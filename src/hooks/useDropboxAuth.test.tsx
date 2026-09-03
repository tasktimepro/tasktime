import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetDropboxAuthStatusCache, useDropboxAuth } from './useDropboxAuth';

const mocks = vi.hoisted(() => ({
    claimActiveCloudStorageSession: vi.fn(),
    clearStoredDropboxSession: vi.fn(),
    clearCloudStorageSession: vi.fn(),
    getStoredDropboxSession: vi.fn(),
    getCloudStorageLifecycle: vi.fn(),
    storeDropboxSession: vi.fn(),
    stageCloudStorageSession: vi.fn(),
    setSession: vi.fn(),
    clearToken: vi.fn(),
    getToken: vi.fn(),
    getDropboxAccountEmail: vi.fn(),
}));

vi.mock('@/config/google', () => ({
    SYNC_WORKER_CONFIG: {
        isEnabled: true,
        endpoints: {
            dropboxAuthInit: 'https://worker.example/auth/dropbox/init',
            dropboxAuthCallback: 'https://worker.example/auth/dropbox/callback',
            dropboxAuthStatus: 'https://worker.example/auth/dropbox/status',
            dropboxAuthRevoke: 'https://worker.example/auth/dropbox/revoke',
        },
    },
}));

vi.mock('@/utils/dropboxAuthStorage', () => ({
    clearStoredDropboxSession: mocks.clearStoredDropboxSession,
    getStoredDropboxSession: mocks.getStoredDropboxSession,
    storeDropboxSession: mocks.storeDropboxSession,
}));

vi.mock('@/stores/yjs/providers/DropboxAccessTokenProvider', () => ({
    dropboxAccessTokenProvider: {
        setSession: mocks.setSession,
        clearToken: mocks.clearToken,
        getToken: mocks.getToken,
    },
}));

vi.mock('@/services/dropboxAccountProfile', () => ({
    getDropboxAccountEmail: mocks.getDropboxAccountEmail,
}));

vi.mock('@/stores/yjs/cloudStorageLifecycle', () => ({
    claimActiveCloudStorageSession: mocks.claimActiveCloudStorageSession,
    clearCloudStorageSession: mocks.clearCloudStorageSession,
    getCloudStorageLifecycle: mocks.getCloudStorageLifecycle,
    getCloudStorageSessionRole: vi.fn((state, provider, sessionId) => {
        if (state.active?.provider === provider && state.active.sessionId === sessionId) return 'active';
        if (state.stagedTarget?.provider === provider
            && state.stagedTarget.sessionId === sessionId) return 'staged';
        return 'inactive';
    }),
    stageCloudStorageSession: mocks.stageCloudStorageSession,
}));

const emptyLifecycle = {
    version: 1,
    revision: 0,
    active: null,
    stagedTarget: null,
    updatedAt: 1,
};
const storedDropboxLifecycle = {
    ...emptyLifecycle,
    active: {
        provider: 'dropbox' as const,
        sessionId: 'stored-dropbox-session',
        generation: 1,
    },
};

