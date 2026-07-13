import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';
import { objectToYMap, readEntity, updateEntityFields } from '@/stores/yjs/entityUtils';
import type { MultiTimerState, Project, Task, TimeEntry } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import { assertPermission, assertReady, getId, getNow, readRequiredEntity, requireString, withIdempotency } from './shared';
import {
    TimerOperationError,
    buildPausedTimer,
    buildResumedTimer,
    buildStartedTimer,
    buildUpdatedTimer,
    findStoppedTimerEntry,
    planStoppedTimer,
} from '@/domain/time/timerOperations';
import {
    TimeEntryOperationError,
    assertManualTimeEntryDeletion,
    buildManualTimeEntry,
    buildManualTimeEntryUpdate,
} from '@/domain/time/manualTimeEntryOperations';

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

export interface ResumeTimerCommandInput {
    timerKey?: string;
    taskId?: string;
}

export interface StopTimerCommandInput {
    timerKey?: string;
    taskId?: string;
    idempotencyKey?: string;
}

export interface ClearTimerCommandInput {
    timerKey?: string;
    taskId?: string;
    confirmClear?: boolean;
    confirmationText?: string;
}

export interface ClearTimerResult {
    timerKey: string;
    taskId: string;
    cleared: true;
}

export interface UpdateTimerCommandInput {
    timerKey?: string;
    taskId?: string;
    startTime?: number;
    note?: string | null;
}

export interface AddManualTimeEntryCommandInput {
    taskId: string;
    start: number;
    end: number;
    note?: string;
    billingIncrementMinutes?: number | null;
    idempotencyKey?: string;
}

export interface UpdateTimeEntryCommandInput {
    entryId: string;
    taskId?: string;
    start?: number;
    end?: number;
    note?: string | null;
    billingIncrementMinutes?: number | null;
}

export interface DeleteTimeEntryCommandInput {
    entryId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteTimeEntryResult {
    entryId: string;
    taskId: string;
    start: number;
    end: number;
    durationMs: number;
    deleted: true;
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

function throwAgentTimeEntryError(error: unknown): never {
    if (error instanceof TimeEntryOperationError) {
        throw new AgentCommandError(error.code, error.message, error.details);
    }
    throw error;
}

function throwAgentTimerError(error: unknown): never {
    if (error instanceof TimerOperationError) {
        throw new AgentCommandError(error.code, error.message, error.details);
    }
    throw error;
}

async function collectStoppedTimerEntries(context: AgentCommandContext): Promise<TimeEntry[]> {
    if (typeof context.store.loadAllTimeEntries === 'function') {
        return context.store.loadAllTimeEntries();
    }
    if (typeof context.store.getAllTimeEntries === 'function') {
        return context.store.getAllTimeEntries();
    }

    return collectValidatedEntities<TimeEntry>('timeEntries', context.store.activeTimeEntries as any, 'agent stopped timer entries');
}

async function collectManualTimeEntryState(context: AgentCommandContext): Promise<{
    archivedTaskMap: any;
    entries: TimeEntry[];
    tasks: Task[];
}> {
    const archivedTaskMap = typeof context.store.loadArchivedTasks === 'function'
        ? await context.store.loadArchivedTasks()
        : context.store.archivedTasks;
    const entries = await collectStoppedTimerEntries(context);
    const tasks = [
        ...collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent time entry tasks'),
        ...(archivedTaskMap
            ? collectValidatedEntities<Task>('tasks', archivedTaskMap as any, 'agent time entry archived tasks')
            : []),
    ];

    return { archivedTaskMap, entries, tasks };
}

function readManualTimeEntryTask(
    context: AgentCommandContext,
    archivedTaskMap: any,
    taskId: string,
): Task {
    const task = readValidatedEntity<Task>('tasks', context.store.tasks.get(taskId), `agent time entry task ${taskId}`)
        || (archivedTaskMap
            ? readValidatedEntity<Task>('tasks', archivedTaskMap.get(taskId), `agent archived time entry task ${taskId}`)
            : null);

    if (!task) {
        throw new AgentCommandError('NOT_FOUND', 'Task not found.', { id: taskId });
    }

    return task;
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
        const task = readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');
        const timer = validateCollectionEntity<MultiTimerState>('timers', buildStartedTimer({
            task,
            timerInstanceId: getId(context),
            now,
            note: input.note,
        }), `agent start timer ${timerKey}`);

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
    const paused = buildPausedTimer(timer, pausedAt);

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.timers as any, timerKey, {
            paused: paused.paused,
            pausedElapsedTime: paused.pausedElapsedTime,
            lastActive: paused.lastActive,
        });
    });

    markMeaningfulActivity('timer_pause');

    return paused;
}

