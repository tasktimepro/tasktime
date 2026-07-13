import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskTimer from '../../components/TaskTimer'
import { ToastContext } from '../../contexts/ToastContext'

// Mutable state for controlling test scenarios
let mockTimers = []

let mockEntries = []

// Hoisted mocks
const timerHookMocks = vi.hoisted(() => ({

    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    stopTimer: vi.fn((timerKey) => {
        const timer = mockTimers.find((candidate) => candidate.projectId === timerKey)
        if (!timer) return null
        const entry = {
            id: 'entry-1',
            taskId: timer.taskId,
            start: timer.startTime,
            end: timer.isPaused ? timer.startTime + timer.elapsedTime : Date.now(),
        }
        mockEntries.push(entry)
        return entry
    }),
    clearTimer: vi.fn()
}))

vi.mock('../../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        timers: mockTimers,
        getTimerForProject: (projectId) => mockTimers.find(timer => timer.projectId === projectId) || null,
        getTimerForTask: (taskId, projectId) => {
            const key = projectId || taskId;
            return mockTimers.find(timer => timer.projectId === key) || null;
        },
        startTimer: timerHookMocks.startTimer,
        pauseTimer: timerHookMocks.pauseTimer,
        resumeTimer: timerHookMocks.resumeTimer,
        stopTimer: timerHookMocks.stopTimer,
        clearTimer: timerHookMocks.clearTimer
    })
}))

vi.mock('../../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Test Task' }],
        activeTasks: [{ id: 'task-1', projectId: 'project-1', title: 'Test Task' }],
        updateTask: vi.fn()
    })
}))

describe('Timer workflow integration', () => {

    const task = { id: 'task-1', projectId: 'project-1', title: 'Test Task' }
    const toastContextValue = {
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    }

    let user

    beforeEach(() => {

        vi.clearAllMocks()
        mockEntries = []
        mockTimers = []
        user = userEvent.setup()
    })

    afterEach(() => {

        cleanup()
        vi.restoreAllMocks()
    })

    it('start then stop creates a time entry', async () => {

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} />
            </ToastContext.Provider>
        )

        // Click start
        await user.click(screen.getByTitle('Start Timer'))
        expect(timerHookMocks.startTimer).toHaveBeenCalledWith('task-1')

        // Now set timer as active
        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 1000,
            isPaused: false,
            note: ''
        }]

        // Re-render with active timer state
        cleanup()
        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} />
            </ToastContext.Provider>
        )

        // Click stop
        await user.click(screen.getByTitle('Save & Stop Timer'))
        expect(timerHookMocks.stopTimer).toHaveBeenCalledWith('project-1')
        expect(mockEntries).toHaveLength(1)
    })

    it('pause then stop uses paused elapsed time', async () => {

        // Set timer as paused
        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 5000,
            isPaused: true,
            note: ''
        }]

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} isGlobalTimer={true} />
            </ToastContext.Provider>
        )

        // Click stop (when paused, should use elapsedTime)
        await user.click(screen.getByTitle('Save & Stop Timer'))

        expect(timerHookMocks.stopTimer).toHaveBeenCalledWith('project-1')
        const entryData = mockEntries[0]
        // Entry end time should equal start + elapsedTime
        expect(entryData.end - entryData.start).toBe(5000)
    })

    it('pause then resume continues from paused time', async () => {

        // Set timer as paused
        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 5000,
            isPaused: true,
            note: ''
        }]

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} isGlobalTimer={true} />
            </ToastContext.Provider>
        )

        // Click resume (play button when paused)
        await user.click(screen.getByTitle('Resume Timer'))
        expect(timerHookMocks.resumeTimer).toHaveBeenCalled()
    })
})
