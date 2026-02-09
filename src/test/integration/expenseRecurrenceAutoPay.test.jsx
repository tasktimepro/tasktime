import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Expenses from '../../components/Expenses'

let mockExpenses = []
let mockRecurrences = []

const expenseHookMocks = vi.hoisted(() => ({

    markAsPaid: vi.fn(),
    markAsUnpaid: vi.fn(),
    createExpense: vi.fn()
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
        createExpense: expenseHookMocks.createExpense
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
})
