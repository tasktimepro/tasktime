import type { Expense, Invoice, Task, TimeEntry } from '@/stores/yjs/types';

export interface InvoiceSourceReleasePlan {
    entriesToDelete: TimeEntry[];
    entriesToClear: TimeEntry[];
    expenseIdsToUnbill: string[];
    taskLastBilledAtRestorations: Map<string, number | null>;
    clearedTimeEntryCount: number;
    deletedAdjustmentCount: number;
}

export interface PlanInvoiceSourceReleaseInput {
    invoice: Invoice;
    invoiceId: string;
    entries: TimeEntry[];
    expenses: Expense[];
    tasks: Task[];
}

export function planInvoiceSourceRelease(input: PlanInvoiceSourceReleaseInput): InvoiceSourceReleasePlan {
    const billedEntries = input.entries.filter((entry) => entry?.billedInvoiceId === input.invoiceId);
    const entriesToDelete = billedEntries.filter((entry) => entry.source === 'invoice-adjustment');
    const entriesToClear = billedEntries.filter((entry) => entry.source !== 'invoice-adjustment');
    const entryIdsToDelete = new Set(entriesToDelete.map((entry) => entry.id));
    const entryIdsToClear = new Set(entriesToClear.map((entry) => entry.id));
    const touchedTaskIds = new Set<string>();
    const invoiceBilledEntryStartByTaskId = new Map<string, number>();
    const snapshotCutoffs = getInvoiceBillingSnapshotCutoffs(input.invoice);

    Object.keys(snapshotCutoffs).forEach((taskId) => {
        touchedTaskIds.add(taskId);
    });

    billedEntries.forEach((entry) => {
        if (entry?.taskId) {
            touchedTaskIds.add(entry.taskId);
        }

        if (
            entry?.taskId
            && entry.source !== 'invoice-adjustment'
            && typeof entry.start === 'number'
        ) {
            const existingStart = invoiceBilledEntryStartByTaskId.get(entry.taskId);

            if (existingStart === undefined || entry.start < existingStart) {
                invoiceBilledEntryStartByTaskId.set(entry.taskId, entry.start);
            }
        }
    });

    input.tasks.forEach((task) => {
        if (task?.quotedAmountBilling?.invoiceId === input.invoiceId) {
            touchedTaskIds.add(task.id);
        }
    });

    (Array.isArray((input.invoice as any)?.tasks) ? (input.invoice as any).tasks : []).forEach((task: any) => {
        if (task?.id) {
            touchedTaskIds.add(task.id);
        }
    });

    const taskLastBilledAtRestorations = new Map<string, number | null>();

    touchedTaskIds.forEach((taskId) => {
        const nextBillingCutoff = input.entries.reduce((latestEnd, entry) => {
            if (entry.taskId !== taskId || entryIdsToDelete.has(entry.id) || entryIdsToClear.has(entry.id)) {
                return latestEnd;
            }

            const hasBillingMarker = Boolean(entry.billedInvoiceId)
                || typeof entry.billedAt === 'number'
                || typeof entry.billedHourlyRate === 'number';

            if (!hasBillingMarker || typeof entry.end !== 'number' || entry.end <= latestEnd) {
                return latestEnd;
            }

            return entry.end;
        }, 0);

        const snapshotCutoff = getSnapshotCutoff(snapshotCutoffs, taskId);
        let restoredCutoff: number | null | undefined;

        if (snapshotCutoff !== undefined) {
            restoredCutoff = Math.max(snapshotCutoff || 0, nextBillingCutoff) || null;
        } else if (invoiceBilledEntryStartByTaskId.has(taskId)) {
            const inferredPreviousCutoff = Math.max(0, (invoiceBilledEntryStartByTaskId.get(taskId) || 0) - 1);
            restoredCutoff = Math.max(nextBillingCutoff, inferredPreviousCutoff) || null;
        }

        if (restoredCutoff !== undefined) {
            taskLastBilledAtRestorations.set(taskId, restoredCutoff);
        }
    });

    return {
        entriesToDelete,
        entriesToClear,
        expenseIdsToUnbill: input.expenses
            .filter((expense) => expense?.invoiceId === input.invoiceId)
            .map((expense) => expense.id),
        taskLastBilledAtRestorations,
        clearedTimeEntryCount: entriesToClear.length,
        deletedAdjustmentCount: entriesToDelete.length,
    };
}

export type InvoiceUndoPlan = InvoiceSourceReleasePlan;
export type PlanInvoiceUndoInput = PlanInvoiceSourceReleaseInput;

/** Preserve the established undo API while sharing source release with cancellation. */
export function planInvoiceUndo(input: PlanInvoiceUndoInput): InvoiceUndoPlan {
    return planInvoiceSourceRelease(input);
}

export function getInvoiceBillingSnapshotCutoffs(invoice: Invoice | null | undefined): Record<string, unknown> {
    const snapshot = (invoice as any)?.billingStateSnapshot?.taskLastBilledAt;

    return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
        ? snapshot
        : {};
}

function getSnapshotCutoff(snapshotCutoffs: Record<string, unknown>, taskId: string): number | null | undefined {
    if (!Object.prototype.hasOwnProperty.call(snapshotCutoffs, taskId)) {
        return undefined;
    }

    const value = snapshotCutoffs[taskId];

    if (value === null || value === undefined) {
        return null;
    }

    return isPositiveFiniteNumber(value)
        ? value
        : null;
}

function isPositiveFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
