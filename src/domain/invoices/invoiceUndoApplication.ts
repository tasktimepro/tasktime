import type { Expense, Invoice, InvoiceTemplate, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { planInvoiceUndo, type InvoiceUndoPlan } from './invoiceUndo';

export interface InvoiceUndoApplicationPlan {
    entriesToDelete: TimeEntry[];
    entriesToClear: Array<{
        entry: TimeEntry;
        updates: Partial<TimeEntry>;
    }>;
    expenseUpdatesToUnbill: Array<{
        id: string;
        updates: Partial<Expense>;
    }>;
    quotedTaskUpdates: Array<{
        id: string;
        updates: Partial<Task>;
    }>;
    taskCutoffUpdates: Array<{
        id: string;
        expectedLastBilledAt: number | null;
        updates: Partial<Task>;
    }>;
    projectUnlinkUpdates: Array<{
        id: string;
        updates: Partial<Project>;
    }>;
    invoiceTemplateSequenceUpdate: {
        id: string;
        updates: Partial<InvoiceTemplate>;
    } | null;
    clearedTimeEntryCount: number;
    deletedAdjustmentCount: number;
    unbilledExpenseCount: number;
    rewoundSequence: boolean;
}

export function buildInvoiceUndoApplication({
    invoice,
    invoiceId,
    entries,
    expenses,
    tasks,
    projects,
    sequenceRollback,
    templateId,
    undoneAt,
}: {
    invoice: Invoice;
    invoiceId: string;
    entries: TimeEntry[];
    expenses: Expense[];
    tasks: Task[];
    projects: Project[];
    sequenceRollback: {
        canRollback: boolean;
        nextSequentialNumber: number;
    };
    templateId?: string | null;
    undoneAt: number;
}): {
    plan: InvoiceUndoPlan;
    application: InvoiceUndoApplicationPlan;
} {
    const plan = planInvoiceUndo({
        invoice,
        invoiceId,
        entries,
        expenses,
        tasks,
    });
    const application = buildInvoiceUndoApplicationPlan({
        invoiceId,
        undoPlan: plan,
        expenses,
        tasks,
        projects,
        sequenceRollback,
        templateId,
        undoneAt,
    });

    return {
        plan,
        application,
    };
}

export function buildInvoiceUndoApplicationPlan({
    invoiceId,
    undoPlan,
    expenses,
    tasks,
    projects,
    sequenceRollback,
    templateId,
    undoneAt,
}: {
    invoiceId: string;
    undoPlan: InvoiceUndoPlan;
    expenses: Expense[];
    tasks: Task[];
    projects: Project[];
    sequenceRollback: {
        canRollback: boolean;
        nextSequentialNumber: number;
    };
    templateId?: string | null;
    undoneAt: number;
}): InvoiceUndoApplicationPlan {
    const expenseIdsToUnbill = new Set(undoPlan.expenseIdsToUnbill);
    const expenseUpdatesToUnbill = expenses
        .filter((expense) => expenseIdsToUnbill.has(expense.id))
        .map((expense) => ({
            id: expense.id,
            updates: buildUnbilledExpenseUpdates({ updatedAt: undoneAt }),
        }));
    const quotedTaskUpdates = tasks
        .map((task) => {
            if (task.quotedAmountBilling?.invoiceId !== invoiceId) {
                return null;
            }

            const updates = buildReleasedQuotedTaskUpdates({
                task,
                updatedAt: undoneAt,
            });

            return updates ? { id: task.id, updates } : null;
        })
        .filter((update): update is { id: string; updates: Partial<Task> } => Boolean(update));
    const taskCutoffUpdates = Array.from(undoPlan.taskLastBilledAtRestorations.entries())
        .map(([taskId, restoredCutoff]) => ({
            id: taskId,
            expectedLastBilledAt: tasks.find((task) => task.id === taskId)?.lastBilledAt ?? null,
            updates: buildRestoredTaskBillingCutoffUpdates({
                restoredCutoff,
                updatedAt: undoneAt,
            }),
        }));
    const projectUnlinkUpdates = projects
        .map((project) => {
            const updates = buildProjectInvoiceUnlinkUpdates({
                project,
                invoiceId,
                updatedAt: undoneAt,
            });

            return updates ? { id: project.id, updates } : null;
        })
        .filter((update): update is { id: string; updates: Partial<Project> } => Boolean(update));
    const invoiceTemplateSequenceUpdate = sequenceRollback.canRollback && templateId
        ? {
            id: templateId,
            updates: buildInvoiceTemplateSequenceRollbackUpdates({
                currentSequentialNumber: sequenceRollback.nextSequentialNumber,
                updatedAt: undoneAt,
            }),
        }
        : null;

    return {
        entriesToDelete: [...undoPlan.entriesToDelete],
        entriesToClear: undoPlan.entriesToClear.map((entry) => ({
            entry,
            updates: buildClearedBilledTimeEntryUpdates({ updatedAt: undoneAt }),
        })),
        expenseUpdatesToUnbill,
        quotedTaskUpdates,
        taskCutoffUpdates,
        projectUnlinkUpdates,
        invoiceTemplateSequenceUpdate,
        clearedTimeEntryCount: undoPlan.clearedTimeEntryCount,
        deletedAdjustmentCount: undoPlan.deletedAdjustmentCount,
        unbilledExpenseCount: expenseUpdatesToUnbill.length,
        rewoundSequence: Boolean(invoiceTemplateSequenceUpdate),
    };
}

export function buildClearedBilledTimeEntryUpdates({
    updatedAt,
}: {
    updatedAt: number;
}): Partial<TimeEntry> {
    return {
        billedAt: null,
        billedHourlyRate: null,
        billedInvoiceId: null,
        updatedAt,
    };
}

export function buildUnbilledExpenseUpdates({
    updatedAt,
}: {
    updatedAt: number;
}): Partial<Expense> {
    return {
        billingStatus: 'unbilled',
        invoiceId: null,
        billedAt: null,
        updatedAt,
    };
}

export function buildRestoredTaskBillingCutoffUpdates({
    restoredCutoff,
    updatedAt,
}: {
    restoredCutoff: number | null;
    updatedAt: number;
}): Partial<Task> {
    return {
        lastBilledAt: restoredCutoff,
        updatedAt,
    };
}

export function buildReleasedQuotedTaskUpdates({
    task,
    updatedAt,
}: {
    task: Task;
    updatedAt: number;
}): Partial<Task> | null {
    if (!task.quotedAmountBilling?.invoiceId) {
        return null;
    }

    const restoredQuoteAmount = isPositiveFiniteNumber(task.estimatedFlatAmount)
        ? task.estimatedFlatAmount
        : task.quotedAmountBilling.total;

    return {
        estimatedFlatAmount: restoredQuoteAmount,
        quotedAmountBilling: null,
        updatedAt,
    };
}

export function buildProjectInvoiceUnlinkUpdates({
    project,
    invoiceId,
    updatedAt,
}: {
    project: Project;
    invoiceId: string;
    updatedAt: number;
}): Partial<Project> | null {
    const invoiceIds = Array.isArray(project.invoiceIds) ? project.invoiceIds : null;

    if (!invoiceIds || !invoiceIds.includes(invoiceId)) {
        return null;
    }

    return {
        invoiceIds: invoiceIds.filter((candidate) => candidate !== invoiceId),
        updatedAt,
    };
}

export function buildInvoiceTemplateSequenceRollbackUpdates({
    currentSequentialNumber,
    updatedAt,
}: {
    currentSequentialNumber: number;
    updatedAt: number;
}): Partial<InvoiceTemplate> {
    return {
        currentSequentialNumber,
        updatedAt,
    };
}

function isPositiveFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
