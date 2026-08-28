import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    DropboxAccessTokenError,
    DropboxAccessTokenProvider,
} from './DropboxAccessTokenProvider';
import { APP_VERSION } from '@/constants/app';

const ENDPOINT = 'https://worker.example/auth/dropbox/access-token';
const SESSION_ID = 'dropbox-session-fixture';
const NOW = 1_787_130_000_000;

function tokenResponse(overrides: Record<string, unknown> = {}): Response {
    return Response.json({
        accessToken: 'dropbox-access-token-fixture',
        tokenType: 'Bearer',
        expiresAt: NOW + 3_600_000,
        serverTime: NOW,
        scope: 'files.content.read files.content.write files.metadata.read files.metadata.write',
        ...overrides,
    });
}

describe('DropboxAccessTokenProvider', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests lazily, deduplicates, and keeps the token in memory only', async () => {
        let resolveResponse!: (response: Response) => void;
        vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { resolveResponse = resolve; }));
        const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
        const cacheOpen = vi.fn();
        vi.stubGlobal('caches', { open: cacheOpen });
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const first = provider.getToken();
        const second = provider.getToken();
        resolveResponse(tokenResponse());

        await expect(Promise.all([first, second])).resolves.toEqual([
            'dropbox-access-token-fixture',
            'dropbox-access-token-fixture',
        ]);
        await expect(provider.getToken()).resolves.toBe('dropbox-access-token-fixture');
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledWith(`${ENDPOINT}?appVersion=${APP_VERSION}`, expect.objectContaining({
            method: 'POST',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: expect.objectContaining({
                'X-Session-Id': SESSION_ID,
                'X-TaskTime-App-Version': APP_VERSION,
            }),
        }));
        expect(localStorageWrite).not.toHaveBeenCalled();
        expect(cacheOpen).not.toHaveBeenCalled();
    });

    it('starts without a token after a new provider instance is created', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'replacement-token-fixture' }));
        const first = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        first.setSession(SESSION_ID);
        await first.getToken();

        const reloaded = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        reloaded.setSession(SESSION_ID);

        expect(reloaded.hasCachedToken()).toBe(false);
        await expect(reloaded.getToken()).resolves.toBe('replacement-token-fixture');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('forces refresh and discards a response from a superseded session generation', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'forced-token-fixture' }));
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);
        await provider.getToken();

        await expect(provider.getToken({ forceRefresh: true })).resolves.toBe('forced-token-fixture');
        expect(await vi.mocked(fetch).mock.calls[1]?.[1]?.body).toBe('{"forceRefresh":true}');

        let resolveResponse!: (response: Response) => void;
        vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { resolveResponse = resolve; }));
        provider.clearToken();
        const pending = provider.getToken();
        provider.setSession('replacement-session');
        resolveResponse(tokenResponse());
        await expect(pending).rejects.toMatchObject({ code: 'STALE_TOKEN_RESPONSE' });
        expect(provider.hasCachedToken()).toBe(false);
    });

    it.each([
        { accessToken: '' },
        { tokenType: 'Basic' },
        { expiresAt: NOW + 60_000 },
        { serverTime: null },
        { scope: undefined },
    ])('rejects malformed or insufficient response %#', async (overrides) => {
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse(overrides));
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const error = await provider.getToken().catch(value => value);

        expect(error).toBeInstanceOf(DropboxAccessTokenError);
        expect(error).toMatchObject({ code: 'INVALID_TOKEN_RESPONSE' });
        expect(error.message).not.toContain('dropbox-access-token-fixture');
    });

    it.each([
        'files.content.write files.metadata.read files.metadata.write',
        'files.content.read files.metadata.read files.metadata.write',
        'files.content.read files.content.write files.metadata.write',
        'files.content.read files.content.write files.metadata.read',
    ])('rejects a token missing required scope: %s', async (scope) => {
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse({ scope }));
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).rejects.toMatchObject({
            code: 'MISSING_REQUIRED_SCOPE',
        });
    });

    it('preserves sanitized Worker errors and Retry-After', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { error: 'private detail', code: 'RATE_LIMITED' },
            { status: 429, headers: { 'Retry-After': '17' } },
        ));
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const error = await provider.getToken().catch(value => value);

        expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 17 });
        expect(error.message).not.toContain('private detail');
    });

    it('sanitizes network failures and does not call the Worker without a session', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('private network detail'));
        const provider = new DropboxAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });

        await expect(provider.getToken()).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
        expect(fetch).not.toHaveBeenCalled();

        provider.setSession(SESSION_ID);
        await expect(provider.getToken()).rejects.toMatchObject({ code: 'TOKEN_SERVICE_UNAVAILABLE' });
    });
});
