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

    constructor(accessToken: string, sessionId?: string | null) {
        this.accessToken = accessToken;
        this.sessionId = sessionId ?? null;
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
            await this.updateFile(this.manifestFileId, MANIFEST_FILE_NAME, blob);
        } else {
            this.manifestFileId = await this.createFile(MANIFEST_FILE_NAME, blob);
            this.fileIdCache.set(MANIFEST_FILE_NAME, this.manifestFileId);
        }

        console.log('[ManifestManager] Saved manifest to Drive');
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
    }

    /**
     * Remove a specific delta from a document's manifest (for pruning orphaned deltas)
     */
    removeDelta(docName: string, deltaId: string): void {
        const doc = this.manifest?.documents[docName];
        if (doc) {
            doc.deltas = doc.deltas.filter(d => d.id !== deltaId);
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

    /**
     * Make an authenticated request to Drive API
     */
    private async request(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0
    ): Promise<Response> {
        const response = await fetch(`${this.driveBaseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers,
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired. Reconnect Google Drive.');
            }

            // Retry transient errors once
            if ((response.status >= 500 || response.status === 429) && retryCount < 1) {
                await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
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

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: form,
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired.');
            }

            // Retry transient errors with exponential backoff
            if ((response.status >= 500 || response.status === 429) && retryCount < 3) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
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
     */
    async updateFile(fileId: string, name: string, blob: Blob, retryCount = 0): Promise<void> {
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
            ? `${SYNC_WORKER_CONFIG.endpoints.drive}/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;

        const response = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: form,
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired.');
            }

            // Retry transient errors with exponential backoff
            if ((response.status >= 500 || response.status === 429) && retryCount < 3) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
                console.warn(`[ManifestManager] updateFile ${name} failed with ${response.status}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.updateFile(fileId, name, blob, retryCount + 1);
            }

            const text = await response.text();
            throw new Error(`Drive update error ${response.status}: ${text}`);
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
