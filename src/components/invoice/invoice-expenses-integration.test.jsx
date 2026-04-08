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

const invoiceOnlyTestState = vi.hoisted(() => ({
    enabled: false
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

vi.mock('../invoice/InvoiceModal', () => {

    function MockInvoiceModal({
        availableExpenses = [],
        handleAddAdditionalExpense,
        handleSaveInvoice,
        handleTemplateSelection,
        newExpenseTitle,
        setNewExpenseAmount,
        setNewExpenseCurrency,
        setNewExpenseSupplierName,
        setNewExpenseTitle,
        setSelectedExpensesForBilling,
        selectedTemplate,
        showInvoiceForm,
    }) {
        const didSelectExpenses = React.useRef(false)
        const didAddInvoiceOnly = React.useRef(false)

        React.useEffect(() => {
            if (!showInvoiceForm) {
                didSelectExpenses.current = false
                didAddInvoiceOnly.current = false
                return
            }

            if (!selectedTemplate) {
                handleTemplateSelection('tpl-1')
                return
            }

            if (!didSelectExpenses.current) {
                didSelectExpenses.current = true
                const selection = {}
                availableExpenses.forEach((expense) => {
                    if (expense.isConvertible !== false) {
                        selection[expense.id] = true
                    }
                })
                setSelectedExpensesForBilling(selection)
                return
            }

            if (invoiceOnlyTestState.enabled && !didAddInvoiceOnly.current) {
                if (!newExpenseTitle) {
                    setNewExpenseTitle('Invoice-only expense')
                    setNewExpenseAmount('80')
                    setNewExpenseCurrency('EUR')
                    setNewExpenseSupplierName('Vendor')
                    return
                }

                didAddInvoiceOnly.current = true
                handleAddAdditionalExpense()
                return
            }

            handleSaveInvoice({ preventDefault: () => {} })
        }, [
            availableExpenses,
            handleAddAdditionalExpense,
            handleSaveInvoice,
            handleTemplateSelection,
            newExpenseTitle,
            selectedTemplate,
            setNewExpenseAmount,
            setNewExpenseCurrency,
            setNewExpenseSupplierName,
            setNewExpenseTitle,
            setSelectedExpensesForBilling,
            showInvoiceForm,
        ])

        return showInvoiceForm ? <div>Invoice Modal</div> : null
    }

    return {
        default: MockInvoiceModal
    }
})

vi.mock('../../utils/pdfUtils.ts', () => ({

    createInvoiceHTML: vi.fn(() => '<html />')
}))

vi.mock('../../utils/currencyUtils.ts', async () => {
    const actual = await vi.importActual('../../utils/currencyUtils.ts')
    return {
        ...actual,
        fetchExchangeRates: vi.fn(() => Promise.resolve({
            rates: { USD: 1, EUR: 0.92, CHF: 0.88, GBP: 0.79 },
            error: null
        }))
    }
})

describe('invoice expenses integration', () => {

    const baseProject = { id: 'project-1', title: 'Project', hourlyRate: 100, invoiceIds: [] }
    const baseClient = { id: 'client-1', clientName: 'Client', defaultCurrency: 'EUR' }
    const baseEntry = { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3601000 }

    beforeEach(() => {
        invoiceHookMocks.createInvoice.mockClear()
        expenseHookMocks.markAsBilled.mockClear()
        expenseHookMocks.markAsUnbilled.mockClear()
        invoiceOnlyTestState.enabled = false

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

    it('saves invoice with same-currency expenses (no conversion needed)', async () => {
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
                expenseId: 'exp-1',
                originalAmount: 125,
                originalCurrency: 'EUR',
                exchangeRate: 1
            }
        ])
        expect(expenseHookMocks.markAsBilled).toHaveBeenCalledWith('exp-1', invoiceData.id)
    })

    it('converts cross-currency expenses to invoice currency', async () => {
        // Expense is in GBP, client default is EUR
        // With rates: USD=1, EUR=0.92, GBP=0.79
        // GBP→EUR: (100 / 0.79) * 0.92 = 116.46 (rounded to 2dp)
        expenseHookMocks.expenses = [
            {
                id: 'exp-gbp',
                title: 'UK Service',
                date: '2026-02-01',
                amount: 100,
                currency: 'GBP',
                billable: true,
                billingStatus: 'unbilled',
                clientId: 'client-1',
                projectId: 'project-1',
                isPersonal: false
            }
        ]

        const user = userEvent.setup()

        // Override the mock InvoiceModal to select the GBP expense
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

        // Verify the expense was converted
        const expenseItem = invoiceData.items.find(i => i.expenseId === 'exp-gbp')
        expect(expenseItem).toBeTruthy()
        expect(expenseItem.originalAmount).toBe(100)
        expect(expenseItem.originalCurrency).toBe('GBP')
        // GBP→EUR via USD: (100 / 0.79) * 0.92 ≈ 116.46
        expect(expenseItem.amount).toBeCloseTo(116.46, 1)
        expect(expenseItem.rate).toBeCloseTo(116.46, 1)
        expect(expenseItem.exchangeRate).toBeGreaterThan(1) // GBP is worth more than EUR
        expect(expenseHookMocks.markAsBilled).toHaveBeenCalledWith('exp-gbp', invoiceData.id)
    })

    it('does not include non-convertible expenses when rates are unavailable', async () => {
        // Override fetchExchangeRates to return null rates
        const currencyUtils = await import('../../utils/currencyUtils.ts')
        currencyUtils.fetchExchangeRates.mockResolvedValueOnce({
            rates: null,
            error: 'Unable to load exchange rates.'
        })

        expenseHookMocks.expenses = [
            {
                id: 'exp-chf',
                title: 'Swiss Expense',
                date: '2026-02-01',
                amount: 200,
                currency: 'CHF',
                billable: true,
                billingStatus: 'unbilled',
                clientId: 'client-1',
                projectId: 'project-1',
                isPersonal: false
            }
        ]

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

        // The non-convertible expense should NOT be included in invoice items
        const expenseItem = invoiceData.items.find(i => i.expenseId === 'exp-chf')
        expect(expenseItem).toBeUndefined()
        expect(expenseHookMocks.markAsBilled).not.toHaveBeenCalled()
    })

    it('adds invoice-only expenses as invoice items', async () => {
        expenseHookMocks.expenses = []
        invoiceOnlyTestState.enabled = true

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
        const invoiceOnlyItem = invoiceData.items.find((item) => !item.expenseId && item.description === 'Invoice-only expense')

        expect(invoiceOnlyItem).toBeTruthy()
        expect(invoiceOnlyItem.amount).toBe(80)
        expect(invoiceOnlyItem.rate).toBe(80)
        expect(invoiceOnlyItem.originalAmount).toBe(80)
        expect(invoiceOnlyItem.originalCurrency).toBe('EUR')
        expect(expenseHookMocks.markAsBilled).not.toHaveBeenCalled()
    })
})
