import type { CloudProvider, SyncData, SyncMeta } from './providers/CloudProvider';
import { AuthorizationError } from './providers/GoogleDriveProvider';
import { syncLog } from './debugLogger';
import { generateChecksum, getDeviceId } from '@/utils/syncUtils';
import { compareForMerge, type SyncableEntity } from '@/utils/syncableEntity';

export type SyncState =
    | 'idle'
    | 'checking'
    | 'pulling'
    | 'pushing'
    | 'merging'
    | 'error';

interface SyncEngineOptions {
    provider: CloudProvider;
    getLocalData: () => Promise<SyncData>;
    setLocalData: (data: SyncData) => Promise<void>;
    onStateChange?: (state: SyncState) => void;
    onConflict?: (local: SyncData, remote: SyncData) => Promise<SyncData>;
    onAuthError?: (error: Error) => void;
}

export class SyncEngine {

    private provider: CloudProvider;
    private getLocalData: () => Promise<SyncData>;
    private setLocalData: (data: SyncData) => Promise<void>;
    private onStateChange?: (state: SyncState) => void;
    private onConflict?: (local: SyncData, remote: SyncData) => Promise<SyncData>;
    private onAuthError?: (error: Error) => void;

    private state: SyncState = 'idle';
    private lastSyncedAt: number = 0;
    private lastSyncVersion: number = 0;
    private lastLocalChecksum: string = '';
    private lastRemoteChecksum: string = '';
    private suppressLocalChange: boolean = false;
    private syncTimeout: ReturnType<typeof setTimeout> | null = null;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private firstChangeAt: number | null = null;
    private lastLocalChangeAt: number = 0;
    private pendingSyncCount: number = 0;
    private isOffline: boolean = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    private handleVisibilityChange?: () => void;
    private handleBeforeUnload?: () => void;
    private handleOnline?: () => void;
    private handleOffline?: () => void;

    private readonly DEBOUNCE_MS = 0; // Instant sync - no rapid-fire typing scenarios
    private readonly CHECK_INTERVAL_MS = 30_000; // 30 seconds (was 2m) - background checks
    private readonly ACTIVE_CHECK_INTERVAL_MS = 10_000; // 10 seconds (was 1m) - active checks
    private readonly MAX_DELAY_MS = 60_000; // 1 minute (was 5m) - max wait before syncing
    private readonly PRE_INACTIVE_SYNC_WINDOW_MS = 5_000;
    // private readonly MIN_SYNC_INTERVAL_MS = 5_000; // Minimum 5 seconds between syncs
    private lastSyncCompletedAt: number = 0;
    private isSyncing: boolean = false;

    constructor(options: SyncEngineOptions) {

        this.provider = options.provider;
        this.getLocalData = options.getLocalData;
        this.setLocalData = options.setLocalData;
        this.onStateChange = options.onStateChange;
        this.onConflict = options.onConflict;
        this.onAuthError = options.onAuthError;
    }

    private setState(newState: SyncState) {

        this.state = newState;
        this.onStateChange?.(newState);
    }

    async initialize(): Promise<void> {

        syncLog('initialize:start');
        await this.provider.initialize();

        const localData = await this.getLocalData();
        this.lastSyncedAt = localData._sync?.lastSyncedAt || 0;
        this.lastSyncVersion = localData._sync?.syncVersion || 0;
        this.lastLocalChecksum = await generateChecksum(localData);

        syncLog('initialize:done', { lastSyncedAt: this.lastSyncedAt, lastSyncVersion: this.lastSyncVersion, lastLocalChecksum: this.lastLocalChecksum });

        await this.sync();
        this.startBackgroundChecks();
        this.setupVisibilityListener();
        this.setupNetworkListeners();
        this.setupBeforeUnloadListener();
    }

    scheduleSync(): void {

        const now = Date.now();
        this.lastLocalChangeAt = now;

        if (this.isSyncing) {
            this.pendingSyncCount++;
            syncLog('scheduleSync:queued', { pendingSyncCount: this.pendingSyncCount });
            return;
        }

        if (!this.firstChangeAt) {

            this.firstChangeAt = now;
        }

        if (this.syncTimeout) {

            clearTimeout(this.syncTimeout);
        }

        const timeSinceFirstChange = now - this.firstChangeAt;
        const delay = timeSinceFirstChange > this.MAX_DELAY_MS ? 0 : this.DEBOUNCE_MS;

        syncLog('scheduleSync', {
            firstChangeAt: this.firstChangeAt,
            lastLocalChangeAt: this.lastLocalChangeAt,
            delay,
            timeSinceFirstChange,
        });

        this.syncTimeout = setTimeout(() => {
            this.syncTimeout = null;
            this.sync();
            this.firstChangeAt = null;
        }, delay);

        this.requestBackgroundSync();
    }

