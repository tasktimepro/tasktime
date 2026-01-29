/**
 * useMasterClock - Provides synchronized time ticking for all timers
 * 
 * This hook ensures all timer displays update in perfect sync by providing
 * a single source of truth for the current time. All components using this
 * hook will see the same `now` value and update at the exact same moment.
 * 
 * Key features:
 * - Single interval shared across all consumers (via module-level state)
 * - Aligned to second boundaries for consistent display
 * - Pauses when no timers are active (no unnecessary ticking)
 */

import { useState, useEffect } from 'react';

// Module-level state for the master clock
let listeners: Set<() => void> = new Set();
let currentTick: number = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
let activeSubscribers = 0;

/**
 * Align to the next second boundary
 */
function getNextSecondDelay(): number {
    const now = Date.now();
    const msIntoCurrentSecond = now % 1000;
    // Wait until the start of the next second
    return 1000 - msIntoCurrentSecond;
}

/**
 * Start the master clock interval
 */
function startClock(): void {
    if (intervalId !== null) return;

    // Update immediately
    currentTick = Date.now();
    listeners.forEach(listener => listener());

    // Align to the next second boundary for the first tick
    const initialDelay = getNextSecondDelay();

    const scheduleNextTick = () => {
        intervalId = setTimeout(() => {
            currentTick = Date.now();
            listeners.forEach(listener => listener());
            
            // Schedule next tick aligned to second boundary
            scheduleNextTick();
        }, getNextSecondDelay());
    };

    // Wait for the next second boundary before starting regular ticks
    intervalId = setTimeout(() => {
        currentTick = Date.now();
        listeners.forEach(listener => listener());
        scheduleNextTick();
    }, initialDelay);
}

/**
 * Stop the master clock interval
 */
function stopClock(): void {
    if (intervalId !== null) {
        clearTimeout(intervalId);
        intervalId = null;
    }
}

/**
 * Subscribe to clock updates
 */
function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    activeSubscribers++;

    // Start the clock when first subscriber joins
    if (activeSubscribers === 1) {
        startClock();
    }

    return () => {
        listeners.delete(listener);
        activeSubscribers--;

        // Stop the clock when last subscriber leaves
        if (activeSubscribers === 0) {
            stopClock();
        }
    };
}

/**
 * Get current snapshot of the clock
 */
function getSnapshot(): number {
    return currentTick;
}

/**
 * Hook to get synchronized time for timer displays
 * 
 * @param enabled - Whether this consumer needs clock updates (default: true)
 * @returns Current timestamp, updated every second in sync with all other consumers
 * 
 * @example
 * const now = useMasterClock();
 * const elapsed = now - timer.startTime;
 */
export function useMasterClock(enabled: boolean = true): number {
    const [now, setNow] = useState<number>(() => (enabled ? getSnapshot() : Date.now()));

    useEffect(() => {
        if (!enabled) {
            setNow(Date.now());
            return undefined;
        }

        const handleTick = () => setNow(getSnapshot());
        const unsubscribe = subscribe(handleTick);

        // Sync immediately on subscribe
        handleTick();

        return unsubscribe;
    }, [enabled]);

    return now;
}

/**
 * Calculate elapsed time for a timer using the master clock
 * 
 * @param startTime - Timer start timestamp
 * @param isPaused - Whether the timer is paused
 * @param pausedElapsedTime - Elapsed time when paused (in ms)
 * @returns Elapsed time in milliseconds
 */
export function useTimerElapsed(
    startTime: number | null,
    isPaused: boolean,
    pausedElapsedTime: number = 0
): number {
    // Only tick when timer is running (not paused)
    const now = useMasterClock(!isPaused && startTime !== null);

    if (!startTime) return 0;
    
    if (isPaused) {
        return pausedElapsedTime;
    }

    return Math.max(0, now - startTime);
}

export default useMasterClock;
