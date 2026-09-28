import React from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurringPicker from './RecurringPicker'

describe('RecurringPicker', () => {

    beforeAll(() => {
        if (!HTMLElement.prototype.hasPointerCapture) {
            HTMLElement.prototype.hasPointerCapture = () => false
        }
        if (!HTMLElement.prototype.setPointerCapture) {
            HTMLElement.prototype.setPointerCapture = () => {}
        }
        if (!HTMLElement.prototype.releasePointerCapture) {
            HTMLElement.prototype.releasePointerCapture = () => {}
        }
        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = () => {}
        }
    })

    it('applies weekly selections', async () => {

        const onChange = vi.fn()
        const onClear = vi.fn()
        const user = userEvent.setup()

        render(<RecurringPicker value={null} onChange={onChange} onClear={onClear} />)

        await user.click(screen.getByRole('button', { name: 'Set repeat' }))
        await user.click(screen.getByRole('button', { name: 'Tu' }))
        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            type: 'weekly',
            weeklyDays: expect.arrayContaining([1, 2])
        }))
    })

    it('clears recurring configuration', async () => {

        const onChange = vi.fn()
        const onClear = vi.fn()
        const user = userEvent.setup()

        render(<RecurringPicker value={null} onChange={onChange} onClear={onClear} />)

        await user.click(screen.getByRole('button', { name: 'Set repeat' }))
        await user.click(screen.getByRole('button', { name: 'Clear' }))

        expect(onClear).toHaveBeenCalled()
    })

    it('clamps monthly specific days to 28', async () => {

        const onChange = vi.fn()
        const onClear = vi.fn()
        const user = userEvent.setup()

        render(<RecurringPicker value={null} onChange={onChange} onClear={onClear} />)

        await user.click(screen.getByRole('button', { name: 'Set repeat' }))
        await user.click(screen.getByRole('button', { name: 'Every Month' }))
        await user.click(screen.getByRole('button', { name: 'On day' }))

        const input = screen.getByPlaceholderText('Day (1-28)')
        await user.clear(input)
        await user.type(input, '29')

        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            type: 'monthly',
            monthlyType: 'specific',
            monthlyDay: 28
        }))
    })

    it.each([
        ['task defaults', undefined],
        ['restricted recurring expense options', ['monthly', 'yearly']]
    ])('offers and applies a yearly schedule with %s', async (_scenario, allowedTypes) => {

        const onChange = vi.fn()
        const onClear = vi.fn()
        const user = userEvent.setup()

        render(<RecurringPicker value={null} onChange={onChange} onClear={onClear} allowedTypes={allowedTypes} />)

        await user.click(screen.getByRole('button', { name: 'Set repeat' }))
        await user.click(screen.getByRole('button', { name: 'Every Year' }))

        await user.click(screen.getByRole('button', { name: 'May' }))
        const day = screen.getByRole('spinbutton', { name: 'Yearly day' })
        await user.clear(day)
        await user.type(day, '12')

        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            type: 'yearly',
            yearlyDate: '2023-05-12'
        }))
    })

    it('loads an existing yearly task schedule for editing', async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()

        render(
            <RecurringPicker
                value={{ type: 'yearly', yearlyDate: '2023-11-21' }}
                onChange={onChange}
                onClear={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Yearly (Nov 21)' }))
        expect(screen.getByRole('button', { name: 'Every Year' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'November' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('spinbutton', { name: 'Yearly day' })).toHaveValue(21)
        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith({ type: 'yearly', yearlyDate: '2023-11-21' })
    })

    it('allows a later day without a long dropdown and validates month length', async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()

        render(<RecurringPicker value={{ type: 'yearly', yearlyDate: '2023-01-03' }} onChange={onChange} onClear={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Yearly (Jan 3)' }))
        const day = screen.getByRole('spinbutton', { name: 'Yearly day' })
        await user.clear(day)
        await user.type(day, '31')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'February' }))
        expect(day).toHaveValue(28)
        await user.clear(day)
        await user.type(day, '29')
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a day from 1 to 28.')
        await user.clear(day)
        await user.type(day, '28')
        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith({ type: 'yearly', yearlyDate: '2023-02-28' })
    })
})
