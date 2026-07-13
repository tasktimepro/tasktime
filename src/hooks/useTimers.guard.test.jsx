// @ts-nocheck
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { useTimers } from './useTimers';
import { useYjs } from '@/contexts/YjsContext';
import { createTestYMap, readStored } from '@/test/yjs-test-helpers';

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }));

const mockUseYjs = useYjs;

describe('useTimers guard paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('no-ops when store is not ready', () => {
        const coreDoc = new Y.Doc();
        const activeEntriesDoc = new Y.Doc();

        const timersMap = createTestYMap({}, coreDoc, 'timers');
        const tasksMap = createTestYMap({}, coreDoc, 'tasks');
        const entriesMap = createTestYMap({}, activeEntriesDoc, 'entries');

        mockUseYjs.mockReturnValue({
            store: {
                timers: timersMap,
                tasks: tasksMap,
                activeTimeEntries: entriesMap,
                coreDoc,
                activeEntriesDoc,
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

        expect(timersMap.toJSON()).toEqual({});
        expect(entriesMap.toJSON()).toEqual({});
    });

    it('guards when data is missing or not in expected state', async () => {
        const coreDoc = new Y.Doc();
        const activeEntriesDoc = new Y.Doc();

        const timersMap = createTestYMap({}, coreDoc, 'timers');
        const tasksMap = createTestYMap({
            'task-no-project': { id: 'task-no-project', projectId: null },
        }, coreDoc, 'tasks');
        const entriesMap = createTestYMap({}, activeEntriesDoc, 'entries');

        mockUseYjs.mockReturnValue({
            store: {
                timers: timersMap,
                tasks: tasksMap,
                activeTimeEntries: entriesMap,
                coreDoc,
                activeEntriesDoc,
            },
            isReady: true,
        });

        const { result } = renderHook(() => useTimers());

        act(() => {
            result.current.startTimer('missing-task');
            result.current.startTimer('task-no-project');
        });

        expect(Object.keys(timersMap.toJSON()).length).toBe(1);
        expect(readStored(timersMap, 'task-no-project')).toEqual(expect.objectContaining({
            taskId: 'task-no-project',
            projectId: 'task-no-project'
        }));

        await expect(result.current.stopTimer('project-1')).resolves.toBeNull();

        act(() => {
            result.current.pauseTimer('project-1');
            result.current.resumeTimer('project-1');
            result.current.updateTimer('project-1', { note: 'note' });
            result.current.focusTimer('project-1');
            result.current.clearTimer('project-1');
        });

        expect(Object.keys(timersMap.toJSON()).length).toBe(1);

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

        expect(readStored(timersMap, 'project-1')?.paused).toBe(true);

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

        expect(readStored(timersMap, 'project-2')?.paused).toBe(false);
    });
});
