import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const preferenceValues = {
        autoSyncEnabled: true,
        autoSyncMode: 'sync',
    };
    const preferences = {
        get: vi.fn((key: keyof typeof preferenceValues) => preferenceValues[key]),
        observe: vi.fn(),
        unobserve: vi.fn(),
    };
    const noopUnsubscribe = vi.fn();
    const store = {
        preferences,
        initialize: vi.fn(async () => {}),
        isCloudConnected: vi.fn(() => true),
        isDriveConnected: vi.fn(() => true),
        getActiveCloudStorageScope: vi.fn(() => ({
            provider: 'google-drive',
            generation: 0,
        })),
        setActiveCloudStorageScope: vi.fn(),
        setCloudSyncPreferences: vi.fn(),
        getSyncState: vi.fn(() => 'idle'),
        getSyncPhase: vi.fn(() => 'idle'),
        getLastSyncedAt: vi.fn(() => 0),
        hasPendingSyncChanges: vi.fn(() => true),
        onPersistenceError: vi.fn(() => noopUnsubscribe),
        onSyncStateChange: vi.fn(() => noopUnsubscribe),
        onSyncPhaseChange: vi.fn(() => noopUnsubscribe),
        onPendingSyncChange: vi.fn(() => noopUnsubscribe),
        syncCloud: vi.fn(async () => {}),
        connectDrive: vi.fn(async () => {}),
        connectCloud: vi.fn(async () => {}),
        updateDriveSessionId: vi.fn(),
        disconnectCloud: vi.fn(),
    };

    return {
        store,
        preferenceValues,
        showError: vi.fn(),
        showWarning: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        revokeAccess: vi.fn(),
        disconnectDropbox: vi.fn(),
        invalidateSession: vi.fn(),
        refreshDriveTransport: vi.fn(),
        authCallbacks: {
            refreshDriveTransport: vi.fn(),
        },
        claimActiveStorage: vi.fn(),
        clearStorageSession: vi.fn(),
        lifecycleState: { stagedTarget: null as object | null },
        identity: {
            activeStorageProvider: 'google-drive' as 'google-drive' | 'dropbox',
            activeStorageSessionId: 'google-session',
            activeStorageGeneration: 0,
            hostedServiceSessionId: 'google-session',
            isGoogleStorageActive: true,
        },
    };
});

vi.mock('@/stores/yjs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/stores/yjs')>();

    return {
        ...actual,
        getYjsStore: () => mocks.store,
    };
});

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        isSignedIn: true,
        sessionId: 'google-session',
        driveTransport: 'direct',
        isLoading: false,
        signIn: mocks.signIn,
        signOut: mocks.signOut,
        revokeAccess: mocks.revokeAccess,
        invalidateSession: mocks.invalidateSession,
        refreshDriveTransport: mocks.authCallbacks.refreshDriveTransport,
    }),
}));

vi.mock('@/hooks/useDropboxAuth', () => ({
    useDropboxAuth: () => ({
        isSignedIn: mocks.identity.activeStorageProvider === 'dropbox',
        isLoading: false,
        sessionId: mocks.identity.activeStorageProvider === 'dropbox'
            ? mocks.identity.activeStorageSessionId
            : null,
        storageGeneration: mocks.identity.activeStorageProvider === 'dropbox'
            ? mocks.identity.activeStorageGeneration
            : null,
        disconnect: mocks.disconnectDropbox,
    }),
}));

vi.mock('@/hooks/useCloudStorageLifecycle', () => ({
    useCloudStorageLifecycle: () => ({
        state: mocks.lifecycleState,
        isLoading: false,
        claimActive: mocks.claimActiveStorage,
        clear: mocks.clearStorageSession,
    }),
}));

vi.mock('@/stores/yjs/cloudStorageLifecycle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/stores/yjs/cloudStorageLifecycle')>();

    return {
        ...actual,
        resolveCloudStorageIdentity: () => ({ ...mocks.identity }),
    };
});

