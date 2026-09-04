/**
 * Email service — sends invoice emails via the Cloudflare Worker
 */

import { SYNC_WORKER_CONFIG } from '@/config/syncWorker';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import type { EmailSendType } from './emailTemplateUtils';
import type { BillingLifecycle } from './billingStorage';
import {
    EmailAttemptBindingConflictError,
    EmailAttemptCapacityError,
    findBoundEmailAttemptByIdempotency,
    rebindEmailAttemptAfterOwnedStatus,
    releasePendingEmailAttemptWithoutDurableEvidence,
    storeEmailAttemptWithDisposition,
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
    documentSnapshot: unknown;
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
    primaryAcceptedAt?: string;
}

export type EmailSendError =
    | { type: 'auth'; message: string }
    | { type: 'quota_exceeded'; remaining: number; message: string }
    | { type: 'rate_limited'; message: string }
    | { type: 'already_sent'; message: string }
    | { type: 'validation'; message: string }
    | { type: 'provider'; message: string }
    | { type: 'entitlement_required'; message: string }
    | { type: 'billing_suspended'; message: string }
    | { type: 'client_upgrade_required'; message: string }
    | { type: 'attempt_capacity'; message: string }
    | { type: 'attempt_conflict'; message: string }
    | { type: 'attempt_dormant'; message: string; attemptId: string }
    | { type: 'attempt_not_found'; message: string }
    | { type: 'pending'; message: string; attemptId: string; primaryAcceptedAt?: string }
    | { type: 'network'; message: string };

