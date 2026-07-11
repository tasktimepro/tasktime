/**
 * YjsContext - React context provider for Yjs store
 *
 * Sync contract source of truth: ../components/sync/README.md
 * 
 * Provides the YjsStore to all components and handles:
 * - Store initialization on mount
 * - Auto-connect to Google Drive when authenticated
 * - Sync state tracking
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { YjsStore, getYjsStore, YjsDocManager, SyncState, SyncPhase, AutoSyncMode, AuthorizationError } from '@/stores/yjs';
/* eslint-disable react-refresh/only-export-components */
import type { BackupInfo } from '@/stores/yjs';
import type { BackupImportPayload } from '@/utils/backupData';
import type { TimeEntry } from '@/stores/yjs/types';
import type * as Y from 'yjs';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useToast } from '@/hooks/useToast';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import { shouldSyncOnLoad, wasSyncInterrupted, hasPersistedPendingChanges } from '@/utils/syncPersistence';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

declare global {

    interface Window {
        __TASKTIME_STORE__?: YjsStore;
    }
}

export interface YjsContextValue {
    /** The underlying YjsStore instance */
    store: YjsStore;
    /** Whether the store is ready (core docs loaded) */
    isReady: boolean;
    /** Whether actively syncing with Drive */
    isSyncing: boolean;
    /** Current sync state */
    syncState: SyncState;
    /** Current sync phase */
    syncPhase: SyncPhase;
    /** Whether connected to Google Drive */
    isDriveConnected: boolean;
    /** Current Drive session ID in Worker mode */
    driveSessionId: string | null;
    /** Whether a Drive connection is in progress */
    isConnecting: boolean;
    /** Whether at least one sync completed */
    hasSynced: boolean;
    /** Whether a manual sync is in progress */
    manualSyncInProgress: boolean;
    /** Last successful sync timestamp (ms since epoch) or null */
    lastSyncedAt: number | null;
    /** Whether there are local changes pending upload */
    hasPendingSyncChanges: () => boolean;
    /** Whether there are local changes pending upload (reactive) */
    pendingSyncChanges: boolean;
    /** Whether auto-sync is enabled */
    autoSyncEnabled: boolean;
    /** Auto-sync mode */
    autoSyncMode: AutoSyncMode;
    /** Manually trigger Drive sync */
    forceSyncDrive: (options?: { allowPull?: boolean; forceFullState?: boolean }) => Promise<void>;
    /** Disconnect Drive sync */
    disconnectDrive: () => void;
    /** Wipe all TaskTime Pro files from Drive */
    wipeDriveData: () => Promise<void>;
    /** Load time entries for a specific year */
    loadEntriesForYear: (year: number) => Promise<Y.Map<string, TimeEntry>>;
    /** Load archived tasks */
    loadArchivedTasks: () => Promise<void>;
    /** Load archived invoices */
    loadArchivedInvoices: () => Promise<void>;
    /** Load archived expenses */
    loadArchivedExpenses: () => Promise<void>;
    /** Get available years from Drive and local */
    getAvailableYears: () => Promise<number[]>;
    /** Clear all data from all collections and IndexedDB databases */
    clearAllData: () => Promise<void>;
    /** Replace all local data with a backup, rolling back on application failure */
    restoreBackupData: (data: BackupImportPayload) => Promise<void>;
    /** List all available backups from Google Drive */
    listBackups: () => Promise<BackupInfo[]>;
    /** Create a backup on demand */
    createBackup: () => Promise<string | null>;
    /** Download a specific backup's data */
    downloadBackup: (fileId: string) => Promise<unknown>;
    /** Delete all backup files from Google Drive */
    deleteAllBackups: () => Promise<void>;
}

const YjsContext = createContext<YjsContextValue | null>(null);

interface YjsProviderProps {
    children: React.ReactNode;
}

type DriveSyncOptions = {
    allowPull?: boolean;
    force?: boolean;
    forceFullState?: boolean;
};

