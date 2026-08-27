/**
 * ManifestManager - Manages the manifest file for Yjs sync
 *
 * Sync contract source of truth: ../../../components/sync/README.md
 * 
 * The manifest tracks:
 * - All document files and their versions
 * - Delta files waiting to be merged
 * - Device identity for conflict detection
 * - Last sync timestamp
 * 
 * Shared behavior uses a CloudFileStore. The ManifestManager compatibility
 * facade still accepts the legacy Google direct/proxy constructor shapes.
 */

import type {
    CloudFileStore,
    CloudNamespace,
    CloudObjectMetadata,
    CloudProviderId,
} from './CloudFileStore';
import { CloudFileStoreError } from './CloudFileStore';
import {
    GoogleDriveFileStore,
    type DriveTokenProvider,
    type DriveTransport,
    type GoogleDriveFileStoreOptions,
} from './GoogleDriveFileStore';
import {
    AuthorizationError,
    DriveConnectivityError,
    DriveFileNotFoundError,
    DriveRateLimitError,
    DriveStorageQuotaError,
    DriveTransportDisabledError,
} from './GoogleDriveErrors';

export {
    AuthorizationError,
    DriveConnectivityError,
    DriveFileNotFoundError,
    DriveRateLimitError,
    DriveStorageQuotaError,
    DriveTransportDisabledError,
} from './GoogleDriveErrors';
export type { DriveTokenProvider, DriveTransport } from './GoogleDriveFileStore';

const MANIFEST_FILE_NAME = 'tasktime-yjs-manifest.json';
export const CLOUD_BINDING_FILE_NAME = 'tasktime-cloud-binding.json';
const SYNC_FILE_PREFIX = 'tasktime-yjs-';
const SYNC_FILE_SUFFIX = '.bin';
const DELTA_FILE_MARKER = '-delta-';

export interface AppDataFile {
    id: string;
    name: string;
    modifiedTime: string;
    revision?: string;
    contentHash?: string;
    size?: number;
}

export interface DeltaInfo {
    id: string;
    timestamp: string;
}

export interface DocManifest {
    stateFile: string;
    stateVersion: number;
    lastCompaction: string;
    deltas: DeltaInfo[];
    stateModifiedTime?: string;
    compactedDeltaIds?: string[];
}

export interface Manifest {
    version: number;
    deviceId: string;
    lastSync: string;
    documents: Record<string, DocManifest>;
    revision?: number;
    lastWriterId?: string;
    writeId?: string;
}

export interface CloudBindingMarkerV1 {
    version: 1;
    workspaceId: string;
    generation: number;
    activeProvider: CloudProviderId;
    state: 'active' | 'transfer-prepared' | 'moved';
    operationId?: string;
    updatedAt: string;
}

export interface CloudManifestFingerprint {
    revision?: string;
    modifiedTime: string;
    contentHash?: string;
    size?: number;
}

export interface CloudManifestManagerOptions {
    fileStore: CloudFileStore;
}

export type ManifestManagerOptions = GoogleDriveFileStoreOptions | CloudManifestManagerOptions;

const MAX_COMPACTED_DELTA_TOMBSTONES = 512;

function isKnownSyncDocName(docName: string): boolean {
    return docName === 'core'
        || docName === 'entries-active'
        || docName === 'tasks-archived'
        || docName === 'invoices-archived'
        || docName === 'expenses-archived'
        || /^entries-\d+$/.test(docName);
}

function parseSyncFileName(fileName: string): { docName: string; deltaId?: string } | null {
    if (!fileName.startsWith(SYNC_FILE_PREFIX) || !fileName.endsWith(SYNC_FILE_SUFFIX)) {
        return null;
    }

    const stem = fileName.slice(SYNC_FILE_PREFIX.length, -SYNC_FILE_SUFFIX.length);
    const deltaMarkerIndex = stem.lastIndexOf(DELTA_FILE_MARKER);

    if (deltaMarkerIndex > 0) {
        const docName = stem.slice(0, deltaMarkerIndex);
        const deltaId = stem.slice(deltaMarkerIndex + DELTA_FILE_MARKER.length);

        if (deltaId && isKnownSyncDocName(docName)) {
            return { docName, deltaId };
        }

        return null;
    }

    if (isKnownSyncDocName(stem)) {
        return { docName: stem };
    }

    return null;
}

/**
 * Merge a locally changed manifest with the latest remote snapshot while
 * treating the provider file list as authoritative evidence for uploaded deltas.
 * Compaction tombstones prevent a concurrent stale writer from resurrecting
 * delta references that are about to be deleted.
 */
