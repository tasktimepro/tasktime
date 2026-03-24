/**
 * App.test.jsx - Tests for the main App component
 * 
 * Tests the Yjs-based App component with mocked hooks
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const createMatchMedia = (matchesByQuery = {}) => vi.fn().mockImplementation((query) => ({
    matches: Boolean(matchesByQuery[query]),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn()
}))

const expenseHookState = vi.hoisted(() => ({
    expenses: [],
    createExpense: vi.fn((expense) => ({
        ...expense,
        id: expense.id || 'created-expense',
    })),
}))

const recurrenceHookState = vi.hoisted(() => ({
    recurrences: [],
    generatePendingExpenses: vi.fn(),
    updateRecurrence: vi.fn(),
}))

const projectsHookState = vi.hoisted(() => ({
    projects: [],
}))

const clientsHookState = vi.hoisted(() => ({
    clients: [],
}))

const urlHookState = vi.hoisted(() => ({
    urlParams: { view: 'dashboard', projectId: null, clientId: null },
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
}))

const todayStringState = vi.hoisted(() => ({
    value: '2026-02-25',
}))

// Mock all Yjs-based hooks
vi.mock('./contexts/YjsContext.tsx', () => ({
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

vi.mock('./hooks/useProjects.ts', () => ({
    useProjects: () => ({
        projects: projectsHookState.projects,
        activeProjects: projectsHookState.projects.filter((project) => !project.archived),
        archivedProjects: [],
        isLoading: false,
        getProject: vi.fn(),
        createProject: vi.fn(),
        updateProject: vi.fn(),
        deleteProject: vi.fn(),
        archiveProject: vi.fn(),
        unarchiveProject: vi.fn(),
        getProjectsByClient: vi.fn(() => []),
    }),
}))

vi.mock('./hooks/useTasks.ts', () => ({
    useTasks: () => ({
        tasks: [],
        activeTasks: [],
        archivedTasks: [],
        isLoading: false,
        archivedLoaded: false,
        getTask: vi.fn(),
        createTask: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        archiveTask: vi.fn(),
        unarchiveTask: vi.fn(),
        getRootTasks: vi.fn(() => []),
        getChildTasks: vi.fn(() => []),
    }),
}))

vi.mock('./hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({
        entries: [],
        isLoading: false,
        isLoadingMore: false,
        totalTime: 0,
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        getEntriesForTask: vi.fn(() => []),
        getTotalTimeForTask: vi.fn(() => 0),
        loadYear: vi.fn(),
        getAvailableYears: vi.fn().mockResolvedValue([]),
    }),
}))

vi.mock('./hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: expenseHookState.expenses,
        createExpense: expenseHookState.createExpense,
    }),
}))

vi.mock('./hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => ({
        recurrences: recurrenceHookState.recurrences,
        generatePendingExpenses: recurrenceHookState.generatePendingExpenses,
        updateRecurrence: recurrenceHookState.updateRecurrence,
    }),
}))

vi.mock('./hooks/useDayRollover', () => ({
    useTodayString: () => todayStringState.value,
}))

vi.mock('./hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: clientsHookState.clients,
        sortedClients: clientsHookState.clients,
        isLoading: false,
        getClient: vi.fn(),
        createClient: vi.fn(),
        updateClient: vi.fn(),
        deleteClient: vi.fn(),
        findByName: vi.fn(),
    }),
}))

vi.mock('./hooks/useInvoices.ts', () => ({
    useInvoices: () => ({
        invoices: [],
        activeInvoices: [],
        archivedInvoices: [],
        isLoading: false,
        archivedLoaded: false,
        getInvoice: vi.fn(),
        createInvoice: vi.fn(),
        updateInvoice: vi.fn(),
        deleteInvoice: vi.fn(),
    }),
}))

vi.mock('./hooks/useBusinessInfos.ts', () => ({
    useBusinessInfos: () => ({
        businessInfos: [],
        defaultBusinessInfo: null,
        isLoading: false,
        getBusinessInfo: vi.fn(),
        createBusinessInfo: vi.fn(),
        updateBusinessInfo: vi.fn(),
        deleteBusinessInfo: vi.fn(),
        setDefault: vi.fn(),
    }),
}))

vi.mock('./hooks/useInvoiceTemplates.ts', () => ({
    useInvoiceTemplates: () => ({
        invoiceTemplates: [],
        sortedTemplates: [],
        isLoading: false,
        getInvoiceTemplate: vi.fn(),
        createInvoiceTemplate: vi.fn(),
        updateInvoiceTemplate: vi.fn(),
        deleteInvoiceTemplate: vi.fn(),
        getNextInvoiceNumber: vi.fn(() => ''),
        incrementSequentialNumber: vi.fn(),
    }),
}))

vi.mock('./hooks/usePaymentMethods.ts', () => ({
    usePaymentMethods: () => ({
        paymentMethods: [],
        defaultPaymentMethod: null,
        isLoading: false,
        getPaymentMethod: vi.fn(),
        createPaymentMethod: vi.fn(),
        updatePaymentMethod: vi.fn(),
        deletePaymentMethod: vi.fn(),
        setDefault: vi.fn(),
    }),
}))

vi.mock('./hooks/usePreferences.ts', () => ({
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
        isLoading: false,
        setPreference: vi.fn(),
        updatePreferences: vi.fn(),
        resetPreferences: vi.fn(),
    }),
}))

vi.mock('./hooks/useTimers.ts', () => ({
    useTimers: () => ({
        timers: [],
        clearTimer: vi.fn(),
        getTimerForTask: () => null,
        isLoading: false,
    }),
}))

vi.mock('./hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: urlHookState.urlParams,
        navigateToProjects: urlHookState.navigateToProjects,
        navigateToProject: urlHookState.navigateToProject,
        navigateToClients: urlHookState.navigateToClients,
        navigateToClient: urlHookState.navigateToClient,
        navigateToInvoices: urlHookState.navigateToInvoices,
        navigateToExpenses: urlHookState.navigateToExpenses,
        navigateToAccount: urlHookState.navigateToAccount,
        navigateToDashboard: urlHookState.navigateToDashboard,
        navigateToPlanner: urlHookState.navigateToPlanner,
        updateUrl: urlHookState.updateUrl
    })
}))

vi.mock('./hooks/useGoogleAuth.ts', () => ({
    useGoogleAuth: () => ({
        isSignedIn: false,
        isLoading: false,
        accessToken: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
    }),
}))

// Mock child components
vi.mock('./components/ProjectList', () => ({ default: () => <div data-testid="project-list" /> }))
vi.mock('./components/ProjectDashboard', () => ({ default: () => <div data-testid="project-dashboard" /> }))
vi.mock('./components/ClientList', () => ({ default: () => <div data-testid="client-list" /> }))
vi.mock('./components/ClientDashboard', () => ({ default: () => <div data-testid="client-dashboard" /> }))
vi.mock('./components/Dashboard', () => ({
    default: ({ openExpenseView }) => (
        <div data-testid="dashboard">
            <button
                type="button"
                onClick={() => openExpenseView?.({
                    id: 'preview-office',
                    title: 'Office',
                    date: '2026-02-25',
                    amount: 80,
                    amountType: 'fixed',
                    currency: 'EUR',
                    paymentStatus: 'unpaid',
                    paymentMode: 'manual',
                    isRecurring: true,
                    isPreview: true,
                    recurrenceId: 'rec-office',
                })}
            >
                Open preview expense
            </button>
        </div>
    )
}))
vi.mock('./components/Account', () => ({ default: () => <div data-testid="account" /> }))
vi.mock('./components/Invoices', () => ({ default: () => <div data-testid="invoices" /> }))
vi.mock('./components/timer/GlobalTimerStack', () => ({ default: () => <div data-testid="global-timer" /> }))
vi.mock('./components/modals/ModalManager', () => ({
    default: ({ activeModal }) => (
        <div data-testid="modal-manager" data-active-modal={activeModal || ''}>
            {activeModal ? <div data-testid="active-modal">{activeModal}</div> : null}
        </div>
    )
}))
vi.mock('./components/modals/ExpenseViewModal', () => ({
    default: ({ isOpen, expense }) => (isOpen ? <div data-testid="expense-view-modal">{expense?.id}:{expense?.title}:{expense?.isPreview ? 'preview' : 'actual'}</div> : null)
}))
vi.mock('./components/ErrorBoundary', () => ({ default: ({ children }) => children }))
vi.mock('./components/OfflineIndicator', () => ({ default: () => <div data-testid="offline-indicator" /> }))
vi.mock('./components/InstallPrompt', () => ({ default: () => <div data-testid="install-prompt" /> }))
vi.mock('./components/ToastContainer', () => ({ ToastProvider: ({ children }) => children }))
vi.mock('./components/sync/YjsSyncStatus', () => ({ default: () => <div data-testid="sync-status" /> }))

window.matchMedia = createMatchMedia()

describe('App component', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        window.matchMedia = createMatchMedia()
        expenseHookState.expenses.length = 0
        expenseHookState.createExpense.mockReset()
        expenseHookState.createExpense.mockImplementation((expense) => ({
            ...expense,
            id: expense.id || 'created-expense',
        }))
        recurrenceHookState.recurrences.length = 0
        recurrenceHookState.generatePendingExpenses.mockReset()
        recurrenceHookState.updateRecurrence.mockReset()
        projectsHookState.projects.length = 0
        clientsHookState.clients.length = 0
        urlHookState.urlParams = { view: 'dashboard', projectId: null, clientId: null }
        urlHookState.navigateToProjects.mockReset()
        urlHookState.navigateToProject.mockReset()
        urlHookState.navigateToClients.mockReset()
        urlHookState.navigateToClient.mockReset()
        urlHookState.navigateToInvoices.mockReset()
        urlHookState.navigateToExpenses.mockReset()
        urlHookState.navigateToAccount.mockReset()
        urlHookState.navigateToDashboard.mockReset()
        urlHookState.navigateToPlanner.mockReset()
        urlHookState.updateUrl.mockReset()
        todayStringState.value = '2026-02-25'
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders the dashboard view by default', async () => {
        render(<App />)
        expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    })

    it('renders the desktop sidebar and not the mobile dock on larger screens', () => {
        render(<App />)
        expect(screen.getByText('TaskTime')).toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Clients')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
        expect(screen.getByText('Invoices')).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    })

    it('shows theme toggle button', () => {
        render(<App />)
        // Dark Mode shows by default because matchMedia returns false for dark mode preference
        expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    })

    it('renders the mobile dock and opens the more sheet on small screens', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        render(<App />)

        expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Planner' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expenses' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Open more actions' }))

        const dialog = screen.getByRole('dialog')

        expect(within(dialog).getByText('More')).toBeInTheDocument()
        expect(within(dialog).getByText('Sync & appearance')).toBeInTheDocument()
        expect(within(dialog).getByText('Clients')).toBeInTheDocument()
        expect(within(dialog).getByText('Invoices')).toBeInTheDocument()
        expect(within(dialog).getByText('Account')).toBeInTheDocument()
        expect(within(dialog).getByText('Sync Settings')).toBeInTheDocument()
    })

    it('navigates through more-sheet destinations and closes the sheet on mobile', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open more actions' }))
        await user.click(screen.getByRole('button', { name: /Clients/ }))

        expect(urlHookState.navigateToClients).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('routes sync settings from the more sheet on mobile', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open more actions' }))
        await user.click(screen.getByRole('button', { name: /Sync Settings/ }))

        expect(urlHookState.navigateToAccount).toHaveBeenCalledWith({ section: 'sync' })
    })

    it('opens the task modal from the mobile top bar create action', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Create new task' }))

        expect(screen.getByTestId('active-modal')).toHaveTextContent('task')
    })

    it('shows a mobile back affordance for project detail routes', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        projectsHookState.projects.push({ id: 'project-1', title: 'Launch Site', archived: false })
        urlHookState.urlParams = { view: 'projects', projectId: 'project-1', clientId: null }

        const user = userEvent.setup()

        render(<App />)

        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
        expect(screen.getByText('Launch Site')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Back' }))

        expect(urlHookState.navigateToProjects).toHaveBeenCalledTimes(1)
    })

    it('generates pending recurring expenses on mount and day rollover', () => {
        const { rerender } = render(<App />)

        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledTimes(1)
        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledWith(expenseHookState.createExpense)

        rerender(<App />)
        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledTimes(1)

        todayStringState.value = '2026-02-26'
        rerender(<App />)

        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledTimes(2)
    })

    it('materializes due preview expenses before opening the expense view', () => {
        recurrenceHookState.recurrences.push({
            id: 'rec-office',
            title: 'Office',
            startDate: '2026-02-25',
            repeat: 'monthly',
            monthlyType: 'specific',
            monthlyDay: 25,
            amount: 80,
            amountType: 'fixed',
            currency: 'EUR',
            supplierName: null,
            note: null,
            paidBy: 'cash',
            paymentMode: 'manual',
            clientId: null,
            projectId: null,
            businessId: null,
            isPersonal: true,
            billable: false,
            taxNumber: null,
            isTaxExempt: false,
            endDate: null,
            lastGeneratedDate: null,
            active: true,
        })

        render(<App />)

        fireEvent.click(screen.getByRole('button', { name: 'Open preview expense' }))

        expect(expenseHookState.createExpense).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Office',
            date: '2026-02-25',
            recurrenceId: 'rec-office',
            paymentStatus: 'unpaid',
        }))
        expect(recurrenceHookState.updateRecurrence).toHaveBeenCalledWith('rec-office', { lastGeneratedDate: '2026-02-25' })
        expect(screen.getByTestId('expense-view-modal')).toHaveTextContent('created-expense:Office:actual')
    })
})
