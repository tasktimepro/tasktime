import type { Task } from '@/stores/yjs/types';
import { isRecurringCompletedOnDate, toggleRecurringCompletionDate } from '@/utils/recurringCompletionUtils';
import { toStorageDate } from '@/utils/dateUtils';

export class TaskStateOperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TaskStateOperationError';
    }
}

function assertStorageDate(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TaskStateOperationError(`${label} must use YYYY-MM-DD.`);
    }
    return value;
}

function hasOwn(value: object, key: keyof Task): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Normalize task-state fields accepted by generic entity updates so every
 * caller preserves the same completion and recurring-skip invariants.
 */
export function buildTaskStatePatchUpdates({
    task,
    updates,
    now,
}: {
    task: Task;
    updates: Partial<Task>;
    now: number;
}): Partial<Task> {
    const normalized: Partial<Task> = { ...updates };
    const wasRecurring = Boolean(task.recurring);
    const nextRecurring = hasOwn(updates, 'recurring')
        ? Boolean(updates.recurring)
        : wasRecurring;
    const hasCompleted = hasOwn(updates, 'completed');
    const hasCompletedOnDate = hasOwn(updates, 'completedOnDate');
    const hasRecurringCompletion = hasOwn(updates, 'completedDatesByYear');
    const hasSkipFlag = hasOwn(updates, 'skipUntilNextRecurring');
    const hasSkippedDate = hasOwn(updates, 'skippedOccurrenceDate');

    if (nextRecurring) {
        if (hasCompleted || hasCompletedOnDate) {
            throw new TaskStateOperationError(
                'Recurring task completion must identify a specific occurrence date.',
            );
        }

        if (!wasRecurring) {
            normalized.completed = false;
            normalized.completedOnDate = null;
        }

        if (hasRecurringCompletion) {
            normalized.skipUntilNextRecurring = false;
            normalized.skippedOccurrenceDate = null;
        } else if (hasSkipFlag || hasSkippedDate) {
            if (hasSkipFlag && typeof updates.skipUntilNextRecurring !== 'boolean') {
                throw new TaskStateOperationError('skipUntilNextRecurring must be a boolean.');
            }

            const shouldSkip = hasSkipFlag
                ? updates.skipUntilNextRecurring === true
                : updates.skippedOccurrenceDate != null;
            const occurrenceDate = hasSkippedDate
                ? updates.skippedOccurrenceDate
                : task.skippedOccurrenceDate;

            normalized.skipUntilNextRecurring = shouldSkip;
            normalized.skippedOccurrenceDate = shouldSkip
                ? assertStorageDate(occurrenceDate, 'skippedOccurrenceDate')
                : null;
        }

        return normalized;
    }

    if (!wasRecurring && (hasRecurringCompletion || hasSkipFlag || hasSkippedDate)) {
        throw new TaskStateOperationError('Recurring completion and skip state require a recurring task.');
    }

    if (wasRecurring) {
        normalized.completed = false;
        normalized.completedOnDate = null;
        normalized.skipUntilNextRecurring = false;
        normalized.skippedOccurrenceDate = null;
    }

    if (hasCompleted) {
        Object.assign(normalized, buildTaskCompletionUpdates({
            task: { ...task, recurring: null },
            completed: updates.completed,
            completionDate: hasCompletedOnDate && updates.completedOnDate
                ? updates.completedOnDate
                : undefined,
            now,
        }));
    } else if (hasCompletedOnDate) {
        if (!task.completed || !updates.completedOnDate) {
            throw new TaskStateOperationError('completedOnDate must be updated together with completed.');
        }
        normalized.completedOnDate = assertStorageDate(updates.completedOnDate, 'completedOnDate');
    }

    return normalized;
}

export function buildTaskCompletionUpdates({
    task,
    completed,
    occurrenceDate,
    completionDate,
    now,
}: {
    task: Task;
    completed?: boolean;
    occurrenceDate?: string;
    completionDate?: string;
    now: number;
}): Partial<Task> {
    if (task.recurring) {
        const date = assertStorageDate(occurrenceDate, 'occurrenceDate');
        const isCompleted = isRecurringCompletedOnDate(task.completedDatesByYear, date);
        const shouldComplete = completed ?? !isCompleted;
        const completedDatesByYear = shouldComplete === isCompleted
            ? task.completedDatesByYear
            : toggleRecurringCompletionDate(task.completedDatesByYear, date);

        return {
            completedDatesByYear,
            skipUntilNextRecurring: false,
            skippedOccurrenceDate: null,
            updatedAt: now,
            lastActive: now,
        };
    }

    const shouldComplete = completed ?? !Boolean(task.completed);
    const completedOnDate = completionDate
        || (task.completed ? task.completedOnDate : null)
        || toStorageDate(new Date(now))
        || undefined;

    return {
        completed: shouldComplete,
        completedOnDate: shouldComplete
            ? assertStorageDate(completedOnDate, 'completionDate')
            : null,
        updatedAt: now,
        lastActive: now,
    };
}

export function buildRecurringSkipUpdates(task: Task, occurrenceDate: string, now: number): Partial<Task> {
    if (!task.recurring) {
        throw new TaskStateOperationError('Only recurring tasks can skip an occurrence.');
    }

    return {
        skipUntilNextRecurring: true,
        skippedOccurrenceDate: assertStorageDate(occurrenceDate, 'occurrenceDate'),
        updatedAt: now,
        lastActive: now,
    };
}
