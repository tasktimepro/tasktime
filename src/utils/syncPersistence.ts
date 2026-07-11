/**
 * syncPersistence - Persists sync state across page refreshes using localStorage
 * 
 * This module tracks:
 * 1. Whether there are pending local changes that haven't been synced
 * 2. Whether a sync was interrupted (started but not completed)
 * 
 * These flags are NOT synced to cloud - they're purely local state for UI continuity.
 */

const STORAGE_KEY = 'tasktime-sync-state';

export interface SyncPersistenceState {
    /** Whether there are local changes pending upload */
    hasPendingChanges: boolean;
    /** Whether a sync was in progress when the page closed */
    syncInterrupted: boolean;
    /** Timestamp when sync started (for detecting interrupted syncs) */
    syncStartedAt: number | null;
    /** Timestamp of last successful sync completion */
    lastSyncCompletedAt: number | null;
}

const DEFAULT_STATE: SyncPersistenceState = {
    hasPendingChanges: false,
    syncInterrupted: false,
    syncStartedAt: null,
    lastSyncCompletedAt: null,
};

/**
 * Read the persisted sync state from localStorage
 */
export function getSyncPersistenceState(): SyncPersistenceState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return { ...DEFAULT_STATE };
        }

        const parsed = JSON.parse(stored) as Partial<SyncPersistenceState>;
        return {
            hasPendingChanges: parsed.hasPendingChanges ?? false,
            syncInterrupted: parsed.syncInterrupted ?? false,
            syncStartedAt: parsed.syncStartedAt ?? null,
            lastSyncCompletedAt: parsed.lastSyncCompletedAt ?? null,
        };
    } catch (error) {
        console.warn('[syncPersistence] Error reading state:', error);
        return { ...DEFAULT_STATE };
    }
}

/**
 * Update the persisted sync state
 */
function updateSyncPersistenceState(updates: Partial<SyncPersistenceState>): void {
    try {
        const current = getSyncPersistenceState();
        const next = { ...current, ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
        console.warn('[syncPersistence] Error saving state:', error);
    }
}

/**
 * Mark that local changes exist and need to be synced
 * Call this when a Yjs doc update is queued
 */
export function markPendingChanges(): void {
    updateSyncPersistenceState({ hasPendingChanges: true });
}

/**
 * Clear the pending changes flag after successful sync
 */
export function clearPendingChanges(): void {
    updateSyncPersistenceState({ hasPendingChanges: false });
}

/**
 * Mark that a sync has started
 * Call this at the beginning of a sync operation
 */
export function markSyncStarted(): void {
    updateSyncPersistenceState({
        syncInterrupted: true,
        syncStartedAt: Date.now(),
    });
}

/**
 * Mark that a sync has completed successfully
 * Call this at the end of a successful sync
 */
export function markSyncCompleted(): void {
    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        lastSyncCompletedAt: Date.now(),
        hasPendingChanges: false, // Sync completed means no pending changes
    });
}

/**
 * Mark that a sync has failed (but we're still tracking state)
 * The pending changes flag remains true so we know to retry
 */
export function markSyncFailed(): void {
    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        // A pull or post-sync consistency phase can fail even when there was
        // no local delta before the attempt. Persist retry evidence in every
        // failure case so reload/reconnect cannot silently forget it.
        hasPendingChanges: true,
    });
}

/**
 * Check if we should trigger a sync on page load
 * Returns true if:
 * - A sync was interrupted (started but not completed)
 * - There are pending changes from a previous session
 */
export function shouldSyncOnLoad(): boolean {
    const state = getSyncPersistenceState();
    return state.syncInterrupted || state.hasPendingChanges;
}

/**
 * Check if there are persisted pending changes
 */
export function hasPersistedPendingChanges(): boolean {
    return getSyncPersistenceState().hasPendingChanges;
}

/**
 * Check if sync was interrupted
 */
export function wasSyncInterrupted(): boolean {
    return getSyncPersistenceState().syncInterrupted;
}

/**
 * Clear all persisted sync state (e.g., on disconnect or wipe)
 */
export function clearSyncPersistence(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('[syncPersistence] Error clearing state:', error);
    }
}
