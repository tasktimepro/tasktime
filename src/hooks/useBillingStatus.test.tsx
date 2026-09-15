import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import { BillingClientError } from '@/services/billingClient';
import { useBillingStatus } from './useBillingStatus';

const storage = vi.hoisted(() => ({
    clearActiveBillingBinding: vi.fn(() => Promise.resolve()),
    readBoundBillingCache: vi.fn(() => Promise.resolve({ kind: 'missing' })),
    readCachedBillingJwks: vi.fn(() => Promise.resolve({
        keys: [{ kid: 'key-1' }],
    })),
    writeCachedBillingJwks: vi.fn(() => Promise.resolve()),
    writeVerifiedBillingCache: vi.fn(() => Promise.resolve()),
}));
const verify = vi.hoisted(() => vi.fn());

vi.mock('@/utils/billingStorage', () => storage);
vi.mock('@/utils/billingLicense', async () => {
    const actual = await vi.importActual<typeof import('@/utils/billingLicense')>('@/utils/billingLicense');
    return { ...actual, verifyBillingLicense: verify };
});

function entitlement(subject: string, accessStatus: 'free' | 'active' = 'free'): EntitlementSnapshotV1 {
    const pro = accessStatus === 'active';
    return {
        version: 1,
        entitlementRevision: 1,
        planConfigVersion: 'test-catalog-1',
        subject,
        plan: pro ? 'pro' : 'free',
        accessStatus,
        billingStatus: pro ? 'active' : 'none',
        source: pro ? 'subscription' : 'free',
        trialStatus: pro ? 'used' : 'eligible',
        trialStartedAt: null,
        trialEndsAt: null,
        sourceExpiresAt: null,
        entitlements: pro ? ['reports.access', 'invoice.email.send'] : [],
        limits: {
            invoiceEmailSendsPerMonth: pro ? 100 : 0,
            cloudSync: true,
            automaticCloudBackups: true,
            webPush: true,
            activeProjects: null,
            activeClients: pro ? null : 1,
            activeTasks: null,
        },
        subscriptionCurrentPeriodStart: pro ? '2026-08-01T00:00:00.000Z' : null,
        subscriptionCurrentPeriodEnd: pro ? '2027-08-01T00:00:00.000Z' : null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
        sourceUpdatedAt: '2026-08-30T00:00:00.000Z',
        lastReconciledAt: null,
    };
}

function status(subject: string, accessStatus: 'free' | 'active' = 'free') {
    const snapshot = entitlement(subject, accessStatus);
    return {
        version: 1 as const,
        authenticated: true as const,
        serverTime: 1_787_140_800_000,
        entitlementRevision: 1,
        account: {
            provider: 'dropbox' as const,
            displayLabel: 'Dropbox · TaskTime account TT-TEST-0001',
            accountReference: 'TT-TEST-0001',
        },
        planConfigVersion: 'test-catalog-1',
        subscription: {} as never,
        actions: {} as never,
        usage: {} as never,
        entitlement: snapshot,
        license: 'header.payload.signature',
    };
}

const lifecycle = {
    provider: 'dropbox' as const,
    generation: 3,
    sessionId: 'session-3',
};

