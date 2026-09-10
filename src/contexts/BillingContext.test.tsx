import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    refresh: vi.fn(async () => undefined),
    billingRefresh: vi.fn(async () => undefined),
    createCheckout: vi.fn(),
    writePending: vi.fn(async () => undefined),
    sessionId: 'session-fixture',
    hostedSessionId: undefined as string | null | undefined,
    isCloudConnected: true,
    isConnecting: false,
    isCloudIdentityLoading: false,
    hadPreviousCloudSession: true,
    movedToStorageProvider: null as 'google-drive' | 'dropbox' | null,
    billingStatusOptions: null as Record<string, unknown> | null,
}));

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: {
        status: true,
        ui: true,
        checkout: true,
        trialActivation: false,
    },
}));
vi.mock('./YjsContext', () => ({
    useYjs: () => ({
        activeStorageProvider: 'dropbox',
        activeStorageSessionId: state.sessionId,
        activeStorageGeneration: 3,
        hostedServiceSessionId: state.hostedSessionId === undefined ? state.sessionId : state.hostedSessionId,
        isCloudConnected: state.isCloudConnected,
        isConnecting: state.isConnecting,
        isCloudIdentityLoading: state.isCloudIdentityLoading,
        hadPreviousCloudSession: state.hadPreviousCloudSession,
        movedToStorageProvider: state.movedToStorageProvider,
    }),
}));
vi.mock('@/hooks/useBillingStatus', () => ({
    useBillingStatus: (options: Record<string, unknown>) => {
        state.billingStatusOptions = options;
        return {
            resolution: { kind: 'canonical', snapshot: { accessStatus: 'free' } },
            status: {
                account: { accountReference: 'TT-TEST-0001' },
                actions: {
                    checkoutEnabled: true,
                    trialActivationEnabled: false,
                    portalAvailable: false,
                },
            },
            catalog: null,
            isLoading: false,
            offline: false,
            clockUntrusted: false,
            error: null,
            catalogError: null,
            refresh: state.refresh,
        };
    },
}));
vi.mock('@/services/billingClient', async () => {
    const actual = await vi.importActual<typeof import('@/services/billingClient')>('@/services/billingClient');
    return {
        ...actual,
        billingClient: {
            createCheckout: state.createCheckout,
            refresh: state.billingRefresh,
        },
    };
});
vi.mock('@/utils/billingStorage', () => ({
    writePendingBillingCheckout: state.writePending,
    readPendingBillingCheckout: vi.fn(async () => null),
    clearPendingBillingCheckout: vi.fn(async () => undefined),
}));

import { BillingClientError } from '@/services/billingClient';
import { BillingProvider, useBilling } from './BillingContext';

function CheckoutProbe({ billingContactEmail }: { billingContactEmail?: string }) {
    const billing = useBilling();
    const [message, setMessage] = useState('');
    return (
        <>
            <button
                type="button"
                onClick={() => void billing.createCheckout(
                    'pro-founding-annual-eur',
                    'test-catalog-1',
                    billingContactEmail,
                ).catch(error => setMessage(error instanceof Error ? error.message : 'unknown'))}
            >
                Start Checkout
            </button>
            <p>{message}</p>
            <p data-testid="cloud-account">{String(billing.hasActiveCloudAccount)}</p>
            <p data-testid="billing-ready">{String(billing.isBillingConnectionReady)}</p>
            <p data-testid="entitlement-plan">{billing.entitlementState.plan}</p>
            <p data-testid="entitlement-connection">{billing.entitlementState.connection}</p>
        </>
    );
}

function PortalReturnProbe() {
    const billing = useBilling();
    return (
        <button type="button" onClick={() => void billing.handlePortalReturn()}>
            Reconcile Portal return
        </button>
    );
}

function UserRefreshProbe() {
    const billing = useBilling();
    return (
        <button type="button" onClick={() => void billing.refresh()}>
            Refresh billing status
        </button>
    );
}

