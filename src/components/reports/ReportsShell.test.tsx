import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementState } from '@/domain/entitlements/entitlementPolicy';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
import { ReportsShell } from './ReportsShell';

const state = vi.hoisted(() => ({
    section: 'overview' as string | null,
    updateUrl: vi.fn(),
}));

vi.mock('@/hooks/useUrlState', () => ({
    useUrlState: () => ({
        urlParams: { section: state.section },
        updateUrl: state.updateUrl,
    }),
}));
vi.mock('@/hooks/useInvoices', () => ({
    useInvoices: () => ({ invoices: [], isLoading: false }),
}));
vi.mock('@/hooks/useExpenses', () => ({
    useExpenses: () => ({ expenses: [], isLoading: false }),
}));
vi.mock('@/hooks/useTimeEntries', () => ({
    useTimeEntries: () => ({ entries: [], isLoading: false }),
}));

const free: EntitlementResolution = {
    kind: 'canonical',
    snapshot: {
        accessStatus: 'free',
        entitlements: [],
    } as never,
};
const pro: EntitlementResolution = {
    kind: 'canonical',
    snapshot: {
        accessStatus: 'active',
        entitlements: ['reports.access', 'invoice.email.send'],
    } as never,
};
const freshState: EntitlementState = {
    plan: 'unknown', accessStatus: 'unresolved', verified: false, connection: 'disconnected',
};
const freeState: EntitlementState = {
    plan: 'free', accessStatus: 'free', verified: true, connection: 'ready',
};
const proState: EntitlementState = {
    plan: 'pro', accessStatus: 'active', verified: true, connection: 'ready',
};

