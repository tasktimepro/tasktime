import type { Expense, Invoice, InvoiceTemplate, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getNextSequentialNumberForTemplate } from '@/utils/invoiceUtils';
import type { InvoiceFinalizationPlan, InvoiceQuotedTaskClaim } from './invoiceFinalization';

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
        sentAt: finalizedAt,
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
