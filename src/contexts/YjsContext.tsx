/**
 * YjsContext - React context provider for Yjs store
 * 
 * Provides the YjsStore to all components and handles:
 * - Store initialization on mount
 * - Auto-connect to Google Drive when authenticated
 * - Sync state tracking
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { YjsStore, getYjsStore, SyncState, SyncPhase, AutoSyncMode } from '@/stores/yjs';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { shouldSyncOnLoad, wasSyncInterrupted, hasPersistedPendingChanges } from '@/utils/syncPersistence';

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
    forceSyncDrive: () => Promise<void>;
    /** Disconnect Drive sync */
    disconnectDrive: () => void;
    /** Wipe all TaskTime files from Drive */
    wipeDriveData: () => Promise<void>;
    /** Load time entries for a specific year */
    loadEntriesForYear: (year: number) => Promise<void>;
    /** Load archived tasks */
    loadArchivedTasks: () => Promise<void>;
    /** Load archived invoices */
    loadArchivedInvoices: () => Promise<void>;
    /** Get available years from Drive and local */
    getAvailableYears: () => Promise<number[]>;
    /** Clear all data from all collections and IndexedDB databases */
    clearAllData: () => Promise<void>;
}

const YjsContext = createContext<YjsContextValue | null>(null);

interface YjsProviderProps {
    children: React.ReactNode;
}

export function YjsProvider({ children }: YjsProviderProps) {

    // Get singleton store
    const store = useMemo(() => getYjsStore(), []);
    
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
    
    // Auth hook for Google Drive connection
    const { isSignedIn, accessToken, sessionId, isLoading: authLoading } = useGoogleAuth();

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
            });

        return () => {
            mounted = false;
        };
    }, [store]);

    // Sync auto-sync preferences from Yjs
    useEffect(() => {
        if (!isReady) return;

        const syncPreferences = () => {
            const enabled = store.preferences.get('autoSyncEnabled') === true;
            const modeValue = store.preferences.get('autoSyncMode');
            const mode: AutoSyncMode = modeValue === 'sync' ? 'sync' : 'backup';

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
                    console.log('[YjsContext] Connected to Drive');
                    // Sync if auto-sync is enabled and mode is 'sync'
                    const currentMode = store.getDriveSyncMode();
                    if (currentMode === 'sync') {
                        await store.forceDriveSync();
                    }
                })
                .catch((error) => {
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
        }
    }, [isReady, isSignedIn, accessToken, sessionId, authLoading, store]);

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
        }
    }, [syncState, isDriveConnected, store]);

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
    }, [store, isReady, isDriveConnected]);

    // --- Callbacks ---

    const forceSyncDrive = useCallback(async () => {
        setManualSyncInProgress(true);
        try {
            await store.forceDriveSync();
        } finally {
            setManualSyncInProgress(false);
        }
    }, [store]);

    // Trigger a sync when tab becomes visible or when network reconnects
    useEffect(() => {
        if (!isDriveConnected) return;

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;

            if (autoSyncEnabled && autoSyncMode === 'sync') {
                store.forceDriveSync().catch(console.error);
            }
        };

        const handleOnline = () => {
            if (!autoSyncEnabled) {
                return;
            }

            if (autoSyncMode === 'sync') {
                store.forceDriveSync().catch(console.error);
                return;
            }

            if (autoSyncMode === 'backup' && store.hasPendingSyncChanges()) {
                store.forceDriveSync().catch(console.error);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };

    }, [isDriveConnected, autoSyncEnabled, autoSyncMode, store]);

    // Handle persisted pending changes or interrupted syncs on load
    // This runs once after Drive connects to recover from page refresh mid-sync
    const hasCheckedPersistedState = useRef(false);
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
            console.log('[YjsContext] Auto-triggering sync for persisted pending changes');
            store.forceDriveSync().catch(console.error);
        }
        // For manual mode: pendingSyncChanges will show "Sync changes" in UI
        // because GoogleDriveProvider.updatePendingState() now checks persisted state

    }, [isDriveConnected, autoSyncEnabled, store]);

    const disconnectDrive = useCallback(() => {
        store.disconnectDrive();
        setIsDriveConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
        hasCheckedPersistedState.current = false; // Reset for next connection
    }, [store]);

    const wipeDriveData = useCallback(async () => {
        await store.wipeDriveData();
    }, [store]);

    const loadEntriesForYear = useCallback(async (year: number) => {
        await store.loadEntriesForYear(year);
    }, [store]);

    const loadArchivedTasks = useCallback(async () => {
        await store.loadArchivedTasks();
    }, [store]);

    const loadArchivedInvoices = useCallback(async () => {
        await store.loadArchivedInvoices();
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

    const hasPendingSyncChanges = useCallback(() => {
        return store.hasPendingSyncChanges();
    }, [store]);

    // --- Context value ---

    const value: YjsContextValue = useMemo(() => ({
        store,
        isReady,
        isSyncing: syncState === 'syncing',
        syncState,
        syncPhase,
        isDriveConnected,
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
        getAvailableYears,
        clearAllData,
    }), [
        store,
        isReady,
        syncState,
        syncPhase,
        isDriveConnected,
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
        getAvailableYears,
        clearAllData,
    ]);

    return (
        <YjsContext.Provider value={value}>
            {children}
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
