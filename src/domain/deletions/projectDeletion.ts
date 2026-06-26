import { invoiceBelongsToProject, isMultiProjectInvoice } from '@/utils/invoiceUtils';
import type { Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';

export interface ProjectDeleteImpactPlan {
    projectId: string;
    title: string;
    includeInvoiceDeletion: boolean;
    activeTaskIds: string[];
    archivedTaskIds: string[];
    taskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceIds: string[];
    storedInvoiceIds: string[];
    sharedInvoiceIds: string[];
    expenseIdsToDelete: string[];
    billedExpenseIds: string[];
    taxClaimedExpenseIds: string[];
    recurrenceIdsToDelete: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface BuildProjectDeleteImpactPlanInput {
    projectId: string;
    includeInvoiceDeletion?: boolean;
    projects: Project[];
    activeTasks: Task[];
    archivedTasks: Task[];
    timeEntries: TimeEntry[];
    timers: MultiTimerState[];
    invoices: Invoice[];
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
    plannerAttachments: PlannerAttachment[];
}

const uniqueSorted = (values: string[]): string[] => {
    return [...new Set(values)].sort();
};

export function buildProjectDeleteImpactPlan(input: BuildProjectDeleteImpactPlanInput): ProjectDeleteImpactPlan | null {
    const project = input.projects.find((candidate) => candidate.id === input.projectId);

    if (!project) {
        return null;
    }

    const includeInvoiceDeletion = input.includeInvoiceDeletion === true;
    const activeTaskIds = input.activeTasks
        .filter((task) => task.projectId === input.projectId)
        .map((task) => task.id)
        .sort();
    const archivedTaskIds = input.archivedTasks
        .filter((task) => task.projectId === input.projectId)
        .map((task) => task.id)
        .sort();
    const taskIdsToDelete = uniqueSorted([...activeTaskIds, ...archivedTaskIds]);
    const taskIdSet = new Set(taskIdsToDelete);
    const timeEntryIdsToDelete = input.timeEntries
        .filter((entry) => taskIdSet.has(entry.taskId))
        .map((entry) => entry.id)
        .sort();
    const billedTimeEntryIds = input.timeEntries
        .filter((entry) => (
            taskIdSet.has(entry.taskId)
            && Boolean(entry.billedAt || entry.billedInvoiceId)
        ))
        .map((entry) => entry.id)
        .sort();
    const timerKeysToClear = input.timers
        .filter((timer) => timer.projectId === input.projectId || taskIdSet.has(timer.taskId))
        .map((timer) => timer.projectId)
        .sort();
    const invoiceIds = input.invoices
        .filter((invoice) => invoiceBelongsToProject(invoice, input.projectId))
        .map((invoice) => invoice.id)
        .sort();
    const sharedInvoiceIds = input.invoices
        .filter((invoice) => invoiceBelongsToProject(invoice, input.projectId) && isMultiProjectInvoice(invoice))
        .map((invoice) => invoice.id)
        .sort();
    const storedInvoiceIds = Array.isArray(project.invoiceIds)
        ? project.invoiceIds.filter((invoiceId): invoiceId is string => typeof invoiceId === 'string' && invoiceId.trim().length > 0).sort()
        : [];
    const expenseIdsToDelete = input.expenses
        .filter((expense) => expense.projectId === input.projectId)
        .map((expense) => expense.id)
        .sort();
    const billedExpenseIds = input.expenses
        .filter((expense) => (
            expense.projectId === input.projectId
            && (expense.billingStatus === 'billed' || Boolean(expense.invoiceId || expense.billedAt))
        ))
        .map((expense) => expense.id)
        .sort();
    const taxClaimedExpenseIds = input.expenses
        .filter((expense) => (
            expense.projectId === input.projectId
            && (expense.taxClaimStatus === 'claimed' || Boolean(expense.taxClaimPeriodId || expense.taxClaimedAt))
        ))
        .map((expense) => expense.id)
        .sort();
    const recurrenceIdsToDelete = input.expenseRecurrences
        .filter((recurrence) => recurrence.projectId === input.projectId)
        .map((recurrence) => recurrence.id)
        .sort();
    const plannerReferenceIds = new Set([input.projectId, ...taskIdsToDelete]);
    const plannerAttachmentIdsToDelete = input.plannerAttachments
        .filter((attachment) => plannerReferenceIds.has(attachment.referenceId))
        .map((attachment) => attachment.id)
        .sort();
    const blockingReasons: string[] = [];

    if (invoiceIds.length > 0 && !includeInvoiceDeletion) {
        blockingReasons.push('project_has_invoices_not_selected_for_delete');
    }

    if (sharedInvoiceIds.length > 0) {
        blockingReasons.push('project_has_shared_invoices');
    }

    if (storedInvoiceIds.length > 0) {
        blockingReasons.push('project_has_stored_invoice_ids');
    }

    if (billedTimeEntryIds.length > 0) {
        blockingReasons.push('project_has_billed_time_entries');
    }

    if (billedExpenseIds.length > 0) {
        blockingReasons.push('project_has_billed_expenses');
    }

    if (taxClaimedExpenseIds.length > 0) {
        blockingReasons.push('project_has_tax_claimed_expenses');
    }

    return {
        projectId: input.projectId,
        title: project.title,
        includeInvoiceDeletion,
        activeTaskIds,
        archivedTaskIds,
        taskIdsToDelete,
        timeEntryIdsToDelete,
        billedTimeEntryIds,
        timerKeysToClear,
        invoiceIds,
        storedInvoiceIds,
        sharedInvoiceIds,
        expenseIdsToDelete,
        billedExpenseIds,
        taxClaimedExpenseIds,
        recurrenceIdsToDelete,
        plannerAttachmentIdsToDelete,
        canCascadeDeleteSafely: blockingReasons.length === 0,
        blockingReasons,
    };
}
