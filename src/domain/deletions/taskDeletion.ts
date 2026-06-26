import { getTaskIdsWithDescendants } from '@/utils/taskUtils';
import type { Invoice, MultiTimerState, PlannerAttachment, Task, TimeEntry } from '@/stores/yjs/types';

export interface TaskDeleteImpactPlan {
    taskId: string;
    title: string;
    archived: boolean;
    descendantTaskIds: string[];
    taskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceReferences: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface BuildTaskDeleteImpactPlanInput {
    taskId: string;
    activeTasks: Task[];
    archivedTasks: Task[];
    timeEntries: TimeEntry[];
    timers: MultiTimerState[];
    invoices: Invoice[];
    plannerAttachments: PlannerAttachment[];
}

const uniqueSorted = (values: string[]): string[] => {
    return [...new Set(values)].sort();
};

const getTaskInvoiceReferences = (invoices: Invoice[], taskId: string): string[] => {
    const references = invoices
        .filter((invoice) => {
            const itemReference = Array.isArray(invoice.items)
                && invoice.items.some((item) => item?.taskId === taskId);
            const billingSnapshotReference = Boolean(invoice.billingStateSnapshot?.taskLastBilledAt?.[taskId] !== undefined);
            const projectBreakdownReference = Array.isArray(invoice.projectBreakdowns)
                && invoice.projectBreakdowns.some((breakdown) => (
                    Array.isArray(breakdown.tasks)
                    && breakdown.tasks.some((breakdownTask) => breakdownTask?.id === taskId || breakdownTask?.taskId === taskId)
                ));

            return itemReference || billingSnapshotReference || projectBreakdownReference;
        })
        .map((invoice) => invoice.id);

    return uniqueSorted(references);
};

export function buildTaskDeleteImpactPlan(input: BuildTaskDeleteImpactPlanInput): TaskDeleteImpactPlan | null {
    const activeTask = input.activeTasks.find((candidate) => candidate.id === input.taskId);
    const archivedTask = input.archivedTasks.find((candidate) => candidate.id === input.taskId);
    const task = activeTask || archivedTask;

    if (!task) {
        return null;
    }

    const allTasks = [...input.activeTasks, ...input.archivedTasks];
    const taskIdsToDelete = getTaskIdsWithDescendants(input.taskId, allTasks).sort();
    const taskIdSet = new Set(taskIdsToDelete);
    const descendantTaskIds = taskIdsToDelete.filter((candidateId) => candidateId !== input.taskId);
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
        .filter((timer) => taskIdSet.has(timer.taskId))
        .map((timer) => timer.projectId)
        .sort();
    const invoiceReferences = taskIdsToDelete
        .flatMap((candidateId) => getTaskInvoiceReferences(input.invoices, candidateId))
        .sort();
    const quotedInvoiceReferences = allTasks
        .filter((candidate) => taskIdSet.has(candidate.id) && candidate.quotedAmountBilling?.invoiceId)
        .map((candidate) => candidate.quotedAmountBilling?.invoiceId)
        .filter((invoiceId): invoiceId is string => typeof invoiceId === 'string' && invoiceId.trim().length > 0);
    const allInvoiceReferences = uniqueSorted([...invoiceReferences, ...quotedInvoiceReferences]);
    const plannerAttachmentIdsToDelete = input.plannerAttachments
        .filter((attachment) => taskIdSet.has(attachment.referenceId))
        .map((attachment) => attachment.id)
        .sort();
    const blockingReasons: string[] = [];

    if (allInvoiceReferences.length > 0) {
        blockingReasons.push('task_has_invoice_references');
    }

    if (billedTimeEntryIds.length > 0) {
        blockingReasons.push('task_has_billed_time_entries');
    }

    return {
        taskId: input.taskId,
        title: task.title,
        archived: Boolean(archivedTask && !activeTask),
        descendantTaskIds,
        taskIdsToDelete,
        timeEntryIdsToDelete,
        billedTimeEntryIds,
        timerKeysToClear,
        invoiceReferences: allInvoiceReferences,
        plannerAttachmentIdsToDelete,
        canCascadeDeleteSafely: blockingReasons.length === 0,
        blockingReasons,
    };
}
