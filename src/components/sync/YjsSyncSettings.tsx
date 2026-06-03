/**
 * YjsSyncSettings - Sync settings component for Yjs-based sync
 * 
 * Shows connection status and allows managing Google Drive sync
 */

import type { ChangeEvent, ComponentType, MouseEvent } from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { useToast } from '@/hooks/useToast';
import { ArrowPathIcon, CheckIcon, CloudIcon, CloudOffIcon, CloudSyncIcon, CloudDownloadIcon, CloudUploadIcon, ExclamationTriangleIcon, MoreHorizontalIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card as CardPrimitive, CardContent as CardContentPrimitive, CardHeader as CardHeaderPrimitive, CardTitle as CardTitlePrimitive } from '@/components/ui/card';
import { Checkbox as CheckboxPrimitive } from '@/components/ui/checkbox';
import { Input as InputPrimitive } from '@/components/ui/input';
import { Label as LabelPrimitive } from '@/components/ui/label';
import { Select as SelectPrimitive, SelectContent as SelectContentPrimitive, SelectItem as SelectItemPrimitive, SelectTrigger as SelectTriggerPrimitive, SelectValue as SelectValuePrimitive } from '@/components/ui/select';
import { DropdownMenu as DropdownMenuPrimitive, DropdownMenuContent as DropdownMenuContentPrimitive, DropdownMenuItem as DropdownMenuItemPrimitive, DropdownMenuTrigger as DropdownMenuTriggerPrimitive } from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';
import { format, formatDistanceToNow } from 'date-fns';
import type { BackupInfo } from '@/stores/yjs';
import type { AutoSyncMode } from '@/stores/yjs/types';
import { parseIntegerInputWithFallback } from '@/utils/numberInputUtils';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

