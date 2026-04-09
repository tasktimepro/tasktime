import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {

    it('opens quick-create options and triggers task creation', async () => {

        const onTaskClick = vi.fn()
        const onExpenseClick = vi.fn()
        const user = userEvent.setup()

        render(
            <FloatingActionButton
                onTaskClick={onTaskClick}
                onExpenseClick={onExpenseClick}
            />
        )

        const button = screen.getByRole('button', { name: 'Open quick create menu' })
        expect(button).toBeInTheDocument()
        expect(button.className).toContain('fixed')

        await user.click(button)
        await user.click(screen.getByRole('menuitem', { name: 'New Task' }))

        expect(onTaskClick).toHaveBeenCalled()
        expect(onExpenseClick).not.toHaveBeenCalled()
    })

    it('opens quick-create options and triggers expense creation', async () => {

        const onTaskClick = vi.fn()
        const onExpenseClick = vi.fn()
        const user = userEvent.setup()

        render(
            <FloatingActionButton
                onTaskClick={onTaskClick}
                onExpenseClick={onExpenseClick}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Open quick create menu' }))
        await user.click(screen.getByRole('menuitem', { name: 'New Expense' }))

        expect(onExpenseClick).toHaveBeenCalled()
        expect(onTaskClick).not.toHaveBeenCalled()
    })

    it('accepts additional positioning classes for mobile reuse', () => {
        render(
            <FloatingActionButton
                onTaskClick={vi.fn()}
                onExpenseClick={vi.fn()}
                className="bottom-safe-fab right-4"
            />
        )

        const button = screen.getByRole('button', { name: 'Open quick create menu' })

        expect(button.className).toContain('bottom-safe-fab')
        expect(button.className).toContain('right-4')
    })
})
