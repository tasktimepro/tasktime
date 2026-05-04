// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { validateCollectionEntity, validateDocManagerState } from './validation.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

function createDocManager(coreDoc = null, loadedDocs = ['core']) {
    return {
        getLoadedDocs: () => loadedDocs,
        getDocSync: (name) => (name === 'core' ? coreDoc : null),
    }
}

describe('Yjs validation', () => {
    it('accepts valid entities and rejects malformed collection records', () => {
        expect(validateCollectionEntity('projects', { id: 'project-1', title: 'Valid Project' }, 'test project')).toEqual({
            id: 'project-1',
            title: 'Valid Project',
        })

        expect(() => validateCollectionEntity('timeEntries', {
            id: 'entry-1',
            taskId: 'task-1',
            start: 200,
            end: 100,
        }, 'test time entry')).toThrow(/end must be greater than or equal to start/)
    })

    it('accepts invoice and expense records that intentionally persist null optional fields', () => {
        expect(() => validateCollectionEntity('expenses', {
            id: 'expense-1',
            title: 'One-time expense',
            date: '2026-04-07',
            currency: 'EUR',
            amount: 12.34,
            paidOn: null,
            paidBy: null,
            paymentStatus: 'unpaid',
            paymentMode: 'manual',
            clientId: null,
            projectId: null,
            businessId: null,
            isPersonal: true,
            billable: false,
            billingStatus: 'unbilled',
            invoiceId: null,
            billedAt: null,
            isRecurring: false,
            recurrenceId: null,
            amountType: null,
            taxNumber: null,
            isTaxExempt: false,
        }, 'test expense')).not.toThrow()

        expect(() => validateCollectionEntity('invoices', {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            businessInfoId: null,
            invoiceNumber: 'INV-001',
            date: '2026-04-07',
            dueDate: null,
            status: 'sent',
            items: [{
                description: 'Consulting',
                quantity: 1,
                rate: 125,
                amount: 125,
                supplierName: null,
            }],
            subtotal: 125,
            total: 125,
            paymentMethodId: null,
        }, 'test invoice')).not.toThrow()
    })

    it('normalizes legacy one-time paid expenses instead of dropping them', () => {
        expect(validateCollectionEntity('expenses', {
            id: 'expense-legacy-paid',
            title: 'Legacy paid expense',
            date: '2026-04-30',
            currency: 'EUR',
            amount: 505.55,
            paidOn: '',
            paymentStatus: 'paid',
            isPersonal: true,
            billable: false,
            paymentCurrencySnapshot: {},
        }, 'legacy expense')).toEqual(expect.objectContaining({
            id: 'expense-legacy-paid',
            paidOn: null,
            paymentMode: 'manual',
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
            paymentCurrencySnapshot: null,
        }))
    })

    it('accepts payment methods in the persisted app shape', () => {
        expect(validateCollectionEntity('paymentMethods', {
            id: 'payment-method-1',
            title: 'Bank Transfer',
            fullName: 'Acme Ltd',
            bank: 'Acme Bank',
            iban: 'DE89 3704 0044 0532 0130 00',
            swift: 'COBADEFFXXX',
            bankAddress: '1 Banking Street',
            paypal: 'billing@example.com',
            custom: [{ label: 'Reference', value: 'INV-001' }],
            isDefault: true,
        }, 'test payment method')).toEqual(expect.objectContaining({
            id: 'payment-method-1',
            title: 'Bank Transfer',
            custom: [{ label: 'Reference', value: 'INV-001' }],
            isDefault: true,
        }))
    })

    it('rejects invoices that still use the legacy shape', () => {
        expect(() => validateCollectionEntity('invoices', {
            id: 'invoice-legacy-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-LEGACY',
            date: '2026-04-07',
            dueDate: '2026-04-09',
            items: [{
                description: 'Consulting',
                quantity: 1,
                rate: 200,
                amount: 200,
            }],
            subtotal: 200,
            totalAmount: 200,
            paymentProcessed: true,
        }, 'legacy invoice')).toThrow(/Invalid invoices entity/)
    })

    it('rejects remote documents with broken cross-entity references', () => {
        const candidateDoc = new Y.Doc()
        const projects = candidateDoc.getMap('projects')

        projects.set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Broken Project',
            invoiceIds: ['invoice-missing'],
        }))

        expect(() => validateDocManagerState(createDocManager(), 'core', candidateDoc)).toThrow(/references missing invoice invoice-missing/)
    })

    it('accepts remote documents whose references resolve within the candidate state', () => {
        const candidateDoc = new Y.Doc()
        const projects = candidateDoc.getMap('projects')
        const clients = candidateDoc.getMap('clients')
        const invoices = candidateDoc.getMap('invoices')

        clients.set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
        }))
        projects.set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Valid Project',
            preferredClientId: 'client-1',
            invoiceIds: ['invoice-1'],
        }))
        invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-01',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
        }))

        expect(() => validateDocManagerState(createDocManager(), 'core', candidateDoc)).not.toThrow()
    })
})