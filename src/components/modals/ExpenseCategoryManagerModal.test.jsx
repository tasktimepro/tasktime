import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpenseCategoryManagerModal from './ExpenseCategoryManagerModal';

const toastState = vi.hoisted(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
}));

const expenseCategoriesState = vi.hoisted(() => ({
    allExpenseCategories: [],
    createExpenseCategory: vi.fn(),
    updateExpenseCategory: vi.fn(),
    archiveExpenseCategory: vi.fn(),
    restoreExpenseCategory: vi.fn(),
    deleteExpenseCategory: vi.fn(),
}));

const expensesState = vi.hoisted(() => ({
    expenses: [],
}));

const recurrencesState = vi.hoisted(() => ({
    recurrences: [],
}));

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => toastState,
}));

vi.mock('@/hooks/useExpenseCategories.ts', () => ({
    useExpenseCategories: () => expenseCategoriesState,
}));

vi.mock('@/hooks/useExpenses.ts', () => ({
    useExpenses: () => expensesState,
}));

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => recurrencesState,
}));

describe('ExpenseCategoryManagerModal', () => {
    beforeEach(() => {
        toastState.showError.mockReset();
        toastState.showSuccess.mockReset();
        expenseCategoriesState.createExpenseCategory.mockReset();
        expenseCategoriesState.updateExpenseCategory.mockReset();
        expenseCategoriesState.archiveExpenseCategory.mockReset();
        expenseCategoriesState.restoreExpenseCategory.mockReset();
        expenseCategoriesState.deleteExpenseCategory.mockReset();
        expenseCategoriesState.allExpenseCategories = [
            {
                id: 'category-1',
                name: 'Software & subscriptions',
                group: 'software',
                isDefault: true,
                archived: false,
            },
        ];
        expensesState.expenses = [];
        recurrencesState.recurrences = [];
    });

    it('creates a colored category in a separate modal', () => {
        render(<ExpenseCategoryManagerModal isOpen onClose={vi.fn()} />);

        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        const activeHeading = screen.getByText('Active categories');
        const categoryHeader = activeHeading.parentElement?.parentElement;
        expect(categoryHeader).toHaveClass('flex', 'items-center', 'justify-between');
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
        expect(screen.getByRole('dialog', { name: 'Add category' })).toHaveClass('sm:max-w-lg');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Travel' } });
        fireEvent.click(screen.getByRole('button', { name: 'Select Blue color' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));

        expect(expenseCategoriesState.createExpenseCategory).toHaveBeenCalledWith({
            name: 'Travel',
            group: null,
            color: '#3b82f6',
        });
        expect(toastState.showSuccess).toHaveBeenCalledWith('Category created');
    });

    it('loads a category into edit mode and updates it', async () => {
        const user = userEvent.setup();

        render(<ExpenseCategoryManagerModal isOpen onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Software' } });
        await user.click(screen.getByRole('button', { name: 'Update Category' }));

        expect(expenseCategoriesState.updateExpenseCategory).toHaveBeenCalledWith('category-1', {
            name: 'Software',
            group: 'software',
            color: null,
        });
        expect(toastState.showSuccess).toHaveBeenCalledWith('Category updated');
    });

    it('blocks deletion when the category is already in use', async () => {
        const user = userEvent.setup();

        expensesState.expenses = [
            {
                id: 'expense-1',
                categoryId: 'category-1',
            },
        ];

        render(<ExpenseCategoryManagerModal isOpen onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

        expect(expenseCategoriesState.deleteExpenseCategory).not.toHaveBeenCalled();
        expect(toastState.showError).not.toHaveBeenCalled();
        const blockedDialog = screen.getByRole('dialog', { name: `Can't delete "Software & subscriptions"` });
        expect(blockedDialog).toBeInTheDocument();
        expect(blockedDialog).toHaveTextContent('1 expense. Archive it instead if you want to hide it from new expenses.');
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog', { name: `Can't delete "Software & subscriptions"` })).not.toBeInTheDocument();
    });
});
