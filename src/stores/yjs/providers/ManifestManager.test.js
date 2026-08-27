import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    AuthorizationError,
    CloudManifestManager,
    DriveStorageQuotaError,
    ManifestManager,
    isDriveFileNotFoundError,
    mergeConcurrentManifests,
} from './ManifestManager.ts'
import { DriveAccessTokenError } from './DriveAccessTokenProvider.ts'
import legacyGoogleManifest from './fixtures/google-manifest-v1.json'

function directManager(tokenProvider = { getToken: vi.fn(async () => 'direct-token'), clearToken: vi.fn() }) {
    return {
        manager: new ManifestManager({
            transport: 'direct',
            tokenProvider,
        }),
        tokenProvider,
    }
}

function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), {
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        ...init,
    })
}

function readBlob(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => resolve(reader.result))
        reader.addEventListener('error', () => reject(reader.error))
        reader.readAsText(blob)
    })
}

describe('ManifestManager', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('loads the supported legacy Google manifest names without rewriting its shape', async () => {
        const files = [
            { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2025-11-08T14:30:00.000Z' },
            { id: 'core-id', name: 'tasktime-yjs-core.bin', modifiedTime: '2025-11-08T14:00:00.000Z' },
            { id: 'core-delta-id', name: 'tasktime-yjs-core-delta-legacy-core-delta.bin', modifiedTime: '2025-11-08T14:20:00.000Z' },
            { id: 'active-id', name: 'tasktime-yjs-entries-active.bin', modifiedTime: '2025-11-08T14:05:00.000Z' },
            { id: 'history-id', name: 'tasktime-yjs-entries-2024.bin', modifiedTime: '2025-01-02T08:00:00.000Z' },
        ]
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ files }))
            .mockResolvedValueOnce(jsonResponse(legacyGoogleManifest))
        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('legacy-google-access-token')

        await expect(manager.load()).resolves.toStrictEqual(legacyGoogleManifest)
        expect(manager.isDirty()).toBe(false)
        expect(files.map(({ name }) => name)).toStrictEqual([
            'tasktime-yjs-manifest.json',
            'tasktime-yjs-core.bin',
            'tasktime-yjs-core-delta-legacy-core-delta.bin',
            'tasktime-yjs-entries-active.bin',
            'tasktime-yjs-entries-2024.bin',
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls.every(([, options]) => options?.method === undefined || options.method === 'GET')).toBe(true)
    })

    it('preserves the Google manifest filename and pretty-printed JSON byte contract', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-19T09:15:00.000Z'))
        const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID')
            .mockReturnValueOnce('google-writer-fixture')
            .mockReturnValueOnce('google-write-fixture')
        const manager = new ManifestManager('legacy-google-access-token')
        manager.manifest = structuredClone(legacyGoogleManifest)
        let uploadedManifest = null
        manager.createFile = vi.fn(async (name, blob) => {
            expect(name).toBe('tasktime-yjs-manifest.json')
            uploadedManifest = blob
            return 'manifest-id'
        })

        await manager.save()

        const expectedManifest = {
            ...legacyGoogleManifest,
            lastSync: '2026-08-19T09:15:00.000Z',
            revision: 1,
            lastWriterId: 'google-writer-fixture',
            writeId: 'google-write-fixture',
        }
        vi.useRealTimers()
        expect(await readBlob(uploadedManifest)).toBe(JSON.stringify(expectedManifest, null, 2))
        expect(randomUuid).toHaveBeenCalledTimes(2)
    })

    it('runs through an injected provider-neutral file store without Google requests', async () => {
        const manifestBytes = new TextEncoder().encode(JSON.stringify(legacyGoogleManifest)).buffer
        const fileStore = {
            provider: 'dropbox',
            list: vi.fn(async (namespace) => namespace === 'sync'
                ? [{
                    logicalName: 'tasktime-yjs-manifest.json',
                    opaqueId: 'provider-manifest-id',
                    revision: 'provider-manifest-rev-1',
                    modifiedTime: '2026-08-19T08:00:00.000Z',
                }]
                : []),
            getMetadata: vi.fn(async () => null),
            download: vi.fn(async () => manifestBytes),
            create: vi.fn(async (_namespace, logicalName) => ({
                logicalName,
                opaqueId: 'provider-core-id',
                modifiedTime: '2026-08-19T08:01:00.000Z',
            })),
            replace: vi.fn(async (object) => ({
                ...object,
                modifiedTime: '2026-08-19T08:02:00.000Z',
            })),
            delete: vi.fn(async () => undefined),
        }
        const fetchMock = vi.fn(() => {
            throw new Error('Google transport must not be reached')
        })
        vi.stubGlobal('fetch', fetchMock)
        const manager = new CloudManifestManager({
            fileStore,
        })

        await expect(manager.load()).resolves.toStrictEqual(legacyGoogleManifest)
        expect(fileStore.list).toHaveBeenNthCalledWith(1, 'sync')
        expect(fileStore.list).toHaveBeenCalledTimes(1)

        await manager.listBackupFiles()
        expect(fileStore.list).toHaveBeenNthCalledWith(2, 'backups')

        await manager.updateFile(
            'provider-manifest-id',
            'tasktime-yjs-manifest.json',
            new Blob(['manifest'], { type: 'application/json' }),
        )
        expect(fileStore.replace).toHaveBeenLastCalledWith(
            expect.objectContaining({ revision: 'provider-manifest-rev-1' }),
            expect.any(Blob),
            'provider-manifest-rev-1',
        )

        const coreId = await manager.createFile(
            'tasktime-yjs-core.bin',
            new Blob(['state'], { type: 'application/octet-stream' }),
        )
        expect(coreId).toBe('provider-core-id')
        expect(fileStore.create).toHaveBeenCalledWith(
            'sync',
            'tasktime-yjs-core.bin',
            expect.any(Blob),
        )

        await expect(manager.updateFile(
            coreId,
            'tasktime-yjs-core.bin',
            new Blob(['next-state'], { type: 'application/octet-stream' }),
        )).resolves.toBe('2026-08-19T08:02:00.000Z')
        await manager.deleteFileByName('tasktime-yjs-core.bin')

        expect(fileStore.replace).toHaveBeenCalledTimes(2)
        expect(fileStore.delete).toHaveBeenCalledTimes(1)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reads, conditionally writes, and validates provider-neutral workspace bindings', async () => {
        let bindingMetadata = null
        let bindingValue = null
        const fileStore = {
            provider: 'dropbox',
            list: vi.fn(async () => []),
            getMetadata: vi.fn(async (_namespace, logicalName) => (
                logicalName === 'tasktime-yjs-manifest.json'
                    ? {
                        logicalName,
                        opaqueId: 'id:manifest',
                        revision: 'manifest-rev-4',
                        modifiedTime: '2026-08-19T10:00:00.000Z',
                        contentHash: 'manifest-hash',
                        size: 42,
                    }
                    : bindingMetadata
            )),
            download: vi.fn(async () => new TextEncoder().encode(
                JSON.stringify(bindingValue),
            ).buffer),
            create: vi.fn(async (_namespace, logicalName, body) => {
                bindingValue = JSON.parse(await readBlob(body))
                bindingMetadata = {
                    logicalName,
                    opaqueId: 'id:binding',
                    revision: 'binding-rev-1',
                    modifiedTime: '2026-08-19T10:01:00.000Z',
                }
                return bindingMetadata
            }),
            replace: vi.fn(async (current, body) => {
                bindingValue = JSON.parse(await readBlob(body))
                bindingMetadata = { ...current, revision: 'binding-rev-2' }
                return bindingMetadata
            }),
            delete: vi.fn(),
        }
        const manager = new CloudManifestManager({ fileStore })
        const marker = {
            version: 1,
            workspaceId: '42de9b18-445c-4d28-b5c9-88bc476fc7f1',
            generation: 3,
            activeProvider: 'dropbox',
            state: 'active',
            updatedAt: '2026-08-19T10:00:00.000Z',
        }

        await expect(manager.getRemoteManifestFingerprint()).resolves.toEqual({
            revision: 'manifest-rev-4',
            modifiedTime: '2026-08-19T10:00:00.000Z',
            contentHash: 'manifest-hash',
            size: 42,
        })
        await expect(manager.readCloudBindingMarker()).resolves.toBeNull()
        await manager.writeCloudBindingMarker(marker)
        await expect(manager.readCloudBindingMarker()).resolves.toEqual(marker)
        await manager.writeCloudBindingMarker({ ...marker, state: 'moved' })
        expect(fileStore.replace).toHaveBeenCalledWith(
            expect.objectContaining({ revision: 'binding-rev-1' }),
            expect.any(Blob),
            'binding-rev-1',
        )

        bindingValue = { ...marker, email: 'must-not-be-accepted@example.com' }
        await expect(manager.readCloudBindingMarker()).rejects.toMatchObject({
            code: 'invalid-response',
            provider: 'dropbox',
        })
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
        manager.listSyncFiles = vi.fn(async () => ([
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
        expect(manager.listSyncFiles).toHaveBeenCalledTimes(1)
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

    it('uses the explicit direct transport with a lazy memory token and network-only fetch options', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager, tokenProvider } = directManager()

        await manager.listAppDataFiles()

        expect(tokenProvider.getToken).toHaveBeenCalledWith({ forceRefresh: false })
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/),
            expect.objectContaining({
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: expect.objectContaining({ Authorization: 'Bearer direct-token' }),
            }),
        )
    })

    it('uses the explicit proxy transport without requesting a Google token', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const tokenProvider = { getToken: vi.fn(), clearToken: vi.fn() }
        const manager = new ManifestManager({
            transport: 'proxy',
            sessionId: 'worker-session',
            tokenProvider,
        })

        await manager.listAppDataFiles()

        expect(tokenProvider.getToken).not.toHaveBeenCalled()
        expect(fetchMock.mock.calls[0][0]).toContain('/drive/files?')
        expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: expect.objectContaining({ 'X-Session-Id': 'worker-session' }),
        }))
    })

    it('forces one fresh token after a direct 401 and never reuses the rejected authorization', async () => {
        const tokenProvider = {
            getToken: vi.fn()
                .mockResolvedValueOnce('rejected-token')
                .mockResolvedValueOnce('fresh-token'),
            clearToken: vi.fn(),
        }
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'authError' }] } }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager(tokenProvider)

        await expect(manager.listAppDataFiles()).resolves.toEqual([])

        expect(tokenProvider.clearToken).toHaveBeenCalledTimes(1)
        expect(tokenProvider.getToken).toHaveBeenNthCalledWith(1, { forceRefresh: false })
        expect(tokenProvider.getToken).toHaveBeenNthCalledWith(2, { forceRefresh: true })
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token')
    })

    it('prompts reconnect after the single forced-refresh retry is also rejected', async () => {
        const tokenProvider = {
            getToken: vi.fn()
                .mockResolvedValueOnce('rejected-token')
                .mockResolvedValueOnce('also-rejected-token'),
            clearToken: vi.fn(),
        }
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'authError' }] } }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'authError' }] } }, { status: 401 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager(tokenProvider)

        await expect(manager.listAppDataFiles()).rejects.toEqual(expect.objectContaining({
            name: AuthorizationError.name,
        }))
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(tokenProvider.getToken).toHaveBeenCalledTimes(2)
    })

    it('surfaces a policy rollback without issuing a Google request or selecting the proxy mid-pass', async () => {
        const tokenProvider = {
            getToken: vi.fn(async () => {
                throw new DriveAccessTokenError(
                    'DIRECT_TRANSPORT_DISABLED',
                    'Direct Google Drive access is currently disabled.',
                )
            }),
            clearToken: vi.fn(),
        }
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager(tokenProvider)

        await expect(manager.listAppDataFiles()).rejects.toEqual(expect.objectContaining({
            name: 'DriveTransportDisabledError',
        }))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('retries a direct rate-limit reason without treating it as an authorization failure', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                error: { errors: [{ reason: 'userRateLimitExceeded' }] },
            }, { status: 403, headers: { 'Retry-After': '2' } }))
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager, tokenProvider } = directManager()
        const promise = manager.listAppDataFiles()
        const assertion = expect(promise).resolves.toEqual([])

        await vi.advanceTimersByTimeAsync(2_000)

        await assertion
        expect(tokenProvider.clearToken).not.toHaveBeenCalled()
    })

    it('reports direct storage quota failures distinctly without exposing the Google body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
            error: {
                errors: [{ reason: 'storageQuotaExceeded' }],
                message: 'private provider payload',
            },
        }, { status: 403 })))
        const { manager } = directManager()

        const error = await manager.listAppDataFiles().catch((caught) => caught)
        expect(error).toEqual(expect.objectContaining({
            name: DriveStorageQuotaError.name,
            message: 'Google Drive storage is full. Free space and try syncing again.',
        }))
        expect(error.message).not.toContain('private provider payload')
    })

    it('pre-generates a direct create ID and uses that exact ID in the multipart metadata', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['generated-id'] }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({ id: 'generated-id' }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager()

        await expect(manager.createFile(
            'tasktime-yjs-core.bin',
            new Blob(['payload'], { type: 'application/octet-stream' }),
        )).resolves.toBe('generated-id')

        expect(fetchMock.mock.calls[0][0]).toContain('/files/generateIds?')
        expect(fetchMock.mock.calls[1][0]).toContain('/upload/drive/v3/files?uploadType=multipart')
        const upload = fetchMock.mock.calls[1][1]
        expect(upload.headers).toEqual(expect.objectContaining({
            'Content-Type': expect.stringMatching(/^multipart\/related; boundary=tasktime-/),
        }))
        const body = await readBlob(upload.body)
        expect(body).toContain('"id":"generated-id"')
        expect(body).toMatch(
            /Content-Type: application\/octet-stream\r\n\r\npayload\r\n--tasktime-/,
        )
    })

    it('reconciles an ambiguous direct create by the same generated ID without replaying the upload', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['stable-id'] }, { status: 200 }))
            .mockRejectedValueOnce(new TypeError('response lost'))
            .mockResolvedValueOnce(jsonResponse({
                id: 'stable-id',
                name: 'tasktime-yjs-core.bin',
                mimeType: 'application/octet-stream',
                parents: ['appDataFolder'],
                trashed: false,
            }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager()

        await expect(manager.createFile(
            'tasktime-yjs-core.bin',
            new Blob(['payload'], { type: 'application/octet-stream' }),
        )).resolves.toBe('stable-id')

        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/upload/'))).toHaveLength(1)
        expect(fetchMock.mock.calls[2][0]).toContain('/files/stable-id?fields=')
    })

    it('retries a rejected direct create with the same generated ID after reconciliation proves it absent', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ ids: ['same-id'] }, { status: 200 }))
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'backendError' }] } }, { status: 503 }))
            .mockResolvedValueOnce(jsonResponse({ error: { errors: [{ reason: 'notFound' }] } }, { status: 404 }))
            .mockResolvedValueOnce(jsonResponse({ id: 'same-id' }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager()
        const promise = manager.createFile(
            'tasktime-yjs-core.bin',
            new Blob(['payload'], { type: 'application/octet-stream' }),
        )
        const assertion = expect(promise).resolves.toBe('same-id')

        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(1_000)
        await assertion
        vi.useRealTimers()

        const uploads = fetchMock.mock.calls.filter(([url]) => String(url).includes('/upload/'))
        expect(uploads).toHaveLength(2)
        const metadata = await Promise.all(uploads.map(([, options]) => readBlob(options.body)))
        expect(metadata.every((value) => value.includes('"id":"same-id"'))).toBe(true)
    })

    it('updates a known direct file ID without changing transports and with network-only options', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
            modifiedTime: '2026-07-16T00:00:00.000Z',
        }, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { manager } = directManager()

        await expect(manager.updateFile(
            'known-id',
            'tasktime-yjs-core.bin',
            new Blob(['payload'], { type: 'application/octet-stream' }),
        )).resolves.toBe('2026-07-16T00:00:00.000Z')

        expect(fetchMock).toHaveBeenCalledWith(
            'https://www.googleapis.com/upload/drive/v3/files/known-id?uploadType=multipart&fields=modifiedTime',
            expect.objectContaining({
                method: 'PATCH',
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: expect.objectContaining({
                    'Content-Type': expect.stringMatching(/^multipart\/related; boundary=tasktime-/),
                }),
            }),
        )
    })

    it('does not reinterpret a failed filename search as an absent file', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'invalid request' }, { status: 400 })))
        const { manager } = directManager()

        await expect(manager.getFileIdWithFallback('tasktime-yjs-core.bin')).rejects.toThrow(
            'Google Drive request failed (400).',
        )
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

        const manager = new ManifestManager('worker-placeholder', 'session-123')
        const promise = manager.createFile('tasktime-yjs-core.bin', new Blob(['payload'], { type: 'application/octet-stream' }))

        await vi.advanceTimersByTimeAsync(61_000)

        await expect(promise).resolves.toBe('created-file-id')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
