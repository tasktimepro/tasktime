import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
        markAsPaidMock.mockResolvedValue(undefined)
        showSuccessMock.mockReset()
        showErrorMock.mockReset()
    })

    it('shows expense details and marks as paid', async () => {
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
        await waitFor(() => expect(showSuccessMock).toHaveBeenCalledWith('Expense marked as paid'))
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

    it('shows due in label for preview expenses', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-06T10:00:00Z'))

        const expense = {
            id: 'preview-rec-1',
            title: 'Gym Membership',
            date: '2026-02-10',
            amount: 45,
            amountType: 'fixed',
            currency: 'USD',
            paymentStatus: 'unpaid',
            billingStatus: 'unbilled',
            billable: false,
            isRecurring: true,
            isPreview: true,
        }

        render(
            <ExpenseViewModal
                isOpen
                onClose={vi.fn()}
                expense={expense}
                onEdit={vi.fn()}
            />
        )

        expect(screen.getByText('Due in 4 days')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument()

        vi.useRealTimers()
    })

    it('uses flexible footer and detail layouts instead of forced small-screen stacking', () => {
        const expense = {
            id: 'exp-3',
            title: 'AWS',
            date: '2026-03-02',
            amount: 68.13,
            currency: 'EUR',
            paymentStatus: 'paid',
            billingStatus: 'unbilled',
            billable: false,
            isRecurring: true,
            paidBy: 'pm-2',
            supplierName: 'Amazon',
            projectId: 'project-1',
            paidOn: '2026-03-03',
        }

        expensesMock.push(expense)
        paymentMethodsMock.push({ id: 'pm-2', title: 'Wise' })
        projectsMock.push({ id: 'project-1', title: 'Sava OS' })

        render(
            <ExpenseViewModal
                isOpen
                onClose={vi.fn()}
                expense={expense}
                onEdit={vi.fn()}
            />
        )

        const amountSection = screen.getByText('Amount').parentElement?.parentElement
        const footer = screen.getByTitle('Edit expense').parentElement

        expect(amountSection?.className).toContain('grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]')
        expect(amountSection?.className).not.toContain('sm:grid-cols-2')
        expect(footer?.className).toContain('flex-wrap')
        expect(footer?.className).not.toContain('flex-col')
        expect(screen.getByText('Wise')).toBeInTheDocument()
    })
})