export function mergeConcurrentManifests(
    remoteManifest: Manifest,
    localManifest: Manifest,
    files: AppDataFile[],
    writerId: string,
    writeId: string
): Manifest {
    const merged: Manifest = {
        version: Math.max(remoteManifest.version || 1, localManifest.version || 1),
        deviceId: remoteManifest.deviceId || localManifest.deviceId,
        lastSync: localManifest.lastSync,
        revision: Math.max(remoteManifest.revision || 0, localManifest.revision || 0) + 1,
        lastWriterId: writerId,
        writeId,
        documents: {},
    };
    const filesByName = new Map(files.map((file) => [file.name, file]));
    const deltaFilesByDoc = new Map<string, AppDataFile[]>();

    files.forEach((file) => {
        const parsed = parseSyncFileName(file.name);
        if (!parsed?.deltaId) return;
        const entries = deltaFilesByDoc.get(parsed.docName) || [];
        entries.push(file);
        deltaFilesByDoc.set(parsed.docName, entries);
    });

    const docNames = new Set([
        ...Object.keys(remoteManifest.documents || {}),
        ...Object.keys(localManifest.documents || {}),
        ...Array.from(deltaFilesByDoc.keys()),
    ]);

    docNames.forEach((docName) => {
        const remoteDoc = remoteManifest.documents?.[docName];
        const localDoc = localManifest.documents?.[docName];
        const fallbackStateFile = `tasktime-yjs-${docName}.bin`;
        const stateFile = localDoc?.stateFile || remoteDoc?.stateFile || fallbackStateFile;
        const stateFileMeta = filesByName.get(stateFile);
        const localVersion = localDoc?.stateVersion || 0;
        const remoteVersion = remoteDoc?.stateVersion || 0;
        let stateVersion = Math.max(localVersion, remoteVersion);
        const knownStateModifiedTime = localVersion >= remoteVersion
            ? localDoc?.stateModifiedTime
            : remoteDoc?.stateModifiedTime;

        if (stateFileMeta && knownStateModifiedTime && knownStateModifiedTime !== stateFileMeta.modifiedTime) {
            stateVersion += 1;
        } else if (stateFileMeta && stateVersion === 0) {
            stateVersion = 1;
        }

        const compactedDeltaIds = uniqueStrings([
            ...(remoteDoc?.compactedDeltaIds || []),
            ...(localDoc?.compactedDeltaIds || []),
        ]).slice(-MAX_COMPACTED_DELTA_TOMBSTONES);
        const compactedSet = new Set(compactedDeltaIds);
        const deltas = new Map<string, DeltaInfo>();
        const addDelta = (delta: DeltaInfo) => {
            if (!delta?.id || compactedSet.has(delta.id)) return;
            const existing = deltas.get(delta.id);
            if (!existing || delta.timestamp < existing.timestamp) {
                deltas.set(delta.id, delta);
            }
        };

        remoteDoc?.deltas?.forEach(addDelta);
        localDoc?.deltas?.forEach(addDelta);
        deltaFilesByDoc.get(docName)?.forEach((file) => {
            const parsed = parseSyncFileName(file.name);
            if (parsed?.deltaId) addDelta({ id: parsed.deltaId, timestamp: file.modifiedTime });
        });

        const preferredDoc = localVersion >= remoteVersion ? localDoc : remoteDoc;
        merged.documents[docName] = {
            stateFile,
            stateVersion,
            lastCompaction: preferredDoc?.lastCompaction
                || remoteDoc?.lastCompaction
                || localDoc?.lastCompaction
                || new Date(0).toISOString(),
            deltas: Array.from(deltas.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)),
            ...(stateFileMeta ? { stateModifiedTime: stateFileMeta.modifiedTime } : {}),
            ...(compactedDeltaIds.length > 0 ? { compactedDeltaIds } : {}),
        };
    });

    return merged;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.length > 0)));
}

function isManifest(value: unknown): value is Manifest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Partial<Manifest>;
    return typeof candidate.version === 'number'
        && typeof candidate.deviceId === 'string'
        && Boolean(candidate.documents && typeof candidate.documents === 'object' && !Array.isArray(candidate.documents));
}

