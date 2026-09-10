import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSummaryCards from './DashboardSummaryCards';

it('keeps unpaid totals inclusive while opening the existing outstanding and overdue views separately', async () => {
    const navigateToInvoices = vi.fn();
    render(<DashboardSummaryCards currentMonth={{ unbilled: { amounts: {} }, unbilledTime: 0, unpricedTime: 0, unpaid: { amounts: { EUR: 300 } }, unpaidCount: 3, overdueCount: 1 }} todayTime={0} recentDays={[0, 0, 0, 0, 0, 0, 0]} dueCount={2} overdueCount={1} preferredCurrency="EUR" loading={false} navigateToInvoices={navigateToInvoices} />);
    expect(screen.getByText('€300.00')).toBeVisible();
    const outstanding = screen.getByRole('button', { name: '2 outstanding invoices' });
    const overdue = screen.getByRole('button', { name: '1 overdue invoice' });
    expect(outstanding).toHaveClass('cursor-pointer');
    expect(outstanding).not.toHaveClass('status-danger-text-strong');
    expect(overdue).toHaveClass('cursor-pointer', 'status-danger-text-strong');
    await userEvent.click(outstanding);
    expect(navigateToInvoices).toHaveBeenLastCalledWith({ section: 'invoices', tab: 'outstanding' });
    await userEvent.click(overdue);
    expect(navigateToInvoices).toHaveBeenLastCalledWith({ section: 'invoices', tab: 'overdue' });
});

it('keeps task counts available while history loads or fails and discloses unpriced time after recovery', () => {
    const props = { currentMonth: { unbilled: { amounts: {} }, unbilledTime: 3600000, unpricedTime: 3600000, unpaid: { amounts: {} }, unpaidCount: 0, overdueCount: 0 }, todayTime: 3600000, recentDays: [0, 3600000], dueCount: 2, overdueCount: 0, preferredCurrency: 'EUR' };
    const { rerender } = render(<DashboardSummaryCards {...props} loading />);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(3);
    expect(screen.getByText('2')).toBeVisible();
    rerender(<DashboardSummaryCards {...props} error="History unavailable" />);
    expect(screen.getAllByLabelText('Unavailable')).toHaveLength(3);
    expect(screen.getAllByText('Records unavailable')).toHaveLength(3);
    rerender(<DashboardSummaryCards {...props} />);
    expect(screen.getByText('1h unbilled · some time has no hourly rate')).toBeVisible();
    expect(screen.getByText('No unpaid invoices')).toBeVisible();
});
