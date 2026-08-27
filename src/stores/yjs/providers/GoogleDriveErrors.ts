import { CloudFileStoreError, type CloudFileStoreErrorCode } from './CloudFileStore';

export class AuthorizationError extends CloudFileStoreError {
    constructor(
        message: string,
        code: Extract<CloudFileStoreErrorCode, 'unauthenticated' | 'missing-scope'> = 'unauthenticated',
    ) {
        super(code, message, { provider: 'google-drive' });
        this.name = 'AuthorizationError';
    }
}

export class DriveStorageQuotaError extends CloudFileStoreError {
    constructor() {
        super(
            'insufficient-storage',
            'Google Drive storage is full. Free space and try syncing again.',
            { provider: 'google-drive' },
        );
        this.name = 'DriveStorageQuotaError';
    }
}

export class DriveRateLimitError extends CloudFileStoreError {
    constructor(retryAfterMs?: number) {
        super(
            'rate-limited',
            'Google Drive is temporarily rate limited. Try syncing again shortly.',
            { provider: 'google-drive', retryAfterMs },
        );
        this.name = 'DriveRateLimitError';
    }
}

export class DriveFileNotFoundError extends CloudFileStoreError {
    constructor() {
        super(
            'not-found',
            'Drive API error 404: file not found',
            { provider: 'google-drive' },
        );
        this.name = 'DriveFileNotFoundError';
    }
}

export class DriveConnectivityError extends CloudFileStoreError {
    constructor() {
        super(
            'transient-unavailable',
            'Unable to reach Google Drive. Your local changes remain saved and will retry.',
            { provider: 'google-drive' },
        );
        this.name = 'DriveConnectivityError';
    }
}

export class DriveTransportDisabledError extends CloudFileStoreError {
    constructor() {
        super(
            'policy-disabled',
            'Direct Google Drive access was disabled. Sync will return to the compatibility transport.',
            { provider: 'google-drive' },
        );
        this.name = 'DriveTransportDisabledError';
    }
}
