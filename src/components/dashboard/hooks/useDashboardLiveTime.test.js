import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useDashboardLiveTime from './useDashboardLiveTime';
import { buildPausedTimer, buildResumedTimer, planStoppedTimer } from '@/domain/time/timerOperations';

const minute = 60000;
const now = new Date(2026, 8, 8, 12).getTime();
const task = { id: 'task', title: 'Work', projectId: 'project', billable: true };
const timer = { projectId: 'project', taskId: 'task', timerInstanceId: 'session', startTime: now - 5 * minute, paused: false };
const tasks = [task];
const entries = [];
const projects = [{ id: 'project', title: 'Project', preferredClientId: 'client' }];
const clients = [{ id: 'client', title: 'Client' }];

describe('dashboard live time', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('samples once per minute, ignoring per-second elapsed display updates', () => {
        const { result, rerender, unmount } = renderHook(timers => useDashboardLiveTime(timers, entries, tasks, projects, clients), { initialProps: [timer] });
        const first = result.current;
        expect(first.get('2026-09-08')?.billable).toBe(5 * minute);
        act(() => { vi.advanceTimersByTime(30000); });
        rerender([{ ...timer, elapsedTime: 5.5 * minute }]);
        expect(result.current).toBe(first);
        act(() => { vi.advanceTimersByTime(30000); });
        expect(result.current.get('2026-09-08')?.total).toBe(6 * minute);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('updates immediately on pause/resume/edit/discard and stops ticking while paused', () => {
        const { result, rerender } = renderHook(timers => useDashboardLiveTime(timers, entries, tasks, projects, clients), { initialProps: [timer] });
        act(() => { vi.advanceTimersByTime(15000); });
        const paused = buildPausedTimer(timer, Date.now());
        rerender([paused]);
        expect(result.current.get('2026-09-08')?.total).toBe(5 * minute + 15000);
        expect(vi.getTimerCount()).toBe(0);
        act(() => { vi.advanceTimersByTime(10 * minute); });
        const resumed = buildResumedTimer(paused, Date.now());
        rerender([resumed]);
        expect(result.current.get('2026-09-08')?.total).toBe(5 * minute + 15000);
        rerender([{ ...resumed, startTime: Date.now() - 2 * minute }]);
        expect(result.current.get('2026-09-08')?.total).toBe(2 * minute);
        rerender([]);
        expect(result.current.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('suppresses a saved timer instance during stop reconciliation, including legacy timers', () => {
        for (const candidate of [timer, { ...timer, timerInstanceId: undefined }]) {
            const saved = planStoppedTimer({ timerKey: 'project', timer: candidate, entries, tasks, now }).entry;
            const { result, rerender, unmount } = renderHook(props => useDashboardLiveTime([candidate], props, tasks, projects, clients), { initialProps: entries });
            expect(result.current.size).toBe(1);
            rerender([saved]);
            expect(result.current.size).toBe(0);
            unmount();
        }
    });

    it('combines concurrent timers with missing tasks as non-billable and uses the local start date across midnight', () => {
        vi.setSystemTime(new Date(2026, 9, 1, 0, 10));
        const startTime = new Date(2026, 8, 30, 23, 50).getTime();
        const { result } = renderHook(() => useDashboardLiveTime([
            { ...timer, startTime },
            { ...timer, projectId: 'other', taskId: 'missing', startTime, paused: true, pausedElapsedTime: minute },
            { ...timer, projectId: 'future', startTime: Date.now() + minute },
        ], entries, tasks, projects, clients));
        expect(result.current.size).toBe(1);
        expect(result.current.get('2026-09-30')).toEqual({ date: '2026-09-30', billable: 20 * minute, nonBillable: minute, total: 21 * minute });
    });

    it('suspends hidden polling and catches up immediately on visibility or focus', () => {
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        const { result } = renderHook(() => useDashboardLiveTime([timer], entries, tasks, projects, clients));
        visibility.mockReturnValue('hidden');
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(vi.getTimerCount()).toBe(0);
        act(() => { vi.advanceTimersByTime(3 * minute); });
        expect(result.current.get('2026-09-08')?.total).toBe(5 * minute);
        visibility.mockReturnValue('visible');
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(result.current.get('2026-09-08')?.total).toBe(8 * minute);
        vi.setSystemTime(now + 4 * minute + 5000);
        act(() => { window.dispatchEvent(new Event('focus')); });
        expect(result.current.get('2026-09-08')?.total).toBe(9 * minute + 5000);
    });
});
