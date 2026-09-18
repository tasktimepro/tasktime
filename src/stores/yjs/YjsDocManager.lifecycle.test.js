import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { YjsDocManager } from './YjsDocManager'

const state = vi.hoisted(() => ({ pending: false, instances: [] }))
const registry = vi.hoisted(() => ({ list: vi.fn(), register: vi.fn(), unregister: vi.fn() }))
vi.mock('./persistedDocRegistry', () => ({
    listRegisteredPersistedDocs: registry.list,
    registerPersistedDoc: registry.register,
    unregisterPersistedDocs: registry.unregister,
}))
vi.mock('y-indexeddb', () => ({
    IndexeddbPersistence: class {
        constructor() {
            this.listeners = new Map()
            this.destroy = vi.fn()
            this.synced = !state.pending
            this.whenSynced = new Promise(resolve => {
                this.finish = () => { this.synced = true; resolve(this) }
            })
            if (this.synced) this.finish()
            state.instances.push(this)
        }
        on(event, callback) { this.listeners.set(event, callback) }
        off(event) { this.listeners.delete(event) }
        emit(event, value) { this.listeners.get(event)?.(value) }
    },
}))

describe('YjsDocManager loading and cross-tab lifecycle', () => {
    const managers = []
    const createManager = () => {
        const manager = new YjsDocManager()
        managers.push(manager)
        return manager
    }
    beforeEach(() => {
        vi.stubGlobal('BroadcastChannel', undefined)
        vi.stubGlobal('indexedDB', undefined)
        state.pending = false
        state.instances = []
        registry.list.mockReset().mockResolvedValue([])
        registry.register.mockReset().mockResolvedValue(undefined)
        registry.unregister.mockReset().mockResolvedValue(undefined)
    })
    afterEach(() => {
        managers.splice(0).forEach(manager => manager.destroy())
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('shares an in-flight load and exposes a document only after hydration', async () => {
        state.pending = true
        const manager = createManager()
        const first = manager.getDoc('core')
        const second = manager.getDoc('core')
        expect(manager.isLoaded('core')).toBe(false)
        expect(manager.getDocSync('core')).toBeNull()
        expect(manager.getLoadedDocs()).toEqual([])
        expect(state.instances).toHaveLength(1)
        state.instances[0].finish()
        const doc = await first
        expect(await second).toBe(doc)
        expect(await manager.getDoc('core')).toBe(doc)
        expect(manager.getDocSync('core')).toBe(doc)
        expect(manager.getLoadedDocs()).toEqual(['core'])
        expect(registry.register).toHaveBeenCalledWith('core')
    })

    it('allows a failed initial load to be retried', async () => {
        state.pending = true
        const manager = createManager()
        const load = manager.getDoc('core')
        const failure = expect(load).rejects.toThrow('Read failed')
        state.instances[0].emit('error', new Error('Read failed'))
        await failure
        expect(manager.isLoaded('core')).toBe(false)
        state.pending = false
        await manager.getDoc('core')
        expect(manager.isLoaded('core')).toBe(true)
    })

    it('does not treat the startup timeout as proof that data can be durably mutated', async () => {
        vi.useFakeTimers()
        state.pending = true
        const manager = createManager()
        const load = manager.getDoc('core')
        await vi.advanceTimersByTimeAsync(10000)
        await load
        await expect(manager.flushPersistence()).rejects.toThrow('Local data is not fully loaded')
        state.instances[0].finish()
    })

    it('surfaces ongoing storage failures and supports unsubscribing', async () => {
        const manager = createManager()
        registry.register.mockRejectedValueOnce(new Error('Registry unavailable'))
        await manager.getDoc('core')
        const handler = vi.fn()
        const unsubscribe = manager.onPersistenceError(handler)
        const error = new DOMException('Full', 'QuotaExceededError')
        state.instances[0].emit('error', error)
        expect(handler).toHaveBeenCalledWith(error, 'core')
        unsubscribe()
        state.instances[0].emit('error', error)
        expect(handler).toHaveBeenCalledOnce()
        expect(YjsDocManager.isQuotaError(error)).toBe(true)
        expect(YjsDocManager.isQuotaError(new DOMException('Other', 'UnknownError'))).toBe(false)
        expect(YjsDocManager.isQuotaError(new Error('storage quota exceeded'))).toBe(true)
        expect(YjsDocManager.isQuotaError('QuotaExceededError')).toBe(true)
        expect(YjsDocManager.isQuotaError('other')).toBe(false)
    })

    it('discovers registered and older browser databases without accepting unrelated names', async () => {
        const manager = createManager()
        await manager.getDoc('core')
        registry.list.mockResolvedValue(['entries-2020'])
        vi.stubGlobal('indexedDB', { databases: async () => [
            {}, { name: 'unrelated' }, { name: 'tasktime-yjs-unknown' },
            ...['core', 'tasks-archived', 'entries-active', 'expenses-archived', 'invoices-archived', 'entries-2019'].map(name => ({ name: `tasktime-yjs-${name}` })),
        ] })
        expect((await manager.listPersistedDocs()).sort()).toEqual(['core', 'entries-2019', 'entries-2020', 'entries-active', 'expenses-archived', 'invoices-archived', 'tasks-archived'])
    })

    it.each(['unavailable', 'unsupported', 'failed'])('retains known history when browser enumeration is %s', async mode => {
        const manager = createManager()
        await manager.getDoc('core')
        registry.list.mockRejectedValueOnce(new Error('Registry unavailable'))
        if (mode === 'unsupported') vi.stubGlobal('indexedDB', {})
        if (mode === 'failed') vi.stubGlobal('indexedDB', { databases: async () => { throw new Error('Enumeration failed') } })
        expect(await manager.listPersistedDocs()).toEqual(['core'])
    })

    it('applies peer updates without echoing them and releases handles for peer deletion', async () => {
        const channels = []
        vi.stubGlobal('BroadcastChannel', class {
            constructor(name) { this.name = name; this.postMessage = vi.fn(); this.close = vi.fn(); channels.push(this) }
        })
        const manager = createManager()
        const doc = await manager.getDoc('core')
        const control = channels[0]
        const data = channels[1]
        doc.getMap('tasks').set('local', { id: 'local' })
        expect(data.postMessage).toHaveBeenCalledOnce()
        const peer = new Y.Doc()
        peer.getMap('tasks').set('peer', { id: 'peer' })
        data.onmessage({ data: Y.encodeStateAsUpdate(peer) })
        data.onmessage({ data: Y.encodeStateAsUpdate(peer).buffer })
        data.onmessage({ data: null })
        doc.transact(() => doc.getMap('tasks').set('internal', {}), manager.docs.get('core').broadcast)
        expect(doc.getMap('tasks').has('peer')).toBe(true)
        expect(data.postMessage).toHaveBeenCalledOnce()
        control.onmessage({ data: { type: 'unrelated' } })
        expect(manager.isLoaded('core')).toBe(true)
        control.onmessage({ data: { type: 'prepare-database-deletion', requestId: 'request' } })
        expect(manager.getLoadedDocs()).toEqual([])
        expect(data.close).toHaveBeenCalledOnce()
        expect(state.instances[0].destroy).toHaveBeenCalledOnce()
        expect(control.postMessage).toHaveBeenCalledWith({ type: 'database-handles-closed', requestId: 'request' })
        peer.destroy()
    })

    it('can be safely closed or asked to delete databases without browser storage', async () => {
        const manager = createManager()
        await manager.deleteDatabases(['core'])
        manager.destroy()
        manager.destroy()
    })
})