function parseCloudBindingMarker(
    value: unknown,
    provider: CloudProviderId,
): CloudBindingMarkerV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new CloudFileStoreError(
            'invalid-response',
            'Cloud storage returned an invalid TaskTime workspace binding.',
            { provider },
        );
    }
    const marker = value as Record<string, unknown>;
    const allowedKeys = new Set([
        'version',
        'workspaceId',
        'generation',
        'activeProvider',
        'state',
        'operationId',
        'updatedAt',
    ]);
    if (Object.keys(marker).some(key => !allowedKeys.has(key))
        || marker.version !== 1
        || typeof marker.workspaceId !== 'string'
        || !/^[a-f0-9-]{20,80}$/i.test(marker.workspaceId)
        || typeof marker.generation !== 'number'
        || !Number.isSafeInteger(marker.generation)
        || marker.generation < 0
        || (marker.activeProvider !== 'google-drive' && marker.activeProvider !== 'dropbox')
        || !['active', 'transfer-prepared', 'moved'].includes(String(marker.state))
        || (marker.operationId !== undefined
            && (typeof marker.operationId !== 'string'
                || !/^[a-f0-9-]{20,80}$/i.test(marker.operationId)))
        || typeof marker.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(marker.updatedAt))) {
        throw new CloudFileStoreError(
            'invalid-response',
            'Cloud storage returned an invalid TaskTime workspace binding.',
            { provider },
        );
    }
    return marker as unknown as CloudBindingMarkerV1;
}

export function isDriveFileNotFoundError(error: unknown): boolean {
    return isCloudFileNotFoundError(error);
}

/** Provider-neutral missing-object detection used by the shared sync core. */
export function isCloudFileNotFoundError(error: unknown): boolean {
    if (error instanceof CloudFileStoreError) return error.code === 'not-found';
    if (error instanceof DriveFileNotFoundError) return true;
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    return message.includes('404') && lowerMessage.includes('file not found');
}

/**
 * Manages the provider-neutral sync manifest through a CloudFileStore.
 */
export class CloudManifestManager {
    private readonly fileStore: CloudFileStore;
    private readonly googleFileStore: GoogleDriveFileStore | null;
    private readonly providerLabel: string;
    private manifestFileId: string | null = null;
    private manifest: Manifest | null = null;
    private fileIdCache: Map<string, string> = new Map();
    private fileMetadataCache: Map<string, CloudObjectMetadata> = new Map();
    private lastManifestModifiedTime: string | null = null;
    private _dirty: boolean = false;
    private readonly localWriterId = crypto.randomUUID();

    constructor(options: ManifestManagerOptions | string, legacySessionId?: string | null) {
        if (typeof options === 'string') {
            this.googleFileStore = new GoogleDriveFileStore(options, legacySessionId);
            this.fileStore = this.googleFileStore;
            this.providerLabel = 'Drive';
            return;
        }

        if ('fileStore' in options) {
            this.fileStore = options.fileStore;
            this.googleFileStore = options.fileStore instanceof GoogleDriveFileStore
                ? options.fileStore
                : null;
            this.providerLabel = this.getProviderLabel(options.fileStore.provider);
            return;
        }

        this.googleFileStore = new GoogleDriveFileStore(options);
        this.fileStore = this.googleFileStore;
        this.providerLabel = 'Drive';
    }

    /** Durable provider identity for lifecycle and diagnostic consumers. */
    getProviderId(): CloudProviderId {
        return this.fileStore.provider;
    }

    /**
     * Reset cached manifest state after a full provider wipe.
     */
    reset(): void {
        this.manifestFileId = null;
        this.manifest = null;
        this.fileIdCache.clear();
        this.fileMetadataCache.clear();
        this.lastManifestModifiedTime = null;
        this._dirty = false;
        this.googleFileStore?.clearCache();
    }

    /**
     * Load the provider manifest (or create a new in-memory manifest).
     */
    async load(): Promise<Manifest> {
        const files = await this.listSyncFiles();

        // Find manifest
        const manifestFile = files.find(f => f.name === MANIFEST_FILE_NAME);

        if (manifestFile) {
            this.manifestFileId = manifestFile.id;
            this.lastManifestModifiedTime = manifestFile.modifiedTime;
            const content = await this.downloadFileAsJson(manifestFile.id);
            this.manifest = content as Manifest;
            console.log(`[ManifestManager] Loaded manifest from ${this.providerLabel}`);
            console.log('[ManifestManager] State snapshot:', {
                docs: this.manifest?.documents,
                lastSync: this.manifest?.lastSync,
            });
        } else {
            // Create new manifest
            this.manifest = {
                version: 1,
                deviceId: crypto.randomUUID(),
                lastSync: new Date().toISOString(),
                documents: {},
                revision: 0,
            };
            console.log('[ManifestManager] Created new manifest');
        }

        // Build file ID cache for quick lookups
        this.rebuildFileCache(files);

        this.reconcileManifestWithFiles(files);

        return this.manifest;
    }

