import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpenseViewModal from './ExpenseViewModal'

const expensesMock = vi.hoisted(() => [])
const recurrencesMock = vi.hoisted(() => [])
const clientsMock = vi.hoisted(() => [])
const projectsMock = vi.hoisted(() => [])
const businessInfosMock = vi.hoisted(() => [])
const paymentMethodsMock = vi.hoisted(() => [])
const markAsPaidMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expensesMock,
        markAsPaid: markAsPaidMock,
    })
}))

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        recurrences: recurrencesMock,
    })
}))

vi.mock('@/hooks/useClients.ts', () => ({

    useClients: () => ({
        clients: clientsMock,
    })
}))

vi.mock('@/hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: projectsMock,
    })
}))

vi.mock('@/hooks/useBusinessInfos.ts', () => ({

    useBusinessInfos: () => ({
        businessInfos: businessInfosMock,
    })
}))

vi.mock('@/hooks/usePaymentMethods.ts', () => ({

    usePaymentMethods: () => ({
        paymentMethods: paymentMethodsMock,
    })
}))

vi.mock('@/hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: showSuccessMock,
        showError: showErrorMock,
    })
}))

describe('ExpenseViewModal', () => {

    beforeEach(() => {
        expensesMock.length = 0
        recurrencesMock.length = 0
        clientsMock.length = 0
        projectsMock.length = 0
        businessInfosMock.length = 0
        paymentMethodsMock.length = 0
        markAsPaidMock.mockReset()
        showSuccessMock.mockReset()
        showErrorMock.mockReset()
    })

    it('shows expense details and marks as paid', () => {
        const expense = {
            id: 'exp-1',
            title: 'Office Rent',
            date: '2026-02-05',
            amount: 1200,
            currency: 'USD',
            paymentStatus: 'unpaid',
            billingStatus: 'unbilled',
            billable: false,
            isRecurring: false,
            paidBy: 'pm-1',
        }
        expensesMock.push(expense)
        paymentMethodsMock.push({ id: 'pm-1', title: 'Company Visa' })

        render(
            <ExpenseViewModal
                isOpen
                onClose={vi.fn()}
                expense={expense}
                onEdit={vi.fn()}
            />
        )

        expect(screen.getByText('Office Rent')).toBeInTheDocument()
        expect(screen.getByText('Unpaid')).toBeInTheDocument()

        expect(screen.getByText('Company Visa')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Mark as paid' }))
        expect(markAsPaidMock).toHaveBeenCalledWith('exp-1')
        expect(showSuccessMock).toHaveBeenCalledWith('Expense marked as paid')
    })

    it('uses Submit action when amount is required', () => {
        const expense = {
            id: 'exp-2',
            title: 'Electricity',
            date: '2026-02-06',
            amount: 0,
            amountType: 'variable',
            currency: 'EUR',
            paymentStatus: 'unpaid',
            billingStatus: 'unbilled',
            billable: false,
            isRecurring: true,
        }
        expensesMock.push(expense)
        const onClose = vi.fn()
        const onEdit = vi.fn()

        render(
            <ExpenseViewModal
                isOpen
                onClose={onClose}
                expense={expense}
                onEdit={onEdit}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
        expect(onClose).toHaveBeenCalled()
        expect(onEdit).toHaveBeenCalledWith(expense)
    })
})
