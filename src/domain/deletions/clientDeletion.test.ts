import { describe, expect, it } from 'vitest';
import { buildClientDeleteImpactPlan } from './clientDeletion';
import type { Client, Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';

const baseAttachment = (id: string, referenceId: string, type: PlannerAttachment['type']): PlannerAttachment => ({
    id,
    referenceId,
    type,
    mode: 'static',
    sortOrder: 1,
    createdAt: 1,
});

const baseExpense = (overrides: Partial<Expense>): Expense => ({
    id: 'expense-1',
    title: 'Expense',
    date: '2026-06-26',
    currency: 'USD',
    amount: 25,
    paymentStatus: 'unpaid',
    isPersonal: false,
    billable: false,
    billingStatus: 'unbilled',
    isRecurring: false,
    isTaxExempt: false,
    ...overrides,
});

const baseRecurrence = (overrides: Partial<ExpenseRecurrence>): ExpenseRecurrence => ({
    id: 'recurrence-1',
    title: 'Recurrence',
    currency: 'USD',
    amount: 25,
    amountType: 'fixed',
    repeat: 'monthly',
    startDate: '2026-06-01',
    isPersonal: false,
    billable: false,
    isTaxExempt: false,
    active: true,
    ...overrides,
});

describe('buildClientDeleteImpactPlan', () => {
    it('plans client deletion that converts linked projects to personal', () => {
        expect(buildClientDeleteImpactPlan({
            clientId: 'client-1',
            alsoDeleteProjects: false,
            clients: [{ id: 'client-1', title: 'Client 1' }],
            projects: [{ id: 'project-1', title: 'Project 1', preferredClientId: 'client-1' }],
            activeTasks: [{ id: 'task-1', title: 'Task', projectId: 'project-1' }],
            archivedTasks: [],
            timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 1, end: 2 }],
            timers: [{ projectId: 'project-1', taskId: 'task-1', timerInstanceId: 'timer-1', startTime: 1 }],
            invoices: [],
            expenses: [baseExpense({ id: 'expense-client', clientId: 'client-1' })],
            expenseRecurrences: [baseRecurrence({ id: 'recurrence-client', clientId: 'client-1' })],
            plannerAttachments: [
                baseAttachment('att-client', 'client-1', 'client'),
                baseAttachment('att-project', 'project-1', 'project'),
            ],
        })).toEqual({
            clientId: 'client-1',
            title: 'Client 1',
            alsoDeleteProjects: false,
            includeInvoiceDeletion: false,
            projectIdsToDelete: [],
            projectIdsToConvertToPersonal: ['project-1'],
            activeTaskIdsToDelete: [],
            archivedTaskIdsToDelete: [],
            timeEntryIdsToDelete: [],
            billedTimeEntryIds: [],
            timerKeysToClear: [],
            invoiceIds: [],
            sharedInvoiceIds: [],
            expenseIdsToDelete: ['expense-client'],
            billedExpenseIds: [],
            taxClaimedExpenseIds: [],
            recurrenceIdsToDelete: ['recurrence-client'],
            plannerAttachmentIdsToDelete: ['att-client'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        });
    });

    it('plans client deletion that deletes linked projects and their records', () => {
        const projects: Project[] = [{ id: 'project-1', title: 'Project 1', preferredClientId: 'client-1' }];
        const activeTasks: Task[] = [{ id: 'task-active', title: 'Active', projectId: 'project-1' }];
        const archivedTasks: Task[] = [{ id: 'task-archived', title: 'Archived', projectId: 'project-1', archived: true }];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-active', taskId: 'task-active', start: 1, end: 2 },
            { id: 'entry-archived', taskId: 'task-archived', start: 3, end: 4 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'task-active', timerInstanceId: 'timer-1', startTime: 1 },
        ];

        expect(buildClientDeleteImpactPlan({
            clientId: 'client-1',
            alsoDeleteProjects: true,
            clients: [{ id: 'client-1', title: 'Client 1' }],
            projects,
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            expenses: [baseExpense({ id: 'expense-project', projectId: 'project-1' })],
            expenseRecurrences: [baseRecurrence({ id: 'recurrence-project', projectId: 'project-1' })],
            plannerAttachments: [
                baseAttachment('att-client', 'client-1', 'client'),
                baseAttachment('att-project', 'project-1', 'project'),
                baseAttachment('att-task', 'task-active', 'task'),
            ],
        })).toEqual(expect.objectContaining({
            projectIdsToDelete: ['project-1'],
            projectIdsToConvertToPersonal: [],
            activeTaskIdsToDelete: ['task-active'],
            archivedTaskIdsToDelete: ['task-archived'],
            timeEntryIdsToDelete: ['entry-active', 'entry-archived'],
            timerKeysToClear: ['project-1'],
            expenseIdsToDelete: ['expense-project'],
            recurrenceIdsToDelete: ['recurrence-project'],
            plannerAttachmentIdsToDelete: ['att-client', 'att-project', 'att-task'],
            canCascadeDeleteSafely: true,
        }));
    });

    it('blocks invoice, shared invoice, billed, and tax claimed cascades', () => {
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

        expect(buildClientDeleteImpactPlan({
            clientId: 'client-1',
            alsoDeleteProjects: true,
            clients: [{ id: 'client-1', title: 'Client 1' }],
            projects: [{ id: 'project-1', title: 'Project 1', preferredClientId: 'client-1' }],
            activeTasks: [{ id: 'task-1', title: 'Task', projectId: 'project-1' }],
            archivedTasks: [],
            timeEntries: [{ id: 'entry-billed', taskId: 'task-1', start: 1, end: 2, billedAt: 3 }],
            timers: [],
            invoices: [invoice],
            expenses: [baseExpense({
                id: 'expense-billed-tax',
                projectId: 'project-1',
                billable: true,
                billingStatus: 'billed',
                taxClaimStatus: 'claimed',
            })],
            expenseRecurrences: [],
            plannerAttachments: [],
        })).toEqual(expect.objectContaining({
            invoiceIds: ['invoice-1'],
            sharedInvoiceIds: ['invoice-1'],
            billedTimeEntryIds: ['entry-billed'],
            billedExpenseIds: ['expense-billed-tax'],
            taxClaimedExpenseIds: ['expense-billed-tax'],
            canCascadeDeleteSafely: false,
            blockingReasons: [
                'client_or_related_projects_have_invoices_not_selected_for_delete',
                'related_projects_have_shared_invoices',
                'client_related_projects_have_billed_time_entries',
                'client_or_related_projects_have_billed_expenses',
                'client_or_related_projects_have_tax_claimed_expenses',
            ],
        }));
    });

    it('returns null when the client does not exist', () => {
        expect(buildClientDeleteImpactPlan({
            clientId: 'missing',
            clients: [],
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
