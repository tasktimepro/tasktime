/**
 * Timer state helpers
 * 
 * Provides operations for the global timer state
 */

import * as Y from 'yjs';
import type { TimerState } from '../types';

export interface TimerHelpers {

    /**
     * Get current timer state
     */
    get(): TimerState;

    /**
     * Check if timer is running
     */
    isRunning(): boolean;

    /**
     * Check if timer is paused
     */
    isPaused(): boolean;

    /**
     * Start timer for a task
     */
    start(taskId: string, note?: string): void;

    /**
     * Pause the timer
     */
    pause(): void;

    /**
     * Resume a paused timer
     */
    resume(): void;

    /**
     * Stop and clear the timer (returns final state for creating time entry)
     */
    stop(): TimerState | null;

    /**
     * Update the timer note
     */
    setNote(note: string): void;

    /**
     * Touch last active timestamp (heartbeat)
     */
    touch(): void;

    /**
     * Get elapsed time in milliseconds
     */
    getElapsedMs(): number;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create timer helpers for a Y.Map
 */
export function createTimerHelpers(timer: Y.Map<string, TimerState[keyof TimerState]>): TimerHelpers {

    return {

        get(): TimerState {
            return {
                taskId: timer.get('taskId') as string | null | undefined,
                startTime: timer.get('startTime') as number | null | undefined,
                paused: timer.get('paused') as boolean | undefined,
                pausedElapsedTime: timer.get('pausedElapsedTime') as number | undefined,
                note: timer.get('note') as string | undefined,
                lastActive: timer.get('lastActive') as number | null | undefined,
            };
        },

        isRunning(): boolean {
            const taskId = timer.get('taskId');
            const paused = timer.get('paused');
            return !!taskId && !paused;
        },

        isPaused(): boolean {
            const taskId = timer.get('taskId');
            const paused = timer.get('paused');
            return !!taskId && !!paused;
        },

        start(taskId: string, note?: string): void {
            timer.set('taskId', taskId);
            timer.set('startTime', Date.now());
            timer.set('paused', false);
            timer.set('pausedElapsedTime', 0);
            timer.set('note', note || '');
            timer.set('lastActive', Date.now());
        },

        pause(): void {
            const taskId = timer.get('taskId');
            if (!taskId) return;

            const startTime = timer.get('startTime') as number | undefined;
            const pausedElapsedTime = timer.get('pausedElapsedTime') as number | undefined;
            
            const elapsed = (pausedElapsedTime || 0) + (Date.now() - (startTime || Date.now()));
            
            timer.set('paused', true);
            timer.set('pausedElapsedTime', elapsed);
            timer.set('lastActive', Date.now());
        },

        resume(): void {
            const taskId = timer.get('taskId');
            if (!taskId) return;

            timer.set('startTime', Date.now());
            timer.set('paused', false);
            timer.set('lastActive', Date.now());
        },

        stop(): TimerState | null {
            const state = this.get();
            if (!state.taskId) return null;

            // Clear timer
            timer.delete('taskId');
            timer.delete('startTime');
            timer.delete('paused');
            timer.delete('pausedElapsedTime');
            timer.delete('note');
            timer.delete('lastActive');

            return state;
        },

        setNote(note: string): void {
            timer.set('note', note);
        },

        touch(): void {
            timer.set('lastActive', Date.now());
        },

        getElapsedMs(): number {
            const state = this.get();
            if (!state.taskId) return 0;

            if (state.paused) {
                return state.pausedElapsedTime || 0;
            }

            const startTime = state.startTime || Date.now();
            const pausedElapsed = state.pausedElapsedTime || 0;
            return pausedElapsed + (Date.now() - startTime);
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            timer.observe(handler);
            return () => timer.unobserve(handler);
        },
    };
}
