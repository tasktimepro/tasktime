import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseDueCard from './ExpenseDueCard'

describe('ExpenseDueCard', () => {

    beforeEach(() => {

        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 6, 10, 0, 0));
    });

    afterEach(() => {

        vi.useRealTimers();
    });

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
        vi.useRealTimers();
        const user = userEvent.setup();
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

    it('shows overdue badge for recurring expenses', () => {
        const expense = {
            id: 'exp-4',
            title: 'Weekly Service',
            date: '2026-02-07',
            amount: 25,
            amountType: 'fixed',
            currency: 'USD',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                isOverdue
                recurrence={{
                    id: 'rec-1',
                    title: 'Weekly Service',
                    startDate: '2026-01-01',
                    repeat: 'weekly',
                    amount: 25,
                    amountType: 'fixed',
                    currency: 'USD',
                    active: true
                }}
            />
        )

        expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('hides mark paid action for auto-payment expenses', () => {
        const expense = {
            id: 'exp-5',
            title: 'Auto Subscription',
            date: '2026-02-06',
            amount: 15,
            amountType: 'fixed',
            currency: 'USD',
            paymentMode: 'auto',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                onMarkPaid={vi.fn()}
            />
        )

        expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument()
    })

    it('shows mark paid action for variable auto-payment expenses with amount', () => {
        const expense = {
            id: 'exp-6',
            title: 'Variable Auto',
            date: '2026-02-06',
            amount: 22,
            amountType: 'variable',
            currency: 'USD',
            paymentMode: 'auto',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                onMarkPaid={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument()
    })
})
