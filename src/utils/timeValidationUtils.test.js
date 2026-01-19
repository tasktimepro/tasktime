import { describe, it, expect } from 'vitest'
import { checkTimeOverlap, getLatestEndTimeForProject, checkTimerStartOverlap, getEarliestStartTimeForProject } from './timeValidationUtils'

describe('timeValidationUtils', () => {

    const mockTasks = [
        { id: 'task-1', projectId: 'project-1', title: 'Task One' },
        { id: 'task-2', projectId: 'project-1', title: 'Task Two' },
        { id: 'task-3', projectId: 'project-2', title: 'Task Three' }
    ]

    describe('checkTimeOverlap', () => {

        it('returns valid when no overlaps exist', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 2000 }
            ]

            const result = checkTimeOverlap(3000, 4000, 'project-1', entries, mockTasks)
            expect(result.isValid).toBe(true)
            expect(result.error).toBeNull()
        })

        it('detects overlapping entries', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3000 }
            ]

            const result = checkTimeOverlap(2000, 4000, 'project-1', entries, mockTasks)
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('overlaps')
        })

        it('allows adjacent entries (no gap, no overlap)', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 2000 }
            ]

            const result = checkTimeOverlap(2000, 3000, 'project-1', entries, mockTasks)
            expect(result.isValid).toBe(true)
        })

        it('excludes specified entry from overlap check', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3000 }
            ]

            const result = checkTimeOverlap(1000, 3000, 'project-1', entries, mockTasks, 'entry-1')
            expect(result.isValid).toBe(true)
        })

        it('ignores entries from different projects', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-3', start: 1000, end: 3000 }
            ]

            const result = checkTimeOverlap(1500, 2500, 'project-1', entries, mockTasks)
            expect(result.isValid).toBe(true)
        })
    })

    describe('checkTimerStartOverlap', () => {

        it('checks overlap using timer start and current time', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 3000 }
            ]

            const result = checkTimerStartOverlap(2000, 4000, 'project-1', entries, mockTasks)
            expect(result.isValid).toBe(false)
        })
    })

    describe('getLatestEndTimeForProject', () => {

        it('returns latest end time', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 2000 },
                { id: 'entry-2', taskId: 'task-2', start: 3000, end: 5000 }
            ]

            const result = getLatestEndTimeForProject('project-1', entries, mockTasks)
            expect(result).toBe(5000)
        })

        it('returns null when no entries exist', () => {

            const result = getLatestEndTimeForProject('project-1', [], mockTasks)
            expect(result).toBeNull()
        })

        it('excludes specified entry', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 1000, end: 2000 },
                { id: 'entry-2', taskId: 'task-2', start: 3000, end: 5000 }
            ]

            const result = getLatestEndTimeForProject('project-1', entries, mockTasks, 'entry-2')
            expect(result).toBe(2000)
        })
    })

    describe('getEarliestStartTimeForProject', () => {

        it('returns earliest start time', () => {

            const entries = [
                { id: 'entry-1', taskId: 'task-1', start: 2000, end: 3000 },
                { id: 'entry-2', taskId: 'task-2', start: 1000, end: 1500 }
            ]

            const result = getEarliestStartTimeForProject('project-1', entries, mockTasks)
            expect(result).toBe(1000)
        })

        it('returns null when no entries exist', () => {

            const result = getEarliestStartTimeForProject('project-1', [], mockTasks)
            expect(result).toBeNull()
        })
    })
})
