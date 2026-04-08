import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskModal from './TaskModal'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn(),
    showError: vi.fn()
}))

const taskMocks = vi.hoisted(() => ({

    createTask: vi.fn(),
    updateTask: vi.fn()
}))

const projectsMocks = vi.hoisted(() => ({

    projects: [
        { id: 'p1', title: 'Project Alpha', archived: false },
        { id: 'p2', title: 'Archived', archived: true }
    ]
}))

const timeEntriesMocks = vi.hoisted(() => ({

    entries: []
}))

vi.mock('../../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess,
        showError: toastMocks.showError
    })
}))

vi.mock('../../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        createTask: taskMocks.createTask,
        updateTask: taskMocks.updateTask
    })
}))

vi.mock('../../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: projectsMocks.projects
    })
}))

vi.mock('../../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: timeEntriesMocks.entries
    })
}))

vi.mock('../task/RecurringPicker', () => ({

    default: ({ onChange, onClear }) => (
        <div>
            <button type="button" onClick={() => onChange({ type: 'weekly', weeklyDays: [1] })}>Set recurring</button>
            <button type="button" onClick={onClear}>Clear recurring</button>
        </div>
    )
}))

describe('TaskModal', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        timeEntriesMocks.entries = []
    })

    it('creates a standalone task with start date', async () => {

        const onClose = vi.fn()
        const user = userEvent.setup()

        render(<TaskModal isOpen onClose={onClose} />)

        await user.type(screen.getByLabelText(/Task Title/i), 'Standalone task')
        const startDateInput = screen.getByLabelText(/Start Date/i)
        await user.clear(startDateInput)
        await user.type(startDateInput, '2025-01-15')
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(taskMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Standalone task',
            projectId: null,
            startDate: '2025-01-15',
            recurring: null,
            parentTaskId: null,
            completed: false,
            archived: false,
            lastActive: expect.any(Number)
        }))
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Task created')
        expect(onClose).toHaveBeenCalled()
    })

    it('preselects a project and reports the created task through modal options', async () => {

        const onClose = vi.fn()
        const onCreate = vi.fn()
        const user = userEvent.setup()

        taskMocks.createTask.mockImplementationOnce((payload) => ({
            id: 'created-task',
            ...payload,
        }))

        render(
            <TaskModal
                isOpen
                onClose={onClose}
                modalOptions={{
                    onCreate,
                    preselectedProjectId: 'p1',
                }}
            />
        )

        await user.type(screen.getByLabelText(/Task Title/i), 'Project-linked task')
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(taskMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            projectId: 'p1',
            title: 'Project-linked task',
        }))
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
            id: 'created-task',
            projectId: 'p1',
        }))
        expect(onClose).toHaveBeenCalled()
    })

    it('validates required title', async () => {

        const user = userEvent.setup()
        render(<TaskModal isOpen onClose={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(toastMocks.showError).toHaveBeenCalledWith('Task title is required')
    })

    it('updates an existing task', async () => {

        const onClose = vi.fn()
        const user = userEvent.setup()
        const editingTask = {
            id: 't1',
            title: 'Existing task',
            projectId: 'p1',
            startDate: '2025-01-10',
            recurring: null,
            parentTaskId: null
        }

        render(<TaskModal isOpen onClose={onClose} editingTask={editingTask} />)

        const titleInput = screen.getByLabelText(/Task Title/i)
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated task')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(taskMocks.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({
            title: 'Updated task',
            projectId: 'p1',
            startDate: '2025-01-10',
            recurring: null,
            parentTaskId: null
        }))
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Task updated')
        expect(onClose).toHaveBeenCalled()
    })

    it('disables start date when recurring is set', async () => {

        const user = userEvent.setup()
        render(<TaskModal isOpen onClose={vi.fn()} />)

        const startDateInput = screen.getByLabelText(/Start Date/i)
        expect(startDateInput).not.toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Set recurring' }))
        expect(startDateInput).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Clear recurring' }))
        expect(startDateInput).not.toBeDisabled()
    })

    it('shows lock notice when billed entries exist', () => {

        timeEntriesMocks.entries = [
            { taskId: 't1', billedInvoiceId: 'inv-1' }
        ]

        render(
            <TaskModal
                isOpen
                onClose={vi.fn()}
                editingTask={{ id: 't1', title: 'Locked task', projectId: 'p1' }}
            />
        )

        expect(screen.getByText('Project is locked')).toBeInTheDocument()
    })

    it('keeps the schedule row full width while footer actions stay inline on mobile', () => {

        render(<TaskModal isOpen onClose={vi.fn()} />)

        expect(screen.getByLabelText(/Start Date/i).className).toContain('w-full')
        expect(screen.getByRole('button', { name: 'Cancel' }).className).not.toContain('w-full')
        expect(screen.getByRole('button', { name: 'Create' }).className).not.toContain('w-full')
    })
})
