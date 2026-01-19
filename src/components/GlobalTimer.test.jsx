import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import GlobalTimer from './GlobalTimer'
import { ToastContext } from '../contexts/ToastContext'

describe('GlobalTimer', () => {

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
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('shows paused elapsed time when timer is paused', async () => {

        renderWithToast(
            <GlobalTimer
                currentTimer={{ taskId: 'task-1', startTime: Date.now() - 10000 }}
                setCurrentTimer={vi.fn()}
                tasks={[{ id: 'task-1', title: 'Task One', projectId: 'project-1' }]}
                projects={[{ id: 'project-1', title: 'Project One' }]}
                setTimeEntries={vi.fn()}
                isPaused={true}
                setIsPaused={vi.fn()}
                pausedElapsedTime={65000}
                setPausedElapsedTime={vi.fn()}
                navigateToProject={vi.fn()}
                onClose={vi.fn()}
                setTasks={vi.fn()}
                timeEntries={[]}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('1m 5s')).toBeInTheDocument()
        })
    })
})
