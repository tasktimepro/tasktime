import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { SyncContext } from '@/contexts/SyncContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth.ts';
import { SyncEngine } from '@/services/sync';
import { syncLog } from '@/services/sync/debugLogger';
import { GoogleDriveProvider } from '@/services/sync';
import { useToast } from '@/hooks/useToast.ts';
import ConflictModal from './ConflictModal';

const SyncProvider = ({ children, getLocalData, setLocalData, onLocalChange }) => {

    const auth = useGoogleAuth();
    const { showError } = useToast();
    const [syncEngine, setSyncEngine] = useState(null);
    const [state, setState] = useState('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [error, setError] = useState(null);
    const lastErrorRef = useRef(null);
    const [conflictState, setConflictState] = useState(null);

    const mergeConflictData = useCallback((local, remote) => {
        const merged = { ...local };
        const collections = [
            'projects',
            'tasks',
            'timeEntries',
            'invoices',
            'clients',
            'businessInfos',
            'invoiceTemplates',
            'paymentMethods'
        ];

        const mergeCollection = (localItems = [], remoteItems = []) => {
            const map = new Map();

            localItems.forEach((item) => {
                map.set(item.id, item);
            });

            remoteItems.forEach((item) => {
                const existing = map.get(item.id);
                if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
                    map.set(item.id, item);
                }
            });

            return Array.from(map.values());
        };

        collections.forEach((collection) => {
            merged[collection] = mergeCollection(local?.[collection], remote?.[collection]);
        });

        const localPreferencesUpdated = local?.preferences?.updatedAt || 0;
        const remotePreferencesUpdated = remote?.preferences?.updatedAt || 0;
        if (remotePreferencesUpdated > localPreferencesUpdated) {
            merged.preferences = remote.preferences;
        }

        if (local?.timer || remote?.timer) {
            const localTimer = local?.timer;
            const remoteTimer = remote?.timer;
            const localActive = localTimer?.startTime && !localTimer?.paused;
            const remoteActive = remoteTimer?.startTime && !remoteTimer?.paused;

            if (localActive && !remoteActive) {
                merged.timer = localTimer;
            } else if (remoteActive && !localActive) {
                merged.timer = remoteTimer;
            } else {
                const localLastActive = localTimer?.lastActive || 0;
                const remoteLastActive = remoteTimer?.lastActive || 0;
                merged.timer = localLastActive >= remoteLastActive ? localTimer : remoteTimer;
            }
        }

        return merged;
    }, []);

    useEffect(() => {

        if (!auth.isSignedIn || !auth.accessToken) {

            setSyncEngine(null);
            setState('idle');
            return;
        }

        let isMounted = true;
        const provider = new GoogleDriveProvider(auth.accessToken);

        const handleAuthError = (err) => {
            if (isMounted) {
                const message = err?.message || 'Authorization failed.';
                setError(message);
                syncLog('provider:authError', message);
                // Sign out to allow reconnection
                auth.signOut();
            }
        };

        const engine = new SyncEngine({
            provider,
            getLocalData,
            setLocalData,
            onStateChange: (newState) => {
                if (isMounted) {
                    setState(newState);
                    syncLog('provider:stateChange', newState);
                    if (newState === 'idle') {
                        // Use in-memory sync time to avoid triggering data changes
                        setLastSyncedAt(engine.getLastSyncedAt() || null);
                    }
                }
            },
            onConflict: (local, remote) => new Promise((resolve) => {
                setConflictState({ local, remote, resolve });
            }),
            onAuthError: handleAuthError
        });

        engine.initialize().then(() => {
            if (isMounted) {
                setSyncEngine(engine);
                setError(null);
                syncLog('provider:engineReady');
            }
        }).catch((err) => {
            if (isMounted) {
                const message = err?.message || 'Sync initialization failed.';
                setError(message);
                syncLog('provider:initError', message);
                // If authorization error, sign out to allow reconnection
                if (err?.name === 'AuthorizationError' || message.includes('authorization')) {
                    auth.signOut();
                }
            }
        });

        return () => {
            isMounted = false;
            engine.destroy();
        };
    }, [auth.isSignedIn, auth.accessToken, auth.signOut, getLocalData, setLocalData]);

    useEffect(() => {

        if (!syncEngine) {

            return undefined;
        }

        return onLocalChange(() => {
            if (syncEngine.isSyncInProgress()) {
                syncLog('provider:onLocalChange skipped (sync in progress)');
                return;
            }
            if (syncEngine.isLocalChangeSuppressed()) {
                syncLog('provider:onLocalChange skipped (suppressed)');
                return;
            }
            syncLog('provider:onLocalChange -> scheduleSync');
            syncEngine.scheduleSync();
        });
    }, [syncEngine, onLocalChange]);

    useEffect(() => {

        if (!syncEngine || !navigator?.serviceWorker || !navigator?.permissions) {

            return undefined;
        }

        let isActive = true;

        const registerPeriodicSync = async () => {

            try {

                const status = await navigator.permissions.query({
                    name: 'periodic-background-sync'
                });

                if (!isActive || status.state !== 'granted') {

                    return;
                }

                const registration = await navigator.serviceWorker.ready;
                const periodicSync = registration?.periodicSync;

                if (!periodicSync?.register) {

                    return;
                }

                await periodicSync.register('tasktime-periodic-sync', {
                    minInterval: 60 * 60 * 1000
                });

            } catch {

                // Periodic sync not available or permission denied
            }
        };

        registerPeriodicSync();

        return () => {

            isActive = false;
        };
    }, [syncEngine]);

    useEffect(() => {

        if (!error || error === lastErrorRef.current) {

            return;
        }

        showError(`Sync error: ${error}`);
        lastErrorRef.current = error;
    }, [error, showError]);

    useEffect(() => {

        if (!navigator?.serviceWorker) {

            return undefined;
        }

        const handleMessage = (event) => {
            if (event?.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
                syncEngine?.sync();
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [syncEngine]);

    const enableSync = useCallback(async () => {

        await auth.signIn();
    }, [auth]);

    const disableSync = useCallback(async () => {

        syncEngine?.destroy();
        setSyncEngine(null);
        await auth.signOut();
    }, [auth, syncEngine]);

    const forceSync = useCallback(async () => {

        await syncEngine?.sync();
    }, [syncEngine]);

    // Track if engine is initializing (signed in but engine not ready yet)
    const isEngineInitializing = auth.isSignedIn && !syncEngine && !error;

    const value = useMemo(() => ({
        isEnabled: !!syncEngine,
        isSignedIn: auth.isSignedIn,
        isLoading: auth.isLoading || isEngineInitializing,
        state,
        user: auth.user,
        lastSyncedAt,
        error: error || auth.error,
        enableSync,
        disableSync,
        forceSync,
    }), [
        syncEngine,
        auth.isSignedIn,
        auth.isLoading,
        isEngineInitializing,
        auth.user,
        auth.error,
        state,
        lastSyncedAt,
        error,
        enableSync,
        disableSync,
        forceSync,
    ]);

    return (
        <SyncContext.Provider value={value}>
            {conflictState && (
                <ConflictModal
                    isOpen={!!conflictState}
                    localData={conflictState.local}
                    remoteData={conflictState.remote}
                    onResolve={(choice) => {
                        if (choice === 'local') {
                            conflictState.resolve(conflictState.local);
                        } else if (choice === 'remote') {
                            conflictState.resolve(conflictState.remote);
                        } else {
                            conflictState.resolve(mergeConflictData(conflictState.local, conflictState.remote));
                        }
                        setConflictState(null);
                    }}
                />
            )}
            {children}
        </SyncContext.Provider>
    );
};

export default SyncProvider;
