/**
 * Provider-neutral object-storage contract for cloud sync and backups.
 *
 * Core sync code owns logical names and bytes. Adapters own provider paths,
 * opaque identifiers, revisions, request headers, pagination, and errors.
 */

export type CloudProviderId = 'google-drive' | 'dropbox';

export type CloudNamespace = 'sync' | 'backups';

export interface CloudObjectMetadata {
    logicalName: string;
    opaqueId: string;
    revision?: string;
    modifiedTime: string;
    contentHash?: string;
    size?: number;
}

export type CloudFileStoreErrorCode =
    | 'unauthenticated'
    | 'missing-scope'
    | 'not-found'
    | 'conflict'
    | 'rate-limited'
    | 'insufficient-storage'
    | 'transient-unavailable'
    | 'invalid-response'
    | 'policy-disabled';

interface CloudFileStoreErrorOptions {
    provider: CloudProviderId;
    retryAfterMs?: number;
}

/**
 * Sanitized provider failure. Upstream response bodies, credentials, paths,
 * and account identifiers must never be retained in this error.
 */
export class CloudFileStoreError extends Error {
    readonly code: CloudFileStoreErrorCode;
    readonly provider: CloudProviderId;
    readonly retryAfterMs?: number;

    constructor(
        code: CloudFileStoreErrorCode,
        message: string,
        options: CloudFileStoreErrorOptions,
    ) {
        super(message);
        this.name = 'CloudFileStoreError';
        this.code = code;
        this.provider = options.provider;
        this.retryAfterMs = options.retryAfterMs;
    }
}

export interface CloudFileStore {
    readonly provider: CloudProviderId;

    list(namespace: CloudNamespace): Promise<CloudObjectMetadata[]>;

    getMetadata(
        namespace: CloudNamespace,
        logicalName: string,
    ): Promise<CloudObjectMetadata | null>;

    download(object: CloudObjectMetadata): Promise<ArrayBuffer>;

    create(
        namespace: CloudNamespace,
        logicalName: string,
        body: Blob,
    ): Promise<CloudObjectMetadata>;

    replace(
        object: CloudObjectMetadata,
        body: Blob,
        expectedRevision?: string,
    ): Promise<CloudObjectMetadata>;

    delete(
        object: CloudObjectMetadata,
        expectedRevision?: string,
    ): Promise<void>;
}
