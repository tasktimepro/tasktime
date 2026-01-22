/**
 * YjsSyncSettings - Sync settings component for Yjs-based sync
 * 
 * Shows connection status and allows managing Google Drive sync
 */

import { useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useToast } from '@/hooks/useToast';
import { ArrowPathIcon, CheckIcon, CloudIcon, ExclamationTriangleIcon, MoreHorizontalIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';
import { formatDistanceToNow } from 'date-fns';

type ConfirmDialogType = 'disconnect' | 'deleteLocal' | null;

export default function YjsSyncSettings() {

    const [now, setNow] = useState(Date.now());
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const { isReady, isSyncing, syncState, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, lastSyncedAt, forceSyncDrive, disconnectDrive, clearAllData } = useYjs();
    const { isSignedIn, isLoading: authLoading, user, signIn, signOut } = useGoogleAuth();
    const { showSuccess, showError } = useToast();

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

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        if (showSyncingText) {
            return {
                text: 'Syncing...',
                tone: 'text-green-700 dark:text-green-300',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (isSyncing) {
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
    }, [isReady, authLoading, isDriveConnected, isConnecting, syncState, isSyncing, hasSynced, manualSyncInProgress, lastSyncedAt, now]);

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

    /**
     * Sync & Disconnect - syncs first, then disconnects.
     * Same as handleDisconnect but triggered from dropdown.
     */
    const handleSyncAndDisconnect = () => {
        setConfirmDialog('disconnect');
    };

    /**
     * Disconnect & Delete Local - syncs first, then deletes local data.
     * This is the DESTRUCTIVE option.
     */
    const handleDisconnectAndDeleteLocal = () => {
        setConfirmDialog('deleteLocal');
    };

    const confirmDeleteLocal = async () => {
        setIsProcessing(true);
        try {
            // MUST sync before deleting to ensure Drive has latest data
            await forceSyncDrive();
            showSuccess('Synced successfully');
            
            // Now safe to disconnect and delete local data
            disconnectDrive();
            await signOut();
            await clearAllData();
            showSuccess('Disconnected and local data deleted');
            
            // Reload to reinitialize
            window.location.reload();
        } catch (error) {
            console.error('[YjsSyncSettings] Sync failed before delete:', error);
            showError('Sync failed. Cannot delete local data until sync succeeds.');
            // DO NOT delete if sync failed - data would be lost forever
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

    const StatusIcon = status.icon;

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Cloud Sync</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Connect Google Drive to sync your data across devices automatically.
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
                            {isSignedIn ? (
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
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                title="More actions"
                                                aria-label="More actions"
                                            >
                                                <MoreHorizontalIcon className="h-5 w-5 group-hover:text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={handleSyncAndDisconnect}
                                                className="cursor-pointer hover:bg-accent focus:bg-accent"
                                            >
                                                <ArrowPathIcon className="h-4 w-4" />
                                                <span>Sync & Disconnect</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={handleDisconnectAndDeleteLocal}
                                                className="cursor-pointer hover:bg-accent focus:bg-accent hover:text-red-600 dark:hover:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Disconnect & Delete Local Data</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            ) : (
                                <Button onClick={handleConnect} leadingIcon={CloudIcon}>
                                    Connect Google Drive
                                </Button>
                            )}
                        </div>
                    </div>
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

            {/* Delete Local Data Confirmation Modal */}
            <Modal
                isOpen={confirmDialog === 'deleteLocal'}
                onClose={() => !isProcessing && setConfirmDialog(null)}
                title="Delete Local Data?"
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
                            onClick={confirmDeleteLocal}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Syncing...' : 'Delete Local Data'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Your data will be synced to Google Drive first, then all local data will be permanently deleted from this device.
                    </p>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        ⚠️ If the sync fails, no data will be deleted to prevent data loss.
                    </p>
                </div>
            </Modal>
        </div>
    );
}