type ConfirmDialogType = 'disconnect' | 'wipe' | null;
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

    const { store, isReady, isSyncing, syncState, syncPhase, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, lastSyncedAt, pendingSyncChanges, forceSyncDrive, disconnectDrive, wipeDriveData, listBackups, createBackup, downloadBackup } = useYjs();
    const { isSignedIn, isLoading: authLoading, user, signIn, signOut, hadPreviousSession } = useGoogleAuth();
    const { preferences, updatePreferences } = usePreferences();
    const { showSuccess, showError } = useToast();

    const showAuthActions = isReady && !authLoading;
    const showConnectButton = showAuthActions && !isOffline && !isSignedIn && !isDriveConnected && !isConnecting;
    const showConnectedActions = showAuthActions && !isOffline && isSignedIn && isDriveConnected;

    const autoSyncEnabled = preferences.autoSyncEnabled ?? false;
    const autoSyncMode = preferences.autoSyncMode ?? 'sync';
    const backupEnabled = preferences.backupEnabled ?? true;
    const backupFrequencyHours = preferences.backupFrequencyHours ?? 24;
    const isManualMode = !autoSyncEnabled;

    // Update "time ago" display
    useEffect(() => {
        if (!isDriveConnected || !lastSyncedAt) {
            return undefined;
        }

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [isDriveConnected, lastSyncedAt]);

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
        if (!isReady || authLoading) {
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

        if (!isDriveConnected && !isConnecting) {
            return {
                text: 'Not connected',
                tone: 'text-muted-foreground',
                icon: CloudIcon
            };
        }

        if (isConnecting || !isDriveConnected) {
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
                icon: CloudUploadIcon,
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
    }, [isReady, authLoading, isDriveConnected, isConnecting, isOffline, syncState, syncPhase, isSyncing, hasSynced, manualSyncInProgress, lastSyncedAt, now, isManualMode, pendingSyncChanges, autoSyncEnabled, autoSyncMode]);

    const handleConnect = async () => {
        try {
            await signIn();
        } catch (error) {
            console.error('[YjsSyncSettings] Connect failed:', error);
            showError(error instanceof Error ? error.message : 'Google Drive action failed.');
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
        setIsProcessing(true);
        try {
            // Sync before disconnecting to ensure Drive has latest data
            await forceSyncDrive();
            showSuccess('Synced successfully');
            
            // Now safe to disconnect
            disconnectDrive();
            await signOut();
            showSuccess('Disconnected from Google Drive');
        } catch (error) {
            console.error('[YjsSyncSettings] Sync failed before disconnect:', error);
            showError('Sync failed. Please try again before disconnecting.');
            // DO NOT disconnect if sync failed - data could be lost
            return;
        } finally {
            setIsProcessing(false);
            setConfirmDialog(null);
        }
    };

    const confirmWipeAndDisconnect = async () => {
        if (wipeConfirmText.trim().toLowerCase() !== 'wipe drive') {
            showError('Please type "wipe drive" to confirm.');
            return;
        }

        setIsProcessing(true);
        try {
            await wipeDriveData();
            disconnectDrive();
            await signOut();
            showSuccess('Google Drive wiped and disconnected');
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
            await forceSyncDrive();
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
        store.setDriveSyncPreferences(nextEnabled, nextMode);

        if (isDriveConnected) {
            try {
                await forceSyncDrive();
            } catch (error) {
                console.error('[YjsSyncSettings] Sync failed after auto-sync preference change:', error);
                showError('Sync failed. Please try again.');
            }
        }
    }, [forceSyncDrive, isDriveConnected, showError, store, updatePreferences]);

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
        if (!isDriveConnected) return;
        setBackupsLoading(true);
        try {
            const result = await listBackups();
            setBackups(result);
        } catch (error) {
            console.error('[YjsSyncSettings] Failed to load backups:', error);
        } finally {
            setBackupsLoading(false);
        }
    }, [isDriveConnected, listBackups]);

    // Load backups when connected
    useEffect(() => {
        if (isDriveConnected && hasSynced) {
            loadBackups();
        } else {
            setBackups([]);
        }
    }, [isDriveConnected, hasSynced, loadBackups]);

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

    const StatusIcon = status.icon;

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Cloud Sync</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Connect Google Drive to back up your data. Auto-sync between devices is optional.
                </p>
            </div>

            <Card>
                <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                    <CardTitle>Google Drive</CardTitle>
                </CardHeader>
                <CardContent className={cn('space-y-4', isMobileLayout && 'px-3 pb-3 pt-0')}>
                    <div className={cn('flex gap-4', isMobileLayout ? 'flex-col' : 'items-center justify-between')}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <StatusIcon className={`h-5 w-5 flex-shrink-0 ${status.tone} ${status.spinning ? 'animate-spin' : ''}`} />
                                <div className="min-w-0">
                                    <div className={`text-sm font-medium ${status.tone}`}>{status.text}</div>
                                    {isSignedIn && user?.email && (
                                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
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
                                        <DropdownMenuItem
                                            onClick={handleWipeAndDisconnect}
                                            className="status-danger-action flex items-center space-x-2"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            <span>Wipe & Disconnect</span>
                                        </DropdownMenuItem>
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
                                            className={cn(isMobileLayout && 'flex-1')}
                                        >
                                            Disconnect
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleForceSync}
                                            disabled={!isDriveConnected || isSyncing}
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
                                                    <DropdownMenuItem
                                                        onClick={handleWipeAndDisconnect}
                                                        className="status-danger-action flex items-center space-x-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Wipe & Disconnect</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </>
                            ) : showConnectButton ? (
                                <Button
                                    onClick={handleConnect}
                                    leadingIcon={CloudIcon}
                                    title={hadPreviousSession ? 'Reconnect to Drive' : 'Connect Google Drive'}
                                    className={cn(isMobileLayout && 'w-full')}
                                >
                                    Connect Google Drive
                                </Button>
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
                                        When disabled, you control when changes are synced with Drive.
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
                                        Creates snapshots of your data on Google Drive after each sync.
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
                title="Disconnect from Google Drive?"
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
                        >
                            {isProcessing ? 'Syncing...' : 'Sync & Disconnect'}
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Your data will be synced to Google Drive before disconnecting.
                    Your local data will remain on this device.
                </p>
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
                        Device backup is intended for using TaskTime on one device. It uploads this device's changes to Drive, but it does not automatically keep other devices up to date.
                    </p>
                    <p>
                        Use Sync between devices if you use TaskTime on both your phone and computer.
                    </p>
                </div>
            </Modal>

            {/* Wipe & Disconnect Confirmation Modal */}
            <Modal
                isOpen={confirmDialog === 'wipe'}
                onClose={() => !isProcessing && setConfirmDialog(null)}
                title="Wipe Google Drive and disconnect?"
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
                            disabled={isProcessing || wipeConfirmText.trim().toLowerCase() !== 'wipe drive'}
                        >
                            {isProcessing ? 'Wiping...' : 'Wipe & Disconnect'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete all TaskTime files from Google Drive and disconnect this device.
                        Your local data will remain on this device, but we recommend that you <strong>export your data before this action</strong>.
                    </p>
                    <div>
                        <Label htmlFor="wipe-drive-confirm" className="text-sm font-medium">
                            Type <span className="font-semibold">wipe drive</span> to confirm
                        </Label>
                        <Input
                            id="wipe-drive-confirm"
                            value={wipeConfirmText}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setWipeConfirmText(event.target.value)}
                            placeholder="wipe drive"
                            className="mt-2"
                        />
                    </div>
                </div>
            </Modal>

        </div>
    );
}
