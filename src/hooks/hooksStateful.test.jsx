// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { usePreferences } from './usePreferences'
import { useTimeEntries } from './useTimeEntries'
import { useTimer } from './useTimer'
import { useYjs } from '@/contexts/YjsContext'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

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
        forEach: (cb) => map.forEach((value, key) => cb(value, key)),
        values: () => Array.from(map.values()),
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    }
}

describe('stateful hooks', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('syncs and updates preferences', async () => {
        const prefMap = createObservableMap({ theme: 'dark' })
        const originalSet = prefMap.set
        const setSpy = vi.fn((key, value) => originalSet(key, value))
        prefMap.set = setSpy

        mockUseYjs.mockReturnValue({ store: { preferences: prefMap }, isReady: true })

        const { result } = renderHook(() => usePreferences())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.preferences.theme).toBe('dark')

        act(() => {
            result.current.setPreference('theme', 'light')
            result.current.updatePreferences({ currency: 'EUR', theme: 'system' })
            result.current.resetPreferences()
        })

        expect(setSpy).toHaveBeenCalledWith('theme', 'light')
        expect(setSpy).toHaveBeenCalledWith('currency', 'EUR')
        expect(setSpy).toHaveBeenCalledWith('theme', 'system')
        expect(setSpy).toHaveBeenCalledWith('currency', 'USD')
    })

    it('manages time entries with filters and CRUD', async () => {
        const start = Date.UTC(2025, 0, 1)
        const end = Date.UTC(2025, 0, 2)
        const entries = [
            { id: 'a', taskId: 't1', start: start, end: end, note: '' },
            { id: 'b', taskId: 't1', start: end + 1000, end: end + 2000, note: '' },
        ]

        const activeMap = createObservableMap(entries.reduce((acc, e) => ({ ...acc, [e.id]: e }), {}))
        const loadEntriesForYear = vi.fn(async () => {})
        const store = {
            activeTimeEntries: activeMap,
            getAllTimeEntries: vi.fn(() => activeMap.values()),
            isYearLoaded: vi.fn(() => false),
            activeEntriesDoc: { transact: (fn) => fn() },
            coreDoc: { transact: (fn) => fn() },
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear,
            getAvailableYears: vi.fn(async () => [2025]),
        })

        const { result } = renderHook(() => useTimeEntries({ startDate: start, endDate: end + 5000 }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.entries[0].id).toBe('b')

        await act(async () => {
            const created = result.current.createEntry({ taskId: 't2', start: end + 3000, end: end + 4000, note: 'new' })
            result.current.updateEntry(created.id, { note: 'updated' })
            result.current.deleteEntry('a')
            await result.current.loadYear(2025)
        })

        await waitFor(() => expect(loadEntriesForYear).toHaveBeenCalledWith(2025))
        expect(result.current.getEntriesForTask('t1').length).toBe(1)
        expect(result.current.getTotalTimeForTask('t1')).toBe(1000)
    })

    it('runs timer lifecycle', async () => {
        const timerMap = createObservableMap()
        const entriesMap = createObservableMap()
        const store = {
            timer: timerMap,
            activeTimeEntries: entriesMap,
            coreDoc: { transact: (fn) => fn() },
            activeEntriesDoc: { transact: (fn) => fn() },
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimer())
        await act(async () => {})
        expect(result.current.isLoading).toBe(false)

        await act(async () => {
            result.current.startTimer('task-1', 'Note')
        })
        expect(result.current.isActive).toBe(true)
        expect(timerMap.get('note')).toBe('Note')

        await act(async () => {
            result.current.pauseTimer()
        })
        expect(timerMap.get('paused')).toBe(true)

        await act(async () => {
            result.current.resumeTimer()
        })
        expect(timerMap.get('paused')).toBe(false)

        let entry
        await act(async () => {
            entry = result.current.stopTimer()
        })
        expect(entry?.taskId).toBe('task-1')
        expect(entriesMap.get(entry.id)?.taskId).toBe('task-1')
        await act(async () => {})
        expect(result.current.isActive).toBe(false)
    })
})
