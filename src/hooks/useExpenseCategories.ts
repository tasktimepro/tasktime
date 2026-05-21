import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { ExpenseCategory } from '@/stores/yjs/types';

const DEFAULT_EXPENSE_CATEGORIES: Array<Pick<ExpenseCategory, 'name' | 'group'>> = [
    { name: 'Software & subscriptions', group: 'software' },
    { name: 'Office supplies', group: 'office' },
    { name: 'Professional services', group: 'professional' },
    { name: 'Banking & payment fees', group: 'banking' },
    { name: 'Travel', group: 'travel' },
    { name: 'Meals', group: 'meals' },
    { name: 'Equipment', group: 'equipment' },
    { name: 'Rent & utilities', group: 'utilities' },
    { name: 'Taxes & government fees', group: 'taxes' },
    { name: 'Insurance', group: 'insurance' },
    { name: 'Marketing', group: 'marketing' },
    { name: 'Other', group: 'other' },
];

const sortCategories = (categories: ExpenseCategory[]) => {
    return [...categories].sort((left, right) => {
        if (left.archived !== right.archived) {
            return left.archived ? 1 : -1;
        }

        if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
    });
};

type UseExpenseCategoriesOptions = {
    seedDefaults?: boolean;
};

export function useExpenseCategories(options: UseExpenseCategoriesOptions = {}) {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<ExpenseCategory>(
        (store) => store.expenseCategories,
        { collectionName: 'expenseCategories' }
    );
    const seededDefaults = useRef(false);

    useEffect(() => {
        if (!options.seedDefaults || isLoading || seededDefaults.current || items.length > 0) {
            return;
        }

        seededDefaults.current = true;

        DEFAULT_EXPENSE_CATEGORIES.forEach((category) => {
            create({
                name: category.name,
                group: category.group,
                isDefault: true,
                archived: false,
            });
        });
    }, [create, isLoading, items.length, options.seedDefaults]);

    const sortedCategories = useMemo(() => sortCategories(items), [items]);
    const activeCategories = useMemo(
        () => sortedCategories.filter((category) => !category.archived),
        [sortedCategories]
    );

    const createExpenseCategory = useCallback((data: Omit<ExpenseCategory, 'id' | 'isDefault' | 'archived'> & { isDefault?: boolean; archived?: boolean; id?: string }) => {
        return create({
            ...data,
            isDefault: data.isDefault ?? false,
            archived: data.archived ?? false,
        });
    }, [create]);

    const archiveExpenseCategory = useCallback((id: string) => {
        return update(id, { archived: true });
    }, [update]);

    const restoreExpenseCategory = useCallback((id: string) => {
        return update(id, { archived: false });
    }, [update]);

    return {
        expenseCategories: activeCategories,
        allExpenseCategories: sortedCategories,
        isLoading,
        getExpenseCategory: get,
        createExpenseCategory,
        updateExpenseCategory: update,
        deleteExpenseCategory: remove,
        archiveExpenseCategory,
        restoreExpenseCategory,
    };
}

export { DEFAULT_EXPENSE_CATEGORIES };
