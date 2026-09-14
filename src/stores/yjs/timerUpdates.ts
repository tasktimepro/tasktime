import type { YjsStore } from './YjsStore';
import type { MultiTimerState, Task, TimeEntry } from './types';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from './validation';
import { updateEntityFields } from './entityUtils';
import { assertTimerInterval, buildUpdatedTimer, TimerOperationError } from '@/domain/time/timerOperations';

/** Apply a timer edit only after complete-history validation and a fresh timer check. */
export async function updateTimerWithValidation(
    store: YjsStore,
    timerKey: string,
    updates: { startTime?: number; note?: string | null },
    now: () => number = Date.now,
): Promise<MultiTimerState> {
    const readTimer = () => readValidatedEntity<MultiTimerState>('timers', store.timers.get(timerKey), `update timer ${timerKey}`);
    const requested = readTimer();
    if (!requested) throw new TimerOperationError('NOT_FOUND', 'Timer not found.');

    let updated = buildUpdatedTimer(requested, updates, now());
    if (updates.startTime !== undefined && updates.startTime !== requested.startTime) {
        const archivedTaskMap = typeof store.loadArchivedTasks === 'function'
            ? await store.loadArchivedTasks()
            : store.archivedTasks;
        const loadedEntries = typeof store.loadAllTimeEntries === 'function'
            ? await store.loadAllTimeEntries()
            : collectValidatedEntities<TimeEntry>('timeEntries', store.activeTimeEntries as any, 'timer update entries');

        const current = readTimer();
        // Focus/activity updates do not change the interval; stop, resume, edits and
        // replacement timers do. Never overwrite those changes after loading history.
        if (!current || (['timerInstanceId', 'taskId', 'startTime', 'paused', 'pausedElapsedTime', 'note'] as const)
            .some((field) => current[field] !== requested[field])) {
            throw new TimerOperationError('CONFLICT', 'The timer changed while it was being updated. Please reopen its options and try again.');
        }
        const tasks = [
            ...collectValidatedEntities<Task>('tasks', store.tasks as any, 'timer update tasks'),
            ...(archivedTaskMap ? collectValidatedEntities<Task>('tasks', archivedTaskMap as any, 'timer update archived tasks') : []),
        ];
        const entries = typeof store.getAllTimeEntries === 'function' ? store.getAllTimeEntries() : loadedEntries;
        const validatedAt = now();
        updated = buildUpdatedTimer(current, updates, validatedAt);
        assertTimerInterval(updated, tasks, entries, validatedAt);
    }

    try {
        updated = validateCollectionEntity<MultiTimerState>('timers', updated, `update timer ${timerKey}`);
    } catch (error) {
        throw new TimerOperationError('INVALID_INPUT', error instanceof Error ? error.message : 'Invalid timer update.');
    }
    const fields: Record<string, unknown> = { lastActive: updated.lastActive };
    if (updates.startTime !== undefined) {
        fields.startTime = updated.startTime;
        if (updated.paused) fields.pausedElapsedTime = updated.pausedElapsedTime;
    }
    if (updates.note !== undefined) fields.note = updated.note;
    store.coreDoc.transact(() => updateEntityFields(store.timers as any, timerKey, fields));
    return updated;
}
