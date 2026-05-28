import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoiceGenerator from './InvoiceGenerator'

const pdfMocks = vi.hoisted(() => ({

    getCurrentInvoiceHtmlContent: vi.fn(() => '<html />')
}))

const businessBrandAssetHookMocks = vi.hoisted(() => ({

    businessBrandAssets: [],
    getBusinessBrandAsset: vi.fn(() => null)
}))

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn()
}))

const invoiceHookMocks = vi.hoisted(() => ({

    invoices: [],
    createInvoice: vi.fn((data) => ({ ...data, id: 'new-invoice-id' })),
    updateInvoice: vi.fn()
}))

const projectHookMocks = vi.hoisted(() => ({

    updateProject: vi.fn()
}))

const taskHookMocks = vi.hoisted(() => ({

    tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100 }],
    updateTask: vi.fn()
}))

const timeEntryHookMocks = vi.hoisted(() => ({

    updateEntry: vi.fn(),
    createEntry: vi.fn(),
    deleteEntry: vi.fn()
}))

const templateHookMocks = vi.hoisted(() => ({

    updateInvoiceTemplate: vi.fn(),
    invoiceTemplates: []
}))

const expenseHookMocks = vi.hoisted(() => ({

    expenses: [],
    markAsBilled: vi.fn(),
    markAsUnbilled: vi.fn()
}))

let modalConfig = {
    applyDateOverride: false,
    skipTemplateSelection: false,
    adjustTaskHours: null,
    billingPeriodPreset: null,
    billingPeriodStart: null,
    billingPeriodEnd: null
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
        invoices: invoiceHookMocks.invoices,
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
        tasks: taskHookMocks.tasks,
        updateTask: taskHookMocks.updateTask
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        updateEntry: timeEntryHookMocks.updateEntry,
        createEntry: timeEntryHookMocks.createEntry,
        deleteEntry: timeEntryHookMocks.deleteEntry
    })
}))

vi.mock('../hooks/useInvoiceTemplates.ts', () => ({

    useInvoiceTemplates: () => ({
        invoiceTemplates: templateHookMocks.invoiceTemplates,
        updateInvoiceTemplate: templateHookMocks.updateInvoiceTemplate
    })
}))

vi.mock('../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expenseHookMocks.expenses,
        markAsBilled: expenseHookMocks.markAsBilled,
        markAsUnbilled: expenseHookMocks.markAsUnbilled
    })
}))

