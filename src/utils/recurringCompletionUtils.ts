/**
 * Recurring completion utilities
 */

export type RecurringCompletionMap = Record<string, Record<string, number[]>>;

/**
 * Convert YYYY-MM-DD to year/month/day parts.
 * @param {string} dateStr
 */
export const getCompletionParts = (dateStr: string): { yearKey: string; monthKey: string; day: number } => {
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (!year || !month || !day) {
        return { yearKey: '0', monthKey: '0', day: 0 };
    }

    return {
        yearKey: String(year),
        monthKey: String(month),
        day,
    };
};

/**
 * Check if a recurring completion map includes a date.
 * @param {RecurringCompletionMap | undefined | null} map
 * @param {string} dateStr
 */
export const isRecurringCompletedOnDate = (
    map: RecurringCompletionMap | undefined | null,
    dateStr: string
): boolean => {
    if (!map) return false;
    const { yearKey, monthKey, day } = getCompletionParts(dateStr);
    if (!yearKey || !monthKey || !day) return false;
    return (map[yearKey]?.[monthKey] || []).includes(day);
};

/**
 * Toggle completion date in the map.
 * @param {RecurringCompletionMap | undefined | null} map
 * @param {string} dateStr
 * @returns {RecurringCompletionMap}
 */
export const toggleRecurringCompletionDate = (
    map: RecurringCompletionMap | undefined | null,
    dateStr: string
): RecurringCompletionMap => {
    const { yearKey, monthKey, day } = getCompletionParts(dateStr);
    const safeMap: RecurringCompletionMap = map ? { ...map } : {};

    const yearBucket = safeMap[yearKey] ? { ...safeMap[yearKey] } : {};
    const monthDays = (yearBucket[monthKey] || []).slice();

    const index = monthDays.indexOf(day);
    if (index >= 0) {
        monthDays.splice(index, 1);
    } else {
        monthDays.push(day);
        monthDays.sort((a, b) => a - b);
    }

    if (monthDays.length === 0) {
        delete yearBucket[monthKey];
    } else {
        yearBucket[monthKey] = monthDays;
    }

    if (Object.keys(yearBucket).length === 0) {
        delete safeMap[yearKey];
    } else {
        safeMap[yearKey] = yearBucket;
    }

    return safeMap;
};
