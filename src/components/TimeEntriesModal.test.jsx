import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
        activeTasks: [{ id: 'task-1', title: 'Task One', projectId: 'project-1' }]
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

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[0])

        await user.clear(screen.getByLabelText('Start Date'))
        await user.type(screen.getByLabelText('Start Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('Start Time'))
        await user.type(screen.getByLabelText('Start Time'), '10:00:00')
        await user.clear(screen.getByLabelText('End Date'))
        await user.type(screen.getByLabelText('End Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('End Time'))
        await user.type(screen.getByLabelText('End Time'), '11:00:00')
        await user.type(screen.getByLabelText('Note (optional)'), 'Manual entry')

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[1])

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

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[0])

        await user.clear(screen.getByLabelText('Start Date'))
        await user.type(screen.getByLabelText('Start Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('Start Time'))
        await user.type(screen.getByLabelText('Start Time'), '11:00:00')
        await user.clear(screen.getByLabelText('End Date'))
        await user.type(screen.getByLabelText('End Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('End Time'))
        await user.type(screen.getByLabelText('End Time'), '10:00:00')

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[1])

        expect(timeEntriesHookMocks.createEntry).not.toHaveBeenCalled()
        expect(toastMocks.showError).toHaveBeenCalledWith('End time must be after start time')
    })

    it('shows validation error when required fields are missing', async () => {

        const user = userEvent.setup()

        render(
            <TimeEntriesModal
                {...baseProps}
            />
        )

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[0])

        await user.clear(screen.getByLabelText('Start Date'))

        await user.click(screen.getAllByRole('button', { name: 'Add Entry' })[1])

        expect(timeEntriesHookMocks.createEntry).not.toHaveBeenCalled()
        expect(toastMocks.showError).toHaveBeenCalledWith('Please fill in all date and time fields')
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

        await user.clear(screen.getByLabelText('End Time'))
        await user.type(screen.getByLabelText('End Time'), '12:00:00')

        await user.click(screen.getByRole('button', { name: 'Save Changes' }))

        expect(timeEntriesHookMocks.updateEntry).toHaveBeenCalledTimes(1)

        const [entryId, updates] = timeEntriesHookMocks.updateEntry.mock.calls[0]
        expect(entryId).toBe('entry-1')
        expect(updates.end).toBeGreaterThan(entry.end)
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry updated successfully')
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
