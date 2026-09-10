import { describe, expect, it } from 'vitest';

import {
    conservativeEntitlement,
    deriveEntitlementState,
    evaluateGetProAction,
    evaluateEntitlementFeature,
    getEntitlementRecovery,
    parseEntitlementSnapshot,
} from './entitlementPolicy';

const FREE = {
    version: 1,
    entitlementRevision: 1,
    planConfigVersion: 'test-catalog-1',
    subject: 'principal-test',
    plan: 'free',
    accessStatus: 'free',
    billingStatus: 'none',
    source: 'free',
    trialStatus: 'eligible',
    trialStartedAt: null,
    trialEndsAt: null,
    sourceExpiresAt: null,
    entitlements: [],
    limits: {
        invoiceEmailSendsPerMonth: 0,
        cloudSync: true,
        automaticCloudBackups: true,
        webPush: true,
        activeProjects: null,
        activeClients: 1,
        activeTasks: null,
    },
    subscriptionCurrentPeriodStart: null,
    subscriptionCurrentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    graceUntil: null,
    sourceUpdatedAt: '2026-08-30T12:00:00.000Z',
    lastReconciledAt: null,
};

describe('client entitlement policy', () => {
    it('shares upgrade, verification, connection and billing recovery without granting access', () => {
        const unknown = { plan: 'unknown', accessStatus: 'unresolved', verified: false } as const;
        for (const [connection, kind, section] of [
            ['ready', 'status', 'billing'],
            ['disconnected', 'upgrade', 'billing'],
            ['reconnecting', 'reconnecting', null],
            ['reconnect_required', 'reconnect', 'sync'],
            ['offline', 'offline', null],
        ] as const) {
            expect(getEntitlementRecovery({ ...unknown, connection })).toMatchObject({ kind, section });
        }
        expect(getEntitlementRecovery({ plan: 'free', accessStatus: 'free', verified: true, connection: 'ready' }))
            .toMatchObject({ kind: 'upgrade', section: 'billing' });
        expect(getEntitlementRecovery({ plan: 'pro', accessStatus: 'suspended', verified: true, connection: 'ready' }))
            .toMatchObject({ kind: 'billing', section: 'billing' });
    });

    it('strictly validates Free and access-granting limit combinations', () => {
        expect(parseEntitlementSnapshot(FREE)).toMatchObject({ accessStatus: 'free' });
        expect(() => parseEntitlementSnapshot({
            ...FREE,
            accessStatus: 'active',
            plan: 'pro',
            source: 'subscription',
            billingStatus: 'active',
            entitlements: ['reports.access', 'invoice.email.send'],
            limits: { ...FREE.limits, activeClients: 1, invoiceEmailSendsPerMonth: 100 },
        })).toThrow('INVALID_ENTITLEMENT');
    });

    it('distinguishes canonical Free from unresolved conservative fallback', () => {
        expect(evaluateEntitlementFeature({
            kind: 'canonical',
            snapshot: parseEntitlementSnapshot(FREE),
        }, 'reports.access')).toEqual({
            allowed: false,
            reason: 'entitlement_required',
            upgradeEligible: true,
        });
        expect(evaluateEntitlementFeature(conservativeEntitlement('network'), 'reports.access'))
            .toEqual({ allowed: false, reason: 'status_unavailable', upgradeEligible: false });
    });

    it('allows only the exact paid keys on trial, active, and grace', () => {
        for (const accessStatus of ['trial', 'active', 'grace'] as const) {
            const snapshot = parseEntitlementSnapshot({
                ...FREE,
                plan: 'pro',
                accessStatus,
                billingStatus: accessStatus === 'trial' ? 'none' : 'active',
                source: accessStatus === 'trial' ? 'trial' : 'subscription',
                trialStatus: accessStatus === 'trial' ? 'active' : 'used',
                trialStartedAt: accessStatus === 'trial' ? '2026-08-30T12:00:00.000Z' : null,
                trialEndsAt: accessStatus === 'trial' ? '2026-09-29T12:00:00.000Z' : null,
                subscriptionCurrentPeriodStart: accessStatus === 'trial' ? null : '2026-08-01T00:00:00.000Z',
                subscriptionCurrentPeriodEnd: accessStatus === 'trial' ? null : '2027-08-01T00:00:00.000Z',
                graceUntil: accessStatus === 'grace' ? '2026-09-02T00:00:00.000Z' : null,
                entitlements: ['reports.access', 'invoice.email.send'],
                limits: { ...FREE.limits, activeClients: null, invoiceEmailSendsPerMonth: 100 },
            });
            expect(evaluateEntitlementFeature({ kind: 'canonical', snapshot }, 'reports.access'))
                .toEqual({ allowed: true, reason: 'entitled', upgradeEligible: false });
        }
    });

    it('derives one verified plan and connection state for every UI surface', () => {
        const pro = parseEntitlementSnapshot({
            ...FREE,
            plan: 'pro',
            accessStatus: 'active',
            billingStatus: 'active',
            source: 'subscription',
            trialStatus: 'used',
            entitlements: ['reports.access', 'invoice.email.send'],
            limits: { ...FREE.limits, activeClients: null, invoiceEmailSendsPerMonth: 100 },
            subscriptionCurrentPeriodStart: '2026-08-01T00:00:00.000Z',
            subscriptionCurrentPeriodEnd: '2027-08-01T00:00:00.000Z',
        });

        expect(deriveEntitlementState({
            resolution: { kind: 'canonical', snapshot: pro },
            offline: false,
            hasActiveCloudAccount: true,
            isCloudAccountLoading: false,
            isBillingConnectionReady: false,
            isBillingReconnecting: true,
            needsCloudReconnect: false,
        })).toEqual({
            plan: 'pro',
            accessStatus: 'active',
            verified: true,
            connection: 'reconnecting',
        });

        expect(deriveEntitlementState({
            resolution: conservativeEntitlement('lifecycle'),
            offline: true,
            hasActiveCloudAccount: false,
            isCloudAccountLoading: false,
            isBillingConnectionReady: false,
            isBillingReconnecting: false,
            needsCloudReconnect: false,
        })).toEqual({
            plan: 'unknown',
            accessStatus: 'unresolved',
            verified: false,
            connection: 'offline',
        });
    });

    it('shows Get Pro only for a canonical Checkout or a fresh account-free comparison', () => {
        const fresh = deriveEntitlementState({
            resolution: conservativeEntitlement('lifecycle'),
            offline: false,
            hasActiveCloudAccount: false,
            isCloudAccountLoading: false,
            isBillingConnectionReady: false,
            isBillingReconnecting: false,
            needsCloudReconnect: false,
        });
        expect(evaluateGetProAction({
            entitlementState: fresh,
            hasCanonicalStatus: false,
            hasCheckoutOffer: false,
            catalogPurchaseEnabled: true,
            proOfferCount: 2,
            isPermanentComplimentaryPro: false,
        })).toEqual({ visible: true, mode: 'deferred' });

        const unresolvedAccount = { ...fresh, connection: 'ready' as const };
        expect(evaluateGetProAction({
            entitlementState: unresolvedAccount,
            hasCanonicalStatus: false,
            hasCheckoutOffer: false,
            catalogPurchaseEnabled: true,
            proOfferCount: 2,
            isPermanentComplimentaryPro: false,
        })).toEqual({ visible: false, mode: null });

        const free = deriveEntitlementState({
            resolution: { kind: 'canonical', snapshot: parseEntitlementSnapshot(FREE) },
            offline: false,
            hasActiveCloudAccount: true,
            isCloudAccountLoading: false,
            isBillingConnectionReady: true,
            isBillingReconnecting: false,
            needsCloudReconnect: false,
        });
        expect(evaluateGetProAction({
            entitlementState: free,
            hasCanonicalStatus: true,
            hasCheckoutOffer: true,
            catalogPurchaseEnabled: true,
            proOfferCount: 2,
            isPermanentComplimentaryPro: false,
        })).toEqual({ visible: true, mode: 'checkout' });

        expect(evaluateGetProAction({
            entitlementState: { ...free, connection: 'offline' },
            hasCanonicalStatus: true,
            hasCheckoutOffer: true,
            catalogPurchaseEnabled: true,
            proOfferCount: 2,
            isPermanentComplimentaryPro: false,
        })).toEqual({ visible: false, mode: null });

        expect(deriveEntitlementState({
            resolution: conservativeEntitlement('lifecycle'),
            offline: false,
            hasActiveCloudAccount: false,
            isCloudAccountLoading: false,
            isBillingConnectionReady: false,
            isBillingReconnecting: false,
            needsCloudReconnect: true,
        }).connection).toBe('reconnect_required');
    });
});
