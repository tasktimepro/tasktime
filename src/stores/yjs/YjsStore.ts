/**
 * YjsStore - Main store class for Yjs-based state management
 * 
 * This is the central store that manages all Yjs documents and provides
 * access to collections. It handles:
 * - Core document initialization
 * - On-demand document loading for archived data
 * - Automatic archival of old entries
 * - Google Drive sync integration
 */

import * as Y from 'yjs';
import { YjsDocManager } from './YjsDocManager';
import { YjsDriveProvider } from './providers/GoogleDriveProvider';
import type {
    DocName,
    SyncState,
    SyncPhase,
    DriveSyncMode,
    AutoSyncMode,
    Project,
    Task,
    TimeEntry,
    Invoice,
    Client,
    BusinessInfo,
    InvoiceTemplate,
    PaymentMethod,
    Preferences,
    MultiTimerState,
} from './types';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export class YjsStore {

    private docManager: YjsDocManager;
    private driveProvider: YjsDriveProvider | null = null;
    private _isReady: boolean = false;
    private driveSyncMode: DriveSyncMode = 'manual';

    // Core docs (always loaded after init)
    private _coreDoc: Y.Doc | null = null;
    private _activeEntriesDoc: Y.Doc | null = null;

    // On-demand docs (lazy loaded)
    private _archivedTasksDoc: Y.Doc | null = null;
    private _archivedTasksLoading: Promise<Y.Doc> | null = null;
    private _archivedInvoicesDoc: Y.Doc | null = null;
    private _archivedInvoicesLoading: Promise<Y.Doc> | null = null;

    constructor() {
        this.docManager = new YjsDocManager();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    /**
     * Initialize core documents (must be called on app start)
     */
    async initialize(): Promise<void> {
        console.log('[YjsStore] Initializing...');

        // Load always-needed documents
        this._coreDoc = await this.docManager.getDoc('core');
        this._activeEntriesDoc = await this.docManager.getDoc('entries-active');

        // Run automatic archival of old data
        await this.archiveOldEntries();
        await this.archiveOldInvoices();

        this._isReady = true;
        console.log('[YjsStore] Initialized');
    }

    get isReady(): boolean {
        return this._isReady;
    }

    // =========================================================================
    // Core Doc Accessors (Always Available After Init)
    // =========================================================================

    get projects(): Y.Map<string, Project> {
        this.assertReady();
        return this._coreDoc!.getMap('projects');
    }

    /**
     * Active (non-archived) tasks - always loaded
     */
    get tasks(): Y.Map<string, Task> {
        this.assertReady();
        return this._coreDoc!.getMap('tasks');
    }

    get clients(): Y.Map<string, Client> {
        this.assertReady();
        return this._coreDoc!.getMap('clients');
    }

    get businessInfos(): Y.Map<string, BusinessInfo> {
        this.assertReady();
        return this._coreDoc!.getMap('businessInfos');
    }

    get invoiceTemplates(): Y.Map<string, InvoiceTemplate> {
        this.assertReady();
        return this._coreDoc!.getMap('invoiceTemplates');
    }

    get paymentMethods(): Y.Map<string, PaymentMethod> {
        this.assertReady();
        return this._coreDoc!.getMap('paymentMethods');
    }

    get preferences(): Y.Map<string, Preferences[keyof Preferences]> {
        this.assertReady();
        return this._coreDoc!.getMap('preferences');
    }

    get timers(): Y.Map<string, MultiTimerState> {
        this.assertReady();
        return this._coreDoc!.getMap('timers');
    }

    /**
     * Get the core document for transactions
     */
    get coreDoc(): Y.Doc {
        this.assertReady();
        return this._coreDoc!;
    }

    /**
     * Get the active entries document for transactions
     */
    get activeEntriesDoc(): Y.Doc {
        this.assertReady();
        return this._activeEntriesDoc!;
    }

    /**
     * Active invoices (unpaid + current year paid) - always in core
     */
    get invoices(): Y.Map<string, Invoice> {
        this.assertReady();
        return this._coreDoc!.getMap('invoices');
    }

    /**
     * Active time entries (last 90 days) - always loaded
     */
    get activeTimeEntries(): Y.Map<string, TimeEntry> {
        this.assertReady();
        return this._activeEntriesDoc!.getMap('timeEntries');
    }

    // =========================================================================
    // Archived Tasks (On-Demand)
    // =========================================================================

    /**
     * Load archived tasks document (on-demand)
     * Call this when user views a project that has archived tasks
     */
    async loadArchivedTasks(): Promise<Y.Map<string, Task>> {
        if (!this._archivedTasksDoc) {
            if (!this._archivedTasksLoading) {
                this._archivedTasksLoading = this.docManager.getDoc('tasks-archived');
            }
            this._archivedTasksDoc = await this._archivedTasksLoading;
            this._archivedTasksLoading = null;

            // Sync with Drive if connected
            if (this.driveProvider?.isConnected()) {
                await this.driveProvider.syncAndSubscribeDoc('tasks-archived');
            }
        }
        return this._archivedTasksDoc.getMap('tasks');
    }

    /**
     * Check if archived tasks are loaded
     */
    get archivedTasksLoaded(): boolean {
        return this._archivedTasksDoc !== null;
    }

    /**
     * Get archived tasks synchronously (only if loaded)
     */
    get archivedTasks(): Y.Map<string, Task> | null {
        return this._archivedTasksDoc?.getMap('tasks') ?? null;
    }

    /**
     * Get all tasks (active + archived) for lifetime stats
     * Loads archived doc if not already loaded
     */
    async getAllTasks(): Promise<Task[]> {
        const allTasks: Task[] = [];

        // Active tasks (always available)
        for (const task of this.tasks.values()) {
            allTasks.push(task);
        }

        // Archived tasks (load if needed)
        const archivedMap = await this.loadArchivedTasks();
        for (const task of archivedMap.values()) {
            allTasks.push(task);
        }

        return allTasks;
    }

    /**
     * Archive a task (move from active to archived doc)
     */
    async archiveTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const archivedMap = await this.loadArchivedTasks();

        // Add to archived doc
        archivedMap.set(taskId, {
            ...task,
            archived: true,
        });

        // Remove from active
        this.tasks.delete(taskId);

        console.log(`[YjsStore] Archived task ${taskId}`);
    }

    /**
     * Unarchive a task (move from archived to active doc)
     */
    async unarchiveTask(taskId: string): Promise<void> {
        const archivedMap = await this.loadArchivedTasks();
        const task = archivedMap.get(taskId);
        if (!task) return;

        // Add back to active doc
        this.tasks.set(taskId, {
            ...task,
            archived: false,
        });

        // Remove from archived
        archivedMap.delete(taskId);

        console.log(`[YjsStore] Unarchived task ${taskId}`);
    }

    // =========================================================================
    // Time Entries (Multi-Doc)
    // =========================================================================

    /**
     * Get all time entries from currently loaded documents
     * Note: Only returns entries from loaded docs - call loadEntriesForYear() first if needed
     */
    getAllTimeEntries(): TimeEntry[] {
        const entries: TimeEntry[] = [];

        // Active entries
        for (const entry of this.activeTimeEntries.values()) {
            entries.push(entry);
        }

        // Archived entries (from loaded year docs)
        for (const docName of this.docManager.getLoadedDocs()) {
            if (docName.startsWith('entries-') && docName !== 'entries-active') {
                const doc = this.docManager.getDocSync(docName);
                if (doc) {
                    const yearEntries = doc.getMap<TimeEntry>('timeEntries');
                    for (const entry of yearEntries.values()) {
                        entries.push(entry);
                    }
                }
            }
        }

        return entries;
    }

    /**
     * Load entries for a specific year (on-demand)
     */
    async loadEntriesForYear(year: number): Promise<Y.Map<string, TimeEntry>> {
        const docName = `entries-${year}` as DocName;
        const wasLoaded = this.docManager.isLoaded(docName);
        const doc = await this.docManager.getDoc(docName);

        // Sync with Drive if this is a newly loaded doc
        if (!wasLoaded && this.driveProvider?.isConnected()) {
            await this.driveProvider.syncAndSubscribeDoc(docName);
        }

        return doc.getMap('timeEntries');
    }

    /**
     * Check if a year's entries are loaded
     */
    isYearLoaded(year: number): boolean {
        return this.docManager.isLoaded(`entries-${year}` as DocName);
    }

    /**
     * Load ALL time entries across all years (for lifetime stats)
     */
    async loadAllTimeEntries(): Promise<TimeEntry[]> {
        const entries: TimeEntry[] = [];

        // Active entries
        for (const entry of this.activeTimeEntries.values()) {
            entries.push(entry);
        }

        // Get all years from local docs
        const years = this.getLocalYears();

        // Load each year's entries
        for (const year of years) {
            const yearEntries = await this.loadEntriesForYear(year);
            for (const entry of yearEntries.values()) {
                entries.push(entry);
            }
        }

        return entries;
    }

    /**
     * Get list of years that have time entries (from local docs)
     */
    getLocalYears(): number[] {
        const years = new Set<number>();

        // Check loaded docs
        for (const docName of this.docManager.getLoadedDocs()) {
            const match = docName.match(/^entries-(\d{4})$/);
            if (match) {
                years.add(parseInt(match[1], 10));
            }
        }

        return Array.from(years).sort((a, b) => b - a); // Descending
    }

    // =========================================================================
    // Archived Invoices (On-Demand)
    // =========================================================================

    /**
     * Load archived invoices (paid from previous years) - on-demand
     */
    async loadArchivedInvoices(): Promise<Y.Map<string, Invoice>> {
        if (!this._archivedInvoicesDoc) {
            if (!this._archivedInvoicesLoading) {
                this._archivedInvoicesLoading = this.docManager.getDoc('invoices-archived');
            }
            this._archivedInvoicesDoc = await this._archivedInvoicesLoading;
            this._archivedInvoicesLoading = null;

            // Sync with Drive if connected
            if (this.driveProvider?.isConnected()) {
                await this.driveProvider.syncAndSubscribeDoc('invoices-archived');
            }
        }
        return this._archivedInvoicesDoc.getMap('invoices');
    }

    /**
     * Check if archived invoices are loaded
     */
    get archivedInvoicesLoaded(): boolean {
        return this._archivedInvoicesDoc !== null;
    }

    /**
     * Get archived invoices synchronously (only if loaded)
     */
    get archivedInvoicesSync(): Y.Map<string, Invoice> | null {
        return this._archivedInvoicesDoc?.getMap('invoices') ?? null;
    }

    /**
     * Get all invoices (active + archived)
     * Loads archived doc if not already loaded
     */
    async getAllInvoices(): Promise<Invoice[]> {
        const allInvoices: Invoice[] = [];

        // Active invoices (always available)
        for (const invoice of this.invoices.values()) {
            allInvoices.push(invoice);
        }

        // Archived invoices (load if needed)
        const archivedMap = await this.loadArchivedInvoices();
        for (const invoice of archivedMap.values()) {
            allInvoices.push(invoice);
        }

        return allInvoices;
    }

    // =========================================================================
    // Automatic Archival
    // =========================================================================

    /**
     * Move old entries from active to year-based documents
     * Called automatically on app start
     */
    private async archiveOldEntries(): Promise<void> {
        const cutoff = Date.now() - NINETY_DAYS_MS;
        const toArchive: Map<number, TimeEntry[]> = new Map();

        // Access doc directly (not via getter, since we're in initialization)
        const activeEntries = this._activeEntriesDoc!.getMap<TimeEntry>('timeEntries');

        // Find entries to archive
        for (const [id, entry] of activeEntries) {
            if (entry.start < cutoff) {
                const year = new Date(entry.start).getFullYear();
                if (!toArchive.has(year)) {
                    toArchive.set(year, []);
                }
                toArchive.get(year)!.push(entry);
            }
        }

        // Move entries to year documents
        for (const [year, entries] of toArchive) {
            const yearDoc = await this.docManager.getDoc(`entries-${year}` as DocName);
            const yearEntries = yearDoc.getMap<TimeEntry>('timeEntries');

            for (const entry of entries) {
                yearEntries.set(entry.id, entry);
                activeEntries.delete(entry.id);
            }

            console.log(`[YjsStore] Archived ${entries.length} entries to ${year}`);
        }
    }

    /**
     * Move paid invoices from previous years to archived document
     * Called automatically on app start
     */
    private async archiveOldInvoices(): Promise<void> {
        const currentYear = new Date().getFullYear();
        const toArchive: Invoice[] = [];

        // Access doc directly (not via getter, since we're in initialization)
        const invoicesMap = this._coreDoc!.getMap<Invoice>('invoices');

        // Find paid invoices from previous years
        for (const [id, invoice] of invoicesMap) {
            if (invoice.status === 'paid' && invoice.paidAt) {
                const paidYear = new Date(invoice.paidAt).getFullYear();
                if (paidYear < currentYear) {
                    toArchive.push(invoice);
                }
            }
        }

        if (toArchive.length === 0) return;

        // Move to archived document
        const archivedMap = await this.loadArchivedInvoices();

        for (const invoice of toArchive) {
            archivedMap.set(invoice.id, invoice);
            invoicesMap.delete(invoice.id);
        }

        console.log(`[YjsStore] Archived ${toArchive.length} paid invoices from previous years`);
    }

    // =========================================================================
    // Google Drive Sync
    // =========================================================================

    /**
     * Connect to Google Drive and start syncing
     * @param accessToken - Access token (for direct auth mode)
     * @param sessionId - Session ID (for Worker proxy mode)
     */
    async connectDrive(accessToken: string, sessionId?: string | null): Promise<void> {
        if (this.driveProvider) {
            this.driveProvider.disconnect();
        }

        this.driveProvider = new YjsDriveProvider(this.docManager, accessToken, sessionId);
        this.driveProvider.setSyncMode(this.driveSyncMode);
        await this.driveProvider.connect();
    }

    /**
     * Disconnect from Google Drive
     */
    disconnectDrive(): void {
        this.driveProvider?.disconnect();
        this.driveProvider = null;
    }

    /**
     * Check if connected to Google Drive
     */
    isDriveConnected(): boolean {
        return this.driveProvider?.isConnected() ?? false;
    }

    /**
     * Force immediate sync with Google Drive
     */
    async forceDriveSync(): Promise<void> {
        await this.driveProvider?.sync(true);
    }

    /**
     * Set Drive auto-sync preferences (manual/backup/sync)
     */
    setDriveSyncPreferences(autoSyncEnabled: boolean, autoSyncMode: AutoSyncMode): void {
        const resolvedMode: DriveSyncMode = autoSyncEnabled
            ? (autoSyncMode === 'backup' ? 'backup' : 'sync')
            : 'manual';

        this.driveSyncMode = resolvedMode;
        this.driveProvider?.setSyncMode(resolvedMode);
    }

    /**
     * Get current Drive sync mode
     */
    getDriveSyncMode(): DriveSyncMode {
        return this.driveSyncMode;
    }

    /**
     * Subscribe to sync state changes
     */
    onSyncStateChange(callback: (state: SyncState) => void): () => void {
        if (!this.driveProvider) return () => {};
        return this.driveProvider.onStateChange(callback);
    }

    /**
     * Subscribe to sync phase changes
     */
    onSyncPhaseChange(callback: (phase: SyncPhase) => void): () => void {
        if (!this.driveProvider) return () => {};
        return this.driveProvider.onPhaseChange(callback);
    }

    /**
     * Subscribe to pending sync change updates
     */
    onPendingSyncChange(callback: (hasPending: boolean) => void): () => void {
        if (!this.driveProvider) return () => {};
        return this.driveProvider.onPendingChange(callback);
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState {
        return this.driveProvider?.getState() ?? 'idle';
    }

    /**
     * Get current sync phase
     */
    getSyncPhase(): SyncPhase {
        return this.driveProvider?.getPhase() ?? 'idle';
    }

    /**
     * Get last synced timestamp (ms since epoch) from Drive manifest
     */
    getLastSyncedAt(): number | null {
        return this.driveProvider?.getLastSyncedAt() ?? null;
    }

    /**
     * Check if there are local changes pending upload
     */
    hasPendingSyncChanges(): boolean {
        return this.driveProvider?.hasLocalChangesToPush() ?? false;
    }

    /**
     * Update access token (for token refresh)
     */
    updateDriveAccessToken(token: string): void {
        this.driveProvider?.updateAccessToken(token);
    }

    /**
     * Update session ID (for Worker proxy mode)
     */
    updateDriveSessionId(sessionId: string | null): void {
        this.driveProvider?.updateSessionId(sessionId);
    }

    /**
     * Wipe all TaskTime files from Google Drive (appDataFolder)
     */
    async wipeDriveData(): Promise<void> {
        if (!this.driveProvider) {
            throw new Error('Drive not connected');
        }

        await this.driveProvider.wipeDriveData();
    }

    /**
     * Get available years for time entries (from Drive manifest)
     */
    async getAvailableYears(): Promise<number[]> {
        const localYears = this.getLocalYears();
        const driveYears = this.driveProvider?.getEntryYears() ?? [];
        
        const allYears = new Set([...localYears, ...driveYears]);
        return Array.from(allYears).sort((a, b) => b - a);
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    /**
     * Clear all data from all collections and IndexedDB databases
     * This is a destructive operation - use for "delete all data" functionality
     */
    async clearAllData(): Promise<void> {
        console.log('[YjsStore] Clearing all data...');
        
        // Disconnect from Drive sync first
        this.driveProvider?.disconnect();
        this.driveProvider = null;

        // Destroy in-memory docs and remove IndexedDB persistence to avoid syncing deletions
        const docNames = new Set<DocName>([
            'core',
            'entries-active',
            'tasks-archived',
            'invoices-archived'
        ]);
        for (const name of this.docManager.getLoadedDocs()) {
            docNames.add(name);
        }

        this.docManager.destroy();
        await this.docManager.deleteDatabases(Array.from(docNames));

        this._coreDoc = null;
        this._activeEntriesDoc = null;
        this._archivedTasksDoc = null;
        this._archivedTasksLoading = null;
        this._archivedInvoicesDoc = null;
        this._archivedInvoicesLoading = null;
        this._isReady = false;

        // Delete all IndexedDB databases
        const dbNames = [
            'yjs-tasktime-core',
            'yjs-tasktime-entries-active',
            'yjs-tasktime-tasks-archived',
            'yjs-tasktime-invoices-archived',
        ];
        
        // Add year-based entry dbs
        const currentYear = new Date().getFullYear();
        for (let year = 2020; year <= currentYear; year++) {
            dbNames.push(`yjs-tasktime-entries-${year}`);
        }

        // Delete each database
        for (const dbName of dbNames) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(dbName);
                    request.onsuccess = () => {
                        console.log(`[YjsStore] Deleted database: ${dbName}`);
                        resolve();
                    };
                    request.onerror = () => reject(request.error);
                    request.onblocked = () => {
                        console.warn(`[YjsStore] Database deletion blocked: ${dbName}`);
                        resolve(); // Continue anyway
                    };
                });
            } catch (e) {
                console.warn(`[YjsStore] Failed to delete database ${dbName}:`, e);
            }
        }

        console.log('[YjsStore] All data cleared');
    }

    /**
     * Destroy the store and cleanup all resources
     */
    destroy(): void {
        console.log('[YjsStore] Destroying...');
        this.driveProvider?.disconnect();
        this.driveProvider = null;
        this.docManager.destroy();
        this._coreDoc = null;
        this._activeEntriesDoc = null;
        this._archivedTasksDoc = null;
        this._archivedInvoicesDoc = null;
        this._isReady = false;
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    private assertReady(): void {
        if (!this._isReady) {
            throw new Error('[YjsStore] Store not initialized. Call initialize() first.');
        }
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let storeInstance: YjsStore | null = null;

/**
 * Get the singleton YjsStore instance
 */
export function getYjsStore(): YjsStore {
    if (!storeInstance) {
        storeInstance = new YjsStore();
    }
    return storeInstance;
}

/**
 * Reset the store (for testing or logout)
 */
export function resetYjsStore(): void {
    storeInstance?.destroy();
    storeInstance = null;
}
