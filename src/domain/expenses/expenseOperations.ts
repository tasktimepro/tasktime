import type { Expense } from '@/stores/yjs/types';

export class ExpenseOperationError extends Error {
    readonly code: 'CONFLICT';
    readonly details: { expenseId: string; reason: 'billed' | 'tax_claimed' };

    constructor(expense: Pick<Expense, 'id'>, reason: 'billed' | 'tax_claimed', message: string) {
        super(message);
        this.name = 'ExpenseOperationError';
        this.code = 'CONFLICT';
        this.details = { expenseId: expense.id, reason };
    }
}

export function getExpenseDeletionBlockReason(expense: Partial<Expense>): string | null {
    if (
        expense.billingStatus === 'billed'
        || Boolean(expense.invoiceId)
        || typeof expense.billedAt === 'number'
    ) {
        return 'Billed expenses cannot be deleted. Remove the expense from its invoice first.';
    }

    if (
        expense.taxClaimStatus === 'claimed'
        || Boolean(expense.taxClaimPeriodId)
        || typeof expense.taxClaimedAt === 'number'
    ) {
        return 'Tax-claimed expenses cannot be deleted. Remove the expense from its tax return first.';
    }

    return null;
}

/**
 * Protect invoice and tax-return evidence from destructive expense deletion.
 */
export function assertExpenseCanBeDeleted(expense: Expense): void {
    const reason = getExpenseDeletionBlockReason(expense);

    if (!reason) {
        return;
    }

    throw new ExpenseOperationError(
        expense,
        reason.startsWith('Billed') ? 'billed' : 'tax_claimed',
        reason
    );
}
