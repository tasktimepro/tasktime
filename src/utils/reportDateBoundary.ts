import { toStorageDate } from './dateUtils';

/**
 * Time entries are assigned wholly to the local calendar date of their start
 * timestamp. This preserves exact entry identity for billing and makes UI,
 * exports, and agent reports agree for entries that cross midnight.
 */
export function isTimestampStartWithinStoredDateRange(
    timestamp: number,
    startDate: string,
    endDate: string,
): boolean {
    if (!Number.isFinite(timestamp)) return false;

    const assignedDate = toStorageDate(timestamp);
    return Boolean(assignedDate && assignedDate >= startDate && assignedDate <= endDate);
}

export function isTimestampStartWithinRange(
    timestamp: number,
    rangeStart: number,
    rangeEnd: number,
): boolean {
    return Number.isFinite(timestamp) && timestamp >= rangeStart && timestamp <= rangeEnd;
}
