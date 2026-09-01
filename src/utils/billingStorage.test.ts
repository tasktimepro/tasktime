import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingLicensePayloadV1 } from './billingLicense';
import {
    clearActiveBillingBinding,
    clearPendingBillingCheckout,
    createBillingSessionFingerprint,
    readBoundBillingCache,
    readCachedBillingJwks,
    readPendingBillingCheckout,
    writeCachedBillingJwks,
    writePendingBillingCheckout,
    writeVerifiedBillingCache,
} from './billingStorage';

const stores = new Map<string, Map<string, unknown>>();

function store(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    const values = stores.get(name)!;
    return {
        get: vi.fn((key: string) => Promise.resolve(structuredClone(values.get(key)))),
        put: vi.fn((value: unknown, key: string) => {
            values.set(key, structuredClone(value));
            return Promise.resolve(key);
        }),
        delete: vi.fn((key: string) => {
            values.delete(key);
            return Promise.resolve();
        }),
        getAll: vi.fn(() => Promise.resolve([...values.values()].map(value => structuredClone(value)))),
    };
}

const db = {
    transaction: vi.fn((names: string | string[]) => {
        const list = Array.isArray(names) ? names : [names];
        return {
            objectStore: (name: string) => store(name),
            store: store(list[0]),
            done: Promise.resolve(),
        };
    }),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(db)),
}));

const payload = {
    subject: 'principal-1',
    jti: 'license-1',
    exp: 1_787_227_200,
} as BillingLicensePayloadV1;

describe('billingStorage', () => {
    beforeEach(() => {
        stores.clear();
        vi.clearAllMocks();
    });

    it('stores a one-way session fingerprint and restores only the exact lifecycle', async () => {
        const lifecycle = {
            provider: 'dropbox' as const,
            generation: 4,
            sessionId: 'raw-secret-session-reference',
        };
        await writeVerifiedBillingCache({
            lifecycle,
            subject: 'principal-1',
            token: 'header.payload.signature',
            payload,
            keyId: 'key-1',
            serverTime: 1_787_140_800_000,
            wallTime: 1_787_140_800_000,
        });

        const binding = stores.get('bindings')?.get('active-v1');
        expect(JSON.stringify(binding)).not.toContain(lifecycle.sessionId);
        expect(await createBillingSessionFingerprint(lifecycle.sessionId)).toMatch(/^[a-f0-9]{64}$/);
        await expect(readBoundBillingCache(lifecycle, 1_787_140_860_000)).resolves.toMatchObject({
            kind: 'hit',
            trustedTime: 1_787_140_860_000,
            license: { subject: 'principal-1', licenseJti: 'license-1' },
        });
        await expect(readBoundBillingCache({ ...lifecycle, generation: 5 }, 1_787_140_860_000))
            .resolves.toEqual({ kind: 'missing' });
        await expect(readBoundBillingCache({ ...lifecycle, sessionId: 'another-session' }, 1_787_140_860_000))
            .resolves.toEqual({ kind: 'missing' });
    });

    it('fails closed on a wall-clock rollback greater than five minutes', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 2, sessionId: 'session-2' };
        await writeVerifiedBillingCache({
            lifecycle,
            subject: 'principal-1',
            token: 'header.payload.signature',
            payload,
            keyId: 'key-1',
            serverTime: 1_787_140_800_000,
            wallTime: 1_787_140_800_000,
        });
        await readBoundBillingCache(lifecycle, 1_787_141_400_000);
        await expect(readBoundBillingCache(lifecycle, 1_787_140_800_000)).resolves.toEqual({
            kind: 'clock_untrusted',
        });
    });

    it('deselects without deleting subject history and permits authoritative same-lifecycle rebasing', async () => {
        const lifecycle = { provider: 'google-drive' as const, generation: 7, sessionId: 'session-7' };
        await writeVerifiedBillingCache({
            lifecycle,
            subject: 'principal-1',
            token: 'first',
            payload,
            keyId: 'key-1',
            serverTime: 1_787_140_800_000,
            wallTime: 1_900_000_000_000,
        });
        await writeVerifiedBillingCache({
            lifecycle,
            subject: 'principal-1',
            token: 'fresh',
            payload: { ...payload, jti: 'license-2' },
            keyId: 'key-1',
            serverTime: 1_787_140_900_000,
            wallTime: 1_900_000_000_000,
            authoritativeOnlineRebase: true,
        });
        await expect(readBoundBillingCache(lifecycle, 1_900_000_000_000)).resolves.toMatchObject({
            kind: 'hit',
            trustedTime: 1_787_140_900_000,
            license: { token: 'fresh' },
        });
        await clearActiveBillingBinding();
        await expect(readBoundBillingCache(lifecycle, 1_900_000_000_000))
            .resolves.toEqual({ kind: 'missing' });
        expect(stores.get('licenses')?.size).toBe(1);
    });

    it('binds pending Checkout recovery metadata to the exact provider lifecycle', async () => {
        const lifecycle = { provider: 'dropbox' as const, generation: 9, sessionId: 'checkout-session' };
        await writePendingBillingCheckout({
            lifecycle,
            attemptId: '0c57f1be-0dc8-4ec1-867e-84e7278fd0c6',
            createdAt: 1_787_140_800_000,
        });

        expect(JSON.stringify(stores.get('checkout-attempts')?.get('active-v1')))
            .not.toContain(lifecycle.sessionId);
        await expect(readPendingBillingCheckout(lifecycle)).resolves.toEqual({
            attemptId: '0c57f1be-0dc8-4ec1-867e-84e7278fd0c6',
            createdAt: 1_787_140_800_000,
        });
        await expect(readPendingBillingCheckout({ ...lifecycle, generation: 10 })).resolves.toBeNull();
        await clearPendingBillingCheckout();
        await expect(readPendingBillingCheckout(lifecycle)).resolves.toBeNull();
    });

    it('caches only a current bounded public-key projection', async () => {
        const jwks = {
            version: 1 as const,
            keys: [{
                kty: 'EC' as const,
                crv: 'P-256' as const,
                x: 'x',
                y: 'y',
                kid: 'key-1',
                alg: 'ES256' as const,
                use: 'sig' as const,
            }],
            etag: null,
            expiresAt: 200,
            storedAt: 100,
        };
        await writeCachedBillingJwks(jwks);
        await expect(readCachedBillingJwks(199)).resolves.toEqual(jwks);
        await expect(readCachedBillingJwks(200)).resolves.toBeNull();

        stores.get('public-resources')?.set('jwks-v1', { ...jwks, keys: [] });
        await expect(readCachedBillingJwks(100)).resolves.toBeNull();
    });

    it('rejects invalid Checkout recovery writes and treats storage failures as misses', async () => {
        await expect(writePendingBillingCheckout({
            lifecycle: { provider: 'dropbox', generation: -1, sessionId: 'session' },
            attemptId: 'not-a-uuid',
        })).rejects.toThrow('INVALID_BILLING_CHECKOUT_ATTEMPT');

        db.transaction.mockImplementationOnce(() => {
            throw new Error('storage unavailable');
        });
        await expect(readBoundBillingCache({
            provider: 'dropbox', generation: 1, sessionId: 'session',
        })).resolves.toEqual({ kind: 'missing' });
    });
});