    async sync(): Promise<void> {

        // Prevent concurrent syncs
        if (this.isSyncing) {
            syncLog('sync:skip already syncing');
            this.pendingSyncCount++;
            return;
        }

        if (this.state !== 'idle' && this.state !== 'error') {
            syncLog('sync:skip state not idle/error', { state: this.state });
            return;
        }

        if (this.isOffline) {
            syncLog('sync:skip offline');
            return;
        }

        // Minimum interval removed: allow immediate sync after local changes

        this.isSyncing = true;

        try {

            this.setState('checking');

            if (this.provider.debugSnapshot) {
                await this.provider.debugSnapshot();
            }

            // Get current local state
            const localData = await this.getLocalData();
            const localChecksum = await generateChecksum(localData);

            // Check if remote has changes we need to pull
            let hasRemoteChanges = await this.provider.hasRemoteChanges(this.lastSyncedAt);

            // Fallback: compare checksums if modifiedTime check says no changes
            // This catches cases where local lastSyncedAt is stale or wrong
            // Compare to lastLocalChecksum (state at last sync), NOT current localChecksum
            // If remote differs from last-synced state, remote changed
            // If remote matches last-synced state, any difference is local changes (should push, not pull)
            if (!hasRemoteChanges) {
                try {
                    const meta = await this.provider.getMeta();
                    if (meta?.checksum && meta.checksum !== this.lastLocalChecksum) {
                        syncLog('sync:remote checksum differs from last sync, forcing pull', {
                            remoteChecksum: meta.checksum,
                            lastLocalChecksum: this.lastLocalChecksum,
                        });
                        hasRemoteChanges = true;
                    }
                } catch {
                    // Meta fetch failed, continue with modifiedTime result
                }
            }

            syncLog('sync:check', { hasRemoteChanges, localChecksum, lastSyncedAt: this.lastSyncedAt });

            if (hasRemoteChanges) {

                this.setState('pulling');
                const remoteData = await this.provider.pull();

                if (remoteData) {

                    const remoteChecksum = await generateChecksum(remoteData);

                    syncLog('sync:pull', { localChecksum, remoteChecksum });

                    // If remote matches last synced state, prefer pushing local changes (no pull)
                    if (remoteChecksum === this.lastLocalChecksum) {
                        this.lastRemoteChecksum = remoteChecksum;

                        if (localChecksum === this.lastLocalChecksum) {
                            syncLog('sync:pull skipped (remote matches last sync)');
                            const syncedAt = Date.now();
                            this.lastSyncedAt = syncedAt;
                            this.lastSyncCompletedAt = syncedAt;
                            syncLog('sync:complete (no changes)');

                            this.finalizeSync('idle');
                            return;
                        }

                        syncLog('sync:remote matches last sync, prefer push');
                        // Continue to push path below without returning
                    } else {

                        // If checksums match, no actual data difference
                        if (localChecksum === remoteChecksum) {
                            syncLog('sync:pull skipped (data identical)');
                        } else {
                            // Check if local has changes we haven't pushed yet
                            const localHasUnpushedChanges = localChecksum !== this.lastLocalChecksum;

                            if (localHasUnpushedChanges) {
                                // Conflict: both local and remote have changes
                                syncLog('sync:conflict detected');
                                this.setState('merging');

                                // Re-read current local data to get the latest state for merging
                                // This ensures any changes made during the pull are included
                                const currentLocalData = await this.getLocalData();
                                const currentLocalChecksum = await generateChecksum(currentLocalData);

                                const merged = this.onConflict
                                    ? await this.onConflict(currentLocalData, remoteData)
                                    : this.autoMerge(currentLocalData, remoteData);

                                // Check if local changed AGAIN during the merge
                                const postMergeLocalData = await this.getLocalData();
                                const postMergeLocalChecksum = await generateChecksum(postMergeLocalData);

                                if (postMergeLocalChecksum === currentLocalChecksum) {
                                    // Local didn't change during merge - safe to apply
                                    await this.setLocalDataSafely(merged);
                                    this.lastLocalChecksum = await generateChecksum(merged);
                                    syncLog('sync:merged (local unchanged during merge)');
                                } else {
                                    // Local changed during merge - re-merge with newest local state
                                    const reMerged = this.autoMerge(postMergeLocalData, merged);
                                    await this.setLocalDataSafely(reMerged);
                                    this.lastLocalChecksum = await generateChecksum(reMerged);
                                    syncLog('sync:merged (local changed during merge, re-merged)');
                                }
                            } else {
                                // No local changes at start - but check if local changed during pull
                                const currentLocalData = await this.getLocalData();
                                const currentLocalChecksum = await generateChecksum(currentLocalData);

                                if (currentLocalChecksum === localChecksum) {
                                    // Local didn't change - safe to apply remote
                                    syncLog('sync:applying remote data');
                                    await this.setLocalDataSafely(remoteData);
                                    this.lastLocalChecksum = remoteChecksum;
                                } else {
                                    // Local changed during pull! Merge instead of overwriting
                                    syncLog('sync:local changed during pull, merging instead');
                                    const merged = this.autoMerge(currentLocalData, remoteData);
                                    await this.setLocalDataSafely(merged);
                                    this.lastLocalChecksum = await generateChecksum(merged);
                                }
                            }
                            // Update syncVersion from remote data
                            this.lastSyncVersion = remoteData._sync?.syncVersion || 0;
                        }

                        this.lastRemoteChecksum = remoteChecksum;

                        // Complete sync after pull - skip push to avoid async state issues
                        const syncedAt = Date.now();
                        this.lastSyncedAt = syncedAt;
                        this.lastSyncCompletedAt = syncedAt;
                        syncLog('sync:complete (pulled)');

                        this.finalizeSync('idle');
                        return;
                    }
                }
            }

            // No remote changes - check if we need to push local changes

            if (localChecksum !== this.lastLocalChecksum) {

                this.setState('pushing');
                syncLog('sync:pushing local changes');

                const newSyncVersion = this.lastSyncVersion + 1;
                const withSyncMeta = {
                    ...localData,
                    _sync: {
                        lastSyncedAt: Date.now(),
                        deviceId: await getDeviceId(),
                        syncVersion: newSyncVersion,
                    },
                };

                const withSyncChecksum = await generateChecksum(withSyncMeta);

                const meta: SyncMeta = {
                    version: 1,
                    syncVersion: newSyncVersion,
                    lastModified: Date.now(),
                    checksum: withSyncChecksum,
                    deviceId: withSyncMeta._sync.deviceId,
                    entryCount: this.countEntries(withSyncMeta),
                };

                await this.provider.push(withSyncMeta, meta);
                // Invalidate cache since we just pushed
                if ('invalidateCache' in this.provider && typeof this.provider.invalidateCache === 'function') {
                    this.provider.invalidateCache();
                }

                // Re-read current local data to check if it changed during push
                // DO NOT blindly write back stale data - local state may have changed!
                const currentLocalData = await this.getLocalData();
                const currentLocalChecksum = await generateChecksum(currentLocalData);

                if (currentLocalChecksum === localChecksum) {
                    // Local data didn't change during push - safe to update _sync metadata
                    await this.setLocalDataSafely(withSyncMeta);
                    this.lastLocalChecksum = withSyncChecksum;
                    syncLog('sync:pushed (local unchanged)', { syncVersion: newSyncVersion });
                } else {
                    // Local data changed during push! Only update _sync metadata on current data
                    // The actual data changes will be synced in the queued follow-up sync
                    const currentWithSyncMeta = {
                        ...currentLocalData,
                        _sync: {
                            lastSyncedAt: Date.now(),
                            deviceId: await getDeviceId(),
                            syncVersion: newSyncVersion,
                        },
                    };
                    await this.setLocalDataSafely(currentWithSyncMeta);
                    // Keep lastLocalChecksum as the checksum we pushed to remote
                    // This ensures the next sync detects the local changes
                    this.lastLocalChecksum = withSyncChecksum;
                    syncLog('sync:pushed (local changed during sync, preserving new local state)', {
                        syncVersion: newSyncVersion,
                        pushedChecksum: withSyncChecksum,
                        currentChecksum: currentLocalChecksum,
                    });
                }

                this.lastSyncVersion = newSyncVersion;
                this.lastRemoteChecksum = withSyncChecksum; // After push, remote matches what we pushed

                syncLog('sync:pushed', { syncVersion: newSyncVersion });
            }

            const syncedAt = Date.now();
            this.lastSyncedAt = syncedAt;
            this.lastSyncCompletedAt = syncedAt;

            syncLog('sync:complete', { lastSyncedAt: this.lastSyncedAt, syncVersion: this.lastSyncVersion, lastLocalChecksum: this.lastLocalChecksum });

            // Persist lastSyncedAt and syncVersion so future sessions don't treat remote as newer
            // Re-read current data to avoid overwriting any changes made during sync
            const finalLocalData = await this.getLocalData();
            await this.setLocalDataSafely({
                ...finalLocalData,
                _sync: {
                    ...(finalLocalData._sync || {}),
                    deviceId: finalLocalData._sync?.deviceId || await getDeviceId(),
                    lastSyncedAt: syncedAt,
                    syncVersion: this.lastSyncVersion,
                },
            });

            this.finalizeSync('idle');

        } catch (error) {

            console.error('Sync failed:', error);
            syncLog('sync:error', error);
            // Handle authorization errors specially
            if (error instanceof AuthorizationError) {
                this.onAuthError?.(error);
            }

            this.finalizeSync('error');
        }
    }

