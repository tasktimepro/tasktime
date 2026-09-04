import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
    find: vi.fn(),
    rebind: vi.fn(),
    release: vi.fn(),
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
    EmailAttemptBindingConflictError: class EmailAttemptBindingConflictError extends Error {},
    EmailAttemptCapacityError: class EmailAttemptCapacityError extends Error {},
    findBoundEmailAttemptByIdempotency: storage.find,
    rebindEmailAttemptAfterOwnedStatus: storage.rebind,
    releasePendingEmailAttemptWithoutDurableEvidence: storage.release,
    storeEmailAttemptWithDisposition: storage.store,
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
        storage.rebind.mockResolvedValue(true);
        storage.release.mockResolvedValue(true);
        storage.store.mockResolvedValue({ created: true, record: {} });
        storage.update.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).resolves.toEqual({
            success: true,
            remaining: 9,
            attemptId,
            attemptState: 'completed',
            primaryAcceptedAt: projection.primary.acceptedAt,
        });
        expect(storage.store).toHaveBeenCalledWith(expect.objectContaining({
            attemptId,
            documentId: 'invoice-1',
            lifecycle,
            documentSnapshot: { id: 'invoice-1', total: 100 },
            serializedPayload: expect.any(String),
        }));
        expect(storage.store.mock.calls[0][0].serializedPayload)
            .toBe((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(JSON.parse(storage.store.mock.calls[0][0].serializedPayload))
            .not.toHaveProperty('documentSnapshot');
        expect(storage.store.mock.invocationCallOrder[0])
            .toBeLessThan((fetch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    });

    it('uses the entitled hosted-email boundary in the local billing sandbox', async () => {
        controls.sandbox = true;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
            new Response(JSON.stringify(projection), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        )));

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'sandbox-idempotency-key-1234',
        })).resolves.toEqual({
            success: true,
            remaining: 9,
            attemptId,
            attemptState: 'completed',
            primaryAcceptedAt: projection.primary.acceptedAt,
        });
        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).resolves.toEqual(projection);
        expect(storage.store).toHaveBeenCalledWith(expect.objectContaining({
            attemptId,
            documentId: 'invoice-1',
            lifecycle,
        }));
        expect(storage.update).toHaveBeenCalledWith(attemptId, lifecycle, 'completed');
        expect(fetch).toHaveBeenCalledTimes(2);
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

    it('keeps the local attempt protected when a successful send response is malformed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            success: true,
        }), {
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({ type: 'pending', attemptId });
    });

    it('keeps an unreadable post-send response protected after one exact bounded replay', async () => {
        const request = vi.fn().mockImplementation(() => Promise.resolve(
            new Response('x'.repeat(65_537), { status: 200 }),
        ));
        vi.stubGlobal('fetch', request);

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({ type: 'pending', attemptId });
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
    });

    it('treats an entitled-send server failure as pending until durable status is checked', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            code: 'BILLING_UNAVAILABLE',
            recovery: { kind: 'retry', retryable: true },
        }), {
            status: 503,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({
            type: 'pending',
            attemptId,
        });
        expect(storage.update).not.toHaveBeenCalled();
        expect(storage.release).not.toHaveBeenCalled();
    });

    it('automatically retries the exact serialized request once after a retryable server failure', async () => {
        vi.useFakeTimers();
        const request = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                version: 1,
                code: 'EMAIL_UNAVAILABLE',
                recovery: { kind: 'retry', retryable: true },
            }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify(projection), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', request);

        const assertion = expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).resolves.toMatchObject({
            attemptId,
            primaryAcceptedAt: projection.primary.acceptedAt,
        });

        await vi.runAllTimersAsync();
        await assertion;
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
        expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        });
    });

    it('replays the exact serialized request once when the first accepted request is still pending', async () => {
        vi.useFakeTimers();
        const pendingProjection = {
            ...projection,
            state: 'pending',
            primary: { outcome: 'pending', acceptedAt: null, reason: null },
            quota: { ...projection.quota, awaitingConfirmation: 1 },
        };
        const request = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(pendingProjection), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify(projection), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', request);

        const assertion = expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).resolves.toMatchObject({
            attemptId,
            primaryAcceptedAt: projection.primary.acceptedAt,
        });

        await vi.runAllTimersAsync();
        await assertion;
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
        expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        });
    });

    it('uses the attempt id as the default idempotency key so one click cannot create a second operation', async () => {
        const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(projection), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', request);

        await sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
        });

        expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
            attemptId,
            idempotencyKey: attemptId,
        });
    });

    it('keeps an accepted primary pending while its requested forward copy is unresolved', async () => {
        const partialPending = {
            ...projection,
            state: 'partial',
            forward: { outcome: 'pending', acceptedAt: null, reason: null },
            quota: { ...projection.quota, awaitingConfirmation: 1 },
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(partialPending), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            forwardTo: 'owner@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({
            type: 'pending',
            attemptId,
            primaryAcceptedAt: partialPending.primary.acceptedAt,
        });
        expect(storage.update).toHaveBeenCalledWith(attemptId, lifecycle, 'partial');
    });

    it.each([
        'ACCOUNT_OPERATION_IN_PROGRESS',
        'PROVIDER_IDEMPOTENCY_CONFLICT',
    ])('keeps the current attempt protected for retry-safe Worker conflict %s', async (code) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            code,
            recovery: { kind: 'retry', retryable: true },
        }), {
            status: 409,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({ type: 'pending', attemptId });
        expect(fetch).toHaveBeenCalledOnce();
        expect(storage.update).not.toHaveBeenCalled();
        expect(storage.release).not.toHaveBeenCalled();
    });

    it('preserves an accepted primary when a same-click replay meets an operation conflict', async () => {
        vi.useFakeTimers();
        const partialPending = {
            ...projection,
            state: 'partial',
            forward: { outcome: 'pending', acceptedAt: null, reason: null },
            quota: { ...projection.quota, awaitingConfirmation: 1 },
        };
        const request = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(partialPending), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                version: 1,
                code: 'ACCOUNT_OPERATION_IN_PROGRESS',
                recovery: { kind: 'retry', retryable: true },
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', request);

        const assertion = expect(sendInvoiceEmail({
            sessionId: lifecycle.sessionId,
            invoiceId: 'invoice-1',
            invoiceNumber: 'INV-1',
            to: 'client@example.com',
            forwardTo: 'owner@example.com',
            subject: 'Invoice',
            bodyText: 'Attached.',
            pdfBase64: 'JVBERi0=',
            sendType: 'invoice',
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
            idempotencyKey: 'idempotency-key-1234',
        })).rejects.toMatchObject({
            type: 'pending',
            attemptId,
            primaryAcceptedAt: partialPending.primary.acceptedAt,
        });

        await vi.runAllTimersAsync();
        await assertion;
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('blocks a new provider request when local unresolved-attempt capacity is full', async () => {
        storage.store.mockRejectedValueOnce({ code: 'EMAIL_ATTEMPT_CAPACITY' });
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
        })).rejects.toMatchObject({ type: 'attempt_capacity' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('maps the enforcement cutover upgrade response without leaving a fresh attempt protected', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            code: 'CLIENT_UPGRADE_REQUIRED',
            message: 'Upgrade required.',
        }), {
            status: 426,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({
            type: 'client_upgrade_required',
            message: expect.stringMatching(/update TaskTime.*manual delivery/i),
        });
        expect(storage.release).toHaveBeenCalledWith(attemptId, lifecycle);
    });

    it.each([
        ['ENTITLEMENT_REQUIRED', 'entitlement_required'],
        ['BILLING_SUSPENDED', 'billing_suspended'],
    ])('maps typed 403 %s responses before generic cloud-session authentication', async (code, type) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            code,
            message: 'Worker-specific billing guidance.',
        }), {
            status: 403,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type });
        expect(storage.release).toHaveBeenCalledWith(attemptId, lifecycle);
    });

    it.each([
        ['QUOTA_EXCEEDED', 429, 'quota_exceeded'],
        ['ALREADY_SENT', 409, 'already_sent'],
        ['INVALID_REQUEST', 400, 'validation'],
        ['RATE_LIMITED', 429, 'rate_limited'],
        ['IDEMPOTENCY_CONFLICT', 409, 'attempt_conflict'],
    ])('releases a fresh local marker for deterministic %s responses', async (code, status, type) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            code,
            message: 'Deterministic pre-attempt response.',
            ...(code === 'QUOTA_EXCEEDED' ? { remaining: 0 } : {}),
        }), {
            status,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type });
        expect(storage.release).toHaveBeenCalledWith(attemptId, lifecycle);
    });

    it('does not release a pre-existing local marker for a deterministic response', async () => {
        storage.store.mockResolvedValueOnce({ created: false, record: {} });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            code: 'QUOTA_EXCEEDED',
            remaining: 0,
        }), {
            status: 429,
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
            documentSnapshot: { id: 'invoice-1', total: 100 },
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type: 'quota_exceeded' });
        expect(storage.release).not.toHaveBeenCalled();
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

    it('rebinds a dormant same-provider attempt only after current-account status proves ownership', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(projection), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
            recoveryBinding: {
                kind: 'same-provider-reconnect',
                documentId: 'invoice-1',
                sendType: 'invoice',
            },
        })).resolves.toEqual(projection);
        expect(storage.rebind).toHaveBeenCalledWith({
            attemptId,
            lifecycle,
            documentId: 'invoice-1',
            sendType: 'invoice',
            state: 'completed',
            allowProviderChange: false,
        });
        expect(storage.update).not.toHaveBeenCalled();
    });

    it('rebinds a cross-provider attempt only after current-account status proves transfer ownership', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(projection), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
            recoveryBinding: {
                kind: 'cross-provider-status-proof',
                documentId: 'invoice-1',
                sendType: 'invoice',
            },
        })).resolves.toEqual(projection);
        expect(storage.rebind).toHaveBeenCalledWith({
            attemptId,
            lifecycle,
            documentId: 'invoice-1',
            sendType: 'invoice',
            state: 'completed',
            allowProviderChange: true,
        });
        expect(storage.update).not.toHaveBeenCalled();
    });

    it('keeps a dormant attempt unchanged when the current account cannot prove ownership', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            code: 'ATTEMPT_NOT_FOUND',
            recovery: { kind: 'unavailable', retryable: false },
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
            recoveryBinding: {
                kind: 'same-provider-reconnect',
                documentId: 'invoice-1',
                sendType: 'invoice',
            },
        })).rejects.toMatchObject({ type: 'attempt_dormant' });
        expect(storage.rebind).not.toHaveBeenCalled();
        expect(storage.update).not.toHaveBeenCalled();
    });

    it('releases only the lifecycle-bound local marker when no durable attempt exists', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            code: 'ATTEMPT_NOT_FOUND',
            recovery: { kind: 'unavailable', retryable: false },
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({
            type: 'attempt_not_found',
            message: 'No hosted send was started. You can send this email now.',
        });
        expect(storage.store).not.toHaveBeenCalled();
        expect(storage.release).toHaveBeenCalledWith(attemptId, lifecycle);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('keeps local accepted evidence protected when a stale not-found response cannot release it', async () => {
        storage.release.mockResolvedValueOnce(false);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            code: 'ATTEMPT_NOT_FOUND',
            recovery: { kind: 'unavailable', retryable: false },
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(checkEmailAttemptStatus({
            sessionId: lifecycle.sessionId,
            billingLifecycle: lifecycle,
            attemptId,
        })).rejects.toMatchObject({ type: 'provider' });
        expect(storage.release).toHaveBeenCalledWith(attemptId, lifecycle);
        expect(storage.update).not.toHaveBeenCalled();
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
