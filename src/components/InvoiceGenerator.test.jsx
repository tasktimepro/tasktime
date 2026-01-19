import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoiceGenerator from './InvoiceGenerator'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn()
}))

let modalConfig = {
    applyDateOverride: false
}

vi.mock('../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError,
        showWarning: toastMocks.showWarning
    })
}))

vi.mock('./invoice/InvoiceGeneratorButton', () => ({

    default: ({ onClick }) => (
        <button type="button" onClick={onClick}>Open Invoice</button>
    )
}))

vi.mock('./invoice/InvoiceModal', () => ({

    default: (props) => (
        <div>
            {modalConfig.applyDateOverride && (
                <button
                    type="button"
                    onClick={() => {
                        props.setUseInvoiceDateOverride(true)
                        props.setInvoiceDateOverride('2026-01-10')
                    }}
                >
                    Set Override
                </button>
            )}
            <button
                type="button"
                onClick={() => {
                    props.handleTemplateSelection('tpl-1')
                    props.handleSaveInvoice({ preventDefault: () => {} })
                }}
            >
                Save Invoice
            </button>
        </div>
    )
}))

vi.mock('../utils/pdfUtils.ts', () => ({

    createInvoiceHTML: vi.fn(() => '<html />')
}))

describe('InvoiceGenerator', () => {

    const baseProject = { id: 'project-1', title: 'Project', hourlyRate: 100, invoiceIds: [] }
    const baseClient = { id: 'client-1', clientName: 'Client', defaultCurrency: 'EUR' }
    const baseTask = { id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100 }
    const baseEntry = { taskId: 'task-1', start: 0, end: 3600000 }
    const templates = [
        {
            id: 'tpl-1',
            isDefault: true,
            invoiceNumberFormat: 'INV-{year}{month}{day}-{sequential}',
            useSequentialNumbers: true,
            currentSequentialNumber: 1,
            dueDateType: 'none'
        }
    ]

    const renderGenerator = (props = {}) => {
        return render(
            <InvoiceGenerator
                project={baseProject}
                client={baseClient}
                projects={[baseProject]}
                setProjects={vi.fn()}
                tasks={[baseTask]}
                setTasks={vi.fn()}
                timeEntries={[baseEntry]}
                currentTimer={null}
                isPaused={false}
                editingInvoice={null}
                onInvoiceSaved={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[baseClient]}
                invoices={[]}
                setInvoices={vi.fn()}
                invoiceTemplates={templates}
                setInvoiceTemplates={vi.fn()}
                showButton={true}
                {...props}
            />
        )
    }

    beforeEach(() => {

        toastMocks.showSuccess.mockClear()
        toastMocks.showError.mockClear()
        toastMocks.showWarning.mockClear()
        modalConfig = { applyDateOverride: false }
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('creates a new invoice using date override and client currency', async () => {

        modalConfig.applyDateOverride = true
        const setInvoices = vi.fn()
        const user = userEvent.setup()

        renderGenerator({ setInvoices })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))

        await user.click(await screen.findByRole('button', { name: 'Set Override' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(setInvoices).toHaveBeenCalledTimes(1)
        const savedInvoices = setInvoices.mock.calls[0][0]
        expect(savedInvoices).toHaveLength(1)
        expect(savedInvoices[0].date).toBe('2026-01-10')
        expect(savedInvoices[0].dateOverride).toBe('2026-01-10')
        expect(savedInvoices[0].currency).toBe('EUR')
    })

    it('updates an existing invoice without changing id or number', async () => {

        const setInvoices = vi.fn()
        const user = userEvent.setup()
        const editingInvoice = {
            id: 'inv-1',
            invoiceNumber: 'INV-OLD',
            projectId: 'project-1',
            clientId: 'client-1',
            tasks: [{ id: 'task-1', hours: 1, hourlyRate: 100 }],
            date: '2026-01-05',
            createdAt: 111,
            paymentProcessed: false,
            templateId: 'tpl-1'
        }

        renderGenerator({
            editingInvoice,
            invoices: [editingInvoice],
            setInvoices
        })

        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(setInvoices).toHaveBeenCalledTimes(1)
        const savedInvoices = setInvoices.mock.calls[0][0]
        expect(savedInvoices).toHaveLength(1)
        expect(savedInvoices[0].id).toBe('inv-1')
        expect(savedInvoices[0].invoiceNumber).toBe('INV-OLD')
    })
})