vi.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showError: mocks.showError,
        showWarning: mocks.showWarning,
    }),
}));

vi.mock('@/utils/syncPersistence', () => ({
    shouldSyncOnLoad: () => false,
    wasSyncInterrupted: () => false,
    hasPersistedPendingChanges: () => false,
}));

vi.mock('@/components/Modal', () => ({
    default: () => null,
}));

import { useYjs, YjsProvider, type YjsContextValue } from './YjsContext';
import { CloudProviderMovedError } from '@/stores/yjs';

afterEach(() => {
    mocks.store.isCloudConnected.mockReturnValue(true);
    mocks.authCallbacks.refreshDriveTransport = mocks.refreshDriveTransport;
});

async function renderConnectedProvider() {
    const view = render(
        <YjsProvider>
            <div>connected</div>
        </YjsProvider>,
    );

    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

    return view;
}

describe('YjsProvider foreground sync scheduling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.store.syncCloud.mockReset();
        mocks.store.hasPendingSyncChanges.mockReturnValue(true);
        mocks.store.getLastSyncedAt.mockReturnValue(0);
        mocks.preferenceValues.autoSyncEnabled = true;
        mocks.preferenceValues.autoSyncMode = 'sync';
        Object.assign(mocks.identity, {
            activeStorageProvider: 'google-drive',
            activeStorageSessionId: 'google-session',
            activeStorageGeneration: 0,
            hostedServiceSessionId: 'google-session',
            isGoogleStorageActive: true,
        });
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
    });

    it('coalesces tab-visible and online wake signals into one sync request', async () => {
        await renderConnectedProvider();

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(mocks.store.syncCloud).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(500);
            window.dispatchEvent(new Event('online'));
            vi.advanceTimersByTime(999);
        });
        expect(mocks.store.syncCloud).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(1);
            await Promise.resolve();
        });

        expect(mocks.store.syncCloud).toHaveBeenCalledTimes(1);
        expect(mocks.store.syncCloud).toHaveBeenCalledWith({ force: false });
    });

    it('allows a later online recovery event after the coalescing window', async () => {
        await renderConnectedProvider();

        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(1000);
            await Promise.resolve();
        });
        expect(mocks.store.syncCloud).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(1001);
            window.dispatchEvent(new Event('online'));
            vi.advanceTimersByTime(1000);
            await Promise.resolve();
        });

        expect(mocks.store.syncCloud).toHaveBeenCalledTimes(2);
    });

    it('keeps Manual mode wake signals request-free', async () => {
        mocks.preferenceValues.autoSyncEnabled = false;
        await renderConnectedProvider();

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('online'));
            vi.advanceTimersByTime(2000);
        });

        expect(mocks.store.syncCloud).not.toHaveBeenCalled();
    });

    it('keeps Backup mode wake-up recovery push-only', async () => {
        mocks.preferenceValues.autoSyncMode = 'backup';
        await renderConnectedProvider();

        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('online'));
            vi.advanceTimersByTime(1000);
            await Promise.resolve();
        });

        expect(mocks.store.syncCloud).toHaveBeenCalledTimes(1);
        expect(mocks.store.syncCloud).toHaveBeenCalledWith({
            allowPull: false,
            force: false,
        });
    });

    it('keeps a clean Sync-mode wake signal inside the cooldown request-free', async () => {
        mocks.store.hasPendingSyncChanges.mockReturnValue(false);
        mocks.store.getLastSyncedAt.mockReturnValue(Date.now());
        await renderConnectedProvider();

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('online'));
            vi.advanceTimersByTime(2000);
        });

        expect(mocks.store.syncCloud).not.toHaveBeenCalled();
    });

    it('cancels a pending wake-up request when the provider unmounts', async () => {
        const view = await renderConnectedProvider();

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            view.unmount();
            vi.advanceTimersByTime(2000);
        });

        expect(mocks.store.syncCloud).not.toHaveBeenCalled();
    });
});

