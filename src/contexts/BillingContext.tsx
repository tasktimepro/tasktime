import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { BillingContext } from './BillingContext.shared';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { buildLocalReviewBillingCatalog } from '@/config/localReviewPricing';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
import {
    deriveEntitlementState,
    type EntitlementState,
} from '@/domain/entitlements/entitlementPolicy';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import {
    billingClient,
    BillingClientError,
    type BillingCatalogV1,
    type BillingStatusResponseV1,
} from '@/services/billingClient';
import {
    clearPendingBillingCheckout,
    readPendingBillingCheckout,
    writePendingBillingCheckout,
} from '@/utils/billingStorage';
import { useYjs } from './YjsContext';

export type BillingContextValue = {
    resolution: EntitlementResolution;
    status: BillingStatusResponseV1 | null;
    catalog: BillingCatalogV1 | null;
    isLoading: boolean;
    offline: boolean;
    clockUntrusted: boolean;
    error: string | null;
    catalogError: string | null;
    hasActiveCloudAccount: boolean;
    isCloudAccountLoading: boolean;
    isBillingConnectionReady: boolean;
    isBillingReconnecting: boolean;
    connectedAccountReference: string | null;
    entitlementState: EntitlementState;
    refresh: () => Promise<void>;
    startTrial: () => Promise<void>;
    createCheckout: (
        offerId: string,
        planConfigVersion: string,
        billingContactEmail?: string,
    ) => Promise<{ url: string; attemptId: string }>;
    openPortal: () => Promise<string>;
    handleCheckoutReturn: (outcome: 'success' | 'cancel') => Promise<void>;
    handlePortalReturn: () => Promise<void>;
};

