import type { Client, Expense, Invoice, InvoiceTemplate, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getNextSequentialNumberForTemplate } from '@/utils/invoiceUtils';
import {
    planInvoiceFinalization,
    type InvoiceFinalizationPlan,
    type InvoiceQuotedTaskClaim,
} from './invoiceFinalization';
import { buildReleasedQuotedTaskUpdates, buildUnbilledExpenseUpdates } from './invoiceUndoApplication';

export type FinalizedInvoiceUpdates = Partial<Invoice> & {
    agentDraft?: Record<string, unknown>;
};

export interface InvoiceFinalizationApplicationPlan {
    adjustmentEntryIdsToDelete: string[];
    adjustmentEntriesToUpdate: Array<{
        id: string;
        updates: Partial<TimeEntry>;
    }>;
    adjustmentEntriesToCreate: Array<{
        id: string;
        entry: Omit<TimeEntry, 'id'>;
    }>;
    timeEntryUpdates: Array<{
        id: string;
        updates: Partial<TimeEntry>;
    }>;
    expenseUpdates: Array<{
        id: string;
        updates: Partial<Expense>;
    }>;
    taskCutoffUpdates: Array<{
        id: string;
        updates: Partial<Task>;
    }>;
    quotedTaskUpdates: Array<{
        id: string;
        updates: Partial<Task>;
    }>;
    projectLinkUpdates: Array<{
        id: string;
        updates: Partial<Project>;
    }>;
    invoiceTemplateSequenceUpdate: {
        id: string;
        updates: Partial<InvoiceTemplate>;
    } | null;
    invoiceUpdates: FinalizedInvoiceUpdates;
    billedEntryCount: number;
    billedExpenseCount: number;
    updatedTaskCount: number;
    updatedProjectInvoiceReferences: boolean;
    advancedInvoiceSequence: boolean;
}

export interface InvoiceEditApplicationPlan {
    adjustmentEntryIdsToDelete: string[];
    adjustmentEntriesToUpdate: Array<{
        id: string;
        updates: Partial<TimeEntry>;
    }>;
    adjustmentEntriesToCreate: Array<{
        id: string;
        entry: Omit<TimeEntry, 'id'>;
    }>;
    expenseUpdates: Array<{
        id: string;
        updates: Partial<Expense>;
    }>;
    quotedTaskUpdates: Array<{
        id: string;
        updates: Partial<Task>;
    }>;
    billedExpenseCount: number;
    unbilledExpenseCount: number;
    claimedQuotedTaskCount: number;
    releasedQuotedTaskCount: number;
}

export function buildInvoiceFinalizationApplication({
    invoice,
    projects,
    clients,
    tasks,
    entries,
    expenses,
    invoiceTemplate,
    invoices,
    finalizedAt,
    createAdjustmentId,
}: {
    invoice: Invoice;
    projects: Project[];
    clients: Client[];
    tasks: Task[];
    entries: TimeEntry[];
    expenses: Expense[];
    invoiceTemplate?: (InvoiceTemplate & Record<string, unknown>) | null;
    invoices: Invoice[];
    finalizedAt: number;
    createAdjustmentId: () => string;
}): {
    plan: InvoiceFinalizationPlan;
    application: InvoiceFinalizationApplicationPlan;
} {
    const plan = planInvoiceFinalization({
        invoice,
        projects,
        clients,
        tasks,
        entries,
        expenses,
        finalizedAt,
        createAdjustmentId,
    });
    const application = buildInvoiceFinalizationApplicationPlan({
        invoice,
        plan,
        projects,
        invoiceTemplate,
        invoices,
        finalizedAt,
    });

    return {
        plan,
        application,
    };
}

export function buildInvoiceEditApplication({
    invoice,
    projects,
    clients,
    tasks,
    entries,
    expenses,
    selectedExpenseIds,
    editedAt,
    createAdjustmentId,
}: {
    invoice: Invoice;
    projects: Project[];
    clients: Client[];
    tasks: Task[];
    entries: TimeEntry[];
    expenses: Expense[];
    selectedExpenseIds: Iterable<string>;
    editedAt: number;
    createAdjustmentId: () => string;
}): {
    plan: InvoiceFinalizationPlan;
    application: InvoiceEditApplicationPlan;
} {
    const plan = planInvoiceFinalization({
        invoice,
        projects,
        clients,
        tasks,
        entries,
        expenses,
        finalizedAt: editedAt,
        createAdjustmentId,
    });
    const application = buildInvoiceEditApplicationPlan({
        invoice,
        plan,
        expenses,
        tasks,
        selectedExpenseIds,
        editedAt,
    });

    return {
        plan,
        application,
    };
}

