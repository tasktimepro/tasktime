/**
 * useDayRollover - Provides a reliable "today" value that updates at midnight.
 * 
 * This hook schedules a timeout for the next local midnight and refreshes
 * on visibility/focus/online events to handle sleep or background tabs.
 */

import { useEffect, useMemo, useState } from 'react';
import { toStorageDate } from '@/utils/dateUtils';

/**
 * Calculate the delay until the next local midnight.
 */
function getMsUntilNextMidnight(now: Date): number {

    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);

    return Math.max(0, nextMidnight.getTime() - now.getTime());
}

/**
 * Hook that returns a Date object for "today" and updates at midnight.
 */
export function useTodayDate(): Date {

    const [today, setToday] = useState<Date>(() => new Date());

    useEffect(() => {

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const refreshToday = (): void => {

            setToday(new Date());
        };

        const scheduleNext = (): void => {

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const delay = getMsUntilNextMidnight(new Date());

            timeoutId = setTimeout(() => {

                refreshToday();
                scheduleNext();
            }, delay + 1000);
        };

        scheduleNext();

        const handleVisibility = (): void => {

            if (document.visibilityState === 'visible') {
                refreshToday();
                scheduleNext();
            }
        };

        window.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleVisibility);
        window.addEventListener('online', handleVisibility);

        return () => {

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            window.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleVisibility);
            window.removeEventListener('online', handleVisibility);
        };
    }, []);

    return today;
}

/**
 * Hook that returns today's date string (YYYY-MM-DD) and updates at midnight.
 */
export function useTodayString(): string | null {

    const today = useTodayDate();

    return useMemo(() => toStorageDate(today), [today]);
}
