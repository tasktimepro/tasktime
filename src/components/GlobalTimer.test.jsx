import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import GlobalTimer from './GlobalTimer'
import { ToastContext } from '../contexts/ToastContext'

// Mock timer hook state
let mockTimers = []
let mockTasks = []

// Hoisted mocks
const timerHookMocks = vi.hoisted(() => ({

    updateTimer: vi.fn(),
    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    clearTimer: vi.fn()
}))

vi.mock('../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        timers: mockTimers,
        updateTimer: timerHookMocks.updateTimer,
        getTimerForProject: (projectId) => mockTimers.find(timer => timer.projectId === projectId) || null,
        getTimerForTask: (taskId, projectId) => {
            const key = projectId || taskId;
            return mockTimers.find(timer => timer.projectId === key) || null;
        },
        startTimer: timerHookMocks.startTimer,
        pauseTimer: timerHookMocks.pauseTimer,
        resumeTimer: timerHookMocks.resumeTimer,
        clearTimer: timerHookMocks.clearTimer
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: [],
        createEntry: vi.fn(() => ({ id: 'entry-1' }))
    })
}))

vi.mock('../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        tasks: mockTasks,
        activeTasks: mockTasks,
        updateTask: vi.fn()
    })
}))

vi.mock('../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: [{ id: 'project-1', title: 'Project One' }],
        getProject: vi.fn(() => ({ id: 'project-1', title: 'Project One' }))
    })
}))

describe('GlobalTimer', () => {

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
        mockTimers = []
        mockTasks = [{ id: 'task-1', title: 'Task One', projectId: 'project-1' }]
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('shows paused elapsed time when timer is paused', async () => {

        // Set timer as paused with elapsed time
        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 65000,
            isPaused: true,
            note: ''
        }]

        renderWithToast(
            <GlobalTimer
                navigateToProject={vi.fn()}
                onClose={vi.fn()}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('1m 5s')).toBeInTheDocument()
        })
    })

    it('keeps the task title on the normal text color while the timer is active', () => {

        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 10000,
            isPaused: false,
            note: ''
        }]

        renderWithToast(
            <GlobalTimer
                navigateToProject={vi.fn()}
                onClose={vi.fn()}
            />
        )

        const taskTitleButton = screen.getByRole('button', { name: 'Task One' })

        expect(taskTitleButton.className).toContain('text-foreground')
        expect(taskTitleButton.className).not.toContain('status-danger-text-strong')
    })

    it('truncates the title while keeping the pulse dot and timer controls from shrinking', () => {

        mockTasks = [{
            id: 'task-1',
            title: 'A very long task title that should truncate before squeezing timer controls on mobile',
            projectId: 'project-1'
        }]

        mockTimers = [{
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: Date.now() - 10000,
            elapsedTime: 65000,
            isPaused: false,
            note: ''
        }]

        renderWithToast(
            <GlobalTimer
                navigateToProject={vi.fn()}
                onClose={vi.fn()}
            />
        )

        const taskTitleButton = screen.getByRole('button', {
            name: 'A very long task title that should truncate before squeezing timer controls on mobile'
        })
        const timerDisplay = screen.getByText('1m 5s')
        const pauseButton = screen.getByRole('button', { name: 'Pause Timer' })

        expect(taskTitleButton.className).toContain('truncate')
        expect(taskTitleButton.className).toContain('min-w-0')
        expect(taskTitleButton.className).toContain('flex-1')
        expect(timerDisplay.className).toContain('shrink-0')
        expect(pauseButton.className).toContain('shrink-0')
    })

    it('keeps pause and stop controls when a timer prop is present before hook state catches up', () => {

        mockTimers = []

        renderWithToast(
            <GlobalTimer
                timer={{
                    projectId: 'project-1',
                    taskId: 'task-1',
                    startTime: Date.now() - 10000,
                    elapsedTime: 10000,
                    isPaused: false,
                    note: ''
                }}
                navigateToProject={vi.fn()}
                onClose={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Pause Timer' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save & Stop Timer' })).toBeInTheDocument()
    })
})
