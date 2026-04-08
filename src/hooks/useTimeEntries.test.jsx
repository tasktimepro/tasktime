// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useTimeEntries } from './useTimeEntries'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap, readStored } from '@/test/yjs-test-helpers'

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

        let updatedEntry
        await act(async () => {
            updatedEntry = result.current.updateEntry(createdEntry.id, { note: 'Updated' })
        })

        expect(updatedEntry?.note).toBe('Updated')

        const created = store.activeTimeEntries.get(createdEntry.id)
        expect(created).toBeTruthy()
        expect(readStored(store.activeTimeEntries, createdEntry.id)?.note).toBe('Updated')

        await act(async () => {
            expect(result.current.deleteEntry(createdEntry.id)).toBe(true)
        })

        await waitFor(() => expect(result.current.entries).toHaveLength(0))
    })

    it('throws when creating entries and store is not ready', () => {
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