    private finalizeSync(nextState: SyncState): void {

        this.isSyncing = false;
        this.setState(nextState);

        // Process queued syncs - since we sync full state, we coalesce all pending into one
        if (nextState === 'idle' && this.pendingSyncCount > 0) {
            const coalesced = this.pendingSyncCount;
            this.pendingSyncCount = 0;
            syncLog('sync:processing queued', { coalescedCount: coalesced });
            this.scheduleSync();
            return;
        }

        this.pendingSyncCount = 0;
    }

    private autoMerge(local: SyncData, remote: SyncData): SyncData {

        const merged: SyncData = { ...local };

        const collections = [
            'projects',
            'tasks',
            'timeEntries',
            'invoices',
            'clients',
            'businessInfos',
            'invoiceTemplates',
            'paymentMethods',
        ] as const;

        for (const collection of collections) {

            merged[collection] = this.mergeCollection(
                (local[collection] as SyncableEntity[] | undefined) || [],
                (remote[collection] as SyncableEntity[] | undefined) || []
            );
        }

        const localPreferences = local.preferences as { updatedAt?: number } | undefined;
        const remotePreferences = remote.preferences as { updatedAt?: number } | undefined;

        if ((remotePreferences?.updatedAt || 0) > (localPreferences?.updatedAt || 0)) {

            merged.preferences = remote.preferences;
        }

        if (local.timer || remote.timer) {

            merged.timer = this.mergeTimerState(local.timer, remote.timer);
        }

        return merged;
    }