vi.mock('../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        getTimerForProject: () => null,
        getTimerForTask: () => null
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

vi.mock('./invoice/InvoiceModal', () => {

    function MockInvoiceModal({
        showInvoiceForm,
        handleHoursChange,
        handleSaveInvoice,
        handleTemplateSelection,
        selectedBusinessInfo,
        setInvoiceDateOverride,
        setUseInvoiceDateOverride,
        setBillingPeriodPreset,
        setBillingPeriodStart,
        setBillingPeriodEnd,
    }) {
        const didApplyAdjustments = React.useRef(false)
        const didApplyBillingPeriod = React.useRef(false)

        React.useEffect(() => {
            if (!showInvoiceForm) {
                didApplyAdjustments.current = false
                didApplyBillingPeriod.current = false
                return
            }

            if (didApplyAdjustments.current || !modalConfig.adjustTaskHours) {
                return
            }

            didApplyAdjustments.current = true
            handleHoursChange(
                modalConfig.adjustTaskHours.taskId,
                modalConfig.adjustTaskHours.hours
            )
        }, [showInvoiceForm, handleHoursChange])

        React.useEffect(() => {
            if (!showInvoiceForm || didApplyBillingPeriod.current || !modalConfig.billingPeriodPreset) {
                return
            }

            didApplyBillingPeriod.current = true
            setBillingPeriodPreset(modalConfig.billingPeriodPreset)

            if (modalConfig.billingPeriodStart !== null) {
                setBillingPeriodStart(modalConfig.billingPeriodStart)
            }

            if (modalConfig.billingPeriodEnd !== null) {
                setBillingPeriodEnd(modalConfig.billingPeriodEnd)
            }
        }, [showInvoiceForm, setBillingPeriodEnd, setBillingPeriodPreset, setBillingPeriodStart])

        if (!showInvoiceForm) {
            return null
        }

        return (
            <div>
                <div data-testid="tax-status">
                    {selectedBusinessInfo?.taxEnabled
                        ? `${selectedBusinessInfo.taxLabel} ${selectedBusinessInfo.taxRate}%`
                        : 'no tax configured'}
                </div>
                {modalConfig.applyDateOverride && (
                    <button
                        type="button"
                        onClick={() => {
                            setUseInvoiceDateOverride(true)
                            setInvoiceDateOverride('2026-01-10')
                        }}
                    >
                        Set Override
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                        if (!modalConfig.skipTemplateSelection) {
                            handleTemplateSelection('tpl-1')
                        }
                        handleSaveInvoice({ preventDefault: () => {} })
                    }}
                >
                    Save Invoice
                </button>
            </div>
        )
    }

    return {
        default: MockInvoiceModal
    }
})

vi.mock('../utils/pdfUtils.ts', () => ({

    getCurrentInvoiceHtmlContent: pdfMocks.getCurrentInvoiceHtmlContent
}))

vi.mock('../hooks/useBusinessBrandAssets.ts', () => ({

    useBusinessBrandAssets: () => ({
        businessBrandAssets: businessBrandAssetHookMocks.businessBrandAssets,
        getBusinessBrandAsset: businessBrandAssetHookMocks.getBusinessBrandAsset
    })
}))

vi.mock('../utils/currencyUtils.ts', async () => {
    const actual = await vi.importActual('../utils/currencyUtils.ts')
    return {
        ...actual,
        fetchExchangeRates: vi.fn(() => Promise.resolve({
            rates: { USD: 1, EUR: 0.92, CHF: 0.88, GBP: 0.79 },
            error: null
        }))
    }
})

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
        invoiceHookMocks.invoices = []
        invoiceHookMocks.createInvoice.mockClear()
        invoiceHookMocks.updateInvoice.mockClear()
        templateHookMocks.updateInvoiceTemplate.mockClear()
        timeEntryHookMocks.updateEntry.mockClear()
        timeEntryHookMocks.createEntry.mockClear()
        timeEntryHookMocks.deleteEntry.mockClear()
        taskHookMocks.updateTask.mockClear()
        expenseHookMocks.expenses = []
        expenseHookMocks.markAsBilled.mockClear()
        expenseHookMocks.markAsUnbilled.mockClear()
        pdfMocks.getCurrentInvoiceHtmlContent.mockClear()
        businessBrandAssetHookMocks.getBusinessBrandAsset.mockClear()
        taskHookMocks.tasks = [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100 }]
        modalConfig = {
            applyDateOverride: false,
            skipTemplateSelection: false,
            adjustTaskHours: null,
            billingPeriodPreset: null,
            billingPeriodStart: null,
            billingPeriodEnd: null
        }
        templateHookMocks.invoiceTemplates = [
            {
                id: 'tpl-1',
                isDefault: true,
                invoiceNumberFormat: 'INV-{year}{month}{day}-{sequential}',
                useSequentialNumbers: true,
                currentSequentialNumber: 1,
                dueDateType: 'none'
            }
        ]
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('creates a new invoice using date override and client currency', { timeout: 20000 }, async () => {

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

    it('creates invoice adjustment entries when hours increase', async () => {

        const fixedNow = new Date('2026-01-19T12:00:00Z').getTime()
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)

        modalConfig.billingPeriodPreset = 'all-time'
        modalConfig.adjustTaskHours = { taskId: 'task-1', hours: 2 }
        timeEntryHookMocks.createEntry.mockClear()
        const user = userEvent.setup()

        renderGenerator()

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(timeEntryHookMocks.createEntry).toHaveBeenCalledTimes(1)
        const entry = timeEntryHookMocks.createEntry.mock.calls[0][0]
        expect(entry.taskId).toBe('task-1')
        expect(entry.source).toBe('invoice-adjustment')
        expect(entry.billedInvoiceId).toEqual(expect.any(String))
        expect(entry.end - entry.start).toBe(3600000)

        dateNowSpy.mockRestore()
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
            status: 'sent',
            template: { id: 'tpl-1', name: 'Template One' }
        }

        renderGenerator({
            editingInvoice
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await new Promise((resolve) => setTimeout(resolve, 0))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledTimes(1)
        const [invoiceId, invoiceData] = invoiceHookMocks.updateInvoice.mock.calls[0]
        expect(invoiceId).toBe('inv-1')
        expect(invoiceData.invoiceNumber).toBe('INV-OLD')
    })

    it('uses the live template sequence when history carries a stale template snapshot', async () => {

        modalConfig.skipTemplateSelection = true
        templateHookMocks.invoiceTemplates = [
            {
                id: 'tpl-1',
                name: 'Template One',
                isDefault: true,
                invoiceNumberFormat: 'INV-{sequential}',
                useSequentialNumbers: true,
                currentSequentialNumber: 160,
                dueDateType: 'none'
            }
        ]
        invoiceHookMocks.invoices = [
            {
                id: 'inv-159',
                projectId: 'project-1',
                clientId: 'client-1',
                createdAt: 100,
                invoiceNumber: 'INV-0159',
                templateId: 'tpl-1',
                template: {
                    id: 'tpl-1',
                    name: 'Template One',
                    invoiceNumberFormat: 'INV-{sequential}',
                    useSequentialNumbers: true,
                    currentSequentialNumber: 159,
                    dueDateType: 'none'
                }
            }
        ]

        const user = userEvent.setup()

        renderGenerator()

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
        expect(invoiceData.invoiceNumber).toBe('INV-0160')
        expect(invoiceData.template?.currentSequentialNumber).toBe(160)
        expect(templateHookMocks.updateInvoiceTemplate).toHaveBeenCalledWith('tpl-1', { currentSequentialNumber: 161 })
    })

    it('refreshes payment method data when updating an invoice', async () => {

        invoiceHookMocks.updateInvoice.mockClear()
        const user = userEvent.setup()

        const editingInvoice = {
            id: 'inv-2',
            invoiceNumber: 'INV-002',
            projectId: 'project-1',
            clientId: 'client-1',
            tasks: [{ id: 'task-1', hours: 1, hourlyRate: 100 }],
            date: '2026-01-05',
            createdAt: 222,
            paymentMethod: {
                id: 'pm-1',
                title: 'Old Method',
                custom: [{ label: 'Tag', value: 'Old' }]
            },
            template: { id: 'tpl-1', name: 'Template One' }
        }

        renderGenerator({
            editingInvoice,
            paymentMethods: [
                { id: 'pm-1', title: 'Updated Method', custom: [{ label: 'Tag', value: 'New' }] }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await new Promise((resolve) => setTimeout(resolve, 0))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledTimes(1)
        const [, invoiceData] = invoiceHookMocks.updateInvoice.mock.calls[0]
        expect(invoiceData.paymentMethod?.title).toBe('Updated Method')
        expect(invoiceData.paymentMethodId).toBe('pm-1')
    })

    it('refreshes business info data when updating an invoice', async () => {

        invoiceHookMocks.updateInvoice.mockClear()
        const user = userEvent.setup()

        const editingInvoice = {
            id: 'inv-3',
            invoiceNumber: 'INV-003',
            projectId: 'project-1',
            clientId: 'client-1',
            tasks: [{ id: 'task-1', hours: 1, hourlyRate: 100 }],
            date: '2026-01-05',
            createdAt: 333,
            businessInfo: {
                id: 'bi-1',
                name: 'Old Business'
            },
            template: { id: 'tpl-1', name: 'Template One' }
        }

        renderGenerator({
            editingInvoice,
            businessInfos: [
                { id: 'bi-1', name: 'Updated Business' }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await new Promise((resolve) => setTimeout(resolve, 0))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledTimes(1)
        const [, invoiceData] = invoiceHookMocks.updateInvoice.mock.calls[0]
        expect(invoiceData.businessInfo?.name).toBe('Updated Business')
        expect(invoiceData.businessInfoId).toBe('bi-1')
    })

    it('falls back to the first business info tax settings when no default business is marked', async () => {

        const user = userEvent.setup()

        renderGenerator({
            businessInfos: [
                {
                    id: 'bi-1',
                    title: 'Primary Business',
                    taxEnabled: true,
                    taxLabel: 'GST',
                    taxRate: 10,
                }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))

        expect(screen.getByTestId('tax-status')).toHaveTextContent('GST 10%')
    })

    it('uses the current business tax settings instead of a stale invoice snapshot', async () => {

        const user = userEvent.setup()
        invoiceHookMocks.invoices = [
            {
                id: 'inv-history-1',
                clientId: 'client-1',
                createdAt: 100,
                businessInfoId: 'bi-1',
                businessInfo: {
                    id: 'bi-1',
                    title: 'Old Business Snapshot',
                    taxEnabled: false,
                    taxLabel: 'VAT',
                    taxRate: 0,
                }
            }
        ]

        renderGenerator({
            businessInfos: [
                {
                    id: 'bi-1',
                    title: 'Updated Business',
                    taxEnabled: true,
                    taxLabel: 'VAT',
                    taxRate: 20,
                }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))

        expect(screen.getByTestId('tax-status')).toHaveTextContent('VAT 20%')
    })

    it('refreshes template data when updating an invoice', async () => {

        invoiceHookMocks.updateInvoice.mockClear()
        modalConfig.skipTemplateSelection = true
        const user = userEvent.setup()

        templateHookMocks.invoiceTemplates = [
            {
                id: 'tpl-1',
                name: 'Updated Template',
                isDefault: true,
                invoiceNumberFormat: 'INV-{year}{month}{day}-{sequential}',
                useSequentialNumbers: true,
                currentSequentialNumber: 1,
                dueDateType: 'none'
            }
        ]

        const editingInvoice = {
            id: 'inv-4',
            invoiceNumber: 'INV-004',
            projectId: 'project-1',
            clientId: 'client-1',
            tasks: [{ id: 'task-1', hours: 1, hourlyRate: 100 }],
            date: '2026-01-05',
            createdAt: 444,
            template: { id: 'tpl-1', name: 'Old Template' }
        }

        renderGenerator({
            editingInvoice
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await new Promise((resolve) => setTimeout(resolve, 0))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.updateInvoice).toHaveBeenCalledTimes(1)
        const [, invoiceData] = invoiceHookMocks.updateInvoice.mock.calls[0]
        expect(invoiceData.template?.name).toBe('Updated Template')
        expect(invoiceData.templateId).toBe('tpl-1')
    })

    it('snapshots billed hourly rate on time entries', async () => {

        const fixedDate = new Date('2026-01-11T10:00:00Z')
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime())
        try {
            modalConfig.billingPeriodPreset = 'all-time'
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

    it('sets lastBilledAt to latest billed entry end, not invoice save time', async () => {

        const fixedDate = new Date('2026-01-11T10:00:00Z')
        const fixedNow = fixedDate.getTime()
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
        try {
            modalConfig.billingPeriodPreset = 'all-time'
            const user = userEvent.setup()

            taskHookMocks.tasks = [
                { id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, hourlyRate: 100, lastBilledAt: 500 }
            ]
            taskHookMocks.updateTask.mockClear()

            renderGenerator({
                timeEntries: [
                    { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3601000 }
                ]
            })

            await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
            await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

            expect(taskHookMocks.updateTask).toHaveBeenCalledTimes(1)
            expect(taskHookMocks.updateTask).toHaveBeenCalledWith('task-1', {
                lastBilledAt: 3601000
            })
            expect(taskHookMocks.updateTask).not.toHaveBeenCalledWith('task-1', {
                lastBilledAt: fixedNow
            })
        } finally {
            dateNowSpy.mockRestore()
        }
    })

    it('orders created invoice tasks with subtasks under parent', async () => {

        invoiceHookMocks.createInvoice.mockClear()
        taskHookMocks.tasks = [
            { id: 'child-1', projectId: 'project-1', title: 'Child task', parentTaskId: 'parent-1', billable: true, hourlyRate: 100 },
            { id: 'parent-1', projectId: 'project-1', title: 'Parent task', billable: true, hourlyRate: 100 },
            { id: 'root-1', projectId: 'project-1', title: 'Root task', billable: true, hourlyRate: 100 }
        ]

        const user = userEvent.setup()
        renderGenerator({
            timeEntries: [
                { id: 'entry-child', taskId: 'child-1', start: 1000, end: 3601000 },
                { id: 'entry-parent', taskId: 'parent-1', start: 1000, end: 3601000 },
                { id: 'entry-root', taskId: 'root-1', start: 1000, end: 3601000 }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
        expect(invoiceData.tasks.map(task => task.id)).toEqual(['parent-1', 'child-1', 'root-1'])
    })

    it('omits selected tasks that compute to zero from saved invoices', async () => {

        invoiceHookMocks.createInvoice.mockClear()
        taskHookMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Implementation', billable: true, hourlyRate: 100 },
            { id: 'task-2', projectId: 'project-1', title: 'Discovery Workshop', billable: true, hourlyRate: 100 },
            { id: 'task-3', projectId: 'project-1', title: 'QA and Polish', billable: true, hourlyRate: 100 }
        ]

        const user = userEvent.setup()

        renderGenerator({
            timeEntries: [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3601000 }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
        expect(invoiceData.tasks.map(task => task.id)).toEqual(['task-1'])
        expect(invoiceData.htmlContent).toBeNull()
    })

    it('shows a warning and skips invoice generation when total is zero', async () => {

        modalConfig.adjustTaskHours = { taskId: 'task-1', hours: 0 }
        const user = userEvent.setup()

        renderGenerator()

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(await screen.findByRole('button', { name: 'Save Invoice' }))

        expect(toastMocks.showWarning).toHaveBeenCalledWith('Invoice total must be greater than 0 to generate an invoice')
        expect(invoiceHookMocks.createInvoice).not.toHaveBeenCalled()
        expect(templateHookMocks.updateInvoiceTemplate).not.toHaveBeenCalled()
    })

    it('defaults new invoices to all time billing period', async () => {

        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-04T12:00:00Z'))

        try {
            invoiceHookMocks.createInvoice.mockClear()

            renderGenerator()

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Open Invoice' }))
            })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Save Invoice' }))
            })

            expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
            const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
            expect(invoiceData.billingPeriodPreset).toBe('all-time')
            expect(invoiceData.billingPeriodStart).toBeNull()
            expect(invoiceData.billingPeriodEnd).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })

    it('refreshes invoice task hours when switching billing period presets', async () => {

        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-04T12:00:00Z'))

        try {
            modalConfig.billingPeriodPreset = 'all-time'
            invoiceHookMocks.createInvoice.mockClear()

            renderGenerator()

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Open Invoice' }))
            })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Save Invoice' }))
            })

            expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
            const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
            expect(invoiceData.tasks).toEqual([
                expect.objectContaining({
                    id: 'task-1',
                    hours: 1,
                })
            ])
            expect(invoiceData.subtotal).toBe(100)
            expect(invoiceData.total).toBe(100)
        } finally {
            vi.useRealTimers()
        }
    })

    it('persists custom billing periods into saved invoice data', async () => {

        modalConfig.billingPeriodPreset = 'custom'
        modalConfig.billingPeriodStart = '2026-03-10'
        modalConfig.billingPeriodEnd = '2026-03-31'
        invoiceHookMocks.createInvoice.mockClear()
        const user = userEvent.setup()

        const customRangeStart = Date.parse('2026-03-15T09:00:00Z')
        const customRangeEnd = customRangeStart + 3600000

        renderGenerator({
            timeEntries: [
                { id: 'entry-custom', taskId: 'task-1', start: customRangeStart, end: customRangeEnd }
            ]
        })

        await user.click(screen.getByRole('button', { name: 'Open Invoice' }))
        await user.click(screen.getByRole('button', { name: 'Save Invoice' }))

        expect(invoiceHookMocks.createInvoice).toHaveBeenCalledTimes(1)
        const invoiceData = invoiceHookMocks.createInvoice.mock.calls[0][0]
        expect(invoiceData.billingPeriodPreset).toBe('custom')
        expect(invoiceData.billingPeriodStart).toBe('2026-03-10')
        expect(invoiceData.billingPeriodEnd).toBe('2026-03-31')
        expect(invoiceData.htmlContent).toBeNull()
    })
})
