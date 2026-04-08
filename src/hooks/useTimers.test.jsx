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
            entry = result.current.stopTimer('p1')
        })

        expect(entry).toBeTruthy()
        expect(store.timers.has('p1')).toBe(false)
        expect(store.activeTimeEntries.has(entry.id)).toBe(true)
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
