import {
    CloudFileStoreError,
    type CloudFileStore,
    type CloudNamespace,
    type CloudObjectMetadata,
} from './CloudFileStore';
import {
    DropboxAccessTokenError,
    type DropboxAccessTokenProvider,
} from './DropboxAccessTokenProvider';

const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2';
const CONTENT_HASH_BLOCK_BYTES = 4 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_THRESHOLD_BYTES = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const LOGICAL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export interface DropboxTokenProvider {
    getToken(options?: { forceRefresh?: boolean }): Promise<string>;
    clearToken(): void;
}

interface DropboxFileStoreOptions {
    tokenProvider: DropboxTokenProvider | DropboxAccessTokenProvider;
    uploadSessionThresholdBytes?: number;
    uploadChunkBytes?: number;
}

interface DropboxFailure {
    status: number;
    tags: Set<string>;
}

class DropboxNetworkError extends Error {
    constructor() {
        super('Dropbox request unavailable');
        this.name = 'DropboxNetworkError';
    }
}

function namespacePath(namespace: CloudNamespace): string {
    return namespace === 'sync' ? '/sync' : '/backups';
}

function namespaceForLogicalName(logicalName: string): CloudNamespace {
    return logicalName.startsWith('tasktime-backup-') ? 'backups' : 'sync';
}

function validateLogicalName(logicalName: string): void {
    if (!LOGICAL_NAME_PATTERN.test(logicalName) || logicalName === '.' || logicalName === '..') {
        throw new CloudFileStoreError(
            'conflict',
            'Dropbox refused an invalid TaskTime logical file name.',
            { provider: 'dropbox' },
        );
    }
}

function objectPath(namespace: CloudNamespace, logicalName: string): string {
    validateLogicalName(logicalName);
    return `${namespacePath(namespace)}/${logicalName}`;
}

