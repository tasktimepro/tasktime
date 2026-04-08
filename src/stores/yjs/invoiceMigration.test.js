// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { migrateInvoicesInDoc } from './invoiceMigration.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

describe('invoiceMigration', () => {
    it('rewrites legacy invoices into the canonical shape', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-07',
            dueDate: '2026-04-09',
            items: [],
            subtotal: 125,
            totalAmount: 125,
            paymentProcessed: true,
        }))

        expect(migrateInvoicesInDoc(doc)).toBe(1)

        const migrated = invoices.get('invoice-1')
        expect(migrated.get('total')).toBe(125)
        expect(migrated.get('subtotal')).toBe(125)
        expect(migrated.get('status')).toBe('paid')
        expect(migrated.get('paymentProcessed')).toBeUndefined()
        expect(migrated.get('totalAmount')).toBeUndefined()
    })

    it('backfills missing items from legacy invoice task and expense data', () => {
        const doc = new Y.Doc()
        const invoices = doc.getMap('invoices')

        invoices.set('invoice-2', objectToYMap({
            id: 'invoice-2',
            projectId: 'project-2',
            clientId: 'client-2',
            invoiceNumber: 'INV-002',
            date: '2026-04-08',
            status: 'sent',
            subtotal: 225,
            total: 225,
            tasks: [
                { id: 'task-2', title: 'Consulting', hours: 2, hourlyRate: 100 },
            ],
            expenseItems: [
                { id: 'expense-1', title: 'Travel', amount: 25 },
            ],
        }))

        expect(migrateInvoicesInDoc(doc)).toBe(1)

        const migrated = invoices.get('invoice-2')
        expect(migrated.get('items')).toEqual([
            {
                description: 'Travel',
                quantity: 1,
                rate: 25,
                amount: 25,
                expenseId: 'expense-1',
                supplierName: null,
                originalAmount: undefined,
                originalCurrency: undefined,
                exchangeRate: undefined,
            },
            {
                description: 'Consulting',
                quantity: 2,
                rate: 100,
                amount: 200,
                taskId: 'task-2',
            }
        ])
    })
})