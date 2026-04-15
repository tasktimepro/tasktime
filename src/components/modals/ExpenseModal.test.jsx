import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseModal from './ExpenseModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

const expensesMocks = vi.hoisted(() => ({

    expenses: [],
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn()
}))

const recurrencesMocks = vi.hoisted(() => ({

    createRecurrence: vi.fn(),
    getRecurrence: vi.fn(),
    updateRecurrence: vi.fn(),
    deleteRecurrence: vi.fn()
}))

const clientsMocks = vi.hoisted(() => ({

    clients: []
}))

const projectsMocks = vi.hoisted(() => ({

    projects: [],
    getProjectsByClient: vi.fn(() => [])
}))

const preferencesMocks = vi.hoisted(() => ({

    preferences: { currency: 'EUR' }
}))

const businessInfosMocks = vi.hoisted(() => ({

    businessInfos: [],
    defaultBusinessInfo: null
}))

const paymentMethodsMocks = vi.hoisted(() => ({

    paymentMethods: [],
    defaultPaymentMethod: null
}))

vi.mock('../../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError
    })
}))

vi.mock('../../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expensesMocks.expenses,
        createExpense: expensesMocks.createExpense,
        updateExpense: expensesMocks.updateExpense,
        deleteExpense: expensesMocks.deleteExpense
    })
}))

vi.mock('../../hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        createRecurrence: recurrencesMocks.createRecurrence,
        getRecurrence: recurrencesMocks.getRecurrence,
        updateRecurrence: recurrencesMocks.updateRecurrence,
        deleteRecurrence: recurrencesMocks.deleteRecurrence
    })
}))

vi.mock('../../hooks/useClients.ts', () => ({

    useClients: () => ({
        clients: clientsMocks.clients
    })
}))

vi.mock('../../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: projectsMocks.projects,
        getProjectsByClient: projectsMocks.getProjectsByClient
    })
}))

vi.mock('../../hooks/usePreferences.ts', () => ({

    usePreferences: () => ({
        preferences: preferencesMocks.preferences
    })
}))

vi.mock('../../hooks/useBusinessInfos.ts', () => ({

    useBusinessInfos: () => ({
        businessInfos: businessInfosMocks.businessInfos,
        defaultBusinessInfo: businessInfosMocks.defaultBusinessInfo
    })
}))

vi.mock('../../hooks/usePaymentMethods.ts', () => ({

    usePaymentMethods: () => ({
        paymentMethods: paymentMethodsMocks.paymentMethods,
        defaultPaymentMethod: paymentMethodsMocks.defaultPaymentMethod
    })
}))

