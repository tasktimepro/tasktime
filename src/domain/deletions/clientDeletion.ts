import { invoiceBelongsToProject, isMultiProjectInvoice } from '@/utils/invoiceUtils';
import type { Client, Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';

export interface ClientDeleteImpactPlan {
    clientId: string;
    title: string;
    alsoDeleteProjects: boolean;
    includeInvoiceDeletion: boolean;
    projectIdsToDelete: string[];
    projectIdsToConvertToPersonal: string[];
    activeTaskIdsToDelete: string[];
    archivedTaskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceIds: string[];
    sharedInvoiceIds: string[];
    expenseIdsToDelete: string[];
    billedExpenseIds: string[];
    taxClaimedExpenseIds: string[];
    recurrenceIdsToDelete: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface BuildClientDeleteImpactPlanInput {
    clientId: string;
    alsoDeleteProjects?: boolean;
    includeInvoiceDeletion?: boolean;
    clients: Client[];
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

export function buildClientDeleteImpactPlan(input: BuildClientDeleteImpactPlanInput): ClientDeleteImpactPlan | null {
    const client = input.clients.find((candidate) => candidate.id === input.clientId);

    if (!client) {
        return null;
    }

    const alsoDeleteProjects = input.alsoDeleteProjects === true;
    const includeInvoiceDeletion = input.includeInvoiceDeletion === true;
    const linkedProjectIds = input.projects
        .filter((project) => project.preferredClientId === input.clientId)
        .map((project) => project.id)
        .sort();
    const linkedProjectIdSet = new Set(linkedProjectIds);
    const activeTaskIdsToDelete = alsoDeleteProjects
        ? input.activeTasks
            .filter((task) => task.projectId && linkedProjectIdSet.has(task.projectId))
            .map((task) => task.id)
            .sort()
        : [];
    const archivedTaskIdsToDelete = alsoDeleteProjects
        ? input.archivedTasks
            .filter((task) => task.projectId && linkedProjectIdSet.has(task.projectId))
            .map((task) => task.id)
            .sort()
        : [];
    const taskIdSet = new Set([...activeTaskIdsToDelete, ...archivedTaskIdsToDelete]);
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
        .filter((timer) => (
            (alsoDeleteProjects && linkedProjectIdSet.has(timer.projectId))
            || taskIdSet.has(timer.taskId)
        ))
        .map((timer) => timer.projectId)
        .sort();
    const invoiceIds = input.invoices
        .filter((invoice) => (
            invoice.clientId === input.clientId
            || (alsoDeleteProjects && linkedProjectIds.some((projectId) => invoiceBelongsToProject(invoice, projectId)))
        ))
        .map((invoice) => invoice.id)
        .sort();
    const sharedInvoiceIds = input.invoices
        .filter((invoice) => (
            alsoDeleteProjects
            && linkedProjectIds.some((projectId) => invoiceBelongsToProject(invoice, projectId))
            && isMultiProjectInvoice(invoice)
        ))
        .map((invoice) => invoice.id)
        .sort();
    const expenseIdsToDelete = input.expenses
        .filter((expense) => (
            expense.clientId === input.clientId
            || (alsoDeleteProjects && expense.projectId && linkedProjectIdSet.has(expense.projectId))
        ))
        .map((expense) => expense.id)
        .sort();
    const billedExpenseIds = input.expenses
        .filter((expense) => (
            (expense.clientId === input.clientId || (alsoDeleteProjects && expense.projectId && linkedProjectIdSet.has(expense.projectId)))
            && (expense.billingStatus === 'billed' || Boolean(expense.invoiceId || expense.billedAt))
        ))
        .map((expense) => expense.id)
        .sort();
    const taxClaimedExpenseIds = input.expenses
        .filter((expense) => (
            (expense.clientId === input.clientId || (alsoDeleteProjects && expense.projectId && linkedProjectIdSet.has(expense.projectId)))
            && (expense.taxClaimStatus === 'claimed' || Boolean(expense.taxClaimPeriodId || expense.taxClaimedAt))
        ))
        .map((expense) => expense.id)
        .sort();
    const recurrenceIdsToDelete = input.expenseRecurrences
        .filter((recurrence) => (
            recurrence.clientId === input.clientId
            || (alsoDeleteProjects && recurrence.projectId && linkedProjectIdSet.has(recurrence.projectId))
        ))
        .map((recurrence) => recurrence.id)
        .sort();
    const plannerReferenceIds = new Set([
        input.clientId,
        ...(alsoDeleteProjects ? linkedProjectIds : []),
        ...activeTaskIdsToDelete,
        ...archivedTaskIdsToDelete,
    ]);
    const plannerAttachmentIdsToDelete = input.plannerAttachments
        .filter((attachment) => plannerReferenceIds.has(attachment.referenceId))
        .map((attachment) => attachment.id)
        .sort();
    const blockingReasons: string[] = [];

    if (invoiceIds.length > 0 && !includeInvoiceDeletion) {
        blockingReasons.push('client_or_related_projects_have_invoices_not_selected_for_delete');
    }

    if (sharedInvoiceIds.length > 0) {
        blockingReasons.push('related_projects_have_shared_invoices');
    }

    if (billedTimeEntryIds.length > 0) {
        blockingReasons.push('client_related_projects_have_billed_time_entries');
    }

    if (billedExpenseIds.length > 0) {
        blockingReasons.push('client_or_related_projects_have_billed_expenses');
    }

    if (taxClaimedExpenseIds.length > 0) {
        blockingReasons.push('client_or_related_projects_have_tax_claimed_expenses');
    }

    return {
        clientId: input.clientId,
        title: client.title,
        alsoDeleteProjects,
        includeInvoiceDeletion,
        projectIdsToDelete: alsoDeleteProjects ? linkedProjectIds : [],
        projectIdsToConvertToPersonal: alsoDeleteProjects ? [] : linkedProjectIds,
        activeTaskIdsToDelete,
        archivedTaskIdsToDelete,
        timeEntryIdsToDelete,
        billedTimeEntryIds,
        timerKeysToClear,
        invoiceIds,
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
