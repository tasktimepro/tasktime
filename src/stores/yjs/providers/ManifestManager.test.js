import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    AuthorizationError,
    ManifestManager,
    isDriveFileNotFoundError,
    mergeConcurrentManifests,
} from './ManifestManager.ts'

function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), {
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        ...init,
    })
}

describe('ManifestManager', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('merges simultaneous writer deltas into one revision regardless of save order', () => {
        const base = {
            version: 1,
            deviceId: 'legacy-device',
            lastSync: '2026-07-11T00:00:00.000Z',
            revision: 4,
            documents: {
                core: {
                    stateFile: 'tasktime-yjs-core.bin',
                    stateVersion: 2,
                    stateModifiedTime: '2026-07-11T00:00:00.000Z',
                    lastCompaction: '2026-07-11T00:00:00.000Z',
                    deltas: [],
                },
            },
        }
        const writerA = structuredClone(base)
        writerA.documents.core.deltas.push({ id: 'writer-a', timestamp: '2026-07-11T00:00:01.000Z' })
        const writerB = structuredClone(base)
        writerB.documents.core.deltas.push({ id: 'writer-b', timestamp: '2026-07-11T00:00:02.000Z' })
        const files = [
            { id: 'base', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-07-11T00:00:00.000Z' },
            { id: 'a', name: 'tasktime-yjs-core-delta-writer-a.bin', modifiedTime: '2026-07-11T00:00:01.000Z' },
            { id: 'b', name: 'tasktime-yjs-core-delta-writer-b.bin', modifiedTime: '2026-07-11T00:00:02.000Z' },
        ]

        const savedByA = mergeConcurrentManifests(base, writerA, files, 'device-a', 'write-a')
        const savedByB = mergeConcurrentManifests(savedByA, writerB, files, 'device-b', 'write-b')

        expect(savedByB.revision).toBe(6)
        expect(savedByB.lastWriterId).toBe('device-b')
        expect(savedByB.documents.core.deltas.map((delta) => delta.id)).toEqual(['writer-a', 'writer-b'])
    })

    it('keeps compaction tombstones from being resurrected by a stale writer', () => {
        const remote = {
            version: 1,
            deviceId: 'legacy-device',
            lastSync: '2026-07-11T00:00:00.000Z',
            revision: 7,
            documents: {
                core: {
                    stateFile: 'tasktime-yjs-core.bin',
                    stateVersion: 3,
                    stateModifiedTime: '2026-07-11T00:00:00.000Z',
                    lastCompaction: '2026-07-11T00:00:00.000Z',
                    deltas: [
                        { id: 'compacted', timestamp: '2026-07-11T00:00:01.000Z' },
                        { id: 'concurrent', timestamp: '2026-07-11T00:00:02.000Z' },
                    ],
                },
            },
        }
        const compactingWriter = structuredClone(remote)
        compactingWriter.documents.core.stateVersion = 4
        compactingWriter.documents.core.stateModifiedTime = '2026-07-11T00:00:03.000Z'
        compactingWriter.documents.core.compactedDeltaIds = ['compacted']
        compactingWriter.documents.core.deltas = [{ id: 'concurrent', timestamp: '2026-07-11T00:00:02.000Z' }]
        const filesAfterCompaction = [
            { id: 'base', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-07-11T00:00:03.000Z' },
            { id: 'concurrent', name: 'tasktime-yjs-core-delta-concurrent.bin', modifiedTime: '2026-07-11T00:00:02.000Z' },
        ]

        const compacted = mergeConcurrentManifests(
            remote,
            compactingWriter,
            filesAfterCompaction,
            'device-a',
            'write-a'
        )
        const staleWriter = structuredClone(remote)
        staleWriter.documents.core.deltas.push({ id: 'new-delta', timestamp: '2026-07-11T00:00:04.000Z' })
        const merged = mergeConcurrentManifests(
            compacted,
            staleWriter,
            [
                ...filesAfterCompaction,
                { id: 'new', name: 'tasktime-yjs-core-delta-new-delta.bin', modifiedTime: '2026-07-11T00:00:04.000Z' },
            ],
            'device-b',
            'write-b'
        )

        expect(merged.documents.core.compactedDeltaIds).toContain('compacted')
        expect(merged.documents.core.deltas.map((delta) => delta.id)).toEqual(['concurrent', 'new-delta'])
    })

    it('re-reads and merges the remote manifest immediately before saving', async () => {
        const manager = new ManifestManager('token-123')
        manager.manifestFileId = 'manifest-id'
        manager.manifest = {
            version: 1,
            deviceId: 'legacy-device',
            lastSync: '2026-07-11T00:00:00.000Z',
            revision: 2,
            documents: {
                core: {
                    stateFile: 'tasktime-yjs-core.bin',
                    stateVersion: 1,
                    lastCompaction: '2026-07-11T00:00:00.000Z',
                    deltas: [{ id: 'local', timestamp: '2026-07-11T00:00:02.000Z' }],
                },
            },
        }
        manager.downloadFileAsJson = vi.fn(async () => ({
            version: 1,
            deviceId: 'legacy-device',
            lastSync: '2026-07-11T00:00:01.000Z',
            revision: 3,
            documents: {
                core: {
                    stateFile: 'tasktime-yjs-core.bin',
                    stateVersion: 1,
                    lastCompaction: '2026-07-11T00:00:00.000Z',
                    deltas: [{ id: 'remote', timestamp: '2026-07-11T00:00:01.000Z' }],
                },
            },
        }))
        manager.listAppDataFiles = vi.fn(async () => ([
            { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-07-11T00:00:03.000Z' },
            { id: 'base', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-07-11T00:00:00.000Z' },
            { id: 'remote', name: 'tasktime-yjs-core-delta-remote.bin', modifiedTime: '2026-07-11T00:00:01.000Z' },
            { id: 'local', name: 'tasktime-yjs-core-delta-local.bin', modifiedTime: '2026-07-11T00:00:02.000Z' },
        ]))
        manager.updateFile = vi.fn(async () => {
            expect(manager.manifest.revision).toBe(4)
            expect(manager.manifest.documents.core.deltas.map((delta) => delta.id)).toEqual(['remote', 'local'])
            return '2026-07-11T00:00:04.000Z'
        })

        await manager.save()

        expect(manager.downloadFileAsJson).toHaveBeenCalledWith('manifest-id')
        expect(manager.listAppDataFiles).toHaveBeenCalledTimes(1)
        expect(manager.updateFile).toHaveBeenCalledTimes(1)
        expect(manager.isDirty()).toBe(false)
    })

    it('retries rate-limited Drive requests using Retry-After before succeeding', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('rate limited', {
                status: 429,
                headers: { 'Retry-After': '2' },
            }))
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.listAppDataFiles()

        await vi.advanceTimersByTimeAsync(2_000)

        await expect(promise).resolves.toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('excludes trashed appData files from file listing and fallback lookup', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')

        await manager.listAppDataFiles()
        await manager.getFileIdWithFallback('tasktime-yjs-core.bin')

        expect(fetchMock.mock.calls[0][0]).toContain('q=trashed%3Dfalse')
        expect(fetchMock.mock.calls[0][0]).toContain('pageSize=1000')
        expect(fetchMock.mock.calls[1][0]).toContain("name%3D'tasktime-yjs-core.bin'%20and%20trashed%3Dfalse")
    })

    it('lists every appData page before returning files', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                files: [{ id: 'file-1', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' }],
                nextPageToken: 'next-page',
            }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({
                files: [{ id: 'file-2', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' }],
            }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')

        await expect(manager.listAppDataFiles()).resolves.toEqual([
            { id: 'file-1', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' },
            { id: 'file-2', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' },
        ])

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[1][0]).toContain('pageToken=next-page')
    })

    it('recovers missing manifest references for existing sync files on load', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                files: [
                    { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' },
                    { id: 'core-state-id', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' },
                    { id: 'core-delta-id', name: 'tasktime-yjs-core-delta-abcd1234.bin', modifiedTime: '2026-06-04T00:00:02.000Z' },
                ],
            }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({
                version: 1,
                deviceId: 'device-1',
                lastSync: '2026-06-04T00:00:00.000Z',
                documents: {},
            }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const manifest = await manager.load()

        expect(manifest.documents.core).toEqual(expect.objectContaining({
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 1,
            deltas: [{ id: 'abcd1234', timestamp: '2026-06-04T00:00:02.000Z' }],
        }))
        expect(manager.isDirty()).toBe(true)
    })

    it('recovers missing delta references during manifest reload', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ modifiedTime: '2026-06-04T00:00:03.000Z' }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({
                version: 1,
                deviceId: 'device-1',
                lastSync: '2026-06-04T00:00:00.000Z',
                documents: {
                    core: {
                        stateFile: 'tasktime-yjs-core.bin',
                        stateVersion: 2,
                        lastCompaction: '2026-06-04T00:00:01.000Z',
                        deltas: [],
                    },
                },
            }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({
                files: [
                    { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:03.000Z' },
                    { id: 'core-state-id', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' },
                    { id: 'core-delta-id', name: 'tasktime-yjs-core-delta-lost9999.bin', modifiedTime: '2026-06-04T00:00:02.000Z' },
                ],
            }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        manager.manifestFileId = 'manifest-id'
        manager.lastManifestModifiedTime = '2026-06-04T00:00:00.000Z'

        const manifest = await manager.reload()

        expect(manifest.documents.core.deltas).toEqual([
            { id: 'lost9999', timestamp: '2026-06-04T00:00:02.000Z' },
        ])
        expect(manager.isDirty()).toBe(true)
    })

    it('identifies Drive file-not-found errors from download and upload paths', () => {
        expect(isDriveFileNotFoundError(new Error('Drive API error 404: {"error":{"message":"File not found: abc."}}'))).toBe(true)
        expect(isDriveFileNotFoundError(new Error('Drive update error 404: {"error":{"message":"File not found: abc."}}'))).toBe(true)
        expect(isDriveFileNotFoundError(new Error('Drive API error 404: {"error":{"message":"Folder not found"}}'))).toBe(false)
        expect(isDriveFileNotFoundError(new Error('Drive API error 500: {"error":{"message":"File not found"}}'))).toBe(false)
    })

    it('retries transient network failures with exponential backoff', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('network down'))
            .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-1', name: 'manifest', modifiedTime: '2026-04-07T00:00:00.000Z' }] }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.listAppDataFiles()

        await vi.advanceTimersByTimeAsync(1_000)

        await expect(promise).resolves.toEqual([
            { id: 'file-1', name: 'manifest', modifiedTime: '2026-04-07T00:00:00.000Z' },
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('maps Drive authorization failures to AuthorizationError messages', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ error: 'insufficient permissions' }, { status: 403 }))
            .mockResolvedValueOnce(jsonResponse({ code: 'SESSION_NOT_FOUND' }, { status: 401 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')

        await expect(manager.listAppDataFiles()).rejects.toEqual(
            expect.objectContaining({
                name: AuthorizationError.name,
                message: 'Google Drive permission is missing for this session. Reconnect and allow Drive access.',
            })
        )

        await expect(manager.listAppDataFiles()).rejects.toEqual(
            expect.objectContaining({
                name: AuthorizationError.name,
                message: 'Google session expired. Reconnect Google Drive.',
            })
        )
    })

    it('retries timed-out uploads and succeeds on a later attempt', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockImplementationOnce((_, options) => {
                return new Promise((resolve, reject) => {
                    options.signal.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'))
                    })
                })
            })
            .mockResolvedValueOnce(jsonResponse({ id: 'created-file-id' }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.createFile('tasktime-yjs-core.bin', new Blob(['payload'], { type: 'application/octet-stream' }))

        await vi.advanceTimersByTimeAsync(61_000)

        await expect(promise).resolves.toBe('created-file-id')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
