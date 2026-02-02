// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useYjsCollection } from './useYjsCollection'
import { useYjs } from '@/contexts/YjsContext'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('@/utils/idUtils', () => ({ generateId: vi.fn(() => 'generated-id') }))

const mockUseYjs = useYjs

function createMockYMap(initial = {}) {
    const map = new Map(Object.entries(initial))
    const observers = new Set()

    return {
        get: (key) => map.get(key),
        set: (key, value) => {
            map.set(key, value)
            observers.forEach((fn) => fn())
        },
        delete: (key) => {
            const deleted = map.delete(key)
            observers.forEach((fn) => fn())
            return deleted
        },
        forEach: (cb) => map.forEach((value, key) => cb(value, key)),
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    }
}

describe('useYjsCollection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('performs CRUD operations and syncs updates', async () => {
        const mockMap = createMockYMap()
        mockUseYjs.mockReturnValue({ store: { test: mockMap }, isReady: true })

        const { result } = renderHook(() => useYjsCollection((store) => store.test))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => {
            result.current.create({ id: '1', name: 'First' })
        })

        expect(result.current.items).toHaveLength(1)
        expect(result.current.get('1')?.name).toBe('First')

        act(() => {
            result.current.update('1', { name: 'Updated' })
        })

        expect(result.current.get('1')?.name).toBe('Updated')

        act(() => {
            result.current.remove('1')
        })

        expect(result.current.items).toHaveLength(0)
    })

    it('subscribes to map changes', async () => {
        const mockMap = createMockYMap({ a: { id: 'a', name: 'Alpha' } })
        mockUseYjs.mockReturnValue({ store: { test: mockMap }, isReady: true })

        const { result } = renderHook(() => useYjsCollection((store) => store.test))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => {
            mockMap.set('b', { id: 'b', name: 'Beta' })
        })

        expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b'])
    })

    it('handles missing readiness and prevents operations', () => {

        const mockMap = createMockYMap()
        mockUseYjs.mockReturnValue({ store: { test: mockMap }, isReady: false })

        const { result } = renderHook(() => useYjsCollection((store) => store.test))

        expect(result.current.items).toEqual([])
        expect(result.current.isLoading).toBe(true)
        expect(result.current.get('missing')).toBeUndefined()
        expect(result.current.update('missing', { name: 'Nope' })).toBeUndefined()
        expect(result.current.remove('missing')).toBe(false)
        expect(() => result.current.create({ name: 'Nope' })).toThrow('Collection not ready')
    })

    it('handles map access errors gracefully', () => {

        mockUseYjs.mockReturnValue({ store: {}, isReady: true })

        const { result } = renderHook(() => useYjsCollection(() => {
            throw new Error('boom')
        }))

        expect(result.current.items).toEqual([])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.get('missing')).toBeUndefined()
        expect(result.current.update('missing', { name: 'Nope' })).toBeUndefined()
        expect(result.current.remove('missing')).toBe(false)
        expect(() => result.current.create({ name: 'Nope' })).toThrow('Collection not ready')
    })

    it('uses generated IDs and preserves timestamps', async () => {

        const mockMap = createMockYMap()
        mockUseYjs.mockReturnValue({ store: { test: mockMap }, isReady: true })

        const { result } = renderHook(() => useYjsCollection((store) => store.test))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let created
        act(() => {
            created = result.current.create({ name: 'Auto', createdAt: 123, updatedAt: 456 })
        })

        expect(created.id).toBe('generated-id')
        expect(created.createdAt).toBe(123)
        expect(created.updatedAt).toBe(456)
    })
})