export function buildInvoiceFinalizationApplicationPlan({
    invoice,
    plan,
    projects,
    invoiceTemplate,
    invoices,
    finalizedAt,
}: {
    invoice: Invoice;
    plan: InvoiceFinalizationPlan;
    projects: Project[];
    invoiceTemplate?: (InvoiceTemplate & Record<string, unknown>) | null;
    invoices: Invoice[];
    finalizedAt: number;
}): InvoiceFinalizationApplicationPlan {
    const projectLinkUpdates = plan.projectIdsToLink
        .map((projectId) => {
            const project = projects.find((candidate) => candidate.id === projectId);
            if (!project) return null;

            const updates = buildProjectInvoiceLinkUpdates({
                project,
                invoiceId: invoice.id,
                finalizedAt,
            });

            return updates ? { id: project.id, updates } : null;
        })
        .filter((update): update is { id: string; updates: Partial<Project> } => Boolean(update));
    const invoiceTemplateSequenceUpdate = invoiceTemplate?.id && invoiceTemplate.useSequentialNumbers
        ? {
            id: invoiceTemplate.id,
            updates: {
                currentSequentialNumber: getNextSequentialNumberForTemplate(invoiceTemplate, invoices),
            },
        }
        : null;

    return {
        adjustmentEntryIdsToDelete: [...plan.adjustmentEntryIdsToDelete],
        adjustmentEntriesToUpdate: plan.adjustmentEntriesToUpdate.map((adjustment) => ({
            id: adjustment.id,
            updates: adjustment.updates,
        })),
        adjustmentEntriesToCreate: plan.adjustmentEntriesToCreate.map((adjustment) => ({
            id: adjustment.id,
            entry: adjustment.entry,
        })),
        timeEntryUpdates: plan.entriesToBill.map(({ entry, billedHourlyRate }) => ({
            id: entry.id,
            updates: buildFinalizedTimeEntryUpdates({
                invoiceId: invoice.id,
                finalizedAt,
                billedHourlyRate,
            }),
        })),
        expenseUpdates: plan.expensesToBill.map((expense) => ({
            id: expense.id,
            updates: buildFinalizedExpenseUpdates({
                invoiceId: invoice.id,
                finalizedAt,
            }),
        })),
        taskCutoffUpdates: Array.from(plan.updatedTaskIds).map((taskId) => ({
            id: taskId,
            updates: buildFinalizedTaskCutoffUpdates({
                plan,
                taskId,
                finalizedAt,
            }),
        })),
        quotedTaskUpdates: plan.quotedTaskClaims.map((claim) => ({
            id: claim.taskId,
            updates: buildFinalizedQuotedTaskUpdates({
                invoiceId: invoice.id,
                finalizedAt,
                claim,
            }),
        })),
        projectLinkUpdates,
        invoiceTemplateSequenceUpdate,
        invoiceUpdates: buildFinalizedInvoiceUpdates({
            finalizedAt,
            plan,
        }),
        billedEntryCount: plan.entriesToBill.length,
        billedExpenseCount: plan.expensesToBill.length,
        updatedTaskCount: plan.updatedTaskIds.size,
        updatedProjectInvoiceReferences: projectLinkUpdates.length > 0,
        advancedInvoiceSequence: Boolean(invoiceTemplateSequenceUpdate),
    };
}

export function buildInvoiceEditApplicationPlan({
    invoice,
    plan,
    expenses,
    tasks,
    selectedExpenseIds,
    editedAt,
}: {
    invoice: Invoice;
    plan: Pick<InvoiceFinalizationPlan, 'adjustmentEntryIdsToDelete' | 'adjustmentEntriesToUpdate' | 'adjustmentEntriesToCreate' | 'quotedTaskClaims'>;
    expenses: Expense[];
    tasks: Task[];
    selectedExpenseIds: Iterable<string>;
    editedAt: number;
}): InvoiceEditApplicationPlan {
    const selectedExpenseIdSet = new Set(selectedExpenseIds);
    const invoiceTaskIds = collectInvoiceTaskIds(invoice);
    const expenseUpdatesToBill = expenses
        .filter((expense) => selectedExpenseIdSet.has(expense.id))
        .map((expense) => ({
            id: expense.id,
            updates: buildFinalizedExpenseUpdates({
                invoiceId: invoice.id,
                finalizedAt: editedAt,
            }),
        }));
    const expenseUpdatesToUnbill = expenses
        .filter((expense) => expense.invoiceId === invoice.id && !selectedExpenseIdSet.has(expense.id))
        .map((expense) => ({
            id: expense.id,
            updates: buildUnbilledExpenseUpdates({
                updatedAt: editedAt,
            }),
        }));
    const quotedTaskClaims = plan.quotedTaskClaims.map((claim) => ({
        id: claim.taskId,
        updates: buildFinalizedQuotedTaskUpdates({
            invoiceId: invoice.id,
            finalizedAt: editedAt,
            claim,
        }),
    }));
    const quotedTaskReleases = tasks
        .map((task) => {
            if (task.quotedAmountBilling?.invoiceId !== invoice.id || invoiceTaskIds.has(task.id)) {
                return null;
            }

            const updates = buildReleasedQuotedTaskUpdates({
                task,
                updatedAt: editedAt,
            });

            return updates ? { id: task.id, updates } : null;
        })
        .filter((update): update is { id: string; updates: Partial<Task> } => Boolean(update));

    return {
        adjustmentEntryIdsToDelete: [...plan.adjustmentEntryIdsToDelete],
        adjustmentEntriesToUpdate: plan.adjustmentEntriesToUpdate.map((adjustment) => ({
            id: adjustment.id,
            updates: adjustment.updates,
        })),
        adjustmentEntriesToCreate: plan.adjustmentEntriesToCreate.map((adjustment) => ({
            id: adjustment.id,
            entry: adjustment.entry,
        })),
        expenseUpdates: [...expenseUpdatesToBill, ...expenseUpdatesToUnbill],
        quotedTaskUpdates: [...quotedTaskClaims, ...quotedTaskReleases],
        billedExpenseCount: expenseUpdatesToBill.length,
        unbilledExpenseCount: expenseUpdatesToUnbill.length,
        claimedQuotedTaskCount: quotedTaskClaims.length,
        releasedQuotedTaskCount: quotedTaskReleases.length,
    };
}

