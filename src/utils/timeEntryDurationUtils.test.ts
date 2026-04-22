import { describe, expect, it } from 'vitest';
import {
    buildBillableDurationFields,
    getActualDurationMs,
    getBillableDurationMs,
    hasBillableDurationOverride,
    roundDurationUpToIncrement,
} from './timeEntryDurationUtils';

describe('timeEntryDurationUtils', () => {
    it('returns actual duration from timestamps', () => {
        expect(getActualDurationMs({ start: 1000, end: 4000 })).toBe(3000);
    });

    it('falls back to actual duration when no billed override exists', () => {
        expect(getBillableDurationMs({ start: 1000, end: 4000 })).toBe(3000);
    });

    it('uses billed duration when present', () => {
        expect(getBillableDurationMs({ start: 1000, end: 4000, billedDurationMs: 9000 })).toBe(9000);
    });

    it('uses the stored billing increment when explicit billed duration is absent', () => {
        expect(getBillableDurationMs({ start: 1000, end: 61000, billingIncrementMinutes: 15 })).toBe(15 * 60 * 1000);
    });

    it('detects billed duration overrides', () => {
        expect(hasBillableDurationOverride({ start: 1000, end: 4000, billedDurationMs: 9000 })).toBe(true);
        expect(hasBillableDurationOverride({ start: 1000, end: 4000 })).toBe(false);
    });

    it('rounds durations up to the next configured increment', () => {
        expect(roundDurationUpToIncrement(10 * 1000, 1)).toBe(60 * 1000);
        expect(roundDurationUpToIncrement(16 * 60 * 1000, 15)).toBe(30 * 60 * 1000);
        expect(roundDurationUpToIncrement(30 * 60 * 1000, 15)).toBe(30 * 60 * 1000);
    });

    it('builds persisted billable duration fields from a billing increment', () => {
        expect(buildBillableDurationFields({
            start: 0,
            end: 5 * 60 * 1000,
            billingIncrementMinutes: 15,
        })).toEqual({
            billedDurationMs: 15 * 60 * 1000,
            billingIncrementMinutes: 15,
        });
    });
});