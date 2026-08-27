import { afterEach, describe, expect, it, vi } from 'vitest';

import { CloudFileStoreError, type CloudObjectMetadata } from './CloudFileStore';
import { DropboxAccessTokenError } from './DropboxAccessTokenProvider';
import { DropboxFileStore, calculateDropboxContentHash } from './DropboxFileStore';

const tokenProvider = {
    getToken: vi.fn().mockResolvedValue('dropbox-access-token-fixture'),
    clearToken: vi.fn(),
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return Response.json(body, init);
}

function fileMetadata(overrides: Record<string, unknown> = {}) {
    return {
        '.tag': 'file',
        id: 'id:manifest-fixture',
        name: 'tasktime-yjs-manifest.json',
        path_lower: '/sync/tasktime-yjs-manifest.json',
        path_display: '/sync/tasktime-yjs-manifest.json',
        server_modified: '2026-08-19T10:00:00Z',
        rev: 'a1c10ce0dd78',
        size: 5,
        content_hash: 'hash-fixture',
        ...overrides,
    };
}

describe('DropboxFileStore direct cloud contract', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        tokenProvider.getToken.mockReset().mockResolvedValue('dropbox-access-token-fixture');
        tokenProvider.clearToken.mockReset();
    });

    it('paginates one physical namespace and maps only file metadata', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                entries: [
                    fileMetadata(),
                    { '.tag': 'folder', id: 'id:folder', name: 'nested', path_lower: '/sync/nested' },
                ],
                cursor: 'cursor-fixture',
                has_more: true,
            }))
            .mockResolvedValueOnce(jsonResponse({
                entries: [fileMetadata({
                    '.tag': undefined,
                    id: 'id:core-fixture',
                    name: 'tasktime-yjs-core.bin',
                    path_lower: '/sync/tasktime-yjs-core.bin',
                    rev: 'b1c10ce0dd79',
                })],
                cursor: 'finished-cursor',
                has_more: false,
            }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.list('sync')).resolves.toEqual([
            expect.objectContaining({
                logicalName: 'tasktime-yjs-manifest.json',
                opaqueId: 'id:manifest-fixture',
                revision: 'a1c10ce0dd78',
            }),
            expect.objectContaining({
                logicalName: 'tasktime-yjs-core.bin',
                opaqueId: 'id:core-fixture',
                revision: 'b1c10ce0dd79',
            }),
        ]);
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/list_folder',
            'https://api.dropboxapi.com/2/files/list_folder/continue',
        ]);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
            path: '/sync',
            recursive: false,
        });
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            cursor: 'cursor-fixture',
        });
    });

    it('shares concurrent identical namespace listings', async () => {
        let resolveList!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
            resolveList = resolve;
        }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        const first = store.list('sync');
        const second = store.list('sync');
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledOnce();
        resolveList(jsonResponse({ entries: [], cursor: 'done', has_more: false }));

        await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('returns null for a missing exact path without listing the folder', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            error_summary: 'path/not_found/',
            error: { '.tag': 'path', path: { '.tag': 'not_found' } },
        }, { status: 409 })));
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.getMetadata('sync', 'tasktime-yjs-core.bin')).resolves.toBeNull();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.dropboxapi.com/2/files/get_metadata',
            expect.objectContaining({
                body: JSON.stringify({
                    path: '/sync/tasktime-yjs-core.bin',
                    include_deleted: false,
                }),
            }),
        );
    });

    it('downloads directly, verifies Dropbox content hash, and never calls the Worker', async () => {
        const bytes = new TextEncoder().encode('state');
        const contentHash = await calculateDropboxContentHash(new Blob([bytes]));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, {
            headers: {
                'Dropbox-API-Result': JSON.stringify(fileMetadata({
                    id: 'id:core-fixture',
                    name: 'tasktime-yjs-core.bin',
                    path_lower: '/sync/tasktime-yjs-core.bin',
                    content_hash: contentHash,
                })),
            },
        })));
        const store = new DropboxFileStore({ tokenProvider });
        const object: CloudObjectMetadata = {
            logicalName: 'tasktime-yjs-core.bin',
            opaqueId: 'id:core-fixture',
            modifiedTime: '2026-08-19T10:00:00Z',
            contentHash,
        };

        await expect(store.download(object)).resolves.toEqual(bytes.buffer);
        expect(fetch).toHaveBeenCalledWith(
            'https://content.dropboxapi.com/2/files/download',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer dropbox-access-token-fixture',
                    'Dropbox-API-Arg': JSON.stringify({ path: 'id:core-fixture' }),
                }),
            }),
        );
        expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('sync.tasktime.pro');
    });

    it('matches Dropbox content hashing for an empty file', async () => {
        await expect(calculateDropboxContentHash(new Blob())).resolves.toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        );
    });

    it('rejects stale download metadata and corrupted bytes', async () => {
        const bytes = new TextEncoder().encode('state');
        const object: CloudObjectMetadata = {
            logicalName: 'tasktime-yjs-core.bin',
            opaqueId: 'id:core-fixture',
            modifiedTime: '2026-08-19T10:00:00Z',
            revision: 'a1c10ce0dd78',
        };
        const response = (metadata: Record<string, unknown>) => new Response(bytes, {
            headers: { 'Dropbox-API-Result': JSON.stringify(fileMetadata(metadata)) },
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response({
                id: 'id:core-fixture',
                name: 'tasktime-yjs-core.bin',
                path_lower: '/sync/tasktime-yjs-core.bin',
                rev: 'b1c10ce0dd79',
            }))
            .mockResolvedValueOnce(response({
                id: 'id:core-fixture',
                name: 'tasktime-yjs-core.bin',
                path_lower: '/sync/tasktime-yjs-core.bin',
                content_hash: '0'.repeat(64),
            }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.download(object)).rejects.toMatchObject({ code: 'conflict' });
        await expect(store.download({ ...object, revision: undefined })).rejects.toMatchObject({
            code: 'invalid-response',
        });
    });

    it('creates and conditionally replaces small files with strict non-autorename writes', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({
                rev: 'b1c10ce0dd79',
                content_hash: hash,
            })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        const created = await store.create('sync', 'tasktime-yjs-manifest.json', body);
        const replaced = await store.replace(created, body, created.revision);

        const createArgs = JSON.parse(String(fetchMock.mock.calls[1][1]?.headers['Dropbox-API-Arg']));
        expect(createArgs).toMatchObject({
            path: '/sync/tasktime-yjs-manifest.json',
            mode: 'add',
            autorename: false,
            strict_conflict: true,
            content_hash: hash,
        });
        const replaceArgs = JSON.parse(String(fetchMock.mock.calls[2][1]?.headers['Dropbox-API-Arg']));
        expect(replaceArgs.mode).toEqual({ '.tag': 'update', update: 'a1c10ce0dd78' });
        expect(replaced.revision).toBe('b1c10ce0dd79');
    });

    it('accepts the untagged FileMetadata returned after a successful upload', async () => {
        const body = new Blob(['state']);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({
                '.tag': undefined,
                path_lower: undefined,
                content_hash: undefined,
            })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create(
            'sync',
            'tasktime-yjs-manifest.json',
            body,
        )).resolves.toMatchObject({
            opaqueId: 'id:manifest-fixture',
        });
    });

    it('rejects a conflicting upload content hash when Dropbox returns one', async () => {
        const body = new Blob(['state']);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({
                content_hash: '0'.repeat(64),
            })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create(
            'sync',
            'tasktime-yjs-manifest.json',
            body,
        )).rejects.toMatchObject({
            code: 'invalid-response',
            provider: 'dropbox',
        });
    });

    it('reuses a verified namespace instead of spending one metadata request per upload', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({
                id: 'id:core-fixture',
                name: 'tasktime-yjs-core.bin',
                path_lower: '/sync/tasktime-yjs-core.bin',
                content_hash: hash,
            })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await store.create('sync', 'tasktime-yjs-manifest.json', body);
        await store.create('sync', 'tasktime-yjs-core.bin', body);

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://content.dropboxapi.com/2/files/upload',
            'https://content.dropboxapi.com/2/files/upload',
        ]);
    });

    it('accepts the untagged FolderMetadata returned when creating a missing namespace', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const missing = jsonResponse({
            error_summary: 'path/not_found/',
            error: { '.tag': 'path', path: { '.tag': 'not_found' } },
        }, { status: 409 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(missing)
            .mockResolvedValueOnce(jsonResponse({
                metadata: {
                    id: 'id:sync-folder',
                    name: 'sync',
                    path_display: '/sync',
                },
            }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create(
            'sync',
            'tasktime-yjs-manifest.json',
            body,
        )).resolves.toMatchObject({ contentHash: hash });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://api.dropboxapi.com/2/files/create_folder_v2',
            'https://content.dropboxapi.com/2/files/upload',
        ]);
    });

    it('accepts an existing namespace whose FolderMetadata omits the optional tag', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                id: 'id:sync-folder',
                name: 'sync',
                path_lower: '/sync',
                path_display: '/sync',
            }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create(
            'sync',
            'tasktime-yjs-manifest.json',
            body,
        )).resolves.toMatchObject({ contentHash: hash });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://content.dropboxapi.com/2/files/upload',
        ]);
    });

    it('checks the expected revision immediately before delete', async () => {
        const object = {
            logicalName: 'tasktime-yjs-manifest.json',
            opaqueId: 'id:manifest-fixture',
            modifiedTime: '2026-08-19T10:00:00Z',
            revision: 'a1c10ce0dd78',
        };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse(fileMetadata()))
            .mockResolvedValueOnce(jsonResponse({ metadata: fileMetadata() }));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.delete(object, object.revision)).resolves.toBeUndefined();
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://api.dropboxapi.com/2/files/delete_v2',
        ]);
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            path: 'id:manifest-fixture',
        });
    });

    it('uses resumable upload sessions above the configured direct-upload threshold', async () => {
        const body = new Blob(['abcdefghij']);
        const hash = await calculateDropboxContentHash(body);
        const firstChunkHash = await calculateDropboxContentHash(new Blob(['abcd']));
        const secondChunkHash = await calculateDropboxContentHash(new Blob(['efgh']));
        const finalChunkHash = await calculateDropboxContentHash(new Blob(['ij']));
        const emptyHash = await calculateDropboxContentHash(new Blob());
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockResolvedValueOnce(jsonResponse({ session_id: 'upload-session-fixture' }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({
                id: 'id:core-fixture',
                name: 'tasktime-yjs-core.bin',
                path_lower: '/sync/tasktime-yjs-core.bin',
                content_hash: hash,
                size: 10,
            })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({
            tokenProvider,
            uploadSessionThresholdBytes: 4,
            uploadChunkBytes: 4,
        });

        await expect(store.create('sync', 'tasktime-yjs-core.bin', body)).resolves.toMatchObject({
            opaqueId: 'id:core-fixture',
            contentHash: hash,
        });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://content.dropboxapi.com/2/files/upload_session/start',
            'https://content.dropboxapi.com/2/files/upload_session/append_v2',
            'https://content.dropboxapi.com/2/files/upload_session/append_v2',
            'https://content.dropboxapi.com/2/files/upload_session/finish',
        ]);
        const startArgs = JSON.parse(String(fetchMock.mock.calls[1][1]?.headers['Dropbox-API-Arg']));
        const firstAppendArgs = JSON.parse(String(fetchMock.mock.calls[2][1]?.headers['Dropbox-API-Arg']));
        const secondAppendArgs = JSON.parse(String(fetchMock.mock.calls[3][1]?.headers['Dropbox-API-Arg']));
        const finishArgs = JSON.parse(String(fetchMock.mock.calls[4][1]?.headers['Dropbox-API-Arg']));
        expect(startArgs).toMatchObject({ close: false, content_hash: firstChunkHash });
        expect(firstAppendArgs).toMatchObject({ content_hash: secondChunkHash });
        expect(secondAppendArgs).toMatchObject({ content_hash: finalChunkHash });
        expect(finishArgs).toMatchObject({
            cursor: { session_id: 'upload-session-fixture', offset: 10 },
            content_hash: emptyHash,
            commit: {
                path: '/sync/tasktime-yjs-core.bin',
                mode: 'add',
                autorename: false,
                strict_conflict: true,
            },
        });
    });

    it('reconciles an ambiguous create by exact path and content hash', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ '.tag': 'folder', id: 'id:sync-folder' }))
            .mockRejectedValueOnce(new TypeError('network outcome unknown'))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create('sync', 'tasktime-yjs-manifest.json', body)).resolves.toMatchObject({
            contentHash: hash,
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('accepts a namespace created concurrently by another tab', async () => {
        const body = new Blob(['state']);
        const hash = await calculateDropboxContentHash(body);
        const missing = jsonResponse({
            error_summary: 'path/not_found/',
            error: { '.tag': 'path', path: { '.tag': 'not_found' } },
        }, { status: 409 });
        const conflict = jsonResponse({
            error_summary: 'path/conflict/folder/',
            error: { '.tag': 'path', path: { '.tag': 'conflict', conflict: { '.tag': 'folder' } } },
        }, { status: 409 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(missing)
            .mockResolvedValueOnce(conflict)
            .mockResolvedValueOnce(jsonResponse({
                id: 'id:sync-folder',
                name: 'sync',
                path_lower: '/sync',
                path_display: '/sync',
            }))
            .mockResolvedValueOnce(jsonResponse(fileMetadata({ content_hash: hash })));
        vi.stubGlobal('fetch', fetchMock);
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.create('sync', 'tasktime-yjs-manifest.json', body)).resolves.toMatchObject({
            contentHash: hash,
        });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://api.dropboxapi.com/2/files/create_folder_v2',
            'https://api.dropboxapi.com/2/files/get_metadata',
            'https://content.dropboxapi.com/2/files/upload',
        ]);
    });

    it.each([
        { status: 403, body: {}, code: 'missing-scope' },
        { status: 507, body: { error: { '.tag': 'insufficient_space' } }, code: 'insufficient-storage' },
    ])('normalizes Dropbox metadata failure $status as $code', async ({ status, body, code }) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body, { status })));
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.getMetadata('sync', 'tasktime-yjs-core.bin')).rejects.toMatchObject({
            code,
            provider: 'dropbox',
        });
    });

    it('refreshes once after a Dropbox 401 and then requires reconnect', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
        const store = new DropboxFileStore({ tokenProvider });

        await expect(store.getMetadata('sync', 'tasktime-yjs-core.bin')).rejects.toMatchObject({
            code: 'unauthenticated',
        });
        expect(tokenProvider.clearToken).toHaveBeenCalledOnce();
        expect(tokenProvider.getToken).toHaveBeenLastCalledWith({ forceRefresh: true });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each([
        { tokenCode: 'MISSING_REQUIRED_SCOPE', code: 'missing-scope' },
        { tokenCode: 'PROVIDER_DISABLED', code: 'policy-disabled' },
        { tokenCode: 'SESSION_PROVIDER_MISMATCH', code: 'unauthenticated' },
        { tokenCode: 'RATE_LIMITED', code: 'rate-limited' },
    ])('maps token failure $tokenCode as $code', async ({ tokenCode, code }) => {
        const failingTokenProvider = {
            getToken: vi.fn().mockRejectedValue(new DropboxAccessTokenError(
                tokenCode,
                'sanitized fixture',
                { retryAfterSeconds: 7 },
            )),
            clearToken: vi.fn(),
        };
        const store = new DropboxFileStore({ tokenProvider: failingTokenProvider });

        await expect(store.getMetadata('sync', 'tasktime-yjs-core.bin')).rejects.toMatchObject({
            code,
            provider: 'dropbox',
            ...(code === 'rate-limited' ? { retryAfterMs: 7000 } : {}),
        });
        expect(failingTokenProvider.getToken).toHaveBeenCalledOnce();
    });

    it.each([
        { status: 429, code: 'rate-limited', headers: { 'Retry-After': '1' } },
        { status: 503, code: 'transient-unavailable', headers: {} },
    ])('retries safe metadata failure $status with bounded backoff', async ({ status, code, headers }) => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status, headers })));
        const store = new DropboxFileStore({ tokenProvider });

        const pending = store.getMetadata('sync', 'tasktime-yjs-core.bin');
        const rejection = expect(pending).rejects.toMatchObject({ code, provider: 'dropbox' });
        await vi.runAllTimersAsync();

        await rejection;
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('normalizes provider failures without exposing upstream bodies or account paths', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            error_summary: 'path/conflict/file/private-name-fixture',
            error: { '.tag': 'path', path: { '.tag': 'conflict' } },
        }, { status: 409 })));
        const store = new DropboxFileStore({ tokenProvider });

        const error = await store.create(
            'sync',
            'tasktime-yjs-core.bin',
            new Blob(['state']),
        ).catch(caught => caught);

        expect(error).toBeInstanceOf(CloudFileStoreError);
        expect(error).toMatchObject({ code: 'conflict', provider: 'dropbox' });
        expect(error.message).not.toContain('private-name-fixture');
        expect(error.message).not.toContain('/sync/');
    });
});
