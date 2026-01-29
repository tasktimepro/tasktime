/**
 * Timer state helpers
 * 
 * Provides operations for multi-timer state (one timer per project)
 */

import * as Y from 'yjs';
import type { MultiTimerState } from '../types';

export interface TimerHelpers {

    /**
     * Get current timer state
     */
    get(projectId: string): MultiTimerState | null;

    /**
     * Get all timers
     */
    getAll(): MultiTimerState[];

    /**
     * Check if timer is running
     */
    isRunning(projectId: string): boolean;

    /**
     * Check if timer is paused
     */
    isPaused(projectId: string): boolean;

    /**
     * Start timer for a task
     */
    start(projectId: string, taskId: string, note?: string): void;

    /**
     * Pause the timer
     */
    pause(projectId: string): void;

    /**
     * Resume a paused timer
     */
    resume(projectId: string): void;

    /**
     * Stop and clear the timer (returns final state for creating time entry)
     */
    stop(projectId: string): MultiTimerState | null;

    /**
     * Update the timer note
     */
    setNote(projectId: string, note: string): void;

    /**
     * Touch last active timestamp (heartbeat)
     */
    touch(projectId: string): void;

    /**
     * Get elapsed time in milliseconds
     */
    getElapsedMs(projectId: string): number;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create timer helpers for a Y.Map
 */
export function createTimerHelpers(timers: Y.Map<string, MultiTimerState>): TimerHelpers {

    return {

        get(projectId: string): MultiTimerState | null {
            const timer = timers.get(projectId);
            return timer || null;
        },

        getAll(): MultiTimerState[] {
            const results: MultiTimerState[] = [];
            timers.forEach((value) => {
                if (value) {
                    results.push(value);
                }
            });
            return results;
        },

        isRunning(projectId: string): boolean {
            const timer = timers.get(projectId);
            return !!timer && !timer.paused;
        },

        isPaused(projectId: string): boolean {
            const timer = timers.get(projectId);
            return !!timer && !!timer.paused;
        },

        start(projectId: string, taskId: string, note?: string): void {
            const now = Date.now();
            timers.set(projectId, {
                projectId,
                taskId,
                startTime: now,
                paused: false,
                pausedElapsedTime: 0,
                note: note || '',
                lastActive: now,
            });
        },

        pause(projectId: string): void {
            const timer = timers.get(projectId);
            if (!timer || timer.paused) return;

            const elapsed = Date.now() - timer.startTime;
            timers.set(projectId, {
                ...timer,
                paused: true,
                pausedElapsedTime: elapsed,
                lastActive: Date.now(),
            });
        },

        resume(projectId: string): void {
            const timer = timers.get(projectId);
            if (!timer || !timer.paused) return;

            const pausedElapsed = timer.pausedElapsedTime || 0;
            const now = Date.now();
            timers.set(projectId, {
                ...timer,
                startTime: now - pausedElapsed,
                paused: false,
                pausedElapsedTime: 0,
                lastActive: now,
            });
        },

        stop(projectId: string): MultiTimerState | null {
            const timer = timers.get(projectId);
            if (!timer) return null;

            timers.delete(projectId);
            return timer;
        },

        setNote(projectId: string, note: string): void {
            const timer = timers.get(projectId);
            if (!timer) return;
            timers.set(projectId, {
                ...timer,
                note,
                lastActive: Date.now(),
            });
        },

        touch(projectId: string): void {
            const timer = timers.get(projectId);
            if (!timer) return;
            timers.set(projectId, {
                ...timer,
                lastActive: Date.now(),
            });
        },

        getElapsedMs(projectId: string): number {
            const timer = timers.get(projectId);
            if (!timer) return 0;

            if (timer.paused) {
                return timer.pausedElapsedTime || 0;
            }

            return Date.now() - timer.startTime;
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            timers.observe(handler);
            return () => timers.unobserve(handler);
        },
    };
}
