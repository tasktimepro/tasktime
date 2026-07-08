import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import YjsSyncStatus from './YjsSyncStatus'
import { TooltipProvider } from '@/components/ui/tooltip'
import { act } from 'react'

const signInMock = vi.hoisted(() => vi.fn())
const showErrorMock = vi.hoisted(() => vi.fn())
const navigateToAccountMock = vi.hoisted(() => vi.fn())
const forceSyncDriveMock = vi.hoisted(() => vi.fn())
const yjsState = vi.hoisted(() => ({
    store: {
        isDriveConnected: vi.fn(),
    },
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
        yjsState.autoSyncMode = 'sync'
        yjsState.lastSyncedAt = null
        yjsState.store.isDriveConnected.mockReturnValue(false)
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
            throw new Error('Google sign-in could not be completed because the session no longer matched. Please try connecting again.')
        })

        render(<YjsSyncStatus />)

        await userEvent.click(screen.getByRole('button', { name: /reconnect to drive/i }))

        expect(showErrorMock).not.toHaveBeenCalled()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
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
