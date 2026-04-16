import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncSettings from './YjsSyncSettings'

const signInMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const yjsSyncSettingsMocks = vi.hoisted(() => ({
    isDriveConnected: false,
    isConnecting: false,
    isSignedIn: false,
    isMobileLayout: false,
    user: null,
    pendingSyncChanges: false,
    lastSyncedAt: null,
    forceSyncDrive: vi.fn(),
    disconnectDrive: vi.fn(),
    signOut: vi.fn(),
}))
let consoleErrorSpy

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: { setDriveSyncPreferences: vi.fn() },
        isReady: true,
        isSyncing: false,
        syncState: 'idle',
        syncPhase: 'idle',
        isDriveConnected: yjsSyncSettingsMocks.isDriveConnected,
        isConnecting: yjsSyncSettingsMocks.isConnecting,
        hasSynced: false,
        manualSyncInProgress: false,
        lastSyncedAt: yjsSyncSettingsMocks.lastSyncedAt,
        pendingSyncChanges: yjsSyncSettingsMocks.pendingSyncChanges,
        forceSyncDrive: yjsSyncSettingsMocks.forceSyncDrive,
        disconnectDrive: yjsSyncSettingsMocks.disconnectDrive,
        wipeDriveData: vi.fn(),
    }),
}))

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        isSignedIn: yjsSyncSettingsMocks.isSignedIn,
        isLoading: false,
        user: yjsSyncSettingsMocks.user,
        signIn: signInMock,
        signOut: yjsSyncSettingsMocks.signOut,
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

vi.mock('@/hooks/useIsMobileLayout', () => ({
    default: () => yjsSyncSettingsMocks.isMobileLayout,
}))

describe('YjsSyncSettings', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        yjsSyncSettingsMocks.isDriveConnected = false
        yjsSyncSettingsMocks.isConnecting = false
        yjsSyncSettingsMocks.isSignedIn = false
        yjsSyncSettingsMocks.isMobileLayout = false
        yjsSyncSettingsMocks.user = null
        yjsSyncSettingsMocks.pendingSyncChanges = false
        yjsSyncSettingsMocks.lastSyncedAt = null
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

    it('uses a full-width action row for disconnect and sync on mobile', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.isMobileLayout = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByRole('button', { name: 'Disconnect' }).className.includes('flex-1')).toBe(true)
        expect(screen.getByRole('button', { name: 'Sync Now' }).className.includes('flex-1')).toBe(true)
    })

    it('shows manual-mode connected wording before the first manual sync', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByText('Connected (manual sync)')).toBeInTheDocument()
    })

    it('shows waiting manual-sync wording when local changes are pending', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        yjsSyncSettingsMocks.pendingSyncChanges = true

        render(<YjsSyncSettings />)

        expect(screen.getByText('Changes waiting for manual sync')).toBeInTheDocument()
    })

    it('hides the connect button while a signed-in session is still reconnecting', () => {
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.isConnecting = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.queryByRole('button', { name: /connect google drive/i })).toBeNull()
        expect(screen.getByText('Syncing...')).toBeInTheDocument()
    })

    it('hides the connect button when auth is restored but Drive is not yet marked connected', () => {
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.isDriveConnected = false
        yjsSyncSettingsMocks.isConnecting = false
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.queryByRole('button', { name: /connect google drive/i })).toBeNull()
        expect(screen.getByText('Not connected')).toBeInTheDocument()
    })
})