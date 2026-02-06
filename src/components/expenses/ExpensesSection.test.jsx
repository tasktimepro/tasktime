import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesSection from './ExpensesSection'

const navigateToExpensesMock = vi.fn()

const hookMocks = vi.hoisted(() => ({

    expenses: []
}))

vi.mock('@/hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: hookMocks.expenses
    })
}))

vi.mock('@/hooks/usePreferences.ts', () => ({

    usePreferences: () => ({
        preferences: { currency: 'USD' }
    })
}))

vi.mock('@/hooks/useUrlState.ts', () => ({

    useUrlState: () => ({
        navigateToExpenses: navigateToExpensesMock
    })
}))

vi.mock('./ExpenseList', () => ({

    default: ({ expenses }) => (
        <div data-testid="expense-list">
            {expenses.map((expense) => (
                <div key={expense.id}>{expense.title}</div>
            ))}
        </div>
    )
}))

describe('ExpensesSection', () => {

    let user

    const baseExpense = {
        id: 'expense-1',
        title: 'Adobe CC',
        date: '2026-02-01',
        amount: 50,
        currency: 'USD',
        paymentStatus: 'unpaid',
        billingStatus: 'unbilled',
        billable: true,
        clientId: 'client-1',
        projectId: null,
        isPersonal: false
    }

    beforeEach(() => {

        navigateToExpensesMock.mockClear()
        hookMocks.expenses = [
            baseExpense,
            {
                ...baseExpense,
                id: 'expense-2',
                title: 'Other Client',
                clientId: 'client-2'
            }
        ]
        user = userEvent.setup()
    })

    it('renders collapsed by default', () => {
        render(
            <ExpensesSection
                clientId="client-1"
                openExpenseModal={vi.fn()}
            />
        )

        expect(screen.getByText('Expenses (1)')).toBeInTheDocument()
        expect(screen.getByText('Unbilled: $50.00')).toBeInTheDocument()
        expect(screen.queryByTestId('expense-list')).not.toBeInTheDocument()
    })

    it('expands on header click', async () => {
        render(
            <ExpensesSection
                clientId="client-1"
                openExpenseModal={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Expenses (1)' }))

        expect(screen.getByTestId('expense-list')).toBeInTheDocument()
        expect(screen.getByText('Adobe CC')).toBeInTheDocument()
    })

    it('calls openExpenseModal with prefill on add', async () => {
        const openExpenseModal = vi.fn()

        render(
            <ExpensesSection
                clientId="client-1"
                openExpenseModal={openExpenseModal}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Expenses (1)' }))
        await user.click(screen.getByRole('button', { name: 'Add Expense' }))

        expect(openExpenseModal).toHaveBeenCalledWith(null, expect.objectContaining({ clientId: 'client-1' }))
    })

    it('navigates to expenses with filters', async () => {
        render(
            <ExpensesSection
                clientId="client-1"
                openExpenseModal={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Expenses (1)' }))
        await user.click(screen.getByRole('button', { name: 'View all expenses' }))

        expect(navigateToExpensesMock).toHaveBeenCalledWith({
            expenseClientId: 'client-1',
            expenseProjectId: null
        })
    })
})
