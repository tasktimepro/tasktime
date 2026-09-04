import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingClientError } from '@/services/billingClient';

const state = vi.hoisted(() => ({
    value: {} as Record<string, unknown>,
    clients: [] as Array<{ id: string; archived?: boolean }>,
    features: {
        sandbox: false,
        ui: true,
        trialActivation: false,
        checkout: false,
    },
}));

vi.mock('@/contexts/BillingContext', () => ({
    useBilling: () => state.value,
}));
vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: state.features,
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
                        memberLimit: 250,
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
                provider: 'dropbox',
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
        state.features.trialActivation = false;
        state.features.checkout = false;
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
        expect(screen.getByText(/\* Founding pricing is limited to the first 250 paid members/)).toBeInTheDocument();
        expect(screen.getByText(/new subscriptions are.*59.*year afterward/i)).toBeInTheDocument();
        expect(screen.getByText(
            'Trial eligibility and the exact offer are confirmed for your connected TaskTime cloud account when you continue.',
        )).toBeInTheDocument();
        expect(screen.queryByText(/Set up Cloud Sync to/)).toBeNull();
        expect(screen.queryByText('Current plan')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }));

        expect(screen.getByText('Set up Cloud Sync to start your Pro trial')).toBeInTheDocument();
        expect(screen.getByText(/Nothing has started yet/)).toBeInTheDocument();
        expect(startTrial).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

        expect(screen.getByText('Set up Cloud Sync to continue with Pro')).toBeInTheDocument();
        expect(createCheckout).not.toHaveBeenCalled();

        const setupButton = screen.getByRole('button', { name: 'Set up Cloud Sync' });
        expect(setupButton).toHaveClass('bg-primary');
        fireEvent.click(setupButton);
        expect(onOpenSync).toHaveBeenCalledOnce();
    });

    it('reassures returning users that Cloud Sync only needs reconnecting', () => {
        const onOpenSync = vi.fn();
        state.value = billingValue({
            status: null,
            resolution: { kind: 'unresolved', reason: 'lifecycle' },
            hasActiveCloudAccount: false,
        });
        render(<BillingPanel onOpenSync={onOpenSync} cloudSyncNeedsReconnect />);

        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

        expect(screen.getByText('Reconnect Cloud Sync to continue with Pro')).toBeInTheDocument();
        expect(screen.getByText(/Cloud Sync is already set up/)).toBeInTheDocument();
        expect(screen.queryByText(/Set up Cloud Sync to continue/)).toBeNull();
        const reconnectButton = screen.getByRole('button', { name: 'Reconnect Cloud Sync' });
        expect(reconnectButton).toHaveClass('bg-primary');

        fireEvent.click(reconnectButton);
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

    it('uses the trial action itself to confirm the visible account without an extra checkbox', async () => {
        const startTrial = vi.fn(async () => undefined);
        state.features.trialActivation = true;
        state.value = billingValue({ startTrial });
        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.getByText('Dropbox · Connected account')).toBeInTheDocument();
        expect(screen.getByText(/Start your one-time 30-day Pro trial for your connected Dropbox account/)).toBeInTheDocument();
        expect(screen.getByText(
            /This trial stays with your TaskTime cloud account if you reconnect it or transfer cloud providers/,
        )).toBeInTheDocument();
        expect(screen.queryByText(/TT-ABCD-EFGH/)).toBeNull();
        expect(screen.getByText(/No payment method is required, and you won't be charged automatically/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }));
        await waitFor(() => expect(startTrial).toHaveBeenCalledOnce());
        expect(screen.getByText(/One active client/)).toBeTruthy();
    });

    it('keeps the comparison layout after status loads and hides billing management for Free', () => {
        const value = billingValue();
        state.value = billingValue({
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutEnabled: true,
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
                    portalAvailable: true,
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        const freeCard = screen.getByRole('region', { name: 'Free' });
        const proCard = screen.getByRole('region', { name: 'Pro' });
        expect(within(freeCard).getByText('Current plan')).toBeInTheDocument();
        expect(within(proCard).queryByText('Current plan')).toBeNull();
        expect(within(proCard).getByRole('button', { name: 'Start free trial' })).toBeInTheDocument();
        expect(within(proCard).queryByRole('button', { name: 'Manage billing' })).toBeNull();
        expect(within(proCard).getByRole('button', { name: 'Get Pro' })).toBeInTheDocument();
        expect(screen.queryByText('Hosted invoice email')).toBeNull();
        expect(screen.queryByText(/Usage is temporarily unavailable/)).toBeNull();
    });

    it('uses the connected provider email for display and Checkout while keeping the stable reference hidden', async () => {
        const value = billingValue();
        const createCheckout = vi.fn(async () => ({
            url: 'https://checkout.stripe.com/c/pay/cs_test_fixture',
            attemptId: 'attempt-fixture',
        }));
        state.features.checkout = true;
        state.value = billingValue({
            createCheckout,
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutEnabled: true,
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
        render(
            <BillingPanel
                onOpenSync={vi.fn()}
                connectedAccountEmail="owner@example.com"
            />,
        );

        expect(screen.getByText('Dropbox · owner@example.com')).toBeInTheDocument();
        expect(screen.getByText((_, element) => (
            element?.tagName === 'P'
            && element.textContent?.includes('Pro trial for owner@example.com') === true
        ))).toBeInTheDocument();
        expect(screen.queryByText(/TT-ABCD-EFGH/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));
        await waitFor(() => expect(createCheckout).toHaveBeenCalledWith(
            'pro-founding-annual-eur',
            'test-catalog-1',
            'owner@example.com',
        ));
    });

    it('marks Pro as the current plan and keeps billing management inside its card', () => {
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
                actions: {
                    ...value.status.actions,
                    portalAvailable: true,
                },
                subscription: {
                    ...value.status.subscription,
                    offerId: 'pro-founding-annual-eur',
                    offerKind: 'founding',
                    billingStatus: 'active',
                    price: {
                        currency: 'EUR',
                        unitAmountMinor: 3900,
                        interval: 'year',
                        taxPresentation: 'calculated_at_checkout',
                        renewal: 'automatic',
                    },
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        const freeCard = screen.getByRole('region', { name: 'Free' });
        const proCard = screen.getByRole('region', { name: 'Pro' });
        expect(within(freeCard).queryByText('Current plan')).toBeNull();
        expect(within(proCard).getByText('Current plan')).toBeInTheDocument();
        expect(within(proCard).getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
        expect(within(proCard).queryByRole('button', { name: 'Start free trial' })).toBeNull();
        expect(screen.queryByText('Hosted invoice email')).toBeNull();
    });

    it('does not invite repurchase while cached Pro waits for canonical status', () => {
        state.value = billingValue({
            status: null,
            resolution: {
                kind: 'canonical',
                snapshot: {
                    ...freeSnapshot,
                    accessStatus: 'active',
                    source: 'subscription',
                    limits: { activeClients: null },
                },
            },
            hasActiveCloudAccount: true,
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        const proCard = screen.getByRole('region', { name: 'Pro' });
        expect(within(proCard).getByText('Current plan')).toBeInTheDocument();
        expect(within(proCard).queryByRole('button', { name: 'Start free trial' })).toBeNull();
        expect(within(proCard).queryByRole('button', { name: 'Get Pro' })).toBeNull();
        expect(within(proCard).getByRole('button', { name: 'Refresh billing status' })).toBeInTheDocument();
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
                    portalAvailable: true,
                },
            },
        });

        render(<BillingPanel onOpenSync={vi.fn()} />);

        expect(screen.getByText(/€39\/year\*/)).toBeInTheDocument();
        expect(screen.getByText(/\* Founding pricing is limited to the first 250 paid members/)).toBeInTheDocument();
        expect(screen.getByText(/retained while the same subscription continues or remains recoverable/)).toBeInTheDocument();
        const proCard = screen.getByRole('region', { name: 'Pro' });
        const actions = within(proCard).getByTestId('pro-plan-actions');
        const rightActions = within(proCard).getByTestId('pro-plan-actions-right');
        const trialButton = within(proCard).getByRole('button', { name: 'Start free trial' });
        const checkoutButton = within(proCard).getByRole('button', { name: 'Get Pro' });
        const qualifier = within(proCard).getByText('Tax calculated at checkout');
        expect(actions).toHaveClass('w-full');
        expect(actions).toContainElement(trialButton);
        expect(rightActions).toHaveClass('ml-auto', 'justify-end');
        expect(within(proCard).queryByRole('button', { name: 'Manage billing' })).toBeNull();
        expect(rightActions).toContainElement(checkoutButton);
        expect(rightActions.lastElementChild).toBe(checkoutButton);
        expect(checkoutButton.querySelector('svg')).toHaveClass('lucide-rocket');
        expect(qualifier).toHaveClass('text-right');
        expect(within(proCard).queryByText(/renews automatically/i)).toBeNull();
        expect(actions.compareDocumentPosition(qualifier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('replaces the Get Pro rocket with the standard spinner while Checkout is opening', async () => {
        let rejectCheckout: ((reason?: unknown) => void) | null = null;
        const createCheckout = vi.fn(() => new Promise((_, reject) => {
            rejectCheckout = reject;
        }));
        const value = billingValue();
        state.features.checkout = true;
        state.value = billingValue({
            createCheckout,
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutEnabled: true,
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

        const checkoutButton = screen.getByRole('button', { name: 'Get Pro' });
        fireEvent.click(checkoutButton);

        const loadingButton = await screen.findByRole('button', { name: 'Opening Checkout…' });
        expect(loadingButton).toBeDisabled();
        expect(loadingButton.querySelector('svg')).toHaveClass('animate-spin', 'lucide-loader-circle');
        expect(loadingButton.querySelector('svg')).not.toHaveClass('lucide-rocket');

        rejectCheckout?.(new Error('Checkout test stop'));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Get Pro' })).toBeEnabled());
    });

    it('never exposes an internal billing code when Checkout recovery cannot complete', async () => {
        const value = billingValue();
        state.features.checkout = true;
        state.value = billingValue({
            createCheckout: vi.fn(async () => {
                throw new BillingClientError('CHECKOUT_EXPIRED', 409, false);
            }),
            status: {
                ...value.status,
                actions: {
                    ...value.status.actions,
                    checkoutEnabled: true,
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
        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

        expect(await screen.findByText(/previous Checkout link expired/i)).toBeInTheDocument();
        expect(screen.queryByText(/CHECKOUT_EXPIRED/)).toBeNull();
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
        expect(screen.getByText(/This TaskTime cloud account has already used its one-time Pro trial/)).toBeInTheDocument();
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
