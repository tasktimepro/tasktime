import { toStorageDate } from './dateUtils';

/**
 * Time entries are assigned wholly to the local calendar date of their start
 * timestamp. This preserves exact entry identity for billing and makes UI,
 * exports, and agent reports agree for entries that cross midnight.
 */
export function isTimestampStartWithinStoredDateRange(
    timestamp: number,
    startDate = '',
    endDate = '',
): boolean {
    if (!Number.isFinite(timestamp)) return false;
    if (!startDate && !endDate) return true;

    const assignedDate = toStorageDate(new Date(timestamp));
    if (!assignedDate) return false;

    if (startDate && assignedDate < startDate) return false;
    if (endDate && assignedDate > endDate) return false;

    return true;
}

export function isTimestampStartWithinRange(
    timestamp: number,
    rangeStart: number,
    rangeEnd: number,
): boolean {
    return Number.isFinite(timestamp) && timestamp >= rangeStart && timestamp <= rangeEnd;
}
