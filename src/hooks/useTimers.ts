/**
 * useTimers - React hook for multi-timer state
 * 
 * Provides reactive state and control functions for timers
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useMasterClock } from '@/hooks/useMasterClock';
import type { MultiTimerState, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';
import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { readEntity, objectToYMap, updateEntityFields } from '@/stores/yjs/entityUtils';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';
import {
    buildPausedTimer,
    buildResumedTimer,
    buildStartedTimer,
    buildUpdatedTimer,
    findStoppedTimerEntry,
    planStoppedTimer,
} from '@/domain/time/timerOperations';

export interface ActiveTimer extends MultiTimerState {
    elapsedTime: number;
    isPaused: boolean;
}

export interface UseTimersResult {
    /** All active timers sorted by lastActive desc */
    timers: ActiveTimer[];
    /** Check if project has an active timer */
    hasTimerForProject: (projectId: string) => boolean;
    /** Check if task has an active timer */
    isTaskTimerActive: (taskId: string) => boolean;
    /** Get timer for a specific project */
    getTimerForProject: (projectId: string) => ActiveTimer | null;
    /** Get timer for a specific task (uses taskId when no projectId) */
    getTimerForTask: (taskId: string, projectId?: string | null) => ActiveTimer | null;
    /** Start timer for a task */
    startTimer: (taskId: string, note?: string) => void;
    /** Pause a project's timer */
    pauseTimer: (projectId: string, pausedAt?: number) => void;
    /** Resume a project's timer */
    resumeTimer: (projectId: string) => void;
    /** Stop timer and create time entry */
    stopTimer: (projectId: string) => Promise<TimeEntry | null>;
    /** Clear timer without creating entry */
    clearTimer: (projectId: string) => void;
    /** Update timer properties */
    updateTimer: (projectId: string, updates: { startTime?: number; note?: string }) => void;
    /** Focus a timer (brings to top of stack) */
    focusTimer: (projectId: string) => void;
    /** Whether timer state is loading */
    isLoading: boolean;
}

