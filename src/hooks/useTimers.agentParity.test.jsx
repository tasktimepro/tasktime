// @ts-nocheck
import { act, renderHook } from '@testing-library/react';
import * as Y from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    updateTimerCommand,
    pauseTimerCommand,
    resumeTimerCommand,
    startTimerCommand,
    stopTimerCommand,
} from '@/agent/commands';
import { useYjs } from '@/contexts/YjsContext';
import { createTestYMap, readStored } from '@/test/yjs-test-helpers';
import { useMasterClock } from './useMasterClock';
import { useTimers } from './useTimers';

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }));
vi.mock('./useMasterClock', () => ({ useMasterClock: vi.fn() }));

const mockUseYjs = useYjs;
const mockUseMasterClock = useMasterClock;

function createTimerStore() {
    const coreDoc = new Y.Doc();
    const activeEntriesDoc = new Y.Doc();

    return {
        isReady: true,
        coreDoc,
        activeEntriesDoc,
        timers: createTestYMap({}, coreDoc, 'timers'),
        tasks: createTestYMap({
            'task-1': {
                id: 'task-1',
                title: 'Parity task',
                projectId: 'project-1',
            },
        }, coreDoc, 'tasks'),
        activeTimeEntries: createTestYMap({}, activeEntriesDoc, 'timeEntries'),
    };
}

function createAgentContext(store) {
    let nextId = 0;

    return {
        store,
        isReady: true,
        permissions: new Set(['read', 'write']),
        idempotency: new Map(),
        now: () => Date.now(),
        generateId: () => `agent-parity-${++nextId}`,
    };
}

function readTimer(store) {
    return readStored(store.timers, 'project-1');
}

function comparableTimer(timer) {
    return {
        projectId: timer.projectId,
        taskId: timer.taskId,
        startTime: timer.startTime,
        paused: timer.paused,
        pausedElapsedTime: timer.pausedElapsedTime,
        note: timer.note,
        lastActive: timer.lastActive,
    };
}

function comparableEntry(entry) {
    return {
        taskId: entry.taskId,
        start: entry.start,
        end: entry.end,
        note: entry.note,
        stoppedTimerKey: entry._stoppedTimerKey,
    };
}

function createParityHarness() {
    const uiStore = createTimerStore();
    const agentStore = createTimerStore();
    const agentContext = createAgentContext(agentStore);

    mockUseYjs.mockReturnValue({ store: uiStore, isReady: true });
    const { result } = renderHook(() => useTimers());

    return {
        result,
        uiStore,
        agentStore,
        agentContext,
    };
}

function startBoth(harness) {
    act(() => {
        harness.result.current.startTimer('task-1', 'Parity note');
    });
    startTimerCommand(harness.agentContext, {
        taskId: 'task-1',
        note: 'Parity note',
    });
}

