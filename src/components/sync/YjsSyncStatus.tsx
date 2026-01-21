/**
 * YjsSyncStatus - Sync status indicator for Yjs-based sync
 * 
 * Shows connection status to Google Drive and sync state
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useUrlState } from '@/hooks/useUrlState';
import { CloudIcon, CloudSyncIcon, CloudCheckIcon, CloudCogIcon, ExclamationTriangleIcon, WifiOffIcon } from '@/components/ui/icons';

interface YjsSyncStatusProps {
    className?: string;
}

export default function YjsSyncStatus({ className = '' }: YjsSyncStatusProps) {

    const { isReady, isSyncing, syncState, isDriveConnected, isConnecting, hasSynced, manualSyncInProgress } = useYjs();
    const { isSignedIn, signIn, isLoading: authLoading } = useGoogleAuth();
    const { navigateToAccount } = useUrlState();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isHovered, setIsHovered] = useState(false);

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

    const status = useMemo(() => {
        // Loading state (store not ready or auth loading)
        if (!isReady || authLoading) {
            return {
                text: 'Loading...',
                icon: CloudSyncIcon,
                tone: 'text-muted-foreground',
            };
        }

        // Not connected (or signed out) - show connect button
        if (!isDriveConnected && !isConnecting) {
            return {
                text: 'Connect Google Drive',
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
                tone: 'text-green-700 dark:text-green-300',
            };
        }

        // Offline
        if (isOffline) {
            return {
                text: 'Offline',
                icon: WifiOffIcon,
                tone: 'text-yellow-700 dark:text-yellow-200',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud Options',
            };
        }

        const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

        // Actively syncing (first sync or manual sync)
        if (showSyncingText) {
            return {
                text: 'Syncing...',
                icon: CloudSyncIcon,
                tone: 'text-green-700 dark:text-green-300',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud Options',
            };
        }

        // Actively syncing (auto sync) - icon change only
        if (isSyncing) {
            return {
                text: 'Connected',
                icon: CloudSyncIcon,
                tone: 'text-green-700 dark:text-green-300',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud Options',
            };
        }

        // Error state
        if (syncState === 'error') {
            return {
                text: 'Sync Error',
                icon: ExclamationTriangleIcon,
                tone: 'text-red-600 dark:text-red-400',
                onClick: handleCloudOptions,
            };
        }

        // Connected and synced
        return {
            text: 'Connected',
            icon: CloudCheckIcon,
            tone: 'text-green-700 dark:text-green-300',
            onClick: handleCloudOptions,
            hoverIcon: CloudCogIcon,
            hoverText: 'Cloud Options',
        };
    }, [isReady, authLoading, isDriveConnected, isConnecting, isOffline, isSyncing, hasSynced, manualSyncInProgress, syncState, handleConnect, handleCloudOptions]);

    const IconComponent = (isHovered && status.hoverIcon) ? status.hoverIcon : status.icon;
    const iconSpinClass = (status as { spinning?: boolean }).spinning ? 'animate-spin' : '';
    const displayText = (isHovered && status.hoverText) ? status.hoverText : status.text;

    return (
        <button
            onClick={status.onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={!status.onClick}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${status.onClick ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer' : 'cursor-default'} ${status.tone} ${className}`}
            title={status.text}
        >
            <IconComponent className={`h-5 w-5 mr-3 flex-shrink-0 ${iconSpinClass}`} />
            <span className="truncate">{displayText}</span>
        </button>
    );
}
