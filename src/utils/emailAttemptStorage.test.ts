import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    findBoundEmailAttemptByIdempotency,
    findBoundUnreconciledEmailAttempt,
    listBoundEmailAttempts,
    markEmailAttemptMetadataApplied,
    storeEmailAttempt,
    updateEmailAttemptState,
} from './emailAttemptStorage';

const records = new Map<string, unknown>();
const store = {
    get: vi.fn((key: string) => Promise.resolve(structuredClone(records.get(key)))),
    getAll: vi.fn(() => Promise.resolve([...records.values()].map(value => structuredClone(value)))),
    put: vi.fn((value: unknown, key: string) => {
        records.set(key, structuredClone(value));
        return Promise.resolve(key);
    }),
    delete: vi.fn((key: string) => { records.delete(key); return Promise.resolve(); }),
};
vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve({
        transaction: () => ({ store, done: Promise.resolve() }),
    })),
}));

describe('emailAttemptStorage', () => {
    beforeEach(() => {
        records.clear();
        vi.clearAllMocks();
    });

    it('stores no draft, recipient, invoice, provider id, or raw session data', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 2, sessionId: 'raw-session' };
        await storeEmailAttempt({
            lifecycle,
            attemptId: 'f85f92e3-1584-4d77-8292-3a9977adcf44',
            sendType: 'invoice',
            idempotencyKey: 'opaque-operation-key-1',
            documentId: 'invoice-sensitive-id',
            nowMs: 1000,
        });
        const serialized = JSON.stringify([...records.values()]);
        expect(serialized).not.toContain('raw-session');
        expect(serialized).not.toContain('recipient');
        expect(serialized).not.toContain('invoiceId');
        expect(serialized).not.toContain('invoice-sensitive-id');
        expect(serialized).not.toContain('providerMessage');
        expect(serialized).not.toContain('opaque-operation-key-1');
        await expect(listBoundEmailAttempts(lifecycle)).resolves.toHaveLength(1);
        await expect(listBoundEmailAttempts({ ...lifecycle, generation: 3 })).resolves.toEqual([]);
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

    it('recovers only the lifecycle-bound unreconciled document and marks metadata once', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 4, sessionId: 'session-4' };
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf45';
        await storeEmailAttempt({
            lifecycle,
            attemptId,
            sendType: 'invoice',
            idempotencyKey: 'opaque-operation-key-3',
            documentId: 'invoice-4',
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
});