describe('useBillingStatus', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        storage.readBoundBillingCache.mockResolvedValue({ kind: 'missing' });
        storage.readCachedBillingJwks.mockResolvedValue({ keys: [{ kid: 'key-1' }] });
        verify.mockImplementation(async (_token, options) => ({
            ok: true,
            payload: {
                ...entitlement(options.expectedSubject),
                ver: 1,
                iss: 'https://sync.tasktime.pro',
                aud: 'urn:tasktime:pro:web',
                sub: options.expectedSubject,
                iat: 1_787_140_800,
                nbf: 1_787_140_500,
                exp: 1_787_227_200,
                jti: 'license-1',
            },
            keyId: 'key-1',
        }));
    });

    it('does not call billing endpoints without an exact active lifecycle', async () => {
        const client = { getStatus: vi.fn(), getJwks: vi.fn(), getCatalog: vi.fn() };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle: null,
            client: client as never,
        }));
        expect(result.current.resolution).toEqual({ kind: 'unresolved', reason: 'lifecycle' });
        expect(client.getStatus).not.toHaveBeenCalled();
    });

    it('keeps an offline fresh browser offline when its lifecycle changes', async () => {
        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
        const client = { getStatus: vi.fn(), getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(({ value }) => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle: value,
            onlineRefreshEnabled: false, client: client as never,
        }), { initialProps: { value: lifecycle as typeof lifecycle | null } });
        await act(async () => Promise.resolve());
        hook.rerender({ value: null });
        expect(hook.result.current.offline).toBe(true);
    });

    it('expires an already-open Pro session at the signed deadline without a network event', async () => {
        vi.useFakeTimers();
        const response = status('principal-1', 'active');
        verify.mockResolvedValue({
            ok: true,
            payload: { ...response.entitlement, iat: response.serverTime / 1000,
                exp: response.serverTime / 1000 + 2, jti: 'short-license' },
            keyId: 'key-1',
        });
        const client = {
            getStatus: vi.fn().mockResolvedValueOnce(response)
                .mockRejectedValue(new BillingClientError('NETWORK_ERROR', null, true)),
            getJwks: vi.fn(), getCatalog: vi.fn(),
        };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(hook.result.current.resolution.kind).toBe('canonical');
        await act(async () => { await vi.advanceTimersByTimeAsync(2_001); });
        expect(hook.result.current.resolution.kind).toBe('unresolved');
        expect(hook.result.current.status).toBeNull();
        hook.unmount();
    });

    it('drops stale online actions after a failed refresh while retaining the verified license', async () => {
        const client = {
            getStatus: vi.fn().mockResolvedValueOnce(status('principal-1'))
                .mockRejectedValue(new BillingClientError('BILLING_UNAVAILABLE', 503, true)),
            getJwks: vi.fn(), getCatalog: vi.fn(),
        };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await waitFor(() => expect(hook.result.current.status).not.toBeNull());
        await act(async () => { await hook.result.current.refresh(); });
        expect(hook.result.current.resolution.kind).toBe('canonical');
        expect(hook.result.current.status).toBeNull();
        hook.unmount();
    });

    it.each(['monotonic', 'wall'])('rejects a license that expires in flight on the %s clock', async clock => {
        vi.useFakeTimers();
        const response = status('principal-1');
        const startedAt = performance.now();
        const monotonic = vi.spyOn(performance, 'now').mockReturnValue(startedAt);
        let deliver!: (value: unknown) => void;
        verify.mockImplementation(async (_token, options) => options.nowMs >= response.serverTime + 2000
            ? { ok: false, code: 'EXPIRED' }
            : { ok: true, keyId: 'key-1', payload: {
                ...response.entitlement, iat: response.serverTime / 1000,
                exp: response.serverTime / 1000 + 2, jti: 'short-license',
            } });
        const client = { getStatus: vi.fn(() => new Promise(resolve => { deliver = resolve; })),
            getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await act(async () => Promise.resolve());
        if (clock === 'monotonic') monotonic.mockReturnValue(startedAt + 3000);
        else vi.setSystemTime(Date.now() + 3000);
        await act(async () => deliver(response));
        expect(hook.result.current.resolution.kind).toBe('unresolved');
        expect(storage.writeVerifiedBillingCache).not.toHaveBeenCalled();
    });

    it('invalidates an open-tab clock rollback and deselects the cached binding', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
        const response = status('principal-1');
        const client = { getStatus: vi.fn().mockResolvedValueOnce(response)
            .mockRejectedValue(new BillingClientError('NETWORK_ERROR', null, true)),
        getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await act(async () => Promise.resolve());
        expect(hook.result.current.resolution.kind).toBe('canonical');
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        vi.setSystemTime(new Date('2026-08-19T11:54:00.000Z'));
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(hook.result.current.resolution.kind).toBe('unresolved');
        expect(hook.result.current.clockUntrusted).toBe(true);
        expect(storage.clearActiveBillingBinding).toHaveBeenCalled();
        expect(client.getStatus).toHaveBeenCalledOnce();
    });

    it('tracks browser offline state even before a cloud lifecycle exists', () => {
        let online = true;
        const onlineSpy = vi.spyOn(window.navigator, 'onLine', 'get')
            .mockImplementation(() => online);
        const client = { getStatus: vi.fn(), getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle: null,
            client: client as never,
        }));

        online = false;
        act(() => window.dispatchEvent(new Event('offline')));
        expect(hook.result.current.offline).toBe(true);

        online = true;
        act(() => window.dispatchEvent(new Event('online')));
        expect(hook.result.current.offline).toBe(false);
        expect(client.getStatus).not.toHaveBeenCalled();

        hook.unmount();
        onlineSpy.mockRestore();
    });

    it('does not erase the device binding while cloud identity is still loading', async () => {
        const client = { getStatus: vi.fn(), getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(
            ({ lifecycleLoading }) => useBillingStatus({
                enabled: true,
                catalogEnabled: false,
                lifecycle: null,
                lifecycleLoading,
                onlineRefreshEnabled: false,
                client: client as never,
            }),
            { initialProps: { lifecycleLoading: true } },
        );

        await act(async () => Promise.resolve());
        expect(storage.clearActiveBillingBinding).not.toHaveBeenCalled();

        hook.rerender({ lifecycleLoading: false });
        await waitFor(() => expect(storage.clearActiveBillingBinding).toHaveBeenCalledOnce());
    });

    it('publishes exact cached Pro while online refresh waits for cloud reconnection', async () => {
        const cachedPayload = {
            ...entitlement('principal-1', 'active'),
            ver: 1,
            iss: 'https://sync.tasktime.pro',
            aud: 'urn:tasktime:pro:web',
            sub: 'principal-1',
            iat: 1_787_140_800,
            nbf: 1_787_140_500,
            exp: 1_787_227_200,
            jti: 'license-1',
        };
        storage.readBoundBillingCache.mockResolvedValue({
            kind: 'hit',
            trustedTime: 1_787_140_810_000,
            license: { token: 'cached', payload: cachedPayload },
            binding: {},
        });
        verify.mockResolvedValue({ ok: true, payload: cachedPayload, keyId: 'key-1' });
        const client = {
            getStatus: vi.fn(() => Promise.resolve(status('principal-1', 'active'))),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const hook = renderHook(
            ({ onlineRefreshEnabled }) => useBillingStatus({
                enabled: true,
                catalogEnabled: false,
                lifecycle,
                lifecycleLoading: false,
                onlineRefreshEnabled,
                client: client as never,
            }),
            { initialProps: { onlineRefreshEnabled: false } },
        );

        await waitFor(() => expect(hook.result.current.resolution).toMatchObject({
            kind: 'canonical',
            snapshot: { accessStatus: 'active', plan: 'pro' },
        }));
        expect(client.getStatus).not.toHaveBeenCalled();
        expect(storage.clearActiveBillingBinding).not.toHaveBeenCalled();

        hook.rerender({ onlineRefreshEnabled: true });

        await waitFor(() => expect(client.getStatus).toHaveBeenCalledOnce());
        await waitFor(() => expect(hook.result.current.status).not.toBeNull());
    });

    it('publishes a verified canonical response and binds it to the exact lifecycle', async () => {
        const response = status('principal-1');
        const client = {
            getStatus: vi.fn(() => Promise.resolve(response)),
            getJwks: vi.fn(() => Promise.resolve([{ kid: 'key-1' }])),
            getCatalog: vi.fn(),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));
        await waitFor(() => expect(result.current.resolution.kind).toBe('canonical'));
        expect(storage.writeVerifiedBillingCache).toHaveBeenCalledWith(expect.objectContaining({
            lifecycle,
            subject: 'principal-1',
            authoritativeOnlineRebase: true,
        }));

        vi.useFakeTimers();
        act(() => {
            window.dispatchEvent(new Event('online'));
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000);
        });
        expect(client.getStatus).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('fetches and caches public keys when no current key set exists', async () => {
        storage.readCachedBillingJwks.mockResolvedValue(null);
        const response = status('principal-1');
        const client = {
            getStatus: vi.fn(() => Promise.resolve(response)),
            getJwks: vi.fn(() => Promise.resolve([{ kid: 'remote-key' }])),
            getCatalog: vi.fn(),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));

        await waitFor(() => expect(result.current.resolution.kind).toBe('canonical'));
        expect(client.getJwks).toHaveBeenCalledTimes(1);
        expect(storage.writeCachedBillingJwks).toHaveBeenCalledWith(expect.objectContaining({
            keys: [{ kid: 'remote-key' }],
            expiresAt: response.serverTime + (60 * 60 * 1000),
        }));
    });

    it('refreshes a cached key set exactly once after an unknown-key result', async () => {
        verify.mockResolvedValueOnce({ ok: false, code: 'UNKNOWN_KEY' });
        const client = {
            getStatus: vi.fn(() => Promise.resolve(status('principal-1'))),
            getJwks: vi.fn(() => Promise.resolve([{ kid: 'rotated-key' }])),
            getCatalog: vi.fn(),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));

        await waitFor(() => expect(result.current.resolution.kind).toBe('canonical'));
        expect(verify).toHaveBeenCalledTimes(2);
        expect(client.getJwks).toHaveBeenCalledTimes(1);
        expect(storage.writeCachedBillingJwks).toHaveBeenCalledTimes(1);
    });

    it('clears the active binding and exposes a canonical conflict reason', async () => {
        const client = {
            getStatus: vi.fn(() => Promise.reject(
                new BillingClientError('PROVIDER_HISTORY_CONFLICT', 409, false),
            )),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));

        await waitFor(() => expect(result.current.resolution).toEqual({
            kind: 'unresolved', reason: 'conflict',
        }));
        expect(storage.clearActiveBillingBinding).toHaveBeenCalled();
        expect(result.current.error).toBe('PROVIDER_HISTORY_CONFLICT');
    });

    it('loads a public catalog independently and contains catalog failures', async () => {
        const catalog = { version: 1, planConfigVersion: 'test-catalog-1' };
        const client = {
            getStatus: vi.fn(),
            getJwks: vi.fn(),
            getCatalog: vi.fn()
                .mockResolvedValueOnce(catalog)
                .mockRejectedValueOnce('catalog unavailable'),
        };
        const { result, rerender } = renderHook(
            ({ catalogEnabled }) => useBillingStatus({
                enabled: false,
                catalogEnabled,
                lifecycle: null,
                client: client as never,
            }),
            { initialProps: { catalogEnabled: true } },
        );
        await waitFor(() => expect(result.current.catalog).toEqual(catalog));

        rerender({ catalogEnabled: false });
        await waitFor(() => expect(result.current.catalog).toBeNull());
        rerender({ catalogEnabled: true });
        await waitFor(() => expect(result.current.catalogError).toBe('CATALOG_UNAVAILABLE'));
        expect(result.current.error).toBeNull();
        expect(client.getStatus).not.toHaveBeenCalled();
    });

    it('shows a loopback review catalog immediately and keeps catalog failures separate', async () => {
        const fallbackCatalog = {
            version: 1,
            planConfigVersion: 'local-review-v1',
        };
        const client = {
            getStatus: vi.fn(),
            getJwks: vi.fn(),
            getCatalog: vi.fn(() => Promise.reject(
                new BillingClientError('CATALOG_UNAVAILABLE', 503, true),
            )),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: false,
            catalogEnabled: true,
            lifecycle: null,
            client: client as never,
            fallbackCatalog: fallbackCatalog as never,
        }));

        expect(result.current.catalog).toBe(fallbackCatalog);
        await waitFor(() => expect(result.current.catalogError).toBe('CATALOG_UNAVAILABLE'));
        expect(result.current.catalog).toBe(fallbackCatalog);
        expect(result.current.error).toBeNull();
        expect(client.getStatus).not.toHaveBeenCalled();
    });

    it('allows an explicit refresh to bypass the foreground cooldown', async () => {
        const client = {
            getStatus: vi.fn(() => Promise.resolve(status('principal-1'))),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const { result } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));
        await waitFor(() => expect(result.current.resolution.kind).toBe('canonical'));

        await act(async () => {
            await result.current.refresh();
        });
        expect(client.getStatus).toHaveBeenCalledTimes(2);
    });

    it('keeps a still-valid exact-bound cache on a transient failure but fails closed on rollback', async () => {
        const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
        const cachedPayload = {
            ...entitlement('principal-1', 'active'),
            ver: 1,
            iss: 'https://sync.tasktime.pro',
            aud: 'urn:tasktime:pro:web',
            sub: 'principal-1',
            iat: 1_787_140_800,
            nbf: 1_787_140_500,
            exp: 1_787_227_200,
            jti: 'license-1',
        };
        storage.readBoundBillingCache.mockResolvedValueOnce({
            kind: 'hit',
            trustedTime: 1_787_140_810_000,
            license: { token: 'cached', payload: cachedPayload },
            binding: {},
        });
        verify.mockResolvedValueOnce({ ok: true, payload: cachedPayload, keyId: 'key-1' });
        const client = {
            getStatus: vi.fn(() => Promise.reject(new BillingClientError('NETWORK_ERROR', null, true))),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const { result, unmount } = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));
        await waitFor(() => expect(result.current.offline).toBe(true));
        await waitFor(() => expect(result.current.resolution).toMatchObject({
            kind: 'canonical', snapshot: { accessStatus: 'active' },
        }));
        unmount();

        storage.readBoundBillingCache.mockResolvedValueOnce({ kind: 'clock_untrusted' });
        const rollback = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));
        await waitFor(() => expect(rollback.result.current.clockUntrusted).toBe(true));
        expect(rollback.result.current.resolution).toEqual({ kind: 'unresolved', reason: 'lifecycle' });
        online.mockRestore();
    });

    it.each([false, true])('keeps account-operation retries quiet, then reports exhaustion=%s', async exhausted => {
        vi.useFakeTimers();
        const response = status('principal-1', 'active');
        verify.mockResolvedValue({
            ok: true,
            payload: { ...response.entitlement, iat: response.serverTime / 1000,
                exp: response.serverTime / 1000 + 86_400, jti: 'busy-license' },
            keyId: 'key-1',
        });
        const busy = new BillingClientError('ACCOUNT_OPERATION_IN_PROGRESS', 409, true);
        const getStatus = vi.fn().mockResolvedValueOnce(status('principal-1', 'active'));
        if (exhausted) getStatus.mockRejectedValue(busy);
        else getStatus.mockRejectedValueOnce(busy).mockResolvedValue(status('principal-1', 'active'));
        const client = { getStatus, getJwks: vi.fn(), getCatalog: vi.fn() };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(hook.result.current.status).not.toBeNull();
        await act(async () => { await hook.result.current.refresh(); });
        expect(hook.result.current.error).toBeNull();
        expect(hook.result.current.status).toBeNull();
        expect(hook.result.current.resolution.kind).toBe('canonical');
        expect(storage.clearActiveBillingBinding).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
        expect(hook.result.current.error).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
        expect(hook.result.current.error).toBe(exhausted ? 'ACCOUNT_OPERATION_IN_PROGRESS' : null);
        expect(getStatus).toHaveBeenCalledTimes(exhausted ? 4 : 3);
        expect(hook.result.current.status === null).toBe(exhausted);
        await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
        expect(getStatus).toHaveBeenCalledTimes(exhausted ? 4 : 3);
        hook.unmount();
    });

    it('reports a non-retryable billing conflict immediately', async () => {
        const client = {
            getStatus: vi.fn().mockRejectedValue(new BillingClientError('BILLING_STATE_CONFLICT', 409, false)),
            getJwks: vi.fn(), getCatalog: vi.fn(),
        };
        const hook = renderHook(() => useBillingStatus({
            enabled: true, catalogEnabled: false, lifecycle, client: client as never,
        }));
        await waitFor(() => expect(hook.result.current.error).toBe('BILLING_STATE_CONFLICT'));
        expect(hook.result.current.resolution).toEqual({ kind: 'unresolved', reason: 'conflict' });
        expect(client.getStatus).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it('does not call an online transient billing failure an offline browser', async () => {
        const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
        const client = {
            getStatus: vi.fn(() => Promise.reject(
                new BillingClientError('NETWORK_ERROR', null, true),
            )),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const hook = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));

        await waitFor(() => expect(hook.result.current.error).toBe('NETWORK_ERROR'));
        expect(hook.result.current.offline).toBe(false);

        hook.unmount();
        online.mockRestore();
    });

    it('fences a late response after the lifecycle changes', async () => {
        let resolveFirst: (value: ReturnType<typeof status>) => void = () => undefined;
        const first = new Promise<ReturnType<typeof status>>(resolve => { resolveFirst = resolve; });
        const client = {
            getStatus: vi.fn()
                .mockReturnValueOnce(first)
                .mockResolvedValueOnce(status('principal-2')),
            getJwks: vi.fn(() => Promise.resolve([{ kid: 'key-1' }])),
            getCatalog: vi.fn(),
        };
        const { result, rerender } = renderHook(
            ({ value }) => useBillingStatus({
                enabled: true,
                catalogEnabled: false,
                lifecycle: value,
                client: client as never,
            }),
            { initialProps: { value: lifecycle } },
        );
        await waitFor(() => expect(client.getStatus).toHaveBeenCalledTimes(1));
        const replacement = { ...lifecycle, generation: 4, sessionId: 'session-4' };
        rerender({ value: replacement });
        await waitFor(() => expect(result.current.resolution).toMatchObject({
            kind: 'canonical', snapshot: { subject: 'principal-2' },
        }));
        await act(async () => resolveFirst(status('principal-1')));
        expect(storage.writeVerifiedBillingCache).not.toHaveBeenCalledWith(expect.objectContaining({
            lifecycle,
            subject: 'principal-1',
        }));
    });

    it('bounds automatic retries after transient failures', async () => {
        vi.useFakeTimers();
        const client = {
            getStatus: vi.fn(() => Promise.reject(
                new BillingClientError('NETWORK_ERROR', null, true),
            )),
            getJwks: vi.fn(),
            getCatalog: vi.fn(),
        };
        const hook = renderHook(() => useBillingStatus({
            enabled: true,
            catalogEnabled: false,
            lifecycle,
            client: client as never,
        }));

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            await vi.runAllTimersAsync();
        });
        expect(client.getStatus).toHaveBeenCalledTimes(3);
        hook.unmount();
        vi.useRealTimers();
    });
});
