import { describe, expect, it } from 'vitest';
import {
    buildInvoiceBillingSelectionSnapshot,
    buildInvoiceBillingSelectionSnapshotFromPlan,
} from './invoiceBillingSelection';

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

    it('normalizes cached numeric task strings into immutable billing evidence', () => {
        const snapshot = buildInvoiceBillingSelectionSnapshotFromPlan({
            invoice: {
                id: 'invoice-cached-inputs',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-CACHED-INPUTS',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 1642.5,
                total: 1642.5,
                currency: 'EUR',
                items: [],
                tasks: [
                    {
                        id: 'task-hourly',
                        title: 'Hourly work',
                        hours: '25.3',
                        hourlyRate: '55',
                        useFlatRate: false,
                    },
                    {
                        id: 'task-flat',
                        title: 'Flat work',
                        quantity: '2',
                        flatRate: '125.5',
                        useFlatRate: true,
                    },
                ],
            } as any,
            plan: {
                selectedTaskIds: new Set(['task-hourly', 'task-flat']),
                entriesToBill: [],
                quotedTaskClaims: [],
                expensesToBill: [],
            } as any,
            capturedAt: 1234,
        });

        expect(snapshot.tasks).toEqual([
            expect.objectContaining({
                taskId: 'task-hourly',
                quantity: 25.3,
                rate: 55,
                amount: 1391.5,
            }),
            expect.objectContaining({
                taskId: 'task-flat',
                quantity: 2,
                rate: 125.5,
                amount: 251,
            }),
        ]);
    });

    it('keeps an explicit hourly override inside a flat-rate project', () => {
        const snapshot = buildInvoiceBillingSelectionSnapshotFromPlan({
            invoice: {
                id: 'invoice-hourly-override',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-HOURLY-OVERRIDE',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 200,
                total: 200,
                currency: 'EUR',
                items: [{
                    taskId: 'task-hourly',
                    description: 'Hourly work',
                    pricingMode: 'hourly',
                    quantity: 2,
                    rate: 100,
                    amount: 200,
                }],
                tasks: [{
                    id: 'task-hourly',
                    title: 'Hourly work',
                    hours: 2,
                    hourlyRate: 100,
                    flatRate: 500,
                    projectFlatRate: true,
                    useFlatRate: false,
                }],
            } as any,
            plan: {
                selectedTaskIds: new Set(['task-hourly']),
                entriesToBill: [],
                quotedTaskClaims: [],
                expensesToBill: [],
            } as any,
            capturedAt: 1234,
        });

        expect(snapshot.tasks).toEqual([expect.objectContaining({
            taskId: 'task-hourly',
            pricingMode: 'hourly',
            quantity: 2,
            rate: 100,
            amount: 200,
        })]);
    });

    it('inherits a merged parent hourly rate in the child billing snapshot', () => {
        const snapshot = buildInvoiceBillingSelectionSnapshotFromPlan({
            invoice: {
                id: 'invoice-merged-rate',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-MERGED-RATE',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 225,
                total: 225,
                currency: 'EUR',
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    hours: 1,
                    hourlyRate: 100,
                    useFlatRate: false,
                    mergedSubtasks: [{
                        id: 'child-task',
                        title: 'Responsive polish',
                        hours: 1.25,
                    }],
                }],
            } as any,
            plan: {
                selectedTaskIds: new Set(['parent-task', 'child-task']),
                entriesToBill: [],
                quotedTaskClaims: [],
                expensesToBill: [],
            } as any,
            capturedAt: 1234,
        });

        expect(snapshot.tasks).toEqual([
            expect.objectContaining({
                taskId: 'parent-task',
                pricingMode: 'hourly',
                quantity: 1,
                rate: 100,
                amount: 100,
            }),
            expect.objectContaining({
                taskId: 'child-task',
                pricingMode: 'hourly',
                quantity: 1.25,
                rate: 100,
                amount: 125,
            }),
        ]);
    });
});
