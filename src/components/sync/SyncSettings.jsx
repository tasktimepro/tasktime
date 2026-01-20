import { useEffect, useMemo, useState } from 'react';
import { useSync } from '@/hooks/useSync.ts';
import { ArrowPathIcon, CheckIcon, CloudIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

const SyncSettings = () => {

    const [now, setNow] = useState(Date.now());

    const {
        isEnabled,
        isSignedIn,
        isLoading,
        state,
        user,
        lastSyncedAt,
        error,
        enableSync,
        disableSync,
        forceSync
    } = useSync();

    useEffect(() => {

        if (!isEnabled || !lastSyncedAt) {
            return undefined;
        }

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [isEnabled, lastSyncedAt]);

    const status = useMemo(() => {
        if (!isEnabled) {
            return {
                text: 'Not connected',
                tone: 'text-muted-foreground',
                icon: CloudIcon
            };
        }

        if (isLoading) {
            return {
                text: 'Connecting...',
                tone: 'text-muted-foreground',
                icon: ArrowPathIcon,
                spinning: true
            };
        }

        if (state === 'error') {
            return {
                text: 'Sync error',
                tone: 'text-red-700 dark:text-red-300',
                icon: ExclamationTriangleIcon
            };
        }

        if (state !== 'idle') {
            return {
                text: 'Syncing...',
                tone: 'text-blue-600 dark:text-blue-300',
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
    }, [isEnabled, isLoading, state, lastSyncedAt, now]);

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
                            {isEnabled ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={forceSync}
                                        disabled={state !== 'idle'}
                                        leadingIcon={ArrowPathIcon}
                                    >
                                        Sync Now
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={disableSync}
                                    >
                                        Disconnect
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={enableSync} leadingIcon={CloudIcon}>
                                    Connect Google Drive
                                </Button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-300">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SyncSettings;
