import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoicesList from './InvoicesList'

const updateUrlMock = vi.fn()

vi.mock('../utils/pdfUtils.ts', () => ({
    generatePDF: vi.fn(),
    createInvoiceHTML: vi.fn(() => '<div />')
}))

vi.mock('../hooks/useUrlState.ts', () => ({
    useUrlState: () => ({ updateUrl: updateUrlMock })
}))

describe('InvoicesList', () => {

    let user

    beforeEach(() => {

        updateUrlMock.mockClear()
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
        user = userEvent.setup()
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    const baseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        date: '2026-01-05',
        dueDate: '2026-01-20',
        totalAmount: 100,
        totalHours: 2,
        paymentProcessed: false,
        currency: 'USD',
        project: { title: 'Project' },
        client: { name: 'Client' }
    }

    it('shows overdue badge for overdue invoices', () => {

        const overdueInvoice = {
            ...baseInvoice,
            id: 'inv-overdue',
            invoiceNumber: 'INV-OVERDUE',
            dueDate: '2000-01-01'
        }

        render(
            <InvoicesList
                projectInvoices={[overdueInvoice]}
                onEditInvoice={vi.fn()}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByText('Overdue • $100.00')).toBeInTheDocument()
    })

    it('shows outstanding badge for unpaid invoices', () => {

        const outstandingInvoice = {
            ...baseInvoice,
            id: 'inv-outstanding',
            invoiceNumber: 'INV-OUT',
            dueDate: '2099-01-01'
        }

        render(
            <InvoicesList
                projectInvoices={[outstandingInvoice]}
                onEditInvoice={vi.fn()}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByText('Outstanding • $100.00')).toBeInTheDocument()
    })

    it('shows paid badge for processed invoices', () => {

        const paidInvoice = {
            ...baseInvoice,
            id: 'inv-paid',
            invoiceNumber: 'INV-PAID',
            paymentProcessed: true
        }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        expect(screen.getByText('Paid • $100.00')).toBeInTheDocument()
    })

    it('toggles paid status without corrupting list', async () => {

        const setInvoices = vi.fn()

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                setInvoices={setInvoices}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        expect(setInvoices).toHaveBeenCalledTimes(1)

        const updater = setInvoices.mock.calls[0][0]
        const updated = updater([baseInvoice])

        expect(updated).toHaveLength(1)
        expect(updated[0].paymentProcessed).toBe(true)
    })

    it('warns before editing paid invoices', async () => {

        const onEditInvoice = vi.fn()
        const paidInvoice = { ...baseInvoice, id: 'inv-paid', paymentProcessed: true }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={onEditInvoice}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByTitle('Edit Invoice'))

        expect(screen.getByText('Edit paid invoice?')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Continue' }))

        expect(onEditInvoice).toHaveBeenCalledWith(paidInvoice)
    })

    it('paginates outstanding invoices', async () => {

        const invoices = Array.from({ length: 9 }, (_, index) => ({
            ...baseInvoice,
            id: `inv-${index + 1}`,
            invoiceNumber: `INV-00${index + 1}`
        }))

        render(
            <InvoicesList
                projectInvoices={invoices}
                onEditInvoice={vi.fn()}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="outstanding"
            />
        )

        expect(screen.getByText('INV-001')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Next' }).length).toBeGreaterThan(0)

        await user.click(screen.getByRole('button', { name: '2' }))

        expect(screen.getByText('INV-009')).toBeInTheDocument()
    })

    it('renders empty state when no invoices exist', () => {

        render(
            <InvoicesList
                projectInvoices={[]}
                onEditInvoice={vi.fn()}
                setInvoices={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByText('No invoices yet')).toBeInTheDocument()
        expect(screen.getByText('Get started by generating your first invoice.')).toBeInTheDocument()
    })
})
