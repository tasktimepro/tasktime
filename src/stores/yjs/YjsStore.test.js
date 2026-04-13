import * as Y from 'yjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'tasktime-disconnected-dirty-docs'

const { docs, providerInstances, storage } = vi.hoisted(() => ({
    docs: new Map(),
    providerInstances: [],
    storage: new Map(),
}))

vi.mock('./YjsDocManager', async () => {
    const Yjs = await import('yjs')

    return {
        YjsDocManager: class {
            async getDoc(name) {
                if (!docs.has(name)) {
                    docs.set(name, new Yjs.Doc())
                }

                return docs.get(name)
            }

            isLoaded(name) {
                return docs.has(name)
            }

            getDocSync(name) {
                return docs.get(name) ?? null
            }

            getLoadedDocs() {
                return Array.from(docs.keys())
            }

            destroy() {
                docs.forEach((doc) => doc.destroy())
                docs.clear()
            }

            async deleteDatabases() {}
        }
    }
})

vi.mock('./providers/GoogleDriveProvider', () => ({
    YjsDriveProvider: class {
        constructor() {
            this.markDocsForFullStateUpload = vi.fn()
            this.setSyncMode = vi.fn()
            this.getManifest = vi.fn(() => ({}))
            this.onSyncComplete = vi.fn()
            this.connect = vi.fn(async () => {})
            this.disconnect = vi.fn()
            this.isConnected = vi.fn(() => true)
            this.syncAndSubscribeDoc = vi.fn(async () => {})
            providerInstances.push(this)
        }
    }
}))

vi.mock('./providers/BackupManager', () => ({
    BackupManager: class {
        async maybeCreateBackup() {}
    }
}))

import { YjsStore } from './YjsStore.ts'

describe('YjsStore reconnect sync tracking', () => {
    beforeEach(() => {
        storage.clear()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, String(value))
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })

        localStorage.clear()

        docs.forEach((doc) => doc.destroy())
        docs.clear()
        providerInstances.length = 0
    })

    it('hands disconnected local edits to Drive on reconnect', async () => {
        const store = new YjsStore()
        await store.initialize()

        const project = new Y.Map()
        project.set('id', 'project-1')
        project.set('title', 'Offline project')

        docs.get('core').getMap('projects').set('project-1', project)

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['core'])
        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })

    it('does not force-upload clean docs on reconnect', async () => {
        const store = new YjsStore()
        await store.initialize()

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).not.toHaveBeenCalled()
        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })
})

describe('YjsStore timer reconciliation', () => {
    beforeEach(() => {
        storage.clear()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, String(value))
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })

        localStorage.clear()

        docs.forEach((doc) => doc.destroy())
        docs.clear()
        providerInstances.length = 0
    })

    function objectToYMap(data) {
        const map = new Y.Map()
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                map.set(key, value)
            }
        })
        return map
    }

    it('deletes orphaned timers that have a matching _stoppedTimerKey entry', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        // Simulate: timer still exists in core (delete didn't sync yet)
        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
            paused: false,
        }))

        // Simulate: entry from stopping that timer already arrived
        entriesDoc.getMap('timeEntries').set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: 1000,
            end: 2000,
            _stoppedTimerKey: 'project-1',
        }))

        expect(coreDoc.getMap('timers').has('project-1')).toBe(true)

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(false)
        // Entry is preserved
        expect(entriesDoc.getMap('timeEntries').has('entry-1')).toBe(true)

        store.destroy()
    })

    it('does not delete timers without matching _stoppedTimerKey entries', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        // Active timer - no matching entry
        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
            paused: false,
        }))

        // Unrelated entry (no _stoppedTimerKey)
        entriesDoc.getMap('timeEntries').set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: 500,
            end: 900,
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(true)

        store.destroy()
    })

    it('handles multiple orphaned timers in a single pass', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
        }))
        coreDoc.getMap('timers').set('project-2', objectToYMap({
            projectId: 'project-2',
            taskId: 'task-2',
            startTime: 2000,
        }))
        // project-3 has no matching entry — should survive
        coreDoc.getMap('timers').set('project-3', objectToYMap({
            projectId: 'project-3',
            taskId: 'task-3',
            startTime: 3000,
        }))

        entriesDoc.getMap('timeEntries').set('e1', objectToYMap({
            id: 'e1', taskId: 'task-1', start: 1000, end: 2000,
            _stoppedTimerKey: 'project-1',
        }))
        entriesDoc.getMap('timeEntries').set('e2', objectToYMap({
            id: 'e2', taskId: 'task-2', start: 2000, end: 3000,
            _stoppedTimerKey: 'project-2',
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(false)
        expect(coreDoc.getMap('timers').has('project-2')).toBe(false)
        expect(coreDoc.getMap('timers').has('project-3')).toBe(true)

        store.destroy()
    })
})