// @ts-nocheck

import * as Y from 'yjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_NOTES_LOCAL_SAVE_ORIGIN } from '@/constants/syncOrigins'

const { captureDebugBundleIncidentSpy } = vi.hoisted(() => ({
    captureDebugBundleIncidentSpy: vi.fn(),
}))

vi.mock('@/utils/debugbundle', () => ({
    captureDebugBundleIncident: captureDebugBundleIncidentSpy,
}))

import { YjsDriveProvider } from './GoogleDriveProvider.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

function createProviderWithCoreDoc(coreDoc) {
    const docManager = {
        getLoadedDocs: () => ['core'],
        getDocSync: (name) => (name === 'core' ? coreDoc : null),
    }

    return new YjsDriveProvider(docManager, 'playwright-access-token')
}

describe('YjsDriveProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('only establishes the connection without syncing on manual-mode connect', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Offline edit',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        provider.markDocsForFullStateUpload(['core'])

        await provider.connect('manual', { bootstrapPullIfPristine: false })

        expect(provider.manifest.load).toHaveBeenCalled()
        expect(provider.syncDoc).not.toHaveBeenCalled()
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('core')
    })

    it('pulls remote data on manual-mode connect when bootstrap is allowed for a pristine device', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        await provider.connect('manual', { bootstrapPullIfPristine: true })

        expect(provider.manifest.load).toHaveBeenCalled()
        expect(provider.syncDoc).toHaveBeenCalledWith('core', true)
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('core')
    })

    it('does not create missing remote docs during manual-mode bootstrap pull', async () => {
        const coreDoc = new Y.Doc()
        const archivedExpensesDoc = new Y.Doc()
        const docManager = {
            getLoadedDocs: () => ['core', 'expenses-archived'],
            getDocSync: (name) => {
                if (name === 'core') return coreDoc
                if (name === 'expenses-archived') return archivedExpensesDoc
                return null
            },
        }
        const provider = new YjsDriveProvider(docManager, 'playwright-access-token')

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        await provider.connect('manual', { bootstrapPullIfPristine: true })

        expect(provider.syncDoc).toHaveBeenCalledTimes(1)
        expect(provider.syncDoc).toHaveBeenCalledWith('core', true)
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('core')
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('expenses-archived')
    })

    it('flushes pending local changes on pagehide in backup mode', async () => {
        vi.useFakeTimers()

        try {
            const liveDoc = new Y.Doc()
            const provider = createProviderWithCoreDoc(liveDoc)

            provider.isOnline = () => true
            provider.setSyncMode('backup')
            provider.manifest = {
                load: vi.fn(async () => {}),
                getManifest: vi.fn(() => ({ documents: {} })),
                isDirty: vi.fn(() => false),
                save: vi.fn(async () => {}),
            }

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            await provider.connect('backup')

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'Stopped remotely',
                }))
            })

            window.dispatchEvent(new Event('pagehide'))

            expect(syncSpy).toHaveBeenCalledWith(true, { allowPull: false })

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('flushes pending changes on pagehide even while a sync is already running', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.setSyncMode('backup')
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }

        const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

        await provider.connect('backup')

        provider.isSyncing = true
        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])

        window.dispatchEvent(new Event('pagehide'))

        expect(syncSpy).toHaveBeenCalledWith(true, { allowPull: false })

        provider.disconnect()
    })

    it('captures page-exit flush failures as incidents', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.setSyncMode('backup')
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }

        vi.spyOn(provider, 'sync').mockRejectedValue(new Error('page-exit flush failed'))

        await provider.connect('backup')

        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])

        window.dispatchEvent(new Event('pagehide'))
        await Promise.resolve()

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'drive.page_exit_sync_failed',
            context: expect.objectContaining({
                mode: 'backup',
                trigger: 'pagehide',
            }),
        }))

        provider.disconnect()
    })

    it('queues local-only project note updates without scheduling an immediate sync', async () => {
        vi.useFakeTimers()

        try {
            const liveDoc = new Y.Doc()
            const provider = createProviderWithCoreDoc(liveDoc)

            provider.isOnline = () => true
            provider.setSyncMode('backup')
            provider.manifest = {
                load: vi.fn(async () => {}),
                getManifest: vi.fn(() => ({ documents: {} })),
                isDirty: vi.fn(() => false),
                save: vi.fn(async () => {}),
            }

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            await provider.connect('backup')

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'Deferred notes sync',
                }))
            }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

            vi.advanceTimersByTime(500)

            expect(provider.pendingDeltas.get('core')).toHaveLength(1)
            expect(syncSpy).not.toHaveBeenCalled()

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('blocks backup-mode push when Drive manifest changed remotely', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.connected = true
        provider.setSyncMode('backup')
        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])
        provider.manifest = {
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            canCheckRemoteManifestChanges: vi.fn(() => true),
            hasManifestChanged: vi.fn(async () => true),
            load: vi.fn(async () => {}),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})

        await provider.sync(false, { allowPull: false })

        expect(provider.manifest.hasManifestChanged).toHaveBeenCalled()
        expect(provider.syncDoc).not.toHaveBeenCalled()
        expect(provider.pendingDeltas.get('core')).toHaveLength(1)
        expect(provider.getState()).toBe('error')
    })

    it('captures top-level sync failures as incidents', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            hasManifestChanged: vi.fn(async () => {
                throw new Error('manifest read failed')
            }),
        }

        await provider.sync(false, { allowPull: true })

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'drive.sync_failed',
            context: expect.objectContaining({
                allowPull: true,
                force: false,
                mode: 'sync',
            }),
        }))
        expect(provider.getState()).toBe('error')
    })

    it('captures delta upload failures as incidents', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const capturedUpdates = []

        liveDoc.on('update', (update) => {
            capturedUpdates.push(update)
        })

        liveDoc.transact(() => {
            liveDoc.getMap('projects').set('project-1', objectToYMap({
                id: 'project-1',
                title: 'Upload me',
            }))
        })

        provider.pendingDeltas.set('core', [capturedUpdates[0]])
        provider.manifest = {
            createFile: vi.fn(async () => {
                throw new Error('delta upload failed')
            }),
        }

        await provider.pushDeltas('core', liveDoc)

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'drive.delta_upload_failed',
            context: expect.objectContaining({
                docName: 'core',
                queuedUpdates: 1,
            }),
        }))
    })

    it('captures unrecoverable missing Drive files as incidents', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.manifest = {
            deleteFileId: vi.fn(),
            downloadFileAsArrayBuffer: vi.fn(async () => {
                throw new Error('Drive API error 404: File not found')
            }),
            refreshFileCache: vi.fn(async () => {}),
            getFileIdWithFallback: vi.fn(async () => null),
        }

        const result = await provider.downloadFileWithRecovery('tasktime-yjs-core.bin', 'stale-id')

        expect(result).toBeNull()
        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'drive.remote_file_missing_after_recovery',
            context: expect.objectContaining({
                fileId: 'stale-id',
                fileName: 'tasktime-yjs-core.bin',
            }),
        }))
    })

    it('wipes all non-backup Drive files and preserves backup files', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            listAppDataFiles: vi.fn()
                .mockResolvedValueOnce([
                    { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' },
                    { id: 'core-id', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' },
                    { id: 'backup-id', name: 'tasktime-backup-2026-06-04-0700.json', modifiedTime: '2026-06-04T00:00:02.000Z' },
                ])
                .mockResolvedValueOnce([
                    { id: 'backup-id', name: 'tasktime-backup-2026-06-04-0700.json', modifiedTime: '2026-06-04T00:00:02.000Z' },
                ]),
            deleteFileById: vi.fn(async () => {}),
            reset: vi.fn(),
        }

        await provider.wipeDriveData()

        expect(provider.manifest.deleteFileById).toHaveBeenCalledWith('manifest-id')
        expect(provider.manifest.deleteFileById).toHaveBeenCalledWith('core-id')
        expect(provider.manifest.deleteFileById).not.toHaveBeenCalledWith('backup-id')
        expect(provider.manifest.reset).toHaveBeenCalledTimes(1)
    })

    it('fails Drive wipe when sync files remain after verification attempts', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            listAppDataFiles: vi.fn(async () => [
                { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' },
            ]),
            deleteFileById: vi.fn(async () => {}),
            reset: vi.fn(),
        }

        await expect(provider.wipeDriveData()).rejects.toThrow('Drive wipe incomplete')

        expect(provider.manifest.deleteFileById).toHaveBeenCalled()
        expect(provider.manifest.reset).not.toHaveBeenCalled()
    })

    it('preserves updates queued while a delta upload is in flight', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const capturedUpdates = []

        liveDoc.on('update', (update) => {
            capturedUpdates.push(update)
        })

        liveDoc.transact(() => {
            liveDoc.getMap('tasks').set('subtask-1', objectToYMap({
                id: 'subtask-1',
                title: 'First subtask',
                archived: true,
            }))
        })

        const firstUpdate = capturedUpdates[0]

        provider.pendingDeltas.set('core', [firstUpdate])
        provider.manifest = {
            createFile: vi.fn(async () => {
                liveDoc.transact(() => {
                    liveDoc.getMap('tasks').set('subtask-2', objectToYMap({
                        id: 'subtask-2',
                        title: 'Second subtask',
                        archived: true,
                    }))
                })

                const secondUpdate = capturedUpdates[1]
                provider.pendingDeltas.get('core').push(secondUpdate)

                return 'delta-file-id'
            }),
            setFileId: vi.fn(),
            addDelta: vi.fn(),
            save: vi.fn(async () => {}),
        }

        await provider.pushDeltas('core', liveDoc)

        expect(provider.pendingDeltas.get('core')).toHaveLength(1)
        expect(provider.manifest.createFile).toHaveBeenCalledTimes(1)
    })

    it('preserves updates queued while a full-state upload is in flight', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const capturedUpdates = []

        liveDoc.on('update', (update) => {
            capturedUpdates.push(update)
        })

        liveDoc.transact(() => {
            liveDoc.getMap('tasks').set('subtask-1', objectToYMap({
                id: 'subtask-1',
                title: 'First subtask',
                archived: true,
            }))
        })

        const firstUpdate = capturedUpdates[0]

        provider.pendingDeltas.set('core', [firstUpdate])
        provider.forceFullStateDocs.add('core')
        provider.manifest = {
            ensureDocManifest: vi.fn(() => ({
                stateFile: 'tasktime-yjs-core.bin',
                stateVersion: 1,
                lastCompaction: '2026-04-23T00:00:00.000Z',
                deltas: [],
            })),
            updateFile: vi.fn(async () => {
                liveDoc.transact(() => {
                    liveDoc.getMap('tasks').set('subtask-2', objectToYMap({
                        id: 'subtask-2',
                        title: 'Second subtask',
                        archived: true,
                    }))
                })

                const secondUpdate = capturedUpdates[1]
                provider.pendingDeltas.get('core').push(secondUpdate)
            }),
            getFileId: vi.fn(() => 'core-state-id'),
            createFile: vi.fn(async () => 'core-state-id'),
            setFileId: vi.fn(),
            updateDocManifest: vi.fn(),
            save: vi.fn(async () => {}),
            getDocManifest: vi.fn(() => ({ stateVersion: 1, deltas: [] })),
        }

        await provider.syncDoc('core', false)

        expect(provider.pendingDeltas.get('core')).toHaveLength(1)
        expect(provider.manifest.updateFile).toHaveBeenCalledTimes(1)
    })

    it('saves manifest before deleting deltas during reconnect full-state upload', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Reconnect state',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)
        const order = []
        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 3,
            lastCompaction: '2026-06-03T00:00:00.000Z',
            deltas: [
                { id: 'old-1', timestamp: '2026-06-03T00:00:00.000Z' },
                { id: 'old-2', timestamp: '2026-06-03T00:00:00.000Z' },
            ],
        }

        provider.manifest = {
            ensureDocManifest: vi.fn(() => manifestDoc),
            getFileId: vi.fn(() => 'core-state-id'),
            updateFile: vi.fn(async () => {
                order.push('state-uploaded')
            }),
            createFile: vi.fn(async () => 'core-state-id'),
            setFileId: vi.fn(),
            updateDocManifest: vi.fn((_, update) => {
                order.push('manifest-updated')
                Object.assign(manifestDoc, update)
            }),
            save: vi.fn(async () => {
                order.push('manifest-saved')
            }),
            deleteFileByName: vi.fn(async (name) => {
                order.push(`deleted:${name}`)
            }),
        }

        await provider.pushFullState('core', liveDoc, true)

        expect(order).toEqual([
            'state-uploaded',
            'manifest-updated',
            'manifest-saved',
            'deleted:tasktime-yjs-core-delta-old-1.bin',
            'deleted:tasktime-yjs-core-delta-old-2.bin',
        ])
        expect(manifestDoc.deltas).toEqual([])
    })

    it('creates a replacement base-state file when cached Drive file id is missing during full-state upload', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Imported replacement state',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)
        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 17,
            lastCompaction: '2026-06-04T00:00:00.000Z',
            deltas: [],
        }

        provider.manifest = {
            ensureDocManifest: vi.fn(() => manifestDoc),
            getFileId: vi.fn(() => 'stale-state-file-id'),
            updateFile: vi.fn(async () => {
                throw new Error('Drive update error 404: {"error":{"code":404,"message":"File not found: stale-state-file-id."}}')
            }),
            deleteFileId: vi.fn(),
            refreshFileCache: vi.fn(async () => {}),
            getFileIdWithFallback: vi.fn(async () => null),
            createFile: vi.fn(async () => 'replacement-state-file-id'),
            setFileId: vi.fn(),
            updateDocManifest: vi.fn((_, update) => {
                Object.assign(manifestDoc, update)
            }),
            save: vi.fn(async () => {}),
        }

        await provider.pushFullState('core', liveDoc, true)

        expect(provider.manifest.deleteFileId).toHaveBeenCalledWith('tasktime-yjs-core.bin')
        expect(provider.manifest.refreshFileCache).toHaveBeenCalledTimes(1)
        expect(provider.manifest.createFile).toHaveBeenCalledWith('tasktime-yjs-core.bin', expect.any(Blob))
        expect(provider.manifest.setFileId).toHaveBeenCalledWith('tasktime-yjs-core.bin', 'replacement-state-file-id')
        expect(provider.manifest.save).toHaveBeenCalled()
        expect(provider.forceFullStateDocs.has('core')).toBe(false)
    })

    it('retries a recovered base-state file id before creating a replacement', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Recovered upload state',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)
        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 4,
            lastCompaction: '2026-06-04T00:00:00.000Z',
            deltas: [],
        }

        provider.manifest = {
            ensureDocManifest: vi.fn(() => manifestDoc),
            getFileId: vi.fn(() => 'stale-state-file-id'),
            updateFile: vi.fn(async (fileId) => {
                if (fileId === 'stale-state-file-id') {
                    throw new Error('Drive update error 404: {"error":{"code":404,"message":"File not found: stale-state-file-id."}}')
                }
            }),
            deleteFileId: vi.fn(),
            refreshFileCache: vi.fn(async () => {}),
            getFileIdWithFallback: vi.fn(async () => 'fresh-state-file-id'),
            createFile: vi.fn(async () => 'replacement-state-file-id'),
            setFileId: vi.fn(),
            updateDocManifest: vi.fn((_, update) => {
                Object.assign(manifestDoc, update)
            }),
            save: vi.fn(async () => {}),
        }

        await provider.pushFullState('core', liveDoc, true)

        expect(provider.manifest.updateFile).toHaveBeenCalledWith('stale-state-file-id', 'tasktime-yjs-core.bin', expect.any(Blob))
        expect(provider.manifest.updateFile).toHaveBeenCalledWith('fresh-state-file-id', 'tasktime-yjs-core.bin', expect.any(Blob))
        expect(provider.manifest.createFile).not.toHaveBeenCalled()
        expect(provider.manifest.setFileId).toHaveBeenCalledWith('tasktime-yjs-core.bin', 'fresh-state-file-id')
        expect(provider.forceFullStateDocs.has('core')).toBe(false)
    })

    it('saves compacted manifest before deleting old compacted delta files', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Compacted state',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)
        const order = []
        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 7,
            lastCompaction: '2026-06-03T00:00:00.000Z',
            deltas: [
                { id: 'compact-1', timestamp: '2026-06-03T00:00:00.000Z' },
            ],
        }

        provider.manifest = {
            getDocManifest: vi.fn(() => manifestDoc),
            getFileId: vi.fn(() => 'core-state-id'),
            updateFile: vi.fn(async () => {
                order.push('state-uploaded')
            }),
            createFile: vi.fn(async () => 'core-state-id'),
            setFileId: vi.fn(),
            clearDeltas: vi.fn(() => {
                order.push('manifest-updated')
                manifestDoc.deltas = []
                manifestDoc.stateVersion += 1
            }),
            save: vi.fn(async () => {
                order.push('manifest-saved')
            }),
            deleteFileByName: vi.fn(async (name) => {
                order.push(`deleted:${name}`)
            }),
        }

        await provider.compactDoc('core', liveDoc)

        expect(order).toEqual([
            'state-uploaded',
            'manifest-updated',
            'manifest-saved',
            'deleted:tasktime-yjs-core-delta-compact-1.bin',
        ])
        expect(manifestDoc.stateVersion).toBe(8)
    })

    it('recovers from stale cached delta file IDs after a 404', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Recovered From Fresh File ID',
        }))

        const deltaBuffer = Y.encodeStateAsUpdate(remoteDoc).buffer

        provider.manifest = {
            getDocManifest: vi.fn(() => ({
                stateVersion: 0,
                stateFile: 'tasktime-yjs-core.bin',
                deltas: [{ id: 'delta-1', timestamp: '2026-06-03T00:00:00.000Z' }],
            })),
            getFileIdWithFallback: vi.fn()
                .mockResolvedValueOnce('stale-file-id')
                .mockResolvedValueOnce('fresh-file-id'),
            refreshFileCache: vi.fn(async () => {}),
            deleteFileId: vi.fn(),
            downloadFileAsArrayBuffer: vi.fn(async (fileId) => {
                if (fileId === 'stale-file-id') {
                    throw new Error('Drive API error 404: {"error":{"code":404,"message":"File not found"}}')
                }

                if (fileId === 'fresh-file-id') {
                    return deltaBuffer
                }

                throw new Error(`Unexpected file id ${fileId}`)
            }),
            removeDelta: vi.fn(),
        }

        await provider.pullDoc('core', liveDoc)

        expect(provider.manifest.deleteFileId).toHaveBeenCalledWith('tasktime-yjs-core-delta-delta-1.bin')
        expect(provider.manifest.refreshFileCache).toHaveBeenCalledTimes(1)
        expect(provider.manifest.removeDelta).not.toHaveBeenCalled()
        expect(liveDoc.getMap('projects').get('project-1').get('title')).toBe('Recovered From Fresh File ID')
    })

    it('applies remote updates with broken references but logs a warning', () => {
        const liveDoc = new Y.Doc()

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Broken Project',
            preferredClientId: 'missing-client',
        }))

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const provider = createProviderWithCoreDoc(liveDoc)

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            Y.encodeStateAsUpdate(remoteDoc),
            'test invalid state',
        )

        // CRDT convergence takes priority — update is applied despite reference issues
        expect(applied).toBe(true)
        expect(liveDoc.getMap('projects').get('project-1').get('title')).toBe('Broken Project')
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockRestore()
    })

    it('rejects corrupt CRDT binary data', () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const corruptData = new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x02])

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            corruptData,
            'test corrupt data',
        )

        expect(applied).toBe(false)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('applies remote updates that keep the projected state valid', () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('clients').set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
        }))
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Valid Project',
            preferredClientId: 'client-1',
        }))

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            Y.encodeStateAsUpdate(remoteDoc),
            'test valid state',
        )

        expect(applied).toBe(true)
        expect(liveDoc.getMap('projects').get('project-1').get('preferredClientId')).toBe('client-1')
    })

})
