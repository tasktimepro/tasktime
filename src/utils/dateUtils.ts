import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subMonths
} from 'date-fns';

type DateRange = {
    start: number;
    end: number;
};

/**
 * Get date range for today
 * @returns {Object} Object with start and end timestamps
 */
export const getTodayRange = (): DateRange => {
    const now = new Date();

    return {
        start: startOfDay(now).getTime(),
        end: endOfDay(now).getTime()
    };
};

/**
 * Get date range for current week
 * @returns {Object} Object with start and end timestamps
 */
export const getThisWeekRange = (): DateRange => {
    const now = new Date();

    return {
        start: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        end: endOfWeek(now, { weekStartsOn: 1 }).getTime()
    };
};

/**
 * Get date range for current month
 * @returns {Object} Object with start and end timestamps
 */
export const getThisMonthRange = (): DateRange => {
    const now = new Date();

    return {
        start: startOfMonth(now).getTime(),
        end: endOfMonth(now).getTime()
    };
};

/**
 * Get date range for last month
 * @returns {Object} Object with start and end timestamps
 */
export const getLastMonthRange = (): DateRange => {
    const lastMonth = subMonths(new Date(), 1);

    return {
        start: startOfMonth(lastMonth).getTime(),
        end: endOfMonth(lastMonth).getTime()
    };
};

/**
 * Get date range for current year
 * @returns {Object} Object with start and end timestamps
 */
export const getThisYearRange = (): DateRange => {
    const now = new Date();

    return {
        start: startOfYear(now).getTime(),
        end: endOfYear(now).getTime()
    };
};

/**
 * Format milliseconds to hours and minutes
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted time string (e.g., "2h 30m")
 */
export const formatDuration = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));

    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0 && minutes === 0) {
        return '0m';
    }

    if (hours === 0) {
        return `${minutes}m`;
    }

    if (minutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
};

/**
 * Format milliseconds to hours, minutes, and seconds
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted time string (e.g., "2h 30m 45s")
 */
export const formatDurationWithSeconds = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    const parts: string[] = [];

    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
};

/**
 * Format current timer duration in real-time (for active timers)
 * @param {number} startTime - Timer start timestamp
 * @returns {string} Formatted duration string
 */
export const formatActiveTimer = (timeValue: number): string => {
    // If the time value is very large (a timestamp), assume it's a start time
    // Otherwise, assume it's already the elapsed milliseconds
    const elapsed = timeValue > 1000000000000
        ? Date.now() - timeValue // It's a timestamp, calculate elapsed time
        : timeValue;             // It's already elapsed milliseconds
    return formatDurationWithSeconds(elapsed);
};

/**
 * Convert milliseconds to decimal hours
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {number} Duration in decimal hours
 */
export const millisecondsToHours = (milliseconds: number): number => {
    return milliseconds / (1000 * 60 * 60);
};

/**
 * Convert decimal hours to total minutes
 * @param {number} hours - Duration in decimal hours
 * @returns {number} Duration in total minutes
 */
export const hoursToMinutes = (hours: number): number => {
    return Math.round(hours * 60);
};

/**
 * Get today's date as a YYYY-MM-DD string for form inputs
 * Uses local time to avoid timezone issues with date inputs
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayString = (): string | null => {
    return toStorageDate(new Date());
};

/**
 * Get current time as HH:MM:SS string for time inputs
 * @returns {string} Current time in HH:MM:SS format
 */
export const getCurrentTimeString = (): string => {
    return new Date().toTimeString().slice(0, 8);
};

/**
 * Convert a timestamp to a date string for form inputs (YYYY-MM-DD)
 * Uses local time to avoid timezone issues
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Date in YYYY-MM-DD format
 */
export const timestampToDateString = (timestamp: number): string | null => {
    return toStorageDate(new Date(timestamp));
};

/**
 * Convert a timestamp to a time string for form inputs (HH:MM:SS)
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Time in HH:MM:SS format
 */
export const timestampToTimeString = (timestamp: number): string => {
    return new Date(timestamp).toTimeString().slice(0, 8);
};

/**
 * Format a date for storage (YYYY-MM-DD format - portable across locales)
 * Uses LOCAL date to avoid timezone shifting issues
 * Use this when STORING dates to IndexedDB or state
 * @param {Date|number|string} date - Date object, timestamp, or date string
 * @returns {string} Date string (YYYY-MM-DD) or null if invalid
 */
export const toStorageDate = (date: Date | number | string | null | undefined): string | null => {
    if (!date) return null;

    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;

    // Use LOCAL date components to avoid timezone shifting
    // e.g., Jan 15 at 10pm PST should store as "2026-01-15", not "2026-01-16" (UTC)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Format a date for display (locale-aware)
 * Use this when DISPLAYING dates to users
 * @param {Date|number|string} date - Date object, timestamp, or ISO date string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Locale-formatted date string
 */
export const toDisplayDate = (
    date: Date | number | string | null | undefined,
    options: Intl.DateTimeFormatOptions = {}
): string => {
    if (!date) return '';

    // If it's a YYYY-MM-DD string, parse it as local time to avoid timezone shift
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        const d = new Date(year, month - 1, day); // Local time
        return d.toLocaleDateString(undefined, options);
    }

    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString(undefined, options);
};

/**
 * Parse a stored date string back to a Date object
 * Handles YYYY-MM-DD format as LOCAL time (not UTC) to avoid timezone issues
 * Also handles legacy locale-dependent formats with fallback
 * @param {string|number} dateValue - ISO date string, locale string, or timestamp
 * @param {number} fallbackTimestamp - Fallback timestamp if parsing fails
 * @returns {Date|null} Parsed Date object or null if invalid
 */
export const parseStoredDate = (
    dateValue: string | number | null | undefined,
    fallbackTimestamp: number | null = null
): Date | null => {
    if (!dateValue) {
        return fallbackTimestamp ? new Date(fallbackTimestamp) : null;
    }

    // If it's already a timestamp, convert directly
    if (typeof dateValue === 'number') {
        return new Date(dateValue);
    }

    // If it's a YYYY-MM-DD string, parse as LOCAL time to avoid timezone shift
    // This prevents "2026-01-15" from becoming Jan 14 in western timezones
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [year, month, day] = dateValue.split('-').map(Number);
        return new Date(year, month - 1, day); // Local time, not UTC
    }

    // Try parsing other string formats
    const parsed = new Date(dateValue);

    // If parsing succeeded, return the date
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    // If parsing failed and we have a fallback, use it
    if (fallbackTimestamp) {
        return new Date(fallbackTimestamp);
    }

    return null;
};
