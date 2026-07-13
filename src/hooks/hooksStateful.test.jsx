// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
import { usePreferences } from './usePreferences'
import { useTimeEntries } from './useTimeEntries'
import { useTimers } from './useTimers'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap, readStored } from '@/test/yjs-test-helpers'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

describe('stateful hooks', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('syncs and updates preferences', async () => {
        const prefMap = createTestYMap({ theme: 'dark' })
        const originalSet = prefMap.set.bind(prefMap)
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
        expect(setSpy).toHaveBeenCalledWith('currency', 'EUR')
    })

    it('manages time entries with filters and CRUD', async () => {
        const start = Date.UTC(2025, 0, 1)
        const end = Date.UTC(2025, 0, 2)
        const entries = [
            { id: 'a', taskId: 't1', start: start, end: end, note: '' },
            { id: 'b', taskId: 't1', start: end + 1000, end: end + 2000, note: '' },
        ]

        const activeMap = createTestYMap(entries.reduce((acc, e) => ({ ...acc, [e.id]: e }), {}))
        const loadEntriesForYear = vi.fn(async () => {})
        const store = {
            activeTimeEntries: activeMap,
            getAllTimeEntries: vi.fn(() => [...activeMap.values()]),
            isYearLoaded: vi.fn(() => false),
            activeEntriesDoc: activeMap.doc,
            coreDoc: new Y.Doc(),
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
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'))

        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()

        const timersMap = createTestYMap({}, coreDoc, 'timers')
        const tasksMap = createTestYMap({
            'task-1': { id: 'task-1', title: 'Task', projectId: 'project-1' }
        }, coreDoc, 'tasks')
        const entriesMap = createTestYMap({}, activeEntriesDoc, 'entries')
        const store = {
            timers: timersMap,
            tasks: tasksMap,
            activeTimeEntries: entriesMap,
            coreDoc,
            activeEntriesDoc,
        }

        mockUseYjs.mockReturnValue({ store, isReady: true })

        const { result } = renderHook(() => useTimers())
        await act(async () => {})
        expect(result.current.isLoading).toBe(false)

        await act(async () => {
            result.current.startTimer('task-1', 'Note')
        })
        expect(result.current.timers.length).toBe(1)
        expect(readStored(timersMap, 'project-1')?.note).toBe('Note')

        await act(async () => {
            vi.advanceTimersByTime(1_500)
        })

        await act(async () => {
            result.current.pauseTimer('project-1')
        })
        expect(readStored(timersMap, 'project-1')?.paused).toBe(true)

        await act(async () => {
            vi.advanceTimersByTime(2_000)
        })

        await act(async () => {
            result.current.resumeTimer('project-1')
        })
        expect(readStored(timersMap, 'project-1')?.paused).toBe(false)

        let entry
        await act(async () => {
            entry = await result.current.stopTimer('project-1')
        })
        expect(entry?.taskId).toBe('task-1')
        expect(readStored(entriesMap, entry.id)?.taskId).toBe('task-1')
        await act(async () => {})
        expect(result.current.timers.length).toBe(0)

        vi.useRealTimers()
    })
})
