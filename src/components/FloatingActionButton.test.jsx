import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {

    it('triggers task creation on click', async () => {

        const onTaskClick = vi.fn()
        const user = userEvent.setup()

        render(
            <FloatingActionButton
                onTaskClick={onTaskClick}
            />
        )

        const button = screen.getByRole('button', { name: 'Create new task' })
        expect(button).toBeInTheDocument()
        expect(button.className).toContain('fixed')

        await user.click(button)
        expect(onTaskClick).toHaveBeenCalled()
    })
})
