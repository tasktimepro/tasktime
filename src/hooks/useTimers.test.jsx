// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useTimers } from './useTimers'
import { useYjs } from '@/contexts/YjsContext'
import { useMasterClock } from './useMasterClock'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useMasterClock', () => ({ useMasterClock: vi.fn() }))

const mockUseYjs = useYjs
const mockUseMasterClock = useMasterClock

function createObservableMap(initial = {}) {
    const map = new Map(Object.entries(initial))
    const observers = new Set()

    return {
        get: (key) => map.get(key),
        set: (key, value) => {
            map.set(key, value)
            observers.forEach((fn) => fn())
        },
        delete: (key) => {
            const deleted = map.delete(key)
            observers.forEach((fn) => fn())
            return deleted
        },
        has: (key) => map.has(key),
        forEach: (cb) => map.forEach((value, key) => cb(value, key)),
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    }
}

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
        const timers = createObservableMap()
        const tasks = createObservableMap({
            t1: { id: 't1', projectId: 'p1' },
        })
        const activeTimeEntries = createObservableMap()

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc: { transact: (fn) => fn() },
            activeEntriesDoc: { transact: (fn) => fn() },
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
        const timers = createObservableMap({
            p1: {
                projectId: 'p1',
                taskId: 't1',
                startTime: Date.now() - 5000,
                paused: false,
                pausedElapsedTime: 0,
                note: '',
                lastActive: Date.now(),
            }
        })
        const tasks = createObservableMap({ t1: { id: 't1', projectId: 'p1' } })
        const activeTimeEntries = createObservableMap()

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc: { transact: (fn) => fn() },
            activeEntriesDoc: { transact: (fn) => fn() },
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())

        act(() => {
            result.current.pauseTimer('p1')
        })

        expect(store.timers.get('p1').paused).toBe(true)

        act(() => {
            result.current.resumeTimer('p1')
        })

        expect(store.timers.get('p1').paused).toBe(false)

        act(() => {
            result.current.updateTimer('p1', { note: 'Updated' })
            result.current.focusTimer('p1')
        })

        expect(store.timers.get('p1').note).toBe('Updated')

        const entry = result.current.stopTimer('p1')
        expect(entry).toBeTruthy()
        expect(store.timers.has('p1')).toBe(false)
        expect(store.activeTimeEntries.has(entry.id)).toBe(true)
    })

    it('clears timers without creating entries', () => {
        const timers = createObservableMap({
            p1: { projectId: 'p1', taskId: 't1', startTime: Date.now(), paused: false, pausedElapsedTime: 0, note: '', lastActive: Date.now() }
        })
        const tasks = createObservableMap({ t1: { id: 't1', projectId: 'p1' } })
        const activeTimeEntries = createObservableMap()

        const store = {
            timers,
            tasks,
            activeTimeEntries,
            coreDoc: { transact: (fn) => fn() },
            activeEntriesDoc: { transact: (fn) => fn() },
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
