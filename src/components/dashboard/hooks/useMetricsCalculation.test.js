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
            { date: '2026-01-10', total: 120, currency: 'USD', status: 'paid' },
            { date: '2026-01-11', total: 80, currency: 'USD', status: 'sent' }
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

    it('uses stored payment currency snapshots for paid invoice totals', () => {

        const snapshotAwareConvertToCurrency = (amounts) => {
            if (amounts.USD) {
                return { amounts: { EUR: 999 }, hadConversionError: false }
            }

            return { amounts, hadConversionError: false }
        }

        const invoices = [
            {
                date: '2026-01-10',
                total: 100,
                currency: 'USD',
                status: 'paid',
                paidAt: 1700000000000,
                paymentCurrencySnapshot: {
                    capturedAt: 1700000000000,
                    sourceCurrency: 'USD',
                    sourceAmount: 100,
                    preferredCurrencyAtPayment: 'EUR',
                    preferredCurrencyAmount: 85,
                    exchangeRatesBase: 'USD',
                    exchangeRates: { USD: 1, EUR: 0.85 },
                },
            },
        ]

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries: [],
            tasks: [],
            projects: [],
            invoices,
            clients: [],
            preferredCurrency: 'EUR',
            convertToCurrency: snapshotAwareConvertToCurrency
        }))

        expect(result.current.thisMonthMetrics.paidInvoices.EUR).toBe(85)
    })

    it('keeps outstanding and past due invoice metrics mutually exclusive', () => {

        const { result } = renderHook(() => useMetricsCalculation({
            timeEntries: [],
            tasks: [],
            projects: [],
            invoices: [
                { date: '2026-01-10', total: 120, currency: 'USD', status: 'paid' },
                { date: '2026-01-11', total: 80, currency: 'USD', status: 'sent', dueDate: '2026-01-25' },
                { date: '2026-01-12', total: 90, currency: 'USD', status: 'sent', dueDate: '2026-01-01' },
            ],
            clients: [],
            preferredCurrency: 'USD',
            convertToCurrency
        }))

        expect(result.current.invoiceMetrics).toEqual({
            outstanding: 1,
            outstandingTotal: 80,
            pastDue: 1,
            pastDueTotal: 90,
            hadConversionError: false,
        })
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

    it('uses billable duration overrides for unbilled totals while keeping worked time actual', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', billable: true }
        ]
        const projects = [{ id: 'project-1', hourlyRate: 100 }]
        const timeEntries = [
            {
                taskId: 'task-1',
                start: baseDate.getTime() - (5 * 60 * 1000),
                end: baseDate.getTime(),
                billedDurationMs: 15 * 60 * 1000,
                billingIncrementMinutes: 15,
            }
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

        expect(result.current.thisMonthMetrics.time).toBe(5 * 60 * 1000)
        expect(result.current.thisMonthUnbilledTotal).toBe(25)
        expect(result.current.thisMonthBillableHours).toBe(0.25)
    })
})