describe('useDropboxAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetDropboxAuthStatusCache();
        mocks.getStoredDropboxSession.mockResolvedValue(null);
        mocks.clearStoredDropboxSession.mockResolvedValue(true);
        mocks.storeDropboxSession.mockResolvedValue(undefined);
        mocks.getToken.mockResolvedValue('dropbox-access-token-fixture');
        mocks.getDropboxAccountEmail.mockResolvedValue('owner@example.com');
        mocks.getCloudStorageLifecycle.mockResolvedValue(storedDropboxLifecycle);
        mocks.claimActiveCloudStorageSession.mockResolvedValue({
            ...emptyLifecycle,
            revision: 1,
            active: {
                provider: 'dropbox',
                sessionId: 'new-dropbox-session',
                generation: 1,
            },
        });
        mocks.stageCloudStorageSession.mockResolvedValue({
            ...emptyLifecycle,
            revision: 1,
            active: {
                provider: 'google-drive',
                sessionId: 'google-session-fixture',
                generation: 0,
            },
            stagedTarget: {
                provider: 'dropbox',
                sessionId: 'new-dropbox-session',
                generation: 1,
                ownerId: 'transfer-owner-fixture',
                sourceProvider: 'google-drive',
                sourceGeneration: 0,
            },
        });
        mocks.clearCloudStorageSession.mockResolvedValue(emptyLifecycle);
        vi.stubGlobal('fetch', vi.fn());
    });

    it('restores a provider-scoped session without requesting a file token', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
            accountEmail: 'owner@example.com',
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authenticated: true,
            provider: 'dropbox',
            directTransport: true,
            scope: 'files.content.read files.content.write files.metadata.read files.metadata.write',
        }));

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({
            isSignedIn: true,
            sessionId: 'stored-dropbox-session',
            accountEmail: 'owner@example.com',
        });
        expect(mocks.setSession).toHaveBeenCalledWith('stored-dropbox-session');
        expect(fetch).toHaveBeenCalledWith(
            'https://worker.example/auth/dropbox/status',
            expect.objectContaining({
                method: 'GET',
                headers: { 'X-Session-Id': 'stored-dropbox-session' },
            }),
        );
    });

    it('deduplicates concurrent status restoration across hook consumers', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'dedup-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        mocks.getCloudStorageLifecycle.mockResolvedValue({
            ...emptyLifecycle,
            active: {
                provider: 'dropbox',
                sessionId: 'dedup-dropbox-session',
                generation: 3,
            },
        });
        vi.mocked(fetch).mockResolvedValue(Response.json({
            authenticated: true,
            provider: 'dropbox',
            directTransport: true,
        }));

        const { result } = renderHook(() => [useDropboxAuth(), useDropboxAuth()]);

        await waitFor(() => expect(result.current.every(auth => !auth.isLoading)).toBe(true));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.current.every(auth => auth.isSignedIn)).toBe(true);
    });

    it('preserves a stored session reference when the status service is unavailable', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network fixture'));

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({
            isSignedIn: false,
            sessionId: 'stored-dropbox-session',
            error: 'The Dropbox connection service is temporarily unavailable.',
        });
        expect(mocks.clearStoredDropboxSession).not.toHaveBeenCalled();
    });

    it('preserves a retryable session when Dropbox status returns a transient response', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { code: 'TOKEN_SERVICE_UNAVAILABLE' },
            { status: 503 },
        ));

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({
            isSignedIn: false,
            sessionId: 'stored-dropbox-session',
            storageGeneration: 1,
            storageRole: 'active',
            error: 'The Dropbox connection service is temporarily unavailable.',
        });
        expect(mocks.clearStoredDropboxSession).not.toHaveBeenCalled();
        expect(mocks.clearCloudStorageSession).not.toHaveBeenCalled();
    });

    it('clears a stored session the Worker confirms is no longer authenticated', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'expired-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { authenticated: false },
            { status: 401 },
        ));

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mocks.clearStoredDropboxSession).toHaveBeenCalledWith('expired-dropbox-session');
        expect(result.current).toMatchObject({ isSignedIn: false, sessionId: null });
    });

    it('retains a disabled provider session so rollout can recover it later', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'disabled-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        mocks.getCloudStorageLifecycle.mockResolvedValue({
            ...emptyLifecycle,
            active: {
                provider: 'dropbox',
                sessionId: 'disabled-dropbox-session',
                generation: 2,
            },
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { code: 'PROVIDER_DISABLED' },
            { status: 404 },
        ));

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({
            isSignedIn: false,
            sessionId: 'disabled-dropbox-session',
            error: 'Dropbox connections are not available yet.',
        });
        expect(mocks.clearStoredDropboxSession).not.toHaveBeenCalled();
    });

    it('connects through the provider-specific callback and stores no bearer credential', async () => {
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({
                authUrl: 'https://www.dropbox.com/oauth2/authorize?state=signed-state',
                state: 'signed-state',
                provider: 'dropbox',
            }))
            .mockResolvedValueOnce(Response.json({
                sessionId: 'new-dropbox-session',
                provider: 'dropbox',
            }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let signIn!: Promise<void>;
        act(() => {
            signIn = result.current.signIn();
        });
        await waitFor(() => expect(popup.location.href).toContain('dropbox.com/oauth2/authorize'));
        window.dispatchEvent(new MessageEvent('message', {
            origin: window.location.origin,
            source: popup as unknown as Window,
            data: {
                type: 'dropbox-auth-callback',
                code: 'dropbox-code-fixture',
                state: 'signed-state',
                error: null,
            },
        }));
        await act(async () => signIn);

        expect(result.current).toMatchObject({
            isSignedIn: true,
            sessionId: 'new-dropbox-session',
            accountEmail: 'owner@example.com',
            error: null,
        });
        expect(mocks.storeDropboxSession).toHaveBeenLastCalledWith({
            provider: 'dropbox',
            sessionId: 'new-dropbox-session',
            createdAt: expect.any(String),
            accountEmail: 'owner@example.com',
        });
        expect(JSON.stringify(mocks.storeDropboxSession.mock.calls)).not.toContain('accessToken');
        expect(mocks.getToken).toHaveBeenCalledOnce();
        expect(mocks.getDropboxAccountEmail).toHaveBeenCalledWith('dropbox-access-token-fixture');
        expect(mocks.setSession).toHaveBeenCalledWith('new-dropbox-session');
        expect(mocks.claimActiveCloudStorageSession).toHaveBeenCalledWith(
            'dropbox',
            'new-dropbox-session',
        );
        expect(vi.mocked(fetch).mock.calls[1]).toEqual([
            'https://worker.example/auth/dropbox/callback',
            expect.objectContaining({
                body: JSON.stringify({
                    code: 'dropbox-code-fixture',
                    redirectUri: `${window.location.origin}/auth/dropbox/callback`,
                    state: 'signed-state',
                }),
            }),
        ]);
        expect(vi.mocked(fetch).mock.calls[0]).toEqual([
            'https://worker.example/auth/dropbox/init',
            expect.objectContaining({
                body: JSON.stringify({
                    redirectUri: `${window.location.origin}/auth/dropbox/callback`,
                    purpose: 'connection',
                }),
            }),
        ]);
    });

    it('rejects a normal Dropbox connection while Google Drive is active', async () => {
        mocks.getCloudStorageLifecycle.mockResolvedValue({
            ...emptyLifecycle,
            active: {
                provider: 'google-drive',
                sessionId: 'google-session-fixture',
                generation: 0,
            },
        });
        const openSpy = vi.spyOn(window, 'open');
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await expect(result.current.signIn()).rejects.toThrow(/transfer from Google Drive/i);

        expect(openSpy).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.storeDropboxSession).not.toHaveBeenCalled();
    });

    it('allows a transfer owner to stage Dropbox without activating it', async () => {
        mocks.getCloudStorageLifecycle.mockResolvedValue({
            ...emptyLifecycle,
            active: {
                provider: 'google-drive',
                sessionId: 'google-session-fixture',
                generation: 0,
            },
        });
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({
                authUrl: 'https://www.dropbox.com/oauth2/authorize?state=signed-state',
                state: 'signed-state',
                provider: 'dropbox',
            }))
            .mockResolvedValueOnce(Response.json({
                sessionId: 'new-dropbox-session',
                provider: 'dropbox',
            }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let pending!: Promise<void>;
        act(() => {
            pending = result.current.signIn({ transferOwnerId: 'transfer-owner-fixture' });
        });
        await waitFor(() => expect(popup.location.href).not.toBe(''));
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                source: popup as unknown as Window,
                data: {
                    type: 'dropbox-auth-callback',
                    code: 'dropbox-code-fixture',
                    state: 'signed-state',
                    error: null,
                },
            }));
            await pending;
        });

        expect(mocks.stageCloudStorageSession).toHaveBeenCalledWith(
            'dropbox',
            'new-dropbox-session',
            'transfer-owner-fixture',
        );
        expect(mocks.claimActiveCloudStorageSession).not.toHaveBeenCalled();
        expect(result.current.storageRole).toBe('staged');
        expect(vi.mocked(fetch).mock.calls[0]).toEqual([
            'https://worker.example/auth/dropbox/init',
            expect.objectContaining({
                body: JSON.stringify({
                    redirectUri: `${window.location.origin}/auth/dropbox/callback`,
                    purpose: 'transfer',
                }),
            }),
        ]);
    });

    it('checks the live Worker transfer control before provider transfer work', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authenticated: true,
            provider: 'dropbox',
            transfersEnabled: false,
        }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await expect(result.current.assertTransferEnabled('dropbox-session-fixture')).rejects.toThrow(
            /transfers are temporarily paused/i,
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://worker.example/auth/dropbox/status',
            expect.objectContaining({
                method: 'GET',
                headers: { 'X-Session-Id': 'dropbox-session-fixture' },
            }),
        );
    });

    it('does not restore an unowned inactive Dropbox session', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'inactive-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        mocks.getCloudStorageLifecycle.mockResolvedValue({
            ...emptyLifecycle,
            active: {
                provider: 'google-drive',
                sessionId: 'google-session-fixture',
                generation: 0,
            },
        });

        const { result } = renderHook(() => useDropboxAuth());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({
            isSignedIn: false,
            sessionId: null,
            storageRole: 'inactive',
        });
        expect(mocks.clearStoredDropboxSession).toHaveBeenCalledWith('inactive-dropbox-session');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a callback whose signed state does not match the initiating request', async () => {
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authUrl: 'https://www.dropbox.com/oauth2/authorize?state=expected-state',
            state: 'expected-state',
            provider: 'dropbox',
        }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let pending!: Promise<void>;
        act(() => {
            pending = result.current.signIn();
        });
        await waitFor(() => expect(popup.location.href).not.toBe(''));
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                source: popup as unknown as Window,
                data: {
                    type: 'dropbox-auth-callback',
                    code: 'dropbox-code-fixture',
                    state: 'wrong-state',
                    error: null,
                },
            }));
            await expect(pending).rejects.toThrow(/session no longer matched/i);
        });

        expect(result.current.isSignedIn).toBe(false);
        expect(mocks.storeDropboxSession).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each([
        {
            callback: { code: null, state: 'signed-state', error: 'access_denied' },
            expected: /authorization was not completed/i,
        },
        {
            callback: { code: null, state: 'signed-state', error: null },
            expected: /did not return an authorization code/i,
        },
    ])('rejects an incomplete provider callback %#', async ({ callback, expected }) => {
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authUrl: 'https://www.dropbox.com/oauth2/authorize?state=signed-state',
            state: 'signed-state',
            provider: 'dropbox',
        }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let pending!: Promise<void>;
        act(() => {
            pending = result.current.signIn();
        });
        await waitFor(() => expect(popup.location.href).not.toBe(''));
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                source: popup as unknown as Window,
                data: { type: 'dropbox-auth-callback', ...callback },
            }));
            await expect(pending).rejects.toThrow(expected);
        });
        expect(mocks.storeDropboxSession).not.toHaveBeenCalled();
    });

    it('reports a fail-closed new-connection response without storing a session', async () => {
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { code: 'NEW_CONNECTIONS_DISABLED' },
            { status: 409 },
        ));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await expect(result.current.signIn()).rejects.toThrow(/temporarily paused/i);
        });

        expect(result.current.error).toMatch(/temporarily paused/i);
        expect(mocks.storeDropboxSession).not.toHaveBeenCalled();
    });

    it('does not store a session when callback exchange fails', async () => {
        const popup = { closed: false, close: vi.fn(), location: { href: '' } };
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({
                authUrl: 'https://www.dropbox.com/oauth2/authorize?state=signed-state',
                state: 'signed-state',
                provider: 'dropbox',
            }))
            .mockResolvedValueOnce(Response.json(
                { code: 'TOKEN_SERVICE_UNAVAILABLE' },
                { status: 503 },
            ));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let pending!: Promise<void>;
        act(() => {
            pending = result.current.signIn();
        });
        await waitFor(() => expect(popup.location.href).not.toBe(''));
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                source: popup as unknown as Window,
                data: {
                    type: 'dropbox-auth-callback',
                    code: 'dropbox-code-fixture',
                    state: 'signed-state',
                    error: null,
                },
            }));
            await expect(pending).rejects.toThrow(/temporarily unavailable/i);
        });
        expect(mocks.storeDropboxSession).not.toHaveBeenCalled();
    });

    it('preserves the local session when provider revocation fails', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({ authenticated: true, provider: 'dropbox' }))
            .mockResolvedValueOnce(Response.json(
                { code: 'TOKEN_SERVICE_UNAVAILABLE' },
                { status: 503 },
            ));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isSignedIn).toBe(true));

        await act(async () => {
            await expect(result.current.disconnect({ revoke: true })).rejects.toThrow(/temporarily unavailable/i);
        });

        expect(result.current.sessionId).toBe('stored-dropbox-session');
        expect(mocks.clearStoredDropboxSession).not.toHaveBeenCalled();
        expect(mocks.clearToken).not.toHaveBeenCalled();
    });

    it('can disconnect this profile without revoking the Dropbox grant', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ authenticated: true, provider: 'dropbox' }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isSignedIn).toBe(true));

        await act(async () => result.current.disconnect());

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(mocks.clearStoredDropboxSession).toHaveBeenCalledWith('stored-dropbox-session');
        expect(mocks.clearCloudStorageSession).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
        }));
        expect(mocks.setSession).toHaveBeenLastCalledWith(null);
        expect(mocks.clearToken).toHaveBeenCalled();
        expect(result.current).toMatchObject({ isSignedIn: false, sessionId: null });
    });

    it('revokes successfully before clearing the matching local session', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({ authenticated: true, provider: 'dropbox' }))
            .mockResolvedValueOnce(Response.json({ success: true }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isSignedIn).toBe(true));

        await act(async () => result.current.disconnect({ revoke: true }));

        expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
            'https://worker.example/auth/dropbox/revoke',
        );
        expect(mocks.clearStoredDropboxSession).toHaveBeenCalledWith('stored-dropbox-session');
        expect(result.current.sessionId).toBeNull();
    });

    it('does not clear a replacement session after a cross-tab disconnect race', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        mocks.clearStoredDropboxSession.mockResolvedValue(false);
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ authenticated: true, provider: 'dropbox' }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isSignedIn).toBe(true));

        await act(async () => {
            await expect(result.current.disconnect()).rejects.toThrow(/disconnected elsewhere/i);
        });

        expect(mocks.setSession).not.toHaveBeenCalledWith(null);
        expect(result.current.sessionId).toBe('stored-dropbox-session');
    });

    it('invalidates only the matching Dropbox session when another hook instance disconnects it', async () => {
        mocks.getStoredDropboxSession.mockResolvedValue({
            provider: 'dropbox',
            sessionId: 'stored-dropbox-session',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authenticated: true,
            provider: 'dropbox',
        }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isSignedIn).toBe(true));

        act(() => {
            window.dispatchEvent(new CustomEvent('tasktime:dropbox-auth-changed', {
                detail: {
                    provider: 'dropbox',
                    action: 'disconnected',
                    sessionId: 'another-dropbox-session',
                    senderId: 'another-hook-instance',
                },
            }));
        });
        expect(result.current.sessionId).toBe('stored-dropbox-session');

        act(() => {
            window.dispatchEvent(new CustomEvent('tasktime:dropbox-auth-changed', {
                detail: {
                    provider: 'dropbox',
                    action: 'disconnected',
                    sessionId: 'stored-dropbox-session',
                    senderId: 'another-hook-instance',
                },
            }));
        });

        expect(result.current).toMatchObject({
            isSignedIn: false,
            sessionId: null,
            storageRole: 'inactive',
        });
        expect(mocks.setSession).toHaveBeenLastCalledWith(null);
        expect(mocks.clearToken).toHaveBeenCalledOnce();
    });

    it('refreshes storage ownership when another hook instance connects Dropbox', async () => {
        mocks.getStoredDropboxSession
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                provider: 'dropbox',
                sessionId: 'stored-dropbox-session',
                createdAt: '2026-08-19T10:00:00.000Z',
            });
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({
            authenticated: true,
            provider: 'dropbox',
        }));
        const { result } = renderHook(() => useDropboxAuth());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            window.dispatchEvent(new CustomEvent('tasktime:dropbox-auth-changed', {
                detail: {
                    provider: 'dropbox',
                    action: 'connected',
                    sessionId: 'stored-dropbox-session',
                    senderId: 'another-hook-instance',
                },
            }));
        });

        await waitFor(() => expect(result.current).toMatchObject({
            isSignedIn: true,
            sessionId: 'stored-dropbox-session',
            storageRole: 'active',
        }));
    });
});
