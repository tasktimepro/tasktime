import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ExpensesDueSection from './ExpensesDueSection'

const expensesMock = vi.hoisted(() => [])
const recurrencesMock = vi.hoisted(() => [])
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

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        recurrences: recurrencesMock,
    })
}))

describe('ExpensesDueSection', () => {

    beforeEach(() => {
        expensesMock.length = 0
        recurrencesMock.length = 0
        markAsPaidMock.mockReset()
        markAsPaidMock.mockResolvedValue(undefined)
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

        render(<ExpensesDueSection openExpenseView={vi.fn()} />)

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

        render(<ExpensesDueSection openExpenseView={vi.fn()} />)

        expect(screen.queryByText('Expenses Due')).not.toBeInTheDocument()
    })

    it('opens expense modal when card is clicked', async () => {
        const openExpenseModal = vi.fn()
        const expense = { id: 'exp-1', title: 'Overdue Bill', date: '2026-02-05', paymentStatus: 'unpaid', amount: 10, amountType: 'fixed', currency: 'USD' }
        expensesMock.push(expense)

        render(<ExpensesDueSection openExpenseView={openExpenseModal} />)

        const titleButton = screen.getByRole('button', { name: /Overdue Bill/ })
        fireEvent.click(titleButton)

        expect(openExpenseModal).toHaveBeenCalledWith(expense)
    })

    it('marks expense as paid from card action', async () => {
        const expense = { id: 'exp-1', title: 'Overdue Bill', date: '2026-02-05', paymentStatus: 'unpaid', amount: 10, amountType: 'fixed', currency: 'USD' }
        expensesMock.push(expense)

        render(<ExpensesDueSection openExpenseView={vi.fn()} />)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Mark as paid' }))
        })

        expect(markAsPaidMock).toHaveBeenCalledWith('exp-1')
        expect(showSuccessMock).toHaveBeenCalledWith('Expense marked as paid')
    })

    it('renders upcoming recurring previews with view support', () => {
        recurrencesMock.push({
            id: 'rec-1',
            title: 'Gym Membership',
            startDate: '2026-02-10',
            repeat: 'monthly',
            amount: 45,
            amountType: 'fixed',
            currency: 'USD',
            supplierName: 'Gym',
            clientId: null,
            projectId: null,
            businessId: null,
            isPersonal: true,
            billable: false,
            taxNumber: null,
            isTaxExempt: false,
            endDate: null,
            active: true,
        })

        const openExpenseModal = vi.fn()
        render(<ExpensesDueSection openExpenseView={openExpenseModal} />)

        expect(screen.getByText('Gym Membership')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark Paid' })).not.toBeInTheDocument()

        const titleButton = screen.getByRole('button', { name: /Gym Membership/ })
        fireEvent.click(titleButton)
        expect(openExpenseModal).toHaveBeenCalledTimes(1)
    })

    it('excludes auto-payment expenses from overdue/today but includes upcoming', () => {
        expensesMock.push(
            { id: 'exp-auto-overdue', title: 'Auto Overdue', date: '2026-02-05', paymentStatus: 'paid', paymentMode: 'auto', amount: 8, amountType: 'fixed', currency: 'USD' },
            { id: 'exp-auto-today', title: 'Auto Today', date: '2026-02-06', paymentStatus: 'paid', paymentMode: 'auto', amount: 9, amountType: 'fixed', currency: 'USD' },
            { id: 'exp-auto-upcoming', title: 'Auto Upcoming', date: '2026-02-10', paymentStatus: 'paid', paymentMode: 'auto', amount: 10, amountType: 'fixed', currency: 'USD' }
        )

        render(<ExpensesDueSection openExpenseView={vi.fn()} />)

        expect(screen.queryByText('Overdue (1)')).not.toBeInTheDocument()
        expect(screen.queryByText('Today (1)')).not.toBeInTheDocument()
        expect(screen.getByText('Upcoming (1)')).toBeInTheDocument()
        expect(screen.getByText('Auto Upcoming')).toBeInTheDocument()
        expect(screen.queryByText('Auto Overdue')).not.toBeInTheDocument()
        expect(screen.queryByText('Auto Today')).not.toBeInTheDocument()
    })

    it('includes variable auto-payment expenses in overdue/today groups', () => {
        expensesMock.push(
            { id: 'exp-var-overdue', title: 'Variable Auto Overdue', date: '2026-02-05', paymentStatus: 'unpaid', paymentMode: 'auto', amount: 12, amountType: 'variable', currency: 'USD' },
            { id: 'exp-var-today', title: 'Variable Auto Today', date: '2026-02-06', paymentStatus: 'unpaid', paymentMode: 'auto', amount: 14, amountType: 'variable', currency: 'USD' }
        )

        render(<ExpensesDueSection openExpenseView={vi.fn()} />)

        expect(screen.getByText('Overdue (1)')).toBeInTheDocument()
        expect(screen.getByText('Today (1)')).toBeInTheDocument()
        expect(screen.getByText('Variable Auto Overdue')).toBeInTheDocument()
        expect(screen.getByText('Variable Auto Today')).toBeInTheDocument()
    })
})
