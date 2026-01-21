/**
 * YjsDriveProvider - Google Drive sync provider for Yjs documents
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
import { ManifestManager, AuthorizationError } from './ManifestManager';
import type { DocName, SyncState } from '../types';

export { AuthorizationError };

const COMPACTION_THRESHOLD = 10; // Compact after 10 deltas
const SYNC_INTERVAL_MS = 15_000; // 15 seconds
const SYNC_DEBOUNCE_MS = 100; // Small debounce to batch rapid changes

export class YjsDriveProvider {

    private docManager: YjsDocManager;
    private manifest: ManifestManager;
    private accessToken: string;
    private sessionId: string | null;

    private connected: boolean = false;
    private syncState: SyncState = 'idle';
    private stateListeners: Set<(state: SyncState) => void> = new Set();

    private pendingDeltas: Map<DocName, Uint8Array[]> = new Map();
    private docUpdateHandlers: Map<DocName, (update: Uint8Array, origin: unknown) => void> = new Map();
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isSyncing: boolean = false;
    private forceFullStateDocs: Set<DocName> = new Set();

    // Track which state versions and deltas we've already applied locally
    private appliedStateVersions: Map<DocName, number> = new Map();
    private appliedDeltaIds: Map<DocName, Set<string>> = new Map();

    constructor(docManager: YjsDocManager, accessToken: string, sessionId?: string | null) {
        this.docManager = docManager;
        this.accessToken = accessToken;
        this.sessionId = sessionId ?? null;
        this.manifest = new ManifestManager(accessToken, sessionId);
    }

    // =========================================================================
    // Connection Management
    // =========================================================================

    /**
     * Connect to Google Drive and start syncing
     */
    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            this.setState('syncing');

            // Load manifest from Drive
            await this.manifest.load();

            // Force a full state push for all loaded docs after reconnect
            this.forceFullStateDocs = new Set(this.docManager.getLoadedDocs());

            // Sync all currently loaded documents
            for (const docName of this.docManager.getLoadedDocs()) {
                await this.syncDoc(docName);
                this.subscribeToDoc(docName);
            }

            // Start periodic sync
            this.syncInterval = setInterval(() => {
                this.sync().catch(console.error);
            }, SYNC_INTERVAL_MS);

            this.connected = true;
            this.setState('idle');
            console.log('[YjsDriveProvider] Connected to Google Drive');

        } catch (error) {
            console.error('[YjsDriveProvider] Connection failed:', error);
            this.setState('error');
            throw error;
        }
    }

    /**
     * Disconnect from Google Drive
     */
    disconnect(): void {
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
        console.log('[YjsDriveProvider] Disconnected from Google Drive');
    }

    /**
     * Check if connected to Drive
     */
    isConnected(): boolean {
        return this.connected;
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
     * @param force - If true, bypasses the isSyncing guard (for manual Sync Now)
     */
    async sync(force: boolean = false): Promise<void> {
        if (!this.connected) {
            console.warn('[YjsDriveProvider] Cannot sync: not connected');
            return;
        }

        if (this.isSyncing && !force) {
            console.log('[YjsDriveProvider] Sync already in progress, skipping');
            return;
        }

        // Wait for current sync to finish if forcing
        if (this.isSyncing && force) {
            console.log('[YjsDriveProvider] Waiting for current sync to complete...');
            // Simple wait - check every 100ms for up to 5 seconds
            for (let i = 0; i < 50 && this.isSyncing; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.isSyncing) {
                console.warn('[YjsDriveProvider] Timeout waiting for sync, proceeding anyway');
            }
        }

        this.isSyncing = true;
        this.setState('syncing');

        try {
            // Reload manifest from Drive to get latest changes from other devices
            await this.manifest.load();

            // Sync each loaded document
            for (const docName of this.docManager.getLoadedDocs()) {
                await this.syncDoc(docName);
            }

            // Save updated manifest
            await this.manifest.save();

            this.setState('idle');

        } catch (error) {
            console.error('[YjsDriveProvider] Sync failed:', error);
            if (error instanceof AuthorizationError) {
                this.setState('error');
            } else {
                // For network errors, stay connected but mark as error temporarily
                this.setState('error');
                // Retry in next interval
            }
            throw error;
        } finally {
            this.isSyncing = false;

            // If changes arrived during sync, run another pass immediately
            if (this.hasPendingDeltas()) {
                this.sync().catch(console.error);
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
     * Sync a single document
     */
    private async syncDoc(docName: DocName): Promise<void> {
        const doc = this.docManager.getDocSync(docName);
        if (!doc) return;

        // Ensure doc has a manifest entry
        const docManifest = this.manifest.ensureDocManifest(docName);

        // 1. Pull remote state and deltas
        await this.pullDoc(docName, doc);

        // 2. Push local changes
        if (this.forceFullStateDocs.has(docName)) {
            // Push full state after reconnect to capture offline changes
            await this.pushFullState(docName, doc, true);
            this.forceFullStateDocs.delete(docName);
            this.pendingDeltas.set(docName, []);
        } else {
            await this.pushDeltas(docName, doc);
        }

        // 3. Compact if needed
        if (docManifest.deltas.length >= COMPACTION_THRESHOLD) {
            await this.compactDoc(docName, doc);
        }
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
            const stateFileId = this.manifest.getFileId(docManifest.stateFile);
            if (stateFileId) {
                try {
                    const stateBuffer = await this.manifest.downloadFileAsArrayBuffer(stateFileId);
                    const stateArray = new Uint8Array(stateBuffer);

                    if (stateArray.length > 0) {
                        applyUpdate(doc, stateArray, 'remote');
                        console.log(`[YjsDriveProvider] Applied base state v${docManifest.stateVersion} for ${docName} (${stateArray.length} bytes)`);
                    }

                    // Mark as applied and clear old deltas (they're included in the new state)
                    this.appliedStateVersions.set(docName, docManifest.stateVersion);
                    appliedDeltas.clear();
                    this.appliedDeltaIds.set(docName, appliedDeltas);
                } catch (error) {
                    console.warn(`[YjsDriveProvider] Could not pull base state for ${docName}:`, error);
                }
            }
        }

        // Pull only new deltas (not already applied)
        for (const delta of docManifest.deltas) {
            if (appliedDeltas.has(delta.id)) {
                continue; // Already applied
            }

            const deltaFileName = `tasktime-yjs-${docName}-delta-${delta.id}.bin`;
            const deltaFileId = this.manifest.getFileId(deltaFileName);

            if (deltaFileId) {
                try {
                    const deltaBuffer = await this.manifest.downloadFileAsArrayBuffer(deltaFileId);
                    const deltaArray = new Uint8Array(deltaBuffer);

                    if (deltaArray.length > 0) {
                        applyUpdate(doc, deltaArray, 'remote');
                        console.log(`[YjsDriveProvider] Applied delta ${delta.id} for ${docName}`);
                    }

                    // Mark as applied
                    appliedDeltas.add(delta.id);
                    this.appliedDeltaIds.set(docName, appliedDeltas);
                } catch (error) {
                    console.warn(`[YjsDriveProvider] Could not pull delta ${delta.id}:`, error);
                }
            }
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

        // Merge all pending deltas into one
        const mergedDelta = mergeUpdates(pending);
        this.pendingDeltas.set(docName, []);

        // Upload as delta file
        const deltaId = crypto.randomUUID().slice(0, 8);
        const deltaFileName = `tasktime-yjs-${docName}-delta-${deltaId}.bin`;

        const blob = new Blob([mergedDelta.buffer as ArrayBuffer], { type: 'application/octet-stream' });
        const fileId = await this.manifest.createFile(deltaFileName, blob);
        this.manifest.setFileId(deltaFileName, fileId);

        // Update manifest
        this.manifest.addDelta(docName, deltaId);

        console.log(`[YjsDriveProvider] Pushed delta ${deltaId} for ${docName} (${mergedDelta.length} bytes)`);
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

        // Check if file already exists
        const existingFileId = this.manifest.getFileId(stateFileName);
        if (existingFileId) {
            await this.manifest.updateFile(existingFileId, stateFileName, blob);
        } else {
            const fileId = await this.manifest.createFile(stateFileName, blob);
            this.manifest.setFileId(stateFileName, fileId);
        }

        const nextStateVersion = docManifest.stateVersion + 1;

        if (clearDeltas && docManifest.deltas.length > 0) {
            for (const delta of docManifest.deltas) {
                const deltaFileName = `tasktime-yjs-${docName}-delta-${delta.id}.bin`;
                await this.manifest.deleteFileByName(deltaFileName);
            }

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

        this.appliedStateVersions.set(docName, nextStateVersion);
        this.appliedDeltaIds.set(docName, new Set());

        console.log(`[YjsDriveProvider] Pushed full state for ${docName} (${fullState.length} bytes)`);
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

        // Get full current state
        const fullState = encodeStateAsUpdate(doc);

        // Upload new base state
        const stateFileName = docManifest.stateFile;
        const existingFileId = this.manifest.getFileId(stateFileName);

        const blob = new Blob([fullState.buffer as ArrayBuffer], { type: 'application/octet-stream' });

        if (existingFileId) {
            await this.manifest.updateFile(existingFileId, stateFileName, blob);
        } else {
            const fileId = await this.manifest.createFile(stateFileName, blob);
            this.manifest.setFileId(stateFileName, fileId);
        }

        // Delete old delta files
        for (const delta of docManifest.deltas) {
            const deltaFileName = `tasktime-yjs-${docName}-delta-${delta.id}.bin`;
            await this.manifest.deleteFileByName(deltaFileName);
        }

        // Update manifest
        this.manifest.clearDeltas(docName);

        // Update local tracking - new state version, clear applied deltas
        const newVersion = (this.appliedStateVersions.get(docName) ?? 0) + 1;
        this.appliedStateVersions.set(docName, newVersion);
        this.appliedDeltaIds.set(docName, new Set());

        console.log(`[YjsDriveProvider] Compacted ${docName} (${fullState.length} bytes, ${deltasToRemove} deltas removed)`);
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

        const handler = (update: Uint8Array, origin: unknown) => {
            if (origin === 'remote') return; // Don't re-sync remote updates

            // Queue delta for upload
            if (!this.pendingDeltas.has(docName)) {
                this.pendingDeltas.set(docName, []);
            }
            this.pendingDeltas.get(docName)!.push(update);

            // Debounce sync
            this.scheduleSync();
        };

        doc.on('update', handler);
        this.docUpdateHandlers.set(docName, handler);
        console.log(`[YjsDriveProvider] Subscribed to updates for ${docName}`);
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
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        this.syncDebounceTimer = setTimeout(() => {
            this.sync().catch(console.error);
        }, SYNC_DEBOUNCE_MS);
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
     * Set sync state and notify listeners
     */
    private setState(state: SyncState): void {
        this.syncState = state;
        for (const callback of this.stateListeners) {
            callback(state);
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
     * Update access token (for token refresh)
     */
    updateAccessToken(token: string): void {
        this.accessToken = token;
        this.manifest.updateAccessToken(token);
    }

    /**
     * Update session ID (for Worker mode)
     */
    updateSessionId(sessionId: string | null): void {
        this.sessionId = sessionId;
        this.manifest.updateSessionId(sessionId);
    }

    // =========================================================================
    // On-demand Document Sync
    // =========================================================================

    /**
     * Subscribe a newly loaded document to sync
     * Call this when loading an on-demand document (archived tasks, year entries)
     */
    async syncAndSubscribeDoc(docName: DocName): Promise<void> {
        if (!this.connected) return;

        // Sync the document
        await this.syncDoc(docName);

        // Subscribe to future updates
        this.subscribeToDoc(docName);

        // Save manifest with any new entries
        await this.manifest.save();
    }

    /**
     * Get available entry years from manifest
     */
    getEntryYears(): number[] {
        return this.manifest.getEntryYears();
    }
}
