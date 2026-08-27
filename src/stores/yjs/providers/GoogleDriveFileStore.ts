import { SYNC_WORKER_CONFIG } from '@/config/google';
import {
    CloudFileStoreError,
    type CloudFileStore,
    type CloudNamespace,
    type CloudObjectMetadata,
} from './CloudFileStore';
import { DriveAccessTokenError } from './DriveAccessTokenProvider';
import {
    AuthorizationError,
    DriveConnectivityError,
    DriveFileNotFoundError,
    DriveRateLimitError,
    DriveStorageQuotaError,
    DriveTransportDisabledError,
} from './GoogleDriveErrors';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_PREFIX = 'tasktime-backup-';

interface NormalizedDriveError {
    status: number;
    reasons: Set<string>;
    code?: string;
}

export type DriveTransport = 'proxy' | 'direct';

export interface DriveTokenProvider {
    getToken(options?: { forceRefresh?: boolean }): Promise<string>;
    clearToken(): void;
}

export interface GoogleDriveFileStoreOptions {
    transport: DriveTransport;
    sessionId?: string | null;
    tokenProvider?: DriveTokenProvider | null;
    /** Legacy direct-auth compatibility for tests and non-Worker consumers. */
    accessToken?: string | null;
}

function belongsToNamespace(name: string, namespace: CloudNamespace): boolean {
    const isBackup = name.startsWith(BACKUP_PREFIX);
    return namespace === 'backups' ? isBackup : !isBackup;
}

/**
 * Google Drive appDataFolder adapter. It owns every Google REST path, opaque
 * file ID, multipart body, retry, and provider-error decision.
 */
export class GoogleDriveFileStore implements CloudFileStore {
    readonly provider = 'google-drive' as const;

    private static readonly REQUEST_TIMEOUT_MS = 30_000;
    private static readonly UPLOAD_TIMEOUT_MS = 60_000;
    private static readonly MAX_RETRIES = 3;

    private accessToken: string;
    private readonly transport: DriveTransport;
    private readonly tokenProvider: DriveTokenProvider | null;
    private sessionId: string | null;
    private readonly metadataByName = new Map<string, CloudObjectMetadata>();
    private readonly pendingCreateIds = new Map<string, string>();

    constructor(options: GoogleDriveFileStoreOptions | string, legacySessionId?: string | null) {
        if (typeof options === 'string') {
            this.accessToken = options;
            this.sessionId = legacySessionId ?? null;
            this.transport = legacySessionId ? 'proxy' : 'direct';
            this.tokenProvider = null;
            return;
        }

        this.transport = options.transport;
        this.sessionId = options.sessionId ?? null;
        this.tokenProvider = options.tokenProvider ?? null;
        this.accessToken = options.accessToken ?? '';

        if (this.transport === 'proxy' && !this.sessionId) {
            throw new Error('Worker proxy transport requires a session.');
        }

        if (this.transport === 'direct' && !this.tokenProvider && !this.accessToken) {
            throw new Error('Direct Drive transport requires a token provider.');
        }
    }

    updateAccessToken(token: string): void {
        this.accessToken = token;
    }

    updateSessionId(sessionId: string | null): void {
        this.sessionId = sessionId;
    }

    clearCache(): void {
        this.metadataByName.clear();
        this.pendingCreateIds.clear();
    }

    setCachedObject(logicalName: string, opaqueId: string): void {
        this.metadataByName.set(logicalName, {
            logicalName,
            opaqueId,
            modifiedTime: this.metadataByName.get(logicalName)?.modifiedTime ?? '',
        });
    }

    deleteCachedObject(logicalName: string): void {
        this.metadataByName.delete(logicalName);
        this.pendingCreateIds.delete(logicalName);
    }

    async list(namespace: CloudNamespace): Promise<CloudObjectMetadata[]> {
        return (await this.listAll()).filter((object) => (
            belongsToNamespace(object.logicalName, namespace)
        ));
    }

