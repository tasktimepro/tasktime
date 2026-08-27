/**
 * syncPersistence - Persists sync state across page refreshes using localStorage
 * 
 * This module tracks:
 * 1. Whether there are pending local changes that haven't been synced
 * 2. Whether a sync was interrupted (started but not completed)
 * 
 * These flags are NOT synced to cloud - they're purely local state for UI continuity.
 */

import type { CloudProviderId } from '@/stores/yjs/providers/CloudFileStore';

const LEGACY_STORAGE_KEY = 'tasktime-sync-state';
const SCOPED_STORAGE_KEY_PREFIX = 'tasktime-sync-state-v2';
const LEGACY_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY = 'tasktime-disconnected-dirty-docs';
const SCOPED_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY_PREFIX = 'tasktime-disconnected-dirty-docs-v2';

export interface SyncPersistenceScope {
    provider: CloudProviderId;
    generation: number;
}

/** Existing Google connections use generation zero until provider lifecycle lands. */
export const DEFAULT_GOOGLE_SYNC_SCOPE: Readonly<SyncPersistenceScope> = Object.freeze({
    provider: 'google-drive',
    generation: 0,
});

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

function normalizeState(parsed: Partial<SyncPersistenceState>): SyncPersistenceState {
    return {
        hasPendingChanges: parsed.hasPendingChanges ?? false,
        syncInterrupted: parsed.syncInterrupted ?? false,
        syncStartedAt: parsed.syncStartedAt ?? null,
        lastSyncCompletedAt: parsed.lastSyncCompletedAt ?? null,
        pendingDocNames: normalizeDocNames(parsed.pendingDocNames),
        needsRetry: parsed.needsRetry ?? false,
    };
}

function isLegacyGoogleScope(scope: SyncPersistenceScope): boolean {
    return scope.provider === DEFAULT_GOOGLE_SYNC_SCOPE.provider
        && scope.generation === DEFAULT_GOOGLE_SYNC_SCOPE.generation;
}

export function getSyncPersistenceStorageKey(scope: SyncPersistenceScope): string {
    if (!Number.isSafeInteger(scope.generation) || scope.generation < 0) {
        throw new Error('Sync persistence generation must be a non-negative safe integer.');
    }

    return `${SCOPED_STORAGE_KEY_PREFIX}:${scope.provider}:${scope.generation}`;
}

export function getDisconnectedDirtyDocsStorageKey(scope: SyncPersistenceScope): string {
    if (!Number.isSafeInteger(scope.generation) || scope.generation < 0) {
        throw new Error('Disconnected dirty-doc generation must be a non-negative safe integer.');
    }

    return `${SCOPED_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY_PREFIX}:${scope.provider}:${scope.generation}`;
}

/**
 * Read local edits captured while no provider was connected. Legacy evidence
 * belongs only to generation-zero Google and is copied for rolling clients.
 */
export function getDisconnectedDirtyDocNames(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): string[] {
    try {
        if (isLegacyGoogleScope(scope)) {
            const legacy = localStorage.getItem(LEGACY_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY);
            if (legacy) {
                const docNames = normalizeDocNames(JSON.parse(legacy));
                try {
                    localStorage.setItem(
                        getDisconnectedDirtyDocsStorageKey(scope),
                        JSON.stringify(docNames),
                    );
                } catch (error) {
                    console.warn(
                        '[syncPersistence] Error copying legacy disconnected dirty docs:',
                        error,
                    );
                }
                return docNames;
            }
        }

        const scoped = localStorage.getItem(getDisconnectedDirtyDocsStorageKey(scope));
        return scoped ? normalizeDocNames(JSON.parse(scoped)) : [];
    } catch (error) {
        console.warn('[syncPersistence] Error reading disconnected dirty docs:', error);
        return [];
    }
}

/** Persist disconnected dirty docs without crossing provider generations. */
export function setDisconnectedDirtyDocNames(
    docNames: string[],
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    try {
        const normalized = normalizeDocNames(docNames);
        const scopedKey = getDisconnectedDirtyDocsStorageKey(scope);

        if (normalized.length === 0) {
            localStorage.removeItem(scopedKey);
            if (isLegacyGoogleScope(scope)) {
                localStorage.removeItem(LEGACY_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY);
            }
            return;
        }

        const serialized = JSON.stringify(normalized);
        if (isLegacyGoogleScope(scope)) {
            localStorage.setItem(LEGACY_DISCONNECTED_DIRTY_DOCS_STORAGE_KEY, serialized);
        }
        localStorage.setItem(scopedKey, serialized);
    } catch (error) {
        console.warn('[syncPersistence] Error saving disconnected dirty docs:', error);
    }
}

function readState(storageKey: string): SyncPersistenceState | null {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    return normalizeState(JSON.parse(stored) as Partial<SyncPersistenceState>);
}

function persistState(scope: SyncPersistenceScope, state: SyncPersistenceState): void {
    const serialized = JSON.stringify(state);

    // Keep current and rolling-back Google clients compatible while generation
    // zero owns the active connection. Other providers/generations never write
    // the legacy Google key.
    if (isLegacyGoogleScope(scope)) {
        localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    }
    localStorage.setItem(getSyncPersistenceStorageKey(scope), serialized);
}

/**
 * Read the persisted sync state from localStorage
 */
