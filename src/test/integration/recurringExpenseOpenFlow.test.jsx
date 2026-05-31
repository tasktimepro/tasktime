import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../../App'
import { buildExpenseFromRecurrence } from '../../utils/expenseUtils.ts'

const integrationState = vi.hoisted(() => ({
    view: 'planner',
    todayStr: '2026-02-25',
    expenses: [],
    recurrences: [],
    createExpense: vi.fn(),
    markAsPaid: vi.fn(),
    generatePendingExpenses: vi.fn(),
    updateRecurrence: vi.fn(),
}))

vi.mock('../../contexts/YjsContext.tsx', () => ({
    YjsProvider: ({ children }) => children,
    useYjs: () => ({
        isReady: true,
        isSyncing: false,
        manualSyncInProgress: false,
        hasPendingSyncChanges: () => false,
        isDriveConnected: false,
        forceSyncDrive: vi.fn(),
        loadEntriesForYear: vi.fn(),
        loadArchivedTasks: vi.fn(),
        loadArchivedInvoices: vi.fn(),
        getAvailableYears: vi.fn().mockResolvedValue([]),
        clearAllData: vi.fn(),
    }),
}))

vi.mock('../../hooks/useProjects.ts', () => ({
    useProjects: () => ({
        projects: [],
        createProject: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useTasks.ts', () => ({
    useTasks: () => ({
        tasks: [],
        createTask: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        archiveTask: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({
        entries: [],
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        loadYear: vi.fn(),
        getAvailableYears: vi.fn().mockResolvedValue([]),
        isLoading: false,
        isLoadingMore: false,
        totalTime: 0,
    }),
}))

vi.mock('../../hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: [],
        createClient: vi.fn(),
        updateClient: vi.fn(),
        deleteClient: vi.fn(),
        sortedClients: [],
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useInvoices.ts', () => ({
    useInvoices: () => ({
        invoices: [],
        createInvoice: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useBusinessInfos.ts', () => ({
    useBusinessInfos: () => ({
        businessInfos: [],
        createBusinessInfo: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useInvoiceTemplates.ts', () => ({
    useInvoiceTemplates: () => ({
        invoiceTemplates: [],
        createInvoiceTemplate: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/usePaymentMethods.ts', () => ({
    usePaymentMethods: () => ({
        paymentMethods: [],
        createPaymentMethod: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        showInfo: vi.fn(),
    }),
}))

vi.mock('../../hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: integrationState.expenses,
        createExpense: integrationState.createExpense,
        markAsPaid: integrationState.markAsPaid,
    }),
}))

vi.mock('../../hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => ({
        recurrences: integrationState.recurrences,
        isLoading: false,
        generatePendingExpenses: integrationState.generatePendingExpenses,
        updateRecurrence: integrationState.updateRecurrence,
    }),
}))

vi.mock('../../hooks/usePreferences.ts', () => ({
    usePreferences: () => ({
        preferences: {
            currency: 'EUR',
            dateFormat: 'MM/dd/yyyy',
            timeFormat: '12h',
            theme: 'system',
            defaultView: 'dashboard',
            weekStartsOn: 1,
            autoHideTotalsOnRevisit: false,
            showCompletedTasks: true,
            defaultBillable: true,
        },
        updatePreferences: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useTimers.ts', () => ({
    useTimers: () => ({
        timers: [],
        clearTimer: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: { view: integrationState.view, projectId: null, clientId: null },
        navigateToProjects: vi.fn(),
        navigateToProject: vi.fn(),
        navigateToClients: vi.fn(),
        navigateToClient: vi.fn(),
        navigateToInvoices: vi.fn(),
        navigateToExpenses: vi.fn(),
        navigateToAccount: vi.fn(),
        navigateToDashboard: vi.fn(),
        navigateToPlanner: vi.fn(),
        updateUrl: vi.fn(),
    }),
}))

vi.mock('../../hooks/usePlannerAttachments.ts', () => ({
    usePlannerAttachments: () => ({
        updateAttachment: vi.fn(),
    }),
}))

vi.mock('../../hooks/useDayRollover', () => ({
    useTodayString: () => integrationState.todayStr,
}))

vi.mock('../../hooks/useGoogleAuth.ts', () => ({
    useGoogleAuth: () => ({
        isSignedIn: false,
        isLoading: false,
        accessToken: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
    }),
}))

vi.mock('../../components/ProjectList', () => ({ default: () => <div /> }))
vi.mock('../../components/ProjectDashboard', () => ({ default: () => <div /> }))
vi.mock('../../components/ClientList', () => ({ default: () => <div /> }))
vi.mock('../../components/ClientDashboard', () => ({ default: () => <div /> }))
vi.mock('../../components/Expenses', () => ({ default: () => <div /> }))
vi.mock('../../components/Account', () => ({ default: () => <div /> }))
vi.mock('../../components/Invoices', () => ({ default: () => <div /> }))
vi.mock('../../components/AuthCallback', () => ({ default: () => <div /> }))

vi.mock('../../components/Planner', () => ({
    default: ({ openExpenseView }) => (
        <div>
            <button
                type="button"
                onClick={() => openExpenseView?.({
                    id: 'preview-office',
                    title: 'Office',
                    date: integrationState.todayStr,
                    amount: 80,
                    amountType: 'fixed',
                    currency: 'EUR',
                    paymentStatus: 'unpaid',
                    paymentMode: 'manual',
                    isRecurring: true,
                    isPreview: true,
                    recurrenceId: 'rec-office',
                    paidBy: 'cash',
                })}
            >
                Open planner recurring expense
            </button>
        </div>
    ),
}))

vi.mock('../../components/Dashboard', () => ({
    default: () => {
        const expense = integrationState.expenses.find((item) => (
            item.recurrenceId === 'rec-office' && item.date === integrationState.todayStr
        ))

        return (
            <div>
                {expense ? 'Dashboard expense visible' : 'Dashboard expense missing'}
            </div>
        )
    },
}))

vi.mock('../../components/modals/ModalManager', () => ({ default: () => <div /> }))
vi.mock('../../components/modals/TaskViewModal', () => ({ default: () => null }))
vi.mock('../../components/TimeEntriesModal', () => ({ default: () => null }))
vi.mock('../../components/planner/index.js', () => ({ EntityPickerModal: () => null }))
vi.mock('../../components/timer/GlobalTimerStack', () => ({ default: () => <div /> }))
vi.mock('../../components/FloatingActionButton', () => ({ default: () => null }))
vi.mock('../../components/ErrorBoundary', () => ({ default: ({ children }) => children }))
vi.mock('../../components/OfflineIndicator', () => ({ default: () => null }))
vi.mock('../../components/sync/YjsSyncStatus', () => ({ default: () => null }))
vi.mock('../../components/ToastContainer', () => ({ ToastProvider: ({ children }) => children }))

if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
    }))
}

