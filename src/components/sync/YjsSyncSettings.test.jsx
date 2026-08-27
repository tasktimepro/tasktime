import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncSettings from './YjsSyncSettings'

const signInMock = vi.hoisted(() => vi.fn())
const signInDropboxMock = vi.hoisted(() => vi.fn())
const disconnectDropboxMock = vi.hoisted(() => vi.fn())
const showSuccessMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const updatePreferencesMock = vi.hoisted(() => vi.fn())
const setDriveSyncPreferencesMock = vi.hoisted(() => vi.fn())
const storeIsDriveConnectedMock = vi.hoisted(() => vi.fn())
const storeIsCloudConnectedMock = vi.hoisted(() => vi.fn())
const wipeDriveDataMock = vi.hoisted(() => vi.fn())
const wipeCloudDataMock = vi.hoisted(() => vi.fn())
const deleteAllBackupsMock = vi.hoisted(() => vi.fn())
const forceSyncCloudMock = vi.hoisted(() => vi.fn())
const disconnectCloudMock = vi.hoisted(() => vi.fn())
const disconnectActiveCloudSessionMock = vi.hoisted(() => vi.fn())
const replaceMovedCloudWorkspaceMock = vi.hoisted(() => vi.fn())
const startTransferMock = vi.hoisted(() => vi.fn())
const resumeTransferMock = vi.hoisted(() => vi.fn())
const dropboxFeatureState = vi.hoisted(() => ({ enabled: false }))
const transferState = vi.hoisted(() => ({
    status: 'idle',
    stage: null,
    targetProvider: null,
    error: null,
    canResume: false,
    isTransferInProgress: false,
}))
const yjsSyncSettingsMocks = vi.hoisted(() => ({
    isDriveConnected: false,
    isCloudConnected: false,
    activeStorageProvider: null,
    movedToStorageProvider: null,
    isConnecting: false,
    isSignedIn: false,
    isDropboxSignedIn: false,
    dropboxSessionId: null,
    dropboxAuthError: null,
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

const createDeferred = () => {
    let resolve
    const promise = new Promise((resolvePromise) => {
        resolve = resolvePromise
    })

    return { promise, resolve }
}

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: {
            isDriveConnected: storeIsDriveConnectedMock,
            isCloudConnected: storeIsCloudConnectedMock,
            setDriveSyncPreferences: setDriveSyncPreferencesMock,
        },
        isReady: true,
        isSyncing: false,
        syncState: yjsSyncSettingsMocks.syncState,
        syncPhase: yjsSyncSettingsMocks.syncPhase,
        isDriveConnected: yjsSyncSettingsMocks.isDriveConnected,
        isCloudConnected: yjsSyncSettingsMocks.isCloudConnected,
        activeStorageProvider: yjsSyncSettingsMocks.activeStorageProvider,
        movedToStorageProvider: yjsSyncSettingsMocks.movedToStorageProvider,
        isConnecting: yjsSyncSettingsMocks.isConnecting,
        hasSynced: false,
        manualSyncInProgress: false,
        lastSyncedAt: yjsSyncSettingsMocks.lastSyncedAt,
        pendingSyncChanges: yjsSyncSettingsMocks.pendingSyncChanges,
        forceSyncDrive: yjsSyncSettingsMocks.forceSyncDrive,
        forceSyncCloud: forceSyncCloudMock,
        disconnectDrive: yjsSyncSettingsMocks.disconnectDrive,
        disconnectCloud: disconnectCloudMock,
        disconnectActiveCloudSession: disconnectActiveCloudSessionMock,
        replaceMovedCloudWorkspace: replaceMovedCloudWorkspaceMock,
        wipeDriveData: wipeDriveDataMock,
        wipeCloudData: wipeCloudDataMock,
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
        revokeAccess: vi.fn(),
        hadPreviousSession: false,
    }),
}))

