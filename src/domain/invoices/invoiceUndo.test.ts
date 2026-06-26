import { describe, expect, it } from 'vitest';
import { planInvoiceUndo } from './invoiceUndo';
import type { Expense, Invoice, Task, TimeEntry } from '@/stores/yjs/types';

describe('planInvoiceUndo', () => {
    it('plans billed entry clearing, adjustment deletion, expense unbilling, and task cutoff restoration', () => {
        const invoice: Invoice = {
            id: 'invoice-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-06-26',
            status: 'sent',
            items: [],
            subtotal: 0,
            total: 0,
            billingStateSnapshot: {
                version: 1,
                capturedAt: 100,
                taskLastBilledAt: {
                    'task-1': 50,
                    'quoted-task': null,
                },
            },
            tasks: [{ id: 'task-from-invoice' }],
        } as Invoice;
        const entries: TimeEntry[] = [
            { id: 'entry-clear', taskId: 'task-1', start: 60, end: 90, billedInvoiceId: 'invoice-1', billedAt: 100 },
            { id: 'entry-adjustment', taskId: 'task-1', start: 90, end: 100, billedInvoiceId: 'invoice-1', billedAt: 100, source: 'invoice-adjustment' },
            { id: 'entry-other-billed', taskId: 'task-1', start: 10, end: 45, billedInvoiceId: 'older-invoice', billedAt: 40 },
            { id: 'entry-inferred', taskId: 'task-inferred', start: 120, end: 150, billedInvoiceId: 'invoice-1', billedAt: 160 },
        ];
        const tasks: Task[] = [
            { id: 'task-1', title: 'Task', projectId: 'project-1' },
            {
                id: 'quoted-task',
                title: 'Quoted',
                projectId: 'project-1',
                quotedAmountBilling: { invoiceId: 'invoice-1', billedAt: 100, total: 500 },
            },
            { id: 'task-inferred', title: 'Inferred', projectId: 'project-1' },
            { id: 'task-from-invoice', title: 'From invoice', projectId: 'project-1' },
        ];
        const expenses: Expense[] = [
            {
                id: 'expense-1',
                title: 'Expense',
                date: '2026-06-26',
                currency: 'USD',
                amount: 10,
                paymentStatus: 'unpaid',
                isPersonal: false,
                billable: true,
                billingStatus: 'billed',
                invoiceId: 'invoice-1',
                isRecurring: false,
                isTaxExempt: false,
            },
        ];

        const plan = planInvoiceUndo({
            invoice,
            invoiceId: 'invoice-1',
            entries,
            tasks,
            expenses,
        });

        expect(plan.entriesToClear.map((entry) => entry.id)).toEqual(['entry-clear', 'entry-inferred']);
        expect(plan.entriesToDelete.map((entry) => entry.id)).toEqual(['entry-adjustment']);
        expect(plan.expenseIdsToUnbill).toEqual(['expense-1']);
        expect(plan.clearedTimeEntryCount).toBe(2);
        expect(plan.deletedAdjustmentCount).toBe(1);
        expect(plan.taskLastBilledAtRestorations.get('task-1')).toBe(50);
        expect(plan.taskLastBilledAtRestorations.get('quoted-task')).toBeNull();
        expect(plan.taskLastBilledAtRestorations.get('task-inferred')).toBe(119);
        expect(plan.taskLastBilledAtRestorations.has('task-from-invoice')).toBe(false);
    });
});
