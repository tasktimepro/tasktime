/**
 * YjsSyncSettings - Sync settings component for Yjs-based sync
 *
 * Sync contract source of truth: ./README.md
 * 
 * Shows connection status and manages the active cloud provider.
 */

import type { ChangeEvent, ComponentType, MouseEvent } from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { isDropboxCloudUiEnabled } from '@/config/cloudProviders';
import { useCloudProviderTransfer } from '@/hooks/useCloudProviderTransfer';
import { useDropboxAuth } from '@/hooks/useDropboxAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { useToast } from '@/hooks/useToast';
import { ArrowPathIcon, CheckIcon, CloudBackupIcon, CloudIcon, CloudOffIcon, DropboxBrandIcon, ExclamationTriangleIcon, GoogleDriveBrandIcon, MoreHorizontalIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card as CardPrimitive, CardContent as CardContentPrimitive, CardHeader as CardHeaderPrimitive, CardTitle as CardTitlePrimitive } from '@/components/ui/card';
import { Checkbox as CheckboxPrimitive } from '@/components/ui/checkbox';
import { Input as InputPrimitive } from '@/components/ui/input';
import { Label as LabelPrimitive } from '@/components/ui/label';
import { Select as SelectPrimitive, SelectContent as SelectContentPrimitive, SelectItem as SelectItemPrimitive, SelectTrigger as SelectTriggerPrimitive, SelectValue as SelectValuePrimitive } from '@/components/ui/select';
import { DropdownMenu as DropdownMenuPrimitive, DropdownMenuContent as DropdownMenuContentPrimitive, DropdownMenuItem as DropdownMenuItemPrimitive, DropdownMenuTrigger as DropdownMenuTriggerPrimitive } from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';
import { Notice as NoticePrimitive } from '@/components/ui/notice';
import { format, formatDistanceToNow } from 'date-fns';
import type { BackupInfo } from '@/stores/yjs';
import type { CloudProviderId } from '@/stores/yjs';
import type { AutoSyncMode } from '@/stores/yjs/types';
import { parseIntegerInputWithFallback } from '@/utils/numberInputUtils';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

type ConfirmDialogType = 'disconnect' | 'transfer' | 'wipe' | 'replace-moved' | null;
type PendingBackupModeChange = {
    autoSyncEnabled: boolean;
    autoSyncMode: 'backup';
} | null;
type UntypedUiComponent = ComponentType<any>;

const Card = CardPrimitive as unknown as UntypedUiComponent;
const CardContent = CardContentPrimitive as unknown as UntypedUiComponent;
const CardHeader = CardHeaderPrimitive as unknown as UntypedUiComponent;
const CardTitle = CardTitlePrimitive as unknown as UntypedUiComponent;
const Checkbox = CheckboxPrimitive as unknown as UntypedUiComponent;
const Input = InputPrimitive as unknown as UntypedUiComponent;
const Label = LabelPrimitive as unknown as UntypedUiComponent;
const Select = SelectPrimitive as unknown as UntypedUiComponent;
const SelectContent = SelectContentPrimitive as unknown as UntypedUiComponent;
const SelectItem = SelectItemPrimitive as unknown as UntypedUiComponent;
const SelectTrigger = SelectTriggerPrimitive as unknown as UntypedUiComponent;
const SelectValue = SelectValuePrimitive as unknown as UntypedUiComponent;
const DropdownMenu = DropdownMenuPrimitive as unknown as UntypedUiComponent;
const DropdownMenuContent = DropdownMenuContentPrimitive as unknown as UntypedUiComponent;
const DropdownMenuItem = DropdownMenuItemPrimitive as unknown as UntypedUiComponent;
const DropdownMenuTrigger = DropdownMenuTriggerPrimitive as unknown as UntypedUiComponent;
const Notice = NoticePrimitive as unknown as UntypedUiComponent;

