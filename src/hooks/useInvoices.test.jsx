// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
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

    it('undoes the latest invoice and restores linked billing state across collections', async () => {
        const coreDoc = new Y.Doc()
        const activeEntries = createTestYMap({
            'entry-current': {
                id: 'entry-current',
                taskId: 'task-1',
                start: new Date('2026-01-05T09:00:00Z').getTime(),
                end: new Date('2026-01-05T11:00:00Z').getTime(),
                billedInvoiceId: 'inv-2',
                billedAt: 200,
                billedHourlyRate: 100,
            },
            'entry-adjustment': {
                id: 'entry-adjustment',
                taskId: 'task-1',
                start: new Date('2026-01-05T11:00:00Z').getTime(),
                end: new Date('2026-01-05T12:00:00Z').getTime(),
                source: 'invoice-adjustment',
                billedInvoiceId: 'inv-2',
                billedAt: 200,
                billedHourlyRate: 100,
            },
        }, undefined, 'timeEntries')
        const year2025Entries = createTestYMap({
            'entry-previous': {
                id: 'entry-previous',
                taskId: 'task-1',
                start: new Date('2025-12-15T09:00:00Z').getTime(),
                end: new Date('2025-12-15T10:00:00Z').getTime(),
                billedInvoiceId: 'inv-1',
                billedAt: 100,
                billedHourlyRate: 90,
            },
            'entry-historical-current': {
                id: 'entry-historical-current',
                taskId: 'task-1',
                start: new Date('2025-12-20T09:00:00Z').getTime(),
                end: new Date('2025-12-20T10:00:00Z').getTime(),
                billedInvoiceId: 'inv-2',
                billedAt: 200,
                billedHourlyRate: 100,
            },
        }, undefined, 'timeEntries')
        const tasksMap = createTestYMap({
            'task-1': {
                id: 'task-1',
                title: 'Implementation',
                lastBilledAt: new Date('2026-01-05T12:00:00Z').getTime(),
            },
        }, coreDoc, 'tasks')
        const archivedTasksMap = createTestYMap({
            'task-quoted': {
                id: 'task-quoted',
                title: 'Quoted Task',
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: 'inv-2',
                    billedAt: 200,
                    total: 500,
                },
            },
        })
        const expensesMap = createTestYMap({
            'expense-active': {
                id: 'expense-active',
                title: 'Hosting',
                date: '2026-01-05',
                amount: 25,
                currency: 'EUR',
                paymentStatus: 'paid',
                billingStatus: 'billed',
                billable: true,
                isPersonal: false,
                clientId: 'client-1',
                projectId: 'project-1',
                invoiceId: 'inv-2',
                billedAt: 200,
            },
        }, coreDoc, 'expenses')
        const archivedExpensesMap = createTestYMap({
            'expense-archived': {
                id: 'expense-archived',
                title: 'Travel',
                date: '2025-12-15',
                amount: 10,
                currency: 'EUR',
                paymentStatus: 'paid',
                billingStatus: 'billed',
                billable: true,
                isPersonal: false,
                clientId: 'client-1',
                projectId: 'project-1',
                invoiceId: 'inv-2',
                billedAt: 200,
            },
        })
        const projectsMap = createTestYMap({
            'project-1': {
                id: 'project-1',
                title: 'Project',
                invoiceIds: ['inv-1', 'inv-2'],
            },
        }, coreDoc, 'projects')
        const templatesMap = createTestYMap({
            'tpl-1': {
                id: 'tpl-1',
                name: 'Default Template',
                useSequentialNumbers: true,
                currentSequentialNumber: 3,
                invoiceNumberFormat: 'INV-{sequential}',
            },
        }, coreDoc, 'invoiceTemplates')
        const invoicesMap = createTestYMap({
            'inv-1': {
                id: 'inv-1',
                invoiceNumber: 'INV-1',
                templateId: 'tpl-1',
                clientId: 'client-1',
                projectId: 'project-1',
                date: '2026-01-01',
                status: 'sent',
                subtotal: 100,
                total: 100,
                items: [],
                createdAt: 1,
            },
            'inv-2': {
                id: 'inv-2',
                invoiceNumber: 'INV-2',
                templateId: 'tpl-1',
                billingStateSnapshot: {
                    version: 1,
                    capturedAt: 200,
                    taskLastBilledAt: {
                        'task-1': new Date('2025-12-15T10:00:00Z').getTime(),
                    },
                },
                clientId: 'client-1',
                projectId: 'project-1',
                date: '2026-01-05',
                status: 'sent',
                subtotal: 135,
                total: 135,
                items: [],
                createdAt: 2,
            },
        }, coreDoc, 'invoices')
        const loadedYearMaps = new Map()
        const loadArchivedTasks = vi.fn(async () => {
            store.archivedTasks = archivedTasksMap
            return archivedTasksMap
        })
        const loadArchivedExpenses = vi.fn(async () => {
            store.archivedExpenses = archivedExpensesMap
            return archivedExpensesMap
        })
        const loadEntriesForYear = vi.fn(async (year) => {
            if (year === 2025) {
                loadedYearMaps.set(2025, year2025Entries)
                return year2025Entries
            }

            return createTestYMap({}, undefined, 'timeEntries')
        })
        const store = {
            archivedInvoicesSync: createTestYMap(),
            archivedTasks: null,
            archivedExpenses: null,
            preferences: mockPreferences,
            tasks: tasksMap,
            expenses: expensesMap,
            projects: projectsMap,
            invoiceTemplates: templatesMap,
            invoices: invoicesMap,
            activeTimeEntries: activeEntries,
            coreDoc,
            getAllTimeEntries: () => {
                const active = Array.from(activeEntries.values())
                const archived = Array.from(loadedYearMaps.values()).flatMap((map) => Array.from(map.values()))
                return [...active, ...archived]
            },
        }
        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks,
            loadArchivedExpenses,
            loadEntriesForYear,
            getAvailableYears: vi.fn(async () => [2025]),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                readStored(invoicesMap, 'inv-1'),
                readStored(invoicesMap, 'inv-2'),
            ],
            isLoading: false,
            get: vi.fn((id) => readStored(invoicesMap, id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn((id) => invoicesMap.delete(id)),
        })

        const { result } = renderHook(() => useInvoices())

        await act(async () => {
            await expect(result.current.undoLatestInvoice('inv-2')).resolves.toEqual({
                invoiceNumber: 'INV-2',
                clearedTimeEntryCount: 2,
                deletedAdjustmentCount: 1,
                unbilledExpenseCount: 2,
                rewoundSequence: true,
            })
        })

        expect(invoicesMap.has('inv-2')).toBe(false)
        expect(readStored(projectsMap, 'project-1')).toEqual(expect.objectContaining({
            invoiceIds: ['inv-1'],
        }))
        expect(readStored(templatesMap, 'tpl-1')).toEqual(expect.objectContaining({
            currentSequentialNumber: 2,
        }))
        expect(readStored(activeEntries, 'entry-current')).toEqual(expect.objectContaining({
            billedInvoiceId: null,
            billedAt: null,
            billedHourlyRate: null,
        }))
        expect(activeEntries.has('entry-adjustment')).toBe(false)
        expect(readStored(year2025Entries, 'entry-previous')).toEqual(expect.objectContaining({
            billedInvoiceId: 'inv-1',
        }))
        expect(readStored(year2025Entries, 'entry-historical-current')).toEqual(expect.objectContaining({
            billedInvoiceId: null,
            billedAt: null,
            billedHourlyRate: null,
        }))
        expect(readStored(tasksMap, 'task-1')).toEqual(expect.objectContaining({
            lastBilledAt: new Date('2025-12-15T10:00:00Z').getTime(),
        }))
        expect(readStored(archivedTasksMap, 'task-quoted')).toEqual(expect.objectContaining({
            estimatedFlatAmount: 500,
            quotedAmountBilling: null,
        }))
        expect(readStored(expensesMap, 'expense-active')).toEqual(expect.objectContaining({
            billingStatus: 'unbilled',
            invoiceId: null,
            billedAt: null,
        }))
        expect(readStored(archivedExpensesMap, 'expense-archived')).toEqual(expect.objectContaining({
            billingStatus: 'unbilled',
            invoiceId: null,
            billedAt: null,
        }))
    })

    it('fails closed when archived billing state cannot be loaded', async () => {
        const coreDoc = new Y.Doc()
        const activeEntries = createTestYMap({
            'entry-current': {
                id: 'entry-current',
                taskId: 'task-1',
                start: new Date('2026-01-05T09:00:00Z').getTime(),
                end: new Date('2026-01-05T11:00:00Z').getTime(),
                billedInvoiceId: 'inv-2',
                billedAt: 200,
                billedHourlyRate: 100,
            },
        }, undefined, 'timeEntries')
        const invoicesMap = createTestYMap({
            'inv-2': {
                id: 'inv-2',
                invoiceNumber: 'INV-2',
                clientId: 'client-1',
                projectId: 'project-1',
                date: '2026-01-05',
                status: 'sent',
                subtotal: 100,
                total: 100,
                items: [],
                createdAt: 2,
            },
        }, coreDoc, 'invoices')
        const remove = vi.fn((id) => invoicesMap.delete(id))

        mockUseYjs.mockReturnValue({
            store: {
                archivedInvoicesSync: createTestYMap(),
                archivedTasks: null,
                archivedExpenses: null,
                preferences: mockPreferences,
                tasks: createTestYMap({}, coreDoc, 'tasks'),
                expenses: createTestYMap({}, coreDoc, 'expenses'),
                projects: createTestYMap({}, coreDoc, 'projects'),
                invoiceTemplates: createTestYMap({}, coreDoc, 'invoiceTemplates'),
                invoices: invoicesMap,
                activeTimeEntries: activeEntries,
                coreDoc,
                getAllTimeEntries: () => Array.from(activeEntries.values()),
            },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks: vi.fn(async () => {
                throw new Error('archived tasks unavailable')
            }),
            loadArchivedExpenses: vi.fn(async () => createTestYMap()),
            loadEntriesForYear: vi.fn(async () => createTestYMap({}, undefined, 'timeEntries')),
            getAvailableYears: vi.fn(async () => []),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [readStored(invoicesMap, 'inv-2')],
            isLoading: false,
            get: vi.fn((id) => readStored(invoicesMap, id)),
            create: vi.fn(),
            update: vi.fn(),
            remove,
        })

        const { result } = renderHook(() => useInvoices())

        await expect(result.current.undoLatestInvoice('inv-2')).rejects.toThrow('archived tasks unavailable')
        expect(remove).not.toHaveBeenCalled()
        expect(invoicesMap.has('inv-2')).toBe(true)
        expect(readStored(activeEntries, 'entry-current')).toEqual(expect.objectContaining({
            billedInvoiceId: 'inv-2',
            billedAt: 200,
            billedHourlyRate: 100,
        }))
    })

    it('uses a legacy cutoff fallback when undoing invoices without a billing snapshot', async () => {
        const coreDoc = new Y.Doc()
        const previousLegacyCutoff = new Date('2026-01-01T10:00:00Z').getTime()
        const invoiceEntryStart = new Date('2026-01-05T09:00:00Z').getTime()
        const activeEntries = createTestYMap({
            'entry-current': {
                id: 'entry-current',
                taskId: 'task-1',
                start: invoiceEntryStart,
                end: new Date('2026-01-05T11:00:00Z').getTime(),
                billedInvoiceId: 'inv-2',
                billedAt: 200,
                billedHourlyRate: 100,
            },
            'entry-old-unmarked': {
                id: 'entry-old-unmarked',
                taskId: 'task-1',
                start: new Date('2025-12-30T09:00:00Z').getTime(),
                end: previousLegacyCutoff,
            },
        }, undefined, 'timeEntries')
        const tasksMap = createTestYMap({
            'task-1': {
                id: 'task-1',
                title: 'Implementation',
                lastBilledAt: new Date('2026-01-05T11:00:00Z').getTime(),
            },
        }, coreDoc, 'tasks')
        const invoicesMap = createTestYMap({
            'inv-2': {
                id: 'inv-2',
                invoiceNumber: 'INV-2',
                clientId: 'client-1',
                projectId: 'project-1',
                date: '2026-01-05',
                status: 'sent',
                subtotal: 100,
                total: 100,
                items: [],
                tasks: [{ id: 'task-1' }],
                createdAt: 2,
            },
        }, coreDoc, 'invoices')

        mockUseYjs.mockReturnValue({
            store: {
                archivedInvoicesSync: createTestYMap(),
                archivedTasks: createTestYMap(),
                archivedExpenses: createTestYMap(),
                preferences: mockPreferences,
                tasks: tasksMap,
                expenses: createTestYMap({}, coreDoc, 'expenses'),
                projects: createTestYMap({}, coreDoc, 'projects'),
                invoiceTemplates: createTestYMap({}, coreDoc, 'invoiceTemplates'),
                invoices: invoicesMap,
                activeTimeEntries: activeEntries,
                coreDoc,
                getAllTimeEntries: () => Array.from(activeEntries.values()),
            },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks: vi.fn(async () => createTestYMap()),
            loadArchivedExpenses: vi.fn(async () => createTestYMap()),
            loadEntriesForYear: vi.fn(async () => createTestYMap({}, undefined, 'timeEntries')),
            getAvailableYears: vi.fn(async () => []),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [readStored(invoicesMap, 'inv-2')],
            isLoading: false,
            get: vi.fn((id) => readStored(invoicesMap, id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn((id) => invoicesMap.delete(id)),
        })

        const { result } = renderHook(() => useInvoices())

        await act(async () => {
            await result.current.undoLatestInvoice('inv-2')
        })

        expect(readStored(activeEntries, 'entry-current')).toEqual(expect.objectContaining({
            billedInvoiceId: null,
            billedAt: null,
            billedHourlyRate: null,
        }))
        expect(readStored(tasksMap, 'task-1')).toEqual(expect.objectContaining({
            lastBilledAt: invoiceEntryStart - 1,
        }))
    })

    it('blocks undo for invoices that are not the latest unpaid invoice', async () => {
        mockUseYjs.mockReturnValue({
            store: { archivedInvoicesSync: createTestYMap(), preferences: mockPreferences },
            isReady: true,
            loadArchivedInvoices: vi.fn(async () => {}),
            loadArchivedTasks: vi.fn(async () => createTestYMap()),
            loadArchivedExpenses: vi.fn(async () => createTestYMap()),
            loadEntriesForYear: vi.fn(async () => createTestYMap()),
            getAvailableYears: vi.fn(async () => []),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'inv-1', invoiceNumber: 'INV-1', status: 'sent', date: '2026-01-01', total: 100, clientId: 'c1', projectId: 'p1', createdAt: 1 },
                { id: 'inv-2', invoiceNumber: 'INV-2', status: 'sent', date: '2026-01-02', total: 100, clientId: 'c1', projectId: 'p1', createdAt: 2 },
            ],
            isLoading: false,
            get: vi.fn((id) => (id === 'inv-1'
                ? { id: 'inv-1', invoiceNumber: 'INV-1', status: 'sent', date: '2026-01-01', total: 100, clientId: 'c1', projectId: 'p1', createdAt: 1 }
                : { id: 'inv-2', invoiceNumber: 'INV-2', status: 'sent', date: '2026-01-02', total: 100, clientId: 'c1', projectId: 'p1', createdAt: 2 }
            )),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoices())

        expect(result.current.canUndoInvoice('inv-1')).toBe(false)
        expect(result.current.getInvoiceUndoBlockReason('inv-1')).toBe('Only the latest unpaid invoice can be undone.')
        await expect(result.current.undoLatestInvoice('inv-1')).rejects.toThrow('Only the latest unpaid invoice can be undone.')
    })
})
