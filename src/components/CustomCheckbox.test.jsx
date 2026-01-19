import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomCheckbox from './CustomCheckbox'

describe('CustomCheckbox', () => {

    it('renders label when provided', () => {

        render(
            <CustomCheckbox
                checked={false}
                onChange={vi.fn()}
                label="Billable"
            />
        )

        expect(screen.getByText('Billable')).toBeInTheDocument()
    })

    it('calls onChange when clicked', async () => {

        const onChange = vi.fn()

        render(
            <CustomCheckbox
                checked={false}
                onChange={onChange}
                label="Billable"
            />
        )

        await userEvent.click(screen.getByRole('checkbox'))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('respects disabled state', async () => {

        const onChange = vi.fn()

        render(
            <CustomCheckbox
                checked={false}
                onChange={onChange}
                disabled
                label="Billable"
            />
        )

        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).toBeDisabled()

        await userEvent.click(checkbox)

        expect(onChange).not.toHaveBeenCalled()
    })
})