export function resumeTimerCommand(context: AgentCommandContext, input: ResumeTimerCommandInput): MultiTimerState {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);
    const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent resume timer ${timerKey}`);

    if (!timer) {
        throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
    }

    if (!timer.paused) {
        return timer;
    }

    const now = getNow(context);
    const merged = validateCollectionEntity<MultiTimerState>('timers', buildResumedTimer(timer, now), `agent resume timer ${timerKey}`);
    const updates = {
        startTime: merged.startTime,
        paused: merged.paused,
        pausedElapsedTime: merged.pausedElapsedTime,
        lastActive: merged.lastActive,
    };

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.timers as any, timerKey, updates);
    });

    markMeaningfulActivity('timer_resume');
    return merged;
}

export async function stopTimerCommand(context: AgentCommandContext, input: StopTimerCommandInput): Promise<{ timerKey: string; entry: TimeEntry; durationMs: number }> {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);
    const cacheKey = input.idempotencyKey
        ? `stop_timer:${timerKey}:${input.idempotencyKey}`
        : undefined;

    return withIdempotency(context, cacheKey, async () => {
        const requestedTimer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent stop timer ${timerKey}`);
        if (!requestedTimer) {
            const stoppedEntries = await collectStoppedTimerEntries(context);
            const recovered = findStoppedTimerEntry({
                timerKey,
                timer: null,
                entries: stoppedEntries,
                operationId: input.idempotencyKey,
            });

            if (recovered) return buildStopTimerResult(timerKey, recovered);
            throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
        }

        const stoppedEntries = await collectStoppedTimerEntries(context);
        const archivedTaskMap = typeof context.store.loadArchivedTasks === 'function'
            ? await context.store.loadArchivedTasks()
            : context.store.archivedTasks;
        const tasks = [
            ...collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent stopped timer tasks'),
            ...(archivedTaskMap
                ? collectValidatedEntities<Task>('tasks', archivedTaskMap as any, 'agent stopped timer archived tasks')
                : []),
        ];
        const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent finish stopping timer ${timerKey}`);

        if (!timer) {
            const recovered = findStoppedTimerEntry({ timerKey, timer: requestedTimer, entries: stoppedEntries, operationId: input.idempotencyKey });
            if (recovered) return buildStopTimerResult(timerKey, recovered);
            throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
        }
        if (timer.timerInstanceId !== requestedTimer.timerInstanceId
            || timer.taskId !== requestedTimer.taskId
            || timer.startTime !== requestedTimer.startTime) {
            throw new AgentCommandError('CONFLICT', 'The active timer changed while it was being stopped.', { timerKey });
        }

        const now = getNow(context);
        const stoppedTask = tasks.find((candidate) => candidate.id === timer.taskId) || null;
        const stoppedProject = stoppedTask?.projectId && context.store.projects
            ? readEntity<Project>(context.store.projects.get(stoppedTask.projectId)) || null
            : null;
        let stopPlan;
        try {
            stopPlan = planStoppedTimer({
                timerKey,
                timer,
                entries: stoppedEntries,
                tasks,
                now,
                operationId: input.idempotencyKey,
                billingIncrementMinutes: stoppedProject?.billableTimeIncrementMinutes,
            });
        } catch (error) {
            throwAgentTimerError(error);
        }
        const entry = validateCollectionEntity<TimeEntry>('timeEntries', stopPlan.entry, `agent stop timer entry ${timerKey}`);

        if (!stopPlan.recovered) {
            context.store.activeEntriesDoc.transact(() => {
                (context.store.activeTimeEntries as any).set(entry.id, objectToYMap(entry as unknown as Record<string, unknown>));
            });
        }

        context.store.coreDoc.transact(() => {
            const latestTimer = readEntity<MultiTimerState>(context.store.timers.get(timerKey));
            const matchesStoppedInstance = latestTimer
                && latestTimer.taskId === timer.taskId
                && latestTimer.startTime === timer.startTime
                && latestTimer.timerInstanceId === timer.timerInstanceId;

            if (matchesStoppedInstance) {
                context.store.timers.delete(timerKey);
            }
        });

        markMeaningfulActivity('timer_stop');
        return buildStopTimerResult(timerKey, entry);
    });
}

function buildStopTimerResult(timerKey: string, entry: TimeEntry) {
    return {
        timerKey,
        entry,
        durationMs: Math.max(0, entry.end - entry.start),
    };
}

export function clearTimerCommand(context: AgentCommandContext, input: ClearTimerCommandInput): ClearTimerResult {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);

    if (input.confirmClear !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmClear must be true to clear a timer.', { timerKey });
    }

    if (input.confirmationText !== timerKey) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match timerKey to clear a timer.', { timerKey });
    }

    const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent clear timer ${timerKey}`);

    if (!timer) {
        throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
    }

    context.store.coreDoc.transact(() => {
        context.store.timers.delete(timerKey);
    });

    markMeaningfulActivity('timer_clear');

    return {
        timerKey,
        taskId: timer.taskId,
        cleared: true,
    };
}

