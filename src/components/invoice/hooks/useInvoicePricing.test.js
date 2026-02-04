import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import useInvoicePricing from './useInvoicePricing'

describe('useInvoicePricing', () => {

    const baseParams = {
        invoiceTasks: [],
        additionalTasks: [],
        editableHours: {},
        discountType: 'percentage',
        discountValue: 0,
        shippingAmount: 0,
        taxOverride: { enabled: false, rate: 0 },
        taskFlatRates: {},
        useFlatRate: {},
        taskHourlyRates: {},
        taskQuantities: {},
        selectedTasksForBilling: {},
        mergedSubtasks: {},
        selectedBusinessInfo: null,
        selectedClient: null,
        selectedProject: null
    }

    it('calculates hourly subtotal and totals', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 2, hourlyRate: 100 }],
            selectedTasksForBilling: { 'task-1': true }
        }))

        expect(result.current.subtotal).toBe(200)
        expect(result.current.total).toBe(200)
        expect(result.current.totalHours).toBe(2)
    })

    it('calculates flat rate with quantity and counts hours', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 2 }],
            selectedTasksForBilling: { 'task-1': true },
            useFlatRate: { 'task-1': true },
            taskFlatRates: { 'task-1': 50 },
            taskQuantities: { 'task-1': 3 }
        }))

        expect(result.current.subtotal).toBe(150)
        expect(result.current.totalHours).toBe(0)
    })

    it('merges subtasks and applies hourly rates', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [
                { id: 'parent', hours: 1, hourlyRate: 100 },
                { id: 'child', parentTaskId: 'parent', hours: 2, hourlyRate: 50 }
            ],
            selectedTasksForBilling: { parent: true, child: true },
            mergedSubtasks: { parent: true }
        }))

        expect(result.current.subtotal).toBe(200)
        expect(result.current.totalHours).toBe(3)
    })

    it('sums numeric hours without string concatenation', () => {

        const { result } = renderHook(() => useInvoicePricing({
            invoiceTasks: [
                { id: 'hourly', hours: '2', hourlyRate: 50 },
                { id: 'flat', hours: '1', flatRate: 40, useFlatRate: true }
            ],
            additionalTasks: [],
            editableHours: {},
            discountType: 'percentage',
            discountValue: 0,
            shippingAmount: 0,
            taxOverride: { enabled: false, rate: 0, label: 'Tax' },
            taskFlatRates: { flat: 40 },
            useFlatRate: { flat: true },
            taskHourlyRates: {},
            taskQuantities: {},
            selectedTasksForBilling: { hourly: true, flat: true },
            mergedSubtasks: {},
            selectedBusinessInfo: null,
            selectedClient: null,
            selectedProject: null
        }))

        expect(result.current.totalHours).toBe(2)
    })
    it('applies discount, shipping, and tax override', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 2, hourlyRate: 100 }],
            selectedTasksForBilling: { 'task-1': true },
            discountType: 'percentage',
            discountValue: 10,
            shippingAmount: 20,
            taxOverride: { enabled: true, rate: 10, label: 'Sales Tax' }
        }))

        expect(result.current.subtotal).toBe(200)
        expect(result.current.discount).toBe(20)
        expect(result.current.shipping).toBe(20)
        expect(result.current.tax).toBe(20)
        expect(result.current.total).toBe(220)
        expect(result.current.taxLabel).toBe('Sales Tax')
    })

    it('handles mixed hourly and flat rate tasks', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [
                { id: 'hourly', hours: 2, hourlyRate: 100 },
                { id: 'flat', hours: 1 }
            ],
            selectedTasksForBilling: { hourly: true, flat: true },
            useFlatRate: { flat: true },
            taskFlatRates: { flat: 150 },
            taskQuantities: { flat: 1 }
        }))

        expect(result.current.subtotal).toBe(350)
        expect(result.current.totalHours).toBe(2)
    })

    it('uses task-level hourly overrides when provided', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 2, hourlyRate: 50 }],
            selectedTasksForBilling: { 'task-1': true },
            taskHourlyRates: { 'task-1': 80 }
        }))

        expect(result.current.subtotal).toBe(160)
    })

    it('rounds totals to two decimals', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 1.3333, hourlyRate: 99.999 }],
            selectedTasksForBilling: { 'task-1': true }
        }))

        expect(result.current.subtotal).toBe(133.33)
        expect(result.current.total).toBe(133.33)
    })

    it('skips tax when client disables tax', () => {

        const { result } = renderHook(() => useInvoicePricing({
            ...baseParams,
            invoiceTasks: [{ id: 'task-1', hours: 1, hourlyRate: 100 }],
            selectedTasksForBilling: { 'task-1': true },
            selectedBusinessInfo: { taxEnabled: true, taxRate: 20, taxLabel: 'VAT' },
            selectedClient: { disableTax: true }
        }))

        expect(result.current.tax).toBe(0)
        expect(result.current.taxRate).toBe(0)
    })
})
