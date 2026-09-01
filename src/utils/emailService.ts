/**
 * Email service — sends invoice emails via the Cloudflare Worker
 */

import { SYNC_WORKER_CONFIG } from '@/config/syncWorker';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import type { EmailSendType } from './emailTemplateUtils';
import type { BillingLifecycle } from './billingStorage';
import {
    findBoundEmailAttemptByIdempotency,
    storeEmailAttempt,
    updateEmailAttemptState,
} from './emailAttemptStorage';

export interface SendInvoiceEmailParams {
    sessionId: string;
    invoiceId: string;
    invoiceNumber: string;
    to: string;
    forwardTo?: string;
    fromName?: string;
    subject: string;
    bodyText: string;
    replyTo?: string;
    pdfBase64: string;
    sendType: EmailSendType;
    attachmentTitle?: string;
    billingLifecycle?: BillingLifecycle;
    attemptId?: string;
    idempotencyKey?: string;
}

export interface SendInvoiceEmailResult {
    success: boolean;
    remaining?: number;
    forwarded?: boolean;
    attemptId?: string;
    attemptState?: 'partial' | 'completed';
}

export type EmailSendError =
    | { type: 'auth'; message: string }
    | { type: 'quota_exceeded'; remaining: number; message: string }
    | { type: 'already_sent'; message: string }
    | { type: 'validation'; message: string }
    | { type: 'provider'; message: string }
    | { type: 'entitlement_required'; message: string }
    | { type: 'billing_suspended'; message: string }
    | { type: 'pending'; message: string; attemptId: string }
    | { type: 'network'; message: string };

const EMAIL_INCIDENT_THROTTLE_MS = 15 * 60 * 1000;
const EMAIL_RESPONSE_MAX_BYTES = 65_536;

export interface EmailAttemptProjectionV1 {
    version: 1;
    attemptId: string;
    state: 'pending' | 'partial' | 'completed' | 'rejected';
    primary: EmailAttemptPartProjectionV1;
    forward: EmailAttemptPartProjectionV1 | null;
    quota: {
        entitled: boolean;
        effectiveRemaining: number;
        periodEnd: string;
        awaitingConfirmation: number;
    };
}

type EmailAttemptPartProjectionV1 = {
    outcome: 'pending' | 'accepted' | 'rejected';
    acceptedAt: string | null;
    reason: 'not_sent' | 'provider_rejected' | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
}

function parseAttemptPart(value: unknown): EmailAttemptPartProjectionV1 {
    if (!isRecord(value)
        || !hasExactKeys(value, ['outcome', 'acceptedAt', 'reason'])
        || !['pending', 'accepted', 'rejected'].includes(String(value.outcome))) {
        throw createEmailError('provider', 'Email service returned an invalid attempt status.');
    }
    const outcome = value.outcome as EmailAttemptPartProjectionV1['outcome'];
    const acceptedAt = value.acceptedAt;
    const reason = value.reason;
    const accepted = outcome === 'accepted'
        && typeof acceptedAt === 'string'
        && Number.isFinite(Date.parse(acceptedAt))
        && reason === null;
    const rejected = outcome === 'rejected'
        && acceptedAt === null
        && (reason === 'not_sent' || reason === 'provider_rejected');
    const pending = outcome === 'pending' && acceptedAt === null && reason === null;
    if (!accepted && !rejected && !pending) {
        throw createEmailError('provider', 'Email service returned an invalid attempt status.');
    }
    return { outcome, acceptedAt: acceptedAt as string | null, reason: reason as EmailAttemptPartProjectionV1['reason'] };
}

