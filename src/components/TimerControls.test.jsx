import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimerControls from './TimerControls'
import { ToastContext } from '../contexts/ToastContext'

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
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('shows play button when timer is stopped', () => {

        renderWithToast(
            <TimerControls
                task={baseTask}
                timeEntries={[]}
                setTimeEntries={vi.fn()}
                tasks={[]}
                currentTimer={null}
                setCurrentTimer={vi.fn()}
            />
        )

        expect(screen.getByTitle('Start Timer')).toBeInTheDocument()
    })

    it('starts timer on play click', async () => {

        const setCurrentTimer = vi.fn()
        vi.spyOn(Date, 'now').mockReturnValue(1000)

        renderWithToast(
            <TimerControls
                task={baseTask}
                timeEntries={[]}
                setTimeEntries={vi.fn()}
                tasks={[]}
                currentTimer={null}
                setCurrentTimer={setCurrentTimer}
            />
        )

        await userEvent.click(screen.getByTitle('Start Timer'))

        expect(setCurrentTimer).toHaveBeenCalledWith(expect.objectContaining({
            taskId: 'task-1',
            startTime: 1000
        }))
    })

    it('shows pause and stop buttons when running', () => {

        renderWithToast(
            <TimerControls
                task={baseTask}
                timeEntries={[]}
                setTimeEntries={vi.fn()}
                tasks={[]}
                currentTimer={{ taskId: 'task-1', startTime: 10 }}
                setCurrentTimer={vi.fn()}
                isPaused={false}
            />
        )

        expect(screen.getByText('Pause')).toBeInTheDocument()
        expect(screen.getByText('Stop')).toBeInTheDocument()
    })

    it('stops timer and creates entry', async () => {

        const setCurrentTimer = vi.fn()
        const setTimeEntries = vi.fn()
        vi.spyOn(Date, 'now').mockReturnValue(2000)

        renderWithToast(
            <TimerControls
                task={baseTask}
                timeEntries={[]}
                setTimeEntries={setTimeEntries}
                tasks={[]}
                currentTimer={{ taskId: 'task-1', startTime: 1000 }}
                setCurrentTimer={setCurrentTimer}
                isPaused={false}
            />
        )

        await userEvent.click(screen.getByText('Stop'))

        expect(setTimeEntries).toHaveBeenCalled()
        expect(setCurrentTimer).toHaveBeenCalledWith(null)
    })

    it('stops a paused timer using paused elapsed time', async () => {

        const setCurrentTimer = vi.fn()
        const setTimeEntries = vi.fn()
        const setIsPaused = vi.fn()
        const setPausedElapsedTime = vi.fn()

        renderWithToast(
            <TimerControls
                task={baseTask}
                timeEntries={[]}
                setTimeEntries={setTimeEntries}
                tasks={[]}
                currentTimer={{ taskId: 'task-1', startTime: 1000 }}
                setCurrentTimer={setCurrentTimer}
                isGlobalTimer={true}
                isPaused={true}
                setIsPaused={setIsPaused}
                pausedElapsedTime={5000}
                setPausedElapsedTime={setPausedElapsedTime}
            />
        )

        await userEvent.click(screen.getByTitle('Save & Stop Timer'))

        const updater = setTimeEntries.mock.calls[0][0]
        const updated = updater([])

        expect(updated[0].start).toBe(1000)
        expect(updated[0].end).toBe(6000)
        expect(setCurrentTimer).toHaveBeenCalledWith(null)
        expect(setIsPaused).toHaveBeenCalledWith(false)
        expect(setPausedElapsedTime).toHaveBeenCalledWith(0)
    })

    it('stops existing timer when starting a new one', async () => {

        const setCurrentTimer = vi.fn()
        const setTimeEntries = vi.fn()
        vi.spyOn(Date, 'now').mockReturnValue(5000)

        renderWithToast(
            <TimerControls
                task={{ id: 'task-2', projectId: 'project-1' }}
                timeEntries={[]}
                setTimeEntries={setTimeEntries}
                tasks={[]}
                currentTimer={{ taskId: 'task-1', startTime: 1000 }}
                setCurrentTimer={setCurrentTimer}
                isPaused={false}
            />
        )

        await userEvent.click(screen.getByTitle('Start Timer'))

        const updater = setTimeEntries.mock.calls[0][0]
        const updated = updater([])

        expect(updated[0]).toMatchObject({
            taskId: 'task-1',
            start: 1000,
            end: 5000
        })

        expect(setCurrentTimer).toHaveBeenCalledWith(expect.objectContaining({
            taskId: 'task-2',
            startTime: 5000
        }))
    })
})
