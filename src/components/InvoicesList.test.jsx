import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoicesList from './InvoicesList'

const updateUrlMock = vi.fn()
const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn(),
}))

const invoiceHookMocks = vi.hoisted(() => ({

    invoices: [],
    markAsPaid: vi.fn(),
    updatePaymentDetails: vi.fn(),
    markAsUnpaid: vi.fn(),
    undoLatestInvoice: vi.fn(),
    canUndoInvoice: vi.fn(() => false),
    cancelInvoice: vi.fn(),
    getInvoiceCancellationBlockReason: vi.fn(() => null),
}))

const currencyUtilsMocks = vi.hoisted(() => ({

    fetchExchangeRates: vi.fn(),
}))

const businessBrandAssetHookMocks = vi.hoisted(() => ({

    businessBrandAssets: [],
}))

const pdfMocks = vi.hoisted(() => ({

    generatePDF: vi.fn(),
    createInvoiceHTML: vi.fn((invoice) => `<div>Invoice: #${invoice.invoiceNumber}</div>`),
    getCurrentInvoiceHtmlContent: vi.fn((invoice) => {
        if (invoice.htmlContent && invoice.htmlContent.includes(invoice.invoiceNumber)) {
            return invoice.htmlContent
        }

        return `<div>Invoice: #${invoice.invoiceNumber}</div>`
    })
}))

vi.mock('../utils/pdfUtils.ts', () => ({
    generatePDF: pdfMocks.generatePDF,
    createInvoiceHTML: pdfMocks.createInvoiceHTML,
    getCurrentInvoiceHtmlContent: pdfMocks.getCurrentInvoiceHtmlContent,
}))

vi.mock('../hooks/useUrlState.ts', () => ({
    useUrlState: () => ({ updateUrl: updateUrlMock })
}))

vi.mock('../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        invoices: invoiceHookMocks.invoices,
        markAsPaid: invoiceHookMocks.markAsPaid,
        updatePaymentDetails: invoiceHookMocks.updatePaymentDetails,
        markAsUnpaid: invoiceHookMocks.markAsUnpaid,
        undoLatestInvoice: invoiceHookMocks.undoLatestInvoice,
        canUndoInvoice: invoiceHookMocks.canUndoInvoice,
        cancelInvoice: invoiceHookMocks.cancelInvoice,
        getInvoiceCancellationBlockReason: invoiceHookMocks.getInvoiceCancellationBlockReason,
    })
}))

vi.mock('../utils/currencyUtils.ts', async () => {
    const actual = await vi.importActual('../utils/currencyUtils.ts')
    return {
        ...actual,
        fetchExchangeRates: currencyUtilsMocks.fetchExchangeRates,
    }
})

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError,
    })
}))

vi.mock('../hooks/useBusinessBrandAssets.ts', () => ({
    useBusinessBrandAssets: () => ({
        businessBrandAssets: businessBrandAssetHookMocks.businessBrandAssets,
    })
}))

vi.mock('../hooks/usePreferences.ts', () => ({
    usePreferences: () => ({ preferences: { currency: 'EUR' } })
}))