    /**
     * Save the manifest through the active file store.
     */
    async save(): Promise<void> {
        if (!this.manifest) return;

        this.manifest.lastSync = new Date().toISOString();

        if (this.manifestFileId) {
            const localSnapshot = structuredClone(this.manifest);
            const [remoteContent, files] = await Promise.all([
                this.downloadFileAsJson(this.manifestFileId),
                this.listSyncFiles(),
            ]);
            const remoteManifest = isManifest(remoteContent) ? remoteContent : localSnapshot;

            this.manifest = mergeConcurrentManifests(
                remoteManifest,
                localSnapshot,
                files,
                this.localWriterId,
                crypto.randomUUID()
            );
            this.rebuildFileCache(files);
        } else {
            this.manifest.revision = (this.manifest.revision || 0) + 1;
            this.manifest.lastWriterId = this.localWriterId;
            this.manifest.writeId = crypto.randomUUID();
        }

        console.log('[ManifestManager] Saving manifest snapshot:', {
            docs: this.manifest.documents,
            lastSync: this.manifest.lastSync,
        });

        const blob = new Blob(
            [JSON.stringify(this.manifest, null, 2)],
            { type: 'application/json' }
        );

        if (this.manifestFileId) {
            const modifiedTime = await this.updateFile(this.manifestFileId, MANIFEST_FILE_NAME, blob);
            // Track the provider's actual modified time so checks do not false-positive.
            if (modifiedTime) {
                this.lastManifestModifiedTime = modifiedTime;
            }
        } else {
            this.manifestFileId = await this.createFile(MANIFEST_FILE_NAME, blob);
            this.fileIdCache.set(MANIFEST_FILE_NAME, this.manifestFileId);
        }

        this._dirty = false;

        console.log(`[ManifestManager] Saved manifest to ${this.providerLabel}`);
    }

    /**
     * Whether local manifest has been modified and needs saving
     */
    isDirty(): boolean {
        return this._dirty;
    }

    /**
     * Mark manifest as needing to be saved
     */
    markDirty(): void {
        this._dirty = true;
    }

    /**
     * Clear dirty flag (called after successful save)
     */
    clearDirty(): void {
        this._dirty = false;
    }

    /**
     * Reload manifest content and refresh the appData file cache.
     * Use this when we already have the manifestFileId from a previous load().
     * Falls back to full load() if we don't have the manifest file ID.
     */
    async reload(): Promise<Manifest> {
        if (!this.manifestFileId) {
            // No cached manifest ID, do full load
            return this.load();
        }

        try {
            // Fetch manifest metadata, content, and the file list so orphaned
            // delta files from concurrent manifest writes can be recovered.
            const [metadata, content, files] = await Promise.all([
                this.getManifestMetadata(),
                this.downloadFileAsJson(this.manifestFileId),
                this.listSyncFiles(),
            ]);

            if (!metadata) {
                throw new CloudFileStoreError(
                    'not-found',
                    `${this.providerLabel} manifest was not found.`,
                    { provider: this.fileStore.provider },
                );
            }
            this.lastManifestModifiedTime = metadata.modifiedTime;
            this.manifest = content as Manifest;
            this.rebuildFileCache(files);
            this.reconcileManifestWithFiles(files);

            console.log('[ManifestManager] Reloaded manifest (lightweight)');
            return this.manifest;
        } catch (error) {
            console.warn('[ManifestManager] Lightweight reload failed, falling back to full load:', error);
            return this.load();
        }
    }

    /**
     * Check if the manifest has changed at the provider since last load.
     * Does a lightweight metadata check instead of full download
     * @returns true if changed or unknown, false if definitely unchanged
     */
    async hasManifestChanged(): Promise<boolean> {
        if (!this.manifestFileId || !this.lastManifestModifiedTime) {
            // No cached info, assume changed
            return true;
        }

        try {
            const metadata = await this.getManifestMetadata();
            if (!metadata) return true;
            const { modifiedTime } = metadata;

            if (modifiedTime !== this.lastManifestModifiedTime) {
                console.log(`[ManifestManager] Manifest changed on ${this.providerLabel}`, {
                    cached: this.lastManifestModifiedTime,
                    remote: modifiedTime,
                });
                return true;
            }

            return false;
        } catch (error) {
            // On error, assume changed to be safe
            console.warn('[ManifestManager] Could not check manifest modifiedTime:', error);
            return true;
        }
    }

    /**
     * Get the current manifest (must call load() first)
     */
    getManifest(): Manifest | null {
        return this.manifest;
    }

    /**
     * Whether this instance has loaded a provider manifest with metadata.
     */
    canCheckRemoteManifestChanges(): boolean {
        return Boolean(this.manifestFileId && this.lastManifestModifiedTime);
    }

    /** Exact metadata used to detect source movement during provider transfer. */
    async getRemoteManifestFingerprint(): Promise<CloudManifestFingerprint | null> {
        const metadata = await this.getManifestMetadata();
        if (!metadata) return null;
        return {
            ...(metadata.revision ? { revision: metadata.revision } : {}),
            modifiedTime: metadata.modifiedTime,
            ...(metadata.contentHash ? { contentHash: metadata.contentHash } : {}),
            ...(metadata.size !== undefined ? { size: metadata.size } : {}),
        };
    }

