import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useMetricsCalculation from './useMetricsCalculation'

const baseDate = new Date('2026-01-19T12:00:00.000Z')

describe('useMetricsCalculation', () => {

    const convertToCurrency = (amounts) => ({ amounts, hadConversionError: false })

    beforeEach(() => {

        vi.useFakeTimers()
        vi.setSystemTime(baseDate)
    })

    afterEach(() => {

        vi.useRealTimers()
    })

    it('calculates time and invoice metrics for the current month', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', billable: true }
        ]
        const projects = [{ id: 'project-1', hourlyRate: 100 }]
        const timeEntries = [
            { taskId: 'task-1', start: baseDate.getTime() - 3600000, end: baseDate.getTime() }
        ]
        const invoices = [
            { date: '2026-01-10', totalAmount: 120, currency: 'USD', paymentProcessed: true },
            { date: '2026-01-11', totalAmount: 80, currency: 'USD', paymentProcessed: false }
        ]

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries,
            tasks,
            projects,
            invoices,
            clients: [],
            preferredCurrency: 'USD',
            convertToCurrency
        }))

        expect(result.current.thisMonthMetrics.time).toBe(3600000)
        expect(result.current.thisMonthMetrics.paidInvoices.USD).toBe(120)
        expect(result.current.thisMonthMetrics.outstandingInvoices.USD).toBe(80)
    })

    it('excludes non-billable tasks from unbilled totals', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', billable: true },
            { id: 'task-2', projectId: 'project-1', billable: false }
        ]
        const projects = [{ id: 'project-1', hourlyRate: 50 }]
        const timeEntries = [
            { taskId: 'task-1', start: baseDate.getTime() - 3600000, end: baseDate.getTime() },
            { taskId: 'task-2', start: baseDate.getTime() - 7200000, end: baseDate.getTime() - 3600000 }
        ]

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries,
            tasks,
            projects,
            invoices: [],
            clients: [],
            preferredCurrency: 'USD',
            convertToCurrency
        }))

        expect(result.current.thisMonthUnbilledTotal).toBe(50)
    })

    it('rounds unbilled hours per task before summing', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', billable: true },
            { id: 'task-2', projectId: 'project-2', billable: true }
        ]
        const projects = [
            { id: 'project-1', hourlyRate: 80 },
            { id: 'project-2', hourlyRate: 120 }
        ]

        const hoursToMs = (hours) => Math.round(hours * 3600000)

        const timeEntries = [
            { taskId: 'task-1', start: baseDate.getTime() - hoursToMs(1.234), end: baseDate.getTime() },
            { taskId: 'task-2', start: baseDate.getTime() - hoursToMs(2.345), end: baseDate.getTime() - hoursToMs(1.234) }
        ]

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries,
            tasks,
            projects,
            invoices: [],
            clients: [],
            preferredCurrency: 'USD',
            convertToCurrency
        }))

        expect(result.current.thisMonthBillableHours).toBe(2.34)
    })

    it('excludes invoice adjustments from unbilled earnings', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', billable: true }
        ]
        const projects = [{ id: 'project-1', hourlyRate: 100 }]
        const timeEntries = [
            { taskId: 'task-1', start: baseDate.getTime() - 3600000, end: baseDate.getTime() },
            { taskId: 'task-1', start: baseDate.getTime() - 7200000, end: baseDate.getTime() - 3600000, source: 'invoice-adjustment' }
        ]

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries,
            tasks,
            projects,
            invoices: [],
            clients: [],
            preferredCurrency: 'USD',
            convertToCurrency
        }))

        expect(result.current.thisMonthUnbilledTotal).toBe(100)
    })
})
