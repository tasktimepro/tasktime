import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCloudStorageLifecycle } from './useCloudStorageLifecycle';

const mocks = vi.hoisted(() => ({
    activateStaged: vi.fn(),
    claim: vi.fn(),
    clear: vi.fn(),
    clearStaged: vi.fn(),
    get: vi.fn(),
    stage: vi.fn(),
}));

vi.mock('@/stores/yjs/cloudStorageLifecycle', () => ({
    CLOUD_STORAGE_LIFECYCLE_EVENT: 'tasktime:cloud-storage-lifecycle-changed',
    activateStagedCloudStorageSession: mocks.activateStaged,
    claimActiveCloudStorageSession: mocks.claim,
    clearCloudStorageSession: mocks.clear,
    clearStagedCloudStorageSession: mocks.clearStaged,
    getCloudStorageLifecycle: mocks.get,
    stageCloudStorageSession: mocks.stage,
}));

const emptyState = {
    version: 1 as const,
    revision: 0,
    active: null,
    stagedTarget: null,
    updatedAt: 1,
};

class BroadcastChannelMock {
    static instances: BroadcastChannelMock[] = [];

    onmessage: ((event: MessageEvent) => void) | null = null;
    close = vi.fn();

    constructor(readonly name: string) {
        BroadcastChannelMock.instances.push(this);
    }

    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
}

describe('useCloudStorageLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue(emptyState);
        BroadcastChannelMock.instances = [];
        vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);
    });

    it('loads the authoritative lifecycle and refreshes on same-profile invalidation', async () => {
        const activeState = {
            ...emptyState,
            revision: 1,
            active: {
                provider: 'google-drive' as const,
                sessionId: 'google-session-fixture',
                generation: 0,
            },
        };
        mocks.get.mockResolvedValueOnce(emptyState).mockResolvedValueOnce(activeState);
        const { result } = renderHook(() => useCloudStorageLifecycle());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            window.dispatchEvent(new CustomEvent('tasktime:cloud-storage-lifecycle-changed'));
        });

        await waitFor(() => expect(result.current.state).toEqual(activeState));
        expect(mocks.get).toHaveBeenCalledTimes(2);

        act(() => {
            BroadcastChannelMock.instances[0].onmessage?.(new MessageEvent('message'));
        });
        await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
    });

    it('applies mutation results and exposes a sanitized storage error', async () => {
        const activeState = {
            ...emptyState,
            revision: 1,
            active: {
                provider: 'dropbox' as const,
                sessionId: 'dropbox-session-fixture',
                generation: 1,
            },
        };
        mocks.claim.mockResolvedValue(activeState);
        mocks.clear.mockRejectedValue(new Error('private storage detail'));
        const { result } = renderHook(() => useCloudStorageLifecycle());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.claimActive('dropbox', 'dropbox-session-fixture');
        });
        expect(result.current.state).toEqual(activeState);

        await act(async () => {
            await expect(result.current.clear(activeState.active!)).rejects.toThrow(
                'Cloud storage state could not be updated.',
            );
        });
        expect(result.current.error).toBe('Cloud storage state could not be updated.');
        expect(result.current.error).not.toContain('private storage detail');
    });

    it('forwards staged ownership operations without exposing session IDs in events', async () => {
        const stagedState = {
            ...emptyState,
            revision: 2,
            active: {
                provider: 'google-drive' as const,
                sessionId: 'google-session-fixture',
                generation: 0,
            },
            stagedTarget: {
                provider: 'dropbox' as const,
                sessionId: 'dropbox-session-fixture',
                generation: 1,
                ownerId: 'transfer-owner-fixture',
                sourceProvider: 'google-drive' as const,
                sourceGeneration: 0,
            },
        };
        mocks.stage.mockResolvedValue(stagedState);
        mocks.clearStaged.mockResolvedValue({ ...stagedState, stagedTarget: null, revision: 3 });
        mocks.activateStaged.mockResolvedValue({
            ...stagedState,
            active: stagedState.stagedTarget,
            stagedTarget: null,
            revision: 4,
        });
        const { result } = renderHook(() => useCloudStorageLifecycle());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.stage(
                'dropbox',
                'dropbox-session-fixture',
                'transfer-owner-fixture',
            );
        });
        expect(result.current.state?.stagedTarget?.ownerId).toBe('transfer-owner-fixture');
        await act(async () => {
            await result.current.clearStaged('transfer-owner-fixture');
        });
        expect(result.current.state?.stagedTarget).toBeNull();
        await act(async () => {
            await result.current.activateStaged('transfer-owner-fixture');
        });
        expect(mocks.activateStaged).toHaveBeenCalledWith('transfer-owner-fixture');
    });

    it('fails closed with the sanitized lifecycle error and tolerates unavailable broadcasts', async () => {
        const lifecycleError = Object.assign(new Error('Cloud storage is locked.'), {
            name: 'CloudStorageLifecycleError',
        });
        mocks.get.mockRejectedValue(lifecycleError);
        vi.stubGlobal('BroadcastChannel', class {
            constructor() {
                throw new Error('broadcast unavailable');
            }
        });

        const { result } = renderHook(() => useCloudStorageLifecycle());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.state).toBeNull();
        expect(result.current.error).toBe('Cloud storage is locked.');
        await act(async () => {
            await expect(result.current.refresh()).rejects.toThrow('Cloud storage is locked.');
        });
    });

    it('ignores a stale refresh result after a newer mutation wins', async () => {
        let resolveRefresh!: (state: typeof emptyState) => void;
        mocks.get.mockImplementationOnce(() => new Promise(resolve => {
            resolveRefresh = resolve;
        }));
        const activeState = {
            ...emptyState,
            revision: 1,
            active: {
                provider: 'dropbox' as const,
                sessionId: 'dropbox-session-fixture',
                generation: 1,
            },
        };
        mocks.claim.mockResolvedValue(activeState);
        const { result, unmount } = renderHook(() => useCloudStorageLifecycle());

        await act(async () => {
            await result.current.claimActive('dropbox', 'dropbox-session-fixture');
        });
        act(() => resolveRefresh(emptyState));

        await waitFor(() => expect(result.current.state).toEqual(activeState));
        unmount();
        expect(BroadcastChannelMock.instances[0].close).toHaveBeenCalledOnce();
    });
});
