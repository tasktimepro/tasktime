// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
import { useTimers } from './useTimers'
import { useYjs } from '@/contexts/YjsContext'
import { useMasterClock } from './useMasterClock'
import { createTestYMap, readStored } from '@/test/yjs-test-helpers'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useMasterClock', () => ({ useMasterClock: vi.fn() }))

const mockUseYjs = useYjs
const mockUseMasterClock = useMasterClock

describe('useTimers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-04T12:00:00Z'))
        mockUseMasterClock.mockImplementation(() => Date.now())
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts timers and exposes lookups', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()

        const timers = createTestYMap({}, coreDoc, 'timers')
        const tasks = createTestYMap({
            t1: { id: 't1', projectId: 'p1' },
        }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        act(() => {
            result.current.startTimer('t1', 'Note')
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.hasTimerForProject('p1')).toBe(true)
        expect(result.current.isTaskTimerActive('t1')).toBe(true)
        expect(result.current.getTimerForProject('p1')).toBeTruthy()
        expect(result.current.getTimerForTask('t1', 'p1')).toBeTruthy()
    })

    it('pauses, resumes, updates, focuses, and stops timers', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()

        const timers = createTestYMap({
            p1: {
                projectId: 'p1',
                taskId: 't1',
                startTime: Date.now() - 5000,
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: Date.now(),
            }
        }, coreDoc, 'timers')
        const tasks = createTestYMap({ t1: { id: 't1', title: 'Task', projectId: 'p1' } }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            result.current.pauseTimer('p1')
        })

        expect(readStored(store.timers, 'p1').paused).toBe(true)

        await act(async () => {
            result.current.resumeTimer('p1')
        })

        expect(readStored(store.timers, 'p1').paused).toBe(false)

        await act(async () => {
            result.current.updateTimer('p1', { note: 'Updated' })
            result.current.focusTimer('p1')
        })

        expect(readStored(store.timers, 'p1').note).toBe('Updated')

        let entry
        await act(async () => {
            entry = await result.current.stopTimer('p1')
        })

        expect(entry).toBeTruthy()
        expect(store.timers.has('p1')).toBe(false)
        expect(store.activeTimeEntries.has(entry.id)).toBe(true)
    })

    it('preserves exact elapsed milliseconds when resuming a paused timer', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()
        const now = Date.now()

        const timers = createTestYMap({
            p1: {
                projectId: 'p1',
                taskId: 't1',
                startTime: now - 7999,
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: now,
            }
        }, coreDoc, 'timers')
        const tasks = createTestYMap({ t1: { id: 't1', projectId: 'p1' } }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            result.current.pauseTimer('p1')
        })

        expect(readStored(store.timers, 'p1').pausedElapsedTime).toBe(7999)

        await act(async () => {
            vi.advanceTimersByTime(275)
            result.current.resumeTimer('p1')
        })

        const resumedTimer = readStored(store.timers, 'p1')
        expect(resumedTimer.paused).toBe(false)
        expect(resumedTimer.startTime).toBe(Date.now() - 7999)

        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.getTimerForProject('p1')?.elapsedTime).toBe(7999)
    })

    it('uses an explicit pause timestamp when provided', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()

        const timers = createTestYMap({
            p1: {
                projectId: 'p1',
                taskId: 't1',
                startTime: 1000,
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: Date.now(),
            }
        }, coreDoc, 'timers')
        const tasks = createTestYMap({ t1: { id: 't1', projectId: 'p1' } }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            vi.advanceTimersByTime(5000)
            result.current.pauseTimer('p1', 13000)
        })

        expect(readStored(store.timers, 'p1')).toEqual(expect.objectContaining({
            paused: true,
            pausedElapsedTime: 12000,
            lastActive: 13000,
        }))
    })

    it('does not render a lower elapsed time when the master clock is stale after resume', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()
        const pausedAt = Date.now()
        const staleMasterClockNow = pausedAt

        mockUseMasterClock.mockImplementation(() => staleMasterClockNow)

        const timers = createTestYMap({
            p1: {
                projectId: 'p1',
                taskId: 't1',
                startTime: pausedAt - 8000,
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: pausedAt,
            }
        }, coreDoc, 'timers')
        const tasks = createTestYMap({ t1: { id: 't1', projectId: 'p1' } }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            result.current.pauseTimer('p1')
        })

        expect(result.current.getTimerForProject('p1')?.elapsedTime).toBe(8000)

        await act(async () => {
            vi.advanceTimersByTime(2750)
            result.current.resumeTimer('p1')
        })

        expect(result.current.getTimerForProject('p1')?.elapsedTime).toBe(8000)
    })

    it('clears timers without creating entries', () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()

        const timers = createTestYMap({
            p1: { projectId: 'p1', taskId: 't1', startTime: Date.now(), paused: false, pausedElapsedTime: 0, note: '', lastActive: Date.now() }
        }, coreDoc, 'timers')
        const tasks = createTestYMap({ t1: { id: 't1', projectId: 'p1' } }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'activeTimeEntries')

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        act(() => {
            result.current.clearTimer('p1')
        })

        expect(store.timers.has('p1')).toBe(false)
        expect(store.activeTimeEntries.has('p1')).toBe(false)
    })
})