describe('ExpenseModal', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        expensesMocks.expenses = []
        recurrencesMocks.createRecurrence.mockImplementation((data) => ({ id: 'r1', ...data }))
        clientsMocks.clients = []
        projectsMocks.projects = []
        projectsMocks.getProjectsByClient.mockReturnValue([])
        businessInfosMocks.businessInfos = []
        businessInfosMocks.defaultBusinessInfo = null
        paymentMethodsMocks.paymentMethods = []
        paymentMethodsMocks.defaultPaymentMethod = null
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('creates a one-time expense', async () => {
        const onClose = vi.fn()
        const user = userEvent.setup()

        render(<ExpenseModal isOpen onClose={onClose} />)

        await user.type(screen.getByLabelText(/Title/i), 'Office supplies')
        await user.clear(screen.getByLabelText(/Amount/i))
        await user.type(screen.getByLabelText(/Amount/i), '45.50')
        await user.click(screen.getByRole('button', { name: 'Create Expense' }))

        expect(expensesMocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Office supplies',
            amount: 45.50,
            isRecurring: false
        }))
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Expense created')
        expect(onClose).toHaveBeenCalled()
    })

    it('validates required title', async () => {
        const user = userEvent.setup()
        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Create Expense' }))
        expect(toastMocks.showError).toHaveBeenCalledWith('Expense title is required')
    })

    it('updates an existing expense', async () => {
        const onClose = vi.fn()
        const user = userEvent.setup()
        const editingExpense = {
            id: 'e1',
            title: 'Old expense',
            date: '2025-01-10',
            amount: 10,
            currency: 'EUR',
            paymentStatus: 'unpaid',
            billingStatus: 'unbilled',
            isPersonal: true,
            billable: false,
            isRecurring: false,
            isTaxExempt: false,
        }

        render(<ExpenseModal isOpen onClose={onClose} editingExpense={editingExpense} />)

        const titleInput = screen.getByLabelText(/Title/i)
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated expense')
        await user.click(screen.getByRole('button', { name: 'Save Expense' }))

        expect(expensesMocks.updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({
            title: 'Updated expense'
        }))
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Expense updated')
        expect(onClose).toHaveBeenCalled()
    })

    it('shows only the amount field for a paid recurring expense instance submit flow', () => {
        const editingExpense = {
            id: 'e-rec-1',
            title: 'Phone bill',
            date: '2026-04-13',
            amount: 89.99,
            amountType: 'fixed',
            currency: 'EUR',
            paymentStatus: 'paid',
            paymentMode: 'manual',
            paidOn: '2026-04-13',
            billingStatus: 'unbilled',
            isPersonal: true,
            billable: false,
            isRecurring: true,
            isTaxExempt: false,
        }

        render(<ExpenseModal isOpen onClose={vi.fn()} editingExpense={editingExpense} />)

        expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
        expect(screen.getByLabelText(/Amount/i)).toHaveValue(89.99)
        expect(screen.queryByLabelText(/Title/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^Date/i)).not.toBeInTheDocument()
    })

    it('creates a recurring expense template and first instance', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 1, 12));
        const onClose = vi.fn()

        render(<ExpenseModal isOpen onClose={onClose} />)

        fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Adobe CC' } })
        fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '54.99' } })
        const typeSelect = Array.from(document.querySelectorAll('select')).find((element) => (
            element.querySelector('option[value="recurring"]')
        ))

        if (!typeSelect) {
            throw new Error('Expense type select not found')
        }

        fireEvent.change(typeSelect, { target: { value: 'recurring' } })
        fireEvent.click(screen.getByRole('button', { name: 'Create Expense' }))

        expect(recurrencesMocks.createRecurrence).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Adobe CC',
            repeat: 'monthly',
            amountType: 'fixed'
        }))
        expect(expensesMocks.createExpense).toHaveBeenCalled()
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Recurring expense created')
        expect(onClose).toHaveBeenCalled()

        vi.useRealTimers();
    })

    it('defaults new one-time expenses dated today to automatically paid and mirrors paid on', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-13T12:00:00Z'))

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const checkbox = screen.getByRole('checkbox', { name: /Automatically paid on expense date/i })
        const paidOnInput = screen.getByLabelText(/^Paid On$/i)

        expect(checkbox.getAttribute('aria-checked')).toBe('true')
        expect(paidOnInput).toHaveValue('2026-04-13')
        expect(paidOnInput.disabled).toBe(true)
    })

    it('leaves auto-payment off for new future-dated one-time expenses', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-13T12:00:00Z'))

        render(<ExpenseModal isOpen onClose={vi.fn()} modalOptions={{ date: '2026-04-20' }} />)

        const checkbox = screen.getByRole('checkbox', { name: /Automatically paid on expense date/i })
        const paidOnInput = screen.getByLabelText(/^Paid On$/i)

        expect(checkbox.getAttribute('aria-checked')).toBe('false')
        expect(paidOnInput).toHaveValue('')
        expect(paidOnInput.disabled).toBe(false)
    })

    it('switches auto-payment off when a defaulted one-time expense date moves away from today', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-13T12:00:00Z'))

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const checkbox = screen.getByRole('checkbox', { name: /Automatically paid on expense date/i })
        const expenseDateInput = screen.getByLabelText(/^Date/i)
        const paidOnInput = screen.getByLabelText(/^Paid On$/i)

        fireEvent.change(expenseDateInput, { target: { value: '2026-04-20' } })

        expect(checkbox.getAttribute('aria-checked')).toBe('false')
        expect(paidOnInput).toHaveValue('')
        expect(paidOnInput.disabled).toBe(false)
    })

    it('keeps one-time auto-payment on and syncs paid on when the user explicitly enables it', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-13T12:00:00Z'))

        render(<ExpenseModal isOpen onClose={vi.fn()} modalOptions={{ date: '2026-04-20' }} />)

        const checkbox = screen.getByRole('checkbox', { name: /Automatically paid on expense date/i })
        const expenseDateInput = screen.getByLabelText(/^Date/i)
        const paidOnInput = screen.getByLabelText(/^Paid On$/i)

        fireEvent.click(checkbox)

        expect(checkbox.getAttribute('aria-checked')).toBe('true')
        expect(paidOnInput).toHaveValue('2026-04-20')
        expect(paidOnInput.disabled).toBe(true)

        fireEvent.change(expenseDateInput, { target: { value: '2026-04-21' } })

        expect(checkbox.getAttribute('aria-checked')).toBe('true')
        expect(paidOnInput).toHaveValue('2026-04-21')
        expect(paidOnInput.disabled).toBe(true)
    })

    it('restores the one-time smart default instead of carrying recurring auto-payment back across type changes', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-13T12:00:00Z'))

        render(<ExpenseModal isOpen onClose={vi.fn()} modalOptions={{ date: '2026-04-20' }} />)

        const typeSelect = Array.from(document.querySelectorAll('select')).find((element) => (
            element.querySelector('option[value="recurring"]')
        ))

        if (!typeSelect) {
            throw new Error('Expense type select not found')
        }

        fireEvent.change(typeSelect, { target: { value: 'recurring' } })
        fireEvent.click(screen.getByRole('checkbox', { name: /Auto-payment/i }))

        fireEvent.change(typeSelect, { target: { value: 'one-time' } })

        expect(screen.getByRole('checkbox', { name: /Automatically paid on expense date/i }).getAttribute('aria-checked')).toBe('false')
        expect(screen.getByLabelText(/^Paid On$/i)).toHaveValue('')
    })

    it('keeps footer actions inline on mobile', () => {
        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        expect(screen.getByRole('button', { name: 'Cancel' }).className).not.toContain('w-full')
    })

    it('uses shared two-column mobile rows for date and amount, and for currency and supplier', () => {
        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const dateRow = screen.getByLabelText(/^Date/i).closest('div.grid')
        const amountRow = screen.getByLabelText(/^Amount/i).closest('div.grid')
        const currencyRow = screen.getByText('Currency').closest('div.grid')
        const supplierRow = screen.getByLabelText('Supplier / Business').closest('div.grid')

        expect(dateRow).not.toBeNull()
        expect(dateRow).toBe(amountRow)
        expect(dateRow.className).toContain('grid-cols-2')

        expect(currencyRow).not.toBeNull()
        expect(currencyRow).toBe(supplierRow)
        expect(currencyRow.className).toContain('grid-cols-2')
    })

    it('shows recent title suggestions on focus and prefers the best typed match first', async () => {
        const user = userEvent.setup()

        expensesMocks.expenses = [
            { id: 'expense-1', title: 'Printer ink', supplierName: 'Paper Depot', date: '2026-02-01', updatedAt: 1706745600000 },
            { id: 'expense-2', title: 'Office supplies', supplierName: 'Stationery Hub', date: '2026-03-01', updatedAt: 1709251200000 },
            { id: 'expense-3', title: 'Printer paper', supplierName: 'Paper Depot', date: '2026-04-01', updatedAt: 1711929600000 }
        ]

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const titleInput = screen.getByLabelText(/Title/i)

        await user.click(titleInput)

        const titleSuggestionList = screen.getByRole('listbox', { name: 'Recent expense titles' }).parentElement

        const titleOptions = screen.getAllByRole('option', { name: /Printer|Office/i })

        expect(titleSuggestionList).not.toBeNull()
        expect(titleSuggestionList.className).toContain('max-h-60')
        expect(titleSuggestionList.className).toContain('overflow-y-auto')

        expect(titleOptions.map((option) => option.textContent)).toEqual([
            'Printer paper',
            'Office supplies',
            'Printer ink'
        ])

        await user.type(titleInput, 'print')

        const filteredTitleOptions = screen.getAllByRole('option', { name: /Printer/i })

        expect(filteredTitleOptions.map((option) => option.textContent)).toEqual([
            'Printer paper',
            'Printer ink'
        ])
    })

    it('shows recent supplier suggestions on focus and applies a clicked suggestion', async () => {
        const user = userEvent.setup()

        expensesMocks.expenses = [
            { id: 'expense-1', title: 'Printer ink', supplierName: 'Alpha Office', date: '2026-02-01', updatedAt: 1706745600000 },
            { id: 'expense-2', title: 'Office supplies', supplierName: 'Acme Supplies', date: '2026-03-01', updatedAt: 1709251200000 },
            { id: 'expense-3', title: 'Printer paper', supplierName: 'Acme Print', date: '2026-04-01', updatedAt: 1711929600000 }
        ]

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const supplierInput = screen.getByLabelText('Supplier / Business')

        await user.click(supplierInput)

        const supplierOptions = screen.getAllByRole('option', { name: /Acme|Alpha/i })

        expect(supplierOptions.map((option) => option.textContent)).toEqual([
            'Acme Print',
            'Acme Supplies',
            'Alpha Office'
        ])

        await user.type(supplierInput, 'acme s')

        const bestSupplierMatch = screen.getAllByRole('option', { name: /Acme/i })

        expect(bestSupplierMatch[0].textContent).toBe('Acme Supplies')

        await user.click(bestSupplierMatch[0])

        expect(supplierInput).toHaveValue('Acme Supplies')
    })

    it('locks a personal project context and keeps the expense personal', () => {
        projectsMocks.projects = [
            {
                id: 'project-personal',
                title: 'Studio admin',
                isPersonal: true,
                archived: false,
                preferredClientId: null
            }
        ]

        render(
            <ExpenseModal
                isOpen
                onClose={vi.fn()}
                modalOptions={{ projectId: 'project-personal' }}
            />
        )

        const projectSelect = screen.getByLabelText('Project')
        const businessCheckbox = screen.getByRole('checkbox', { name: 'Business Expense' })

        expect(businessCheckbox).not.toBeChecked()
        expect(businessCheckbox).toBeDisabled()
        expect(projectSelect).toBeDisabled()
        expect(projectSelect.textContent).toContain('Studio admin')
        expect(screen.queryByLabelText('Client')).not.toBeInTheDocument()
    })

    it('locks a client project context and derives the business assignment from the project', async () => {
        clientsMocks.clients = [
            { id: 'client-1', title: 'Acme Co', archived: false }
        ]
        projectsMocks.projects = [
            {
                id: 'project-client',
                title: 'Website refresh',
                isPersonal: false,
                archived: false,
                preferredClientId: 'client-1'
            }
        ]
        businessInfosMocks.businessInfos = [
            { id: 'business-1', title: 'TaskTime LLC', taxNumber: 'TAX-123' }
        ]
        businessInfosMocks.defaultBusinessInfo = businessInfosMocks.businessInfos[0]
        projectsMocks.getProjectsByClient.mockReturnValue(projectsMocks.projects)

        render(
            <ExpenseModal
                isOpen
                onClose={vi.fn()}
                modalOptions={{ projectId: 'project-client' }}
            />
        )

        const businessCheckbox = screen.getByRole('checkbox', { name: 'Business Expense' })
        const clientSelect = screen.getByLabelText('Client')
        const projectSelect = screen.getByLabelText('Project')

        expect(businessCheckbox).toBeChecked()
        expect(businessCheckbox).toBeDisabled()
        expect(clientSelect).toBeDisabled()
        expect(projectSelect).toBeDisabled()
        expect(clientSelect.textContent).toContain('Acme Co')
        expect(projectSelect.textContent).toContain('Website refresh')
    })
})
