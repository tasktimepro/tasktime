import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import Expenses from '../../components/Expenses'

let mockExpenses = []
let mockRecurrences = []
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

const expenseHookMocks = vi.hoisted(() => ({

    markAsPaid: vi.fn(),
    markAsUnpaid: vi.fn(),
    createExpenseWithPaymentSnapshot: vi.fn()
}))

const recurrenceHookMocks = vi.hoisted(() => ({

    generatePendingExpenses: vi.fn(),
    pauseRecurrence: vi.fn(),
    resumeRecurrence: vi.fn(),
    deleteRecurrence: vi.fn()
}))

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn()
}))

const urlStateMocks = vi.hoisted(() => ({

    updateUrl: vi.fn()
}))

vi.mock('../../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: mockExpenses,
        markAsPaid: expenseHookMocks.markAsPaid,
        markAsUnpaid: expenseHookMocks.markAsUnpaid,
        createExpenseWithPaymentSnapshot: expenseHookMocks.createExpenseWithPaymentSnapshot
    })
}))

vi.mock('../../hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        recurrences: mockRecurrences,
        generatePendingExpenses: recurrenceHookMocks.generatePendingExpenses,
        pauseRecurrence: recurrenceHookMocks.pauseRecurrence,
        resumeRecurrence: recurrenceHookMocks.resumeRecurrence,
        deleteRecurrence: recurrenceHookMocks.deleteRecurrence
    })
}))

vi.mock('../../hooks/useClients.ts', () => ({

    useClients: () => ({
        clients: []
    })
}))

vi.mock('../../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: [],
        getProjectsByClient: () => []
    })
}))

vi.mock('../../hooks/usePreferences.ts', () => ({

    usePreferences: () => ({
        preferences: { currency: 'USD' }
    })
}))

vi.mock('../../hooks/useExpenseCategories.ts', () => ({

    useExpenseCategories: () => ({
        expenseCategories: [],
        allExpenseCategories: [],
        createExpenseCategory: vi.fn(),
        updateExpenseCategory: vi.fn(),
        archiveExpenseCategory: vi.fn(),
        restoreExpenseCategory: vi.fn(),
        deleteExpenseCategory: vi.fn(),
    })
}))

vi.mock('../../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError,
        showWarning: toastMocks.showWarning,
        showInfo: toastMocks.showInfo
    })
}))

vi.mock('../../hooks/useUrlState.ts', () => ({

    useUrlState: () => ({
        urlParams: { section: 'all' },
        updateUrl: urlStateMocks.updateUrl
    })
}))

