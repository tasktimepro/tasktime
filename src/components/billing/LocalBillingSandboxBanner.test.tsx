import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    sandbox: false,
}));

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: {
        get sandbox() {
            return state.sandbox;
        },
    },
}));

import { LocalBillingSandboxBanner } from './LocalBillingSandboxBanner';

describe('LocalBillingSandboxBanner', () => {
    beforeEach(() => {
        state.sandbox = false;
    });

    it('stays absent outside local billing sandbox mode', () => {
        const { container } = render(<LocalBillingSandboxBanner />);

        expect(container).toBeEmptyDOMElement();
    });

    it('labels the real Stripe test-mode boundary without offering synthetic state controls', () => {
        state.sandbox = true;

        render(<LocalBillingSandboxBanner />);

        expect(screen.getByRole('status')).toHaveTextContent('Stripe sandbox');
        expect(screen.getByText(/real Stripe test-mode purchases/i)).toBeInTheDocument();
        expect(screen.getByText(/Never use a real card or customer identity/i)).toBeInTheDocument();
        expect(screen.queryByRole('combobox')).toBeNull();
    });
});
