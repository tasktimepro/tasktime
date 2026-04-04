/**
 * useTimers - React hook for multi-timer state
 * 
 * Provides reactive state and control functions for timers
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useMasterClock } from '@/hooks/useMasterClock';
import type { MultiTimerState, TimeEntry } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';
import { readEntity, objectToYMap, collectEntities } from '@/stores/yjs/entityUtils';

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
    pauseTimer: (projectId: string) => void;
    /** Resume a project's timer */
    resumeTimer: (projectId: string) => void;
    /** Stop timer and create time entry */
    stopTimer: (projectId: string) => TimeEntry | null;
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

    const syncTimerStates = useCallback(() => {
        if (!isReady) return;

        setTimerStates(collectEntities<MultiTimerState>(store.timers as any));
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
                    : Math.max(0, now - timer.startTime);

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
    }, [timerStates, now]);

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

        const timerKey = task.projectId || task.id;

        const now = Date.now();
        // Align start time to the next second boundary
        // This ensures all timers tick in sync with real-world clock seconds
        // e.g., if now is 14:30:15.432, startTime becomes 14:30:16.000
        const alignedStartTime = Math.ceil(now / 1000) * 1000;
        
        const timer: MultiTimerState = {
            projectId: timerKey,
            taskId,
            startTime: alignedStartTime,
            paused: false,
            pausedElapsedTime: 0,
            note: note || '',
            lastActive: now,
        };

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap(timer as unknown as Record<string, unknown>);
            (store.timers as any).set(timerKey, entityMap);
        });
    }, [isReady, store]);

    const pauseTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        const timer = readEntity<MultiTimerState>(store.timers.get(projectId));
        if (!timer || timer.paused) return;

        const elapsed = Date.now() - timer.startTime;

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap({
                ...timer,
                paused: true,
                pausedElapsedTime: elapsed,
                lastActive: Date.now(),
            } as unknown as Record<string, unknown>);
            (store.timers as any).set(projectId, entityMap);
        });
    }, [isReady, store]);

    const resumeTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        const timer = readEntity<MultiTimerState>(store.timers.get(projectId));
        if (!timer || !timer.paused) return;

        const pausedTime = timer.pausedElapsedTime || 0;
        const now = Date.now();
        
        // Align resume to next second boundary for consistent ticking
        // Calculate the fractional part of the paused time
        const pausedSeconds = Math.floor(pausedTime / 1000);
        const alignedNow = Math.ceil(now / 1000) * 1000;
        // Set startTime so that at alignedNow, elapsed = pausedSeconds * 1000
        const alignedStartTime = alignedNow - (pausedSeconds * 1000);

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap({
                ...timer,
                startTime: alignedStartTime,
                paused: false,
                pausedElapsedTime: 0,
                lastActive: now,
            } as unknown as Record<string, unknown>);
            (store.timers as any).set(projectId, entityMap);
        });
    }, [isReady, store]);

    const stopTimer = useCallback((projectId: string): TimeEntry | null => {
        if (!isReady) return null;

        const timer = readEntity<MultiTimerState>(store.timers.get(projectId));
        if (!timer) return null;

        const now = Date.now();
        const startTime = timer.paused
            ? (now - (timer.pausedElapsedTime || 0))
            : timer.startTime;

        const entry: TimeEntry = {
            id: generateId(),
            taskId: timer.taskId,
            start: startTime,
            end: now,
            note: timer.note,
        };

        store.activeEntriesDoc.transact(() => {
            const entryMap = objectToYMap(entry as unknown as Record<string, unknown>);
            (store.activeTimeEntries as any).set(entry.id, entryMap);
        });

        store.coreDoc.transact(() => {
            store.timers.delete(projectId);
        });

        return entry;
    }, [isReady, store]);

    const clearTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        store.coreDoc.transact(() => {
            store.timers.delete(projectId);
        });
    }, [isReady, store]);

    const updateTimer = useCallback((projectId: string, updates: { startTime?: number; note?: string }) => {
        if (!isReady) return;

        const timer = readEntity<MultiTimerState>(store.timers.get(projectId));
        if (!timer) return;

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap({
                ...timer,
                startTime: updates.startTime !== undefined ? updates.startTime : timer.startTime,
                note: updates.note !== undefined ? updates.note : timer.note,
                lastActive: Date.now(),
            } as unknown as Record<string, unknown>);
            (store.timers as any).set(projectId, entityMap);
        });
    }, [isReady, store]);

    const focusTimer = useCallback((projectId: string) => {
        if (!isReady) return;

        const timer = readEntity<MultiTimerState>(store.timers.get(projectId));
        if (!timer) return;

        store.coreDoc.transact(() => {
            const entityMap = objectToYMap({
                ...timer,
                lastActive: Date.now(),
            } as unknown as Record<string, unknown>);
            (store.timers as any).set(projectId, entityMap);
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
