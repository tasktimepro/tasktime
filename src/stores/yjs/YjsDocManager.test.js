import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YjsDocManager } from './YjsDocManager.ts'
import * as Y from 'yjs'

describe('YjsDocManager persistence commit', () => {
    beforeEach(() => vi.stubGlobal('BroadcastChannel', undefined))
    afterEach(() => vi.unstubAllGlobals())

    const fixture = () => {
        const doc = new Y.Doc()
        const read = {}
        const add = vi.fn(() => ({}))
        const updates = { getAll: vi.fn(() => read), clear: vi.fn(), add }
        const transaction = { objectStore: vi.fn(() => updates), abort: vi.fn() }
        const persistence = { synced: true, db: { transaction: vi.fn(() => transaction) }, set: vi.fn(async () => {}) }
        const manager = new YjsDocManager()
        manager.docs.set('core', { doc, persistence, loaded: true, broadcast: null })
        return { manager, doc, read, updates, transaction, persistence }
    }

    it('waits for the actual data transaction to commit, not a marker or request success', async () => {
        const { manager, doc, read, updates, transaction, persistence } = fixture()
        doc.getMap('tasks').set('task', { id: 'task' })
        let complete = false
        const flush = manager.flushPersistence().then(() => { complete = true })
        await Promise.resolve()
        await Promise.resolve()
        expect(complete).toBe(false)
        expect(persistence.db.transaction).toHaveBeenCalledWith(['updates'], 'readwrite')
        read.result = []
        read.onsuccess()
        await Promise.resolve()
        expect(complete).toBe(false)
        const restored = new Y.Doc()
        Y.applyUpdate(restored, updates.add.mock.calls[0][0])
        expect(restored.getMap('tasks').has('task')).toBe(true)
        transaction.oncomplete()
        await flush
        expect(complete).toBe(true)
        expect(persistence.set).not.toHaveBeenCalled()
    })

    it('retains persisted work from another tab and local deletion markers when compacting', async () => {
        const { manager, doc, read, updates, transaction } = fixture()
        doc.getMap('tasks').set('deleted', { id: 'deleted' })
        const oldState = Y.encodeStateAsUpdate(doc)
        doc.getMap('tasks').delete('deleted')
        const otherTab = new Y.Doc()
        otherTab.getMap('tasks').set('retained', { id: 'retained' })
        const flush = manager.flushPersistence()
        read.result = [oldState, Y.encodeStateAsUpdate(otherTab)]
        read.onsuccess()
        const restored = new Y.Doc()
        Y.applyUpdate(restored, updates.add.mock.calls[0][0])
        expect(restored.getMap('tasks').toJSON()).toEqual({ retained: { id: 'retained' } })
        expect(updates.clear).toHaveBeenCalledOnce()
        transaction.oncomplete()
        await flush
    })

    it('rejects a transaction abort even after its data requests succeeded', async () => {
        const { manager, read, transaction } = fixture()
        const onError = vi.fn()
        manager.onPersistenceError(onError)
        const flush = manager.flushPersistence()
        const rejection = expect(flush).rejects.toThrow('Storage full')
        read.result = []
        read.onsuccess()
        transaction.error = new DOMException('Storage full', 'QuotaExceededError')
        transaction.onabort()
        await rejection
        expect(onError).toHaveBeenCalledWith(transaction.error, 'core')
    })

    it.each(['not-loaded', 'closed'])('rejects %s persistence before reporting a successful flush', async state => {
        const { manager, persistence } = fixture()
        if (state === 'closed') persistence.db = null
        else persistence.synced = false
        await expect(manager.flushPersistence()).rejects.toThrow('Local data is not fully loaded')
    })

    it('aborts instead of replacing unreadable persisted updates', async () => {
        const { manager, read, transaction, updates } = fixture()
        const flush = manager.flushPersistence()
        const rejection = expect(flush).rejects.toThrow()
        read.result = [new Uint8Array([255])]
        read.onsuccess()
        await rejection
        expect(transaction.abort).toHaveBeenCalledOnce()
        expect(updates.clear).not.toHaveBeenCalled()
    })
})

describe('YjsDocManager database deletion', () => {
    beforeEach(() => {
        vi.stubGlobal('indexedDB', {
            deleteDatabase: vi.fn(),
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('resolves only after IndexedDB confirms deletion', async () => {
        vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
            const request = {}
            queueMicrotask(() => request.onsuccess?.())
            return request
        })

        const manager = new YjsDocManager()

        await expect(manager.deleteDatabases(['core'])).resolves.toBeUndefined()
    })

    it('rejects when IndexedDB deletion fails', async () => {
        vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
            const request = {
                error: new DOMException('Delete failed', 'UnknownError'),
            }
            queueMicrotask(() => request.onerror?.())
            return request
        })

        const manager = new YjsDocManager()

        await expect(manager.deleteDatabases(['core'])).rejects.toThrow('Failed to delete local database tasktime-yjs-core')
    })

    it('rejects when another tab blocks IndexedDB deletion', async () => {
        vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
            const request = {}
            queueMicrotask(() => request.onblocked?.())
            return request
        })

        const manager = new YjsDocManager()

        await expect(manager.deleteDatabases(['core'])).rejects.toThrow('Close other TaskTime Pro tabs')
    })

    it('asks peer tabs to close database handles before deletion', async () => {
        const messages = []

        class BroadcastChannelMock {
            constructor() {
                this.onmessage = null
            }

            postMessage(message) {
                messages.push(message)
            }

            close() {}
        }

        vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
        vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
            const request = {}
            queueMicrotask(() => request.onsuccess?.())
            return request
        })

        const manager = new YjsDocManager()
        await manager.deleteDatabases(['core'])

        expect(messages).toContainEqual(expect.objectContaining({
            type: 'prepare-database-deletion',
            requestId: expect.any(String),
        }))

        manager.destroy()
    })

    it('rejects when post-delete enumeration still finds a requested database', async () => {
        indexedDB.databases = vi.fn(async () => [{ name: 'tasktime-yjs-core' }])
        vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
            const request = {}
            queueMicrotask(() => request.onsuccess?.())
            return request
        })

        const manager = new YjsDocManager()

        await expect(manager.deleteDatabases(['core'])).rejects.toThrow('still exists after deletion')
    })
})
