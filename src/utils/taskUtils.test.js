import { describe, it, expect } from 'vitest'
import { getTaskIdsToDelete, hasSubtasks, getSubtasks, deleteTaskWithCleanup } from './taskUtils'

describe('taskUtils', () => {

    const mockTasks = [
        { id: 'task-1', parentTaskId: null },
        { id: 'task-2', parentTaskId: 'task-1' },
        { id: 'task-3', parentTaskId: 'task-1' },
        { id: 'task-4', parentTaskId: null },
        { id: 'task-5', parentTaskId: 'task-4' }
    ]

    describe('getTaskIdsToDelete', () => {

        it('returns main task and all subtasks', () => {

            const ids = getTaskIdsToDelete('task-1', mockTasks)
            expect(ids).toContain('task-1')
            expect(ids).toContain('task-2')
            expect(ids).toContain('task-3')
            expect(ids.length).toBe(3)
        })

        it('returns only the task when it has no subtasks', () => {

            const ids = getTaskIdsToDelete('task-2', mockTasks)
            expect(ids).toEqual(['task-2'])
        })

        it('does not include unrelated tasks', () => {

            const ids = getTaskIdsToDelete('task-1', mockTasks)
            expect(ids).not.toContain('task-4')
            expect(ids).not.toContain('task-5')
        })
    })

    describe('hasSubtasks', () => {

        it('returns true when task has subtasks', () => {

            expect(hasSubtasks('task-1', mockTasks)).toBe(true)
        })

        it('returns false when task has no subtasks', () => {

            expect(hasSubtasks('task-2', mockTasks)).toBe(false)
        })
    })

    describe('getSubtasks', () => {

        it('returns all subtasks', () => {

            const subtasks = getSubtasks('task-1', mockTasks)
            expect(subtasks.length).toBe(2)
            expect(subtasks.map(task => task.id)).toContain('task-2')
            expect(subtasks.map(task => task.id)).toContain('task-3')
        })

        it('returns empty array when no subtasks', () => {

            const subtasks = getSubtasks('task-2', mockTasks)
            expect(subtasks).toEqual([])
        })
    })

    describe('deleteTaskWithCleanup', () => {

        it('removes main task, subtasks, and entries', () => {

            const setTasks = vi.fn()
            const setTimeEntries = vi.fn()
            const setCurrentTimer = vi.fn()

            const timeEntries = [
                { taskId: 'task-1' },
                { taskId: 'task-2' },
                { taskId: 'task-4' }
            ]

            const result = deleteTaskWithCleanup(
                'task-1',
                mockTasks,
                timeEntries,
                { taskId: 'task-2' },
                setTasks,
                setTimeEntries,
                setCurrentTimer
            )

            expect(setTasks).toHaveBeenCalled()
            expect(setTimeEntries).toHaveBeenCalled()
            expect(setCurrentTimer).toHaveBeenCalledWith(null)
            expect(result.deletedCount).toBe(3)
            expect(result.isMainTask).toBe(true)
        })

        it('removes only subtask and its entries', () => {

            const setTasks = vi.fn()
            const setTimeEntries = vi.fn()
            const setCurrentTimer = vi.fn()

            const result = deleteTaskWithCleanup(
                'task-2',
                mockTasks,
                [{ taskId: 'task-2' }, { taskId: 'task-1' }],
                null,
                setTasks,
                setTimeEntries,
                setCurrentTimer
            )

            expect(result.deletedCount).toBe(1)
            expect(result.isMainTask).toBe(false)
        })
    })
})
