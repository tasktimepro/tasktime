/**
 * useTimer - React hook for timer state
 * 
 * Provides reactive timer state and control functions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import type { TimerState, TimeEntry } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';

export interface UseTimerResult {
    /** Whether a timer is running or paused */
    isActive: boolean;
    /** Whether the timer is paused */
    isPaused: boolean;
    /** Task ID the timer is tracking */
    taskId: string | null;
    /** Current elapsed time in milliseconds */
    elapsedTime: number;
    /** Note attached to the timer */
    note: string;
    /** Timer start time */
    startTime: number | null;
    /** Whether timer state is loading */
    isLoading: boolean;
    
    // Actions
    /** Start timer for a task */
    startTimer: (taskId: string, note?: string) => void;
    /** Pause the running timer */
    pauseTimer: () => void;
    /** Resume a paused timer */
    resumeTimer: () => void;
    /** Stop timer and create time entry */
    stopTimer: () => TimeEntry | null;
    /** Update the timer note */
    setNote: (note: string) => void;
    /** Update timer properties (startTime, note) */
    updateTimer: (updates: { startTime?: number; note?: string }) => void;
    /** Clear timer without creating entry */
    clearTimer: () => void;
}

export function useTimer(): UseTimerResult {
    const { store, isReady } = useYjs();
    
    // Timer state
    const [timerState, setTimerState] = useState<TimerState>({});
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    // Interval ref for updating elapsed time
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync from Yjs
    const syncTimerState = useCallback(() => {
        if (!isReady) return;

        const state: TimerState = {
            taskId: store.timer.get('taskId') as string | null | undefined,
            startTime: store.timer.get('startTime') as number | null | undefined,
            paused: store.timer.get('paused') as boolean | undefined,
            pausedElapsedTime: store.timer.get('pausedElapsedTime') as number | undefined,
            note: store.timer.get('note') as string | undefined,
        };
        
        setTimerState(state);
        setIsLoading(false);
    }, [isReady, store]);

    // Initial load and subscribe
    useEffect(() => {
        if (!isReady) return;

        syncTimerState();

        const handler = () => syncTimerState();
        store.timer.observe(handler);

        return () => store.timer.unobserve(handler);
    }, [isReady, store, syncTimerState]);

    // Update elapsed time periodically
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!timerState.taskId) {
            setElapsedTime(0);
            return;
        }

        if (timerState.paused) {
            setElapsedTime(timerState.pausedElapsedTime || 0);
            return;
        }

        // Update elapsed time every second
        const updateElapsed = () => {
            if (timerState.startTime) {
                setElapsedTime(Date.now() - timerState.startTime);
            }
        };

        updateElapsed();
        intervalRef.current = setInterval(updateElapsed, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [timerState.taskId, timerState.paused, timerState.startTime, timerState.pausedElapsedTime]);

    // Actions
    const startTimer = useCallback((taskId: string, note?: string) => {
        if (!isReady) return;

        // Wrap in transaction to ensure single update event for sync
        store.coreDoc.transact(() => {
            store.timer.set('taskId', taskId);
            store.timer.set('startTime', Date.now());
            store.timer.set('paused', false);
            store.timer.set('pausedElapsedTime', 0);
            store.timer.set('note', note || '');
            store.timer.set('lastActive', Date.now());
        });
    }, [isReady, store]);

    const pauseTimer = useCallback(() => {
        if (!isReady || !timerState.taskId || timerState.paused) return;

        const elapsed = timerState.startTime 
            ? Date.now() - timerState.startTime 
            : 0;
        
        store.coreDoc.transact(() => {
            store.timer.set('paused', true);
            store.timer.set('pausedElapsedTime', elapsed);
        });
    }, [isReady, store, timerState.taskId, timerState.paused, timerState.startTime]);

    const resumeTimer = useCallback(() => {
        if (!isReady || !timerState.taskId || !timerState.paused) return;

        const pausedTime = timerState.pausedElapsedTime || 0;
        
        store.coreDoc.transact(() => {
            store.timer.set('startTime', Date.now() - pausedTime);
            store.timer.set('paused', false);
            store.timer.set('pausedElapsedTime', 0);
            store.timer.set('lastActive', Date.now());
        });
    }, [isReady, store, timerState.taskId, timerState.paused, timerState.pausedElapsedTime]);

    const stopTimer = useCallback((): TimeEntry | null => {
        if (!isReady || !timerState.taskId) return null;

        const now = Date.now();
        let endTime = now;
        let startTime: number;

        if (timerState.paused && timerState.pausedElapsedTime) {
            // Timer was paused - use the paused elapsed time
            startTime = now - timerState.pausedElapsedTime;
        } else if (timerState.startTime) {
            startTime = timerState.startTime;
        } else {
            return null;
        }

        // Create time entry
        const entry: TimeEntry = {
            id: generateId(),
            taskId: timerState.taskId,
            start: startTime,
            end: endTime,
            note: timerState.note,
        };

        // Save to active entries (in a transaction)
        store.activeEntriesDoc.transact(() => {
            store.activeTimeEntries.set(entry.id, entry);
        });

        // Clear timer (in a transaction)
        clearTimerInternal();

        return entry;
    }, [isReady, store, timerState]);

    const clearTimerInternal = useCallback(() => {
        store.coreDoc.transact(() => {
            store.timer.delete('taskId');
            store.timer.delete('startTime');
            store.timer.delete('paused');
            store.timer.delete('pausedElapsedTime');
            store.timer.delete('note');
            store.timer.delete('lastActive');
        });
    }, [store]);

    const clearTimer = useCallback(() => {
        if (!isReady) return;
        clearTimerInternal();
    }, [isReady, clearTimerInternal]);

    const setNote = useCallback((note: string) => {
        if (!isReady) return;
        store.coreDoc.transact(() => {
            store.timer.set('note', note);
        });
    }, [isReady, store]);

    /** Update timer start time and optionally note */
    const updateTimer = useCallback((updates: { startTime?: number; note?: string }) => {
        if (!isReady || !timerState.taskId) return;
        store.coreDoc.transact(() => {
            if (updates.startTime !== undefined) {
                store.timer.set('startTime', updates.startTime);
            }
            if (updates.note !== undefined) {
                store.timer.set('note', updates.note);
            }
            store.timer.set('lastActive', Date.now());
        });
    }, [isReady, store, timerState.taskId]);

    return {
        isActive: Boolean(timerState.taskId),
        isPaused: Boolean(timerState.paused),
        taskId: timerState.taskId ?? null,
        elapsedTime,
        note: timerState.note || '',
        startTime: timerState.startTime ?? null,
        isLoading,
        
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        setNote,
        updateTimer,
        clearTimer,
    };
}
