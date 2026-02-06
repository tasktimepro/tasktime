// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useExpenses } from './useExpenses'
import { useYjsCollection } from './useYjsCollection'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjsCollection = useYjsCollection

describe('useExpenses', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters and sorts expenses by date desc', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid', billingStatus: 'unbilled', billable: false, isPersonal: true },
                { id: '2', date: '2025-02-01', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false, isPersonal: true, clientId: 'c1' },
                { id: '3', date: '2024-12-01', amount: 5, paymentStatus: 'unpaid', billingStatus: 'billed', billable: true, isPersonal: false, clientId: 'c2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses({ clientId: 'c1' }))
        expect(result.current.expenses.map((e) => e.id)).toEqual(['2'])
    })

    it('computes totals correctly', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: '1', date: '2025-01-01', amount: 10, paymentStatus: 'paid', billingStatus: 'unbilled', billable: true, isPersonal: true },
                { id: '2', date: '2025-02-01', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: true },
                { id: '3', date: '2024-12-01', amount: 5, paymentStatus: 'unpaid', billingStatus: 'billed', billable: true, isPersonal: true },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())
        expect(result.current.totals).toEqual({ total: 35, unpaid: 25, paid: 10, billableUnbilled: 30 })
    })

    it('markAsPaid requires amount for variable expenses', () => {
        const update = vi.fn()
        const get = vi.fn(() => ({
            id: 'v1',
            amount: 0,
            amountType: 'variable',
            paymentStatus: 'unpaid',
            paidBy: null,
        }))

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get,
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        expect(() => result.current.markAsPaid('v1')).toThrow('Amount is required')
    })

    it('markAsPaid updates amount and status', () => {
        const update = vi.fn()
        const get = vi.fn(() => ({
            id: 'v2',
            amount: 0,
            amountType: 'variable',
            paymentStatus: 'unpaid',
            paidBy: null,
        }))

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get,
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.markAsPaid('v2', { amount: 147.23, paidBy: 'Card' })
        })

        expect(update).toHaveBeenCalledWith('v2', expect.objectContaining({
            amount: 147.23,
            paidBy: 'Card',
            paymentStatus: 'paid',
        }))
    })

    it('returns undefined when marking a missing expense as paid', () => {
        const update = vi.fn()
        const get = vi.fn(() => undefined)

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get,
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())
        expect(result.current.markAsPaid('missing')).toBeUndefined()
        expect(update).not.toHaveBeenCalled()
    })

    it('filters by project, personal, and billable options', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: '1', date: '2025-02-01', amount: 10, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: true, projectId: 'p1' },
                { id: '2', date: '2025-02-02', amount: 20, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false, isPersonal: true, projectId: 'p1' },
                { id: '3', date: '2025-02-03', amount: 30, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: false, projectId: 'p2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses({
            projectId: 'p1',
            personalOnly: true,
            billableOnly: true,
        }))

        expect(result.current.expenses.map((e) => e.id)).toEqual(['1'])
    })

    it('updates payment and billing statuses', () => {
        const update = vi.fn()

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.markAsUnpaid('exp-1')
            result.current.markAsBilled('exp-2', 'inv-1')
            result.current.markAsUnbilled('exp-3')
        })

        expect(update).toHaveBeenCalledWith('exp-1', { paidOn: null, paidBy: null, paymentStatus: 'unpaid' })
        expect(update).toHaveBeenCalledWith('exp-2', expect.objectContaining({ billingStatus: 'billed', invoiceId: 'inv-1' }))
        expect(update).toHaveBeenCalledWith('exp-3', { billingStatus: 'unbilled', invoiceId: null, billedAt: null })
    })

    it('unbills all expenses for an invoice', () => {
        const update = vi.fn()

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'exp-1', invoiceId: 'inv-1' },
                { id: 'exp-2', invoiceId: 'inv-1' },
                { id: 'exp-3', invoiceId: 'inv-2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        act(() => {
            result.current.unbillExpensesForInvoice('inv-1')
        })

        expect(update).toHaveBeenCalledTimes(2)
        expect(update).toHaveBeenCalledWith('exp-1', { billingStatus: 'unbilled', invoiceId: null, billedAt: null })
        expect(update).toHaveBeenCalledWith('exp-2', { billingStatus: 'unbilled', invoiceId: null, billedAt: null })
    })

    it('returns client/project scoped lists and billable-unbilled helpers', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'exp-1', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'unbilled' },
                { id: 'exp-2', clientId: 'c1', projectId: 'p1', billable: true, billingStatus: 'billed' },
                { id: 'exp-3', clientId: 'c2', projectId: 'p2', billable: true, billingStatus: 'unbilled' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        expect(result.current.getExpensesForClient('c1').map((e) => e.id)).toEqual(['exp-1', 'exp-2'])
        expect(result.current.getExpensesForProject('p2').map((e) => e.id)).toEqual(['exp-3'])
        expect(result.current.getBillableUnbilledForClient('c1').map((e) => e.id)).toEqual(['exp-1'])
        expect(result.current.getBillableUnbilledForProject('p2').map((e) => e.id)).toEqual(['exp-3'])
    })

    it('returns overdue and upcoming expenses based on today', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-06T12:00:00Z'))

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'exp-1', date: '2026-02-05', paymentStatus: 'unpaid' },
                { id: 'exp-2', date: '2026-02-06', paymentStatus: 'unpaid' },
                { id: 'exp-3', date: '2026-02-10', paymentStatus: 'unpaid' },
                { id: 'exp-4', date: '2026-02-20', paymentStatus: 'unpaid' },
                { id: 'exp-5', date: '2026-02-04', paymentStatus: 'paid' },
                { id: 'exp-6', date: 'invalid', paymentStatus: 'unpaid' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenses())

        expect(result.current.getOverdueExpenses().map((e) => e.id)).toEqual(['exp-1'])
        expect(result.current.getUpcomingDueExpenses(7).map((e) => e.id)).toEqual(['exp-2', 'exp-3'])

        vi.useRealTimers()
    })
})
