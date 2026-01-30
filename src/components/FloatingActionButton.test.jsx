import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton', () => {

    it('renders and triggers click handler', async () => {

        const onClick = vi.fn()
        render(<FloatingActionButton onClick={onClick} />)

        const button = screen.getByRole('button', { name: 'Create new task' })
        expect(button).toBeInTheDocument()
        expect(button.className).toContain('fixed')

        await userEvent.click(button)
        expect(onClick).toHaveBeenCalled()
    })
})
