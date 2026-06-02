import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExpenseRow from './ExpenseRow';

describe('ExpenseRow', () => {
    it('keeps the edit and mark-paid actions inline on mobile-sized layouts', () => {
        render(
            <ExpenseRow
                expense={{
                    id: 'expense-1',
                    title: 'Phone bill',
                    date: '2026-04-12',
                    amount: 15.99,
                    currency: 'EUR',
                    paymentStatus: 'unpaid',
                }}
                onView={vi.fn()}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        );

        const editButton = screen.getByRole('button', { name: 'Edit Expense' });
        const markPaidButton = screen.getByRole('button', { name: 'Mark as Paid' });
        const actionContainer = editButton.parentElement;

        expect(actionContainer).not.toBeNull();
        expect(actionContainer.className.includes('flex-col-reverse')).toBe(false);
        expect(actionContainer.className.includes('justify-end')).toBe(true);
        expect(markPaidButton.className.includes('w-full')).toBe(false);
        expect(markPaidButton.className.includes('shrink-0')).toBe(true);
        expect(editButton.className.includes('self-end')).toBe(false);
    });

    it('labels business expenses without a client as business expenses', () => {
        render(
            <ExpenseRow
                expense={{
                    id: 'expense-1',
                    title: 'Software license',
                    date: '2026-04-12',
                    amount: 15.99,
                    currency: 'EUR',
                    paymentStatus: 'paid',
                    isPersonal: false,
                }}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        );

        expect(screen.getByText('Business expense')).toBeInTheDocument();
        expect(screen.queryByText('Client:')).not.toBeInTheDocument();
    });

    it('shows project context in compact mixed client lists', () => {
        render(
            <ExpenseRow
                compact
                showProjectContext
                expense={{
                    id: 'expense-1',
                    title: 'Project software',
                    date: '2026-04-12',
                    amount: 40,
                    currency: 'EUR',
                    paymentStatus: 'unpaid',
                    projectId: 'project-1',
                }}
                project={{ id: 'project-1', title: 'Health AI' }}
                onEdit={vi.fn()}
                onTogglePaid={vi.fn()}
            />
        );

        expect(screen.getByText('Project:')).toBeInTheDocument();
        expect(screen.getByText('Health AI')).toBeInTheDocument();
    });
});
