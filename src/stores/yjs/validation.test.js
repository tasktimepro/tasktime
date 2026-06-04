// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
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

function createDocManager(coreDoc = null, loadedDocs = ['core'], extraDocs = {}) {
    return {
        getLoadedDocs: () => loadedDocs,
        getDocSync: (name) => {
            if (name === 'core') return coreDoc
            return extraDocs[name] ?? null
        },
    }
}

describe('Yjs validation', () => {
    it('keeps Zod validation jitless for the production CSP', () => {
        const OriginalFunction = globalThis.Function

        try {
            globalThis.Function = vi.fn(() => {
                throw new Error('Zod JIT should not execute under TaskTime CSP')
            })

            expect(validateCollectionEntity('projects', {
                id: 'project-csp-safe',
                title: 'CSP safe project',
            }, 'csp validation')).toEqual({
                id: 'project-csp-safe',
                title: 'CSP safe project',
            })
        } finally {
            globalThis.Function = OriginalFunction
        }
    })

    it('accepts valid entities and rejects malformed collection records', () => {
        expect(validateCollectionEntity('projects', { id: 'project-1', title: 'Valid Project' }, 'test project')).toEqual({
            id: 'project-1',
            title: 'Valid Project',
        })

        expect(validateCollectionEntity('projects', {
            id: 'project-kanban-1',
            title: 'Kanban Project',
            taskView: 'kanban',
            taskSort: 'manual',
            statusMode: 'quote',
            deadline: '2026-06-01',
            budgetAmount: 1200,
        }, 'test project task view')).toEqual({
            id: 'project-kanban-1',
            title: 'Kanban Project',
            taskView: 'kanban',
            taskSort: 'manual',
            statusMode: 'quote',
            deadline: '2026-06-01',
            budgetAmount: 1200,
        })

        expect(validateCollectionEntity('tasks', {
            id: 'task-ordered-1',
            title: 'Ordered Task',
            sortOrder: 1000,
            sortOrderUpdatedAt: 123456,
            estimatedHours: 4.5,
            estimatedFlatAmount: 300,
            quotedAmountBilling: {
                invoiceId: 'invoice-1',
                billedAt: 123456,
                total: 300,
            },
        }, 'test ordered task')).toEqual({
            id: 'task-ordered-1',
            title: 'Ordered Task',
            sortOrder: 1000,
            sortOrderUpdatedAt: 123456,
            estimatedHours: 4.5,
            estimatedFlatAmount: 300,
            quotedAmountBilling: {
                invoiceId: 'invoice-1',
                billedAt: 123456,
                total: 300,
            },
        })

        expect(validateCollectionEntity('projects', {
            id: 'project-with-notes',
            title: 'Project with notes',
            notes: {
                version: 1,
                type: 'tiptap-json',
                content: {
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                { type: 'text', text: 'Remember the kickoff link' },
                            ],
                        },
                        {
                            type: 'taskList',
                            content: [
                                {
                                    type: 'taskItem',
                                    attrs: { checked: false },
                                    content: [{ type: 'paragraph' }],
                                },
                            ],
                        },
                    ],
                },
                plainTextPreview: 'Remember the kickoff link',
                updatedAt: 123,
            },
        }, 'test project notes')).toMatchObject({
            id: 'project-with-notes',
            notes: {
                type: 'tiptap-json',
                version: 1,
            },
        })

        expect(validateCollectionEntity('projects', {
            id: 'project-bad-notes',
            title: 'Bad notes',
            notes: {
                version: 1,
                type: 'tiptap-json',
                content: { content: [] },
                updatedAt: 123,
            },
        }, 'test malformed project notes')).toEqual({
            id: 'project-bad-notes',
            title: 'Bad notes',
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
            projectId: null,
            projectIds: ['project-1', 'project-2'],
            projectBreakdowns: [
                {
                    projectId: 'project-1',
                    projectTitle: 'Project One',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 1,
                    subtotal: 125,
                },
                {
                    projectId: 'project-2',
                    projectTitle: 'Project Two',
                    clientId: 'client-1',
                    pricingMode: 'flat',
                    totalHours: 0,
                    subtotal: 0,
                },
            ],
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

    it('normalizes legacy invoices missing projectId to null', () => {
        expect(validateCollectionEntity('invoices', {
            id: 'invoice-legacy-project-id',
            clientId: 'client-1',
            invoiceNumber: 'INV-LEGACY-PROJECT',
            date: '2026-04-07',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
        }, 'legacy invoice without projectId')).toEqual(expect.objectContaining({
            id: 'invoice-legacy-project-id',
            projectId: null,
        }))
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

    it('accepts quote email templates in the persisted app shape', () => {
        expect(validateCollectionEntity('emailTemplates', {
            id: 'email-template-quote-1',
            name: 'Quote Template',
            type: 'quote',
            subject: 'Quote {invoiceNumber}',
            sendBody: 'Hello {clientName}',
            reminderBody: '',
            attachmentTitle: 'quote-{invoiceNumber}',
            isDefault: true,
        }, 'test email template')).toEqual(expect.objectContaining({
            id: 'email-template-quote-1',
            type: 'quote',
            attachmentTitle: 'quote-{invoiceNumber}',
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

    it('defers time entry task reference checks until archived tasks are loaded', () => {
        const coreDoc = new Y.Doc()
        coreDoc.getMap('tasks').set('active-task', objectToYMap({
            id: 'active-task',
            title: 'Active Task',
            projectId: null,
        }))

        const entriesDoc = new Y.Doc()
        entriesDoc.getMap('timeEntries').set('entry-archived-task', objectToYMap({
            id: 'entry-archived-task',
            taskId: 'archived-task',
            start: 100,
            end: 200,
        }))

        expect(() => validateDocManagerState(
            createDocManager(coreDoc, ['core', 'entries-active'], { 'entries-active': entriesDoc }),
            'entries-active',
            entriesDoc,
        )).not.toThrow()
    })

    it('rejects time entries with missing tasks once archived tasks are loaded', () => {
        const coreDoc = new Y.Doc()
        coreDoc.getMap('tasks').set('active-task', objectToYMap({
            id: 'active-task',
            title: 'Active Task',
            projectId: null,
        }))

        const archivedTasksDoc = new Y.Doc()
        archivedTasksDoc.getMap('tasks').set('different-archived-task', objectToYMap({
            id: 'different-archived-task',
            title: 'Archived Task',
            projectId: null,
            archived: true,
        }))

        const entriesDoc = new Y.Doc()
        entriesDoc.getMap('timeEntries').set('entry-missing-task', objectToYMap({
            id: 'entry-missing-task',
            taskId: 'missing-task',
            start: 100,
            end: 200,
        }))

        expect(() => validateDocManagerState(
            createDocManager(coreDoc, ['core', 'tasks-archived', 'entries-active'], {
                'tasks-archived': archivedTasksDoc,
                'entries-active': entriesDoc,
            }),
            'entries-active',
            entriesDoc,
        )).toThrow(/time entry entry-missing-task references missing task missing-task/)
    })
})