export function getSyncPersistenceState(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): SyncPersistenceState {
    try {
        if (isLegacyGoogleScope(scope)) {
            const legacyState = readState(LEGACY_STORAGE_KEY);
            if (legacyState) {
                // Copy rather than move. Old cached clients continue to read
                // the original key until Google reports a later safe state.
                try {
                    localStorage.setItem(
                        getSyncPersistenceStorageKey(scope),
                        JSON.stringify(legacyState),
                    );
                } catch (error) {
                    console.warn('[syncPersistence] Error copying legacy state:', error);
                }
                return legacyState;
            }
        }

        const scopedState = readState(getSyncPersistenceStorageKey(scope));
        if (scopedState) return scopedState;

        return { ...DEFAULT_STATE };
    } catch (error) {
        console.warn('[syncPersistence] Error reading state:', error);
        return { ...DEFAULT_STATE };
    }
}

/**
 * Update the persisted sync state
 */
function updateSyncPersistenceState(
    updates: Partial<SyncPersistenceState>,
    scope: SyncPersistenceScope,
): void {
    try {
        const current = getSyncPersistenceState(scope);
        const next = { ...current, ...updates };
        persistState(scope, next);
    } catch (error) {
        console.warn('[syncPersistence] Error saving state:', error);
    }
}

/**
 * Mark that local changes exist and need to be synced
 * Call this when a Yjs doc update is queued
 */
export function markPendingChanges(
    docName?: string,
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    const current = getSyncPersistenceState(scope);
    const pendingDocNames = docName
        ? normalizeDocNames([...current.pendingDocNames, docName])
        : current.pendingDocNames;

    updateSyncPersistenceState({
        hasPendingChanges: true,
        pendingDocNames,
    }, scope);
}

/**
 * Clear the pending changes flag after successful sync
 */
export function clearPendingChanges(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    updateSyncPersistenceState({
        hasPendingChanges: false,
        pendingDocNames: [],
    }, scope);
}

/**
 * Clear only the exact recovery identities that completed provider sync.
 * Boolean-only legacy evidence remains conservative because it cannot prove
 * which document was recovered.
 */
export function markPendingDocsSynced(
    docNames: string[],
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    const completedDocNames = new Set(normalizeDocNames(docNames));
    if (completedDocNames.size === 0) return;

    const current = getSyncPersistenceState(scope);
    if (current.pendingDocNames.length === 0) return;

    const pendingDocNames = current.pendingDocNames.filter(
        (docName) => !completedDocNames.has(docName),
    );
    if (pendingDocNames.length === current.pendingDocNames.length) return;

    updateSyncPersistenceState({
        hasPendingChanges: pendingDocNames.length > 0,
        pendingDocNames,
    }, scope);
}

/**
 * Mark that a sync has started
 * Call this at the beginning of a sync operation
 */
export function markSyncStarted(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    updateSyncPersistenceState({
        syncInterrupted: true,
        syncStartedAt: Date.now(),
    }, scope);
}

/**
 * Mark that a sync has completed successfully
 * Call this at the end of a successful sync
 */
export function markSyncCompleted(
    pendingDocNames: string[] = [],
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    const normalizedPendingDocNames = normalizeDocNames(pendingDocNames);

    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        lastSyncCompletedAt: Date.now(),
        hasPendingChanges: normalizedPendingDocNames.length > 0,
        pendingDocNames: normalizedPendingDocNames,
        needsRetry: false,
    }, scope);
}

/**
 * Mark that a sync has failed while preserving any existing local dirty docs.
 * Pull-only and consistency failures use a separate retry flag.
 */
export function markSyncFailed(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    updateSyncPersistenceState({
        syncInterrupted: false,
        syncStartedAt: null,
        // Keep local dirty evidence unchanged and separately retain pull or
        // post-sync consistency failures that need another attempt.
        needsRetry: true,
    }, scope);
}

/**
 * Check if we should trigger a sync on page load
 * Returns true if:
 * - A sync was interrupted (started but not completed)
 * - There are pending changes from a previous session
 */
export function shouldSyncOnLoad(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): boolean {
    const state = getSyncPersistenceState(scope);
    return state.syncInterrupted || state.hasPendingChanges || state.needsRetry;
}

/**
 * Check if there are persisted pending changes
 */
export function hasPersistedPendingChanges(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): boolean {
    return getSyncPersistenceState(scope).hasPendingChanges;
}

/** Get the documents that contain local changes from a prior in-memory session. */
export function getPersistedPendingDocNames(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): string[] {
    return getSyncPersistenceState(scope).pendingDocNames;
}

/** Check whether a failed pull or consistency phase requires a retry. */
export function hasPersistedRetryNeeded(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): boolean {
    return getSyncPersistenceState(scope).needsRetry;
}

/**
 * Check if sync was interrupted
 */
export function wasSyncInterrupted(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): boolean {
    return getSyncPersistenceState(scope).syncInterrupted;
}

/**
 * Clear all persisted sync state (e.g., on disconnect or wipe)
 */
export function clearSyncPersistence(
    scope: SyncPersistenceScope = DEFAULT_GOOGLE_SYNC_SCOPE,
): void {
    try {
        localStorage.removeItem(getSyncPersistenceStorageKey(scope));
        if (isLegacyGoogleScope(scope)) {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('[syncPersistence] Error clearing state:', error);
    }
}
