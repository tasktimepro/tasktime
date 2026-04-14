import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncStatus from './YjsSyncStatus'

const signInMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const navigateToAccountMock = vi.hoisted(() => vi.fn())
const forceSyncDriveMock = vi.hoisted(() => vi.fn())
const yjsState = vi.hoisted(() => ({
    isReady: true,
    isSyncing: false,
    syncState: 'idle',
    syncPhase: 'idle',
    isDriveConnected: false,
    isConnecting: false,
    hasSynced: false,
    manualSyncInProgress: false,
    pendingSyncChanges: false,
    forceSyncDrive: forceSyncDriveMock,
    autoSyncEnabled: true,
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
        yjsState.isConnecting = false
        yjsState.hasSynced = false
        yjsState.manualSyncInProgress = false
        yjsState.pendingSyncChanges = false
        yjsState.autoSyncEnabled = true
        yjsState.lastSyncedAt = null
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

    it('uses a full manual sync when pending changes are clicked', async () => {
        yjsState.isDriveConnected = true
        yjsState.pendingSyncChanges = true
        yjsState.autoSyncEnabled = false

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /sync changes/i }))

        expect(forceSyncDriveMock).toHaveBeenCalledTimes(1)
        expect(forceSyncDriveMock.mock.calls[0]).toEqual([])
    })
})