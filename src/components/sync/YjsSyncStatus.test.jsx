import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncStatus from './YjsSyncStatus'

const signInMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const navigateToAccountMock = vi.hoisted(() => vi.fn())
let consoleErrorSpy

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        isReady: true,
        isSyncing: false,
        syncState: 'idle',
        syncPhase: 'idle',
        isDriveConnected: false,
        isConnecting: false,
        hasSynced: false,
        manualSyncInProgress: false,
        pendingSyncChanges: false,
        forceSyncDrive: vi.fn(),
        autoSyncEnabled: true,
    }),
}))

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        signIn: signInMock,
        isLoading: false,
        hadPreviousSession: true,
    }),
}))

vi.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showError: showErrorMock,
    }),
}))

vi.mock('@/hooks/useUrlState', () => ({
    useUrlState: () => ({
        navigateToAccount: navigateToAccountMock,
    }),
}))

describe('YjsSyncStatus', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it('shows a toast when reconnect fails', async () => {
        signInMock.mockRejectedValueOnce(new Error('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.'))

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /reconnect to drive/i }))

        expect(showErrorMock).toHaveBeenCalledWith('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(navigateToAccountMock).not.toHaveBeenCalled()
    })
})