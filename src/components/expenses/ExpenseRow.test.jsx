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
});