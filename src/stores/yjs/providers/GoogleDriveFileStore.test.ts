import { afterEach, describe, expect, it, vi } from 'vitest';

import { CloudFileStoreError } from './CloudFileStore';
import { GoogleDriveFileStore } from './GoogleDriveFileStore';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        ...init,
    });
}

describe('GoogleDriveFileStore cloud contract', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('implements the provider-neutral metadata and object lifecycle without proxy fallback', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                files: [
                    {
                        id: 'manifest-id',
                        name: 'tasktime-yjs-manifest.json',
                        modifiedTime: '2026-08-19T08:00:00.000Z',
                    },
                    {
                        id: 'backup-id',
                        name: 'tasktime-backup-2026-08-19-0800.json',
                        modifiedTime: '2026-08-19T08:00:01.000Z',
                    },
                ],
            }))
            .mockResolvedValueOnce(jsonResponse({ modifiedTime: '2026-08-19T08:00:00.000Z' }))
            .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
            .mockResolvedValueOnce(jsonResponse({ ids: ['created-id'] }))
            .mockResolvedValueOnce(jsonResponse({ id: 'created-id' }))
            .mockResolvedValueOnce(jsonResponse({ modifiedTime: '2026-08-19T08:01:00.000Z' }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({
            transport: 'direct',
            accessToken: 'google-access-token-fixture',
        });

        expect(store.provider).toBe('google-drive');

        const syncObjects = await store.list('sync');
        expect(syncObjects).toStrictEqual([{
            logicalName: 'tasktime-yjs-manifest.json',
            opaqueId: 'manifest-id',
            modifiedTime: '2026-08-19T08:00:00.000Z',
        }]);

        const manifest = await store.getMetadata('sync', 'tasktime-yjs-manifest.json');
        expect(manifest).toStrictEqual(syncObjects[0]);
        expect(fetchMock.mock.calls[1][0]).toBe(
            'https://www.googleapis.com/drive/v3/files/manifest-id?fields=modifiedTime',
        );

        await expect(store.download(manifest!)).resolves.toStrictEqual(
            new Uint8Array([1, 2, 3]).buffer,
        );

        const created = await store.create(
            'sync',
            'tasktime-yjs-core.bin',
            new Blob(['state'], { type: 'application/octet-stream' }),
        );
        expect(created).toMatchObject({
            logicalName: 'tasktime-yjs-core.bin',
            opaqueId: 'created-id',
        });

        const replaced = await store.replace(
            created,
            new Blob(['next-state'], { type: 'application/octet-stream' }),
        );
        expect(replaced).toMatchObject({
            logicalName: 'tasktime-yjs-core.bin',
            opaqueId: 'created-id',
            modifiedTime: '2026-08-19T08:01:00.000Z',
        });

        await expect(store.delete(replaced)).resolves.toBeUndefined();
        expect(fetchMock.mock.calls.filter(([url]) => (
            String(url).startsWith('https://sync.tasktime.pro/drive/')
        ))).toHaveLength(0);
    });

    it('normalizes provider failures without retaining an upstream response body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            error: {
                errors: [{ reason: 'storageQuotaExceeded' }],
                message: 'private provider payload',
            },
        }, { status: 403 })));
        const store = new GoogleDriveFileStore({
            transport: 'direct',
            accessToken: 'google-access-token-fixture',
        });

        const error = await store.list('sync').catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(CloudFileStoreError);
        expect(error).toMatchObject({
            code: 'insufficient-storage',
            provider: 'google-drive',
        });
        expect((error as Error).message).not.toContain('private provider payload');
    });
});
