/**
 * YjsSyncSettings - Sync settings component for Yjs-based sync
 * 
 * Shows connection status and allows managing Google Drive sync
 */

import { useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { ArrowPathIcon, CheckIcon, CloudIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export default function YjsSyncSettings() {

    const [now, setNow] = useState(Date.now());

    const { isReady, isSyncing, syncState, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, lastSyncedAt, forceSyncDrive, disconnectDrive } = useYjs();
    const { isSignedIn, isLoading: authLoading, user, signIn, signOut } = useGoogleAuth();

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

    const handleDisconnect = async () => {
        try {
            disconnectDrive();
            await signOut();
        } catch {
            // Error handled in useGoogleAuth
        }
    };

    const handleForceSync = async () => {
        try {
            await forceSyncDrive();
        } catch {
            // Error handled internally
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
        </div>
    );
}