describe('Recurring expense App integration', () => {
    const recurrenceTemplate = {
        id: 'rec-office',
        title: 'Office',
        note: null,
        supplierName: null,
        currency: 'EUR',
        amount: 80,
        amountType: 'fixed',
        repeat: 'monthly',
        monthlyType: 'specific',
        monthlyDay: 25,
        startDate: '2026-02-25',
        endDate: null,
        clientId: null,
        projectId: null,
        businessId: null,
        paymentMode: 'manual',
        paidBy: 'cash',
        isPersonal: true,
        billable: false,
        taxNumber: null,
        isTaxExempt: false,
        lastGeneratedDate: null,
        active: true,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        integrationState.view = 'planner'
        integrationState.todayStr = '2026-02-25'
        integrationState.expenses.length = 0
        integrationState.recurrences.length = 0
        integrationState.recurrences.push({ ...recurrenceTemplate })
        integrationState.createExpense.mockImplementation((data) => {
            const expense = {
                ...data,
                id: data.id || `expense-${integrationState.expenses.length + 1}`,
            }

            integrationState.expenses.push(expense)
            return expense
        })
        integrationState.markAsPaid.mockReset()
        integrationState.generatePendingExpenses.mockImplementation((createExpense) => {
            integrationState.recurrences.forEach((recurrence) => {
                if (!recurrence.active) return
                if (recurrence.startDate > integrationState.todayStr) return

                const existingExpense = integrationState.expenses.find((expense) => (
                    expense.recurrenceId === recurrence.id && expense.date === integrationState.todayStr
                ))

                if (existingExpense) return

                createExpense(buildExpenseFromRecurrence(recurrence, integrationState.todayStr))
            })
        })
        integrationState.updateRecurrence.mockImplementation((recurrenceId, updates) => {
            const recurrence = integrationState.recurrences.find((item) => item.id === recurrenceId)
            if (recurrence) {
                Object.assign(recurrence, updates)
            }
            return recurrence
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('materializes a due planner preview into a real expense before opening the modal', () => {
        integrationState.view = 'planner'

        render(<App />)

        fireEvent.click(screen.getByRole('button', { name: 'Open planner recurring expense' }))

        expect(integrationState.createExpense).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Office',
            date: '2026-02-25',
            recurrenceId: 'rec-office',
            paymentStatus: 'unpaid',
        }))
        expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument()
        expect(screen.queryByText('Upcoming')).not.toBeInTheDocument()
    })

    it('makes the due recurring expense visible to the dashboard after day rollover generation', () => {
        integrationState.view = 'dashboard'
        integrationState.todayStr = '2026-02-24'

        const { rerender } = render(<App />)

        expect(screen.getByText('Dashboard expense missing')).toBeInTheDocument()

        integrationState.todayStr = '2026-02-25'
        rerender(<App />)
        rerender(<App />)

        expect(screen.getByText('Dashboard expense visible')).toBeInTheDocument()
        expect(integrationState.generatePendingExpenses).toHaveBeenCalledTimes(2)
        expect(integrationState.expenses).toEqual([
            expect.objectContaining({
                title: 'Office',
                date: '2026-02-25',
                recurrenceId: 'rec-office',
            }),
        ])
    })
})
