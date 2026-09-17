import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseDueCard from './ExpenseDueCard'

describe('ExpenseDueCard', () => {
    it('keeps the amount and actions visible in a compact dashboard column on desktop', () => {
        render(<ExpenseDueCard compact expense={{ id: 'compact', title: 'A long software subscription', amount: 29, currency: 'EUR', paymentStatus: 'unpaid', date: '2026-09-28' }} onView={() => {}} onMarkPaid={() => {}} />);
        expect(screen.getByTestId('expense-row-secondary-compact')).toBeInTheDocument();
        expect(screen.getByText('€29.00 EUR')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument();
    });

    const setMatchMedia = (matches) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches,
                media: '(max-width: 767px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }))
        })
    }

    beforeEach(() => {
        setMatchMedia(false)

        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 6, 10, 0, 0));
    });

    afterEach(() => {

        vi.useRealTimers();
    });

    it.each([
        [false, false, false], [false, false, true],
        [true, false, false], [true, false, true],
        [false, true, false], [false, true, true],
    ])('constrains the title itself for ellipsis (mobile=%s, compact=%s, clickable=%s)', (mobile, compact, clickable) => {
        setMatchMedia(mobile)
        const title = 'Prototyping subscription with an exceptionally long expense title'
        render(<ExpenseDueCard
            compact={compact}
            expense={{ id: 'long-title', title, date: '2026-02-06', amount: 29, currency: 'EUR' }}
            category={{ color: '#8b5cf6' }}
            onView={clickable ? vi.fn() : undefined}
        />)
        const label = screen.getByText(title)
        const amount = screen.getByText('€29.00 EUR')
        expect(label).toHaveClass('min-w-0', 'truncate')
        expect(label.parentElement).toContainElement(amount)
        expect(label).toHaveClass('leading-5')
        expect(amount).toHaveClass('leading-5')
        expect(label).toHaveAttribute('title', title)
        expect(screen.getByTestId('category-color-dot')).toHaveClass('shrink-0')
    })

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

    it('shows the original category color as a dot because the due row has no colored border', () => {
        render(
            <ExpenseDueCard
                expense={{ id: 'category-expense', title: 'Software', date: '2026-02-06', amount: 12, amountType: 'fixed', currency: 'USD' }}
                category={{ id: 'software', name: 'Software', color: '#ef4444' }}
            />
        )

        expect(screen.getByTestId('category-color-dot')).toHaveStyle({ backgroundColor: '#ef4444' })
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

    it.each([
        { mobile: false, recurring: false },
        { mobile: true, recurring: false },
        { mobile: false, recurring: true },
        { mobile: true, recurring: true },
    ])('removes paid expense urgency and restores it when unpaid: %j', ({ mobile, recurring }) => {
        setMatchMedia(mobile)
        const expense = { id: 'late', title: 'Client meeting room', date: '2026-02-05', amount: 45, currency: 'EUR', paymentStatus: 'unpaid' }
        const recurrence = recurring ? { repeat: 'monthly', monthlyType: 'specific', monthlyDay: 5 } : null
        const card = (paymentStatus) => (
            <ExpenseDueCard expense={{ ...expense, paymentStatus }} recurrence={recurrence} isOverdue onView={() => {}} />
        )
        const { rerender } = render(card('unpaid'))
        expect(screen.getByText('Overdue')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open expense details' })).toBeInTheDocument()

        rerender(card('paid'))
        expect(screen.getByText(expense.title)).toHaveClass('line-through')
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
        expect(screen.queryByText('Monthly (5th)')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open expense details' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Client meeting room/ })).toBeInTheDocument()

        rerender(card('unpaid'))
        expect(screen.getByText(expense.title)).not.toHaveClass('line-through')
        expect(screen.getByText('Overdue')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open expense details' })).toBeInTheDocument()
    })

    it('retains the schedule for future automatic payments recorded as paid', () => {
        render(<ExpenseDueCard expense={{ id: 'future-auto', title: 'Auto subscription', date: '2026-02-07', paymentStatus: 'paid', paymentMode: 'auto', amountType: 'fixed', amount: 19, currency: 'EUR' }} />)
        expect(screen.getByText('Tomorrow')).toBeInTheDocument()
        expect(screen.getByText('Auto subscription')).not.toHaveClass('line-through')
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

    it('keeps the mobile pay action available below the date', () => {
        setMatchMedia(true)

        const expense = {
            id: 'exp-7',
            title: 'Phone bill with a longer mobile label',
            date: '2026-02-05',
            amount: 45,
            amountType: 'fixed',
            currency: 'USD',
            supplierName: 'A1',
        }

        render(
            <ExpenseDueCard
                expense={expense}
                isOverdue
                onMarkPaid={vi.fn()}
            />
        )

        const secondaryRow = screen.getByTestId('expense-row-secondary-exp-7')
        const actionsRow = screen.getByTestId('expense-row-actions-exp-7')

        expect(secondaryRow).not.toContainElement(actionsRow)
        expect(within(actionsRow).getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument()
        expect(screen.getByText('A1')).toBeInTheDocument()
    })
})
