import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('ReportsShell', () => {
    beforeEach(() => {
        state.section = 'overview';
        state.updateUrl.mockClear();
    });

    it('always shows the exact report routes and a billing-independent Free Overview', () => {
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(<ReportsShell resolution={{ kind: 'unresolved', reason: 'network' }} renderAdvanced={renderAdvanced} />);
        for (const label of [
            'Overview', 'Monthly', 'Statement', 'Work Summary', 'Tax', 'Invoices',
            'Outstanding', 'Expenses', 'Hours', 'To Invoice',
        ]) expect(screen.getByRole('tab', { name: label, exact: true })).toBeInTheDocument();
        expect(screen.getByText('Received')).toBeInTheDocument();
        expect(screen.getByText('Tracked time')).toBeInTheDocument();
        expect(renderAdvanced).not.toHaveBeenCalled();
    });

    it('keeps the established single-row horizontally scrollable report tabs without repeated Pro badges', () => {
        render(<ReportsShell resolution={free} renderAdvanced={() => null} />);
        const tabList = screen.getByRole('tablist');

        expect(tabList.parentElement).toHaveClass('overflow-x-auto');
        expect(tabList).toHaveClass('w-max', 'min-w-full', 'flex-nowrap');
        expect(tabList).not.toHaveClass('flex-wrap');
        expect(screen.queryByRole('tab', { name: /pro/i })).not.toBeInTheDocument();
    });

    it('renders a static Free preview before protected report code executes', () => {
        state.section = 'tax';
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(<ReportsShell resolution={free} renderAdvanced={renderAdvanced} />);
        expect(screen.getByRole('tab', { name: 'Tax' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'VAT / Tax Summary' })).toBeInTheDocument();
        expect(screen.getByText(/does not load protected report history/i)).toBeInTheDocument();
        expect(renderAdvanced).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Back to free overview' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            section: 'overview', create: null, tab: null,
        });
    });

    it('executes advanced report code only for a canonical report entitlement', () => {
        state.section = 'hours';
        const renderAdvanced = vi.fn(() => <div>Protected report</div>);
        render(<ReportsShell resolution={pro} renderAdvanced={renderAdvanced} />);
        expect(screen.getByText('Protected report')).toBeInTheDocument();
        expect(renderAdvanced).toHaveBeenCalledOnce();
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.queryByText('Pro')).not.toBeInTheDocument();
    });

    it('canonicalizes an unsupported section and routes the Pro action safely', () => {
        state.section = 'not-a-report';
        const { rerender } = render(<ReportsShell resolution={free} renderAdvanced={() => null} />);
        expect(state.updateUrl).toHaveBeenCalledWith({ section: 'overview', create: null, tab: null });
        state.section = 'monthly';
        rerender(<ReportsShell resolution={free} renderAdvanced={() => null} />);
        fireEvent.click(screen.getByRole('button', { name: 'View Pro options' }));
        expect(state.updateUrl).toHaveBeenCalledWith({
            view: 'account', section: 'billing', create: null, tab: null,
        });
    });
});
