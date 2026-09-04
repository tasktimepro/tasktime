/**
 * YjsContext - React context provider for Yjs store
 *
 * Sync contract source of truth: ../components/sync/README.md
 * 
 * Provides the YjsStore to all components and handles:
 * - Store initialization on mount
 * - Auto-connect to the lifecycle-selected cloud provider when authenticated
 * - Sync state tracking
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    YjsStore,
    getYjsStore,
    YjsDocManager,
    SyncState,
    SyncPhase,
    AutoSyncMode,
    AuthorizationError,
    CloudFileStoreError,
    CloudManifestManager,
    CloudProviderMovedError,
    DropboxFileStore,
    DriveTransportDisabledError,
} from '@/stores/yjs';
/* eslint-disable react-refresh/only-export-components */
import type { BackupInfo } from '@/stores/yjs';
import type { CloudProviderId } from '@/stores/yjs';
import type { BackupImportPayload } from '@/utils/backupData';
import type { TimeEntry } from '@/stores/yjs/types';
import type * as Y from 'yjs';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useCloudStorageLifecycle } from '@/hooks/useCloudStorageLifecycle';
import { useDropboxAuth } from '@/hooks/useDropboxAuth';
import { resolveCloudStorageIdentity } from '@/stores/yjs/cloudStorageLifecycle';
import { driveAccessTokenProvider } from '@/stores/yjs/providers/DriveAccessTokenProvider';
import { dropboxAccessTokenProvider } from '@/stores/yjs/providers/DropboxAccessTokenProvider';
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
    /** Whether actively syncing with the selected cloud provider */
    isSyncing: boolean;
    /** Current sync state */
    syncState: SyncState;
    /** Current sync phase */
    syncPhase: SyncPhase;
    /** Whether connected to Google Drive */
    isDriveConnected: boolean;
    /** Whether connected to the active cloud-storage provider */
    isCloudConnected: boolean;
    /** Current Drive session ID in Worker mode */
    driveSessionId: string | null;
    /** Provider allowed to perform cloud storage work in this browser profile */
    activeStorageProvider: CloudProviderId | null;
    /** Target provider recorded by a verified moved-source safety marker */
    movedToStorageProvider: CloudProviderId | null;
    /** Provider-bound Worker session reference for active storage only */
    activeStorageSessionId: string | null;
    /** Generation fence for the active storage connection */
    activeStorageGeneration: number | null;
    /** Active provider session used for hosted email, metrics, and future entitlements */
    hostedServiceSessionId: string | null;
    /** Whether the persisted provider lifecycle or its selected auth session is still loading */
    isCloudIdentityLoading: boolean;
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
    /** Manually trigger sync on the active provider */
    forceSyncCloud: (options?: { allowPull?: boolean; forceFullState?: boolean }) => Promise<void>;
    /** Disconnect Drive sync */
    disconnectDrive: () => void;
    /** Disconnect the active provider runtime without revoking authorization */
    disconnectCloud: () => void;
    /** Disconnect the lifecycle-selected provider session, optionally revoking its authorization */
    disconnectActiveCloudSession: (options?: { revoke?: boolean }) => Promise<void>;
    /** Wipe all TaskTime Pro files from Drive */
    wipeDriveData: () => Promise<void>;
    /** Wipe validated TaskTime Pro sync files from the active provider */
    wipeCloudData: () => Promise<void>;
    /** Clear a verified moved source and seed it as a new independent workspace */
    replaceMovedCloudWorkspace: (expectedTargetProvider: CloudProviderId) => Promise<void>;
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
    /** List all available backups from the selected cloud provider */
    listBackups: () => Promise<BackupInfo[]>;
    /** Create a backup on demand */
    createBackup: () => Promise<string | null>;
    /** Download a specific backup's data */
    downloadBackup: (fileId: string) => Promise<unknown>;
    /** Delete all backup files from the selected cloud provider */
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

type CloudConnectionAttempt = {
    key: string;
};

