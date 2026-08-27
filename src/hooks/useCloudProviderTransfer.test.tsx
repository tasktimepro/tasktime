import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCloudProviderTransfer } from './useCloudProviderTransfer';

const mocks = vi.hoisted(() => ({
    activeProvider: 'google-drive' as 'google-drive' | 'dropbox',
    cloudConnected: true,
    lifecycleState: null as any,
    journal: null as any,
    sourceManifest: { source: true },
    coordinatorRun: vi.fn(),
    disconnectCloud: vi.fn(),
    getActiveCloudManifest: vi.fn(),
    getActiveCloudProviderId: vi.fn(),
    getActiveCloudStorageScope: vi.fn(),
    isCloudConnected: vi.fn(),
    googleSignIn: vi.fn(),
    googleSignOut: vi.fn(),
    getValidatedGoogleSession: vi.fn(),
    dropboxSignIn: vi.fn(),
    dropboxDisconnect: vi.fn(),
    assertDropboxTransferEnabled: vi.fn(),
    lifecycleRefresh: vi.fn(),
    lifecycleStage: vi.fn(),
    readJournal: vi.fn(),
    getLifecycle: vi.fn(),
    setDropboxSession: vi.fn(),
    setDriveSession: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock('@/config/google', () => ({
    SYNC_WORKER_CONFIG: {
        isEnabled: true,
        endpoints: {
            hostedIdentityTransfer: 'https://sync.tasktime.pro/auth/hosted-identity/transfer',
        },
    },
}));

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: {
            disconnectCloud: mocks.disconnectCloud,
            getActiveCloudManifest: mocks.getActiveCloudManifest,
            getActiveCloudProviderId: mocks.getActiveCloudProviderId,
            getActiveCloudStorageScope: mocks.getActiveCloudStorageScope,
            isCloudConnected: mocks.isCloudConnected,
        },
        activeStorageProvider: mocks.activeProvider,
        isCloudConnected: mocks.cloudConnected,
    }),
}));

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        isSignedIn: false,
        signIn: mocks.googleSignIn,
        signOut: mocks.googleSignOut,
        getValidatedDriveStorageSession: mocks.getValidatedGoogleSession,
    }),
}));

vi.mock('@/hooks/useDropboxAuth', () => ({
    useDropboxAuth: () => ({
        signIn: mocks.dropboxSignIn,
        disconnect: mocks.dropboxDisconnect,
        assertTransferEnabled: mocks.assertDropboxTransferEnabled,
    }),
}));

vi.mock('@/hooks/useCloudStorageLifecycle', () => ({
    useCloudStorageLifecycle: () => ({
        refresh: mocks.lifecycleRefresh,
        stage: mocks.lifecycleStage,
    }),
}));

vi.mock('@/stores/yjs/cloudStorageLifecycle', () => ({
    getCloudStorageLifecycle: mocks.getLifecycle,
}));

vi.mock('@/stores/yjs/cloudTransferJournal', () => ({
    readCloudTransferJournal: mocks.readJournal,
}));

vi.mock('@/stores/yjs/providers/DropboxAccessTokenProvider', () => ({
    dropboxAccessTokenProvider: {
        setSession: mocks.setDropboxSession,
    },
}));

vi.mock('@/stores/yjs/providers/DriveAccessTokenProvider', () => ({
    driveAccessTokenProvider: {
        setSession: mocks.setDriveSession,
    },
}));

vi.mock('@/stores/yjs', () => ({
    CloudManifestManager: class CloudManifestManager {
        constructor(readonly options: unknown) {}
    },
    DropboxFileStore: class DropboxFileStore {
        constructor(readonly options: unknown) {}
    },
    GoogleDriveFileStore: class GoogleDriveFileStore {
        constructor(readonly options: unknown) {}
    },
    CloudProviderTransferCoordinator: class CloudProviderTransferCoordinator {
        constructor(readonly store: unknown) {}
        run(options: unknown) {
            return mocks.coordinatorRun(options);
        }
    },
}));

function lifecycle(
    source: 'google-drive' | 'dropbox',
    target?: 'google-drive' | 'dropbox',
    ownerId = 'transfer-owner-fixture',
) {
    return {
        version: 1,
        revision: target ? 2 : 1,
        active: {
            provider: source,
            sessionId: `${source}-session`,
            generation: 2,
        },
        stagedTarget: target ? {
            provider: target,
            sessionId: `${target}-session`,
            generation: 3,
            ownerId,
            sourceProvider: source,
            sourceGeneration: 2,
        } : null,
        updatedAt: 1,
    };
}

