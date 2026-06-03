/**
 * ManifestManager - Manages the manifest file for Yjs sync
 * 
 * The manifest tracks:
 * - All document files and their versions
 * - Delta files waiting to be merged
 * - Device identity for conflict detection
 * - Last sync timestamp
 * 
 * Supports two modes:
 * - Direct mode: Uses access token to call Google Drive API directly
 * - Worker mode: Uses session ID to call through Cloudflare Worker proxy
 */

import { SYNC_WORKER_CONFIG } from '@/config/google';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const MANIFEST_FILE_NAME = 'tasktime-yjs-manifest.json';

export interface DeltaInfo {
    id: string;
    timestamp: string;
}

export interface DocManifest {
    stateFile: string;
    stateVersion: number;
    lastCompaction: string;
    deltas: DeltaInfo[];
}

export interface Manifest {
    version: number;
    deviceId: string;
    lastSync: string;
    documents: Record<string, DocManifest>;
}

/**
 * AuthorizationError for expired/invalid tokens
 */
export class AuthorizationError extends Error {

    constructor(message: string) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

/**
 * Manages the manifest.json file in Google Drive appDataFolder
 */
export class ManifestManager {

    private accessToken: string;
    private sessionId: string | null;
    private manifestFileId: string | null = null;
    private manifest: Manifest | null = null;
    private fileIdCache: Map<string, string> = new Map();
    private lastManifestModifiedTime: string | null = null;
    private _dirty: boolean = false;

    constructor(accessToken: string, sessionId?: string | null) {
        this.accessToken = accessToken;
        this.sessionId = sessionId ?? null;
    }

    /**
     * Reset cached manifest state (used after a full Drive wipe)
     */
    reset(): void {
        this.manifestFileId = null;
        this.manifest = null;
        this.fileIdCache.clear();
        this.lastManifestModifiedTime = null;
        this._dirty = false;
    }

    /**
     * Check if using Worker proxy mode
     */
    private get useWorker(): boolean {
        return SYNC_WORKER_CONFIG.isEnabled && Boolean(this.sessionId);
    }

    /**
     * Get the base URL for Drive API calls
     */
    private get driveBaseUrl(): string {
        return this.useWorker ? SYNC_WORKER_CONFIG.endpoints.drive : DRIVE_API;
    }

    /**
     * Get auth headers for API calls
     */
    private getAuthHeaders(): Record<string, string> {
        if (this.useWorker) {
            return { 'X-Session-Id': this.sessionId! };
        }
        return { 'Authorization': `Bearer ${this.accessToken}` };
    }

    /**
     * Load manifest from Google Drive (or create new one)
     */
    async load(): Promise<Manifest> {
        // List all files in appDataFolder
        const files = await this.listAppDataFiles();

        // Find manifest
        const manifestFile = files.find(f => f.name === MANIFEST_FILE_NAME);

        if (manifestFile) {
            this.manifestFileId = manifestFile.id;
            this.lastManifestModifiedTime = manifestFile.modifiedTime;
            const content = await this.downloadFileAsJson(manifestFile.id);
            this.manifest = content as Manifest;
            console.log('[ManifestManager] Loaded manifest from Drive');
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
            };
            console.log('[ManifestManager] Created new manifest');
        }

        // Build file ID cache for quick lookups
        this.fileIdCache.clear();
        for (const file of files) {
            this.fileIdCache.set(file.name, file.id);
        }

        return this.manifest;
    }

    /**
     * Save manifest to Google Drive
     */
    async save(): Promise<void> {
        if (!this.manifest) return;

        this.manifest.lastSync = new Date().toISOString();

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
            // Track Drive's actual modifiedTime so hasManifestChanged() won't false-positive
            if (modifiedTime) {
                this.lastManifestModifiedTime = modifiedTime;
            }
        } else {
            this.manifestFileId = await this.createFile(MANIFEST_FILE_NAME, blob);
            this.fileIdCache.set(MANIFEST_FILE_NAME, this.manifestFileId);
        }

        this._dirty = false;

