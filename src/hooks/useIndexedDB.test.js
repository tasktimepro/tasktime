import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIndexedDB, useIndexedDBLoading, clearAllData, getAllKeys } from './useIndexedDB'

const mockDb = {
    get: vi.fn(),
    put: vi.fn(),
    getAllKeys: vi.fn(),
    transaction: vi.fn()
}

const openDBMock = vi.fn()

vi.mock('idb', () => ({
    openDB: (...args) => openDBMock(...args)
}))

let lastChannelInstance = null

class BroadcastChannelMock {
    constructor() {
        this.handlers = new Set()
        lastChannelInstance = this
    }
    addEventListener(_event, handler) {
        this.handlers.add(handler)
    }
    removeEventListener(_event, handler) {
        this.handlers.delete(handler)
    }
    postMessage(data) {
        this.handlers.forEach(handler => handler({ data }))
    }
}

describe('useIndexedDB', () => {

    beforeEach(() => {

        mockDb.get.mockReset()
        mockDb.put.mockReset()
        mockDb.getAllKeys.mockReset()
        mockDb.transaction.mockReset()
        openDBMock.mockReset()
        global.BroadcastChannel = BroadcastChannelMock
        mockDb.transaction.mockReturnValue({
            store: { clear: vi.fn() },
            done: Promise.resolve()
        })
        openDBMock.mockImplementation(async (_name, _version, options) => {
            if (options?.upgrade) {
                options.upgrade({
                    objectStoreNames: {
                        contains: () => false
                    },
                    createObjectStore: vi.fn()
                })
            }
            return mockDb
        })
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('loads stored value from IndexedDB', async () => {

        mockDb.get.mockResolvedValue('stored')

        const { result } = renderHook(() => useIndexedDB('key', 'default'))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        expect(result.current[0]).toBe('stored')
    })

    it('saves updates and broadcasts changes', async () => {

        mockDb.get.mockResolvedValue(undefined)

        const { result } = renderHook(() => useIndexedDB('key', 'default'))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        act(() => {
            result.current[1]('next')
        })

        await waitFor(() => {
            expect(mockDb.put).toHaveBeenCalledWith('app-data', 'next', 'key')
        })
    })

    it('accepts functional updates', async () => {

        mockDb.get.mockResolvedValue(1)

        const { result } = renderHook(() => useIndexedDB('key', 0))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        act(() => {
            result.current[1](prev => prev + 1)
        })

        await waitFor(() => {
            expect(result.current[0]).toBe(2)
        })
    })

    it('responds to external broadcast updates without echo', async () => {

        mockDb.get.mockResolvedValue(undefined)

        const { result } = renderHook(() => useIndexedDB('key', 'default'))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        expect(lastChannelInstance).not.toBeNull()

        act(() => {
            lastChannelInstance.postMessage({ key: 'key', value: 'external' })
        })

        await waitFor(() => {
            expect(result.current[0]).toBe('external')
        })
    })

    it('syncs timer state across tabs', async () => {

        const { result } = renderHook(() => useIndexedDB('timer', { taskId: null }))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        act(() => {
            lastChannelInstance.postMessage({
                key: 'timer',
                value: { taskId: 'task-1', startTime: 1000 }
            })
        })

        await waitFor(() => {
            expect(result.current[0]).toMatchObject({ taskId: 'task-1', startTime: 1000 })
        })
    })

    it('captures errors when writes fail', async () => {

        const error = new Error('Write failed')
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        mockDb.get.mockResolvedValue('stored')
        mockDb.put.mockRejectedValueOnce(error)

        const { result } = renderHook(() => useIndexedDB('key', 'default'))

        await waitFor(() => {
            expect(result.current[2].loading).toBe(false)
        })

        act(() => {
            result.current[1]('next')
        })

        await waitFor(() => {
            expect(result.current[2].error).toBe(error)
        })

        errorSpy.mockRestore()
    })
})

describe('indexedDB utilities', () => {

    beforeEach(() => {

        mockDb.transaction.mockReturnValue({
            store: { clear: vi.fn() },
            done: Promise.resolve()
        })
        openDBMock.mockResolvedValue(mockDb)
    })

    it('aggregates loading states', () => {

        expect(useIndexedDBLoading([{ loading: true }, { loading: false }])).toBe(true)
        expect(useIndexedDBLoading([{ loading: false }])).toBe(false)
    })

    it('clears all data', async () => {

        await clearAllData()
        expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('gets all keys', async () => {

        mockDb.getAllKeys.mockResolvedValue(['a', 'b'])
        const keys = await getAllKeys()
        expect(keys).toEqual(['a', 'b'])
    })
})
