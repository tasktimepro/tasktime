// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import {
    backfillPaidInvoiceCurrencySnapshotsInDoc,
    hasPaidInvoicesMissingCurrencySnapshotsInMap,
} from './invoicePaymentSnapshotMigration.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

describe('invoicePaymentSnapshotMigration', () => {
    it('backfills missing payment currency snapshots for paid invoices', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-07',
            status: 'paid',
            paidAt: 1700000000000,
            currency: 'USD',
            items: [],
            subtotal: 100,
            total: 100,
        }))

        expect(backfillPaidInvoiceCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })).toBe(1)

        const migrated = invoices.get('invoice-1')
        expect(migrated.get('paymentCurrencySnapshot')).toEqual({
            capturedAt: 1700000000000,
            sourceCurrency: 'USD',
            sourceAmount: 100,
            preferredCurrencyAtPayment: 'EUR',
            preferredCurrencyAmount: 85,
            exchangeRatesBase: 'USD',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })
    })

    it('backfills legacy paid invoices even when paidAt is missing', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-legacy', objectToYMap({
            id: 'invoice-legacy',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-LEGACY',
            date: '2026-03-03',
            status: 'paid',
            currency: 'CHF',
            items: [],
            subtotal: 2075,
            total: 2075,
        }))

        expect(hasPaidInvoicesMissingCurrencySnapshotsInMap(invoices)).toBe(true)

        expect(backfillPaidInvoiceCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.851081, CHF: 0.780477 },
        })).toBe(1)

        const migrated = invoices.get('invoice-legacy')
        expect(migrated.get('paymentCurrencySnapshot')).toEqual({
            capturedAt: new Date(2026, 2, 3).getTime(),
            sourceCurrency: 'CHF',
            sourceAmount: 2075,
            preferredCurrencyAtPayment: 'EUR',
            preferredCurrencyAmount: 2262.71,
            exchangeRatesBase: 'USD',
            exchangeRates: { USD: 1, EUR: 0.851081, CHF: 0.780477 },
        })
    })

    it('is idempotent once snapshots already exist', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-07',
            status: 'paid',
            paidAt: 1700000000000,
            currency: 'USD',
            items: [],
            subtotal: 100,
            total: 100,
            paymentCurrencySnapshot: {
                capturedAt: 1700000000000,
                sourceCurrency: 'USD',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 85,
                exchangeRatesBase: 'USD',
                exchangeRates: { USD: 1, EUR: 0.85 },
            },
        }))

        expect(backfillPaidInvoiceCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })).toBe(0)
    })

    it('detects when no paid invoices need snapshot backfill', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-07',
            status: 'paid',
            paidAt: 1700000000000,
            currency: 'USD',
            items: [],
            subtotal: 100,
            total: 100,
            paymentCurrencySnapshot: {
                capturedAt: 1700000000000,
                sourceCurrency: 'USD',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 85,
            },
        }))

        expect(hasPaidInvoicesMissingCurrencySnapshotsInMap(invoices)).toBe(false)
    })
})