import { describe, it, expect } from 'vitest';
import {
    advanceByRepeat,
    buildExpenseFromRecurrence,
    createExpensePaymentCurrencySnapshot,
    getPaidExpenseConvertedAmount,
    getPendingPeriods,
    getNextRecurringDate,
    isExpenseInDateRange,
    isRecurringExpenseDueOnDate,
} from './expenseUtils';
import { generateRecurringExpenseId } from './idUtils';

const recurrenceBase = {
    id: 'r1',
    title: 'Office Rent',
    note: 'Monthly rent',
    supplierName: 'Landlord',
    currency: 'EUR',
    amount: 1200,
    amountType: 'fixed',
    repeat: 'monthly',
    startDate: '2025-01-01',
    endDate: null,
    clientId: null,
    projectId: null,
    isPersonal: true,
    billable: false,
    taxNumber: null,
    isTaxExempt: false,
    lastGeneratedDate: null,
    active: true,
};

describe('expenseUtils', () => {
    it('advanceByRepeat monthly: normal', () => {
        expect(advanceByRepeat('2025-01-15', 'monthly')).toBe('2025-02-15');
    });

    it('advanceByRepeat monthly: end-of-month clamping', () => {
        expect(advanceByRepeat('2025-01-31', 'monthly')).toBe('2025-02-28');
    });

    it('advanceByRepeat monthly: first and last', () => {
        expect(advanceByRepeat('2025-01-15', 'monthly', 'first')).toBe('2025-02-01');
        expect(advanceByRepeat('2025-01-15', 'monthly', 'last')).toBe('2025-02-28');
    });

    it('advanceByRepeat yearly: leap day', () => {
        expect(advanceByRepeat('2024-02-29', 'yearly')).toBe('2025-02-28');
    });

    it('getPendingPeriods returns correct dates', () => {
        const pending = getPendingPeriods({
            startDate: '2025-01-01',
            lastGeneratedDate: '2025-01-01',
            repeat: 'monthly',
            today: '2025-03-15',
        });
        expect(pending).toEqual(['2025-02-01', '2025-03-01']);
    });

    it('getPendingPeriods respects endDate', () => {
        const pending = getPendingPeriods({
            startDate: '2025-01-01',
            lastGeneratedDate: '2025-01-01',
            repeat: 'monthly',
            endDate: '2025-02-01',
            today: '2025-04-15',
        });
        expect(pending).toEqual(['2025-02-01']);
    });

    it('buildExpenseFromRecurrence copies fields and defaults', () => {
        const expense = buildExpenseFromRecurrence(recurrenceBase, '2025-02-01');
        expect(expense.id).toBe(generateRecurringExpenseId('r1', '2025-02-01'));
        expect(expense.title).toBe('Office Rent');
        expect(expense.amount).toBe(1200);
        expect(expense.amountType).toBe('fixed');
        expect(expense.paymentStatus).toBe('unpaid');
        expect(expense.billingStatus).toBe('unbilled');
        expect(expense.isRecurring).toBe(true);
        expect(expense.recurrenceId).toBe('r1');
    });

    it('buildExpenseFromRecurrence copies tax detail fields', () => {
        const expense = buildExpenseFromRecurrence({
            ...recurrenceBase,
            amountExcludingTax: 1000,
            taxLabel: 'VAT',
            taxRate: 20,
        }, '2025-02-01');

        expect(expense.amountExcludingTax).toBe(1000);
        expect(expense.taxLabel).toBe('VAT');
        expect(expense.taxRate).toBe(20);
    });

    it('buildExpenseFromRecurrence produces deterministic IDs', () => {
        const expense1 = buildExpenseFromRecurrence(recurrenceBase, '2025-02-01');
        const expense2 = buildExpenseFromRecurrence(recurrenceBase, '2025-02-01');
        expect(expense1.id).toBe(expense2.id);

        const expense3 = buildExpenseFromRecurrence(recurrenceBase, '2025-03-01');
        expect(expense1.id).not.toBe(expense3.id);

        const otherRecurrence = { ...recurrenceBase, id: 'r2' };
        const expense4 = buildExpenseFromRecurrence(otherRecurrence, '2025-02-01');
        expect(expense1.id).not.toBe(expense4.id);
    });

    it('buildExpenseFromRecurrence sets variable amount to 0', () => {
        const expense = buildExpenseFromRecurrence({
            ...recurrenceBase,
            amountType: 'variable',
            amount: 200,
        }, '2025-02-01');
            expect(expense.amount).toBe(200);
        expect(expense.amountType).toBe('variable');
    });

    it('buildExpenseFromRecurrence auto-marks paid when auto-payment', () => {
        const expense = buildExpenseFromRecurrence({
            ...recurrenceBase,
            paymentMode: 'auto',
        }, '2025-02-01');

        expect(expense.paymentMode).toBe('auto');
        expect(expense.paymentStatus).toBe('paid');
        expect(expense.paidOn).toBe('2025-02-01');
    });

    it('creates and resolves paid expense currency snapshots', () => {
        const snapshot = createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'USD',
                amount: 125,
                paidOn: '2025-02-01',
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.8 },
        });

        expect(snapshot).toEqual({
            capturedAt: new Date(2025, 1, 1).getTime(),
            sourceCurrency: 'USD',
            sourceAmount: 125,
            preferredCurrencyAtPayment: 'EUR',
            preferredCurrencyAmount: 100,
        });

        expect(getPaidExpenseConvertedAmount({
            amount: 125,
            currency: 'USD',
            paymentCurrencySnapshot: snapshot,
        }, 'EUR')).toEqual({
            amount: 100,
            currency: 'EUR',
            success: true,
            usedSnapshot: true,
        });

        expect(getPaidExpenseConvertedAmount({
            amount: 125,
            currency: 'USD',
            paymentCurrencySnapshot: snapshot,
        }, 'USD')).toEqual({
            amount: 125,
            currency: 'USD',
            success: true,
            usedSnapshot: true,
        });

        expect(getPaidExpenseConvertedAmount({
            amount: 125,
            currency: 'USD',
            paymentCurrencySnapshot: snapshot,
        }, 'GBP')).toEqual({
            amount: 125,
            currency: 'USD',
            success: false,
            usedSnapshot: true,
        });
    });

    it('does not create a paid expense snapshot when source and preferred currencies match', () => {
        expect(createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'EUR',
                amount: 125,
                paidOn: '2025-02-01',
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.8 },
        })).toBeNull();
    });

    it('rejects a cross-currency snapshot when the requested conversion is unavailable', () => {
        expect(() => createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'USD',
                amount: 125,
                paidOn: '2025-02-01',
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1 },
        })).toThrow('Missing exchange rate for EUR');
    });

    it('falls back to the raw expense amount when no snapshot exists', () => {
        expect(getPaidExpenseConvertedAmount({
            amount: 50,
            currency: 'USD',
        }, 'USD')).toEqual({
            amount: 50,
            currency: 'USD',
            success: true,
            usedSnapshot: false,
        });

        expect(getPaidExpenseConvertedAmount({
            amount: 50,
            currency: 'USD',
        }, 'EUR')).toEqual({
            amount: 50,
            currency: 'USD',
            success: false,
            usedSnapshot: false,
        });
    });

    it('falls back through date and timestamp sources when capturing snapshot time', () => {
        const fromExpenseDate = createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'USD',
                amount: 20,
                date: '2025-03-15',
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.9 },
        });

        const fromUpdatedAt = createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'USD',
                amount: 20,
                updatedAt: 1234,
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.9 },
        });

        const fromCreatedAt = createExpensePaymentCurrencySnapshot({
            expense: {
                currency: 'USD',
                amount: 20,
                createdAt: 5678,
            },
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.9 },
        });

        expect(fromExpenseDate?.capturedAt).toBe(new Date(2025, 2, 15).getTime());
        expect(fromUpdatedAt?.capturedAt).toBe(1234);
        expect(fromCreatedAt?.capturedAt).toBe(5678);
    });

    it('ignores invalid payment currency snapshots', () => {
        expect(getPaidExpenseConvertedAmount({
            amount: 75,
            currency: 'USD',
            paymentCurrencySnapshot: {
                capturedAt: 0,
                sourceCurrency: 'USD',
                sourceAmount: 75,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 60,
            },
        }, 'EUR')).toEqual({
            amount: 75,
            currency: 'USD',
            success: false,
            usedSnapshot: false,
        });
    });

    it('isExpenseInDateRange includes boundaries', () => {
        const expense = buildExpenseFromRecurrence(recurrenceBase, '2025-02-01');
        expect(isExpenseInDateRange(expense, '2025-02-01', '2025-02-28')).toBe(true);
        expect(isExpenseInDateRange(expense, '2025-02-02', '2025-02-28')).toBe(false);
    });

    it('getNextRecurringDate returns next matching date', () => {
        const nextDate = getNextRecurringDate({
            startDate: '2025-01-01',
            repeat: 'monthly',
            fromDate: '2025-03-10',
        });

        expect(nextDate).toBe('2025-04-01');
    });

    it('getNextRecurringDate respects endDate', () => {
        const nextDate = getNextRecurringDate({
            startDate: '2025-01-01',
            repeat: 'monthly',
            fromDate: '2025-03-10',
            endDate: '2025-02-01',
        });

        expect(nextDate).toBeNull();
    });

    it('isRecurringExpenseDueOnDate matches monthly schedule', () => {
        const recurrence = { ...recurrenceBase, startDate: '2025-01-15', repeat: 'monthly' };
        expect(isRecurringExpenseDueOnDate(recurrence, '2025-02-15')).toBe(true);
        expect(isRecurringExpenseDueOnDate(recurrence, '2025-02-16')).toBe(false);
    });

    it('isRecurringExpenseDueOnDate respects start and end dates', () => {
        const recurrence = { ...recurrenceBase, startDate: '2025-01-15', endDate: '2025-02-15', repeat: 'monthly' };
        expect(isRecurringExpenseDueOnDate(recurrence, '2025-01-01')).toBe(false);
        expect(isRecurringExpenseDueOnDate(recurrence, '2025-03-15')).toBe(false);
    });

    it('isRecurringExpenseDueOnDate returns false when startDate missing', () => {
        expect(isRecurringExpenseDueOnDate({ ...recurrenceBase, startDate: '' }, '2025-02-15')).toBe(false);
    });
});