    /** One-request compatibility listing for the existing mixed appDataFolder. */
    async listAll(): Promise<CloudObjectMetadata[]> {
        const allObjects: CloudObjectMetadata[] = [];
        const query = encodeURIComponent('trashed=false');
        let pageToken: string | null = null;

        do {
            const pageTokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
            const response = await this.request(
                `/files?spaces=appDataFolder&q=${query}&pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime)${pageTokenParam}`,
            );
            const payload = await response.json() as {
                files?: Array<{ id?: unknown; name?: unknown; modifiedTime?: unknown }>;
                nextPageToken?: unknown;
            };

            for (const file of payload.files || []) {
                if (typeof file.id !== 'string' || typeof file.name !== 'string') continue;
                const metadata: CloudObjectMetadata = {
                    logicalName: file.name,
                    opaqueId: file.id,
                    modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : '',
                };
                allObjects.push(metadata);
                this.metadataByName.set(metadata.logicalName, metadata);
            }

            pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken.length > 0
                ? payload.nextPageToken
                : null;
        } while (pageToken);

        return allObjects;
    }

    async getMetadata(
        namespace: CloudNamespace,
        logicalName: string,
    ): Promise<CloudObjectMetadata | null> {
        if (!belongsToNamespace(logicalName, namespace)) return null;

        const cached = this.metadataByName.get(logicalName);
        if (cached) {
            try {
                const response = await this.request(
                    `/files/${encodeURIComponent(cached.opaqueId)}?fields=modifiedTime`,
                );
                const payload = await response.json() as { modifiedTime?: unknown };
                const metadata = {
                    ...cached,
                    modifiedTime: typeof payload.modifiedTime === 'string'
                        ? payload.modifiedTime
                        : cached.modifiedTime,
                };
                this.metadataByName.set(logicalName, metadata);
                return metadata;
            } catch (error) {
                if (!(error instanceof DriveFileNotFoundError)) throw error;
                this.metadataByName.delete(logicalName);
                return null;
            }
        }

        const query = encodeURIComponent(`name='${logicalName}' and trashed=false`);
        const response = await this.request(
            `/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`,
        );
        const payload = await response.json() as {
            files?: Array<{ id?: unknown; name?: unknown; modifiedTime?: unknown }>;
        };
        const file = payload.files?.[0];

        if (!file || typeof file.id !== 'string' || typeof file.name !== 'string') {
            return null;
        }

        if (file.name !== logicalName || !belongsToNamespace(file.name, namespace)) {
            throw new CloudFileStoreError(
                'conflict',
                'Google Drive returned conflicting metadata for a TaskTime file lookup.',
                { provider: this.provider },
            );
        }

        const metadata: CloudObjectMetadata = {
            logicalName: file.name,
            opaqueId: file.id,
            modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : '',
        };
        this.metadataByName.set(logicalName, metadata);
        return metadata;
    }

    async download(object: CloudObjectMetadata): Promise<ArrayBuffer> {
        const response = await this.request(`/files/${encodeURIComponent(object.opaqueId)}?alt=media`);
        return response.arrayBuffer();
    }

    async create(
        _namespace: CloudNamespace,
        logicalName: string,
        body: Blob,
    ): Promise<CloudObjectMetadata> {
        return this.useWorker
            ? this.createProxyFile(logicalName, body)
            : this.createDirectFile(logicalName, body);
    }

    async replace(
        object: CloudObjectMetadata,
        body: Blob,
    ): Promise<CloudObjectMetadata> {
        return this.replaceFile(object, body);
    }

    async delete(
        object: CloudObjectMetadata,
    ): Promise<void> {
        try {
            await this.request(`/files/${encodeURIComponent(object.opaqueId)}`, { method: 'DELETE' });
        } catch (error) {
            if (error instanceof DriveFileNotFoundError) {
                this.deleteCachedObject(object.logicalName);
                return;
            }
            throw error;
        }

        this.deleteCachedObject(object.logicalName);
    }

    private get useWorker(): boolean {
        return this.transport === 'proxy';
    }

    private get driveBaseUrl(): string {
        return this.useWorker ? SYNC_WORKER_CONFIG.endpoints.drive : DRIVE_API;
    }