vi.mock('@/hooks/useDropboxAuth', () => ({
    useDropboxAuth: () => ({
        isSignedIn: yjsSyncSettingsMocks.isDropboxSignedIn,
        isLoading: false,
        sessionId: yjsSyncSettingsMocks.dropboxSessionId,
        error: yjsSyncSettingsMocks.dropboxAuthError,
        signIn: signInDropboxMock,
        disconnect: disconnectDropboxMock,
        refresh: vi.fn(),
    }),
}))

vi.mock('@/hooks/useCloudProviderTransfer', () => ({
    useCloudProviderTransfer: () => ({
        ...transferState,
        startTransfer: startTransferMock,
        resumeTransfer: resumeTransferMock,
    }),
}))

vi.mock('@/config/cloudProviders', () => ({
    isDropboxCloudUiEnabled: () => dropboxFeatureState.enabled,
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
        yjsSyncSettingsMocks.isCloudConnected = false
        yjsSyncSettingsMocks.activeStorageProvider = null
        yjsSyncSettingsMocks.movedToStorageProvider = null
        yjsSyncSettingsMocks.isConnecting = false
        yjsSyncSettingsMocks.isSignedIn = false
        yjsSyncSettingsMocks.isDropboxSignedIn = false
        yjsSyncSettingsMocks.dropboxSessionId = null
        yjsSyncSettingsMocks.dropboxAuthError = null
        yjsSyncSettingsMocks.isMobileLayout = false
        yjsSyncSettingsMocks.user = null
        yjsSyncSettingsMocks.pendingSyncChanges = false
        yjsSyncSettingsMocks.lastSyncedAt = null
        yjsSyncSettingsMocks.syncState = 'idle'
        yjsSyncSettingsMocks.syncPhase = 'idle'
        yjsSyncSettingsMocks.autoSyncEnabled = false
        yjsSyncSettingsMocks.autoSyncMode = 'sync'
        dropboxFeatureState.enabled = false
        Object.assign(transferState, {
            status: 'idle',
            stage: null,
            targetProvider: null,
            error: null,
            canResume: false,
            isTransferInProgress: false,
        })
        storeIsDriveConnectedMock.mockReturnValue(false)
        storeIsCloudConnectedMock.mockReturnValue(false)
        wipeDriveDataMock.mockResolvedValue(undefined)
        wipeCloudDataMock.mockResolvedValue(undefined)
        deleteAllBackupsMock.mockResolvedValue(undefined)
        disconnectActiveCloudSessionMock.mockResolvedValue(undefined)
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

    it('keeps Dropbox entry points hidden until the client feature flag is enabled', () => {
        render(<YjsSyncSettings />)

        expect(screen.queryByRole('button', { name: /connect dropbox/i })).toBeNull()
        expect(screen.getByRole('button', { name: /connect google drive/i })).toBeInTheDocument()
    })

    it('gives both provider choices equal primary emphasis and provider-specific marks', () => {
        dropboxFeatureState.enabled = true

        render(<YjsSyncSettings />)

        const googleDriveButton = screen.getByRole('button', { name: /connect google drive/i })
        const dropboxButton = screen.getByRole('button', { name: /connect dropbox/i })

        expect(googleDriveButton).toHaveClass('bg-primary')
        expect(dropboxButton).toHaveClass('bg-primary')
        expect(googleDriveButton.querySelector('[data-provider-icon="google-drive"]')).toHaveAttribute('aria-hidden', 'true')
        expect(dropboxButton.querySelector('[data-provider-icon="dropbox"]')).toHaveAttribute('aria-hidden', 'true')
    })

    it('shows the active provider mark and switches it with the active provider title', () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        const { rerender } = render(<YjsSyncSettings />)

        const googleTitle = screen.getByText('Google Drive')
        expect(googleTitle.parentElement?.querySelector('[data-provider-icon="google-drive"]')).toHaveAttribute('aria-hidden', 'true')

        yjsSyncSettingsMocks.isDriveConnected = false
        yjsSyncSettingsMocks.activeStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.isSignedIn = false
        yjsSyncSettingsMocks.isDropboxSignedIn = true
        yjsSyncSettingsMocks.user = null
        rerender(<YjsSyncSettings />)

        const dropboxTitle = screen.getByText('Dropbox')
        expect(dropboxTitle.parentElement?.querySelector('[data-provider-icon="dropbox"]')).toHaveAttribute('aria-hidden', 'true')
    })

    it('places durable transfer progress above the active provider card', () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        Object.assign(transferState, {
            status: 'transferring',
            stage: 'target-prepared',
            targetProvider: 'dropbox',
            error: null,
            canResume: true,
            isTransferInProgress: true,
        })

        render(<YjsSyncSettings />)

        const transferTitle = screen.getByText('Moving to Dropbox')
        const providerTitle = screen.getByText('Google Drive')
        expect(transferTitle.compareDocumentPosition(providerTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        const progress = screen.getByRole('progressbar', { name: 'Transfer to Dropbox progress' })
        expect(progress).toHaveAttribute('aria-valuenow', '55')
        const progressFill = progress.querySelector('[data-transfer-progress-fill]')
        const progressActivity = progress.querySelector('[data-transfer-progress-activity]')
        expect(progressFill).toContainElement(progressActivity)
        expect(progressActivity).toHaveClass('transfer-progress-activity')
        expect(screen.getByText('55%')).toBeInTheDocument()
        expect(screen.getByText('Verifying your data in Dropbox')).toBeInTheDocument()
        expect(screen.getByText(
            'Do not use TaskTime on other devices during this transfer. Then connect them to Dropbox before making changes.',
        )).toBeInTheDocument()
    })

    it('starts transfer progress at zero until the first durable stage', () => {
        dropboxFeatureState.enabled = true
        Object.assign(transferState, {
            status: 'authorizing',
            stage: null,
            targetProvider: 'dropbox',
            error: null,
            canResume: false,
            isTransferInProgress: true,
        })

        render(<YjsSyncSettings />)

        const progress = screen.getByRole('progressbar', { name: 'Transfer to Dropbox progress' })
        expect(progress).toHaveAttribute('aria-valuenow', '0')
        expect(screen.getByText('0%')).toBeInTheDocument()
        expect(screen.getByText('Waiting for provider authorization')).toBeInTheDocument()
    })

    it('removes completed transfer progress after success takes over', () => {
        dropboxFeatureState.enabled = true
        Object.assign(transferState, {
            status: 'complete',
            stage: 'finalizing',
            targetProvider: 'dropbox',
            error: null,
            canResume: false,
            isTransferInProgress: false,
        })

        render(<YjsSyncSettings />)

        expect(screen.queryByText('Moved to Dropbox')).toBeNull()
        expect(screen.queryByRole('progressbar', { name: 'Transfer to Dropbox progress' })).toBeNull()
    })

    it('offers Dropbox as a direct cloud provider when the client feature flag is enabled', async () => {
        dropboxFeatureState.enabled = true
        signInDropboxMock.mockResolvedValueOnce({ sessionId: 'dropbox-session' })

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /connect dropbox/i }))

        expect(signInDropboxMock).toHaveBeenCalledOnce()
        expect(signInMock).not.toHaveBeenCalled()
        expect(screen.getByText(/one cloud provider for private, direct browser-to-provider sync/i)).toBeInTheDocument()
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
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.isMobileLayout = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByRole('button', { name: 'Disconnect' }).className.includes('flex-1')).toBe(true)
        expect(screen.getByRole('button', { name: 'Sync Now' }).className.includes('flex-1')).toBe(true)
    })

    it('shows manual-mode connected wording before the first manual sync', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByText('Connected (manual sync)')).toBeInTheDocument()
    })

    it('shows waiting manual-sync wording when local changes are pending', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
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

    it('makes the migrated provider the primary recovery action without revoking or deleting source data', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.movedToStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByText('Moved to Dropbox')).toBeInTheDocument()
        const movedDescription = screen.getByText('TaskTime data in this Google Drive was moved to Dropbox.')
        expect(movedDescription).toHaveClass('status-warning-text-strong')

        const connectDropbox = screen.getByRole('button', { name: 'Connect Dropbox' })
        const useDrive = screen.getByRole('button', { name: 'Use Google Drive' })
        const recoveryButtons = Array.from(connectDropbox.parentElement.querySelectorAll('button'))

        expect(connectDropbox.className).toContain('bg-primary')
        expect(recoveryButtons).toEqual([useDrive, connectDropbox])

        await userEvent.click(connectDropbox)

        expect(disconnectActiveCloudSessionMock).toHaveBeenCalledWith({ revoke: false })
        expect(signInDropboxMock).toHaveBeenCalledTimes(1)
        expect(replaceMovedCloudWorkspaceMock).not.toHaveBeenCalled()
    })

    it('requires destructive confirmation before replacing the retained moved-source data', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.movedToStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.isSignedIn = true

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: 'Use Google Drive' }))

        expect(screen.getByText('Use Google Drive for a new workspace?')).toBeInTheDocument()
        expect(screen.getByText(/permanently deletes all TaskTime sync files and backups in Google Drive/i)).toBeInTheDocument()
        expect(screen.getByText(/Dropbox stays unchanged/i)).toBeInTheDocument()

        const clearButton = screen.getByRole('button', { name: 'Clear & use Google Drive' })
        expect(clearButton).toHaveClass('bg-destructive')

        await userEvent.click(clearButton)

        expect(replaceMovedCloudWorkspaceMock).toHaveBeenCalledWith('dropbox')
    })

    it('shows the standard loading spinner while resetting a moved source', async () => {
        const replacement = createDeferred()
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.movedToStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.isSignedIn = true
        replaceMovedCloudWorkspaceMock.mockReturnValueOnce(replacement.promise)

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: 'Use Google Drive' }))
        await userEvent.click(screen.getByRole('button', { name: 'Clear & use Google Drive' }))

        const resettingButton = screen.getByRole('button', { name: 'Resetting Google Drive...' })
        expect(resettingButton).toBeDisabled()
        expect(resettingButton.querySelector('.animate-spin')).not.toBeNull()
        expect(resettingButton.firstElementChild).toHaveClass('animate-spin')

        await act(async () => {
            replacement.resolve(undefined)
            await replacement.promise
        })
    })

    it('makes Google Drive the primary recovery action when Dropbox is the moved source', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.movedToStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isDropboxSignedIn = true

        render(<YjsSyncSettings />)

        expect(screen.getByText('Moved to Google Drive')).toBeInTheDocument()
        const movedDescription = screen.getByText('TaskTime data in this Dropbox was moved to Google Drive.')
        expect(movedDescription).toHaveClass('status-warning-text-strong')

        const connectDrive = screen.getByRole('button', { name: 'Connect Google Drive' })
        const useDropbox = screen.getByRole('button', { name: 'Use Dropbox' })
        const recoveryButtons = Array.from(connectDrive.parentElement.querySelectorAll('button'))

        expect(connectDrive.className).toContain('bg-primary')
        expect(recoveryButtons).toEqual([useDropbox, connectDrive])

        await userEvent.click(connectDrive)

        expect(disconnectActiveCloudSessionMock).toHaveBeenCalledWith({ revoke: false })
        expect(signInMock).toHaveBeenCalledTimes(1)
        expect(replaceMovedCloudWorkspaceMock).not.toHaveBeenCalled()
    })

    it('explains that reusing Dropbox clears only Dropbox and leaves Google Drive unchanged', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.movedToStorageProvider = 'google-drive'

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: 'Use Dropbox' }))

        expect(screen.getByText(/permanently deletes all TaskTime sync files and backups in Dropbox/i)).toBeInTheDocument()
        expect(screen.getByText(/Google Drive stays unchanged/i)).toBeInTheDocument()
    })

    it('offers retry and local disconnect when a retained Dropbox session cannot be validated', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.activeStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.dropboxSessionId = 'retained-dropbox-session'
        yjsSyncSettingsMocks.dropboxAuthError = 'The Dropbox connection service is temporarily unavailable.'

        render(<YjsSyncSettings />)

        expect(screen.getByText('Connection unavailable')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Connect Dropbox' })).toBeNull()
    })

    it('labels sync as recommended and backup as device-only', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
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
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
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
        expect(forceSyncCloudMock).toHaveBeenCalled()
    })

    it('shows Sync Now needed when backup mode is blocked with pending changes', () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        yjsSyncSettingsMocks.autoSyncEnabled = true
        yjsSyncSettingsMocks.autoSyncMode = 'backup'
        yjsSyncSettingsMocks.pendingSyncChanges = true
        yjsSyncSettingsMocks.syncState = 'error'

        render(<YjsSyncSettings />)

        expect(screen.getByText('Sync Now needed')).toBeInTheDocument()
    })

    it('offers only disconnect and wipe actions for a connected provider', async () => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        expect(screen.getByText('Wipe data & disconnect')).toBeInTheDocument()
        expect(screen.queryByText('Revoke access')).toBeNull()
    })

    it('shows the standard loading spinner while syncing and disconnecting', async () => {
        const sync = createDeferred()
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        forceSyncCloudMock.mockReturnValueOnce(sync.promise)

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
        await userEvent.click(screen.getByRole('button', { name: 'Sync & disconnect' }))

        const disconnectingButton = screen.getByRole('button', { name: 'Disconnecting...' })
        expect(disconnectingButton).toBeDisabled()
        expect(disconnectingButton.querySelector('.animate-spin')).not.toBeNull()
        expect(disconnectingButton.firstElementChild).toHaveClass('animate-spin')

        await act(async () => {
            sync.resolve(undefined)
            await sync.promise
        })
    })

    it('shows the standard loading spinner while wiping and disconnecting', async () => {
        const wipe = createDeferred()
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }
        wipeCloudDataMock.mockReturnValueOnce(wipe.promise)

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        await userEvent.click(screen.getByText('Wipe data & disconnect'))
        await userEvent.type(screen.getByLabelText(/wipe data/i), 'wipe data')
        await userEvent.click(screen.getByRole('button', { name: 'Wipe & disconnect' }))

        const wipingButton = screen.getByRole('button', { name: 'Wiping...' })
        expect(wipingButton).toBeDisabled()
        expect(wipingButton.querySelector('.animate-spin')).not.toBeNull()
        expect(wipingButton.firstElementChild).toHaveClass('animate-spin')

        await act(async () => {
            wipe.resolve(undefined)
            await wipe.promise
        })
    })

    it.each([
        ['google-drive', true, false, 'Google Drive'],
        ['dropbox', false, true, 'Dropbox'],
    ])('wipes all cloud data and revokes %s before disconnecting', async (provider, driveSignedIn, dropboxSignedIn, providerName) => {
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = provider
        yjsSyncSettingsMocks.isSignedIn = driveSignedIn
        yjsSyncSettingsMocks.isDropboxSignedIn = dropboxSignedIn
        yjsSyncSettingsMocks.user = driveSignedIn ? { email: 'user@example.com' } : null

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        await userEvent.click(screen.getByText('Wipe data & disconnect'))
        expect(screen.queryByText('Also delete backup snapshots')).toBeNull()
        await userEvent.type(screen.getByLabelText(/wipe data/i), 'wipe data')
        await userEvent.click(screen.getByRole('button', { name: 'Wipe & disconnect' }))

        expect(wipeCloudDataMock).toHaveBeenCalledTimes(1)
        expect(deleteAllBackupsMock).toHaveBeenCalledTimes(1)
        expect(disconnectActiveCloudSessionMock).toHaveBeenCalledWith({ revoke: true })
        expect(wipeCloudDataMock.mock.invocationCallOrder[0]).toBeLessThan(deleteAllBackupsMock.mock.invocationCallOrder[0])
        expect(deleteAllBackupsMock.mock.invocationCallOrder[0]).toBeLessThan(disconnectActiveCloudSessionMock.mock.invocationCallOrder[0])
        expect(showSuccessMock).toHaveBeenCalledWith(`${providerName} data wiped and disconnected`)
    })

    it.each([
        ['google-drive', true, false, 'dropbox', 'Dropbox'],
        ['dropbox', false, true, 'google-drive', 'Google Drive'],
    ])('keeps the %s transfer action in the overflow menu with the destination provider mark', async (
        provider,
        driveSignedIn,
        dropboxSignedIn,
        targetProvider,
        targetProviderName,
    ) => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.isDriveConnected = provider === 'google-drive'
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = provider
        yjsSyncSettingsMocks.isSignedIn = driveSignedIn
        yjsSyncSettingsMocks.isDropboxSignedIn = dropboxSignedIn
        yjsSyncSettingsMocks.user = driveSignedIn ? { email: 'user@example.com' } : null
        startTransferMock.mockResolvedValueOnce(undefined)

        render(<YjsSyncSettings />)

        expect(screen.queryByText(`Transfer to ${targetProviderName}`)).toBeNull()

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))

        const transferAction = screen.getByText(`Transfer to ${targetProviderName}`).closest('[role="menuitem"]')
        expect(transferAction).toBeInTheDocument()
        expect(transferAction.querySelector(`[data-provider-icon="${targetProvider}"]`)).toHaveAttribute('aria-hidden', 'true')

        await userEvent.click(transferAction)

        expect(screen.getByText(`Transfer to ${targetProviderName}?`)).toBeInTheDocument()
        expect(screen.getByText(`Your ${provider === 'google-drive' ? 'Google Drive' : 'Dropbox'} data and backups will stay there.`)).toBeInTheDocument()
        expect(screen.getByText(
            `Do not use TaskTime on other devices during this transfer. Then connect them to ${targetProviderName} before making changes.`,
        )).toBeInTheDocument()
        expect(screen.queryByText('On your other devices')).toBeNull()
        expect(screen.queryByText(/copy every managed document/i)).toBeNull()
        expect(screen.queryByText(/directly to the target/i)).toBeNull()
        expect(startTransferMock).not.toHaveBeenCalled()

        const confirmTransferButton = screen.getByRole('button', { name: 'Connect & transfer' })
        expect(confirmTransferButton.querySelector(`[data-provider-icon="${targetProvider}"]`)).toHaveAttribute('aria-hidden', 'true')
        expect(confirmTransferButton.firstElementChild).toHaveAttribute('data-provider-icon', targetProvider)

        await userEvent.click(confirmTransferButton)

        expect(startTransferMock).toHaveBeenCalledWith(targetProvider)
    })

    it('keeps the destination-marked transfer action in the mobile overflow menu', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.isDriveConnected = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'google-drive'
        yjsSyncSettingsMocks.isSignedIn = true
        yjsSyncSettingsMocks.isMobileLayout = true
        yjsSyncSettingsMocks.user = { email: 'user@example.com' }

        render(<YjsSyncSettings />)

        expect(screen.queryByText('Transfer to Dropbox')).toBeNull()

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))

        const transferAction = screen.getByText('Transfer to Dropbox').closest('[role="menuitem"]')
        expect(transferAction).toBeInTheDocument()
        expect(transferAction.querySelector('[data-provider-icon="dropbox"]')).toHaveAttribute('aria-hidden', 'true')
    })

    it('puts the concise destructive Dropbox consequences in the warning notice', async () => {
        dropboxFeatureState.enabled = true
        yjsSyncSettingsMocks.isCloudConnected = true
        yjsSyncSettingsMocks.activeStorageProvider = 'dropbox'
        yjsSyncSettingsMocks.isDropboxSignedIn = true

        render(<YjsSyncSettings />)

        await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
        await userEvent.click(screen.getByText('Wipe data & disconnect'))

        expect(screen.getByText('Cloud data will be wiped')).toBeInTheDocument()
        expect(screen.getByText(/Deletes all TaskTime sync files and backups from Dropbox, revokes access, and disconnects this browser/i)).toBeInTheDocument()
        expect(screen.getByText(/Dropbox may retain deleted files temporarily for recovery/i)).toBeInTheDocument()
        expect(screen.getByText('wipe data')).toBeInTheDocument()
    })
})
