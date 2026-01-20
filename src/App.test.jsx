import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { TIMER_HEARTBEAT_INTERVAL_MS } from './constants/app'

const setTimerStateMock = vi.fn()
const setStoredAppVersionMock = vi.fn()

vi.mock('./hooks/useIndexedDB.ts', () => ({

    useIndexedDB: (key, defaultValue) => {
        if (key === 'timer') {
            return [
                {
                    startTime: Date.now() - 1000,
                    taskId: 'task-1',
                    paused: false,
                    elapsedTime: 0,
                    note: undefined,
                    lastActive: null
                },
                setTimerStateMock,
                { loading: false }
            ]
        }
        if (key === 'appVersion') {
            return [null, setStoredAppVersionMock, { loading: false }]
        }
        return [defaultValue, vi.fn(), { loading: false }]
    },
    useIndexedDBLoading: () => false
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

vi.mock('./components/ProjectList', () => ({ default: () => null }))
vi.mock('./components/ProjectDashboard', () => ({ default: () => null }))
vi.mock('./components/ClientList', () => ({ default: () => null }))
vi.mock('./components/ClientDashboard', () => ({ default: () => null }))
vi.mock('./components/Dashboard', () => ({ default: () => null }))
vi.mock('./components/Account', () => ({ default: () => null }))
vi.mock('./components/Invoices', () => ({ default: () => null }))
vi.mock('./components/GlobalTimer', () => ({ default: () => null }))
vi.mock('./components/modals/ModalManager', () => ({ default: () => null }))
vi.mock('./components/ErrorBoundary', () => ({ default: ({ children }) => children }))
vi.mock('./components/OfflineIndicator', () => ({ default: () => null }))
vi.mock('./components/InstallPrompt', () => ({ default: () => null }))
vi.mock('./components/ToastContainer', () => ({ ToastProvider: ({ children }) => children }))
vi.mock('./components/sync/SyncProvider', () => ({ default: ({ children }) => children }))
vi.mock('./components/sync/SyncStatus', () => ({ default: () => null }))

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

describe('App timer heartbeat', () => {

    beforeEach(() => {

        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-19T00:00:00.000Z'))
        setTimerStateMock.mockClear()
        setStoredAppVersionMock.mockClear()
    })

    afterEach(() => {

        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('updates heartbeat while timer is running', () => {

        render(<App />)

        expect(setTimerStateMock).toHaveBeenCalledTimes(1)

        const updater = setTimerStateMock.mock.calls[0][0]
        const updated = updater({
            startTime: Date.now() - 1000,
            taskId: 'task-1',
            paused: false,
            elapsedTime: 0,
            note: undefined,
            lastActive: null
        })

        expect(updated.lastActive).toBe(Date.now())

        vi.advanceTimersByTime(TIMER_HEARTBEAT_INTERVAL_MS)

        expect(setTimerStateMock).toHaveBeenCalledTimes(2)
    })
})