describe('useTimers and agent command parity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-11T09:00:00.000Z'));
        mockUseMasterClock.mockImplementation(() => Date.now());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each(['ui', 'agent'])('rejects future start updates through the %s write boundary', async (source) => {
        const harness = createParityHarness();
        startBoth(harness);
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        const before = readTimer(store);
        await expect(Promise.resolve().then(() => source === 'ui'
            ? harness.result.current.updateTimer('project-1', { startTime: Date.now() + 60000 })
            : updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime: Date.now() + 60000 })
        )).rejects.toThrow(/future/);
        expect(readTimer(store)).toEqual(before);
    });

    it.each(['ui', 'agent'])('retains timer schema validation for malformed %s updates', async (source) => {
        const harness = createParityHarness();
        startBoth(harness);
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        const before = readTimer(store);
        await expect(Promise.resolve().then(() => source === 'ui'
            ? harness.result.current.updateTimer('project-1', { note: 123 })
            : updateTimerCommand(harness.agentContext, { timerKey: 'project-1', note: 123 })
        )).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(readTimer(store)).toEqual(before);
    });

    it.each(['ui', 'agent'])('checks archived project work before the %s start update is saved', async (source) => {
        const harness = createParityHarness();
        startBoth(harness);
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        const before = readTimer(store);
        store.loadAllTimeEntries = vi.fn(async () => [{ id: 'old-entry', taskId: 'archived-task', start: Date.now() - 3600000, end: Date.now() - 1800000 }]);
        store.loadArchivedTasks = vi.fn(async () => createTestYMap({ 'archived-task': { id: 'archived-task', title: 'Archived task', projectId: 'project-1' } }));
        await expect(Promise.resolve().then(() => source === 'ui'
            ? harness.result.current.updateTimer('project-1', { startTime: Date.now() - 7200000 })
            : updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime: Date.now() - 7200000 })
        )).rejects.toThrow(/overlap/);
        expect(readTimer(store)).toEqual(before);
    });

    it.each(['ui', 'agent'])('keeps a paused August interval and its stopped entry in August through %s', async (source) => {
        const harness = createParityHarness();
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        vi.setSystemTime(new Date('2026-09-14T00:00:00+02:00'));
        const originalStart = new Date('2026-08-27T23:50:45+02:00').getTime();
        const timer = { projectId: 'project-1', taskId: 'task-1', timerInstanceId: 'august', startTime: originalStart, paused: true, pausedElapsedTime: 431000, note: 'Work' };
        act(() => {
            store.timers.set('project-1', timer);
            store.activeTimeEntries.set('september', { id: 'september', taskId: 'task-1', start: new Date('2026-09-13T16:43:00+02:00').getTime(), end: new Date('2026-09-14T00:43:00+02:00').getTime() });
        });
        const startTime = originalStart - 60000;
        await act(async () => {
            if (source === 'ui') await harness.result.current.updateTimer('project-1', { startTime });
            else await updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime });
        });
        expect(readTimer(store)).toMatchObject({ startTime, paused: true, pausedElapsedTime: 491000, timerInstanceId: 'august' });
        let entry;
        await act(async () => {
            entry = source === 'ui' ? await harness.result.current.stopTimer('project-1')
                : (await stopTimerCommand(harness.agentContext, { timerKey: 'project-1' })).entry;
        });
        expect(entry).toMatchObject({ start: startTime, end: originalStart + 431000 });
        expect(store.activeTimeEntries.size).toBe(2);
    });

    it.each(['ui', 'agent'])('does not overwrite a replacement timer while %s loads history', async (source) => {
        const harness = createParityHarness();
        startBoth(harness);
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        let finishLoading;
        store.loadAllTimeEntries = vi.fn(() => new Promise((resolve) => { finishLoading = resolve; }));
        const replacement = { ...readTimer(store), timerInstanceId: 'replacement', note: 'New timer' };
        await act(async () => {
            const pending = source === 'ui' ? harness.result.current.updateTimer('project-1', { startTime: Date.now() - 1000 })
                : updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime: Date.now() - 1000 });
            const rejected = expect(pending).rejects.toThrow(/timer changed/);
            store.timers.set('project-1', replacement);
            finishLoading([]);
            await rejected;
        });
        expect(readTimer(store)).toEqual(replacement);
    });

    it.each(['ui', 'agent'])('allows %s note-only edits without loading history or changing a paused interval', async (source) => {
        const harness = createParityHarness();
        startBoth(harness);
        const store = source === 'ui' ? harness.uiStore : harness.agentStore;
        const timer = { ...readTimer(store), paused: true, pausedElapsedTime: 1234 };
        act(() => store.timers.set('project-1', timer));
        store.loadAllTimeEntries = vi.fn(async () => { throw new Error('History unavailable'); });
        await act(async () => {
            if (source === 'ui') await harness.result.current.updateTimer('project-1', { startTime: timer.startTime, note: '' });
            else await updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime: timer.startTime, note: '' });
        });
        expect(store.loadAllTimeEntries).not.toHaveBeenCalled();
        expect(readTimer(store)).toMatchObject({ startTime: timer.startTime, pausedElapsedTime: 1234, note: '' });
    });

    it('preserves the paused endpoint when UI and agent move a start across midnight', async () => {
        const harness = createParityHarness();
        const timer = { projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000, paused: true, pausedElapsedTime: 5000, note: '' };
        act(() => {
            harness.uiStore.timers.set('project-1', timer);
            harness.agentStore.timers.set('project-1', timer);
        });
        const startTime = timer.startTime - 2 * 60 * 60 * 1000;
        await act(async () => {
            await harness.result.current.updateTimer('project-1', { startTime });
            await updateTimerCommand(harness.agentContext, { timerKey: 'project-1', startTime });
        });
        expect(readTimer(harness.uiStore).pausedElapsedTime).toBe(7205000);
        expect(comparableTimer(readTimer(harness.uiStore))).toEqual(comparableTimer(readTimer(harness.agentStore)));
    });

    it('starts the same timer state through the UI and agent paths', () => {
        const harness = createParityHarness();

        startBoth(harness);

        const uiTimer = readTimer(harness.uiStore);
        const agentTimer = readTimer(harness.agentStore);

        expect(comparableTimer(uiTimer)).toEqual(comparableTimer(agentTimer));
        expect(uiTimer.timerInstanceId).toEqual(expect.any(String));
        expect(agentTimer.timerInstanceId).toEqual(expect.any(String));
    });

    it('pauses with the same elapsed-time state through the UI and agent paths', () => {
        const harness = createParityHarness();
        startBoth(harness);
        vi.advanceTimersByTime(5_375);

        act(() => {
            harness.result.current.pauseTimer('project-1');
        });
        pauseTimerCommand(harness.agentContext, { timerKey: 'project-1' });

        expect(comparableTimer(readTimer(harness.uiStore))).toEqual(
            comparableTimer(readTimer(harness.agentStore))
        );
        expect(readTimer(harness.uiStore).pausedElapsedTime).toBe(5_375);
    });

    it('resumes with the same preserved elapsed time through the UI and agent paths', () => {
        const harness = createParityHarness();
        startBoth(harness);
        vi.advanceTimersByTime(5_375);

        act(() => {
            harness.result.current.pauseTimer('project-1');
        });
        pauseTimerCommand(harness.agentContext, { timerKey: 'project-1' });
        vi.advanceTimersByTime(2_625);

        act(() => {
            harness.result.current.resumeTimer('project-1');
        });
        resumeTimerCommand(harness.agentContext, { timerKey: 'project-1' });

        expect(comparableTimer(readTimer(harness.uiStore))).toEqual(
            comparableTimer(readTimer(harness.agentStore))
        );
        expect(Date.now() - readTimer(harness.uiStore).startTime).toBe(5_375);
    });

    it('stops into equivalent time-entry data and clears the same timer', async () => {
        const harness = createParityHarness();
        startBoth(harness);
        const uiTimerInstanceId = readTimer(harness.uiStore).timerInstanceId;
        const agentTimerInstanceId = readTimer(harness.agentStore).timerInstanceId;
        vi.advanceTimersByTime(5_375);

        act(() => {
            harness.result.current.pauseTimer('project-1');
        });
        pauseTimerCommand(harness.agentContext, { timerKey: 'project-1' });
        vi.advanceTimersByTime(2_625);

        act(() => {
            harness.result.current.resumeTimer('project-1');
        });
        resumeTimerCommand(harness.agentContext, { timerKey: 'project-1' });
        vi.advanceTimersByTime(3_250);

        let uiEntry;
        await act(async () => {
            uiEntry = await harness.result.current.stopTimer('project-1');
        });
        const agentResult = await stopTimerCommand(harness.agentContext, { timerKey: 'project-1' });

        expect(comparableEntry(uiEntry)).toEqual(comparableEntry(agentResult.entry));
        expect(uiEntry.end - uiEntry.start).toBe(8_625);
        expect(uiEntry._stoppedTimerInstanceId).toBe(uiTimerInstanceId);
        expect(agentResult.entry._stoppedTimerInstanceId).toBe(agentTimerInstanceId);
        expect(agentResult.durationMs).toBe(uiEntry.end - uiEntry.start);
        expect(harness.uiStore.timers.has('project-1')).toBe(false);
        expect(harness.agentStore.timers.has('project-1')).toBe(false);
        expect(readStored(harness.uiStore.activeTimeEntries, uiEntry.id)).toEqual(uiEntry);
        expect(readStored(harness.agentStore.activeTimeEntries, agentResult.entry.id)).toEqual(agentResult.entry);
    });
});
