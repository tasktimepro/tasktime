import { describe, expect, it } from 'vitest';
import { buildDashboardComparison, buildDashboardPeriodOptions, buildDashboardReport, resolveDashboardComparison, resolveDashboardPeriod } from './dashboardMetrics';

const hour = 3600000;
const start = new Date(2026, 8, 8, 10).getTime();
const range = { startDate: '2026-09-01', endDate: '2026-09-30' };
const input = {
    range, todayStr: '2026-09-08', preferredCurrency: 'EUR',
    tasks: [{ id: 'billable', title: 'Client', projectId: 'p', billable: true }, { id: 'internal', title: 'Internal' }],
    projects: [{ id: 'p', title: 'Project', hourlyRate: 100 }], clients: [],
    entries: [], invoices: [], expenses: [], recurrences: [],
    convertToCurrency: (amounts) => ({ amounts, hadConversionError: false }),
};

describe('dashboard report', () => {
    it('stacks actual billable and non-billable time, including invoiced and archived work, with zero days', () => {
        const report = buildDashboardReport({ ...input, entries: [
            { id: 'a', taskId: 'billable', start, end: start + hour, billedDurationMs: 2 * hour, billedInvoiceId: 'paid' },
            { id: 'b', taskId: 'internal', start, end: start + 2 * hour },
            { id: 'c', taskId: 'missing', start, end: start + hour / 2 },
            { id: 'adjustment', taskId: 'billable', start, end: start + hour, source: 'invoice-adjustment' },
        ] });
        expect(report.time).toBe(3.5 * hour);
        expect(report.days).toHaveLength(30);
        expect(report.days[7]).toMatchObject({ date: '2026-09-08', billable: hour, nonBillable: 2.5 * hour, total: 3.5 * hour });
        expect(report.days[0].total).toBe(0);
        expect(report.days.reduce((sum, day) => sum + day.billable + day.nonBillable, 0)).toBe(report.time);
    });

    it('uses canonical eligibility, preserving late work before the old cutoff and excluding billing markers', () => {
        const report = buildDashboardReport({ ...input,
            tasks: [{ ...input.tasks[0], lastBilledAt: start + hour }],
            entries: [
                { id: 'late', taskId: 'billable', start, end: start + hour, billedDurationMs: 1.5 * hour },
                { id: 'billed', taskId: 'billable', start, end: start + hour, billedInvoiceId: 'invoice' },
            ],
        });
        expect(report.unbilled.amounts).toEqual({ EUR: 150 });
        expect(report.unbilledTime).toBe(1.5 * hour);
    });

    it('assigns the whole entry to its local start date, including the final day and leap days', () => {
        const leap = resolveDashboardPeriod('2024-02', '2026-09-08');
        const at = new Date(2024, 1, 29, 23, 30).getTime();
        const report = buildDashboardReport({ ...input, range: leap, entries: [
            { id: 'midnight', taskId: 'internal', start: at, end: at + hour },
            { id: 'outside', taskId: 'internal', start: at + hour, end: at + 2 * hour },
        ] });
        expect(report.days).toHaveLength(29);
        expect(report.days[28].total).toBe(hour);
        expect(report.time).toBe(hour);
    });

    it('uses payment dates and frozen snapshots, excluding drafts and canceled invoices', () => {
        const report = buildDashboardReport({ ...input, invoices: [
            { id: 'paid', date: '2025-01-01', status: 'paid', paidAt: start, total: 100, currency: 'USD',
                paymentCurrencySnapshot: { capturedAt: start, sourceCurrency: 'USD', sourceAmount: 100, preferredCurrencyAtPayment: 'EUR', preferredCurrencyAmount: 85 } },
            { id: 'old-payment', date: '2026-09-01', status: 'paid', paidAt: new Date(2026, 7, 1).getTime(), total: 200, currency: 'EUR' },
            { id: 'draft', date: '2026-09-01', status: 'draft', total: 900, currency: 'EUR' },
            { id: 'void', date: '2026-09-01', status: 'canceled', total: 500, currency: 'EUR' },
            { id: 'late', date: '2025-01-01', dueDate: '2025-01-31', status: 'sent', total: 300, currency: 'EUR' },
            { id: 'open', date: '2026-09-01', dueDate: '2026-09-30', status: 'sent', total: 400, currency: 'EUR' },
        ] });
        expect(report.received.amounts).toEqual({ EUR: 85 });
        expect(report.unpaid.amounts).toEqual({ EUR: 700 });
        expect(report.unpaidCount).toBe(2);
        expect(report.overdueCount).toBe(1);
    });

    it('keeps failed conversions in their source currencies and preserves expense payment snapshots', () => {
        const report = buildDashboardReport({ ...input,
            convertToCurrency: (amounts) => ({ amounts, hadConversionError: true }),
            expenses: [
                { id: 'paid', title: 'Subscription', date: '2026-09-03', paymentStatus: 'paid', currency: 'USD', amount: 100,
                    paymentCurrencySnapshot: { capturedAt: start, sourceCurrency: 'USD', sourceAmount: 100, preferredCurrencyAtPayment: 'EUR', preferredCurrencyAmount: 80 } },
                { id: 'unpaid', title: 'Future', date: '2026-09-20', paymentStatus: 'unpaid', currency: 'GBP', amount: 25, amountType: 'variable' },
            ],
        });
        expect(report.spent.amounts).toEqual({ EUR: 80 });
        expect(report).not.toHaveProperty('upcomingExpenses');
    });

    it('rolls presets over at local midnight and lists older months without a custom range', () => {
        expect(resolveDashboardPeriod('last-month', '2026-01-01')).toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' });
        expect(resolveDashboardPeriod('last-90-days', '2026-01-01').endDate).toBe('2026-01-01');
        expect(resolveDashboardPeriod('invalid', '2026-09-08')).toEqual(range);
        const options = buildDashboardPeriodOptions('2026-09-08', [2024]);
        expect(options).toContainEqual({ value: '2024-02', label: 'February 2024' });
        expect(options.some(option => option.value === 'custom')).toBe(false);
    });

    it('retains legacy finalized billing evidence and restores eligibility for canceled invoices without mutation', () => {
        const entries = [{ id: 'legacy', taskId: 'billable', start, end: start + hour }];
        const invoice = { id: 'invoice', date: '2026-09-09', status: 'sent', currency: 'EUR', total: 100, billingPeriodStart: '2026-09-01', billingPeriodEnd: '2026-09-30', tasks: [{ id: 'billable', originalTimeMs: hour }] };
        const source = { ...input, entries, invoices: [invoice] };
        const before = JSON.stringify(source);
        expect(buildDashboardReport(source).unbilled.amounts).toEqual({});
        expect(JSON.stringify(source)).toBe(before);
        expect(buildDashboardReport({ ...source, invoices: [{ ...invoice, status: 'canceled' }] }).unbilled.amounts).toEqual({ EUR: 100 });
    });

    it('excludes future auto-paid expenses and recurring previews from spending', () => {
        const report = buildDashboardReport({ ...input,
            expenses: [{ id: 'future-auto', title: 'Subscription', date: '2026-09-20', paymentStatus: 'paid', paymentMode: 'auto', currency: 'EUR', amount: 20, recurrenceId: 'rec' }],
            recurrences: [{ id: 'rec', active: true, startDate: '2026-09-20', repeat: 'monthly', monthlyType: 'date', monthlyDay: 20, amount: 20, currency: 'EUR', amountType: 'fixed' }],
        });
        expect(report.spent.amounts).toEqual({});
        expect(report).not.toHaveProperty('upcomingExpenses');
    });
});

