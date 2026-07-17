import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    DriveAccessTokenError,
    DriveAccessTokenProvider,
} from './DriveAccessTokenProvider';
import { APP_VERSION } from '@/constants/app';

const ENDPOINT = 'https://worker.example/auth/access-token';
const SESSION_ID = 'session-fixture';
const NOW = 1_784_203_400_000;

function tokenResponse(overrides: Record<string, unknown> = {}): Response {
    return Response.json({
        accessToken: 'access-token-fixture',
        tokenType: 'Bearer',
        expiresAt: NOW + 3_600_000,
        serverTime: NOW,
        scope: 'email https://www.googleapis.com/auth/drive.appdata',
        ...overrides,
    });
}

describe('DriveAccessTokenProvider', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests lazily, caches only in memory, and reuses the token before early expiry', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse());
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        expect(fetch).not.toHaveBeenCalled();
        await expect(provider.getToken()).resolves.toBe('access-token-fixture');
        await expect(provider.getToken()).resolves.toBe('access-token-fixture');

        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({
            method: 'POST',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: expect.objectContaining({
                'X-Session-Id': SESSION_ID,
                'X-TaskTime-App-Version': APP_VERSION,
            }),
        }));
    });

    it('deduplicates simultaneous requests in one tab', async () => {
        let resolveResponse!: (response: Response) => void;
        vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { resolveResponse = resolve; }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const first = provider.getToken();
        const second = provider.getToken();
        resolveResponse(tokenResponse());

        await expect(Promise.all([first, second])).resolves.toEqual([
            'access-token-fixture',
            'access-token-fixture',
        ]);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('starts empty after reload because credentials are not persisted', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'reloaded-token-fixture' }));
        const firstTab = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        firstTab.setSession(SESSION_ID);
        await firstTab.getToken();

        const reloadedTab = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        reloadedTab.setSession(SESSION_ID);

        expect(reloadedTab.hasCachedToken()).toBe(false);
        await expect(reloadedTab.getToken()).resolves.toBe('reloaded-token-fixture');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('forces a real refresh and replaces the nominally valid cached token', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'forced-token-fixture' }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).resolves.toBe('access-token-fixture');
        await expect(provider.getToken({ forceRefresh: true })).resolves.toBe('forced-token-fixture');
        expect(await vi.mocked(fetch).mock.calls[1]?.[1]?.body).toBe('{"forceRefresh":true}');
    });

    it('uses Worker time for expiry and refreshes after the bounded early-expiry point', async () => {
        let localNow = NOW - 600_000;
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse({ expiresAt: NOW + 300_000 }))
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'replacement-token-fixture' }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => localNow });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).resolves.toBe('access-token-fixture');
        localNow += 181_000;
        await expect(provider.getToken()).resolves.toBe('replacement-token-fixture');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('caps an extreme reported lifetime instead of retaining a token indefinitely', async () => {
        let localNow = NOW;
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse({ expiresAt: NOW + 24 * 60 * 60 * 1000 }))
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'bounded-token-fixture' }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => localNow });
        provider.setSession(SESSION_ID);
        await provider.getToken();

        localNow += (2 * 60 * 60 * 1000) - (2 * 60 * 1000) + 1;

        await expect(provider.getToken()).resolves.toBe('bounded-token-fixture');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each([
        { accessToken: '' },
        { tokenType: 'Basic' },
        { expiresAt: 'soon' },
        { serverTime: null },
        { expiresAt: NOW + 60_000 },
        { scope: 'email https://www.googleapis.com/auth/drive.file' },
        { scope: 42 },
    ])('rejects malformed or insufficient token response %# without exposing its body', async (overrides) => {
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse(overrides));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const error = await provider.getToken().catch(value => value);

        expect(error).toBeInstanceOf(DriveAccessTokenError);
        expect(error.code).toBe('INVALID_TOKEN_RESPONSE');
        expect(error.message).not.toContain('access-token-fixture');
    });

    it('accepts a supported legacy response with omitted scope', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse({ scope: undefined }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).resolves.toBe('access-token-fixture');
    });

    it('discards a stale response after session replacement', async () => {
        let resolveResponse!: (response: Response) => void;
        vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { resolveResponse = resolve; }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const pending = provider.getToken();
        provider.setSession('replacement-session');
        resolveResponse(tokenResponse());

        await expect(pending).rejects.toMatchObject({ code: 'STALE_TOKEN_RESPONSE' });
        expect(provider.hasCachedToken()).toBe(false);
    });

    it('preserves sanitized Worker error codes and Retry-After without returning response details', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { error: 'private upstream detail', code: 'RATE_LIMITED' },
            { status: 429, headers: { 'Retry-After': '17' } },
        ));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        const error = await provider.getToken().catch(value => value);

        expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 17 });
        expect(error.message).not.toContain('private upstream detail');
    });

    it('reports transport rollback without acquiring or caching a token', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { code: 'DIRECT_TRANSPORT_DISABLED' },
            { status: 409 },
        ));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).rejects.toMatchObject({
            code: 'DIRECT_TRANSPORT_DISABLED',
            status: 409,
        });
        expect(provider.hasCachedToken()).toBe(false);
    });

    it('maps a revoked or expired Worker session to reconnect-required state', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(
            { code: 'SESSION_NOT_FOUND' },
            { status: 401 },
        ));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).rejects.toMatchObject({
            code: 'SESSION_NOT_FOUND',
            status: 401,
        });
        expect(provider.hasCachedToken()).toBe(false);
    });

    it('sanitizes network and malformed-success failures', async () => {
        vi.mocked(fetch)
            .mockRejectedValueOnce(new TypeError('secret network detail'))
            .mockResolvedValueOnce(new Response('not-json', { status: 200 }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await expect(provider.getToken()).rejects.toMatchObject({ code: 'TOKEN_SERVICE_UNAVAILABLE' });
        await expect(provider.getToken()).rejects.toMatchObject({ code: 'INVALID_TOKEN_RESPONSE' });
    });

    it('does not contact the Worker without a current session', async () => {
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });

        await expect(provider.getToken()).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('clears cached and in-flight credentials without clearing the Worker session', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(tokenResponse())
            .mockResolvedValueOnce(tokenResponse({ accessToken: 'replacement-token-fixture' }));
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);
        await provider.getToken();

        provider.clearToken();

        expect(provider.hasCachedToken()).toBe(false);
        await expect(provider.getToken()).resolves.toBe('replacement-token-fixture');
    });

    it('never writes token material to browser storage, Cache Storage, or console output', async () => {
        const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
        const sessionStorageWrite = vi.spyOn(window.sessionStorage, 'setItem');
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const cacheOpen = vi.fn();
        vi.stubGlobal('caches', { open: cacheOpen });
        vi.mocked(fetch).mockResolvedValueOnce(tokenResponse());
        const provider = new DriveAccessTokenProvider({ endpoint: ENDPOINT, now: () => NOW });
        provider.setSession(SESSION_ID);

        await provider.getToken();

        expect(localStorageWrite).not.toHaveBeenCalled();
        expect(sessionStorageWrite).not.toHaveBeenCalled();
        expect(cacheOpen).not.toHaveBeenCalled();
        expect(consoleLog).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
    });
});
