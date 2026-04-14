// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useClients } from './useClients'
import { useYjsCollection } from './useYjsCollection'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap } from '@/test/yjs-test-helpers'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjsCollection = useYjsCollection
const mockUseYjs = useYjs

function setupMocks({ items = [], remove = vi.fn(() => true), plannerAttachments = createTestYMap() } = {}) {
    mockUseYjs.mockReturnValue({
        store: { plannerAttachments },
        isReady: true,
    })
    mockUseYjsCollection.mockReturnValue({
        items,
        isLoading: false,
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove,
    })
    return { remove, plannerAttachments }
}

describe('useClients', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sorts clients by title', () => {
        setupMocks({
            items: [
                { id: 'c2', title: 'Banana' },
                { id: 'c1', title: 'Apple' },
            ],
        })

        const { result } = renderHook(() => useClients())

        expect(result.current.sortedClients.map((c) => c.id)).toEqual(['c1', 'c2'])
    })

    it('finds client by name case-insensitively', () => {
        setupMocks({
            items: [
                { id: 'c1', title: 'Acme Corp' },
            ],
        })

        const { result } = renderHook(() => useClients())

        expect(result.current.findByName('acme corp')?.id).toBe('c1')
        expect(result.current.findByName('ACME CORP')?.id).toBe('c1')
        expect(result.current.findByName('nope')).toBeUndefined()
    })

    it('cleans up planner attachments when deleting a client', () => {
        const plannerAttachments = createTestYMap({
            'att-1': { id: 'att-1', type: 'client', referenceId: 'c1' },
            'att-2': { id: 'att-2', type: 'project', referenceId: 'p1' },
            'att-3': { id: 'att-3', type: 'client', referenceId: 'c2' },
        })
        const remove = vi.fn(() => true)

        setupMocks({ remove, plannerAttachments })

        const { result } = renderHook(() => useClients())

        act(() => {
            result.current.deleteClient('c1')
        })

        expect(remove).toHaveBeenCalledWith('c1')
        expect(plannerAttachments.has('att-1')).toBe(false)
        expect(plannerAttachments.has('att-2')).toBe(true)
        expect(plannerAttachments.has('att-3')).toBe(true)
    })

    it('does not clean up attachments when client removal fails', () => {
        const plannerAttachments = createTestYMap({
            'att-1': { id: 'att-1', type: 'client', referenceId: 'c1' },
        })
        const remove = vi.fn(() => false)

        setupMocks({ remove, plannerAttachments })

        const { result } = renderHook(() => useClients())

        act(() => {
            result.current.deleteClient('c1')
        })

        expect(plannerAttachments.has('att-1')).toBe(true)
    })
})
