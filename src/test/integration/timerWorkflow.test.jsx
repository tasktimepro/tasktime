import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskTimer from '../../components/TaskTimer'
import { ToastContext } from '../../contexts/ToastContext'

// Mutable state for controlling test scenarios
let mockTimerState = {
    isActive: false,
    isPaused: false,
    taskId: null,
    startTime: null,
    elapsedTime: 0,
    note: ''
}

let mockEntries = []

// Hoisted mocks
const timerHookMocks = vi.hoisted(() => ({

    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    clearTimer: vi.fn()
}))

const entriesHookMocks = vi.hoisted(() => ({

    createEntry: vi.fn((entry) => {
        mockEntries.push({ ...entry, id: 'entry-1' })
        return { ...entry, id: 'entry-1' }
    })
}))

vi.mock('../../hooks/useTimer.ts', () => ({

    useTimer: () => ({
        ...mockTimerState,
        startTimer: timerHookMocks.startTimer,
        pauseTimer: timerHookMocks.pauseTimer,
        resumeTimer: timerHookMocks.resumeTimer,
        clearTimer: timerHookMocks.clearTimer
    })
}))

vi.mock('../../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: mockEntries,
        createEntry: entriesHookMocks.createEntry
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
        addToast: vi.fn(),
        removeToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    }

    let user

    beforeEach(() => {

        vi.clearAllMocks()
        mockEntries = []
        mockTimerState = {
            isActive: false,
            isPaused: false,
            taskId: null,
            startTime: null,
            elapsedTime: 0,
            note: ''
        }
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
        mockTimerState = {
            isActive: true,
            isPaused: false,
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 1000,
            note: ''
        }

        // Re-render with active timer state
        cleanup()
        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} />
            </ToastContext.Provider>
        )

        // Click stop
        await user.click(screen.getByTitle('Save & Stop Timer'))
        expect(entriesHookMocks.createEntry).toHaveBeenCalled()
        expect(timerHookMocks.clearTimer).toHaveBeenCalled()
    })

    it('pause then stop uses paused elapsed time', async () => {

        // Set timer as paused
        mockTimerState = {
            isActive: true,
            isPaused: true,
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 5000,
            note: ''
        }

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer task={task} isGlobalTimer={true} />
            </ToastContext.Provider>
        )

        // Click stop (when paused, should use elapsedTime)
        await user.click(screen.getByTitle('Save & Stop Timer'))

        expect(entriesHookMocks.createEntry).toHaveBeenCalled()
        const entryData = entriesHookMocks.createEntry.mock.calls[0][0]
        // Entry end time should equal start + elapsedTime
        expect(entryData.end - entryData.start).toBe(5000)
    })

    it('pause then resume continues from paused time', async () => {

        // Set timer as paused
        mockTimerState = {
            isActive: true,
            isPaused: true,
            taskId: 'task-1',
            startTime: 0,
            elapsedTime: 5000,
            note: ''
        }

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
