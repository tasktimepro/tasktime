import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
    TimerOperationError,
    buildPausedTimer,
    buildResumedTimer,
    buildStartedTimer,
    buildStoppedTimerEntryId,
    planStoppedTimer,
} from './timerOperations';

const tasks = [
    { id: 'task-1', title: 'Task', projectId: 'project-1' },
    { id: 'task-2', title: 'Other task', projectId: 'project-1' },
];

describe('timer operations', () => {
    it('preserves exact elapsed time across pause and resume', () => {
        const started = buildStartedTimer({
            task: { id: 'task-1', title: 'Task', projectId: 'project-1' },
            timerInstanceId: 'timer-1',
            now: 1_234,
            note: 'Work',
        });
        const paused = buildPausedTimer(started, 6_609);
        const resumed = buildResumedTimer(paused, 10_000);

        expect(started.startTime).toBe(2_000);
        expect(paused.pausedElapsedTime).toBe(4_609);
        expect(resumed.startTime).toBe(5_391);
        expect(resumed.pausedElapsedTime).toBe(0);
    });

    it('recovers a repeated stop by timer instance without creating another entry', () => {
        const timer = buildStartedTimer({
            task: { id: 'task-1', title: 'Task', projectId: 'project-1' },
            timerInstanceId: 'timer-1',
            now: 1_000,
        });
        const priorEntry = {
            id: 'entry-1',
            taskId: 'task-1',
            start: 1_000,
            end: 5_000,
            _stoppedTimerKey: 'project-1',
            _stoppedTimerInstanceId: 'timer-1',
        };

        expect(planStoppedTimer({
            timerKey: 'project-1',
            timer,
            entries: [priorEntry],
            tasks,
            now: 6_000,
        })).toEqual({ entry: priorEntry, recovered: true });
    });

    it('recovers by operation ID after the timer is gone and rejects an unknown stop', () => {
        const priorEntry = {
            id: 'entry-1', taskId: 'task-1', start: 1_000, end: 5_000,
            _stoppedTimerKey: 'project-1',
            _stoppedTimerOperationId: 'stop-1',
        };
        expect(planStoppedTimer({
            timerKey: 'project-1', timer: null, entries: [priorEntry], tasks, now: 6_000, operationId: 'stop-1',
        })).toEqual({ entry: priorEntry, recovered: true });
        expect(() => planStoppedTimer({
            timerKey: 'project-1', timer: null, entries: [], tasks, now: 6_000,
        })).toThrow(TimerOperationError);
        expect(() => planStoppedTimer({
            timerKey: 'other-project', timer: null, entries: [priorEntry], tasks, now: 6_000, operationId: 'stop-1',
        })).toThrow(TimerOperationError);
    });

    it('snapshots the billing increment on a newly stopped entry', () => {
        const timer = buildStartedTimer({
            task: { id: 'task-1', title: 'Task', projectId: 'project-1' }, timerInstanceId: 'timer-1', now: 1_000,
        });
        const result = planStoppedTimer({
            timerKey: 'project-1', timer, entries: [], tasks, now: 61_000, billingIncrementMinutes: 15,
        });
        expect(result.entry).toEqual(expect.objectContaining({
            billedDurationMs: 900_000,
            billingIncrementMinutes: 15,
        }));
    });

    it('keeps a paused timer on its original raw interval when stopped later', () => {
        const timer = {
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-paused',
            startTime: 1_000,
            paused: true,
            pausedElapsedTime: 5_000,
            note: 'Paused work',
        };

        const result = planStoppedTimer({
            timerKey: 'project-1',
            timer,
            entries: [],
            tasks,
            now: 20_000,
        });

        expect(result.entry).toEqual(expect.objectContaining({
            start: 1_000,
            end: 6_000,
        }));
    });

    it('rejects a stopped interval that overlaps another task in the project', () => {
        const timer = {
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-overlap',
            startTime: 1_000,
            paused: true,
            pausedElapsedTime: 5_000,
        };

        expect(() => planStoppedTimer({
            timerKey: 'project-1',
            timer,
            entries: [{ id: 'existing', taskId: 'task-2', start: 4_000, end: 8_000 }],
            tasks,
            now: 20_000,
        })).toThrow(/overlaps/);
    });

    it('uses one deterministic entry key when two devices stop the same timer instance', () => {
        const timer = buildStartedTimer({
            task: tasks[0],
            timerInstanceId: 'shared-timer-instance',
            now: 1_000,
        });
        const entryId = buildStoppedTimerEntryId('project-1', timer);
        const first = planStoppedTimer({
            timerKey: 'project-1', timer, entries: [], tasks, now: 5_000, operationId: 'device-a',
        }).entry;
        const second = planStoppedTimer({
            timerKey: 'project-1', timer, entries: [], tasks, now: 6_000, operationId: 'device-b',
        }).entry;

        expect(first.id).toBe(entryId);
        expect(second.id).toBe(entryId);

        const firstDoc = new Y.Doc();
        const secondDoc = new Y.Doc();
        firstDoc.getMap('timeEntries').set(first.id, first);
        secondDoc.getMap('timeEntries').set(second.id, second);
        const firstUpdate = Y.encodeStateAsUpdate(firstDoc);
        const secondUpdate = Y.encodeStateAsUpdate(secondDoc);
        Y.applyUpdate(firstDoc, secondUpdate);
        Y.applyUpdate(secondDoc, firstUpdate);

        expect(firstDoc.getMap('timeEntries').size).toBe(1);
        expect(secondDoc.getMap('timeEntries').size).toBe(1);
    });
});