describe('ReportsShell', () => {
    beforeEach(() => {
        state.section = 'overview';
        state.updateUrl.mockClear();
    });

    it('always shows the exact report routes and a billing-independent Free Overview', () => {
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'network' }}
                entitlementState={freshState}
                renderAdvanced={renderAdvanced}
            />,
        );
        for (const label of [
            'Overview', 'Monthly', 'Statement', 'Work Summary', 'Tax', 'Invoices',
            'Outstanding', 'Expenses', 'Hours', 'To Invoice',
        ]) expect(screen.getByRole('tab', { name: label, exact: true })).toBeInTheDocument();
        expect(screen.getByText('Received')).toBeInTheDocument();
        expect(screen.getByText('Tracked time')).toBeInTheDocument();
        expect(renderAdvanced).not.toHaveBeenCalled();
    });

    it('keeps the established single-row horizontally scrollable report tabs without repeated Pro badges', () => {
        render(<ReportsShell resolution={free} entitlementState={freeState} renderAdvanced={() => null} />);
        const tabList = screen.getByRole('tablist');

        expect(tabList.parentElement).toHaveClass('overflow-x-auto');
        expect(tabList).toHaveClass('w-max', 'min-w-full', 'flex-nowrap');
        expect(tabList).not.toHaveClass('flex-wrap');
        expect(screen.queryByRole('tab', { name: /pro/i })).not.toBeInTheDocument();
    });

    it('aligns the rocket-led Get Pro action with the Overview title only when eligible', () => {
        const view = render(
            <ReportsShell resolution={free} entitlementState={freeState} showGetPro renderAdvanced={() => null} />,
        );
        const title = screen.getByRole('heading', { name: 'Reports' });
        const action = screen.getByRole('button', { name: 'Get Pro' });

        expect(title.parentElement?.parentElement).toHaveClass('justify-between');
        expect(action.querySelector('svg')).toHaveClass('lucide-rocket');
        fireEvent.click(action);
        expect(state.updateUrl).toHaveBeenCalledWith({
            view: 'account', section: 'billing', create: null, tab: null,
        });

        view.rerender(
            <ReportsShell resolution={free} entitlementState={freeState} showGetPro={false} renderAdvanced={() => null} />,
        );
        expect(screen.queryByRole('button', { name: 'Get Pro' })).not.toBeInTheDocument();
    });

    it('renders a static Free preview before protected report code executes', () => {
        state.section = 'tax';
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(<ReportsShell resolution={free} entitlementState={freeState} renderAdvanced={renderAdvanced} />);
        expect(screen.getByRole('tab', { name: 'Tax' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'VAT / Tax Summary' })).toBeInTheDocument();
        expect(screen.getByText(/does not load protected report history/i)).toBeInTheDocument();
        expect(renderAdvanced).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Back to free overview' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            section: 'overview', create: null, tab: null,
        });
    });

    it('presents a fresh account-free browser as a Pro acquisition opportunity', () => {
        state.section = 'monthly';
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'lifecycle' }}
                entitlementState={{
                    plan: 'unknown', accessStatus: 'unresolved', verified: false, connection: 'disconnected',
                }}
                showGetPro
                renderAdvanced={() => null}
            />,
        );

        expect(screen.getByText('Get Pro to unlock Monthly Summary.')).toBeInTheDocument();
        expect(screen.queryByText(/confirm your TaskTime cloud account/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            view: 'account', section: 'billing', create: null, tab: null,
        });
    });

    it('never asks a fresh account-free browser to confirm an account while Pro options load', () => {
        state.section = 'monthly';
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'lifecycle' }}
                entitlementState={freshState}
                renderAdvanced={() => null}
            />,
        );

        expect(screen.getByText(
            'Advanced reports are available with TaskTime Pro. View current options in Plan & Billing.',
        )).toBeInTheDocument();
        expect(screen.queryByText(/confirm.*account|check.*account/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Get Pro' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View Pro options' })).toBeInTheDocument();
    });

    it('offers Cloud Sync recovery only when a previous account needs explicit reconnection', () => {
        state.section = 'monthly';
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'lifecycle' }}
                entitlementState={{
                    plan: 'unknown', accessStatus: 'unresolved', verified: false, connection: 'reconnect_required',
                }}
                renderAdvanced={() => null}
            />,
        );

        expect(screen.getByText('Reconnect Cloud Sync to confirm your existing plan.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reconnect Cloud Sync' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            view: 'account', section: 'sync', create: null, tab: null,
        });
    });

    it('shows non-actionable progress while an existing account reconnects automatically', () => {
        state.section = 'monthly';
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'lifecycle' }}
                entitlementState={{
                    plan: 'unknown', accessStatus: 'unresolved', verified: false, connection: 'reconnecting',
                }}
                renderAdvanced={() => null}
            />,
        );

        expect(screen.getByText('Reconnecting to your TaskTime cloud account and checking Pro access.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /check account|reconnect cloud sync|get pro/i })).not.toBeInTheDocument();
    });

    it('asks an offline browser to go online without presenting account confirmation', () => {
        state.section = 'monthly';
        render(
            <ReportsShell
                resolution={{ kind: 'unresolved', reason: 'network' }}
                entitlementState={{
                    plan: 'unknown', accessStatus: 'unresolved', verified: false, connection: 'offline',
                }}
                renderAdvanced={() => null}
            />,
        );

        expect(screen.getByText("You're offline. Go online to check Pro access.")).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /check account|reconnect cloud sync|get pro/i })).not.toBeInTheDocument();
    });

    it('executes advanced report code only for a canonical report entitlement', () => {
        state.section = 'hours';
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(<ReportsShell resolution={pro} entitlementState={proState} renderAdvanced={renderAdvanced} />);
        expect(screen.getByText('Protected report')).toBeInTheDocument();
        expect(renderAdvanced).toHaveBeenCalledOnce();
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.queryByText('Pro')).not.toBeInTheDocument();
    });

    it('canonicalizes an unsupported section and routes the Pro action safely', () => {
        state.section = 'not-a-report';
        const { rerender } = render(
            <ReportsShell resolution={free} entitlementState={freeState} renderAdvanced={() => null} />,
        );
        expect(state.updateUrl).toHaveBeenCalledWith({ section: 'overview', create: null, tab: null });
        state.section = 'monthly';
        rerender(<ReportsShell resolution={free} entitlementState={freeState} renderAdvanced={() => null} />);
        fireEvent.click(screen.getByRole('button', { name: 'View Pro options' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            view: 'account', section: 'billing', create: null, tab: null,
        });
    });
});
