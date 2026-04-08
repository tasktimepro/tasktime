// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
import { useExpenses } from './useExpenses'
import { useYjs } from '@/contexts/YjsContext'
import { readStored } from '@/test/yjs-test-helpers'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

const buildExpense = (overrides = {}) => ({
    id: 'expense-default',
    title: 'Test Expense',
    date: '2025-01-01',
    supplierName: null,
    receiptNumber: null,
    currency: 'EUR',
    amount: 10,
    paidOn: null,
    paidBy: null,
    paymentStatus: 'unpaid',
    paymentMode: 'manual',
    clientId: null,
    projectId: null,
    businessId: null,
    isPersonal: true,
    billable: false,
    billingStatus: 'unbilled',
    invoiceId: null,
    billedAt: null,
    isRecurring: false,
    recurrenceId: null,
    amountType: 'fixed',
    taxNumber: null,
    isTaxExempt: false,
    note: null,
    ...overrides,
})

const buildStore = ({ active = [], archived = [] } = {}) => {
    const activeDoc = new Y.Doc()
    const archivedDoc = new Y.Doc()
    const activeMap = activeDoc.getMap('expenses')
    const archivedMap = archivedDoc.getMap('expenses')

    active.forEach((expense) => {
        activeMap.set(expense.id, expense)
    })

    archived.forEach((expense) => {
        archivedMap.set(expense.id, expense)
    })

    const store = {
        expenses: activeMap,
        archivedExpenses: archived.length > 0 ? archivedMap : null,
    }

    const loadArchivedExpenses = vi.fn(async () => {
        store.archivedExpenses = archivedMap
        return archivedMap
    })

    return { store, loadArchivedExpenses }
}

