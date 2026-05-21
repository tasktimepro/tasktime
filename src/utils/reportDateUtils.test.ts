import { describe, expect, it } from 'vitest';
import {
    getDateRangeLabel,
    getDefaultCustomRange,
    getDefaultReportPeriod,
    resolveReportDateRange,
} from './reportDateUtils';

describe('reportDateUtils', () => {
    it.each([
        ['this-month', '2026-05-01', '2026-05-31'],
        ['this-quarter', '2026-04-01', '2026-06-30'],
        ['last-quarter', '2026-01-01', '2026-03-31'],
        ['this-year', '2026-01-01', '2026-12-31'],
        ['last-year', '2025-01-01', '2025-12-31'],
    ])('resolves %s from the reference date', (period, startDate, endDate) => {
        expect(resolveReportDateRange({
            period,
            referenceDate: new Date('2026-05-20T10:00:00Z'),
        })).toMatchObject({
            startDate,
            endDate,
        });
    });

    it('defaults reports to last month', () => {
        expect(getDefaultReportPeriod()).toBe('last-month');
    });

    it('builds a month-based default custom range from the reference date', () => {
        expect(getDefaultCustomRange(new Date('2026-05-20T10:00:00Z'))).toEqual({
            customStart: '2026-05-01',
            customEnd: '2026-05-31',
        });
    });

    it('resolves the last month range from a reference date', () => {
        expect(resolveReportDateRange({
            period: 'last-month',
            referenceDate: new Date('2026-05-20T10:00:00Z'),
        })).toMatchObject({
            startDate: '2026-04-01',
            endDate: '2026-04-30',
        });
    });

    it('resolves a custom range and normalizes reversed dates', () => {
        expect(resolveReportDateRange({
            period: 'custom',
            customStart: '2026-05-20',
            customEnd: '2026-05-01',
            referenceDate: new Date('2026-05-20T10:00:00Z'),
        })).toMatchObject({
            startDate: '2026-05-01',
            endDate: '2026-05-20',
        });
    });

    it('falls back to the reference month when custom dates are missing or invalid', () => {
        expect(resolveReportDateRange({
            period: 'custom',
            customStart: 'not-a-date',
            customEnd: null,
            referenceDate: new Date('2026-05-20T10:00:00Z'),
        })).toMatchObject({
            startDate: '2026-05-01',
            endDate: '2026-05-31',
        });
    });

    it('builds an ISO-like label from the resolved range', () => {
        expect(getDateRangeLabel({
            startDate: '2026-04-01',
            endDate: '2026-04-30',
        })).toBe('2026-04-01 to 2026-04-30');
    });

    it('returns an empty label when the range is incomplete', () => {
        expect(getDateRangeLabel({
            startDate: '2026-04-01',
            endDate: '',
        })).toBe('');
    });
});
