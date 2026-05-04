import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesSection from './ExpensesSection'

const hookMocks = vi.hoisted(() => ({

    expenses: [],
    recurrences: [],
    markAsPaid: vi.fn(),
    markAsUnpaid: vi.fn(),
    showError: vi.fn()
}))

vi.mock('@/hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: hookMocks.expenses,
        markAsPaid: hookMocks.markAsPaid,
        markAsUnpaid: hookMocks.markAsUnpaid
    })
}))

vi.mock('@/hooks/useToast.ts', () => ({

    useToast: () => ({
        showError: hookMocks.showError,
    })
}))

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        recurrences: hookMocks.recurrences
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

        hookMocks.expenses = [
            baseExpense,
            {
                ...baseExpense,
                id: 'expense-2',
                title: 'Other Client',
                clientId: 'client-2'
            }
        ]
        hookMocks.recurrences = []
        hookMocks.markAsPaid.mockReset()
        hookMocks.markAsPaid.mockResolvedValue(undefined)
        hookMocks.markAsUnpaid.mockReset()
        hookMocks.showError.mockReset()
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

        await user.click(screen.getByRole('button', { name: 'New Expense' }))

        expect(openExpenseModal).toHaveBeenCalledWith(null, expect.objectContaining({ clientId: 'client-1' }))
    })

    it('shows upcoming recurring previews in the main list', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 1, 10, 0, 0));

        hookMocks.recurrences = [
            {
                id: 'rec-1',
                title: 'Monthly Hosting',
                repeat: 'monthly',
                startDate: '2026-02-03',
                amount: 20,
                amountType: 'fixed',
                active: true,
                clientId: 'client-1',
                projectId: null,
                isPersonal: false
            }
        ];

        render(
            <ExpensesSection
                clientId="client-1"
                openExpenseModal={vi.fn()}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Expenses (2)' }))

        expect(screen.getByText('Monthly Hosting')).toBeInTheDocument()

        vi.useRealTimers();
    })
})
