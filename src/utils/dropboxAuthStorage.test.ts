import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearStoredDropboxSession,
    getStoredDropboxSession,
    storeDropboxSession,
} from './dropboxAuthStorage';

const mockDb = {
    get: vi.fn(),
    put: vi.fn(),
    transaction: vi.fn(),
};
const mockStore = { get: vi.fn(), delete: vi.fn() };

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

describe('dropboxAuthStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.transaction.mockReturnValue({ store: mockStore, done: Promise.resolve() });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stores only a provider-scoped Worker session reference', async () => {
        const session = {
            provider: 'dropbox' as const,
            sessionId: 'dropbox-session-fixture',
            createdAt: '2026-08-19T10:00:00.000Z',
        };

        await storeDropboxSession(session);

        expect(mockDb.put).toHaveBeenCalledWith('app-data', session, 'dropbox-auth-session');
        expect(JSON.stringify(mockDb.put.mock.calls[0])).not.toContain('accessToken');
        expect(JSON.stringify(mockDb.put.mock.calls[0])).not.toContain('accountId');
    });

    it('returns only a valid Dropbox reference and ignores malformed records', async () => {
        mockDb.get
            .mockResolvedValueOnce({
                provider: 'dropbox',
                sessionId: 'dropbox-session-fixture',
                createdAt: '2026-08-19T10:00:00.000Z',
            })
            .mockResolvedValueOnce({ provider: 'google-drive', sessionId: 'wrong-provider' });

        await expect(getStoredDropboxSession()).resolves.toMatchObject({
            sessionId: 'dropbox-session-fixture',
        });
        await expect(getStoredDropboxSession()).resolves.toBeNull();
    });

    it('does not let a stale tab clear a replacement session reference', async () => {
        mockStore.get.mockResolvedValue({ sessionId: 'replacement-session' });

        await expect(clearStoredDropboxSession('old-session')).resolves.toBe(false);
        expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('clears a matching session and fails safely on storage errors', async () => {
        mockStore.get.mockResolvedValue({ sessionId: 'dropbox-session-fixture' });
        await expect(clearStoredDropboxSession('dropbox-session-fixture')).resolves.toBe(true);
        expect(mockStore.delete).toHaveBeenCalledWith('dropbox-auth-session');

        mockDb.get.mockRejectedValueOnce(new Error('private storage detail'));
        await expect(getStoredDropboxSession()).resolves.toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            'Error loading Dropbox session from IndexedDB:',
            expect.any(Error),
        );
    });
});
