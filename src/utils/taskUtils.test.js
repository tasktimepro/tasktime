import { describe, it, expect } from 'vitest'
import { getTaskIdsToDelete, getTaskDeletionBillingSummary, hasSubtasks, getSubtasks } from './taskUtils'

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

    describe('getTaskDeletionBillingSummary', () => {

        it('detects billable unbilled time after the billing cutoff', () => {

            const summary = getTaskDeletionBillingSummary(
                ['task-1'],
                [{ id: 'task-1', billable: true, lastBilledAt: 1000 }],
                [
                    { taskId: 'task-1', start: 900, end: 1200, billedInvoiceId: 'inv-1' },
                    { taskId: 'task-1', start: 2000, end: 5600 },
                    { taskId: 'task-1', start: 2500, end: 3500, source: 'invoice-adjustment' }
                ]
            )

            expect(summary).toEqual({
                hasUnbilledTime: true,
                unbilledEntryCount: 1,
                unbilledTimeMs: 3600,
                hasBilledTime: true,
                billedEntryCount: 1
            })
        })

        it('includes billable subtasks when deleting a parent task', () => {

            const summary = getTaskDeletionBillingSummary(
                ['task-1', 'task-2'],
                [
                    { id: 'task-1', billable: false, lastBilledAt: null },
                    { id: 'task-2', parentTaskId: 'task-1', billable: true, lastBilledAt: null }
                ],
                [
                    { taskId: 'task-2', start: 1000, end: 4600 }
                ]
            )

            expect(summary.hasUnbilledTime).toBe(true)
            expect(summary.unbilledTimeMs).toBe(3600)
        })

        it('does not treat non-billable time as unbilled invoice time', () => {

            const summary = getTaskDeletionBillingSummary(
                ['task-1'],
                [{ id: 'task-1', billable: false, lastBilledAt: null }],
                [
                    { taskId: 'task-1', start: 1000, end: 4600 }
                ]
            )

            expect(summary.hasUnbilledTime).toBe(false)
            expect(summary.unbilledTimeMs).toBe(0)
            expect(summary.hasBilledTime).toBe(false)
        })

        it('treats entries before lastBilledAt as billed history even without explicit invoice markers', () => {

            const summary = getTaskDeletionBillingSummary(
                ['task-1'],
                [{ id: 'task-1', billable: true, lastBilledAt: 5000 }],
                [
                    { taskId: 'task-1', start: 1000, end: 2000 },
                    { taskId: 'task-1', start: 6000, end: 7000 }
                ]
            )

            expect(summary.hasBilledTime).toBe(true)
            expect(summary.billedEntryCount).toBe(1)
            expect(summary.hasUnbilledTime).toBe(true)
            expect(summary.unbilledEntryCount).toBe(1)
        })
    })
})
