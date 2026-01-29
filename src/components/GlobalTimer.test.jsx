import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import GlobalTimer from './GlobalTimer'
import { ToastContext } from '../contexts/ToastContext'

// Mock timer hook state
let mockTimers = []

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
        tasks: [{ id: 'task-1', title: 'Task One', projectId: 'project-1' }],
        activeTasks: [{ id: 'task-1', title: 'Task One', projectId: 'project-1' }],
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
})
