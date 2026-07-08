/**
 * Sync status display rules.
 *
 * Sync contract source of truth: ./README.md
 */

import {
    CloudBackupIcon,
    CloudCheckIcon,
    CloudCogIcon,
    CloudIcon,
    CloudOffIcon,
    CloudSyncIcon,
    ExclamationTriangleIcon,
} from '@/components/ui/icons';

export const SYNC_STATUS_KIND = {
    LOADING: 'loading',
    OFFLINE: 'offline',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    ERROR: 'error',
    CHECKING: 'checking',
    DOWNLOADING: 'downloading',
    UPLOADING: 'uploading',
    SYNCING: 'syncing',
    PENDING: 'pending',
    SYNCED: 'synced',
};

export function getYjsSyncStatusDescriptor({
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
    autoSyncMode,
    isSyncing,
    hasSynced,
    onConnect,
    onCloudOptions,
    onManualSync,
}) {
    const isManualMode = !autoSyncEnabled;

    if (!isReady || (authLoading && !isDriveConnected && !isConnecting)) {
        return {
            kind: SYNC_STATUS_KIND.LOADING,
            text: 'Loading...',
            icon: CloudSyncIcon,
            tone: 'text-muted-foreground',
        };
    }

    if (isOffline) {
        return {
            kind: SYNC_STATUS_KIND.OFFLINE,
            text: 'Currently offline',
            icon: CloudOffIcon,
            tone: 'status-warning-text-strong',
        };
    }

    if (!isDriveConnected && !isConnecting) {
        return {
            kind: SYNC_STATUS_KIND.DISCONNECTED,
            text: hadPreviousSession ? 'Reconnect to Drive' : 'Connect Google Drive',
            icon: CloudIcon,
            tone: 'text-muted-foreground',
            onClick: onConnect,
        };
    }

    if (isConnecting || !isDriveConnected) {
        if (isManualMode) {
            return {
                kind: SYNC_STATUS_KIND.LOADING,
                text: 'Loading...',
                icon: CloudSyncIcon,
                tone: 'text-muted-foreground',
            };
        }

        return {
            kind: SYNC_STATUS_KIND.CONNECTING,
            text: 'Syncing...',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
        };
    }

    if (syncState === 'error') {
        if (autoSyncEnabled && autoSyncMode === 'backup' && pendingSyncChanges) {
            return {
                kind: SYNC_STATUS_KIND.ERROR,
                text: 'Sync Now needed',
                icon: ExclamationTriangleIcon,
                tone: 'status-warning-text-strong',
                onClick: onManualSync,
            };
        }

        let errorText = 'Sync Error';

        if (lastSyncedAt) {
            const minutesAgo = Math.round((Date.now() - lastSyncedAt) / 60_000);

            if (minutesAgo < 1) {
                errorText = 'Sync error - synced just now';
            } else if (minutesAgo < 60) {
                errorText = `Sync error - ${minutesAgo}m ago`;
            } else {
                const hoursAgo = Math.round(minutesAgo / 60);
                errorText = `Sync error - ${hoursAgo}h ago`;
            }
        }

        return {
            kind: SYNC_STATUS_KIND.ERROR,
            text: errorText,
            icon: ExclamationTriangleIcon,
            tone: 'status-danger-text-strong',
            onClick: onCloudOptions,
            hoverIcon: CloudCogIcon,
            hoverText: 'Cloud Options',
        };
    }

    if (syncPhase === 'checking') {
        return {
            kind: SYNC_STATUS_KIND.CHECKING,
            text: 'Checking for updates...',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
            onClick: onCloudOptions,
        };
    }

    if (syncPhase === 'downloading') {
        return {
            kind: SYNC_STATUS_KIND.DOWNLOADING,
            text: 'Fetching updates...',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
            onClick: onCloudOptions,
        };
    }

    if (syncPhase === 'uploading') {
        return {
            kind: SYNC_STATUS_KIND.UPLOADING,
            text: 'Syncing changes...',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
            onClick: onCloudOptions,
        };
    }

    const showSyncingText = manualSyncInProgress || (isSyncing && !hasSynced);

    if (showSyncingText) {
        return {
            kind: SYNC_STATUS_KIND.SYNCING,
            text: 'Syncing...',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
            onClick: onCloudOptions,
        };
    }

    if (isManualMode && pendingSyncChanges) {
        return {
            kind: SYNC_STATUS_KIND.PENDING,
            text: 'Sync changes',
            icon: CloudBackupIcon,
            tone: 'status-warning-text-strong',
            onClick: onManualSync,
        };
    }

    if (isManualMode) {
        return {
            kind: SYNC_STATUS_KIND.SYNCED,
            text: 'In sync',
            icon: CloudCheckIcon,
            tone: 'status-success-text-strong',
            onClick: onCloudOptions,
            hoverIcon: CloudCogIcon,
            hoverText: 'Cloud Options',
        };
    }

    if (isSyncing) {
        return {
            kind: SYNC_STATUS_KIND.SYNCING,
            text: 'In sync',
            icon: CloudSyncIcon,
            tone: 'status-warning-text-strong',
            onClick: onCloudOptions,
        };
    }

    return {
        kind: SYNC_STATUS_KIND.SYNCED,
        text: 'In sync',
        icon: CloudCheckIcon,
        tone: 'status-success-text-strong',
        onClick: onCloudOptions,
        hoverIcon: CloudCogIcon,
        hoverText: 'Cloud Options',
    };
}
