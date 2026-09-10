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
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
const LICENSE_RECHECK_MS = 60_000;

type BillingClientPort = Pick<typeof billingClient, 'getCatalog' | 'getJwks' | 'getStatus'>;

type ClockAnchor = { wallTime: number; monotonicTime: number };

function elapsedSince(anchor: ClockAnchor): number {
    return Math.max(0, Date.now() - anchor.wallTime, performance.now() - anchor.monotonicTime);
}

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
    lifecycleLoading?: boolean;
    onlineRefreshEnabled?: boolean;
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
    const [offline, setOffline] = useState(() => (
        typeof navigator !== 'undefined' && navigator.onLine === false
    ));
    const [clockUntrusted, setClockUntrusted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [resolvedLifecycle, setResolvedLifecycle] = useState('none');
    const verifiedClock = useRef<{
        expiresAt: number;
        serverTime: number;
        wallTime: number;
        monotonicTime: number;
        lastWallTime: number;
    } | null>(null);
    const requestEpoch = useRef(0);
    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshAt = useRef(0);
    const foregroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hydratedLifecycle = useRef('none');
    const previousOnlineRefreshEnabled = useRef(options.onlineRefreshEnabled ?? true);
    const currentLifecycle = useRef(options.lifecycle);
    const currentOnlineRefreshEnabled = useRef(options.onlineRefreshEnabled ?? true);
    currentLifecycle.current = options.lifecycle;
    currentOnlineRefreshEnabled.current = options.onlineRefreshEnabled ?? true;

    const selectVerifiedLicense = useCallback((
        payload: BillingLicensePayloadV1, trustedTime: number, lifecycle: BillingLifecycle,
    ) => {
        const wallTime = Date.now();
        verifiedClock.current = {
            expiresAt: payload.exp * 1000,
            serverTime: trustedTime,
            wallTime,
            monotonicTime: performance.now(),
            lastWallTime: wallTime,
        };
        setResolvedLifecycle(lifecycleKey(lifecycle));
        setResolution({ kind: 'canonical', snapshot: snapshotFromPayload(payload) });
    }, []);

    const publishVerifiedStatus = useCallback(async (
        response: BillingStatusResponseV1,
        lifecycle: BillingLifecycle,
        epoch: number,
        requestStartedAt: ClockAnchor,
    ) => {
        if (response.account.provider !== lifecycle.provider) throw new Error('BILLING_LIFECYCLE_MISMATCH');
        // Conservatively include in-flight/key-fetch time instead of rebasing
        // an old signed deadline to the moment a delayed response arrives.
        const trustedNow = () => response.serverTime + elapsedSince(requestStartedAt);
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
            nowMs: trustedNow(),
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
                nowMs: trustedNow(),
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
        if (!currentOnlineRefreshEnabled.current
            || epoch !== requestEpoch.current
            || lifecycleKey(currentLifecycle.current) !== lifecycleKey(lifecycle)) return;
        await writeVerifiedBillingCache({
            lifecycle,
            subject: signedSnapshot.subject,
            token: response.license,
            payload: verification.payload,
            keyId: verification.keyId,
            serverTime: trustedNow(),
            wallTime: Date.now(),
            authoritativeOnlineRebase: true,
            isCurrent: () => currentOnlineRefreshEnabled.current
                && epoch === requestEpoch.current
                && lifecycleKey(currentLifecycle.current) === lifecycleKey(lifecycle),
        });
        if (!currentOnlineRefreshEnabled.current
            || epoch !== requestEpoch.current
            || lifecycleKey(currentLifecycle.current) !== lifecycleKey(lifecycle)) return;
        if (trustedNow() >= verification.payload.exp * 1000) throw new Error('BILLING_LICENSE_EXPIRED');
        setStatus(response);
        selectVerifiedLicense(verification.payload, trustedNow(), lifecycle);
        setClockUntrusted(false);
        setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
        setError(null);
        retryCount.current = 0;
    }, [client, selectVerifiedLicense]);

    const refresh = useCallback(async (force = false) => {
        const lifecycle = currentLifecycle.current;
        if (!options.enabled || !lifecycle || !currentOnlineRefreshEnabled.current) return;
        const now = Date.now();
        if (!force && now - lastRefreshAt.current < FOREGROUND_COOLDOWN_MS) return;
        lastRefreshAt.current = now;
        const epoch = ++requestEpoch.current;
        const requestStartedAt = { wallTime: now, monotonicTime: performance.now() };
        if (retryTimer.current) clearTimeout(retryTimer.current);
        setIsLoading(true);
        try {
            const response = await client.getStatus(lifecycle.sessionId);
            if (!currentOnlineRefreshEnabled.current) return;
            await publishVerifiedStatus(response, lifecycle, epoch, requestStartedAt);
        } catch (caught) {
            if (epoch !== requestEpoch.current || !currentOnlineRefreshEnabled.current
                || lifecycleKey(currentLifecycle.current) !== lifecycleKey(lifecycle)) return;
            // Online actions and usage must not outlive a failed canonical read.
            setStatus(null);
            const transient = caught instanceof BillingClientError && caught.retryable;
            if (transient) {
                // A reachable browser can still meet a transient Worker/session
                // failure. Only the browser's network state justifies offline UI.
                setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
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
                verifiedClock.current = null;
                setResolution({
                    kind: 'unresolved',
                    reason: caught instanceof BillingClientError && caught.status === 409
                        ? 'conflict'
                        : 'lifecycle',
                });
                setError(caught instanceof Error ? caught.message : 'BILLING_UNAVAILABLE');
                await clearActiveBillingBinding(lifecycle);
            }
        } finally {
            if (epoch === requestEpoch.current) setIsLoading(false);
        }
    }, [client, options.enabled, publishVerifiedStatus]);

    useEffect(() => {
        const epoch = ++requestEpoch.current;
        retryCount.current = 0;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        setIsLoading(false);
        setStatus(null);
        setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
        setClockUntrusted(false);
        setError(null);
        setResolution({ kind: 'unresolved', reason: 'lifecycle' });
        verifiedClock.current = null;
        setResolvedLifecycle(lifecycleKey(options.lifecycle));
        hydratedLifecycle.current = 'none';
        const lifecycle = options.lifecycle;
        if (!options.enabled || !lifecycle) {
            return;
        }
        setIsLoading(true);
        void (async () => {
            const hydrationStartedAt = { wallTime: Date.now(), monotonicTime: performance.now() };
            const cached = await readBoundBillingCache(lifecycle);
            if (epoch !== requestEpoch.current) return;
            if (cached.kind === 'clock_untrusted') {
                setClockUntrusted(true);
            } else if (cached.kind === 'hit') {
                const jwks = await readCachedBillingJwks(cached.trustedTime, { forOfflineLicense: true });
                if (jwks) {
                    const verification = await verifyBillingLicense(cached.license.token, {
                        keys: jwks.keys,
                        expectedSubject: cached.license.subject,
                        expectedIssuer: LICENSE_ISSUER,
                        nowMs: cached.trustedTime,
                    });
                    const trustedTime = cached.trustedTime + elapsedSince(hydrationStartedAt);
                    if (verification.ok && trustedTime < verification.payload.exp * 1000
                        && epoch === requestEpoch.current
                        && lifecycleKey(currentLifecycle.current) === lifecycleKey(lifecycle)) {
                        selectVerifiedLicense(verification.payload, trustedTime, lifecycle);
                    }
                }
            }
            if (epoch !== requestEpoch.current) return;
            hydratedLifecycle.current = lifecycleKey(lifecycle);
            lastRefreshAt.current = 0;
            if (currentOnlineRefreshEnabled.current) {
                await refresh(true);
            } else {
                setIsLoading(false);
            }
        })();
        return () => {
            requestEpoch.current += 1;
        };
    }, [options.enabled, options.lifecycle, refresh, selectVerifiedLicense]);

    // Keep open tabs bounded by the same signed deadline as a cold boot. The
    // monotonic clock prevents a small wall-clock rollback extending access;
    // focus/visibility checks also cover suspended browser timers.
    useEffect(() => {
        const clock = verifiedClock.current;
        if (!clock || resolution.kind !== 'canonical') return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const check = () => {
            if (timer) clearTimeout(timer);
            if (verifiedClock.current !== clock) return;
            const wallTime = Date.now();
            const rollback = wallTime + CLOCK_ROLLBACK_TOLERANCE_MS < clock.lastWallTime;
            clock.lastWallTime = Math.max(clock.lastWallTime, wallTime);
            const trustedTime = clock.serverTime + Math.max(
                0, wallTime - clock.wallTime, performance.now() - clock.monotonicTime,
            );
            if (rollback || trustedTime >= clock.expiresAt) {
                verifiedClock.current = null;
                setStatus(null);
                setResolution({ kind: 'unresolved', reason: 'lifecycle' });
                setClockUntrusted(rollback);
                setError(rollback ? 'BILLING_CLOCK_UNTRUSTED' : 'BILLING_LICENSE_EXPIRED');
                const lifecycle = currentLifecycle.current;
                if (lifecycle) void clearActiveBillingBinding(lifecycle, () => (
                    verifiedClock.current === null
                    && lifecycleKey(currentLifecycle.current) === lifecycleKey(lifecycle)
                ));
                if (navigator.onLine !== false) void refresh(true);
                return;
            }
            timer = setTimeout(check, Math.min(LICENSE_RECHECK_MS, clock.expiresAt - trustedTime));
        };
        check();
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', check);
        };
    }, [resolution, refresh]);

    useEffect(() => {
        if (!options.enabled || options.lifecycle || options.lifecycleLoading) return;
        void clearActiveBillingBinding(undefined, () => currentLifecycle.current === null);
    }, [options.enabled, options.lifecycle, options.lifecycleLoading]);

    useEffect(() => {
        const onlineRefreshEnabled = options.onlineRefreshEnabled ?? true;
        const wasOnlineRefreshEnabled = previousOnlineRefreshEnabled.current;
        previousOnlineRefreshEnabled.current = onlineRefreshEnabled;
        if (!onlineRefreshEnabled) {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryCount.current = 0;
            setIsLoading(false);
            setStatus(null);
            setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
            setError(null);
            return;
        }
        if (!options.enabled
            || !options.lifecycle
            || wasOnlineRefreshEnabled
            || hydratedLifecycle.current !== lifecycleKey(options.lifecycle)) return;
        lastRefreshAt.current = 0;
        void refresh(true);
    }, [options.enabled, options.lifecycle, options.onlineRefreshEnabled, refresh]);

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
                if (controller.signal.aborted) return;
                setCatalog(nextCatalog);
                setCatalogError(null);
            })
            .catch(caught => {
                if (!controller.signal.aborted) setCatalogError(
                    caught instanceof Error ? caught.message : 'CATALOG_UNAVAILABLE',
                );
            });
        return () => controller.abort();
    }, [client, options.catalogEnabled, options.fallbackCatalog]);

    useEffect(() => {
        if (!options.enabled) return;
        const onOffline = () => {
            setOffline(true);
            setStatus(null);
            lastRefreshAt.current = 0;
        };
        const onOnline = () => setOffline(false);
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
        };
    }, [options.enabled]);

    useEffect(() => {
        if (!options.enabled
            || !options.lifecycle
            || !(options.onlineRefreshEnabled ?? true)) return;
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
        const onOnline = () => {
            setOffline(false);
            schedule();
        };
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisibility);
            if (foregroundTimer.current) clearTimeout(foregroundTimer.current);
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [options.enabled, options.lifecycle, options.onlineRefreshEnabled, refresh]);

    const forceRefresh = useCallback(() => refresh(true), [refresh]);

    return {
        // Never expose the previous account during the render before effect cleanup.
        resolution: options.enabled && resolvedLifecycle === lifecycleKey(options.lifecycle)
            ? resolution
            : { kind: 'unresolved', reason: 'lifecycle' } as EntitlementResolution,
        status: options.enabled && !offline && (options.onlineRefreshEnabled ?? true)
            && resolvedLifecycle === lifecycleKey(options.lifecycle) ? status : null,
        catalog,
        isLoading,
        offline,
        clockUntrusted,
        error,
        catalogError,
        refresh: forceRefresh,
    };
}
