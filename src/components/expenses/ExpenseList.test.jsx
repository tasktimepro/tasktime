import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExpenseList from './ExpenseList'

describe('ExpenseList', () => {

    it('renders empty state when no expenses', () => {
        render(
            <ExpenseList
                expenses={[]}
                clientsById={new Map()}
                projectsById={new Map()}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
                onCreateFirst={vi.fn()}
            />
        )

        expect(screen.getByText('No expenses yet')).toBeInTheDocument()
        expect(screen.getByText('Create First Expense')).toBeInTheDocument()
    })

    it('renders filtered empty state when expenses exist', () => {
        render(
            <ExpenseList
                expenses={[]}
                hasAnyExpenses
                hasActiveFilters
                clientsById={new Map()}
                projectsById={new Map()}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        )

        expect(screen.getByText('No expenses match your filters')).toBeInTheDocument()
    })

    it('renders period empty state when no filters are applied', () => {
        render(
            <ExpenseList
                expenses={[]}
                hasAnyExpenses
                clientsById={new Map()}
                projectsById={new Map()}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        )

        expect(screen.getByText('No expenses in this period')).toBeInTheDocument()
    })

    it('renders expense rows', () => {
        const expenses = [
            { id: 'e1', title: 'Adobe CC', date: '2025-02-01', amount: 10, currency: 'EUR', paymentStatus: 'paid', billingStatus: 'unbilled', billable: false, isPersonal: true },
            { id: 'e2', title: 'Office Rent', date: '2025-02-02', amount: 50, currency: 'USD', paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false, isPersonal: true },
        ]

        render(
            <ExpenseList
                expenses={expenses}
                clientsById={new Map()}
                projectsById={new Map()}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        )

        expect(screen.getByText('Adobe CC')).toBeInTheDocument()
        expect(screen.getByText('Office Rent')).toBeInTheDocument()
    })
})
