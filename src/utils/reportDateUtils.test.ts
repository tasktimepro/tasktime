import { describe, expect, it } from 'vitest';
import {
    getDateRangeLabel,
    getDefaultCustomRange,
    getDefaultReportPeriod,
    resolveReportDateRange,
} from './reportDateUtils';

describe('reportDateUtils', () => {
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

    it('builds an ISO-like label from the resolved range', () => {
        expect(getDateRangeLabel({
            startDate: '2026-04-01',
            endDate: '2026-04-30',
        })).toBe('2026-04-01 to 2026-04-30');
    });
});
