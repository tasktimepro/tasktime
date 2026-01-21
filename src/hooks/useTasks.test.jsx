// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useTasks } from './useTasks'
import { useYjs } from '@/contexts/YjsContext'
import { useYjsCollection } from './useYjsCollection'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjs = useYjs
const mockUseYjsCollection = useYjsCollection

function createObservableMap(initial = {}) {
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

describe('useTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads archived tasks, filters by project, and exposes helpers', async () => {
        const archivedMap = createObservableMap({
            t3: { id: 't3', projectId: 'p1', archived: true, parentTaskId: null },
            t4: { id: 't4', projectId: 'p2', archived: true, parentTaskId: null },
        })

        const loadArchivedTasks = vi.fn(async () => {})
        const archiveTask = vi.fn(async () => {})
        const unarchiveTask = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: archivedMap, archiveTask, unarchiveTask },
            isReady: true,
            loadArchivedTasks,
        })

        const activeTasks = [
            { id: 't1', projectId: 'p1', archived: false, parentTaskId: null },
            { id: 't2', projectId: 'p1', archived: false, parentTaskId: 't1' },
        ]
        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks({ includeArchived: false, projectId: 'p1' }))

        await act(async () => {})
        expect(result.current.tasks.map((t) => t.id)).toEqual(['t1', 't2'])
        expect(result.current.archivedTasks.map((t) => t.id)).toEqual([])
        expect(result.current.getRootTasks('p1').map((t) => t.id)).toEqual(['t1'])
        expect(result.current.getChildTasks('t1').map((t) => t.id)).toEqual(['t2'])

        await act(async () => {
            await result.current.archiveTask('t1')
            await result.current.unarchiveTask('t3')
        })

        expect(archiveTask).toHaveBeenCalledWith('t1')
        expect(unarchiveTask).toHaveBeenCalledWith('t3')
    })

    it('triggers archived load when includeArchived is true', async () => {
        const loadArchivedTasks = vi.fn(async () => {})
        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createObservableMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        renderHook(() => useTasks({ includeArchived: true }))

        await waitFor(() => expect(loadArchivedTasks).toHaveBeenCalled())
    })
})
