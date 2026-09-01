import { describe, expect, it } from 'vitest';

import {
    conservativeEntitlement,
    evaluateEntitlementFeature,
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
});