function headerSafeJson(value: unknown): string {
    return JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => (
        `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
    ));
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Unable to read Dropbox upload body.'));
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error('Unable to read Dropbox upload body.'));
        };
        reader.readAsArrayBuffer(blob);
    });
}

/** Calculate Dropbox's stable 4 MiB block hash without buffering the whole file. */
export async function calculateDropboxContentHash(body: Blob): Promise<string> {
    const blockDigests: Uint8Array[] = [];
    for (let offset = 0; offset < body.size; offset += CONTENT_HASH_BLOCK_BYTES) {
        const block = await readBlob(body.slice(offset, offset + CONTENT_HASH_BLOCK_BYTES));
        blockDigests.push(new Uint8Array(await crypto.subtle.digest(
            'SHA-256',
            new Uint8Array(block),
        )));
    }
    const combined = new Uint8Array(blockDigests.length * 32);
    blockDigests.forEach((digest, index) => combined.set(digest, index * 32));
    return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', combined)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFolderMetadata(value: unknown, expectedPath: string): boolean {
    if (!isRecord(value)) {
        return false;
    }
    // Concrete FolderMetadata responses may omit the union discriminator.
    // When it is absent, validate the stable folder identity and exact path.
    if (value['.tag'] !== undefined) {
        return value['.tag'] === 'folder';
    }
    if (typeof value.id !== 'string'
        || !value.id.startsWith('id:')
        || typeof value.name !== 'string'
        || (value.path_lower !== undefined && typeof value.path_lower !== 'string')) {
        return false;
    }
    const expectedName = expectedPath.slice(expectedPath.lastIndexOf('/') + 1);
    return value.name.toLowerCase() === expectedName.toLowerCase()
        && (typeof value.path_lower !== 'string'
            || value.path_lower.toLowerCase() === expectedPath.toLowerCase());
}

function collectTags(value: unknown, tags: Set<string>, depth = 0): void {
    if (depth > 5 || !isRecord(value)) return;
    if (typeof value['.tag'] === 'string') tags.add(value['.tag']);
    for (const child of Object.values(value)) collectTags(child, tags, depth + 1);
}

async function normalizeFailure(response: Response): Promise<DropboxFailure> {
    const tags = new Set<string>();
    try {
        collectTags(await response.clone().json(), tags);
    } catch {
        // Provider bodies are untrusted and never retained.
    }
    return { status: response.status, tags };
}

function getRetryDelay(response: Response, retryCount: number): number {
    const seconds = Number.parseInt(response.headers.get('Retry-After') || '', 10);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
    return Math.min(1000 * (2 ** retryCount), 30_000);
}

function toMetadata(value: unknown, expected?: {
    logicalName: string;
    path: string;
}): CloudObjectMetadata {
    if (!isRecord(value)
        || (value['.tag'] !== undefined && value['.tag'] !== 'file')
        || typeof value.id !== 'string'
        || !value.id.startsWith('id:')
        || typeof value.name !== 'string'
        || (value.path_lower !== undefined && typeof value.path_lower !== 'string')
        || typeof value.server_modified !== 'string'
        || typeof value.rev !== 'string'
        || typeof value.size !== 'number'
        || !Number.isSafeInteger(value.size)
        || value.size < 0
        || (value.content_hash !== undefined && typeof value.content_hash !== 'string')) {
        throw new CloudFileStoreError(
            'invalid-response',
            'Dropbox returned invalid TaskTime file metadata.',
            { provider: 'dropbox' },
        );
    }
    validateLogicalName(value.name);
    if (expected
        && (value.name !== expected.logicalName
            || (typeof value.path_lower === 'string'
                && value.path_lower.toLowerCase() !== expected.path.toLowerCase()))) {
        throw new CloudFileStoreError(
            'conflict',
            'Dropbox returned conflicting TaskTime file metadata.',
            { provider: 'dropbox' },
        );
    }
    return {
        logicalName: value.name,
        opaqueId: value.id,
        revision: value.rev,
        modifiedTime: value.server_modified,
        contentHash: typeof value.content_hash === 'string' ? value.content_hash : undefined,
        size: value.size,
    };
}

/** Direct App Folder adapter. No Worker data route is accepted or referenced. */
export class DropboxFileStore implements CloudFileStore {
    readonly provider = 'dropbox' as const;

    private readonly tokenProvider: DropboxTokenProvider;
    private readonly uploadSessionThresholdBytes: number;
    private readonly uploadChunkBytes: number;
    private readonly listFlights = new Map<CloudNamespace, Promise<CloudObjectMetadata[]>>();
    private readonly namespaceFlights = new Map<CloudNamespace, Promise<void>>();
    private readonly readyNamespaces = new Set<CloudNamespace>();

    constructor({
        tokenProvider,
        uploadSessionThresholdBytes = DEFAULT_UPLOAD_SESSION_THRESHOLD_BYTES,
        uploadChunkBytes = DEFAULT_UPLOAD_CHUNK_BYTES,
    }: DropboxFileStoreOptions) {
        if (uploadSessionThresholdBytes <= 0 || uploadChunkBytes <= 0) {
            throw new Error('Dropbox upload thresholds must be positive.');
        }
        this.tokenProvider = tokenProvider;
        this.uploadSessionThresholdBytes = uploadSessionThresholdBytes;
        this.uploadChunkBytes = uploadChunkBytes;
    }

    async list(namespace: CloudNamespace): Promise<CloudObjectMetadata[]> {
        const existing = this.listFlights.get(namespace);
        if (existing) return existing;
        const request = this.listNamespace(namespace).finally(() => {
            if (this.listFlights.get(namespace) === request) this.listFlights.delete(namespace);
        });
        this.listFlights.set(namespace, request);
        return request;
    }

    private async listNamespace(namespace: CloudNamespace): Promise<CloudObjectMetadata[]> {
        const first = await this.rpc('/files/list_folder', {
            path: namespacePath(namespace),
            recursive: false,
            include_deleted: false,
            include_non_downloadable_files: false,
            limit: 2000,
        }, { allowNotFound: true, safeToRetry: true });
        if (!first) return [];
        this.readyNamespaces.add(namespace);
        const objects: CloudObjectMetadata[] = [];
        let page = await this.readListPage(first, namespace, objects);
        while (page.hasMore) {
            const response = await this.rpc('/files/list_folder/continue', { cursor: page.cursor }, {
                safeToRetry: true,
            });
            page = await this.readListPage(response!, namespace, objects);
        }
        return objects;
    }

    async getMetadata(
        namespace: CloudNamespace,
        logicalName: string,
    ): Promise<CloudObjectMetadata | null> {
        const path = objectPath(namespace, logicalName);
        const response = await this.rpc('/files/get_metadata', {
            path,
            include_deleted: false,
        }, { allowNotFound: true, safeToRetry: true });
        if (!response) return null;
        return toMetadata(await this.readJson(response), { logicalName, path });
    }

    async download(object: CloudObjectMetadata): Promise<ArrayBuffer> {
        validateLogicalName(object.logicalName);
        const response = await this.contentRequest('/files/download', {
            path: object.opaqueId,
        });
        const resultHeader = response.headers.get('Dropbox-API-Result');
        if (!resultHeader) {
            throw new CloudFileStoreError(
                'invalid-response',
                'Dropbox did not identify the downloaded TaskTime file.',
                { provider: this.provider },
            );
        }
        let downloaded: CloudObjectMetadata;
        try {
            downloaded = toMetadata(JSON.parse(resultHeader));
        } catch (error) {
            if (error instanceof CloudFileStoreError) throw error;
            throw new CloudFileStoreError(
                'invalid-response',
                'Dropbox returned invalid download metadata.',
                { provider: this.provider },
            );
        }
        if (downloaded.opaqueId !== object.opaqueId
            || downloaded.logicalName !== object.logicalName
            || (object.revision && downloaded.revision !== object.revision)) {
            throw new CloudFileStoreError(
                'conflict',
                'Dropbox file changed before TaskTime could download it.',
                { provider: this.provider },
            );
        }
        const bytes = await response.arrayBuffer();
        if (downloaded.contentHash) {
            const actual = await calculateDropboxContentHash(new Blob([bytes]));
            if (actual !== downloaded.contentHash) {
                throw new CloudFileStoreError(
                    'invalid-response',
                    'Dropbox file integrity verification failed.',
                    { provider: this.provider },
                );
            }
        }
        return bytes;
    }

    async create(
        namespace: CloudNamespace,
        logicalName: string,
        body: Blob,
    ): Promise<CloudObjectMetadata> {
        const path = objectPath(namespace, logicalName);
        await this.ensureNamespace(namespace);
        const contentHash = await calculateDropboxContentHash(body);
        return this.writeWithReconciliation({
            namespace,
            logicalName,
            path,
            body,
            contentHash,
            mode: 'add',
        });
    }

    async replace(
        object: CloudObjectMetadata,
        body: Blob,
        expectedRevision = object.revision,
    ): Promise<CloudObjectMetadata> {
        validateLogicalName(object.logicalName);
        if (!expectedRevision) {
            throw new CloudFileStoreError(
                'conflict',
                'Dropbox requires a known revision for a safe TaskTime replacement.',
                { provider: this.provider },
            );
        }
        const namespace = namespaceForLogicalName(object.logicalName);
        const path = objectPath(namespace, object.logicalName);
        const contentHash = await calculateDropboxContentHash(body);
        return this.writeWithReconciliation({
            namespace,
            logicalName: object.logicalName,
            path,
            body,
            contentHash,
            mode: { '.tag': 'update', update: expectedRevision },
        });
    }

    async delete(
        object: CloudObjectMetadata,
        expectedRevision = object.revision,
    ): Promise<void> {
        validateLogicalName(object.logicalName);
        if (expectedRevision) {
            const response = await this.rpc('/files/get_metadata', {
                path: object.opaqueId,
                include_deleted: false,
            }, { allowNotFound: true, safeToRetry: true });
            if (!response) return;
            const current = toMetadata(await this.readJson(response));
            if (current.revision !== expectedRevision
                || current.logicalName !== object.logicalName) {
                throw new CloudFileStoreError(
                    'conflict',
                    'Dropbox file changed before TaskTime could remove it.',
                    { provider: this.provider },
                );
            }
        }
        const response = await this.rpc('/files/delete_v2', { path: object.opaqueId }, {
            allowNotFound: true,
            safeToRetry: true,
        });
        if (response) await this.readJson(response);
    }

    private async readListPage(
        response: Response,
        namespace: CloudNamespace,
        objects: CloudObjectMetadata[],
    ): Promise<{ cursor: string; hasMore: boolean }> {
        const value = await this.readJson(response);
        if (!Array.isArray(value.entries)
            || typeof value.cursor !== 'string'
            || typeof value.has_more !== 'boolean') {
            throw new CloudFileStoreError(
                'invalid-response',
                'Dropbox returned an invalid TaskTime folder listing.',
                { provider: this.provider },
            );
        }
        const base = namespacePath(namespace).toLowerCase();
        for (const entry of value.entries) {
            if (!isRecord(entry)
                || (entry['.tag'] !== undefined && entry['.tag'] !== 'file')) continue;
            // Without the optional discriminator, folder entries have none of
            // the concrete file fields. Leave those out of TaskTime's listing.
            if (entry['.tag'] === undefined
                && entry.server_modified === undefined
                && entry.rev === undefined
                && entry.size === undefined) continue;
            const logicalName = typeof entry.name === 'string' ? entry.name : '';
            const metadata = toMetadata(entry, {
                logicalName,
                path: `${base}/${logicalName}`,
            });
            objects.push(metadata);
        }
        return { cursor: value.cursor, hasMore: value.has_more };
    }

    private async ensureNamespace(namespace: CloudNamespace): Promise<void> {
        if (this.readyNamespaces.has(namespace)) return;
        const existingFlight = this.namespaceFlights.get(namespace);
        if (existingFlight) return existingFlight;
        const request = this.ensureNamespaceInner(namespace).finally(() => {
            if (this.namespaceFlights.get(namespace) === request) {
                this.namespaceFlights.delete(namespace);
            }
        });
        this.namespaceFlights.set(namespace, request);
        return request;
    }

    private async ensureNamespaceInner(namespace: CloudNamespace): Promise<void> {
        const path = namespacePath(namespace);
        const existing = await this.rpc('/files/get_metadata', {
            path,
            include_deleted: false,
        }, { allowNotFound: true, safeToRetry: true });
        if (existing) {
            const value = await this.readJson(existing);
            if (isFolderMetadata(value, path)) {
                this.readyNamespaces.add(namespace);
                return;
            }
            throw new CloudFileStoreError(
                'conflict',
                'Dropbox TaskTime namespace is occupied by a file.',
                { provider: this.provider },
            );
        }
        let created: Response | null;
        try {
            created = await this.rpc('/files/create_folder_v2', { path, autorename: false });
        } catch (error) {
            if (!(error instanceof CloudFileStoreError) || error.code !== 'conflict') throw error;
            const raced = await this.rpc('/files/get_metadata', {
                path,
                include_deleted: false,
            }, { allowNotFound: true, safeToRetry: true });
            if (raced) {
                const value = await this.readJson(raced);
                if (isFolderMetadata(value, path)) {
                    this.readyNamespaces.add(namespace);
                    return;
                }
            }
            throw error;
        }
        const value = await this.readJson(created!);
        if (!isFolderMetadata(value.metadata, path)) {
            throw new CloudFileStoreError(
                'invalid-response',
                'Dropbox did not create the TaskTime namespace.',
                { provider: this.provider },
            );
        }
        this.readyNamespaces.add(namespace);
    }

    private async writeWithReconciliation(options: {
        namespace: CloudNamespace;
        logicalName: string;
        path: string;
        lookupPath?: string;
        body: Blob;
        contentHash: string;
        mode: 'add' | { '.tag': 'update'; update: string };
    }): Promise<CloudObjectMetadata> {
        const lookupPath = options.lookupPath ?? objectPath(options.namespace, options.logicalName);
        let lastFailure: unknown = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
            try {
                const response = options.body.size > this.uploadSessionThresholdBytes
                    ? await this.uploadSession(options)
                    : await this.directUpload(options);
                const metadata = toMetadata(await this.readJson(response), {
                    logicalName: options.logicalName,
                    path: lookupPath,
                });
                // Dropbox verifies the content_hash supplied with the upload
                // request. Compare it again when the optional response field is
                // present, but do not reject an otherwise verified response when
                // the concrete FileMetadata omits that optional field.
                if (metadata.contentHash !== undefined
                    && metadata.contentHash !== options.contentHash) {
                    throw new CloudFileStoreError(
                        'invalid-response',
                        'Dropbox upload integrity verification failed.',
                        { provider: this.provider },
                    );
                }
                return metadata;
            } catch (error) {
                lastFailure = error;
                if (!(error instanceof DropboxNetworkError)
                    && !(error instanceof CloudFileStoreError
                        && (error.code === 'conflict'
                            || error.code === 'transient-unavailable'
                            || error.code === 'rate-limited'))) {
                    throw error;
                }
                let reconciled: CloudObjectMetadata | null = null;
                try {
                    reconciled = await this.reconcileWrite(
                        options.namespace,
                        options.logicalName,
                        options.contentHash,
                    );
                } catch (reconcileError) {
                    if (!(reconcileError instanceof CloudFileStoreError)
                        || (reconcileError.code !== 'rate-limited'
                            && reconcileError.code !== 'transient-unavailable')) {
                        throw reconcileError;
                    }
                }
                if (reconciled) return reconciled;
                if (error instanceof CloudFileStoreError && error.code === 'conflict') throw error;
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (2 ** attempt), 30_000)));
                }
            }
        }
        if (lastFailure instanceof Error) throw lastFailure;
        throw new CloudFileStoreError(
            'transient-unavailable',
            'Dropbox upload is temporarily unavailable.',
            { provider: this.provider },
        );
    }

    private async reconcileWrite(
        namespace: CloudNamespace,
        logicalName: string,
        expectedHash: string,
    ): Promise<CloudObjectMetadata | null> {
        const metadata = await this.getMetadata(namespace, logicalName);
        if (!metadata) return null;
        if (metadata.contentHash === expectedHash) return metadata;
        return null;
    }

    private commitInfo(
        path: string,
        mode: 'add' | { '.tag': 'update'; update: string },
    ): Record<string, unknown> {
        return {
            path,
            mode,
            autorename: false,
            mute: true,
            strict_conflict: true,
        };
    }

    private directUpload(options: {
        path: string;
        body: Blob;
        contentHash: string;
        mode: 'add' | { '.tag': 'update'; update: string };
    }): Promise<Response> {
        return this.contentRequest('/files/upload', {
            ...this.commitInfo(options.path, options.mode),
            content_hash: options.contentHash,
        }, options.body, { reconcileOnFailure: true });
    }

    private async uploadSession(options: {
        path: string;
        body: Blob;
        contentHash: string;
        mode: 'add' | { '.tag': 'update'; update: string };
    }): Promise<Response> {
        const firstEnd = Math.min(this.uploadChunkBytes, options.body.size);
        const firstChunk = options.body.slice(0, firstEnd);
        const started = await this.contentRequest(
            '/files/upload_session/start',
            {
                close: false,
                content_hash: await calculateDropboxContentHash(firstChunk),
            },
            firstChunk,
            { reconcileOnFailure: true },
        );
        const startValue = await this.readJson(started);
        if (typeof startValue.session_id !== 'string' || !startValue.session_id) {
            throw new CloudFileStoreError(
                'invalid-response',
                'Dropbox returned an invalid upload session.',
                { provider: this.provider },
            );
        }
        let offset = firstEnd;
        while (offset < options.body.size) {
            const end = Math.min(offset + this.uploadChunkBytes, options.body.size);
            const chunk = options.body.slice(offset, end);
            await this.contentRequest('/files/upload_session/append_v2', {
                cursor: { session_id: startValue.session_id, offset },
                close: false,
                content_hash: await calculateDropboxContentHash(chunk),
            }, chunk, { reconcileOnFailure: true });
            offset = end;
        }
        const finishBody = new Blob();
        return this.contentRequest('/files/upload_session/finish', {
            cursor: { session_id: startValue.session_id, offset },
            commit: this.commitInfo(options.path, options.mode),
            content_hash: await calculateDropboxContentHash(finishBody),
        }, finishBody, { reconcileOnFailure: true });
    }

    private async rpc(
        endpoint: string,
        body: Record<string, unknown>,
        options: { allowNotFound?: boolean; safeToRetry?: boolean } = {},
    ): Promise<Response | null> {
        const response = await this.request(`${DROPBOX_API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, { safeToRetry: options.safeToRetry });
        if (response.ok) return response;
        const failure = await normalizeFailure(response);
        if (options.allowNotFound && failure.tags.has('not_found')) return null;
        this.throwFailure(response, failure);
    }

    private async contentRequest(
        endpoint: string,
        args: Record<string, unknown>,
        body?: Blob,
        options: { reconcileOnFailure?: boolean } = {},
    ): Promise<Response> {
        let response: Response;
        try {
            response = await this.request(`${DROPBOX_CONTENT_API}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': headerSafeJson(args),
                },
                body,
            }, { safeToRetry: !options.reconcileOnFailure, upload: Boolean(body) });
        } catch (error) {
            if (options.reconcileOnFailure && error instanceof DropboxNetworkError) throw error;
            throw error;
        }
        if (response.ok) return response;
        const failure = await normalizeFailure(response);
        this.throwFailure(response, failure);
    }

    private async request(
        url: string,
        init: RequestInit,
        options: { safeToRetry?: boolean; upload?: boolean } = {},
        retryCount = 0,
        authRetried = false,
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            options.upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
        );
        let response: Response;
        try {
            const token = await this.tokenProvider.getToken({ forceRefresh: authRetried });
            response = await fetch(url, {
                ...init,
                signal: init.signal ?? controller.signal,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...init.headers,
                },
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch (error) {
            if (error instanceof DropboxAccessTokenError) {
                if (error.code === 'SESSION_NOT_FOUND'
                    || error.code === 'SESSION_PROVIDER_MISMATCH'
                    || error.code === 'REFRESH_FAILED') {
                    throw new CloudFileStoreError(
                        'unauthenticated',
                        'Dropbox session expired. Reconnect Dropbox.',
                        { provider: this.provider },
                    );
                }
                if (error.code === 'MISSING_REQUIRED_SCOPE') {
                    throw new CloudFileStoreError(
                        'missing-scope',
                        'Dropbox file permission is missing. Reconnect Dropbox.',
                        { provider: this.provider },
                    );
                }
                if (error.code === 'PROVIDER_DISABLED') {
                    throw new CloudFileStoreError(
                        'policy-disabled',
                        'Dropbox access is currently disabled.',
                        { provider: this.provider },
                    );
                }
                if (error.code === 'RATE_LIMITED') {
                    throw new CloudFileStoreError(
                        'rate-limited',
                        'Dropbox token requests are temporarily rate limited.',
                        {
                            provider: this.provider,
                            retryAfterMs: error.retryAfterSeconds
                                ? error.retryAfterSeconds * 1000
                                : undefined,
                        },
                    );
                }
                throw new CloudFileStoreError(
                    'transient-unavailable',
                    'Dropbox token service is temporarily unavailable.',
                    { provider: this.provider },
                );
            }
            if (options.safeToRetry && retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (2 ** retryCount), 30_000)));
                return this.request(url, init, options, retryCount + 1, authRetried);
            }
            throw new DropboxNetworkError();
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.status === 401 && !authRetried) {
            this.tokenProvider.clearToken();
            return this.request(url, init, options, retryCount, true);
        }
        if (options.safeToRetry
            && (response.status === 429
                || (response.status >= 500 && response.status !== 507))
            && retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, getRetryDelay(response, retryCount)));
            return this.request(url, init, options, retryCount + 1, authRetried);
        }
        return response;
    }

    private async readJson(response: Response): Promise<Record<string, unknown>> {
        try {
            const value: unknown = await response.json();
            if (isRecord(value)) return value;
        } catch {
            // Sanitized below.
        }
        throw new CloudFileStoreError(
            'invalid-response',
            'Dropbox returned an invalid response.',
            { provider: this.provider },
        );
    }

    private throwFailure(response: Response, failure: DropboxFailure): never {
        if (response.status === 401) {
            throw new CloudFileStoreError(
                'unauthenticated',
                'Dropbox authorization expired. Reconnect Dropbox.',
                { provider: this.provider },
            );
        }
        if (response.status === 403) {
            throw new CloudFileStoreError(
                'missing-scope',
                'Dropbox file permission is missing. Reconnect Dropbox.',
                { provider: this.provider },
            );
        }
        if (response.status === 429 || failure.tags.has('too_many_write_operations')) {
            throw new CloudFileStoreError(
                'rate-limited',
                'Dropbox is temporarily rate limited. Try again shortly.',
                { provider: this.provider, retryAfterMs: getRetryDelay(response, 0) },
            );
        }
        if (response.status === 507 || failure.tags.has('insufficient_space')) {
            throw new CloudFileStoreError(
                'insufficient-storage',
                'Dropbox storage is full. Free space and try syncing again.',
                { provider: this.provider },
            );
        }
        if (failure.tags.has('not_found')) {
            throw new CloudFileStoreError(
                'not-found',
                'Dropbox TaskTime file was not found.',
                { provider: this.provider },
            );
        }
        if (response.status === 409) {
            throw new CloudFileStoreError(
                'conflict',
                'Dropbox reported a conflicting TaskTime file operation.',
                { provider: this.provider },
            );
        }
        if (response.status >= 500) {
            throw new CloudFileStoreError(
                'transient-unavailable',
                'Dropbox is temporarily unavailable.',
                { provider: this.provider },
            );
        }
        throw new CloudFileStoreError(
            'invalid-response',
            `Dropbox request failed (${response.status}).`,
            { provider: this.provider },
        );
    }
}
