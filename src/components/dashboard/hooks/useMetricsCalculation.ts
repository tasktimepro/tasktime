import { useMemo } from 'react';
import { subDays } from 'date-fns';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { buildDashboardComparison, buildDashboardReport, resolveDashboardComparison, resolveDashboardPeriod } from '../dashboardMetrics';

/** Keep the fixed summary timeframe separate from the user's selected report. */
export default function useMetricsCalculation(input: Parameters<typeof buildDashboardReport>[0]) {
    return useMemo(() => {
        const report = buildDashboardReport(input);
        const comparisonPeriod = resolveDashboardComparison(input.range);
        const previous = buildDashboardReport({ ...input, range: comparisonPeriod.range });
        const comparison = { ...comparisonPeriod, ...buildDashboardComparison(report, previous) };
        const currentMonth = buildDashboardReport({ ...input, range: resolveDashboardPeriod('this-month', input.todayStr) });
        const recent = buildDashboardReport({ ...input, range: {
            startDate: toStorageDate(subDays(parseStoredDate(input.todayStr)!, 6))!, endDate: input.todayStr,
        } });
        return { report, comparison, currentMonth, todayTime: recent.days[recent.days.length - 1]?.total || 0, recentDays: recent.days.map(day => day.total) };
    }, [input]);
}
