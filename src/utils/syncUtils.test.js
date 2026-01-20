import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChecksum, getDeviceId } from './syncUtils';

// Mock IndexedDB
const mockDb = {
    get: vi.fn(),
    put: vi.fn(),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

describe('syncUtils', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateChecksum', () => {

        it('produces the same checksum for identical data', async () => {
            const data1 = { a: 1, b: 2 };
            const data2 = { a: 1, b: 2 };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('produces the same checksum regardless of key order', async () => {
            const data1 = { a: 1, b: 2, c: 3 };
            const data2 = { c: 3, a: 1, b: 2 };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('produces different checksums for different data', async () => {
            const data1 = { a: 1 };
            const data2 = { a: 2 };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).not.toBe(checksum2);
        });

        it('excludes _sync key from checksum', async () => {
            const data1 = { a: 1, _sync: { lastSyncedAt: 1000 } };
            const data2 = { a: 1, _sync: { lastSyncedAt: 2000 } };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('excludes version and exportedAt from checksum', async () => {
            const data1 = { a: 1, version: 1, exportedAt: 1000 };
            const data2 = { a: 1, version: 2, exportedAt: 2000 };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('handles nested objects correctly', async () => {
            const data1 = { nested: { x: 1, y: 2 } };
            const data2 = { nested: { y: 2, x: 1 } };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('handles arrays correctly', async () => {
            const data1 = { items: [1, 2, 3] };
            const data2 = { items: [1, 2, 3] };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).toBe(checksum2);
        });

        it('array order matters', async () => {
            const data1 = { items: [1, 2, 3] };
            const data2 = { items: [3, 2, 1] };

            const checksum1 = await generateChecksum(data1);
            const checksum2 = await generateChecksum(data2);

            expect(checksum1).not.toBe(checksum2);
        });
    });

    describe('getDeviceId', () => {

        it('returns stored device ID if exists', async () => {
            mockDb.get.mockResolvedValue('existing-device-id');

            const deviceId = await getDeviceId();

            expect(deviceId).toBe('existing-device-id');
            expect(mockDb.put).not.toHaveBeenCalled();
        });

        it('generates and stores new device ID if none exists', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const deviceId = await getDeviceId();

            expect(deviceId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
            expect(mockDb.put).toHaveBeenCalledWith('app-data', deviceId, 'device-id');
        });
    });
});
