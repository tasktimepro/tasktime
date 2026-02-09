// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
import { useExpenses } from './useExpenses'
import { useYjs } from '@/contexts/YjsContext'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

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
                { id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid', billingStatus: 'unbilled', billable: false, isPersonal: true },
                { id: '2', date: '2025-02-01', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false, isPersonal: true, clientId: 'c1' },
                { id: '3', date: '2024-12-01', amount: 5, paymentStatus: 'unpaid', billingStatus: 'billed', billable: true, isPersonal: false, clientId: 'c2' },
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
                { id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid', billingStatus: 'unbilled', billable: true, isPersonal: true },
                { id: '2', date: '2025-02-01', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: true },
                { id: '3', date: '2024-12-01', amount: 5, paymentStatus: 'unpaid', billingStatus: 'billed', billable: true, isPersonal: true },
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
            active: [{
                id: 'v1',
                amount: 0,
                amountType: 'variable',
                paymentStatus: 'unpaid',
                paidBy: null,
            }]
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
            active: [{
                id: 'v2',
                amount: 0,
                amountType: 'variable',
                paymentStatus: 'unpaid',
                paidBy: null,
            }]
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

        const updated = store.expenses.get('v2')
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
                { id: '1', date: '2025-02-01', amount: 10, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: true, projectId: 'p1' },
                { id: '2', date: '2025-02-02', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false, isPersonal: true, projectId: 'p1' },
                { id: '3', date: '2025-02-03', amount: 30, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: false, projectId: 'p2' },
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
            active: [{ id: 'exp-1' }, { id: 'exp-2' }, { id: 'exp-3' }]
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

        expect(store.expenses.get('exp-1')).toEqual(expect.objectContaining({ paymentStatus: 'unpaid' }))
        expect(store.expenses.get('exp-2')).toEqual(expect.objectContaining({ billingStatus: 'billed', invoiceId: 'inv-1' }))
        expect(store.expenses.get('exp-3')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
    })

    it('unbills all expenses for an invoice', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                { id: 'exp-1', invoiceId: 'inv-1' },
                { id: 'exp-2', invoiceId: 'inv-1' },
                { id: 'exp-3', invoiceId: 'inv-2' },
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

        expect(store.expenses.get('exp-1')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
        expect(store.expenses.get('exp-2')).toEqual(expect.objectContaining({ billingStatus: 'unbilled', invoiceId: null, billedAt: null }))
    })

    it('returns client/project scoped lists and billable-unbilled helpers', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [
                { id: 'exp-1', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'unbilled' },
                { id: 'exp-2', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'billed' },
                { id: 'exp-3', clientId: 'c2', projectId: 'p2', billable: true, billingStatus: 'unbilled' },
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
            active: [{ id: 'exp-1', date: '2025-02-01', paymentStatus: 'paid', billingStatus: 'billed', billable: true, isPersonal: false }],
            archived: [{ id: 'exp-2', date: '2024-02-01', paymentStatus: 'paid', billingStatus: 'billed', billable: true, isPersonal: false }]
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

        const { store, loadArchivedExpenses } = buildStore({
            active: [
                { id: 'exp-1', date: '2026-02-05', paymentStatus: 'unpaid' },
                { id: 'exp-2', date: '2026-02-06', paymentStatus: 'unpaid' },
                { id: 'exp-3', date: '2026-02-10', paymentStatus: 'unpaid' },
                { id: 'exp-4', date: '2026-02-20', paymentStatus: 'unpaid' },
                { id: 'exp-5', date: '2026-02-04', paymentStatus: 'paid' },
                { id: 'exp-6', date: '2026-02-05', paymentStatus: 'paid', paymentMode: 'auto' },
                { id: 'exp-7', date: '2026-02-10', paymentStatus: 'paid', paymentMode: 'auto' },
                { id: 'exp-8', date: 'invalid', paymentStatus: 'unpaid' },
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

        vi.useRealTimers()
    })

    it('returns archived expense when includeArchived is true', () => {
        const { store, loadArchivedExpenses } = buildStore({
            active: [{ id: 'exp-1' }],
            archived: [{ id: 'exp-2' }]
        })

        mockUseYjs.mockReturnValue({
            store,
            isReady: true,
            loadArchivedExpenses,
        })

        const { result } = renderHook(() => useExpenses({ includeArchived: true }))

        expect(result.current.getExpense('exp-2')).toEqual({ id: 'exp-2' })
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