export default function YjsSyncSettings() {
    const isMobileLayout = useIsMobileLayout();

    const [now, setNow] = useState(Date.now());
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [wipeConfirmText, setWipeConfirmText] = useState('');
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [backupsLoading, setBackupsLoading] = useState(false);
    const [backupCreating, setBackupCreating] = useState(false);
    const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<BackupInfo | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [pendingBackupModeChange, setPendingBackupModeChange] = useState<PendingBackupModeChange>(null);
    const [transferTarget, setTransferTarget] = useState<CloudProviderId | null>(null);

    const {
        store,
        isReady,
        isSyncing,
        syncState,
        syncPhase,
        isDriveConnected,
        isCloudConnected,
        activeStorageProvider,
        movedToStorageProvider,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        lastSyncedAt,
        pendingSyncChanges,
        forceSyncCloud,
        disconnectActiveCloudSession,
        wipeCloudData,
        replaceMovedCloudWorkspace,
        deleteAllBackups,
        listBackups,
        createBackup,
        downloadBackup,
    } = useYjs();
    const {
        isSignedIn,
        isLoading: authLoading,
        user,
        signIn,
        hadPreviousSession,
    } = useGoogleAuth();
    const {
        isSignedIn: isDropboxSignedIn,
        isLoading: dropboxAuthLoading,
        sessionId: dropboxSessionId,
        accountEmail: dropboxAccountEmail,
        error: dropboxAuthError,
        signIn: signInDropbox,
        refresh: refreshDropboxAuth,
    } = useDropboxAuth();
    const transfer = useCloudProviderTransfer();
    const { preferences, updatePreferences } = usePreferences();
    const { showSuccess, showError } = useToast();

    const dropboxUiEnabled = isDropboxCloudUiEnabled();
    const cloudConnected = isCloudConnected ?? isDriveConnected;
    const provider = activeStorageProvider ?? (isDriveConnected ? 'google-drive' : null);
    const providerName = provider === 'dropbox' ? 'Dropbox' : 'Google Drive';
    const providerShortName = provider === 'dropbox' ? 'Dropbox' : 'Drive';
    const transferTargetProvider: CloudProviderId = provider === 'dropbox' ? 'google-drive' : 'dropbox';
    const transferTargetName = transferTargetProvider === 'dropbox' ? 'Dropbox' : 'Google Drive';
    const TransferTargetIcon = transferTargetProvider === 'dropbox' ? DropboxBrandIcon : GoogleDriveBrandIcon;
    const ProviderIcon = provider === 'dropbox' ? DropboxBrandIcon : GoogleDriveBrandIcon;
    const movedTargetName = movedToStorageProvider === 'dropbox' ? 'Dropbox' : 'Google Drive';
    const MovedTargetIcon = movedToStorageProvider === 'dropbox' ? DropboxBrandIcon : GoogleDriveBrandIcon;
    const providerIsSignedIn = provider === 'dropbox' ? isDropboxSignedIn : isSignedIn;
    const showAuthActions = isReady && !authLoading && !dropboxAuthLoading;
    const showConnectButton = showAuthActions
        && !isOffline
        && !provider
        && !isSignedIn
        && !isDropboxSignedIn
        && !cloudConnected
        && !isConnecting;
    const showConnectedActions = showAuthActions
        && !isOffline
        && providerIsSignedIn
        && cloudConnected;
    const showMovedRecoveryActions = showAuthActions
        && !isOffline
        && Boolean(provider)
        && Boolean(movedToStorageProvider)
        && !cloudConnected
        && !isConnecting;
    const showProviderRecoveryActions = showAuthActions
        && provider === 'dropbox'
        && Boolean(dropboxSessionId)
        && !providerIsSignedIn
        && !cloudConnected;

    const autoSyncEnabled = preferences.autoSyncEnabled ?? false;
    const autoSyncMode = preferences.autoSyncMode ?? 'sync';
    const backupEnabled = preferences.backupEnabled ?? true;
    const backupFrequencyHours = preferences.backupFrequencyHours ?? 24;
    const isManualMode = !autoSyncEnabled;

    // Update "time ago" display
    useEffect(() => {
        if (!cloudConnected || !lastSyncedAt) {
            return undefined;
        }

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [cloudConnected, lastSyncedAt]);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const status = useMemo(() => {
        if (!isReady || authLoading || dropboxAuthLoading) {
            return {
                text: 'Loading...',
                tone: 'text-muted-foreground',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (isOffline) {
            return {
                text: 'Currently offline',
                tone: 'status-warning-text-strong',
                icon: CloudOffIcon
            };
        }

        if (movedToStorageProvider) {
            return {
                text: `Moved to ${movedTargetName}`,
                tone: 'status-warning-text-strong',
                icon: ExclamationTriangleIcon,
            };
        }

        if (provider === 'dropbox' && dropboxSessionId && dropboxAuthError) {
            return {
                text: 'Connection unavailable',
                tone: 'status-warning-text-strong',
                icon: ExclamationTriangleIcon,
            };
        }

        if (!cloudConnected && !isConnecting) {
            return {
                text: 'Not connected',
                tone: 'text-muted-foreground',
                icon: CloudIcon
            };
        }

        if (isConnecting || !cloudConnected) {
            return {
                text: 'Syncing...',
                tone: 'status-warning-text-strong',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncState === 'error') {
            if (autoSyncEnabled && autoSyncMode === 'backup' && pendingSyncChanges) {
                return {
                    text: 'Sync Now needed',
                    tone: 'status-warning-text-strong',
                    icon: ExclamationTriangleIcon
                };
            }

            return {
                text: 'Sync error',
                tone: 'status-danger-text-strong',
                icon: ExclamationTriangleIcon
            };
        }

        if (syncPhase === 'checking') {
            return {
                text: 'Checking for updates...',
                tone: 'status-warning-text-strong',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncPhase === 'downloading') {
            return {
                text: 'Fetching updates...',
                tone: 'status-warning-text-strong',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncPhase === 'uploading') {
            return {
                text: 'Syncing changes...',
                tone: 'status-warning-text-strong',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        if (showSyncingText || isSyncing) {
            return {
                text: 'Syncing...',
                tone: 'status-warning-text-strong',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (isManualMode && pendingSyncChanges) {
            return {
                text: 'Changes waiting for manual sync',
                tone: 'status-warning-text-strong',
                icon: CloudBackupIcon,
            };
        }

        if (isManualMode) {
            return {
                text: lastSyncedAt
                    ? `Last sync ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, includeSeconds: true })}`
                    : 'Connected (manual sync)',
                tone: 'status-success-text-strong',
                icon: CheckIcon
            };
        }

        return {
            text: lastSyncedAt
                ? `Synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, includeSeconds: true })}`
                : 'Connected',
            tone: 'status-success-text-strong',
            icon: CheckIcon
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` is a tick dependency that forces recomputation of relative-time strings
    }, [isReady, authLoading, dropboxAuthLoading, cloudConnected, isConnecting, isOffline, syncState, syncPhase, isSyncing, hasSynced, manualSyncInProgress, lastSyncedAt, now, isManualMode, pendingSyncChanges, autoSyncEnabled, autoSyncMode, provider, dropboxSessionId, dropboxAuthError, movedToStorageProvider, movedTargetName]);

    const handleConnect = async () => {
        try {
            await signIn();
        } catch (error) {
            if (store.isDriveConnected()) {
                return;
            }

            console.error('[YjsSyncSettings] Connect failed:', error);
            showError(error instanceof Error ? error.message : 'Google Drive action failed.');
        }
    };

    const handleConnectDropbox = async () => {
        try {
            await signInDropbox();
        } catch (error) {
            if (store.isCloudConnected()) return;
            console.error('[YjsSyncSettings] Dropbox connect failed:', error);
            showError(error instanceof Error ? error.message : 'Dropbox action failed.');
        }
    };

    const handleRetryDropbox = async () => {
        try {
            await refreshDropboxAuth();
        } catch (error) {
            console.error('[YjsSyncSettings] Dropbox reconnect check failed:', error);
            showError(error instanceof Error ? error.message : 'Dropbox connection could not be checked.');
        }
    };

    const handleConnectMovedTarget = async () => {
        if (!movedToStorageProvider) return;
        try {
            await disconnectActiveCloudSession({ revoke: false });
            if (movedToStorageProvider === 'dropbox') {
                await signInDropbox();
            } else {
                await signIn();
            }
        } catch (error) {
            console.error('[YjsSyncSettings] Moved provider recovery failed:', error);
            showError(error instanceof Error ? error.message : `Could not connect ${movedTargetName}.`);
        }
    };

    const confirmReplaceMovedWorkspace = async () => {
        if (!movedToStorageProvider) return;
        setIsProcessing(true);
        try {
            await replaceMovedCloudWorkspace(movedToStorageProvider);
            showSuccess(`${providerName} is ready as a new workspace`);
            setConfirmDialog(null);
        } catch (error) {
            console.error('[YjsSyncSettings] Moved source replacement failed:', error);
            showError(error instanceof Error ? error.message : `${providerName} could not be cleared.`);
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Simple disconnect - syncs first, then disconnects.
     * Does NOT delete local data (user can reconnect later).
     */
    const handleDisconnect = () => {
        setConfirmDialog('disconnect');
    };

    const handleWipeAndDisconnect = () => {
        setWipeConfirmText('');
        setConfirmDialog('wipe');
    };

    const confirmDisconnect = async () => {
        const canSyncBeforeDisconnect = cloudConnected && providerIsSignedIn;
        setIsProcessing(true);
        try {
            if (canSyncBeforeDisconnect) {
                // Sync before disconnecting so the active provider has the latest data.
                await forceSyncCloud();
                showSuccess('Synced successfully');
            }
            await disconnectActiveCloudSession({ revoke: false });
            showSuccess(`Disconnected from ${providerName}`);
        } catch (error) {
            console.error('[YjsSyncSettings] Disconnect failed:', error);
            showError(canSyncBeforeDisconnect
                ? 'Sync or disconnect failed. Please try again.'
                : 'Disconnect failed. Please try again.');
            // DO NOT disconnect if sync failed - data could be lost
            return;
        } finally {
            setIsProcessing(false);
            setConfirmDialog(null);
        }
    };

    const confirmWipeAndDisconnect = async () => {
        const confirmation = 'wipe data';
        if (wipeConfirmText.trim().toLowerCase() !== confirmation) {
            showError(`Please type "${confirmation}" to confirm.`);
            return;
        }

        setIsProcessing(true);
        try {
            await wipeCloudData();
            await deleteAllBackups();
            await disconnectActiveCloudSession({ revoke: true });
            showSuccess(`${providerName} data wiped and disconnected`);
        } catch (error) {
            console.error('[YjsSyncSettings] Wipe & disconnect failed:', error);
            showError('Wipe failed. Please try again.');
            return;
        } finally {
            setIsProcessing(false);
            setConfirmDialog(null);
        }
    };

    const handleForceSync = async () => {
        try {
            await forceSyncCloud();
            showSuccess('Synced successfully');
        } catch (error) {
            console.error('[YjsSyncSettings] Manual sync failed:', error);
            showError('Sync failed. Please try again.');
        }
    };

    const applyAutoSyncPreferences = useCallback(async (nextEnabled: boolean, nextMode: AutoSyncMode) => {
        updatePreferences({
            autoSyncEnabled: nextEnabled,
            autoSyncMode: nextMode,
        });
        if (typeof store.setCloudSyncPreferences === 'function') {
            store.setCloudSyncPreferences(nextEnabled, nextMode);
        } else {
            // Compatibility for older embedded/test store facades.
            store.setDriveSyncPreferences(nextEnabled, nextMode);
        }

        if (cloudConnected) {
            try {
                await forceSyncCloud();
            } catch (error) {
                console.error('[YjsSyncSettings] Sync failed after auto-sync preference change:', error);
                showError('Sync failed. Please try again.');
            }
        }
    }, [cloudConnected, forceSyncCloud, showError, store, updatePreferences]);

    const handleAutoSyncToggle = async (checked: boolean | 'indeterminate') => {
        const nextEnabled = checked === true;
        const nextMode: AutoSyncMode = autoSyncMode === 'backup' ? 'backup' : 'sync';

        if (nextEnabled && nextMode === 'backup') {
            setPendingBackupModeChange({ autoSyncEnabled: true, autoSyncMode: 'backup' });
            return;
        }

        await applyAutoSyncPreferences(nextEnabled, nextMode);
    };

    const handleAutoSyncModeChange = async (value: string) => {
        const nextMode: AutoSyncMode = value === 'backup' ? 'backup' : 'sync';

        if (nextMode === 'backup' && autoSyncMode !== 'backup') {
            setPendingBackupModeChange({ autoSyncEnabled, autoSyncMode: 'backup' });
            return;
        }

        await applyAutoSyncPreferences(autoSyncEnabled, nextMode);
    };

    const confirmBackupModeChange = async () => {
        if (!pendingBackupModeChange) return;

        const nextChange = pendingBackupModeChange;
        setPendingBackupModeChange(null);
        await applyAutoSyncPreferences(nextChange.autoSyncEnabled, nextChange.autoSyncMode);
    };

    const loadBackups = useCallback(async () => {
        if (!cloudConnected) return;
        setBackupsLoading(true);
        try {
            const result = await listBackups();
            setBackups(result);
        } catch (error) {
            console.error('[YjsSyncSettings] Failed to load backups:', error);
        } finally {
            setBackupsLoading(false);
        }
    }, [cloudConnected, listBackups]);

    // Load backups when connected
    useEffect(() => {
        if (cloudConnected && hasSynced) {
            loadBackups();
        } else {
            setBackups([]);
        }
    }, [cloudConnected, hasSynced, loadBackups]);

    const handleCreateBackup = async () => {
        setBackupCreating(true);
        try {
            await createBackup();
            showSuccess('Backup created successfully');
            await loadBackups();
        } catch (error) {
            console.error('[YjsSyncSettings] Create backup failed:', error);
            showError('Failed to create backup');
        } finally {
            setBackupCreating(false);
        }
    };

    const handleBackupEnabledToggle = (checked: boolean | 'indeterminate') => {
        updatePreferences({ backupEnabled: checked === true });
    };

    const handleBackupFrequencyChange = (value: string) => {
        updatePreferences({
            backupFrequencyHours: parseIntegerInputWithFallback(value, backupFrequencyHours, { min: 1 }),
        });
    };

    const handleRestoreBackup = async () => {
        if (!restoreConfirmBackup) return;
        setIsRestoring(true);
        try {
            const data = await downloadBackup(restoreConfirmBackup.id) as Record<string, unknown>;
            // Trigger the import flow in the parent (ExportImport)
            // For now, download as a file so the user can import via the existing flow
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = restoreConfirmBackup.name;
            a.click();
            URL.revokeObjectURL(url);
            showSuccess(`Downloaded ${restoreConfirmBackup.name}. Use Import to restore.`);
        } catch (error) {
            console.error('[YjsSyncSettings] Restore failed:', error);
            showError('Failed to download backup');
        } finally {
            setIsRestoring(false);
            setRestoreConfirmBackup(null);
        }
    };

    const requestTransfer = (targetProvider: CloudProviderId) => {
        setTransferTarget(targetProvider);
        setConfirmDialog('transfer');
    };

    const confirmTransfer = async () => {
        if (!transferTarget) return;
        setConfirmDialog(null);
        try {
            await transfer.startTransfer(transferTarget);
            showSuccess(`Workspace transferred to ${transferTarget === 'dropbox' ? 'Dropbox' : 'Google Drive'}`);
        } catch (error) {
            console.error('[YjsSyncSettings] Provider transfer stopped:', error);
            showError(error instanceof Error
                ? error.message
                : 'The provider transfer stopped safely. Your source remains active.');
        }
    };

    const handleResumeTransfer = async () => {
        try {
            await transfer.resumeTransfer();
            showSuccess(`Workspace transfer to ${transfer.targetProvider === 'dropbox' ? 'Dropbox' : 'Google Drive'} completed`);
        } catch (error) {
            console.error('[YjsSyncSettings] Provider transfer resume stopped:', error);
            showError(error instanceof Error
                ? error.message
                : 'The provider transfer could not resume. Your source remains active.');
        }
    };

    const transferTargetLabel = transfer.targetProvider === 'dropbox' ? 'Dropbox' : 'Google Drive';
    const transferStageDetails: Record<string, { text: string; progress: number }> = {
        'preparing-source': { text: 'Preparing your data', progress: 10 },
        'target-inspected': { text: `Checking ${transferTargetLabel}`, progress: 25 },
        'uploading-target': { text: `Copying your data to ${transferTargetLabel}`, progress: 40 },
        'target-prepared': { text: `Verifying your data in ${transferTargetLabel}`, progress: 55 },
        'target-verified': { text: 'Checking for recent changes', progress: 70 },
        'source-marked': { text: `Switching to ${transferTargetLabel}`, progress: 80 },
        activated: { text: `Connecting ${transferTargetLabel}`, progress: 90 },
        finalizing: { text: 'Finishing setup', progress: 95 },
    };
    const transferStageDetail = transfer.stage ? transferStageDetails[transfer.stage] : null;
    const transferProgress = transferStageDetail?.progress ?? 0;
    const transferStatusText = transferStageDetail?.text ?? 'Waiting for provider authorization';
    const showTransferPanel = dropboxUiEnabled
        && (transfer.isTransferInProgress
            || transfer.canResume
            || transfer.status === 'error');

    const StatusIcon = status.icon;
    const renderProviderOverflowActions = () => (
        <>
            {dropboxUiEnabled && (
                <DropdownMenuItem
                    onClick={() => requestTransfer(transferTargetProvider)}
                    disabled={transfer.isTransferInProgress || isSyncing}
                    className="flex items-center space-x-2"
                >
                    <TransferTargetIcon className="h-4 w-4" />
                    <span>Transfer to {transferTargetName}</span>
                </DropdownMenuItem>
            )}
            <DropdownMenuItem
                onClick={handleWipeAndDisconnect}
                disabled={transfer.isTransferInProgress}
                className="status-danger-action flex items-center space-x-2"
            >
                <TrashIcon className="h-4 w-4" />
                <span>Wipe data & disconnect</span>
            </DropdownMenuItem>
        </>
    );

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Cloud Sync</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {dropboxUiEnabled
                        ? 'Choose one cloud provider for private, direct browser-to-provider sync. Auto-sync between devices is optional.'
                        : 'Connect Google Drive to back up your data. Auto-sync between devices is optional.'}
                </p>
            </div>

            {showTransferPanel && (
                <Card className="mb-4" aria-live="polite">
                    <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                        <CardTitle>
                            Moving to {transferTargetLabel}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className={cn('space-y-3', isMobileLayout && 'px-3 pb-3 pt-0')}>
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm text-foreground">{transferStatusText}</p>
                                <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">
                                    {transferProgress}%
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-label={`Transfer to ${transferTargetLabel} progress`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={transferProgress}
                                aria-valuetext={transferStatusText}
                                className="relative h-2 overflow-hidden rounded-full bg-muted"
                            >
                                <div
                                    data-transfer-progress-fill
                                    className="relative h-full overflow-hidden rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                                    style={{ width: `${transferProgress}%` }}
                                >
                                    {transfer.isTransferInProgress && (
                                        <div
                                            data-transfer-progress-activity
                                            aria-hidden="true"
                                            className="transfer-progress-activity"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                        {transfer.error && (
                            <p className="text-sm status-danger-text-strong">{transfer.error}</p>
                        )}
                        <Notice
                            variant="warning"
                            compact
                            description={`Do not use TaskTime on other devices during this transfer. Then connect them to ${transferTargetLabel} before making changes.`}
                        />
                        {transfer.canResume && !transfer.isTransferInProgress && (
                            <Button variant="outline" onClick={handleResumeTransfer}>
                                Resume transfer
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                    <CardTitle className="flex items-center gap-2">
                        {provider && <ProviderIcon className="h-5 w-5 flex-shrink-0" />}
                        <span>{provider ? providerName : (dropboxUiEnabled ? 'Choose a provider' : 'Google Drive')}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className={cn('space-y-4', isMobileLayout && 'px-3 pb-3 pt-0')}>
                    <div className={cn('flex gap-4', isMobileLayout ? 'flex-col' : 'items-center justify-between')}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <StatusIcon className={`h-5 w-5 flex-shrink-0 ${status.tone} ${status.spinning ? 'animate-spin' : ''}`} />
                                <div className="min-w-0">
                                    <div className={`text-sm font-medium ${status.tone}`}>{status.text}</div>
                                    {provider !== 'dropbox' && isSignedIn && user?.email && (
                                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                                    )}
                                    {provider === 'dropbox' && (dropboxAuthError || dropboxAccountEmail) && (
                                        <div className="truncate text-xs text-muted-foreground">
                                            {dropboxAuthError ?? dropboxAccountEmail}
                                        </div>
                                    )}
                                    {provider && movedToStorageProvider && (
                                        <div className="mt-1 text-xs status-warning-text-strong">
                                            TaskTime data in this {providerName} was moved to {movedTargetName}.
                                        </div>
                                    )}
                                </div>
                            </div>
                            {showConnectedActions && isMobileLayout && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full text-muted-foreground hover:bg-muted"
                                            title="More actions"
                                            aria-label="More actions"
                                        >
                                            <MoreHorizontalIcon className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
                                        {renderProviderOverflowActions()}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <div className={cn('flex items-center gap-2', isMobileLayout && 'w-full flex-wrap')}>
                            {showConnectedActions ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            onClick={handleDisconnect}
                                            disabled={transfer.isTransferInProgress}
                                            className={cn(isMobileLayout && 'flex-1')}
                                        >
                                            Disconnect
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleForceSync}
                                            disabled={!cloudConnected || isSyncing || transfer.isTransferInProgress}
                                            leadingIcon={ArrowPathIcon}
                                            className={cn(isMobileLayout && 'flex-1')}
                                        >
                                            Sync Now
                                        </Button>
                                        {!isMobileLayout && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="rounded-full text-muted-foreground hover:bg-muted"
                                                        title="More actions"
                                                        aria-label="More actions"
                                                    >
                                                        <MoreHorizontalIcon className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
                                                    {renderProviderOverflowActions()}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </>
                            ) : showMovedRecoveryActions ? (
                                <div className={cn('flex gap-2', isMobileLayout && 'w-full flex-col')}>
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirmDialog('replace-moved')}
                                        disabled={isProcessing}
                                        leadingIcon={ProviderIcon}
                                        className={cn(isMobileLayout && 'w-full')}
                                    >
                                        Use {providerName}
                                    </Button>
                                    <Button
                                        onClick={handleConnectMovedTarget}
                                        disabled={isProcessing}
                                        leadingIcon={MovedTargetIcon}
                                        className={cn(isMobileLayout && 'w-full')}
                                    >
                                        Connect {movedTargetName}
                                    </Button>
                                </div>
                            ) : showProviderRecoveryActions ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={handleDisconnect}
                                        className={cn(isMobileLayout && 'flex-1')}
                                    >
                                        Disconnect
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleRetryDropbox}
                                        disabled={dropboxAuthLoading || isOffline}
                                        leadingIcon={ArrowPathIcon}
                                        className={cn(isMobileLayout && 'flex-1')}
                                    >
                                        Retry
                                    </Button>
                                </>
                            ) : showConnectButton ? (
                                <div className={cn('flex gap-2', isMobileLayout && 'w-full flex-col')}>
                                    <Button
                                        onClick={handleConnect}
                                        leadingIcon={GoogleDriveBrandIcon}
                                        title={hadPreviousSession ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                                        className={cn(isMobileLayout && 'w-full')}
                                    >
                                        Connect Google Drive
                                    </Button>
                                    {dropboxUiEnabled && (
                                        <Button
                                            onClick={handleConnectDropbox}
                                            leadingIcon={DropboxBrandIcon}
                                            title="Connect Dropbox"
                                            className={cn(isMobileLayout && 'w-full')}
                                        >
                                            Connect Dropbox
                                        </Button>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    {showConnectedActions && (
                        <div className={cn('space-y-3 rounded-md border border-border bg-muted/30', isMobileLayout ? 'p-3' : 'p-4')}>
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="auto-sync-enabled"
                                    checked={autoSyncEnabled}
                                    onCheckedChange={handleAutoSyncToggle}
                                />
                                <div>
                                    <Label htmlFor="auto-sync-enabled" className="text-sm font-medium">
                                        Enable auto-sync
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        When disabled, you control when changes are synced with {providerShortName}.
                                    </p>
                                </div>
                            </div>
                            {autoSyncEnabled && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Auto-sync mode</Label>
                                    <Select value={autoSyncMode} onValueChange={handleAutoSyncModeChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sync">Sync between devices (recommended)</SelectItem>
                                            <SelectItem value="backup">Back up this device only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Sync between devices uploads and pulls changes automatically. Device backup uploads this device's changes and requires Sync Now to import edits from another device.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Backup Settings Card */}
            {showConnectedActions && (
                <Card className="mt-4">
                    <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                        <CardTitle>Automatic Backups</CardTitle>
                    </CardHeader>
                    <CardContent className={cn('space-y-4', isMobileLayout && 'px-3 pb-3 pt-0')}>
                        <div className={cn('space-y-3 rounded-md border border-border bg-muted/30', isMobileLayout ? 'p-3' : 'p-4')}>
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="backup-enabled"
                                    checked={backupEnabled}
                                    onCheckedChange={handleBackupEnabledToggle}
                                />
                                <div>
                                    <Label htmlFor="backup-enabled" className="text-sm font-medium">
                                        Enable automatic backups
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Creates snapshots of your data on {providerName} after each sync.
                                    </p>
                                </div>
                            </div>
                            {backupEnabled && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Backup frequency</Label>
                                    <Select value={String(backupFrequencyHours)} onValueChange={handleBackupFrequencyChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Every hour</SelectItem>
                                            <SelectItem value="4">Every 4 hours</SelectItem>
                                            <SelectItem value="8">Every 8 hours</SelectItem>
                                            <SelectItem value="12">Every 12 hours</SelectItem>
                                            <SelectItem value="24">Every 24 hours</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Keeps up to 7 daily and 4 weekly snapshots (~11 files max).
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Backup list */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Available backups</Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={loadBackups}
                                        disabled={backupsLoading}
                                    >
                                        {backupsLoading ? 'Loading...' : 'Refresh'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCreateBackup}
                                        disabled={backupCreating || isSyncing}
                                    >
                                        {backupCreating ? 'Creating...' : 'Backup Now'}
                                    </Button>
                                </div>
                            </div>
                            {backups.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                    {backupsLoading ? 'Loading backups...' : 'No backups yet. Backups are created automatically after sync.'}
                                </p>
                            ) : (
                                <div className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
                                    {backups.map((backup) => (
                                        <div key={backup.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {format(new Date(backup.modifiedTime), 'MMM d, yyyy h:mm a')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(backup.modifiedTime), { addSuffix: true })}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setRestoreConfirmBackup(backup)}
                                            >
                                                Download
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Restore Confirmation Modal */}
            <Modal
                isOpen={restoreConfirmBackup !== null}
                onClose={() => !isRestoring && setRestoreConfirmBackup(null)}
                title="Download backup?"
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setRestoreConfirmBackup(null)}
                            disabled={isRestoring}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRestoreBackup}
                            disabled={isRestoring}
                        >
                            {isRestoring ? 'Downloading...' : 'Download'}
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    This will download the backup from{' '}
                    {restoreConfirmBackup && format(new Date(restoreConfirmBackup.modifiedTime), 'MMM d, yyyy h:mm a')}.
                    To restore, use the Import feature in the Export & Import section.
                </p>
            </Modal>

            {/* Disconnect Confirmation Modal */}
            <Modal
                isOpen={confirmDialog === 'disconnect'}
                onClose={() => !isProcessing && setConfirmDialog(null)}
                title={`Disconnect from ${providerName}?`}
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(null)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDisconnect}
                            disabled={isProcessing}
                            loading={isProcessing}
                            loadingText="Disconnecting..."
                        >
                            {cloudConnected && providerIsSignedIn ? 'Sync & disconnect' : 'Disconnect'}
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {cloudConnected && providerIsSignedIn
                        ? `Your data will be synced to ${providerName} before this browser disconnects.`
                        : `This browser will disconnect without syncing because ${providerName} is currently unavailable. Any local changes stay on this device.`}
                    {' '}Provider authorization and cloud files remain in place, and your local data stays on this device.
                </p>
            </Modal>

            <Modal
                isOpen={confirmDialog === 'transfer'}
                onClose={() => !transfer.isTransferInProgress && setConfirmDialog(null)}
                title={`Transfer to ${transferTarget === 'dropbox' ? 'Dropbox' : 'Google Drive'}?`}
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(null)}
                            disabled={transfer.isTransferInProgress}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmTransfer}
                            disabled={transfer.isTransferInProgress}
                            leadingIcon={TransferTargetIcon}
                        >
                            Connect & transfer
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        TaskTime will sync your latest changes, copy your data to {transferTarget === 'dropbox' ? 'Dropbox' : 'Google Drive'}, and verify it before switching this browser.
                    </p>
                    <p>
                        Your {providerName} data and backups will stay there.
                    </p>
                    <Notice
                        variant="warning"
                        compact
                        description={`Do not use TaskTime on other devices during this transfer. Then connect them to ${transferTarget === 'dropbox' ? 'Dropbox' : 'Google Drive'} before making changes.`}
                    />
                </div>
            </Modal>

            <Modal
                isOpen={confirmDialog === 'replace-moved'}
                onClose={() => !isProcessing && setConfirmDialog(null)}
                title={`Use ${providerName} for a new workspace?`}
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(null)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmReplaceMovedWorkspace}
                            disabled={isProcessing}
                            loading={isProcessing}
                            loadingText={`Resetting ${providerName}...`}
                        >
                            Clear & use {providerName}
                        </Button>
                    </div>
                }
            >
                <Notice
                    variant="warning"
                    icon={ExclamationTriangleIcon}
                    description={`This permanently deletes all TaskTime sync files and backups in ${providerName}. ${movedTargetName} stays unchanged. This device will then start a new ${providerName} workspace.`}
                />
            </Modal>

            {/* Backup Mode Confirmation Modal */}
            <Modal
                isOpen={pendingBackupModeChange !== null}
                onClose={() => setPendingBackupModeChange(null)}
                title="Use device backup mode?"
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setPendingBackupModeChange(null)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={confirmBackupModeChange}>
                            Use Backup Mode
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Device backup is intended for using TaskTime Pro on one device. It uploads this device's changes to {providerShortName}, but it does not automatically keep other devices up to date.
                    </p>
                    <p>
                        Use Sync between devices if you use TaskTime Pro on both your phone and computer.
                    </p>
                </div>
            </Modal>

            {/* Wipe & Disconnect Confirmation Modal */}
            <Modal
                isOpen={confirmDialog === 'wipe'}
                onClose={() => !isProcessing && setConfirmDialog(null)}
                title="Wipe cloud data & disconnect?"
                size="md"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(null)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmWipeAndDisconnect}
                            disabled={isProcessing || wipeConfirmText.trim().toLowerCase() !== 'wipe data'}
                            loading={isProcessing}
                            loadingText="Wiping..."
                        >
                            Wipe & disconnect
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <Notice
                        title="Cloud data will be wiped"
                        icon={ExclamationTriangleIcon}
                        variant="warning"
                    >
                        <p>
                            Deletes all TaskTime sync files and backups from {providerName}, revokes access, and disconnects this browser. Local data remains on this device.
                        </p>
                        {provider === 'dropbox' && (
                            <p className="mt-2">
                                Dropbox may retain deleted files temporarily for recovery.
                            </p>
                        )}
                    </Notice>
                    <div>
                        <Label htmlFor="wipe-cloud-confirm" className="text-sm font-medium">
                            Type <span className="font-semibold">wipe data</span> to confirm
                        </Label>
                        <Input
                            id="wipe-cloud-confirm"
                            value={wipeConfirmText}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setWipeConfirmText(event.target.value)}
                            placeholder="wipe data"
                            className="mt-2"
                        />
                    </div>
                </div>
            </Modal>

        </div>
    );
}