describe('YjsProvider cloud connection lifecycle', () => {
    beforeEach(() => {
        vi.useRealTimers();
        mocks.store.isCloudConnected.mockReturnValue(false);
        mocks.store.connectDrive.mockReset();
        mocks.store.connectCloud.mockReset();
        mocks.authCallbacks.refreshDriveTransport = mocks.refreshDriveTransport;
        Object.assign(mocks.identity, {
            activeStorageProvider: 'google-drive',
            activeStorageSessionId: 'google-session',
            activeStorageGeneration: 0,
            hostedServiceSessionId: 'google-session',
            isGoogleStorageActive: true,
        });
    });

    it('coalesces repeated renders while the same provider connection is still in flight', async () => {
        let finishConnect: (() => void) | undefined;
        mocks.store.connectDrive.mockImplementation(() => new Promise<void>((resolve) => {
            finishConnect = resolve;
        }));

        const view = render(
            <YjsProvider>
                <div>connected</div>
            </YjsProvider>,
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(mocks.store.connectDrive).toHaveBeenCalledTimes(1);

        mocks.authCallbacks.refreshDriveTransport = vi.fn(async () => 'direct');
        view.rerender(
            <YjsProvider>
                <div>connected</div>
            </YjsProvider>,
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mocks.store.connectDrive).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishConnect?.();
            await Promise.resolve();
        });
    });

    it('applies the same in-flight connection coalescing to Dropbox', async () => {
        Object.assign(mocks.identity, {
            activeStorageProvider: 'dropbox',
            activeStorageSessionId: 'dropbox-session',
            activeStorageGeneration: 7,
            hostedServiceSessionId: 'dropbox-session',
            isGoogleStorageActive: false,
        });
        let finishConnect: (() => void) | undefined;
        mocks.store.connectCloud.mockImplementation(() => new Promise<void>((resolve) => {
            finishConnect = resolve;
        }));

        const view = render(
            <YjsProvider>
                <div>connected</div>
            </YjsProvider>,
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(mocks.store.connectCloud).toHaveBeenCalledTimes(1);

        mocks.authCallbacks.refreshDriveTransport = vi.fn(async () => 'direct');
        view.rerender(
            <YjsProvider>
                <div>connected</div>
            </YjsProvider>,
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mocks.store.connectCloud).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishConnect?.();
            await Promise.resolve();
        });
    });

    it('surfaces a moved workspace target and does not retry the fenced source connection', async () => {
        let contextValue: YjsContextValue | null = null;
        const movedError = new CloudProviderMovedError('dropbox', 3);
        mocks.store.connectDrive.mockRejectedValue(movedError);

        function ContextProbe() {
            contextValue = useYjs();
            return null;
        }

        const view = render(
            <YjsProvider>
                <ContextProbe />
            </YjsProvider>,
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mocks.store.connectDrive).toHaveBeenCalledTimes(1);
        expect(contextValue?.movedToStorageProvider).toBe('dropbox');

        mocks.authCallbacks.refreshDriveTransport = vi.fn(async () => 'direct');
        view.rerender(
            <YjsProvider>
                <ContextProbe />
            </YjsProvider>,
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mocks.store.connectDrive).toHaveBeenCalledTimes(1);
    });
});

