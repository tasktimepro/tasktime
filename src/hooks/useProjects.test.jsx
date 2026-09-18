// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useProjects } from './useProjects'
import { deleteWorkspaceRecords } from '@/stores/yjs/workspaceDeletion'
import { useYjsCollection } from './useYjsCollection'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap } from '@/test/yjs-test-helpers'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/stores/yjs/workspaceDeletion', () => ({ deleteWorkspaceRecords: vi.fn() }))
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

describe('useProjects', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('splits active and archived projects', () => {
        setupMocks({
            items: [
                { id: 'p1', archived: false },
                { id: 'p2', archived: true },
            ],
        })

        const { result } = renderHook(() => useProjects())

        expect(result.current.activeProjects.map((p) => p.id)).toEqual(['p1'])
        expect(result.current.archivedProjects.map((p) => p.id)).toEqual(['p2'])
    })

    it('archives and unarchives projects', () => {
        const update = vi.fn()
        mockUseYjs.mockReturnValue({ store: { plannerAttachments: createTestYMap() }, isReady: true })
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
        setupMocks({
            items: [
                { id: 'p1', preferredClientId: 'c1' },
                { id: 'p2', preferredClientId: 'c2' },
            ],
        })

        const { result } = renderHook(() => useProjects())

        expect(result.current.getProjectsByClient('c1').map((p) => p.id)).toEqual(['p1'])
    })

    it('validates relationship-bearing project creates and updates', () => {
        const existing = { id: 'p1', title: 'Existing', preferredClientId: 'c1' }
        const get = vi.fn((id) => id === 'p1' ? existing : undefined)
        const create = vi.fn((project) => project)
        const update = vi.fn((id, updates) => ({ ...existing, ...updates, id }))
        mockUseYjs.mockReturnValue({
            store: {
                plannerAttachments: createTestYMap(),
                clients: createTestYMap({ c1: { id: 'c1', title: 'Client' } }),
            },
            isReady: true,
        })
        mockUseYjsCollection.mockReturnValue({
            items: [existing], isLoading: false, get, create, update, remove: vi.fn(),
        })

        const { result } = renderHook(() => useProjects())
        let created
        act(() => {
            created = result.current.createProject({ title: ' New ', preferredClientId: 'c1' })
        })
        expect(created).toEqual(expect.objectContaining({ title: 'New', preferredClientId: 'c1' }))

        act(() => {
            result.current.updateProject('p1', { preferredClientId: null })
        })
        expect(update).toHaveBeenCalledWith('p1', { preferredClientId: null })
        expect(result.current.updateProject('missing', { title: 'Nope' })).toBeUndefined()
        expect(() => result.current.createProject({ title: 'Invalid', preferredClientId: 'missing' })).toThrow('Client not found')
        expect(() => result.current.updateProject('p1', { id: 'replacement' })).toThrow(/identity/i)
    })

    it('forwards an explicit transaction origin through project updates', () => {
        const existing = { id: 'p1', title: 'Existing' }
        const update = vi.fn((id, updates) => ({ ...existing, ...updates, id }))
        mockUseYjs.mockReturnValue({
            store: {
                plannerAttachments: createTestYMap(),
                clients: createTestYMap(),
            },
            isReady: true,
        })
        mockUseYjsCollection.mockReturnValue({
            items: [existing],
            isLoading: false,
            get: vi.fn(() => existing),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })
        const origin = Symbol('project-notes-save')
        const { result } = renderHook(() => useProjects())

        act(() => {
            result.current.updateProject('p1', { notes: null }, { origin })
        })

        expect(update).toHaveBeenCalledWith('p1', { notes: null }, { origin })
    })

    it('awaits the shared deletion and passes the explicit invoice choice', async () => {
        setupMocks()
        deleteWorkspaceRecords.mockResolvedValueOnce({})
        const { result } = renderHook(() => useProjects())
        await expect(result.current.deleteProject('id', { includeInvoiceDeletion: true })).resolves.toBe(true)
        expect(deleteWorkspaceRecords).toHaveBeenCalledWith(mockUseYjs().store, { kind: 'project', id: 'id', includeInvoiceDeletion: true })
    })

    it('propagates a failed deletion without reporting success', async () => {
        setupMocks()
        deleteWorkspaceRecords.mockRejectedValueOnce(new Error('Unable to persist'))
        const { result } = renderHook(() => useProjects())
        await expect(result.current.deleteProject('id')).rejects.toThrow('Unable to persist')
    })
})
