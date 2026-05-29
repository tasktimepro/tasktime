/**
 * Email service — sends invoice emails via the Cloudflare Worker
 */

import { SYNC_WORKER_CONFIG } from '@/config/google';
import type { EmailSendType } from './emailTemplateUtils';

export interface SendInvoiceEmailParams {
    sessionId: string;
    invoiceId: string;
    invoiceNumber: string;
    to: string;
    fromName?: string;
    subject: string;
    bodyText: string;
    replyTo?: string;
    pdfBase64: string;
    sendType: EmailSendType;
    attachmentTitle?: string;
}

export interface SendInvoiceEmailResult {
    success: boolean;
    remaining?: number;
}

export type EmailSendError =
    | { type: 'auth'; message: string }
    | { type: 'quota_exceeded'; remaining: number; message: string }
    | { type: 'already_sent'; message: string }
    | { type: 'validation'; message: string }
    | { type: 'provider'; message: string }
    | { type: 'network'; message: string };

/**
 * Send an invoice email via the Worker endpoint
 */
export async function sendInvoiceEmail(
    params: SendInvoiceEmailParams
): Promise<SendInvoiceEmailResult> {

    const workerUrl = SYNC_WORKER_CONFIG.workerUrl;

    if (!workerUrl) {
        throw createEmailError('network', 'Sync worker URL is not configured');
    }

    const body = JSON.stringify({
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
        to: params.to,
        fromName: params.fromName,
        subject: params.subject,
        bodyText: params.bodyText,
        replyTo: params.replyTo,
        pdfBase64: params.pdfBase64,
        sendType: params.sendType,
        attachmentTitle: params.attachmentTitle,
    });

    let response: Response;

    try {
        response = await fetch(`${workerUrl}/email/invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': params.sessionId,
            },
            body,
        });
    } catch {
        throw createEmailError('network', 'Unable to reach the email service. Check your connection and try again.');
    }

    if (response.ok) {
        const data = await response.json();
        return { success: true, remaining: data.remaining };
    }

    // Parse structured error from Worker
    let errorData: { error?: string; details?: string; message?: string; remaining?: number } | undefined;

    try {
        errorData = await response.json();
    } catch {
        // Non-JSON response
    }

    const errorCode = errorData?.error || '';
    const details = errorData?.details || errorData?.message || errorData?.error || '';

    if (response.status === 401 || response.status === 403) {
        throw createEmailError('auth', details || 'Session expired. Please reconnect cloud sync.');
    }

    if (errorCode === 'quota_exceeded') {
        throw createEmailError('quota_exceeded', 'Monthly email limit reached', errorData?.remaining ?? 0);
    }

    if (errorCode === 'already_sent') {
        throw createEmailError('already_sent', 'This invoice has already been emailed');
    }

    if (response.status === 400) {
        throw createEmailError('validation', details || 'Invalid email request');
    }

    if (response.status >= 500) {
        throw createEmailError('provider', details || 'Email service error. Please try again later.');
    }

    throw createEmailError('network', details || `Unexpected error (${response.status})`);
}

function createEmailError(type: 'quota_exceeded', message: string, remaining: number): EmailSendError;
function createEmailError(type: Exclude<EmailSendError['type'], 'quota_exceeded'>, message: string): EmailSendError;
function createEmailError(type: EmailSendError['type'], message: string, remaining?: number): EmailSendError {

    if (type === 'quota_exceeded') {
        return { type, message, remaining: remaining ?? 0 };
    }

    return { type, message } as EmailSendError;
}

/**
 * Type guard for EmailSendError
 */
export function isEmailSendError(error: unknown): error is EmailSendError {
    return typeof error === 'object' && error !== null && 'type' in error && 'message' in error;
}