const VISIBILITY_SYNC_COOLDOWN_MS = 60 * 1000;
const ONLINE_SYNC_COOLDOWN_MS = 60 * 1000;
const FOREGROUND_SYNC_COALESCE_MS = 1000;
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
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [manualSyncInProgress, setManualSyncInProgress] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [autoSyncMode, setAutoSyncMode] = useState<AutoSyncMode>('sync');
    const [pendingSyncChanges, setPendingSyncChanges] = useState(false);
    const [movedToStorageProvider, setMovedToStorageProvider] = useState<CloudProviderId | null>(null);
    const [driveBindingVersion, setDriveBindingVersion] = useState(0);
    const [showReconnectDialog, setShowReconnectDialog] = useState(false);
    const [reconnectDialogMessage, setReconnectDialogMessage] = useState('Google authorization expired. Reconnect Google Drive to continue syncing.');
    const [isReconnectProcessing, setIsReconnectProcessing] = useState(false);
    const hasCheckedPersistedState = useRef(false);
    const consecutiveSyncErrors = useRef(0);
    const cloudConnectionAttempt = useRef<CloudConnectionAttempt | null>(null);
    const blockedCloudConnectionKey = useRef<string | null>(null);
    
    // Auth hook for Google Drive connection
    const {
        isSignedIn,
        sessionId,
        driveTransport,
        isLoading: authLoading,
        signIn,
        signOut,
        revokeAccess,
        invalidateSession,
        refreshDriveTransport,
    } = useGoogleAuth();
    const {
        isSignedIn: isDropboxSignedIn,
        isLoading: dropboxAuthLoading,
        sessionId: dropboxSessionId,
        storageGeneration: dropboxStorageGeneration,
        disconnect: disconnectDropbox,
    } = useDropboxAuth();
    const {
        state: storageLifecycle,
        isLoading: storageLifecycleLoading,
        claimActive: claimActiveStorage,
        clear: clearStorageSession,
    } = useCloudStorageLifecycle();
    const {
        activeStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        hostedServiceSessionId,
        isGoogleStorageActive,
    } = resolveCloudStorageIdentity(storageLifecycle, {
        googleSessionId: sessionId,
        dropboxSessionId,
    });
    const isDropboxStorageActive = Boolean(
        isDropboxSignedIn
        && dropboxSessionId
        && activeStorageProvider === 'dropbox'
        && activeStorageSessionId === dropboxSessionId
        && activeStorageGeneration === dropboxStorageGeneration,
    );
    const isCloudIdentityLoading = storageLifecycleLoading
        || (activeStorageProvider === 'dropbox'
            ? dropboxAuthLoading
            : activeStorageProvider === 'google-drive'
                ? authLoading
                : authLoading || dropboxAuthLoading);
    const isDriveConnected = isCloudConnected && activeStorageProvider === 'google-drive';

    // Only an absent or already-Google storage binding may be claimed here; a
    // Dropbox binding always wins until explicit transfer. Hosted services use
    // the lifecycle-selected provider session rather than this Google session.
    useEffect(() => {
        if (authLoading || storageLifecycleLoading || !isSignedIn || !sessionId) return;
        if (activeStorageProvider && activeStorageProvider !== 'google-drive') return;
        if (activeStorageSessionId === sessionId) return;
        void claimActiveStorage('google-drive', sessionId).catch((error) => {
            console.error('[YjsContext] Could not bind the Google storage session:', error);
        });
    }, [
        authLoading,
        storageLifecycleLoading,
        isSignedIn,
        sessionId,
        activeStorageProvider,
        activeStorageSessionId,
        claimActiveStorage,
    ]);

    // When Google auth is explicitly gone, retire only the exact Google storage
    // generation. A Dropbox active session remains independently authenticated.
    useEffect(() => {
        if (authLoading || storageLifecycleLoading || isSignedIn) return;
        if (activeStorageProvider !== 'google-drive'
            || !activeStorageSessionId
            || activeStorageGeneration === null) return;
        void clearStorageSession({
            provider: activeStorageProvider,
            sessionId: activeStorageSessionId,
            generation: activeStorageGeneration,
        }, { force: true }).catch((error) => {
            console.error('[YjsContext] Could not clear the Google storage binding:', error);
        });
    }, [
        authLoading,
        storageLifecycleLoading,
        isSignedIn,
        activeStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        clearStorageSession,
    ]);

    // Apply provider/generation changes before any automatic sync can run. A
    // cross-tab activation invalidates the old runtime connection immediately.
    useEffect(() => {
        if (storageLifecycleLoading
            || !activeStorageProvider
            || activeStorageGeneration === null) return;
        const runtimeScope = store.getActiveCloudStorageScope();
        if (store.isCloudConnected()
            && (runtimeScope.provider !== activeStorageProvider
                || runtimeScope.generation !== activeStorageGeneration)) {
            store.disconnectCloud();
        }
        store.setActiveCloudStorageScope({
            provider: activeStorageProvider,
            generation: activeStorageGeneration,
        });
    }, [
        storageLifecycleLoading,
        activeStorageProvider,
        activeStorageGeneration,
        store,
    ]);

    const handleAuthorizationFailure = useCallback(async (error: unknown): Promise<boolean> => {
        if (!(error instanceof AuthorizationError)) {
            return false;
        }

        await invalidateSession();

        store.disconnectDrive();
        setIsCloudConnected(false);
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

    const handleDriveBoundaryFailure = useCallback(async (error: unknown): Promise<boolean> => {
        if (error instanceof DriveTransportDisabledError) {
            driveAccessTokenProvider.clearToken();
            store.disconnectDrive();
            setIsCloudConnected(false);
            setIsConnecting(false);
            setSyncState('idle');
            setSyncPhase('idle');
            setHasSynced(false);
            setManualSyncInProgress(false);
            setDriveBindingVersion(previous => previous + 1);
            hasCheckedPersistedState.current = false;
            await refreshDriveTransport();
            return true;
        }

        return handleAuthorizationFailure(error);
    }, [handleAuthorizationFailure, refreshDriveTransport, store]);

    const handleCloudBoundaryFailure = useCallback(async (error: unknown): Promise<boolean> => {
        if (activeStorageProvider === 'google-drive') {
            return handleDriveBoundaryFailure(error);
        }
        if (activeStorageProvider !== 'dropbox'
            || !(error instanceof CloudFileStoreError)
            || !['unauthenticated', 'missing-scope', 'policy-disabled'].includes(error.code)) {
            return false;
        }

        dropboxAccessTokenProvider.clearToken();
        store.disconnectCloud('dropbox');
        setIsCloudConnected(false);
        setIsConnecting(false);
        setSyncState(error.code === 'policy-disabled' ? 'idle' : 'error');
        setSyncPhase(error.code === 'policy-disabled' ? 'idle' : 'error');
        setHasSynced(false);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
        hasCheckedPersistedState.current = false;
        return true;
    }, [activeStorageProvider, handleDriveBoundaryFailure, store]);

    const handleMovedWorkspaceFailure = useCallback((
        error: unknown,
        attemptKey: string,
    ): boolean => {
        if (!(error instanceof CloudProviderMovedError)) {
            return false;
        }

        // The provider marker is an intentional terminal fence. Remember the
        // exact failed connection identity so React rerenders cannot retry it
        // until the user chooses the target provider or explicitly replaces
        // the retained source data.
        blockedCloudConnectionKey.current = attemptKey;
        setMovedToStorageProvider(error.targetProvider);
        setIsCloudConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
        return true;
    }, []);

    const runSyncWithAuthHandling = useCallback<RunSyncWithAuthHandling>(async (options) => {
        try {
            await store.syncCloud(options);
        } catch (error) {
            if (await handleCloudBoundaryFailure(error)) {
                return;
            }

            throw error;
        }
    }, [store, handleCloudBoundaryFailure]);

    // Initialize store on mount
    useEffect(() => {
        let mounted = true;

        store.initialize()
            .then(() => {
                if (mounted) {
                    setIsReady(true);
                    // Check if already connected (e.g., from previous session)
                    setIsCloudConnected(store.isCloudConnected());
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
            store.setCloudSyncPreferences(enabled, mode);
        };

        syncPreferences();

        const handler = () => syncPreferences();
        store.preferences.observe(handler);

        return () => store.preferences.unobserve(handler);
    }, [isReady, store]);

    // Connect only the lifecycle-selected provider. An inactive provider session
    // never authorizes hosted services while the selected provider owns storage.
    // NOTE: Do NOT include autoSyncEnabled/autoSyncMode in deps - those are handled
    // by the preference sync effect calling store.setCloudSyncPreferences().
    useEffect(() => {
        if (!isReady || authLoading || dropboxAuthLoading || storageLifecycleLoading) return;

        const hasWorkerAuth = Boolean(sessionId);
        const runtimeScope = store.getActiveCloudStorageScope();
        if (store.isCloudConnected()
            && runtimeScope.provider === activeStorageProvider
            && runtimeScope.generation === activeStorageGeneration) {
            blockedCloudConnectionKey.current = null;
            setMovedToStorageProvider(null);
            setIsCloudConnected(true);
            setSyncState(store.getSyncState());
            setSyncPhase(store.getSyncPhase());
            setLastSyncedAt(store.getLastSyncedAt());
            setDriveBindingVersion(previous => previous + 1);
            return;
        }

        if (isSignedIn && hasWorkerAuth && isGoogleStorageActive) {
            const attemptKey = JSON.stringify([
                'google-drive',
                activeStorageGeneration ?? 0,
                sessionId,
                driveTransport,
            ]);
            if (blockedCloudConnectionKey.current === attemptKey) return;
            if (cloudConnectionAttempt.current?.key === attemptKey) return;
            const attempt = { key: attemptKey };
            cloudConnectionAttempt.current = attempt;
            setHasSynced(false);
            setIsConnecting(true);

            store.connectDrive({
                transport: driveTransport,
                sessionId,
                generation: activeStorageGeneration ?? 0,
                tokenProvider: driveTransport === 'direct' ? driveAccessTokenProvider : null,
            })
                .then(async () => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    blockedCloudConnectionKey.current = null;
                    setMovedToStorageProvider(null);
                    setIsCloudConnected(true);
                    setSyncState(store.getSyncState());
                    setSyncPhase(store.getSyncPhase());
                    setLastSyncedAt(store.getLastSyncedAt());
                    setDriveBindingVersion(previous => previous + 1);
                    console.log('[YjsContext] Connected to Drive');
                    // connect() already handles initial sync based on the sync mode,
                    // no need for a follow-up forceDriveSync
                })
                .catch(async (error) => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    if (handleMovedWorkspaceFailure(error, attemptKey)) return;
                    if (await handleDriveBoundaryFailure(error)) {
                        return;
                    }

                    setIsCloudConnected(false);
                    setSyncState('error');
                    setSyncPhase('error');
                    console.error('[YjsContext] Failed to connect Drive:', error);
                })
                .finally(() => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    cloudConnectionAttempt.current = null;
                    setIsConnecting(false);
                });
            return;
        }

        if (isDropboxStorageActive
            && dropboxSessionId
            && activeStorageGeneration !== null) {
            const attemptKey = JSON.stringify([
                'dropbox',
                activeStorageGeneration,
                dropboxSessionId,
            ]);
            if (blockedCloudConnectionKey.current === attemptKey) return;
            if (cloudConnectionAttempt.current?.key === attemptKey) return;
            const attempt = { key: attemptKey };
            cloudConnectionAttempt.current = attempt;
            setHasSynced(false);
            setIsConnecting(true);
            dropboxAccessTokenProvider.setSession(dropboxSessionId);
            const manifest = new CloudManifestManager({
                fileStore: new DropboxFileStore({
                    tokenProvider: dropboxAccessTokenProvider,
                }),
            });

            store.connectCloud({
                provider: 'dropbox',
                generation: activeStorageGeneration,
                manifest,
            })
                .then(() => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    blockedCloudConnectionKey.current = null;
                    setMovedToStorageProvider(null);
                    setIsCloudConnected(true);
                    setSyncState(store.getSyncState());
                    setSyncPhase(store.getSyncPhase());
                    setLastSyncedAt(store.getLastSyncedAt());
                    setDriveBindingVersion(previous => previous + 1);
                })
                .catch(async (error) => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    if (handleMovedWorkspaceFailure(error, attemptKey)) return;
                    if (await handleCloudBoundaryFailure(error)) return;
                    setIsCloudConnected(false);
                    setSyncState('error');
                    setSyncPhase('error');
                    console.error('[YjsContext] Failed to connect Dropbox:', error);
                })
                .finally(() => {
                    if (cloudConnectionAttempt.current !== attempt) return;
                    cloudConnectionAttempt.current = null;
                    setIsConnecting(false);
                });
            return;
        }

        cloudConnectionAttempt.current = null;
        blockedCloudConnectionKey.current = null;
        setMovedToStorageProvider(null);
        store.disconnectCloud();
        if (activeStorageProvider !== 'dropbox') {
            dropboxAccessTokenProvider.clearToken();
        }
        setIsCloudConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setLastSyncedAt(null);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
    }, [
        isReady,
        isSignedIn,
        sessionId,
        driveTransport,
        authLoading,
        dropboxAuthLoading,
        isDropboxStorageActive,
        dropboxSessionId,
        storageLifecycleLoading,
        isGoogleStorageActive,
        activeStorageProvider,
        activeStorageGeneration,
        store,
        handleDriveBoundaryFailure,
        handleCloudBoundaryFailure,
        handleMovedWorkspaceFailure,
    ]);

    // Update session ID when it changes (Worker mode)
    useEffect(() => {
        if (store.isDriveConnected() && isGoogleStorageActive) {
            store.updateDriveSessionId(sessionId);
        }
    }, [sessionId, isGoogleStorageActive, store]);

    // Track when at least one sync has completed
    useEffect(() => {
        if (syncState === 'idle' && isCloudConnected) {
            setHasSynced(true);
            setLastSyncedAt(store.getLastSyncedAt());
            consecutiveSyncErrors.current = 0;
        }
    }, [syncState, isCloudConnected, store]);

    // Notify user on repeated sync failures
    useEffect(() => {
        if (syncState !== 'error' || !isCloudConnected) return;

        consecutiveSyncErrors.current += 1;

        if (consecutiveSyncErrors.current === 2) {
            showWarning('Cloud sync is having trouble. Your data is safe locally.');
        } else if (consecutiveSyncErrors.current >= 5) {
            const providerLabel = activeStorageProvider === 'dropbox' ? 'Dropbox' : 'Google Drive';
            showError(`Cloud sync has failed multiple times. Check your connection or reconnect ${providerLabel}.`);
            captureDebugBundleIncident({
                incidentKey: activeStorageProvider === 'dropbox'
                    ? 'dropbox.sync_failed_repeatedly'
                    : 'drive.sync_failed_repeatedly',
                name: activeStorageProvider === 'dropbox'
                    ? 'TaskTimeDropboxSyncError'
                    : 'TaskTimeDriveSyncError',
                message: `TaskTime Pro ${providerLabel} sync failed repeatedly`,
                context: {
                    provider: activeStorageProvider,
                    autoSyncEnabled,
                    autoSyncMode,
                    consecutiveErrors: consecutiveSyncErrors.current,
                },
                throttleMs: 30 * 60 * 1000,
            });
        }
    }, [
        syncState,
        isCloudConnected,
        activeStorageProvider,
        showWarning,
        showError,
        autoSyncEnabled,
        autoSyncMode,
    ]);

    // Subscribe to sync state/phase/pending changes
    // Re-subscribe when the active provider changes because that's when its runtime is created.
    useEffect(() => {
        if (!isReady) return;

        // If not connected, reset to idle and don't subscribe
        if (!isCloudConnected) {
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
    }, [store, isReady, isCloudConnected, driveBindingVersion]);

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

    const forceSyncCloud = useCallback<YjsContextValue['forceSyncCloud']>(async (options) => {
        setManualSyncInProgress(true);
        try {
            try {
                await store.forceCloudSync(options);
            } catch (error) {
                if (await handleCloudBoundaryFailure(error)) return;
                throw error;
            }
        } finally {
            setManualSyncInProgress(false);
        }
    }, [store, handleCloudBoundaryFailure]);

    // Trigger a sync when tab becomes visible or when network reconnects
    useEffect(() => {
        if (!isCloudConnected) return;

        let foregroundSyncTimer: ReturnType<typeof setTimeout> | null = null;
        let foregroundSyncCooldownMs = VISIBILITY_SYNC_COOLDOWN_MS;

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

        const runForegroundSync = () => {
            foregroundSyncTimer = null;

            if (!autoSyncEnabled) return;

            if (autoSyncMode === 'sync') {
                if (!shouldTriggerForegroundSync(foregroundSyncCooldownMs)) {
                    return;
                }

                runSyncWithAuthHandling({ force: false }).catch(console.error);
            } else if (autoSyncMode === 'backup' && store.hasPendingSyncChanges()) {
                runSyncWithAuthHandling({ allowPull: false, force: false }).catch(console.error);
            }
        };

        const scheduleForegroundSync = (cooldownMs: number) => {
            if (!autoSyncEnabled) return;

            if (autoSyncMode === 'sync') {
                if (!shouldTriggerForegroundSync(cooldownMs)) {
                    return;
                }
            } else if (autoSyncMode !== 'backup' || !store.hasPendingSyncChanges()) {
                return;
            }

            if (foregroundSyncTimer !== null) {
                clearTimeout(foregroundSyncTimer);
            }

            foregroundSyncCooldownMs = cooldownMs;
            foregroundSyncTimer = setTimeout(runForegroundSync, FOREGROUND_SYNC_COALESCE_MS);
        };

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            scheduleForegroundSync(VISIBILITY_SYNC_COOLDOWN_MS);
        };

        const handleOnline = () => {
            scheduleForegroundSync(ONLINE_SYNC_COOLDOWN_MS);
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            if (foregroundSyncTimer !== null) {
                clearTimeout(foregroundSyncTimer);
            }
        };

    }, [isCloudConnected, autoSyncEnabled, autoSyncMode, store, runSyncWithAuthHandling]);

    // Recover only the active provider generation after a refresh or interrupted pass.
    useEffect(() => {
        // Only run once per connection, and only after first successful sync state
        if (!isCloudConnected
            || !activeStorageProvider
            || activeStorageGeneration === null
            || hasCheckedPersistedState.current) return;

        const recoveryScope = {
            provider: activeStorageProvider,
            generation: activeStorageGeneration,
        };
        
        const needsSync = shouldSyncOnLoad(recoveryScope);
        if (!needsSync) {
            hasCheckedPersistedState.current = true;
            return;
        }

        const wasInterrupted = wasSyncInterrupted(recoveryScope);
        const hasPending = hasPersistedPendingChanges(recoveryScope);
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
        // because the shared provider checks generation-scoped persisted state.

    }, [
        isCloudConnected,
        activeStorageProvider,
        activeStorageGeneration,
        autoSyncEnabled,
        store,
        autoSyncMode,
        runSyncWithAuthHandling,
    ]);

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
        if (activeStorageProvider !== 'google-drive') return;
        blockedCloudConnectionKey.current = null;
        setMovedToStorageProvider(null);
        store.disconnectDrive();
        setIsCloudConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
        hasCheckedPersistedState.current = false; // Reset for next connection
    }, [activeStorageProvider, store]);

    const disconnectCloud = useCallback(() => {
        blockedCloudConnectionKey.current = null;
        setMovedToStorageProvider(null);
        store.disconnectCloud();
        dropboxAccessTokenProvider.clearToken();
        setIsCloudConnected(false);
        setIsConnecting(false);
        setSyncState('idle');
        setSyncPhase('idle');
        setHasSynced(false);
        setManualSyncInProgress(false);
        setDriveBindingVersion(previous => previous + 1);
        hasCheckedPersistedState.current = false;
    }, [store]);

    const disconnectActiveCloudSession = useCallback<YjsContextValue['disconnectActiveCloudSession']>(async (
        { revoke = false } = {},
    ) => {
        if (!activeStorageProvider || !activeStorageSessionId || activeStorageGeneration === null) {
            throw new Error('Reconnect your cloud provider before disconnecting.');
        }
        if (storageLifecycle?.stagedTarget) {
            throw new Error('Cancel the provider transfer before disconnecting its source.');
        }

        const activeSession = {
            provider: activeStorageProvider,
            sessionId: activeStorageSessionId,
            generation: activeStorageGeneration,
        };

        // Remote revocation must succeed before local state is reported as
        // disconnected. This keeps a transient provider failure retryable.
        if (activeStorageProvider === 'dropbox') {
            await disconnectDropbox({ revoke });
        } else if (revoke) {
            await revokeAccess();
        } else {
            await signOut();
        }

        // Dropbox clears this binding inside its auth hook. Repeating the
        // exact fenced clear is intentionally idempotent and keeps the shared
        // lifecycle contract identical for every provider.
        await clearStorageSession(activeSession);
        disconnectCloud();
    }, [
        activeStorageGeneration,
        activeStorageProvider,
        activeStorageSessionId,
        clearStorageSession,
        disconnectCloud,
        disconnectDropbox,
        revokeAccess,
        signOut,
        storageLifecycle?.stagedTarget,
    ]);

    const wipeDriveData = useCallback(async () => {
        await store.wipeDriveData();
    }, [store]);

    const wipeCloudData = useCallback(async () => {
        await store.wipeCloudData();
    }, [store]);

    const replaceMovedCloudWorkspace = useCallback<YjsContextValue['replaceMovedCloudWorkspace']>(async (
        expectedTargetProvider,
    ) => {
        setIsConnecting(true);
        try {
            await store.replaceMovedCloudWorkspace(expectedTargetProvider);
            blockedCloudConnectionKey.current = null;
            setMovedToStorageProvider(null);
            setIsCloudConnected(store.isCloudConnected());
            setSyncState(store.getSyncState());
            setSyncPhase(store.getSyncPhase());
            setLastSyncedAt(store.getLastSyncedAt());
            setHasSynced(store.isCloudConnected());
            setDriveBindingVersion(previous => previous + 1);
            hasCheckedPersistedState.current = false;
        } catch (error) {
            // Once the old source is cleared and its new manual connection is
            // established, a failed first upload is an ordinary retryable sync
            // error rather than a moved-source fence. Expose Sync Now instead
            // of leaving the user trapped in the destructive confirmation.
            if (store.isCloudConnected()) {
                blockedCloudConnectionKey.current = null;
                setMovedToStorageProvider(null);
                setIsCloudConnected(true);
                setSyncState(store.getSyncState());
                setSyncPhase(store.getSyncPhase());
                setLastSyncedAt(store.getLastSyncedAt());
                setHasSynced(false);
                setDriveBindingVersion(previous => previous + 1);
            }
            throw error;
        } finally {
            setIsConnecting(false);
        }
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
        setIsCloudConnected(store.isCloudConnected());
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
            setIsCloudConnected(store.isCloudConnected());
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
        isCloudConnected,
        activeStorageProvider,
        movedToStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        hostedServiceSessionId,
        isCloudIdentityLoading,
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
        forceSyncCloud,
        disconnectDrive,
        disconnectCloud,
        disconnectActiveCloudSession,
        wipeDriveData,
        wipeCloudData,
        replaceMovedCloudWorkspace,
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
        isCloudConnected,
        activeStorageProvider,
        movedToStorageProvider,
        activeStorageSessionId,
        activeStorageGeneration,
        hostedServiceSessionId,
        isCloudIdentityLoading,
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
        forceSyncCloud,
        disconnectDrive,
        disconnectCloud,
        disconnectActiveCloudSession,
        wipeDriveData,
        wipeCloudData,
        replaceMovedCloudWorkspace,
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