        console.log('[ManifestManager] Saved manifest to Drive');
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
     * Lightweight reload: download just the manifest content without listing all files.
     * Use this when we already have the manifestFileId and file cache from a previous load().
     * Falls back to full load() if we don't have the manifest file ID.
     */
    async reload(): Promise<Manifest> {
        if (!this.manifestFileId) {
            // No cached manifest ID, do full load
            return this.load();
        }

        try {
            // Fetch manifest metadata (modifiedTime) and content
            const [metaResponse, content] = await Promise.all([
                this.request(`/files/${this.manifestFileId}?fields=modifiedTime`),
                this.downloadFileAsJson(this.manifestFileId),
            ]);

            const { modifiedTime } = await metaResponse.json();
            this.lastManifestModifiedTime = modifiedTime;
            this.manifest = content as Manifest;

            console.log('[ManifestManager] Reloaded manifest (lightweight)');
            return this.manifest;
        } catch (error) {
            console.warn('[ManifestManager] Lightweight reload failed, falling back to full load:', error);
            return this.load();
        }
    }

    /**
     * Check if manifest has changed on Drive since last load
     * Does a lightweight metadata check instead of full download
     * @returns true if changed or unknown, false if definitely unchanged
     */
    async hasManifestChanged(): Promise<boolean> {
        if (!this.manifestFileId || !this.lastManifestModifiedTime) {
            // No cached info, assume changed
            return true;
        }

        try {
            // Fetch just the manifest file metadata
            const response = await this.request(
                `/files/${this.manifestFileId}?fields=modifiedTime`
            );
            const { modifiedTime } = await response.json();

            if (modifiedTime !== this.lastManifestModifiedTime) {
                console.log('[ManifestManager] Manifest changed on Drive', {
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
     * Whether this instance has loaded a Drive-backed manifest with metadata.
     */
    canCheckRemoteManifestChanges(): boolean {
        return Boolean(this.manifestFileId && this.lastManifestModifiedTime);
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

        this.manifest.documents[docName] = { ...existing, ...update };
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
            this._dirty = true;
        }
    }

    /**
     * Clear all deltas after compaction
     */
    clearDeltas(docName: string): void {
        const doc = this.manifest?.documents[docName];
        if (doc) {
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
        this.accessToken = token;
    }

    /**
     * Update session ID (for Worker mode)
     */
    updateSessionId(sessionId: string | null): void {
        this.sessionId = sessionId;
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

    /**
     * Get file ID, with fallback to Drive lookup if not in cache
     * Use this for critical files that must be found
     */
    async getFileIdWithFallback(fileName: string): Promise<string | null> {
        // Try cache first
        const cached = this.fileIdCache.get(fileName);
        if (cached) return cached;

        // Fallback: search Drive for the file
        console.log(`[ManifestManager] File not in cache, searching Drive: ${fileName}`);
        try {
            const query = encodeURIComponent(`name='${fileName}'`);
            const response = await this.request(
                `/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`
            );
            const { files } = await response.json();
            
            if (files && files.length > 0) {
                const fileId = files[0].id;
                this.fileIdCache.set(fileName, fileId);
                console.log(`[ManifestManager] Found file on Drive: ${fileName} -> ${fileId}`);
                return fileId;
            }
        } catch (error) {
            console.warn(`[ManifestManager] Failed to search for file ${fileName}:`, error);
        }

        return null;
    }

    /**
     * Refresh file ID cache from Drive
     */
    async refreshFileCache(): Promise<void> {
        const files = await this.listAppDataFiles();
        this.fileIdCache.clear();
        for (const file of files) {
            this.fileIdCache.set(file.name, file.id);
        }
    }

    /**
     * Set file ID in cache
     */
    setFileId(fileName: string, fileId: string): void {
        this.fileIdCache.set(fileName, fileId);
    }

    /**
     * Delete file ID from cache
     */
    deleteFileId(fileName: string): void {
        this.fileIdCache.delete(fileName);
    }

    // =========================================================================
    // Drive API Helpers
    // =========================================================================

    private static readonly REQUEST_TIMEOUT_MS = 30_000;
    private static readonly UPLOAD_TIMEOUT_MS = 60_000;
    private static readonly MAX_RETRIES = 3;

    /**
     * Compute retry delay: honor Retry-After header, otherwise exponential backoff (max 30s)
     */
    private static getRetryDelay(response: Response, retryCount: number): number {
        const retryAfter = response.headers.get('Retry-After');

        if (retryAfter) {
            const seconds = Number(retryAfter);

            if (!Number.isNaN(seconds) && seconds > 0) {
                // Cap at 60s to avoid extremely long waits
                return Math.min(seconds * 1000, 60_000);
            }

            // Could be an HTTP-date; fall through to exponential backoff
        }

        return Math.min(1000 * Math.pow(2, retryCount), 30_000);
    }

    /**
     * Make an authenticated request to Drive API
     */
    private async request(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ManifestManager.REQUEST_TIMEOUT_MS);

        let response: Response;

        try {
            response = await fetch(`${this.driveBaseUrl}${endpoint}`, {
                ...options,
                signal: options.signal ?? controller.signal,
                headers: {
                    ...this.getAuthHeaders(),
                    ...options.headers,
                },
            });
        } catch (error) {
            clearTimeout(timeoutId);

            // Retry on network / timeout errors
            if (retryCount < ManifestManager.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                console.warn(`[ManifestManager] request ${endpoint} failed (${error instanceof Error ? error.message : error}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.request(endpoint, options, retryCount + 1);
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                let errorMessage = 'Google authorization expired. Reconnect Google Drive.';

                try {
                    const cloned = response.clone();
                    const contentType = cloned.headers.get('Content-Type') || '';

                    if (contentType.includes('application/json')) {
                        const payload = await cloned.json() as { error?: unknown; code?: string };
                        const payloadError = typeof payload.error === 'string' ? payload.error : null;
                        const payloadCode = typeof payload.code === 'string' ? payload.code : null;

                        if (response.status === 403) {
                            if (payloadError && payloadError.toLowerCase().includes('insufficient')) {
                                errorMessage = 'Google Drive permission is missing for this session. Reconnect and allow Drive access.';
                            } else {
                                errorMessage = 'Google Drive access was denied. Reconnect Google Drive.';
                            }
                        } else if (payloadCode === 'SESSION_NOT_FOUND' || payloadCode === 'REFRESH_FAILED') {
                            errorMessage = 'Google session expired. Reconnect Google Drive.';
                        }
                    } else if (response.status === 403) {
                        const text = await cloned.text();
                        if (text.toLowerCase().includes('insufficient')) {
                            errorMessage = 'Google Drive permission is missing for this session. Reconnect and allow Drive access.';
                        } else {
                            errorMessage = 'Google Drive access was denied. Reconnect Google Drive.';
                        }
                    }
                } catch {
                    // Ignore parse failures and keep generic auth message
                }

                throw new AuthorizationError(errorMessage);
            }

            // Retry transient errors with exponential backoff (honors Retry-After)
            if ((response.status >= 500 || response.status === 429) && retryCount < ManifestManager.MAX_RETRIES) {
                const delay = ManifestManager.getRetryDelay(response, retryCount);
                console.warn(`[ManifestManager] request ${endpoint} failed with ${response.status}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.request(endpoint, options, retryCount + 1);
            }

            const text = await response.text();
            throw new Error(`Drive API error ${response.status}: ${text}`);
        }

        return response;
    }

    /**
     * List all files in appDataFolder
     */
    async listAppDataFiles(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
        const response = await this.request(
            '/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)'
        );
        const { files } = await response.json();
        return files || [];
    }

    /**
     * Download a file as JSON
     */
    async downloadFileAsJson(fileId: string): Promise<unknown> {
        const response = await this.request(`/files/${fileId}?alt=media`);
        return response.json();
    }

    /**
     * Download a file as ArrayBuffer
     */
    async downloadFileAsArrayBuffer(fileId: string): Promise<ArrayBuffer> {
        const response = await this.request(`/files/${fileId}?alt=media`);
        return response.arrayBuffer();
    }

    /**
     * Create a new file in appDataFolder
     */
    async createFile(name: string, blob: Blob, retryCount = 0): Promise<string> {
        const metadata = {
            name,
            mimeType: blob.type,
            parents: ['appDataFolder'],
        };

        const form = new FormData();
        form.append(
            'metadata',
            new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        form.append('file', blob);

        const uploadUrl = this.useWorker
            ? `${SYNC_WORKER_CONFIG.endpoints.drive}/files?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ManifestManager.UPLOAD_TIMEOUT_MS);

        let response: Response;

        try {
            response = await fetch(uploadUrl, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: form,
                signal: controller.signal,
            });
        } catch (error) {
            clearTimeout(timeoutId);

            if (retryCount < ManifestManager.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                console.warn(`[ManifestManager] createFile ${name} failed (${error instanceof Error ? error.message : error}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.createFile(name, blob, retryCount + 1);
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired.');
            }

            // Retry transient errors with exponential backoff (honors Retry-After)
            if ((response.status >= 500 || response.status === 429) && retryCount < ManifestManager.MAX_RETRIES) {
                const delay = ManifestManager.getRetryDelay(response, retryCount);
                console.warn(`[ManifestManager] createFile ${name} failed with ${response.status}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.createFile(name, blob, retryCount + 1);
            }

            const text = await response.text();
            throw new Error(`Drive upload error ${response.status}: ${text}`);
        }

        const result = await response.json();
        this.fileIdCache.set(name, result.id);
        return result.id;
    }

    /**
     * Update an existing file
     * Returns the updated modifiedTime from Drive if available
     */
    async updateFile(fileId: string, name: string, blob: Blob, retryCount = 0): Promise<string | undefined> {
        const metadata = {
            name,
            mimeType: blob.type,
        };

        const form = new FormData();
        form.append(
            'metadata',
            new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        form.append('file', blob);

        const uploadUrl = this.useWorker
            ? `${SYNC_WORKER_CONFIG.endpoints.drive}/files/${fileId}?uploadType=multipart&fields=modifiedTime`
            : `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=modifiedTime`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ManifestManager.UPLOAD_TIMEOUT_MS);

        let response: Response;

        try {
            response = await fetch(uploadUrl, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: form,
                signal: controller.signal,
            });
        } catch (error) {
            clearTimeout(timeoutId);

            if (retryCount < ManifestManager.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                console.warn(`[ManifestManager] updateFile ${name} failed (${error instanceof Error ? error.message : error}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.updateFile(fileId, name, blob, retryCount + 1);
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired.');
            }

            // Retry transient errors with exponential backoff (honors Retry-After)
            if ((response.status >= 500 || response.status === 429) && retryCount < ManifestManager.MAX_RETRIES) {
                const delay = ManifestManager.getRetryDelay(response, retryCount);
                console.warn(`[ManifestManager] updateFile ${name} failed with ${response.status}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.updateFile(fileId, name, blob, retryCount + 1);
            }

            const text = await response.text();
            throw new Error(`Drive update error ${response.status}: ${text}`);
        }

        try {
            const result = await response.json();
            return result?.modifiedTime;
        } catch {
            return undefined;
        }
    }

    /**
     * Delete a file by ID
     */
    async deleteFileById(fileId: string): Promise<void> {
        try {
            await this.request(`/files/${fileId}`, { method: 'DELETE' });
        } catch (error) {
            // If the file is already gone, treat as success to avoid breaking sync
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('404')) {
                console.warn('[ManifestManager] deleteFileById: file missing, skipping');
                return;
            }
            throw error;
        }
    }

    /**
     * Delete a file by name
     */
    async deleteFileByName(name: string): Promise<void> {
        const fileId = this.fileIdCache.get(name);
        if (!fileId) return;

        await this.deleteFileById(fileId);
        this.fileIdCache.delete(name);
    }
}
