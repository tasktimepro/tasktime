import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { checkTimeOverlap } from '@/utils/timeValidationUtils';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';
import { objectToYMap, updateEntityFields } from '@/stores/yjs/entityUtils';
import type { MultiTimerState, Task, TimeEntry } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import { assertPermission, assertReady, getId, getNow, readRequiredEntity, requireString, withIdempotency } from './shared';

export interface StartTimerCommandInput {
    taskId: string;
    note?: string;
    idempotencyKey?: string;
}

export interface PauseTimerCommandInput {
    timerKey?: string;
    taskId?: string;
    pausedAt?: number;
}

export interface StopTimerCommandInput {
    timerKey?: string;
    taskId?: string;
}

export interface AddManualTimeEntryCommandInput {
    taskId: string;
    start: number;
    end: number;
    note?: string;
    idempotencyKey?: string;
}

export interface ActiveTimerResult extends MultiTimerState {
    timerKey: string;
    elapsedTime: number;
    isPaused: boolean;
}

function resolveTimerKeyForTask(context: AgentCommandContext, taskId: string): string {
    const task = readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');
    return task.projectId || task.id;
}

function resolveTimerKey(context: AgentCommandContext, input: { timerKey?: string; taskId?: string }): string {
    if (input.timerKey) {
        return requireString(input.timerKey, 'timerKey');
    }

    if (input.taskId) {
        return resolveTimerKeyForTask(context, input.taskId);
    }

    throw new AgentCommandError('INVALID_INPUT', 'timerKey or taskId is required.');
}

export function getActiveTimersCommand(context: AgentCommandContext): ActiveTimerResult[] {
    assertReady(context);
    assertPermission(context, 'read');

    const now = getNow(context);

    return collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent list timers')
        .map((timer) => {
            const timerKey = timer.projectId;
            const elapsedTime = timer.paused
                ? (timer.pausedElapsedTime || 0)
                : Math.max(0, now - timer.startTime);

            return {
                ...timer,
                timerKey,
                elapsedTime,
                isPaused: Boolean(timer.paused),
            };
        })
        .sort((a, b) => (b.lastActive || b.startTime) - (a.lastActive || a.startTime));
}

export function startTimerCommand(context: AgentCommandContext, input: StartTimerCommandInput): MultiTimerState {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const taskId = requireString(input.taskId, 'taskId');
        const timerKey = resolveTimerKeyForTask(context, taskId);

        if (context.store.timers.has(timerKey)) {
            throw new AgentCommandError('CONFLICT', 'A timer is already active for this task/project.', { timerKey, taskId });
        }

        const now = getNow(context);
        const timer = validateCollectionEntity<MultiTimerState>('timers', {
            projectId: timerKey,
            taskId,
            timerInstanceId: getId(context),
            startTime: Math.ceil(now / 1000) * 1000,
            paused: false,
            pausedElapsedTime: 0,
            note: input.note || '',
            lastActive: now,
        }, `agent start timer ${timerKey}`);

        context.store.coreDoc.transact(() => {
            (context.store.timers as any).set(timerKey, objectToYMap(timer as unknown as Record<string, unknown>));
        });

        markMeaningfulActivity('timer_start');
        return timer;
    });
}

export function pauseTimerCommand(context: AgentCommandContext, input: PauseTimerCommandInput): MultiTimerState {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);
    const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent pause timer ${timerKey}`);

    if (!timer) {
        throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
    }

    if (timer.paused) {
        return timer;
    }

    const pausedAt = typeof input.pausedAt === 'number' && Number.isFinite(input.pausedAt)
        ? input.pausedAt
        : getNow(context);
    const pausedElapsedTime = Math.max(0, pausedAt - timer.startTime);

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.timers as any, timerKey, {
            paused: true,
            pausedElapsedTime,
            lastActive: pausedAt,
        });
    });

    markMeaningfulActivity('timer_pause');

    return {
        ...timer,
        paused: true,
        pausedElapsedTime,
        lastActive: pausedAt,
    };
}

export function stopTimerCommand(context: AgentCommandContext, input: StopTimerCommandInput): { timerKey: string; entry: TimeEntry; durationMs: number } {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);
    const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent stop timer ${timerKey}`);

    if (!timer) {
        throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
    }

    const now = getNow(context);
    const startTime = timer.paused
        ? (now - (timer.pausedElapsedTime || 0))
        : timer.startTime;

    const entry = validateCollectionEntity<TimeEntry>('timeEntries', {
        id: getId(context),
        taskId: timer.taskId,
        start: startTime,
        end: now,
        note: timer.note,
        _stoppedTimerKey: timerKey,
        _stoppedTimerInstanceId: timer.timerInstanceId,
        createdAt: now,
        updatedAt: now,
    }, `agent stop timer entry ${timerKey}`);

    context.store.activeEntriesDoc.transact(() => {
        (context.store.activeTimeEntries as any).set(entry.id, objectToYMap(entry as unknown as Record<string, unknown>));
    });

    context.store.coreDoc.transact(() => {
        context.store.timers.delete(timerKey);
    });

    markMeaningfulActivity('timer_stop');

    return {
        timerKey,
        entry,
        durationMs: Math.max(0, entry.end - entry.start),
    };
}

export function addManualTimeEntryCommand(context: AgentCommandContext, input: AddManualTimeEntryCommandInput): TimeEntry {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const taskId = requireString(input.taskId, 'taskId');
        const task = readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');

        if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end < input.start) {
            throw new AgentCommandError('INVALID_INPUT', 'Manual time entry start/end are invalid.');
        }

        const billingCutoff = task.lastBilledAt || 0;
        if (input.start < billingCutoff) {
            throw new AgentCommandError('CONFLICT', 'Cannot add time entries before the latest billed time entry.', { billingCutoff });
        }

        const allEntries = context.store.getAllTimeEntries();
        const allTasks = collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent manual entry task overlap')
            .map((item) => ({
                id: item.id,
                projectId: item.projectId || item.id,
                title: item.title,
            }));
        const overlap = checkTimeOverlap(input.start, input.end, task.projectId || task.id, allEntries, allTasks);

        if (!overlap.isValid) {
            throw new AgentCommandError('CONFLICT', overlap.error || 'Time entry overlaps an existing entry.');
        }

        const now = getNow(context);
        const entry = validateCollectionEntity<TimeEntry>('timeEntries', {
            id: getId(context),
            taskId,
            start: input.start,
            end: input.end,
            note: input.note?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
        }, `agent create manual entry ${taskId}`);

        context.store.activeEntriesDoc.transact(() => {
            (context.store.activeTimeEntries as any).set(entry.id, objectToYMap(entry as unknown as Record<string, unknown>));
        });

        markMeaningfulActivity('time_entry_create');
        return entry;
    });
}
