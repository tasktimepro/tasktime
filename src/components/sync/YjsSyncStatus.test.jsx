import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncStatus from './YjsSyncStatus'
import { TooltipProvider } from '@/components/ui/tooltip'
import { act } from 'react'

const signInMock = vi.hoisted(() => vi.fn())
const signInDropboxMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const navigateToAccountMock = vi.hoisted(() => vi.fn())
const forceSyncDriveMock = vi.hoisted(() => vi.fn())
const forceSyncCloudMock = vi.hoisted(() => vi.fn())
const dropboxFeatureState = vi.hoisted(() => ({ enabled: false }))
const dropboxAuthState = vi.hoisted(() => ({ sessionId: null }))
const yjsState = vi.hoisted(() => ({
    store: {
        isDriveConnected: vi.fn(),
        isCloudConnected: vi.fn(),
    },
    isReady: true,
    isSyncing: false,
    syncState: 'idle',
    syncPhase: 'idle',
    isDriveConnected: false,
    isCloudConnected: undefined,
    activeStorageProvider: undefined,
    movedToStorageProvider: null,
    isConnecting: false,
    hasSynced: false,
    manualSyncInProgress: false,
    pendingSyncChanges: false,
    forceSyncDrive: forceSyncDriveMock,
    forceSyncCloud: forceSyncCloudMock,
    autoSyncEnabled: true,
    autoSyncMode: 'sync',
    lastSyncedAt: null,
}))
let consoleErrorSpy

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => yjsState,
}))

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        signIn: signInMock,
        isLoading: false,
        hadPreviousSession: true,
    }),
}))

vi.mock('@/hooks/useDropboxAuth', () => ({
    useDropboxAuth: () => ({
        signIn: signInDropboxMock,
        isLoading: false,
        sessionId: dropboxAuthState.sessionId,
    }),
}))

vi.mock('@/config/cloudProviders', () => ({
    isDropboxCloudUiEnabled: () => dropboxFeatureState.enabled,
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
        yjsState.isReady = true
        yjsState.isSyncing = false
        yjsState.syncState = 'idle'
        yjsState.syncPhase = 'idle'
        yjsState.isDriveConnected = false
        yjsState.isCloudConnected = undefined
        yjsState.activeStorageProvider = undefined
        yjsState.movedToStorageProvider = null
        yjsState.isConnecting = false
        yjsState.hasSynced = false
        yjsState.manualSyncInProgress = false
        yjsState.pendingSyncChanges = false
        yjsState.autoSyncEnabled = true
        yjsState.autoSyncMode = 'sync'
        yjsState.lastSyncedAt = null
        dropboxFeatureState.enabled = false
        dropboxAuthState.sessionId = null
        yjsState.store.isDriveConnected.mockReturnValue(false)
        yjsState.store.isCloudConnected.mockReturnValue(false)
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

    it('does not show a stale connect error after Drive is already connected', async () => {
        signInMock.mockImplementationOnce(async () => {
            yjsState.store.isDriveConnected.mockReturnValue(true)
            yjsState.store.isCloudConnected.mockReturnValue(true)
            throw new Error('Google sign-in could not be completed because the session no longer matched. Please try connecting again.')
        })

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /reconnect to drive/i }))

        expect(showErrorMock).not.toHaveBeenCalled()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('uses the provider-neutral full manual sync when Drive changes are clicked', async () => {
        yjsState.isDriveConnected = true
        yjsState.pendingSyncChanges = true
        yjsState.autoSyncEnabled = false

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /sync changes/i }))

        expect(forceSyncCloudMock).toHaveBeenCalledTimes(1)
        expect(forceSyncCloudMock.mock.calls[0]).toEqual([])
        expect(forceSyncDriveMock).not.toHaveBeenCalled()
    })

    it('uses the generic direct sync action for an active Dropbox session', async () => {
        dropboxFeatureState.enabled = true
        dropboxAuthState.sessionId = 'dropbox-session'
        yjsState.activeStorageProvider = 'dropbox'
        yjsState.isCloudConnected = true
        yjsState.pendingSyncChanges = true
        yjsState.autoSyncEnabled = false

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /sync changes/i }))

        expect(forceSyncCloudMock).toHaveBeenCalledOnce()
        expect(forceSyncDriveMock).not.toHaveBeenCalled()
    })

    it('reconnects the active Dropbox provider without using Google identity', async () => {
        dropboxFeatureState.enabled = true
        dropboxAuthState.sessionId = 'dropbox-session'
        yjsState.activeStorageProvider = 'dropbox'
        yjsState.isCloudConnected = false

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /reconnect to dropbox/i }))

        expect(signInDropboxMock).toHaveBeenCalledOnce()
        expect(signInMock).not.toHaveBeenCalled()
    })

    it('opens provider choices instead of selecting one implicitly', async () => {
        dropboxFeatureState.enabled = true

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /(?:connect|reconnect) to cloud storage/i }))

        expect(navigateToAccountMock).toHaveBeenCalledWith({ section: 'sync' })
        expect(signInMock).not.toHaveBeenCalled()
        expect(signInDropboxMock).not.toHaveBeenCalled()
    })

    it('opens Cloud Sync choices from a moved source instead of reconnecting it', async () => {
        dropboxFeatureState.enabled = true
        yjsState.activeStorageProvider = 'google-drive'
        yjsState.movedToStorageProvider = 'dropbox'

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /moved to dropbox/i }))

        expect(navigateToAccountMock).toHaveBeenCalledWith({ section: 'sync' })
        expect(signInMock).not.toHaveBeenCalled()
        expect(signInDropboxMock).not.toHaveBeenCalled()
    })

    it('opens Cloud Sync settings when the status is clicked while Drive is connecting', async () => {
        yjsState.isDriveConnected = false
        yjsState.isConnecting = true

        render(<YjsSyncStatus />)

        const statusButton = screen.getByRole('button', { name: /syncing/i })

        expect(statusButton).toBeEnabled()
        await userEvent.click(statusButton)

        expect(navigateToAccountMock).toHaveBeenCalledWith({ section: 'sync' })
        expect(forceSyncDriveMock).not.toHaveBeenCalled()
        expect(signInMock).not.toHaveBeenCalled()
    })

    it('clears stale hover state when status changes to synced in compact mode', async () => {
        const user = userEvent.setup()

        const { rerender } = render(
            <TooltipProvider>
                <YjsSyncStatus isCompact />
            </TooltipProvider>
        )

        const statusButton = screen.getByRole('button', { name: /reconnect to drive/i })

        await user.hover(statusButton)

        yjsState.isDriveConnected = true
        yjsState.hasSynced = true

        await act(async () => {
            rerender(
                <TooltipProvider>
                    <YjsSyncStatus isCompact />
                </TooltipProvider>
            )
        })

        expect(screen.getByRole('button', { name: /in sync/i })).toBeTruthy()
        expect(screen.queryByRole('button', { name: /cloud options/i })).toBeNull()
    })
})
