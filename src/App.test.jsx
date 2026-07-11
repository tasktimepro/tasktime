/**
 * App.test.jsx - Tests for the main App component
 * 
 * Tests the Yjs-based App component with mocked hooks
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const timersHookState = vi.hoisted(() => ({
    timers: [],
}))

const tasksHookState = vi.hoisted(() => ({
    tasks: [],
    createTask: vi.fn((task) => ({
        ...task,
        id: task.id || 'created-task',
    })),
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

const googleAuthHookState = vi.hoisted(() => ({
    hadPreviousSession: false,
    isLoading: false,
    isSignedIn: false,
}))

const reportsComponentState = vi.hoisted(() => ({
    autoReady: true,
    readyHandler: null,
}))

const onboardingModalMock = vi.hoisted(() => vi.fn(({ isOpen, onComplete }) => (
    isOpen ? (
        <div data-testid="onboarding-modal">
            <button type="button" onClick={onComplete}>Complete onboarding</button>
        </div>
    ) : null
)))

const yjsHookState = vi.hoisted(() => ({
    isReady: true,
    isSyncing: false,
    syncState: 'idle',
    syncPhase: 'idle',
    isDriveConnected: false,
    isConnecting: false,
    hasSynced: false,
    manualSyncInProgress: false,
    hasPendingSyncChanges: vi.fn(() => false),
    pendingSyncChanges: false,
    forceSyncDrive: vi.fn(),
    autoSyncEnabled: true,
    lastSyncedAt: null,
    loadEntriesForYear: vi.fn(),
    loadArchivedTasks: vi.fn(),
    loadArchivedInvoices: vi.fn(),
    getAvailableYears: vi.fn().mockResolvedValue([]),
    clearAllData: vi.fn(),
    restoreBackupData: vi.fn(),
    driveSessionId: null,
}))

// Mock all Yjs-based hooks
vi.mock('./contexts/YjsContext.tsx', () => ({
    YjsProvider: ({ children }) => children,
    useYjs: () => yjsHookState,
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
        tasks: tasksHookState.tasks,
        activeTasks: tasksHookState.tasks,
        archivedTasks: [],
        isLoading: false,
        archivedLoaded: false,
        getTask: vi.fn(),
        createTask: tasksHookState.createTask,
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
        timers: timersHookState.timers,
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
        isSignedIn: googleAuthHookState.isSignedIn,
        isLoading: googleAuthHookState.isLoading,
        accessToken: null,
        hadPreviousSession: googleAuthHookState.hadPreviousSession,
        signIn: vi.fn(),
        signOut: vi.fn(),
    }),
}))

// Mock child components
vi.mock('./components/ProjectList', () => ({ default: () => <div data-testid="project-list" /> }))
vi.mock('./components/ProjectDashboard', () => ({ default: () => <div data-testid="project-dashboard" /> }))
vi.mock('./components/ClientList', () => ({ default: () => <div data-testid="client-list" /> }))
vi.mock('./components/ClientDashboard', () => ({ default: () => <div data-testid="client-dashboard" /> }))
vi.mock('./components/AuthCallback', () => ({ default: () => <div data-testid="auth-callback">Completing authentication...</div> }))
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
vi.mock('./components/Reports', () => {
    const MockReportsView = ({ onReadyChange }) => {
        React.useEffect(() => {
            reportsComponentState.readyHandler = onReadyChange || null

            if (reportsComponentState.autoReady) {
                onReadyChange?.(true)
            }

            return () => {
                reportsComponentState.readyHandler = null
            }
        }, [onReadyChange])

        return <div data-testid="reports-view">Reports view</div>
    }

    return { default: MockReportsView }
})
vi.mock('./components/timer/GlobalTimerStack', () => ({ default: () => <div data-testid="global-timer" /> }))
vi.mock('./components/modals/ModalManager', () => ({
    default: ({ activeModal, modalOptions }) => (
        <div data-testid="modal-manager" data-active-modal={activeModal || ''} data-modal-options={JSON.stringify(modalOptions || null)}>
            {activeModal ? <div data-testid="active-modal">{activeModal}</div> : null}
        </div>
    )
}))
vi.mock('./components/modals/ExpenseViewModal', () => ({
    default: ({ isOpen, expense }) => (isOpen ? <div data-testid="expense-view-modal">{expense?.id}:{expense?.title}:{expense?.isPreview ? 'preview' : 'actual'}</div> : null)
}))
vi.mock('./components/OnboardingModal.jsx', () => ({ default: onboardingModalMock }))
vi.mock('./components/ErrorBoundary', () => ({ default: ({ children }) => children }))
vi.mock('./components/OfflineIndicator', () => ({ default: () => <div data-testid="offline-indicator" /> }))
vi.mock('./components/ToastContainer', () => ({ ToastProvider: ({ children }) => children }))
vi.mock('./components/sync/YjsSyncStatus', () => ({ default: () => <div data-testid="sync-status" /> }))

window.matchMedia = createMatchMedia()

const setNavigatorOnline = (value) => {
    Object.defineProperty(navigator, 'onLine', {
        value,
        configurable: true,
    })
}

describe('App component', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
        window.history.pushState({}, '', '/')
        googleAuthHookState.hadPreviousSession = false
        googleAuthHookState.isLoading = false
        googleAuthHookState.isSignedIn = false
        onboardingModalMock.mockClear()
        setNavigatorOnline(true)
        yjsHookState.isReady = true
        yjsHookState.isSyncing = false
        yjsHookState.syncState = 'idle'
        yjsHookState.syncPhase = 'idle'
        yjsHookState.isDriveConnected = false
        yjsHookState.isConnecting = false
        yjsHookState.hasSynced = false
        yjsHookState.manualSyncInProgress = false
        yjsHookState.hasPendingSyncChanges.mockReset()
        yjsHookState.hasPendingSyncChanges.mockReturnValue(false)
        yjsHookState.pendingSyncChanges = false
        yjsHookState.forceSyncDrive.mockReset()
        yjsHookState.autoSyncEnabled = true
        yjsHookState.lastSyncedAt = null
        yjsHookState.loadEntriesForYear.mockReset()
        yjsHookState.loadArchivedTasks.mockReset()
        yjsHookState.loadArchivedInvoices.mockReset()
        yjsHookState.getAvailableYears.mockReset()
        yjsHookState.getAvailableYears.mockResolvedValue([])
        yjsHookState.clearAllData.mockReset()
        yjsHookState.restoreBackupData.mockReset()
        yjsHookState.driveSessionId = null
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'tasktime-onboarding-completed') {
                return 'true'
            }

            return null
        })
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
        tasksHookState.tasks.length = 0
        tasksHookState.createTask.mockClear()
        clientsHookState.clients.length = 0
        timersHookState.timers.length = 0
        reportsComponentState.autoReady = true
        reportsComponentState.readyHandler = null
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

    it('keeps the page-level reports loader visible until the reports view signals ready', async () => {
        reportsComponentState.autoReady = false
        urlHookState.urlParams = { view: 'reports', projectId: null, clientId: null }

        render(<App />)

        expect(screen.getByRole('status')).toHaveTextContent('Loading reports')
        expect(await screen.findByTestId('reports-view')).toBeInTheDocument()

        act(() => {
            reportsComponentState.readyHandler?.(true)
        })

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument()
        })
    })

    it('seeds the first onboarding task when onboarding is shown', () => {
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'tasktime-onboarding-completed') {
                return null
            }

            if (key === 'tasktime-onboarding-pending') {
                return null
            }

            return null
        })

        render(<App />)

        expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument()
        expect(tasksHookState.createTask).toHaveBeenCalledTimes(1)
        expect(tasksHookState.createTask).toHaveBeenCalledWith(expect.objectContaining({
            note: 'Start the timer, head to projects, and create your first one.',
            title: 'Create my first project',
            startDate: '2026-02-25',
        }))
        expect(localStorage.setItem).toHaveBeenCalledWith('tasktime-onboarding-pending', 'true')
    })

    it('reopens onboarding after refresh while it is still pending', () => {
        tasksHookState.tasks.push({
            id: 'seed-task',
            title: 'Create my first project',
        })

        localStorage.getItem.mockImplementation((key) => {
            if (key === 'tasktime-onboarding-completed') {
                return null
            }

            if (key === 'tasktime-onboarding-pending') {
                return 'true'
            }

            return null
        })

        render(<App />)

        expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument()
        expect(tasksHookState.createTask).not.toHaveBeenCalled()
    })

    it('renders the desktop sidebar and not the mobile dock on larger screens', () => {
        render(<App />)
        expect(screen.getByText('TaskTime Pro')).toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Clients')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
        expect(screen.getByText('Invoices')).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    })

    it('renders only the auth callback view on the auth callback route', () => {
        urlHookState.urlParams = { view: 'auth-callback', projectId: null, clientId: null }

        render(<App />)

        expect(screen.getByTestId('auth-callback')).toBeInTheDocument()
        expect(screen.queryByText('TaskTime Pro')).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
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
        expect(screen.queryByText('TaskTime Pro')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'More' }))

        const dialog = screen.getByRole('dialog')

        expect(within(dialog).getByText('Clients')).toBeInTheDocument()
        expect(within(dialog).getByText('Invoices')).toBeInTheDocument()
        expect(within(dialog).getByText('Account')).toBeInTheDocument()
        expect(within(dialog).getByText(/Hide totals|Show totals/)).toBeInTheDocument()
        expect(within(dialog).getByText(/Dark mode|Light mode/)).toBeInTheDocument()
    })

    it('clears the previous mobile nav selection when More opens', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        urlHookState.urlParams = { view: 'projects', projectId: null, clientId: null }

        render(<App />)

        const projectsButton = screen.getByRole('button', { name: 'Projects' })
        const moreButton = screen.getByRole('button', { name: 'More' })

        expect(projectsButton.className.includes('text-muted-foreground')).toBe(false)
        expect(moreButton.className.includes('text-muted-foreground')).toBe(true)

        fireEvent.click(moreButton)

        expect(projectsButton.className.includes('text-muted-foreground')).toBe(true)
        expect(moreButton.className.includes('text-muted-foreground')).toBe(false)
    })

    it('navigates from the mobile dock while the More sheet is open', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        urlHookState.urlParams = { view: 'projects', projectId: null, clientId: null }

        const user = userEvent.setup()
        render(<App />)

        await user.click(screen.getByRole('button', { name: 'More' }))

        expect(screen.getByRole('dialog')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Dashboard' }))

        expect(urlHookState.navigateToDashboard).toHaveBeenCalledTimes(1)
    })

    it('navigates through more-sheet destinations and closes the sheet on mobile', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'More' }))
        await user.click(screen.getByRole('button', { name: /Clients/ }))

        expect(urlHookState.navigateToClients).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('routes account from the more sheet on mobile', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'More' }))
        await user.click(screen.getByRole('button', { name: 'Account' }))

        expect(urlHookState.navigateToAccount).toHaveBeenCalledTimes(1)
    })

    it('updates dark mode immediately while the more sheet stays open on mobile', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
            '(prefers-color-scheme: dark)': false,
        })
        document.head.innerHTML = `
            <meta name="theme-color" content="#fcfcfc" />
            <meta name="color-scheme" content="light" />
        `

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'More' }))

        const dialog = screen.getByRole('dialog')

        await user.click(within(dialog).getByRole('button', { name: 'Switch to dark mode' }))

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(within(screen.getByRole('dialog')).getByText('Light mode')).toBeInTheDocument()
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0a0a')
        expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark')
    })

    it('temporarily replaces More with sync status during an active mobile sync', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        yjsHookState.isDriveConnected = true
        yjsHookState.syncPhase = 'uploading'

        render(<App />)

        expect(screen.getByRole('button', { name: 'More. Syncing changes...' })).toBeInTheDocument()
        expect(screen.getByText('Syncing')).toBeInTheDocument()
    })

    it('opens the more sheet from the sync-state mobile slot', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        yjsHookState.isDriveConnected = true
        yjsHookState.syncPhase = 'uploading'

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'More. Syncing changes...' }))

        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('shows the sync button on mobile during the connecting phase', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        yjsHookState.isConnecting = true

        render(<App />)

        expect(screen.getByRole('button', { name: 'More. Syncing...' })).toBeInTheDocument()
    })

    it('keeps the More button neutral during connecting in manual mode on mobile', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        yjsHookState.isConnecting = true
        yjsHookState.autoSyncEnabled = false

        render(<App />)

        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.queryByTestId('mobile-more-status-dot')).not.toBeInTheDocument()
    })

    it('shows a warning dot on More when there are pending sync changes on mobile', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        yjsHookState.isDriveConnected = true
        yjsHookState.autoSyncEnabled = false
        yjsHookState.pendingSyncChanges = true

        render(<App />)

        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.getByTestId('mobile-more-status-dot').className.includes('status-warning-fill')).toBe(true)
    })

    it('returns the mobile sync slot to More after the success linger', () => {
        vi.useFakeTimers()

        try {
            window.matchMedia = createMatchMedia({
                '(max-width: 767px)': true,
            })
            yjsHookState.isDriveConnected = true
            yjsHookState.syncPhase = 'uploading'

            const { rerender } = render(<App />)

            expect(screen.getByRole('button', { name: 'More. Syncing changes...' })).toBeInTheDocument()

            yjsHookState.syncPhase = 'idle'
            yjsHookState.hasSynced = true
            act(() => {
                rerender(<App />)
            })

            expect(screen.getByRole('button', { name: 'More. In sync' })).toBeInTheDocument()

            act(() => {
                vi.advanceTimersByTime(1200)
            })

            expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'More. In sync' })).not.toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps document scrolling enabled without keyboard-specific shell state on mobile', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const { container } = render(<App />)

        const shell = container.querySelector('.app-shell-content')

        expect(shell?.style.getPropertyValue('--app-content-padding-bottom')).toBe('7rem')
        expect(document.documentElement.classList.contains('mobile-layout')).toBe(true)
        expect(document.body.classList.contains('mobile-layout')).toBe(true)
        expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
    })

    it('shows a yellow More-button dot when mobile sync is offline', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        setNavigatorOnline(false)

        render(<App />)

        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.getByTestId('mobile-more-status-dot').className.includes('status-warning-fill')).toBe(true)
    })

    it('shows a red More-button dot when drive sync is disconnected after a prior session', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        googleAuthHookState.hadPreviousSession = true

        render(<App />)

        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.getByTestId('mobile-more-status-dot').className.includes('status-danger-fill')).toBe(true)
    })

    it('does not show a red More-button dot while a previous auth session is still restoring', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        googleAuthHookState.hadPreviousSession = true
        googleAuthHookState.isSignedIn = true

        render(<App />)

        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
        expect(screen.queryByTestId('mobile-more-status-dot')).not.toBeInTheDocument()
    })

    it('opens the task modal from the mobile floating action button menu', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const user = userEvent.setup()

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open quick create menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'New Task' }))

        expect(screen.getByTestId('active-modal')).toHaveTextContent('task')
    })

    it('keeps quick-create task blank on project detail routes', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        const user = userEvent.setup()

        projectsHookState.projects.push({
            id: 'project-1',
            title: 'Launch Site',
            archived: false,
            preferredClientId: 'client-1',
        })
        urlHookState.urlParams = { view: 'projects', projectId: 'project-1', clientId: null }

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open quick create menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'New Task' }))

        expect(screen.getByTestId('active-modal')).toHaveTextContent('task')
        expect(screen.getByTestId('modal-manager').dataset.modalOptions).toBe(JSON.stringify(null))
    })

    it('keeps quick-create expense blank on project detail routes', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        const user = userEvent.setup()

        projectsHookState.projects.push({
            id: 'project-1',
            title: 'Launch Site',
            archived: false,
            preferredClientId: 'client-1',
        })
        urlHookState.urlParams = { view: 'projects', projectId: 'project-1', clientId: null }

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open quick create menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'New Expense' }))

        expect(screen.getByTestId('active-modal')).toHaveTextContent('expense')
        expect(screen.getByTestId('modal-manager').dataset.modalOptions).toBe(JSON.stringify(null))
    })

    it('keeps quick-create expense blank on client detail routes', async () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        const user = userEvent.setup()

        clientsHookState.clients.push({ id: 'client-1', title: 'Acme Co', archived: false })
        urlHookState.urlParams = { view: 'clients', projectId: null, clientId: 'client-1' }

        render(<App />)

        await user.click(screen.getByRole('button', { name: 'Open quick create menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'New Expense' }))

        expect(screen.getByTestId('active-modal')).toHaveTextContent('expense')
        expect(screen.getByTestId('modal-manager').dataset.modalOptions).toBe(JSON.stringify(null))
    })

    it('pins the mobile global timer at the top of the viewport', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        timersHookState.timers.push({
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now(),
            isPaused: false,
            elapsedTime: 1000,
        })

        render(<App />)

        const timer = screen.getByTestId('global-timer')
        const timerShell = timer.parentElement?.parentElement

        expect(timerShell?.className).toContain('top-0')
        expect(timerShell?.className).not.toContain('bottom-safe-dock')
    })

    it('uses the viewport-safe shell for the mobile app layout', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const { container } = render(<App />)

        const main = container.querySelector('main')

        expect(main).not.toBeNull()
        expect(main?.className).toContain('app-viewport-shell')
        expect(main?.className).not.toContain('min-h-screen')
        expect(document.documentElement.classList.contains('mobile-layout')).toBe(true)
        expect(document.body.classList.contains('mobile-layout')).toBe(true)
    })

    it('resets the main content scroll position when navigating to a different route', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })

        const { container, rerender } = render(<App />)

        const main = container.querySelector('main')

        expect(main).not.toBeNull()

        main.scrollTop = 180
        main.scrollLeft = 24
        main.scrollTo = ({ top = 0, left = 0 }) => {
            main.scrollTop = top
            main.scrollLeft = left
        }

        urlHookState.urlParams = { view: 'projects', projectId: null, clientId: null }
        rerender(<App />)

        expect(main.scrollTop).toBe(0)
        expect(main.scrollLeft).toBe(0)
        expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' })
    })

    it('does not render the removed mobile top bar on project detail routes', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        })
        projectsHookState.projects.push({ id: 'project-1', title: 'Launch Site', archived: false })
        urlHookState.urlParams = { view: 'projects', projectId: 'project-1', clientId: null }

        render(<App />)

        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
        expect(screen.queryByText('Launch Site')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open quick create menu' })).toBeInTheDocument()
    })

    it('generates pending recurring expenses on mount and day rollover', () => {
        const { rerender } = render(<App />)

        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledTimes(1)
        expect(recurrenceHookState.generatePendingExpenses).toHaveBeenCalledWith(
            expenseHookState.createExpense,
            expect.any(Set),
        )

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
        const modalText = screen.getByTestId('expense-view-modal').textContent
        expect(modalText).toContain(':Office:actual')
        expect(modalText).not.toContain('created-expense')
    })
})
