import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    findBoundEmailAttemptByIdempotency,
    findBoundUnreconciledEmailAttempt,
    findUnreconciledEmailAttemptForRecovery,
    listBoundEmailAttempts,
    markEmailAttemptMetadataApplied,
    rebindEmailAttemptAfterOwnedStatus,
    releasePendingEmailAttemptWithoutDurableEvidence,
    storeEmailAttempt,
    storeEmailAttemptWithDisposition,
    updateEmailAttemptState,
    validateBoundEmailAttemptDocumentSnapshot,
} from './emailAttemptStorage';

const records = new Map<string, unknown>();
const fingerprintKeys = new Map<string, unknown>();
const attemptEvidence = (documentId: string) => ({
    serializedPayload: JSON.stringify({ documentId }),
    documentSnapshot: { id: documentId },
});
const store = {
    get: vi.fn((key: string) => Promise.resolve(structuredClone(records.get(key)))),
    getAll: vi.fn(() => Promise.resolve([...records.values()].map(value => structuredClone(value)))),
    put: vi.fn((value: unknown, key: string) => {
        records.set(key, structuredClone(value));
        return Promise.resolve(key);
    }),
    delete: vi.fn((key: string) => { records.delete(key); return Promise.resolve(); }),
};
const fingerprintKeyStore = {
    get: vi.fn((key: string) => Promise.resolve(fingerprintKeys.get(key))),
    put: vi.fn((value: unknown, key: string) => {
        fingerprintKeys.set(key, value);
        return Promise.resolve(key);
    }),
};
vi.mock('idb', () => ({
    openDB: vi.fn((name: string) => Promise.resolve({
        transaction: () => ({
            store: name === 'tasktime-email-attempt-secrets' ? fingerprintKeyStore : store,
            done: Promise.resolve(),
        }),
    })),
}));

