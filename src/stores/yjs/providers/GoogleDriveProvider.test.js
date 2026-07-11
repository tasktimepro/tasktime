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
        const storage = new Map()

        vi.clearAllMocks()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, value)
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })
        localStorage.clear()
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

    it('does not persist manifest recovery during a pristine manual bootstrap', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            isDirty: vi.fn(() => true),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        await provider.connect('manual', { bootstrapPullIfPristine: true })

        expect(provider.syncDoc).toHaveBeenCalledWith('core', true)
        expect(provider.manifest.save).not.toHaveBeenCalled()
    })

    it('awaits post-sync reconciliation and flushes the deltas it creates', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        let callbackCompleted = false

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }

        await provider.connect('manual', { bootstrapPullIfPristine: false })

        provider.syncDoc = vi.fn(async (docName) => {
            provider.pendingDeltas.set(docName, [])
        })
        provider.onSyncComplete(async () => {
            await Promise.resolve()
            liveDoc.getMap('projects').set('reconciled-project', objectToYMap({
                id: 'reconciled-project',
                title: 'Reconciled project',
            }))
            callbackCompleted = true
        })

        await provider.sync(true, { allowPull: false })

        expect(callbackCompleted).toBe(true)
        expect(provider.syncDoc).toHaveBeenCalledTimes(2)
        expect(provider.getPendingDocNames()).toEqual([])
    })

    it('keeps sync in an error state when post-sync consistency replay fails', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: { core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] } } })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }

        await provider.connect('manual', { bootstrapPullIfPristine: false })

        provider.syncDoc = vi.fn(async () => {})
        provider.onSyncComplete(async () => {
            throw new Error('archived billing document unavailable')
        })

        await provider.sync(true, { allowPull: false })

        expect(provider.getState()).toBe('error')
        expect(JSON.parse(localStorage.getItem('tasktime-sync-state'))).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            needsRetry: true,
        }))
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

    it('reconciles existing Drive data before a Backup-mode upload after connecting offline', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        let online = false

        provider.isOnline = () => online
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({
                documents: {
                    core: {
                        stateVersion: 4,
                        stateFile: 'tasktime-yjs-core.bin',
                        deltas: [{ id: 'remote-delta', timestamp: '2026-07-10T00:00:00.000Z' }],
                    },
                },
            })),
            canCheckRemoteManifestChanges: vi.fn(() => true),
            hasManifestChanged: vi.fn(async () => false),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})

        await provider.connect('backup')

        expect(provider.hasLocalChangesToPush()).toBe(true)
        expect(provider.forceFullStateDocs.has('core')).toBe(false)

        online = true
        await provider.sync(false, { allowPull: false })

        expect(provider.manifest.load).toHaveBeenCalledTimes(1)
        expect(provider.syncDoc).toHaveBeenCalledWith('core', true)
        expect(provider.hasLocalChangesToPush()).toBe(false)
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

    it('does not enqueue another pagehide flush while a sync is already running', async () => {
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

        expect(syncSpy).not.toHaveBeenCalled()

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

    it('reports every document that still needs a local upload', () => {
        const coreDoc = new Y.Doc()
        const entriesDoc = new Y.Doc()
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => ['core', 'entries-active', 'tasks-archived'],
            getDocSync: (name) => name === 'core' ? coreDoc : entriesDoc,
        }, 'playwright-access-token')

        provider.pendingDeltas.set('core', [new Uint8Array([1])])
        provider.forceFullStateDocs.add('entries-active')
        provider.verifyFullStateDocs.add('tasks-archived')

        expect(provider.getPendingDocNames()).toEqual(['core', 'entries-active', 'tasks-archived'])
    })

    it('recovers only the persisted documents that actually changed', () => {
        const coreDoc = new Y.Doc()
        const entriesDoc = new Y.Doc()
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => ['core', 'entries-active', 'tasks-archived'],
            getDocSync: (name) => name === 'core' ? coreDoc : entriesDoc,
        }, 'playwright-access-token')

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            pendingDocNames: ['entries-active'],
            needsRetry: false,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: null,
        }))

        expect(provider.getPendingDocNames()).toEqual(['entries-active'])

        provider.promotePersistedLocalChangesToFullState(['core', 'entries-active', 'tasks-archived'])

        expect(Array.from(provider.forceFullStateDocs)).toEqual(['entries-active'])
    })

    it('does not promote loaded documents when exact dirty identity belongs to an unloaded lazy document', () => {
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => ['core', 'entries-active'],
            getDocSync: () => new Y.Doc(),
        }, 'playwright-access-token')

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            pendingDocNames: ['entries-2024'],
            needsRetry: false,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: null,
        }))

        provider.promotePersistedLocalChangesToFullState(['core', 'entries-active'])

        expect(provider.getPendingDocNames()).toEqual([])
        expect(Array.from(provider.forceFullStateDocs)).toEqual([])
    })

    it('does not treat an interrupted pull-only check as unsynced local data', () => {
        const coreDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(coreDoc)

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: false,
            pendingDocNames: [],
            needsRetry: false,
            syncInterrupted: true,
            syncStartedAt: Date.now(),
            lastSyncCompletedAt: null,
        }))

        expect(provider.hasLocalChangesToPush()).toBe(false)
        expect(provider.getPendingDocNames()).toEqual([])
    })

    it('uses the latest successful local check for the foreground cooldown timestamp', () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())
        const localCompletedAt = Date.parse('2026-07-11T17:10:00.000Z')

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: false,
            pendingDocNames: [],
            needsRetry: false,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: localCompletedAt,
        }))
        provider.manifest = {
            getLastSync: vi.fn(() => '2026-07-11T16:00:00.000Z'),
        }

        expect(provider.getLastSyncedAt()).toBe(localCompletedAt)
    })

    it('uses zero Drive requests inside the cooldown and one metadata request for a stale clean check', async () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())
        const hasManifestChanged = vi.fn(async () => false)
        const saveManifest = vi.fn(async () => {})

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            hasManifestChanged,
            isDirty: vi.fn(() => false),
            save: saveManifest,
        }
        provider.syncDoc = vi.fn(async () => {})

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: false,
            pendingDocNames: [],
            needsRetry: false,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: Date.now(),
        }))

        await provider.sync(false, { allowPull: true })

        expect(hasManifestChanged).not.toHaveBeenCalled()
        expect(provider.syncDoc).not.toHaveBeenCalled()

        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: false,
            pendingDocNames: [],
            needsRetry: false,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: Date.now() - 61_000,
        }))

        await provider.sync(false, { allowPull: true })
        await provider.sync(false, { allowPull: true })

        expect(hasManifestChanged).toHaveBeenCalledTimes(1)
        expect(provider.syncDoc).toHaveBeenCalledTimes(1)
        expect(saveManifest).not.toHaveBeenCalled()
    })

    it('does not report lock contention after a completed non-forced sync', async () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            hasManifestChanged: vi.fn(async () => false),
            isDirty: vi.fn(() => false),
        }
        provider.syncDoc = vi.fn(async () => {})

        const logSpy = vi.spyOn(provider, 'log')

        await provider.sync(false, { allowPull: true })

        expect(provider.syncDoc).toHaveBeenCalledTimes(1)
        expect(logSpy).not.toHaveBeenCalledWith('sync: skipped, sync lock is currently held')
    })

    it('reports lock contention only when the Web Lock is actually unavailable', async () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())
        const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
        const request = vi.fn(async (_name, _options, callback) => callback(null))

        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request },
        })

        try {
            provider.connected = true
            provider.isOnline = () => true
            provider.syncDoc = vi.fn(async () => {})

            const logSpy = vi.spyOn(provider, 'log')

            await provider.sync(false, { allowPull: true })

            expect(request).toHaveBeenCalledTimes(1)
            expect(provider.syncDoc).not.toHaveBeenCalled()
            expect(logSpy).toHaveBeenCalledWith('sync: skipped, sync lock is currently held')
        } finally {
            if (originalLocksDescriptor) {
                Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
            } else {
                delete navigator.locks
            }
        }
    })

    it('keeps durable pending state when a queued delta upload fails during sync', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const capturedUpdates = []

        liveDoc.on('update', (update) => {
            capturedUpdates.push(update)
        })

        liveDoc.transact(() => {
            liveDoc.getMap('projects').set('project-1', objectToYMap({
                id: 'project-1',
                title: 'Must retry',
            }))
        })

        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 1,
            lastCompaction: '2026-06-04T00:00:00.000Z',
            deltas: [],
        }

        provider.connected = true
        provider.isOnline = () => true
        provider.pendingDeltas.set('core', [capturedUpdates[0]])
        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: null,
        }))
        provider.manifest = {
            hasManifestChanged: vi.fn(async () => false),
            getDocManifest: vi.fn(() => manifestDoc),
            ensureDocManifest: vi.fn(() => manifestDoc),
            createFile: vi.fn(async () => {
                throw new Error('delta upload failed')
            }),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }

        await provider.sync(false, { allowPull: true })

        const persisted = JSON.parse(localStorage.getItem('tasktime-sync-state'))
        expect(provider.getState()).toBe('error')
        expect(provider.pendingDeltas.get('core')).toHaveLength(1)
        expect(persisted.hasPendingChanges).toBe(true)
        expect(persisted.syncInterrupted).toBe(false)
    })

    it('uploads full document state on forced verification sync even without queued deltas', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Verify me',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)
        const manifestDoc = {
            stateFile: 'tasktime-yjs-core.bin',
            stateVersion: 1,
            lastCompaction: '2026-06-04T00:00:00.000Z',
            deltas: [],
        }

        provider.connected = true
        provider.isOnline = () => true
        provider.appliedStateVersions.set('core', 1)
        provider.manifest = {
            hasManifestChanged: vi.fn(async () => false),
            reload: vi.fn(async () => {}),
            getDocManifest: vi.fn(() => manifestDoc),
            ensureDocManifest: vi.fn(() => manifestDoc),
            getFileId: vi.fn(() => 'core-state-id'),
            updateFile: vi.fn(async () => '2026-06-04T00:00:01.000Z'),
            createFile: vi.fn(async () => 'core-state-id'),
            setFileId: vi.fn(),
            updateDocManifest: vi.fn((_, update) => {
                Object.assign(manifestDoc, update)
            }),
            save: vi.fn(async () => {}),
            isDirty: vi.fn(() => false),
        }

        await provider.sync(true, { allowPull: true, forceFullState: true })

        expect(provider.manifest.updateFile).toHaveBeenCalledWith('core-state-id', 'tasktime-yjs-core.bin', expect.any(Blob))
        expect(provider.manifest.updateDocManifest).toHaveBeenCalledWith('core', expect.not.objectContaining({
            deltas: [],
        }))
        expect(provider.getState()).toBe('idle')
        expect(JSON.parse(localStorage.getItem('tasktime-sync-state')).hasPendingChanges).toBe(false)
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

    it('fails a document pull when a referenced remote delta is corrupt', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        provider.manifest = {
            getDocManifest: vi.fn(() => ({
                stateVersion: 0,
                stateFile: 'tasktime-yjs-core.bin',
                deltas: [{ id: 'corrupt-delta', timestamp: '2026-07-11T00:00:00.000Z' }],
            })),
            getFileIdWithFallback: vi.fn(async () => 'corrupt-delta-file-id'),
            refreshFileCache: vi.fn(async () => {}),
            downloadFileAsArrayBuffer: vi.fn(async () => (
                new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x02]).buffer
            )),
        }

        await expect(provider.pullDoc('core', liveDoc)).rejects.toThrow('Remote delta is corrupt')
        expect(provider.appliedDeltaIds.get('core')?.has('corrupt-delta') ?? false).toBe(false)
        warnSpy.mockRestore()
    })

    it('keeps sync in an error state when any remote pull is incomplete', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        provider.manifest = {
            hasManifestChanged: vi.fn(async () => true),
            reload: vi.fn(async () => {}),
            isDirty: vi.fn(() => false),
            getLastSync: vi.fn(() => null),
        }
        provider.syncDoc = vi.fn(async () => {
            throw new Error('Remote base state is missing')
        })

        await provider.syncInner(true, { allowPull: true })

        expect(provider.getState()).toBe('error')
        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'drive.sync_failed',
        }))
        errorSpy.mockRestore()
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
