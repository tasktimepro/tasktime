import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    sendInvoiceEmail,
    isEmailSendError,
    type EmailSendError,
    type SendInvoiceEmailParams,
} from './emailService';

const { captureDebugBundleIncidentSpy } = vi.hoisted(() => ({
    captureDebugBundleIncidentSpy: vi.fn(),
}));

vi.mock('@/config/google', () => ({
    SYNC_WORKER_CONFIG: {
        workerUrl: 'https://sync.test.worker',
    },
}));

vi.mock('@/utils/debugbundle', () => ({
    captureDebugBundleIncident: captureDebugBundleIncidentSpy,
}));

const validParams: SendInvoiceEmailParams = {
    sessionId: 'sess-123',
    invoiceId: 'inv-1',
    invoiceNumber: 'INV-001',
    to: 'client@example.com',
    subject: 'Invoice INV-001',
    bodyText: 'Please find attached...',
    pdfBase64: 'JVBERi0=',
    sendType: 'invoice',
};

const fetchMock = vi.fn<typeof fetch>();

function createJsonResponse(body: unknown, init?: ResponseInit): Response {

    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        ...init,
    });
}

function getFetchCall(): { url: string | URL | Request; options: RequestInit } {

    const [url, options] = fetchMock.mock.calls[0] ?? [];

    if (!url || !options) {
        throw new Error('Expected fetch to be called with request options');
    }

    return { url, options };
}

function expectEmailSendError(error: unknown): EmailSendError {

    expect(isEmailSendError(error)).toBe(true);

    if (!isEmailSendError(error)) {
        throw error;
    }

    return error;
}

