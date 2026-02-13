import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeEntriesModal from './TimeEntriesModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

const timeEntriesHookMocks = vi.hoisted(() => ({

    createEntry: vi.fn(() => ({ id: 'generated-id' })),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(() => true)
}))

let mockTimeEntries = []

vi.mock('../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: mockTimeEntries,
        createEntry: timeEntriesHookMocks.createEntry,
        updateEntry: timeEntriesHookMocks.updateEntry,
        deleteEntry: timeEntriesHookMocks.deleteEntry
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
        projects: [{ id: 'project-1', title: 'Project One', hourlyRate: 50 }],
        isLoading: false
    })
}))

vi.mock('../utils/idUtils.ts', () => ({

    generateId: () => 'generated-id'
}))

describe('TimeEntriesModal', () => {

    const baseTask = {
        id: 'task-1',
        title: 'Task One',
        projectId: 'project-1'
    }

    const baseProps = {
        isOpen: true,
        onClose: vi.fn(),
        task: baseTask,
        allTasks: [baseTask]
    }

    beforeEach(() => {

        toastMocks.showSuccess.mockClear()
        toastMocks.showError.mockClear()
        timeEntriesHookMocks.createEntry.mockClear()
        timeEntriesHookMocks.updateEntry.mockClear()
        timeEntriesHookMocks.deleteEntry.mockClear()
        mockTimeEntries = []
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('adds a manual time entry', async () => {

        const user = userEvent.setup()

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Add Entry' }))

        await user.clear(screen.getByLabelText('Date started'))
        await user.type(screen.getByLabelText('Date started'), '2026-01-19')
        await user.clear(screen.getByLabelText('Time spent'))
        await user.type(screen.getByLabelText('Time spent'), '1h')
        await user.type(screen.getByLabelText('Note (optional)'), 'Manual entry')

        const addButtons = screen.getAllByRole('button', { name: 'Add Entry' })
        await user.click(addButtons[addButtons.length - 1])

        expect(timeEntriesHookMocks.createEntry).toHaveBeenCalledTimes(1)

        const entryData = timeEntriesHookMocks.createEntry.mock.calls[0][0]
        expect(entryData).toMatchObject({
            taskId: 'task-1',
            note: 'Manual entry'
        })
        expect(entryData.start).toBeTypeOf('number')
        expect(entryData.end).toBeTypeOf('number')
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry added successfully')
    })

    it('rejects manual entries with invalid ranges', async () => {

        const user = userEvent.setup()

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Add Entry' }))

        await user.clear(screen.getByLabelText('Date started'))
        await user.type(screen.getByLabelText('Date started'), '2026-01-19')
        await user.clear(screen.getByLabelText('Time spent'))
        await user.type(screen.getByLabelText('Time spent'), '0m')

        const addButtons = screen.getAllByRole('button', { name: 'Add Entry' })
        await user.click(addButtons[addButtons.length - 1])

        expect(timeEntriesHookMocks.createEntry).not.toHaveBeenCalled()
        expect(toastMocks.showError).toHaveBeenCalledWith('Time spent must be greater than 0')
    })

    it('shows validation error when required fields are missing', async () => {

        const user = userEvent.setup()

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Add Entry' }))

        await user.clear(screen.getByLabelText('Date started'))

        const addButtons = screen.getAllByRole('button', { name: 'Add Entry' })
        await user.click(addButtons[addButtons.length - 1])

        expect(timeEntriesHookMocks.createEntry).not.toHaveBeenCalled()
        expect(toastMocks.showError).toHaveBeenCalledWith('Please fill in date started and start time')
    })

    it('edits an existing time entry', async () => {

        const user = userEvent.setup()
        const entry = {
            id: 'entry-1',
            taskId: 'task-1',
            start: new Date('2026-01-19T10:00:00').getTime(),
            end: new Date('2026-01-19T11:00:00').getTime(),
            note: 'Original'
        }

        // Set up mock entries for this test
        mockTimeEntries = [entry]

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByTitle('Edit entry'))

        await user.clear(screen.getByLabelText('Time spent'))
        await user.type(screen.getByLabelText('Time spent'), '2h')

        await user.click(screen.getByRole('button', { name: 'Save Changes' }))

        expect(timeEntriesHookMocks.updateEntry).toHaveBeenCalledTimes(1)

        const [entryId, updates] = timeEntriesHookMocks.updateEntry.mock.calls[0]
        expect(entryId).toBe('entry-1')
        expect(updates.end).toBeGreaterThan(entry.end)
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry updated successfully')
    })

    it('supports seconds when editing an existing time entry', async () => {

        const user = userEvent.setup()
        const entry = {
            id: 'entry-seconds',
            taskId: 'task-1',
            start: new Date('2026-01-19T10:00:15').getTime(),
            end: new Date('2026-01-19T11:00:45').getTime(),
            note: 'With seconds'
        }

        mockTimeEntries = [entry]

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByTitle('Edit entry'))

        await user.clear(screen.getByLabelText('Time spent'))
        await user.type(screen.getByLabelText('Time spent'), '1h 30m 45s')

        await user.click(screen.getByRole('button', { name: 'Save Changes' }))

        expect(timeEntriesHookMocks.updateEntry).toHaveBeenCalledTimes(1)
        const [entryId, updates] = timeEntriesHookMocks.updateEntry.mock.calls[0]
        expect(entryId).toBe('entry-seconds')
        expect(updates.end - updates.start).toBe((1 * 60 * 60 + 30 * 60 + 45) * 1000)
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry updated successfully')
    })

    it('does not allow seconds when adding a new manual time entry', async () => {

        const user = userEvent.setup()

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Add Entry' }))

        await user.clear(screen.getByLabelText('Date started'))
        await user.type(screen.getByLabelText('Date started'), '2026-01-19')
        await user.clear(screen.getByLabelText('Time spent'))
        await user.type(screen.getByLabelText('Time spent'), '30s')

        const addButtons = screen.getAllByRole('button', { name: 'Add Entry' })
        await user.click(addButtons[addButtons.length - 1])

        expect(timeEntriesHookMocks.createEntry).not.toHaveBeenCalled()
        expect(toastMocks.showError).toHaveBeenCalledWith('Use format like 2w 4d 6h 45m')
    })

    it('deletes an existing time entry', async () => {

        const user = userEvent.setup()
        const entry = {
            id: 'entry-1',
            taskId: 'task-1',
            start: new Date('2026-01-19T10:00:00').getTime(),
            end: new Date('2026-01-19T11:00:00').getTime()
        }

        // Set up mock entries for this test
        mockTimeEntries = [entry]

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getByTitle('Delete entry'))

        await user.click(screen.getByRole('button', { name: 'Delete' }))
        expect(timeEntriesHookMocks.deleteEntry).toHaveBeenCalledTimes(1)
        expect(timeEntriesHookMocks.deleteEntry).toHaveBeenCalledWith('entry-1')
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry deleted successfully')
    })
})