    /** Read the non-sensitive workspace lineage and migration marker. */
    async readCloudBindingMarker(): Promise<CloudBindingMarkerV1 | null> {
        const object = await this.fileStore.getMetadata('sync', CLOUD_BINDING_FILE_NAME);
        if (!object) return null;
        const bytes = await this.fileStore.download(object);
        let value: unknown;
        try {
            value = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
            throw new CloudFileStoreError(
                'invalid-response',
                'Cloud storage returned an invalid TaskTime workspace binding.',
                { provider: this.fileStore.provider },
            );
        }
        this.cacheObject(object);
        return parseCloudBindingMarker(value, this.fileStore.provider);
    }

    /** Read a binding discovered by the normal sync listing without another metadata request. */
    async readCachedCloudBindingMarker(): Promise<CloudBindingMarkerV1 | null> {
        const fileId = this.fileIdCache.get(CLOUD_BINDING_FILE_NAME);
        if (!fileId) return null;
        const value = await this.downloadFileAsJson(fileId);
        return parseCloudBindingMarker(value, this.fileStore.provider);
    }

    /** Create or conditionally replace the fixed workspace binding marker. */
    async writeCloudBindingMarker(marker: CloudBindingMarkerV1): Promise<void> {
        const validated = parseCloudBindingMarker(marker, this.fileStore.provider);
        const blob = new Blob([JSON.stringify(validated)], { type: 'application/json' });
        const current = await this.fileStore.getMetadata('sync', CLOUD_BINDING_FILE_NAME);
        if (current) {
            const replaced = await this.fileStore.replace(current, blob, current.revision);
            this.cacheObject(replaced);
            return;
        }
        try {
            const created = await this.fileStore.create('sync', CLOUD_BINDING_FILE_NAME, blob);
            this.cacheObject(created);
        } catch (error) {
            if (!(error instanceof CloudFileStoreError) || error.code !== 'conflict') throw error;
            const concurrent = await this.readCloudBindingMarker();
            if (JSON.stringify(concurrent) !== JSON.stringify(validated)) throw error;
        }
    }

    /**
     * Get last sync timestamp (ISO string) if manifest is loaded
     */
    getLastSync(): string | null {
        return this.manifest?.lastSync ?? null;
    }

    /**
     * Get manifest for a specific document
     */
    getDocManifest(docName: string): DocManifest | undefined {
        return this.manifest?.documents[docName];
    }

    /**
     * Create or update document manifest
     */
    updateDocManifest(docName: string, update: Partial<DocManifest>): void {
        if (!this.manifest) return;

        const existing = this.manifest.documents[docName] || {
            stateFile: `tasktime-yjs-${docName}.bin`,
            stateVersion: 0,
            lastCompaction: new Date().toISOString(),
            deltas: [],
        };

        const removedDeltaIds = Array.isArray(update.deltas)
            ? existing.deltas
                .filter((delta) => !update.deltas!.some((nextDelta) => nextDelta.id === delta.id))
                .map((delta) => delta.id)
            : [];
        const compactedDeltaIds = uniqueStrings([
            ...(existing.compactedDeltaIds || []),
            ...removedDeltaIds,
            ...(update.compactedDeltaIds || []),
        ]).slice(-MAX_COMPACTED_DELTA_TOMBSTONES);

        this.manifest.documents[docName] = {
            ...existing,
            ...update,
            ...(compactedDeltaIds.length > 0 ? { compactedDeltaIds } : {}),
        };
        this._dirty = true;
    }

    /**
     * Ensure a document has a manifest entry
     */
    ensureDocManifest(docName: string): DocManifest {
        if (!this.manifest) {
            throw new Error('Manifest not loaded');
        }

        if (!this.manifest.documents[docName]) {
            this.manifest.documents[docName] = {
                stateFile: `tasktime-yjs-${docName}.bin`,
                stateVersion: 0,
                lastCompaction: new Date().toISOString(),
                deltas: [],
            };
            this._dirty = true;
        }

        return this.manifest.documents[docName];
    }

    /**
     * Add a delta to a document's manifest
     */
    addDelta(docName: string, deltaId: string): void {
        const doc = this.ensureDocManifest(docName);
        doc.compactedDeltaIds = (doc.compactedDeltaIds || []).filter((id) => id !== deltaId);
        if (doc.deltas.some((delta) => delta.id === deltaId)) {
            return;
        }
        doc.deltas.push({
            id: deltaId,
            timestamp: new Date().toISOString(),
        });
        this._dirty = true;
    }