export function updateTimerCommand(context: AgentCommandContext, input: UpdateTimerCommandInput): MultiTimerState {
    assertReady(context);
    assertPermission(context, 'write');

    const timerKey = resolveTimerKey(context, input);
    const timer = readValidatedEntity<MultiTimerState>('timers', context.store.timers.get(timerKey), `agent update timer ${timerKey}`);

    if (!timer) {
        throw new AgentCommandError('NOT_FOUND', 'Timer not found.', { timerKey });
    }

    if (input.startTime === undefined && input.note === undefined) {
        throw new AgentCommandError('INVALID_INPUT', 'startTime or note is required to update a timer.', { timerKey });
    }

    let merged: MultiTimerState;
    try {
        merged = validateCollectionEntity<MultiTimerState>('timers', buildUpdatedTimer(timer, input, getNow(context)), `agent update timer ${timerKey}`);
    } catch (error) {
        throw new AgentCommandError('INVALID_INPUT', error instanceof Error ? error.message : 'Invalid timer update.', { timerKey });
    }
    const updates: Record<string, unknown> = { lastActive: merged.lastActive };
    if (input.startTime !== undefined) updates.startTime = merged.startTime;
    if (input.note !== undefined) updates.note = merged.note;

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.timers as any, timerKey, updates);
    });

    markMeaningfulActivity('timer_update');
    return merged;
}

export function addManualTimeEntryCommand(context: AgentCommandContext, input: AddManualTimeEntryCommandInput): Promise<TimeEntry> {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, async () => {
        const taskId = requireString(input.taskId, 'taskId');
        const operationState = await collectManualTimeEntryState(context);
        const task = readManualTimeEntryTask(context, operationState.archivedTaskMap, taskId);

        const now = getNow(context);
        let builtEntry: TimeEntry;
        try {
            builtEntry = buildManualTimeEntry({
                id: getId(context),
                task,
                tasks: operationState.tasks,
                entries: operationState.entries,
                start: input.start,
                end: input.end,
                note: input.note,
                billingIncrementMinutes: input.billingIncrementMinutes,
                now,
            });
        } catch (error) {
            throwAgentTimeEntryError(error);
        }
        const entry = validateCollectionEntity<TimeEntry>('timeEntries', builtEntry, `agent create manual entry ${taskId}`);

        context.store.activeEntriesDoc.transact(() => {
            (context.store.activeTimeEntries as any).set(entry.id, objectToYMap(entry as unknown as Record<string, unknown>));
        });

        markMeaningfulActivity('time_entry_create');
        return entry;
    });
}

