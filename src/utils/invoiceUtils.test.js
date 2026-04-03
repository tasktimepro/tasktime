import { describe, it, expect, vi } from 'vitest'
import {
    extractSequentialNumber,
    getInvoicesForProject,
    getLatestInvoiceForProject,
    getNextSequentialNumberForTemplate,
    resolveCurrentInvoiceTemplate,
} from './invoiceUtils'

describe('invoiceUtils', () => {

    it('returns empty when projectId is missing', () => {

        expect(getInvoicesForProject([], null)).toEqual([])
        expect(getInvoicesForProject([{ projectId: 'p1' }], undefined)).toEqual([])
    })

    it('filters invoices by projectId and guards non-array input', () => {

        const invoices = [
            { id: 'a', projectId: 'p1' },
            { id: 'b', projectId: 'p2' },
            { id: 'c', projectId: 'p1' }
        ]

        expect(getInvoicesForProject(invoices, 'p1')).toEqual([
            { id: 'a', projectId: 'p1' },
            { id: 'c', projectId: 'p1' }
        ])
        expect(getInvoicesForProject(null, 'p1')).toEqual([])
    })

    it('returns latest invoice by createdAt', () => {

        const invoices = [
            { id: 'old', projectId: 'p1', createdAt: 1 },
            { id: 'new', projectId: 'p1', createdAt: 5 },
            { id: 'other', projectId: 'p2', createdAt: 10 }
        ]

        expect(getLatestInvoiceForProject(invoices, 'p1')).toEqual({
            id: 'new',
            projectId: 'p1',
            createdAt: 5
        })
    })

    it('returns null when no invoices match', () => {

        const invoices = [{ id: 'a', projectId: 'p2', createdAt: 2 }]

        expect(getLatestInvoiceForProject(invoices, 'p1')).toBeNull()
    })

    it('resolves the latest live template and falls back when references are incomplete', () => {

        const liveTemplates = [
            { id: 'tpl-1', name: 'Live Template' }
        ]

        expect(resolveCurrentInvoiceTemplate({
            templateId: 'tpl-1',
            template: { id: 'tpl-old', name: 'Old Template' }
        }, liveTemplates)).toEqual({ id: 'tpl-1', name: 'Live Template' })

        expect(resolveCurrentInvoiceTemplate({
            template: { name: 'Embedded Template' }
        }, liveTemplates)).toEqual({ name: 'Embedded Template' })

        expect(resolveCurrentInvoiceTemplate(null, liveTemplates)).toBeNull()
    })

    it('extracts sequential numbers only for simple sequential templates', () => {

        const template = {
            useSequentialNumbers: true,
            invoiceNumberFormat: 'INV-{sequential}-A'
        }

        expect(extractSequentialNumber('INV-42-A', template)).toBe(42)
        expect(extractSequentialNumber('WRONG-42-A', template)).toBeNull()
        expect(extractSequentialNumber('INV-abc-A', template)).toBeNull()
        expect(extractSequentialNumber('INV-42-A', {
            useSequentialNumbers: true,
            invoiceNumberFormat: 'INV-{year}-{sequential}'
        })).toBeNull()
    })

    it('computes the next sequential number from existing template invoices', () => {

        const template = {
            id: 'tpl-1',
            currentSequentialNumber: 3,
            useSequentialNumbers: true,
            invoiceNumberFormat: 'INV-{sequential}'
        }

        const invoices = [
            { id: 'inv-1', templateId: 'tpl-1', invoiceNumber: 'INV-4', createdAt: 1 },
            { id: 'inv-2', template: { id: 'tpl-1' }, invoiceNumber: 'INV-6', date: '2026-04-03' },
            { id: 'inv-3', templateId: 'tpl-1', invoiceNumber: 'INV-NaN', createdAt: 2 },
            { id: 'inv-4', templateId: 'tpl-2', invoiceNumber: 'INV-99', createdAt: 3 }
        ]

        expect(getNextSequentialNumberForTemplate(template, invoices)).toBe(7)
        expect(getNextSequentialNumberForTemplate(template, invoices, { excludeInvoiceId: 'inv-2' })).toBe(5)
        expect(getNextSequentialNumberForTemplate({ currentSequentialNumber: 8 }, invoices)).toBe(8)
        expect(getNextSequentialNumberForTemplate(template, [{ id: 'inv-empty', templateId: 'tpl-1', invoiceNumber: 'BAD' }])).toBe(3)
    })

    it('uses date fallbacks when determining the latest invoice for a project', () => {

        const invoices = [
            { id: 'dated', projectId: 'p1', date: '2026-01-10' },
            { id: 'newest', projectId: 'p1', date: '2026-02-15' },
            { id: 'missing-sort', projectId: 'p1' }
        ]

        expect(getLatestInvoiceForProject(invoices, 'p1')).toEqual({
            id: 'newest',
            projectId: 'p1',
            date: '2026-02-15'
        })
    })
})
