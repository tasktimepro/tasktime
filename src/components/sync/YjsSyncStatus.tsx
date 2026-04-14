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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getYjsSyncStatusDescriptor } from '@/components/sync/syncStatusDescriptor';

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
        await forceSyncDrive();
    }, [forceSyncDrive]);

    const status = useMemo(() => {
        return getYjsSyncStatusDescriptor({
            isReady,
            authLoading,
            isOffline,
            isDriveConnected,
            isConnecting,
            hadPreviousSession,
            syncState,
            syncPhase,
            lastSyncedAt,
            manualSyncInProgress,
            pendingSyncChanges,
            autoSyncEnabled,
            isSyncing,
            hasSynced,
            onConnect: handleConnect,
            onCloudOptions: handleCloudOptions,
            onManualSync: handleManualSync,
        });
    }, [
        authLoading,
        autoSyncEnabled,
        hadPreviousSession,
        handleCloudOptions,
        handleConnect,
        handleManualSync,
        hasSynced,
        isConnecting,
        isDriveConnected,
        isOffline,
        isReady,
        isSyncing,
        lastSyncedAt,
        manualSyncInProgress,
        pendingSyncChanges,
        syncPhase,
        syncState,
    ]);

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
