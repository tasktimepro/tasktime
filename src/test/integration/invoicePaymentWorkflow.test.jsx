import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoicesList from '../../components/InvoicesList'

const invoiceHookMocks = vi.hoisted(() => ({

    updateInvoice: vi.fn()
}))

const urlStateMocks = vi.hoisted(() => ({

    updateUrl: vi.fn()
}))

vi.mock('../../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        updateInvoice: invoiceHookMocks.updateInvoice
    })
}))

vi.mock('../../hooks/useUrlState.ts', () => ({

    useUrlState: () => ({
        updateUrl: urlStateMocks.updateUrl
    })
}))

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))

describe('Invoice payment workflow integration', () => {

    beforeEach(() => {

        vi.clearAllMocks()
    })

    afterEach(() => {

        cleanup()
        vi.restoreAllMocks()
    })

    it('marks an invoice as paid from the list', async () => {

        const user = userEvent.setup()
        const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

        const invoice = {
            id: 'inv-1',
            invoiceNumber: 'INV-001',
            date: '2026-02-01',
            dueDate: '2026-02-10',
            totalHours: 2,
            totalAmount: 200,
            currency: 'USD',
            paymentProcessed: false,
            clientId: 'client-1',
            project: { id: 'project-1', title: 'Project Alpha' }
        }

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

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledWith(
            'inv-1',
            expect.objectContaining({
                paymentProcessed: true,
                paidAt: 1700000000000
            })
        )

        dateSpy.mockRestore()
    })
})
