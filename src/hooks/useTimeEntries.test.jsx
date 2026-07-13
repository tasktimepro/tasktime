// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useTimeEntries } from './useTimeEntries'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap, readStored } from '@/test/yjs-test-helpers'
import * as Y from 'yjs'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

describe('useTimeEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters entries by task and date range', async () => {
        const activeTimeEntries = createTestYMap({
            e1: { id: 'e1', taskId: 't1', start: 10, end: 20 },
            e2: { id: 'e2', taskId: 't2', start: 30, end: 40 },
            e3: { id: 'e3', taskId: 't1', start: 50, end: 60 },
        })

        const store = {
            activeTimeEntries,
            getAllTimeEntries: () => [...activeTimeEntries.values()],
            isYearLoaded: vi.fn(() => true),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(() => [2025]),
        })

        const { result } = renderHook(() => useTimeEntries({ taskId: 't1', startDate: 15, endDate: 55 }))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.entries.map((e) => e.id)).toEqual(['e3', 'e1'])
    })

    it('creates, updates, and deletes entries', async () => {
        const createdAt = Date.parse('2026-04-14T12:00:00.000Z')
        const updatedAt = Date.parse('2026-04-14T12:00:05.000Z')
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(createdAt)

        const activeTimeEntries = createTestYMap()
        const store = {
            activeTimeEntries,
            getAllTimeEntries: () => [...activeTimeEntries.values()],
            isYearLoaded: vi.fn(() => true),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(() => []),
        })

        const { result } = renderHook(() => useTimeEntries())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let createdEntry
        await act(async () => {
            createdEntry = result.current.createEntry({ taskId: 't1', start: 1, end: 2 })
        })

        await waitFor(() => expect(result.current.entries).toHaveLength(1))
        expect(createdEntry.createdAt).toBe(createdAt)
        expect(createdEntry.updatedAt).toBe(createdAt)

        let updatedEntry
        await act(async () => {
            nowSpy.mockReturnValue(updatedAt)
            updatedEntry = result.current.updateEntry(createdEntry.id, { note: 'Updated' })
        })

        expect(updatedEntry?.note).toBe('Updated')
        expect(updatedEntry?.updatedAt).toBe(updatedAt)

        const created = store.activeTimeEntries.get(createdEntry.id)
        expect(created).toBeTruthy()
        expect(readStored(store.activeTimeEntries, createdEntry.id)?.note).toBe('Updated')
        expect(readStored(store.activeTimeEntries, createdEntry.id)?.updatedAt).toBe(updatedAt)

        await act(async () => {
            expect(result.current.deleteEntry(createdEntry.id)).toBe(true)
        })

        await waitFor(() => expect(result.current.entries).toHaveLength(0))
        nowSpy.mockRestore()
    })

    it('routes manual create, update, and delete through shared validation', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()
        const tasks = createTestYMap({
            t1: { id: 't1', title: 'Task', projectId: 'p1' },
        }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'timeEntries')
        const store = {
            tasks,
            activeTimeEntries,
            activeEntriesDoc,
            getAllTimeEntries: () => Array.from(activeTimeEntries.values()).map((value) => (
                value instanceof Y.Map ? Object.fromEntries(value.entries()) : value
            )),
            isYearLoaded: vi.fn(() => true),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(() => []),
        })

        const { result } = renderHook(() => useTimeEntries())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let entry
        await act(async () => {
            entry = await result.current.createManualEntry({ taskId: 't1', start: 1000, end: 2000 })
        })
        expect(readStored(activeTimeEntries, entry.id)).toEqual(expect.objectContaining({ taskId: 't1' }))

        await act(async () => {
            await result.current.updateManualEntry(entry.id, { end: 3000, note: 'Updated' })
        })
        expect(readStored(activeTimeEntries, entry.id)).toEqual(expect.objectContaining({ end: 3000, note: 'Updated' }))

        await act(async () => {
            await expect(result.current.deleteManualEntry(entry.id)).resolves.toBe(true)
        })
        expect(activeTimeEntries.has(entry.id)).toBe(false)
    })

    it('loads historical entries before validating a manual overlap', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()
        const tasks = createTestYMap({
            t1: { id: 't1', title: 'Task', projectId: 'p1' },
        }, coreDoc, 'tasks')
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'timeEntries')
        const historicalEntry = { id: 'historical', taskId: 't1', start: 1_000, end: 3_000 }
        const loadAllTimeEntries = vi.fn(async () => [historicalEntry])
        const store = {
            tasks,
            activeTimeEntries,
            activeEntriesDoc,
            loadAllTimeEntries,
            getAllTimeEntries: () => [],
            isYearLoaded: vi.fn(() => false),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(async () => [2024]),
        })

        const { result } = renderHook(() => useTimeEntries())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await expect(result.current.createManualEntry({
                taskId: 't1',
                start: 2_000,
                end: 4_000,
            })).rejects.toThrow(/overlaps/)
        })
        expect(loadAllTimeEntries).toHaveBeenCalledTimes(1)
        expect(activeTimeEntries.size).toBe(0)
    })

    it('supports archived task lookups and protected manual-entry edge branches', async () => {
        const coreDoc = new Y.Doc()
        const activeEntriesDoc = new Y.Doc()
        const tasks = createTestYMap({
            target: { id: 'target', title: 'Target', projectId: 'p1' },
        }, coreDoc, 'tasks')
        const archivedTasks = createTestYMap({
            source: { id: 'source', title: 'Archived source', projectId: 'p2', archived: true },
        })
        const activeTimeEntries = createTestYMap({}, activeEntriesDoc, 'timeEntries')
        const loadArchivedTasks = vi.fn(async () => archivedTasks)
        const loadAllTimeEntries = vi.fn(async () => Array.from(activeTimeEntries.keys())
            .map((id) => readStored(activeTimeEntries, id)))
        const store = {
            tasks,
            archivedTasks: null,
            activeTimeEntries,
            activeEntriesDoc,
            loadArchivedTasks,
            loadAllTimeEntries,
            getAllTimeEntries: () => [],
            isYearLoaded: vi.fn(() => true),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(async () => []),
        })

        const { result } = renderHook(() => useTimeEntries())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let created
        await act(async () => {
            created = await result.current.createManualEntry({
                taskId: 'source',
                start: 1_000,
                end: 2_000,
                billingIncrementMinutes: 15,
            })
        })
        expect(created.billingIncrementMinutes).toBe(15)

        await act(async () => {
            await result.current.updateManualEntry(created.id, {
                taskId: 'target',
                start: 3_000,
                end: 4_000,
                billingIncrementMinutes: null,
            })
        })
        expect(readStored(activeTimeEntries, created.id)).toEqual(expect.objectContaining({
            taskId: 'target',
            billedDurationMs: null,
            billingIncrementMinutes: null,
        }))

        await act(async () => {
            activeTimeEntries.set('archived-delete', {
                id: 'archived-delete', taskId: 'source', start: 5_000, end: 6_000,
            })
            await expect(result.current.deleteManualEntry('archived-delete')).resolves.toBe(true)
            await expect(result.current.updateManualEntry('missing', { note: 'Nope' })).resolves.toBeUndefined()
            await expect(result.current.deleteManualEntry('missing')).resolves.toBe(false)
            await expect(result.current.createManualEntry({
                taskId: 'missing', start: 7_000, end: 8_000,
            })).rejects.toThrow('Task not found')
        })
        expect(loadArchivedTasks).toHaveBeenCalled()
    })

    it('throws when creating entries and store is not ready', async () => {
        const store = {
            activeTimeEntries: createTestYMap(),
            getAllTimeEntries: () => [],
            isYearLoaded: vi.fn(() => true),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: false,
            loadEntriesForYear: vi.fn(async () => {}),
            getAvailableYears: vi.fn(() => []),
        })

        const { result } = renderHook(() => useTimeEntries())

        expect(() => result.current.createEntry({ taskId: 't1', start: 1, end: 2 })).toThrow('Store not ready')
        expect(result.current.updateEntry('missing', { note: 'Nope' })).toBeUndefined()
        expect(result.current.deleteEntry('missing')).toBe(false)
        await expect(result.current.createManualEntry({ taskId: 't1', start: 1, end: 2 })).rejects.toThrow('Store not ready')
        await expect(result.current.updateManualEntry('missing', { note: 'Nope' })).resolves.toBeUndefined()
        await expect(result.current.deleteManualEntry('missing')).resolves.toBe(false)
    })

    it('loads year when requested', async () => {
        const loadEntriesForYear = vi.fn(async () => {})
        const activeTimeEntries = createTestYMap()
        const store = {
            activeTimeEntries,
            getAllTimeEntries: () => [...activeTimeEntries.values()],
            isYearLoaded: vi.fn(() => false),
        }

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadEntriesForYear,
            getAvailableYears: vi.fn(() => [2024]),
        })

        const { result } = renderHook(() => useTimeEntries())

        await act(async () => {
            await result.current.loadYear(2024)
        })

        expect(loadEntriesForYear).toHaveBeenCalledWith(2024)
    })
})
