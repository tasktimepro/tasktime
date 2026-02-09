// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useInvoices } from './useInvoices'
import { useYjs } from '@/contexts/YjsContext'
import { useYjsCollection } from './useYjsCollection'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjs = useYjs
const mockUseYjsCollection = useYjsCollection

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
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    }
}

describe('useInvoices', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('combines active and archived invoices, sorts, filters, and updates status', async () => {
        const archivedMap = createObservableMap({
            c: { id: 'c', status: 'paid', date: '2024-12-31', total: 50, clientId: 'c1', projectId: 'p1' },
        })
        const loadArchivedInvoices = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap },
            isReady: true,
            loadArchivedInvoices,
        })

        const update = vi.fn()
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'draft', date: '2025-01-02', total: 100, clientId: 'c1', projectId: 'p1' },
                { id: 'b', status: 'overdue', date: '2025-01-01', total: 200, clientId: 'c2', projectId: 'p2' },
            ],
            isLoading: false,
            get: vi.fn((id) => ({ id })),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ includeArchived: false }))

        await act(async () => {})

        expect(result.current.invoices.map((i) => i.id)).toEqual(['a', 'b'])
        expect(result.current.draftInvoices.map((i) => i.id)).toEqual(['a'])
        expect(result.current.paidInvoices.map((i) => i.id)).toEqual([])
        expect(result.current.overdueInvoices.map((i) => i.id)).toEqual(['b'])
        expect(result.current.totals).toEqual({ outstanding: 300, paid: 0, total: 300 })

        act(() => {
            result.current.markAsSent('a')
            result.current.markAsPaid('c')
        })

        expect(update).toHaveBeenCalledWith('a', { status: 'sent' })
        expect(update).toHaveBeenCalledWith('c', expect.objectContaining({ status: 'paid' }))
    })

    it('requests archived invoices when includeArchived is true', async () => {
        const loadArchivedInvoices = vi.fn(async () => {})
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createObservableMap() },
            isReady: true,
            loadArchivedInvoices,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        renderHook(() => useInvoices({ includeArchived: true }))

        await waitFor(() => expect(loadArchivedInvoices).toHaveBeenCalled())
    })

    it('loads archived invoices, filters by client/project, and reacts to archive updates', async () => {
        const loadArchivedInvoices = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: null },
            isReady: true,
            loadArchivedInvoices,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'sent', date: '2025-01-04', total: 100, clientId: 'c1', projectId: 'p1' },
                { id: 'b', status: 'draft', date: '2025-01-02', total: 200, clientId: 'c2', projectId: 'p2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ includeArchived: true, clientId: 'c1', projectId: 'p1' }))

        await act(async () => {})

        await waitFor(() => expect(loadArchivedInvoices).toHaveBeenCalled())

        await act(async () => {
            await loadArchivedInvoices.mock.results[0].value
        })

        await act(async () => {})

        expect(result.current.invoices.map((invoice) => invoice.id)).toEqual(['a'])
    })

    it('does not include archived invoices when includeArchived is false', () => {
        const archivedMap = createObservableMap({
            x: { id: 'x', status: 'paid', date: '2024-12-31', total: 75, clientId: 'c1', projectId: 'p1' },
        })

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'sent', date: '2025-01-04', total: 100, clientId: 'c1', projectId: 'p1' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ includeArchived: false }))

        expect(result.current.invoices.map((i) => i.id)).toEqual(['a'])
    })

    it('filters by client/project and computes totals with mixed statuses', () => {
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createObservableMap() },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'paid', date: '2025-01-10', total: 100, clientId: 'c1', projectId: 'p1' },
                { id: 'b', status: 'sent', date: '2025-01-05', total: 50, clientId: 'c1', projectId: 'p1' },
                { id: 'c', status: 'draft', date: '2025-01-08', total: 25, clientId: 'c2', projectId: 'p2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ clientId: 'c1', projectId: 'p1' }))

        expect(result.current.invoices.map((i) => i.id)).toEqual(['a', 'b'])
        expect(result.current.paidInvoices.map((i) => i.id)).toEqual(['a'])
        expect(result.current.sentInvoices.map((i) => i.id)).toEqual(['b'])
        expect(result.current.totals).toEqual({ outstanding: 50, paid: 100, total: 150 })
    })

    it('does not load archived invoices when store is not ready', () => {
        const loadArchivedInvoices = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createObservableMap() },
            isReady: false,
            loadArchivedInvoices,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: true,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ includeArchived: true }))

        expect(loadArchivedInvoices).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(true)
    })

    it('uses archived invoices when already available in store', async () => {
        const archivedMap = createObservableMap({
            x: { id: 'x', status: 'paid', date: '2024-12-31', total: 75, clientId: 'c1', projectId: 'p1' },
        })

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'sent', date: '2025-01-04', total: 100, clientId: 'c1', projectId: 'p1' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ includeArchived: true }))

        await waitFor(() => expect(result.current.invoices.map((i) => i.id)).toEqual(['a', 'x']))
    })
})
