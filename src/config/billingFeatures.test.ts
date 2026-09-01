import { describe, expect, it } from 'vitest';

import {
    buildBillingFeatures,
    isLocalBillingSandboxAllowed,
} from './billingFeatures';

describe('billing feature configuration', () => {
    it('allows the real billing sandbox only for an explicit development loopback session', () => {
        expect(isLocalBillingSandboxAllowed({
            isDevelopment: true,
            hostname: 'localhost',
            sandboxValue: 'true',
        })).toBe(true);
        expect(isLocalBillingSandboxAllowed({
            isDevelopment: true,
            hostname: '127.0.0.1',
            sandboxValue: 'true',
        })).toBe(true);
        expect(isLocalBillingSandboxAllowed({
            isDevelopment: true,
            hostname: '::1',
            sandboxValue: 'true',
        })).toBe(true);

        for (const input of [
            { isDevelopment: false, hostname: 'localhost', sandboxValue: 'true' },
            { isDevelopment: true, hostname: 'app.tasktime.pro', sandboxValue: 'true' },
            { isDevelopment: true, hostname: 'localhost', sandboxValue: 'false' },
            { isDevelopment: true, hostname: 'localhost', sandboxValue: undefined },
        ]) {
            expect(isLocalBillingSandboxAllowed(input)).toBe(false);
        }
    });

    it('enables the real billing client and enforcement only inside the loopback sandbox', () => {
        expect(buildBillingFeatures({
            isDevelopment: true,
            hostname: 'localhost',
            values: {
                VITE_BILLING_SANDBOX_MODE: 'true',
                VITE_BILLING_CANARY_UI_ENABLED: 'true',
            },
        })).toEqual({
            sandbox: true,
            localCatalogFallback: false,
            ui: true,
            canaryUi: false,
            status: true,
            trialActivation: true,
            checkout: true,
            clientLimitEnforcement: true,
            advancedReportsEnforcement: true,
            emailEntitlementEnforcement: true,
        });
    });

    it('preserves the independent production-style controls outside preview mode', () => {
        expect(buildBillingFeatures({
            isDevelopment: true,
            hostname: 'localhost',
            values: {
                VITE_BILLING_UI_ENABLED: 'true',
                VITE_BILLING_CANARY_UI_ENABLED: 'true',
                VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT: 'true',
                VITE_REPORTS_ENTITLEMENT_ENFORCEMENT: 'true',
                VITE_EMAIL_ENTITLEMENT_ENFORCEMENT: 'true',
            },
        })).toEqual({
            sandbox: false,
            localCatalogFallback: true,
            ui: true,
            canaryUi: true,
            status: true,
            trialActivation: true,
            checkout: true,
            clientLimitEnforcement: true,
            advancedReportsEnforcement: true,
            emailEntitlementEnforcement: true,
        });
    });

    it('never enables the bundled catalog fallback outside loopback development', () => {
        expect(buildBillingFeatures({
            isDevelopment: false,
            hostname: 'localhost',
            values: { VITE_BILLING_UI_ENABLED: 'true' },
        }).localCatalogFallback).toBe(false);
        expect(buildBillingFeatures({
            isDevelopment: true,
            hostname: 'app.tasktime.pro',
            values: { VITE_BILLING_UI_ENABLED: 'true' },
        }).localCatalogFallback).toBe(false);
    });
});
