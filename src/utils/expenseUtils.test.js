import { describe, it, expect } from 'vitest';
import { advanceByRepeat, buildExpenseFromRecurrence, getPendingPeriods, isExpenseInDateRange } from './expenseUtils';

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
        expect(expense.amount).toBe(0);
        expect(expense.amountType).toBe('variable');
    });

    it('isExpenseInDateRange includes boundaries', () => {
        const expense = buildExpenseFromRecurrence(recurrenceBase, '2025-02-01');
        expect(isExpenseInDateRange(expense, '2025-02-01', '2025-02-28')).toBe(true);
        expect(isExpenseInDateRange(expense, '2025-02-02', '2025-02-28')).toBe(false);
    });
});