function isChangedCheckoutOffer(error: unknown): error is BillingClientError {
    return error instanceof BillingClientError
        && (error.code === 'FOUNDING_OFFER_ENDED' || error.code === 'CATALOG_CHANGED');
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
    const {
        activeStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        hostedServiceSessionId,
        isCloudConnected,
        isConnecting,
        isCloudIdentityLoading,
        hadPreviousCloudSession,
    } = useYjs();
    const lifecycle = useMemo(() => {
        // The exact persisted account binding remains usable for signed offline
        // entitlement selection while its provider connection is starting.
        if (!activeStorageProvider
            || !activeStorageSessionId
            || activeStorageGeneration === null
            || hostedServiceSessionId !== activeStorageSessionId) return null;
        return {
            provider: activeStorageProvider,
            generation: activeStorageGeneration,
            sessionId: activeStorageSessionId,
        };
    }, [
        activeStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        hostedServiceSessionId,
    ]);
    const isBillingConnectionReady = Boolean(
        lifecycle
        && isCloudConnected
        && !isConnecting
        && !isCloudIdentityLoading,
    );
    const isBillingReconnecting = Boolean(
        isConnecting || isCloudIdentityLoading,
    );
    const needsCloudReconnect = Boolean(
        !isConnecting
        && !isCloudIdentityLoading
        && ((hadPreviousCloudSession && !isCloudConnected)
            // Partial/mismatched account evidence is not a pristine browser.
            || (!lifecycle && (activeStorageSessionId || hostedServiceSessionId || isCloudConnected))),
    );
    const localCatalogFallback = useMemo<BillingCatalogV1 | null>(() => (
        BILLING_FEATURES.localCatalogFallback
            ? buildLocalReviewBillingCatalog() as BillingCatalogV1
            : null
    ), []);
    const liveBilling = useBillingStatus({
        enabled: BILLING_FEATURES.status,
        catalogEnabled: BILLING_FEATURES.ui,
        lifecycle,
        lifecycleLoading: isCloudIdentityLoading,
        onlineRefreshEnabled: isBillingConnectionReady,
        fallbackCatalog: localCatalogFallback,
    });
    const billing = liveBilling;
    const { refresh, status } = billing;
    const activeActionLifecycle = useRef(lifecycle);
    activeActionLifecycle.current = lifecycle;
    const assertCurrentAccount = useCallback(() => {
        if (activeActionLifecycle.current !== lifecycle) {
            throw new Error('The cloud account changed. Review the current plan before continuing.');
        }
    }, [lifecycle]);
    const entitlementState = useMemo(() => deriveEntitlementState({
        resolution: billing.resolution,
        offline: billing.offline,
        hasActiveCloudAccount: Boolean(lifecycle),
        isCloudAccountLoading: isCloudIdentityLoading,
        isBillingConnectionReady,
        isBillingReconnecting,
        needsCloudReconnect,
    }), [
        billing.offline,
        billing.resolution,
        isBillingConnectionReady,
        isBillingReconnecting,
        isCloudIdentityLoading,
        lifecycle,
        needsCloudReconnect,
    ]);
    const announceRefresh = useCallback(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel('tasktime-billing-refresh-v1');
        channel.postMessage({ version: 1, reason: 'canonical-state-changed' });
        channel.close();
    }, []);
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined' || !BILLING_FEATURES.status) return;
        const channel = new BroadcastChannel('tasktime-billing-refresh-v1');
        channel.onmessage = event => {
            if (event.data?.version === 1) void refresh();
        };
        return () => channel.close();
    }, [refresh]);
    const refreshCanonicalStatus = useCallback(async () => {
        assertCurrentAccount();
        if (!lifecycle || !isBillingConnectionReady) throw new Error('BILLING_DISABLED');
        await billingClient.refresh(lifecycle.sessionId, 'user_retry');
        assertCurrentAccount();
        announceRefresh();
        await refresh();
    }, [announceRefresh, assertCurrentAccount, isBillingConnectionReady, lifecycle, refresh]);
    const startTrial = useCallback(async () => {
        assertCurrentAccount();
        if (!BILLING_FEATURES.trialActivation
            || !lifecycle
            || !isBillingConnectionReady
            || !status?.actions.trialActivationEnabled) throw new Error('BILLING_DISABLED');
        await billingClient.startTrial(lifecycle.sessionId);
        assertCurrentAccount();
        announceRefresh();
        await refresh();
    }, [announceRefresh, assertCurrentAccount, isBillingConnectionReady, lifecycle, refresh, status]);
    const createCheckout = useCallback(async (
        offerId: string,
        planConfigVersion: string,
        billingContactEmail?: string,
    ) => {
        assertCurrentAccount();
        if (!BILLING_FEATURES.checkout
            || !lifecycle
            || !isBillingConnectionReady
            || !status?.actions.checkoutEnabled) throw new Error('BILLING_DISABLED');
        const openCheckout = () => billingContactEmail
            ? billingClient.createCheckout(
                lifecycle.sessionId,
                offerId,
                planConfigVersion,
                undefined,
                billingContactEmail,
            )
            : billingClient.createCheckout(
                lifecycle.sessionId,
                offerId,
                planConfigVersion,
            );
        let result;
        try {
            result = await openCheckout();
        } catch (error) {
            assertCurrentAccount();
            if (error instanceof BillingClientError && error.code === 'CHECKOUT_EXPIRED') {
                await refresh();
                assertCurrentAccount();
                try {
                    result = await openCheckout();
                } catch (retryError) {
                    assertCurrentAccount();
                    if (isChangedCheckoutOffer(retryError)) {
                        await refresh();
                        announceRefresh();
                        throw new Error('The Pro offer changed. Review the updated order summary and confirm again.');
                    }
                    throw retryError;
                }
            } else {
                if (isChangedCheckoutOffer(error)) {
                    await refresh();
                    announceRefresh();
                    throw new Error('The Pro offer changed. Review the updated order summary and confirm again.');
                }
                throw error;
            }
        }
        assertCurrentAccount();
        await writePendingBillingCheckout({
            lifecycle, attemptId: result.attemptId,
            isCurrent: () => activeActionLifecycle.current === lifecycle,
        });
        assertCurrentAccount();
        announceRefresh();
        return result;
    }, [announceRefresh, assertCurrentAccount, isBillingConnectionReady, lifecycle, refresh, status]);
    const openPortal = useCallback(async () => {
        assertCurrentAccount();
        if (!lifecycle
            || !isBillingConnectionReady
            || !status?.actions.portalAvailable) throw new Error('BILLING_DISABLED');
        const result = await billingClient.createPortal(lifecycle.sessionId);
        assertCurrentAccount();
        return result.url;
    }, [assertCurrentAccount, isBillingConnectionReady, lifecycle, status]);
    const handleCheckoutReturn = useCallback(async (outcome: 'success' | 'cancel') => {
        assertCurrentAccount();
        if (!lifecycle || !isBillingConnectionReady) throw new Error('BILLING_DISABLED');
        const pending = await readPendingBillingCheckout(lifecycle);
        assertCurrentAccount();
        if (outcome === 'cancel' && pending) {
            await billingClient.abandonCheckout(lifecycle.sessionId, pending.attemptId);
        } else if (outcome === 'success') {
            await billingClient.refresh(lifecycle.sessionId, 'checkout_return');
        }
        assertCurrentAccount();
        await clearPendingBillingCheckout(lifecycle);
        assertCurrentAccount();
        announceRefresh();
        await refresh();
    }, [announceRefresh, assertCurrentAccount, isBillingConnectionReady, lifecycle, refresh]);
    const handlePortalReturn = useCallback(async () => {
        assertCurrentAccount();
        if (!lifecycle || !isBillingConnectionReady) throw new Error('BILLING_DISABLED');
        await billingClient.refresh(lifecycle.sessionId, 'portal_return');
        assertCurrentAccount();
        announceRefresh();
        await refresh();
    }, [announceRefresh, assertCurrentAccount, isBillingConnectionReady, lifecycle, refresh]);
    const value = useMemo<BillingContextValue>(() => ({
        ...billing,
        refresh: refreshCanonicalStatus,
        hasActiveCloudAccount: Boolean(lifecycle),
        isCloudAccountLoading: isCloudIdentityLoading,
        isBillingConnectionReady,
        isBillingReconnecting,
        connectedAccountReference: billing.status?.account.accountReference ?? null,
        entitlementState,
        startTrial,
        createCheckout,
        openPortal,
        handleCheckoutReturn,
        handlePortalReturn,
    }), [
        billing,
        refreshCanonicalStatus,
        lifecycle,
        isCloudIdentityLoading,
        isBillingConnectionReady,
        isBillingReconnecting,
        entitlementState,
        startTrial,
        createCheckout,
        openPortal,
        handleCheckoutReturn,
        handlePortalReturn,
    ]);
    return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

// Context providers and their companion hooks intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useBilling(): BillingContextValue {
    return useContext(BillingContext);
}
