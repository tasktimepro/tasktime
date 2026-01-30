/**
 * Recurring task utilities
 */

import { endOfMonth } from 'date-fns';
import type { RecurringConfig } from '@/stores/yjs/types';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Get ordinal suffix for a day number.
 * @param {number} day
 * @returns {string}
 */
export const getOrdinalSuffix = (day: number): string => {
    const mod10 = day % 10;
    const mod100 = day % 100;

    if (mod10 === 1 && mod100 !== 11) return 'st';
    if (mod10 === 2 && mod100 !== 12) return 'nd';
    if (mod10 === 3 && mod100 !== 13) return 'rd';
    return 'th';
};

/**
 * Format a recurring config into a human readable label.
 * @param {RecurringConfig | null | undefined} config
 * @returns {string}
 */
export const formatRecurringLabel = (config?: RecurringConfig | null): string => {
    if (!config) return '';

    if (config.type === 'weekly') {
        const sortedDays = (config.weeklyDays || [])
            .slice()
            .sort((a, b) => a - b);

        if (sortedDays.length === 7) {
            return 'Every day';
        }

        const days = sortedDays
            .map((day) => DAY_LABELS[day])
            .filter(Boolean);

        if (days.length === 0) {
            return 'Every week';
        }

        return `Every ${days.join(', ')}`;
    }

    if (config.type === 'monthly') {
        if (config.monthlyType === 'first') return 'Monthly (1st)';
        if (config.monthlyType === 'last') return 'Monthly (last)';

        const day = config.monthlyDay || 1;
        return `Monthly (${day}${getOrdinalSuffix(day)})`;
    }

    return '';
};

/**
 * Check if a recurring task should appear on the provided date.
 * @param {Date} date
 * @param {RecurringConfig | null | undefined} config
 * @returns {boolean}
 */
export const isRecurringTaskDueOnDate = (
    date: Date,
    config?: RecurringConfig | null
): boolean => {
    if (!config) return false;

    if (config.type === 'weekly') {
        const dayIndex = date.getDay();
        return (config.weeklyDays || []).includes(dayIndex);
    }

    if (config.type === 'monthly') {
        const dayOfMonth = date.getDate();

        if (config.monthlyType === 'first') {
            return dayOfMonth === 1;
        }

        if (config.monthlyType === 'last') {
            const lastDay = endOfMonth(date).getDate();
            return dayOfMonth === lastDay;
        }

        if (config.monthlyType === 'specific') {
            return dayOfMonth === (config.monthlyDay || 1);
        }
    }

    return false;
};
