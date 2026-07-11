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
    /** Documents with local changes that may need full-state recovery after reload */
    pendingDocNames: string[];
    /** A pull or consistency failure that must retry even when no local upload is pending */
    needsRetry: boolean;
}

const DEFAULT_STATE: SyncPersistenceState = {
    hasPendingChanges: false,
    syncInterrupted: false,
    syncStartedAt: null,
    lastSyncCompletedAt: null,
    pendingDocNames: [],
    needsRetry: false,
};

function normalizeDocNames(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(new Set(value.filter((item): item is string => (
        typeof item === 'string' && item.length > 0
    ))));
}

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
            pendingDocNames: normalizeDocNames(parsed.pendingDocNames),
            needsRetry: parsed.needsRetry ?? false,
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
export function markPendingChanges(docName?: string): void {
    const current = getSyncPersistenceState();
    const pendingDocNames = docName
        ? normalizeDocNames([...current.pendingDocNames, docName])
        : current.pendingDocNames;

    updateSyncPersistenceState({
        hasPendingChanges: true,
        pendingDocNames,
    });
}

/**
 * Clear the pending changes flag after successful sync
 */
export function clearPendingChanges(): void {
    updateSyncPersistenceState({
        hasPendingChanges: false,
        pendingDocNames: [],
    });
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
export function markSyncCompleted(pendingDocNames: string[] = []): void {
    const normalizedPendingDocNames = normalizeDocNames(pendingDocNames);

    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        lastSyncCompletedAt: Date.now(),
        hasPendingChanges: normalizedPendingDocNames.length > 0,
        pendingDocNames: normalizedPendingDocNames,
        needsRetry: false,
    });
}

/**
 * Mark that a sync has failed while preserving any existing local dirty docs.
 * Pull-only and consistency failures use a separate retry flag.
 */
export function markSyncFailed(): void {
    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        // Keep local dirty evidence unchanged and separately retain pull or
        // post-sync consistency failures that need another attempt.
        needsRetry: true,
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
    return state.syncInterrupted || state.hasPendingChanges || state.needsRetry;
}

/**
 * Check if there are persisted pending changes
 */
export function hasPersistedPendingChanges(): boolean {
    return getSyncPersistenceState().hasPendingChanges;
}

/** Get the documents that contain local changes from a prior in-memory session. */
export function getPersistedPendingDocNames(): string[] {
    return getSyncPersistenceState().pendingDocNames;
}

/** Check whether a failed pull or consistency phase requires a retry. */
export function hasPersistedRetryNeeded(): boolean {
    return getSyncPersistenceState().needsRetry;
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
