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

/**
 * Get date range for today
 * @returns {Object} Object with start and end timestamps
 */
export const getTodayRange = () => {
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
export const getThisWeekRange = () => {
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
export const getThisMonthRange = () => {
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
export const getLastMonthRange = () => {
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
export const getThisYearRange = () => {
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
export const formatDuration = (milliseconds) => {
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
export const formatDurationWithSeconds = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    const parts = [];
    
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
export const formatActiveTimer = (startTime) => {
    const now = Date.now();
    const elapsed = now - startTime;
    return formatDurationWithSeconds(elapsed);
};

/**
 * Convert milliseconds to decimal hours
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {number} Duration in decimal hours
 */
export const millisecondsToHours = (milliseconds) => {
    return milliseconds / (1000 * 60 * 60);
};

/**
 * Convert decimal hours to total minutes
 * @param {number} hours - Duration in decimal hours
 * @returns {number} Duration in total minutes
 */
export const hoursToMinutes = (hours) => {
    return Math.round(hours * 60);
};
