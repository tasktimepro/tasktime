// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useProjects } from './useProjects'
import { useYjsCollection } from './useYjsCollection'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjsCollection = useYjsCollection

describe('useProjects', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('splits active and archived projects', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'p1', archived: false },
                { id: 'p2', archived: true },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useProjects())

        expect(result.current.activeProjects.map((p) => p.id)).toEqual(['p1'])
        expect(result.current.archivedProjects.map((p) => p.id)).toEqual(['p2'])
    })

    it('archives and unarchives projects', () => {
        const update = vi.fn()
        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useProjects())

        act(() => {
            result.current.archiveProject('p1')
            result.current.unarchiveProject('p2')
        })

        expect(update).toHaveBeenCalledWith('p1', expect.objectContaining({ archived: true }))
        expect(update).toHaveBeenCalledWith('p2', { archived: false, archivedOnDate: null })
    })

    it('filters projects by client', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'p1', preferredClientId: 'c1' },
                { id: 'p2', preferredClientId: 'c2' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useProjects())

        expect(result.current.getProjectsByClient('c1').map((p) => p.id)).toEqual(['p1'])
    })
})