describe('sendInvoiceEmail', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('sends successfully and returns remaining count', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 7 }));

        const result = await sendInvoiceEmail(validParams);

        expect(result).toEqual({ success: true, remaining: 7 });
        expect(fetchMock).toHaveBeenCalledOnce();

        const { url, options } = getFetchCall();
        expect(url).toBe('https://sync.test.worker/email/invoice');
        expect(options.method).toBe('POST');
        expect(new Headers(options.headers).get('X-Session-Id')).toBe('sess-123');
        expect(new Headers(options.headers).get('Content-Type')).toBe('application/json');

        const body = JSON.parse(String(options.body));
        expect(body.invoiceId).toBe('inv-1');
        expect(body.to).toBe('client@example.com');
        expect(body.sendType).toBe('invoice');
    });

    it('includes replyTo when provided', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 9 }));

        await sendInvoiceEmail({ ...validParams, replyTo: 'me@business.com' });

        const body = JSON.parse(String(getFetchCall().options.body));
        expect(body.replyTo).toBe('me@business.com');
    });

    it('includes fromName when provided', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 9 }));

        await sendInvoiceEmail({ ...validParams, fromName: 'Jane at Acme' });

        const body = JSON.parse(String(getFetchCall().options.body));
        expect(body.fromName).toBe('Jane at Acme');
    });

    it('includes attachmentTitle when provided', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 9 }));

        await sendInvoiceEmail({ ...validParams, attachmentTitle: 'custom-invoice.pdf' });

        const body = JSON.parse(String(getFetchCall().options.body));
        expect(body.attachmentTitle).toBe('custom-invoice.pdf');
    });

    it('includes forwardTo when provided', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 8, forwarded: true }));

        const result = await sendInvoiceEmail({ ...validParams, forwardTo: 'me@business.com' });

        const body = JSON.parse(String(getFetchCall().options.body));
        expect(body.forwardTo).toBe('me@business.com');
        expect(result).toEqual({ success: true, remaining: 8, forwarded: true });
    });

    it('passes quote sendType through unchanged', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ success: true, remaining: 9 }));

        await sendInvoiceEmail({
            ...validParams,
            invoiceId: 'quote-proj-1',
            invoiceNumber: '28123045',
            subject: 'Quote 28123045',
            sendType: 'quote',
            attachmentTitle: 'quote-28123045.pdf',
        });

        const body = JSON.parse(String(getFetchCall().options.body));
        expect(body.sendType).toBe('quote');
        expect(body.attachmentTitle).toBe('quote-28123045.pdf');
    });

    it('throws auth error on 401', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            { error: 'unauthorized', details: 'Session expired' },
            { status: 401 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('auth');
            expect(error.message).toBe('Session expired');
        }
    });

    it('throws auth error on 403', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ error: 'forbidden' }, { status: 403 }));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(expectEmailSendError(err).type).toBe('auth');
        }
    });

    it('throws quota_exceeded error with remaining count', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            { error: 'quota_exceeded', remaining: 0 },
            { status: 429 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('quota_exceeded');

            if (error.type !== 'quota_exceeded') {
                expect.unreachable('expected quota_exceeded error');
            }

            expect(error.remaining).toBe(0);
            expect(error.message).toContain('Monthly email limit');
        }
    });

    it('preserves quota details from the worker response', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            {
                error: 'quota_exceeded',
                remaining: 1,
                details: 'Forwarding a copy requires 2 emails, but only 1 email remains this month.',
            },
            { status: 429 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('quota_exceeded');

            if (error.type !== 'quota_exceeded') {
                expect.unreachable('expected quota_exceeded error');
            }

            expect(error.remaining).toBe(1);
            expect(error.message).toBe('Forwarding a copy requires 2 emails, but only 1 email remains this month.');
        }
    });

    it('throws already_sent error', async () => {

        fetchMock.mockResolvedValue(createJsonResponse({ error: 'already_sent' }, { status: 409 }));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('already_sent');
            expect(error.message).toContain('already been emailed');
        }
    });

    it('throws validation error on 400', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            { error: 'validation', details: 'Invalid email address' },
            { status: 400 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('validation');
            expect(error.message).toBe('Invalid email address');
        }
    });

    it('falls back to worker error text on 400 when details is missing', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            { error: 'Invalid invoiceNumber' },
            { status: 400 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('validation');
            expect(error.message).toBe('Invalid invoiceNumber');
        }
    });

    it('throws provider error on 500', async () => {

        fetchMock.mockResolvedValue(createJsonResponse(
            { error: 'email_failed', details: 'Resend rejected' },
            { status: 500 }
        ));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(expectEmailSendError(err).type).toBe('provider');
        }

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'invoice.email_send_provider_failed',
            context: expect.objectContaining({
                sendType: 'invoice',
                status: 500,
            }),
        }));
    });

    it('throws network error when fetch fails', async () => {

        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('network');
            expect(error.message).toContain('Unable to reach');
        }

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'invoice.email_send_network_failed',
            context: expect.objectContaining({
                sendType: 'invoice',
                workerConfigured: true,
            }),
        }));
    });

    it('handles non-JSON error response gracefully', async () => {

        fetchMock.mockResolvedValue(new Response('not json', { status: 502 }));

        try {
            await sendInvoiceEmail(validParams);
            expect.unreachable('should have thrown');
        } catch (err) {
            const error = expectEmailSendError(err);
            expect(error.type).toBe('provider');
            expect(error.message).toContain('Email service error');
        }

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'invoice.email_send_provider_failed',
            context: expect.objectContaining({
                status: 502,
            }),
        }));
    });

    it('does not capture incidents for validation or already-sent business responses', async () => {

        fetchMock
            .mockResolvedValueOnce(createJsonResponse(
                { error: 'validation', details: 'Invalid email address' },
                { status: 400 }
            ))
            .mockResolvedValueOnce(createJsonResponse({ error: 'already_sent' }, { status: 409 }));

        await expect(sendInvoiceEmail(validParams)).rejects.toMatchObject({
            type: 'validation',
        });
        await expect(sendInvoiceEmail(validParams)).rejects.toMatchObject({
            type: 'already_sent',
        });

        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalled();
    });
});

describe('isEmailSendError', () => {

    it('returns true for EmailSendError objects', () => {
        expect(isEmailSendError({ type: 'auth', message: 'test' })).toBe(true);
        expect(isEmailSendError({ type: 'quota_exceeded', message: 'test', remaining: 0 })).toBe(true);
    });

    it('returns false for non-error objects', () => {
        expect(isEmailSendError(null)).toBe(false);
        expect(isEmailSendError(new Error('test'))).toBe(false);
        expect(isEmailSendError('string')).toBe(false);
        expect(isEmailSendError({ foo: 'bar' })).toBe(false);
    });
});
