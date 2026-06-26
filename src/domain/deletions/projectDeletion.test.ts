import { describe, expect, it } from 'vitest';
import { buildProjectDeleteImpactPlan } from './projectDeletion';
import type { Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';

const baseAttachment = (id: string, referenceId: string, type: PlannerAttachment['type']): PlannerAttachment => ({
    id,
    referenceId,
    type,
    mode: 'static',
    sortOrder: 1,
    createdAt: 1,
});

describe('buildProjectDeleteImpactPlan', () => {
    it('plans project cascades without mutating inputs', () => {
        const projects: Project[] = [{ id: 'project-1', title: 'Project 1' }];
        const activeTasks: Task[] = [{ id: 'task-active', title: 'Active', projectId: 'project-1' }];
        const archivedTasks: Task[] = [{ id: 'task-archived', title: 'Archived', projectId: 'project-1', archived: true }];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-active', taskId: 'task-active', start: 1, end: 2 },
            { id: 'entry-archived', taskId: 'task-archived', start: 3, end: 4 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'task-active', timerInstanceId: 'timer-1', startTime: 1 },
        ];
        const expenses: Expense[] = [{
            id: 'expense-1',
            title: 'Expense',
            date: '2026-06-26',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            projectId: 'project-1',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }];
        const expenseRecurrences: ExpenseRecurrence[] = [{
            id: 'recurrence-1',
            title: 'Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            projectId: 'project-1',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }];

        expect(buildProjectDeleteImpactPlan({
            projectId: 'project-1',
            projects,
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            expenses,
            expenseRecurrences,
            plannerAttachments: [
                baseAttachment('att-project', 'project-1', 'project'),
                baseAttachment('att-task', 'task-active', 'task'),
            ],
        })).toEqual({
            projectId: 'project-1',
            title: 'Project 1',
            includeInvoiceDeletion: false,
            activeTaskIds: ['task-active'],
            archivedTaskIds: ['task-archived'],
            taskIdsToDelete: ['task-active', 'task-archived'],
            timeEntryIdsToDelete: ['entry-active', 'entry-archived'],
            billedTimeEntryIds: [],
            timerKeysToClear: ['project-1'],
            invoiceIds: [],
            storedInvoiceIds: [],
            sharedInvoiceIds: [],
            expenseIdsToDelete: ['expense-1'],
            billedExpenseIds: [],
            taxClaimedExpenseIds: [],
            recurrenceIdsToDelete: ['recurrence-1'],
            plannerAttachmentIdsToDelete: ['att-project', 'att-task'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        });
    });

    it('blocks invoice, billed, stored invoice, shared invoice, and tax claimed cascades', () => {
        const invoice: Invoice = {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-06-26',
            status: 'draft',
            items: [],
            projectBreakdowns: [
                { projectId: 'project-1', projectTitle: 'Project 1', clientId: 'client-1', pricingMode: 'hourly', tasks: [], totalHours: 1, subtotal: 100 },
                { projectId: 'other-project', projectTitle: 'Other', clientId: 'client-1', pricingMode: 'hourly', tasks: [], totalHours: 1, subtotal: 100 },
            ],
            subtotal: 200,
            total: 200,
        };

        expect(buildProjectDeleteImpactPlan({
            projectId: 'project-1',
            projects: [{ id: 'project-1', title: 'Project 1', invoiceIds: ['stored-invoice'] }],
            activeTasks: [{ id: 'task-1', title: 'Task', projectId: 'project-1' }],
            archivedTasks: [],
            timeEntries: [{ id: 'entry-billed', taskId: 'task-1', start: 1, end: 2, billedAt: 3 }],
            timers: [],
            invoices: [invoice],
            expenses: [{
                id: 'expense-billed-tax',
                title: 'Expense',
                date: '2026-06-26',
                currency: 'USD',
                amount: 25,
                paymentStatus: 'unpaid',
                projectId: 'project-1',
                isPersonal: false,
                billable: true,
                billingStatus: 'billed',
                isRecurring: false,
                isTaxExempt: false,
                taxClaimStatus: 'claimed',
            }],
            expenseRecurrences: [],
            plannerAttachments: [],
        })).toEqual(expect.objectContaining({
            invoiceIds: ['invoice-1'],
            storedInvoiceIds: ['stored-invoice'],
            sharedInvoiceIds: ['invoice-1'],
            billedTimeEntryIds: ['entry-billed'],
            billedExpenseIds: ['expense-billed-tax'],
            taxClaimedExpenseIds: ['expense-billed-tax'],
            canCascadeDeleteSafely: false,
            blockingReasons: [
                'project_has_invoices_not_selected_for_delete',
                'project_has_shared_invoices',
                'project_has_stored_invoice_ids',
                'project_has_billed_time_entries',
                'project_has_billed_expenses',
                'project_has_tax_claimed_expenses',
            ],
        }));
    });

    it('returns null when the project does not exist', () => {
        expect(buildProjectDeleteImpactPlan({
            projectId: 'missing',
            projects: [],
            activeTasks: [],
            archivedTasks: [],
            timeEntries: [],
            timers: [],
            invoices: [],
            expenses: [],
            expenseRecurrences: [],
            plannerAttachments: [],
        })).toBeNull();
    });
});
