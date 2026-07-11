import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YjsDocManager } from './YjsDocManager.ts'

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
