import type { Task, TimeEntry } from '@/stores/yjs/types';
import { buildBillableDurationFields } from '@/utils/timeEntryDurationUtils';
import { checkTimeOverlap } from '@/utils/timeValidationUtils';

export class TimeEntryOperationError extends Error {
    constructor(
        public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT',
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'TimeEntryOperationError';
    }
}

export function isTimeEntryBilled(entry: TimeEntry): boolean {
    return Boolean(entry.billedAt || entry.billedInvoiceId);
}

export function isManualTimeEntryLocked(entry: TimeEntry, task?: Task | null): boolean {
    return isTimeEntryBilled(entry) || Boolean(task?.lastBilledAt && entry.start <= task.lastBilledAt);
}

function assertTiming(start: number, end: number): void {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        throw new TimeEntryOperationError('INVALID_INPUT', 'Time entry start/end are invalid.');
    }
}

function assertAfterBillingCutoff(task: Task, start: number): void {
    const billingCutoff = task.lastBilledAt || 0;
    if (start < billingCutoff) {
        throw new TimeEntryOperationError(
            'CONFLICT',
            'Cannot place time entries before the latest billed time entry.',
            { billingCutoff },
        );
    }
}

function assertNoOverlap({
    task,
    tasks,
    entries,
    start,
    end,
    excludeEntryId,
}: {
    task: Task;
    tasks: Task[];
    entries: TimeEntry[];
    start: number;
    end: number;
    excludeEntryId?: string;
}): void {
    const overlap = checkTimeOverlap(
        start,
        end,
        task.projectId || task.id,
        entries,
        tasks.map((candidate) => ({
            ...candidate,
            projectId: candidate.projectId || candidate.id,
        })),
        excludeEntryId || null,
    );

    if (!overlap.isValid) {
        throw new TimeEntryOperationError('CONFLICT', overlap.error || 'Time entry overlaps an existing entry.');
    }
}

export function buildManualTimeEntry({
    id,
    task,
    tasks,
    entries,
    start,
    end,
    note,
    billingIncrementMinutes,
    now,
}: {
    id: string;
    task: Task;
    tasks: Task[];
    entries: TimeEntry[];
    start: number;
    end: number;
    note?: string | null;
    billingIncrementMinutes?: number | null;
    now: number;
}): TimeEntry {
    assertTiming(start, end);
    assertAfterBillingCutoff(task, start);
    assertNoOverlap({ task, tasks, entries, start, end });

    return {
        id,
        taskId: task.id,
        start,
        end,
        note: note?.trim() || undefined,
        ...buildBillableDurationFields({ start, end, billingIncrementMinutes }),
        createdAt: now,
        updatedAt: now,
    };
}

export function buildManualTimeEntryUpdate({
    entry,
    sourceTask,
    task,
    tasks,
    entries,
    updates,
    now,
}: {
    entry: TimeEntry;
    sourceTask?: Task | null;
    task: Task;
    tasks: Task[];
    entries: TimeEntry[];
    updates: Partial<Pick<TimeEntry, 'taskId' | 'start' | 'end' | 'note' | 'billingIncrementMinutes'>>;
    now: number;
}): TimeEntry {
    if (isManualTimeEntryLocked(entry, sourceTask || task)) {
        throw new TimeEntryOperationError('CONFLICT', 'Billed time entries cannot be edited.', { entryId: entry.id });
    }

    const start = updates.start ?? entry.start;
    const end = updates.end ?? entry.end;
    assertTiming(start, end);
    assertAfterBillingCutoff(task, start);
    assertNoOverlap({ task, tasks, entries, start, end, excludeEntryId: entry.id });

    const hasIncrementUpdate = Object.prototype.hasOwnProperty.call(updates, 'billingIncrementMinutes');
    const timingChanged = start !== entry.start || end !== entry.end;
    let durationFields: Pick<TimeEntry, 'billedDurationMs' | 'billingIncrementMinutes'> = {};

    if (hasIncrementUpdate) {
        const rebuilt = buildBillableDurationFields({
            start,
            end,
            billingIncrementMinutes: updates.billingIncrementMinutes,
        });
        durationFields = {
            billedDurationMs: rebuilt.billedDurationMs ?? null,
            billingIncrementMinutes: rebuilt.billingIncrementMinutes ?? null,
        };
    } else if (timingChanged && typeof entry.billingIncrementMinutes === 'number') {
        durationFields = buildBillableDurationFields({
            start,
            end,
            billingIncrementMinutes: entry.billingIncrementMinutes,
        });
    }

    return {
        ...entry,
        taskId: task.id,
        start,
        end,
        note: typeof updates.note === 'string'
            ? updates.note.trim() || undefined
            : (updates.note === null ? undefined : entry.note),
        ...durationFields,
        updatedAt: now,
    };
}

export function assertManualTimeEntryDeletion(entry: TimeEntry, task?: Task | null): void {
    if (isManualTimeEntryLocked(entry, task)) {
        throw new TimeEntryOperationError('CONFLICT', 'Billed time entries cannot be deleted.', { entryId: entry.id });
    }
}