describe('useCloudProviderTransfer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.activeProvider = 'google-drive';
        mocks.cloudConnected = true;
        mocks.lifecycleState = lifecycle('google-drive');
        mocks.journal = null;
        mocks.readJournal.mockImplementation(async () => mocks.journal);
        mocks.getLifecycle.mockImplementation(async () => mocks.lifecycleState);
        mocks.getActiveCloudManifest.mockReturnValue(mocks.sourceManifest);
        mocks.getActiveCloudProviderId.mockImplementation(() => mocks.activeProvider);
        mocks.getActiveCloudStorageScope.mockReturnValue({ generation: 2 });
        mocks.isCloudConnected.mockReturnValue(true);
        mocks.lifecycleRefresh.mockResolvedValue(undefined);
        mocks.assertDropboxTransferEnabled.mockResolvedValue(undefined);
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', mocks.fetch);
        mocks.getValidatedGoogleSession.mockResolvedValue({
            sessionId: 'google-drive-session',
        });
        mocks.coordinatorRun.mockImplementation(async (options: any) => {
            options.onStage?.('target-verified');
            await options.linkHostedServiceIdentity?.({
                source: mocks.lifecycleState.active,
                target: mocks.lifecycleState.stagedTarget,
            });
            await options.clearSourceSession?.();
        });
        mocks.dropboxSignIn.mockImplementation(async ({ transferOwnerId }) => {
            mocks.lifecycleState = lifecycle('google-drive', 'dropbox', transferOwnerId);
            return {
                sessionId: 'dropbox-session',
                storageGeneration: 3,
                storageRole: 'staged',
            };
        });
        mocks.lifecycleStage.mockImplementation(async (provider, sessionId, ownerId) => {
            mocks.lifecycleState = {
                ...lifecycle('dropbox', provider, ownerId),
                stagedTarget: {
                    ...lifecycle('dropbox', provider, ownerId).stagedTarget,
                    sessionId,
                },
            };
            return mocks.lifecycleState;
        });
    });

    it('authorizes Dropbox as a staged target and transfers without replacing the active source first', async () => {
        const { result } = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());

        await act(async () => {
            await result.current.startTransfer('dropbox');
        });

        expect(mocks.dropboxSignIn).toHaveBeenCalledWith({
            transferOwnerId: expect.any(String),
        });
        const ownerId = mocks.dropboxSignIn.mock.calls[0][0].transferOwnerId;
        expect(mocks.coordinatorRun).toHaveBeenCalledWith(expect.objectContaining({
            ownerId,
            sourceManifest: mocks.sourceManifest,
        }));
        expect(mocks.setDropboxSession).toHaveBeenCalledWith('dropbox-session');
        expect(mocks.assertDropboxTransferEnabled).toHaveBeenCalledWith('dropbox-session');
        expect(mocks.fetch).toHaveBeenCalledWith(
            'https://sync.tasktime.pro/auth/hosted-identity/transfer',
            expect.objectContaining({
                method: 'POST',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: expect.objectContaining({
                    'X-Session-Id': 'google-drive-session',
                    'X-Target-Session-Id': 'dropbox-session',
                }),
            }),
        );
        expect(mocks.lifecycleRefresh).toHaveBeenCalledOnce();
        expect(mocks.googleSignOut).toHaveBeenCalledOnce();
        expect(mocks.dropboxDisconnect).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({
            status: 'complete',
            targetProvider: 'dropbox',
            canResume: false,
        });
    });

    it('stages a validated Google storage session and transfers hosted identity with it', async () => {
        mocks.activeProvider = 'dropbox';
        mocks.lifecycleState = lifecycle('dropbox');
        mocks.getActiveCloudProviderId.mockReturnValue('dropbox');

        const { result } = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());

        await act(async () => {
            await result.current.startTransfer('google-drive');
        });

        expect(mocks.googleSignIn).toHaveBeenCalledOnce();
        expect(mocks.getValidatedGoogleSession).toHaveBeenCalled();
        expect(mocks.lifecycleStage).toHaveBeenCalledWith(
            'google-drive',
            'google-drive-session',
            expect.any(String),
        );
        expect(mocks.dropboxSignIn).not.toHaveBeenCalled();
        expect(mocks.assertDropboxTransferEnabled).toHaveBeenCalledWith('dropbox-session');
        expect(mocks.fetch).toHaveBeenCalledWith(
            'https://sync.tasktime.pro/auth/hosted-identity/transfer',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Session-Id': 'dropbox-session',
                    'X-Target-Session-Id': 'google-drive-session',
                }),
            }),
        );
        expect(mocks.dropboxDisconnect).toHaveBeenCalledOnce();
        expect(mocks.googleSignOut).not.toHaveBeenCalled();
        expect(mocks.coordinatorRun).toHaveBeenCalledOnce();
    });

    it('keeps the source active and transfer resumable when hosted identity linking fails', async () => {
        mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
            error: 'Hosted identity service unavailable',
            code: 'IDENTITY_STORE_UNAVAILABLE',
        }), { status: 503 }));
        const { result } = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());

        await act(async () => {
            await expect(result.current.startTransfer('dropbox')).rejects.toThrow(
                /Hosted-service transfer could not be completed/i,
            );
        });

        expect(mocks.lifecycleState.active.provider).toBe('google-drive');
        expect(mocks.lifecycleRefresh).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({
            status: 'error',
            targetProvider: 'dropbox',
            canResume: true,
        });
    });

    it('keeps the source active when the live transfer control is disabled', async () => {
        mocks.activeProvider = 'dropbox';
        mocks.lifecycleState = lifecycle('dropbox');
        mocks.getActiveCloudProviderId.mockReturnValue('dropbox');
        mocks.assertDropboxTransferEnabled.mockRejectedValueOnce(
            new Error('Dropbox transfers are temporarily paused.'),
        );
        const { result } = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());

        await act(async () => {
            await expect(result.current.startTransfer('google-drive')).rejects.toThrow(
                /transfers are temporarily paused/i,
            );
        });

        expect(mocks.coordinatorRun).not.toHaveBeenCalled();
        expect(mocks.lifecycleState.active.provider).toBe('dropbox');
        expect(result.current).toMatchObject({ status: 'error', canResume: true });
    });

    it('offers recovery when the target was staged before the local journal existed', async () => {
        mocks.lifecycleState = lifecycle('google-drive', 'dropbox');
        const { result } = renderHook(() => useCloudProviderTransfer());

        await waitFor(() => expect(result.current).toMatchObject({
            canResume: true,
            targetProvider: 'dropbox',
        }));

        await act(async () => {
            await result.current.resumeTransfer();
        });

        expect(mocks.coordinatorRun).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'transfer-owner-fixture',
        }));
        expect(result.current.status).toBe('complete');
    });

    it('keeps a staged target resumable when coordinator setup stops before journal creation', async () => {
        mocks.coordinatorRun.mockRejectedValueOnce(new Error('temporary target failure'));
        const { result } = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());

        await act(async () => {
            await expect(result.current.startTransfer('dropbox')).rejects.toThrow(
                'temporary target failure',
            );
        });

        expect(result.current).toMatchObject({
            status: 'error',
            targetProvider: 'dropbox',
            canResume: true,
            error: 'temporary target failure',
        });
        expect(mocks.lifecycleState.active.provider).toBe('google-drive');
    });

    it('reports a fail-closed recovery error when persisted transfer state cannot be read', async () => {
        mocks.readJournal.mockRejectedValueOnce(new Error('private IndexedDB detail'));
        const { result } = renderHook(() => useCloudProviderTransfer());

        await waitFor(() => expect(result.current).toMatchObject({
            status: 'error',
            error: 'The saved provider transfer state could not be read. Cloud sync remains unchanged.',
        }));
    });

    it('rejects disconnected and same-provider transfer starts before target authorization', async () => {
        mocks.cloudConnected = false;
        const disconnected = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());
        await expect(disconnected.result.current.startTransfer('dropbox')).rejects.toThrow(
            /finish syncing the current provider/i,
        );
        disconnected.unmount();

        mocks.cloudConnected = true;
        const sameProvider = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());
        await expect(sameProvider.result.current.startTransfer('google-drive')).rejects.toThrow(
            /Google Drive is already the active provider/i,
        );
        sameProvider.unmount();
        expect(mocks.dropboxSignIn).not.toHaveBeenCalled();
        expect(mocks.googleSignIn).not.toHaveBeenCalled();
    });

    it('rejects a new transfer while a journal or staged target already exists', async () => {
        const journal = {
            ownerId: 'existing-transfer-owner',
            targetProvider: 'dropbox',
            stage: 'target-prepared',
        };
        mocks.readJournal.mockResolvedValue(journal);
        mocks.journal = journal;
        const journaled = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(journaled.result.current.canResume).toBe(true));
        await expect(journaled.result.current.startTransfer('dropbox')).rejects.toThrow(
            /Resume the saved provider transfer/i,
        );
        journaled.unmount();

        mocks.journal = null;
        mocks.readJournal.mockResolvedValue(null);
        mocks.lifecycleState = lifecycle('google-drive', 'dropbox');
        const staged = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(staged.result.current.canResume).toBe(true));
        await expect(staged.result.current.startTransfer('dropbox')).rejects.toThrow(
            /Resume the staged provider transfer/i,
        );
        staged.unmount();
    });

    it('reports an absent transfer and keeps a failed journal resume recoverable', async () => {
        const empty = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(mocks.readJournal).toHaveBeenCalled());
        await act(async () => {
            await expect(empty.result.current.resumeTransfer()).rejects.toThrow(
                /no saved provider transfer/i,
            );
        });
        empty.unmount();

        mocks.journal = {
            ownerId: 'transfer-owner-fixture',
            targetProvider: 'dropbox',
            stage: 'target-prepared',
        };
        mocks.lifecycleState = lifecycle('google-drive', 'dropbox');
        mocks.coordinatorRun.mockRejectedValueOnce(new Error('resume network failure'));
        const failed = renderHook(() => useCloudProviderTransfer());
        await waitFor(() => expect(failed.result.current.canResume).toBe(true));
        await act(async () => {
            await expect(failed.result.current.resumeTransfer()).rejects.toThrow(
                'resume network failure',
            );
        });
        expect(failed.result.current).toMatchObject({
            status: 'error',
            stage: 'target-prepared',
            targetProvider: 'dropbox',
            canResume: true,
        });
    });
});
