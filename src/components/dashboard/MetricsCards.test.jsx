import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetricsCards from './MetricsCards';
import { buildDashboardReport } from './dashboardMetrics';

vi.mock('./DashboardHoursChart', () => ({ default: ({ days }) => <div data-testid="chart">{days.length} days</div> }));
const report = buildDashboardReport({
    range: { startDate: '2026-09-01', endDate: '2026-09-30' }, todayStr: '2026-09-08',
    preferredCurrency: 'EUR', convertToCurrency: amounts => ({ amounts }),
    tasks: [], projects: [], clients: [], entries: [], invoices: [], expenses: [], recurrences: [],
});
const props = { report, period: 'this-month', periodOptions: [{ value: 'this-month', label: 'This Month' }, { value: 'last-month', label: 'Last Month' }], onPeriodChange: vi.fn(), preferredCurrency: 'EUR', loading: false, error: null, onRetry: vi.fn() };

describe('dashboard reports overview', () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
    afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView; });
    it('shows four labeled metrics and the matching chart, including clear zero states', async () => {
        render(<MetricsCards {...props} />);
        for (const label of ['Tracked time', 'Unbilled amount', 'Received', 'Expenses']) expect(screen.getByRole('heading', { name: label, exact: true })).toBeVisible();
        expect(await screen.findByTestId('chart')).toHaveTextContent('30 days');
        expect(screen.getByText('No time tracked in this period.')).toBeVisible();
        expect(screen.queryByRole('button', { name: /previous|next|custom/i })).not.toBeInTheDocument();
        screen.getByRole('combobox', { name: 'Dashboard report period' }).focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.click(await screen.findByRole('option', { name: 'Last Month' }));
        expect(props.onPeriodChange).toHaveBeenCalledWith('last-month');
    });

    it('shows original currencies separately without the removed upcoming expense note', () => {
        render(<MetricsCards {...props} report={{ ...report,
            received: { amounts: { EUR: 80, USD: 100 }, hadConversionError: true },
        }} />);
        const received = screen.getByRole('heading', { name: 'Received' }).parentElement.parentElement;
        expect(within(received).getByText('€80.00')).toBeVisible();
        expect(within(received).getByText('$100.00')).toBeVisible();
        expect(screen.getByText(/Unavailable conversions/)).toBeVisible();
        expect(screen.queryByText(/Upcoming expenses in this period/)).not.toBeInTheDocument();
    });

    it('labels increases, decreases, no change and unavailable comparisons without depending on color', () => {
        render(<MetricsCards {...props} comparison={{ label: 'vs last month', range: { startDate: '2026-08-01', endDate: '2026-08-31' },
            time: { direction: 'up', label: '+25%' }, unbilled: { direction: 'down', label: '−50%' },
            received: { direction: 'flat', label: 'No change' }, spent: { direction: 'unavailable', label: 'N/A' },
        }} />);
        expect(screen.getAllByText('+25%')).toHaveLength(1);
        expect(screen.getByText('−50%')).toBeVisible();
        expect(screen.getByText('No change')).toBeVisible();
        expect(screen.getByText('N/A')).toBeVisible();
        expect(screen.getAllByText('vs last month')).toHaveLength(4);
    });

    it('hides totals during loading or failure and exposes retry without changing the period', async () => {
        const { rerender } = render(<MetricsCards {...props} loading />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading report');
        expect(screen.queryByRole('heading', { name: 'Received' })).not.toBeInTheDocument();
        rerender(<MetricsCards {...props} error="Unable to load dashboard history." />);
        expect(screen.getByRole('alert')).toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(props.onRetry).toHaveBeenCalledOnce();
    });
});