    /**
     * Remove a specific delta from a document's manifest (for pruning orphaned deltas)
     */
    removeDelta(docName: string, deltaId: string): void {
        const doc = this.manifest?.documents[docName];
        if (doc) {
            doc.deltas = doc.deltas.filter(d => d.id !== deltaId);
            doc.compactedDeltaIds = uniqueStrings([
                ...(doc.compactedDeltaIds || []),
                deltaId,
            ]).slice(-MAX_COMPACTED_DELTA_TOMBSTONES);
            this._dirty = true;
        }
    }

    /**
     * Clear all deltas after compaction
     */
    clearDeltas(docName: string): void {
        const doc = this.manifest?.documents[docName];
        if (doc) {
            doc.compactedDeltaIds = uniqueStrings([
                ...(doc.compactedDeltaIds || []),
                ...doc.deltas.map((delta) => delta.id),
            ]).slice(-MAX_COMPACTED_DELTA_TOMBSTONES);
            doc.deltas = [];
            doc.lastCompaction = new Date().toISOString();
            doc.stateVersion++;
            this._dirty = true;
        }
    }

    /**
     * Get list of years that have entry documents
     */
    getEntryYears(): number[] {
        if (!this.manifest) return [];

        const years: number[] = [];
        for (const docName of Object.keys(this.manifest.documents)) {
            const match = docName.match(/^entries-(\d{4})$/);
            if (match) {
                years.push(parseInt(match[1], 10));
            }
        }
        return years.sort((a, b) => b - a);
    }

    /**
     * Update access token (for token refresh)
     */
    updateAccessToken(token: string): void {
        this.googleFileStore?.updateAccessToken(token);
    }

    /**
     * Update session ID (for Worker mode)
     */
    updateSessionId(sessionId: string | null): void {
        this.googleFileStore?.updateSessionId(sessionId);
    }

    // =========================================================================
    // File ID Cache Helpers
    // =========================================================================

    /**
     * Get file ID from cache
     */
    getFileId(fileName: string): string | null {
        return this.fileIdCache.get(fileName) ?? null;
    }

    /** Resolve exact provider metadata without a namespace listing. */
    async getFileMetadata(fileName: string): Promise<AppDataFile | null> {
        const object = await this.fileStore.getMetadata(this.getNamespace(fileName), fileName);
        if (!object) return null;
        this.cacheObject(object);
        return this.toAppDataFile(object);
    }

    /**
     * Get an opaque object ID, with an exact provider lookup fallback.
     * Use this for critical files that must be found
     */
    async getFileIdWithFallback(fileName: string): Promise<string | null> {
        // Try cache first
        const cached = this.fileIdCache.get(fileName);
        if (cached) return cached;

        // Fallback: ask the provider adapter for exact logical-name metadata.
        console.log(`[ManifestManager] File not in cache, searching ${this.providerLabel}: ${fileName}`);
        try {
            const metadata = await this.fileStore.getMetadata(this.getNamespace(fileName), fileName);

            if (metadata) {
                this.cacheObject(metadata);
                console.log(`[ManifestManager] Found file on ${this.providerLabel}: ${fileName} -> ${metadata.opaqueId}`);
                return metadata.opaqueId;
            }
        } catch (error) {
            console.warn(`[ManifestManager] Failed to search for file ${fileName}:`, error);
            // A failed lookup is not evidence that a file is absent. Propagate
            // it so callers retain dirty evidence instead of creating a
            // possible duplicate after an ambiguous network/auth failure.
            throw error;
        }

        return null;
    }

    /**
     * Refresh the sync-object cache from the provider.
     */
    async refreshFileCache(): Promise<AppDataFile[]> {
        const files = await this.listSyncFiles();
        this.rebuildFileCache(files);
        return files;
    }

    private ensureRecoveredDocManifest(docName: string, modifiedTime: string): DocManifest {
        if (!this.manifest) {
            throw new Error('Manifest not loaded');
        }

        const existing = this.manifest.documents[docName];
        if (existing) {
            return existing;
        }

        const recovered: DocManifest = {
            stateFile: `${SYNC_FILE_PREFIX}${docName}${SYNC_FILE_SUFFIX}`,
            stateVersion: 0,
            lastCompaction: modifiedTime,
            deltas: [],
        };

        this.manifest.documents[docName] = recovered;
        this._dirty = true;
        return recovered;
    }

