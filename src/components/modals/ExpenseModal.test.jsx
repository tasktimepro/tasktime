import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseModal from './ExpenseModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

const expensesMocks = vi.hoisted(() => ({

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
        recurrencesMocks.createRecurrence.mockImplementation((data) => ({ id: 'r1', ...data }))
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

    it('clears paid on when auto-payment is selected (one-time)', async () => {
        const user = userEvent.setup()

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const paidOnInput = screen.getByLabelText(/Paid On/i)
        await user.type(paidOnInput, '2026-02-01')
        expect(paidOnInput).toHaveValue('2026-02-01')

        await user.click(screen.getByLabelText(/Auto-payment/i))
        expect(paidOnInput).toHaveValue('')
    })

    it('clears paid on when auto-payment is selected (recurring)', async () => {
        const user = userEvent.setup()

        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        const paidOnInput = screen.getByLabelText(/Paid On/i)
        await user.type(paidOnInput, '2026-02-01')
        expect(paidOnInput).toHaveValue('2026-02-01')

        const typeSelect = Array.from(document.querySelectorAll('select')).find((element) => (
            element.querySelector('option[value="recurring"]')
        ))

        if (!typeSelect) {
            throw new Error('Expense type select not found')
        }

        fireEvent.change(typeSelect, { target: { value: 'recurring' } })
        await user.click(screen.getByLabelText(/Auto-payment/i))

        fireEvent.change(typeSelect, { target: { value: 'one-time' } })
        expect(screen.getByLabelText(/Paid On/i)).toHaveValue('')
    })

    it('keeps footer actions inline on mobile', () => {
        render(<ExpenseModal isOpen onClose={vi.fn()} />)

        expect(screen.getByRole('button', { name: 'Cancel' }).className).not.toContain('w-full')
        expect(screen.getByRole('button', { name: 'Create Expense' }).className).not.toContain('w-full')
    })
})
