import { useCallback, useEffect, useRef, useState } from 'react';

import {
    CLOUD_STORAGE_LIFECYCLE_EVENT,
    activateStagedCloudStorageSession,
    claimActiveCloudStorageSession,
    clearCloudStorageSession,
    clearStagedCloudStorageSession,
    getCloudStorageLifecycle,
    stageCloudStorageSession,
    type CloudStorageLifecycleState,
    type CloudStorageSessionRef,
} from '@/stores/yjs/cloudStorageLifecycle';
import type { CloudProviderId } from '@/stores/yjs/providers/CloudFileStore';

const INVALIDATION_CHANNEL = 'tasktime-cloud-storage-lifecycle';

function sanitizedLifecycleError(error: unknown): Error {
    if (typeof error === 'object'
        && error !== null
        && (error as { name?: unknown }).name === 'CloudStorageLifecycleError'
        && typeof (error as { message?: unknown }).message === 'string') {
        return new Error((error as { message: string }).message);
    }
    return new Error('Cloud storage state could not be updated.');
}

export function useCloudStorageLifecycle() {
    const [state, setState] = useState<CloudStorageLifecycleState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestGeneration = useRef(0);

    const refresh = useCallback(async (): Promise<CloudStorageLifecycleState> => {
        const generation = ++requestGeneration.current;
        try {
            const current = await getCloudStorageLifecycle();
            if (generation === requestGeneration.current) {
                setState(current);
                setError(null);
                setIsLoading(false);
            }
            return current;
        } catch (caught) {
            const normalized = sanitizedLifecycleError(caught);
            if (generation === requestGeneration.current) {
                setState(null);
                setError(normalized.message);
                setIsLoading(false);
            }
            throw normalized;
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        void refresh().catch(() => {
            // The hook state carries the sanitized fail-closed result.
        });

        const handleInvalidation = () => {
            if (!mounted) return;
            void refresh().catch(() => {
                // The hook state carries the sanitized fail-closed result.
            });
        };
        window.addEventListener(CLOUD_STORAGE_LIFECYCLE_EVENT, handleInvalidation);

        let channel: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                channel = new BroadcastChannel(INVALIDATION_CHANNEL);
                channel.onmessage = handleInvalidation;
            } catch {
                channel = null;
            }
        }

        return () => {
            mounted = false;
            requestGeneration.current += 1;
            window.removeEventListener(CLOUD_STORAGE_LIFECYCLE_EVENT, handleInvalidation);
            channel?.close();
        };
    }, [refresh]);

    const applyMutation = useCallback(async (
        operation: () => Promise<CloudStorageLifecycleState>,
    ): Promise<CloudStorageLifecycleState> => {
        try {
            const current = await operation();
            requestGeneration.current += 1;
            setState(current);
            setError(null);
            setIsLoading(false);
            return current;
        } catch (caught) {
            const normalized = sanitizedLifecycleError(caught);
            setError(normalized.message);
            throw normalized;
        }
    }, []);

    const claimActive = useCallback((provider: CloudProviderId, sessionId: string) => (
        applyMutation(() => claimActiveCloudStorageSession(provider, sessionId))
    ), [applyMutation]);

    const stage = useCallback((provider: CloudProviderId, sessionId: string, ownerId: string) => (
        applyMutation(() => stageCloudStorageSession(provider, sessionId, ownerId))
    ), [applyMutation]);

    const clear = useCallback((session: CloudStorageSessionRef, options?: { force?: boolean }) => (
        applyMutation(() => clearCloudStorageSession(session, options))
    ), [applyMutation]);

    const clearStaged = useCallback((ownerId: string) => (
        applyMutation(() => clearStagedCloudStorageSession(ownerId))
    ), [applyMutation]);

    const activateStaged = useCallback((ownerId: string) => (
        applyMutation(() => activateStagedCloudStorageSession(ownerId))
    ), [applyMutation]);

    return {
        state,
        isLoading,
        error,
        refresh,
        claimActive,
        stage,
        clear,
        clearStaged,
        activateStaged,
    };
}
