import type { Invoice, Task, TimeEntry } from '@/stores/yjs/types';
import { isStoredDateWithinBillingRange } from '@/utils/billingPeriodUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';

const HOUR_IN_MS = 60 * 60 * 1000;

type LegacyInvoiceTask = {
    id?: string;
    originalHours?: number | null;
    originalTimeMs?: number | null;
    mergedSubtasks?: Array<string | { id?: string }>;
};

type LegacyInvoice = Invoice & {
    tasks?: LegacyInvoiceTask[];
};

type InvoiceEligibilityInput = {
    tasks: Task[];
    timeEntries: TimeEntry[];
    invoices?: Invoice[];
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
};

const isValidSourceEntry = (entry: TimeEntry): boolean => (
    typeof entry.start === 'number'
    && typeof entry.end === 'number'
    && entry.end > entry.start
    && entry.source !== 'invoice-adjustment'
);

export const hasExplicitBillingMarker = (entry: TimeEntry): boolean => Boolean(
    entry.billedInvoiceId
    || entry.billedAt
    || entry.billedHourlyRate
);

const getLegacyInvoiceTaskIds = (invoiceTask: LegacyInvoiceTask): Set<string> => {
    const taskIds = new Set<string>();

    if (invoiceTask.id) {
        taskIds.add(invoiceTask.id);
    }

    (invoiceTask.mergedSubtasks || []).forEach((subtask) => {
        const taskId = typeof subtask === 'string' ? subtask : subtask?.id;

        if (taskId) {
            taskIds.add(taskId);
        }
    });

    return taskIds;
};

const getLegacyInvoiceTaskDuration = (invoiceTask: LegacyInvoiceTask) => {
    if (
        typeof invoiceTask.originalTimeMs === 'number'
        && Number.isFinite(invoiceTask.originalTimeMs)
        && invoiceTask.originalTimeMs >= 0
    ) {
        return {
            durationMs: invoiceTask.originalTimeMs,
            exact: true,
        };
    }

    if (
        typeof invoiceTask.originalHours === 'number'
        && Number.isFinite(invoiceTask.originalHours)
        && invoiceTask.originalHours >= 0
    ) {
        return {
            durationMs: invoiceTask.originalHours * HOUR_IN_MS,
            exact: false,
        };
    }

    return null;
};

const durationsMatch = (expectedMs: number, actualMs: number, exact: boolean): boolean => {
    if (exact) {
        return Math.abs(expectedMs - actualMs) < 1;
    }

    const expectedHours = Math.round((expectedMs / HOUR_IN_MS) * 100) / 100;
    const actualHours = Math.round((actualMs / HOUR_IN_MS) * 100) / 100;

    return expectedHours === actualHours;
};

/**
 * Recover exact legacy billing evidence without mutating persisted entries.
 *
 * Older finalized invoices could record task source duration and advance the
 * task cutoff without writing an entry-level billing marker to every source
 * entry. Markerless entries are considered legacy-billed only when the stored
 * invoice duration can account for every candidate exactly. Ambiguous records
 * remain eligible so genuinely late-arriving work is never silently consumed.
 */
export const collectLegacyBilledTimeEntryIds = ({
    tasks,
    timeEntries,
    invoices = [],
}: Omit<InvoiceEligibilityInput, 'billingPeriodStart' | 'billingPeriodEnd'>): Set<string> => {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const legacyBilledEntryIds = new Set<string>();
    const sortedInvoices = [...invoices]
        .filter((invoice) => invoice.status !== 'draft' && !invoice.billingSelectionSnapshot)
        .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));

    sortedInvoices.forEach((invoiceRecord) => {
        const invoice = invoiceRecord as LegacyInvoice;

        if (!invoice.billingPeriodStart || !invoice.billingPeriodEnd) {
            return;
        }

        (invoice.tasks || []).forEach((invoiceTask) => {
            const sourceTaskIds = getLegacyInvoiceTaskIds(invoiceTask);
            const taskDuration = getLegacyInvoiceTaskDuration(invoiceTask);

            if (!taskDuration || sourceTaskIds.size === 0) {
                return;
            }

            const hasKnownTask = Array.from(sourceTaskIds).some((taskId) => taskMap.has(taskId));

            if (!hasKnownTask) {
                return;
            }

            const sourceEntries = timeEntries.filter((entry) => (
                sourceTaskIds.has(entry.taskId)
                && taskMap.has(entry.taskId)
                && isValidSourceEntry(entry)
                && isStoredDateWithinBillingRange(
                    entry.start,
                    invoice.billingPeriodStart || '',
                    invoice.billingPeriodEnd || ''
                )
            ));
            const explicitlyLinkedDurationMs = sourceEntries
                .filter((entry) => entry.billedInvoiceId === invoice.id)
                .reduce((total, entry) => total + getBillableDurationMs(entry), 0);
            const markerlessCandidates = sourceEntries.filter((entry) => (
                !hasExplicitBillingMarker(entry)
                && !legacyBilledEntryIds.has(entry.id)
                && (
                    typeof invoice.createdAt !== 'number'
                    || typeof entry.createdAt !== 'number'
                    || entry.createdAt <= invoice.createdAt
                )
            ));
            const markerlessDurationMs = markerlessCandidates
                .reduce((total, entry) => total + getBillableDurationMs(entry), 0);

            if (
                markerlessCandidates.length > 0
                && durationsMatch(
                    taskDuration.durationMs,
                    explicitlyLinkedDurationMs + markerlessDurationMs,
                    taskDuration.exact
                )
            ) {
                markerlessCandidates.forEach((entry) => legacyBilledEntryIds.add(entry.id));
            }
        });
    });

    return legacyBilledEntryIds;
};

/**
 * Return the shared UI/agent invoice candidates for the supplied tasks.
 */
export const getInvoiceEligibleTimeEntries = ({
    tasks,
    timeEntries,
    invoices = [],
    billingPeriodStart = '',
    billingPeriodEnd = '',
}: InvoiceEligibilityInput): TimeEntry[] => {
    const billableTaskIds = new Set(
        tasks
            .filter((task) => task.billable === true)
            .map((task) => task.id)
    );
    const legacyBilledEntryIds = collectLegacyBilledTimeEntryIds({
        tasks,
        timeEntries,
        invoices,
    });

    return timeEntries.filter((entry) => (
        billableTaskIds.has(entry.taskId)
        && isValidSourceEntry(entry)
        && !hasExplicitBillingMarker(entry)
        && !legacyBilledEntryIds.has(entry.id)
        && isStoredDateWithinBillingRange(entry.start, billingPeriodStart, billingPeriodEnd)
    ));
};
