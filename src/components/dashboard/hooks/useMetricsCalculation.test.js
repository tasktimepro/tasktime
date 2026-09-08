import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMetricsCalculation from './useMetricsCalculation';

const hour = 3600000;
const at = new Date(2026, 8, 8, 12).getTime();
const input = {
    todayStr: '2026-09-08', range: { startDate: '2026-08-01', endDate: '2026-08-31' },
    preferredCurrency: 'EUR', convertToCurrency: amounts => ({ amounts, hadConversionError: false }),
    tasks: [{ id: 'task', title: 'Work', projectId: 'project', billable: true }],
    projects: [{ id: 'project', title: 'Project', hourlyRate: 100 }], clients: [], invoices: [], expenses: [], recurrences: [],
    entries: [{ id: 'entry', taskId: 'task', start: at, end: at + hour, billedDurationMs: 1.5 * hour }],
};

describe('dashboard metrics calculation', () => {
    it('compares the selected report with its actual preceding period and recomputes on selection', () => {
        const entry = (id, month, hours) => ({ id, taskId: 'task', start: new Date(2026, month - 1, 8, 12).getTime(), end: new Date(2026, month - 1, 8, 12).getTime() + hours * hour });
        const entries = [entry('july', 7, 2), entry('august', 8, 1), entry('september', 9, 3)];
        const { result, rerender } = renderHook(props => useMetricsCalculation(props), { initialProps: { ...input, entries } });
        expect(result.current.comparison.range).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
        expect(result.current.comparison.time).toEqual({ direction: 'down', label: '−50%' });
        expect(result.current.comparison.unbilled.label).toBe('−50%');
        rerender({ ...input, entries, range: { startDate: '2026-09-01', endDate: '2026-09-30' } });
        expect(result.current.comparison.time).toEqual({ direction: 'up', label: '+200%' });
        expect(result.current.comparison.unbilled.label).toBe('+200%');
    });

    it('keeps summary cards on this month while selecting another report month', () => {
        const { result } = renderHook(() => useMetricsCalculation(input));
        expect(result.current.report.time).toBe(0);
        expect(result.current.currentMonth.time).toBe(hour);
        expect(result.current.currentMonth.unbilled.amounts.EUR).toBe(150);
        expect(result.current.todayTime).toBe(hour);
        expect(result.current.recentDays).toEqual([0, 0, 0, 0, 0, 0, hour]);
    });

    it('updates summary and report at local month rollover while retaining the seven-day trend', () => {
        const entry = { id: 'entry', taskId: 'task', start: new Date(2026, 8, 30, 10).getTime(), end: new Date(2026, 8, 30, 11).getTime() };
        const { result, rerender } = renderHook(props => useMetricsCalculation(props), { initialProps: { ...input, todayStr: '2026-09-30', entries: [entry] } });
        expect(result.current.todayTime).toBe(hour);
        rerender({ ...input, todayStr: '2026-10-01', entries: [entry] });
        expect(result.current.todayTime).toBe(0);
        expect(result.current.currentMonth.time).toBe(0);
        expect(result.current.recentDays).toEqual([0, 0, 0, 0, 0, hour, 0]);
    });

    it('keeps task-by-task invoice rounding for monetary estimates', () => {
        const { result } = renderHook(() => useMetricsCalculation({ ...input,
            range: { startDate: '2026-09-01', endDate: '2026-09-30' },
            tasks: [...input.tasks, { id: 'second', title: 'Second task', projectId: 'project', billable: true }],
            entries: [
                { id: 'a', taskId: 'task', start: at, end: at + 1.234 * hour },
                { id: 'b', taskId: 'second', start: at, end: at + 1.111 * hour },
            ],
        }));
        expect(result.current.report.unbilled.amounts.EUR).toBe(234);
    });
});
