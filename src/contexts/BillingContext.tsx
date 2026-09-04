import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { buildLocalReviewBillingCatalog } from '@/config/localReviewPricing';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
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

type BillingContextValue = {
    resolution: EntitlementResolution;
    status: BillingStatusResponseV1 | null;
    catalog: BillingCatalogV1 | null;
    isLoading: boolean;
    offline: boolean;
    clockUntrusted: boolean;
    error: string | null;
    catalogError: string | null;
    hasActiveCloudAccount: boolean;
    connectedAccountReference: string | null;
    refresh: () => Promise<void>;
    startTrial: () => Promise<void>;
    createCheckout: (
        offerId: string,
        planConfigVersion: string,
        billingContactEmail?: string,
    ) => Promise<{ url: string; attemptId: string }>;
    openPortal: () => Promise<string>;
    handleCheckoutReturn: (outcome: 'success' | 'cancel') => Promise<void>;
};

const DISABLED_VALUE: BillingContextValue = {
    resolution: { kind: 'unresolved', reason: 'lifecycle' },
    status: null,
    catalog: null,
    isLoading: false,
    offline: false,
    clockUntrusted: false,
    error: null,
    catalogError: null,
    hasActiveCloudAccount: false,
    connectedAccountReference: null,
    refresh: async () => undefined,
    startTrial: async () => { throw new Error('BILLING_DISABLED'); },
    createCheckout: async () => { throw new Error('BILLING_DISABLED'); },
    openPortal: async () => { throw new Error('BILLING_DISABLED'); },
    handleCheckoutReturn: async () => { throw new Error('BILLING_DISABLED'); },
};

const BillingContext = createContext<BillingContextValue>(DISABLED_VALUE);

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
    } = useYjs();
    const lifecycle = useMemo(() => {
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
    const localCatalogFallback = useMemo<BillingCatalogV1 | null>(() => (
        BILLING_FEATURES.localCatalogFallback
            ? buildLocalReviewBillingCatalog() as BillingCatalogV1
            : null
    ), []);
    const liveBilling = useBillingStatus({
        enabled: BILLING_FEATURES.status,
        catalogEnabled: BILLING_FEATURES.ui,
        lifecycle,
        fallbackCatalog: localCatalogFallback,
    });
    const billing = liveBilling;
    const { refresh, status } = billing;
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
    const startTrial = useCallback(async () => {
        if (!BILLING_FEATURES.trialActivation
            || !lifecycle
            || !status?.actions.trialActivationEnabled) throw new Error('BILLING_DISABLED');
        await billingClient.startTrial(lifecycle.sessionId);
        announceRefresh();
        await refresh();
    }, [announceRefresh, lifecycle, refresh, status]);
    const createCheckout = useCallback(async (
        offerId: string,
        planConfigVersion: string,
        billingContactEmail?: string,
    ) => {
        if (!BILLING_FEATURES.checkout
            || !lifecycle
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
            if (error instanceof BillingClientError && error.code === 'CHECKOUT_EXPIRED') {
                await refresh();
                try {
                    result = await openCheckout();
                } catch (retryError) {
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
        await writePendingBillingCheckout({ lifecycle, attemptId: result.attemptId });
        announceRefresh();
        return result;
    }, [announceRefresh, lifecycle, refresh, status]);
    const openPortal = useCallback(async () => {
        if (!lifecycle || !status?.actions.portalAvailable) throw new Error('BILLING_DISABLED');
        const result = await billingClient.createPortal(lifecycle.sessionId);
        return result.url;
    }, [lifecycle, status]);
    const handleCheckoutReturn = useCallback(async (outcome: 'success' | 'cancel') => {
        if (!lifecycle) throw new Error('BILLING_DISABLED');
        const pending = await readPendingBillingCheckout(lifecycle);
        if (outcome === 'cancel' && pending) {
            await billingClient.abandonCheckout(lifecycle.sessionId, pending.attemptId);
        } else if (outcome === 'success') {
            await billingClient.refresh(lifecycle.sessionId, 'checkout_return');
        }
        await clearPendingBillingCheckout();
        announceRefresh();
        await refresh();
    }, [announceRefresh, lifecycle, refresh]);
    const value = useMemo<BillingContextValue>(() => ({
        ...billing,
        hasActiveCloudAccount: Boolean(lifecycle),
        connectedAccountReference: billing.status?.account.accountReference ?? null,
        startTrial,
        createCheckout,
        openPortal,
        handleCheckoutReturn,
    }), [billing, lifecycle, startTrial, createCheckout, openPortal, handleCheckoutReturn]);
    return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

// Context providers and their companion hooks intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useBilling(): BillingContextValue {
    return useContext(BillingContext);
}