    private mergeTimerState(localTimer: SyncData['timer'], remoteTimer: SyncData['timer']) {

        if (!localTimer) {

            return remoteTimer;
        }

        if (!remoteTimer) {

            return localTimer;
        }

        const localActive = localTimer?.startTime && !localTimer?.paused;
        const remoteActive = remoteTimer?.startTime && !remoteTimer?.paused;

        if (localActive && !remoteActive) {

            return localTimer;
        }

        if (remoteActive && !localActive) {

            return remoteTimer;
        }

        const localLastActive = localTimer?.lastActive || 0;
        const remoteLastActive = remoteTimer?.lastActive || 0;

        return localLastActive >= remoteLastActive ? localTimer : remoteTimer;
    }

    /**
     * Merge two collections using deterministic conflict resolution.
     * Uses compareForMerge which considers:
     * 1. updatedAt timestamp (higher wins)
     * 2. _syncSeq sequence number (higher wins if same timestamp)
     * 3. id comparison (lexicographic for ultimate tie-break)
     */
    private mergeCollection<T extends SyncableEntity>(
        local: T[],
        remote: T[]
    ): T[] {

        const merged = new Map<string, T>();

        // Add all local items first
        for (const item of local) {
            merged.set(item.id, item);
        }

        // Merge remote items using deterministic comparison
        for (const item of remote) {
            const existing = merged.get(item.id);
            
            if (!existing) {
                // New item from remote
                merged.set(item.id, item);
            } else {
                // Both exist - use deterministic comparison
                // compareForMerge returns positive if second arg (item/remote) wins
                const comparison = compareForMerge(existing, item);
                if (comparison > 0) {
                    // Remote item is newer/wins
                    merged.set(item.id, item);
                }
                // If comparison <= 0, local item stays (already in merged)
            }
        }

        return Array.from(merged.values());
    }

