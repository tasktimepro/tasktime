import { afterEach, describe, expect, it, vi } from 'vitest';

import { CloudFileStoreError } from './CloudFileStore';
import { DriveAccessTokenError } from './DriveAccessTokenProvider';
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
        vi.useRealTimers();
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

    it.each(['response lost', 'fileIdInUse', 'server error'])(
        'recovers an accepted create after %s using the application-data space',
        async failure => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }));
            if (failure === 'response lost') {
                fetchMock.mockRejectedValueOnce(new TypeError('response lost'));
            } else {
                fetchMock.mockResolvedValueOnce(jsonResponse({
                    error: { errors: [{ reason: failure === 'fileIdInUse' ? 'fileIdInUse' : 'backendError' }] },
                }, { status: failure === 'fileIdInUse' ? 409 : 503 }));
            }
            fetchMock.mockResolvedValueOnce(jsonResponse({
                id: 'allocated-id',
                name: 'tasktime-yjs-core-delta-recovery.bin',
                mimeType: 'application/octet-stream',
                parents: ['opaque-application-data-folder-id'],
                spaces: ['appDataFolder'],
                trashed: false,
            })).mockResolvedValueOnce(new Response('pending-update'));
            vi.stubGlobal('fetch', fetchMock);
            const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });

            await expect(store.create(
                'sync',
                'tasktime-yjs-core-delta-recovery.bin',
                new Blob(['pending-update'], { type: 'application/octet-stream' }),
            )).resolves.toMatchObject({
                logicalName: 'tasktime-yjs-core-delta-recovery.bin',
                opaqueId: 'allocated-id',
            });

            expect(fetchMock).toHaveBeenCalledTimes(4);
            expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
            const readback = new URL(fetchMock.mock.calls[2][0]);
            expect(readback.pathname).toBe('/drive/v3/files/allocated-id');
            expect(readback.searchParams.get('fields')?.split(',')).toContain('spaces');
            expect(fetchMock.mock.calls[3][0]).toBe('https://www.googleapis.com/drive/v3/files/allocated-id?alt=media');
        },
    );

    it.each(['metadata', 'content'])('bounds a stalled recovery %s response body and keeps the allocated ID', async stalledRead => {
        vi.useFakeTimers();
        let readSignal: AbortSignal | undefined;
        const stalledBody = (signal: AbortSignal) => {
            readSignal = signal;
            return new Promise<never>((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Read aborted', 'AbortError')), { once: true });
            });
        };
        const metadata = {
            id: 'allocated-id', name: 'tasktime-yjs-core.bin',
            mimeType: 'application/octet-stream', spaces: ['appDataFolder'], trashed: false,
        };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
            .mockResolvedValueOnce(jsonResponse({}, { status: 409 }))
            .mockImplementationOnce(async (_url, options) => stalledRead === 'metadata'
                ? { ok: true, json: () => stalledBody(options.signal) }
                : jsonResponse(metadata));
        if (stalledRead === 'content') {
            fetchMock.mockImplementationOnce(async (_url, options) => ({
                ok: true, arrayBuffer: () => stalledBody(options.signal),
            }));
        }
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });
        const body = new Blob(['pending-update'], { type: 'application/octet-stream' });
        let result: unknown;
        const operation = store.create('sync', 'tasktime-yjs-core.bin', body)
            .then(value => { result = value; }, error => { result = error; });

        await vi.advanceTimersByTimeAsync(30_000);
        expect(readSignal?.aborted).toBe(true);
        expect(result).toMatchObject({ code: 'transient-unavailable' });
        await operation;
        expect(vi.getTimerCount()).toBe(0);
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'allocated-id' }));
        await expect(store.create('sync', 'tasktime-yjs-core.bin', body)).resolves.toMatchObject({ opaqueId: 'allocated-id' });
        expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/upload/drive/v3/files?uploadType=multipart');
    });

    it.each([
        ['different file ID', { id: 'other-id' }],
        ['different name', { name: 'other-file.bin' }],
        ['different MIME type', { mimeType: 'text/plain' }],
        ['ordinary Drive space', { spaces: ['drive'] }],
        ['missing space', { spaces: undefined }],
        ['malformed space', { spaces: 'appDataFolder' }],
        ['empty spaces', { spaces: [] }],
        ['trashed file', { trashed: true }],
    ])('refuses create recovery with %s without replaying the upload', async (_label, mismatch) => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
            .mockResolvedValueOnce(jsonResponse({
                error: { errors: [{ reason: 'fileIdInUse' }] },
            }, { status: 409 }))
            .mockResolvedValueOnce(jsonResponse({
                id: 'allocated-id',
                name: 'tasktime-yjs-core-delta-recovery.bin',
                mimeType: 'application/octet-stream',
                // A parent alias must never substitute for verified space membership.
                parents: ['appDataFolder'],
                spaces: ['appDataFolder'],
                trashed: false,
                ...mismatch,
            }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });

        await expect(store.create(
            'sync',
            'tasktime-yjs-core-delta-recovery.bin',
            new Blob(['pending-update'], { type: 'application/octet-stream' }),
        )).rejects.toMatchObject({ code: 'conflict', provider: 'google-drive' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each([401, 403])('refreshes expired upload authorization once after HTTP %s using the same file ID', async status => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
            .mockResolvedValueOnce(jsonResponse({
                error: { errors: [{ reason: 'insufficientPermissions' }] },
            }, { status }))
            .mockResolvedValueOnce(jsonResponse({ id: 'allocated-id', modifiedTime: '2026-10-15T10:00:00Z' }));
        vi.stubGlobal('fetch', fetchMock);
        const tokenProvider = { getToken: vi.fn(async () => 'token-fixture'), clearToken: vi.fn() };
        const store = new GoogleDriveFileStore({ transport: 'direct', tokenProvider });

        await expect(store.create('sync', 'tasktime-yjs-core.bin', new Blob(['state']))).resolves.toMatchObject({
            opaqueId: 'allocated-id', modifiedTime: '2026-10-15T10:00:00Z',
        });
        expect(tokenProvider.clearToken).toHaveBeenCalledTimes(1);
        expect(tokenProvider.getToken).toHaveBeenLastCalledWith({ forceRefresh: true });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
    });

    it.each(['SESSION_NOT_FOUND', 'DIRECT_TRANSPORT_DISABLED', 'TOKEN_SERVICE_UNAVAILABLE'])(
        'does not reconcile or upload when token acquisition fails with %s',
        async code => {
            const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }));
            vi.stubGlobal('fetch', fetchMock);
            const tokenProvider = {
                getToken: vi.fn()
                    .mockResolvedValueOnce('token-fixture')
                    .mockRejectedValueOnce(new DriveAccessTokenError(code, 'Token unavailable')),
                clearToken: vi.fn(),
            };
            const store = new GoogleDriveFileStore({ transport: 'direct', tokenProvider });

            await expect(store.create('sync', 'tasktime-yjs-core.bin', new Blob(['state']))).rejects.toMatchObject({
                code: code === 'SESSION_NOT_FOUND' ? 'unauthenticated'
                    : code === 'DIRECT_TRANSPORT_DISABLED' ? 'policy-disabled' : code,
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(tokenProvider.clearToken).not.toHaveBeenCalled();
        },
    );

    it('retains the allocated ID after a lost upload response and absent readback for the next explicit attempt', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
            .mockRejectedValueOnce(new TypeError('response lost'))
            .mockResolvedValueOnce(jsonResponse({}, { status: 404 }))
            .mockResolvedValueOnce(jsonResponse({ id: 'allocated-id' }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });
        const body = new Blob(['pending-update'], { type: 'application/octet-stream' });

        await expect(store.create('sync', 'tasktime-yjs-core.bin', body)).rejects.toMatchObject({
            code: 'transient-unavailable',
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await expect(store.create('sync', 'tasktime-yjs-core.bin', body)).resolves.toMatchObject({ opaqueId: 'allocated-id' });
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock.mock.calls[3][1].method).toBe('POST');
    });

    it('does not acknowledge newer bytes when a reused allocated ID contains an earlier upload', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
            .mockRejectedValueOnce(new TypeError('response lost'))
            .mockResolvedValueOnce(jsonResponse({}, { status: 404 }))
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'fileIdInUse' }] } }, { status: 409 }))
            .mockResolvedValueOnce(jsonResponse({
                id: 'allocated-id',
                name: 'tasktime-yjs-core.bin',
                mimeType: 'application/octet-stream',
                spaces: ['appDataFolder'],
                trashed: false,
            }))
            .mockResolvedValueOnce(new Response('old-state'));
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });

        await expect(store.create('sync', 'tasktime-yjs-core.bin',
            new Blob(['old-state'], { type: 'application/octet-stream' }),
        )).rejects.toMatchObject({ code: 'transient-unavailable' });
        await expect(store.create('sync', 'tasktime-yjs-core.bin',
            new Blob(['new-state'], { type: 'application/octet-stream' }),
        )).rejects.toMatchObject({ code: 'conflict' });
        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2);
    });

    it.each(['different length', 'media unavailable', 'local body unreadable'])(
        'does not acknowledge an ambiguous upload when content verification fails: %s',
        async failure => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(jsonResponse({ ids: ['allocated-id'] }))
                .mockResolvedValueOnce(jsonResponse({}, { status: 409 }))
                .mockResolvedValueOnce(jsonResponse({
                    id: 'allocated-id', name: 'tasktime-yjs-core.bin',
                    mimeType: 'application/octet-stream', spaces: ['appDataFolder'], trashed: false,
                }))
                .mockResolvedValueOnce(failure === 'media unavailable'
                    ? jsonResponse({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, { status: 403 })
                    : new Response(failure === 'different length' ? 'short' : 'pending-update'));
            if (failure === 'local body unreadable') {
                vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
                    Object.defineProperty(this, 'error', { value: new Error('fixture read failure') });
                    this.dispatchEvent(new Event('error'));
                });
            }
            vi.stubGlobal('fetch', fetchMock);
            const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });

            await expect(store.create('sync', 'tasktime-yjs-core.bin',
                new Blob(['pending-update'], { type: 'application/octet-stream' }),
            )).rejects.toBeInstanceOf(Error);
            expect(fetchMock).toHaveBeenCalledTimes(4);
            expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
            // Failure cannot publish this object to the metadata cache.
            fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] }));
            await expect(store.getMetadata('sync', 'tasktime-yjs-core.bin')).resolves.toBeNull();
            expect(new URL(fetchMock.mock.calls[4][0]).pathname).toBe('/drive/v3/files');
        },
    );

    it.each([
        ['missing allocation', { ids: [] }, null, 1],
        ['unexpected successful file ID', { ids: ['allocated-id'] }, { id: 'other-id' }, 2],
    ])('rejects %s without attempting recovery writes', async (_label, allocation, uploaded, requests) => {
        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(allocation));
        if (uploaded) fetchMock.mockResolvedValueOnce(jsonResponse(uploaded));
        vi.stubGlobal('fetch', fetchMock);
        const store = new GoogleDriveFileStore({ transport: 'direct', accessToken: 'token-fixture' });

        await expect(store.create('sync', 'tasktime-yjs-core.bin', new Blob(['state']))).rejects.toMatchObject({
            code: 'invalid-response',
        });
        expect(fetchMock).toHaveBeenCalledTimes(requests);
    });
});
