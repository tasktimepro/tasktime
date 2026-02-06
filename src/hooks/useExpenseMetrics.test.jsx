// @ts-nocheck
import { renderHook } from '@testing-library/react'
import { useExpenseMetrics } from './useExpenseMetrics'

describe('useExpenseMetrics', () => {
    it('computes totals and splits correctly', () => {
        const expenses = [
            { id: '1', date: '2025-02-01', amount: 100, paymentStatus: 'paid', billingStatus: 'unbilled', billable: true, isPersonal: true },
            { id: '2', date: '2025-02-10', amount: 50, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: false, clientId: 'c1' },
            { id: '3', date: '2025-01-15', amount: 200, paymentStatus: 'paid', billingStatus: 'billed', billable: true, isPersonal: true },
        ]

        const { result } = renderHook(() => useExpenseMetrics({
            expenses,
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-02-28'),
        }))

        expect(result.current.totalExpenses).toBe(150)
        expect(result.current.paidTotal).toBe(100)
        expect(result.current.unpaidTotal).toBe(50)
        expect(result.current.billableUnbilledTotal).toBe(150)
        expect(result.current.personalTotal).toBe(100)
        expect(result.current.clientTotal).toBe(50)
        expect(result.current.count).toBe(2)
    })

    it('scopes to clientId when provided', () => {
        const expenses = [
            { id: '1', date: '2025-02-01', amount: 100, paymentStatus: 'paid', billingStatus: 'unbilled', billable: true, isPersonal: false, clientId: 'c1' },
            { id: '2', date: '2025-02-10', amount: 50, paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: true, isPersonal: false, clientId: 'c2' },
        ]

        const { result } = renderHook(() => useExpenseMetrics({
            expenses,
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-02-28'),
            clientId: 'c1',
        }))

        expect(result.current.totalExpenses).toBe(100)
        expect(result.current.count).toBe(1)
    })
})
