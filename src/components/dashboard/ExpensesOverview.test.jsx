import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpensesOverview from './ExpensesOverview';

const categoryState = vi.hoisted(() => ({ categories: [] }));

vi.mock('@/hooks/useExpenseCategories.ts', () => ({
    useExpenseCategories: () => ({
        expenseCategories: categoryState.categories,
        allExpenseCategories: categoryState.categories,
    }),
}));

vi.mock('../../hooks/useIsMobileLayout', () => ({ default: () => false }));

describe('ExpensesOverview', () => {
    beforeEach(() => {
        categoryState.categories = [];
    });

    it('shows an expense category dot with the original tag color', () => {
        categoryState.categories = [{ id: 'software', name: 'Software', color: '#ef4444' }];

        render(
            <ExpensesOverview
                expenses={[{
                    id: 'expense-1',
                    title: 'Hosting',
                    categoryId: 'software',
                    date: '2026-09-09',
                    amount: 25,
                    currency: 'EUR',
                    paymentStatus: 'paid',
                }]}
                expenseFilter="paid"
                setExpenseFilter={vi.fn()}
                preferredCurrency="EUR"
                onExpenseClick={vi.fn()}
            />
        );

        expect(screen.getByTestId('category-color-dot')).toHaveStyle({ backgroundColor: '#ef4444' });
    });
});
