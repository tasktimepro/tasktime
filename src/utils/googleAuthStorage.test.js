import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTokenExpired, getStoredToken, storeToken, clearStoredToken, getTokenTimeRemaining } from './googleAuthStorage';
import { getStoredSession, storeSession, clearStoredSession } from './googleAuthStorage';

// Mock IndexedDB
const mockDb = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

describe('googleAuthStorage', () => {

    let consoleErrorSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        consoleErrorSpy?.mockRestore();
    });

    describe('isTokenExpired', () => {

        it('returns true for null token', () => {
            expect(isTokenExpired(null)).toBe(true);
        });

        it('returns true for token without expiresAt', () => {
            const token = { accessToken: 'abc' };
            expect(isTokenExpired(token)).toBe(true);
        });

        it('returns true for expired token', () => {
            vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));
            
            const token = {
                accessToken: 'abc',
                expiresAt: new Date('2026-01-19T11:00:00Z').getTime(), // 1 hour ago
            };

            expect(isTokenExpired(token)).toBe(true);
        });

        it('returns true when token expires within buffer window (60s)', () => {
            vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));
            
            const token = {
                accessToken: 'abc',
                expiresAt: new Date('2026-01-19T12:00:30Z').getTime(), // 30s from now
            };

            expect(isTokenExpired(token)).toBe(true);
        });

        it('returns false for valid token outside buffer window', () => {
            vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));
            
            const token = {
                accessToken: 'abc',
                expiresAt: new Date('2026-01-19T13:00:00Z').getTime(), // 1 hour from now
            };

            expect(isTokenExpired(token)).toBe(false);
        });
    });

    describe('getStoredToken', () => {

        it('returns stored token when exists', async () => {
            const storedToken = {
                accessToken: 'abc123',
                expiresAt: Date.now() + 3600000,
            };
            mockDb.get.mockResolvedValue(storedToken);

            const result = await getStoredToken();

            expect(result).toEqual(storedToken);
        });

        it('returns null when no token stored', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const result = await getStoredToken();

            expect(result).toBeNull();
        });

        it('returns null on error', async () => {
            mockDb.get.mockRejectedValue(new Error('DB error'));

            const result = await getStoredToken();

            expect(result).toBeNull();
        });
    });

    describe('storeToken', () => {

        it('stores token in IndexedDB', async () => {
            const token = {
                accessToken: 'abc123',
                expiresAt: Date.now() + 3600000,
            };

            await storeToken(token);

            expect(mockDb.put).toHaveBeenCalledWith('app-data', token, 'google-auth-token');
        });

        it('handles errors gracefully', async () => {
            mockDb.put.mockRejectedValue(new Error('DB error'));

            // Should not throw
            await expect(storeToken({ accessToken: 'abc', expiresAt: 1234 })).resolves.toBeUndefined();
        });

        it('logs a quota warning for QuotaExceededError DOMExceptions', async () => {
            const error = new DOMException('Quota hit', 'QuotaExceededError');
            mockDb.put.mockRejectedValue(error);

            await expect(storeToken({ accessToken: 'abc', expiresAt: 1234 })).resolves.toBeUndefined();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'IndexedDB storage quota exceeded while saving auth token. Clear browser data to free space.'
            );
        });

        it('logs a quota warning for storage quota error messages', async () => {
            mockDb.put.mockRejectedValue(new Error('storage quota exceeded'));

            await expect(storeToken({ accessToken: 'abc', expiresAt: 1234 })).resolves.toBeUndefined();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'IndexedDB storage quota exceeded while saving auth token. Clear browser data to free space.'
            );
        });
    });

    describe('clearStoredToken', () => {

        it('deletes token from IndexedDB', async () => {
            await clearStoredToken();

            expect(mockDb.delete).toHaveBeenCalledWith('app-data', 'google-auth-token');
        });

        it('handles errors gracefully', async () => {
            mockDb.delete.mockRejectedValue(new Error('DB error'));

            // Should not throw
            await expect(clearStoredToken()).resolves.toBeUndefined();
        });
    });

    describe('getTokenTimeRemaining', () => {

        it('returns 0 for null token', () => {
            expect(getTokenTimeRemaining(null)).toBe(0);
        });

        it('returns 0 for token without expiresAt', () => {
            const token = { accessToken: 'abc' };
            expect(getTokenTimeRemaining(token)).toBe(0);
        });

        it('returns positive remaining time for valid token', () => {
            vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));

            const token = {
                accessToken: 'abc',
                expiresAt: new Date('2026-01-19T12:10:00Z').getTime(),
            };

            expect(getTokenTimeRemaining(token)).toBe(600000);
        });

        it('clamps remaining time at 0 for expired token', () => {
            vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));

            const token = {
                accessToken: 'abc',
                expiresAt: new Date('2026-01-19T11:59:30Z').getTime(),
            };

            expect(getTokenTimeRemaining(token)).toBe(0);
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
        });

        it('clears session in IndexedDB', async () => {
            await clearStoredSession();

            expect(mockDb.delete).toHaveBeenCalledWith('app-data', 'google-auth-session');
        });

        it('handles session clear errors gracefully', async () => {
            mockDb.delete.mockRejectedValue(new Error('session clear failed'));

            await expect(clearStoredSession()).resolves.toBeUndefined();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error clearing session from IndexedDB:',
                expect.any(Error)
            );
        });
    });
});
