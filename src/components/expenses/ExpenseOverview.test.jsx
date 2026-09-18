import { cloneElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ExpenseMetrics from './ExpenseMetrics';
import ExpenseInsights from './ExpenseInsights';
import ExpenseSpendingChart from './ExpenseSpendingChart';
import { buildExpenseOverview } from './expenseOverviewMetrics';

vi.mock('recharts', async original => ({ ...await original(), ResponsiveContainer: ({ children }) => cloneElement(children, { width: 480, height: 192 }) }));
const money = amounts => ({ amounts, hadConversionError: false });
const baseExpense = { id: 'expense', title: 'Hosting', date: '2026-09-10', currency: 'EUR', amount: 50, paymentStatus: 'paid', paidOn: '2026-09-10', isPersonal: true, isRecurring: false, amountType: 'fixed' };
const overview = extra => buildExpenseOverview({ expenses: [baseExpense], recurrences: [], upcoming: [], categories: [], range: { startDate: '2026-09-01', endDate: '2026-09-30' }, period: 'month', today: '2026-09-15', currency: 'EUR', convert: amounts => money(amounts), ...extra });

it('shows compact summaries and routes their actions without changing payments', () => {
    const onRecurring = vi.fn();
    const onUpcoming = vi.fn();
    const result = overview();
    const { rerender } = render(<ExpenseMetrics overview={result} currency="EUR" periodLabel="This month" onRecurring={onRecurring} onUpcoming={onUpcoming} />);
    expect(screen.getByRole('region', { name: 'Expense summary' })).toHaveTextContent('€50.00');
    expect(screen.getByText('100% of period spend')).toBeInTheDocument();
    expect(screen.queryByText('Manage recurring expenses')).not.toBeInTheDocument();
    expect(screen.queryByText('View upcoming expenses')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage recurring expenses' }));
    fireEvent.click(screen.getByRole('button', { name: 'View upcoming expenses' }));
    expect(onRecurring).toHaveBeenCalledOnce();
    expect(onUpcoming).toHaveBeenCalledOnce();
    for (const direction of ['up', 'down']) {
        rerender(<ExpenseMetrics overview={{ ...result, trend: { direction, label: '+5%' } }} currency="EUR" periodLabel="Last month" />);
        expect(screen.getByText('+5%')).toBeInTheDocument();
    }
    rerender(<ExpenseMetrics overview={result} currency="EUR" periodLabel="This month" loading />);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(4);
    expect(screen.queryByText('€50.00')).not.toBeInTheDocument();
    rerender(<ExpenseMetrics overview={result} currency="EUR" periodLabel="This month" error="Offline" />);
    expect(screen.getAllByLabelText('Unavailable')).toHaveLength(4);
});

it('discloses unknown estimates and original currencies without inventing a top category', () => {
    const result = { ...overview({ expenses: [] }), spent: money({ USD: 100, EUR: 20 }), recurring: money({ USD: 50, EUR: 10 }), chartCurrency: null, unknownRecurringCount: 1, nextDate: '2026-09-20', upcomingEstimated: true };
    render(<ExpenseMetrics overview={result} currency="EUR" periodLabel="Period" />);
    expect(screen.getByText('Multiple currencies')).toBeInTheDocument();
    expect(screen.getByText('1 variable without an estimate')).toBeInTheDocument();
    expect(screen.getByText(/Next /)).toBeInTheDocument();
    expect(screen.getByText('~')).toBeInTheDocument();
});

it('offers complete category and activity detail and opens the exact source expense', async () => {
    const expenses = Array.from({ length: 7 }, (_, index) => ({ ...baseExpense, id: 'e' + index, title: 'Expense ' + index, amount: index + 1, categoryId: 'c' + index }));
    const categories = expenses.map((item, index) => ({ id: item.categoryId, name: 'Category ' + index, color: index === 0 ? '#ef4444' : null }));
    const result = overview({ expenses, categories, upcoming: [{ ...baseExpense, id: 'next', title: 'Upcoming renewal', date: '2026-09-20', categoryId: 'c0' }] });
    const onView = vi.fn();
    const { rerender } = render(<ExpenseInsights overview={result} currency="EUR" periodLabel="This month" onView={onView} />);
    fireEvent.click(screen.getByRole('button', { name: 'View full breakdown' }));
    expect(screen.getByText('Category 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Category 0')).not.toBeInTheDocument();
    const activityCard = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(activityCard).getAllByRole('listitem')).toHaveLength(3);
    expect(within(activityCard).getAllByTestId('category-color-dot')[0]).toHaveStyle({ backgroundColor: '#ef4444' });
    fireEvent.click(screen.getByText('Upcoming renewal').closest('button'));
    expect(onView).toHaveBeenCalledWith(result.activity[0].expense);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    const modal = screen.getByRole('dialog', { name: 'Recent activity' });
    expect(within(modal).getByText(/Last 30 days/)).toBeInTheDocument();
    expect(within(modal).getAllByRole('listitem')).toHaveLength(7);
    expect(within(modal).queryByText('Upcoming renewal')).not.toBeInTheDocument();
    expect(within(activityCard).getAllByRole('listitem', { hidden: true })).toHaveLength(3);
    fireEvent.click(within(modal).getByText('Expense 6').closest('button'));
    expect(onView).toHaveBeenLastCalledWith(expenses[6]);
    fireEvent.click(within(modal).getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<ExpenseInsights overview={{ ...result, chartCurrency: null, spent: { amounts: { USD: 1 }, hadConversionError: true }, breakdown: [{ id: '', name: 'Uncategorized', money: money({ USD: 1 }), percentage: null }], activity: [{ expense: baseExpense, label: 'New expense', kind: 'created', date: '2026-09-01' }] }} currency="EUR" periodLabel="This month" />);
    expect(screen.getByText(/combined chart is unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable conversions/)).toBeInTheDocument();
    rerender(<ExpenseInsights overview={overview({ expenses: [] })} currency="EUR" periodLabel="This month" />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
    expect(screen.getByText('No paid expenses in this period')).toBeInTheDocument();
});

it('makes monthly amounts available in an accessible table and keyboard tooltip', async () => {
    const user = userEvent.setup();
    render(<ExpenseSpendingChart months={overview().months} currency="EUR" />);
    expect(screen.getByRole('table', { name: 'Monthly paid expense values' })).toHaveTextContent('September 2026€50.00');
    act(() => screen.getByRole('application', { name: 'Monthly paid expenses' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByText('May 2026')).toHaveLength(2);
});


it('keeps archived category identity in historical summaries', () => {
    const result = overview({ expenses: [{ ...baseExpense, categoryId: 'software' }], categories: [{ id: 'software', name: 'Software', color: '#3b82f6', archived: true }] });
    render(<ExpenseInsights overview={result} currency="EUR" periodLabel="This month" />);
    screen.getAllByTestId('category-color-dot').forEach(dot => {
        expect(dot).toHaveStyle({ backgroundColor: '#3b82f6' });
    });
    expect(screen.getByText('Software')).toBeVisible();
});
