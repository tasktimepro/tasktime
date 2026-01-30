import { describe, it, expect } from 'vitest';
import { endOfMonth } from 'date-fns';
import { getOrdinalSuffix, formatRecurringLabel, isRecurringTaskDueOnDate } from './recurringUtils';

describe('recurringUtils', () => {

    describe('getOrdinalSuffix', () => {

        it('handles typical suffixes', () => {

            expect(getOrdinalSuffix(1)).toBe('st');
            expect(getOrdinalSuffix(2)).toBe('nd');
            expect(getOrdinalSuffix(3)).toBe('rd');
            expect(getOrdinalSuffix(4)).toBe('th');
        });

        it('handles teen exceptions', () => {

            expect(getOrdinalSuffix(11)).toBe('th');
            expect(getOrdinalSuffix(12)).toBe('th');
            expect(getOrdinalSuffix(13)).toBe('th');
        });
    });

    describe('formatRecurringLabel', () => {

        it('returns empty string for missing config', () => {

            expect(formatRecurringLabel(null)).toBe('');
            expect(formatRecurringLabel(undefined)).toBe('');
        });

        it('formats weekly configs', () => {

            expect(formatRecurringLabel({ type: 'weekly', weeklyDays: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
            expect(formatRecurringLabel({ type: 'weekly', weeklyDays: [] })).toBe('Every week');
            expect(formatRecurringLabel({ type: 'weekly', weeklyDays: [1, 3, 5] })).toBe('Every Mo, We, Fr');
        });

        it('formats monthly configs', () => {

            expect(formatRecurringLabel({ type: 'monthly', monthlyType: 'first' })).toBe('Monthly (1st)');
            expect(formatRecurringLabel({ type: 'monthly', monthlyType: 'last' })).toBe('Monthly (last)');
            expect(formatRecurringLabel({ type: 'monthly', monthlyType: 'specific', monthlyDay: 22 })).toBe('Monthly (22nd)');
        });

        it('returns empty string for unknown type', () => {

            expect(formatRecurringLabel({ type: 'unknown' })).toBe('');
        });
    });

    describe('isRecurringTaskDueOnDate', () => {

        it('returns false for missing config', () => {

            expect(isRecurringTaskDueOnDate(new Date(), null)).toBe(false);
            expect(isRecurringTaskDueOnDate(new Date(), undefined)).toBe(false);
        });

        it('checks weekly schedules', () => {

            const monday = new Date('2025-01-06T00:00:00Z');
            expect(isRecurringTaskDueOnDate(monday, { type: 'weekly', weeklyDays: [1, 3] })).toBe(true);
            expect(isRecurringTaskDueOnDate(monday, { type: 'weekly', weeklyDays: [2, 4] })).toBe(false);
        });

        it('checks monthly schedules', () => {

            const firstDay = new Date('2025-02-01T00:00:00Z');
            const lastDay = endOfMonth(firstDay);

            expect(isRecurringTaskDueOnDate(firstDay, { type: 'monthly', monthlyType: 'first' })).toBe(true);
            expect(isRecurringTaskDueOnDate(firstDay, { type: 'monthly', monthlyType: 'last' })).toBe(false);
            expect(isRecurringTaskDueOnDate(lastDay, { type: 'monthly', monthlyType: 'last' })).toBe(true);
            expect(isRecurringTaskDueOnDate(new Date('2025-02-14T00:00:00Z'), { type: 'monthly', monthlyType: 'specific', monthlyDay: 14 })).toBe(true);
            expect(isRecurringTaskDueOnDate(new Date('2025-02-14T00:00:00Z'), { type: 'monthly', monthlyType: 'specific', monthlyDay: 15 })).toBe(false);
        });

        it('returns false for unknown type', () => {

            expect(isRecurringTaskDueOnDate(new Date('2025-01-06T00:00:00Z'), { type: 'unknown' })).toBe(false);
        });
    });
});
