import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseDueCard from './ExpenseDueCard'

describe('ExpenseDueCard', () => {

    it('renders fixed expense with amount and mark paid button', () => {
        const expense = {
            id: 'exp-1',
            title: 'Office Rent',
            date: '2026-02-06',
            amount: 1200,
            amountType: 'fixed',
            currency: 'USD',
            supplierName: 'Landlord',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                isToday
                onMarkPaid={vi.fn()}
            />
        )

        expect(screen.getByText('Office Rent')).toBeInTheDocument()
        expect(screen.getByText('Today')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Mark Paid' })).toBeInTheDocument()
        expect(screen.getByText(/USD/)).toBeInTheDocument()
    })

    it('shows variable amount input and validates entry', async () => {
        const user = userEvent.setup()
        const onMarkPaid = vi.fn()
        const expense = {
            id: 'exp-2',
            title: 'Electricity',
            date: '2026-02-06',
            amount: 0,
            amountType: 'variable',
            currency: 'USD',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                onMarkPaid={onMarkPaid}
            />
        )

        const input = screen.getByPlaceholderText('Enter amount')
        const button = screen.getByRole('button', { name: 'Enter Amount & Pay' })

        await user.click(button)
        expect(screen.getByText('Amount required')).toBeInTheDocument()

        await user.clear(input)
        await user.type(input, '147.23')
        await user.click(button)

        expect(onMarkPaid).toHaveBeenCalledWith(147.23)
    })

    it('calls onEdit when card is clicked', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        const expense = {
            id: 'exp-3',
            title: 'Domain',
            date: '2026-02-06',
            amount: 20,
            amountType: 'fixed',
            currency: 'USD',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                onEdit={onEdit}
            />
        )

        const card = screen.getByText('Domain').closest('div[role="button"]')
        expect(card).toBeTruthy()
        await user.click(card)
        expect(onEdit).toHaveBeenCalledWith(expense)
    })
})
