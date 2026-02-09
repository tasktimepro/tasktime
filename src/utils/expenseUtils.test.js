import { describe, it, expect } from 'vitest';
import {
    advanceByRepeat,
    buildExpenseFromRecurrence,
    getPendingPeriods,
    getNextRecurringDate,
    isExpenseInDateRange,
    isRecurringExpenseDueOnDate,
} from './expenseUtils';

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
        expect(expense.title).toBe('Office Rent');
        expect(expense.amount).toBe(1200);
        expect(expense.amountType).toBe('fixed');
        expect(expense.paymentStatus).toBe('unpaid');
        expect(expense.billingStatus).toBe('unbilled');
        expect(expense.isRecurring).toBe(true);
        expect(expense.recurrenceId).toBe('r1');
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
