import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskActionsMenu from './TaskActionsMenu'

const hookState = vi.hoisted(() => ({

    tasks: [],
    entries: [],
    projects: []
}))

vi.mock('@/hooks/useTasks', () => ({

    useTasks: () => ({
        tasks: hookState.tasks
    })
}))

vi.mock('@/hooks/useTimeEntries', () => ({

    useTimeEntries: () => ({
        entries: hookState.entries
    })
}))

vi.mock('@/hooks/useProjects', () => ({

    useProjects: () => ({
        projects: hookState.projects
    })
}))

describe('TaskActionsMenu', () => {

    it('shows billed and unbilled warnings in delete confirmation when applicable', async () => {

        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task', billable: true, lastBilledAt: 1000 }
        const user = userEvent.setup()

        hookState.tasks = [
            task,
            { id: 't2', title: 'Subtask', parentTaskId: 't1', billable: true, lastBilledAt: null }
        ]
        hookState.entries = [
            { taskId: 't1', start: 500, end: 900, billedInvoiceId: 'inv-1' },
            { taskId: 't2', start: 2000, end: 5600000 }
        ]
        hookState.projects = [{ id: 'p1', isPersonal: false }]

        task.projectId = 'p1'
        hookState.tasks[1].projectId = 'p1'

        render(<TaskActionsMenu task={task} onEdit={vi.fn()} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))

        expect(screen.getByText('This task and its subtasks include 1.55 unbilled hours.')).toBeInTheDocument()
        expect(screen.getByText('This task and its subtasks include time that is already recorded on an invoice.')).toBeInTheDocument()
    })

    it('does not show unbilled warning for tasks on personal projects', async () => {

        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task', billable: true, projectId: 'p1' }
        const user = userEvent.setup()

        hookState.tasks = [task]
        hookState.entries = [
            { taskId: 't1', start: 2000, end: 5600000 }
        ]
        hookState.projects = [{ id: 'p1', isPersonal: true }]

        render(<TaskActionsMenu task={task} onEdit={vi.fn()} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))

        expect(screen.queryByText('This task includes 1.55 unbilled hours.')).not.toBeInTheDocument()
    })

    it('calls onEdit when edit is selected', async () => {

        const onEdit = vi.fn()
        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

        hookState.tasks = [task]
        hookState.entries = []
        hookState.projects = []

        render(<TaskActionsMenu task={task} onEdit={onEdit} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Edit'))

        expect(onEdit).toHaveBeenCalledWith(task)
    })

    it('confirms delete before calling onDelete', async () => {

        const onEdit = vi.fn()
        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

        hookState.tasks = [task]
        hookState.entries = []
        hookState.projects = []

        render(<TaskActionsMenu task={task} onEdit={onEdit} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))

        expect(screen.getByText('Delete task?')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Delete' }))

        expect(onDelete).toHaveBeenCalledWith(task)
    })

    it('keeps delete destructive while other menu items stay neutral', async () => {

        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

        hookState.tasks = [task]
        hookState.entries = []
        hookState.projects = []

        render(<TaskActionsMenu task={task} onEdit={vi.fn()} onDelete={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))

        const editItem = screen.getByRole('menuitem', { name: 'Edit' })
        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' })

        expect(editItem.className.includes('status-warning-action')).toBe(false)
        expect(deleteItem.className.includes('status-danger-action')).toBe(true)
    })

    it('allows canceling delete confirmation', async () => {

        const onEdit = vi.fn()
        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

        hookState.tasks = [task]
        hookState.entries = []
        hookState.projects = []

        render(<TaskActionsMenu task={task} onEdit={onEdit} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))
        await user.click(screen.getByRole('button', { name: 'Cancel' }))

        expect(onDelete).not.toHaveBeenCalled()
    })
})
