/**
 * YjsDriveProvider - Google Drive sync provider for Yjs documents
 *
 * Sync contract source of truth: ../../../components/sync/README.md
 * 
 * Handles:
 * - Delta-based sync (only changes, not full state)
 * - Multi-document sync (core, entries, archives)
 * - Automatic compaction when deltas accumulate
 * - Offline resilience with pending delta queue
 * - Debounced sync to batch rapid changes
 */

import * as Y from 'yjs';
import { encodeStateAsUpdate, applyUpdate, mergeUpdates } from 'yjs';
import { YjsDocManager } from '../YjsDocManager';
import { ManifestManager, AuthorizationError, isDriveFileNotFoundError } from './ManifestManager';
import { BackupManager } from './BackupManager';
import type { DocName, SyncState, DriveSyncMode, SyncPhase } from '../types';
import { validateDocManagerState } from '../validation';
import {
    markPendingChanges,
    markSyncStarted,
    markSyncCompleted,
    markSyncFailed,
    hasPersistedPendingChanges,
    wasSyncInterrupted,
    clearSyncPersistence,
    getSyncPersistenceState,
} from '@/utils/syncPersistence';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import { PROJECT_NOTES_LOCAL_SAVE_ORIGIN } from '@/constants/syncOrigins';

export { AuthorizationError };

const COMPACTION_THRESHOLD = 10; // Compact after 10 deltas
const SYNC_INTERVAL_MS = 900_000; // 15 minutes (reduced periodic checks)
const SYNC_DEBOUNCE_MS = 100; // Small debounce to batch rapid changes
const PULL_THROTTLE_MS = 30_000; // Skip pull if no local changes and last pull was < 30s ago
const CROSS_TAB_SYNC_RECENCY_MS = 60_000; // Skip periodic sync if another tab synced in last 60s
const SYNC_LOCK_NAME = 'tasktime-drive-sync';
const WIPE_VERIFY_ATTEMPTS = 3;
const DRIVE_INCIDENT_THROTTLE_MS = 15 * 60 * 1000;
const DRIVE_VALIDATION_INCIDENT_THROTTLE_MS = 30 * 60 * 1000;

class BackupModeRemoteChangedError extends Error {

    constructor() {
        super('Remote Drive data changed. Run Sync Now before backup mode can upload local changes.');
        this.name = 'BackupModeRemoteChangedError';
    }
}

function captureDriveIncident({
    incidentKey,
    message,
    error,
    context,
    throttleMs = DRIVE_INCIDENT_THROTTLE_MS,
}: {
    incidentKey: string;
    message: string;
    error?: unknown;
    context?: Record<string, unknown>;
    throttleMs?: number;
}): void {
    captureDebugBundleIncident({
        incidentKey,
        name: 'TaskTimeDriveSyncError',
        message,
        error,
        context,
        throttleMs,
    });
}

/**
 * Acquire a Web Lock to coordinate sync across browser tabs.
 * - ifAvailable=true: return immediately if lock not available (for periodic/debounced syncs)
 * - ifAvailable=false: wait for lock (for force/manual syncs)
 * Falls back to no-op on browsers without Web Locks API.
 */
async function withSyncLock<T>(fn: () => Promise<T>, wait: boolean = false): Promise<T | undefined> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
        return fn();
    }

    return navigator.locks.request(
        SYNC_LOCK_NAME,
        { ifAvailable: !wait },
        async (lock) => {
            if (!lock) {
                return undefined; // Another tab holds the lock
            }

            return fn();
        },
    );
}

type DocUpdateHandler = (...args: unknown[]) => void;

type ConnectOptions = {
    bootstrapPullIfPristine?: boolean;
};

export class YjsDriveProvider {

    private docManager: YjsDocManager;
    private manifest: ManifestManager;
    private accessToken: string;
    private sessionId: string | null;

    private connected: boolean = false;
    private syncState: SyncState = 'idle';
    private stateListeners: Set<(state: SyncState) => void> = new Set();
    private syncPhase: SyncPhase = 'idle';
    private phaseListeners: Set<(phase: SyncPhase) => void> = new Set();
    private syncMode: DriveSyncMode = 'sync';
    private pendingChanges: boolean = false;
    private pendingChangeListeners: Set<(hasPending: boolean) => void> = new Set();
    private onSyncCompleteCallback: (() => void) | null = null;

    private pendingDeltas: Map<DocName, Uint8Array[]> = new Map();
    private docUpdateHandlers: Map<DocName, DocUpdateHandler> = new Map();
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isSyncing: boolean = false;
    private forceFullStateDocs: Set<DocName> = new Set();
    private lifecycleListenersAttached: boolean = false;

    // Track which state versions and deltas we've already applied locally
    private appliedStateVersions: Map<DocName, number> = new Map();
    private appliedDeltaIds: Map<DocName, Set<string>> = new Map();

    // Track last pull time and manifest modifiedTime for throttling
    private lastPullAt: number = 0;
    private lastManifestModifiedTime: string | null = null;

    markDocsForFullStateUpload(docNames: DocName[]): void {
        let added = false;

        for (const docName of docNames) {
            if (!this.forceFullStateDocs.has(docName)) {
                this.forceFullStateDocs.add(docName);
                added = true;
            }
        }

        if (added) {
            this.log('sync: queued full-state upload for reconnect docs', { docs: docNames });
            this.updatePendingState();
        }
    }

    private isOnline(): boolean {
        if (typeof navigator === 'undefined') {
            return true;
        }

        return navigator.onLine;
    }

    private initializeOfflineConnection(reason: string): void {
        for (const docName of this.docManager.getLoadedDocs()) {
            this.subscribeToDoc(docName);
        }

        this.forceFullStateDocs = new Set(this.docManager.getLoadedDocs());
        this.connected = true;
        this.updateSyncInterval();
        this.setState('offline');
        this.setPhase('idle');
        this.updatePendingState();
        this.log(`connect: offline (${reason})`);
    }

    private log(message: string, extra?: unknown): void {
        const ts = new Date().toISOString();
        if (extra !== undefined) {
            console.log(`[DriveSync] ${ts} ${message}`, extra);
        } else {
            console.log(`[DriveSync] ${ts} ${message}`);
        }
    }

