import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import useTaskState from './useTaskState'
import { BILLABLE_TIME_THRESHOLD_MS } from '../../../constants/app'

// Mock the hooks
const mockUpdateTask = vi.fn()
vi.mock('../../../hooks/useTasks', () => ({
    useTasks: () => ({
        updateTask: mockUpdateTask
    })
}))

vi.mock('../../../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForProject: () => null,
        getTimerForTask: () => null
    })
}))

describe('useTaskState', () => {

    const baseTask = {
        id: 'task-1',
        projectId: 'project-1',
        billable: false,
        billableSetByUser: false,
        createdAt: 0
    }

    const baseParams = {
        task: baseTask,
        timeEntries: [],
        subtasks: []
    }

    beforeEach(() => {

        vi.spyOn(Date, 'now').mockReturnValue(123)
        mockUpdateTask.mockClear()
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('auto-marks billable after threshold when not user-set', async () => {

        const timeEntries = [{ taskId: 'task-1', start: 1, end: BILLABLE_TIME_THRESHOLD_MS + 1 }]

        renderHook(() => useTaskState({
            ...baseParams,
            timeEntries
        }))

        await waitFor(() => {
            expect(mockUpdateTask).toHaveBeenCalledTimes(1)
            expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { billable: true, lastActive: 123 })
        })
    })

    it('does not auto-mark when user explicitly set billing', async () => {

        const timeEntries = [{ taskId: 'task-1', start: 0, end: BILLABLE_TIME_THRESHOLD_MS }]

        renderHook(() => useTaskState({
            ...baseParams,
            task: { ...baseTask, billableSetByUser: true },
            timeEntries
        }))

        await waitFor(() => {
            expect(mockUpdateTask).not.toHaveBeenCalled()
        })
    })
})
