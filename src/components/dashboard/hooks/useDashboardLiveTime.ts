import { useEffect, useMemo, useState } from 'react';
import type { MultiTimerState, Task, TimeEntry } from '@/stores/yjs/types';
import { findStoppedTimerEntry } from '@/domain/time/timerOperations';
import { toStorageDate } from '@/utils/dateUtils';
import type { DashboardDay } from '../dashboardMetrics';

const MINUTE = 60000;

/** Display-only elapsed time. Never creates entries or applies billing rounding. */
export default function useDashboardLiveTime(timers: MultiTimerState[], entries: TimeEntry[], tasks: Task[]) {
    // useTimers refreshes elapsedTime every second. Only lifecycle fields should
    // refresh these dashboard totals between minute ticks.
    const signature = JSON.stringify(timers.map(timer => ({
        projectId: timer.projectId, taskId: timer.taskId, timerInstanceId: timer.timerInstanceId,
        startTime: timer.startTime, paused: Boolean(timer.paused), pausedElapsedTime: timer.pausedElapsedTime || 0,
    })));
    const snapshot = useMemo(() => ({ timers: JSON.parse(signature) as MultiTimerState[], sampledAt: Date.now() }), [signature]);
    const running = snapshot.timers.some(timer => !timer.paused);
    const [tick, setTick] = useState(() => Date.now());

    useEffect(() => {
        if (!running) return;
        let timeout: ReturnType<typeof setTimeout>;
        const refresh = () => {
            clearTimeout(timeout);
            if (document.visibilityState === 'hidden') return;
            setTick(Date.now());
            timeout = setTimeout(refresh, MINUTE - Date.now() % MINUTE);
        };
        refresh();
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [running]);

    // Read wall time on lifecycle changes too, so pause/stop never wait a minute.
    const now = Math.max(snapshot.sampledAt, tick);
    return useMemo(() => {
        const days = new Map<string, DashboardDay>();
        const taskMap = new Map(tasks.map(task => [task.id, task]));
        for (const timer of snapshot.timers) {
            // Entry and timer documents can notify separately during a stop or sync.
            if (findStoppedTimerEntry({ timerKey: timer.projectId, timer, entries })) continue;
            const duration = timer.paused ? timer.pausedElapsedTime || 0 : Math.max(0, now - timer.startTime);
            const date = toStorageDate(new Date(timer.startTime));
            if (!date || !Number.isFinite(duration) || duration <= 0) continue;
            // Match saved-entry semantics, including resumed and cross-midnight sessions.
            const day = days.get(date) || { date, billable: 0, nonBillable: 0, total: 0 };
            if (taskMap.get(timer.taskId)?.billable === true) day.billable += duration;
            else day.nonBillable += duration;
            day.total += duration;
            days.set(date, day);
        }
        return days;
    }, [snapshot, now, entries, tasks]);
}
