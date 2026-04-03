import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncSettings from './YjsSyncSettings'

const signInMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
let consoleErrorSpy

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: { setDriveSyncPreferences: vi.fn() },
        isReady: true,
        isSyncing: false,
        syncState: 'idle',
        syncPhase: 'idle',
        isDriveConnected: false,
        isConnecting: false,
        hasSynced: false,
        manualSyncInProgress: false,
        lastSyncedAt: null,
        forceSyncDrive: vi.fn(),
        disconnectDrive: vi.fn(),
        wipeDriveData: vi.fn(),
    }),
}))

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        isSignedIn: false,
        isLoading: false,
        user: null,
        signIn: signInMock,
        signOut: vi.fn(),
    }),
}))

vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: {
            autoSyncEnabled: false,
            autoSyncMode: 'backup',
        },
        updatePreferences: vi.fn(),
    }),
}))

vi.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showSuccess: showSuccessMock,
        showError: showErrorMock,
    }),
}))

describe('YjsSyncSettings', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it('shows a toast when account settings connect fails', async () => {
        signInMock.mockRejectedValueOnce(new Error('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.'))

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /connect google drive/i }))

        expect(showErrorMock).toHaveBeenCalledWith('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(showSuccessMock).not.toHaveBeenCalled()
    })
})