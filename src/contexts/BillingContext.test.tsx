import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    refresh: vi.fn(async () => undefined),
    createCheckout: vi.fn(),
    writePending: vi.fn(async () => undefined),
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
        activeStorageSessionId: 'session-fixture',
        activeStorageGeneration: 3,
        hostedServiceSessionId: 'session-fixture',
    }),
}));
vi.mock('@/hooks/useBillingStatus', () => ({
    useBillingStatus: () => ({
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
    }),
}));
vi.mock('@/services/billingClient', async () => {
    const actual = await vi.importActual<typeof import('@/services/billingClient')>('@/services/billingClient');
    return {
        ...actual,
        billingClient: {
            createCheckout: state.createCheckout,
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

function CheckoutProbe() {
    const billing = useBilling();
    const [message, setMessage] = useState('');
    return (
        <>
            <button
                type="button"
                onClick={() => void billing.createCheckout(
                    'pro-founding-annual-eur',
                    'test-catalog-1',
                ).catch(error => setMessage(error instanceof Error ? error.message : 'unknown'))}
            >
                Start Checkout
            </button>
            <p>{message}</p>
            <p data-testid="cloud-account">{String(billing.hasActiveCloudAccount)}</p>
        </>
    );
}

describe('BillingProvider Checkout continuity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        fireEvent.click(screen.getByRole('button', { name: 'Start Checkout' }));

        await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
        expect(await screen.findByText(/offer changed.*review.*confirm again/i)).toBeInTheDocument();
        expect(state.createCheckout).toHaveBeenCalledOnce();
        expect(state.writePending).not.toHaveBeenCalled();
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
});
