/**
 * Yjs Providers index
 * 
 * Re-exports all sync providers
 */

export {
    CloudManifestManager,
    ManifestManager,
    AuthorizationError,
    DriveConnectivityError,
    DriveFileNotFoundError,
    DriveRateLimitError,
    DriveStorageQuotaError,
    DriveTransportDisabledError,
    isCloudFileNotFoundError,
} from './ManifestManager';
export type {
    CloudBindingMarkerV1,
    CloudManifestFingerprint,
    CloudManifestManagerOptions,
    Manifest,
    DocManifest,
    DeltaInfo,
    DriveTokenProvider,
    DriveTransport,
    ManifestManagerOptions,
} from './ManifestManager';

export { CloudFileStoreError } from './CloudFileStore';
export type {
    CloudFileStore,
    CloudFileStoreErrorCode,
    CloudNamespace,
    CloudObjectMetadata,
    CloudProviderId,
} from './CloudFileStore';

export { GoogleDriveFileStore } from './GoogleDriveFileStore';
export type { GoogleDriveFileStoreOptions } from './GoogleDriveFileStore';

export { DropboxFileStore, calculateDropboxContentHash } from './DropboxFileStore';
export type { DropboxTokenProvider } from './DropboxFileStore';

export {
    CloudProviderMovedError,
    YjsCloudSyncProvider,
    YjsDriveProvider,
    withCloudSyncExclusiveLock,
} from './GoogleDriveProvider';
export type {
    CloudSyncConnectionOptions,
    CloudSyncLockPermit,
    CloudSyncLockResult,
    DriveConnectionOptions,
} from './GoogleDriveProvider';

export {
    DriveAccessTokenError,
    DriveAccessTokenProvider,
    driveAccessTokenProvider,
} from './DriveAccessTokenProvider';

export {
    DropboxAccessTokenError,
    DropboxAccessTokenProvider,
    dropboxAccessTokenProvider,
} from './DropboxAccessTokenProvider';

export { BackupManager, CloudBackupManager } from './BackupManager';
export type { BackupInfo, CloudBackupManagerOptions } from './BackupManager';
