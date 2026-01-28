/**
 * YjsSyncSettings - Sync settings component for Yjs-based sync
 * 
 * Shows connection status and allows managing Google Drive sync
 */

import { useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { useToast } from '@/hooks/useToast';
import { ArrowPathIcon, CheckIcon, CloudIcon, CloudSyncIcon, CloudDownloadIcon, CloudUploadIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Modal from '@/components/Modal';
import { formatDistanceToNow } from 'date-fns';

type ConfirmDialogType = 'disconnect' | null;

export default function YjsSyncSettings() {

    const [now, setNow] = useState(Date.now());
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const { store, isReady, isSyncing, syncState, syncPhase, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, lastSyncedAt, forceSyncDrive, disconnectDrive } = useYjs();
    const { isSignedIn, isLoading: authLoading, user, signIn, signOut } = useGoogleAuth();
    const { preferences, updatePreferences } = usePreferences();
    const { showSuccess, showError } = useToast();

    const showAuthActions = isReady && !authLoading;

    const autoSyncEnabled = preferences.autoSyncEnabled ?? false;
    const autoSyncMode = preferences.autoSyncMode ?? 'backup';

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

    const status = useMemo(() => {
        if (!isReady || authLoading) {
            return {
                text: 'Loading...',
                tone: 'text-muted-foreground',
                icon: ArrowPathIcon,
                spinning: true
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
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncState === 'error') {
            return {
                text: 'Sync error',
                tone: 'text-red-700 dark:text-red-300',
                icon: ExclamationTriangleIcon
            };
        }

        if (syncPhase === 'checking') {
            return {
                text: 'Checking for updates...',
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncPhase === 'downloading') {
            return {
                text: 'Downloading updates...',
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (syncPhase === 'uploading') {
            return {
                text: 'Syncing changes...',
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        if (showSyncingText || isSyncing) {
            return {
                text: 'Syncing...',
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        return {
            text: lastSyncedAt
                ? `Synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true, includeSeconds: true })}`
                : 'Connected',
            tone: 'text-green-700 dark:text-green-300',
            icon: CheckIcon
        };
    }, [isReady, authLoading, isDriveConnected, isConnecting, syncState, syncPhase, isSyncing, hasSynced, manualSyncInProgress, lastSyncedAt, now]);

    const handleConnect = async () => {
        try {
            await signIn();
        } catch {
            // Error handled in useGoogleAuth
        }
    };

    /**
     * Simple disconnect - syncs first, then disconnects.
     * Does NOT delete local data (user can reconnect later).
     */
    const handleDisconnect = () => {
        setConfirmDialog('disconnect');
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

    const handleForceSync = async () => {
        try {
            await forceSyncDrive();
            showSuccess('Synced successfully');
        } catch (error) {
            console.error('[YjsSyncSettings] Manual sync failed:', error);
            showError('Sync failed. Please try again.');
        }
    };

    const handleAutoSyncToggle = async (checked: boolean | 'indeterminate') => {
        const nextEnabled = checked === true;
        const nextMode = autoSyncMode === 'sync' ? 'sync' : 'backup';

        updatePreferences({ autoSyncEnabled: nextEnabled });
        store.setDriveSyncPreferences(nextEnabled, nextMode);

        if (isDriveConnected) {
            try {
                await forceSyncDrive();
            } catch (error) {
                console.error('[YjsSyncSettings] Sync failed after auto-sync toggle:', error);
                showError('Sync failed. Please try again.');
            }
        }
    };

    const handleAutoSyncModeChange = async (value: string) => {
        const nextMode = value === 'backup' ? 'backup' : 'sync';

        updatePreferences({ autoSyncMode: nextMode });
        store.setDriveSyncPreferences(autoSyncEnabled, nextMode);

        if (isDriveConnected) {
            try {
                await forceSyncDrive();
            } catch (error) {
                console.error('[YjsSyncSettings] Sync failed after auto-sync mode change:', error);
                showError('Sync failed. Please try again.');
            }
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
                <CardHeader>
                    <CardTitle>Google Drive</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <StatusIcon className={`h-5 w-5 ${status.tone} ${status.spinning ? 'animate-spin' : ''}`} />
                            <div>
                                <div className={`text-sm font-medium ${status.tone}`}>{status.text}</div>
                                {isSignedIn && user?.email && (
                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {showAuthActions && (
                                isSignedIn ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            onClick={handleDisconnect}
                                        >
                                            Disconnect
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleForceSync}
                                            disabled={!isDriveConnected || isSyncing}
                                            leadingIcon={ArrowPathIcon}
                                        >
                                            Sync Now
                                        </Button>
                                    </>
                                ) : (
                                    <Button onClick={handleConnect} leadingIcon={CloudIcon}>
                                        Connect Google Drive
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                    {showAuthActions && isSignedIn && (
                        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
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
                                            <SelectItem value="backup">Sync with cloud (backup mode)</SelectItem>
                                            <SelectItem value="sync">Sync between devices (backup + sync)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Backup mode auto-uploads when local changes are detected. Backup + sync also does periodic checks for changes.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

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

        </div>
    );
}