describe('Expense recurrence auto-pay integration', () => {

    beforeEach(() => {

        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-09T12:00:00Z'))
        HTMLElement.prototype.scrollIntoView = vi.fn()

        mockExpenses = []
        mockRecurrences = [
            {
                id: 'rec-1',
                title: 'Auto Rent',
                note: null,
                startDate: '2026-02-10',
                repeat: 'monthly',
                monthlyType: 'specific',
                monthlyDay: 10,
                amountType: 'fixed',
                amount: 1200,
                currency: 'USD',
                paymentMode: 'auto',
                paidBy: null,
                clientId: null,
                projectId: null,
                businessId: null,
                supplierName: 'Landlord',
                isPersonal: false,
                billable: false,
                isTaxExempt: false,
                taxNumber: null,
                active: true
            }
        ]
    })

    afterEach(() => {

        cleanup()
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('shows auto-pay preview without a paid toggle', () => {

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        expect(screen.getByText('Auto Rent')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark as Paid' })).not.toBeInTheDocument()
    })

    it('sorts outstanding by highest overdue first', () => {
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-overdue-oldest',
                title: 'Overdue Oldest',
                date: '2026-02-01',
                paymentStatus: 'unpaid',
                amount: 40,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-overdue-recent',
                title: 'Overdue Recent',
                date: '2026-02-08',
                paymentStatus: 'unpaid',
                amount: 35,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        const overdueOldest = screen.getByText('Overdue Oldest')
        const overdueRecent = screen.getByText('Overdue Recent')
        expect(overdueOldest.compareDocumentPosition(overdueRecent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('sorts upcoming by nearest date first', () => {
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-upcoming-nearest',
                title: 'Upcoming Nearest',
                date: '2026-02-10',
                paymentStatus: 'unpaid',
                amount: 20,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-upcoming-later',
                title: 'Upcoming Later',
                date: '2026-02-20',
                paymentStatus: 'unpaid',
                amount: 22,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        const upcomingNearest = screen.getByText('Upcoming Nearest')
        const upcomingLater = screen.getByText('Upcoming Later')
        expect(upcomingNearest.compareDocumentPosition(upcomingLater) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('sorts paid by expense date descending', () => {
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-paid-most-recent',
                title: 'Paid Most Recent',
                date: '2026-02-02',
                paidOn: '2026-02-09',
                paymentStatus: 'paid',
                amount: 70,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-paid-older',
                title: 'Paid Older',
                date: '2026-02-08',
                paidOn: '2026-02-07',
                paymentStatus: 'paid',
                amount: 65,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        const paidMostRecent = screen.getByText('Paid Most Recent')
        const paidOlder = screen.getByText('Paid Older')
        expect(paidOlder.compareDocumentPosition(paidMostRecent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('keeps outstanding expenses visible outside the selected period while upcoming stays within the default window', () => {
        vi.setSystemTime(new Date('2026-03-12T12:00:00Z'))
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-overdue-february',
                title: 'February Rent',
                date: '2026-02-28',
                paymentStatus: 'unpaid',
                amount: 900,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-upcoming-march',
                title: 'March Hosting',
                date: '2026-03-20',
                paymentStatus: 'unpaid',
                amount: 20,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        expect(screen.getByText('Outstanding (1)')).toBeInTheDocument()
        expect(screen.getByText('February Rent')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Expenses/i }).textContent).toContain('(2)')

        expect(screen.getByRole('tab', { name: 'Upcoming (1)' })).toBeInTheDocument()
    })

    it('defaults paid tab to this month window', () => {
        vi.setSystemTime(new Date('2026-03-12T12:00:00Z'))
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-paid-recent',
                title: 'Recent Paid Expense',
                date: '2026-03-01',
                paidOn: '2026-03-02',
                paymentStatus: 'paid',
                amount: 50,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-paid-old',
                title: 'Old Paid Expense',
                date: '2025-11-30',
                paidOn: '2025-11-30',
                paymentStatus: 'paid',
                amount: 75,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        fireEvent.click(screen.getByRole('tab', { name: 'Paid (1)' }))

        expect(screen.getByText('Recent Paid Expense')).toBeInTheDocument()
        expect(screen.queryByText('Old Paid Expense')).not.toBeInTheDocument()
    })

    it('shows paid expenses from the previous calendar month when last month is selected', () => {
        vi.setSystemTime(new Date('2026-05-04T12:00:00Z'))
        mockRecurrences = []
        mockExpenses = [
            {
                id: 'exp-paid-april',
                title: 'April Paid Expense',
                date: '2026-04-30',
                paidOn: '2026-04-30',
                paymentStatus: 'paid',
                amount: 50,
                amountType: 'fixed',
                currency: 'USD'
            },
            {
                id: 'exp-paid-may',
                title: 'May Paid Expense',
                date: '2026-05-02',
                paidOn: '2026-05-02',
                paymentStatus: 'paid',
                amount: 75,
                amountType: 'fixed',
                currency: 'USD'
            }
        ]

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        )

        fireEvent.click(screen.getByRole('tab', { name: 'Paid (1)' }))
    fireEvent.click(screen.getAllByRole('combobox')[0])
        fireEvent.click(screen.getByRole('option', { name: 'Last Month' }))

        expect(screen.getByText('April Paid Expense')).toBeInTheDocument()
        expect(screen.queryByText('May Paid Expense')).not.toBeInTheDocument()
    })
})