describe('BillingProvider Checkout continuity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.isCloudConnected = true;
        state.sessionId = 'session-fixture';
        state.hostedSessionId = undefined;
        state.isConnecting = false;
        state.isCloudIdentityLoading = false;
        state.hadPreviousCloudSession = true;
        state.movedToStorageProvider = null;
        state.billingStatusOptions = null;
    });

    it('keeps the mounted account and entitlement when a lazy consumer loads a hot-updated module', async () => {
        // Vite versions invalidated imports this way when Reports first loads
        // after a shared-modal update. The mounted provider is not remounted.
        const updated = await import('./BillingContext.tsx?hmr-regression');
        expect(updated.BillingProvider).not.toBe(BillingProvider);
        function UpdatedConsumer() {
            const billing = updated.useBilling();
            return <p>{billing.resolution.kind}:{String(billing.hasActiveCloudAccount)}</p>;
        }
        render(<BillingProvider><UpdatedConsumer /></BillingProvider>);
        expect(screen.getByText('canonical:true')).toBeInTheDocument();
    });

    it('refreshes a stale founding offer and requires a fresh explicit confirmation', async () => {
        state.createCheckout.mockRejectedValueOnce(new BillingClientError(
            'FOUNDING_OFFER_ENDED',
            409,
            false,
            {
                effectiveOfferId: 'pro-standard-annual-eur',
                planConfigVersion: 'test-catalog-2',
            },
        ));
        render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        expect(screen.getByTestId('cloud-account')).toHaveTextContent('true');
        expect(screen.getByTestId('entitlement-plan')).toHaveTextContent('free');
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('ready');

        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));

        await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
        expect(await screen.findByText(/offer changed.*review.*confirm again/i)).toBeInTheDocument();
        expect(state.createCheckout).toHaveBeenCalledOnce();
        expect(state.writePending).not.toHaveBeenCalled();
    });

    it('passes an explicit billing contact through without making it account authority', async () => {
        state.createCheckout.mockResolvedValueOnce({
            version: 1,
            url: 'https://checkout.stripe.com/c/pay/cs_test_contact',
            attemptId: 'contact-attempt',
        });
        render(
            <BillingProvider>
                <CheckoutProbe billingContactEmail="owner@example.com" />
            </BillingProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));

        await waitFor(() => expect(state.createCheckout).toHaveBeenCalledWith(
            'session-fixture',
            'pro-founding-annual-eur',
            'test-catalog-1',
            undefined,
            'owner@example.com',
        ));
        expect(state.writePending).toHaveBeenCalledWith(expect.objectContaining({
            attemptId: 'contact-attempt',
        }));
    });

    it('clears an expired Checkout attempt and retries the unchanged offer from the same click', async () => {
        state.createCheckout
            .mockRejectedValueOnce(new BillingClientError('CHECKOUT_EXPIRED', 409, false))
            .mockResolvedValueOnce({
                version: 1,
                url: 'https://checkout.stripe.com/c/pay/cs_test_replacement',
                attemptId: 'replacement-attempt',
            });
        render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));

        await waitFor(() => expect(state.createCheckout).toHaveBeenCalledTimes(2));
        expect(state.createCheckout).toHaveBeenNthCalledWith(
            1,
            'session-fixture',
            'pro-founding-annual-eur',
            'test-catalog-1',
        );
        expect(state.createCheckout).toHaveBeenNthCalledWith(
            2,
            'session-fixture',
            'pro-founding-annual-eur',
            'test-catalog-1',
        );
        expect(state.refresh).toHaveBeenCalled();
        expect(state.writePending).toHaveBeenCalledWith({
            lifecycle: {
                provider: 'dropbox',
                generation: 3,
                sessionId: 'session-fixture',
            },
            attemptId: 'replacement-attempt',
            isCurrent: expect.any(Function),
        });
        expect(screen.queryByText(/CHECKOUT_EXPIRED/)).toBeNull();
    });

    it('requires fresh confirmation if the offer changes while replacing an expired Checkout', async () => {
        state.createCheckout
            .mockRejectedValueOnce(new BillingClientError('CHECKOUT_EXPIRED', 409, false))
            .mockRejectedValueOnce(new BillingClientError(
                'FOUNDING_OFFER_ENDED',
                409,
                false,
                {
                    effectiveOfferId: 'pro-standard-annual-eur',
                    planConfigVersion: 'test-catalog-2',
                },
            ));
        render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));

        await waitFor(() => expect(state.createCheckout).toHaveBeenCalledTimes(2));
        expect(await screen.findByText(/offer changed.*review.*confirm again/i)).toBeInTheDocument();
        expect(state.createCheckout).toHaveBeenLastCalledWith(
            'session-fixture',
            'pro-founding-annual-eur',
            'test-catalog-1',
        );
        expect(state.writePending).not.toHaveBeenCalled();
    });

    it('reconciles canonical Stripe state after returning from the Portal', async () => {
        render(<BillingProvider><PortalReturnProbe /></BillingProvider>);

        fireEvent.click(screen.getByRole('button', { name: 'Reconcile Portal return' }));

        await waitFor(() => expect(state.billingRefresh).toHaveBeenCalledWith(
            'session-fixture',
            'portal_return',
        ));
        expect(state.refresh).toHaveBeenCalled();
    });

    it('reconciles canonical Stripe state for an explicit user refresh', async () => {
        render(<BillingProvider><UserRefreshProbe /></BillingProvider>);

        fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }));

        await waitFor(() => expect(state.billingRefresh).toHaveBeenCalledWith(
            'session-fixture',
            'user_retry',
        ));
        expect(state.refresh).toHaveBeenCalled();
    });

    it('keeps the exact local billing lifecycle while cloud reconnection gates online actions', async () => {
        state.isCloudConnected = false;
        state.isConnecting = true;
        const view = render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        expect(screen.getByTestId('cloud-account')).toHaveTextContent('true');
        expect(screen.getByTestId('billing-ready')).toHaveTextContent('false');
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('reconnecting');
        expect(state.billingStatusOptions).toMatchObject({
            lifecycle: {
                provider: 'dropbox',
                generation: 3,
                sessionId: 'session-fixture',
            },
            onlineRefreshEnabled: false,
        });

        state.isCloudConnected = true;
        state.isConnecting = false;
        view.rerender(<BillingProvider><CheckoutProbe /></BillingProvider>);

        expect(screen.getByTestId('cloud-account')).toHaveTextContent('true');
        expect(screen.getByTestId('billing-ready')).toHaveTextContent('true');
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('ready');
        expect(state.billingStatusOptions).toMatchObject({ onlineRefreshEnabled: true });
    });

    it('publishes a distinct reconnect-required state after automatic restoration settles', () => {
        state.isCloudConnected = false;

        render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        expect(screen.getByTestId('entitlement-plan')).toHaveTextContent('free');
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('reconnect_required');
    });

    it('keeps the billing cache intact while provider identity is still loading', () => {
        state.isCloudIdentityLoading = true;
        render(<BillingProvider><CheckoutProbe /></BillingProvider>);

        expect(state.billingStatusOptions).toMatchObject({ lifecycleLoading: true });
    });

    it('treats a moved-source device as needing reconnection, not as a fresh purchase prospect', () => {
        state.isCloudConnected = false;
        state.movedToStorageProvider = 'google-drive';
        render(<BillingProvider><CheckoutProbe /></BillingProvider>);
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('reconnect_required');
    });

    it('never treats a partial or mismatched hosted identity as a fresh account-free browser', () => {
        state.hostedSessionId = 'mismatched-session';
        const view = render(<BillingProvider><CheckoutProbe /></BillingProvider>);
        expect(state.billingStatusOptions).toMatchObject({ lifecycle: null, onlineRefreshEnabled: false });
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('reconnect_required');
        state.isConnecting = true;
        view.rerender(<BillingProvider><CheckoutProbe /></BillingProvider>);
        expect(screen.getByTestId('entitlement-connection')).toHaveTextContent('reconnecting');
    });

    it('does not publish or hand off a delayed Checkout for the previous cloud account', async () => {
        let resolve!: (value: unknown) => void;
        state.createCheckout.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        const view = render(<BillingProvider><CheckoutProbe /></BillingProvider>);
        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));
        state.sessionId = 'different-session';
        view.rerender(<BillingProvider><CheckoutProbe /></BillingProvider>);
        await act(async () => resolve({ url: 'https://checkout.stripe.com/old', attemptId: 'old-attempt' }));
        expect(screen.getByText(/cloud account changed/i)).toBeInTheDocument();
        expect(state.writePending).not.toHaveBeenCalled();
    });
});
