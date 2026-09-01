import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    value: {} as Record<string, unknown>,
    clients: [] as Array<{ id: string; archived?: boolean }>,
}));

vi.mock('@/contexts/BillingContext', () => ({
    useBilling: () => state.value,
}));
vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: {
        sandbox: false,
        ui: true,
        trialActivation: false,
        checkout: false,
    },
}));
vi.mock('@/hooks/useClients', () => ({
    useClients: () => ({ clients: state.clients }),
}));

import { BillingPanel } from './BillingPanel';

const freeSnapshot = {
    accessStatus: 'free',
    trialStatus: 'eligible',
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    subscriptionCurrentPeriodEnd: null,
    limits: { activeClients: 1 },
};

const testCatalog = {
    version: 1,
    planConfigVersion: 'test-catalog-1',
    purchaseEnabled: true,
    trial: {
        durationHours: 720,
        paymentMethodRequired: false,
        autoCharges: false,
    },
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
            invoiceEmailSendsPerUtcMonth: 100,
            offers: [
                {
                    offerId: 'pro-founding-annual-eur',
                    offerKind: 'founding',
                    currency: 'EUR',
                    unitAmountMinor: 3900,
                    interval: 'year',
                    taxPresentation: 'calculated_at_checkout',
                    renewal: 'automatic',
                    founding: {
                        memberLimit: 1000,
                        availability: 'available',
                        priceRetention: 'while_same_subscription_continues_or_is_recoverable',
                    },
                },
                {
                    offerId: 'pro-standard-annual-eur',
                    offerKind: 'standard',
                    currency: 'EUR',
                    unitAmountMinor: 5900,
                    interval: 'year',
                    taxPresentation: 'calculated_at_checkout',
                    renewal: 'automatic',
                    founding: null,
                },
            ],
        },
    ],
    legal: {
        termsVersion: 'test-terms',
        privacyVersion: 'test-privacy',
        refundPolicyVersion: 'test-refunds',
    },
};

function billingValue(overrides: Record<string, unknown> = {}) {
    return {
        resolution: { kind: 'canonical', snapshot: freeSnapshot },
        status: {
            account: {
                displayLabel: 'Dropbox · TaskTime account TT-ABCD-EFGH',
                accountReference: 'TT-ABCD-EFGH',
            },
            planConfigVersion: 'test-catalog-1',
            actions: {
                trialActivationEnabled: true,
                checkoutEnabled: false,
                checkoutOffer: null,
                checkoutOfferReason: 'checkout_disabled',
                portalAvailable: false,
            },
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
            usage: {
                invoiceEmail: {
                    available: true,
                    entitled: false,
                    effectiveRemaining: 0,
                    window: null,
                },
            },
        },
        catalog: testCatalog,
        isLoading: false,
        offline: false,
        clockUntrusted: false,
        error: null,
        catalogError: null,
        hasActiveCloudAccount: true,
        refresh: vi.fn(async () => undefined),
        startTrial: vi.fn(async () => undefined),
        createCheckout: vi.fn(),
        openPortal: vi.fn(),
        handleCheckoutReturn: vi.fn(async () => undefined),
        ...overrides,
    };
}

