import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientModal from './ClientModal';

const state = vi.hoisted(() => ({
    clients: [],
    connection: 'ready',
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
    useBilling: () => ({
        resolution: state.resolution,
        entitlementState: {
            plan: state.resolution.kind === 'canonical' ? 'free' : 'unknown',
            accessStatus: state.resolution.snapshot?.accessStatus ?? 'unresolved',
            verified: state.resolution.kind === 'canonical',
            connection: state.connection,
        },
    }),
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
        state.connection = 'ready';
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
        state.clients = [{ id: 'existing-client', archived: false }];

        render(<ClientModal isOpen={true} onClose={onClose} />);

        expect(screen.getByText('Plan status needs confirmation')).toBeInTheDocument();
        expect(screen.queryByText('Unlock unlimited clients')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Check plan status' }));
        expect(state.updateUrl).toHaveBeenCalledWith({ view: 'account', section: 'billing' });
    });

    it.each([
        ['disconnected', 'Unlock unlimited clients', 'billing'],
        ['reconnect_required', 'Reconnect Cloud Sync', 'sync'],
        ['reconnecting', 'Reconnecting…', null],
        ['offline', 'Offline', null],
    ])('uses the shared recovery for an unverified %s account', async (connection, label, section) => {
        state.resolution = { kind: 'unresolved', reason: 'lifecycle' };
        state.connection = connection;
        state.clients = [{ id: 'existing-client', archived: false }];
        render(<ClientModal isOpen={true} onClose={vi.fn()} />);
        const action = screen.getByRole('button', { name: label });
        if (section) {
            await userEvent.setup().click(action);
            expect(state.updateUrl).toHaveBeenCalledWith({ view: 'account', section });
        } else {
            expect(action).toBeDisabled();
        }
        expect(state.createClientWithPolicyLock).not.toHaveBeenCalled();
    });

    it('keeps the first-client form available before plan status resolves', () => {
        state.resolution = { kind: 'unresolved', reason: 'lifecycle' };

        render(<ClientModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByLabelText(/Client Title/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Client' })).toBeInTheDocument();
        expect(screen.queryByText('Plan status needs confirmation')).not.toBeInTheDocument();
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