    private startBackgroundChecks(): void {

        this.checkInterval = setInterval(() => {
            this.checkForRemoteChanges();
        }, this.CHECK_INTERVAL_MS);
    }

    private async checkForRemoteChanges(): Promise<void> {

        if (this.state !== 'idle') {

            return;
        }

        if (this.isOffline) {

            return;
        }

        try {

            const hasChanges = await this.provider.hasRemoteChanges(
                this.lastSyncedAt
            );

            if (hasChanges) {

                await this.sync();
            }

        } catch (error) {

            console.error('Background check failed:', error);
        }
    }

    private setupVisibilityListener(): void {

        this.handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {

                this.checkForRemoteChanges();

                if (this.checkInterval) {

                    clearInterval(this.checkInterval);
                }
                this.checkInterval = setInterval(() => {
                    this.checkForRemoteChanges();
                }, this.ACTIVE_CHECK_INTERVAL_MS);

            } else {

                const hasRecentChanges = (Date.now() - this.lastLocalChangeAt) < this.PRE_INACTIVE_SYNC_WINDOW_MS;
                if (hasRecentChanges) {

                    this.sync();
                }

                if (this.checkInterval) {

                    clearInterval(this.checkInterval);
                }
                this.checkInterval = setInterval(() => {
                    this.checkForRemoteChanges();
                }, this.CHECK_INTERVAL_MS);
            }
        };

        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private setupNetworkListeners(): void {

        this.handleOnline = () => {
            this.isOffline = false;
            this.checkForRemoteChanges();
            this.scheduleSync();
        };

        this.handleOffline = () => {
            this.isOffline = true;
        };

        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }

    private requestBackgroundSync(): void {

        if (!('serviceWorker' in navigator)) {

            return;
        }

        navigator.serviceWorker.ready.then((registration) => {
            const syncManager = (registration as ServiceWorkerRegistration & {
                sync?: { register: (tag: string) => Promise<void> }
            }).sync;

            if (!syncManager?.register) {

                return;
            }

            syncManager.register('tasktime-sync').catch(() => undefined);
        }).catch(() => undefined);
    }

    private setupBeforeUnloadListener(): void {

        this.handleBeforeUnload = (event?: BeforeUnloadEvent) => {
            const hasRecentChanges = (Date.now() - this.lastLocalChangeAt) < this.PRE_INACTIVE_SYNC_WINDOW_MS;
            const hasPendingSync = this.syncTimeout !== null || this.pendingSyncCount > 0;

            if (hasRecentChanges) {
                this.sync();
            }

            if (this.isSyncing || hasRecentChanges || hasPendingSync) {
                if (event) {
                    event.preventDefault();
                    event.returnValue = '';
                }
                return '';
            }

            return undefined;
        };

        window.addEventListener('beforeunload', this.handleBeforeUnload as EventListener);
    }

    private countEntries(data: SyncData): SyncMeta['entryCount'] {

        return {
            projects: data.projects?.length || 0,
            tasks: data.tasks?.length || 0,
            timeEntries: data.timeEntries?.length || 0,
            invoices: data.invoices?.length || 0,
        };
    }

    /**
     * True while a sync is in progress.
     */
    isSyncInProgress(): boolean {
        return this.isSyncing;
    }

    /**
     * True while we are writing data that should not trigger downstream sync scheduling.
     */
    isLocalChangeSuppressed(): boolean {
        return this.suppressLocalChange;
    }

    private async setLocalDataSafely(data: SyncData): Promise<void> {

        this.suppressLocalChange = true;
        try {
            await this.setLocalData(data);
        } finally {
            this.suppressLocalChange = false;
        }
    }

    /**
     * Get the timestamp of the last successful sync (in memory, not persisted)
     */
    getLastSyncedAt(): number {
        return this.lastSyncedAt;
    }

    destroy(): void {

        if (this.syncTimeout) {

            clearTimeout(this.syncTimeout);
        }

        if (this.checkInterval) {

            clearInterval(this.checkInterval);
        }

        if (this.handleVisibilityChange) {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }

        if (this.handleOnline) {
            window.removeEventListener('online', this.handleOnline);
        }

        if (this.handleOffline) {
            window.removeEventListener('offline', this.handleOffline);
        }

        if (this.handleBeforeUnload) {
            window.removeEventListener('beforeunload', this.handleBeforeUnload);
        }
    }
}
