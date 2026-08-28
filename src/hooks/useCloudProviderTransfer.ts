import { useCallback, useEffect, useState } from 'react';

import { useYjs } from '@/contexts/YjsContext';
import { useCloudStorageLifecycle } from '@/hooks/useCloudStorageLifecycle';
import { useDropboxAuth } from '@/hooks/useDropboxAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { SYNC_WORKER_CONFIG } from '@/config/google';
import {
    CloudManifestManager,
    CloudProviderTransferCoordinator,
    DropboxFileStore,
    GoogleDriveFileStore,
    type CloudProviderId,
} from '@/stores/yjs';
import {
    dropboxAccessTokenProvider,
} from '@/stores/yjs/providers/DropboxAccessTokenProvider';
import {
    driveAccessTokenProvider,
} from '@/stores/yjs/providers/DriveAccessTokenProvider';
import { getCloudStorageLifecycle } from '@/stores/yjs/cloudStorageLifecycle';
import {
    readCloudTransferJournal,
    type CloudTransferStage,
} from '@/stores/yjs/cloudTransferJournal';

export type CloudProviderTransferStatus =
    | 'idle'
    | 'authorizing'
    | 'transferring'
    | 'complete'
    | 'error';

interface CloudProviderTransferState {
    status: CloudProviderTransferStatus;
    stage: CloudTransferStage | null;
    targetProvider: CloudProviderId | null;
    error: string | null;
    canResume: boolean;
}

const INITIAL_STATE: CloudProviderTransferState = {
    status: 'idle',
    stage: null,
    targetProvider: null,
    error: null,
    canResume: false,
};

function providerLabel(provider: CloudProviderId): string {
    return provider === 'dropbox' ? 'Dropbox' : 'Google Drive';
}

function transferErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'The provider transfer stopped safely. Your source provider remains unchanged.';
}

async function linkHostedServiceIdentity(
    sourceSessionId: string,
    targetSessionId: string,
): Promise<void> {
    if (!SYNC_WORKER_CONFIG.isEnabled) {
        throw new Error(
            'Hosted-service transfer is unavailable. Your source provider remains active.',
        );
    }

    let response: Response;
    try {
        response = await fetch(SYNC_WORKER_CONFIG.endpoints.hostedIdentityTransfer, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-Session-Id': sourceSessionId,
                'X-Target-Session-Id': targetSessionId,
            },
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
    } catch {
        throw new Error(
            'Hosted-service transfer could not be reached. Your source provider remains active.',
        );
    }

    if (!response.ok) {
        throw new Error(
            'Hosted-service transfer could not be completed. Your source provider remains active.',
        );
    }
}

