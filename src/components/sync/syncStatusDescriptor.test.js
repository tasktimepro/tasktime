import { describe, it, expect, vi } from 'vitest'
import { getYjsSyncStatusDescriptor, SYNC_STATUS_KIND } from './syncStatusDescriptor'

const baseArgs = {
    isReady: true,
    authLoading: false,
    isOffline: false,
    isDriveConnected: true,
    isConnecting: false,
    hadPreviousSession: true,
    syncState: 'idle',
    syncPhase: 'idle',
    lastSyncedAt: null,
    manualSyncInProgress: false,
    pendingSyncChanges: false,
    autoSyncEnabled: true,
    isSyncing: true,
    hasSynced: true,
    onConnect: vi.fn(),
    onCloudOptions: vi.fn(),
    onManualSync: vi.fn(),
}

describe('getYjsSyncStatusDescriptor', () => {

    it('returns LOADING when nothing is ready', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            isReady: false,
            authLoading: true,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.LOADING)
    })

    it('skips loading gate when auth is loading but Drive is already connected', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            authLoading: true,
            isDriveConnected: true,
        })

        expect(result.kind).not.toBe(SYNC_STATUS_KIND.LOADING)
    })

    it('skips loading gate when auth is loading but Drive is connecting', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            authLoading: true,
            isDriveConnected: false,
            isConnecting: true,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.CONNECTING)
    })

    it('shows LOADING when auth is loading and Drive is not connected or connecting', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            authLoading: true,
            isDriveConnected: false,
            isConnecting: false,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.LOADING)
    })

    it('returns SYNCED when fully synced', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            isSyncing: false,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.SYNCED)
    })

    it('returns CONNECTING when isConnecting is true', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            isDriveConnected: false,
            isConnecting: true,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.CONNECTING)
    })

    it('returns CHECKING during checking phase', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            syncPhase: 'checking',
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.CHECKING)
    })

    it('returns DOWNLOADING during downloading phase', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            syncPhase: 'downloading',
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.DOWNLOADING)
    })

    it('returns UPLOADING during uploading phase', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            syncPhase: 'uploading',
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.UPLOADING)
    })

    it('returns ERROR with last synced time', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            syncState: 'error',
            lastSyncedAt: Date.now() - 25 * 60_000,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.ERROR)
        expect(result.text).toMatch(/25m ago/)
    })

    it('returns OFFLINE when offline', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            isOffline: true,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.OFFLINE)
    })

    it('returns PENDING for manual mode with pending changes', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            autoSyncEnabled: false,
            pendingSyncChanges: true,
            isSyncing: false,
            hasSynced: true,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.PENDING)
    })

    it('returns CONNECTED wording for manual mode without pending changes', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            autoSyncEnabled: false,
            pendingSyncChanges: false,
            isSyncing: false,
            hasSynced: false,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.SYNCED)
        expect(result.text).toBe('Connected')
    })

    it('returns DISCONNECTED when not connected', () => {
        const result = getYjsSyncStatusDescriptor({
            ...baseArgs,
            isDriveConnected: false,
            isConnecting: false,
        })

        expect(result.kind).toBe(SYNC_STATUS_KIND.DISCONNECTED)
    })
})