describe('BillingPanel shadow-mode UX', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/account?section=billing');
        state.clients = [];
        state.value = billingValue();
    });

    it('keeps plan details visible before connection and requests Cloud Sync only after an action', () => {
        const onOpenSync = vi.fn();
        const startTrial = vi.fn(async () => undefined);
        const createCheckout = vi.fn();
        state.value = billingValue({
            status: null,
            resolution: { kind: 'unresolved', reason: 'lifecycle' },
            hasActiveCloudAccount: false,
            startTrial,
            createCheckout,
        });
        render(<BillingPanel onOpenSync={onOpenSync} />);

        expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
        expect(screen.getByText(/One active client at a time/)).toBeInTheDocument();
        expect(screen.getByText(/Unlimited active clients/)).toBeInTheDocument();
        expect(screen.getByText(/€39\/year\*/)).toBeInTheDocument();
        expect(screen.getByText(/\* Founding pricing is limited to the first 1,000 paid members/)).toBeInTheDocument();
        expect(screen.getByText(/new subscriptions are.*59.*year afterward/i)).toBeInTheDocument();
        expect(screen.queryByText(/Set up Cloud Sync to/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }));

        expect(screen.getByText('Set up Cloud Sync to start your Pro trial')).toBeInTheDocument();
        expect(screen.getByText(/Nothing has started yet/)).toBeInTheDocument();
        expect(startTrial).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

        expect(screen.getByText('Set up Cloud Sync to continue with Pro')).toBeInTheDocument();
        expect(createCheckout).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Set up Cloud Sync' }));
        expect(onOpenSync).toHaveBeenCalledOnce();
    });

    it('offers billing-status recovery instead of Cloud Sync when a cloud account already exists', async () => {
        const onOpenSync = vi.fn();
        const refresh = vi.fn(async () => undefined);
        state.value = billingValue({
            status: null,
            resolution: { kind: 'unresolved', reason: 'lifecycle' },
            hasActiveCloudAccount: true,
            error: 'NETWORK_ERROR',
            refresh,
        });
        render(<BillingPanel onOpenSync={onOpenSync} />);

        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

        expect(screen.getByText('Refresh billing status to continue with Pro')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Set up Cloud Sync' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }));

        await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
        expect(onOpenSync).not.toHaveBeenCalled();
    });

    it('uses a quiet loading scaffold instead of a blocking catalog notice', () => {
        state.value = billingValue({
            status: null,
            catalog: null,
            resolution: { kind: 'unresolved', reason: 'lifecycle' },
            hasActiveCloudAccount: false,
        });
        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.queryByText('Loading plan details')).toBeNull();
        expect(screen.getByLabelText('Loading plan options')).toHaveAttribute('aria-busy', 'true');
    });

    it('states the no-card/no-auto-charge trial contract while production activation stays disabled', () => {
        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/requires no payment method, does not auto-charge/)).toBeTruthy();
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        expect(screen.getByRole('button', { name: 'Start free trial' })).toBeDisabled();
        expect(screen.getByText(/One active client/)).toBeTruthy();
    });

    it('does not misrepresent Free zero allowance as a live usage projection', () => {
        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/Usage is temporarily unavailable/)).toBeTruthy();
        expect(screen.queryByText('0 remaining')).toBeNull();
    });

    it('marks the available founding Checkout price and explains its capacity and retention', () => {
        const value = billingValue();
        state.value = billingValue({
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutOffer: {
                        offerId: 'pro-founding-annual-eur',
                        offerKind: 'founding',
                        price: {
                            currency: 'EUR',
                            unitAmountMinor: 3900,
                            interval: 'year',
                            taxPresentation: 'calculated_at_checkout',
                            renewal: 'automatic',
                        },
                    },
                    checkoutOfferReason: 'founding_available',
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/€39\/year\*/)).toBeInTheDocument();
        expect(screen.getByText(/\* Founding pricing is limited to the first 1,000 paid members/)).toBeInTheDocument();
        expect(screen.getByText(/retained while the same subscription continues or remains recoverable/)).toBeInTheDocument();
    });

    it('shows the standard Checkout price without a founding footnote after capacity is exhausted', () => {
        const value = billingValue();
        state.value = billingValue({
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutOffer: {
                        offerId: 'pro-standard-annual-eur',
                        offerKind: 'standard',
                        price: {
                            currency: 'EUR',
                            unitAmountMinor: 5900,
                            interval: 'year',
                            taxPresentation: 'calculated_at_checkout',
                            renewal: 'automatic',
                        },
                    },
                    checkoutOfferReason: 'founding_exhausted',
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/€59\/year/)).toBeInTheDocument();
        expect(screen.queryByText(/€59\/year\*/)).toBeNull();
        expect(screen.queryByText(/Founding pricing is limited/)).toBeNull();
    });

    it('reconciles a fixed Checkout return before removing its URL marker', async () => {
        const handleCheckoutReturn = vi.fn(async () => undefined);
        state.value = billingValue({ handleCheckoutReturn });
        window.history.replaceState({}, '', '/account?section=billing&checkout=success');

        render(<BillingPanel onOpenSync={vi.fn()} />);

        await waitFor(() => expect(handleCheckoutReturn).toHaveBeenCalledWith('success'));
        await waitFor(() => expect(window.location.search).toBe('?section=billing'));
    });

    it('waits for the provider-bound account before reconciling a Checkout return', async () => {
        const handleCheckoutReturn = vi.fn(async () => undefined);
        state.value = billingValue({
            status: null,
            hasActiveCloudAccount: false,
            handleCheckoutReturn,
        });
        window.history.replaceState({}, '', '/account?section=billing&checkout=success');

        const view = render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(handleCheckoutReturn).not.toHaveBeenCalled();
        expect(window.location.search).toBe('?section=billing&checkout=success');

        state.value = billingValue({ hasActiveCloudAccount: true, handleCheckoutReturn });
        view.rerender(<BillingPanel onOpenSync={vi.fn()} />);

        await waitFor(() => expect(handleCheckoutReturn).toHaveBeenCalledWith('success'));
        await waitFor(() => expect(window.location.search).toBe('?section=billing'));
    });

    it('shows trial-used, offline, ended-subscription, and over-limit state without hiding data', () => {
        state.clients = [
            { id: 'client-1', archived: false },
            { id: 'client-2', archived: false },
        ];
        state.value = billingValue({
            offline: true,
            resolution: {
                kind: 'canonical',
                snapshot: { ...freeSnapshot, trialStatus: 'used' },
            },
            status: {
                ...billingValue().status,
                subscription: {
                    ...billingValue().status.subscription,
                    billingStatus: 'canceled',
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/2 active clients/)).toBeInTheDocument();
        expect(screen.getByText(/Existing over-limit clients remain fully usable/)).toBeInTheDocument();
        expect(screen.getByText(/one-time Pro trial has already been used/)).toBeInTheDocument();
        expect(screen.getByText(/Subscription ended/)).toBeInTheDocument();
        expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    });

    it('keeps temporary founding saturation retryable without showing standard pricing', () => {
        const value = billingValue();
        state.value = billingValue({
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutOfferReason: 'temporarily_reserved',
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/Founding offer is temporarily busy/)).toBeInTheDocument();
        expect(screen.getByText(/does not switch you to standard pricing/)).toBeInTheDocument();
    });

    it('does not offer trial activation to an active subscriber who never used a trial', () => {
        const value = billingValue();
        state.value = billingValue({
            resolution: {
                kind: 'canonical',
                snapshot: {
                    ...freeSnapshot,
                    accessStatus: 'active',
                    source: 'subscription',
                    trialStatus: 'eligible',
                    limits: { activeClients: null },
                },
            },
            status: {
                ...value.status,
                subscription: {
                    ...value.status.subscription,
                    billingStatus: 'active',
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.queryByRole('button', { name: 'Start free trial' })).toBeNull();
    });
});
