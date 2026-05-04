// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import {
    backfillPaidExpenseCurrencySnapshotsInDoc,
    hasPaidExpensesMissingCurrencySnapshotsInMap,
} from './expensePaymentSnapshotMigration.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

describe('expensePaymentSnapshotMigration', () => {
    it('backfills missing payment currency snapshots for paid expenses', () => {
        const doc = new Y.Doc()
        const expenses = doc.getMap('expenses')

        expenses.set('expense-1', objectToYMap({
            id: 'expense-1',
            title: 'Hosting',
            date: '2026-04-07',
            paidOn: '2026-04-08',
            paymentStatus: 'paid',
            currency: 'USD',
            amount: 100,
            billingStatus: 'unbilled',
            isPersonal: true,
            billable: false,
            isRecurring: false,
            isTaxExempt: false,
        }))

        expect(backfillPaidExpenseCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })).toBe(1)

        const migrated = expenses.get('expense-1')
        expect(migrated.get('paymentCurrencySnapshot')).toEqual({
            capturedAt: new Date(2026, 3, 8).getTime(),
            sourceCurrency: 'USD',
            sourceAmount: 100,
            preferredCurrencyAtPayment: 'EUR',
            preferredCurrencyAmount: 85,
            exchangeRatesBase: 'USD',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })
    })

    it('backfills paid expenses using the expense date when paidOn is missing', () => {
        const doc = new Y.Doc()
        const expenses = doc.getMap('expenses')

        expenses.set('expense-legacy', objectToYMap({
            id: 'expense-legacy',
            title: 'Travel',
            date: '2026-03-03',
            paymentStatus: 'paid',
            currency: 'CHF',
            amount: 2075,
            billingStatus: 'unbilled',
            isPersonal: true,
            billable: false,
            isRecurring: false,
            isTaxExempt: false,
        }))

        expect(hasPaidExpensesMissingCurrencySnapshotsInMap(expenses)).toBe(true)

        expect(backfillPaidExpenseCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.851081, CHF: 0.780477 },
        })).toBe(1)

        const migrated = expenses.get('expense-legacy')
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
        const expenses = doc.getMap('expenses')

        expenses.set('expense-1', objectToYMap({
            id: 'expense-1',
            title: 'Hosting',
            date: '2026-04-07',
            paidOn: '2026-04-08',
            paymentStatus: 'paid',
            currency: 'USD',
            amount: 100,
            billingStatus: 'unbilled',
            isPersonal: true,
            billable: false,
            isRecurring: false,
            isTaxExempt: false,
            paymentCurrencySnapshot: {
                capturedAt: new Date(2026, 3, 8).getTime(),
                sourceCurrency: 'USD',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 85,
                exchangeRatesBase: 'USD',
                exchangeRates: { USD: 1, EUR: 0.85 },
            },
        }))

        expect(backfillPaidExpenseCurrencySnapshotsInDoc(doc, {
            preferredCurrency: 'EUR',
            exchangeRates: { USD: 1, EUR: 0.85 },
        })).toBe(0)
    })
})