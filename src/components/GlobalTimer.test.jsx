import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GlobalTimer from './GlobalTimer'
import { ToastContext } from '../contexts/ToastContext'

vi.mock('@/components/ui/time-picker', () => ({ TimePicker: props => <input {...props} /> }))

// Mock timer hook state
let mockTimers = []
let mockTasks = []
let mockEntries = []

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
        entries: mockEntries,
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
        mockEntries = []
        mockTimers = []
        mockTasks = [{ id: 'task-1', title: 'Task One', projectId: 'project-1' }]
    })

    afterEach(() => {

        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it.each([
        ['2026-09-13T00:53:00', '2026-09-12', '23:30:00'],
        ['2027-01-01T00:53:00', '2026-12-31', '23:30:00'],
        ['2026-03-29T04:00:00', '2026-03-28', '23:30:00'],
    ])('moves the active timer to an explicit previous date from %s', (now, date, time) => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(now))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000, elapsedTime: 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: date } })
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: time } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', expect.objectContaining({ startTime: new Date(`${date}T${time}`).getTime() }))
        expect(toastContextValue.showError).not.toHaveBeenCalled()
    })

    it.each([['2026-09-13', '23:30:00'], ['2026-09-14', '00:30:00'], ['', '23:30:00']])('rejects invalid or future start %s %s', (date, time) => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-13T00:53:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: date } })
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: time } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(toastContextValue.showError).toHaveBeenCalled()
    })

    it('keeps the original timestamp when editing only the note on an overnight timer', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-25T05:00:00'))
        const startTime = new Date('2026-10-25T02:30:00+01:00').getTime() + 123
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, note: 'Original' }]
        renderWithToast(<GlobalTimer isExpanded />)
        expect(screen.getByLabelText('Start Date')).toHaveValue('2026-10-25')
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated note' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', { startTime, note: 'Updated note' })
    })

    it.skipIf(new Date('2026-03-29T02:30:00').getHours() === 2)('rejects a local time skipped by daylight-saving time', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-29T04:00:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '02:30:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(toastContextValue.showError).toHaveBeenCalledWith('This start time does not exist on the selected date')
    })

    it('rejects an earlier date that overlaps existing project work', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-13T00:53:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        mockEntries = [{ id: 'existing', taskId: 'task-1', start: new Date('2026-09-12T23:00:00').getTime(), end: new Date('2026-09-12T23:45:00').getTime() }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-12' } })
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '23:30:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(toastContextValue.showError).toHaveBeenCalled()
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
        const timerIndicator = screen.getByLabelText('Timer active')

        expect(taskTitleButton.className).toContain('text-foreground')
        expect(taskTitleButton.className).not.toContain('status-danger-text-strong')
        expect(timerIndicator).toHaveClass('status-danger-fill', 'animate-pulse')
    })

    it('keeps a disabled recurring task status out of the active timer title', () => {
        mockTasks = [{
            id: 'task-1',
            title: 'Task One',
            projectId: 'project-1',
            recurring: { type: 'weekly', weeklyDays: [1], paused: true }
        }]
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
        expect(taskTitleButton).toHaveClass('flex-1')
        expect(screen.queryByLabelText('Recurring task disabled')).not.toBeInTheDocument()
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