export function parseEmailAttemptProjection(
    value: unknown,
    expectedAttemptId: string,
): EmailAttemptProjectionV1 {
    if (!isRecord(value)
        || !hasExactKeys(value, ['version', 'attemptId', 'state', 'primary', 'forward', 'quota'])
        || value.version !== 1
        || value.attemptId !== expectedAttemptId
        || !['pending', 'partial', 'completed', 'rejected'].includes(String(value.state))
        || !isRecord(value.quota)
        || !hasExactKeys(value.quota, [
            'entitled', 'effectiveRemaining', 'periodEnd', 'awaitingConfirmation',
        ])
        || typeof value.quota.entitled !== 'boolean'
        || !Number.isSafeInteger(value.quota.effectiveRemaining)
        || Number(value.quota.effectiveRemaining) < 0
        || typeof value.quota.periodEnd !== 'string'
        || !Number.isFinite(Date.parse(value.quota.periodEnd))
        || !Number.isSafeInteger(value.quota.awaitingConfirmation)
        || Number(value.quota.awaitingConfirmation) < 0
        || Number(value.quota.awaitingConfirmation) > 2
        || (!value.quota.entitled && value.quota.effectiveRemaining !== 0)) {
        throw createEmailError('provider', 'Email service returned an invalid attempt status.');
    }
    const primary = parseAttemptPart(value.primary);
    const forward = value.forward === null ? null : parseAttemptPart(value.forward);
    const parts = [primary, ...(forward ? [forward] : [])];
    const accepted = parts.filter(part => part.outcome === 'accepted').length;
    const pending = parts.filter(part => part.outcome === 'pending').length;
    const aggregate = accepted === parts.length
        ? 'completed'
        : accepted > 0
            ? 'partial'
            : pending > 0
                ? 'pending'
                : 'rejected';
    if (value.state !== aggregate || value.quota.awaitingConfirmation !== pending) {
        throw createEmailError('provider', 'Email service returned an invalid attempt status.');
    }
    return {
        version: 1,
        attemptId: expectedAttemptId,
        state: aggregate,
        primary,
        forward,
        quota: value.quota as EmailAttemptProjectionV1['quota'],
    };
}

async function readBoundedResponseJson(response: Response): Promise<unknown> {
    const declared = response.headers.get('Content-Length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > EMAIL_RESPONSE_MAX_BYTES)) {
        throw new Error('EMAIL_RESPONSE_TOO_LARGE');
    }
    if (!response.body) return undefined;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > EMAIL_RESPONSE_MAX_BYTES) {
                await reader.cancel();
                throw new Error('EMAIL_RESPONSE_TOO_LARGE');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        return undefined;
    }
}

function captureInvoiceEmailIncident({
    incidentKey,
    message,
    error,
    context,
}: {
    incidentKey: string;
    message: string;
    error: unknown;
    context: Record<string, boolean | number | string | null>;
}) {

    captureDebugBundleIncident({
        incidentKey,
        name: 'TaskTimeInvoiceEmailFailure',
        message,
        error,
        context,
        throttleMs: EMAIL_INCIDENT_THROTTLE_MS,
    });
}

/**
 * Send an invoice email via the Worker endpoint
 */
