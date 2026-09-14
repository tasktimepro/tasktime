import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

    const chooseStartDay = (name) => {
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Start Day' }), { key: 'ArrowDown' })
        fireEvent.click(screen.getByRole('option', { name, exact: true }))
    }

    it('offers only today and yesterday for a recent timer, without a calendar', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T00:15:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 60000, elapsedTime: 60000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        expect(screen.queryByLabelText('Start Date')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open date picker' })).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Start Day' })).toHaveTextContent('Today')
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Start Day' }), { key: 'ArrowDown' })
        expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Today', 'Yesterday'])
    })

    it('previews the running overnight duration and updates it without saving', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T00:15:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 60000, elapsedTime: 60000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Yesterday')
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '23:30:00' } })
        const preview = screen.getByRole('group', { name: 'Timer preview' })
        expect(preview).toHaveTextContent('45m')
        expect(preview).toHaveTextContent('Yesterday 23:30:00 → Today 00:15:00 (now)')
        act(() => vi.advanceTimersByTime(2000))
        expect(preview).toHaveTextContent('45m 2s')
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
    })

    it('previews a paused correction with its fixed endpoint', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T12:00:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: new Date('2026-09-14T09:00:00').getTime(), elapsedTime: 600000, isPaused: true }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '08:55:00' } })
        const preview = screen.getByRole('group', { name: 'Timer preview' })
        expect(preview).toHaveTextContent('15m')
        expect(preview).toHaveTextContent('Today 08:55:00 → Today 09:10:00 (paused)')
        act(() => vi.advanceTimersByTime(60000))
        expect(preview).toHaveTextContent('15m')
        expect(preview).toHaveTextContent('09:10:00 (paused)')
    })

    it('preserves an older timer date and precise timestamp when clearing its note', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T12:00:00'))
        const startTime = new Date('2026-08-27T09:00:00').getTime() + 123
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, elapsedTime: 431000, isPaused: true, note: 'Old work' }]
        renderWithToast(<GlobalTimer isExpanded />)
        expect(screen.getByRole('combobox', { name: 'Start Day' })).toHaveTextContent('Aug 27, 2026')
        expect(screen.getByRole('group', { name: 'Timer preview' })).toHaveTextContent('7m 11s')
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: '' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', { startTime, note: '' })
    })

    it('blocks a paused start after its endpoint without showing a negative duration', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T12:00:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: new Date('2026-09-13T09:00:00').getTime(), elapsedTime: 600000, isPaused: true }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Today')
        expect(screen.getByRole('group', { name: 'Timer preview' })).toHaveTextContent('Start time cannot be after the timer was paused')
        expect(screen.getByRole('button', { name: 'Update Timer' })).toBeDisabled()
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
    })

    it('keeps an open draft on its absolute date when midnight changes the day labels', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-13T23:59:59'))
        const startTime = new Date('2026-09-13T23:50:00').getTime()
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, elapsedTime: 60000, isPaused: true }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Yesterday')
        act(() => vi.advanceTimersByTime(2000))
        expect(screen.getByRole('combobox', { name: 'Start Day' })).toHaveTextContent('Sep 12, 2026')
        expect(within(screen.getByRole('group', { name: 'Timer preview' })).getByText(/Sep 12, 2026 23:50:00/)).toBeInTheDocument()
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', expect.objectContaining({ startTime: new Date('2026-09-12T23:50:00').getTime() }))
    })

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
    ])('corrects the active timer to yesterday from %s', async (now, date, time) => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(now))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000, elapsedTime: 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Yesterday')
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: time } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', expect.objectContaining({ startTime: new Date(`${date}T${time}`).getTime() }))
        expect(toastContextValue.showError).not.toHaveBeenCalled()
    })

    it.each(['23:30:00', '25:00:00', '00:99:00', '00:30:99', ''])('rejects invalid or future start time %s', async (time) => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-13T00:53:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: time } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Update Timer' })).toBeDisabled()
        expect(screen.getByRole('group', { name: 'Timer preview' })).toHaveTextContent(/valid start|future/)
    })

    it('keeps the original timestamp when editing only the note on an overnight timer', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-25T05:00:00'))
        const startTime = new Date('2026-10-25T02:30:00+01:00').getTime() + 123
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, note: 'Original' }]
        renderWithToast(<GlobalTimer isExpanded />)
        expect(screen.getByRole('combobox', { name: 'Start Day' })).toHaveTextContent('Today')
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated note' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', { startTime, note: 'Updated note' })
    })

    it.skipIf(new Date('2026-03-29T02:30:00').getHours() === 2)('rejects a local time skipped by daylight-saving time', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-29T04:00:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '02:30:00' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(screen.getByRole('group', { name: 'Timer preview' })).toHaveTextContent('This start time does not exist on the selected date')
    })

    it('rejects an earlier date that overlaps existing project work', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-13T00:53:00'))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 10000 }]
        mockEntries = [{ id: 'existing', taskId: 'task-1', start: new Date('2026-09-12T23:00:00').getTime(), end: new Date('2026-09-12T23:45:00').getTime() }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Yesterday')
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '23:30:00' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).not.toHaveBeenCalled()
        expect(toastContextValue.showError).toHaveBeenCalled()
    })

    it('does not extend a paused August interval into September during validation', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-14T00:00:00'))
        const startTime = new Date('2026-08-27T23:50:45').getTime()
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, isPaused: true, elapsedTime: 431000 }]
        mockEntries = [{ id: 'existing', taskId: 'task-1', start: new Date('2026-09-13T16:43:00').getTime(), end: new Date('2026-09-14T00:43:00').getTime() }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '23:49:45' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', expect.objectContaining({ startTime: startTime - 60000 }))
        expect(toastContextValue.showError).not.toHaveBeenCalled()
    })

    it('keeps the draft open and reports failure when complete-history validation fails', async () => {
        let rejectUpdate
        timerHookMocks.updateTimer.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectUpdate = reject }))
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime: Date.now() - 60000, note: 'Original' }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Retain this draft' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update Timer' }))
        expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled()
        expect(toastContextValue.showSuccess).not.toHaveBeenCalled()
        await act(async () => rejectUpdate(new Error('History could not be loaded')))
        expect(toastContextValue.showError).toHaveBeenCalledWith('History could not be loaded')
        expect(toastContextValue.showSuccess).not.toHaveBeenCalled()
        expect(screen.getByLabelText('Note')).toHaveValue('Retain this draft')
        expect(screen.getByRole('button', { name: 'Update Timer' })).toBeEnabled()
    })

    it('can clear a note without changing or revalidating an existing overlapping interval', async () => {
        const startTime = Date.now() - 60000
        mockTimers = [{ projectId: 'project-1', taskId: 'task-1', startTime, note: 'Clear me' }]
        mockEntries = [{ id: 'legacy-overlap', taskId: 'task-1', start: startTime - 1000, end: Date.now() }]
        renderWithToast(<GlobalTimer isExpanded />)
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: '' } })
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalledWith('project-1', { startTime, note: '' })
        expect(toastContextValue.showSuccess).toHaveBeenCalledWith('Timer updated successfully')
        expect(toastContextValue.showError).not.toHaveBeenCalled()
    })

    it('keeps unrelated standalone tasks out of the edited timer overlap scope', async () => {
        mockTasks = [{ id: 'task-1', title: 'Standalone work', projectId: null }, { id: 'task-2', title: 'Other standalone work', projectId: null }]
        const startTime = Date.now() - 60000
        mockTimers = [{ projectId: 'task-1', taskId: 'task-1', startTime }]
        mockEntries = [{ id: 'other-work', taskId: 'task-2', start: startTime - 300000, end: Date.now() }]
        renderWithToast(<GlobalTimer isExpanded />)
        chooseStartDay('Yesterday')
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Timer' })))
        expect(timerHookMocks.updateTimer).toHaveBeenCalled()
        expect(toastContextValue.showError).not.toHaveBeenCalled()
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
