import type { MultiTimerState, Task, TimeEntry } from '@/stores/yjs/types';
import { buildBillableDurationFields } from '@/utils/timeEntryDurationUtils';
import { checkTimeOverlap } from '@/utils/timeValidationUtils';

export class TimerOperationError extends Error {
    constructor(
        public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT',
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'TimerOperationError';
    }
}

type TimerTaskIdentity = Pick<Task, 'id' | 'projectId'>;

export function getTimerKeyForTask(task: TimerTaskIdentity): string {
    return task.projectId || task.id;
}

export function buildStartedTimer({
    task,
    timerInstanceId,
    now,
    note = '',
}: {
    task: TimerTaskIdentity;
    timerInstanceId: string;
    now: number;
    note?: string;
}): MultiTimerState {
    if (!Number.isFinite(now)) {
        throw new TimerOperationError('INVALID_INPUT', 'Timer start time must be finite.');
    }

    return {
        projectId: getTimerKeyForTask(task),
        taskId: task.id,
        timerInstanceId,
        startTime: Math.ceil(now / 1000) * 1000,
        paused: false,
        pausedElapsedTime: 0,
        note,
        lastActive: now,
    };
}

export function buildPausedTimer(timer: MultiTimerState, pausedAt: number): MultiTimerState {
    if (!Number.isFinite(pausedAt)) {
        throw new TimerOperationError('INVALID_INPUT', 'Timer pause time must be finite.');
    }

    if (timer.paused) return timer;

    return {
        ...timer,
        paused: true,
        pausedElapsedTime: Math.max(0, pausedAt - timer.startTime),
        lastActive: pausedAt,
    };
}

export function buildResumedTimer(timer: MultiTimerState, now: number): MultiTimerState {
    if (!Number.isFinite(now)) {
        throw new TimerOperationError('INVALID_INPUT', 'Timer resume time must be finite.');
    }

    if (!timer.paused) return timer;
    const pausedElapsedTime = Math.max(0, timer.pausedElapsedTime || 0);

    return {
        ...timer,
        startTime: now - pausedElapsedTime,
        paused: false,
        pausedElapsedTime: 0,
        lastActive: now,
    };
}

export function buildUpdatedTimer(
    timer: MultiTimerState,
    updates: { startTime?: number; note?: string | null },
    now: number,
): MultiTimerState {
    if (updates.startTime === undefined && updates.note === undefined) {
        throw new TimerOperationError('INVALID_INPUT', 'startTime or note is required to update a timer.');
    }
    if (updates.startTime !== undefined && !Number.isFinite(updates.startTime)) {
        throw new TimerOperationError('INVALID_INPUT', 'startTime must be a finite timestamp.');
    }

    return {
        ...timer,
        ...(updates.startTime === undefined ? {} : { startTime: updates.startTime }),
        ...(updates.note === undefined ? {} : { note: updates.note || '' }),
        lastActive: now,
    };
}

export function findStoppedTimerEntry({
    timerKey,
    timer,
    entries,
    operationId,
}: {
    timerKey: string;
    timer: MultiTimerState | null;
    entries: TimeEntry[];
    operationId?: string;
}): TimeEntry | null {
    if (operationId) {
        const operationEntry = entries.find((entry) => (
            entry._stoppedTimerKey === timerKey
            && entry._stoppedTimerOperationId === operationId
        ));
        if (operationEntry) return operationEntry;
    }
    if (!timer) return null;

    return entries.find((entry) => {
        if (entry._stoppedTimerKey !== timerKey) return false;
        if (entry._stoppedTimerInstanceId && timer.timerInstanceId) {
            return entry._stoppedTimerInstanceId === timer.timerInstanceId;
        }

        return !entry._stoppedTimerInstanceId
            && !timer.timerInstanceId
            && entry.taskId === timer.taskId
            && entry.start === timer.startTime;
    }) || null;
}

/**
 * Return the stable entry key for one timer instance. Using the same key on
 * every device lets Yjs converge concurrent stops to one logical entry.
 */
export function buildStoppedTimerEntryId(timerKey: string, timer: MultiTimerState): string {
    const instanceIdentity = timer.timerInstanceId || `legacy-${timer.startTime}`;

    return [
        'timer-stop',
        encodeURIComponent(timerKey),
        encodeURIComponent(timer.taskId),
        encodeURIComponent(instanceIdentity),
    ].join(':');
}

export function planStoppedTimer({
    timerKey,
    timer,
    entries,
    tasks,
    now,
    operationId,
    billingIncrementMinutes,
}: {
    timerKey: string;
    timer: MultiTimerState | null;
    entries: TimeEntry[];
    tasks: Task[];
    now: number;
    operationId?: string;
    billingIncrementMinutes?: number | null;
}): { entry: TimeEntry; recovered: boolean } {
    const priorEntry = findStoppedTimerEntry({ timerKey, timer, entries, operationId });
    if (priorEntry) return { entry: priorEntry, recovered: true };
    if (!timer) {
        throw new TimerOperationError('NOT_FOUND', 'Timer not found.', { timerKey });
    }
    if (!Number.isFinite(now)) {
        throw new TimerOperationError('INVALID_INPUT', 'Timer stop time must be finite.');
    }

    const task = tasks.find((candidate) => candidate.id === timer.taskId);
    if (!task) {
        throw new TimerOperationError('NOT_FOUND', 'Timer task not found.', { taskId: timer.taskId });
    }

    const start = timer.startTime;
    const end = timer.paused
        ? timer.startTime + Math.max(0, timer.pausedElapsedTime || 0)
        : Math.max(now, timer.startTime);
    const projectId = task.projectId || task.id;
    const normalizedTasks = tasks.map((candidate) => ({
        ...candidate,
        projectId: candidate.projectId || candidate.id,
    }));
    const overlap = checkTimeOverlap(start, end, projectId, entries, normalizedTasks);

    if (!overlap.isValid) {
        throw new TimerOperationError('CONFLICT', overlap.error || 'Time entry overlaps an existing entry.');
    }

    return {
        recovered: false,
        entry: {
            id: buildStoppedTimerEntryId(timerKey, timer),
            taskId: timer.taskId,
            start,
            end,
            note: timer.note,
            _stoppedTimerKey: timerKey,
            _stoppedTimerInstanceId: timer.timerInstanceId,
            _stoppedTimerOperationId: operationId,
            ...buildBillableDurationFields({ start, end, billingIncrementMinutes }),
            createdAt: now,
            updatedAt: now,
        },
    };
}
