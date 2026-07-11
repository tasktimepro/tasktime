import { describe, expect, it } from 'vitest';
import { buildInvoiceBillingSelectionSnapshot } from './invoiceBillingSelection';

describe('invoice billing selection snapshot', () => {
    it('captures exact entry, task, rate, quote, expense, and conversion evidence', () => {
        const snapshot = buildInvoiceBillingSelectionSnapshot({
            capturedAt: 1234,
            preview: {
                currency: 'EUR',
                total: 292,
                taskAmount: 200,
                expenseAmount: 92,
                unbilledHours: 2,
                unpricedHours: 0,
                selectedExpenseCount: 1,
                excludedExpenseCount: 0,
                entrySelections: [{
                    entryId: 'entry-1',
                    taskId: 'task-1',
                    start: 100,
                    end: 200,
                    actualDurationMs: 100,
                    billableDurationMs: 120,
                }],
                taskSelections: [{
                    taskId: 'task-1',
                    title: 'Work',
                    pricingMode: 'hourly',
                    quantity: 2,
                    rate: 100,
                    amount: 200,
                    quotedAmount: null,
                }],
                expenseSelections: [{
                    expenseId: 'expense-1',
                    title: 'Swiss fee',
                    sourceAmount: 88,
                    sourceCurrency: 'CHF',
                    invoiceAmount: 92,
                    invoiceCurrency: 'EUR',
                    exchangeRate: 92 / 88,
                }],
            },
        });

        expect(snapshot).toEqual(expect.objectContaining({
            version: 1,
            capturedAt: 1234,
            invoiceCurrency: 'EUR',
            entries: [expect.objectContaining({
                entryId: 'entry-1',
                billedHourlyRate: 100,
            })],
            tasks: [expect.objectContaining({ taskId: 'task-1', amount: 200 })],
            expenses: [expect.objectContaining({ expenseId: 'expense-1', sourceCurrency: 'CHF' })],
        }));
    });
});
