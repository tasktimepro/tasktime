import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {

    it('renders dropdown options and triggers actions', async () => {

        const onTaskClick = vi.fn()
        const onExpenseClick = vi.fn()
        const user = userEvent.setup()

        render(
            <FloatingActionButton
                onTaskClick={onTaskClick}
                onExpenseClick={onExpenseClick}
            />
        )

        const button = screen.getByRole('button', { name: 'Create new item' })
        expect(button).toBeInTheDocument()
        expect(button.className).toContain('fixed')

        await user.click(button)

        const taskOption = screen.getByRole('menuitem', { name: 'New Task' })
        const expenseOption = screen.getByRole('menuitem', { name: 'New Expense' })

        await user.click(taskOption)
        expect(onTaskClick).toHaveBeenCalled()

        await user.click(button)
        const expenseOptionAfterOpen = screen.getByRole('menuitem', { name: 'New Expense' })
        await user.click(expenseOptionAfterOpen)
        expect(onExpenseClick).toHaveBeenCalled()
    })
})