describe('useExpenses', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters and sorts expenses by date desc', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid' }),
                buildExpense({ id: '2', date: '2025-02-01', amount: 20, clientId: 'c1' }),
                buildExpense({ id: '3', date: '2024-12-01', amount: 5, billingStatus: 'billed', billable: true, isPersonal: false, clientId: 'c2' }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({ clientId: 'c1' }))
        expect(result.current.expenses.map((e) => e.id)).toEqual(['2'])
    })

    it('computes totals correctly', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid', billable: true }),
                buildExpense({ id: '2', date: '2025-02-01', amount: 20, billable: true }),
                buildExpense({ id: '3', date: '2024-12-01', amount: 5, billingStatus: 'billed', billable: true }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())
        expect(result.current.totals).toEqual({ total: 35, unpaid: 25, paid: 10, billableUnbilled: 30 })
    })

    it('markAsPaid requires amount for variable expenses', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [buildExpense({
                id: 'v1',
                amount: 0,
                amountType: 'variable',
            })]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        expect(() => result.current.markAsPaid('v1')).toThrow('Amount is required')
    })

    it('markAsPaid updates amount and status', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [buildExpense({
                id: 'v2',
                amount: 0,
                amountType: 'variable',
            })]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.markAsPaid('v2', { amount: 147.23, paidBy: 'Card' })
        })

        const updated = readStored(store.expenses, 'v2')
        expect(updated).toEqual(expect.objectContaining({
            amount: 147.23,
            paidBy: 'Card',
            paymentStatus: 'paid',
        }))
    })

    it('returns undefined when marking a missing expense as paid', () => {
        const { store, loadArchivedExpenses } = buildStore()

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())
        expect(result.current.markAsPaid('missing')).toBeUndefined()
    })

    it('filters by project, personal, and billable options', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: '1', date: '2025-02-01', amount: 10, billable: true, projectId: 'p1' }),
                buildExpense({ id: '2', date: '2025-02-02', amount: 20, billable: false, projectId: 'p1' }),
                buildExpense({ id: '3', date: '2025-02-03', amount: 30, billable: true, isPersonal: false, projectId: 'p2' }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({
            projectId: 'p1',
            personalOnly: true,
            billableOnly: true,
        }))

        expect(result.current.expenses.map((e) => e.id)).toEqual(['1'])
    })

    it('updates payment and billing statuses', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: 'exp-1', paymentStatus: 'paid' }),
                buildExpense({ id: 'exp-2' }),
                buildExpense({ id: 'exp-3', billingStatus: 'billed', invoiceId: 'inv-2', billedAt: 100 }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.markAsUnpaid('exp-1')
            result.current.markAsBilled('exp-2', 'inv-1')
            result.current.markAsUnbilled('exp-3')
        })

        expect(readStored(store.expenses, 'exp-1')).toEqual(expect.objectContaining({ paymentStatus: 'unpaid' }))
        expect(readStored(store.expenses, 'exp-2')).toEqual(expect.objectContaining({ billingStatus: 'billed', invoiceId: 'inv-1' }))
        expect(readStored(store.expenses, 'exp-3')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
    })

    it('unbills all expenses for an invoice', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: 'exp-1', billingStatus: 'billed', invoiceId: 'inv-1', billedAt: 100 }),
                buildExpense({ id: 'exp-2', billingStatus: 'billed', invoiceId: 'inv-1', billedAt: 200 }),
                buildExpense({ id: 'exp-3', billingStatus: 'billed', invoiceId: 'inv-2', billedAt: 300 }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.unbillExpensesForInvoice('inv-1')
        })

        expect(readStored(store.expenses, 'exp-1')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
        expect(readStored(store.expenses, 'exp-2')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
    })

    it('returns client/project scoped lists and billable-unbilled helpers', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: 'exp-1', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'unbilled' }),
                buildExpense({ id: 'exp-2', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'billed' }),
                buildExpense({ id: 'exp-3', clientId: 'c2', projectId: 'p2', billable: true, billingStatus: 'unbilled' }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        expect(result.current.getExpensesForClient('c1').map((e) => e.id)).toEqual(['exp-1', 'exp-2'])
        expect(result.current.getExpensesForProject('p2').map((e) => e.id)).toEqual(['exp-3'])
        expect(result.current.getBillableUnbilledForClient('c1').map((e) => e.id)).toEqual(['exp-1'])
        expect(result.current.getBillableUnbilledForProject('p2').map((e) => e.id)).toEqual(['exp-3'])
    })

    it('includes archived expenses when requested', async () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [buildExpense({ id: 'exp-1', date: '2025-02-01', paymentStatus: 'paid', billingStatus: 'billed', billable: true, isPersonal: false })],
            archived: [buildExpense({ id: 'exp-2', date: '2024-02-01', paymentStatus: 'paid', billingStatus: 'billed', billable: true, isPersonal: false })]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({ includeArchived: true }))

        expect(result.current.expenses.map((e) => e.id)).toEqual(['exp-1', 'exp-2'])
    })

    it('returns overdue and upcoming expenses based on today', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-06T12:00:00Z'))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const { store, loadArchivedExpenses } = buildStore({
            active: [
                buildExpense({ id: 'exp-1', date: '2026-02-05' }),
                buildExpense({ id: 'exp-2', date: '2026-02-06' }),
                buildExpense({ id: 'exp-3', date: '2026-02-10' }),
                buildExpense({ id: 'exp-4', date: '2026-02-20' }),
                buildExpense({ id: 'exp-5', date: '2026-02-04', paymentStatus: 'paid' }),
                buildExpense({ id: 'exp-6', date: '2026-02-05', paymentStatus: 'paid', paymentMode: 'auto' }),
                buildExpense({ id: 'exp-7', date: '2026-02-10', paymentStatus: 'paid', paymentMode: 'auto' }),
                buildExpense({ id: 'exp-8', date: 'invalid' }),
            ]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        expect(result.current.getOverdueExpenses().map((e) => e.id)).toEqual(['exp-1'])
        expect(result.current.getUpcomingDueExpenses(7).map((e) => e.id)).toEqual(['exp-2', 'exp-3', 'exp-7'])
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid expenses entity in active expenses sync'))

        warnSpy.mockRestore()
        vi.useRealTimers()
    })

    it('returns archived expense when includeArchived is true', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [buildExpense({ id: 'exp-1' })],
            archived: [buildExpense({ id: 'exp-2' })]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({ includeArchived: true }))

        expect(result.current.getExpense('exp-2')).toEqual(expect.objectContaining({ id: 'exp-2' }))
    })

    it('creates expenses with explicit timestamps preserved', () => {
        const { store, loadArchivedExpenses } = buildStore()

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.createExpense(buildExpense({
                id: 'exp-custom-time',
                createdAt: 111,
                updatedAt: 222,
            }))
        })

        expect(readStored(store.expenses, 'exp-custom-time')).toEqual(expect.objectContaining({
            createdAt: 111,
            updatedAt: 222,
        }))
    })

    it('updates and deletes archived expenses when includeArchived is enabled', () => {
        const { store, loadArchivedExpenses } = buildStore({
            archived: [buildExpense({ id: 'arch-1', amount: 15 })],
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({ includeArchived: true }))

        act(() => {
            result.current.updateExpense('arch-1', { amount: 25 })
        })

        expect(readStored(store.archivedExpenses, 'arch-1')).toEqual(expect.objectContaining({ amount: 25 }))

        act(() => {
            result.current.deleteExpense('arch-1')
        })

        expect(store.archivedExpenses.has('arch-1')).toBe(false)
    })

    it('returns empty upcoming expenses when the current date cannot be derived', () => {
        const realDate = global.Date

        class InvalidDate extends Date {
            constructor(...args) {
                if (args.length > 0) {
                    super(...args)
                    return
                }

                super('invalid')
            }
        }

        global.Date = InvalidDate

        const { store, loadArchivedExpenses } = buildStore({
            active: [buildExpense({ id: 'exp-1' })],
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        expect(result.current.getUpcomingDueExpenses()).toEqual([])

        global.Date = realDate
    })

    it('handles create/update/delete when store is not ready', () => {
        const { store, loadArchivedExpenses } = buildStore()

        mockUseYjs.mockReturnValue({
            store,
            isReady: false,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses())

        expect(() => result.current.createExpense({ title: 'Test' })).toThrow('Store not ready')
        expect(result.current.updateExpense('missing', { title: 'Nope' })).toBeUndefined()
        expect(result.current.deleteExpense('missing')).toBe(false)
    })
})