export async function sendInvoiceEmail(
    params: SendInvoiceEmailParams
): Promise<SendInvoiceEmailResult> {

    if (BILLING_FEATURES.sandbox) {
        throw createEmailError('auth', 'Hosted Send is disabled in the local billing sandbox.');
    }

    const workerUrl = SYNC_WORKER_CONFIG.workerUrl;
    const incidentContext = {
        sendType: params.sendType,
        hasForwardToCopy: Boolean(params.forwardTo),
        workerConfigured: Boolean(workerUrl),
    };

    if (!workerUrl) {
        const error = createEmailError('network', 'Sync worker URL is not configured');
        captureInvoiceEmailIncident({
            incidentKey: 'invoice.email_send_network_failed',
            message: 'TaskTime Pro invoice email send failed to reach the worker',
            error,
            context: incidentContext,
        });
        throw error;
    }

    const entitledFlow = BILLING_FEATURES.emailEntitlementEnforcement;
    const idempotencyKey = entitledFlow ? (params.idempotencyKey ?? crypto.randomUUID()) : null;
    if (entitledFlow && (!params.billingLifecycle
        || params.billingLifecycle.sessionId !== params.sessionId)) {
        throw createEmailError(
            'auth',
            'Confirm the active TaskTime cloud account before sending hosted email.',
        );
    }
    if (entitledFlow) {
        const existing = await findBoundEmailAttemptByIdempotency(
            params.billingLifecycle!,
            idempotencyKey!,
        );
        const recoveredAttemptId = params.attemptId ?? existing?.attemptId ?? crypto.randomUUID();
        params = { ...params, attemptId: recoveredAttemptId };
        await storeEmailAttempt({
            lifecycle: params.billingLifecycle!,
            attemptId: recoveredAttemptId,
            sendType: params.sendType,
            idempotencyKey: idempotencyKey!,
            documentId: params.invoiceId,
        });
    }
    const attemptId = entitledFlow ? params.attemptId! : null;
    const body = JSON.stringify({
        ...(entitledFlow ? { version: 1, attemptId, idempotencyKey } : {}),
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
        to: params.to,
        forwardTo: params.forwardTo,
        fromName: params.fromName,
        subject: params.subject,
        bodyText: params.bodyText,
        replyTo: params.replyTo,
        pdfBase64: params.pdfBase64,
        sendType: params.sendType,
        attachmentTitle: params.attachmentTitle,
    });

    let response: Response;
    let responseData: unknown;

    try {
        const controller = new AbortController();
        const timeout = entitledFlow ? window.setTimeout(() => controller.abort(), 20_000) : null;
        try {
            response = await fetch(`${workerUrl}/email/invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': params.sessionId,
                },
                body,
                ...(entitledFlow ? { signal: controller.signal } : {}),
            });
            responseData = await readBoundedResponseJson(response);
        } finally {
            if (timeout !== null) window.clearTimeout(timeout);
        }
    } catch (error) {
        if (entitledFlow && attemptId) {
            const pending = createPendingEmailError(
                attemptId,
                'Delivery confirmation is pending. Check this attempt before starting another send.',
            );
            captureInvoiceEmailIncident({
                incidentKey: 'invoice.email_send_confirmation_pending',
                message: 'TaskTime Pro invoice email delivery confirmation is pending',
                error,
                context: incidentContext,
            });
            throw pending;
        }
        const networkError = createEmailError('network', 'Unable to reach the email service. Check your connection and try again.');
        captureInvoiceEmailIncident({
            incidentKey: 'invoice.email_send_network_failed',
            message: 'TaskTime Pro invoice email send failed to reach the worker',
            error,
            context: incidentContext,
        });
        throw networkError;
    }

    if (response.ok && entitledFlow) {
        const data = parseEmailAttemptProjection(responseData, attemptId!);
        await updateEmailAttemptState(
            attemptId!,
            params.billingLifecycle!,
            data.state,
        );
        if (data.state === 'pending') {
            throw createPendingEmailError(
                attemptId!,
                'Delivery confirmation is pending. Check this attempt before starting another send.',
            );
        }
        if (data.state === 'rejected' || data.primary.outcome !== 'accepted') {
            throw createEmailError('provider', 'Email delivery was rejected.');
        }
        return {
            success: true,
            remaining: data.quota.effectiveRemaining,
            forwarded: params.forwardTo ? data.forward?.outcome === 'accepted' : undefined,
            attemptId: attemptId!,
            attemptState: data.state as 'partial' | 'completed',
        };
    }

    if (response.ok) {
        if (!isRecord(responseData)) {
            throw createEmailError('provider', 'Email service returned an invalid response.');
        }
        const result: SendInvoiceEmailResult = {
            success: true,
            remaining: Number.isSafeInteger(responseData.remaining)
                ? Number(responseData.remaining)
                : undefined,
        };

        if (typeof responseData.forwarded === 'boolean') {
            result.forwarded = responseData.forwarded;
        }

        return result;
    }

    // Parse structured error from Worker
    const errorData = isRecord(responseData)
        ? responseData as { error?: string; code?: string; details?: string | Record<string, unknown>; message?: string; remaining?: number }
        : undefined;

    const errorCode = errorData?.code || errorData?.error || '';
    const details = typeof errorData?.details === 'string'
        ? errorData.details
        : errorData?.message || errorData?.error || errorData?.code || '';

    if (response.status === 401 || response.status === 403) {
        throw createEmailError('auth', details || 'Session expired. Please reconnect cloud sync.');
    }

    if (errorCode === 'quota_exceeded' || errorCode === 'QUOTA_EXCEEDED') {
        const quotaMessage = details && details !== errorCode
            ? details
            : 'Monthly email limit reached';
        const projectedRemaining = typeof errorData?.details === 'object'
            && Number.isSafeInteger(errorData.details.remaining)
            ? Number(errorData.details.remaining)
            : errorData?.remaining ?? 0;

        throw createEmailError(
            'quota_exceeded',
            quotaMessage,
            projectedRemaining,
        );
    }

    if (errorCode === 'already_sent' || errorCode === 'ALREADY_SENT') {
        throw createEmailError('already_sent', 'This invoice has already been emailed');
    }

    if (errorCode === 'ENTITLEMENT_REQUIRED') {
        throw createEmailError('entitlement_required', 'Hosted email sending requires a Pro trial or subscription.');
    }

    if (errorCode === 'BILLING_SUSPENDED') {
        throw createEmailError('billing_suspended', 'Resolve billing before starting a new hosted email send.');
    }

    if (response.status === 400) {
        throw createEmailError('validation', details || 'Invalid email request');
    }

    if (response.status >= 500) {
        const error = createEmailError('provider', details || 'Email service error. Please try again later.');
        captureInvoiceEmailIncident({
            incidentKey: 'invoice.email_send_provider_failed',
            message: 'TaskTime Pro invoice email provider request failed',
            error,
            context: {
                ...incidentContext,
                status: response.status,
            },
        });
        throw error;
    }

    const error = createEmailError('network', details || `Unexpected error (${response.status})`);
    captureInvoiceEmailIncident({
        incidentKey: 'invoice.email_send_network_failed',
        message: 'TaskTime Pro invoice email send returned an unexpected worker response',
        error,
        context: {
            ...incidentContext,
            status: response.status,
        },
    });
    throw error;
}

export async function checkEmailAttemptStatus(input: {
    sessionId: string;
    billingLifecycle: BillingLifecycle;
    attemptId: string;
}): Promise<EmailAttemptProjectionV1> {
    if (BILLING_FEATURES.sandbox) {
        throw createEmailError('auth', 'Delivery status is disabled in the local billing sandbox.');
    }
    const workerUrl = SYNC_WORKER_CONFIG.workerUrl;
    if (!workerUrl || input.billingLifecycle.sessionId !== input.sessionId) {
        throw createEmailError('auth', 'Confirm the active TaskTime cloud account before checking delivery.');
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(`${workerUrl}/email/attempt/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': input.sessionId,
            },
            body: JSON.stringify({ version: 1, attemptId: input.attemptId }),
            signal: controller.signal,
        });
        if (!response.ok) throw createEmailError(
            response.status === 401 || response.status === 403 ? 'auth' : 'provider',
            'Delivery status could not be confirmed.',
        );
        const projection = parseEmailAttemptProjection(
            await readBoundedResponseJson(response),
            input.attemptId,
        );
        await updateEmailAttemptState(
            input.attemptId,
            input.billingLifecycle,
            projection.state,
        );
        return projection;
    } catch (error) {
        if (isEmailSendError(error)) throw error;
        throw createEmailError('network', 'Delivery status could not be confirmed. Try again when online.');
    } finally {
        window.clearTimeout(timeout);
    }
}

function createEmailError(type: 'quota_exceeded', message: string, remaining: number): EmailSendError;
function createEmailError(type: Exclude<EmailSendError['type'], 'quota_exceeded' | 'pending'>, message: string): EmailSendError;
function createEmailError(type: EmailSendError['type'], message: string, remaining?: number): EmailSendError {

    if (type === 'quota_exceeded') {
        return { type, message, remaining: remaining ?? 0 };
    }

    return { type, message } as EmailSendError;
}

function createPendingEmailError(attemptId: string, message: string): EmailSendError {
    return { type: 'pending', attemptId, message };
}

/**
 * Type guard for EmailSendError
 */
export function isEmailSendError(error: unknown): error is EmailSendError {
    return typeof error === 'object' && error !== null && 'type' in error && 'message' in error;
}
