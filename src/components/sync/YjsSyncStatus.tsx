/**
 * YjsSyncStatus - Sync status indicator for Yjs-based sync
 *
 * Sync contract source of truth: ./README.md
 * 
 * Shows the active cloud provider connection and sync state
 */

import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { isDropboxCloudUiEnabled } from '@/config/cloudProviders';
import { useDropboxAuth } from '@/hooks/useDropboxAuth';
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

const TooltipContentComponent = TooltipContent as unknown as ComponentType<{
    children?: ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
}>;

export default function YjsSyncStatus({ className = '', isCompact = false, onActionComplete }: YjsSyncStatusProps) {

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
        pendingSyncChanges,
        forceSyncCloud,
        autoSyncEnabled,
        autoSyncMode,
        lastSyncedAt,
    } = useYjs();
    const { signIn, isLoading: authLoading, hadPreviousSession } = useGoogleAuth();
    const {
        signIn: signInDropbox,
        isLoading: dropboxAuthLoading,
        sessionId: dropboxSessionId,
    } = useDropboxAuth();
    const { showError } = useToast();
    const { navigateToAccount } = useUrlState();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isHovered, setIsHovered] = useState(false);
    const cloudConnected = isCloudConnected ?? isDriveConnected;
    const provider = activeStorageProvider ?? (isDriveConnected ? 'google-drive' : null);
    const providerName = provider === 'dropbox'
        ? 'Dropbox'
        : (provider === 'google-drive' || !isDropboxCloudUiEnabled()
            ? 'Google Drive'
            : 'cloud storage');
    const movedTargetName = movedToStorageProvider === 'dropbox'
        ? 'Dropbox'
        : movedToStorageProvider === 'google-drive'
            ? 'Google Drive'
            : null;

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

    const handleCloudOptions = useCallback(() => {
        navigateToAccount({ section: 'sync' });
    }, [navigateToAccount]);

    const handleConnect = useCallback(async () => {
        if (!provider && isDropboxCloudUiEnabled()) {
            handleCloudOptions();
            return;
        }
        if (provider === 'dropbox') await signInDropbox();
        else await signIn();
    }, [handleCloudOptions, provider, signIn, signInDropbox]);

    const handleManualSync = useCallback(async () => {
        await forceSyncCloud();
    }, [forceSyncCloud]);

    const status = useMemo(() => {
        return getYjsSyncStatusDescriptor({
            isReady,
            authLoading: authLoading || dropboxAuthLoading,
            isOffline,
            isDriveConnected: cloudConnected,
            isConnecting,
            hadPreviousSession: provider === 'dropbox'
                ? Boolean(dropboxSessionId)
                : hadPreviousSession,
            providerName,
            movedToProviderName: movedTargetName,
            syncState,
            syncPhase,
            lastSyncedAt,
            manualSyncInProgress,
            pendingSyncChanges,
            autoSyncEnabled,
            autoSyncMode,
            isSyncing,
            hasSynced,
            onConnect: handleConnect,
            onCloudOptions: handleCloudOptions,
            onManualSync: handleManualSync,
        });
    }, [
        authLoading,
        dropboxAuthLoading,
        autoSyncEnabled,
        autoSyncMode,
        hadPreviousSession,
        handleCloudOptions,
        handleConnect,
        handleManualSync,
        hasSynced,
        isConnecting,
        cloudConnected,
        isOffline,
        isReady,
        isSyncing,
        lastSyncedAt,
        manualSyncInProgress,
        movedTargetName,
        pendingSyncChanges,
        provider,
        providerName,
        dropboxSessionId,
        syncPhase,
        syncState,
    ]);

    useEffect(() => {
        setIsHovered(false);
    }, [status.kind]);

    const IconComponent = (isHovered && status.hoverIcon) ? status.hoverIcon : status.icon;
    const displayText = (isHovered && status.hoverText) ? status.hoverText : status.text;

    const handleStatusClick = async (event: MouseEvent<HTMLButtonElement>) => {
        if (!status.onClick) {
            return;
        }

        event.currentTarget.blur();
        setIsHovered(false);

        try {
            await status.onClick();
            onActionComplete?.();
        } catch (error) {
            if (store.isCloudConnected()) {
                onActionComplete?.();
                return;
            }

            console.error('[YjsSyncStatus] Status action failed:', error);
            showError(error instanceof Error ? error.message : `${providerName} action failed.`);
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
            <TooltipContentComponent side="right" align="center">
                {displayText}
            </TooltipContentComponent>
        </Tooltip>
    );
}