const EMAIL_INCIDENT_THROTTLE_MS = 15 * 60 * 1000;
const EMAIL_RESPONSE_MAX_BYTES = 65_536;
const EMAIL_SEND_RETRY_DELAY_MS = 250;

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
        void response.body?.cancel().catch(() => undefined);
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
    const requestedAttemptId = entitledFlow ? (params.attemptId ?? crypto.randomUUID()) : null;
    const idempotencyKey = entitledFlow ? (params.idempotencyKey ?? requestedAttemptId!) : null;
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
        const recoveredAttemptId = params.attemptId ?? existing?.attemptId ?? requestedAttemptId!;
        params = { ...params, attemptId: recoveredAttemptId };
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
    let localAttemptWasCreated = false;
    if (entitledFlow) {
        try {
            const stored = await storeEmailAttemptWithDisposition({
                lifecycle: params.billingLifecycle!,
                attemptId: attemptId!,
                sendType: params.sendType,
                idempotencyKey: idempotencyKey!,
                documentId: params.invoiceId,
                serializedPayload: body,
                documentSnapshot: params.documentSnapshot,
            });
            localAttemptWasCreated = stored.created;
        } catch (error) {
            if (error instanceof EmailAttemptBindingConflictError
                || (isRecord(error) && error.code === 'EMAIL_ATTEMPT_BINDING_CONFLICT')) {
                throw createEmailError(
                    'attempt_conflict',
                    'TaskTime could not safely resume this email attempt. Close this draft and reopen it before trying again.',
                );
            }
            if (error instanceof EmailAttemptCapacityError
                || (isRecord(error) && error.code === 'EMAIL_ATTEMPT_CAPACITY')) {
                throw createEmailError(
                    'attempt_capacity',
                    'TaskTime must finish reconciling earlier email deliveries before another send can start.',
                );
            }
            throw error;
        }
    }

    let response: Response | null = null;
    let responseData: unknown;
    let lastPendingProjection: EmailAttemptProjectionV1 | null = null;

    let requestError: unknown = null;
    for (let requestIndex = 0; requestIndex < (entitledFlow ? 2 : 1); requestIndex += 1) {
        let shouldRetry = false;
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
            requestError = null;
            if (entitledFlow && requestIndex === 0) {
                shouldRetry = response.status >= 500;
                if (response.status === 202) {
                    const pendingProjection = parseEmailAttemptProjection(responseData, attemptId!);
                    const hasPendingPart = pendingProjection.primary.outcome === 'pending'
                        || pendingProjection.forward?.outcome === 'pending';
                    if (pendingProjection.state === 'pending' || hasPendingPart) {
                        lastPendingProjection = pendingProjection;
                        await updateEmailAttemptState(
                            attemptId!,
                            params.billingLifecycle!,
                            pendingProjection.state,
                        );
                        shouldRetry = true;
                    }
                }
            }
            if (!shouldRetry) break;
        } catch (error) {
            requestError = error;
            if (!(entitledFlow && requestIndex === 0)) break;
        }
        await new Promise(resolve => window.setTimeout(resolve, EMAIL_SEND_RETRY_DELAY_MS));
    }

    if (requestError) {
        const error = requestError;
        if (entitledFlow && attemptId) {
            const pending = createPendingEmailError(
                attemptId,
                'Delivery confirmation is pending. Check this attempt before starting another send.',
                lastPendingProjection?.primary.outcome === 'accepted'
                    ? lastPendingProjection.primary.acceptedAt!
                    : undefined,
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

    if (!response) {
        throw createEmailError('network', 'Unable to reach the email service. Check your connection and try again.');
    }

    if (response.ok && entitledFlow) {
        let data: EmailAttemptProjectionV1;
        try {
            data = parseEmailAttemptProjection(responseData, attemptId!);
        } catch {
            throw createPendingEmailError(
                attemptId!,
                'Delivery confirmation is pending. Check this attempt before starting another send.',
                lastPendingProjection?.primary.outcome === 'accepted'
                    ? lastPendingProjection.primary.acceptedAt!
                    : undefined,
            );
        }
        await updateEmailAttemptState(
            attemptId!,
            params.billingLifecycle!,
            data.state,
        );
        if (data.state === 'pending'
            || data.primary.outcome === 'pending'
            || data.forward?.outcome === 'pending') {
            throw createPendingEmailError(
                attemptId!,
                'Delivery confirmation is pending. Check this attempt before starting another send.',
                data.primary.outcome === 'accepted' ? data.primary.acceptedAt! : undefined,
            );
        }
        if (data.state === 'rejected' || data.primary.outcome !== 'accepted') {
            throw createEmailError('provider', 'Email delivery was rejected.');
        }
        const result: SendInvoiceEmailResult = {
            success: true,
            remaining: data.quota.effectiveRemaining,
            attemptId: attemptId!,
            attemptState: data.state as 'partial' | 'completed',
            primaryAcceptedAt: data.primary.acceptedAt!,
        };
        if (params.forwardTo) result.forwarded = data.forward?.outcome === 'accepted';
        return result;
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
    const releaseFreshLocalAttempt = async () => {
        if (entitledFlow && attemptId && localAttemptWasCreated) {
            await releasePendingEmailAttemptWithoutDurableEvidence(
                attemptId,
                params.billingLifecycle!,
            );
        }
    };

    if (errorCode === 'ENTITLEMENT_REQUIRED' || errorCode === 'BILLING_SUSPENDED') {
        await releaseFreshLocalAttempt();
        throw createEmailError(
            errorCode === 'ENTITLEMENT_REQUIRED' ? 'entitlement_required' : 'billing_suspended',
            errorCode === 'ENTITLEMENT_REQUIRED'
                ? 'Hosted email sending requires a Pro trial or subscription.'
                : 'Resolve billing before starting a new hosted email send.',
        );
    }

    if (response.status === 401 || response.status === 403) {
        await releaseFreshLocalAttempt();
        throw createEmailError('auth', details || 'Session expired. Please reconnect cloud sync.');
    }

    if (errorCode === 'quota_exceeded' || errorCode === 'QUOTA_EXCEEDED') {
        await releaseFreshLocalAttempt();
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
        await releaseFreshLocalAttempt();
        throw createEmailError('already_sent', 'This invoice has already been emailed');
    }

    if (errorCode === 'RATE_LIMITED') {
        await releaseFreshLocalAttempt();
        throw createEmailError('rate_limited', 'Too many hosted email requests. Wait a moment before trying again.');
    }

    if (errorCode === 'IDEMPOTENCY_CONFLICT') {
        await releaseFreshLocalAttempt();
        throw createEmailError(
            'attempt_conflict',
            'This email action no longer matches its original request. Close the draft and reopen it before trying again.',
        );
    }

    if (errorCode === 'CLIENT_UPGRADE_REQUIRED') {
        await releaseFreshLocalAttempt();
        throw createEmailError(
            'client_upgrade_required',
            'Update TaskTime before using hosted email. Your draft and manual delivery options remain available.',
        );
    }

    if (entitledFlow
        && attemptId
        && (errorCode === 'ACCOUNT_OPERATION_IN_PROGRESS'
            || errorCode === 'PROVIDER_IDEMPOTENCY_CONFLICT')) {
        throw createPendingEmailError(
            attemptId,
            'Delivery confirmation is pending. TaskTime will check this attempt before another send can start.',
            lastPendingProjection?.primary.outcome === 'accepted'
                ? lastPendingProjection.primary.acceptedAt!
                : undefined,
        );
    }

    if (response.status === 400) {
        await releaseFreshLocalAttempt();
        throw createEmailError('validation', details || 'Invalid email request');
    }

    if (response.status >= 500) {
        const error = entitledFlow && attemptId
            ? createPendingEmailError(
                attemptId,
                'TaskTime is confirming whether delivery started.',
                lastPendingProjection?.primary.outcome === 'accepted'
                    ? lastPendingProjection.primary.acceptedAt!
                    : undefined,
            )
            : createEmailError('provider', details || 'Email service error. Please try again later.');
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
    recoveryBinding?: {
        kind: 'same-provider-reconnect' | 'cross-provider-status-proof';
        documentId: string;
        sendType: EmailSendType;
    };
}): Promise<EmailAttemptProjectionV1> {
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
        const responseData = await readBoundedResponseJson(response);
        if (!response.ok) {
            const errorCode = isRecord(responseData) && typeof responseData.code === 'string'
                ? responseData.code
                : '';
            if (response.status === 404 && errorCode === 'ATTEMPT_NOT_FOUND') {
                if (input.recoveryBinding) {
                    throw createDormantEmailError(
                        input.attemptId,
                        'Reconnect the cloud account used for this delivery attempt to confirm it.',
                    );
                }
                const released = await releasePendingEmailAttemptWithoutDurableEvidence(
                    input.attemptId,
                    input.billingLifecycle,
                );
                if (released) {
                    throw createEmailError(
                        'attempt_not_found',
                        'No hosted send was started. You can send this email now.',
                    );
                }
            }
            throw createEmailError(
                response.status === 401 || response.status === 403 ? 'auth' : 'provider',
                'Delivery status could not be confirmed.',
            );
        }
        const projection = parseEmailAttemptProjection(responseData, input.attemptId);
        if (input.recoveryBinding) {
            const rebound = await rebindEmailAttemptAfterOwnedStatus({
                attemptId: input.attemptId,
                lifecycle: input.billingLifecycle,
                documentId: input.recoveryBinding.documentId,
                sendType: input.recoveryBinding.sendType,
                state: projection.state,
                allowProviderChange: input.recoveryBinding.kind === 'cross-provider-status-proof',
            });
            if (!rebound) {
                throw createDormantEmailError(
                    input.attemptId,
                    'Reconnect the cloud account used for this delivery attempt to confirm it.',
                );
            }
        } else {
            await updateEmailAttemptState(
                input.attemptId,
                input.billingLifecycle,
                projection.state,
            );
        }
        return projection;
    } catch (error) {
        if (isEmailSendError(error)) throw error;
        throw createEmailError('network', 'Delivery status could not be confirmed. Try again when online.');
    } finally {
        window.clearTimeout(timeout);
    }
}

function createEmailError(type: 'quota_exceeded', message: string, remaining: number): EmailSendError;
function createEmailError(
    type: Exclude<EmailSendError['type'], 'quota_exceeded' | 'pending' | 'attempt_dormant'>,
    message: string,
): EmailSendError;
function createEmailError(type: EmailSendError['type'], message: string, remaining?: number): EmailSendError {

    if (type === 'quota_exceeded') {
        return { type, message, remaining: remaining ?? 0 };
    }

    return { type, message } as EmailSendError;
}

function createPendingEmailError(
    attemptId: string,
    message: string,
    primaryAcceptedAt?: string,
): EmailSendError {
    return {
        type: 'pending',
        attemptId,
        message,
        ...(primaryAcceptedAt ? { primaryAcceptedAt } : {}),
    };
}

function createDormantEmailError(attemptId: string, message: string): EmailSendError {
    return { type: 'attempt_dormant', attemptId, message };
}

/**
 * Type guard for EmailSendError
 */
export function isEmailSendError(error: unknown): error is EmailSendError {
    return typeof error === 'object' && error !== null && 'type' in error && 'message' in error;
}
