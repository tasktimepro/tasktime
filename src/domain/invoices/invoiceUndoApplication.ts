import type { Expense, InvoiceTemplate, Project, Task, TimeEntry } from '@/stores/yjs/types';

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
