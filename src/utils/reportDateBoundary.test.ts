import { describe, expect, it } from 'vitest';
import {
    isTimestampStartWithinRange,
    isTimestampStartWithinStoredDateRange,
} from './reportDateBoundary';

describe('report time-entry boundary assignment', () => {
    it('assigns a cross-midnight entry wholly to its local start date', () => {
        const entryStart = new Date(2026, 0, 31, 23, 30).getTime();

        expect(isTimestampStartWithinStoredDateRange(entryStart, '2026-01-01', '2026-01-31')).toBe(true);
        expect(isTimestampStartWithinStoredDateRange(entryStart, '2026-02-01', '2026-02-28')).toBe(false);
    });

    it('supports open stored-date boundaries', () => {
        const entryStart = new Date(2026, 0, 31, 12).getTime();

        expect(isTimestampStartWithinStoredDateRange(entryStart, '', '')).toBe(true);
        expect(isTimestampStartWithinStoredDateRange(entryStart, '2026-01-01', '')).toBe(true);
        expect(isTimestampStartWithinStoredDateRange(entryStart, '', '2026-01-31')).toBe(true);
        expect(isTimestampStartWithinStoredDateRange(entryStart, '2026-02-01', '')).toBe(false);
        expect(isTimestampStartWithinStoredDateRange(entryStart, '', '2026-01-30')).toBe(false);
        expect(isTimestampStartWithinStoredDateRange(0, '1970-01-01', '1970-01-01')).toBe(true);
    });

    it('uses the start timestamp only for timestamp ranges', () => {
        expect(isTimestampStartWithinRange(100, 100, 200)).toBe(true);
        expect(isTimestampStartWithinRange(99, 100, 200)).toBe(false);
    });
});
