import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntitlementResolution, EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import {
    billingClient,
    BillingClientError,
    type BillingCatalogV1,
    type BillingStatusResponseV1,
} from '@/services/billingClient';
import {
    verifyBillingLicense,
    type BillingLicensePayloadV1,
} from '@/utils/billingLicense';
import {
    clearActiveBillingBinding,
    readBoundBillingCache,
    readCachedBillingJwks,
    writeCachedBillingJwks,
    writeVerifiedBillingCache,
    type BillingLifecycle,
} from '@/utils/billingStorage';

const LICENSE_ISSUER = 'https://sync.tasktime.pro';
const FOREGROUND_COOLDOWN_MS = 60_000;
const FOREGROUND_COALESCE_MS = 1_000;
const MAX_TRANSIENT_RETRIES = 2;

type BillingClientPort = Pick<typeof billingClient, 'getCatalog' | 'getJwks' | 'getStatus'>;

function snapshotFromPayload(payload: BillingLicensePayloadV1): EntitlementSnapshotV1 {
    return {
        version: payload.version,
        entitlementRevision: payload.entitlementRevision,
        planConfigVersion: payload.planConfigVersion,
        subject: payload.subject,
        plan: payload.plan,
        accessStatus: payload.accessStatus,
        billingStatus: payload.billingStatus,
        source: payload.source,
        trialStatus: payload.trialStatus,
        trialStartedAt: payload.trialStartedAt,
        trialEndsAt: payload.trialEndsAt,
        sourceExpiresAt: payload.sourceExpiresAt,
        entitlements: payload.entitlements,
        limits: payload.limits,
        subscriptionCurrentPeriodStart: payload.subscriptionCurrentPeriodStart,
        subscriptionCurrentPeriodEnd: payload.subscriptionCurrentPeriodEnd,
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
        graceUntil: payload.graceUntil,
        sourceUpdatedAt: payload.sourceUpdatedAt,
        lastReconciledAt: payload.lastReconciledAt,
    };
}

function sameSnapshot(left: EntitlementSnapshotV1, right: EntitlementSnapshotV1): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function lifecycleKey(lifecycle: BillingLifecycle | null): string {
    if (!lifecycle) return 'none';
    return `${lifecycle.provider}:${lifecycle.generation}:${lifecycle.sessionId}`;
}

