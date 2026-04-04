/**
 * YjsSyncStatus - Sync status indicator for Yjs-based sync
 * 
 * Shows connection status to Google Drive and sync state
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { CloudIcon, CloudSyncIcon, CloudCheckIcon, CloudCogIcon, CloudOffIcon, CloudUploadIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface YjsSyncStatusProps {
    className?: string;
    isCompact?: boolean;
    onActionComplete?: () => void;
}

export default function YjsSyncStatus({ className = '', isCompact = false, onActionComplete }: YjsSyncStatusProps) {

    const { isReady, isSyncing, syncState, syncPhase, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, pendingSyncChanges, forceSyncDrive, autoSyncEnabled, lastSyncedAt } = useYjs();
    const { signIn, isLoading: authLoading, hadPreviousSession } = useGoogleAuth();
    const { showError } = useToast();
    const { navigateToAccount } = useUrlState();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const updateOfflineState = () => {
            setIsOffline(!navigator.onLine);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                updateOfflineState();
            }
        };

        updateOfflineState();

        window.addEventListener('online', updateOfflineState);
        window.addEventListener('offline', updateOfflineState);
        window.addEventListener('focus', updateOfflineState);
        document.addEventListener('visibilitychange', handleVisibility);

        const interval = setInterval(updateOfflineState, 5000);

        return () => {
            window.removeEventListener('online', updateOfflineState);
            window.removeEventListener('offline', updateOfflineState);
            window.removeEventListener('focus', updateOfflineState);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, []);

    const handleConnect = useCallback(async () => {
        await signIn();
    }, [signIn]);

    const handleCloudOptions = useCallback(() => {
        navigateToAccount({ section: 'sync' });
    }, [navigateToAccount]);

    const handleManualSync = useCallback(async () => {
        await forceSyncDrive({ allowPull: false });
    }, [forceSyncDrive]);

    // NOTE: Sidebar cloud icon should never spin.

    const isManualMode = !autoSyncEnabled;
    const hasPendingChanges = pendingSyncChanges;

    const status = useMemo(() => {
        // Loading state (store not ready or auth loading)
        if (!isReady || authLoading) {
            return {
                text: 'Loading...',
                icon: CloudSyncIcon,
                tone: 'text-muted-foreground',
            };
        }

        // Offline
        if (isOffline) {
            return {
                text: 'Currently offline',
                icon: CloudOffIcon,
                tone: 'status-warning-text-strong',
            };
        }

        // Not connected (or signed out) - show connect button
        if (!isDriveConnected && !isConnecting) {
            return {
                text: hadPreviousSession ? 'Reconnect to Drive' : 'Connect Google Drive',
                icon: CloudIcon,
                tone: 'text-muted-foreground',
                onClick: handleConnect,
            };
        }

        // Connecting/initial sync in progress
        if (isConnecting || !isDriveConnected) {
            return {
                text: 'Syncing...',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
            };
        }

        // Error state
        if (syncState === 'error') {
            let errorText = 'Sync Error';

            if (lastSyncedAt) {
                const minutesAgo = Math.round((Date.now() - lastSyncedAt) / 60_000);

                if (minutesAgo < 1) {
                    errorText = 'Sync error — synced just now';
                } else if (minutesAgo < 60) {
                    errorText = `Sync error — ${minutesAgo}m ago`;
                } else {
                    const hoursAgo = Math.round(minutesAgo / 60);
                    errorText = `Sync error — ${hoursAgo}h ago`;
                }
            }

            return {
                text: errorText,
                icon: ExclamationTriangleIcon,
                tone: 'status-danger-text-strong',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud Options',
            };
        }

        if (syncPhase === 'checking') {
            return {
                text: 'Checking for updates...',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
                onClick: handleCloudOptions,
            };
        }

        if (syncPhase === 'downloading') {
            return {
                text: 'Fetching updates...',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
                onClick: handleCloudOptions,
            };
        }

        if (syncPhase === 'uploading') {
            return {
                text: 'Syncing changes...',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
                onClick: handleCloudOptions,
            };
        }

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        // Actively syncing (first sync or manual sync)
        if (showSyncingText) {
            return {
                text: 'Syncing...',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
                onClick: handleCloudOptions,
            };
        }

        // Manual sync mode with pending changes
        if (isManualMode && hasPendingChanges) {
            return {
                text: 'Sync changes',
                icon: CloudUploadIcon,
                tone: 'status-warning-text-strong',
                onClick: handleManualSync,
            };
        }

        // Actively syncing (auto sync) - icon change only
        if (isSyncing) {
            return {
                text: 'In sync',
                icon: CloudSyncIcon,
                tone: 'status-warning-text-strong',
                onClick: handleCloudOptions,
            };
        }

        // Connected and synced
        return {
            text: 'In sync',
            icon: CloudCheckIcon,
            tone: 'status-success-text-strong',
            onClick: handleCloudOptions,
            hoverIcon: CloudCogIcon,
            hoverText: 'Cloud Options',
        };
    }, [isReady, authLoading, isDriveConnected, isConnecting, isSyncing, hasSynced, manualSyncInProgress, syncPhase, syncState, isManualMode, hasPendingChanges, hadPreviousSession, lastSyncedAt, isOffline, handleConnect, handleCloudOptions, handleManualSync]);

    const IconComponent = (isHovered && status.hoverIcon) ? status.hoverIcon : status.icon;
    const displayText = (isHovered && status.hoverText) ? status.hoverText : status.text;

    const handleStatusClick = async (event) => {
        if (!status.onClick) {
            return;
        }

        event.currentTarget.blur();

        try {
            await status.onClick();
            onActionComplete?.();
        } catch (error) {
            console.error('[YjsSyncStatus] Status action failed:', error);
            showError(error instanceof Error ? error.message : 'Google Drive action failed.');
        }
    };

    if (isOffline) {
        return null;
    }

    const content = (
        <button
            onClick={status.onClick ? handleStatusClick : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={!status.onClick}
            className={`${isCompact ? 'w-10 mx-auto justify-center px-2 py-2' : 'w-full px-3 py-2'} flex items-center text-sm font-medium rounded-md transition-colors ${status.onClick ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer' : 'cursor-default'} ${status.tone} ${className}`}
            title={isCompact ? undefined : status.text}
            aria-label={isCompact ? displayText : undefined}
        >
            <IconComponent className={`h-5 w-5 ${isCompact ? '' : 'mr-3'} flex-shrink-0`} />
            {!isCompact && (
                <span className="truncate">{displayText}</span>
            )}
        </button>
    );

    if (!isCompact) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {content}
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                {displayText}
            </TooltipContent>
        </Tooltip>
    );
}
