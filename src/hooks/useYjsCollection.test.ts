// @ts-nocheck

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useYjsCollection } from './useYjsCollection'
import { useYjs } from '@/contexts/YjsContext'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs as unknown as ReturnType<typeof vi.fn>

function createMockYMap<T>(initial: Record<string, T> = {}) {
    const map = new Map<string, T>(Object.entries(initial))
    const observers = new Set<() => void>()

    return {
        get: (key: string) => map.get(key),
        set: (key: string, value: T) => {
            map.set(key, value)
            observers.forEach((fn) => fn())
        },
        delete: (key: string) => {
            const deleted = map.delete(key)
            observers.forEach((fn) => fn())
            return deleted
        },
        forEach: (cb: (value: T, key: string) => void) => map.forEach((value, key) => cb(value, key)),
        observe: (fn: () => void) => observers.add(fn),
        unobserve: (fn: () => void) => observers.delete(fn),
    }
}

describe('useYjsCollection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('performs CRUD operations and syncs updates', async () => {
        const mockMap = createMockYMap<{ id: string; name: string }>()
        mockUseYjs.mockReturnValue({ store: { test: mockMap } as unknown as any, isReady: true })

        const { result } = renderHook(() => useYjsCollection((store) => (store as any).test))

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
        const mockMap = createMockYMap<{ id: string; name: string }>({ a: { id: 'a', name: 'Alpha' } })
        mockUseYjs.mockReturnValue({ store: { test: mockMap } as unknown as any, isReady: true })

        const { result } = renderHook(() => useYjsCollection((store) => (store as any).test))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => {
            mockMap.set('b', { id: 'b', name: 'Beta' })
        })

        expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b'])
    })
})