describe('YjsProvider active cloud session lifecycle', () => {
    let contextValue: YjsContextValue | null = null;

    function ContextProbe() {
        contextValue = useYjs();
        return null;
    }

    beforeEach(() => {
        vi.useRealTimers();
        contextValue = null;
        mocks.lifecycleState.stagedTarget = null;
        Object.assign(mocks.identity, {
            activeStorageProvider: 'google-drive',
            activeStorageSessionId: 'google-session',
            activeStorageGeneration: 0,
            hostedServiceSessionId: 'google-session',
            isGoogleStorageActive: true,
        });
        mocks.signOut.mockReset().mockResolvedValue(undefined);
        mocks.revokeAccess.mockReset().mockResolvedValue(undefined);
        mocks.disconnectDropbox.mockReset().mockResolvedValue(undefined);
        mocks.clearStorageSession.mockReset().mockResolvedValue(undefined);
        mocks.store.disconnectCloud.mockReset();
    });

    async function renderContext() {
        render(
            <YjsProvider>
                <ContextProbe />
            </YjsProvider>,
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        if (!contextValue) throw new Error('Yjs context was not initialized.');
        return contextValue;
    }

    it('revokes the active provider before clearing its fenced session and runtime', async () => {
        const context = await renderContext();

        await act(async () => {
            await context.disconnectActiveCloudSession({ revoke: true });
        });

        expect(mocks.revokeAccess).toHaveBeenCalledTimes(1);
        expect(mocks.signOut).not.toHaveBeenCalled();
        expect(mocks.clearStorageSession).toHaveBeenCalledWith({
            provider: 'google-drive',
            sessionId: 'google-session',
            generation: 0,
        });
        expect(mocks.revokeAccess.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.clearStorageSession.mock.invocationCallOrder[0],
        );
        expect(mocks.clearStorageSession.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.store.disconnectCloud.mock.invocationCallOrder[0],
        );
    });

    it('disconnects locally without revoking provider authorization', async () => {
        const context = await renderContext();

        await act(async () => {
            await context.disconnectActiveCloudSession({ revoke: false });
        });

        expect(mocks.signOut).toHaveBeenCalledTimes(1);
        expect(mocks.revokeAccess).not.toHaveBeenCalled();
        expect(mocks.clearStorageSession).toHaveBeenCalledTimes(1);
        expect(mocks.store.disconnectCloud).toHaveBeenCalledTimes(1);
    });

    it('uses the same revoke and fenced-clear lifecycle for Dropbox', async () => {
        Object.assign(mocks.identity, {
            activeStorageProvider: 'dropbox',
            activeStorageSessionId: 'dropbox-session',
            activeStorageGeneration: 7,
            hostedServiceSessionId: 'dropbox-session',
            isGoogleStorageActive: false,
        });
        const context = await renderContext();
        mocks.store.disconnectCloud.mockReset();

        await act(async () => {
            await context.disconnectActiveCloudSession({ revoke: true });
        });

        expect(mocks.disconnectDropbox).toHaveBeenCalledWith({ revoke: true });
        expect(mocks.revokeAccess).not.toHaveBeenCalled();
        expect(mocks.clearStorageSession).toHaveBeenCalledWith({
            provider: 'dropbox',
            sessionId: 'dropbox-session',
            generation: 7,
        });
        expect(mocks.disconnectDropbox.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.clearStorageSession.mock.invocationCallOrder[0],
        );
        expect(mocks.store.disconnectCloud).toHaveBeenCalledTimes(1);
    });

    it('keeps the local session and runtime intact when remote revocation fails', async () => {
        mocks.revokeAccess.mockRejectedValueOnce(new Error('Provider unavailable'));
        const context = await renderContext();

        await expect(context.disconnectActiveCloudSession({ revoke: true })).rejects.toThrow(
            'Provider unavailable',
        );

        expect(mocks.clearStorageSession).not.toHaveBeenCalled();
        expect(mocks.store.disconnectCloud).not.toHaveBeenCalled();
    });

    it('refuses to disconnect the source while a provider transfer is staged', async () => {
        mocks.lifecycleState.stagedTarget = { provider: 'dropbox' };
        const context = await renderContext();

        await expect(context.disconnectActiveCloudSession({ revoke: true })).rejects.toThrow(
            'Cancel the provider transfer before disconnecting its source.',
        );

        expect(mocks.revokeAccess).not.toHaveBeenCalled();
        expect(mocks.signOut).not.toHaveBeenCalled();
        expect(mocks.clearStorageSession).not.toHaveBeenCalled();
        expect(mocks.store.disconnectCloud).not.toHaveBeenCalled();
    });
});
