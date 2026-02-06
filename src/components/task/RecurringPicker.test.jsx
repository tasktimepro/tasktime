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

    it('applies yearly selection when enabled', async () => {

        const onChange = vi.fn()
        const onClear = vi.fn()
        const user = userEvent.setup()

        render(
            <RecurringPicker
                value={null}
                onChange={onChange}
                onClear={onClear}
                allowedTypes={['monthly', 'yearly']}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Set repeat' }))
        await user.click(screen.getByRole('button', { name: 'Every Year' }))

        await user.click(screen.getByLabelText('Yearly month'))
        await user.click(await screen.findByRole('option', { name: '5' }))
        await user.click(screen.getByLabelText('Yearly day'))
        await user.click(await screen.findByRole('option', { name: '12' }))

        await user.click(screen.getByRole('button', { name: 'Apply' }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            type: 'yearly',
            yearlyDate: '2023-05-12'
        }))
    })
})
