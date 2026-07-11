import { useMemo, useRef } from 'react';
import type { AgentCommandContext } from '@/agent/types';
import { useYjs } from '@/contexts/YjsContext';
import { useGoogleAuth } from './useGoogleAuth';

function openAppRoute(path: string): void {
    const url = new URL(path, window.location.origin);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
}

export function useAgentCommandContext(): AgentCommandContext {
    const { store, isReady, driveSessionId, clearAllData, restoreBackupData } = useYjs();
    const { revokeAccess } = useGoogleAuth();
    const idempotencyRef = useRef(new Map<string, unknown>());

    return useMemo(() => ({
        store,
        isReady,
        clearAllData,
        restoreBackupData,
        revokeDriveAccess: revokeAccess,
        idempotency: idempotencyRef.current,
        navigation: {
            openRoute: openAppRoute,
        },
        driveSessionId,
    }), [store, isReady, clearAllData, restoreBackupData, revokeAccess, driveSessionId]);
}
