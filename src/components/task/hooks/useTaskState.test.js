import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import useTaskState from './useTaskState'
import { BILLABLE_TIME_THRESHOLD_MS } from '../../../constants/app'

describe('useTaskState', () => {

    const baseTask = {
        id: 'task-1',
        billable: false,
        billableSetByUser: false,
        createdAt: 0
    }

    const baseParams = {
        task: baseTask,
        tasks: [baseTask],
        timeEntries: [],
        currentTimer: null,
        isPaused: false,
        subtasks: []
    }

    beforeEach(() => {

        vi.spyOn(Date, 'now').mockReturnValue(123)
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('auto-marks billable after threshold when not user-set', async () => {

        const setTasks = vi.fn()
        const timeEntries = [{ taskId: 'task-1', start: 1, end: BILLABLE_TIME_THRESHOLD_MS + 1 }]

        renderHook(() => useTaskState({
            ...baseParams,
            timeEntries,
            setTasks
        }))

        await waitFor(() => {
            expect(setTasks).toHaveBeenCalledTimes(1)
        })

        const updater = setTasks.mock.calls[0][0]
        const updated = updater([baseTask])

        expect(updated[0].billable).toBe(true)
        expect(updated[0].lastActive).toBe(123)
    })

    it('does not auto-mark when user explicitly set billing', async () => {

        const setTasks = vi.fn()
        const timeEntries = [{ taskId: 'task-1', start: 0, end: BILLABLE_TIME_THRESHOLD_MS }]

        renderHook(() => useTaskState({
            ...baseParams,
            task: { ...baseTask, billableSetByUser: true },
            tasks: [{ ...baseTask, billableSetByUser: true }],
            timeEntries,
            setTasks
        }))

        await waitFor(() => {
            expect(setTasks).not.toHaveBeenCalled()
        })
    })
})
