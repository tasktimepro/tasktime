import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearLegacyStoredToken, getStoredSession, storeSession, clearStoredSession } from './googleAuthStorage';

const { captureDebugBundleIncidentSpy } = vi.hoisted(() => ({
    captureDebugBundleIncidentSpy: vi.fn(),
}));

// Mock IndexedDB
const mockDb = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
};

const mockSessionStore = {
    get: vi.fn(),
    delete: vi.fn(),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock('@/utils/debugbundle', () => ({
    captureDebugBundleIncident: captureDebugBundleIncidentSpy,
}));

describe('googleAuthStorage', () => {

    let consoleErrorSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockDb.transaction.mockReturnValue({
            store: mockSessionStore,
            done: Promise.resolve(),
        });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        consoleErrorSpy?.mockRestore();
    });

    describe('legacy token cleanup', () => {

        it('deletes the retired persisted access-token record', async () => {
            await clearLegacyStoredToken();

            expect(mockDb.delete).toHaveBeenCalledWith('app-data', 'google-auth-token');
            expect(mockDb.put).not.toHaveBeenCalled();
        });

        it('reports cleanup failure without exposing credential data', async () => {
            mockDb.delete.mockRejectedValue(new Error('DB error'));

            await expect(clearLegacyStoredToken()).resolves.toBeUndefined();
            expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
                incidentKey: 'auth.token_storage_clear_failed',
                context: { operation: 'clear', storageKind: 'token' },
            }));
        });
    });

    describe('session storage', () => {

        it('returns stored session when exists', async () => {
            const storedSession = {
                sessionId: 'session-1',
                userId: 'user-1',
                email: 'person@example.com',
                createdAt: new Date('2026-01-19T12:00:00Z').toISOString(),
            };
            mockDb.get.mockResolvedValue(storedSession);

            const result = await getStoredSession();

            expect(result).toEqual(storedSession);
        });

        it('returns null when no session stored', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const result = await getStoredSession();

            expect(result).toBeNull();
        });

        it('returns null on session read error', async () => {
            mockDb.get.mockRejectedValue(new Error('DB error'));

            const result = await getStoredSession();

            expect(result).toBeNull();
            expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
                incidentKey: 'auth.session_storage_read_failed',
            }));
        });

        it('stores session in IndexedDB', async () => {
            const session = {
                sessionId: 'session-2',
                userId: 'user-2',
                email: 'person2@example.com',
                createdAt: new Date('2026-01-20T12:00:00Z').toISOString(),
            };

            await storeSession(session);

            expect(mockDb.put).toHaveBeenCalledWith('app-data', session, 'google-auth-session');
        });

        it('handles session write errors gracefully', async () => {
            mockDb.put.mockRejectedValue(new Error('session write failed'));

            await expect(storeSession({
                sessionId: 'session-3',
                userId: 'user-3',
                email: 'person3@example.com',
                createdAt: new Date('2026-01-21T12:00:00Z').toISOString(),
            })).resolves.toBeUndefined();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error saving session to IndexedDB:',
                expect.any(Error)
            );
            expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
                incidentKey: 'auth.session_storage_write_failed',
            }));
        });

        it('clears session in IndexedDB', async () => {
            await clearStoredSession();

            expect(mockSessionStore.delete).toHaveBeenCalledWith('google-auth-session');
        });

        it('clears only the expected session so a stale tab cannot delete a replacement', async () => {
            mockSessionStore.get.mockResolvedValueOnce({ sessionId: 'new-session' });

            await expect(clearStoredSession('old-session')).resolves.toBe(false);

            expect(mockSessionStore.delete).not.toHaveBeenCalled();
        });

        it('clears a matching expected session', async () => {
            mockSessionStore.get.mockResolvedValueOnce({ sessionId: 'current-session' });

            await expect(clearStoredSession('current-session')).resolves.toBe(true);

            expect(mockSessionStore.delete).toHaveBeenCalledWith('google-auth-session');
        });

        it('handles session clear errors gracefully', async () => {
            mockDb.transaction.mockImplementationOnce(() => {
                throw new Error('session clear failed');
            });

            await expect(clearStoredSession()).resolves.toBe(false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error clearing session from IndexedDB:',
                expect.any(Error)
            );
            expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
                incidentKey: 'auth.session_storage_clear_failed',
            }));
        });
    });
});