export function useBillingStatus(options: {
    enabled: boolean;
    catalogEnabled: boolean;
    lifecycle: BillingLifecycle | null;
    client?: BillingClientPort;
    fallbackCatalog?: BillingCatalogV1 | null;
}) {
    const client = options.client ?? billingClient;
    const [resolution, setResolution] = useState<EntitlementResolution>({
        kind: 'unresolved',
        reason: 'lifecycle',
    });
    const [status, setStatus] = useState<BillingStatusResponseV1 | null>(null);
    const [catalog, setCatalog] = useState<BillingCatalogV1 | null>(
        options.catalogEnabled ? options.fallbackCatalog ?? null : null,
    );
    const [isLoading, setIsLoading] = useState(false);
    const [offline, setOffline] = useState(false);
    const [clockUntrusted, setClockUntrusted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const requestEpoch = useRef(0);
    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshAt = useRef(0);
    const foregroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentLifecycle = useRef(options.lifecycle);
    currentLifecycle.current = options.lifecycle;

    const publishVerifiedStatus = useCallback(async (
        response: BillingStatusResponseV1,
        lifecycle: BillingLifecycle,
        epoch: number,
    ) => {
        if (response.account.provider !== lifecycle.provider) throw new Error('BILLING_LIFECYCLE_MISMATCH');
        let cachedKeys = await readCachedBillingJwks(response.serverTime);
        let keys = cachedKeys?.keys ?? null;
        if (!keys) {
            keys = await client.getJwks();
            await writeCachedBillingJwks({
                version: 1,
                keys,
                etag: null,
                expiresAt: response.serverTime + (60 * 60 * 1000),
                storedAt: response.serverTime,
            });
        }
        let verification = await verifyBillingLicense(response.license, {
            keys,
            expectedSubject: response.entitlement.subject,
            expectedIssuer: LICENSE_ISSUER,
            nowMs: response.serverTime,
            browserOrigin: typeof window === 'undefined' ? undefined : window.location.origin,
        });
        if (verification.ok === false && verification.code === 'UNKNOWN_KEY' && cachedKeys) {
            keys = await client.getJwks();
            await writeCachedBillingJwks({
                version: 1,
                keys,
                etag: null,
                expiresAt: response.serverTime + (60 * 60 * 1000),
                storedAt: response.serverTime,
            });
            verification = await verifyBillingLicense(response.license, {
                keys,
                expectedSubject: response.entitlement.subject,
                expectedIssuer: LICENSE_ISSUER,
                nowMs: response.serverTime,
            });
        }
        if (verification.ok === false) throw new Error(`BILLING_LICENSE_${verification.code}`);
        const signedSnapshot = snapshotFromPayload(verification.payload);
        if (!sameSnapshot(signedSnapshot, response.entitlement)
            || response.entitlementRevision !== signedSnapshot.entitlementRevision
            || response.planConfigVersion !== signedSnapshot.planConfigVersion
            || Math.abs((verification.payload.iat * 1000) - response.serverTime) > 300_000) {
            throw new Error('BILLING_STATUS_LICENSE_MISMATCH');
        }
        if (epoch !== requestEpoch.current
            || lifecycleKey(currentLifecycle.current) !== lifecycleKey(lifecycle)) return;
        await writeVerifiedBillingCache({
            lifecycle,
            subject: signedSnapshot.subject,
            token: response.license,
            payload: verification.payload,
            keyId: verification.keyId,
            serverTime: response.serverTime,
            wallTime: Date.now(),
            authoritativeOnlineRebase: true,
        });
        if (epoch !== requestEpoch.current
            || lifecycleKey(currentLifecycle.current) !== lifecycleKey(lifecycle)) return;
        setStatus(response);
        setResolution({ kind: 'canonical', snapshot: signedSnapshot });
        setClockUntrusted(false);
        setOffline(false);
        setError(null);
        retryCount.current = 0;
    }, [client]);

    const refresh = useCallback(async (force = false) => {
        const lifecycle = currentLifecycle.current;
        if (!options.enabled || !lifecycle) return;
        const now = Date.now();
        if (!force && now - lastRefreshAt.current < FOREGROUND_COOLDOWN_MS) return;
        lastRefreshAt.current = now;
        const epoch = ++requestEpoch.current;
        setIsLoading(true);
        try {
            const response = await client.getStatus(lifecycle.sessionId);
            await publishVerifiedStatus(response, lifecycle, epoch);
        } catch (caught) {
            if (epoch !== requestEpoch.current) return;
            const transient = caught instanceof BillingClientError && caught.retryable;
            if (transient) {
                setOffline(true);
                setError(caught.code);
                if (retryCount.current < MAX_TRANSIENT_RETRIES) {
                    const delay = 2_000 * (2 ** retryCount.current);
                    retryCount.current += 1;
                    retryTimer.current = setTimeout(() => {
                        lastRefreshAt.current = 0;
                        void refresh(true);
                    }, delay);
                }
            } else {
                await clearActiveBillingBinding();
                setStatus(null);
                setResolution({
                    kind: 'unresolved',
                    reason: caught instanceof BillingClientError && caught.status === 409
                        ? 'conflict'
                        : 'lifecycle',
                });
                setError(caught instanceof Error ? caught.message : 'BILLING_UNAVAILABLE');
            }
        } finally {
            if (epoch === requestEpoch.current) setIsLoading(false);
        }
    }, [client, options.enabled, publishVerifiedStatus]);

    useEffect(() => {
        const epoch = ++requestEpoch.current;
        retryCount.current = 0;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        setStatus(null);
        setOffline(false);
        setClockUntrusted(false);
        setError(null);
        setResolution({ kind: 'unresolved', reason: 'lifecycle' });
        const lifecycle = options.lifecycle;
        if (!options.enabled || !lifecycle) {
            void clearActiveBillingBinding();
            return;
        }
        void (async () => {
            const cached = await readBoundBillingCache(lifecycle);
            if (epoch !== requestEpoch.current) return;
            if (cached.kind === 'clock_untrusted') {
                setClockUntrusted(true);
            } else if (cached.kind === 'hit') {
                const jwks = await readCachedBillingJwks(cached.trustedTime);
                if (jwks) {
                    const verification = await verifyBillingLicense(cached.license.token, {
                        keys: jwks.keys,
                        expectedSubject: cached.license.subject,
                        expectedIssuer: LICENSE_ISSUER,
                        nowMs: cached.trustedTime,
                    });
                    if (verification.ok && epoch === requestEpoch.current) {
                        setResolution({
                            kind: 'canonical',
                            snapshot: snapshotFromPayload(verification.payload),
                        });
                    }
                }
            }
            lastRefreshAt.current = 0;
            await refresh(true);
        })();
        return () => {
            requestEpoch.current += 1;
        };
    }, [options.enabled, options.lifecycle, refresh]);

    useEffect(() => {
        if (!options.catalogEnabled) {
            setCatalog(null);
            setCatalogError(null);
            return;
        }
        setCatalog(options.fallbackCatalog ?? null);
        setCatalogError(null);
        const controller = new AbortController();
        void client.getCatalog(controller.signal)
            .then(nextCatalog => {
                setCatalog(nextCatalog);
                setCatalogError(null);
            })
            .catch(caught => setCatalogError(
                caught instanceof Error ? caught.message : 'CATALOG_UNAVAILABLE',
            ));
        return () => controller.abort();
    }, [client, options.catalogEnabled, options.fallbackCatalog]);

    useEffect(() => {
        if (!options.enabled || !options.lifecycle) return;
        const schedule = () => {
            if (foregroundTimer.current) return;
            foregroundTimer.current = setTimeout(() => {
                foregroundTimer.current = null;
                void refresh(false);
            }, FOREGROUND_COALESCE_MS);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') schedule();
        };
        window.addEventListener('online', schedule);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('online', schedule);
            document.removeEventListener('visibilitychange', onVisibility);
            if (foregroundTimer.current) clearTimeout(foregroundTimer.current);
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [options.enabled, options.lifecycle, refresh]);

    const forceRefresh = useCallback(() => refresh(true), [refresh]);

    return {
        resolution,
        status,
        catalog,
        isLoading,
        offline,
        clockUntrusted,
        error,
        catalogError,
        refresh: forceRefresh,
    };
}