    private reconcileManifestWithFiles(files: AppDataFile[]): void {
        if (!this.manifest) {
            return;
        }

        let recoveredDocCount = 0;
        let recoveredDeltaCount = 0;

        for (const file of files) {
            const parsed = parseSyncFileName(file.name);
            if (!parsed) {
                continue;
            }

            const doc = this.ensureRecoveredDocManifest(parsed.docName, file.modifiedTime);

            if (!parsed.deltaId) {
                if (doc.stateFile !== file.name) {
                    doc.stateFile = file.name;
                    this._dirty = true;
                }

                if (doc.stateModifiedTime !== file.modifiedTime) {
                    doc.stateVersion = doc.stateModifiedTime
                        ? Math.max(1, doc.stateVersion + 1)
                        : Math.max(1, doc.stateVersion);
                    doc.stateModifiedTime = file.modifiedTime;
                    doc.lastCompaction = file.modifiedTime;
                    recoveredDocCount++;
                    this._dirty = true;
                }

                continue;
            }

            if (
                doc.deltas.some((delta) => delta.id === parsed.deltaId)
                || doc.compactedDeltaIds?.includes(parsed.deltaId)
            ) {
                continue;
            }

            doc.deltas.push({
                id: parsed.deltaId,
                timestamp: file.modifiedTime,
            });
            recoveredDeltaCount++;
            this._dirty = true;
        }

        if (recoveredDocCount > 0 || recoveredDeltaCount > 0) {
            console.warn(`[ManifestManager] Recovered missing sync file references from ${this.providerLabel} file list`, {
                documents: recoveredDocCount,
                deltas: recoveredDeltaCount,
            });
        }
    }

    /**
     * Set file ID in cache
     */
    setFileId(fileName: string, fileId: string): void {
        this.fileIdCache.set(fileName, fileId);
        const cached = this.fileMetadataCache.get(fileName);
        if (!cached || cached.opaqueId !== fileId) {
            this.fileMetadataCache.set(fileName, {
                logicalName: fileName,
                opaqueId: fileId,
                modifiedTime: '',
            });
        }
        this.googleFileStore?.setCachedObject(fileName, fileId);
    }

    /**
     * Delete file ID from cache
     */
    deleteFileId(fileName: string): void {
        this.fileIdCache.delete(fileName);
        this.fileMetadataCache.delete(fileName);
        this.googleFileStore?.deleteCachedObject(fileName);
    }

    // =========================================================================
    // Provider adapter compatibility helpers
    // =========================================================================

    private getNamespace(logicalName: string): CloudNamespace {
        return logicalName.startsWith('tasktime-backup-') ? 'backups' : 'sync';
    }

    private toAppDataFile(object: CloudObjectMetadata): AppDataFile {
        return {
            id: object.opaqueId,
            name: object.logicalName,
            modifiedTime: object.modifiedTime,
            ...(object.revision ? { revision: object.revision } : {}),
            ...(object.contentHash ? { contentHash: object.contentHash } : {}),
            ...(object.size !== undefined ? { size: object.size } : {}),
        };
    }

    private async getManifestMetadata(): Promise<CloudObjectMetadata | null> {
        if (this.manifestFileId) {
            this.googleFileStore?.setCachedObject(MANIFEST_FILE_NAME, this.manifestFileId);
        }

        const metadata = await this.fileStore.getMetadata('sync', MANIFEST_FILE_NAME);
        if (metadata) this.cacheObject(metadata);
        return metadata;
    }

    /**
     * List all files in the existing mixed Google appDataFolder.
     *
     * Google keeps the one-request compatibility path. A future provider with
     * physically separate namespaces may require one list per namespace.
     */
    async listAppDataFiles(): Promise<AppDataFile[]> {
        if (this.googleFileStore) {
            const objects = await this.googleFileStore.listAll();
            const files = objects.map((object) => this.toAppDataFile(object));
            this.rebuildFileCache(files);
            return files;
        }

        const [syncObjects, backupObjects] = await Promise.all([
            this.fileStore.list('sync'),
            this.fileStore.list('backups'),
        ]);
        const objects = [...syncObjects, ...backupObjects];
        const files = objects.map((object) => this.toAppDataFile(object));
        this.rebuildFileCache(files);
        return files;
    }

    /** List sync objects without spending a backup-namespace request. */
    async listSyncFiles(): Promise<AppDataFile[]> {
        if (this.googleFileStore) {
            const objects = await this.googleFileStore.listAll();
            const files = objects.map((object) => this.toAppDataFile(object));
            this.rebuildFileCache(files);
            return files.filter((file) => this.getNamespace(file.name) === 'sync');
        }

        const files = (await this.fileStore.list('sync'))
            .map((object) => this.toAppDataFile(object));
        this.replaceNamespaceCache('sync', files);
        return files;
    }

    /** List backup objects without spending a sync-namespace request. */
    async listBackupFiles(): Promise<AppDataFile[]> {
        if (this.googleFileStore) {
            const objects = await this.googleFileStore.listAll();
            const files = objects.map((object) => this.toAppDataFile(object));
            this.rebuildFileCache(files);
            return files.filter((file) => this.getNamespace(file.name) === 'backups');
        }

        const files = (await this.fileStore.list('backups'))
            .map((object) => this.toAppDataFile(object));
        this.replaceNamespaceCache('backups', files);
        return files;
    }

