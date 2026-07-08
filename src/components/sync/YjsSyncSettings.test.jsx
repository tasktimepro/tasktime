import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncSettings from './YjsSyncSettings'

const signInMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const updatePreferencesMock = vi.hoisted(() => vi.fn())
const setDriveSyncPreferencesMock = vi.hoisted(() => vi.fn())
const storeIsDriveConnectedMock = vi.hoisted(() => vi.fn())
const wipeDriveDataMock = vi.hoisted(() => vi.fn())
const deleteAllBackupsMock = vi.hoisted(() => vi.fn())
const yjsSyncSettingsMocks = vi.hoisted(() => ({
    isDriveConnected: false,
    isConnecting: false,
    isSignedIn: false,
    isMobileLayout: false,
    user: null,
    pendingSyncChanges: false,
    lastSyncedAt: null,
    syncState: 'idle',
    syncPhase: 'idle',
    autoSyncEnabled: false,
    autoSyncMode: 'sync',
    forceSyncDrive: vi.fn(),
    disconnectDrive: vi.fn(),
    signOut: vi.fn(),
}))
let consoleErrorSpy

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: {
            isDriveConnected: storeIsDriveConnectedMock,
            setDriveSyncPreferences: setDriveSyncPreferencesMock,
        },
        isReady: true,
        isSyncing: false,
        syncState: yjsSyncSettingsMocks.syncState,
        syncPhase: yjsSyncSettingsMocks.syncPhase,
        isDriveConnected: yjsSyncSettingsMocks.isDriveConnected,
        isConnecting: yjsSyncSettingsMocks.isConnecting,
        hasSynced: false,
        manualSyncInProgress: false,
        lastSyncedAt: yjsSyncSettingsMocks.lastSyncedAt,
        pendingSyncChanges: yjsSyncSettingsMocks.pendingSyncChanges,
        forceSyncDrive: yjsSyncSettingsMocks.forceSyncDrive,
        disconnectDrive: yjsSyncSettingsMocks.disconnectDrive,
        wipeDriveData: wipeDriveDataMock,
        deleteAllBackups: deleteAllBackupsMock,
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
            autoSyncEnabled: yjsSyncSettingsMocks.autoSyncEnabled,
            autoSyncMode: yjsSyncSettingsMocks.autoSyncMode,
        },
        updatePreferences: updatePreferencesMock,
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
        if (!HTMLElement.prototype.hasPointerCapture) {
            HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
        }
        if (!HTMLElement.prototype.setPointerCapture) {
            HTMLElement.prototype.setPointerCapture = vi.fn()
        }
        if (!HTMLElement.prototype.releasePointerCapture) {
            HTMLElement.prototype.releasePointerCapture = vi.fn()
        }
        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = vi.fn()
        }
        yjsSyncSettingsMocks.isDriveConnected = false
        yjsSyncSettingsMocks.isConnecting = false
        yjsSyncSettingsMocks.isSignedIn = false
        yjsSyncSettingsMocks.isMobileLayout = false
        yjsSyncSettingsMocks.user = null
        yjsSyncSettingsMocks.pendingSyncChanges = false
        yjsSyncSettingsMocks.lastSyncedAt = null
        yjsSyncSettingsMocks.syncState = 'idle'
        yjsSyncSettingsMocks.syncPhase = 'idle'
        yjsSyncSettingsMocks.autoSyncEnabled = false
        yjsSyncSettingsMocks.autoSyncMode = 'sync'
        storeIsDriveConnectedMock.mockReturnValue(false)
        wipeDriveDataMock.mockResolvedValue(undefined)
        deleteAllBackupsMock.mockResolvedValue(undefined)
        yjsSyncSettingsMocks.signOut.mockResolvedValue(undefined)
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

    it('does not show a stale connect error after Drive is already connected', async () => {
        signInMock.mockImplementationOnce(async () => {
            storeIsDriveConnectedMock.mockReturnValue(true)
            throw new Error('Google sign-in could not be completed because the session no longer matched. Please try connecting again.')
        })

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /connect google drive/i }))

        expect(showErrorMock).not.toHaveBeenCalled()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
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

    it('labels sync as recommended and backup as device-only', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        yjsSyncSettingsMocks.autoSyncEnabled = true
        yjsSyncSettingsMocks.autoSyncMode = 'sync'

        render(<YjsSyncSettings />)

        expect(screen.getByText('Sync between devices (recommended)')).toBeInTheDocument()
        expect(screen.getByText(/Device backup uploads this device/i)).toBeInTheDocument()
    })

    it('requires confirmation before switching to device backup mode', async () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        yjsSyncSettingsMocks.autoSyncEnabled = true
        yjsSyncSettingsMocks.autoSyncMode = 'sync'

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getAllByRole('combobox')[0])
        await userEvent.click(screen.getByRole('option', { name: 'Back up this device only' }))

        expect(screen.getByText('Use device backup mode?')).toBeInTheDocument()
        expect(updatePreferencesMock).not.toHaveBeenCalledWith(expect.objectContaining({ autoSyncMode: 'backup' }))

        await userEvent.click(screen.getByRole('button', { name: 'Use Backup Mode' }))

        expect(updatePreferencesMock).toHaveBeenCalledWith({
            autoSyncEnabled: true,
            autoSyncMode: 'backup',
        })
        expect(setDriveSyncPreferencesMock).toHaveBeenCalledWith(true, 'backup')
        expect(yjsSyncSettingsMocks.forceSyncDrive).toHaveBeenCalled()
    })

    it('shows Sync Now needed when backup mode is blocked with pending changes', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        yjsSyncSettingsMocks.autoSyncEnabled = true
        yjsSyncSettingsMocks.autoSyncMode = 'backup'
        yjsSyncSettingsMocks.pendingSyncChanges = true
        yjsSyncSettingsMocks.syncState = 'error'

        render(<YjsSyncSettings />)

        expect(screen.getByText('Sync Now needed')).toBeInTheDocument()
    })

    it('preserves backup snapshots by default when wiping Drive sync data', async () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        await userEvent.click(screen.getByText('Wipe & Disconnect'))

        expect(screen.getByText('Also delete backup snapshots')).toBeInTheDocument()

        await userEvent.type(screen.getByLabelText(/wipe drive/i), 'wipe drive')
        await userEvent.click(screen.getByRole('button', { name: 'Wipe & Disconnect' }))

        expect(wipeDriveDataMock).toHaveBeenCalledTimes(1)
        expect(deleteAllBackupsMock).not.toHaveBeenCalled()
        expect(yjsSyncSettingsMocks.disconnectDrive).toHaveBeenCalledTimes(1)
        expect(yjsSyncSettingsMocks.signOut).toHaveBeenCalledTimes(1)
        expect(showSuccessMock).toHaveBeenCalledWith('Google Drive sync data wiped and disconnected')
    })

    it('deletes backup snapshots when the wipe backup option is selected', async () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        await userEvent.click(screen.getByText('Wipe & Disconnect'))
        await userEvent.click(screen.getByText('Also delete backup snapshots'))
        await userEvent.type(screen.getByLabelText(/wipe drive/i), 'wipe drive')
        await userEvent.click(screen.getByRole('button', { name: 'Wipe & Disconnect' }))

        expect(wipeDriveDataMock).toHaveBeenCalledTimes(1)
        expect(deleteAllBackupsMock).toHaveBeenCalledTimes(1)
        expect(wipeDriveDataMock.mock.invocationCallOrder[0]).toBeLessThan(deleteAllBackupsMock.mock.invocationCallOrder[0])
        expect(deleteAllBackupsMock.mock.invocationCallOrder[0]).toBeLessThan(yjsSyncSettingsMocks.disconnectDrive.mock.invocationCallOrder[0])
        expect(showSuccessMock).toHaveBeenCalledWith('Google Drive data and backups wiped and disconnected')
    })
})
