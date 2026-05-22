// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import { YjsDriveProvider } from './GoogleDriveProvider.ts'
import { PROJECT_NOTES_LOCAL_SAVE_ORIGIN } from '@/constants/syncOrigins'

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

        await provider.connect('manual')

        expect(provider.manifest.load).toHaveBeenCalled()
        expect(provider.syncDoc).not.toHaveBeenCalled()
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('core')
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
