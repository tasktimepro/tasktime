/**
 * YjsSyncStatus - Sync status indicator for Yjs-based sync
 * 
 * Shows connection status to Google Drive and sync state
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useUrlState } from '@/hooks/useUrlState';
import { CloudIcon, CloudSyncIcon, CloudCheckIcon, CloudCogIcon, CloudOffIcon, CloudUploadIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface YjsSyncStatusProps {
    className?: string;
    isCompact?: boolean;
}

export default function YjsSyncStatus({ className = '', isCompact = false }: YjsSyncStatusProps) {

    const { isReady, isSyncing, syncState, syncPhase, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress, pendingSyncChanges, forceSyncDrive, autoSyncEnabled } = useYjs();
    const { signIn, isLoading: authLoading, hadPreviousSession } = useGoogleAuth();
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
        try {
            await signIn();
        } catch {
            // Error handled in useGoogleAuth
        }
    }, [signIn]);

    const handleCloudOptions = useCallback(() => {
        navigateToAccount({ section: 'sync' });
    }, [navigateToAccount]);

    const handleManualSync = useCallback(async () => {
        await forceSyncDrive();
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
                tone: 'text-yellow-700 dark:text-yellow-200',
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
                tone: 'text-yellow-700 dark:text-yellow-300',
            };
        }

        // Error state
        if (syncState === 'error') {
            return {
                text: 'Sync Error',
                icon: ExclamationTriangleIcon,
                tone: 'text-red-600 dark:text-red-400',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud Options',
            };
        }

        if (syncPhase === 'checking') {
            return {
                text: 'Checking for updates...',
                icon: CloudSyncIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleCloudOptions,
            };
        }

        if (syncPhase === 'downloading') {
            return {
                text: 'Downloading updates...',
                icon: CloudSyncIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleCloudOptions,
            };
        }

        if (syncPhase === 'uploading') {
            return {
                text: 'Syncing changes...',
                icon: CloudSyncIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleCloudOptions,
            };
        }

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        // Actively syncing (first sync or manual sync)
        if (showSyncingText) {
            return {
                text: 'Syncing...',
                icon: CloudSyncIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleCloudOptions,
            };
        }

        // Manual sync mode with pending changes
        if (isManualMode && hasPendingChanges) {
            return {
                text: 'Sync changes',
                icon: CloudUploadIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleManualSync,
            };
        }

        // Actively syncing (auto sync) - icon change only
        if (isSyncing) {
            return {
                text: 'In sync',
                icon: CloudSyncIcon,
                tone: 'text-yellow-700 dark:text-yellow-300',
                onClick: handleCloudOptions,
            };
        }

        // Connected and synced
        return {
            text: 'In sync',
            icon: CloudCheckIcon,
            tone: 'text-green-700 dark:text-green-300',
            onClick: handleCloudOptions,
            hoverIcon: CloudCogIcon,
            hoverText: 'Cloud Options',
        };
    }, [isReady, authLoading, isDriveConnected, isConnecting, isSyncing, hasSynced, manualSyncInProgress, syncPhase, syncState, isManualMode, hasPendingChanges, hadPreviousSession, handleConnect, handleCloudOptions, handleManualSync]);

    const IconComponent = (isHovered && status.hoverIcon) ? status.hoverIcon : status.icon;
    const displayText = (isHovered && status.hoverText) ? status.hoverText : status.text;

    const handleStatusClick = (event) => {
        if (!status.onClick) {
            return;
        }

        event.currentTarget.blur();
        status.onClick();
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
