// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useTasks } from './useTasks'
import { useYjs } from '@/contexts/YjsContext'
import { useYjsCollection } from './useYjsCollection'
import * as recurringUtils from '@/utils/recurringUtils.ts'
import * as dateUtils from '@/utils/dateUtils.ts'
import { createTestYMap } from '@/test/yjs-test-helpers'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjs = useYjs
const mockUseYjsCollection = useYjsCollection

describe('useTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('loads archived tasks, filters by project, and exposes helpers', async () => {
        const archivedMap = createTestYMap({
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
            store: { archivedTasks: null, archiveTask: vi.fn(), unarchiveTask: vi.fn() },
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

    it('hydrates archived tasks immediately when the archived doc is already loaded', async () => {
        const archivedMap = createTestYMap({
            t9: { id: 't9', projectId: null, archived: true, parentTaskId: null },
        })

        const loadArchivedTasks = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: archivedMap, archiveTask: vi.fn(), unarchiveTask: vi.fn() },
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

        const { result } = renderHook(() => useTasks({ includeArchived: true }))

        await waitFor(() => expect(result.current.archivedLoaded).toBe(true))
        expect(result.current.archivedTasks.map((task) => task.id)).toEqual(['t9'])
        expect(loadArchivedTasks).not.toHaveBeenCalled()
    })

    it('deletes archived tasks from the archived doc and updates archived state', async () => {
        const archivedMap = createTestYMap({
            archivedTask: { id: 'archivedTask', projectId: null, archived: true, parentTaskId: null },
        })

        const remove = vi.fn(() => false)
        const loadArchivedTasks = vi.fn(async () => {})

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: archivedMap, archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks,
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove,
        })

        const { result } = renderHook(() => useTasks({ includeArchived: true }))

        await waitFor(() => expect(result.current.archivedLoaded).toBe(true))

        await act(async () => {
            await result.current.deleteTask('archivedTask')
        })

        expect(remove).toHaveBeenCalledWith('archivedTask')
        expect(loadArchivedTasks).not.toHaveBeenCalled()
        await waitFor(() => expect(result.current.archivedTasks).toEqual([]))
    })

    it('filters standalone, overdue, today, and upcoming tasks', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-06T09:00:00Z'))

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
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

    it('keeps recurring tasks in today list when overdue and hides after completion', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-07T09:00:00Z'))

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        const activeTasks = [
            { id: 'recurring-overdue', projectId: 'p1', archived: false, completed: false, recurring: { type: 'weekly', weeklyDays: [1] } },
            { id: 'recurring-completed', projectId: 'p1', archived: false, completed: false, recurring: { type: 'weekly', weeklyDays: [1] }, completedDatesByYear: { '2025': { '1': [6] } } },
            { id: 'recurring-completed-today', projectId: 'p1', archived: false, completed: false, recurring: { type: 'weekly', weeklyDays: [1] }, completedDatesByYear: { '2025': { '1': [6] } }, lastActive: new Date('2025-01-07T08:00:00Z').getTime() },
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

        expect(result.current.getTasksForToday().map((t) => t.id).sort()).toEqual([
            'recurring-completed-today',
            'recurring-overdue'
        ])
    })

    it('toggles recurring completion and reports recurring status', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-06T09:00:00Z'))

        const update = vi.fn((id, data) => ({ id, ...data }))
        const activeTasks = [
            {
                id: 'recurring-task',
                projectId: 'p1',
                archived: false,
                completed: false,
                recurring: { type: 'weekly', weeklyDays: [1] },
                startDate: '2025-01-01',
                createdAt: new Date('2025-01-01T00:00:00Z').getTime(),
                completedDatesByYear: {},
            },
        ]

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        const statusDue = result.current.getRecurringStatus(activeTasks[0], '2025-01-06')
        expect(statusDue.isDueToday).toBe(true)
        expect(statusDue.isOverdue).toBe(false)

        act(() => {
            result.current.toggleRecurringCompletion('recurring-task', '2025-01-06')
        })

        expect(update).toHaveBeenCalledWith(
            'recurring-task',
            expect.objectContaining({
                completedDatesByYear: expect.any(Object),
                lastActive: expect.any(Number),
            })
        )
    })

    it('marks recurring tasks as overdue when prior due date is missed', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-07T09:00:00Z'))

        const activeTasks = [
            {
                id: 'recurring-overdue',
                projectId: 'p1',
                archived: false,
                completed: false,
                recurring: { type: 'weekly', weeklyDays: [1] },
                startDate: '2025-01-01',
                createdAt: new Date('2025-01-01T00:00:00Z').getTime(),
                completedDatesByYear: {},
            },
        ]

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        const status = result.current.getRecurringStatus(activeTasks[0], '2025-01-07')
        expect(status.isDueToday).toBe(false)
        expect(status.isOverdue).toBe(true)
        expect(status.effectiveDateStr).toBe('2025-01-06')
    })

    it('returns non-recurring status defaults', () => {
        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        const status = result.current.getRecurringStatus({ id: 't1', recurring: null })
        expect(status.isDueToday).toBe(false)
        expect(status.isOverdue).toBe(false)
        expect(status.effectiveDateStr).toBeNull()
    })

    it('does not mark recurring tasks due before start date', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-01T09:00:00Z'))

        const activeTasks = [
            {
                id: 'recurring-future',
                projectId: 'p1',
                archived: false,
                completed: false,
                recurring: { type: 'weekly', weeklyDays: [1] },
                startDate: '2025-02-01',
            },
        ]

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        const status = result.current.getRecurringStatus(activeTasks[0], '2025-01-01')
        expect(status.isDueToday).toBe(false)
        expect(status.isOverdue).toBe(false)
        expect(status.lastDueDateStr).toBeNull()
    })

    it('skips recurring tasks when previous/next due dates are missing', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-06T09:00:00Z'))

        const previousSpy = vi.spyOn(recurringUtils, 'findPreviousRecurringDueDate').mockReturnValue(null)
        const nextSpy = vi.spyOn(recurringUtils, 'findNextRecurringDueDate').mockReturnValue(null)
        const dueSpy = vi.spyOn(recurringUtils, 'isRecurringTaskDueOnDate').mockReturnValue(false)

        const activeTasks = [
            { id: 'recurring-null', projectId: 'p1', archived: false, completed: false, recurring: { type: 'weekly', weeklyDays: [1] } },
        ]

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: activeTasks,
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        expect(result.current.getTasksForToday()).toEqual([])

        previousSpy.mockRestore()
        nextSpy.mockRestore()
        dueSpy.mockRestore()
    })

    it('returns empty lists when today is unavailable', () => {
        const todaySpy = vi.spyOn(dateUtils, 'getTodayString').mockReturnValue(null)

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        expect(result.current.getOverdueTasks()).toEqual([])
        expect(result.current.getTasksForToday()).toEqual([])
        expect(result.current.getUpcomingTasks()).toEqual([])

        todaySpy.mockRestore()
    })

    it('returns undefined when toggling completion for missing task', () => {
        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => undefined),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        expect(result.current.toggleRecurringCompletion('missing', '2025-01-06')).toBeUndefined()
    })

    it('skips recurring task for current occurrence and resets on next recurrence', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-07T09:00:00Z'))

        const task = {
            id: 'recurring-overdue',
            projectId: 'p1',
            archived: false,
            completed: false,
            recurring: { type: 'weekly', weeklyDays: [1] },
            startDate: '2025-01-01',
            createdAt: new Date('2025-01-01T00:00:00Z').getTime(),
            completedDatesByYear: {},
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2025-01-06',
        }

        const activeTasks = [task]
        const update = vi.fn((id, data) => {
            const index = activeTasks.findIndex((t) => t.id === id)
            if (index >= 0) {
                activeTasks[index] = { ...activeTasks[index], ...data }
                return activeTasks[index]
            }
            return undefined
        })

        mockUseYjs.mockReturnValue({
            store: { archivedTasks: createTestYMap(), archiveTask: vi.fn(), unarchiveTask: vi.fn() },
            isReady: true,
            loadArchivedTasks: vi.fn(async () => {}),
        })

        mockUseYjsCollection.mockReturnValue({
            get items() {
                return activeTasks
            },
            isLoading: false,
            get: vi.fn((id) => activeTasks.find((t) => t.id === id)),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useTasks())

        expect(result.current.getTasksForToday()).toEqual([])

        act(() => {
            result.current.skipRecurringOccurrence('recurring-overdue', '2025-01-06')
        })

        expect(update).toHaveBeenCalledWith(
            'recurring-overdue',
            expect.objectContaining({
                skipUntilNextRecurring: true,
                skippedOccurrenceDate: '2025-01-06',
                lastActive: expect.any(Number),
            })
        )

        vi.setSystemTime(new Date('2025-01-13T09:00:00Z'))

        const status = result.current.getRecurringStatus(activeTasks[0], '2025-01-13')
        expect(status.isDueToday).toBe(true)
        expect(status.isOverdue).toBe(false)
        expect(status.effectiveDateStr).toBe('2025-01-13')
        expect(status.isSkipped).toBe(false)

        // Side-effect write removed — skip reset is now handled by resetExpiredSkips()
        // called from Dashboard, not automatically inside getRecurringStatus
        act(() => {
            result.current.resetExpiredSkips()
        })

        expect(update).toHaveBeenCalledWith(
            'recurring-overdue',
            {
                skipUntilNextRecurring: false,
                skippedOccurrenceDate: null,
            }
        )
    })
})
