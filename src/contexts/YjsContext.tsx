/**
 * YjsContext - React context provider for Yjs store
 * 
 * Provides the YjsStore to all components and handles:
 * - Store initialization on mount
 * - Auto-connect to Google Drive when authenticated
 * - Sync state tracking
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { YjsStore, getYjsStore, SyncState } from '@/stores/yjs';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

export interface YjsContextValue {
    /** The underlying YjsStore instance */
    store: YjsStore;
    /** Whether the store is ready (core docs loaded) */
    isReady: boolean;
    /** Whether actively syncing with Drive */
    isSyncing: boolean;
    /** Current sync state */
    syncState: SyncState;
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
    /** Manually trigger Drive sync */
    forceSyncDrive: () => Promise<void>;
    /** Disconnect Drive sync */
    disconnectDrive: () => void;
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
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [manualSyncInProgress, setManualSyncInProgress] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    
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

    // Connect/disconnect Drive based on auth state
    useEffect(() => {
        if (!isReady || authLoading) return;

        const hasDirectAuth = Boolean(accessToken);
        const hasWorkerAuth = Boolean(sessionId);

        if (isSignedIn && (hasDirectAuth || hasWorkerAuth)) {
            setHasSynced(false);
            setIsConnecting(true);
            setSyncState('syncing');

            // In worker mode we don't have a client-side access token; pass a placeholder
            const tokenForConnect = accessToken || 'worker-placeholder';

            store.connectDrive(tokenForConnect, sessionId)
                .then(async () => {
                    setIsDriveConnected(true);
                    setSyncState(store.getSyncState());
                    setLastSyncedAt(store.getLastSyncedAt());
                    console.log('[YjsContext] Connected to Drive');
                    await store.forceDriveSync();
                })
                .catch((error) => {
                    setIsDriveConnected(false);
                    setSyncState('error');
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
    }, [syncState, isDriveConnected]);

    // Subscribe to sync state changes after connection
    useEffect(() => {
        if (!isDriveConnected) return;

        const unsubscribe = store.onSyncStateChange(setSyncState);
        return () => unsubscribe();
    }, [store, isDriveConnected]);

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
            if (document.visibilityState === 'visible') {
                store.forceDriveSync().catch(console.error);
            }
        };

        const handleOnline = () => {
            store.forceDriveSync().catch(console.error);
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };

    }, [isDriveConnected, store]);

    const disconnectDrive = useCallback(() => {
        store.disconnectDrive();
        setIsDriveConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
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

        await store.clearAllData();
        await store.initialize();

        setIsReady(true);
        setIsDriveConnected(store.isDriveConnected());
        setSyncState(store.getSyncState());
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
        isDriveConnected,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        lastSyncedAt,
        hasPendingSyncChanges,
        forceSyncDrive,
        disconnectDrive,
        loadEntriesForYear,
        loadArchivedTasks,
        loadArchivedInvoices,
        getAvailableYears,
        clearAllData,
    }), [
        store,
        isReady,
        syncState,
        isDriveConnected,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        lastSyncedAt,
        hasPendingSyncChanges,
        forceSyncDrive,
        disconnectDrive,
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