type RunSyncWithAuthHandling = (options?: DriveSyncOptions) => Promise<void>;

const VISIBILITY_SYNC_COOLDOWN_MS = 60 * 1000;
const ONLINE_SYNC_COOLDOWN_MS = 60 * 1000;
const YJS_INCIDENT_THROTTLE_MS = 15 * 60 * 1000;

export function YjsProvider({ children }: YjsProviderProps) {

    // Get singleton store
    const store = useMemo(() => getYjsStore(), []);
    const { showError, showWarning } = useToast();

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        window.__TASKTIME_STORE__ = store;

        return () => {
            delete window.__TASKTIME_STORE__;
        };
    }, [store]);
    
    // State
    const [isReady, setIsReady] = useState(false);
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [manualSyncInProgress, setManualSyncInProgress] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [autoSyncMode, setAutoSyncMode] = useState<AutoSyncMode>('sync');
    const [pendingSyncChanges, setPendingSyncChanges] = useState(false);
    const [driveBindingVersion, setDriveBindingVersion] = useState(0);
    const [showReconnectDialog, setShowReconnectDialog] = useState(false);
    const [reconnectDialogMessage, setReconnectDialogMessage] = useState('Google authorization expired. Reconnect Google Drive to continue syncing.');
    const [isReconnectProcessing, setIsReconnectProcessing] = useState(false);
    const hasCheckedPersistedState = useRef(false);
    const consecutiveSyncErrors = useRef(0);
    
    // Auth hook for Google Drive connection
    const { isSignedIn, accessToken, sessionId, isLoading: authLoading, signIn, signOut, invalidateSession } = useGoogleAuth();

    const handleAuthorizationFailure = useCallback(async (error: unknown): Promise<boolean> => {
        if (!(error instanceof AuthorizationError)) {
            return false;
        }

        await invalidateSession();

        store.disconnectDrive();
        setIsDriveConnected(false);
        setIsConnecting(false);
        setSyncState('error');
        setSyncPhase('error');
        setHasSynced(false);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
        hasCheckedPersistedState.current = false;
        setReconnectDialogMessage(error.message || 'Google authorization expired. Reconnect Google Drive to continue syncing.');
        setShowReconnectDialog(true);
        return true;
    }, [store, invalidateSession]);

    const runSyncWithAuthHandling = useCallback<RunSyncWithAuthHandling>(async (options) => {
        try {
            await store.syncDrive(options);
        } catch (error) {
            if (await handleAuthorizationFailure(error)) {
                return;
            }

            throw error;
        }
    }, [store, handleAuthorizationFailure]);

    // Initialize store on mount
    useEffect(() => {
        let mounted = true;

        store.initialize()
            .then(() => {
                if (mounted) {
                    setIsReady(true);
                    // Check if already connected (e.g., from previous session)
                    setIsDriveConnected(store.isDriveConnected());
                    setHasSynced(false);
                    console.log('[YjsContext] Store initialized');
                }
            })
            .catch((error) => {
                console.error('[YjsContext] Store initialization failed:', error);
                captureDebugBundleIncident({
                    incidentKey: 'yjs.store_initialize_failed',
                    name: 'TaskTimeStoreInitializationError',
                    message: 'TaskTime Pro Yjs store initialization failed',
                    error,
                    throttleMs: YJS_INCIDENT_THROTTLE_MS,
                });
            });

        return () => {
            mounted = false;
        };
    }, [store]);

    // Listen for IndexedDB persistence errors (e.g., quota exceeded)
    useEffect(() => {
        const hasWarned = { current: false };

        const unsub = store.onPersistenceError((error, docName) => {
            if (hasWarned.current) return;

            if (YjsDocManager.isQuotaError(error)) {
                hasWarned.current = true;
                showError('Storage is full. Clear browser data to free space or your changes may not be saved.');
                captureDebugBundleIncident({
                    incidentKey: 'yjs.persistence_quota_exceeded',
                    name: 'TaskTimePersistenceQuotaExceeded',
                    message: 'TaskTime Pro Yjs persistence quota was exceeded',
                    error,
                    context: { docName },
                    throttleMs: YJS_INCIDENT_THROTTLE_MS,
                });
            } else {
                showWarning('A storage error occurred. Your data may not persist across page reloads.');
                captureDebugBundleIncident({
                    incidentKey: 'yjs.persistence_error',
                    name: 'TaskTimePersistenceError',
                    message: 'TaskTime Pro Yjs persistence failed',
                    error,
                    context: { docName },
                    throttleMs: YJS_INCIDENT_THROTTLE_MS,
                });
            }
        });

        return unsub;
    }, [store, showError, showWarning]);

    // Sync auto-sync preferences from Yjs
    useEffect(() => {
        if (!isReady) return;

        const syncPreferences = () => {
            const enabled = store.preferences.get('autoSyncEnabled') === true;
            const modeValue = store.preferences.get('autoSyncMode');
            const mode: AutoSyncMode = modeValue === 'backup' ? 'backup' : 'sync';

            setAutoSyncEnabled(enabled);
            setAutoSyncMode(mode);
            store.setDriveSyncPreferences(enabled, mode);
        };

        syncPreferences();

        const handler = () => syncPreferences();
        store.preferences.observe(handler);

        return () => store.preferences.unobserve(handler);
    }, [isReady, store]);

    // Connect/disconnect Drive based on auth state
    // NOTE: Do NOT include autoSyncEnabled/autoSyncMode in deps - those are handled
    // by the preference sync effect calling store.setDriveSyncPreferences()
    useEffect(() => {
        if (!isReady || authLoading) return;

        const hasDirectAuth = Boolean(accessToken);
        const hasWorkerAuth = Boolean(sessionId);

        if (isSignedIn && (hasDirectAuth || hasWorkerAuth)) {
            setHasSynced(false);
            setIsConnecting(true);

            // In worker mode we don't have a client-side access token; pass a placeholder
            const tokenForConnect = accessToken || 'worker-placeholder';

            store.connectDrive(tokenForConnect, sessionId)
                .then(async () => {
                    setIsDriveConnected(true);
                    setSyncState(store.getSyncState());
                    setSyncPhase(store.getSyncPhase());
                    setLastSyncedAt(store.getLastSyncedAt());
                    setDriveBindingVersion(previous => previous + 1);
                    console.log('[YjsContext] Connected to Drive');
                    // connect() already handles initial sync based on the sync mode,
                    // no need for a follow-up forceDriveSync
                })
                .catch(async (error) => {
                    if (await handleAuthorizationFailure(error)) {
                        return;
                    }

                    setIsDriveConnected(false);
                    setSyncState('error');
                    setSyncPhase('error');
                    console.error('[YjsContext] Failed to connect Drive:', error);
                })
                .finally(() => {
                    setIsConnecting(false);
                });
        } else if (!isSignedIn) {
            store.disconnectDrive();
            setIsDriveConnected(false);
            setIsConnecting(false);
            setSyncState('idle');
            setSyncPhase('idle');
            setHasSynced(false);
            setLastSyncedAt(null);
            setManualSyncInProgress(false);
            setDriveBindingVersion(previous => previous + 1);
        }
    }, [isReady, isSignedIn, accessToken, sessionId, authLoading, store, handleAuthorizationFailure]);

    // Update access token when it changes
    useEffect(() => {
        if (accessToken && store.isDriveConnected()) {
            store.updateDriveAccessToken(accessToken);
        }
    }, [accessToken, store]);

    // Update session ID when it changes (Worker mode)
    useEffect(() => {
        if (store.isDriveConnected()) {
            store.updateDriveSessionId(sessionId);
        }
    }, [sessionId, store]);

    // Track when at least one sync has completed
    useEffect(() => {
        if (syncState === 'idle' && isDriveConnected) {
            setHasSynced(true);
            setLastSyncedAt(store.getLastSyncedAt());
            consecutiveSyncErrors.current = 0;
        }
    }, [syncState, isDriveConnected, store]);

    // Notify user on repeated sync failures
    useEffect(() => {
        if (syncState !== 'error' || !isDriveConnected) return;

        consecutiveSyncErrors.current += 1;

        if (consecutiveSyncErrors.current === 2) {
            showWarning('Cloud sync is having trouble. Your data is safe locally.');
        } else if (consecutiveSyncErrors.current >= 5) {
            showError('Cloud sync has failed multiple times. Check your connection or reconnect Google Drive.');
            captureDebugBundleIncident({
                incidentKey: 'drive.sync_failed_repeatedly',
                name: 'TaskTimeDriveSyncError',
                message: 'TaskTime Pro Drive sync failed repeatedly',
                context: {
                    autoSyncEnabled,
                    autoSyncMode,
                    consecutiveErrors: consecutiveSyncErrors.current,
                },
                throttleMs: 30 * 60 * 1000,
            });
        }
    }, [syncState, isDriveConnected, showWarning, showError, autoSyncEnabled, autoSyncMode]);

    // Subscribe to sync state/phase/pending changes
    // Re-subscribe when isDriveConnected changes because that's when provider is created
    useEffect(() => {
        if (!isReady) return;

        // If not connected, reset to idle and don't subscribe
        if (!isDriveConnected) {
            setSyncState('idle');
            setSyncPhase('idle');
            setPendingSyncChanges(false);
            return;
        }

        // Subscribe to all sync events from the provider
        const unsubState = store.onSyncStateChange(setSyncState);
        const unsubPhase = store.onSyncPhaseChange(setSyncPhase);
        const unsubPending = store.onPendingSyncChange(setPendingSyncChanges);

        // Fetch current state to ensure we're in sync (in case we missed updates)
        setSyncState(store.getSyncState());
        setSyncPhase(store.getSyncPhase());
        setPendingSyncChanges(store.hasPendingSyncChanges());

        return () => {
            unsubState();
            unsubPhase();
            unsubPending();
        };
    }, [store, isReady, isDriveConnected, driveBindingVersion]);

    // --- Callbacks ---

    const forceSyncDrive = useCallback<YjsContextValue['forceSyncDrive']>(async (options) => {
        setManualSyncInProgress(true);
        try {
            try {
                await store.forceDriveSync(options);
            } catch (error) {
                if (await handleAuthorizationFailure(error)) {
                    return;
                }

                throw error;
            }
        } finally {
            setManualSyncInProgress(false);
        }
    }, [store, handleAuthorizationFailure]);

    // Trigger a sync when tab becomes visible or when network reconnects
    useEffect(() => {
        if (!isDriveConnected) return;

        const shouldTriggerForegroundSync = (cooldownMs: number) => {
            if (store.hasPendingSyncChanges()) {
                return true;
            }

            const lastSuccessfulSyncAt = store.getLastSyncedAt();
            if (lastSuccessfulSyncAt == null) {
                return true;
            }

            return (Date.now() - lastSuccessfulSyncAt) >= cooldownMs;
        };

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            if (!autoSyncEnabled) return;

            if (autoSyncMode === 'sync') {
                if (!shouldTriggerForegroundSync(VISIBILITY_SYNC_COOLDOWN_MS)) {
                    return;
                }

                runSyncWithAuthHandling({ force: false }).catch(console.error);
            } else if (autoSyncMode === 'backup' && store.hasPendingSyncChanges()) {
                // Backup mode: only push pending local changes on tab focus
                runSyncWithAuthHandling({ allowPull: false, force: false }).catch(console.error);
            }
        };

        const handleOnline = () => {
            if (!autoSyncEnabled) {
                return;
            }

            if (autoSyncMode === 'sync') {
                if (!shouldTriggerForegroundSync(ONLINE_SYNC_COOLDOWN_MS)) {
                    return;
                }

                runSyncWithAuthHandling({ force: false }).catch(console.error);
                return;
            }

            if (autoSyncMode === 'backup' && store.hasPendingSyncChanges()) {
                runSyncWithAuthHandling({ allowPull: false, force: false }).catch(console.error);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };

    }, [isDriveConnected, autoSyncEnabled, autoSyncMode, store, runSyncWithAuthHandling]);

    // Handle persisted pending changes or interrupted syncs on load
    // This runs once after Drive connects to recover from page refresh mid-sync
    useEffect(() => {
        // Only run once per connection, and only after first successful sync state
        if (!isDriveConnected || hasCheckedPersistedState.current) return;
        
        const needsSync = shouldSyncOnLoad();
        if (!needsSync) {
            hasCheckedPersistedState.current = true;
            return;
        }

        const wasInterrupted = wasSyncInterrupted();
        const hasPending = hasPersistedPendingChanges();
        console.log('[YjsContext] Detected persisted sync state:', { wasInterrupted, hasPending });

        hasCheckedPersistedState.current = true;

        // For auto-sync mode: trigger sync to complete what was interrupted
        if (autoSyncEnabled) {
            console.log('[YjsContext] Auto-triggering sync for persisted pending changes', { autoSyncMode });
            if (autoSyncMode === 'backup') {
                // Backup mode: only push, don't pull
                runSyncWithAuthHandling({ allowPull: false, force: false }).catch(console.error);
            } else {
                runSyncWithAuthHandling({ force: false }).catch(console.error);
            }
        }
        // For manual mode: pendingSyncChanges will show "Sync changes" in UI
        // because GoogleDriveProvider.updatePendingState() now checks persisted state

    }, [isDriveConnected, autoSyncEnabled, store, autoSyncMode, runSyncWithAuthHandling]);

    const handleReconnectNow = useCallback(async () => {
        setIsReconnectProcessing(true);

        try {
            await signOut();
            await signIn();
            setShowReconnectDialog(false);
        } catch (error) {
            console.error('[YjsContext] Reconnect failed:', error);
        } finally {
            setIsReconnectProcessing(false);
        }
    }, [signIn, signOut]);

    const disconnectDrive = useCallback(() => {
        store.disconnectDrive();
        setIsDriveConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
        hasCheckedPersistedState.current = false; // Reset for next connection
    }, [store]);

    const wipeDriveData = useCallback(async () => {
        await store.wipeDriveData();
    }, [store]);

    const loadEntriesForYear = useCallback<YjsContextValue['loadEntriesForYear']>(async (year) => {
        return store.loadEntriesForYear(year);
    }, [store]);

    const loadArchivedTasks = useCallback(async () => {
        await store.loadArchivedTasks();
    }, [store]);

    const loadArchivedInvoices = useCallback(async () => {
        await store.loadArchivedInvoices();
    }, [store]);

    const loadArchivedExpenses = useCallback(async () => {
        await store.loadArchivedExpenses();
    }, [store]);

    const getAvailableYears = useCallback(async () => {
        return store.getAvailableYears();
    }, [store]);

    const clearAllData = useCallback(async () => {
        setIsReady(false);
        setHasSynced(false);
        setManualSyncInProgress(false);
        setLastSyncedAt(null);
        setSyncPhase('idle');

        await store.clearAllData();
        await store.initialize();

        setIsReady(true);
        setIsDriveConnected(store.isDriveConnected());
        setSyncState(store.getSyncState());
        setSyncPhase(store.getSyncPhase());
        setLastSyncedAt(store.getLastSyncedAt());
    }, [store]);

    const restoreBackupData = useCallback(async (data: BackupImportPayload) => {
        setIsReady(false);
        setHasSynced(false);
        setManualSyncInProgress(false);
        setLastSyncedAt(null);
        setSyncPhase('idle');

        try {
            await store.replaceAllDataWithBackup(data);
        } finally {
            setIsReady(store.isReady);
            setIsDriveConnected(store.isDriveConnected());
            setSyncState(store.getSyncState());
            setSyncPhase(store.getSyncPhase());
            setLastSyncedAt(store.getLastSyncedAt());
        }
    }, [store]);

    const hasPendingSyncChanges = useCallback(() => {
        return store.hasPendingSyncChanges();
    }, [store]);

    const listBackups = useCallback(async () => {
        return store.listBackups();
    }, [store]);

    const createBackup = useCallback(async () => {
        return store.createBackup();
    }, [store]);

    const downloadBackup = useCallback<YjsContextValue['downloadBackup']>(async (fileId) => {
        return store.downloadBackup(fileId);
    }, [store]);

    const deleteAllBackups = useCallback(async () => {
        return store.deleteAllBackups();
    }, [store]);

    // --- Context value ---

    const value: YjsContextValue = useMemo(() => ({
        store,
        isReady,
        isSyncing: syncState === 'syncing',
        syncState,
        syncPhase,
        isDriveConnected,
        driveSessionId: sessionId,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        lastSyncedAt,
        hasPendingSyncChanges,
        pendingSyncChanges,
        autoSyncEnabled,
        autoSyncMode,
        forceSyncDrive,
        disconnectDrive,
        wipeDriveData,
        loadEntriesForYear,
        loadArchivedTasks,
        loadArchivedInvoices,
        loadArchivedExpenses,
        getAvailableYears,
        clearAllData,
        restoreBackupData,
        listBackups,
        createBackup,
        downloadBackup,
        deleteAllBackups,
    }), [
        store,
        isReady,
        syncState,
        syncPhase,
        isDriveConnected,
        sessionId,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        lastSyncedAt,
        hasPendingSyncChanges,
        pendingSyncChanges,
        autoSyncEnabled,
        autoSyncMode,
        forceSyncDrive,
        disconnectDrive,
        wipeDriveData,
        loadEntriesForYear,
        loadArchivedTasks,
        loadArchivedInvoices,
        loadArchivedExpenses,
        getAvailableYears,
        clearAllData,
        restoreBackupData,
        listBackups,
        createBackup,
        downloadBackup,
        deleteAllBackups,
    ]);

    return (
        <YjsContext.Provider value={value}>
            {children}
            <Modal
                isOpen={showReconnectDialog}
                onClose={() => !isReconnectProcessing && setShowReconnectDialog(false)}
                title="Reconnect Google Drive"
                description={reconnectDialogMessage}
                showCloseButton={!isReconnectProcessing}
                footer={(
                    <div className="flex justify-end gap-2 w-full">
                        <Button
                            variant="outline"
                            onClick={() => setShowReconnectDialog(false)}
                            disabled={isReconnectProcessing}
                        >
                            Not now
                        </Button>
                        <Button
                            onClick={handleReconnectNow}
                            loading={isReconnectProcessing}
                            loadingText="Reconnecting..."
                        >
                            Reconnect
                        </Button>
                    </div>
                )}
            >
                <p className="text-sm text-muted-foreground">
                    Local changes are kept safely on this device. Reconnect to resume cloud sync.
                </p>
            </Modal>
        </YjsContext.Provider>
    );
}

/**
 * Hook to access the Yjs context
 * @throws Error if used outside YjsProvider
 */
export function useYjs(): YjsContextValue {
    const context = useContext(YjsContext);
    if (!context) {
        throw new Error('useYjs must be used within a YjsProvider');
    }
    return context;
}

/**
 * Hook to get just the store (convenience)
 */
export function useYjsStore(): YjsStore {
    const { store, isReady } = useYjs();
    if (!isReady) {
        throw new Error('YjsStore is not ready yet');
    }
    return store;
}
