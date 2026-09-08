import { useMemo } from 'react';
import { subDays } from 'date-fns';
import type { MultiTimerState } from '@/stores/yjs/types';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { buildDashboardComparison, buildDashboardReport, compareDashboardTime, resolveDashboardComparison, resolveDashboardPeriod } from '../dashboardMetrics';
import type { DashboardDay, DashboardReport } from '../dashboardMetrics';
import useDashboardLiveTime from './useDashboardLiveTime';

const NO_TIMERS: MultiTimerState[] = [];

/** Overlay elapsed time only; monetary values keep their saved-entry references. */
function withLiveTime(report: DashboardReport, live: Map<string, DashboardDay>) {
    const days = report.days.map(day => {
        const addition = live.get(day.date);
        return addition ? { ...day, billable: day.billable + addition.billable,
            nonBillable: day.nonBillable + addition.nonBillable, total: day.total + addition.total } : day;
    });
    const time = days.reduce((sum, day) => sum + day.total, 0);
    return { ...report, days, time, billableTime: days.reduce((sum, day) => sum + day.billable, 0), liveTime: time - report.time };
}

/** Saved financial calculations never depend on the live dashboard clock. */
export default function useMetricsCalculation(input: Parameters<typeof buildDashboardReport>[0], timers: MultiTimerState[] = NO_TIMERS) {
    const saved = useMemo(() => {
        const report = buildDashboardReport(input);
        const comparisonPeriod = resolveDashboardComparison(input.range);
        const previous = buildDashboardReport({ ...input, range: comparisonPeriod.range });
        const comparison = { ...comparisonPeriod, ...buildDashboardComparison(report, previous) };
        const currentMonth = buildDashboardReport({ ...input, range: resolveDashboardPeriod('this-month', input.todayStr) });
        const recent = buildDashboardReport({ ...input, range: {
            startDate: toStorageDate(subDays(parseStoredDate(input.todayStr)!, 6))!, endDate: input.todayStr,
        } });
        return { report, previous, comparison, currentMonth, recent };
    }, [input]);
    const live = useDashboardLiveTime(timers, input.entries, input.tasks);
    return useMemo(() => {
        const report = withLiveTime(saved.report, live);
        const previous = withLiveTime(saved.previous, live);
        const recent = withLiveTime(saved.recent, live);
        return {
            report,
            comparison: { ...saved.comparison, time: compareDashboardTime(report.time, previous.time) },
            currentMonth: saved.currentMonth,
            todayTime: recent.days[recent.days.length - 1]?.total || 0,
            todayLiveTime: live.get(input.todayStr)?.total || 0,
            recentDays: recent.days.map(day => day.total),
        };
    }, [saved, live, input.todayStr]);
}