    private handleDocumentVisibilityChange = (): void => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
            return;
        }

        this.flushPendingChangesForPageExit('visibilitychange');
    };

    private handlePageHide = (): void => {
        this.flushPendingChangesForPageExit('pagehide');
    };

    private attachLifecycleListeners(): void {
        if (this.lifecycleListenersAttached || typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        document.addEventListener('visibilitychange', this.handleDocumentVisibilityChange);
        window.addEventListener('pagehide', this.handlePageHide);
        this.lifecycleListenersAttached = true;
    }

    private detachLifecycleListeners(): void {
        if (!this.lifecycleListenersAttached || typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        document.removeEventListener('visibilitychange', this.handleDocumentVisibilityChange);
        window.removeEventListener('pagehide', this.handlePageHide);
        this.lifecycleListenersAttached = false;
    }

    private flushPendingChangesForPageExit(trigger: 'pagehide' | 'visibilitychange'): void {
        if (!this.connected || this.syncMode === 'manual') {
            return;
        }

        if (!this.hasLocalChangesToPush()) {
            return;
        }

        this.log('page exit: flushing pending local changes', { trigger, mode: this.syncMode });
        this.sync(true, { allowPull: false }).catch((error) => {
            console.error('[YjsDriveProvider] Page-exit sync failed:', error);
            captureDriveIncident({
                incidentKey: 'drive.page_exit_sync_failed',
                message: 'TaskTime could not flush pending Drive sync changes during page exit',
                error,
                context: { trigger, mode: this.syncMode },
                throttleMs: 10 * 60 * 1000,
            });
        });
    }

    private clearUploadedPendingPrefix(docName: DocName, uploadedBatch: Uint8Array[]): void {
        if (uploadedBatch.length === 0) {
            return;
        }

        const latestPending = this.pendingDeltas.get(docName) ?? [];

        if (uploadedBatch.every((update, index) => latestPending[index] === update)) {
            this.pendingDeltas.set(docName, latestPending.slice(uploadedBatch.length));
        }
    }

    private async downloadFileWithRecovery(fileName: string, fileId: string): Promise<ArrayBuffer | null> {
        try {
            return await this.manifest.downloadFileAsArrayBuffer(fileId);
        } catch (error) {
            if (!isDriveFileNotFoundError(error)) {
                throw error;
            }

            this.log('pull: cached file id missing, refreshing file cache', { fileName, fileId });
            this.manifest.deleteFileId(fileName);
            await this.manifest.refreshFileCache();

            const recoveredFileId = await this.manifest.getFileIdWithFallback(fileName);
            if (!recoveredFileId) {
                captureDriveIncident({
                    incidentKey: 'drive.remote_file_missing_after_recovery',
                    message: 'TaskTime could not recover a Drive sync file after refreshing the file cache',
                    error,
                    context: { fileName, fileId },
                    throttleMs: 30 * 60 * 1000,
                });
                return null;
            }

            try {
                return await this.manifest.downloadFileAsArrayBuffer(recoveredFileId);
            } catch (retryError) {
                if (isDriveFileNotFoundError(retryError)) {
                    captureDriveIncident({
                        incidentKey: 'drive.remote_file_missing_after_recovery',
                        message: 'TaskTime could not recover a Drive sync file after refreshing the file cache',
                        error: retryError,
                        context: { fileName, fileId: recoveredFileId, originalFileId: fileId },
                        throttleMs: 30 * 60 * 1000,
                    });
                    return null;
                }

                throw retryError;
            }
        }
    }

    private async uploadFileWithRecovery(fileName: string, blob: Blob): Promise<void> {
        const existingFileId = this.manifest.getFileId(fileName);

        if (!existingFileId) {
            const fileId = await this.manifest.createFile(fileName, blob);
            this.manifest.setFileId(fileName, fileId);
            return;
        }

        try {
            await this.manifest.updateFile(existingFileId, fileName, blob);
            return;
        } catch (error) {
            if (!isDriveFileNotFoundError(error)) {
                throw error;
            }

            this.log('push: cached file id missing, refreshing file cache', { fileName, fileId: existingFileId });
            this.manifest.deleteFileId(fileName);
            await this.manifest.refreshFileCache();

            const recoveredFileId = await this.manifest.getFileIdWithFallback(fileName);
            if (recoveredFileId) {
                try {
                    await this.manifest.updateFile(recoveredFileId, fileName, blob);
                    this.manifest.setFileId(fileName, recoveredFileId);
                    return;
                } catch (retryError) {
                    if (!isDriveFileNotFoundError(retryError)) {
                        throw retryError;
                    }

                    this.log('push: recovered file id also missing, creating replacement file', { fileName, fileId: recoveredFileId });
                    this.manifest.deleteFileId(fileName);
                }
            }

            const replacementFileId = await this.manifest.createFile(fileName, blob);
            this.manifest.setFileId(fileName, replacementFileId);
        }
    }

    private updatePendingState(): void {
        const hasPendingInMemory = this.hasLocalChangesToPush();
        // Also check persisted state for changes from previous sessions
        const hasPersisted = hasPersistedPendingChanges() || wasSyncInterrupted();
        const hasPending = hasPendingInMemory || hasPersisted;
        
        if (hasPending === this.pendingChanges) {
            return;
        }

        this.pendingChanges = hasPending;
        for (const callback of this.pendingChangeListeners) {
            callback(hasPending);
        }
    }

    private promotePersistedLocalChangesToFullState(loadedDocs: DocName[]): void {
        const hasOnlyPersistedLocalChanges = (hasPersistedPendingChanges() || wasSyncInterrupted()) && !this.hasPendingDeltas();

        if (!hasOnlyPersistedLocalChanges || loadedDocs.length === 0) {
            return;
        }

        let added = false;

        for (const docName of loadedDocs) {
            if (!this.forceFullStateDocs.has(docName)) {
                this.forceFullStateDocs.add(docName);
                added = true;
            }
        }

        if (added) {
            this.log('sync: promoting persisted local changes to full-state upload', { docs: loadedDocs });
        }
    }

    /**
     * Apply a remote CRDT update, always merging into the local doc.
     *
     * Validation runs on a projected copy first.  If the merged state has
     * reference-integrity issues (e.g. a timer referencing an archived task
     * whose doc isn't loaded), the update is still applied — CRDT
     * convergence takes priority.  Invalid entities are filtered at
     * read-time by `collectValidatedEntities`, so the UI stays safe.
     */
    applyValidatedRemoteUpdate(docName: DocName, doc: Y.Doc, update: Uint8Array, source: string): boolean {
        const projectedDoc = new Y.Doc();

        try {
            applyUpdate(projectedDoc, encodeStateAsUpdate(doc));
            applyUpdate(projectedDoc, update, 'remote');
        } catch (error) {
            // Corrupt CRDT binary — this is the only case we truly reject
            console.warn(`[YjsDriveProvider] Rejected corrupt remote ${source} for ${docName}:`, error);
            projectedDoc.destroy();
            return false;
        }

        try {
            validateDocManagerState(this.docManager, docName, projectedDoc);
        } catch (error) {
            // Reference-integrity warning — log but still apply.
            // Cross-document references (e.g. entries → tasks) can be
            // temporarily broken during concurrent multi-device edits;
            // blocking the update would prevent CRDT convergence.
            console.warn(`[YjsDriveProvider] Validation warning after ${source} for ${docName} (update applied anyway):`, error);
            captureDriveIncident({
                incidentKey: 'drive.remote_validation_warning',
                message: 'TaskTime applied a remote Drive update that failed validation',
                error,
                context: { docName, source },
                throttleMs: DRIVE_VALIDATION_INCIDENT_THROTTLE_MS,
            });
        }

        projectedDoc.destroy();

        // Always apply the remote update to maintain CRDT convergence
        applyUpdate(doc, update, 'remote');
        return true;
    }

    constructor(docManager: YjsDocManager, accessToken: string, sessionId?: string | null) {
        this.docManager = docManager;
        this.accessToken = accessToken;
        this.sessionId = sessionId ?? null;
        this.manifest = new ManifestManager(accessToken, sessionId);
    }

    /**
     * Register a callback to run after each successful sync
     */
    onSyncComplete(callback: () => void): void {
        this.onSyncCompleteCallback = callback;
    }

    /**
     * Get the manifest manager (for BackupManager access)
     */
    getManifest(): ManifestManager {
        return this.manifest;
    }

    // =========================================================================
    // Connection Management
    // =========================================================================

    /**
     * Connect to Google Drive and start syncing
     * @param syncMode - Optional sync mode to determine connect behavior.
     *   'sync' = pull + push (default), 'backup' = push only, 'manual' = subscribe only
     */
    async connect(syncMode?: DriveSyncMode, options: ConnectOptions = {}): Promise<void> {
        if (this.connected) return;

        const mode = syncMode ?? this.syncMode;
        const bootstrapPullIfPristine = options.bootstrapPullIfPristine === true;
        this.syncMode = mode;

        try {
            if (!this.isOnline()) {
                this.initializeOfflineConnection('navigator.offline');
                return;
            }

            this.log('connect: starting', { mode });

            if (mode === 'sync') {
                // Sync mode: load manifest and pull remote changes.
                // No need to force-push full state — IndexedDB has everything
                // and any pending changes from interrupted syncs are handled
                // separately by the persisted state recovery in YjsContext.
                this.setState('syncing');
                this.setPhase('checking');

                await this.manifest.load();
                this.lastPullAt = Date.now();
                this.log('connect: manifest loaded');

                this.promotePersistedLocalChangesToFullState(this.docManager.getLoadedDocs());

                for (const docName of this.docManager.getLoadedDocs()) {
                    await this.syncDoc(docName);
                    this.subscribeToDoc(docName);
                }

                // Save manifest only if we modified it during connect
                if (this.manifest.isDirty()) {
                    await this.manifest.save();
                    this.log('connect: manifest saved');
                }
            } else if (mode === 'backup') {
                // Backup mode avoids background pulls after connect, but still
                // performs a one-time remote check on connect so a fresh device
                // doesn't overwrite existing Drive state with an empty local doc.
                this.setState('syncing');
                this.setPhase('checking');

                await this.manifest.load();
                this.lastPullAt = Date.now();

                const remoteManifest = this.manifest.getManifest();
                const hasRemoteData = remoteManifest && Object.keys(remoteManifest.documents).length > 0;

                this.promotePersistedLocalChangesToFullState(this.docManager.getLoadedDocs());

                const shouldPushLocalChanges = this.hasLocalChangesToPush();

                if (hasRemoteData) {
                    // Remote data exists — pull it before subscribing to local changes
                    this.log('connect: first-sync pull for backup/manual mode');
                    this.setPhase('downloading');

                    for (const docName of this.docManager.getLoadedDocs()) {
                        await this.syncDoc(docName, true);
                        this.subscribeToDoc(docName);
                    }

                    if (this.manifest.isDirty()) {
                        await this.manifest.save();
                    }
                } else if (shouldPushLocalChanges) {
                    this.log('connect: first-sync push for local reconnect changes', { mode });

                    for (const docName of this.docManager.getLoadedDocs()) {
                        await this.syncDoc(docName, false);
                        this.subscribeToDoc(docName);
                    }

                    if (this.manifest.isDirty()) {
                        await this.manifest.save();
                    }
                } else {
                    // No remote data — just subscribe to doc updates
                    for (const docName of this.docManager.getLoadedDocs()) {
                        this.subscribeToDoc(docName);
                    }
                }
            } else {
                // Manual mode only establishes the connection and verifies
                // Drive access. Pulling and pushing stay explicit so manual
                // mode remains fully user-controlled even after reloads or
                // reconnects.
                this.setState('syncing');
                this.setPhase('checking');

                await this.manifest.load();

                this.promotePersistedLocalChangesToFullState(this.docManager.getLoadedDocs());

                const remoteManifest = this.manifest.getManifest();
                const hasRemoteData = remoteManifest && Object.keys(remoteManifest.documents).length > 0;
                const shouldBootstrapPull = bootstrapPullIfPristine && hasRemoteData && !this.hasLocalChangesToPush();

                if (shouldBootstrapPull) {
                    this.log('connect: bootstrap pull for pristine manual-mode device');
                    this.setPhase('downloading');

                    for (const docName of this.docManager.getLoadedDocs()) {
                        if (remoteManifest.documents[docName]) {
                            await this.syncDoc(docName, true);
                        }
                        this.subscribeToDoc(docName);
                    }

                    if (this.manifest.isDirty()) {
                        await this.manifest.save();
                    }
                } else {
                    for (const docName of this.docManager.getLoadedDocs()) {
                        this.subscribeToDoc(docName);
                    }
                }
            }

            this.connected = true;
            this.attachLifecycleListeners();
            this.updateSyncInterval();
            this.setState('idle');
            this.setPhase('idle');
            this.updatePendingState();
            this.log('connect: connected');

        } catch (error) {
            if (!this.isOnline()) {
                this.initializeOfflineConnection('connect error while offline');
                return;
            }

            console.error('[YjsDriveProvider] Connection failed:', error);
            if (!(error instanceof AuthorizationError)) {
                captureDriveIncident({
                    incidentKey: 'drive.connect_failed',
                    message: 'TaskTime could not connect to Google Drive sync',
                    error,
                    context: { mode },
                });
            }
            this.setState('error');
            this.setPhase('error');
            throw error;
        }
    }

    /**
     * Disconnect from Google Drive
     */
    disconnect(): void {
        this.detachLifecycleListeners();

        // Stop listening to doc updates
        for (const [docName, handler] of this.docUpdateHandlers) {
            const doc = this.docManager.getDocSync(docName);
            if (doc) {
                doc.off('update', handler);
            }
        }
        this.docUpdateHandlers.clear();

        // Stop periodic sync
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Clear debounce timer
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            this.syncDebounceTimer = null;
        }

        this.connected = false;
        this.pendingDeltas.clear();
        this.forceFullStateDocs = new Set(this.docManager.getLoadedDocs());
        this.appliedStateVersions.clear();
        this.appliedDeltaIds.clear();
        this.setState('idle');
        this.setPhase('idle');
        this.updatePendingState();
        // Clear persisted sync state on disconnect
        clearSyncPersistence();
        console.log('[YjsDriveProvider] Disconnected from Google Drive');
    }

    /**
     * Wipe all TaskTime files from Drive appDataFolder
     * This deletes the manifest and all document/delta files.
     */
    async wipeDriveData(): Promise<void> {
        if (!this.connected) {
            throw new Error('Drive not connected');
        }

        if (!this.isOnline()) {
            throw new Error('Cannot wipe Drive while offline');
        }

        this.setState('syncing');
        this.setPhase('uploading');
        this.log('wipe: started');

        for (let attempt = 1; attempt <= WIPE_VERIFY_ATTEMPTS; attempt++) {
            const files = await this.manifest.listAppDataFiles();
            const syncFiles = files.filter((file) => !BackupManager.isBackupFile(file.name));

            if (syncFiles.length === 0) {
                break;
            }

            for (const file of syncFiles) {
                await this.manifest.deleteFileById(file.id);
            }

            if (attempt === WIPE_VERIFY_ATTEMPTS) {
                const remainingFiles = await this.manifest.listAppDataFiles();
                const remainingSyncFiles = remainingFiles.filter((file) => !BackupManager.isBackupFile(file.name));

                if (remainingSyncFiles.length > 0) {
                    throw new Error(`Drive wipe incomplete. ${remainingSyncFiles.length} sync file(s) remain.`);
                }
            }
        }

        // Reset local manifest caches
        this.manifest.reset();

        // Reset local sync tracking
        this.pendingDeltas.clear();
        this.forceFullStateDocs = new Set(this.docManager.getLoadedDocs());
        this.appliedStateVersions.clear();
        this.appliedDeltaIds.clear();
        this.updatePendingState();
        // Clear persisted sync state on wipe
        clearSyncPersistence();

        this.setState('idle');
        this.setPhase('idle');
        this.log('wipe: complete');
    }

    /**
     * Check if connected to Drive
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Update sync mode (manual, backup, or sync)
     */
    setSyncMode(mode: DriveSyncMode): void {
        this.syncMode = mode;
        this.updateSyncInterval();
        this.log('sync mode updated', { mode });
    }

    private updateSyncInterval(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (!this.connected || this.syncMode !== 'sync') {
            return;
        }

        this.syncInterval = setInterval(() => {
            this.sync(false, { allowPull: true }).catch(console.error);
        }, SYNC_INTERVAL_MS);
    }

    /**
     * Get last synced timestamp from manifest (ms since epoch)
     */
    getLastSyncedAt(): number | null {
        const lastSync = this.manifest.getLastSync();
        if (!lastSync) return null;
        const parsed = Date.parse(lastSync);
        return Number.isNaN(parsed) ? null : parsed;
    }

    // =========================================================================
    // Sync Operations
    // =========================================================================

    /**
     * Perform a full sync of all loaded documents
     * @param force - If true, bypasses the isSyncing guard and throttle (for manual Sync Now / visibility change)
     */
    async sync(force: boolean = false, options: { allowPull?: boolean } = {}): Promise<void> {
        // Force sync supersedes any pending debounced sync
        if (force && this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            this.syncDebounceTimer = null;
        }

        if (!this.connected) {
            console.warn('[YjsDriveProvider] Cannot sync: not connected');
            return;
        }

        if (!this.isOnline()) {
            this.log('sync: offline, skipping');
            this.setState('offline');
            this.setPhase('idle');
            return;
        }

        if (!force && this.syncMode === 'manual') {
            this.log('sync: manual mode, skipping');
            return;
        }

        if (this.isSyncing && !force) {
            this.log('sync: already in progress, skipping');
            return;
        }

        // Cross-tab recency check: if another tab completed a sync recently, skip periodic syncs
        if (!force) {
            const { lastSyncCompletedAt } = getSyncPersistenceState();

            if (lastSyncCompletedAt && (Date.now() - lastSyncCompletedAt) < CROSS_TAB_SYNC_RECENCY_MS) {
                const hasPendingLocal = this.hasLocalChangesToPush();

                if (!hasPendingLocal) {
                    this.log('sync: skipped, another tab synced recently', { msSince: Date.now() - lastSyncCompletedAt });
                    return;
                }
            }
        }

        // Acquire cross-tab lock (skip if another tab is syncing, unless force)
        const result = await withSyncLock(() => this.syncInner(force, options), force);

        if (result === undefined && !force) {
            this.log('sync: skipped, another tab holds the sync lock');
        }
    }

    /**
     * Inner sync implementation (runs under the Web Lock)
     */
    private async syncInner(force: boolean, options: { allowPull?: boolean }): Promise<void> {
        // Wait for current sync to finish if forcing
        if (this.isSyncing && force) {
            this.log('sync(force): waiting for current sync to complete...');
            // Simple wait - check every 100ms for up to 5 seconds
            for (let i = 0; i < 50 && this.isSyncing; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.isSyncing) {
                console.warn('[YjsDriveProvider] Timeout waiting for sync, proceeding anyway');
            }
        }

        const allowPull = options.allowPull ?? true;

        this.updatePendingState();

        const hasPendingLocal = this.hasLocalChangesToPush();
        const timeSinceLastPull = Date.now() - this.lastPullAt;

        if (!allowPull && !hasPendingLocal && !force) {
            this.log('sync: no local changes to push (push-only mode)');
            this.setPhase('idle');
            return;
        }

        // Pull throttle: skip manifest reload if no local changes and last pull was recent
        // Unless force=true (manual sync, visibility change, online event)
        const shouldThrottlePull = allowPull && !force && !hasPendingLocal && timeSinceLastPull < PULL_THROTTLE_MS;

        if (shouldThrottlePull) {
            this.log('sync: throttled (no local changes, recent pull)', { timeSinceLastPull });
            this.setPhase('idle');
            return;
        }

        this.isSyncing = true;
        this.setState('syncing');
        // Capture persisted state BEFORE markSyncStarted() overwrites it.
        // markSyncStarted sets syncInterrupted=true for crash detection, but
        // promotePersistedLocalChangesToFullState must only act on stale flags
        // left over from a genuinely interrupted previous sync, not the current one.
        const loadedDocs = this.docManager.getLoadedDocs();
        this.promotePersistedLocalChangesToFullState(loadedDocs);
        markSyncStarted();
        this.log('sync: started', { docs: loadedDocs, force, hasPendingLocal, allowPull });

        try {
            // Check if manifest has changed before doing full reload
            let manifestChanged = false;
            if (allowPull) {
                this.setPhase('checking');
                manifestChanged = await this.manifest.hasManifestChanged();
                
                if (manifestChanged || force) {
                    // Reload manifest from Drive to get latest changes
                    // Use lightweight reload (no file listing) since we already have the file cache
                    this.setPhase('downloading');
                    await this.manifest.reload();
                    this.lastPullAt = Date.now();
                    this.log('sync: manifest reloaded (changed or forced)');
                } else {
                    this.log('sync: manifest unchanged, skipping pull');
                }
            }

            if (!allowPull && !this.manifest.getManifest()) {
                await this.manifest.load();
                this.log('sync: manifest loaded (push-only)');
            }

            if (!allowPull && this.syncMode === 'backup' && hasPendingLocal && this.manifest.canCheckRemoteManifestChanges()) {
                this.setPhase('checking');
                const remoteManifestChanged = await this.manifest.hasManifestChanged();

                if (remoteManifestChanged) {
                    throw new BackupModeRemoteChangedError();
                }
            }

            const shouldPull = allowPull && (manifestChanged || force);

            // Sync each loaded document (pull if manifest changed, always push pending)
            for (const docName of loadedDocs) {
                await this.syncDoc(docName, shouldPull);
            }

            // Only save manifest if it was modified during this sync
            if (this.manifest.isDirty()) {
                await this.manifest.save();
                this.log('sync: manifest saved, lastSync', this.manifest.getLastSync());
            } else {
                this.log('sync: no manifest changes, skipping save');
            }

            this.setState('idle');
            markSyncCompleted(); // Persist successful sync completion

            // Trigger post-sync callback (e.g., backup)
            try {
                this.onSyncCompleteCallback?.();
            } catch (cbErr) {
                console.error('[YjsDriveProvider] onSyncComplete callback error:', cbErr);
            }

        } catch (error) {
            console.error('[YjsDriveProvider] Sync failed:', error);
            markSyncFailed(); // Persist that sync failed (pending changes remain)
            if (!(error instanceof AuthorizationError) && !(error instanceof BackupModeRemoteChangedError)) {
                captureDriveIncident({
                    incidentKey: 'drive.sync_failed',
                    message: 'TaskTime Drive sync failed',
                    error,
                    context: {
                        allowPull,
                        force,
                        mode: this.syncMode,
                    },
                });
            }
            if (error instanceof AuthorizationError) {
                this.setState('error');
                this.setPhase('error');
                throw error; // Auth errors should propagate
            } else {
                // For network errors, stay connected but mark as error temporarily
                this.setState('error');
                this.setPhase('error');
                // Don't throw - pending deltas are preserved and will retry on next interval
                // Throwing here could cause the app to lose track of the sync state
            }
        } finally {
            this.isSyncing = false;
            const hasPending = this.hasPendingDeltas();
            this.log('sync: finished', { pending: hasPending });

            if (this.syncState !== 'error') {
                this.setPhase('idle');
            }

            this.updatePendingState();

            // If changes arrived during sync, run another pass immediately
            if (this.syncState !== 'error' && this.hasPendingDeltas()) {
                const followUpAllowPull = this.syncMode === 'sync';
                this.sync(false, { allowPull: followUpAllowPull }).catch(console.error);
            }
        }
    }

    /**
     * Check if any pending deltas exist
     */
    private hasPendingDeltas(): boolean {
        for (const updates of this.pendingDeltas.values()) {
            if (updates.length > 0) return true;
        }
        return false;
    }

    /**
     * Check if there are local changes that need to be pushed
     * This includes in-memory pending deltas and persisted state from previous sessions
     */
    hasLocalChangesToPush(): boolean {
        if (this.forceFullStateDocs.size > 0) {
            return true;
        }

        if (this.hasPendingDeltas()) {
            return true;
        }

        // Also check persisted state for changes from previous sessions
        return hasPersistedPendingChanges() || wasSyncInterrupted();
    }

    /**
     * Sync a single document
     * @param shouldPull - Whether to pull remote changes (false if manifest unchanged)
     * @param silent - If true, don't update global sync phase (for on-demand doc loads)
     */
    private async syncDoc(docName: DocName, shouldPull: boolean = true, silent: boolean = false): Promise<void> {
        const doc = this.docManager.getDocSync(docName);
        if (!doc) return;

        // Ensure doc has a manifest entry
        const docManifest = this.manifest.ensureDocManifest(docName);
        this.log('syncDoc: start', { docName, stateVersion: docManifest.stateVersion, deltas: docManifest.deltas.length, shouldPull, silent });

        // 1. Pull remote state and deltas (only if manifest changed)
        if (shouldPull) {
            if (!silent) this.setPhase('downloading');
            await this.pullDoc(docName, doc);
        }

        // 2. Push local changes
        const pendingCount = this.pendingDeltas.get(docName)?.length ?? 0;
        const needsInitialState = docManifest.stateVersion === 0;
        const shouldUpload = this.forceFullStateDocs.has(docName) || pendingCount > 0 || needsInitialState;

        if (shouldUpload) {
            if (!silent) this.setPhase('uploading');
        }

        if (this.forceFullStateDocs.has(docName)) {
            // Push full state after reconnect to capture offline changes
            // Note: pushFullState handles its own error recovery and will re-add to forceFullStateDocs on failure
            const uploadedBatch = [...(this.pendingDeltas.get(docName) ?? [])];
            this.forceFullStateDocs.delete(docName); // Remove before push
            await this.pushFullState(docName, doc, true);
            // If pushFullState failed, it re-added to forceFullStateDocs, so don't clear pending
            if (!this.forceFullStateDocs.has(docName)) {
                // Success - clear only the updates already included in the uploaded full state.
                this.clearUploadedPendingPrefix(docName, uploadedBatch);
            }
        } else {
            await this.pushDeltas(docName, doc);
        }

        // 3. Compact if needed
        if (docManifest.deltas.length >= COMPACTION_THRESHOLD) {
            await this.compactDoc(docName, doc);
        }

        this.log('syncDoc: done', { docName, pending: this.pendingDeltas.get(docName)?.length ?? 0, appliedVersion: this.appliedStateVersions.get(docName) });
    }

    // =========================================================================
    // Pull (Download from Drive)
    // =========================================================================

    /**
     * Pull remote state and deltas for a document
     * Only applies state/deltas that haven't been applied yet
     */
    private async pullDoc(docName: DocName, doc: Y.Doc): Promise<void> {
        const docManifest = this.manifest.getDocManifest(docName);
        if (!docManifest) return;

        const appliedVersion = this.appliedStateVersions.get(docName) ?? 0;
        const appliedDeltas = this.appliedDeltaIds.get(docName) ?? new Set<string>();

        // Pull base state only if version changed
        if (docManifest.stateVersion > appliedVersion) {
            let stateFileId = await this.manifest.getFileIdWithFallback(docManifest.stateFile);
            if (!stateFileId) {
                await this.manifest.refreshFileCache();
                stateFileId = await this.manifest.getFileIdWithFallback(docManifest.stateFile);
            }

            if (stateFileId) {
                try {
                    const stateBuffer = await this.downloadFileWithRecovery(docManifest.stateFile, stateFileId);
                    if (!stateBuffer) {
                        console.warn(`[YjsDriveProvider] State file not found for ${docName}: ${docManifest.stateFile}`);
                    } else {
                        const stateArray = new Uint8Array(stateBuffer);
                        let applied = true;

                        if (stateArray.length > 0) {
                            applied = this.applyValidatedRemoteUpdate(docName, doc, stateArray, `base state v${docManifest.stateVersion}`);

                            if (applied) {
                                this.log(`pull: applied base state v${docManifest.stateVersion} for ${docName}`, { bytes: stateArray.length });
                            }
                        }

                        if (applied) {
                            // Mark as applied and clear old deltas (they're included in the new state)
                            this.appliedStateVersions.set(docName, docManifest.stateVersion);
                            appliedDeltas.clear();
                            this.appliedDeltaIds.set(docName, appliedDeltas);
                        }
                    }
                } catch (error) {
                    console.warn(`[YjsDriveProvider] Could not pull base state for ${docName}:`, error);
                }
            } else {
                console.warn(`[YjsDriveProvider] State file not found for ${docName}: ${docManifest.stateFile}`);
            }
        }

        // Pull only new deltas (not already applied)
        // Track orphaned deltas that need to be pruned from manifest
        const orphanedDeltaIds: string[] = [];

        for (const delta of docManifest.deltas) {
            if (appliedDeltas.has(delta.id)) {
                continue; // Already applied
            }

            const deltaFileName = `tasktime-yjs-${docName}-delta-${delta.id}.bin`;
            let deltaFileId = await this.manifest.getFileIdWithFallback(deltaFileName);

            if (!deltaFileId) {
                await this.manifest.refreshFileCache();
                deltaFileId = await this.manifest.getFileIdWithFallback(deltaFileName);
            }

            if (deltaFileId) {
                try {
                    const deltaBuffer = await this.downloadFileWithRecovery(deltaFileName, deltaFileId);
                    if (!deltaBuffer) {
                        console.warn(`[YjsDriveProvider] Delta file orphaned after recovery, pruning: ${deltaFileName}`);
                        orphanedDeltaIds.push(delta.id);
                        continue;
                    }

                    const deltaArray = new Uint8Array(deltaBuffer);

                    if (deltaArray.length > 0) {
                        const applied = this.applyValidatedRemoteUpdate(docName, doc, deltaArray, `delta ${delta.id}`);

                        if (!applied) {
                            continue;
                        }

                        this.log(`pull: applied delta ${delta.id} for ${docName}`);
                    }

                    // Mark as applied
                    appliedDeltas.add(delta.id);
                    this.appliedDeltaIds.set(docName, appliedDeltas);
                } catch (error) {
                    console.warn(`[YjsDriveProvider] Could not pull delta ${delta.id}:`, error);
                }
            } else {
                // Delta file referenced in manifest but not found on Drive - it's orphaned
                // Mark for pruning from manifest (file was deleted but manifest wasn't updated)
                console.warn(`[YjsDriveProvider] Delta file orphaned (not in Drive), pruning: ${deltaFileName}`);
                orphanedDeltaIds.push(delta.id);
            }
        }

        // Prune orphaned deltas from manifest
        if (orphanedDeltaIds.length > 0) {
            for (const deltaId of orphanedDeltaIds) {
                this.manifest.removeDelta(docName, deltaId);
            }
            // Manifest is now dirty and will be saved by the parent sync() call
            this.log(`pull: pruned ${orphanedDeltaIds.length} orphaned deltas for ${docName}`);
        }
    }

    // =========================================================================
    // Push (Upload to Drive)
    // =========================================================================

    /**
     * Push pending local deltas for a document
     */
    private async pushDeltas(docName: DocName, doc: Y.Doc): Promise<void> {
        const pending = this.pendingDeltas.get(docName);
        if (!pending || pending.length === 0) {
            // No pending deltas - but we might need to push initial state
            const docManifest = this.manifest.getDocManifest(docName);
            if (!docManifest || docManifest.stateVersion === 0) {
                // First time syncing this doc - push full state
                await this.pushFullState(docName, doc);
            }
            return;
        }

        const uploadedBatch = [...pending];

        // Merge all pending deltas into one
        const mergedDelta = mergeUpdates(uploadedBatch);

        // Upload as delta file
        const deltaId = crypto.randomUUID().slice(0, 8);
        const deltaFileName = `tasktime-yjs-${docName}-delta-${deltaId}.bin`;

        const blob = new Blob([mergedDelta.buffer as ArrayBuffer], { type: 'application/octet-stream' });

        try {
            const fileId = await this.manifest.createFile(deltaFileName, blob);
            this.manifest.setFileId(deltaFileName, fileId);

            // Update manifest
            this.manifest.addDelta(docName, deltaId);

            // CRITICAL: Save manifest immediately after adding delta
            // This ensures the delta is recorded even if subsequent operations fail
            await this.manifest.save();

            // Only clear the exact batch we uploaded after the manifest is persisted.
            // New updates can arrive while the upload is in flight and must stay queued.
            this.clearUploadedPendingPrefix(docName, uploadedBatch);

            this.updatePendingState();

            this.log(`push: delta ${deltaId} for ${docName}`, { bytes: mergedDelta.length });
        } catch (error) {
            // Preserve pending deltas so they retry on next sync
            console.error(`[DriveSync] Failed to push delta for ${docName}, will retry on next sync`, error);
            captureDriveIncident({
                incidentKey: 'drive.delta_upload_failed',
                message: 'TaskTime could not upload a Drive delta update',
                error,
                context: {
                    docName,
                    queuedUpdates: uploadedBatch.length,
                },
            });
            // Don't rethrow - let sync continue with other docs and retry later
        }
    }

    /**
     * Push full state for initial sync
     */
    private async pushFullState(docName: DocName, doc: Y.Doc, clearDeltas: boolean = false): Promise<void> {
        const fullState = encodeStateAsUpdate(doc);
        if (fullState.length === 0) return; // Empty doc

        const docManifest = this.manifest.ensureDocManifest(docName);
        const stateFileName = docManifest.stateFile;

        const blob = new Blob([fullState.buffer as ArrayBuffer], { type: 'application/octet-stream' });

        try {
            await this.uploadFileWithRecovery(stateFileName, blob);

            const nextStateVersion = docManifest.stateVersion + 1;
            const deltaFileNamesToDelete = clearDeltas
                ? docManifest.deltas.map((delta) => `tasktime-yjs-${docName}-delta-${delta.id}.bin`)
                : [];

            if (clearDeltas && docManifest.deltas.length > 0) {
                this.manifest.updateDocManifest(docName, {
                    stateVersion: nextStateVersion,
                    lastCompaction: new Date().toISOString(),
                    deltas: [],
                });
            } else {
                // Update manifest
                this.manifest.updateDocManifest(docName, {
                    stateVersion: nextStateVersion,
                    lastCompaction: new Date().toISOString(),
                });
            }

            // CRITICAL: Always save manifest after state upload succeeds
            await this.manifest.save();

            for (const deltaFileName of deltaFileNamesToDelete) {
                try {
                    await this.manifest.deleteFileByName(deltaFileName);
                } catch (deleteError) {
                    console.warn(`[YjsDriveProvider] Could not delete compacted delta ${deltaFileName}:`, deleteError);
                }
            }

            this.appliedStateVersions.set(docName, nextStateVersion);
            this.appliedDeltaIds.set(docName, new Set());
            this.log(`push: full state for ${docName}`, { bytes: fullState.length, version: nextStateVersion });

            this.updatePendingState();
        } catch (error) {
            // Keep doc in forceFullStateDocs so it retries on next sync
            this.forceFullStateDocs.add(docName);
            console.error(`[DriveSync] Failed to push full state for ${docName}, will retry`, error);
            captureDriveIncident({
                incidentKey: 'drive.full_state_upload_failed',
                message: 'TaskTime could not upload a full Drive document state',
                error,
                context: {
                    clearDeltas,
                    docName,
                    bytes: fullState.length,
                },
            });
            // Don't rethrow - let sync continue with other docs
        }
    }

    // =========================================================================
    // Compaction
    // =========================================================================

    /**
     * Compact deltas into base state
     */
    private async compactDoc(docName: DocName, doc: Y.Doc): Promise<void> {
        console.log(`[YjsDriveProvider] Compacting ${docName}...`);

        const docManifest = this.manifest.getDocManifest(docName);
        if (!docManifest) return;

        const deltasToRemove = docManifest.deltas.length;
        const deltaFileNamesToDelete = docManifest.deltas.map((delta) => `tasktime-yjs-${docName}-delta-${delta.id}.bin`);

        // Get full current state
        const fullState = encodeStateAsUpdate(doc);

        // Upload new base state
        const stateFileName = docManifest.stateFile;
        const blob = new Blob([fullState.buffer as ArrayBuffer], { type: 'application/octet-stream' });

        await this.uploadFileWithRecovery(stateFileName, blob);

        // Save the manifest before deleting old files so remote readers never see references to deleted deltas.
        this.manifest.clearDeltas(docName);
        await this.manifest.save();

        for (const deltaFileName of deltaFileNamesToDelete) {
            try {
                await this.manifest.deleteFileByName(deltaFileName);
            } catch (deleteError) {
                console.warn(`[YjsDriveProvider] Could not delete compacted delta ${deltaFileName}:`, deleteError);
            }
        }

        // Update local tracking - new state version, clear applied deltas
        const newVersion = this.manifest.getDocManifest(docName)?.stateVersion ?? ((this.appliedStateVersions.get(docName) ?? 0) + 1);
        this.appliedStateVersions.set(docName, newVersion);
        this.appliedDeltaIds.set(docName, new Set());
        this.log(`compact: ${docName}`, { bytes: fullState.length, deltasRemoved: deltasToRemove, version: newVersion });
    }

    // =========================================================================
    // Document Subscriptions
    // =========================================================================

    /**
     * Subscribe to document updates for automatic sync
     */
    subscribeToDoc(docName: DocName): void {
        const doc = this.docManager.getDocSync(docName);
        if (!doc || this.docUpdateHandlers.has(docName)) return;

        const handler: DocUpdateHandler = (...args) => {
            const [update, origin] = args;

            if (!(update instanceof Uint8Array)) {
                return;
            }

            if (origin === 'remote') return; // Don't re-sync remote updates

            // Queue delta for upload
            if (!this.pendingDeltas.has(docName)) {
                this.pendingDeltas.set(docName, []);
            }
            this.pendingDeltas.get(docName)!.push(update);

            this.log('doc update queued', { docName, pending: this.pendingDeltas.get(docName)?.length });

            // Persist that we have pending changes (survives page refresh)
            markPendingChanges();

            this.updatePendingState();

            if (origin === PROJECT_NOTES_LOCAL_SAVE_ORIGIN) {
                this.log('scheduleSync: deferred for local-only project notes update', { docName });
                return;
            }

            // Debounce sync
            this.scheduleSync();
        };

        doc.on('update', handler);
        this.docUpdateHandlers.set(docName, handler);
        this.log(`subscribe: ${docName}`);
    }

    /**
     * Unsubscribe from a document
     */
    unsubscribeFromDoc(docName: DocName): void {
        const handler = this.docUpdateHandlers.get(docName);
        if (!handler) return;

        const doc = this.docManager.getDocSync(docName);
        if (doc) {
            doc.off('update', handler);
        }
        this.docUpdateHandlers.delete(docName);
    }

    /**
     * Schedule a debounced sync
     */
    private scheduleSync(): void {
        if (this.syncMode === 'manual') {
            this.log('scheduleSync: manual mode, skipping');
            return;
        }

        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        const allowPull = this.syncMode === 'sync';

        this.syncDebounceTimer = setTimeout(() => {
            this.syncDebounceTimer = null;
            this.sync(false, { allowPull }).catch(console.error);
        }, SYNC_DEBOUNCE_MS);

        this.log('scheduleSync: debounced', { allowPull });
    }

    // =========================================================================
    // State Management
    // =========================================================================

    /**
     * Get current sync state
     */
    getState(): SyncState {
        return this.syncState;
    }

    /**
     * Get current sync phase
     */
    getPhase(): SyncPhase {
        return this.syncPhase;
    }

    /**
     * Set sync state and notify listeners
     */
    private setState(state: SyncState): void {
        this.syncState = state;
        if (state === 'error') {
            this.setPhase('error');
        }
        for (const callback of this.stateListeners) {
            callback(state);
        }
    }

    /**
     * Set sync phase and notify listeners
     */
    private setPhase(phase: SyncPhase): void {
        this.syncPhase = phase;
        for (const callback of this.phaseListeners) {
            callback(phase);
        }
    }

    /**
     * Subscribe to sync state changes
     */
    onStateChange(callback: (state: SyncState) => void): () => void {
        this.stateListeners.add(callback);
        return () => this.stateListeners.delete(callback);
    }

    /**
     * Subscribe to sync phase changes
     */
    onPhaseChange(callback: (phase: SyncPhase) => void): () => void {
        this.phaseListeners.add(callback);
        return () => this.phaseListeners.delete(callback);
    }

    /**
     * Subscribe to pending change updates
     */
    onPendingChange(callback: (hasPending: boolean) => void): () => void {
        this.pendingChangeListeners.add(callback);
        return () => this.pendingChangeListeners.delete(callback);
    }

    /**
     * Update access token (for token refresh)
     */
    updateAccessToken(token: string): void {
        this.accessToken = token;
        this.manifest.updateAccessToken(token);
        this.log('token updated');
    }

    /**
     * Update session ID (for Worker mode)
     */
    updateSessionId(sessionId: string | null): void {
        this.sessionId = sessionId;
        this.manifest.updateSessionId(sessionId);
        this.log('session updated');
    }

    // =========================================================================
    // On-demand Document Sync
    // =========================================================================

    /**
     * Subscribe a newly loaded document to sync
     * Call this when loading an on-demand document (archived tasks, year entries)
     */
    async syncAndSubscribeDoc(docName: DocName, options: { allowPull?: boolean } = {}): Promise<void> {
        if (!this.connected) return;

        if (this.syncMode === 'manual' && options.allowPull !== true) {
            this.subscribeToDoc(docName);
            return;
        }

        if (!this.manifest.getManifest()) {
            if (!this.isOnline()) {
                this.subscribeToDoc(docName);
                return;
            }

            await this.manifest.load();
            this.log('syncAndSubscribeDoc: manifest loaded');
        }

        // Sync the document silently (don't show global "Fetching updates" for on-demand loads)
        const shouldPull = options.allowPull ?? (this.syncMode === 'sync');
        await this.syncDoc(docName, shouldPull, true);

        // Subscribe to future updates
        this.subscribeToDoc(docName);

        // Save manifest only if it was modified
        if (this.manifest.isDirty()) {
            await this.manifest.save();
        }
    }

    /**
     * Get available entry years from manifest
     */
    getEntryYears(): number[] {
        return this.manifest.getEntryYears();
    }
}
