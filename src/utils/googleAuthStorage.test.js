import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTokenExpired, getStoredToken, storeToken, clearStoredToken } from './googleAuthStorage';

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

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
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
});