describe('dashboard period comparisons', () => {
    it('uses previous calendar months across year and leap-year boundaries', () => {
        expect(resolveDashboardComparison({ startDate: '2026-01-01', endDate: '2026-01-31' })).toEqual({
            range: { startDate: '2025-12-01', endDate: '2025-12-31' }, label: 'vs last month',
        });
        expect(resolveDashboardComparison({ startDate: '2024-03-01', endDate: '2024-03-31' }).range).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
    });

    it('uses the immediately preceding 90 calendar days across daylight-saving changes', () => {
        expect(resolveDashboardComparison({ startDate: '2026-03-01', endDate: '2026-05-29' })).toEqual({
            range: { startDate: '2025-12-01', endDate: '2026-02-28' }, label: 'vs last 90d',
        });
    });

    const money = (value, currency = 'EUR', hadConversionError = false) => ({ amounts: { [currency]: value }, hadConversionError });
    const metrics = (time, unbilled = money(time), received = money(time), spent = money(time)) => ({ time, unbilled, received, spent });

    it('calculates actual increases, decreases, zero baselines and unchanged values', () => {
        expect(buildDashboardComparison(metrics(2, money(5), money(0), money(7)), metrics(1, money(10), money(10), money(7)))).toEqual({
            time: { direction: 'up', label: '+100%' }, unbilled: { direction: 'down', label: '−50%' },
            received: { direction: 'down', label: '−100%' }, spent: { direction: 'flat', label: 'No change' },
        });
        expect(buildDashboardComparison(metrics(0), metrics(0)).time).toEqual({ direction: 'flat', label: 'No change' });
        expect(buildDashboardComparison(metrics(1), metrics(0)).time).toEqual({ direction: 'new', label: 'New' });
        expect(buildDashboardComparison(metrics(1.00001), metrics(1)).time).toEqual({ direction: 'up', label: '+<0.1%' });
    });

    it('does not compare incompatible or failed currencies, while a genuinely empty period is zero', () => {
        const previous = metrics(1);
        expect(buildDashboardComparison(metrics(1, money(5, 'USD')), previous).unbilled.direction).toBe('unavailable');
        expect(buildDashboardComparison(metrics(1, money(5, 'EUR', true)), previous).unbilled.direction).toBe('unavailable');
        expect(buildDashboardComparison(previous, metrics(1, money(5, 'EUR', true))).unbilled.direction).toBe('unavailable');
        expect(buildDashboardComparison(metrics(1, { amounts: { EUR: 1, USD: 2 }, hadConversionError: false }), previous).unbilled.direction).toBe('unavailable');
        expect(buildDashboardComparison(metrics(1, { amounts: {}, hadConversionError: false }), previous).unbilled.label).toBe('−100%');
        expect(buildDashboardComparison(previous, metrics(1, { amounts: {}, hadConversionError: false })).unbilled.label).toBe('New');
        expect(buildDashboardComparison(metrics(Infinity), previous).time.direction).toBe('unavailable');
        expect(buildDashboardComparison(metrics(1, money(-5)), metrics(1, money(-10))).unbilled.label).toBe('+50%');
    });
});
