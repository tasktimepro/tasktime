import { createContext } from 'react';
import type { BillingContextValue } from './BillingContext';

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
    isCloudAccountLoading: false,
    isBillingConnectionReady: false,
    isBillingReconnecting: false,
    connectedAccountReference: null,
    refresh: async () => undefined,
    startTrial: async () => { throw new Error('BILLING_DISABLED'); },
    createCheckout: async () => { throw new Error('BILLING_DISABLED'); },
    openPortal: async () => { throw new Error('BILLING_DISABLED'); },
    handleCheckoutReturn: async () => { throw new Error('BILLING_DISABLED'); },
    handlePortalReturn: async () => { throw new Error('BILLING_DISABLED'); },
};

// Like YjsContext, this must not depend at runtime on provider UI modules:
// a first lazy import after HMR must retain the mounted account's entitlement.
export const BillingContext = createContext<BillingContextValue>(DISABLED_VALUE);