    private async getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
        if (this.useWorker) {
            return { 'X-Session-Id': this.sessionId! };
        }

        try {
            const token = this.tokenProvider
                ? await this.tokenProvider.getToken({ forceRefresh })
                : this.accessToken;
            return { 'Authorization': `Bearer ${token}` };
        } catch (error) {
            if (error instanceof DriveAccessTokenError) {
                if (error.code === 'DIRECT_TRANSPORT_DISABLED') {
                    throw new DriveTransportDisabledError();
                }
                if (error.code === 'SESSION_NOT_FOUND' || error.code === 'REFRESH_FAILED') {
                    throw new AuthorizationError('Google session expired. Reconnect Google Drive.');
                }
            }
            throw error;
        }
    }

    private static async normalizeDriveError(response: Response): Promise<NormalizedDriveError> {
        const reasons = new Set<string>();
        let code: string | undefined;

        try {
            const payload = await response.clone().json() as {
                code?: unknown;
                error?: unknown;
            };

            if (typeof payload.code === 'string') code = payload.code;

            if (typeof payload.error === 'string') {
                const lower = payload.error.toLowerCase();
                if (lower.includes('insufficient')) reasons.add('insufficientPermissions');
                if (lower.includes('rate limit')) reasons.add('rateLimitExceeded');
                if (lower.includes('quota')) reasons.add('storageQuotaExceeded');
            } else if (payload.error && typeof payload.error === 'object') {
                const googleError = payload.error as {
                    errors?: unknown;
                    status?: unknown;
                };
                if (Array.isArray(googleError.errors)) {
                    for (const item of googleError.errors) {
                        if (
                            item
                            && typeof item === 'object'
                            && typeof (item as { reason?: unknown }).reason === 'string'
                        ) {
                            reasons.add((item as { reason: string }).reason);
                        }
                    }
                }
                if (typeof googleError.status === 'string') reasons.add(googleError.status);
            }
        } catch {
            // Provider response bodies are untrusted and never included in errors.
        }

        return { status: response.status, reasons, code };
    }

    private static isRateLimited(error: NormalizedDriveError): boolean {
        return error.status === 429
            || error.reasons.has('rateLimitExceeded')
            || error.reasons.has('userRateLimitExceeded');
    }

    private static isPermissionFailure(error: NormalizedDriveError): boolean {
        return error.reasons.has('insufficientPermissions')
            || error.reasons.has('PERMISSION_DENIED');
    }

    private static getRetryDelay(response: Response, retryCount: number): number {
        const retryAfter = response.headers.get('Retry-After');

        if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!Number.isNaN(seconds) && seconds > 0) {
                return Math.min(seconds * 1000, 60_000);
            }
        }

        return Math.min(1000 * Math.pow(2, retryCount), 30_000);
    }

    private async request(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0,
        authRetried = false,
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GoogleDriveFileStore.REQUEST_TIMEOUT_MS);
        let response: Response;

        try {
            const authHeaders = await this.getAuthHeaders(authRetried);
            response = await fetch(`${this.driveBaseUrl}${endpoint}`, {
                ...options,
                signal: options.signal ?? controller.signal,
                headers: {
                    ...authHeaders,
                    ...options.headers,
                },
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch (error) {
            if (
                error instanceof AuthorizationError
                || error instanceof DriveTransportDisabledError
                || error instanceof DriveAccessTokenError
            ) {
                throw error;
            }

            if (retryCount < GoogleDriveFileStore.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                console.warn(`[GoogleDriveFileStore] Request failed, retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.request(endpoint, options, retryCount + 1, authRetried);
            }

            throw new DriveConnectivityError();
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok) return response;

        const driveError = await GoogleDriveFileStore.normalizeDriveError(response);
        const shouldRefreshDirectAuth = !this.useWorker
            && Boolean(this.tokenProvider)
            && !authRetried
            && (
                response.status === 401
                || (response.status === 403 && GoogleDriveFileStore.isPermissionFailure(driveError))
            );

        if (shouldRefreshDirectAuth) {
            this.tokenProvider?.clearToken();
            return this.request(endpoint, options, retryCount, true);
        }

        if (
            (response.status >= 500 || GoogleDriveFileStore.isRateLimited(driveError))
            && retryCount < GoogleDriveFileStore.MAX_RETRIES
        ) {
            const delay = GoogleDriveFileStore.getRetryDelay(response, retryCount);
            console.warn(`[GoogleDriveFileStore] Request failed with ${response.status}, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.request(endpoint, options, retryCount + 1, authRetried);
        }

        this.throwRequestError(response, driveError);
    }

    private throwRequestError(response: Response, driveError: NormalizedDriveError): never {
        if (response.status === 401) {
            const message = driveError.code === 'SESSION_NOT_FOUND' || driveError.code === 'REFRESH_FAILED'
                ? 'Google session expired. Reconnect Google Drive.'
                : 'Google authorization expired. Reconnect Google Drive.';
            throw new AuthorizationError(message);
        }
        if (response.status === 403 && driveError.reasons.has('storageQuotaExceeded')) {
            throw new DriveStorageQuotaError();
        }
        if (response.status === 403 && GoogleDriveFileStore.isPermissionFailure(driveError)) {
            throw new AuthorizationError(
                'Google Drive permission is missing for this session. Reconnect and allow Drive access.',
                'missing-scope',
            );
        }
        if (response.status === 403 && !GoogleDriveFileStore.isRateLimited(driveError)) {
            throw new AuthorizationError('Google Drive access was denied. Reconnect Google Drive.');
        }
        if (GoogleDriveFileStore.isRateLimited(driveError)) {
            throw new DriveRateLimitError(GoogleDriveFileStore.getRetryDelay(response, 0));
        }
        if (response.status === 404) {
            throw new DriveFileNotFoundError();
        }
        if (response.status === 409) {
            throw new CloudFileStoreError(
                'conflict',
                'Google Drive reported a conflicting TaskTime file operation.',
                { provider: this.provider },
            );
        }
        if (response.status >= 500) {
            throw new DriveConnectivityError();
        }
        throw new CloudFileStoreError(
            'invalid-response',
            `Google Drive request failed (${response.status}).`,
            { provider: this.provider },
        );
    }

    private async generateDirectFileId(): Promise<string> {
        const response = await this.request('/files/generateIds?count=1&space=appDataFolder&type=files');
        const payload = await response.json() as { ids?: unknown };
        const id = Array.isArray(payload.ids) && typeof payload.ids[0] === 'string'
            ? payload.ids[0]
            : null;

        if (!id) {
            throw new CloudFileStoreError(
                'invalid-response',
                'Google Drive did not allocate a file ID.',
                { provider: this.provider },
            );
        }

        return id;
    }

    private async fetchUpload(
        url: string,
        method: 'POST' | 'PATCH',
        body: BodyInit,
        contentType?: string,
        authRetried = false,
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GoogleDriveFileStore.UPLOAD_TIMEOUT_MS);
        let response: Response;

        try {
            const authHeaders = await this.getAuthHeaders(authRetried);
            response = await fetch(url, {
                method,
                headers: contentType
                    ? { ...authHeaders, 'Content-Type': contentType }
                    : authHeaders,
                body,
                signal: controller.signal,
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch (error) {
            if (
                error instanceof AuthorizationError
                || error instanceof DriveTransportDisabledError
                || error instanceof DriveAccessTokenError
            ) {
                throw error;
            }
            throw new DriveConnectivityError();
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok && !this.useWorker && Boolean(this.tokenProvider) && !authRetried) {
            const driveError = await GoogleDriveFileStore.normalizeDriveError(response);
            if (
                response.status === 401
                || (response.status === 403 && GoogleDriveFileStore.isPermissionFailure(driveError))
            ) {
                this.tokenProvider?.clearToken();
                return this.fetchUpload(url, method, body, contentType, true);
            }
        }

        return response;
    }

    private createDirectMultipartBody(metadata: Record<string, unknown>, blob: Blob): {
        body: Blob;
        contentType: string;
    } {
        const boundary = `tasktime-${crypto.randomUUID()}`;
        const contentType = `multipart/related; boundary=${boundary}`;
        const fileType = blob.type || 'application/octet-stream';
        const prefix = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(metadata),
            `--${boundary}`,
            `Content-Type: ${fileType}`,
            '',
            '',
        ].join('\r\n');
        const suffix = `\r\n--${boundary}--\r\n`;

        return {
            body: new Blob([prefix, blob, suffix], { type: contentType }),
            contentType,
        };
    }

    private async reconcileDirectCreate(
        opaqueId: string,
        logicalName: string,
        mimeType: string,
    ): Promise<boolean> {
        try {
            const fields = encodeURIComponent('id,name,mimeType,parents,trashed');
            const response = await this.request(
                `/files/${encodeURIComponent(opaqueId)}?fields=${fields}`,
            );
            const file = await response.json() as {
                id?: unknown;
                name?: unknown;
                mimeType?: unknown;
                parents?: unknown;
                trashed?: unknown;
            };
            const matches = file.id === opaqueId
                && file.name === logicalName
                && file.mimeType === mimeType
                && Array.isArray(file.parents)
                && file.parents.includes('appDataFolder')
                && file.trashed !== true;

            if (!matches) {
                throw new CloudFileStoreError(
                    'conflict',
                    'Google Drive returned conflicting metadata for an allocated TaskTime file ID.',
                    { provider: this.provider },
                );
            }

            this.setCachedObject(logicalName, opaqueId);
            this.pendingCreateIds.delete(logicalName);
            return true;
        } catch (error) {
            if (error instanceof DriveFileNotFoundError) return false;
            throw error;
        }
    }

    private async createDirectFile(
        logicalName: string,
        body: Blob,
        retryCount = 0,
    ): Promise<CloudObjectMetadata> {
        const opaqueId = this.pendingCreateIds.get(logicalName) ?? await this.generateDirectFileId();
        this.pendingCreateIds.set(logicalName, opaqueId);
        const metadata = {
            id: opaqueId,
            name: logicalName,
            mimeType: body.type,
            parents: ['appDataFolder'],
        };
        const multipart = this.createDirectMultipartBody(metadata, body);
        let response: Response;

        try {
            response = await this.fetchUpload(
                `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
                'POST',
                multipart.body,
                multipart.contentType,
            );
        } catch (error) {
            if (
                error instanceof DriveConnectivityError
                && await this.reconcileDirectCreate(opaqueId, logicalName, body.type)
            ) {
                return { logicalName, opaqueId, modifiedTime: '' };
            }
            throw error;
        }

        if (response.ok) {
            const result = await response.json() as { id?: unknown; modifiedTime?: unknown };
            if (result.id !== opaqueId) {
                throw new CloudFileStoreError(
                    'invalid-response',
                    'Google Drive returned an unexpected file ID for a TaskTime upload.',
                    { provider: this.provider },
                );
            }
            const object = {
                logicalName,
                opaqueId,
                modifiedTime: typeof result.modifiedTime === 'string' ? result.modifiedTime : '',
            };
            this.metadataByName.set(logicalName, object);
            this.pendingCreateIds.delete(logicalName);
            return object;
        }

        const driveError = await GoogleDriveFileStore.normalizeDriveError(response);
        const ambiguous = response.status === 409 || response.status >= 500;
        if (ambiguous && await this.reconcileDirectCreate(opaqueId, logicalName, body.type)) {
            return { logicalName, opaqueId, modifiedTime: '' };
        }

        const retryable = ambiguous || GoogleDriveFileStore.isRateLimited(driveError);
        if (retryable && retryCount < GoogleDriveFileStore.MAX_RETRIES) {
            const delay = GoogleDriveFileStore.getRetryDelay(response, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.createDirectFile(logicalName, body, retryCount + 1);
        }

        this.throwRequestError(response, driveError);
    }

    private async createProxyFile(
        logicalName: string,
        body: Blob,
        retryCount = 0,
    ): Promise<CloudObjectMetadata> {
        const metadata = {
            name: logicalName,
            mimeType: body.type,
            parents: ['appDataFolder'],
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', body);
        const uploadUrl = `${SYNC_WORKER_CONFIG.endpoints.drive}/files?uploadType=multipart`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GoogleDriveFileStore.UPLOAD_TIMEOUT_MS);
        let response: Response;

        try {
            response = await fetch(uploadUrl, {
                method: 'POST',
                headers: await this.getAuthHeaders(),
                body: form,
                signal: controller.signal,
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch (error) {
            if (retryCount < GoogleDriveFileStore.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                console.warn(`[GoogleDriveFileStore] Create failed, retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.createProxyFile(logicalName, body, retryCount + 1);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired.');
            }
            if (
                (response.status >= 500 || response.status === 429)
                && retryCount < GoogleDriveFileStore.MAX_RETRIES
            ) {
                const delay = GoogleDriveFileStore.getRetryDelay(response, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.createProxyFile(logicalName, body, retryCount + 1);
            }
            throw new CloudFileStoreError(
                'invalid-response',
                `Drive upload error ${response.status}.`,
                { provider: this.provider },
            );
        }

        const result = await response.json() as { id?: unknown; modifiedTime?: unknown };
        if (typeof result.id !== 'string') {
            throw new CloudFileStoreError(
                'invalid-response',
                'Google Drive returned an invalid file identifier.',
                { provider: this.provider },
            );
        }
        const object = {
            logicalName,
            opaqueId: result.id,
            modifiedTime: typeof result.modifiedTime === 'string' ? result.modifiedTime : '',
        };
        this.metadataByName.set(logicalName, object);
        return object;
    }

    private async replaceFile(
        object: CloudObjectMetadata,
        body: Blob,
        retryCount = 0,
    ): Promise<CloudObjectMetadata> {
        const metadata = { name: object.logicalName, mimeType: body.type };
        const uploadUrl = this.useWorker
            ? `${SYNC_WORKER_CONFIG.endpoints.drive}/files/${object.opaqueId}?uploadType=multipart&fields=modifiedTime`
            : `${DRIVE_UPLOAD_API}/files/${object.opaqueId}?uploadType=multipart&fields=modifiedTime`;
        const multipart = this.useWorker ? null : this.createDirectMultipartBody(metadata, body);
        const form = this.useWorker ? new FormData() : null;

        if (form) {
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', body);
        }

        let response: Response;
        try {
            response = await this.fetchUpload(
                uploadUrl,
                'PATCH',
                multipart?.body ?? form!,
                multipart?.contentType,
            );
        } catch (error) {
            if (
                error instanceof AuthorizationError
                || error instanceof DriveTransportDisabledError
                || error instanceof DriveAccessTokenError
                || error instanceof DriveStorageQuotaError
            ) {
                throw error;
            }
            if (retryCount < GoogleDriveFileStore.MAX_RETRIES) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.replaceFile(object, body, retryCount + 1);
            }
            throw error;
        }

        if (!response.ok) {
            const driveError = await GoogleDriveFileStore.normalizeDriveError(response);
            if (
                (response.status >= 500 || GoogleDriveFileStore.isRateLimited(driveError))
                && retryCount < GoogleDriveFileStore.MAX_RETRIES
            ) {
                const delay = GoogleDriveFileStore.getRetryDelay(response, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.replaceFile(object, body, retryCount + 1);
            }
            this.throwRequestError(response, driveError);
        }

        let modifiedTime = object.modifiedTime;
        try {
            const result = await response.json() as { modifiedTime?: unknown };
            if (typeof result.modifiedTime === 'string') modifiedTime = result.modifiedTime;
        } catch {
            // Compatibility: the legacy Worker proxy may return an empty body.
        }

        const replaced = { ...object, modifiedTime };
        this.metadataByName.set(object.logicalName, replaced);
        return replaced;
    }
}
