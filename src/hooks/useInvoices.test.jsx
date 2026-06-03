// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useInvoices } from './useInvoices'
import { useYjs } from '@/contexts/YjsContext'
import { useYjsCollection } from './useYjsCollection'
import { fetchExchangeRates } from '@/utils/currencyUtils'
import { createTestYMap, readStored } from '@/test/yjs-test-helpers'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/utils/currencyUtils', async () => {
    const actual = await vi.importActual('@/utils/currencyUtils')
    return {
        ...actual,
        fetchExchangeRates: vi.fn(),
    }
})

const mockUseYjs = useYjs
const mockUseYjsCollection = useYjsCollection
const mockFetchExchangeRates = vi.mocked(fetchExchangeRates)

const mockPreferences = {
    get: vi.fn(() => 'EUR')
}

describe('useInvoices', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPreferences.get.mockReturnValue('EUR')
    })

    it('combines active and archived invoices, sorts, filters, and updates status', async () => {
        const archivedMap = createTestYMap({
            c: { id: 'c', status: 'paid', date: '2024-12-31', total: 50, clientId: 'c1', projectId: 'p1' },
        })
        const loadArchivedInvoices = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap, preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices,
        })

        const update = vi.fn()
        mockFetchExchangeRates.mockResolvedValue({
            rates: { USD: 1, EUR: 0.85 },
            error: null,
        })
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'a', status: 'draft', date: '2025-01-02', total: 100, clientId: 'c1', projectId: 'p1' },
                { id: 'b', status: 'sent', date: '2025-01-01', dueDate: '2025-01-01', total: 200, clientId: 'c2', projectId: 'p2', currency: 'USD' },
            ],
            isLoading: false,
            get: vi.fn((id) => (id === 'c'
                ? { id: 'c', status: 'sent', date: '2024-12-31', total: 50, currency: 'USD', clientId: 'c1', projectId: 'p1' }
                : { id }
            )),
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

        await act(async () => {
            result.current.markAsSent('a')
            await result.current.markAsPaid('c')
        })

        expect(update).toHaveBeenCalledWith('a', { status: 'sent', paidAt: null, paymentCurrencySnapshot: undefined })
        expect(update).toHaveBeenCalledWith('c', expect.objectContaining({
            status: 'paid',
            paymentCurrencySnapshot: expect.objectContaining({
                sourceCurrency: 'USD',
                preferredCurrencyAtPayment: 'EUR',
            }),
        }))
    })

    it('requests archived invoices when includeArchived is true', async () => {
        const loadArchivedInvoices = vi.fn(async () => {})
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
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
            store: { archivedInvoicesSync: null, preferences: mockPreferences },
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
        const archivedMap = createTestYMap({
            x: { id: 'x', status: 'paid', date: '2024-12-31', total: 75, clientId: 'c1', projectId: 'p1' },
        })

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap, preferences: mockPreferences },
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
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
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

    it('releases task quoted amounts when deleting an invoice', () => {
        const tasksMap = createTestYMap({
            'task-1': {
                id: 'task-1',
                title: 'Quoted task',
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: 'inv-1',
                    billedAt: 100,
                    total: 500,
                },
            },
            'task-2': {
                id: 'task-2',
                title: 'Other quoted task',
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: 'inv-2',
                    billedAt: 100,
                    total: 300,
                },
            },
        })
        const remove = vi.fn(() => true)

        mockUseYjs.mockReturnValue({
            store: {
                archivedInvoicesSync: createTestYMap(),
                archivedTasks: null,
                preferences: mockPreferences,
                tasks: tasksMap,
            },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove,
        })

        const { result } = renderHook(() => useInvoices())

        expect(result.current.deleteInvoice('inv-1')).toBe(true)
        expect(remove).toHaveBeenCalledWith('inv-1')
        expect(readStored(tasksMap, 'task-1')).toEqual(expect.objectContaining({
            estimatedFlatAmount: 500,
            quotedAmountBilling: null,
        }))
        expect(readStored(tasksMap, 'task-2')).toEqual(expect.objectContaining({
            estimatedFlatAmount: null,
            quotedAmountBilling: expect.objectContaining({ invoiceId: 'inv-2' }),
        }))
    })

    it('loads archived tasks to release quoted amounts when deleting an invoice', async () => {
        const tasksMap = createTestYMap()
        let archivedTasksMap = null
        const loadArchivedTasks = vi.fn(async () => {
            archivedTasksMap = createTestYMap({
                'archived-task-1': {
                    id: 'archived-task-1',
                    title: 'Archived quoted task',
                    estimatedFlatAmount: null,
                    quotedAmountBilling: {
                        invoiceId: 'inv-1',
                        billedAt: 100,
                        total: 800,
                    },
                },
            })
        })
        const remove = vi.fn(() => true)

        mockUseYjs.mockReturnValue({
            store: {
                archivedInvoicesSync: createTestYMap(),
                get archivedTasks() {
                    return archivedTasksMap
                },
                preferences: mockPreferences,
                tasks: tasksMap,
            },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove,
        })

        const { result } = renderHook(() => useInvoices())

        expect(result.current.deleteInvoice('inv-1')).toBe(true)

        await waitFor(() => expect(loadArchivedTasks).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            expect(readStored(archivedTasksMap, 'archived-task-1')).toEqual(expect.objectContaining({
                estimatedFlatAmount: 800,
                quotedAmountBilling: null,
            }))
        })
    })

    it('includes shared invoices when filtering by project id', () => {
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'shared', status: 'sent', date: '2025-01-06', total: 90, clientId: 'c1', projectId: 'p1', projectIds: ['p1', 'p2'] },
                { id: 'single', status: 'sent', date: '2025-01-05', total: 40, clientId: 'c1', projectId: 'p3' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices({ projectId: 'p2' }))

        expect(result.current.invoices.map((invoice) => invoice.id)).toEqual(['shared'])
        expect(result.current.totals).toEqual({ outstanding: 90, paid: 0, total: 90 })
    })

    it('does not load archived invoices when store is not ready', () => {
        const loadArchivedInvoices = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
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
        const archivedMap = createTestYMap({
            x: { id: 'x', status: 'paid', date: '2024-12-31', total: 75, clientId: 'c1', projectId: 'p1' },
        })

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: archivedMap, preferences: mockPreferences },
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

    it('marks invoices unpaid by clearing payment metadata and restoring sent status', () => {
        const update = vi.fn()
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn((id) => id === 'paid-invoice'
                ? { id, status: 'paid', paidAt: 1700000000000, dueDate: '2099-01-01', total: 100, clientId: 'c1', projectId: 'p1' }
                : undefined),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices())

        act(() => {
            result.current.markAsUnpaid('paid-invoice')
        })

        expect(update).toHaveBeenCalledWith('paid-invoice', {
            status: 'sent',
            paidAt: null,
            paymentCurrencySnapshot: undefined,
        })
    })

    it('returns undefined when markAsPaid or markAsUnpaid target a missing invoice', async () => {
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => undefined),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices())

        await expect(result.current.markAsPaid('missing')).resolves.toBeUndefined()
        expect(result.current.markAsUnpaid('missing')).toBeUndefined()
    })

    it('marks same-currency invoices paid without storing a snapshot when exchange rates are unavailable', async () => {
        const update = vi.fn()
        mockFetchExchangeRates.mockResolvedValue({ rates: null, error: 'offline' })
        mockPreferences.get.mockReturnValue('USD')

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn((id) => id === 'usd-invoice'
                ? { id, status: 'sent', total: 100, currency: 'USD', clientId: 'c1', projectId: 'p1' }
                : undefined),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices())

        await act(async () => {
            await result.current.markAsPaid('usd-invoice')
        })

        expect(update).toHaveBeenCalledWith('usd-invoice', expect.objectContaining({
            status: 'paid',
            paymentCurrencySnapshot: undefined,
        }))
    })

    it('throws when a cross-currency paid snapshot cannot fetch exchange rates', async () => {
        mockFetchExchangeRates.mockResolvedValue({ rates: null, error: 'offline' })
        mockPreferences.get.mockReturnValue('EUR')

        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn((id) => id === 'usd-invoice'
                ? { id, status: 'sent', total: 100, currency: 'USD', clientId: 'c1', projectId: 'p1' }
                : undefined),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices())

        await expect(result.current.markAsPaid('usd-invoice')).rejects.toThrow('offline')
    })
})
