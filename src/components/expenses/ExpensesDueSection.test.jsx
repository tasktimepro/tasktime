import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpensesDueSection from './ExpensesDueSection'

const expensesMock = vi.hoisted(() => [])
const markAsPaidMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expensesMock,
        markAsPaid: markAsPaidMock,
    })
}))

vi.mock('@/hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: showSuccessMock,
        showError: showErrorMock,
    })
}))

describe('ExpensesDueSection', () => {

    beforeEach(() => {
        expensesMock.length = 0
        markAsPaidMock.mockReset()
        showSuccessMock.mockReset()
        showErrorMock.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-06T12:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders overdue, today, and upcoming groups', () => {
        expensesMock.push(
            { id: 'exp-1', title: 'Overdue Bill', date: '2026-02-05', paymentStatus: 'unpaid', amount: 10, amountType: 'fixed', currency: 'USD' },
            { id: 'exp-2', title: 'Today Bill', date: '2026-02-06', paymentStatus: 'unpaid', amount: 12, amountType: 'fixed', currency: 'USD' },
            { id: 'exp-3', title: 'Upcoming Bill', date: '2026-02-10', paymentStatus: 'unpaid', amount: 15, amountType: 'fixed', currency: 'USD' },
            { id: 'exp-4', title: 'Paid Bill', date: '2026-02-05', paymentStatus: 'paid', amount: 8, amountType: 'fixed', currency: 'USD' }
        )

        render(<ExpensesDueSection openExpenseModal={vi.fn()} />)

        expect(screen.getByText('Expenses Due (3)')).toBeInTheDocument()
        expect(screen.getByText('Overdue (1)')).toBeInTheDocument()
        expect(screen.getByText('Today (1)')).toBeInTheDocument()
        expect(screen.getByText('Upcoming (1)')).toBeInTheDocument()
        expect(screen.getByText('Overdue Bill')).toBeInTheDocument()
        expect(screen.getByText('Today Bill')).toBeInTheDocument()
        expect(screen.getByText('Upcoming Bill')).toBeInTheDocument()
        expect(screen.queryByText('Paid Bill')).not.toBeInTheDocument()
    })

    it('hides section when there are no unpaid expenses', () => {
        expensesMock.push(
            { id: 'exp-1', title: 'Paid', date: '2026-02-05', paymentStatus: 'paid', amount: 10, amountType: 'fixed', currency: 'USD' }
        )

        render(<ExpensesDueSection openExpenseModal={vi.fn()} />)

        expect(screen.queryByText('Expenses Due')).not.toBeInTheDocument()
    })

    it('opens expense modal when card is clicked', async () => {
        const openExpenseModal = vi.fn()
        const expense = { id: 'exp-1', title: 'Overdue Bill', date: '2026-02-05', paymentStatus: 'unpaid', amount: 10, amountType: 'fixed', currency: 'USD' }
        expensesMock.push(expense)

        render(<ExpensesDueSection openExpenseModal={openExpenseModal} />)

        const card = screen.getByText('Overdue Bill').closest('div[role="button"]')
        expect(card).toBeTruthy()
        fireEvent.click(card)

        expect(openExpenseModal).toHaveBeenCalledWith(expense)
    })

    it('marks expense as paid from card action', async () => {
        const expense = { id: 'exp-1', title: 'Overdue Bill', date: '2026-02-05', paymentStatus: 'unpaid', amount: 10, amountType: 'fixed', currency: 'USD' }
        expensesMock.push(expense)

        render(<ExpensesDueSection openExpenseModal={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))

        expect(markAsPaidMock).toHaveBeenCalledWith('exp-1', undefined)
        expect(showSuccessMock).toHaveBeenCalledWith('Expense marked as paid')
    })
})
