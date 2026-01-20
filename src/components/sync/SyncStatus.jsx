import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSync } from '@/hooks/useSync.ts';
import { useUrlState } from '@/hooks/useUrlState.ts';
import { CloudIcon, CloudSyncIcon, CloudCheckIcon, CloudCogIcon, ExclamationTriangleIcon, WifiOffIcon } from '@/components/ui/icons';

const SyncStatus = ({ className = '' }) => {

    const { isEnabled, isLoading, state, enableSync } = useSync();
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
            await enableSync();
        } catch {
            // Error handled in useGoogleAuth
        }
    }, [enableSync]);

    const handleCloudOptions = useCallback(() => {

        navigateToAccount({ section: 'sync' });
    }, [navigateToAccount]);

    const isSyncing = state === 'pushing' || state === 'pulling' || state === 'checking' || state === 'merging';

    const status = useMemo(() => {
        // Connecting / Initializing - Check this first to avoid "Connect" flash
        if (isLoading) {
            return {
                text: 'Syncing...',
                icon: CloudSyncIcon,
                tone: 'text-muted-foreground',
            };
        }

        // Not connected
        if (!isEnabled) {
            return {
                text: 'Connect Google Drive',
                icon: CloudIcon,
                tone: 'text-muted-foreground',
                onClick: handleConnect,
            };
        }

        // Offline
        if (isOffline) {
            return {
                text: 'Offline',
                icon: WifiOffIcon,
                tone: 'text-yellow-700 dark:text-yellow-200',
            };
        }

        // Actively syncing
        if (isSyncing) {
            return {
                text: 'Connected',
                icon: CloudSyncIcon,
                tone: 'text-green-700 dark:text-green-300',
                onClick: handleCloudOptions,
                hoverIcon: CloudCogIcon,
                hoverText: 'Cloud options',
                hoverTone: 'text-blue-600 dark:text-blue-300',
            };
        }

        // Error state
        if (state === 'error') {
            return {
                text: 'Sync error',
                icon: ExclamationTriangleIcon,
                tone: 'text-red-700 dark:text-red-300',
                onClick: handleCloudOptions,
                hoverText: 'Cloud options',
                hoverIcon: CloudCogIcon,
                hoverTone: 'text-blue-600 dark:text-blue-300',
            };
            }

            // Connected / idle
            return {
                text: 'Connected',
                icon: CloudCheckIcon,
                tone: 'text-green-700 dark:text-green-300',
                onClick: handleCloudOptions,
                hoverText: 'Cloud options',
                hoverIcon: CloudCogIcon,
                hoverTone: 'text-blue-600 dark:text-blue-300',
            };
        }, [isEnabled, isLoading, isOffline, isSyncing, state, handleConnect, handleCloudOptions]);

    // Determine which icon/text to show based on hover state
    const displayIcon = (isHovered && status.hoverIcon) ? status.hoverIcon : status.icon;
    const displayText = (isHovered && status.hoverText) ? status.hoverText : status.text;
    const displayTone = (isHovered && status.hoverTone) ? status.hoverTone : status.tone;
    const isClickable = Boolean(status.onClick);

    return (
        <button
            type="button"
            onClick={() => status.onClick?.()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-disabled={!isClickable}
            className={`group w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isClickable ? 'cursor-pointer hover:bg-accent' : 'cursor-not-allowed opacity-60'} ${className}`}
        >
            {(() => {
                const Icon = displayIcon;
                return (
                    <Icon className={`h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-150 ${displayTone} ${status.spinning ? 'animate-spin' : ''}`} />
                );
            })()}
            <span className={`transition-colors duration-150 ${displayTone}`}>{displayText}</span>
        </button>
    );
};

export default SyncStatus;
