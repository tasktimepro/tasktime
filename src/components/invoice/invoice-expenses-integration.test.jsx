import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoiceGenerator from '../InvoiceGenerator'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn()
}))

const invoiceHookMocks = vi.hoisted(() => ({

    createInvoice: vi.fn(),
    updateInvoice: vi.fn()
}))

const expenseHookMocks = vi.hoisted(() => ({

    expenses: [],
    markAsBilled: vi.fn(),
    markAsUnbilled: vi.fn()
}))

const templateHookMocks = vi.hoisted(() => ({

    updateInvoiceTemplate: vi.fn(),
    invoiceTemplates: [{
        id: 'tpl-1',
        name: 'Default',
        invoiceNumberFormat: 'INV-{year}-{month}-{sequential}',
        useSequentialNumbers: false,
        currentSequentialNumber: 1,
        dueDateType: 'fixed-days',
        dueDateDays: 30,
    }]
}))

vi.mock('../../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError,
        showWarning: toastMocks.showWarning
    })
}))

vi.mock('../../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        invoices: [],
        createInvoice: invoiceHookMocks.createInvoice,
        updateInvoice: invoiceHookMocks.updateInvoice
    })
}))

vi.mock('../../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: [{ id: 'project-1', title: 'Project', hourlyRate: 100, invoiceIds: [] }]
    })
}))

vi.mock('../../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100 }],
        updateTask: vi.fn()
    })
}))

vi.mock('../../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        updateEntry: vi.fn(),
        createEntry: vi.fn(),
        deleteEntry: vi.fn()
    })
}))

vi.mock('../../hooks/useInvoiceTemplates.ts', () => ({

    useInvoiceTemplates: () => ({
        invoiceTemplates: templateHookMocks.invoiceTemplates,
        updateInvoiceTemplate: templateHookMocks.updateInvoiceTemplate
    })
}))

vi.mock('../../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expenseHookMocks.expenses,
        markAsBilled: expenseHookMocks.markAsBilled,
        markAsUnbilled: expenseHookMocks.markAsUnbilled
    })
}))

vi.mock('../../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        getTimerForProject: () => null,
        getTimerForTask: () => null
    })
}))

vi.mock('../invoice/InvoiceGeneratorButton', () => ({

    default: ({ onClick }) => (
        <button type="button" onClick={onClick}>Open Invoice</button>
    )
}))

vi.mock('../invoice/InvoiceModal', () => ({

    default: (props) => {
        React.useEffect(() => {
            if (!props.showInvoiceForm) return

            if (!props.selectedTemplate) {
                props.handleTemplateSelection('tpl-1')
                return
            }

            if (!props.selectedExpensesForBilling?.['exp-1']) {
                props.setSelectedExpensesForBilling({ 'exp-1': true })
                return
            }

            props.handleSaveInvoice({ preventDefault: () => {} })
        }, [props.showInvoiceForm, props.selectedTemplate, props.selectedExpensesForBilling])

        return props.showInvoiceForm ? <div>Invoice Modal</div> : null
    }
}))

vi.mock('../../utils/pdfUtils.ts', () => ({

    createInvoiceHTML: vi.fn(() => '<html />')
}))

describe('invoice expenses integration', () => {

    const baseProject = { id: 'project-1', title: 'Project', hourlyRate: 100, invoiceIds: [] }
    const baseClient = { id: 'client-1', clientName: 'Client', defaultCurrency: 'EUR' }
    const baseEntry = { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3601000 }

    beforeEach(() => {
        invoiceHookMocks.createInvoice.mockClear()
        expenseHookMocks.markAsBilled.mockClear()
        expenseHookMocks.markAsUnbilled.mockClear()

        expenseHookMocks.expenses = [
            {
                id: 'exp-1',
                title: 'Expense One',
                date: '2026-02-01',
                amount: 125,
                currency: 'EUR',
                billable: true,
                billingStatus: 'unbilled',
                clientId: 'client-1',
                projectId: 'project-1',
                isPersonal: false
            }
        ]
    })

    it('saves invoice with selected expenses and bills them', async () => {
        const user = userEvent.setup()

        render(
            <InvoiceGenerator
                project={baseProject}
                client={baseClient}
                timeEntries={[baseEntry]}
                editingInvoice={null}
                onInvoiceSaved={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[baseClient]}
                showButton={true}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))

        await waitFor(() => {
            expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        })
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]

        expect(invoiceData.items).toEqual([
            {
                description: 'Expense One',
                quantity: 1,
                rate: 125,
                amount: 125,
                expenseId: 'exp-1'
            }
        ])
        expect(expenseHookMocks.markAsBilled).toHaveBeenCalledWith('exp-1', invoiceData.id)
    })
})
