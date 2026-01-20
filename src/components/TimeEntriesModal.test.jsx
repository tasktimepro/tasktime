import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeEntriesModal from './TimeEntriesModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

vi.mock('../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError
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
        timeEntries: [],
        setTimeEntries: vi.fn(),
        allTasks: [baseTask]
    }

    beforeEach(() => {

        toastMocks.showSuccess.mockClear()
        toastMocks.showError.mockClear()
        baseProps.setTimeEntries.mockClear()
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

        expect(baseProps.setTimeEntries).toHaveBeenCalledTimes(1)

        const updatedEntries = baseProps.setTimeEntries.mock.calls[0][0]
        expect(updatedEntries).toHaveLength(1)
        expect(updatedEntries[0]).toMatchObject({
            id: 'generated-id',
            taskId: 'task-1',
            note: 'Manual entry'
        })
        expect(updatedEntries[0].start).toBeTypeOf('number')
        expect(updatedEntries[0].end).toBeTypeOf('number')
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

        expect(baseProps.setTimeEntries).not.toHaveBeenCalled()
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

        expect(baseProps.setTimeEntries).not.toHaveBeenCalled()
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

        render(
            <TimeEntriesModal
                {...baseProps}
                timeEntries={[entry]}
            />
        )

        await user.click(screen.getByTitle('Edit entry'))

        await user.clear(screen.getByLabelText('End Time'))
        await user.type(screen.getByLabelText('End Time'), '12:00:00')

        await user.click(screen.getByRole('button', { name: 'Save Changes' }))

        expect(baseProps.setTimeEntries).toHaveBeenCalledTimes(1)

        const updatedEntries = baseProps.setTimeEntries.mock.calls[0][0]
        expect(updatedEntries).toHaveLength(1)
        expect(updatedEntries[0].id).toBe('entry-1')
        expect(updatedEntries[0].end).toBeGreaterThan(entry.end)
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry updated successfully')
    })

    it('deletes an existing time entry', async () => {

        const user = userEvent.setup()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        const entry = {
            id: 'entry-1',
            taskId: 'task-1',
            start: new Date('2026-01-19T10:00:00').getTime(),
            end: new Date('2026-01-19T11:00:00').getTime()
        }

        render(
            <TimeEntriesModal
                {...baseProps}
                timeEntries={[entry]}
            />
        )

        await user.click(screen.getByTitle('Delete entry'))

        expect(confirmSpy).toHaveBeenCalled()
        expect(baseProps.setTimeEntries).toHaveBeenCalledTimes(1)

        const updatedEntries = baseProps.setTimeEntries.mock.calls[0][0]
        // Soft-delete: entry still exists but has deletedAt set
        expect(updatedEntries).toHaveLength(1)
        expect(updatedEntries[0].id).toBe('entry-1')
        expect(updatedEntries[0].deletedAt).toBeDefined()
        expect(updatedEntries[0].deletedAt).toBeGreaterThan(0)
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Time entry deleted successfully')
    })
})
