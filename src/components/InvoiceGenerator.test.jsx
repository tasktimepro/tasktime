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

const invoiceHookMocks = vi.hoisted(() => ({

    createInvoice: vi.fn((data) => ({ ...data, id: 'new-invoice-id' })),
    updateInvoice: vi.fn()
}))

const projectHookMocks = vi.hoisted(() => ({

    updateProject: vi.fn()
}))

const taskHookMocks = vi.hoisted(() => ({

    updateTask: vi.fn()
}))

const timeEntryHookMocks = vi.hoisted(() => ({

    updateEntry: vi.fn()
}))

const templateHookMocks = vi.hoisted(() => ({

    updateInvoiceTemplate: vi.fn()
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

vi.mock('../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        invoices: [],
        createInvoice: invoiceHookMocks.createInvoice,
        updateInvoice: invoiceHookMocks.updateInvoice
    })
}))

vi.mock('../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: [{ id: 'project-1', title: 'Project', hourlyRate: 100, invoiceIds: [] }],
        updateProject: projectHookMocks.updateProject
    })
}))

vi.mock('../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100 }],
        updateTask: taskHookMocks.updateTask
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        updateEntry: timeEntryHookMocks.updateEntry
    })
}))

vi.mock('../hooks/useInvoiceTemplates.ts', () => ({

    useInvoiceTemplates: () => ({
        invoiceTemplates: [
            {
                id: 'tpl-1',
                isDefault: true,
                invoiceNumberFormat: 'INV-{year}{month}{day}-{sequential}',
                useSequentialNumbers: true,
                currentSequentialNumber: 1,
                dueDateType: 'none'
            }
        ],
        updateInvoiceTemplate: templateHookMocks.updateInvoiceTemplate
    })
}))

vi.mock('../hooks/useTimer.ts', () => ({

    useTimer: () => ({
        isActive: false,
        isPaused: false
    })
}))

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
    const baseEntry = { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3601000 }

    const renderGenerator = (props = {}) => {
        return render(
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
                {...props}
            />
        )
    }

    beforeEach(() => {

        toastMocks.showSuccess.mockClear()
        toastMocks.showError.mockClear()
        toastMocks.showWarning.mockClear()
        timeEntryHookMocks.updateEntry.mockClear()
        modalConfig = { applyDateOverride: false }
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('creates a new invoice using date override and client currency', async () => {

        modalConfig.applyDateOverride = true
        invoiceHookMocks.createInvoice.mockClear()
        const user = userEvent.setup()

        renderGenerator()

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))

        await user.click(await screen.findByRole('button', { name: 'Set Override' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
        expect(invoiceData.date).toBe('2026-01-10')
        expect(invoiceData.dateOverride).toBe('2026-01-10')
        expect(invoiceData.currency).toBe('EUR')
    })

    it('updates an existing invoice without changing id or number', async () => {

        invoiceHookMocks.updateInvoice.mockClear()
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
            template: { id: 'tpl-1', name: 'Template One' }
        }

        renderGenerator({
            editingInvoice
        })

        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledTimes(1)
        const [invoiceId, invoiceData] = invoiceHookMocks.updateInvoice.mock.calls[0]
        expect(invoiceId).toBe('inv-1')
        expect(invoiceData.invoiceNumber).toBe('INV-OLD')
    })

    it('snapshots billed hourly rate on time entries', async () => {

        const fixedDate = new Date('2026-01-11T10:00:00Z')
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime())
        try {
            const user = userEvent.setup()
            timeEntryHookMocks.updateEntry.mockClear()

            renderGenerator()

            await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
            await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

            const expectedInvoiceId = `INV-roject-1-${fixedDate.getTime()}`

            expect(timeEntryHookMocks.updateEntry).toHaveBeenCalledTimes(1)
            const [entryId, updates] = timeEntryHookMocks.updateEntry.mock.calls[0]
            expect(entryId).toBe('entry-1')
            expect(updates).toEqual(expect.objectContaining({
                billedHourlyRate: 100,
                billedAt: fixedDate.getTime(),
                billedInvoiceId: expectedInvoiceId
            }))
        } finally {
            dateNowSpy.mockRestore()
        }
    })
})
