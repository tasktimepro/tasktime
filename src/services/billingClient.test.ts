import { describe, expect, it, vi } from 'vitest';

import {
    BillingClientError,
    createBillingClient,
    parseBillingCatalog,
    parseBillingStatus,
} from './billingClient';

const freeEntitlement = {
    version: 1,
    entitlementRevision: 4,
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
    sourceUpdatedAt: '2026-08-30T08:00:00.000Z',
    lastReconciledAt: null,
};

const status = {
    version: 1,
    authenticated: true,
    serverTime: Date.parse('2026-08-30T08:00:00.000Z'),
    entitlementRevision: 4,
    account: {
        provider: 'google-drive',
        displayLabel: 'Google Drive · TaskTime account TT-ABCD-EFGH',
        accountReference: 'TT-ABCD-EFGH',
    },
    planConfigVersion: 'test-catalog-1',
    subscription: {
        offerId: null,
        offerKind: null,
        price: null,
        billingStatus: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
        repairRequired: false,
    },
    actions: {
        trialActivationEnabled: false,
        checkoutEnabled: false,
        checkoutOffer: null,
        checkoutOfferReason: 'checkout_disabled',
        portalAvailable: false,
    },
    usage: {
        invoiceEmail: {
            available: true,
            entitled: false,
            effectiveLimit: 0,
            effectiveRemaining: 0,
            window: null,
        },
    },
    entitlement: freeEntitlement,
    license: 'signed.fixture.assertion',
};

const disabledCatalog = {
    version: 1,
    planConfigVersion: 'live-disabled-1',
    purchaseEnabled: false,
    trial: { durationHours: 720, paymentMethodRequired: false, autoCharges: false },
    plans: [
        {
            plan: 'free',
            displayName: 'Free',
            features: ['oneActiveClient', 'basicReportsOverview'],
            activeClients: 1,
            invoiceEmailSendsPerUtcMonth: 0,
            offers: [],
        },
        {
            plan: 'pro',
            displayName: 'Pro',
            features: ['unlimitedActiveClients', 'advancedReports', 'hostedEmail'],
            activeClients: null,
            invoiceEmailSendsPerUtcMonth: null,
            offers: [],
        },
    ],
    legal: { termsVersion: 'pending', privacyVersion: 'pending', refundPolicyVersion: 'pending' },
};

describe('billing client contract', () => {
    it('accepts the exact disabled catalog and rejects purchaser data while disabled', () => {
        expect(parseBillingCatalog(disabledCatalog)).toEqual(disabledCatalog);
        expect(() => parseBillingCatalog({
            ...disabledCatalog,
            plans: [
                disabledCatalog.plans[0],
                { ...disabledCatalog.plans[1], invoiceEmailSendsPerUtcMonth: 100 },
            ],
        })).toThrow(expect.objectContaining({ code: 'INVALID_CATALOG' }));
        expect(() => parseBillingCatalog({ ...disabledCatalog, futurePlan: true }))
            .toThrow(expect.objectContaining({ code: 'INVALID_CATALOG' }));
    });

    it('accepts one revision-coherent signed Free status and rejects projection drift', () => {
        expect(parseBillingStatus(status)).toMatchObject({
            entitlement: { plan: 'free' },
            usage: { invoiceEmail: { effectiveLimit: 0 } },
        });
        expect(() => parseBillingStatus({ ...status, license: '' }))
            .toThrow(expect.objectContaining({ code: 'INVALID_STATUS' }));
        expect(() => parseBillingStatus({
            ...status,
            entitlementRevision: 5,
        })).toThrow(expect.objectContaining({ code: 'INVALID_STATUS' }));
        expect(() => parseBillingStatus({
            ...status,
            usage: {
                invoiceEmail: {
                    ...status.usage.invoiceEmail,
                    entitled: true,
                },
            },
        })).toThrow(expect.objectContaining({ code: 'INVALID_STATUS' }));
    });

    it('ignores bounded additive status fields without preserving or granting them', () => {
        const parsed = parseBillingStatus({
            ...status,
            futureTopLevel: { automaticPurchaseEnabled: true },
            account: { ...status.account, futureProviderHint: 'ignored' },
            subscription: { ...status.subscription, futureBillingAction: 'ignored' },
            actions: { ...status.actions, automaticPurchaseEnabled: true },
            usage: {
                ...status.usage,
                futureQuota: 999,
                invoiceEmail: {
                    ...status.usage.invoiceEmail,
                    futureRemaining: 999,
                },
            },
            entitlement: {
                ...freeEntitlement,
                futureLifecycle: 'ignored',
                entitlements: ['future.feature'],
                limits: { ...freeEntitlement.limits, futureUnlimitedThings: null },
            },
        });

        expect(parsed.entitlement.entitlements).toEqual([]);
        expect(parsed).not.toHaveProperty('futureTopLevel');
        expect(parsed.account).not.toHaveProperty('futureProviderHint');
        expect(parsed.subscription).not.toHaveProperty('futureBillingAction');
        expect(parsed.actions).not.toHaveProperty('automaticPurchaseEnabled');
        expect(parsed.usage).not.toHaveProperty('futureQuota');
        expect(parsed.usage.invoiceEmail).not.toHaveProperty('futureRemaining');
    });

    it('refuses a non-Stripe Checkout redirect even on a successful response', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            version: 1,
            url: 'https://checkout.stripe.com.attacker.invalid/session',
            attemptId: '0c57f1be-0dc8-4ec1-867e-84e7278fd0c6',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const client = createBillingClient({ baseUrl: 'https://sync.test.worker', fetchImpl });

        await expect(client.createCheckout(
            'session-fixture',
            'pro-founding-annual-eur',
            'test-catalog-1',
            'idempotency-key-fixture',
        )).rejects.toEqual(expect.objectContaining<Partial<BillingClientError>>({
            code: 'INVALID_RESPONSE',
            retryable: false,
        }));
    });

    it('bounds successful private response bodies before parsing them', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('x', {
            status: 200,
            headers: { 'Content-Length': '131073' },
        }));
        const client = createBillingClient({ baseUrl: 'https://sync.test.worker', fetchImpl });

        await expect(client.getStatus('session-fixture')).rejects.toEqual(
            expect.objectContaining({ code: 'RESPONSE_TOO_LARGE' }),
        );
    });
});
