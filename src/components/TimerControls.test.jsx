import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimerControls from './TimerControls'
import { ToastContext } from '../contexts/ToastContext'

// Mutable state for controlling test scenarios
let mockTimerState = {
    isActive: false,
    isPaused: false,
    taskId: null,
    startTime: null,
    elapsedTime: 0,
    note: ''
}

// Hoisted mocks for timer hook functions
const timerHookMocks = vi.hoisted(() => ({

    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    clearTimer: vi.fn()
}))

// Hoisted mocks for time entries hook
const entriesHookMocks = vi.hoisted(() => ({

    createEntry: vi.fn(() => ({ id: 'entry-1' }))
}))

// Hoisted mocks for tasks hook
const tasksHookMocks = vi.hoisted(() => ({

    updateTask: vi.fn()
}))

vi.mock('../hooks/useTimer.ts', () => ({

    useTimer: () => ({
        ...mockTimerState,
        startTimer: timerHookMocks.startTimer,
        pauseTimer: timerHookMocks.pauseTimer,
        resumeTimer: timerHookMocks.resumeTimer,
        clearTimer: timerHookMocks.clearTimer
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: [],
        createEntry: entriesHookMocks.createEntry
    })
}))

vi.mock('../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        activeTasks: [],
        updateTask: tasksHookMocks.updateTask
    })
}))

describe('TimerControls', () => {

    const baseTask = { id: 'task-1', projectId: 'project-1' }
    const toastContextValue = {
        addToast: vi.fn(),
        removeToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    }

    const renderWithToast = (ui) => {
        return render(
            <ToastContext.Provider value={toastContextValue}>
                {ui}
            </ToastContext.Provider>
        )
    }

    beforeEach(() => {

        vi.clearAllMocks()
        // Reset timer state
        mockTimerState = {
            isActive: false,
            isPaused: false,
            taskId: null,
            startTime: null,
            elapsedTime: 0,
            note: ''
        }
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('shows play button when timer is stopped', () => {

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        expect(screen.getByTitle('Start Timer')).toBeInTheDocument()
    })

    it('starts timer on play click', async () => {

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        await userEvent.click(screen.getByTitle('Start Timer'))

        expect(timerHookMocks.startTimer).toHaveBeenCalledWith('task-1')
    })

    it('shows pause and stop buttons when running', () => {

        // Set timer as active for this task
        mockTimerState = {
            isActive: true,
            isPaused: false,
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 10000,
            note: ''
        }

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        expect(screen.getByTitle('Pause Timer')).toBeInTheDocument()
        expect(screen.getByTitle('Save & Stop Timer')).toBeInTheDocument()
    })

    it('stops timer and creates entry', async () => {

        // Set timer as active for this task
        mockTimerState = {
            isActive: true,
            isPaused: false,
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 10000,
            note: ''
        }

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        await userEvent.click(screen.getByTitle('Save & Stop Timer'))

        expect(entriesHookMocks.createEntry).toHaveBeenCalled()
        expect(timerHookMocks.clearTimer).toHaveBeenCalled()
    })

    it('stops a paused timer using paused elapsed time', async () => {

        // Set timer as paused with elapsed time
        mockTimerState = {
            isActive: true,
            isPaused: true,
            taskId: 'task-1',
            startTime: 1000,
            elapsedTime: 5000,
            note: ''
        }

        renderWithToast(
            <TimerControls
                task={baseTask}
                isGlobalTimer={true}
            />
        )

        await userEvent.click(screen.getByTitle('Save & Stop Timer'))

        // Verify entry was created with correct elapsed time
        expect(entriesHookMocks.createEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                taskId: 'task-1'
            })
        )
        expect(timerHookMocks.clearTimer).toHaveBeenCalled()
    })

    it('stops existing timer when starting a new one', async () => {

        // Set timer as active for a different task
        mockTimerState = {
            isActive: true,
            isPaused: false,
            taskId: 'task-other',
            startTime: 1000,
            elapsedTime: 4000,
            note: ''
        }

        renderWithToast(
            <TimerControls task={{ id: 'task-2', projectId: 'project-1' }} />
        )

        await userEvent.click(screen.getByTitle('Start Timer'))

        // When starting a new timer while another is running, it creates an entry and starts new timer
        expect(timerHookMocks.startTimer).toHaveBeenCalledWith('task-2')
    })
})
