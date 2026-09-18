// @ts-nocheck
import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YjsCloudSyncProvider } from './CloudSyncProvider'
import { YjsCloudSyncProvider as LegacyModuleProvider } from './GoogleDriveProvider'

const { captureIncident } = vi.hoisted(() => ({ captureIncident: vi.fn() }))
vi.mock('@/utils/debugbundle', () => ({ captureDebugBundleIncident: captureIncident }))

function record(doc, collection, value) {
    const item = new Y.Map()
    Object.entries(value).forEach(([key, field]) => item.set(key, field))
    doc.getMap(collection).set(value.id, item)
}

function deferred() {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}

function fixture(providerId, names = ['core', 'entries-2026', 'tasks-archived']) {
    const docs = new Map(names.map(name => [name, new Y.Doc()]))
    const remote = new Map(names.map(name => [name, new Y.Doc()]))
    const documents = Object.fromEntries(names.map(name => [name, { stateVersion: 1, stateFile: name, deltas: [] }]))
    const files = new Map()
    const manifest = {
        getProviderId: () => providerId,
        load: vi.fn(async () => {}), reload: vi.fn(async () => {}),
        getManifest: () => ({ documents }),
        getDocManifest: name => documents[name],
        ensureDocManifest: name => documents[name],
        getFileIdWithFallback: async name => name,
        downloadFileAsArrayBuffer: vi.fn(async name => files.get(name) ?? Y.encodeStateAsUpdate(remote.get(name)).buffer),
        isDirty: () => false, save: vi.fn(async () => {}),
        hasManifestChanged: async () => true, canCheckRemoteManifestChanges: () => false,
        getLastSync: () => null,
        createFile: vi.fn(async (name, blob) => { files.set(name, blob); return name }),
        setFileId: vi.fn(),
        addDelta: (name, id) => documents[name].deltas.push({ id }),
    }
    const provider = new YjsCloudSyncProvider({
        getLoadedDocs: () => [...docs.keys()],
        getDocSync: name => docs.get(name) ?? null,
        getDoc: async name => docs.get(name),
    }, { provider: providerId, generation: 0, manifest })
    provider.isOnline = () => true
    return { provider, docs, remote, manifest, documents, files }
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    const storage = new Map()
    localStorage.getItem.mockImplementation(key => storage.get(key) ?? null)
    localStorage.setItem.mockImplementation((key, value) => storage.set(key, value))
    localStorage.removeItem.mockImplementation(key => storage.delete(key))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('preserves the previous provider module export identity', () => {
    expect(LegacyModuleProvider).toBe(YjsCloudSyncProvider)
})

for (const providerId of ['google-drive', 'dropbox']) {
    describe(providerId, () => {
        it.each(['manual', 'backup'])('does not treat an unpulled lazy archive as complete deletion evidence in %s mode', async mode => {
            const { provider, docs, manifest } = fixture(providerId)
            const archive = docs.get('tasks-archived')
            docs.delete('tasks-archived')
            await provider.connect(mode)
            docs.set('tasks-archived', archive)
            await provider.syncAndSubscribeDoc('tasks-archived')
            const downloads = manifest.downloadFileAsArrayBuffer.mock.calls.length
            expect(provider.isWorkspaceHistoryReady()).toBe(false)
            expect(manifest.downloadFileAsArrayBuffer.mock.calls.length).toBe(downloads)
            await provider.sync(true)
            expect(provider.isWorkspaceHistoryReady()).toBe(true)
            provider.disconnect()
        })

        it.each(['sync', 'backup', 'manual'])('preserves edits during %s connect without an early automatic sync', async mode => {
            const { provider, docs, manifest } = fixture(providerId, ['core', 'entries-active'])
            const started = deferred(), release = deferred()
            const original = manifest.downloadFileAsArrayBuffer
            manifest.downloadFileAsArrayBuffer = vi.fn(async name => {
                if (name === 'entries-active') { started.resolve(); await release.promise }
                return original(name)
            })
            const sync = vi.spyOn(provider, 'sync')
            const connecting = provider.connect(mode, { bootstrapPullIfPristine: true })
            await started.promise
            record(docs.get('core'), 'tasks', { id: 'local', title: 'Edited while connecting', projectId: null })
            await vi.advanceTimersByTimeAsync(150)
            expect(sync).not.toHaveBeenCalled()
            release.resolve()
            await connecting
            await vi.advanceTimersByTimeAsync(1000)
            expect(console.warn).not.toHaveBeenCalled()
            if (mode === 'manual') {
                expect(manifest.createFile).not.toHaveBeenCalled()
                expect(provider.getPendingDocNames()).toContain('core')
            } else {
                expect(manifest.createFile).toHaveBeenCalledOnce()
                expect(provider.getPendingDocNames()).toEqual([])
            }
            expect(docs.get('core').getMap('tasks').has('local')).toBe(true)
            provider.disconnect()
        })


        it('keeps a manual bootstrap pull-only when an edit arrives during the first download', async () => {
            const { provider, docs, manifest } = fixture(providerId, ['core'])
            const original = manifest.downloadFileAsArrayBuffer
            manifest.downloadFileAsArrayBuffer = vi.fn(async name => {
                record(docs.get('core'), 'tasks', { id: 'during-pull', title: 'Local edit', projectId: null })
                return original(name)
            })
            await provider.connect('manual', { bootstrapPullIfPristine: true })
            expect(manifest.createFile).not.toHaveBeenCalled()
            expect(provider.getPendingDocNames()).toContain('core')
            provider.disconnect()
        })

        it('captures a local edit while the manifest is still loading', async () => {
            const { provider, docs, manifest } = fixture(providerId, ['core'])
            const started = deferred(), release = deferred()
            manifest.load = async () => { started.resolve(); await release.promise }
            const connecting = provider.connect('sync')
            await started.promise
            record(docs.get('core'), 'tasks', { id: 'early', title: 'Early edit', projectId: null })
            await vi.advanceTimersByTimeAsync(150)
            expect(manifest.createFile).not.toHaveBeenCalled()
            release.resolve()
            await connecting
            expect(manifest.createFile).toHaveBeenCalledOnce()
            expect(provider.getPendingDocNames()).toEqual([])
            expect(console.warn).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it.each(['sync', 'backup', 'manual'])('includes a dashboard document opened during %s connect', async mode => {
            const { provider, docs, remote, manifest } = fixture(providerId)
            const history = docs.get('entries-2026')
            docs.delete('entries-2026')
            record(remote.get('tasks-archived'), 'tasks', { id: 'archived', title: 'Archived task', projectId: null, archived: true })
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'archived', start: 100, end: 200 })
            const original = manifest.downloadFileAsArrayBuffer
            manifest.downloadFileAsArrayBuffer = vi.fn(async name => {
                if (name === 'core') docs.set('entries-2026', history)
                return original(name)
            })
            await provider.connect(mode, { bootstrapPullIfPristine: true })
            expect(history.getMap('timeEntries').has('entry')).toBe(true)
            expect(provider.docUpdateHandlers.has('entries-2026')).toBe(true)
            expect(captureIncident).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it.each([false, true])('checks unloaded task references after lazy loading (orphan: %s)', async orphan => {
            const { provider, docs, remote, manifest } = fixture(providerId)
            const archive = docs.get('tasks-archived')
            docs.delete('tasks-archived')
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'archived', start: 100, end: 200 })
            record(remote.get('core'), 'plannerAttachments', { id: 'attachment', type: 'task', referenceId: 'archived', date: '2026-09-18' })
            if (!orphan) record(remote.get('tasks-archived'), 'tasks', { id: 'archived', title: 'Archived task', projectId: null, archived: true })
            await provider.connect('sync')
            expect(captureIncident).not.toHaveBeenCalled()
            expect(manifest.downloadFileAsArrayBuffer).not.toHaveBeenCalledWith('tasks-archived')
            docs.set('tasks-archived', archive)
            await provider.syncAndSubscribeDoc('tasks-archived')
            expect(captureIncident).toHaveBeenCalledTimes(orphan ? 1 : 0)
            expect(docs.get('entries-2026').getMap('timeEntries').has('entry')).toBe(true)
            provider.disconnect()
        })

        it('validates after reconciliation repairs a reference in an ordinary sync', async () => {
            const { provider, remote, docs } = fixture(providerId, ['core'])
            await provider.connect('manual')
            record(remote.get('core'), 'projects', { id: 'project', title: 'Project', preferredClientId: 'client' })
            provider.onSyncComplete(() => {
                record(docs.get('core'), 'clients', { id: 'client', title: 'Client' })
            })
            await provider.sync(true)
            expect(provider.getState()).toBe('idle')
            expect(provider.getPendingDocNames()).toEqual([])
            expect(captureIncident).not.toHaveBeenCalled()
            expect(console.warn).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it('preserves an edit through failed connection and retries it only on recovery', async () => {
            const { provider, docs, manifest } = fixture(providerId, ['core'])
            manifest.load = vi.fn(async () => {
                record(docs.get('core'), 'tasks', { id: 'pending', title: 'Pending edit', projectId: null })
                throw new Error('network unavailable')
            })
            await expect(provider.connect('backup')).rejects.toThrow('network unavailable')
            await vi.advanceTimersByTimeAsync(1000)
            expect(provider.getPendingDocNames()).toContain('core')
            expect(manifest.createFile).not.toHaveBeenCalled()
            manifest.load = vi.fn(async () => {})
            await provider.connect('backup')
            expect(manifest.createFile).toHaveBeenCalledOnce()
            expect(provider.getPendingDocNames()).toEqual([])
            provider.disconnect()
        })

        it.each(['sync', 'backup'])('includes history opened during the final %s manifest write', async mode => {
            const { provider, docs, remote, manifest } = fixture(providerId)
            const history = docs.get('entries-2026')
            docs.delete('entries-2026')
            record(remote.get('tasks-archived'), 'tasks', { id: 'archived', title: 'Archived task', projectId: null, archived: true })
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'archived', start: 100, end: 200 })
            let dirty = true
            manifest.isDirty = () => dirty
            manifest.save = vi.fn(async () => {
                docs.set('entries-2026', history)
                dirty = false
            })
            await provider.connect(mode)
            expect(history.getMap('timeEntries').has('entry')).toBe(true)
            expect(provider.docUpdateHandlers.has('entries-2026')).toBe(true)
            expect(manifest.save).toHaveBeenCalledOnce()
            provider.disconnect()
        })

        it('reports a recurrence after a reference was repaired locally and synced', async () => {
            const { provider, remote, docs } = fixture(providerId, ['core'])
            record(remote.get('core'), 'projects', { id: 'project', title: 'Project', preferredClientId: 'client' })
            await provider.connect('sync')
            expect(console.warn).toHaveBeenCalledTimes(1)
            record(docs.get('core'), 'clients', { id: 'client', title: 'Client' })
            await provider.sync(true, { allowPull: false })
            expect(console.warn).toHaveBeenCalledTimes(1)
            const removal = new Y.Doc()
            Y.applyUpdate(removal, Y.encodeStateAsUpdate(docs.get('core')))
            const vector = Y.encodeStateVector(removal)
            removal.getMap('clients').delete('client')
            provider.applyValidatedRemoteUpdate('core', docs.get('core'), Y.encodeStateAsUpdate(removal, vector), 'remote deletion')
            await provider.sync(true, { allowPull: false })
            expect(console.warn).toHaveBeenCalledTimes(2)
            provider.disconnect()
        })

        it('defers references into a local archive that is not loaded or present in the remote manifest', async () => {
            const { provider, docs, remote, documents } = fixture(providerId)
            const archive = docs.get('tasks-archived')
            record(archive, 'tasks', { id: 'local-archive', title: 'Existing local history', projectId: null, archived: true })
            docs.delete('tasks-archived')
            delete documents['tasks-archived']
            record(remote.get('core'), 'tasks', { id: 'active', title: 'Active task', projectId: null })
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'local-archive', start: 100, end: 200 })
            await provider.connect('sync')
            expect(captureIncident).not.toHaveBeenCalled()
            docs.set('tasks-archived', archive)
            provider.validateSettledRemoteState()
            expect(captureIncident).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it('waits for an archived task arriving after its time entry', async () => {
            const { provider, remote, docs } = fixture(providerId)
            record(remote.get('core'), 'tasks', { id: 'active', title: 'Active task', projectId: null })
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'archived', start: 100, end: 200 })
            record(remote.get('tasks-archived'), 'tasks', { id: 'archived', title: 'Archived task', projectId: null, archived: true })
            await provider.connect('sync')
            expect(docs.get('entries-2026').getMap('timeEntries').has('entry')).toBe(true)
            expect(docs.get('tasks-archived').getMap('tasks').has('archived')).toBe(true)
            expect(console.warn).not.toHaveBeenCalled()
            expect(captureIncident).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it('validates the complete base and delta sequence, not intermediate broken references', async () => {
            const { provider, remote, documents, files } = fixture(providerId, ['core'])
            record(remote.get('core'), 'projects', { id: 'project', title: 'Project', preferredClientId: 'client' })
            files.set('core', Y.encodeStateAsUpdate(remote.get('core')).buffer)
            const vector = Y.encodeStateVector(remote.get('core'))
            record(remote.get('core'), 'clients', { id: 'client', title: 'Client' })
            files.set('tasktime-yjs-core-delta-repair.bin', Y.encodeStateAsUpdate(remote.get('core'), vector).buffer)
            documents.core.deltas.push({ id: 'repair' })
            await provider.connect('sync')
            expect(console.warn).not.toHaveBeenCalled()
            expect(captureIncident).not.toHaveBeenCalled()
            provider.disconnect()
        })

        it('reports a genuinely missing task after the full pass while retaining the entry', async () => {
            const { provider, remote, docs } = fixture(providerId)
            record(remote.get('entries-2026'), 'timeEntries', { id: 'orphan', taskId: 'missing', start: 100, end: 200 })
            await provider.connect('sync')
            expect(captureIncident).toHaveBeenCalledWith(expect.objectContaining({ incidentKey: expect.stringContaining('remote_validation_warning') }))
            expect(docs.get('entries-2026').getMap('timeEntries').has('orphan')).toBe(true)
            provider.disconnect()
        })

        it('does not infer missing references from an interrupted pull and checks again on retry', async () => {
            const { provider, remote, manifest, docs } = fixture(providerId)
            record(remote.get('core'), 'tasks', { id: 'active', title: 'Active task', projectId: null })
            record(remote.get('entries-2026'), 'timeEntries', { id: 'entry', taskId: 'archived', start: 100, end: 200 })
            record(remote.get('tasks-archived'), 'tasks', { id: 'archived', title: 'Archived task', projectId: null, archived: true })
            const original = manifest.downloadFileAsArrayBuffer
            manifest.downloadFileAsArrayBuffer = vi.fn(async name => {
                if (name === 'tasks-archived') throw new Error('temporary network failure')
                return original(name)
            })
            await expect(provider.connect('sync')).rejects.toThrow('temporary network failure')
            expect(captureIncident.mock.calls.some(([event]) => event.incidentKey.endsWith('remote_validation_warning'))).toBe(false)
            manifest.downloadFileAsArrayBuffer = original
            await provider.connect('sync')
            expect(docs.get('tasks-archived').getMap('tasks').has('archived')).toBe(true)
            expect(captureIncident.mock.calls.some(([event]) => event.incidentKey.endsWith('remote_validation_warning'))).toBe(false)
            provider.disconnect()
        })
    })
}
