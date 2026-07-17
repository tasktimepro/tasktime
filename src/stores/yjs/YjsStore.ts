/**
 * YjsStore - Main store class for Yjs-based state management
 *
 * Sync contract source of truth: ../../components/sync/README.md
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
import { YjsDriveProvider, type DriveConnectionOptions } from './providers/GoogleDriveProvider';
import { BackupManager } from './providers/BackupManager';
import type { BackupInfo } from './providers/BackupManager';
import { normalizeInvoiceRecord } from '@/utils/invoiceUtils';
import { createBackupPayload, validateBackupImportPayload, type BackupImportPayload, type BackupPayload } from '@/utils/backupData';
import { parseStoredDate } from '@/utils/dateUtils';
import { getTaskIdsWithDescendants } from '@/utils/taskUtils';
import { generateId } from '@/utils/idUtils';
import { readEntity, objectToYMap, collectEntities, forEachEntity, updateEntityFields } from './entityUtils';
import { collectValidatedEntities, validateCollectionEntity } from './validation';
import { clearSyncPersistence } from '@/utils/syncPersistence';
import {
    clearRestoreJournal,
    readRestoreJournal,
    writeRestoreJournal,
    type RestoreJournalRecord,
} from './restoreJournal';
import type {
    BusinessBrandAsset,
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
    EmailTemplate,
    PaymentMethod,
    Expense,
    ExpenseCategory,
    ExpenseRecurrence,
    Preferences,
    MultiTimerState,
    TaxReturnPeriod,
    PlannerAttachment,
    DailyGoal,
    ArchiveTransition,
} from './types';
import type { InvoiceFinalizationApplicationPlan } from '@/domain/invoices/invoiceFinalizationApplication';
import {
    buildInvoiceSourceReleaseApplication,
    type InvoiceUndoApplicationPlan,
} from '@/domain/invoices/invoiceUndoApplication';
import {
    getInvoiceCancellationBlockReason,
    type InvoiceCancellationApplicationPlan,
} from '@/domain/invoices/invoiceCancellation';
import {
    createInvoiceCancellationOperation,
    createInvoiceFinalizationOperation,
    createInvoiceUndoOperation,
    isInvoiceBillingOperation,
    type InvoiceBillingOperation,
    type InvoiceBillingOperationPhase,
    type InvoiceCancellationOperation,
} from '@/domain/invoices/invoiceBillingOperation';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const DISCONNECTED_DIRTY_DOCS_STORAGE_KEY = 'tasktime-disconnected-dirty-docs';

type DocUpdateHandler = (...args: unknown[]) => void;
type ArchiveEntity = Task | TimeEntry | Invoice | Expense;

function readArchiveTransition(entity: ArchiveEntity | null): ArchiveTransition | null {
    const transition = entity?._archiveTransition;

    if (
        !transition
        || typeof transition.operationId !== 'string'
        || typeof transition.targetDoc !== 'string'
        || !Number.isFinite(transition.changedAt)
    ) {
        return null;
    }

    return transition;
}

function compareArchiveTransitions(left: ArchiveTransition, right: ArchiveTransition): number {
    if (left.changedAt !== right.changedAt) {
        return left.changedAt - right.changedAt;
    }

    return left.operationId.localeCompare(right.operationId);
}

function entityFreshness(entity: ArchiveEntity | null): number {
    if (!entity) return Number.NEGATIVE_INFINITY;

    const timestamps = entity as ArchiveEntity & { updatedAt?: number; createdAt?: number };

    return Math.max(
        Number.isFinite(timestamps.updatedAt) ? timestamps.updatedAt! : Number.NEGATIVE_INFINITY,
        Number.isFinite(timestamps.createdAt) ? timestamps.createdAt! : Number.NEGATIVE_INFINITY,
        readArchiveTransition(entity)?.changedAt ?? Number.NEGATIVE_INFINITY,
    );
}

function chooseFreshestEntity<T extends ArchiveEntity>(active: T, archived: T): T {
    return entityFreshness(active) > entityFreshness(archived) ? active : archived;
}

function areRecordsEquivalent(
    left: Record<string, unknown> | null | undefined,
    right: Record<string, unknown> | null | undefined,
): boolean {
    if (!left || !right) return left === right;

    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);

    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => (
            Object.prototype.hasOwnProperty.call(right, key)
            && JSON.stringify(left[key]) === JSON.stringify(right[key])
        ));
}

export class YjsStore {

    private docManager: YjsDocManager;
    private driveProvider: YjsDriveProvider | null = null;
    private backupManager: BackupManager | null = null;
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
    private _archivedExpensesDoc: Y.Doc | null = null;
    private _archivedExpensesLoading: Promise<Y.Doc> | null = null;
    private disconnectedDirtyDocs: Set<DocName>;
    private disconnectedDirtyDocHandlers: Map<DocName, DocUpdateHandler> = new Map();

    constructor() {
        this.docManager = new YjsDocManager();
        this.disconnectedDirtyDocs = this.readDisconnectedDirtyDocs();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    /**
     * Initialize core documents (must be called on app start)
     */
    async initialize(options: { skipRestoreRecovery?: boolean } = {}): Promise<void> {
        console.log('[YjsStore] Initializing...');

        if (!options.skipRestoreRecovery) {
            const restoreJournal = await readRestoreJournal();

            if (restoreJournal) {
                await this.recoverInterruptedRestore(restoreJournal);
                return;
            }
        }

        // Load always-needed documents
        this._coreDoc = await this.docManager.getDoc('core');
        this._activeEntriesDoc = await this.docManager.getDoc('entries-active');

        this.trackDocForDisconnectedChanges('core', this._coreDoc);
        this.trackDocForDisconnectedChanges('entries-active', this._activeEntriesDoc);

        this.normalizePersistedInvoiceMap(this._coreDoc.getMap('invoices'));

        // Run automatic archival of old data
        await this.archiveOldEntries();
        await this.archiveOldInvoices();
        await this.archiveOldExpenses();

        // Clean up planner attachments referencing deleted projects/clients
        this.cleanupOrphanedPlannerAttachments();

        this._isReady = true;

        try {
            await this.reconcileInvoiceBillingOperations({ includeCompleted: false });
        } catch (error) {
            console.error('[YjsStore] Pending invoice billing reconciliation error:', error);
        }

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

    get businessBrandAssets(): Y.Map<string, BusinessBrandAsset> {
        this.assertReady();
        return this._coreDoc!.getMap('businessBrandAssets');
    }

    get invoiceTemplates(): Y.Map<string, InvoiceTemplate> {
        this.assertReady();
        return this._coreDoc!.getMap('invoiceTemplates');
    }

    get emailTemplates(): Y.Map<string, EmailTemplate> {
        this.assertReady();
        return this._coreDoc!.getMap('emailTemplates');
    }

    get paymentMethods(): Y.Map<string, PaymentMethod> {
        this.assertReady();
        return this._coreDoc!.getMap('paymentMethods');
    }

    get expenseCategories(): Y.Map<string, ExpenseCategory> {
        this.assertReady();
        return this._coreDoc!.getMap('expenseCategories');
    }

    get taxReturnPeriods(): Y.Map<string, TaxReturnPeriod> {
        this.assertReady();
        return this._coreDoc!.getMap('taxReturnPeriods');
    }

    get expenses(): Y.Map<string, Expense> {
        this.assertReady();
        return this._coreDoc!.getMap('expenses');
    }

    get expenseRecurrences(): Y.Map<string, ExpenseRecurrence> {
        this.assertReady();
        return this._coreDoc!.getMap('expenseRecurrences');
    }

    get preferences(): Y.Map<string, Preferences[keyof Preferences]> {
        this.assertReady();
        return this._coreDoc!.getMap('preferences');
    }

    get timers(): Y.Map<string, MultiTimerState> {
        this.assertReady();
        return this._coreDoc!.getMap('timers');
    }

    get plannerAttachments(): Y.Map<string, PlannerAttachment> {
        this.assertReady();
        return this._coreDoc!.getMap('plannerAttachments');
    }

    get dailyGoals(): Y.Map<string, DailyGoal> {
        this.assertReady();
        return this._coreDoc!.getMap('dailyGoals');
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

    /** Durable cross-document invoice finalization and undo journal. */
    get invoiceBillingOperations(): Y.Map<string, InvoiceBillingOperation> {
        this.assertReady();
        return this._coreDoc!.getMap('invoiceBillingOperations');
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
    async loadArchivedTasks(options: { allowPullFromDrive?: boolean } = {}): Promise<Y.Map<string, Task>> {
        if (!this._archivedTasksDoc) {
            if (!this._archivedTasksLoading) {
                this._archivedTasksLoading = this.docManager.getDoc('tasks-archived');
            }
            this._archivedTasksDoc = await this._archivedTasksLoading;
            this._archivedTasksLoading = null;

            this.trackDocForDisconnectedChanges('tasks-archived', this._archivedTasksDoc);

            // Sync with Drive if connected
            if (this.driveProvider?.isConnected()) {
                if (this.isDisconnectedDirtyDoc('tasks-archived')) {
                    this.driveProvider.markDocsForFullStateUpload(['tasks-archived']);
                }

                await this.driveProvider.syncAndSubscribeDoc(
                    'tasks-archived',
                    options.allowPullFromDrive ? { allowPull: true } : undefined,
                );
                // Only clear dirty flag if the doc was actually synced (not manual mode)
                if (this.driveSyncMode !== 'manual' && this.canClearDisconnectedDirtyDocsAfterSync()) {
                    this.clearDisconnectedDirtyDocs(['tasks-archived']);
                }
            }
        }

        const archivedMap = this._archivedTasksDoc.getMap<Task>('tasks');
        this.reconcileTaskArchiveTransitions(archivedMap);
        return archivedMap;
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
    async getAllTasks(options: { allowPullFromDrive?: boolean } = {}): Promise<Task[]> {
        const allTasks: Task[] = [];

        // Active tasks (always available)
        allTasks.push(...collectEntities<Task>(this.tasks as any));

        // Archived tasks (load if needed)
        const archivedMap = await this.loadArchivedTasks(options);
        allTasks.push(...collectEntities<Task>(archivedMap as any));

        return allTasks;
    }

    async getAllExpenses(options: { allowPullFromDrive?: boolean } = {}): Promise<Expense[]> {
        const allExpenses: Expense[] = [];
        const seenIds = new Set<string>();

        for (const expense of collectEntities<Expense>(this.expenses as any)) {
            allExpenses.push(expense);
            seenIds.add(expense.id);
        }

        const archivedMap = await this.loadArchivedExpenses(options);

        for (const expense of collectEntities<Expense>(archivedMap as any)) {
            if (seenIds.has(expense.id)) {
                continue;
            }

            allExpenses.push(expense);
        }

        return allExpenses;
    }

    // =========================================================================
    // Archived Expenses (On-Demand)
    // =========================================================================

    /**
     * Load archived expenses document (on-demand)
     */
    async loadArchivedExpenses(options: { allowPullFromDrive?: boolean } = {}): Promise<Y.Map<string, Expense>> {
        if (!this._archivedExpensesDoc) {
            if (!this._archivedExpensesLoading) {
                this._archivedExpensesLoading = this.docManager.getDoc('expenses-archived');
            }
            this._archivedExpensesDoc = await this._archivedExpensesLoading;
            this._archivedExpensesLoading = null;

            this.trackDocForDisconnectedChanges('expenses-archived', this._archivedExpensesDoc);

            // Sync with Drive if connected
            if (this.driveProvider?.isConnected()) {
                if (this.isDisconnectedDirtyDoc('expenses-archived')) {
                    this.driveProvider.markDocsForFullStateUpload(['expenses-archived']);
                }

                await this.driveProvider.syncAndSubscribeDoc(
                    'expenses-archived',
                    options.allowPullFromDrive ? { allowPull: true } : undefined,
                );
                if (this.driveSyncMode !== 'manual' && this.canClearDisconnectedDirtyDocsAfterSync()) {
                    this.clearDisconnectedDirtyDocs(['expenses-archived']);
                }
            }

        }

        const archivedMap = this._archivedExpensesDoc.getMap<Expense>('expenses');
        this.reconcileExpenseArchives(archivedMap);
        return archivedMap;
    }

    /**
     * Check if archived expenses are loaded
     */
    get archivedExpensesLoaded(): boolean {
        return this._archivedExpensesDoc !== null;
    }

    /**
     * Get archived expenses synchronously (only if loaded)
     */
    get archivedExpenses(): Y.Map<string, Expense> | null {
        return this._archivedExpensesDoc?.getMap('expenses') ?? null;
    }

    /**
     * Archive a task (move from active to archived doc)
     */
    async archiveTask(taskId: string): Promise<void> {
        const archivedMap = await this.loadArchivedTasks();
        const activeTasks = collectEntities<Task>(this.tasks as any);
        const archivedTasks = collectEntities<Task>(archivedMap as any);
        const taskIdsToArchive = getTaskIdsWithDescendants(taskId, [...activeTasks, ...archivedTasks]);

        if (taskIdsToArchive.length === 0) return;

        const archivedOnDate = new Date().toISOString().slice(0, 10);
        const transition: ArchiveTransition = {
            operationId: generateId(),
            targetDoc: 'tasks-archived',
            changedAt: Date.now(),
        };

        taskIdsToArchive.forEach((candidateTaskId) => {
            const task = readEntity<Task>(this.tasks.get(candidateTaskId));
            if (!task) return;

            const entityMap = objectToYMap({
                ...task,
                archived: true,
                archivedOnDate,
                _archiveTransition: transition,
            } as unknown as Record<string, unknown>);
            (archivedMap as any).set(candidateTaskId, entityMap);
            this.tasks.delete(candidateTaskId);
        });

        console.log(`[YjsStore] Archived task subtree ${taskId} (${taskIdsToArchive.length} task(s))`);
    }

    /**
     * Unarchive a task (move from archived to active doc)
     */
    async unarchiveTask(taskId: string): Promise<void> {
        const archivedMap = await this.loadArchivedTasks();
        const activeTasks = collectEntities<Task>(this.tasks as any);
        const archivedTasks = collectEntities<Task>(archivedMap as any);
        const taskIdsToUnarchive = getTaskIdsWithDescendants(taskId, [...activeTasks, ...archivedTasks]);

        if (taskIdsToUnarchive.length === 0) return;

        const transition: ArchiveTransition = {
            operationId: generateId(),
            targetDoc: 'core',
            changedAt: Date.now(),
        };

        taskIdsToUnarchive.forEach((candidateTaskId) => {
            const task = readEntity<Task>(archivedMap.get(candidateTaskId));
            if (!task) return;

            const entityMap = objectToYMap({
                ...task,
                archived: false,
                archivedOnDate: null,
                _archiveTransition: transition,
            } as unknown as Record<string, unknown>);
            (this.tasks as any).set(candidateTaskId, entityMap);
            archivedMap.delete(candidateTaskId);
        });

        console.log(`[YjsStore] Unarchived task subtree ${taskId} (${taskIdsToUnarchive.length} task(s))`);
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
        entries.push(...collectValidatedEntities<TimeEntry>('timeEntries', this.activeTimeEntries as any, 'loaded active time entries'));

        // Archived entries (from loaded year docs)
        for (const docName of this.docManager.getLoadedDocs()) {
            if (docName.startsWith('entries-') && docName !== 'entries-active') {
                const doc = this.docManager.getDocSync(docName);
                if (doc) {
                    const yearEntries = doc.getMap('timeEntries');
                    entries.push(...collectValidatedEntities<TimeEntry>('timeEntries', yearEntries as any, `loaded ${docName} time entries`));
                }
            }
        }

        return entries;
    }

    /**
     * Load entries for a specific year (on-demand)
     */
    async loadEntriesForYear(year: number, options: { allowPullFromDrive?: boolean } = {}): Promise<Y.Map<string, TimeEntry>> {
        const docName = `entries-${year}` as DocName;
        const wasLoaded = this.docManager.isLoaded(docName);
        const doc = await this.docManager.getDoc(docName);

        this.trackDocForDisconnectedChanges(docName, doc);

        // Sync with Drive if this is a newly loaded doc
        if (!wasLoaded && this.driveProvider?.isConnected()) {
            if (this.isDisconnectedDirtyDoc(docName)) {
                this.driveProvider.markDocsForFullStateUpload([docName]);
            }

            await this.driveProvider.syncAndSubscribeDoc(
                docName,
                options.allowPullFromDrive ? { allowPull: true } : undefined,
            );
            if (this.driveSyncMode !== 'manual' && this.canClearDisconnectedDirtyDocsAfterSync()) {
                this.clearDisconnectedDirtyDocs([docName]);
            }
        }

        const yearEntries = doc.getMap<TimeEntry>('timeEntries');
        this.reconcileEntryArchives(year, yearEntries);
        return yearEntries;
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
    async loadAllTimeEntries(options: { allowPullFromDrive?: boolean } = {}): Promise<TimeEntry[]> {
        const entries: TimeEntry[] = [];

        // Active entries
        entries.push(...collectValidatedEntities<TimeEntry>('timeEntries', this.activeTimeEntries as any, 'all active time entries'));

        const years = await this.getAvailableYears();

        // Load each year's entries
        for (const year of years) {
            const yearEntries = await this.loadEntriesForYear(year, options);
            entries.push(...collectValidatedEntities<TimeEntry>('timeEntries', yearEntries as any, `all entries-${year} time entries`));
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
    async loadArchivedInvoices(options: { allowPullFromDrive?: boolean } = {}): Promise<Y.Map<string, Invoice>> {
        if (!this._archivedInvoicesDoc) {
            if (!this._archivedInvoicesLoading) {
                this._archivedInvoicesLoading = this.docManager.getDoc('invoices-archived');
            }
            this._archivedInvoicesDoc = await this._archivedInvoicesLoading;
            this._archivedInvoicesLoading = null;

            this.trackDocForDisconnectedChanges('invoices-archived', this._archivedInvoicesDoc);

            // Sync with Drive if connected
            if (this.driveProvider?.isConnected()) {
                if (this.isDisconnectedDirtyDoc('invoices-archived')) {
                    this.driveProvider.markDocsForFullStateUpload(['invoices-archived']);
                }

                await this.driveProvider.syncAndSubscribeDoc(
                    'invoices-archived',
                    options.allowPullFromDrive ? { allowPull: true } : undefined,
                );
                if (this.driveSyncMode !== 'manual' && this.canClearDisconnectedDirtyDocsAfterSync()) {
                    this.clearDisconnectedDirtyDocs(['invoices-archived']);
                }
            }
        }

        const archivedMap = this._archivedInvoicesDoc.getMap<Invoice>('invoices');
        this.normalizePersistedInvoiceMap(archivedMap);
        this.reconcileInvoiceArchives(archivedMap);
        return archivedMap;
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
    async getAllInvoices(options: { allowPullFromDrive?: boolean } = {}): Promise<Invoice[]> {
        const allInvoices: Invoice[] = [];

        // Active invoices (always available)
        allInvoices.push(...collectEntities<Invoice>(this.invoices as any));

        // Archived invoices (load if needed)
        const archivedMap = await this.loadArchivedInvoices(options);
        allInvoices.push(...collectEntities<Invoice>(archivedMap as any));

        return allInvoices;
    }

    // =========================================================================
    // Orphaned Planner Attachment Cleanup
    // =========================================================================

    /**
     * Remove planner attachments whose referenced project or client no longer exists.
     * Task-type attachments are skipped because archived tasks live in a separate
     * on-demand doc that may not be loaded yet.
     */
    cleanupOrphanedPlannerAttachments(): void {

        const projectIds = new Set<string>();
        this._coreDoc!.getMap('projects').forEach((_v, key) => projectIds.add(key));

        const clientIds = new Set<string>();
        this._coreDoc!.getMap('clients').forEach((_v, key) => clientIds.add(key));

        const attachments = this._coreDoc!.getMap('plannerAttachments');
        const toDelete: string[] = [];

        attachments.forEach((value, key) => {
            const entity = readEntity<PlannerAttachment>(value);
            if (!entity) return;

            if (entity.type === 'project' && !projectIds.has(entity.referenceId)) {
                toDelete.push(key);
            } else if (entity.type === 'client' && !clientIds.has(entity.referenceId)) {
                toDelete.push(key);
            }
        });

        if (toDelete.length > 0) {
            this._coreDoc!.transact(() => {
                toDelete.forEach((key) => attachments.delete(key));
            });
            console.log(`[YjsStore] Cleaned up ${toDelete.length} orphaned planner attachment(s)`);
        }
    }

    /**
     * Finish task archive/unarchive moves after an interrupted write or stale
     * cross-device replay. A transition on either copy is authoritative; for
     * legacy duplicates without metadata, the archived copy wins because all
     * historical moves wrote the destination before deleting the source.
     */
    private reconcileTaskArchiveTransitions(archivedMap: Y.Map<string, Task>): void {
        const activeMap = this._coreDoc!.getMap('tasks') as Y.Map<string, Task>;
        const ids = new Set([...activeMap.keys(), ...archivedMap.keys()]);

        for (const id of ids) {
            const active = readEntity<Task>(activeMap.get(id));
            const archived = readEntity<Task>(archivedMap.get(id));
            const activeTransition = readArchiveTransition(active);
            const archivedTransition = readArchiveTransition(archived);

            let transition: ArchiveTransition | null = null;

            if (activeTransition && archivedTransition) {
                transition = compareArchiveTransitions(activeTransition, archivedTransition) >= 0
                    ? activeTransition
                    : archivedTransition;
            } else {
                transition = activeTransition ?? archivedTransition;
            }

            if (!transition && !(active && archived)) {
                continue;
            }

            const targetDoc = transition?.targetDoc === 'core' ? 'core' : 'tasks-archived';
            const source = transition
                ? (active && archived ? chooseFreshestEntity(active, archived) : active ?? archived)
                : archived;

            if (!source) continue;

            const reconciled = {
                ...source,
                archived: targetDoc === 'tasks-archived',
                archivedOnDate: targetDoc === 'tasks-archived'
                    ? source.archivedOnDate ?? new Date().toISOString().slice(0, 10)
                    : null,
                ...(transition ? { _archiveTransition: transition } : {}),
            };

            if (targetDoc === 'core') {
                if (!areRecordsEquivalent(active as unknown as Record<string, unknown>, reconciled as unknown as Record<string, unknown>)) {
                    (activeMap as any).set(id, objectToYMap(reconciled as unknown as Record<string, unknown>));
                }
                if (archived) archivedMap.delete(id);
            } else {
                if (!areRecordsEquivalent(archived as unknown as Record<string, unknown>, reconciled as unknown as Record<string, unknown>)) {
                    (archivedMap as any).set(id, objectToYMap(reconciled as unknown as Record<string, unknown>));
                }
                if (active) activeMap.delete(id);
            }
        }
    }

    /**
     * Resolve a duplicate one-way archive using the freshest complete record
     * and the current archival predicate. This preserves a later undo/edit on
     * another device instead of blindly preferring one document forever.
     */
    private reconcileOneWayArchive<T extends TimeEntry | Invoice | Expense>(
        activeMap: Y.Map<string, T>,
        archivedMap: Y.Map<string, T>,
        activeDoc: DocName,
        archivedDoc: DocName,
        shouldArchive: (entity: T) => boolean,
    ): void {
        for (const id of archivedMap.keys()) {
            const active = readEntity<T>(activeMap.get(id));
            const archived = readEntity<T>(archivedMap.get(id));

            if (!active || !archived) continue;

            const source = chooseFreshestEntity(active, archived);
            const targetDoc = shouldArchive(source) ? archivedDoc : activeDoc;
            const transition: ArchiveTransition = {
                operationId: generateId(),
                targetDoc,
                changedAt: Date.now(),
            };
            const reconciled = {
                ...source,
                _archiveTransition: transition,
            };

            if (targetDoc === archivedDoc) {
                (archivedMap as any).set(id, objectToYMap(reconciled as unknown as Record<string, unknown>));
                activeMap.delete(id);
            } else {
                (activeMap as any).set(id, objectToYMap(reconciled as unknown as Record<string, unknown>));
                archivedMap.delete(id);
            }
        }
    }

    private reconcileEntryArchives(year: number, archivedMap: Y.Map<string, TimeEntry>): void {
        const cutoff = Date.now() - NINETY_DAYS_MS;
        const activeMap = this._activeEntriesDoc!.getMap('timeEntries') as Y.Map<string, TimeEntry>;

        this.reconcileOneWayArchive(
            activeMap,
            archivedMap,
            'entries-active',
            `entries-${year}` as DocName,
            (entry) => entry.start < cutoff && new Date(entry.start).getFullYear() === year,
        );
    }

    private reconcileInvoiceArchives(archivedMap: Y.Map<string, Invoice>): void {
        const currentYear = new Date().getFullYear();
        const activeMap = this._coreDoc!.getMap('invoices') as Y.Map<string, Invoice>;
        const operationMap = this.getExistingInvoiceBillingOperations();
        const cancellationByInvoice = new Map<string, InvoiceCancellationOperation>();

        if (operationMap) {
            collectEntities<InvoiceBillingOperation>(operationMap as any)
                .filter(isInvoiceBillingOperation)
                .filter((operation): operation is InvoiceCancellationOperation => operation.kind === 'cancel')
                .sort((left, right) => (
                    left.createdAt - right.createdAt
                    || left.operationId.localeCompare(right.operationId)
                ))
                .forEach((operation) => {
                    if (!cancellationByInvoice.has(operation.invoiceId)) {
                        cancellationByInvoice.set(operation.invoiceId, operation);
                    }
                });
        }

        // A terminal cancellation journal wins over a fresher stale paid copy
        // that reappears in the archived document. Only resolve duplicates:
        // an explicitly deleted invoice must not be recreated from the journal.
        for (const [invoiceId, operation] of cancellationByInvoice) {
            if (!activeMap.has(invoiceId) || !archivedMap.has(invoiceId)) continue;

            const transition: ArchiveTransition = {
                operationId: generateId(),
                targetDoc: 'core',
                changedAt: Date.now(),
            };
            (activeMap as any).set(invoiceId, objectToYMap({
                ...operation.desiredInvoice,
                _archiveTransition: transition,
            } as unknown as Record<string, unknown>));
            archivedMap.delete(invoiceId);
        }

        this.reconcileOneWayArchive(
            activeMap,
            archivedMap,
            'core',
            'invoices-archived',
            (invoice) => Boolean(
                invoice.status === 'paid'
                && invoice.paidAt
                && new Date(invoice.paidAt).getFullYear() < currentYear
            ),
        );
    }

    private reconcileExpenseArchives(archivedMap: Y.Map<string, Expense>): void {
        const cutoff = Date.now() - NINETY_DAYS_MS;
        const activeMap = this._coreDoc!.getMap('expenses') as Y.Map<string, Expense>;

        this.reconcileOneWayArchive(
            activeMap,
            archivedMap,
            'core',
            'expenses-archived',
            (expense) => {
                const date = parseStoredDate(expense.date);

                return Boolean(
                    date
                    && date.getTime() < cutoff
                    && expense.paymentStatus === 'paid'
                    && !(expense.billable && expense.billingStatus === 'unbilled')
                );
            },
        );
    }

    private reconcileLoadedArchiveTransitions(): void {
        this.normalizePersistedInvoiceMap(this._coreDoc!.getMap('invoices'));

        if (this._archivedTasksDoc) {
            this.reconcileTaskArchiveTransitions(this._archivedTasksDoc.getMap('tasks') as Y.Map<string, Task>);
        }

        if (this._archivedInvoicesDoc) {
            const archivedInvoices = this._archivedInvoicesDoc.getMap('invoices') as Y.Map<string, Invoice>;
            this.normalizePersistedInvoiceMap(archivedInvoices);
            this.reconcileInvoiceArchives(archivedInvoices);
        }

        if (this._archivedExpensesDoc) {
            this.reconcileExpenseArchives(this._archivedExpensesDoc.getMap('expenses') as Y.Map<string, Expense>);
        }

        for (const docName of this.docManager.getLoadedDocs()) {
            const match = docName.match(/^entries-(\d{4})$/);
            const doc = match ? this.docManager.getDocSync(docName as DocName) : null;

            if (match && doc) {
                this.reconcileEntryArchives(
                    Number(match[1]),
                    doc.getMap('timeEntries') as Y.Map<string, TimeEntry>,
                );
            }
        }
    }

    /**
     * Upgrade only recognized legacy invoice shapes before validated readers
     * can hide them. Unsupported/corrupt records remain untouched for raw CRDT
     * convergence and diagnostics.
     */
    private normalizePersistedInvoiceMap(invoiceMap: Y.Map<string, Invoice>): void {
        for (const [id, value] of invoiceMap.entries()) {
            const invoice = readEntity<Invoice & Record<string, unknown>>(value);

            if (!invoice) continue;

            const isLegacy = !Array.isArray(invoice.items)
                || typeof invoice.total !== 'number'
                || 'totalAmount' in invoice
                || 'paymentProcessed' in invoice
                || 'project' in invoice
                || 'client' in invoice
                || 'businessInfo' in invoice
                || 'paymentMethod' in invoice;

            if (!isLegacy) continue;

            const normalized = normalizeInvoiceRecord(invoice);

            try {
                const validated = validateCollectionEntity<Invoice>(
                    'invoices',
                    normalized,
                    `normalize persisted invoice ${id}`,
                );
                if (!areRecordsEquivalent(
                    invoice as unknown as Record<string, unknown>,
                    validated as unknown as Record<string, unknown>,
                )) {
                    (invoiceMap as any).set(id, objectToYMap(validated as unknown as Record<string, unknown>));
                }
            } catch (error) {
                console.warn(`[YjsStore] Unable to normalize legacy invoice ${id}:`, error);
            }
        }
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
        const activeEntries = this._activeEntriesDoc!.getMap('timeEntries');

        // Find entries to archive (handle both nested Y.Map and plain object formats)
        const entriesToProcess: TimeEntry[] = [];
        activeEntries.forEach((value: unknown) => {
            const entry = readEntity<TimeEntry>(value);
            if (entry) entriesToProcess.push(entry);
        });

        for (const entry of entriesToProcess) {
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
            this.trackDocForDisconnectedChanges(`entries-${year}` as DocName, yearDoc);
            const yearEntries = yearDoc.getMap('timeEntries');
            const transition: ArchiveTransition = {
                operationId: generateId(),
                targetDoc: `entries-${year}` as DocName,
                changedAt: Date.now(),
            };

            for (const entry of entries) {
                const entityMap = objectToYMap({
                    ...entry,
                    _archiveTransition: transition,
                } as unknown as Record<string, unknown>);
                (yearEntries as any).set(entry.id, entityMap);
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
        const invoicesMap = this._coreDoc!.getMap('invoices');

        // Find paid invoices from previous years
        const invoicesToCheck: Array<{ id: string; invoice: Invoice }> = [];
        invoicesMap.forEach((value: unknown, id: string) => {
            const invoice = readEntity<Invoice>(value);
            if (invoice) invoicesToCheck.push({ id, invoice });
        });

        for (const { invoice } of invoicesToCheck) {
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
        const transition: ArchiveTransition = {
            operationId: generateId(),
            targetDoc: 'invoices-archived',
            changedAt: Date.now(),
        };

        for (const invoice of toArchive) {
            const entityMap = objectToYMap({
                ...invoice,
                _archiveTransition: transition,
            } as unknown as Record<string, unknown>);
            (archivedMap as any).set(invoice.id, entityMap);
            invoicesMap.delete(invoice.id);
        }

        console.log(`[YjsStore] Archived ${toArchive.length} paid invoices from previous years`);
    }

    /**
     * Move old expenses from active to archived document
     * Called automatically on app start
     */
    private async archiveOldExpenses(): Promise<void> {
        const cutoff = Date.now() - NINETY_DAYS_MS;
        const toArchive: Expense[] = [];

        // Access doc directly (not via getter, since we're in initialization)
        const expensesMap = this._coreDoc!.getMap('expenses');

        const expensesToCheck: Array<{ id: string; expense: Expense }> = [];
        expensesMap.forEach((value: unknown, id: string) => {
            const expense = readEntity<Expense>(value);
            if (expense) expensesToCheck.push({ id, expense });
        });

        for (const { expense } of expensesToCheck) {
            if (!expense?.date) continue;

            const parsedDate = parseStoredDate(expense.date);
            if (!parsedDate) continue;

            if (parsedDate.getTime() >= cutoff) continue;

            const isPaid = expense.paymentStatus === 'paid';
            const isBillableUnbilled = expense.billable && expense.billingStatus === 'unbilled';

            if (!isPaid || isBillableUnbilled) continue;

            toArchive.push(expense);
        }

        if (toArchive.length === 0) return;

        const archivedMap = await this.loadArchivedExpenses();
        const transition: ArchiveTransition = {
            operationId: generateId(),
            targetDoc: 'expenses-archived',
            changedAt: Date.now(),
        };

        for (const expense of toArchive) {
            const entityMap = objectToYMap({
                ...expense,
                _archiveTransition: transition,
            } as unknown as Record<string, unknown>);
            (archivedMap as any).set(expense.id, entityMap);
            expensesMap.delete(expense.id);
        }

        console.log(`[YjsStore] Archived ${toArchive.length} expenses older than 90 days`);
    }

    // =========================================================================
    // Google Drive Sync
    // =========================================================================

    /**
     * Connect to Google Drive and start syncing
     * The explicit transport is fixed for the lifetime of this connection.
     * The string overload remains for compatible tests/non-Worker consumers.
     */
    async connectDrive(
        connection: DriveConnectionOptions | string,
        legacySessionId?: string | null,
    ): Promise<void> {
        if (this.driveProvider) {
            this.driveProvider.disconnect();
        }

        this.driveProvider = new YjsDriveProvider(this.docManager, connection, legacySessionId);
        this.driveProvider.setSyncMode(this.driveSyncMode);

        const bootstrapPullIfPristine = this.driveSyncMode === 'manual' && this.shouldBootstrapRemotePullOnManualConnect();

        if (bootstrapPullIfPristine) {
            this.clearDisconnectedDirtyDocs();
            clearSyncPersistence();
        }

        const disconnectedDirtyDocs = bootstrapPullIfPristine ? [] : this.getDisconnectedDirtyDocs();
        if (disconnectedDirtyDocs.length > 0) {
            this.driveProvider.markDocsForFullStateUpload(disconnectedDirtyDocs);
        }

        // Set up backup manager with access to the provider's manifest
        this.backupManager = new BackupManager(this.driveProvider.getManifest(), this);

        // After each successful sync, reconcile cross-document operations and maybe create a backup
        this.driveProvider.onSyncComplete(async () => {
            try {
                this.reconcileLoadedArchiveTransitions();
                // Clean up timers whose stop-entry arrived from another device
                this.reconcileOrphanedTimers();
            } catch (err) {
                console.error('[YjsStore] Cross-document reconciliation error:', err);
            }

            const enabled = this.preferences.get('backupEnabled') ?? true;
            // A pulled billing journal record is part of sync consistency. If
            // replay cannot load or reconcile a required document, let the
            // provider retain its error/pending state instead of claiming that
            // the workspace is fully synchronized.
            await this.reconcileInvoiceBillingOperations({ includeCompleted: true });

            if (!enabled || !this.backupManager) return;

            const frequencyHours = (this.preferences.get('backupFrequencyHours') as number) ?? 24;
            await this.backupManager.maybeCreateBackup(frequencyHours);
        });

        await this.driveProvider.connect(this.driveSyncMode, {
            bootstrapPullIfPristine,
        });

        // Clear disconnected dirty docs after a successful online reconnect
        // only when connect() actually reconciled them. Manual mode keeps
        // those docs queued until the user explicitly clicks Sync Now.
        if (this.driveSyncMode !== 'manual' && this.canClearDisconnectedDirtyDocsAfterSync()) {
            this.clearDisconnectedDirtyDocs(
                disconnectedDirtyDocs.filter((docName) => this.docManager.isLoaded(docName)),
            );
        }
    }

    /**
     * Disconnect from Google Drive
     */
    disconnectDrive(): void {
        if (this.driveProvider) {
            // Provider disconnect clears its in-memory queue and generic sync
            // flags. Persist document identity first so authentication expiry,
            // explicit disconnect, or reconnect cannot strand IndexedDB-only
            // edits without a future full-state upload signal.
            for (const docName of this.driveProvider.getPendingDocNames()) {
                this.markDisconnectedDirtyDoc(docName);
            }

            this.driveProvider.disconnect();
        }
        this.driveProvider = null;
        this.backupManager = null;
    }

    /**
     * Check if connected to Google Drive
     */
    isDriveConnected(): boolean {
        return this.driveProvider?.isConnected() ?? false;
    }

    /**
     * Trigger Drive sync with optional force control.
     */
    async syncDrive(options?: { allowPull?: boolean; force?: boolean; forceFullState?: boolean }): Promise<void> {
        if (!this.driveProvider) {
            return;
        }

        await this.driveProvider.sync(options?.force ?? false, {
            allowPull: options?.allowPull,
            forceFullState: options?.forceFullState,
        });

        const syncState = this.driveProvider.getState();
        if (syncState === 'offline') {
            throw new Error('Unable to sync while offline. Your local changes are still saved on this device.');
        }

        if (syncState === 'error') {
            throw new Error('Drive sync failed. Your local changes are still saved and will retry.');
        }

        // After a successful sync, clear any leftover disconnected dirty docs
        // (matters for manual mode where they aren't cleared on connect)
        if (this.disconnectedDirtyDocs.size > 0 && this.canClearDisconnectedDirtyDocsAfterSync()) {
            this.clearDisconnectedDirtyDocs();
        }
    }

    /**
     * Force immediate sync with Google Drive
     * @param options - Optional sync options (e.g., allowPull: false for backup mode)
     */
    async forceDriveSync(options?: { allowPull?: boolean; forceFullState?: boolean }): Promise<void> {
        await this.syncDrive({
            ...options,
            force: true,
            forceFullState: options?.forceFullState ?? options?.allowPull !== false,
        });
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
     * Subscribe to IndexedDB persistence errors (e.g., quota exceeded)
     */
    onPersistenceError(callback: (error: Error, docName: string) => void): () => void {
        return this.docManager.onPersistenceError(callback);
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
     * Wipe all TaskTime Pro files from Google Drive (appDataFolder)
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
        const localYears = new Set(this.getLocalYears());
        const persistedDocs = await this.docManager.listPersistedDocs();

        for (const docName of persistedDocs) {
            const match = docName.match(/^entries-(\d{4})$/);

            if (match) {
                localYears.add(parseInt(match[1], 10));
            }
        }

        const driveYears = this.driveProvider?.getEntryYears() ?? [];

        const allYears = new Set([...localYears, ...driveYears]);
        return Array.from(allYears).sort((a, b) => b - a);
    }

    /**
     * Persist and apply one deterministic invoice finalization plan. The
     * journal write happens first so startup or post-sync reconciliation can
     * finish every later phase after an interruption.
     */
    async commitInvoiceFinalization({
        operationId,
        desiredInvoice,
        application,
        createdAt = Date.now(),
        onPhase,
    }: {
        operationId: string;
        desiredInvoice: Invoice;
        application: InvoiceFinalizationApplicationPlan;
        createdAt?: number;
        onPhase?: (phase: InvoiceBillingOperationPhase) => void;
    }): Promise<Invoice> {
        const operation = createInvoiceFinalizationOperation({
            operationId,
            desiredInvoice,
            application,
            createdAt,
        });

        this.persistInvoiceBillingOperation(operation);
        onPhase?.('prepared');
        await this.applyInvoiceBillingOperation(operation, onPhase);

        const invoice = readEntity<Invoice>(this.invoices.get(desiredInvoice.id));

        if (!invoice) {
            throw new Error(`Invoice ${desiredInvoice.id} was not persisted after finalization.`);
        }

        return invoice;
    }

    /** Persist and apply one deterministic undo plan before deleting its invoice. */
    async commitInvoiceUndo({
        operationId,
        invoice,
        application,
        createdAt = Date.now(),
        onPhase,
    }: {
        operationId: string;
        invoice: Invoice;
        application: InvoiceUndoApplicationPlan;
        createdAt?: number;
        onPhase?: (phase: InvoiceBillingOperationPhase) => void;
    }): Promise<void> {
        const operation = createInvoiceUndoOperation({
            operationId,
            invoice,
            application,
            createdAt,
        });

        this.persistInvoiceBillingOperation(operation);
        onPhase?.('prepared');
        await this.applyInvoiceBillingOperation(operation, onPhase);
    }

    /** Persist and apply terminal cancellation without unlinking or rewinding. */
    async commitInvoiceCancellation({
        operationId,
        invoice,
        desiredInvoice,
        application,
        createdAt = Date.now(),
        onPhase,
    }: {
        operationId: string;
        invoice: Invoice;
        desiredInvoice: Invoice;
        application: InvoiceCancellationApplicationPlan;
        createdAt?: number;
        onPhase?: (phase: InvoiceBillingOperationPhase) => void;
    }): Promise<{
        invoice: Invoice;
        operation: InvoiceCancellationOperation;
        alreadyApplied: boolean;
    }> {
        const requestedOperation = createInvoiceCancellationOperation({
            operationId,
            invoice,
            desiredInvoice,
            application,
            createdAt,
        });

        if (!isInvoiceBillingOperation(requestedOperation)) {
            throw new Error(`Invoice cancellation operation ${operationId} has invalid persisted input.`);
        }

        const existing = readEntity<InvoiceBillingOperation>(
            this.invoiceBillingOperations.get(operationId)
        );
        let operation = requestedOperation;
        let alreadyApplied = false;

        if (existing) {
            if (!isInvoiceBillingOperation(existing)
                || existing.kind !== 'cancel'
                || existing.invoiceId !== invoice.id) {
                throw new Error(`Invoice billing operation ${operationId} has conflicting persisted input.`);
            }

            if (
                existing.desiredInvoice.canceledAt !== desiredInvoice.canceledAt
                || existing.desiredInvoice.cancellationReason !== desiredInvoice.cancellationReason
            ) {
                throw new Error(`Invoice cancellation operation ${operationId} has conflicting persisted input.`);
            }

            operation = existing;
            alreadyApplied = existing.state === 'complete';
        } else {
            const currentInvoice = readEntity<Invoice>(this.invoices.get(invoice.id));

            if (
                currentInvoice?.status === 'canceled'
                && (
                    currentInvoice.canceledAt !== desiredInvoice.canceledAt
                    || currentInvoice.cancellationReason !== desiredInvoice.cancellationReason
                )
            ) {
                throw new Error(`Invoice ${invoice.id} was canceled by a conflicting operation.`);
            }

            const blockReason = getInvoiceCancellationBlockReason(currentInvoice);

            if (blockReason) {
                throw new Error(blockReason);
            }

            if (currentInvoice?.invoiceNumber !== invoice.invoiceNumber) {
                throw new Error(`Invoice ${invoice.id} changed before cancellation could be persisted.`);
            }

            this.persistInvoiceBillingOperation(operation);
        }

        onPhase?.('prepared');
        await this.applyInvoiceBillingOperation(operation, onPhase);

        const canceledInvoice = readEntity<Invoice>(this.invoices.get(invoice.id));

        if (!canceledInvoice) {
            throw new Error(`Invoice ${invoice.id} was removed before cancellation completed.`);
        }

        if (
            canceledInvoice.status !== 'canceled'
            || canceledInvoice.canceledAt !== operation.desiredInvoice.canceledAt
            || canceledInvoice.cancellationReason !== operation.desiredInvoice.cancellationReason
        ) {
            throw new Error(`Invoice ${invoice.id} was canceled by a conflicting operation.`);
        }

        return {
            invoice: canceledInvoice,
            operation,
            alreadyApplied,
        };
    }

    /**
     * Replay journaled billing operations in deterministic order. Completed
     * records are included after cloud sync because another document's update
     * can arrive later than the core journal record.
     */
    async reconcileInvoiceBillingOperations({
        includeCompleted = true,
    }: {
        includeCompleted?: boolean;
    } = {}): Promise<void> {
        const operationMap = this.getExistingInvoiceBillingOperations();
        if (!operationMap) return;

        const operations = collectEntities<InvoiceBillingOperation>(operationMap as any)
            .filter(isInvoiceBillingOperation)
            .filter((operation) => includeCompleted || operation.state !== 'complete')
            .sort((left, right) => {
                if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
                return left.operationId.localeCompare(right.operationId);
            });

        for (const operation of operations) {
            await this.applyInvoiceBillingOperation(operation);
        }
    }

    private getExistingInvoiceBillingOperations(): Y.Map<string, InvoiceBillingOperation> | null {
        if (!this._coreDoc?.share.has('invoiceBillingOperations')) {
            return null;
        }

        return this._coreDoc.getMap('invoiceBillingOperations');
    }

    private persistInvoiceBillingOperation(operation: InvoiceBillingOperation): void {
        const existing = readEntity<InvoiceBillingOperation>(
            this.invoiceBillingOperations.get(operation.operationId)
        );

        if (existing) {
            if (existing.invoiceId !== operation.invoiceId || existing.kind !== operation.kind) {
                throw new Error(`Invoice billing operation ${operation.operationId} has conflicting persisted input.`);
            }

            return;
        }

        this.coreDoc.transact(() => {
            (this.invoiceBillingOperations as any).set(
                operation.operationId,
                objectToYMap(operation as unknown as Record<string, unknown>)
            );
        });
    }

    private updateInvoiceBillingOperationPhase(
        operation: InvoiceBillingOperation,
        phase: InvoiceBillingOperationPhase,
        state: 'prepared' | 'complete' = 'prepared',
    ): void {
        const current = readEntity<InvoiceBillingOperation>(
            this.invoiceBillingOperations.get(operation.operationId)
        );

        if (!current || current.state === 'complete'
            || (current.lastCompletedPhase === phase && current.state === state)) {
            return;
        }

        this.coreDoc.transact(() => {
            this.updateEntityFieldsIfChanged(
                this.invoiceBillingOperations as any,
                operation.operationId,
                {
                    lastCompletedPhase: phase,
                    state,
                    updatedAt: Date.now(),
                }
            );
        });
    }

    private updateEntityFieldsIfChanged<T extends Record<string, unknown>>(
        map: Y.Map<string, unknown>,
        id: string,
        updates: Partial<T>,
    ): T | undefined {
        const current = readEntity<T>(map.get(id));
        if (!current) return undefined;

        const changed = Object.entries(updates).some(([key, value]) => {
            return JSON.stringify(current[key]) !== JSON.stringify(value);
        });

        return changed ? updateEntityFields(map, id, updates) : current;
    }

    private async applyInvoiceBillingOperation(
        operation: InvoiceBillingOperation,
        onPhase?: (phase: InvoiceBillingOperationPhase) => void,
    ): Promise<void> {
        const taskMaps = [this.tasks, await this.loadArchivedTasks()].filter(Boolean) as Array<Y.Map<string, Task>>;
        const expenseMaps = [this.expenses, await this.loadArchivedExpenses()].filter(Boolean) as Array<Y.Map<string, Expense>>;
        const entryMaps = [this.activeTimeEntries] as Array<Y.Map<string, TimeEntry>>;
        const years = await this.getAvailableYears();

        for (const year of years) {
            entryMaps.push(await this.loadEntriesForYear(year));
        }

        const operationToApply: InvoiceBillingOperation = operation.kind === 'cancel'
            ? {
                ...operation,
                application: this.buildCancellationReplayApplication(
                    operation,
                    entryMaps,
                    expenseMaps,
                    taskMaps,
                ),
            }
            : operation;

        if (operationToApply.kind === 'finalize') {
            this.applyFinalizationEntryPhase(operationToApply, entryMaps);
        } else {
            this.applySourceReleaseEntryPhase(operationToApply, entryMaps);
        }
        this.updateInvoiceBillingOperationPhase(operation, 'entries-applied');
        onPhase?.('entries-applied');

        if (operationToApply.kind === 'finalize') {
            this.applyFinalizationExpensePhase(operationToApply, expenseMaps);
        } else {
            this.applySourceReleaseExpensePhase(operationToApply, expenseMaps);
        }
        this.updateInvoiceBillingOperationPhase(operation, 'expenses-applied');
        onPhase?.('expenses-applied');

        if (operationToApply.kind === 'finalize') {
            this.applyFinalizationTaskPhase(operationToApply, taskMaps);
        } else {
            this.applySourceReleaseTaskPhase(operationToApply, taskMaps);
        }
        this.updateInvoiceBillingOperationPhase(operation, 'tasks-applied');
        onPhase?.('tasks-applied');

        this.applyInvoiceBillingCorePhase(operationToApply);
        this.updateInvoiceBillingOperationPhase(operation, 'core-links-applied');
        onPhase?.('core-links-applied');

        this.applyInvoiceBillingInvoicePhase(operationToApply);
        this.updateInvoiceBillingOperationPhase(operation, 'invoice-applied');
        onPhase?.('invoice-applied');

        this.updateInvoiceBillingOperationPhase(operation, 'complete', 'complete');
        onPhase?.('complete');
    }

    /**
     * Extend a persisted cancellation plan with source records that became
     * visible only after preparation. Result counts remain the original,
     * stable counts, while current-owner checks keep replay conditional.
     */
    private buildCancellationReplayApplication(
        operation: InvoiceCancellationOperation,
        entryMaps: Array<Y.Map<string, TimeEntry>>,
        expenseMaps: Array<Y.Map<string, Expense>>,
        taskMaps: Array<Y.Map<string, Task>>,
    ): InvoiceCancellationApplicationPlan {
        const uniqueById = <T extends { id: string }>(items: T[]): T[] => {
            const unique = new Map<string, T>();

            items.forEach((item) => {
                if (!unique.has(item.id)) unique.set(item.id, item);
            });

            return Array.from(unique.values());
        };
        const entries = uniqueById(entryMaps.flatMap((entryMap) => (
            collectValidatedEntities<TimeEntry>(
                'timeEntries',
                entryMap as any,
                'invoice cancellation replay time entries',
            )
        )));
        const expenses = uniqueById(expenseMaps.flatMap((expenseMap) => (
            collectValidatedEntities<Expense>(
                'expenses',
                expenseMap as any,
                'invoice cancellation replay expenses',
            )
        )));
        const tasks = uniqueById(taskMaps.flatMap((taskMap) => (
            collectValidatedEntities<Task>(
                'tasks',
                taskMap as any,
                'invoice cancellation replay tasks',
            )
        )));
        const releasedAt = operation.desiredInvoice.canceledAt ?? operation.createdAt;
        const replayApplication = buildInvoiceSourceReleaseApplication({
            invoice: operation.invoice,
            invoiceId: operation.invoiceId,
            entries,
            expenses,
            tasks,
            releasedAt,
        }).application;
        const expectedFinalCutoffs = new Map<string, number>();
        const rememberFinalCutoff = (taskId: unknown, end: unknown) => {
            if (typeof taskId !== 'string' || typeof end !== 'number' || !Number.isFinite(end)) return;

            expectedFinalCutoffs.set(taskId, Math.max(expectedFinalCutoffs.get(taskId) ?? 0, end));
        };

        operation.invoice.billingSelectionSnapshot?.entries?.forEach((entry) => {
            rememberFinalCutoff(entry.taskId, entry.end);
        });
        entries.forEach((entry) => {
            if (entry.billedInvoiceId === operation.invoiceId && entry.source !== 'invoice-adjustment') {
                rememberFinalCutoff(entry.taskId, entry.end);
            }
        });

        replayApplication.taskCutoffUpdates = replayApplication.taskCutoffUpdates.filter(({ id }) => {
            const task = tasks.find((candidate) => candidate.id === id);
            const expectedFinalCutoff = expectedFinalCutoffs.get(id);

            return expectedFinalCutoff !== undefined && task?.lastBilledAt === expectedFinalCutoff;
        });

        const mergeById = <T>(
            prepared: T[],
            replay: T[],
            getId: (value: T) => string,
        ): T[] => {
            const merged = new Map<string, T>();

            prepared.forEach((value) => merged.set(getId(value), value));
            replay.forEach((value) => merged.set(getId(value), value));
            return Array.from(merged.values());
        };

        return {
            ...operation.application,
            entriesToDelete: mergeById(
                operation.application.entriesToDelete,
                replayApplication.entriesToDelete,
                (entry) => entry.id,
            ),
            entriesToClear: mergeById(
                operation.application.entriesToClear,
                replayApplication.entriesToClear,
                ({ entry }) => entry.id,
            ),
            expenseUpdatesToUnbill: mergeById(
                operation.application.expenseUpdatesToUnbill,
                replayApplication.expenseUpdatesToUnbill,
                ({ id }) => id,
            ),
            quotedTaskUpdates: mergeById(
                operation.application.quotedTaskUpdates,
                replayApplication.quotedTaskUpdates,
                ({ id }) => id,
            ),
            taskCutoffUpdates: mergeById(
                operation.application.taskCutoffUpdates,
                replayApplication.taskCutoffUpdates,
                ({ id }) => id,
            ),
        };
    }

    private applyFinalizationEntryPhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'finalize' }>,
        entryMaps: Array<Y.Map<string, TimeEntry>>,
    ): void {
        const { application } = operation;
        const locate = (id: string) => entryMaps.find((entryMap) => entryMap.has(id));

        application.adjustmentEntryIdsToDelete.forEach((id) => locate(id)?.delete(id));
        application.adjustmentEntriesToUpdate.forEach(({ id, updates }) => {
            const map = locate(id);
            if (map) this.updateEntityFieldsIfChanged(map as any, id, updates);
        });
        application.adjustmentEntriesToCreate.forEach(({ id, entry }) => {
            if (!locate(id)) {
                (this.activeTimeEntries as any).set(id, objectToYMap({ id, ...entry }));
            }
        });
        application.timeEntryUpdates.forEach(({ id, updates }) => {
            const map = locate(id);
            const current = map ? readEntity<TimeEntry>(map.get(id)) : null;

            if (map && (!current?.billedInvoiceId || current.billedInvoiceId === operation.invoiceId)) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
    }

    private applySourceReleaseEntryPhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'undo' | 'cancel' }>,
        entryMaps: Array<Y.Map<string, TimeEntry>>,
    ): void {
        const locate = (id: string) => entryMaps.find((entryMap) => entryMap.has(id));

        operation.application.entriesToDelete.forEach((entry) => {
            const map = locate(entry.id);
            const current = map ? readEntity<TimeEntry>(map.get(entry.id)) : null;

            if (
                map
                && current?.billedInvoiceId === operation.invoiceId
                && current.source === 'invoice-adjustment'
            ) {
                map.delete(entry.id);
            }
        });
        operation.application.entriesToClear.forEach(({ entry, updates }) => {
            const map = locate(entry.id);
            const current = map ? readEntity<TimeEntry>(map.get(entry.id)) : null;

            if (
                map
                && current?.billedInvoiceId === operation.invoiceId
                && current.source !== 'invoice-adjustment'
            ) {
                this.updateEntityFieldsIfChanged(map as any, entry.id, updates);
            }
        });
    }

    private applyFinalizationExpensePhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'finalize' }>,
        expenseMaps: Array<Y.Map<string, Expense>>,
    ): void {
        operation.application.expenseUpdates.forEach(({ id, updates }) => {
            const map = expenseMaps.find((expenseMap) => expenseMap.has(id));
            const current = map ? readEntity<Expense>(map.get(id)) : null;

            if (map && (!current?.invoiceId || current.invoiceId === operation.invoiceId)) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
    }

    private applySourceReleaseExpensePhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'undo' | 'cancel' }>,
        expenseMaps: Array<Y.Map<string, Expense>>,
    ): void {
        operation.application.expenseUpdatesToUnbill.forEach(({ id, updates }) => {
            const map = expenseMaps.find((expenseMap) => expenseMap.has(id));
            const current = map ? readEntity<Expense>(map.get(id)) : null;

            if (map && current?.invoiceId === operation.invoiceId) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
    }

    private applyFinalizationTaskPhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'finalize' }>,
        taskMaps: Array<Y.Map<string, Task>>,
    ): void {
        operation.application.taskCutoffUpdates.forEach(({ id, updates }) => {
            const map = taskMaps.find((taskMap) => taskMap.has(id));
            const current = map ? readEntity<Task>(map.get(id)) : null;
            const target = updates.lastBilledAt;

            if (map && typeof target === 'number'
                && (current?.lastBilledAt ?? Number.NEGATIVE_INFINITY) < target) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
        operation.application.quotedTaskUpdates.forEach(({ id, updates }) => {
            const map = taskMaps.find((taskMap) => taskMap.has(id));
            const current = map ? readEntity<Task>(map.get(id)) : null;

            if (map && (!current?.quotedAmountBilling?.invoiceId
                || current.quotedAmountBilling.invoiceId === operation.invoiceId)) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
    }

    private applySourceReleaseTaskPhase(
        operation: Extract<InvoiceBillingOperation, { kind: 'undo' | 'cancel' }>,
        taskMaps: Array<Y.Map<string, Task>>,
    ): void {
        operation.application.quotedTaskUpdates.forEach(({ id, updates }) => {
            const map = taskMaps.find((taskMap) => taskMap.has(id));
            const current = map ? readEntity<Task>(map.get(id)) : null;

            if (map && current?.quotedAmountBilling?.invoiceId === operation.invoiceId) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
        operation.application.taskCutoffUpdates.forEach(({ id, expectedLastBilledAt, updates }) => {
            const map = taskMaps.find((taskMap) => taskMap.has(id));
            const current = map ? readEntity<Task>(map.get(id)) : null;

            if (map && (current?.lastBilledAt ?? null) === expectedLastBilledAt) {
                this.updateEntityFieldsIfChanged(map as any, id, updates);
            }
        });
    }

    private applyInvoiceBillingCorePhase(operation: InvoiceBillingOperation): void {
        this.coreDoc.transact(() => {
            if (operation.kind === 'finalize') {
                operation.application.projectLinkUpdates.forEach(({ id, updates }) => {
                    const project = readEntity<Project>(this.projects.get(id));
                    if (!project) return;

                    this.updateEntityFieldsIfChanged(this.projects as any, id, {
                        invoiceIds: Array.from(new Set([...(project.invoiceIds ?? []), operation.invoiceId])),
                        updatedAt: Math.max(project.updatedAt ?? 0, updates.updatedAt ?? 0),
                    });
                });

                const sequenceUpdate = operation.application.invoiceTemplateSequenceUpdate;
                if (sequenceUpdate) {
                    const template = readEntity<InvoiceTemplate>(this.invoiceTemplates.get(sequenceUpdate.id));
                    const target = sequenceUpdate.updates.currentSequentialNumber;

                    if (template && typeof target === 'number'
                        && (template.currentSequentialNumber ?? 0) < target) {
                        this.updateEntityFieldsIfChanged(this.invoiceTemplates as any, sequenceUpdate.id, sequenceUpdate.updates);
                    }
                }
                return;
            }

            if (operation.kind === 'cancel') {
                return;
            }

            operation.application.projectUnlinkUpdates.forEach(({ id, updates }) => {
                const project = readEntity<Project>(this.projects.get(id));
                if (!project) return;

                this.updateEntityFieldsIfChanged(this.projects as any, id, {
                    invoiceIds: (project.invoiceIds ?? []).filter((invoiceId) => invoiceId !== operation.invoiceId),
                    updatedAt: Math.max(project.updatedAt ?? 0, updates.updatedAt ?? 0),
                });
            });

            const sequenceUpdate = operation.application.invoiceTemplateSequenceUpdate;
            if (sequenceUpdate) {
                const template = readEntity<InvoiceTemplate>(this.invoiceTemplates.get(sequenceUpdate.id));
                const target = sequenceUpdate.updates.currentSequentialNumber;

                if (template && typeof target === 'number'
                    && template.currentSequentialNumber === target + 1) {
                    this.updateEntityFieldsIfChanged(this.invoiceTemplates as any, sequenceUpdate.id, sequenceUpdate.updates);
                }
            }
        });
    }

    private applyInvoiceBillingInvoicePhase(operation: InvoiceBillingOperation): void {
        if (operation.kind === 'undo') {
            this.invoices.delete(operation.invoiceId);
            return;
        }

        const current = readEntity<Invoice>(this.invoices.get(operation.invoiceId));

        if (operation.kind === 'cancel') {
            if (!current) {
                return;
            }

            if (
                current.status === 'canceled'
                && (
                    current.canceledAt !== operation.desiredInvoice.canceledAt
                    || current.cancellationReason !== operation.desiredInvoice.cancellationReason
                )
            ) {
                return;
            }

            // Canceled invoices require status, timestamp, and reason together.
            // Publish the field-level CRDT updates in one transaction so React
            // observers never receive an invalid intermediate canceled record.
            this.coreDoc.transact(() => {
                this.updateEntityFieldsIfChanged(
                    this.invoices as any,
                    operation.invoiceId,
                    operation.application.invoiceUpdates,
                );
            });
            return;
        }

        if (!current) {
            (this.invoices as any).set(
                operation.invoiceId,
                objectToYMap(operation.desiredInvoice as unknown as Record<string, unknown>)
            );
            return;
        }

        if (current.status === 'draft') {
            this.updateEntityFieldsIfChanged(this.invoices as any, operation.invoiceId, {
                ...operation.application.invoiceUpdates,
                billingSelectionSnapshot: operation.desiredInvoice.billingSelectionSnapshot,
            });
        }
    }

    async exportBackupData(options: {
        backupType?: 'automatic' | 'manual';
        exportDate?: string;
        refreshFromCloud?: boolean;
        refreshLazyDocsFromCloud?: boolean;
    } = {}): Promise<BackupPayload> {
        // Portable backups omit the internal operation journal, so pending
        // operations must first reach a consistent product-data state.
        await this.reconcileInvoiceBillingOperations({ includeCompleted: false });

        const shouldRefreshFromCloud = options.refreshFromCloud === true && this.driveProvider?.isConnected();
        const shouldRefreshLazyDocs = (shouldRefreshFromCloud || options.refreshLazyDocsFromCloud === true)
            && this.driveProvider?.isConnected();
        const loadOptions = shouldRefreshLazyDocs ? { allowPullFromDrive: true } : undefined;

        if (shouldRefreshFromCloud) {
            try {
                await this.forceDriveSync({ allowPull: true, forceFullState: false });
            } catch {
                throw new Error('Unable to refresh cloud data before export. Please check your connection and try again.');
            }

            const syncState = this.getSyncState();
            if (syncState === 'offline' || syncState === 'error') {
                throw new Error('Unable to refresh cloud data before export. Please check your connection and try again.');
            }
        }

        const [tasks, timeEntries, invoices, expenses] = await Promise.all([
            this.getAllTasks(loadOptions),
            this.loadAllTimeEntries(loadOptions),
            this.getAllInvoices(loadOptions),
            this.getAllExpenses(loadOptions),
        ]);

        return createBackupPayload({
            exportDate: options.exportDate,
            backupType: options.backupType,
            projects: collectEntities(this.projects as any),
            tasks,
            timeEntries,
            invoices,
            paymentMethods: collectEntities(this.paymentMethods as any),
            expenseCategories: collectEntities(this.expenseCategories as any),
            taxReturnPeriods: collectEntities(this.taxReturnPeriods as any),
            businessInfos: collectEntities(this.businessInfos as any),
            businessBrandAssets: collectEntities(this.businessBrandAssets as any),
            clients: collectEntities(this.clients as any),
            invoiceTemplates: collectEntities(this.invoiceTemplates as any),
            emailTemplates: collectEntities(this.emailTemplates as any),
            expenses,
            expenseRecurrences: collectEntities(this.expenseRecurrences as any),
            dailyGoals: collectEntities(this.dailyGoals as any),
            plannerAttachments: collectEntities(this.plannerAttachments as any),
            preferences: Object.fromEntries(this.preferences.entries()) as Preferences,
        });
    }

    async importBackupData(data: BackupImportPayload): Promise<void> {
        // Direct callers receive the same complete boundary validation as JSON
        // restores. All validation finishes before archive docs are loaded or any
        // collection is mutated.
        data = validateBackupImportPayload(data);

        const archivedTaskMapPromise = (data.tasks || []).some((task) => task.archived || task.archivedOnDate)
            ? this.loadArchivedTasks()
            : null;
        const archivedInvoiceMapPromise = (data.invoices || []).some((invoice) => this.shouldArchiveInvoiceOnImport(normalizeInvoiceRecord(invoice)))
            ? this.loadArchivedInvoices()
            : null;
        const archivedExpenseMapPromise = (data.expenses || []).some((expense) => this.shouldArchiveExpenseOnImport(expense))
            ? this.loadArchivedExpenses()
            : null;

        const historicalEntryYears = new Set(
            (data.timeEntries || [])
                .filter((entry) => this.shouldArchiveTimeEntryOnImport(entry))
                .map((entry) => new Date(entry.start).getFullYear())
        );

        const historicalEntryMaps = new Map<number, Y.Map<string, TimeEntry>>();

        for (const year of historicalEntryYears) {
            historicalEntryMaps.set(year, await this.loadEntriesForYear(year));
        }

        const archivedTasksMap = archivedTaskMapPromise ? await archivedTaskMapPromise : null;
        const archivedInvoicesMap = archivedInvoiceMapPromise ? await archivedInvoiceMapPromise : null;
        const archivedExpensesMap = archivedExpenseMapPromise ? await archivedExpenseMapPromise : null;

        for (const project of data.projects || []) {
            const validated = validateCollectionEntity<Project>('projects', project, `import project ${project.id}`);
            (this.projects as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const task of data.tasks || []) {
            const validated = validateCollectionEntity<Task>('tasks', task, `import task ${task.id}`);
            const targetMap = validated.archived || validated.archivedOnDate ? archivedTasksMap : this.tasks;
            (targetMap as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const entry of data.timeEntries || []) {
            const validated = validateCollectionEntity<TimeEntry>('timeEntries', entry, `import time entry ${entry.id}`);
            if (this.shouldArchiveTimeEntryOnImport(validated)) {
                const year = new Date(validated.start).getFullYear();
                const yearMap = historicalEntryMaps.get(year) ?? await this.loadEntriesForYear(year);
                historicalEntryMaps.set(year, yearMap);
                (yearMap as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
            } else {
                (this.activeTimeEntries as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
            }
        }

        for (const invoice of data.invoices || []) {
            const normalizedInvoice = normalizeInvoiceRecord(invoice);
            const validated = validateCollectionEntity<Invoice>('invoices', normalizedInvoice, `import invoice ${normalizedInvoice.id}`);
            const targetMap = this.shouldArchiveInvoiceOnImport(validated) ? archivedInvoicesMap : this.invoices;
            (targetMap as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const method of data.paymentMethods || []) {
            const validated = validateCollectionEntity<PaymentMethod>('paymentMethods', method, `import payment method ${method.id}`);
            (this.paymentMethods as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const category of data.expenseCategories || []) {
            const validated = validateCollectionEntity<ExpenseCategory>('expenseCategories', category, `import expense category ${category.id}`);
            (this.expenseCategories as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const taxReturnPeriod of data.taxReturnPeriods || []) {
            const validated = validateCollectionEntity<TaxReturnPeriod>('taxReturnPeriods', taxReturnPeriod, `import tax return period ${taxReturnPeriod.id}`);
            (this.taxReturnPeriods as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const info of data.businessInfos || []) {
            const validated = validateCollectionEntity<BusinessInfo>('businessInfos', info, `import business info ${info.id}`);
            (this.businessInfos as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const asset of data.businessBrandAssets || []) {
            const validated = validateCollectionEntity<BusinessBrandAsset>('businessBrandAssets', asset, `import business brand asset ${asset.id}`);
            (this.businessBrandAssets as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const client of data.clients || []) {
            const validated = validateCollectionEntity<Client>('clients', client, `import client ${client.id}`);
            (this.clients as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const template of data.invoiceTemplates || []) {
            const validated = validateCollectionEntity<InvoiceTemplate>('invoiceTemplates', template, `import invoice template ${template.id}`);
            (this.invoiceTemplates as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const template of data.emailTemplates || []) {
            const validated = validateCollectionEntity<EmailTemplate>('emailTemplates', template, `import email template ${template.id}`);
            (this.emailTemplates as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const expense of data.expenses || []) {
            const validated = validateCollectionEntity<Expense>('expenses', expense, `import expense ${expense.id}`);
            const targetMap = this.shouldArchiveExpenseOnImport(validated) ? archivedExpensesMap : this.expenses;
            (targetMap as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const recurrence of data.expenseRecurrences || []) {
            const validated = validateCollectionEntity<ExpenseRecurrence>('expenseRecurrences', recurrence, `import expense recurrence ${recurrence.id}`);
            (this.expenseRecurrences as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const goal of data.dailyGoals || []) {
            const validated = validateCollectionEntity<DailyGoal>('dailyGoals', goal, `import daily goal ${goal.id}`);
            (this.dailyGoals as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        for (const attachment of data.plannerAttachments || []) {
            const validated = validateCollectionEntity<PlannerAttachment>('plannerAttachments', attachment, `import planner attachment ${attachment.id}`);
            (this.plannerAttachments as any).set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
        }

        const validatedPreferences = validateCollectionEntity<Preferences>('preferences', data.preferences || {}, 'import preferences');
        for (const key of Array.from(this.preferences.keys())) {
            this.preferences.delete(key);
        }
        for (const [key, value] of Object.entries(validatedPreferences)) {
            this.preferences.set(key, value as Preferences[keyof Preferences]);
        }

    }

    /**
     * Replace the local workspace with a validated backup and restore the
     * previous workspace if applying the replacement fails. Active timers are
     * intentionally absent from portable backups, but must survive a failed
     * restore attempt.
     */
    async replaceAllDataWithBackup(data: BackupImportPayload): Promise<void> {
        const validatedData = validateBackupImportPayload(data);
        const rollbackPayload = await this.exportBackupData({
            backupType: 'manual',
        });
        const rollbackTimers = collectValidatedEntities<MultiTimerState>(
            'timers',
            this.timers as any,
            'prepare restore rollback'
        );

        const restoreJournal: RestoreJournalRecord = {
            version: 1,
            operationId: generateId(),
            createdAt: Date.now(),
            rollback: rollbackPayload,
            rollbackTimers,
            replacement: validatedData,
        };

        // This transaction must commit before the existing workspace is
        // touched. A browser close at any later point can recover the rollback.
        await writeRestoreJournal(restoreJournal);

        const resetWorkspace = async () => {
            await this.clearAllData();
            await this.initialize({ skipRestoreRecovery: true });
        };

        try {
            await resetWorkspace();
            await this.importBackupData(validatedData);
            await this.docManager.flushPersistence();
            await clearRestoreJournal();
        } catch (restoreFailure) {
            try {
                await resetWorkspace();
                await this.importBackupData(rollbackPayload);
                this.restoreTimers(rollbackTimers);
                await this.docManager.flushPersistence();
                await clearRestoreJournal();
            } catch (rollbackFailure) {
                const rollbackMessage = rollbackFailure instanceof Error
                    ? rollbackFailure.message
                    : String(rollbackFailure);

                throw new Error(
                    `Restore failed and the previous workspace could not be recovered automatically: ${rollbackMessage}`
                );
            }

            const restoreMessage = restoreFailure instanceof Error
                ? restoreFailure.message
                : String(restoreFailure);

            throw new Error(`Restore failed; the previous workspace was recovered. ${restoreMessage}`);
        }
    }

    /**
     * A journal only remains when a restore did not reach its durable commit
     * barrier. Recover the pre-restore workspace before normal startup so a
     * crash can never expose a partially replaced collection set.
     */
    private async recoverInterruptedRestore(journal: RestoreJournalRecord): Promise<void> {
        try {
            await this.clearAllData();
            await this.initialize({ skipRestoreRecovery: true });
            await this.importBackupData(journal.rollback);
            this.restoreTimers(journal.rollbackTimers);
            await this.docManager.flushPersistence();
            await clearRestoreJournal();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`An interrupted restore was detected, but the previous workspace could not be recovered: ${message}`);
        }
    }

    private restoreTimers(timers: MultiTimerState[]): void {
        this.coreDoc.transact(() => {
            for (const timer of timers) {
                const validatedTimer = validateCollectionEntity<MultiTimerState>(
                    'timers',
                    timer,
                    `restore rollback timer ${timer.projectId}`
                );
                this.timers.set(
                    validatedTimer.projectId,
                    objectToYMap(validatedTimer as unknown as Record<string, unknown>) as any
                );
            }
        });
    }

    // =========================================================================
    // Backups
    // =========================================================================

    /**
     * List all available backups from Google Drive
     */
    async listBackups(): Promise<BackupInfo[]> {
        if (!this.backupManager) return [];
        return this.backupManager.listBackups();
    }

    /**
     * Create a backup on demand
     */
    async createBackup(): Promise<string | null> {
        if (!this.backupManager) {
            throw new Error('Drive not connected');
        }
        return this.backupManager.createBackup();
    }

    /**
     * Download a specific backup's data
     */
    async downloadBackup(fileId: string): Promise<unknown> {
        if (!this.backupManager) {
            throw new Error('Drive not connected');
        }
        return this.backupManager.downloadBackup(fileId);
    }

    /**
     * Delete all backup files from Google Drive
     */
    async deleteAllBackups(): Promise<void> {
        if (!this.backupManager) return;
        return this.backupManager.deleteAllBackups();
    }

    // =========================================================================
    // Reconciliation
    // =========================================================================

    /**
     * Reconcile orphaned timers after sync.
     *
     * When a timer is stopped, two writes happen across different Yjs docs:
     *   1. Time entry created in `entries-active`
     *   2. Timer deleted from `core`
     *
     * If those deltas arrive on another device out of order (or one fails),
     * a "ghost" timer can persist even though its entry already exists.
     *
     * This method detects and cleans up such orphans by matching entries
     * against the specific timer instance that produced them.
     */
    reconcileOrphanedTimers(): void {
        if (!this._coreDoc || !this._activeEntriesDoc) return;

        const timersMap = this._coreDoc.getMap<MultiTimerState>('timers');
        if (timersMap.size === 0) return;

        const stoppedKeys = new Set<string>();

        forEachEntity<TimeEntry>(
            this._activeEntriesDoc.getMap('timeEntries') as Y.Map<string, unknown>,
            (entry) => {
                if (!entry._stoppedTimerKey) {
                    return;
                }

                const timer = readEntity<MultiTimerState>(timersMap.get(entry._stoppedTimerKey));
                if (!timer) {
                    return;
                }

                if (entry._stoppedTimerInstanceId && timer.timerInstanceId === entry._stoppedTimerInstanceId) {
                    stoppedKeys.add(entry._stoppedTimerKey);
                    return;
                }

                // Legacy fallback for timers created before instance IDs existed.
                if (!entry._stoppedTimerInstanceId && !timer.timerInstanceId && entry.taskId === timer.taskId && entry.start === timer.startTime) {
                    stoppedKeys.add(entry._stoppedTimerKey);
                }
            },
        );

        if (stoppedKeys.size === 0) return;

        this._coreDoc.transact(() => {
            for (const key of stoppedKeys) {
                timersMap.delete(key);
            }
        });
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

        const persistedDocs = await this.docManager.listPersistedDocs();

        // Disconnect from Drive sync first
        this.driveProvider?.disconnect();
        this.driveProvider = null;

        // Destroy in-memory docs and remove IndexedDB persistence to avoid syncing deletions
        this.docManager.destroy();

        // Collect all potential database names to delete
        // 1. Standard docs
        const docsToDelete = new Set<DocName>([
            'core',
            'entries-active',
            'tasks-archived',
            'expenses-archived',
            'invoices-archived'
        ]);

        for (const docName of persistedDocs) {
            docsToDelete.add(docName);
        }
        
        // 2. Add discovered persisted/loaded docs, including historical years outside the default range
        // 3. Keep the default year range as a fallback for browsers without indexedDB.databases()
        const currentYear = new Date().getFullYear();
        const fallbackEndYear = Math.max(currentYear + 10, 2035);

        for (let year = 2000; year <= fallbackEndYear; year++) {
            docsToDelete.add(`entries-${year}` as DocName);
        }

        // Delete all databases using the correct prefix via DocManager
        await this.docManager.deleteDatabases(Array.from(docsToDelete));

        this._coreDoc = null;
        this._activeEntriesDoc = null;
        this._archivedTasksDoc = null;
        this._archivedTasksLoading = null;
        this._archivedInvoicesDoc = null;
        this._archivedInvoicesLoading = null;
        this._archivedExpensesDoc = null;
        this._archivedExpensesLoading = null;
        this.disconnectedDirtyDocHandlers.clear();
        this.clearDisconnectedDirtyDocs();
        clearSyncPersistence();
        this._isReady = false;

        console.log('[YjsStore] All data cleared');
    }

    /**
     * Destroy the store and cleanup all resources
     */
    destroy(): void {
        console.log('[YjsStore] Destroying...');
        this.driveProvider?.disconnect();
        this.driveProvider = null;
        this.backupManager = null;
        this.docManager.destroy();
        this._coreDoc = null;
        this._activeEntriesDoc = null;
        this._archivedTasksDoc = null;
        this._archivedInvoicesDoc = null;
        this._archivedExpensesDoc = null;
        this.disconnectedDirtyDocHandlers.clear();
        this.clearDisconnectedDirtyDocs();
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

    private shouldArchiveTimeEntryOnImport(entry: TimeEntry): boolean {
        return entry.start < Date.now() - NINETY_DAYS_MS;
    }

    private shouldArchiveInvoiceOnImport(invoice: Invoice): boolean {
        if (invoice.status !== 'paid' || typeof invoice.paidAt !== 'number') {
            return false;
        }

        return new Date(invoice.paidAt).getFullYear() < new Date().getFullYear();
    }

    private shouldArchiveExpenseOnImport(expense: Expense): boolean {
        if (!expense?.date) {
            return false;
        }

        const parsedDate = parseStoredDate(expense.date);
        if (!parsedDate) {
            return false;
        }

        if (parsedDate.getTime() >= Date.now() - NINETY_DAYS_MS) {
            return false;
        }

        const isPaid = expense.paymentStatus === 'paid';
        const isBillableUnbilled = expense.billable && expense.billingStatus === 'unbilled';

        return isPaid && !isBillableUnbilled;
    }

    private trackDocForDisconnectedChanges(docName: DocName, doc: Y.Doc): void {
        if (this.disconnectedDirtyDocHandlers.has(docName)) {
            return;
        }

        const handler: DocUpdateHandler = (_update, origin) => {
            if (origin === 'remote') {
                return;
            }

            if (this.driveProvider?.isConnected()) {
                return;
            }

            this.markDisconnectedDirtyDoc(docName);
        };

        doc.on('update', handler);
        this.disconnectedDirtyDocHandlers.set(docName, handler);
    }

    private markDisconnectedDirtyDoc(docName: DocName): void {
        if (this.disconnectedDirtyDocs.has(docName)) {
            return;
        }

        this.disconnectedDirtyDocs.add(docName);
        this.persistDisconnectedDirtyDocs();
    }

    private getDisconnectedDirtyDocs(): DocName[] {
        return Array.from(this.disconnectedDirtyDocs);
    }

    private isDisconnectedDirtyDoc(docName: DocName): boolean {
        return this.disconnectedDirtyDocs.has(docName);
    }

    private shouldBootstrapRemotePullOnManualConnect(): boolean {
        return !this.docManager.getLoadedDocs().some((docName) => this.docHasMeaningfulLocalData(docName));
    }

    private docHasMeaningfulLocalData(docName: DocName): boolean {
        const doc = this.docManager.getDocSync(docName);
        if (!doc) {
            return false;
        }

        if (docName === 'core') {
            return [
                'projects',
                'tasks',
                'clients',
                'businessInfos',
                'businessBrandAssets',
                'invoiceTemplates',
                'emailTemplates',
                'paymentMethods',
                'expenseCategories',
                'taxReturnPeriods',
                'expenses',
                'expenseRecurrences',
                'timers',
                'plannerAttachments',
                'dailyGoals',
                'invoices',
            ].some((mapName) => doc.getMap(mapName).size > 0)
                || (doc.share.has('invoiceBillingOperations')
                    && doc.getMap('invoiceBillingOperations').size > 0);
        }

        if (docName === 'entries-active' || /^entries-\d{4}$/.test(docName)) {
            return doc.getMap('timeEntries').size > 0;
        }

        if (docName === 'tasks-archived') {
            return doc.getMap('tasks').size > 0;
        }

        if (docName === 'expenses-archived') {
            return doc.getMap('expenses').size > 0;
        }

        if (docName === 'invoices-archived') {
            return doc.getMap('invoices').size > 0;
        }

        return false;
    }

    private canClearDisconnectedDirtyDocsAfterSync(): boolean {
        if (!this.driveProvider) {
            return false;
        }

        const state = this.driveProvider.getState();
        return state !== 'offline' && state !== 'error' && !this.driveProvider.hasLocalChangesToPush();
    }

    private clearDisconnectedDirtyDocs(docNames?: DocName[]): void {
        if (!docNames) {
            this.disconnectedDirtyDocs.clear();
            this.persistDisconnectedDirtyDocs();
            return;
        }

        if (docNames.length === 0) {
            return;
        }

        let changed = false;

        for (const docName of docNames) {
            if (this.disconnectedDirtyDocs.delete(docName)) {
                changed = true;
            }
        }

        if (changed) {
            this.persistDisconnectedDirtyDocs();
        }
    }

    private readDisconnectedDirtyDocs(): Set<DocName> {
        if (typeof localStorage === 'undefined') {
            return new Set();
        }

        try {
            const stored = localStorage.getItem(DISCONNECTED_DIRTY_DOCS_STORAGE_KEY);
            if (!stored) {
                return new Set();
            }

            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                return new Set();
            }

            return new Set(parsed as DocName[]);
        } catch (error) {
            console.warn('[YjsStore] Failed to read disconnected dirty docs:', error);
            return new Set();
        }
    }

    private persistDisconnectedDirtyDocs(): void {
        if (typeof localStorage === 'undefined') {
            return;
        }

        try {
            if (this.disconnectedDirtyDocs.size === 0) {
                localStorage.removeItem(DISCONNECTED_DIRTY_DOCS_STORAGE_KEY);
                return;
            }

            localStorage.setItem(
                DISCONNECTED_DIRTY_DOCS_STORAGE_KEY,
                JSON.stringify(Array.from(this.disconnectedDirtyDocs)),
            );
        } catch (error) {
            console.warn('[YjsStore] Failed to persist disconnected dirty docs:', error);
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
