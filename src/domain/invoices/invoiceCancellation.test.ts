import { describe, expect, it } from 'vitest';
import type { Expense, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import {
    buildInvoiceCancellationApplication,
    getInvoiceCancellationBlockReason,
    normalizeInvoiceCancellationReason,
} from './invoiceCancellation';

const sentInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
    id: 'invoice-1',
    projectId: 'project-1',
    projectIds: ['project-1'],
    clientId: 'client-1',
    invoiceNumber: 'INV-41',
    date: '2026-07-14',
    dueDate: '2026-07-31',
    status: 'sent',
    items: [],
    subtotal: 800,
    tax: 160,
    total: 960,
    billingStateSnapshot: {
        version: 1,
        capturedAt: 900,
        taskLastBilledAt: {
            'task-1': 100,
            'task-quote': null,
        },
    },
    ...overrides,
});

describe('invoice cancellation application', () => {
    it('accepts only finalized unpaid invoices and validates the retained reason', () => {
        expect(getInvoiceCancellationBlockReason(sentInvoice(), new Date('2026-07-14T12:00:00Z'))).toBeNull();
        expect(getInvoiceCancellationBlockReason(sentInvoice({
            dueDate: '2026-07-01',
        }), new Date('2026-07-14T12:00:00Z'))).toBeNull();
        expect(getInvoiceCancellationBlockReason(sentInvoice({ status: 'draft' }))).toBe(
            'Draft invoices should be edited or deleted instead of canceled.'
        );
        expect(getInvoiceCancellationBlockReason(sentInvoice({ status: 'paid', paidAt: 1 }))).toBe(
            'Paid invoices cannot be canceled. Use a credit-note or refund workflow outside TaskTime Pro.'
        );
        expect(getInvoiceCancellationBlockReason(sentInvoice({ status: 'canceled' } as Partial<Invoice>))).toBe(
            'This invoice is already canceled.'
        );
        expect(normalizeInvoiceCancellationReason('  Duplicate invoice  ')).toBe('Duplicate invoice');
        expect(() => normalizeInvoiceCancellationReason('   ')).toThrow('Cancellation reason is required.');
        expect(() => normalizeInvoiceCancellationReason('x'.repeat(501))).toThrow(
            'Cancellation reason must be 500 characters or fewer.'
        );
    });

    it('builds a deterministic release while preserving the invoice and its relationships', () => {
        const invoice = sentInvoice();
        const entries: TimeEntry[] = [
            {
                id: 'entry-1',
                taskId: 'task-1',
                start: 200,
                end: 300,
                billedAt: 900,
                billedInvoiceId: invoice.id,
                billedHourlyRate: 100,
            },
            {
                id: 'entry-adjustment',
                taskId: 'task-1',
                start: 300,
                end: 400,
                source: 'invoice-adjustment',
                billedAt: 900,
                billedInvoiceId: invoice.id,
                billedHourlyRate: 100,
            },
            {
                id: 'entry-other-invoice',
                taskId: 'task-1',
                start: 400,
                end: 500,
                billedAt: 950,
                billedInvoiceId: 'invoice-2',
                billedHourlyRate: 100,
            },
        ];
        const expenses: Expense[] = [
            {
                id: 'expense-1',
                title: 'Canceled invoice expense',
                date: '2026-07-14',
                amount: 50,
                currency: 'EUR',
                paymentStatus: 'paid',
                billingStatus: 'billed',
                isPersonal: false,
                billable: true,
                isRecurring: false,
                taxExempt: false,
                taxClaimed: true,
                invoiceId: invoice.id,
                billedAt: 900,
            },
            {
                id: 'expense-2',
                title: 'Other invoice expense',
                date: '2026-07-14',
                amount: 20,
                currency: 'EUR',
                paymentStatus: 'unpaid',
                billingStatus: 'billed',
                isPersonal: false,
                billable: true,
                isRecurring: false,
                taxExempt: false,
                invoiceId: 'invoice-2',
            },
        ] as Expense[];
        const tasks: Task[] = [
            {
                id: 'task-1',
                title: 'Hourly task',
                lastBilledAt: 300,
            },
            {
                id: 'task-quote',
                title: 'Quoted task',
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: invoice.id,
                    billedAt: 900,
                    total: 500,
                },
            },
            {
                id: 'task-other-quote',
                title: 'Other quoted task',
                quotedAmountBilling: {
                    invoiceId: 'invoice-2',
                    billedAt: 950,
                    total: 200,
                },
            },
        ] as Task[];
        const projects: Project[] = [
            { id: 'project-1', title: 'Project', invoiceIds: [invoice.id, 'invoice-2'] },
        ];

        const result = buildInvoiceCancellationApplication({
            invoice,
            entries,
            expenses,
            tasks,
            projects,
            reason: '  Duplicate invoice  ',
            canceledAt: 1_000,
        });

        expect(result.desiredInvoice).toEqual({
            ...invoice,
            status: 'canceled',
            canceledAt: 1_000,
            cancellationReason: 'Duplicate invoice',
            paidAt: null,
            paymentCurrencySnapshot: null,
            updatedAt: 1_000,
        });
        expect(result.application.entriesToDelete.map((entry) => entry.id)).toEqual(['entry-adjustment']);
        expect(result.application.entriesToClear.map(({ entry }) => entry.id)).toEqual(['entry-1']);
        expect(result.application.expenseUpdatesToUnbill).toEqual([{
            id: 'expense-1',
            updates: expect.objectContaining({
                billingStatus: 'unbilled',
                invoiceId: null,
                billedAt: null,
            }),
        }]);
        expect(result.application.quotedTaskUpdates.map(({ id }) => id)).toEqual(['task-quote']);
        expect(result.application.taskCutoffUpdates).toEqual([{
            id: 'task-1',
            expectedLastBilledAt: 300,
            updates: {
                lastBilledAt: 500,
                updatedAt: 1_000,
            },
        }, {
            id: 'task-quote',
            expectedLastBilledAt: null,
            updates: {
                lastBilledAt: null,
                updatedAt: 1_000,
            },
        }]);
        expect(result.result).toEqual({
            invoice: result.desiredInvoice,
            releasedTimeEntryCount: 1,
            deletedAdjustmentCount: 1,
            releasedExpenseCount: 1,
            releasedQuotedTaskCount: 1,
            restoredTaskCutoffCount: 2,
            retainedProjectLinkCount: 1,
            retainedInvoiceNumber: true,
            alreadyApplied: false,
        });
        expect(projects[0].invoiceIds).toEqual([invoice.id, 'invoice-2']);
        expect(invoice.status).toBe('sent');
        expect(invoice.total).toBe(960);
    });

    it('rejects invalid cancellation time before building mutations', () => {
        expect(() => buildInvoiceCancellationApplication({
            invoice: sentInvoice(),
            entries: [],
            expenses: [],
            tasks: [],
            projects: [],
            reason: 'Duplicate invoice',
            canceledAt: Number.NaN,
        })).toThrow('Cancellation time must be a finite positive timestamp.');
    });
});
