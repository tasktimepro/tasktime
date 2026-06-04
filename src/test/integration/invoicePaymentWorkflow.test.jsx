import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoicesList from '../../components/InvoicesList'

const invoiceHookMocks = vi.hoisted(() => ({
    invoices: [],
    markAsPaid: vi.fn(),
    updatePaymentDetails: vi.fn(),
    markAsUnpaid: vi.fn(),
    undoLatestInvoice: vi.fn(),
    canUndoInvoice: vi.fn(() => false),
}))

const currencyUtilsMocks = vi.hoisted(() => ({

    fetchExchangeRates: vi.fn(),
}))

const businessBrandAssetHookMocks = vi.hoisted(() => ({

    businessBrandAssets: [],
}))

const urlStateMocks = vi.hoisted(() => ({

    updateUrl: vi.fn()
}))

vi.mock('../../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        invoices: invoiceHookMocks.invoices,
        markAsPaid: invoiceHookMocks.markAsPaid,
        updatePaymentDetails: invoiceHookMocks.updatePaymentDetails,
        markAsUnpaid: invoiceHookMocks.markAsUnpaid,
        undoLatestInvoice: invoiceHookMocks.undoLatestInvoice,
        canUndoInvoice: invoiceHookMocks.canUndoInvoice,
    })
}))

vi.mock('../../utils/currencyUtils.ts', async () => {
    const actual = await vi.importActual('../../utils/currencyUtils.ts')
    return {
        ...actual,
        fetchExchangeRates: currencyUtilsMocks.fetchExchangeRates,
    }
})

vi.mock('../../hooks/useUrlState.ts', () => ({

    useUrlState: () => ({
        updateUrl: urlStateMocks.updateUrl
    })
}))

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))

vi.mock('../../hooks/useBusinessBrandAssets.ts', () => ({
    useBusinessBrandAssets: () => ({
        businessBrandAssets: businessBrandAssetHookMocks.businessBrandAssets,
    })
}))

describe('Invoice payment workflow integration', () => {

    beforeEach(() => {

        vi.clearAllMocks()
        invoiceHookMocks.updatePaymentDetails.mockResolvedValue(undefined)
        currencyUtilsMocks.fetchExchangeRates.mockResolvedValue({
            rates: { USD: 1, EUR: 0.8 },
            error: null,
        })
    })

    afterEach(() => {

        cleanup()
        vi.restoreAllMocks()
    })

    it('marks an invoice as paid from the list', async () => {

        const user = userEvent.setup()
        const invoice = {
            id: 'inv-1',
            invoiceNumber: 'INV-001',
            date: '2026-02-01',
            dueDate: '2026-02-10',
            totalHours: 2,
            total: 200,
            currency: 'USD',
            status: 'sent',
            clientId: 'client-1',
            project: { id: 'project-1', title: 'Project Alpha' }
        }

        invoiceHookMocks.invoices = [invoice]

        render(
            <InvoicesList
                projectInvoices={[invoice]}
                onEditInvoice={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', clientName: 'Client One' }]}
                invoiceTemplates={[]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        expect(screen.getByText('Confirm Payment Conversion')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Mark as Paid' }))

        expect(invoiceHookMocks.markAsPaid).toHaveBeenCalledWith('inv-1', expect.objectContaining({
            paymentCurrencySnapshot: expect.objectContaining({
                sourceCurrency: 'USD',
                preferredCurrencyAtPayment: 'EUR',
                preferredCurrencyAmount: 160,
            }),
        }))
    })
})
