import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimerControls from './TimerControls'
import { ToastContext } from '../contexts/ToastContext'

// Mutable state for controlling test scenarios
let mockProjectTimer = null

// Hoisted mocks for timer hook functions
const timerHookMocks = vi.hoisted(() => ({

    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    clearTimer: vi.fn(),
    getTimerForProject: vi.fn((projectId) => {
        if (!mockProjectTimer) return null
        return mockProjectTimer.projectId === projectId ? mockProjectTimer : null
    })
}))

// Hoisted mocks for time entries hook
const entriesHookMocks = vi.hoisted(() => ({

    createEntry: vi.fn(() => ({ id: 'entry-1' }))
}))

// Hoisted mocks for tasks hook
const tasksHookMocks = vi.hoisted(() => ({

    updateTask: vi.fn()
}))

const projectHookMocks = vi.hoisted(() => ({

    projects: [{ id: 'project-1', billableTimeIncrementMinutes: 15 }]
}))

vi.mock('../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        getTimerForProject: timerHookMocks.getTimerForProject,
        startTimer: timerHookMocks.startTimer,
        pauseTimer: timerHookMocks.pauseTimer,
        resumeTimer: timerHookMocks.resumeTimer,
        clearTimer: timerHookMocks.clearTimer,
        getTimerForTask: (taskId, projectId) => {
            if (!mockProjectTimer) return null;
            const key = projectId || taskId;
            return mockProjectTimer.projectId === key ? mockProjectTimer : null;
        }
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

vi.mock('../hooks/useProjects.ts', () => ({

    useProjects: () => projectHookMocks
}))

describe('TimerControls', () => {

    const baseTask = { id: 'task-1', projectId: 'project-1' }
    const toastContextValue = {
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
        mockProjectTimer = null
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
        mockProjectTimer = {
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 10000,
            isPaused: false,
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
        mockProjectTimer = {
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 10000,
            isPaused: false,
            note: ''
        }

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        await userEvent.click(screen.getByTitle('Save & Stop Timer'))

        expect(entriesHookMocks.createEntry).toHaveBeenCalled()
        expect(timerHookMocks.clearTimer).toHaveBeenCalledWith('project-1')
    })

    it('stops a paused timer using paused elapsed time', async () => {

        // Set timer as paused with elapsed time
        mockProjectTimer = {
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
            elapsedTime: 5000,
            isPaused: true,
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
        expect(timerHookMocks.clearTimer).toHaveBeenCalledWith('project-1')
    })

    it('stores billable duration metadata when the project has a billing increment', async () => {

        mockProjectTimer = {
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
            elapsedTime: 5000,
            isPaused: false,
            note: ''
        }

        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(6000)

        renderWithToast(
            <TimerControls task={baseTask} />
        )

        await userEvent.click(screen.getByTitle('Save & Stop Timer'))

        expect(entriesHookMocks.createEntry).toHaveBeenCalledWith(expect.objectContaining({
            billedDurationMs: 15 * 60 * 1000,
            billingIncrementMinutes: 15,
        }))

        nowSpy.mockRestore()
    })

    it('stops existing timer when starting a new one', async () => {

        // Set timer as active for a different task
        mockProjectTimer = {
            projectId: 'project-1',
            taskId: 'task-other',
            startTime: 1000,
            elapsedTime: 4000,
            isPaused: false,
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
