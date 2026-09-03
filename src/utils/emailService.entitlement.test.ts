import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
    find: vi.fn(),
    store: vi.fn(),
    update: vi.fn(),
}));
const controls = vi.hoisted(() => ({ sandbox: false }));

vi.mock('@/config/syncWorker', () => ({
    SYNC_WORKER_CONFIG: { workerUrl: 'https://sync.test.worker' },
}));
vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: {
        emailEntitlementEnforcement: true,
        get sandbox() {
            return controls.sandbox;
        },
    },
}));
vi.mock('@/utils/debugbundle', () => ({ captureDebugBundleIncident: vi.fn() }));
vi.mock('./emailAttemptStorage', () => ({
    findBoundEmailAttemptByIdempotency: storage.find,
    storeEmailAttempt: storage.store,
    updateEmailAttemptState: storage.update,
}));

import {
    checkEmailAttemptStatus,
    parseEmailAttemptProjection,
    sendInvoiceEmail,
} from './emailService';

const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf44';
const lifecycle = { provider: 'dropbox' as const, generation: 3, sessionId: 'session-3' };
const projection = {
    version: 1,
    attemptId,
    state: 'completed',
    primary: {
        outcome: 'accepted',
        acceptedAt: '2026-08-30T08:00:00.000Z',
        reason: null,
    },
    forward: null,
    quota: {
        entitled: true,
        effectiveRemaining: 9,
        periodEnd: '2026-09-01T00:00:00.000Z',
        awaitingConfirmation: 0,
    },
};

describe('entitled email client boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        controls.sandbox = false;
        storage.find.mockResolvedValue(null);
        storage.store.mockResolvedValue(undefined);
        storage.update.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('persists a lifecycle-bound attempt before sending and accepts only the exact projection', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(projection), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).resolves.toEqual({
            success: true,
            remaining: 9,
            attemptId,
            attemptState: 'completed',
        });
        expect(storage.store).toHaveBeenCalledWith(expect.objectContaining({
            attemptId,
            documentId: 'invoice-1',
            lifecycle,
        }));
        expect(storage.store.mock.invocationCallOrder[0])
            .toBeLessThan((fetch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    });

    it('rejects the local billing sandbox before persistence or any hosted-email request', async () => {
        controls.sandbox = true;
        vi.stubGlobal('fetch', vi.fn());

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            billingLifecycle: lifecycle,
        })).rejects.toMatchObject({
            type: 'auth',
            message: 'Hosted Send is temporarily unavailable.',
        });
        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({
            type: 'auth',
            message: 'Delivery status is temporarily unavailable.',
        });
        expect(storage.find).not.toHaveBeenCalled();
        expect(storage.store).not.toHaveBeenCalled();
        expect(storage.update).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fails closed on extra fields or inconsistent aggregate state', () => {
        expect(() => parseEmailAttemptProjection({ ...projection, providerId: 'forbidden' }, attemptId))
            .toThrow(expect.objectContaining({ type: 'provider' }));
        expect(() => parseEmailAttemptProjection({ ...projection, state: 'pending' }, attemptId))
            .toThrow(expect.objectContaining({ type: 'provider' }));
        expect(() => parseEmailAttemptProjection({
            ...projection,
            quota: { ...projection.quota, awaitingConfirmation: 1 },
        }, attemptId)).toThrow(expect.objectContaining({ type: 'provider' }));
    });

    it('treats an unreadable post-send response as pending instead of replaying', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(65_537), {
            status: 200,
        })));

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({ type: 'pending', attemptId });
    });

    it('checks durable status without creating a new attempt', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(projection), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).resolves.toEqual(projection);
        expect(storage.store).not.toHaveBeenCalled();
        expect(storage.update).toHaveBeenCalledWith(attemptId, lifecycle, 'completed');
    });

    it('rejects a status check for a mismatched lifecycle before making a request', async () => {
        vi.stubGlobal('fetch', vi.fn());

        await expect(checkEmailAttemptStatus({
            sessionId: 'different-session',
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type: 'auth' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('maps durable status authentication and network failures without replaying a send', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response('', { status: 403 }))
            .mockRejectedValueOnce(new TypeError('offline')));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type: 'auth' });
        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type: 'network' });
        expect(storage.store).not.toHaveBeenCalled();
    });
});