describe('emailAttemptStorage', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1000);
        records.clear();
        fingerprintKeys.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stores no draft, recipient, invoice, provider id, or raw session data', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 2, sessionId: 'raw-session' };
        await storeEmailAttempt({
            lifecycle,
            attemptId: 'f85f92e3-1584-4d77-8292-3a9977adcf44',
            sendType: 'invoice',
            idempotencyKey: 'opaque-operation-key-1',
            documentId: 'invoice-sensitive-id',
            serializedPayload: JSON.stringify({
                to: 'private-recipient@example.com',
                bodyText: 'private message',
                pdfBase64: 'private-pdf',
            }),
            documentSnapshot: {
                id: 'invoice-sensitive-id',
                note: 'private invoice note',
            },
            nowMs: 1000,
        });
        const serialized = JSON.stringify([...records.values()]);
        expect(serialized).not.toContain('raw-session');
        expect(serialized).not.toContain('recipient');
        expect(serialized).not.toContain('invoiceId');
        expect(serialized).not.toContain('invoice-sensitive-id');
        expect(serialized).not.toContain('providerMessage');
        expect(serialized).not.toContain('opaque-operation-key-1');
        expect(serialized).not.toContain('private-recipient@example.com');
        expect(serialized).not.toContain('private message');
        expect(serialized).not.toContain('private-pdf');
        expect(serialized).not.toContain('private invoice note');
        const fingerprintKey = fingerprintKeys.get('payload-fingerprint-v1');
        expect(fingerprintKey).toBeInstanceOf(CryptoKey);
        expect((fingerprintKey as CryptoKey).extractable).toBe(false);
        await expect(crypto.subtle.exportKey('raw', fingerprintKey as CryptoKey)).rejects.toThrow();
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toHaveLength(1);
        await expect(listBoundEmailAttempts({ ...lifecycle, generation: 3 })).resolves.toEqual([]);
    });

    it('reports whether an exact attempt binding was created by this write', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 2, sessionId: 'session-write' };
        const input = {
            lifecycle,
            attemptId: 'f85f92e3-1584-4d77-8292-3a9977adcf54',
            sendType: 'invoice' as const,
            idempotencyKey: 'write-disposition',
            documentId: 'invoice-write',
            ...attemptEvidence('invoice-write'),
        };

        await expect(storeEmailAttemptWithDisposition({ ...input, nowMs: 1000 }))
            .resolves.toMatchObject({ created: true });
        await expect(storeEmailAttemptWithDisposition({ ...input, nowMs: 2000 }))
            .resolves.toMatchObject({ created: false });
    });

    it('releases only pending evidence and never regresses partial or completed attempts', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 2, sessionId: 'session-release' };
        const attempts = [
            ['pending', 'f85f92e3-1584-4d77-8292-3a9977adcf55'],
            ['partial', 'f85f92e3-1584-4d77-8292-3a9977adcf56'],
            ['completed', 'f85f92e3-1584-4d77-8292-3a9977adcf57'],
        ] as const;
        for (const [state, attemptId] of attempts) {
            await storeEmailAttempt({
                lifecycle,
                attemptId,
                sendType: 'invoice',
                idempotencyKey: `release-${state}`,
                documentId: `invoice-${state}`,
                ...attemptEvidence(`invoice-${state}`),
                state,
            });
        }

        await expect(releasePendingEmailAttemptWithoutDurableEvidence(
            attempts[0][1],
            lifecycle,
        )).resolves.toBe(true);
        await expect(releasePendingEmailAttemptWithoutDurableEvidence(
            attempts[1][1],
            lifecycle,
        )).resolves.toBe(false);
        await expect(releasePendingEmailAttemptWithoutDurableEvidence(
            attempts[2][1],
            lifecycle,
        )).resolves.toBe(false);
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ attemptId: attempts[0][1], state: 'rejected' }),
            expect.objectContaining({ attemptId: attempts[1][1], state: 'partial' }),
            expect.objectContaining({ attemptId: attempts[2][1], state: 'completed' }),
        ]));
    });

    it('matches only the unchanged current document snapshot without storing its content', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 2, sessionId: 'session-2' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf52';
        const original = {
            id: 'invoice-snapshot',
            invoiceNumber: 'INV-SNAPSHOT',
            total: 100,
            updatedAt: 10,
        };
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'snapshot-idempotency',
            documentId: original.id,
            serializedPayload: '{"attemptId":"opaque","bodyText":"private"}',
            documentSnapshot: original,
        });

        await expect(validateBoundEmailAttemptDocumentSnapshot(
            attemptId,
            lifecycle,
            { ...original, sentAt: 100, sentToEmail: 'recipient@example.com', updatedAt: 20 },
        )).resolves.toBe('match');
        await expect(validateBoundEmailAttemptDocumentSnapshot(
            attemptId,
            lifecycle,
            { ...original, total: 200, updatedAt: 20 },
        )).resolves.toBe('mismatch');
    });

    it('updates state only for the exact lifecycle binding', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 1, sessionId: 'session-1' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf44';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'quote',
            idempotencyKey: 'opaque-operation-key-2',
            documentId: 'quote-project-2',
            ...attemptEvidence('quote-project-2'),
        });
        await expect(findBoundEmailAttemptByIdempotency(
            lifecycle,
            'opaque-operation-key-2',
        )).resolves.toMatchObject({ attemptId });
        await expect(updateEmailAttemptState(attemptId, lifecycle, 'completed')).resolves.toBe(true);
        await expect(updateEmailAttemptState(
            attemptId,
            { ...lifecycle, sessionId: 'replacement' },
            'rejected',
        )).resolves.toBe(false);
    });

    it('keeps delivery state monotonic when stale status responses arrive out of order', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 1, sessionId: 'session-1' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf49';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'monotonic-attempt',
            documentId: 'invoice-monotonic',
            ...attemptEvidence('invoice-monotonic'),
        });

        await expect(updateEmailAttemptState(attemptId, lifecycle, 'partial', 200)).resolves.toBe(true);
        await expect(updateEmailAttemptState(attemptId, lifecycle, 'pending', 300)).resolves.toBe(true);
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toEqual([
            expect.objectContaining({ state: 'partial', updatedAt: 200 }),
        ]);

        await expect(updateEmailAttemptState(attemptId, lifecycle, 'completed', 400)).resolves.toBe(true);
        await expect(Promise.all([
            updateEmailAttemptState(attemptId, lifecycle, 'pending', 500),
            updateEmailAttemptState(attemptId, lifecycle, 'partial', 600),
            updateEmailAttemptState(attemptId, lifecycle, 'rejected', 700),
        ])).resolves.toEqual([true, true, true]);
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toEqual([
            expect.objectContaining({ state: 'completed', updatedAt: 400 }),
        ]);
    });

    it('discovers a dormant same-provider attempt and rebinds only after owned status proof', async () => {
        const priorLifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'prior-session' };
        const currentLifecycle = { provider: 'dropbox' as const, generation: 5, sessionId: 'current-session' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf50';
        await storeEmailAttempt({
            lifecycle: priorLifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'reconnect-attempt',
            documentId: 'invoice-reconnect',
            ...attemptEvidence('invoice-reconnect'),
            state: 'partial',
            nowMs: 100,
        });

        await expect(findUnreconciledEmailAttemptForRecovery(
            currentLifecycle,
            'invoice-reconnect',
            'invoice',
        )).resolves.toMatchObject({
            binding: 'same-provider-reconnect',
            attempt: { attemptId, state: 'partial' },
        });
        await expect(listBoundEmailAttempts(currentLifecycle)).resolves.toEqual([]);

        await expect(rebindEmailAttemptAfterOwnedStatus({
            attemptId,
            lifecycle: currentLifecycle,
            documentId: 'invoice-reconnect',
            sendType: 'invoice',
            state: 'completed',
            nowMs: 200,
        })).resolves.toBe(true);
        await expect(listBoundEmailAttempts(priorLifecycle)).resolves.toEqual([]);
        await expect(listBoundEmailAttempts(currentLifecycle)).resolves.toEqual([
            expect.objectContaining({
                attemptId,
                generation: 5,
                state: 'completed',
                updatedAt: 200,
            }),
        ]);
    });

    it('keeps cross-provider evidence dormant unless an owned status proof permits rebinding', async () => {
        const priorLifecycle = { provider: 'google-drive' as const, generation: 4, sessionId: 'prior-session' };
        const currentLifecycle = { provider: 'dropbox' as const, generation: 5, sessionId: 'current-session' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf51';
        await storeEmailAttempt({
            lifecycle: priorLifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'transfer-attempt',
            documentId: 'invoice-transfer',
            ...attemptEvidence('invoice-transfer'),
        });

        await expect(findUnreconciledEmailAttemptForRecovery(
            currentLifecycle,
            'invoice-transfer',
            'invoice',
        )).resolves.toMatchObject({
            binding: 'different-provider',
            attempt: { attemptId },
        });
        await expect(rebindEmailAttemptAfterOwnedStatus({
            attemptId,
            lifecycle: currentLifecycle,
            documentId: 'invoice-transfer',
            sendType: 'invoice',
            state: 'completed',
        })).resolves.toBe(false);
        await expect(listBoundEmailAttempts(priorLifecycle)).resolves.toHaveLength(1);
        await expect(listBoundEmailAttempts(currentLifecycle)).resolves.toEqual([]);

        await expect(rebindEmailAttemptAfterOwnedStatus({
            attemptId,
            lifecycle: currentLifecycle,
            documentId: 'invoice-transfer',
            sendType: 'invoice',
            state: 'completed',
            allowProviderChange: true,
        })).resolves.toBe(true);
        await expect(listBoundEmailAttempts(priorLifecycle)).resolves.toEqual([]);
        await expect(listBoundEmailAttempts(currentLifecycle)).resolves.toEqual([
            expect.objectContaining({
                attemptId,
                provider: 'dropbox',
                generation: 5,
                state: 'completed',
            }),
        ]);
    });

    it('preserves the original binding when the same attempt id is replayed with different evidence', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 1, sessionId: 'session-1' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf46';
        const original = await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'original-idempotency',
            documentId: 'invoice-original',
            serializedPayload: '{"documentId":"invoice-original"}',
            documentSnapshot: { id: 'invoice-original', total: 100 },
            state: 'partial',
            nowMs: 100,
        });

        const conflicts = [
            { lifecycle, sendType: 'invoice' as const, idempotencyKey: 'changed-idempotency', documentId: 'invoice-original', serializedPayload: '{"documentId":"invoice-original"}', documentSnapshot: { id: 'invoice-original', total: 100 } },
            { lifecycle, sendType: 'invoice' as const, idempotencyKey: 'original-idempotency', documentId: 'invoice-changed', serializedPayload: '{"documentId":"invoice-original"}', documentSnapshot: { id: 'invoice-original', total: 100 } },
            { lifecycle, sendType: 'reminder' as const, idempotencyKey: 'original-idempotency', documentId: 'invoice-original', serializedPayload: '{"documentId":"invoice-original"}', documentSnapshot: { id: 'invoice-original', total: 100 } },
            { lifecycle: { ...lifecycle, generation: 2 }, sendType: 'invoice' as const, idempotencyKey: 'original-idempotency', documentId: 'invoice-original', serializedPayload: '{"documentId":"invoice-original"}', documentSnapshot: { id: 'invoice-original', total: 100 } },
            { lifecycle, sendType: 'invoice' as const, idempotencyKey: 'original-idempotency', documentId: 'invoice-original', serializedPayload: '{"documentId":"invoice-original","changed":true}', documentSnapshot: { id: 'invoice-original', total: 100 } },
            { lifecycle, sendType: 'invoice' as const, idempotencyKey: 'original-idempotency', documentId: 'invoice-original', serializedPayload: '{"documentId":"invoice-original"}', documentSnapshot: { id: 'invoice-original', total: 200 } },
        ];

        for (const conflict of conflicts) {
            await expect(storeEmailAttempt({
                ...conflict,
                attemptId,
                nowMs: 200,
            })).rejects.toMatchObject({ code: 'EMAIL_ATTEMPT_BINDING_CONFLICT' });
        }

        expect(records.get(attemptId)).toEqual(original);
        expect(store.put).toHaveBeenCalledTimes(1);
    });

    it('keeps an exact replay on its original state unless a new state is explicit', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 7, sessionId: 'session-7' };
        const input = {
            lifecycle,
            attemptId: 'f85f92e3-1584-4d77-8292-3a9977adcf47',
            sendType: 'invoice' as const,
            idempotencyKey: 'same-idempotency',
            documentId: 'same-invoice',
            ...attemptEvidence('same-invoice'),
        };
        await storeEmailAttempt({ ...input, state: 'partial', nowMs: 100 });

        await expect(storeEmailAttempt({ ...input, nowMs: 200 })).resolves.toMatchObject({
            state: 'partial',
            createdAt: 100,
            updatedAt: 200,
        });
    });

    it('recovers only the lifecycle-bound unreconciled document and marks metadata once', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'session-4' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf45';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'opaque-operation-key-3',
            documentId: 'invoice-4',
            ...attemptEvidence('invoice-4'),
            nowMs: 100,
        });
        await updateEmailAttemptState(attemptId, lifecycle, 'completed', 200);

        await expect(findBoundUnreconciledEmailAttempt(
            lifecycle,
            'invoice-4',
            'invoice',
        )).resolves.toMatchObject({ attemptId, metadataAppliedAt: null });
        await expect(findBoundUnreconciledEmailAttempt(
            lifecycle,
            'another-invoice',
            'invoice',
        )).resolves.toBeNull();
        await expect(markEmailAttemptMetadataApplied(attemptId, lifecycle, 300)).resolves.toBe(true);
        await expect(markEmailAttemptMetadataApplied(attemptId, lifecycle, 400)).resolves.toBe(true);
        await expect(findBoundUnreconciledEmailAttempt(
            lifecycle,
            'invoice-4',
            'invoice',
        )).resolves.toBeNull();
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toEqual([
            expect.objectContaining({ metadataAppliedAt: 300 }),
        ]);
    });

    it('rediscovers a completed applied attempt only when missing invoice metadata needs recovery', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'session-4' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf58';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'completed-applied-recovery',
            documentId: 'invoice-applied-recovery',
            ...attemptEvidence('invoice-applied-recovery'),
            state: 'completed',
            nowMs: 100,
        });
        await markEmailAttemptMetadataApplied(attemptId, lifecycle, 200);

        await expect(findUnreconciledEmailAttemptForRecovery(
            lifecycle,
            'invoice-applied-recovery',
            'invoice',
        )).resolves.toBeNull();
        await expect(findUnreconciledEmailAttemptForRecovery(
            lifecycle,
            'invoice-applied-recovery',
            'invoice',
            { includeAppliedCompletion: true },
        )).resolves.toMatchObject({
            binding: 'bound',
            attempt: { attemptId, state: 'completed', metadataAppliedAt: 200 },
        });
    });

    it('rediscovers an applied partial attempt whose primary was accepted and forward was rejected', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'session-4' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf61';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'partial-applied-recovery',
            documentId: 'invoice-partial-applied-recovery',
            ...attemptEvidence('invoice-partial-applied-recovery'),
            state: 'partial',
            nowMs: 100,
        });
        await markEmailAttemptMetadataApplied(attemptId, lifecycle, 200);

        await expect(findUnreconciledEmailAttemptForRecovery(
            lifecycle,
            'invoice-partial-applied-recovery',
            'invoice',
            { includeAppliedCompletion: true },
        )).resolves.toMatchObject({
            binding: 'bound',
            attempt: { attemptId, state: 'partial', metadataAppliedAt: 200 },
        });
    });

    it.each([
        ['same-provider reconnect', { provider: 'dropbox' as const, generation: 5, sessionId: 'current-session' }, false, 'same-provider-reconnect'],
        ['provider transfer', { provider: 'google-drive' as const, generation: 5, sessionId: 'current-session' }, true, 'different-provider'],
    ])('rebinds a completed applied attempt after owned status proof across a %s', async (
        _scenario,
        currentLifecycle,
        allowProviderChange,
        expectedBinding,
    ) => {
        const priorLifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'prior-session' };
        const attemptId = allowProviderChange
            ? 'f85f92e3-1584-4d77-8292-3a9977adcf59'
            : 'f85f92e3-1584-4d77-8292-3a9977adcf60';
        await storeEmailAttempt({
            lifecycle: priorLifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: `applied-${expectedBinding}`,
            documentId: 'invoice-applied-transfer',
            ...attemptEvidence('invoice-applied-transfer'),
            state: 'completed',
            nowMs: 100,
        });
        await markEmailAttemptMetadataApplied(attemptId, priorLifecycle, 200);

        await expect(findUnreconciledEmailAttemptForRecovery(
            currentLifecycle,
            'invoice-applied-transfer',
            'invoice',
            { includeAppliedCompletion: true },
        )).resolves.toMatchObject({ binding: expectedBinding, attempt: { attemptId } });
        await expect(rebindEmailAttemptAfterOwnedStatus({
            attemptId,
            lifecycle: currentLifecycle,
            documentId: 'invoice-applied-transfer',
            sendType: 'invoice',
            state: 'completed',
            allowProviderChange,
        })).resolves.toBe(true);
        await expect(listBoundEmailAttempts(currentLifecycle)).resolves.toEqual([
            expect.objectContaining({
                attemptId,
                state: 'completed',
                metadataAppliedAt: 200,
            }),
        ]);
    });

    it('keeps up to 256 unresolved attempts and blocks rather than pruning one more', async () => {
        const fingerprint = 'a'.repeat(64);
        const now = 30 * 24 * 60 * 60 * 1000;
        for (let index = 0; index < 256; index += 1) {
            records.set(`attempt-${index}`, {
                version: 1,
                attemptId: `attempt-${index}`,
                provider: 'dropbox',
                generation: 1,
                sessionIdFingerprint: fingerprint,
                idempotencyFingerprint: fingerprint,
                documentFingerprint: fingerprint,
                sendType: 'invoice',
                state: 'pending',
                metadataAppliedAt: null,
                createdAt: now - (29 * 24 * 60 * 60 * 1000),
                updatedAt: now - (29 * 24 * 60 * 60 * 1000),
            });
        }

        await expect(storeEmailAttempt({
            lifecycle: { provider: 'dropbox', generation: 1, sessionId: 'session' },
            attemptId: 'attempt-over-capacity',
            sendType: 'invoice',
            idempotencyKey: 'idempotency-over-capacity',
            documentId: 'invoice-over-capacity',
            ...attemptEvidence('invoice-over-capacity'),
            nowMs: now,
        })).rejects.toMatchObject({ code: 'EMAIL_ATTEMPT_CAPACITY' });
        expect(records.size).toBe(256);
        expect(store.delete).not.toHaveBeenCalled();
    });

    it('expires unresolved evidence after 30 days by creation time before enforcing capacity', async () => {
        const fingerprint = 'c'.repeat(64);
        const now = 40 * 24 * 60 * 60 * 1000;
        records.set('expired-unresolved', {
            version: 1,
            attemptId: 'expired-unresolved',
            provider: 'dropbox',
            generation: 1,
            sessionIdFingerprint: fingerprint,
            idempotencyFingerprint: fingerprint,
            documentFingerprint: fingerprint,
            sendType: 'invoice',
            state: 'pending',
            metadataAppliedAt: null,
            createdAt: now - (30 * 24 * 60 * 60 * 1000),
            updatedAt: now - (24 * 60 * 60 * 1000),
        });
        for (let index = 0; index < 255; index += 1) {
            records.set(`current-unresolved-${index}`, {
                version: 1,
                attemptId: `current-unresolved-${index}`,
                provider: 'dropbox',
                generation: 1,
                sessionIdFingerprint: fingerprint,
                idempotencyFingerprint: fingerprint,
                documentFingerprint: fingerprint,
                sendType: 'invoice',
                state: 'pending',
                metadataAppliedAt: null,
                createdAt: now - (24 * 60 * 60 * 1000),
                updatedAt: now - (24 * 60 * 60 * 1000),
            });
        }

        await expect(storeEmailAttempt({
            lifecycle: { provider: 'dropbox', generation: 1, sessionId: 'session' },
            attemptId: 'replacement-attempt',
            sendType: 'invoice',
            idempotencyKey: 'replacement-idempotency',
            documentId: 'replacement-invoice',
            ...attemptEvidence('replacement-invoice'),
            nowMs: now,
        })).resolves.toMatchObject({ attemptId: 'replacement-attempt' });
        expect(records.has('expired-unresolved')).toBe(false);
        expect(records.has('replacement-attempt')).toBe(true);
        expect(records.size).toBe(256);
    });

    it('does not return expired unresolved evidence during recovery discovery', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 1, sessionId: 'session' };
        await storeEmailAttempt({
            lifecycle,
            attemptId: 'expired-recovery',
            sendType: 'invoice',
            idempotencyKey: 'expired-recovery-idempotency',
            documentId: 'expired-invoice',
            ...attemptEvidence('expired-invoice'),
            nowMs: Date.now() - (31 * 24 * 60 * 60 * 1000),
        });

        await expect(findUnreconciledEmailAttemptForRecovery(
            lifecycle,
            'expired-invoice',
            'invoice',
        )).resolves.toBeNull();
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toEqual([]);
        expect(records.has('expired-recovery')).toBe(false);
    });

    it('prunes expired resolved records before capacity without deleting current unresolved attempts', async () => {
        const fingerprint = 'b'.repeat(64);
        const now = 40 * 24 * 60 * 60 * 1000;
        records.set('old-unresolved', {
            version: 1,
            attemptId: 'old-unresolved',
            provider: 'dropbox',
            generation: 1,
            sessionIdFingerprint: fingerprint,
            idempotencyFingerprint: fingerprint,
            documentFingerprint: fingerprint,
            sendType: 'invoice',
            state: 'pending',
            metadataAppliedAt: null,
            createdAt: now - (29 * 24 * 60 * 60 * 1000),
            updatedAt: now - (29 * 24 * 60 * 60 * 1000),
        });
        for (let index = 0; index < 255; index += 1) {
            records.set(`resolved-${index}`, {
                version: 1,
                attemptId: `resolved-${index}`,
                provider: 'dropbox',
                generation: 1,
                sessionIdFingerprint: fingerprint,
                idempotencyFingerprint: fingerprint,
                documentFingerprint: fingerprint,
                sendType: 'invoice',
                state: 'completed',
                metadataAppliedAt: 2,
                createdAt: 1,
                updatedAt: 2,
            });
        }

        await expect(storeEmailAttempt({
            lifecycle: { provider: 'dropbox', generation: 1, sessionId: 'session' },
            attemptId: 'new-attempt',
            sendType: 'invoice',
            idempotencyKey: 'new-idempotency',
            documentId: 'new-invoice',
            ...attemptEvidence('new-invoice'),
            nowMs: now,
        })).resolves.toMatchObject({ attemptId: 'new-attempt' });
        expect(records.has('old-unresolved')).toBe(true);
        expect(records.has('new-attempt')).toBe(true);
    });
});
