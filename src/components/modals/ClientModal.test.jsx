import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientModal from './ClientModal';

const state = vi.hoisted(() => ({
    clients: [],
    resolution: {
        kind: 'canonical',
        snapshot: {
            accessStatus: 'free',
            limits: { activeClients: 1 },
        },
    },
    createClientWithPolicyLock: vi.fn(),
    updateClient: vi.fn(),
    updateUrl: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
}));

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: { clientLimitEnforcement: true },
}));
vi.mock('@/contexts/BillingContext', () => ({
    useBilling: () => ({ resolution: state.resolution }),
}));
vi.mock('../../hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: state.clients,
        createClientWithPolicyLock: state.createClientWithPolicyLock,
        updateClient: state.updateClient,
    }),
}));
vi.mock('@/hooks/useUrlState', () => ({
    useUrlState: () => ({ updateUrl: state.updateUrl }),
}));
vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({ preferences: { currency: 'EUR' } }),
}));
vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: state.showSuccess, showError: state.showError }),
}));
vi.mock('../../utils/idUtils.ts', () => ({
    generateSlugId: () => 'new-client',
}));

describe('ClientModal active-client policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.clients = [];
        state.resolution = {
            kind: 'canonical',
            snapshot: {
                accessStatus: 'free',
                limits: { activeClients: 1 },
            },
        };
        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = vi.fn();
        }
    });

    it('shows an upgrade path before mounting a second-client form', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        state.clients = [{ id: 'existing-client', archived: false }];

        render(<ClientModal isOpen={true} onClose={onClose} />);

        const noticeTitle = screen.getByText('Free includes one active client');
        const notice = noticeTitle.closest('.rounded-md');
        const closeButton = screen.getByRole('button', { name: 'Close' });
        const upgradeButton = screen.getByRole('button', { name: 'Unlock unlimited clients' });

        expect(notice).toHaveClass('bg-muted', 'border-border');
        expect(notice).not.toHaveClass('status-warning-surface');
        expect(closeButton.parentElement).toBe(upgradeButton.parentElement);
        expect(closeButton.compareDocumentPosition(upgradeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(upgradeButton).toHaveClass('bg-primary');
        expect(upgradeButton.querySelector('svg')).not.toBeNull();
        expect(screen.queryByLabelText(/Client Title/i)).not.toBeInTheDocument();
        await user.click(upgradeButton);
        expect(onClose).toHaveBeenCalledOnce();
        expect(state.updateUrl).toHaveBeenCalledWith({ view: 'account', section: 'billing' });
    });

    it('uses recovery rather than purchase copy while entitlement is unresolved', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        state.resolution = { kind: 'unresolved', reason: 'network' };

        render(<ClientModal isOpen={true} onClose={onClose} />);

        expect(screen.getByText('Plan status needs confirmation')).toBeInTheDocument();
        expect(screen.queryByText('Unlock unlimited clients')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Check cloud account' }));
        expect(state.updateUrl).toHaveBeenCalledWith({ view: 'account', section: 'sync' });
    });

    it('creates the first Free client through the revalidating policy lock', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(<ClientModal isOpen={true} onClose={onClose} />);

        await user.type(screen.getByLabelText(/Client Title/i), 'Acme');
        await user.type(screen.getByLabelText(/Business\/Name/i), 'Acme Ltd');
        await user.click(screen.getByRole('button', { name: /Pricing & Taxes/i }));
        await user.type(screen.getByLabelText(/Hourly Rate/i), '120');
        await user.click(screen.getByRole('button', { name: 'Create Client' }));

        expect(state.createClientWithPolicyLock).toHaveBeenCalledWith(expect.objectContaining({
            id: 'new-client',
            title: 'Acme',
            clientName: 'Acme Ltd',
            hourlyRate: 120,
            archived: false,
        }));
        expect(state.showSuccess).toHaveBeenCalledWith('Client created successfully!');
        expect(onClose).toHaveBeenCalledOnce();
    });
});
