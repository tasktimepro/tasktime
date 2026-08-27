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

import { CloudProviderMovedError, YjsCloudSyncProvider, YjsDriveProvider } from './GoogleDriveProvider.ts'
import { CloudFileStoreError } from './CloudFileStore.ts'
import { getSyncPersistenceState, markPendingChanges } from '@/utils/syncPersistence'

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

    it('constructs the reusable sync core from an injected manifest and provider scope', () => {
        const manifest = { getProviderId: () => 'dropbox' }
        const provider = new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'dropbox',
            generation: 3,
            manifest,
        })

        expect(provider.getManifest()).toBe(manifest)
    })

    it('rejects a provider scope that does not match the injected file store', () => {
        expect(() => new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'dropbox',
            generation: 3,
            manifest: { getProviderId: () => 'google-drive' },
        })).toThrow('does not match')
    })

    it('rejects an invalid provider generation before reading or writing recovery state', () => {
        expect(() => new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'dropbox',
            generation: -1,
            manifest: { getProviderId: () => 'dropbox' },
        })).toThrow('non-negative safe integer')
    })

    it('stops an upgraded source client after a verified provider migration marker', async () => {
        const provider = new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'google-drive',
            generation: 2,
            manifest: {
                getProviderId: () => 'google-drive',
                load: vi.fn(async () => {}),
                readCachedCloudBindingMarker: vi.fn(async () => ({
                    version: 1,
                    workspaceId: '42de9b18-445c-4d28-b5c9-88bc476fc7f1',
                    generation: 3,
                    activeProvider: 'dropbox',
                    state: 'moved',
                    operationId: 'f85f92e3-1584-4d77-8292-3a9977adcf44',
                    updatedAt: '2026-08-19T10:00:00.000Z',
                })),
            },
        })
        provider.isOnline = () => true

        await expect(provider.connect('manual')).rejects.toBeInstanceOf(CloudProviderMovedError)
        expect(provider.isConnected()).toBe(false)
    })

    it('uses Dropbox-scoped diagnostics in the reusable sync core', async () => {
        const provider = new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'dropbox',
            generation: 3,
            manifest: {
                getProviderId: () => 'dropbox',
                hasManifestChanged: vi.fn(async () => {
                    throw new CloudFileStoreError(
                        'transient-unavailable',
                        'Dropbox is temporarily unavailable.',
                        { provider: 'dropbox' },
                    )
                }),
            },
        })

        provider.connected = true
        provider.isOnline = () => true

        await provider.sync(false, { allowPull: true })

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'dropbox.sync_failed',
            name: 'TaskTimeCloudSyncError',
            message: 'TaskTime Pro Dropbox sync failed',
        }))
    })

    it('recovers provider-neutral missing-object errors without Drive-specific error classes', async () => {
        const provider = new YjsCloudSyncProvider({
            getLoadedDocs: () => [],
            getDocSync: () => null,
        }, {
            provider: 'dropbox',
            generation: 4,
            manifest: {
                getProviderId: () => 'dropbox',
                deleteFileId: vi.fn(),
                downloadFileAsArrayBuffer: vi.fn(async () => {
                    throw new CloudFileStoreError(
                        'not-found',
                        'Dropbox object was not found.',
                        { provider: 'dropbox' },
                    )
                }),
                refreshFileCache: vi.fn(async () => {}),
                getFileIdWithFallback: vi.fn(async () => null),
            },
        })

        await expect(provider.downloadFileWithRecovery(
            'tasktime-yjs-core.bin',
            'stale-dropbox-id',
        )).resolves.toBeNull()

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'dropbox.remote_file_missing_after_recovery',
            name: 'TaskTimeCloudSyncError',
        }))
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

    it('subscribes an on-demand document locally without remote work while offline', async () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())

        provider.connected = true
        provider.syncMode = 'sync'
        provider.isOnline = () => false
        provider.manifest = {
            getManifest: vi.fn(() => ({ documents: {} })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        await provider.syncAndSubscribeDoc('entries-2026')

        expect(provider.syncDoc).not.toHaveBeenCalled()
        expect(provider.manifest.save).not.toHaveBeenCalled()
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('entries-2026')
    })

    it('serializes remote connection work under the cross-tab Drive lock', async () => {
        const provider = createProviderWithCoreDoc(new Y.Doc())
        const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
        const request = vi.fn(async (_name, _options, callback) => callback({ name: 'tasktime-drive-sync' }))

        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request },
        })

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            isDirty: vi.fn(() => false),
        }
        provider.subscribeToDoc = vi.fn()

        try {
            await provider.connect('manual')
            expect(request).toHaveBeenCalledWith(
                'tasktime-drive-sync',
                { ifAvailable: false },
                expect.any(Function),
            )
            expect(provider.manifest.load).toHaveBeenCalledTimes(1)
        } finally {
            if (originalLocksDescriptor) {
                Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
            } else {
                delete navigator.locks
            }
        }
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

    it('waits for an active sync before syncing an externally loaded lazy document', async () => {
        const coreDoc = new Y.Doc()
        const archivedTasksDoc = new Y.Doc()
        const loadedDocs = ['core']
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => [...loadedDocs],
            getDocSync: (name) => ({
                core: coreDoc,
                'tasks-archived': archivedTasksDoc,
            })[name] ?? null,
        }, 'playwright-access-token')
        let releaseCoreSync
        const coreSyncStarted = new Promise((resolve) => {
            releaseCoreSync = resolve
        })
        let unblockCoreSync
        const coreSyncBlocked = new Promise((resolve) => {
            unblockCoreSync = resolve
        })

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            getManifest: vi.fn(() => ({ documents: {} })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async (docName) => {
            if (docName === 'core') {
                releaseCoreSync()
                await coreSyncBlocked
            }
        })
        provider.subscribeToDoc = vi.fn()

        const activeSync = provider.sync(true, { allowPull: false })
        await coreSyncStarted
        loadedDocs.push('tasks-archived')
        const lazySync = provider.syncAndSubscribeDoc('tasks-archived')
        await Promise.resolve()

        expect(provider.syncDoc).toHaveBeenCalledTimes(1)

        unblockCoreSync()
        await Promise.all([activeSync, lazySync])

        expect(provider.syncDoc.mock.calls.map(([docName]) => docName)).toEqual([
            'core',
            'tasks-archived',
        ])

        coreDoc.destroy()
        archivedTasksDoc.destroy()
    })

    it('defers a callback-loaded lazy manifest write to the owning sync pass', async () => {
        const coreDoc = new Y.Doc()
        const archivedInvoicesDoc = new Y.Doc()
        const loadedDocs = ['core']
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => [...loadedDocs],
            getDocSync: (name) => ({
                core: coreDoc,
                'invoices-archived': archivedInvoicesDoc,
            })[name] ?? null,
        }, 'playwright-access-token')
        let manifestDirty = false
        const saveManifest = vi.fn(async () => {
            manifestDirty = false
        })

        provider.connected = true
        provider.isOnline = () => true
        provider.manifest = {
            getManifest: vi.fn(() => ({ documents: {} })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => manifestDirty),
            save: saveManifest,
        }
        provider.syncDoc = vi.fn(async (docName) => {
            if (docName === 'invoices-archived') {
                manifestDirty = true
            }
        })
        provider.subscribeToDoc = vi.fn()
        provider.onSyncComplete(async () => {
            loadedDocs.push('invoices-archived')
            await provider.syncAndSubscribeDoc('invoices-archived')
            expect(saveManifest).not.toHaveBeenCalled()
        })

        await provider.sync(true, { allowPull: false })

        expect(saveManifest).toHaveBeenCalledTimes(1)

        coreDoc.destroy()
        archivedInvoicesDoc.destroy()
    })

    it('clears exact persisted recovery evidence after sync-mode connect succeeds', async () => {
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
        provider.syncDoc = vi.fn(async (docName) => {
            expect(provider.forceFullStateDocs.has(docName)).toBe(true)
            provider.forceFullStateDocs.delete(docName)
        })
        provider.subscribeToDoc = vi.fn()
        markPendingChanges('core')

        await provider.connect('sync')

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            pendingDocNames: [],
        }))

        provider.disconnect()
        liveDoc.destroy()
    })

    it('retains exact persisted recovery evidence when new local work remains after connect', async () => {
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
        provider.syncDoc = vi.fn(async (docName) => {
            provider.forceFullStateDocs.delete(docName)
            provider.pendingDeltas.set(docName, [new Uint8Array([1])])
        })
        provider.subscribeToDoc = vi.fn()
        markPendingChanges('core')

        await provider.connect('sync')

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        }))

        provider.disconnect()
        liveDoc.destroy()
    })

    it('loads and recovers an exact lazy reconnect document during sync-mode connect', async () => {
        const coreDoc = new Y.Doc()
        const historicalEntriesDoc = new Y.Doc()
        const loadedDocs = ['core']
        const getDoc = vi.fn(async (docName) => {
            if (!loadedDocs.includes(docName)) loadedDocs.push(docName)
            return docName === 'entries-2026' ? historicalEntriesDoc : coreDoc
        })
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => [...loadedDocs],
            getDocSync: (docName) => ({
                core: coreDoc,
                'entries-2026': historicalEntriesDoc,
            })[docName] ?? null,
            getDoc,
        }, 'playwright-access-token')

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {
                core: { stateVersion: 1, stateFile: 'tasktime-yjs-core.bin', deltas: [] },
                'entries-2026': { stateVersion: 1, stateFile: 'tasktime-yjs-entries-2026.bin', deltas: [] },
            } })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async (docName) => {
            provider.forceFullStateDocs.delete(docName)
        })
        provider.subscribeToDoc = vi.fn()
        provider.markDocsForFullStateUpload(['entries-2026'])

        await provider.connect('sync')

        expect(getDoc).toHaveBeenCalledWith('entries-2026')
        expect(provider.syncDoc).toHaveBeenCalledWith('entries-2026')
        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            pendingDocNames: [],
        }))

        provider.disconnect()
        coreDoc.destroy()
        historicalEntriesDoc.destroy()
    })

    it('clears exact persisted recovery evidence after a direct lazy document sync succeeds', async () => {
        const coreDoc = new Y.Doc()
        const archivedTasksDoc = new Y.Doc()
        const loadedDocs = ['core']
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => [...loadedDocs],
            getDocSync: (name) => ({
                core: coreDoc,
                'tasks-archived': archivedTasksDoc,
            })[name] ?? null,
        }, 'playwright-access-token')

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async (docName) => {
            if (docName === 'tasks-archived') {
                expect(provider.forceFullStateDocs.has(docName)).toBe(true)
                provider.forceFullStateDocs.delete(docName)
            }
        })
        provider.subscribeToDoc = vi.fn()

        await provider.connect('manual', { bootstrapPullIfPristine: false })
        markPendingChanges('tasks-archived')
        loadedDocs.push('tasks-archived')

        await provider.syncAndSubscribeDoc('tasks-archived', { allowPull: true })

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            pendingDocNames: [],
        }))

        provider.disconnect()
        coreDoc.destroy()
        archivedTasksDoc.destroy()
    })

    it('retains exact persisted recovery evidence when a direct lazy document sync fails', async () => {
        const coreDoc = new Y.Doc()
        const archivedTasksDoc = new Y.Doc()
        const loadedDocs = ['core']
        const provider = new YjsDriveProvider({
            getLoadedDocs: () => [...loadedDocs],
            getDocSync: (name) => ({
                core: coreDoc,
                'tasks-archived': archivedTasksDoc,
            })[name] ?? null,
        }, 'playwright-access-token')

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async (docName) => {
            if (docName === 'tasks-archived') throw new Error('lazy Dropbox sync failed')
        })
        provider.subscribeToDoc = vi.fn()

        await provider.connect('manual', { bootstrapPullIfPristine: false })
        markPendingChanges('tasks-archived')
        loadedDocs.push('tasks-archived')

        await provider.syncAndSubscribeDoc('tasks-archived', { allowPull: true }).catch(() => {})

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['tasks-archived'],
        }))

        provider.disconnect()
        coreDoc.destroy()
        archivedTasksDoc.destroy()
    })

    it.each([
        {
            label: 'Google Drive',
            scope: { provider: 'google-drive', generation: 0 },
        },
        {
            label: 'Dropbox',
            scope: { provider: 'dropbox', generation: 3 },
        },
    ])('loads and recovers exact unloaded documents during a forced $label sync', async ({ scope }) => {
        const docs = new Map([
            ['core', new Y.Doc()],
            ['entries-active', new Y.Doc()],
            ['tasks-archived', new Y.Doc()],
            ['entries-2026', new Y.Doc()],
        ])
        const loadedDocs = ['core', 'entries-active']
        const getDoc = vi.fn(async (docName) => {
            if (!loadedDocs.includes(docName)) loadedDocs.push(docName)
            return docs.get(docName)
        })
        const manifest = {
            getProviderId: () => scope.provider,
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            getLastSync: vi.fn(() => null),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        const provider = scope.provider === 'dropbox'
            ? new YjsCloudSyncProvider({
                getLoadedDocs: () => [...loadedDocs],
                getDocSync: (docName) => loadedDocs.includes(docName) ? docs.get(docName) : null,
                getDoc,
            }, {
                provider: 'dropbox',
                generation: scope.generation,
                manifest,
            })
            : new YjsDriveProvider({
                getLoadedDocs: () => [...loadedDocs],
                getDocSync: (docName) => loadedDocs.includes(docName) ? docs.get(docName) : null,
                getDoc,
            }, 'playwright-access-token')

        provider.isOnline = () => true
        provider.manifest = manifest
        provider.syncDoc = vi.fn(async (docName) => {
            // Mirror the production priority: a recovery upload consumes the
            // force queue first, while an ordinary Sync Now consumes the
            // verification queue. A document must never occupy both queues and
            // therefore require two provider writes in one forced pass.
            if (provider.forceFullStateDocs.has(docName)) {
                provider.forceFullStateDocs.delete(docName)
            } else {
                provider.verifyFullStateDocs.delete(docName)
            }
            provider.pendingDeltas.set(docName, [])
        })
        provider.subscribeToDoc = vi.fn()
        const pendingStates = []

        await provider.connect('manual', { bootstrapPullIfPristine: false })
        provider.onPendingChange((hasPending) => pendingStates.push(hasPending))
        markPendingChanges('tasks-archived', scope)
        markPendingChanges('entries-2026', scope)

        await provider.sync(true, { allowPull: false, forceFullState: true })

        expect(getDoc).toHaveBeenCalledWith('tasks-archived')
        expect(getDoc).toHaveBeenCalledWith('entries-2026')
        expect(provider.syncDoc).toHaveBeenCalledWith('tasks-archived', false)
        expect(provider.syncDoc).toHaveBeenCalledWith('entries-2026', false)
        expect(provider.syncDoc.mock.calls.filter(([docName]) => docName === 'tasks-archived')).toHaveLength(1)
        expect(provider.syncDoc.mock.calls.filter(([docName]) => docName === 'entries-2026')).toHaveLength(1)
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('tasks-archived')
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('entries-2026')
        expect(getSyncPersistenceState(scope)).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            pendingDocNames: [],
        }))
        expect(provider.hasLocalChangesToPush()).toBe(false)
        expect(pendingStates).toEqual([true, false])

        provider.disconnect()
        docs.forEach((doc) => doc.destroy())
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

    it('syncs local project note updates after a quiet period in backup mode', async () => {
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

            vi.advanceTimersByTime(1499)

            expect(provider.pendingDeltas.get('core')).toHaveLength(1)
            expect(syncSpy).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)

            expect(syncSpy).toHaveBeenCalledWith(false, { allowPull: false })

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('restarts the project note quiet period after each backup-mode edit', async () => {
        vi.useFakeTimers()

        try {
            const liveDoc = new Y.Doc()
            const provider = createProviderWithCoreDoc(liveDoc)

            provider.connected = true
            provider.isOnline = () => true
            provider.setSyncMode('backup')

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            provider.subscribeToDoc('core')

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'First note draft',
                }))
            }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

            vi.advanceTimersByTime(1_000)

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'Latest note draft',
                }))
            }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

            vi.advanceTimersByTime(1_499)

            expect(syncSpy).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)

            expect(syncSpy).toHaveBeenCalledTimes(1)
            expect(syncSpy).toHaveBeenCalledWith(false, { allowPull: false })

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('syncs local project note updates with a manifest check in sync mode', async () => {
        vi.useFakeTimers()

        try {
            const liveDoc = new Y.Doc()
            const provider = createProviderWithCoreDoc(liveDoc)

            provider.connected = true
            provider.isOnline = () => true
            provider.setSyncMode('sync')

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            provider.subscribeToDoc('core')

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'Bidirectional note draft',
                }))
            }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

            vi.advanceTimersByTime(1_500)

            expect(syncSpy).toHaveBeenCalledTimes(1)
            expect(syncSpy).toHaveBeenCalledWith(false, { allowPull: true })

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps local project note updates manual in manual mode', async () => {
        vi.useFakeTimers()

        try {
            const liveDoc = new Y.Doc()
            const provider = createProviderWithCoreDoc(liveDoc)

            provider.isOnline = () => true
            provider.manifest = {
                load: vi.fn(async () => {}),
                getManifest: vi.fn(() => ({ documents: {} })),
                isDirty: vi.fn(() => false),
                save: vi.fn(async () => {}),
            }

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            await provider.connect('manual')

            liveDoc.transact(() => {
                liveDoc.getMap('projects').set('project-1', objectToYMap({
                    id: 'project-1',
                    title: 'Manual project note',
                }))
            }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

            vi.advanceTimersByTime(2_000)

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

    it('retries pending local changes after cross-tab lock contention', async () => {
        vi.useFakeTimers()

        const provider = createProviderWithCoreDoc(new Y.Doc())
        const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
        const request = vi.fn()
            .mockImplementationOnce(async (_name, _options, callback) => callback(null))
            .mockImplementation(async (_name, _options, callback) => callback({ name: 'tasktime-drive-sync' }))

        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request },
        })

        provider.connected = true
        provider.isOnline = () => true
        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])
        provider.syncInner = vi.fn(async () => {})

        try {
            await provider.sync(false, { allowPull: false })

            expect(request).toHaveBeenCalledTimes(1)
            expect(provider.syncInner).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(249)

            expect(request).toHaveBeenCalledTimes(1)

            await vi.advanceTimersByTimeAsync(1)

            expect(request).toHaveBeenCalledTimes(2)
            expect(provider.syncInner).toHaveBeenCalledWith(false, { allowPull: false })
        } finally {
            provider.disconnect()
            vi.useRealTimers()

            if (originalLocksDescriptor) {
                Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
            } else {
                delete navigator.locks
            }
        }
    })

    it('backs off repeated cross-tab lock retries while local changes remain pending', async () => {
        vi.useFakeTimers()

        const provider = createProviderWithCoreDoc(new Y.Doc())
        const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
        const request = vi.fn(async (_name, _options, callback) => callback(null))

        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request },
        })

        provider.connected = true
        provider.isOnline = () => true
        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])

        try {
            await provider.sync(false, { allowPull: true })

            await vi.advanceTimersByTimeAsync(250)

            expect(request).toHaveBeenCalledTimes(2)

            await vi.advanceTimersByTimeAsync(499)

            expect(request).toHaveBeenCalledTimes(2)

            await vi.advanceTimersByTimeAsync(1)

            expect(request).toHaveBeenCalledTimes(3)
        } finally {
            provider.disconnect()
            vi.useRealTimers()

            if (originalLocksDescriptor) {
                Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
            } else {
                delete navigator.locks
            }
        }
    })

    it('cancels an automatic pending retry when the user switches to manual mode', async () => {
        vi.useFakeTimers()

        const provider = createProviderWithCoreDoc(new Y.Doc())
        const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
        const request = vi.fn(async (_name, _options, callback) => callback(null))

        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request },
        })

        provider.connected = true
        provider.isOnline = () => true
        provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])

        try {
            await provider.sync(false, { allowPull: true })

            provider.setSyncMode('manual')
            await vi.advanceTimersByTimeAsync(250)

            expect(request).toHaveBeenCalledTimes(1)
        } finally {
            provider.disconnect()
            vi.useRealTimers()

            if (originalLocksDescriptor) {
                Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
            } else {
                delete navigator.locks
            }
        }
    })

    it('retries pending local changes after an active sync completes', async () => {
        vi.useFakeTimers()

        try {
            const provider = createProviderWithCoreDoc(new Y.Doc())

            provider.connected = true
            provider.isOnline = () => true
            provider.pendingDeltas.set('core', [new Uint8Array([1, 2, 3])])
            provider.isSyncing = true
            provider.syncInner = vi.fn(async () => {})

            await provider.sync(false, { allowPull: true })

            expect(provider.syncInner).not.toHaveBeenCalled()

            provider.isSyncing = false
            await vi.advanceTimersByTimeAsync(250)

            expect(provider.syncInner).toHaveBeenCalledWith(false, { allowPull: true })

            provider.disconnect()
        } finally {
            vi.useRealTimers()
        }
    })

    it('checks for remote changes every five minutes only while sync mode is visible', async () => {
        vi.useFakeTimers()

        const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        })

        try {
            const provider = createProviderWithCoreDoc(new Y.Doc())

            provider.connected = true

            const syncSpy = vi.spyOn(provider, 'sync').mockResolvedValue(undefined)

            provider.setSyncMode('sync')

            vi.advanceTimersByTime(299_999)

            expect(syncSpy).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)

            expect(syncSpy).toHaveBeenCalledTimes(1)
            expect(syncSpy).toHaveBeenCalledWith(false, { allowPull: true })

            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                value: 'hidden',
            })

            vi.advanceTimersByTime(300_000)

            expect(syncSpy).toHaveBeenCalledTimes(1)

            provider.disconnect()
        } finally {
            vi.useRealTimers()

            if (originalVisibilityDescriptor) {
                Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor)
            } else {
                delete document.visibilityState
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
            listSyncFiles: vi.fn()
                .mockResolvedValueOnce([
                    { id: 'manifest-id', name: 'tasktime-yjs-manifest.json', modifiedTime: '2026-06-04T00:00:00.000Z' },
                    { id: 'core-id', name: 'tasktime-yjs-core.bin', modifiedTime: '2026-06-04T00:00:01.000Z' },
                ])
                .mockResolvedValueOnce([]),
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
            listSyncFiles: vi.fn(async () => [
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

    it('merges a project note typing batch into one Drive delta upload', async () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)
        const capturedUpdates = []

        liveDoc.on('update', (update) => {
            capturedUpdates.push(update)
        })

        liveDoc.transact(() => {
            liveDoc.getMap('notes').set('first', 'Project')
        }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

        liveDoc.transact(() => {
            liveDoc.getMap('notes').set('second', 'Project notes')
        }, PROJECT_NOTES_LOCAL_SAVE_ORIGIN)

        provider.pendingDeltas.set('core', capturedUpdates)
        provider.manifest = {
            createFile: vi.fn(async () => 'delta-file-id'),
            setFileId: vi.fn(),
            addDelta: vi.fn(),
            save: vi.fn(async () => {}),
        }

        await provider.pushDeltas('core', liveDoc)

        expect(provider.manifest.createFile).toHaveBeenCalledTimes(1)
        expect(provider.manifest.addDelta).toHaveBeenCalledTimes(1)
        expect(provider.pendingDeltas.get('core')).toHaveLength(0)

        const uploadedBlob = provider.manifest.createFile.mock.calls[0][1]
        const restoredDoc = new Y.Doc()
        const uploadedBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.addEventListener('load', () => resolve(reader.result))
            reader.addEventListener('error', () => reject(reader.error))
            reader.readAsArrayBuffer(uploadedBlob)
        })

        Y.applyUpdate(restoredDoc, new Uint8Array(uploadedBuffer))

        expect(restoredDoc.getMap('notes').toJSON()).toEqual({
            first: 'Project',
            second: 'Project notes',
        })
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
