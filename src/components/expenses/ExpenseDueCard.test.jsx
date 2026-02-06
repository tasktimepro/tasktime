import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseDueCard from './ExpenseDueCard'

describe('ExpenseDueCard', () => {

    it('renders fixed expense with amount and mark paid icon button', () => {
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
        expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument()
        expect(screen.getByText(/USD/)).toBeInTheDocument()
    })

    it('hides check action for variable expense without amount', async () => {
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
                onMarkPaid={vi.fn()}
            />
        )

        expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument()
    })

    it('calls onView when card is clicked', async () => {
        const user = userEvent.setup()
            const onView = vi.fn()
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
                    onView={onView}
            />
        )

        const titleButton = screen.getByRole('button', { name: /Domain/ })
        await user.click(titleButton)
            expect(onView).toHaveBeenCalledWith(expense)
    })
})
