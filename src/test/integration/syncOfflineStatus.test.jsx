import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncStatus from '../../components/sync/YjsSyncStatus'

let mockYjsState = {}

const authMocks = vi.hoisted(() => ({

    signIn: vi.fn()
}))

const urlStateMocks = vi.hoisted(() => ({

    navigateToAccount: vi.fn()
}))

const toastMocks = vi.hoisted(() => ({

    showError: vi.fn()
}))

const setNavigatorOnline = (value) => {

    Object.defineProperty(navigator, 'onLine', {
        value,
        configurable: true
    })
}

vi.mock('../../contexts/YjsContext', () => ({

    useYjs: () => mockYjsState
}))

vi.mock('../../hooks/useGoogleAuth', () => ({

    useGoogleAuth: () => ({
        signIn: authMocks.signIn,
        isLoading: false,
        hadPreviousSession: false
    })
}))

vi.mock('../../hooks/useDropboxAuth', () => ({

    useDropboxAuth: () => ({
        signIn: vi.fn(),
        isLoading: false,
        sessionId: null
    })
}))

vi.mock('../../hooks/useUrlState', () => ({

    useUrlState: () => ({
        navigateToAccount: urlStateMocks.navigateToAccount
    })
}))

vi.mock('../../hooks/useToast', () => ({

    useToast: () => ({
        showError: toastMocks.showError
    })
}))

describe('Sync and offline status integration', () => {

    beforeEach(() => {

        mockYjsState = {
            isReady: true,
            isSyncing: false,
            syncState: 'idle',
            syncPhase: null,
            isDriveConnected: false,
            isConnecting: false,
            hasSynced: false,
            manualSyncInProgress: false,
            pendingSyncChanges: false,
            forceSyncDrive: vi.fn(),
            autoSyncEnabled: true
        }

        setNavigatorOnline(true)
    })

    afterEach(() => {

        cleanup()
        vi.restoreAllMocks()
    })

    it('prompts to connect when online and disconnected', async () => {

        const user = userEvent.setup()

        render(
            <YjsSyncStatus />
        )

        const connectButton = screen.getByRole('button', { name: 'Connect cloud storage' })
        await user.click(connectButton)

        expect(urlStateMocks.navigateToAccount).toHaveBeenCalledWith({ section: 'sync' })
        expect(authMocks.signIn).not.toHaveBeenCalled()
    })

    it('renders nothing while offline', () => {

        setNavigatorOnline(false)

        const { container } = render(
            <YjsSyncStatus />
        )

        expect(container.firstChild).toBeNull()
    })
})
