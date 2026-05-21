import {
    endOfMonth,
    endOfQuarter,
    endOfYear,
    startOfMonth,
    startOfQuarter,
    startOfYear,
    subMonths,
    subQuarters,
    subYears,
} from 'date-fns';
import { parseStoredDate, toStorageDate } from './dateUtils';

export const REPORT_PERIOD_OPTIONS = [
    { value: 'this-month', label: 'This Month' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'this-quarter', label: 'This Quarter' },
    { value: 'last-quarter', label: 'Last Quarter' },
    { value: 'this-year', label: 'This Year' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
] as const;

export type ReportPeriodValue = typeof REPORT_PERIOD_OPTIONS[number]['value'];

export type ReportDateRange = {
    startDate: string;
    endDate: string;
    startTimestamp: number;
    endTimestamp: number;
};

const buildRange = (startDate: Date, endDate: Date): ReportDateRange => ({
    startDate: toStorageDate(startDate) || '',
    endDate: toStorageDate(endDate) || '',
    startTimestamp: startDate.getTime(),
    endTimestamp: endDate.getTime(),
});

export const getDefaultReportPeriod = (): ReportPeriodValue => 'last-month';

export const getDefaultCustomRange = (referenceDate = new Date()) => {
    return {
        customStart: toStorageDate(startOfMonth(referenceDate)) || '',
        customEnd: toStorageDate(endOfMonth(referenceDate)) || '',
    };
};

export const resolveReportDateRange = ({
    period,
    customStart,
    customEnd,
    referenceDate = new Date(),
}: {
    period: ReportPeriodValue;
    customStart?: string | null;
    customEnd?: string | null;
    referenceDate?: Date;
}): ReportDateRange => {
    switch (period) {
        case 'this-month':
            return buildRange(startOfMonth(referenceDate), endOfMonth(referenceDate));
        case 'last-month': {
            const lastMonth = subMonths(referenceDate, 1);
            return buildRange(startOfMonth(lastMonth), endOfMonth(lastMonth));
        }
        case 'this-quarter':
            return buildRange(startOfQuarter(referenceDate), endOfQuarter(referenceDate));
        case 'last-quarter': {
            const lastQuarter = subQuarters(referenceDate, 1);
            return buildRange(startOfQuarter(lastQuarter), endOfQuarter(lastQuarter));
        }
        case 'this-year':
            return buildRange(startOfYear(referenceDate), endOfYear(referenceDate));
        case 'last-year': {
            const lastYear = subYears(referenceDate, 1);
            return buildRange(startOfYear(lastYear), endOfYear(lastYear));
        }
        case 'custom':
        default: {
            const parsedStart = parseStoredDate(customStart);
            const parsedEnd = parseStoredDate(customEnd);
            const fallback = getDefaultCustomRange(referenceDate);
            const safeStart = parsedStart || parseStoredDate(fallback.customStart) || startOfMonth(referenceDate);
            const safeEnd = parsedEnd || parseStoredDate(fallback.customEnd) || endOfMonth(referenceDate);

            return buildRange(safeStart <= safeEnd ? safeStart : safeEnd, safeStart <= safeEnd ? safeEnd : safeStart);
        }
    }
};

export const getDateRangeLabel = ({ startDate, endDate }: Pick<ReportDateRange, 'startDate' | 'endDate'>) => {
    if (!startDate || !endDate) {
        return '';
    }

    return `${startDate} to ${endDate}`;
};
