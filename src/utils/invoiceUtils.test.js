import { describe, it, expect } from 'vitest'
import { getInvoicesForProject, getLatestInvoiceForProject } from './invoiceUtils'

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
})
