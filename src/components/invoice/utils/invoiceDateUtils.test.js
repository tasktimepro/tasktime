import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateDueDate, generateInvoiceNumber } from './invoiceDateUtils'

const baseDate = new Date('2026-01-19T10:00:00.000Z')

describe('invoiceDateUtils', () => {

    beforeEach(() => {

        vi.useFakeTimers()
        vi.setSystemTime(baseDate)
    })

    afterEach(() => {

        vi.useRealTimers()
    })

    describe('calculateDueDate', () => {

        it('defaults to 30 days when no template', () => {

            const result = calculateDueDate(null, baseDate)
            expect(result).toBe('2026-02-18')
        })

        it('returns null for fixed-days with zero', () => {

            const result = calculateDueDate({ dueDateType: 'fixed-days', dueDateDays: 0, invoiceNumberFormat: '' }, baseDate)
            expect(result).toBeNull()
        })

        it('adds fixed days', () => {

            const result = calculateDueDate({ dueDateType: 'fixed-days', dueDateDays: 15, invoiceNumberFormat: '' }, baseDate)
            expect(result).toBe('2026-02-03')
        })

        it('adds fixed weeks', () => {

            const result = calculateDueDate({ dueDateType: 'fixed-weeks', dueDateWeeks: 2, invoiceNumberFormat: '' }, baseDate)
            expect(result).toBe('2026-02-02')
        })

        it('uses precise date', () => {

            const result = calculateDueDate({ dueDateType: 'precise-date', dueDatePrecise: '2026-02-01', invoiceNumberFormat: '' }, baseDate)
            expect(result).toBe('2026-02-01')
        })

        it('returns null for none type', () => {

            const result = calculateDueDate({ dueDateType: 'none', invoiceNumberFormat: '' }, baseDate)
            expect(result).toBeNull()
        })
    })

    describe('generateInvoiceNumber', () => {

        it('generates from template format', () => {

            const template = {
                invoiceNumberFormat: 'INV-{year}{month}{day}-{sequential}-{projectId}',
                useSequentialNumbers: true,
                currentSequentialNumber: 12
            }

            const result = generateInvoiceNumber(template, { id: 'project-abcdef1234' })

            expect(result).toBe('INV-20260119-0012-cdef1234')
        })

        it('falls back when no template', () => {

            const now = Date.now()
            const result = generateInvoiceNumber(null, { id: 'project-abcdef1234' })
            expect(result).toBe(`INV-cdef1234-${now}`)
        })
    })
})
