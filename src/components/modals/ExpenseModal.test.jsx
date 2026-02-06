import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseModal from './ExpenseModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

const expensesMocks = vi.hoisted(() => ({

    createExpense: vi.fn(),
    updateExpense: vi.fn()
}))

const recurrencesMocks = vi.hoisted(() => ({

    createRecurrence: vi.fn()
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

vi.mock('../../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError
    })
}))

vi.mock('../../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        createExpense: expensesMocks.createExpense,
        updateExpense: expensesMocks.updateExpense
    })
}))

vi.mock('../../hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        createRecurrence: recurrencesMocks.createRecurrence
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
        const onClose = vi.fn()
        const user = userEvent.setup()

        render(<ExpenseModal isOpen onClose={onClose} />)

        await user.type(screen.getByLabelText(/Title/i), 'Adobe CC')
        await user.clear(screen.getByLabelText(/Amount/i))
        await user.type(screen.getByLabelText(/Amount/i), '54.99')
        await user.click(screen.getByLabelText(/Recurring/i))
        await user.click(screen.getByRole('button', { name: 'Create Expense' }))

        expect(recurrencesMocks.createRecurrence).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Adobe CC',
            repeat: 'monthly',
            amountType: 'fixed'
        }))
        expect(expensesMocks.createExpense).toHaveBeenCalled()
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Recurring expense created')
        expect(onClose).toHaveBeenCalled()
    })
})
