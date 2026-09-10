import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    billing: {},
}));

vi.mock('@/contexts/BillingContext', () => ({
    useBilling: () => state.billing,
}));

vi.mock('@/components/reports/ReportsShell', () => ({
    ReportsShell: ({ showGetPro, entitlementState }) => (
        <>
            <p data-testid="get-pro-visible">{String(showGetPro)}</p>
            <p data-testid="entitlement-state">{JSON.stringify(entitlementState)}</p>
        </>
    ),
}));

import Reports from './Reports';

const catalog = {
    purchaseEnabled: true,
    plans: [
        { plan: 'free', offers: [] },
        { plan: 'pro', offers: [{ offerId: 'pro-annual' }] },
    ],
};

describe('Reports entry-point entitlement presentation', () => {
    beforeEach(() => {
        state.billing = {
            resolution: { kind: 'unresolved', reason: 'lifecycle' },
            entitlementState: {
                plan: 'unknown',
                accessStatus: 'unresolved',
                verified: false,
                connection: 'disconnected',
            },
            status: null,
            catalog,
        };
    });

    it('uses the same fresh-account Get Pro decision as Plan & Billing', () => {
        render(<Reports enforcementEnabled />);

        expect(screen.getByTestId('get-pro-visible')).toHaveTextContent('true');
        expect(screen.getByTestId('entitlement-state')).toHaveTextContent('"connection":"disconnected"');
    });

    it('does not invite a cached Pro user to repurchase while reconnecting', () => {
        state.billing = {
            ...state.billing,
            resolution: {
                kind: 'canonical',
                snapshot: {
                    accessStatus: 'active',
                    source: 'subscription',
                    sourceExpiresAt: null,
                },
            },
            entitlementState: {
                plan: 'pro',
                accessStatus: 'active',
                verified: true,
                connection: 'reconnecting',
            },
        };

        render(<Reports enforcementEnabled />);

        expect(screen.getByTestId('get-pro-visible')).toHaveTextContent('false');
    });
});