describe('InvoicesList', () => {

    let user

    const setMatchMedia = (matches) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches,
                media: '(max-width: 767px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }))
        })
    }

    beforeEach(() => {

        updateUrlMock.mockClear()
        invoiceHookMocks.markAsPaid.mockReset()
        invoiceHookMocks.markAsPaid.mockResolvedValue(undefined)
        invoiceHookMocks.updatePaymentDetails.mockReset()
        invoiceHookMocks.updatePaymentDetails.mockResolvedValue(undefined)
        invoiceHookMocks.markAsUnpaid.mockReset()
        invoiceHookMocks.markAsUnpaid.mockResolvedValue({ id: 'inv-paid', status: 'sent' })
        invoiceHookMocks.invoices = []
        invoiceHookMocks.undoLatestInvoice.mockReset()
        invoiceHookMocks.undoLatestInvoice.mockResolvedValue({
            invoiceNumber: 'INV-001',
            clearedTimeEntryCount: 1,
            deletedAdjustmentCount: 0,
            unbilledExpenseCount: 1,
            rewoundSequence: true,
        })
        invoiceHookMocks.canUndoInvoice.mockReset()
        invoiceHookMocks.canUndoInvoice.mockReturnValue(false)
        invoiceHookMocks.cancelInvoice.mockReset()
        invoiceHookMocks.cancelInvoice.mockResolvedValue({
            invoice: { id: 'inv-1', invoiceNumber: 'INV-001', status: 'canceled' },
            releasedTimeEntryCount: 2,
            deletedAdjustmentCount: 1,
            releasedExpenseCount: 3,
            releasedQuotedTaskCount: 1,
            retainedInvoiceNumber: true,
        })
        invoiceHookMocks.getInvoiceCancellationBlockReason.mockReset()
        invoiceHookMocks.getInvoiceCancellationBlockReason.mockReturnValue(null)
        pdfMocks.generatePDF.mockClear()
        pdfMocks.createInvoiceHTML.mockClear()
        pdfMocks.getCurrentInvoiceHtmlContent.mockClear()
        toastMocks.showSuccess.mockClear()
        toastMocks.showError.mockClear()
        currencyUtilsMocks.fetchExchangeRates.mockReset()
        currencyUtilsMocks.fetchExchangeRates.mockResolvedValue({
            rates: { USD: 1, EUR: 0.8 },
            error: null,
        })
        setMatchMedia(false)
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
        dueDate: '2099-01-20',
        total: 100,
        totalHours: 2,
        status: 'sent',
        currency: 'USD',
        project: { title: 'Project' },
        client: { name: 'Client' }
    }

    it('shows overdue badge for overdue invoices', { timeout: 20000 }, () => {

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
                
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        // Text is split across elements due to sensitive-data wrapper, matches parent + child
        const matches = screen.getAllByText((content, element) => {
            const text = element?.textContent?.replace(/\s+/g, ' ').trim() || '';
            return text.includes('Overdue') && text.includes('•') && text.includes('$100.00');
        })
        expect(matches.length).toBeGreaterThan(0)
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
                
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        // Text is split across elements due to sensitive-data wrapper, matches parent + child
        const matches = screen.getAllByText((content, element) => {
            const text = element?.textContent?.replace(/\s+/g, ' ').trim() || '';
            return text.includes('Outstanding') && text.includes('•') && text.includes('$100.00');
        })
        expect(matches.length).toBeGreaterThan(0)
    })

    it('uses neutral styling for overdue and outstanding tabs', () => {

        const invoices = [
            {
                ...baseInvoice,
                id: 'inv-overdue',
                invoiceNumber: 'INV-OVERDUE',
                dueDate: '2000-01-01'
            },
            {
                ...baseInvoice,
                id: 'inv-outstanding',
                invoiceNumber: 'INV-OUTSTANDING',
                dueDate: '2099-01-01'
            }
        ]

        render(
            <InvoicesList
                projectInvoices={invoices}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByRole('tab', { name: 'Overdue (1)' }).className.includes('status-danger-tab')).toBe(false)
        expect(screen.getByRole('tab', { name: 'Outstanding (1)' }).className.includes('status-warning-tab')).toBe(false)
    })

    it('keeps overdue invoices out of the outstanding tab', () => {

        const invoices = [
            {
                ...baseInvoice,
                id: 'inv-overdue',
                invoiceNumber: 'INV-OVERDUE',
                dueDate: '2000-01-01'
            },
            {
                ...baseInvoice,
                id: 'inv-outstanding',
                invoiceNumber: 'INV-OUTSTANDING',
                dueDate: '2099-01-01'
            }
        ]

        render(
            <InvoicesList
                projectInvoices={invoices}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="outstanding"
            />
        )

        expect(screen.getByText('INV-OUTSTANDING')).toBeInTheDocument()
        expect(screen.queryByText('INV-OVERDUE')).not.toBeInTheDocument()
    })

    it('shows paid badge for processed invoices', () => {

        const paidInvoice = {
            ...baseInvoice,
            id: 'inv-paid',
            invoiceNumber: 'INV-PAID',
            status: 'paid'
        }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        // Text is split across elements due to sensitive-data wrapper, matches parent + child
        const matches = screen.getAllByText((content, element) => {
            const text = element?.textContent?.replace(/\s+/g, ' ').trim() || '';
            return text.includes('Paid') && text.includes('•') && text.includes('$100.00');
        })
        expect(matches.length).toBeGreaterThan(0)
    })

    it('shows canceled invoices only in the explicitly selected Canceled tab', async () => {

        const canceledInvoice = {
            ...baseInvoice,
            id: 'inv-canceled',
            invoiceNumber: 'INV-CANCELED',
            status: 'canceled',
            canceledAt: new Date('2026-07-14T08:30:00Z').getTime(),
            cancellationReason: 'Duplicate invoice',
            dueDate: '2000-01-01',
        }

        render(
            <InvoicesList
                projectInvoices={[baseInvoice, canceledInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="canceled"
            />
        )

        expect(screen.getByRole('tab', { name: 'Canceled (1)' })).toBeInTheDocument()
        expect(screen.getByText('INV-CANCELED')).toBeInTheDocument()
        expect(screen.queryByText('INV-001')).not.toBeInTheDocument()
        expect(screen.getByText('Duplicate invoice')).toBeInTheDocument()
        const cancellationNotice = screen.getByText('Cancellation reason').closest('.rounded-md')
        expect(cancellationNotice).toHaveClass('bg-muted', 'border-border')
        expect(screen.queryByText(/Historical/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Original total:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/not outstanding or payable/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark as Paid' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Outstanding (1)' }))

        expect(screen.getByText('INV-001')).toBeInTheDocument()
        expect(screen.queryByText('INV-CANCELED')).not.toBeInTheDocument()
    })

    it('requires a bounded reason and exact invoice number before canceling', async () => {

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Cancel invoice' }))

        const dialog = screen.getByRole('dialog', { name: 'Cancel Invoice?' })
        const submit = screen.getByRole('button', { name: 'Cancel Invoice' })
        const reason = screen.getByLabelText(/^Cancellation reason/)
        const confirmation = screen.getByLabelText(/Type INV-001 to confirm/i)
        expect(dialog.className).toContain('sm:max-w-xl')
        expect(reason).toBeRequired()
        expect(within(reason.labels[0]).getByText('*')).toHaveClass('text-destructive-strong')
        expect(submit).toBeDisabled()

        await user.type(reason, 'Duplicate invoice')
        await user.type(confirmation, 'INV-001')
        expect(submit).toBeEnabled()

        await user.click(submit)

        await waitFor(() => {
            expect(invoiceHookMocks.cancelInvoice).toHaveBeenCalledWith('inv-1', {
                reason: 'Duplicate invoice',
            })
        })
        expect(updateUrlMock).toHaveBeenCalledWith({ tab: 'canceled', section: 'invoices' })
        expect(toastMocks.showSuccess).toHaveBeenCalledWith(
            'Invoice INV-001 canceled. 2 billed entries restored, 1 invoice adjustment removed, 3 expenses unbilled, and 1 quoted task released. Invoice number retained.'
        )
    })

    it('keeps cancellation input available when the operation fails', async () => {

        invoiceHookMocks.cancelInvoice.mockRejectedValueOnce(new Error('Cancellation could not be completed'))

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Cancel invoice' }))
        const dialog = screen.getByRole('dialog', { name: 'Cancel Invoice?' })
        const reason = screen.getByLabelText(/^Cancellation reason/)
        const confirmation = screen.getByLabelText(/Type INV-001 to confirm/i)
        await user.type(reason, 'Duplicate invoice')
        await user.type(confirmation, 'INV-001')
        await user.click(screen.getByRole('button', { name: 'Cancel Invoice' }))

        await waitFor(() => {
            expect(toastMocks.showError).toHaveBeenCalledWith('Cancellation could not be completed')
        })
        expect(dialog).toBeVisible()
        expect(reason).toHaveValue('Duplicate invoice')
        expect(confirmation).toHaveValue('INV-001')
        expect(screen.getByRole('button', { name: 'Cancel Invoice' })).toBeEnabled()
    })

    it('locks and keeps the cancellation dialog open while committing', async () => {

        let resolveCancellation
        invoiceHookMocks.cancelInvoice.mockReturnValueOnce(new Promise((resolve) => {
            resolveCancellation = resolve
        }))

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Cancel invoice' }))
        const dialog = screen.getByRole('dialog', { name: 'Cancel Invoice?' })
        await user.type(screen.getByLabelText(/^Cancellation reason/), 'Duplicate invoice')
        await user.type(screen.getByLabelText(/Type INV-001 to confirm/i), 'INV-001')
        await user.click(screen.getByRole('button', { name: 'Cancel Invoice' }))

        expect(screen.getByRole('button', { name: 'Canceling Invoice' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Keep Invoice' })).toBeDisabled()
        expect(screen.getByLabelText(/^Cancellation reason/)).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Close dialog' }))
        expect(dialog).toBeVisible()

        resolveCancellation({
            invoice: { ...baseInvoice, status: 'canceled', cancellationReason: 'Duplicate invoice' },
            releasedTimeEntryCount: 0,
            deletedAdjustmentCount: 0,
            releasedExpenseCount: 0,
            releasedQuotedTaskCount: 0,
            retainedInvoiceNumber: true,
        })

        await waitFor(() => expect(dialog).not.toBeInTheDocument())
    })

    it('shows the undo latest invoice action only for eligible invoices', () => {

        invoiceHookMocks.canUndoInvoice.mockImplementation((invoice) => invoice.id === 'inv-latest')

        render(
            <InvoicesList
                projectInvoices={[
                    {
                        ...baseInvoice,
                        id: 'inv-old',
                        invoiceNumber: 'INV-OLD',
                        dueDate: '2099-01-01'
                    },
                    {
                        ...baseInvoice,
                        id: 'inv-latest',
                        invoiceNumber: 'INV-LATEST',
                        dueDate: '2099-01-02'
                    }
                ]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getAllByRole('button', { name: 'More actions' })).toHaveLength(2)
    })

    it('requires typing the invoice number before undoing the latest invoice', async () => {

        invoiceHookMocks.canUndoInvoice.mockReturnValue(true)

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', clientName: 'Client Co' }]}
                invoiceTemplates={[{ id: 'tpl-1', name: 'Default Template', useSequentialNumbers: true, currentSequentialNumber: 2, invoiceNumberFormat: 'INV-{sequential}' }]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Undo' }))

        expect(screen.getByLabelText(/Type INV-001 to confirm/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Undo Invoice' })).toBeDisabled()

        await user.type(screen.getByLabelText(/Type INV-001 to confirm/i), 'INV-001')
        expect(screen.getByRole('button', { name: 'Undo Invoice' })).toBeEnabled()

        await user.click(screen.getByRole('button', { name: 'Undo Invoice' }))

        await waitFor(() => {
            expect(invoiceHookMocks.undoLatestInvoice).toHaveBeenCalledWith('inv-1')
        })

        expect(toastMocks.showSuccess).toHaveBeenCalledWith(
            'Invoice INV-001 undone. 1 billed entry restored, 0 invoice adjustments removed, and 1 expense unbilled. Next invoice number was restored.'
        )
        expect(toastMocks.showError).not.toHaveBeenCalled()
    })

    it('shows an error toast when undoing the latest invoice fails', async () => {

        invoiceHookMocks.canUndoInvoice.mockReturnValue(true)
        invoiceHookMocks.undoLatestInvoice.mockRejectedValue(new Error('Undo blocked'))

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', clientName: 'Client Co' }]}
                invoiceTemplates={[{ id: 'tpl-1', name: 'Default Template', useSequentialNumbers: true, currentSequentialNumber: 2, invoiceNumberFormat: 'INV-{sequential}' }]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Undo' }))
        await user.type(screen.getByLabelText(/Type INV-001 to confirm/i), 'INV-001')
        await user.click(screen.getByRole('button', { name: 'Undo Invoice' }))

        await waitFor(() => {
            expect(toastMocks.showError).toHaveBeenCalledWith('Undo blocked')
        })
    })

    it('uses all active invoices when showing sequence rollback safety', async () => {

        invoiceHookMocks.canUndoInvoice.mockReturnValue(true)
        const sequenceInvoice = {
            ...baseInvoice,
            templateId: 'tpl-1',
        }
        invoiceHookMocks.invoices = [
            sequenceInvoice,
            {
                ...sequenceInvoice,
                id: 'inv-other-project',
                invoiceNumber: 'INV-002',
                projectId: 'project-2',
                createdAt: 2,
            }
        ]

        render(
            <InvoicesList
                projectInvoices={[sequenceInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', clientName: 'Client Co' }]}
                invoiceTemplates={[{ id: 'tpl-1', name: 'Default Template', useSequentialNumbers: true, currentSequentialNumber: 2, invoiceNumberFormat: 'INV-{sequential}' }]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Undo' }))

        expect(screen.getByText('Will stay as-is')).toBeInTheDocument()
        expect(screen.getByText('Existing invoice numbers prevent rewinding the template sequence.')).toBeInTheDocument()
    })

    it('shows a sent badge for emailed invoices', () => {

        const sentInvoice = {
            ...baseInvoice,
            id: 'inv-sent',
            invoiceNumber: 'INV-SENT',
            sentAt: Date.now()
        }

        render(
            <InvoicesList
                projectInvoices={[sentInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByText('Sent')).toBeInTheDocument()
        expect(screen.queryByText('Emailed')).not.toBeInTheDocument()
    })

    it('marks a same-currency invoice paid without corrupting the list', async () => {
        const sameCurrencyInvoice = {
            ...baseInvoice,
            currency: 'EUR',
        }

        render(
            <InvoicesList
                projectInvoices={[sameCurrencyInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        await waitFor(() => {
            expect(invoiceHookMocks.markAsPaid).toHaveBeenCalledTimes(1)
        })
        expect(invoiceHookMocks.markAsPaid).toHaveBeenCalledWith('inv-1')
    })

    it('confirms payment conversion before marking a cross-currency invoice as paid', async () => {

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        expect(screen.getByText('Confirm Payment Conversion')).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByLabelText('Exchange rate')).toHaveValue(0.8)
        })
        expect(screen.getByDisplayValue('80.00')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        await waitFor(() => {
            expect(invoiceHookMocks.markAsPaid).toHaveBeenCalledWith('inv-1', expect.objectContaining({
                paymentCurrencySnapshot: expect.objectContaining({
                    sourceCurrency: 'USD',
                    sourceAmount: 100,
                    preferredCurrencyAtPayment: 'EUR',
                    preferredCurrencyAmount: 80,
                }),
            }))
        })
    })

    it('marks zero-total cross-currency invoices paid without requiring conversion details', async () => {

        const zeroTotalInvoice = {
            ...baseInvoice,
            id: 'inv-zero',
            total: 0,
            currency: 'USD',
        }

        render(
            <InvoicesList
                projectInvoices={[zeroTotalInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        expect(screen.queryByText('Confirm Payment Conversion')).not.toBeInTheDocument()
        expect(invoiceHookMocks.markAsPaid).toHaveBeenCalledWith('inv-zero')
    })

    it('edits saved payment details without reopening the invoice editor', async () => {

        const paidInvoice = {
            ...baseInvoice,
            id: 'inv-paid-fx',
            status: 'paid',
            paidAt: 1700000000000,
            paymentCurrencySnapshot: {
                capturedAt: 1700000000000,
                sourceCurrency: 'USD',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 80,
            },
        }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit payment details' }))

        expect(screen.getByText('Stored payment conversion')).toBeInTheDocument()
        expect(screen.queryByText('Live conversion preview')).not.toBeInTheDocument()
        expect(currencyUtilsMocks.fetchExchangeRates).not.toHaveBeenCalled()

        const exchangeRateInput = screen.getByLabelText('Exchange rate')
        await user.clear(exchangeRateInput)
        await user.type(exchangeRateInput, '0.9')

        expect(screen.getByDisplayValue('90.00')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save Payment Details' }))

        await waitFor(() => {
            expect(invoiceHookMocks.updatePaymentDetails).toHaveBeenCalledWith('inv-paid-fx', expect.objectContaining({
                paymentCurrencySnapshot: expect.objectContaining({
                    sourceCurrency: 'USD',
                    sourceAmount: 100,
                    preferredCurrencyAtPayment: 'EUR',
                    preferredCurrencyAmount: 90,
                }),
            }))
        })
    })

    it('confirms a paid invoice payment correction before marking it unpaid', { timeout: 20000 }, async () => {

        const paidInvoice = {
            ...baseInvoice,
            id: 'inv-paid-correction',
            invoiceNumber: 'INV-PAID-CORRECTION',
            status: 'paid',
            paidAt: 1700000000000,
            paymentCurrencySnapshot: {
                capturedAt: 1700000000000,
                sourceCurrency: 'USD',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 80,
            },
        }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Mark as unpaid' }))

        expect(screen.getByRole('dialog', { name: 'Mark Invoice as Unpaid?' })).toBeVisible()
        expect(screen.getByText('This does not record or issue a refund.')).toBeInTheDocument()
        expect(invoiceHookMocks.markAsUnpaid).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Mark as Unpaid' }))

        await waitFor(() => {
            expect(invoiceHookMocks.markAsUnpaid).toHaveBeenCalledWith('inv-paid-correction')
        })
        expect(updateUrlMock).toHaveBeenCalledWith({ tab: 'outstanding', section: 'invoices' })
        expect(toastMocks.showSuccess).toHaveBeenCalledWith(
            'Invoice INV-PAID-CORRECTION marked as unpaid. Recorded payment details were cleared.'
        )
        expect(screen.queryByRole('dialog', { name: 'Mark Invoice as Unpaid?' })).not.toBeInTheDocument()
    })

    it('returns a corrected past-due paid invoice to the Overdue tab', { timeout: 20000 }, async () => {

        const paidInvoice = {
            ...baseInvoice,
            id: 'inv-paid-overdue',
            status: 'paid',
            dueDate: '2000-01-01',
        }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Mark as unpaid' }))

        expect(screen.getByRole('dialog', { name: 'Mark Invoice as Unpaid?' })).toHaveTextContent(
            'It will return to Overdue.'
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Unpaid' }))

        await waitFor(() => {
            expect(updateUrlMock).toHaveBeenCalledWith({ tab: 'overdue', section: 'invoices' })
        })
    })

    it('keeps the mark-unpaid confirmation open when the correction fails', { timeout: 20000 }, async () => {

        const paidInvoice = { ...baseInvoice, id: 'inv-paid-error', status: 'paid' }
        invoiceHookMocks.markAsUnpaid.mockRejectedValueOnce(new Error('Payment correction failed'))

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Mark as unpaid' }))
        await user.click(screen.getByRole('button', { name: 'Mark as Unpaid' }))

        await waitFor(() => {
            expect(toastMocks.showError).toHaveBeenCalledWith('Payment correction failed')
        })
        expect(screen.getByRole('dialog', { name: 'Mark Invoice as Unpaid?' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Mark as Unpaid' })).toBeEnabled()
    })

    it('does not report success when the paid invoice disappeared before correction', { timeout: 20000 }, async () => {

        const paidInvoice = { ...baseInvoice, id: 'inv-paid-missing', status: 'paid' }
        invoiceHookMocks.markAsUnpaid.mockResolvedValueOnce(undefined)

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Mark as unpaid' }))
        await user.click(screen.getByRole('button', { name: 'Mark as Unpaid' }))

        await waitFor(() => {
            expect(toastMocks.showError).toHaveBeenCalledWith(
                'Invoice could not be found. Refresh the list and try again.'
            )
        })
        expect(screen.getByRole('dialog', { name: 'Mark Invoice as Unpaid?' })).toBeVisible()
        expect(toastMocks.showSuccess).not.toHaveBeenCalled()
        expect(updateUrlMock).not.toHaveBeenCalled()
    })

    it('locks the mark-unpaid confirmation while the correction is being saved', { timeout: 20000 }, async () => {

        let resolveMarkUnpaid
        const paidInvoice = { ...baseInvoice, id: 'inv-paid-loading', status: 'paid' }
        invoiceHookMocks.markAsUnpaid.mockReturnValueOnce(new Promise((resolve) => {
            resolveMarkUnpaid = resolve
        }))

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Mark as unpaid' }))
        await user.click(screen.getByRole('button', { name: 'Mark as Unpaid' }))

        const dialog = screen.getByRole('dialog', { name: 'Mark Invoice as Unpaid?' })
        expect(screen.getByRole('button', { name: 'Marking as Unpaid' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Keep Paid' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Close dialog' }))
        expect(dialog).toBeVisible()

        resolveMarkUnpaid({ id: paidInvoice.id, status: 'sent' })

        await waitFor(() => expect(dialog).not.toBeInTheDocument())
    })

    it('does not offer mark as unpaid for invoices without a recorded paid status', { timeout: 20000 }, async () => {

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))

        expect(screen.queryByRole('menuitem', { name: 'Mark as unpaid' })).not.toBeInTheDocument()
    })

    it('hides direct invoice editing for paid invoices', async () => {

        const onEditInvoice = vi.fn()
        const paidInvoice = { ...baseInvoice, id: 'inv-paid', status: 'paid' }

        render(
            <InvoicesList
                projectInvoices={[paidInvoice]}
                onEditInvoice={onEditInvoice}
                
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="paid"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        expect(screen.queryByRole('menuitem', { name: 'Edit invoice' })).not.toBeInTheDocument()

        expect(onEditInvoice).not.toHaveBeenCalled()
        expect(toastMocks.showError).not.toHaveBeenCalled()
    })

    it('offers invoice editing for drafts', async () => {

        const onEditInvoice = vi.fn()
        const draftInvoice = { ...baseInvoice, id: 'inv-draft', status: 'draft' }

        render(
            <InvoicesList
                projectInvoices={[draftInvoice]}
                onEditInvoice={onEditInvoice}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
                selectedTab="outstanding"
            />
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit invoice' }))

        expect(onEditInvoice).toHaveBeenCalledWith(draftInvoice)
        expect(toastMocks.showError).not.toHaveBeenCalled()
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
                
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        expect(screen.getByText('No invoices yet')).toBeInTheDocument()
        expect(screen.getByText('Get started by generating your first invoice.')).toBeInTheDocument()
    })

    it('wraps tabs and actions safely on mobile', () => {

        setMatchMedia(true)

        render(
            <InvoicesList
                projectInvoices={[baseInvoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        const tablist = screen.getByRole('tablist')
        const markPaidButton = screen.getByRole('button', { name: 'Mark as Paid' })

        expect(tablist.className.includes('flex-wrap')).toBe(true)
        expect(markPaidButton.parentElement?.className.includes('flex-wrap')).toBe(true)
    })

    it('uses current invoice html when stored html is stale', async () => {

        render(
            <InvoicesList
                projectInvoices={[{
                    ...baseInvoice,
                    invoiceNumber: 'INV-0160',
                    htmlContent: '<div>Invoice: #INV-0159</div>'
                }]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByTitle('Preview Invoice'))

        expect(screen.getByText('Invoice: #INV-0160')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Download PDF' }))

        expect(pdfMocks.generatePDF).toHaveBeenCalledWith('<div>Invoice: #INV-0160</div>', 'invoice-INV-0160.pdf')
    })
})
