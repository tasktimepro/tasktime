import React, { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskTimer from '../../components/TaskTimer'
import { ToastContext } from '../../contexts/ToastContext'

describe('Timer workflow integration', () => {

    const task = { id: 'task-1', projectId: 'project-1', title: 'Test Task' }
    const tasks = [task]
    const toastContextValue = {
        addToast: vi.fn(),
        removeToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    }

    const Harness = ({ isGlobalTimer = false }) => {
        const [timeEntries, setTimeEntries] = useState([])
        const [currentTimer, setCurrentTimer] = useState(null)
        const [isPaused, setIsPaused] = useState(false)
        const [pausedElapsedTime, setPausedElapsedTime] = useState(0)

        return (
            <ToastContext.Provider value={toastContextValue}>
                <TaskTimer
                    task={task}
                    tasks={tasks}
                    timeEntries={timeEntries}
                    setTimeEntries={setTimeEntries}
                    currentTimer={currentTimer}
                    setCurrentTimer={setCurrentTimer}
                    isPaused={isPaused}
                    setIsPaused={setIsPaused}
                    pausedElapsedTime={pausedElapsedTime}
                    setPausedElapsedTime={setPausedElapsedTime}
                    isGlobalTimer={isGlobalTimer}
                    showTimeDisplay={false}
                />
                <div data-testid="entries">{JSON.stringify(timeEntries)}</div>
            </ToastContext.Provider>
        )
    }

    let user
    let now

    beforeEach(() => {

        now = 0
        vi.spyOn(Date, 'now').mockImplementation(() => now)
        user = userEvent.setup()
    })

    afterEach(() => {

        cleanup()
        vi.restoreAllMocks()
    })

    it('start then stop creates a time entry', async () => {

        render(<Harness />)

        await user.click(screen.getByTitle('Start Timer'))

        now = 1000
        await user.click(screen.getByText('Stop'))

        const entries = JSON.parse(screen.getByTestId('entries').textContent || '[]')
        expect(entries).toHaveLength(1)
        expect(entries[0].start).toBe(0)
        expect(entries[0].end).toBe(1000)
    })

    it('pause then stop uses paused elapsed time', async () => {

        render(<Harness isGlobalTimer />)

        await user.click(screen.getByTitle('Start Timer'))

        now = 2000
        await user.click(screen.getByTitle('Pause Timer'))

        now = 5000
        await user.click(screen.getByTitle('Save & Stop Timer'))

        const entries = JSON.parse(screen.getByTestId('entries').textContent || '[]')
        expect(entries).toHaveLength(1)
        expect(entries[0].start).toBe(0)
        expect(entries[0].end).toBe(2000)
    })

    it('pause then resume continues from paused time', async () => {

        render(<Harness isGlobalTimer />)

        await user.click(screen.getByTitle('Start Timer'))

        now = 2000
        await user.click(screen.getByTitle('Pause Timer'))

        now = 3000
        await user.click(screen.getByTitle('Resume Timer'))

        now = 4000
        await user.click(screen.getByTitle('Save & Stop Timer'))

        const entries = JSON.parse(screen.getByTestId('entries').textContent || '[]')
        expect(entries).toHaveLength(1)
        expect(entries[0].start).toBe(1000)
        expect(entries[0].end).toBe(4000)
    })
})
