/**
 * useTimeProgress - Hook for tracking time progress through the day
 * 
 * Returns a value from 0 to 1 representing how much of the day has passed
 */

import { useState, useEffect } from 'react';

/**
 * Calculate current progress through the day (0 to 1)
 */
function calculateProgress(): number {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    
    const totalMs = dayEnd.getTime() - dayStart.getTime();
    const elapsedMs = now.getTime() - dayStart.getTime();
    
    return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

/**
 * Hook that provides the current time progress through the day
 * 
 * @param updateIntervalMs - How often to update (default: 60000ms = 1 minute)
 * @returns Progress value from 0 (midnight) to 1 (end of day)
 */
export function useTimeProgress(updateIntervalMs: number = 60000): number {
    const [progress, setProgress] = useState(calculateProgress);

    useEffect(() => {
        // Update immediately
        setProgress(calculateProgress());

        // Then update on interval
        const interval = setInterval(() => {
            setProgress(calculateProgress());
        }, updateIntervalMs);

        return () => clearInterval(interval);
    }, [updateIntervalMs]);

    return progress;
}

/**
 * Generate a CSS gradient style for the time progress fill
 * 
 * @param progress - Progress value from 0 to 1
 * @param fillColor - Color for the filled portion (default: neutral with opacity)
 * @returns CSS background style object
 */
export function getProgressGradientStyle(
    progress: number,
    fillColor: string = 'rgba(0, 0, 0, 0.04)'
): { background: string } {
    const percentage = Math.round(progress * 100);
    
    return {
        background: `linear-gradient(to bottom, ${fillColor} ${percentage}%, transparent ${percentage}%)`,
    };
}
