import { describe, it, expect } from 'vitest';
import {
    getCompletionParts,
    isRecurringCompletedOnDate,
    toggleRecurringCompletionDate
} from './recurringCompletionUtils';

describe('recurringCompletionUtils', () => {

    it('parses valid date parts', () => {
        expect(getCompletionParts('2026-02-01')).toEqual({
            yearKey: '2026',
            monthKey: '2',
            day: 1
        });
    });

    it('returns zeros for invalid date strings', () => {
        expect(getCompletionParts('invalid')).toEqual({
            yearKey: '0',
            monthKey: '0',
            day: 0
        });
    });

    it('checks completion in the map', () => {
        const map = { '2026': { '2': [1, 3] } };
        expect(isRecurringCompletedOnDate(map, '2026-02-01')).toBe(true);
        expect(isRecurringCompletedOnDate(map, '2026-02-02')).toBe(false);
        expect(isRecurringCompletedOnDate(null, '2026-02-01')).toBe(false);
    });

    it('toggles completion dates and cleans empty buckets', () => {
        const initial = { '2026': { '2': [1] } };
        const added = toggleRecurringCompletionDate(initial, '2026-02-03');
        expect(added).toEqual({ '2026': { '2': [1, 3] } });

        const removed = toggleRecurringCompletionDate(added, '2026-02-01');
        expect(removed).toEqual({ '2026': { '2': [3] } });

        const cleaned = toggleRecurringCompletionDate(removed, '2026-02-03');
        expect(cleaned).toEqual({});
    });
});
