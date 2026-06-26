import { describe, expect, it } from 'vitest';
import type { Expense } from '@/stores/yjs/types';
import {
    buildExpenseTaxClaimedUpdates,
    buildExpenseTaxUnclaimedUpdates,
    buildMarkExpensePaidUpdates,
    buildMarkExpenseUnpaidUpdates,
} from './expenseUpdates';

describe('expense update builders', () => {
    it('builds paid and unpaid payment updates', () => {
        const paymentCurrencySnapshot: Expense['paymentCurrencySnapshot'] = {
            capturedAt: 10,
            sourceCurrency: 'USD',
            sourceAmount: 100,
            preferredCurrencyAtPayment: 'EUR',
            preferredCurrencyAmount: 90,
        };

        expect(buildMarkExpensePaidUpdates({
            amount: 100,
            paidOn: '2026-06-26',
            paidBy: 'Card',
            paymentCurrencySnapshot,
            updatedAt: 11,
        })).toEqual({
            amount: 100,
            paidOn: '2026-06-26',
            paidBy: 'Card',
            paymentStatus: 'paid',
            paymentCurrencySnapshot,
            updatedAt: 11,
        });

        expect(buildMarkExpenseUnpaidUpdates({ updatedAt: 12 })).toEqual({
            paidOn: null,
            paidBy: null,
            paymentStatus: 'unpaid',
            paymentCurrencySnapshot: undefined,
            updatedAt: 12,
        });
    });

    it('builds tax claim and unclaim updates', () => {
        expect(buildExpenseTaxClaimedUpdates({
            taxClaimPeriodId: 'period-1',
            claimedAt: 20,
        })).toEqual({
            taxClaimStatus: 'claimed',
            taxClaimPeriodId: 'period-1',
            taxClaimedAt: 20,
            updatedAt: 20,
        });

        expect(buildExpenseTaxUnclaimedUpdates({ updatedAt: 21 })).toEqual({
            taxClaimStatus: 'unclaimed',
            taxClaimPeriodId: null,
            taxClaimedAt: null,
            updatedAt: 21,
        });
    });
});
