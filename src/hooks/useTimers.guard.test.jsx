// @ts-nocheck
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTimers } from './useTimers';
import { useYjs } from '@/contexts/YjsContext';

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }));

const mockUseYjs = useYjs;

function createObservableMap(initial = {}) {
    const map = new Map(Object.entries(initial));
    const observers = new Set();

    return {
        get: (key) => map.get(key),
        set: (key, value) => {
            map.set(key, value);
            observers.forEach((fn) => fn());
        },
        delete: (key) => {
            const deleted = map.delete(key);
            observers.forEach((fn) => fn());
            return deleted;
        },
        forEach: (cb) => map.forEach((value, key) => cb(value, key)),
        values: () => Array.from(map.values()),
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    };
}

describe('useTimers guard paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('no-ops when store is not ready', () => {
        const timersMap = createObservableMap();
        const tasksMap = createObservableMap();
        const entriesMap = createObservableMap();

        mockUseYjs.mockReturnValue({
            store: {
                timers: timersMap,
                tasks: tasksMap,
                activeTimeEntries: entriesMap,
                coreDoc: { transact: (fn) => fn() },
                activeEntriesDoc: { transact: (fn) => fn() },
            },
            isReady: false,
        });

        const { result } = renderHook(() => useTimers());

        act(() => {
            result.current.startTimer('missing-task');
            result.current.pauseTimer('project-1');
            result.current.resumeTimer('project-1');
            result.current.stopTimer('project-1');
            result.current.clearTimer('project-1');
            result.current.updateTimer('project-1', { note: 'note' });
            result.current.focusTimer('project-1');
        });

        expect(timersMap.values().length).toBe(0);
        expect(entriesMap.values().length).toBe(0);
    });

    it('guards when data is missing or not in expected state', () => {
        const timersMap = createObservableMap();
        const tasksMap = createObservableMap({
            'task-no-project': { id: 'task-no-project', projectId: null },
        });
        const entriesMap = createObservableMap();

        mockUseYjs.mockReturnValue({
            store: {
                timers: timersMap,
                tasks: tasksMap,
                activeTimeEntries: entriesMap,
                coreDoc: { transact: (fn) => fn() },
                activeEntriesDoc: { transact: (fn) => fn() },
            },
            isReady: true,
        });

        const { result } = renderHook(() => useTimers());

        act(() => {
            result.current.startTimer('missing-task');
            result.current.startTimer('task-no-project');
        });

        expect(timersMap.values().length).toBe(1);
        expect(timersMap.get('task-no-project')).toEqual(expect.objectContaining({
            taskId: 'task-no-project',
            projectId: 'task-no-project'
        }));

        expect(result.current.stopTimer('project-1')).toBeNull();

        act(() => {
            result.current.pauseTimer('project-1');
            result.current.resumeTimer('project-1');
            result.current.updateTimer('project-1', { note: 'note' });
            result.current.focusTimer('project-1');
            result.current.clearTimer('project-1');
        });

        expect(timersMap.values().length).toBe(1);

        act(() => {
            timersMap.set('project-1', {
                projectId: 'project-1',
                taskId: 'task-1',
                startTime: Date.now(),
                paused: true,
                pausedElapsedTime: 1000,
                note: '',
                lastActive: Date.now(),
            });
        });

        act(() => {
            result.current.pauseTimer('project-1');
        });

        expect(timersMap.get('project-1')?.paused).toBe(true);

        act(() => {
            timersMap.set('project-2', {
                projectId: 'project-2',
                taskId: 'task-2',
                startTime: Date.now(),
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: Date.now(),
            });
        });

        act(() => {
            result.current.resumeTimer('project-2');
        });

        expect(timersMap.get('project-2')?.paused).toBe(false);
    });
});
