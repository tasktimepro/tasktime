/**
 * Yjs Store - Main exports
 * 
 * This is the entry point for the Yjs-based state management system.
 * Import from '@/stores/yjs' to access the store and helpers.
 * 
 * @example
 * ```typescript
 * import { getYjsStore, createProjectHelpers } from '@/stores/yjs';
 * 
 * const store = getYjsStore();
 * await store.initialize();
 * 
 * const projectHelpers = createProjectHelpers(store.projects);
 * const allProjects = projectHelpers.getAll();
 * ```
 */

// Store
export { YjsStore, getYjsStore, resetYjsStore } from './YjsStore';
export type {
    CloudTransferDocumentSnapshot,
    CloudTransferWorkspaceSnapshot,
} from './YjsStore';
export {
    CloudProviderTransferCoordinator,
    CloudTransferError,
    isRecoverableCloudTransferError,
} from './CloudProviderTransferCoordinator';
export type {
    CloudProviderTransferOptions,
    CloudTransferErrorCode,
} from './CloudProviderTransferCoordinator';

// Document manager
export { YjsDocManager } from './YjsDocManager';

// Providers
export {
    YjsCloudSyncProvider,
    YjsDriveProvider,
    CloudProviderMovedError,
    withCloudSyncExclusiveLock,
    AuthorizationError,
    DriveTransportDisabledError,
    isCloudFileNotFoundError,
} from './providers';
export { CloudManifestManager, ManifestManager } from './providers';
export { BackupManager, CloudBackupManager } from './providers';
export { CloudFileStoreError, DropboxFileStore, GoogleDriveFileStore } from './providers';
export type {
    CloudBindingMarkerV1,
    CloudManifestFingerprint,
    Manifest,
    DocManifest,
    DeltaInfo,
    BackupInfo,
    CloudBackupManagerOptions,
    CloudManifestManagerOptions,
    CloudSyncConnectionOptions,
    CloudSyncLockPermit,
    CloudSyncLockResult,
    DriveConnectionOptions,
    DriveTransport,
    CloudFileStore,
    CloudFileStoreErrorCode,
    CloudNamespace,
    CloudObjectMetadata,
    CloudProviderId,
    GoogleDriveFileStoreOptions,
} from './providers';

// Types
export type {
    DocName,
    SyncState,
    SyncPhase,
    AutoSyncMode,
    CloudSyncMode,
    DriveSyncMode,
    Project,
    Task,
    TimeEntry,
    Invoice,
    InvoiceItem,
    Client,
    BusinessInfo,
    InvoiceTemplate,
    PaymentMethod,
    ExpenseCategory,
    Preferences,
    MultiTimerState,
    TaxReturnPeriod,
} from './types';

// Collection helpers
export {
    createProjectHelpers,
    createTaskHelpers,
    createTimeEntryHelpers,
    createClientHelpers,
    createInvoiceHelpers,
    createBusinessInfoHelpers,
    createInvoiceTemplateHelpers,
    createPaymentMethodHelpers,
    createPreferencesHelpers,
    createTimerHelpers,
} from './collections';

export type {
    ProjectHelpers,
    TaskHelpers,
    TimeEntryHelpers,
    ClientHelpers,
    InvoiceHelpers,
    BusinessInfoHelpers,
    InvoiceTemplateHelpers,
    PaymentMethodHelpers,
    PreferencesHelpers,
    TimerHelpers,
} from './collections';
