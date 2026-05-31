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
        { id: 'p1', title: 'Project Alpha', archived: false, preferredClientId: 'client-1', flatRate: false, hourlyRate: 120, isPersonal: false },
        { id: 'p2', title: 'Archived', archived: true },
        { id: 'p3', title: 'Project Fixed', archived: false, preferredClientId: 'client-2', flatRate: true, isPersonal: false }
    ]
}))

const clientsMocks = vi.hoisted(() => ({

    clients: [
        { id: 'client-1', title: 'Client One', defaultHourlyRate: 100, hourlyRate: 90 },
        { id: 'client-2', title: 'Client Two', defaultHourlyRate: 80, hourlyRate: 80 }
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

vi.mock('../../hooks/useClients.ts', () => ({

    useClients: () => ({
        clients: clientsMocks.clients
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

    it('shows hourly estimate fields and saves estimated hours for hourly client projects', async () => {

        const user = userEvent.setup()

        render(
            <TaskModal
                isOpen
                onClose={vi.fn()}
                modalOptions={{ preselectedProjectId: 'p1' }}
            />
        )

        expect(screen.getByLabelText('Estimated Hours')).toBeInTheDocument()
        expect(screen.queryByLabelText('Quote Amount')).not.toBeInTheDocument()

        await user.type(screen.getByLabelText(/Task Title/i), 'Estimated hourly task')
        await user.type(screen.getByLabelText('Estimated Hours'), '3.5')

        expect(screen.getByText('Estimated amount from project rate: 420.00')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(taskMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            projectId: 'p1',
            estimatedHours: 3.5,
            estimatedFlatAmount: null,
        }))
    })

    it('shows flat estimate fields and saves quote amount for flat-rate client projects', async () => {

        const user = userEvent.setup()

        render(
            <TaskModal
                isOpen
                onClose={vi.fn()}
                modalOptions={{ preselectedProjectId: 'p3' }}
            />
        )

        expect(screen.getByLabelText('Estimated Hours')).toBeInTheDocument()
        expect(screen.getByLabelText('Quote Amount')).toBeInTheDocument()

        await user.type(screen.getByLabelText(/Task Title/i), 'Flat quote task')
        await user.type(screen.getByLabelText('Estimated Hours'), '5')
        await user.type(screen.getByLabelText('Quote Amount'), '900')
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(taskMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            projectId: 'p3',
            estimatedHours: 5,
            estimatedFlatAmount: 900,
        }))
    })

    it('hides estimate fields for standalone tasks', () => {

        render(<TaskModal isOpen onClose={vi.fn()} />)

        expect(screen.queryByLabelText('Estimated Hours')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Quote Amount')).not.toBeInTheDocument()
    })
})
