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

// Document manager
export { YjsDocManager } from './YjsDocManager';

// Providers
export { YjsDriveProvider, AuthorizationError } from './providers';
export { ManifestManager } from './providers';
export type { Manifest, DocManifest, DeltaInfo } from './providers';

// Types
export type {
    DocName,
    SyncState,
    SyncPhase,
    AutoSyncMode,
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
    Preferences,
    TimerState,
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
