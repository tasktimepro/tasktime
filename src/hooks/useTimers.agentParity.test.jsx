// @ts-nocheck
import { act, renderHook } from '@testing-library/react';
import * as Y from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

    it('stops into equivalent time-entry data and clears the same timer', () => {
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
        act(() => {
            uiEntry = harness.result.current.stopTimer('project-1');
        });
        const agentResult = stopTimerCommand(harness.agentContext, { timerKey: 'project-1' });

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
