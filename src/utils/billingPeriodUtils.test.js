import { describe, expect, it } from 'vitest'
import {
    DEFAULT_INVOICE_BILLING_PERIOD,
    formatBillingPeriodLabel,
    getBillingPeriodRange,
    getDefaultInvoiceBillingPeriodState,
    getStoredInvoiceBillingPeriodState,
    isStoredDateWithinBillingRange,
    normalizeBillingPeriodPreset,
} from './billingPeriodUtils'

describe('billingPeriodUtils', () => {

    it('normalizes presets and falls back for invalid values', () => {

        expect(normalizeBillingPeriodPreset('month')).toBe('month')
        expect(normalizeBillingPeriodPreset('nope')).toBe(DEFAULT_INVOICE_BILLING_PERIOD)
        expect(normalizeBillingPeriodPreset(null, 'all-time')).toBe('all-time')
    })

    it('builds ranges for last month, this month, all time, and custom presets', () => {

        const today = new Date(2026, 4, 4)

        expect(getBillingPeriodRange({ preset: 'last-month', today })).toEqual({
            startDate: '2026-04-01',
            endDate: '2026-04-30'
        })

        expect(getBillingPeriodRange({ preset: 'month', today })).toEqual({
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        })

        expect(getBillingPeriodRange({ preset: 'all-time', today })).toEqual({
            startDate: '',
            endDate: ''
        })

        expect(getBillingPeriodRange({
            preset: 'custom',
            customStart: '2026-03-10',
            customEnd: '2026-03-31',
            today,
        })).toEqual({
            startDate: '2026-03-10',
            endDate: '2026-03-31'
        })
    })

    it('derives default and stored billing period state', () => {

        expect(getDefaultInvoiceBillingPeriodState(new Date(2026, 4, 4))).toEqual({
            preset: 'all-time',
            startDate: '',
            endDate: ''
        })

        expect(getStoredInvoiceBillingPeriodState(null, new Date(2026, 4, 4))).toEqual({
            preset: 'all-time',
            startDate: '',
            endDate: ''
        })

        expect(getStoredInvoiceBillingPeriodState({})).toEqual({
            preset: 'all-time',
            startDate: '',
            endDate: ''
        })

        expect(getStoredInvoiceBillingPeriodState({
            billingPeriodPreset: 'invalid',
            billingPeriodStart: '2026-02-01',
            billingPeriodEnd: '2026-02-28'
        })).toEqual({
            preset: 'all-time',
            startDate: '2026-02-01',
            endDate: '2026-02-28'
        })
    })

    it('checks whether stored dates fall within the billing range', () => {

        expect(isStoredDateWithinBillingRange('2026-04-10')).toBe(true)
        expect(isStoredDateWithinBillingRange('not-a-date', '2026-04-01', '2026-04-30')).toBe(false)
        expect(isStoredDateWithinBillingRange('2026-03-31', '2026-04-01', '2026-04-30')).toBe(false)
        expect(isStoredDateWithinBillingRange('2026-04-15', '2026-04-01', '2026-04-30')).toBe(true)
        expect(isStoredDateWithinBillingRange('2026-05-01', '2026-04-01', '2026-04-30')).toBe(false)
    })

    it('formats billing period labels for all supported shapes', () => {

        expect(formatBillingPeriodLabel({ preset: 'all-time' })).toBe('All Time')
        expect(formatBillingPeriodLabel({ preset: 'custom', startDate: '2026-04-10', endDate: '2026-04-10' })).toBe('4/10/2026')
        expect(formatBillingPeriodLabel({ preset: 'custom', startDate: '2026-04-01', endDate: '2026-04-30' })).toBe('4/1/2026 - 4/30/2026')
        expect(formatBillingPeriodLabel({ preset: 'custom', startDate: '2026-04-01' })).toBe('From 4/1/2026')
        expect(formatBillingPeriodLabel({ preset: 'custom', endDate: '2026-04-30' })).toBe('Through 4/30/2026')
        expect(formatBillingPeriodLabel({ preset: 'custom' })).toBe('')
    })
})