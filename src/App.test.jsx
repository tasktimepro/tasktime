/**
 * App.test.jsx - Tests for the main App component
 * 
 * Tests the Yjs-based App component with mocked hooks
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// Mock all Yjs-based hooks
vi.mock('./contexts/YjsContext.tsx', () => ({
    YjsProvider: ({ children }) => children,
    useYjs: () => ({
        isReady: true,
        syncState: 'idle',
        isSyncing: false,
        isDriveConnected: false,
        forceSyncDrive: vi.fn(),
        loadEntriesForYear: vi.fn(),
        loadArchivedTasks: vi.fn(),
        loadArchivedInvoices: vi.fn(),
        getAvailableYears: vi.fn().mockResolvedValue([]),
    }),
}))

vi.mock('./hooks/useProjects.ts', () => ({
    useProjects: () => ({
        projects: [],
        activeProjects: [],
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

vi.mock('./hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: [],
        sortedClients: [],
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
            weekStartsOn: 0,
            showCompletedTasks: true,
            defaultBillable: true,
        },
        isLoading: false,
        setPreference: vi.fn(),
        updatePreferences: vi.fn(),
        resetPreferences: vi.fn(),
    }),
}))

vi.mock('./hooks/useTimer.ts', () => ({
    useTimer: () => ({
        isActive: false,
        isPaused: false,
        taskId: null,
        elapsedTime: 0,
        note: '',
        startTime: null,
        isLoading: false,
        startTimer: vi.fn(),
        pauseTimer: vi.fn(),
        resumeTimer: vi.fn(),
        stopTimer: vi.fn(),
        setNote: vi.fn(),
        clearTimer: vi.fn(),
    }),
}))

vi.mock('./hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: { view: 'dashboard', projectId: null, clientId: null },
        navigateToProjects: vi.fn(),
        navigateToProject: vi.fn(),
        navigateToClients: vi.fn(),
        navigateToClient: vi.fn(),
        navigateToInvoices: vi.fn(),
        navigateToAccount: vi.fn(),
        navigateToDashboard: vi.fn(),
        updateUrl: vi.fn()
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
vi.mock('./components/Dashboard', () => ({ default: () => <div data-testid="dashboard" /> }))
vi.mock('./components/Account', () => ({ default: () => <div data-testid="account" /> }))
vi.mock('./components/Invoices', () => ({ default: () => <div data-testid="invoices" /> }))
vi.mock('./components/GlobalTimer', () => ({ default: () => <div data-testid="global-timer" /> }))
vi.mock('./components/modals/ModalManager', () => ({ default: () => <div data-testid="modal-manager" /> }))
vi.mock('./components/ErrorBoundary', () => ({ default: ({ children }) => children }))
vi.mock('./components/OfflineIndicator', () => ({ default: () => <div data-testid="offline-indicator" /> }))
vi.mock('./components/InstallPrompt', () => ({ default: () => <div data-testid="install-prompt" /> }))
vi.mock('./components/ToastContainer', () => ({ ToastProvider: ({ children }) => children }))
vi.mock('./components/sync/YjsSyncStatus', () => ({ default: () => <div data-testid="sync-status" /> }))

// Mock matchMedia
if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn()
    }))
}

describe('App component', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders the dashboard view by default', () => {
        render(<App />)
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('renders the navigation sidebar', () => {
        render(<App />)
        expect(screen.getByText('TaskTime')).toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Clients')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
        expect(screen.getByText('Invoices')).toBeInTheDocument()
    })

    it('shows theme toggle button', () => {
        render(<App />)
        // Dark Mode shows by default because matchMedia returns false for dark mode preference
        expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    })
})