export function useTimers(): UseTimersResult {
    const { store, isReady } = useYjs();

    const [timerStates, setTimerStates] = useState<MultiTimerState[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Use master clock for synchronized timing across all timer displays
    const hasRunningTimers = timerStates.some(timer => !timer.paused);
    const now = useMasterClock(hasRunningTimers);
    const elapsedNow = hasRunningTimers ? Math.max(now, Date.now()) : now;

    const syncTimerStates = useCallback(() => {
        if (!isReady) return;

        setTimerStates(collectValidatedEntities<MultiTimerState>('timers', store.timers as any, 'sync timers'));
        setIsLoading(false);
    }, [isReady, store]);

    useEffect(() => {
        if (!isReady) return;

        syncTimerStates();

        const handler = () => syncTimerStates();
        store.timers.observeDeep(handler);

        return () => store.timers.unobserveDeep(handler);
    }, [isReady, store, syncTimerStates]);

    // Timer elapsed time is now calculated using master clock (no individual interval needed)

    const timers = useMemo<ActiveTimer[]>(() => {
        return timerStates
            .map((timer) => {
                const elapsedTime = timer.paused
                    ? (timer.pausedElapsedTime || 0)
                    : Math.max(0, elapsedNow - timer.startTime);

                return {
                    ...timer,
                    elapsedTime,
                    isPaused: Boolean(timer.paused)
                };
            })
            .sort((a, b) => {
                const aTime = a.lastActive || a.startTime;
                const bTime = b.lastActive || b.startTime;
                return bTime - aTime;
            });
    }, [timerStates, elapsedNow]);

    const getTimerForProject = useCallback((projectId: string) => {
        return timers.find(timer => timer.projectId === projectId) || null;
    }, [timers]);

    const getTimerForTask = useCallback((taskId: string, projectId?: string | null) => {
        const key = projectId || taskId;
        return timers.find(timer => timer.projectId === key) || null;
    }, [timers]);

    const hasTimerForProject = useCallback((projectId: string) => {
        return timers.some(timer => timer.projectId === projectId);
    }, [timers]);

    const isTaskTimerActive = useCallback((taskId: string) => {
        return timers.some(timer => timer.taskId === taskId);
    }, [timers]);

    const startTimer = useCallback((taskId: string, note?: string) => {
        if (!isReady) return;

        const task = readEntity<{ id: string; projectId?: string }>(store.tasks.get(taskId));
        if (!task) return;

        const now = Date.now();
        const timerKey = task.projectId || task.id;
        if (store.timers.has(timerKey)) return;
        
        const timer = validateCollectionEntity<MultiTimerState>('timers', buildStartedTimer({
            task,
            timerInstanceId: generateId(),
            now,
            note,
        }), `start timer ${timerKey}`);

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap(timer as unknown as Record<string, unknown>);
            (store.timers as any).set(timerKey, entityMap);
        });

        markMeaningfulActivity('timer_start');
    }, [isReady, store]);

    const pauseTimer = useCallback((projectId: string, pausedAt?: number) => {
        if (!isReady) return;

        const timer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `pause timer ${projectId}`);
        if (!timer || timer.paused) return;

        const pauseTimestamp = typeof pausedAt === 'number' && Number.isFinite(pausedAt)
            ? pausedAt
            : Date.now();
        const paused = buildPausedTimer(timer, pauseTimestamp);

        store.coreDoc.transact(() => {
            updateEntityFields(store.timers as any, projectId, {
                paused: paused.paused,
                pausedElapsedTime: paused.pausedElapsedTime,
                lastActive: paused.lastActive,
            });
        });

        markMeaningfulActivity('timer_pause');
    }, [isReady, store]);

    const resumeTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        const timer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `resume timer ${projectId}`);
        if (!timer || !timer.paused) return;

        const now = Date.now();
        const resumed = buildResumedTimer(timer, now);

        store.coreDoc.transact(() => {
            updateEntityFields(store.timers as any, projectId, {
                startTime: resumed.startTime,
                paused: resumed.paused,
                pausedElapsedTime: resumed.pausedElapsedTime,
                lastActive: resumed.lastActive,
            });
        });

        markMeaningfulActivity('timer_resume');
    }, [isReady, store]);

    const stopTimer = useCallback(async (projectId: string): Promise<TimeEntry | null> => {
        if (!isReady) return null;

        const requestedTimer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `stop timer ${projectId}`) || null;
        if (!requestedTimer) return null;

        const entries = typeof store.loadAllTimeEntries === 'function'
            ? await store.loadAllTimeEntries()
            : (typeof store.getAllTimeEntries === 'function'
                ? store.getAllTimeEntries()
                : collectValidatedEntities<TimeEntry>('timeEntries', store.activeTimeEntries as any, 'stopped timer recovery'));
        const archivedTaskMap = typeof store.loadArchivedTasks === 'function'
            ? await store.loadArchivedTasks()
            : store.archivedTasks;
        const tasks = [
            ...collectValidatedEntities<Task>('tasks', store.tasks as any, 'stopped timer tasks'),
            ...(archivedTaskMap
                ? collectValidatedEntities<Task>('tasks', archivedTaskMap as any, 'stopped timer archived tasks')
                : []),
        ];
        const currentTimer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `finish stopping timer ${projectId}`) || null;

        if (!currentTimer) {
            const recoveredEntry = findStoppedTimerEntry({
                timerKey: projectId,
                timer: requestedTimer,
                entries,
            });

            return recoveredEntry;
        }

        if (currentTimer.timerInstanceId !== requestedTimer.timerInstanceId
            || currentTimer.taskId !== requestedTimer.taskId
            || currentTimer.startTime !== requestedTimer.startTime) {
            throw new Error('The active timer changed while it was being stopped. Please try again.');
        }

        const now = Date.now();
        const task = tasks.find((candidate) => candidate.id === currentTimer.taskId) || null;
        const project = task?.projectId
            ? readEntity<Project>(store.projects?.get(task.projectId))
            : null;
        const stopPlan = planStoppedTimer({
            timerKey: projectId,
            timer: currentTimer,
            entries,
            tasks,
            now,
            billingIncrementMinutes: project?.billableTimeIncrementMinutes,
        });
        const entry = validateCollectionEntity<TimeEntry>('timeEntries', stopPlan.entry, `stop timer entry ${projectId}`);

        if (!stopPlan.recovered) {
            store.activeEntriesDoc.transact(() => {
                const entryMap = objectToYMap(entry as unknown as Record<string, unknown>);
                (store.activeTimeEntries as any).set(entry.id, entryMap);
            });
        }

        store.coreDoc.transact(() => {
            const latestTimer = readEntity<MultiTimerState>(store.timers.get(projectId));
            const matchesStoppedInstance = latestTimer
                && latestTimer.taskId === currentTimer.taskId
                && latestTimer.startTime === currentTimer.startTime
                && latestTimer.timerInstanceId === currentTimer.timerInstanceId;

            if (matchesStoppedInstance) {
                store.timers.delete(projectId);
            }
        });

        markMeaningfulActivity('timer_stop');

        return entry;
    }, [isReady, store]);

    const clearTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        store.coreDoc.transact(() => {
            store.timers.delete(projectId);
        });

        markMeaningfulActivity('timer_clear');
    }, [isReady, store]);

    const updateTimer = useCallback((projectId: string, updates: { startTime?: number; note?: string }) => {
        if (!isReady) return;

        const timer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `update timer ${projectId}`);
        if (!timer) return;

        const updated = buildUpdatedTimer(timer, updates, Date.now());
        const fieldUpdates: Record<string, unknown> = { lastActive: updated.lastActive };
        if (updates.startTime !== undefined) fieldUpdates.startTime = updated.startTime;
        if (updates.note !== undefined) fieldUpdates.note = updated.note;

        store.coreDoc.transact(() => {
            updateEntityFields(store.timers as any, projectId, fieldUpdates);
        });

        markMeaningfulActivity('timer_update');
    }, [isReady, store]);

    const focusTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        const timer = readValidatedEntity<MultiTimerState>('timers', store.timers.get(projectId), `focus timer ${projectId}`);
        if (!timer) return;

        store.coreDoc.transact(() => {
            updateEntityFields(store.timers as any, projectId, {
                lastActive: Date.now(),
            });
        });
    }, [isReady, store]);

    return {
        timers,
        hasTimerForProject,
        isTaskTimerActive,
        getTimerForProject,
        getTimerForTask,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        clearTimer,
        updateTimer,
        focusTimer,
        isLoading,
    };
}
