import { describe, expect, it } from 'vitest';
import { buildExpenseOverview, resolveExpenseComparison } from './expenseOverviewMetrics';

const expense = (extra = {}) => ({ id: 'e', title: 'Software', date: '2026-09-10', currency: 'EUR', amount: 50, paymentStatus: 'paid', paidOn: '2026-09-10', isPersonal: true, billable: false, billingStatus: 'unbilled', isRecurring: false, isTaxExempt: true, ...extra });
const recurrence = (extra = {}) => ({ id: 'r', title: 'Subscription', currency: 'EUR', amount: 120, amountType: 'fixed', repeat: 'monthly', startDate: '2026-01-01', active: true, ...extra });
const input = (extra = {}) => ({ expenses: [], recurrences: [], upcoming: [], categories: [], range: { startDate: '2026-09-01', endDate: '2026-09-30' }, period: 'month', today: '2026-09-15', currency: 'EUR', convert: (amounts) => ({ amounts, hadConversionError: false }), ...extra });

describe('expense overview projections', () => {
    it('reconciles paid spend, categories and monthly bars without previews, unpaid or future auto-paid amounts', () => {
        const result = buildExpenseOverview(input({ expenses: [
            expense({ id: 'paid', categoryId: 'software' }),
            expense({ id: 'old', date: '2026-08-10', amount: 100 }),
            expense({ id: 'unpaid', paymentStatus: 'unpaid', amount: 200 }),
            expense({ id: 'preview', isPreview: true, amount: 300 }),
            expense({ id: 'future', date: '2026-09-20', paymentMode: 'auto', amount: 400 }),
        ], categories: [{ id: 'software', name: 'Software' }] }));
        expect(result.spent.amounts).toEqual({ EUR: 50 });
        expect(result.months.map(month => month.value)).toEqual([0, 0, 0, 0, 100, 50]);
        expect(result.trend.label).toBe('−50%');
        expect(result.topCategory).toMatchObject({ name: 'Software', percentage: 100 });
    });

    it('keeps frozen payment conversions authoritative and refuses mixed-currency chart comparisons', () => {
        const snapshot = { sourceCurrency: 'USD', sourceAmount: 100, preferredCurrencyAtPayment: 'EUR', preferredCurrencyAmount: 80, exchangeRate: 0.8, capturedAt: 1 };
        const result = buildExpenseOverview(input({ expenses: [expense({ currency: 'USD', amount: 100, paymentCurrencySnapshot: snapshot })], convert: () => ({ amounts: { EUR: 25 }, hadConversionError: false }) }));
        expect(result.spent.amounts).toEqual({ EUR: 80 });
        const fallback = buildExpenseOverview(input({ currency: 'GBP', expenses: [expense({ currency: 'USD', amount: 100, paymentCurrencySnapshot: snapshot }), expense({ id: 'eur', amount: 10 })], convert: amounts => ({ amounts, hadConversionError: true }) }));
        expect(fallback.spent.amounts).toEqual({ USD: 100, EUR: 10 });
        expect(fallback.chartCurrency).toBeNull();
        expect(fallback.topCategory).toBeNull();
        expect(fallback.trend.label).toBe('N/A');
    });

    it('normalizes active yearly commitments, excludes paused/ended schedules and discloses variable amounts', () => {
        const result = buildExpenseOverview(input({ recurrences: [recurrence(), recurrence({ id: 'year', repeat: 'yearly', amount: 120 }), recurrence({ id: 'variable', amountType: 'variable', amount: 0 }), recurrence({ id: 'paused', active: false }), recurrence({ id: 'ended', endDate: '2026-08-01' })], upcoming: [expense({ id: 'next', date: '2026-09-20', isPreview: true, paymentStatus: 'unpaid', amount: 30 })] }));
        expect(result.recurring.amounts).toEqual({ EUR: 130 });
        expect(result.recurringCount).toBe(3);
        expect(result.unknownRecurringCount).toBe(1);
        expect(result.upcoming.amounts).toEqual({ EUR: 30 });
        expect(result.nextDate).toBe('2026-09-20');
    });

    it('compares calendar periods and handles new, unchanged and small changes truthfully', () => {
        expect(resolveExpenseComparison('month', { startDate: '2024-03-01', endDate: '2024-03-31' })).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29', label: 'vs last month' });
        expect(resolveExpenseComparison('quarter', { startDate: '2026-01-01', endDate: '2026-03-31' })).toMatchObject({ startDate: '2025-10-01', endDate: '2025-12-31' });
        expect(resolveExpenseComparison('year', { startDate: '2024-01-01', endDate: '2024-12-31' })).toMatchObject({ startDate: '2023-01-01', endDate: '2023-12-31' });
        expect(resolveExpenseComparison('custom', { startDate: '2026-03-28', endDate: '2026-03-30' })).toMatchObject({ startDate: '2026-03-25', endDate: '2026-03-27' });
        expect(buildExpenseOverview(input()).trend.label).toBe('No change');
        expect(buildExpenseOverview(input({ expenses: [expense()] })).trend.label).toBe('New');
        expect(buildExpenseOverview(input({ expenses: [expense({ amount: 100.01 }), expense({ id: 'old', date: '2026-08-10', amount: 100 })] })).trend.label).toBe('+<0.1%');
    });

    it('uses recorded event dates for activity, never an invented payment-sent event', () => {
        const result = buildExpenseOverview(input({ expenses: [expense(), expense({ id: 'new', paymentStatus: 'unpaid', paidOn: null, createdAt: new Date('2026-09-14T12:00:00').getTime() }), expense({ id: 'legacy', paymentStatus: 'unpaid', paidOn: null })], upcoming: [expense({ id: 'next', date: '2026-09-20', isPreview: true })] }));
        expect(result.activity.map(item => [item.expense.id, item.label])).toEqual([['next', 'Upcoming payment'], ['new', 'New expense'], ['e', 'Marked paid']]);
    });

    it('limits recorded activity to 30 local calendar days independently of the spending period', () => {
        const result = buildExpenseOverview(input({ today: '2026-03-30', period: 'year', range: { startDate: '2026-01-01', endDate: '2026-12-31' }, expenses: [
            expense({ id: 'first', date: '2026-02-01', paidOn: '2026-03-01' }),
            expense({ id: 'old', date: '2026-02-01', paidOn: '2026-02-28' }),
            expense({ id: 'today', date: '2026-03-30', paidOn: '2026-03-30' }),
            expense({ id: 'new', paymentStatus: 'unpaid', paidOn: null, createdAt: new Date('2026-03-01T00:00:00').getTime() }),
            expense({ id: 'old-new', paymentStatus: 'unpaid', paidOn: null, createdAt: new Date('2026-02-28T23:59:59').getTime() }),
            expense({ id: 'future-new', paymentStatus: 'unpaid', paidOn: null, createdAt: new Date('2026-03-31T00:00:00').getTime() }),
        ], upcoming: [expense({ id: 'next', date: '2026-04-01', isPreview: true })] }));
        expect(result.activityRange).toEqual({ startDate: '2026-03-01', endDate: '2026-03-30' });
        expect(result.recordedActivity.map(item => item.expense.id)).toEqual(['today', 'new', 'first']);
        expect(result.activity[0].expense.id).toBe('next');
        expect(result.spent.amounts).toEqual({ EUR: 150 });
    });

});
