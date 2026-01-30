import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskActionsMenu from './TaskActionsMenu'

describe('TaskActionsMenu', () => {

    it('calls onEdit when edit is selected', async () => {

        const onEdit = vi.fn()
        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

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

        render(<TaskActionsMenu task={task} onEdit={onEdit} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))

        expect(screen.getByText('Delete task?')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Delete' }))

        expect(onDelete).toHaveBeenCalledWith(task)
    })

    it('allows canceling delete confirmation', async () => {

        const onEdit = vi.fn()
        const onDelete = vi.fn()
        const task = { id: 't1', title: 'Task' }
        const user = userEvent.setup()

        render(<TaskActionsMenu task={task} onEdit={onEdit} onDelete={onDelete} />)

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByText('Delete'))
        await user.click(screen.getByRole('button', { name: 'Cancel' }))

        expect(onDelete).not.toHaveBeenCalled()
    })
})
