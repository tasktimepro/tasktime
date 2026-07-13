import { describe, expect, it } from 'vitest';
import type { Expense } from '@/stores/yjs/types';
import { assertExpenseCanBeDeleted, getExpenseDeletionBlockReason } from './expenseOperations';

const expense = (updates: Partial<Expense> = {}) => ({
    id: 'expense-1',
    billingStatus: 'unbilled',
    taxClaimStatus: 'unclaimed',
    ...updates,
} as Expense);

describe('expense operations', () => {
    it('allows deletion only while an expense is neither billed nor tax-claimed', () => {
        expect(getExpenseDeletionBlockReason(expense())).toBeNull();
        expect(() => assertExpenseCanBeDeleted(expense())).not.toThrow();

        expect(() => assertExpenseCanBeDeleted(expense({ invoiceId: 'invoice-1' })))
            .toThrow('Billed expenses cannot be deleted');
        expect(() => assertExpenseCanBeDeleted(expense({ taxClaimPeriodId: 'tax-period-1' })))
            .toThrow('Tax-claimed expenses cannot be deleted');
        expect(() => assertExpenseCanBeDeleted(expense({ taxClaimedAt: 1 })))
            .toThrow('Tax-claimed expenses cannot be deleted');
    });
});