export function useCloudProviderTransfer() {
    const { store, activeStorageProvider, isCloudConnected } = useYjs();
    const googleAuth = useGoogleAuth();
    const {
        signIn: signInDropbox,
        disconnect: disconnectDropbox,
        assertTransferEnabled: assertDropboxTransferEnabled,
    } = useDropboxAuth();
    const lifecycle = useCloudStorageLifecycle();
    const [state, setState] = useState<CloudProviderTransferState>(INITIAL_STATE);

    const refreshRecoveryState = useCallback(async () => {
        const [journal, currentLifecycle] = await Promise.all([
            readCloudTransferJournal(),
            getCloudStorageLifecycle(),
        ]);
        const stagedTarget = currentLifecycle.stagedTarget;
        setState(current => ({
            ...current,
            stage: journal?.stage ?? (current.status === 'complete' ? current.stage : null),
            targetProvider: journal?.targetProvider ?? stagedTarget?.provider ?? (
                current.status === 'complete' ? current.targetProvider : null
            ),
            canResume: Boolean(journal || stagedTarget),
        }));
        return journal;
    }, []);

    useEffect(() => {
        void refreshRecoveryState().catch(() => {
            setState(current => ({
                ...current,
                status: 'error',
                error: 'The saved provider transfer state could not be read. Cloud sync remains unchanged.',
            }));
        });
    }, [refreshRecoveryState]);

    const createTargetManifest = useCallback(async (
        targetProvider: CloudProviderId,
        targetSessionId: string,
    ): Promise<CloudManifestManager> => {
        if (targetProvider === 'dropbox') {
            dropboxAccessTokenProvider.setSession(targetSessionId);
            return new CloudManifestManager({
                fileStore: new DropboxFileStore({
                    tokenProvider: dropboxAccessTokenProvider,
                }),
            });
        }

        const googleSession = await googleAuth.getValidatedDriveStorageSession();
        if (googleSession.sessionId !== targetSessionId) {
            throw new Error('The staged Google Drive account changed. Restart the transfer.');
        }
        return new CloudManifestManager({
            fileStore: new GoogleDriveFileStore({
                transport: 'direct',
                sessionId: targetSessionId,
                tokenProvider: driveAccessTokenProvider,
            }),
        });
    }, [googleAuth]);

    const runStagedTransfer = useCallback(async (ownerId: string): Promise<void> => {
        const currentLifecycle = await getCloudStorageLifecycle();
        const source = currentLifecycle.active;
        const target = currentLifecycle.stagedTarget;
        if (!source || !target || target.ownerId !== ownerId) {
            throw new Error('The staged provider transfer changed. Start again from Cloud Sync settings.');
        }
        if (!store.isCloudConnected()
            || store.getActiveCloudProviderId() !== source.provider
            || store.getActiveCloudStorageScope().generation !== source.generation) {
            throw new Error(`Reconnect ${providerLabel(source.provider)} before continuing the transfer.`);
        }
        const dropboxSessionId = source.provider === 'dropbox'
            ? source.sessionId
            : target.sessionId;
        await assertDropboxTransferEnabled(dropboxSessionId);
        const sourceManifest = store.getActiveCloudManifest();
        if (!sourceManifest) {
            throw new Error(`Reconnect ${providerLabel(source.provider)} before continuing the transfer.`);
        }
        const targetManifest = await createTargetManifest(
            target.provider,
            target.sessionId,
        );
        const coordinator = new CloudProviderTransferCoordinator(store);
        setState(current => ({
            ...current,
            status: 'transferring',
            targetProvider: target.provider,
            error: null,
            canResume: true,
        }));
        await coordinator.run({
            ownerId,
            sourceManifest,
            targetManifest,
            linkHostedServiceIdentity: async ({ source: sourceRef, target: targetRef }) => {
                await linkHostedServiceIdentity(sourceRef.sessionId, targetRef.sessionId);
            },
            clearSourceSession: async () => {
                if (source.provider === 'dropbox') {
                    await disconnectDropbox();
                } else {
                    await googleAuth.signOut();
                }
            },
            onStage: stage => setState(current => ({ ...current, stage })),
        });
        await lifecycle.refresh();
        setState({
            status: 'complete',
            stage: 'finalizing',
            targetProvider: target.provider,
            error: null,
            canResume: false,
        });
    }, [assertDropboxTransferEnabled, createTargetManifest, disconnectDropbox, googleAuth, lifecycle, store]);

    const startTransfer = useCallback(async (targetProvider: CloudProviderId): Promise<void> => {
        if (!activeStorageProvider || !isCloudConnected) {
            throw new Error('Connect and finish syncing the current provider before transferring.');
        }
        if (targetProvider === activeStorageProvider) {
            throw new Error(`${providerLabel(targetProvider)} is already the active provider.`);
        }
        if (await readCloudTransferJournal()) {
            throw new Error('Resume the saved provider transfer before starting another one.');
        }
        const currentLifecycle = await getCloudStorageLifecycle();
        if (currentLifecycle.stagedTarget) {
            throw new Error('Resume the staged provider transfer before starting another one.');
        }

        const ownerId = crypto.randomUUID();
        setState({
            status: 'authorizing',
            stage: null,
            targetProvider,
            error: null,
            canResume: false,
        });
        try {
            if (targetProvider === 'dropbox') {
                await signInDropbox({ transferOwnerId: ownerId });
            } else {
                if (!googleAuth.isSignedIn) await googleAuth.signIn();
                const googleSession = await googleAuth.getValidatedDriveStorageSession();
                await lifecycle.stage('google-drive', googleSession.sessionId, ownerId);
            }
            await runStagedTransfer(ownerId);
        } catch (error) {
            const [journal, currentLifecycle] = await Promise.all([
                readCloudTransferJournal().catch(() => null),
                getCloudStorageLifecycle().catch(() => null),
            ]);
            setState({
                status: 'error',
                stage: journal?.stage ?? null,
                targetProvider,
                error: transferErrorMessage(error),
                canResume: Boolean(journal || currentLifecycle?.stagedTarget),
            });
            throw error;
        }
    }, [
        activeStorageProvider,
        googleAuth,
        isCloudConnected,
        lifecycle,
        runStagedTransfer,
        signInDropbox,
    ]);

    const resumeTransfer = useCallback(async (): Promise<void> => {
        const [journal, currentLifecycle] = await Promise.all([
            readCloudTransferJournal(),
            getCloudStorageLifecycle(),
        ]);
        const stagedTarget = currentLifecycle.stagedTarget;
        if (!journal && !stagedTarget) {
            setState(INITIAL_STATE);
            throw new Error('There is no saved provider transfer to resume.');
        }
        const ownerId = journal?.ownerId ?? stagedTarget?.ownerId;
        if (!ownerId) {
            setState(INITIAL_STATE);
            throw new Error('There is no saved provider transfer to resume.');
        }
        try {
            await runStagedTransfer(ownerId);
        } catch (error) {
            setState(current => ({
                ...current,
                status: 'error',
                stage: journal?.stage ?? null,
                targetProvider: journal?.targetProvider ?? stagedTarget?.provider ?? null,
                error: transferErrorMessage(error),
                canResume: true,
            }));
            throw error;
        }
    }, [runStagedTransfer]);

    return {
        ...state,
        isTransferInProgress: state.status === 'authorizing' || state.status === 'transferring',
        startTransfer,
        resumeTransfer,
        refreshRecoveryState,
    };
}
