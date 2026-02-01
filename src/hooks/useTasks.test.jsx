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

    afterEach(() => {
        vi.useRealTimers()
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

    it('filters standalone, overdue, today, and upcoming tasks', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-06T09:00:00Z'))

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createObservableMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        const activeTasks = [
            { id: 'overdue', projectId: 'p1', archived: false, completed: false, recurring: null, startDate: '2025-01-04' },
            { id: 'today', projectId: 'p1', archived: false, completed: false, recurring: null, startDate: '2025-01-06' },
            { id: 'upcoming', projectId: 'p1', archived: false, completed: false, recurring: null, startDate: '2025-01-10' },
            { id: 'completed-today', projectId: 'p1', archived: false, completed: true, completedOnDate: '2025-01-06', recurring: null, startDate: '2025-01-04' },
            { id: 'completed-earlier', projectId: 'p1', archived: false, completed: true, completedOnDate: '2025-01-05', recurring: null, startDate: '2025-01-04' },
            { id: 'recurring-weekly', projectId: 'p1', archived: false, completed: false, recurring: { type: 'weekly', weeklyDays: [1] } },
            { id: 'standalone', projectId: null, archived: false, completed: false, recurring: null, startDate: null },
            { id: 'archived', projectId: 'p1', archived: true, completed: false, recurring: null, startDate: '2025-01-03' },
        ]

        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        expect(result.current.getStandaloneTasks().map((t) => t.id)).toEqual(['standalone'])
        expect(result.current.getOverdueTasks().map((t) => t.id).sort()).toEqual(['completed-today', 'overdue'])
        expect(result.current.getTasksForToday().map((t) => t.id).sort()).toEqual(['recurring-weekly', 'today'])
        expect(result.current.getUpcomingTasks(7).map((t) => t.id)).toEqual(['upcoming'])
    })
})