export function buildFinalizedTimeEntryUpdates({
    invoiceId,
    finalizedAt,
    billedHourlyRate,
    updatedAt = finalizedAt,
}: {
    invoiceId: string;
    finalizedAt: number;
    billedHourlyRate: number | null;
    updatedAt?: number;
}): Partial<TimeEntry> {
    return {
        billedAt: finalizedAt,
        billedInvoiceId: invoiceId,
        billedHourlyRate,
        updatedAt,
    };
}

export function buildFinalizedExpenseUpdates({
    invoiceId,
    finalizedAt,
    updatedAt = finalizedAt,
}: {
    invoiceId: string;
    finalizedAt: number;
    updatedAt?: number;
}): Partial<Expense> {
    return {
        billingStatus: 'billed',
        invoiceId,
        billedAt: finalizedAt,
        updatedAt,
    };
}

export function buildFinalizedTaskCutoffUpdates({
    plan,
    taskId,
    finalizedAt,
    updatedAt = finalizedAt,
}: {
    plan: Pick<InvoiceFinalizationPlan, 'nextTaskCutoffs'>;
    taskId: string;
    finalizedAt: number;
    updatedAt?: number;
}): Partial<Task> {
    return {
        lastBilledAt: plan.nextTaskCutoffs.get(taskId) || null,
        updatedAt,
    };
}

export function buildFinalizedQuotedTaskUpdates({
    invoiceId,
    finalizedAt,
    claim,
    updatedAt = finalizedAt,
}: {
    invoiceId: string;
    finalizedAt: number;
    claim: InvoiceQuotedTaskClaim;
    updatedAt?: number;
}): Partial<Task> {
    return {
        estimatedFlatAmount: null,
        quotedAmountBilling: {
            invoiceId,
            billedAt: finalizedAt,
            total: claim.total,
        },
        updatedAt,
    };
}

export function buildProjectInvoiceLinkUpdates({
    project,
    invoiceId,
    finalizedAt,
    updatedAt = finalizedAt,
}: {
    project: Project;
    invoiceId: string;
    finalizedAt: number;
    updatedAt?: number;
}): Partial<Project> | null {
    const existingInvoiceIds = Array.isArray(project.invoiceIds) ? project.invoiceIds : [];

    if (existingInvoiceIds.includes(invoiceId)) {
        return null;
    }

    return {
        invoiceIds: [...existingInvoiceIds, invoiceId],
        updatedAt,
    };
}

export function buildFinalizedInvoiceUpdates({
    finalizedAt,
    plan,
    updatedAt = finalizedAt,
}: {
    finalizedAt: number;
    plan: Pick<InvoiceFinalizationPlan, 'taskLastBilledAt' | 'agentDraft'>;
    updatedAt?: number;
}): FinalizedInvoiceUpdates {
    return {
        status: 'sent',
        billingStateSnapshot: {
            version: 1,
            capturedAt: finalizedAt,
            taskLastBilledAt: plan.taskLastBilledAt,
        },
        agentDraft: plan.agentDraft
            ? {
                ...plan.agentDraft,
                finalizationState: 'finalized',
                finalizedAt,
            }
            : undefined,
        updatedAt,
    };
}

function collectInvoiceTaskIds(invoice: Invoice): Set<string> {
    const ids = new Set<string>();
    const collect = (tasks: unknown) => {
        if (!Array.isArray(tasks)) return;

        tasks.forEach((task) => {
            if (!task || typeof task !== 'object') return;

            const record = task as Record<string, unknown>;
            const taskId = typeof record.id === 'string' ? record.id : null;

            if (taskId) {
                ids.add(taskId);
            }

            collect(record.mergedSubtasks);
        });
    };

    collect((invoice as Invoice & { tasks?: unknown }).tasks);

    const projectBreakdowns = (invoice as Invoice & { projectBreakdowns?: unknown }).projectBreakdowns;
    if (Array.isArray(projectBreakdowns)) {
        projectBreakdowns.forEach((breakdown) => {
            if (!breakdown || typeof breakdown !== 'object') return;
            collect((breakdown as Record<string, unknown>).tasks);
        });
    }

    return ids;
}