    /**
     * Download a file as JSON.
     */
    async downloadFileAsJson(fileId: string): Promise<unknown> {
        const object = this.getObjectById(fileId);
        const bytes = await this.fileStore.download(object);
        return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    }

    /**
     * Download a file as an ArrayBuffer.
     */
    async downloadFileAsArrayBuffer(fileId: string): Promise<ArrayBuffer> {
        return this.fileStore.download(this.getObjectById(fileId));
    }

    /**
     * Create a new file while preserving the existing ID-returning facade.
     */
    async createFile(name: string, blob: Blob, _retryCount = 0): Promise<string> {
        void _retryCount;
        const object = await this.fileStore.create(this.getNamespace(name), name, blob);
        this.cacheObject(object);
        this.googleFileStore?.setCachedObject(name, object.opaqueId);
        return object.opaqueId;
    }

    /**
     * Replace a known file while preserving the existing modifiedTime facade.
     */
    async updateFile(
        fileId: string,
        name: string,
        blob: Blob,
        _retryCount = 0,
    ): Promise<string | undefined> {
        void _retryCount;
        const current = this.getObjectById(fileId, name);
        const replaced = await this.fileStore.replace(current, blob, current.revision);
        this.cacheObject(replaced);
        this.googleFileStore?.setCachedObject(name, replaced.opaqueId);
        return replaced.modifiedTime || undefined;
    }

    /**
     * Delete a file by opaque provider ID.
     */
    async deleteFileById(fileId: string): Promise<void> {
        const object = this.getObjectById(fileId);
        await this.fileStore.delete(object, object.revision);

        for (const [name, cachedId] of this.fileIdCache) {
            if (cachedId !== fileId) continue;
            this.fileIdCache.delete(name);
            this.fileMetadataCache.delete(name);
            this.googleFileStore?.deleteCachedObject(name);
        }
    }

    /**
     * Delete a file by logical name.
     */
    async deleteFileByName(name: string): Promise<void> {
        const fileId = this.fileIdCache.get(name);
        if (!fileId) return;

        await this.deleteFileById(fileId);
        this.fileIdCache.delete(name);
        this.fileMetadataCache.delete(name);
        this.googleFileStore?.deleteCachedObject(name);
    }

    private getObjectById(fileId: string, logicalName?: string): CloudObjectMetadata {
        const cachedName = logicalName ?? Array.from(this.fileIdCache.entries())
            .find(([, cachedId]) => cachedId === fileId)?.[0]
            ?? '';
        const cachedObject = this.fileMetadataCache.get(cachedName);

        if (cachedObject?.opaqueId === fileId) {
            return cachedObject;
        }

        return {
            logicalName: cachedName,
            opaqueId: fileId,
            modifiedTime: '',
        };
    }

    private cacheObject(object: CloudObjectMetadata): void {
        this.fileIdCache.set(object.logicalName, object.opaqueId);
        this.fileMetadataCache.set(object.logicalName, object);
    }

    private rebuildFileCache(files: AppDataFile[]): void {
        this.fileIdCache.clear();
        this.fileMetadataCache.clear();

        for (const file of files) {
            this.cacheObject({
                logicalName: file.name,
                opaqueId: file.id,
                modifiedTime: file.modifiedTime,
                ...(file.revision ? { revision: file.revision } : {}),
                ...(file.contentHash ? { contentHash: file.contentHash } : {}),
                ...(file.size !== undefined ? { size: file.size } : {}),
            });
        }
    }

    private replaceNamespaceCache(namespace: CloudNamespace, files: AppDataFile[]): void {
        for (const logicalName of this.fileIdCache.keys()) {
            if (this.getNamespace(logicalName) !== namespace) continue;
            this.fileIdCache.delete(logicalName);
            this.fileMetadataCache.delete(logicalName);
        }

        for (const file of files) {
            this.cacheObject({
                logicalName: file.name,
                opaqueId: file.id,
                modifiedTime: file.modifiedTime,
                ...(file.revision ? { revision: file.revision } : {}),
                ...(file.contentHash ? { contentHash: file.contentHash } : {}),
                ...(file.size !== undefined ? { size: file.size } : {}),
            });
        }
    }

    private getProviderLabel(provider: CloudProviderId): string {
        return provider === 'google-drive' ? 'Drive' : 'Dropbox';
    }
}

/**
 * Google-compatible facade retained for existing imports and consumers.
 * The shared manifest algorithm lives in CloudManifestManager.
 */
export class ManifestManager extends CloudManifestManager {}