export async function updateTimeEntryCommand(context: AgentCommandContext, input: UpdateTimeEntryCommandInput): Promise<TimeEntry> {
    assertReady(context);
    assertPermission(context, 'write');

    const entryId = requireString(input.entryId, 'entryId');
    const operationState = await collectManualTimeEntryState(context);
    const existing = readValidatedEntity<TimeEntry>('timeEntries', context.store.activeTimeEntries.get(entryId), `agent update time entry ${entryId}`);

    if (!existing) {
        throw new AgentCommandError('NOT_FOUND', 'Active time entry not found. Historical entries cannot be edited by an agent in v1.', { entryId });
    }

    const nextTaskId = input.taskId ? requireString(input.taskId, 'taskId') : existing.taskId;
    const sourceTask = readManualTimeEntryTask(context, operationState.archivedTaskMap, existing.taskId);
    const task = readManualTimeEntryTask(context, operationState.archivedTaskMap, nextTaskId);
    let builtEntry: TimeEntry;
    try {
        builtEntry = buildManualTimeEntryUpdate({
            entry: existing,
            sourceTask,
            task,
            tasks: operationState.tasks,
            entries: operationState.entries,
            updates: {
                taskId: nextTaskId,
                start: input.start,
                end: input.end,
                note: input.note,
                ...(Object.prototype.hasOwnProperty.call(input, 'billingIncrementMinutes')
                    ? { billingIncrementMinutes: input.billingIncrementMinutes }
                    : {}),
            },
            now: getNow(context),
        });
    } catch (error) {
        throwAgentTimeEntryError(error);
    }
    const merged = validateCollectionEntity<TimeEntry>('timeEntries', builtEntry, `agent update time entry ${entryId}`);
    const updates: Partial<TimeEntry> = {
        taskId: merged.taskId,
        start: merged.start,
        end: merged.end,
        note: merged.note,
        updatedAt: merged.updatedAt,
    };
    if (Object.prototype.hasOwnProperty.call(merged, 'billedDurationMs')) {
        updates.billedDurationMs = merged.billedDurationMs;
    }
    if (Object.prototype.hasOwnProperty.call(merged, 'billingIncrementMinutes')) {
        updates.billingIncrementMinutes = merged.billingIncrementMinutes;
    }

    context.store.activeEntriesDoc.transact(() => {
        const updated = updateEntityFields(context.store.activeTimeEntries as any, entryId, updates as Record<string, unknown>);

        if (!updated) {
            (context.store.activeTimeEntries as any).set(entryId, objectToYMap(merged as unknown as Record<string, unknown>));
        }
    });

    markMeaningfulActivity('time_entry_update');
    return merged;
}

export async function deleteTimeEntryCommand(context: AgentCommandContext, input: DeleteTimeEntryCommandInput): Promise<DeleteTimeEntryResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const entryId = requireString(input.entryId, 'entryId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a time entry.', { entryId });
    }

    if (input.confirmationText !== entryId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match entryId to delete a time entry.', { entryId });
    }

    const archivedTaskMap = typeof context.store.loadArchivedTasks === 'function'
        ? await context.store.loadArchivedTasks()
        : context.store.archivedTasks;
    const existing = readValidatedEntity<TimeEntry>('timeEntries', context.store.activeTimeEntries.get(entryId), `agent delete time entry ${entryId}`);

    if (!existing) {
        throw new AgentCommandError('NOT_FOUND', 'Active time entry not found. Historical entries cannot be deleted by an agent in v1.', { entryId });
    }

    const task = readManualTimeEntryTask(context, archivedTaskMap, existing.taskId);
    try {
        assertManualTimeEntryDeletion(existing, task);
    } catch (error) {
        throwAgentTimeEntryError(error);
    }

    context.store.activeEntriesDoc.transact(() => {
        context.store.activeTimeEntries.delete(entryId);
    });

    markMeaningfulActivity('time_entry_delete');

    return {
        entryId,
        taskId: existing.taskId,
        start: existing.start,
        end: existing.end,
        durationMs: Math.max(0, existing.end - existing.start),
        deleted: true,
    };
}
