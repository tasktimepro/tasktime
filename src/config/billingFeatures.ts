type BillingFeatureValues = Partial<Record<
    | 'VITE_BILLING_SANDBOX_MODE'
    | 'VITE_BILLING_UI_ENABLED'
    | 'VITE_BILLING_CANARY_UI_ENABLED'
    | 'VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT'
    | 'VITE_REPORTS_ENTITLEMENT_ENFORCEMENT'
    | 'VITE_EMAIL_ENTITLEMENT_ENFORCEMENT',
    unknown
>>;

export type BillingFeatures = {
    sandbox: boolean;
    localCatalogFallback: boolean;
    ui: boolean;
    canaryUi: boolean;
    status: boolean;
    trialActivation: boolean;
    checkout: boolean;
    clientLimitEnforcement: boolean;
    advancedReportsEnforcement: boolean;
    emailEntitlementEnforcement: boolean;
};

function enabled(value: unknown): boolean {
    return value === 'true';
}

function isLoopbackHost(hostname: string): boolean {
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '::1'
        || hostname === '[::1]';
}

export function isLocalBillingSandboxAllowed(input: {
    isDevelopment: boolean;
    hostname: string;
    sandboxValue: unknown;
}): boolean {
    return input.isDevelopment && isLoopbackHost(input.hostname) && enabled(input.sandboxValue);
}

export function buildBillingFeatures(input: {
    isDevelopment: boolean;
    hostname: string;
    values: BillingFeatureValues;
}): BillingFeatures {
    const sandbox = isLocalBillingSandboxAllowed({
        isDevelopment: input.isDevelopment,
        hostname: input.hostname,
        sandboxValue: input.values.VITE_BILLING_SANDBOX_MODE,
    });
    const ui = sandbox || enabled(input.values.VITE_BILLING_UI_ENABLED);
    const canaryUi = !sandbox && enabled(input.values.VITE_BILLING_CANARY_UI_ENABLED);
    return {
        sandbox,
        localCatalogFallback: input.isDevelopment && isLoopbackHost(input.hostname) && !sandbox,
        ui,
        canaryUi,
        status: ui,
        trialActivation: sandbox || canaryUi,
        checkout: sandbox || canaryUi,
        clientLimitEnforcement: sandbox
            || enabled(input.values.VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT),
        advancedReportsEnforcement: sandbox
            || enabled(input.values.VITE_REPORTS_ENTITLEMENT_ENFORCEMENT),
        emailEntitlementEnforcement: sandbox
            || enabled(input.values.VITE_EMAIL_ENTITLEMENT_ENFORCEMENT),
    };
}

/**
 * Every Program Phase 1 control is dark by default. Worker controls remain an
 * independent server-side requirement; these flags can never authorize work.
 * The real billing sandbox is restricted to Vite development mode on a
 * loopback hostname. It enables the normal Worker-backed billing flow while
 * disabling the bundled catalog fallback so configuration failures stay
 * visible. Production catalog values and controls remain independent.
 */
export const BILLING_FEATURES = Object.freeze(buildBillingFeatures({
    isDevelopment: import.meta.env.DEV,
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    values: {
        VITE_BILLING_SANDBOX_MODE: import.meta.env.VITE_BILLING_SANDBOX_MODE,
        VITE_BILLING_UI_ENABLED: import.meta.env.VITE_BILLING_UI_ENABLED,
        VITE_BILLING_CANARY_UI_ENABLED: import.meta.env.VITE_BILLING_CANARY_UI_ENABLED,
        VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT: import.meta.env.VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT,
        VITE_REPORTS_ENTITLEMENT_ENFORCEMENT: import.meta.env.VITE_REPORTS_ENTITLEMENT_ENFORCEMENT,
        VITE_EMAIL_ENTITLEMENT_ENFORCEMENT: import.meta.env.VITE_EMAIL_ENTITLEMENT_ENFORCEMENT,
    },
}));
