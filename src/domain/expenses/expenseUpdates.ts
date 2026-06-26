import type { Expense } from '@/stores/yjs/types';

export function buildMarkExpensePaidUpdates({
    amount,
    paidOn,
    paidBy,
    paymentCurrencySnapshot,
    updatedAt,
}: {
    amount: number;
    paidOn: string | null;
    paidBy: string | null;
    paymentCurrencySnapshot?: Expense['paymentCurrencySnapshot'];
    updatedAt?: number;
}): Partial<Expense> {
    return {
        amount,
        paidOn,
        paidBy,
        paymentStatus: 'paid',
        paymentCurrencySnapshot,
        ...(typeof updatedAt === 'number' && Number.isFinite(updatedAt)
            ? { updatedAt }
            : {}),
    };
}

export function buildMarkExpenseUnpaidUpdates({
    updatedAt,
}: {
    updatedAt?: number;
} = {}): Partial<Expense> {
    return {
        paidOn: null,
        paidBy: null,
        paymentStatus: 'unpaid',
        paymentCurrencySnapshot: undefined,
        ...(typeof updatedAt === 'number' && Number.isFinite(updatedAt)
            ? { updatedAt }
            : {}),
    };
}

export function buildExpenseTaxClaimedUpdates({
    taxClaimPeriodId,
    claimedAt,
    updatedAt = claimedAt,
}: {
    taxClaimPeriodId: string;
    claimedAt: number;
    updatedAt?: number;
}): Partial<Expense> {
    return {
        taxClaimStatus: 'claimed',
        taxClaimPeriodId,
        taxClaimedAt: claimedAt,
        updatedAt,
    };
}

export function buildExpenseTaxUnclaimedUpdates({
    updatedAt,
}: {
    updatedAt?: number;
} = {}): Partial<Expense> {
    return {
        taxClaimStatus: 'unclaimed',
        taxClaimPeriodId: null,
        taxClaimedAt: null,
        ...(typeof updatedAt === 'number' && Number.isFinite(updatedAt)
            ? { updatedAt }
            : {}),
    };
}
