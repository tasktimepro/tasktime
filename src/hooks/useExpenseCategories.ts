import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { ExpenseCategory } from '@/stores/yjs/types';

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

/**
 * Read saved categories without seeding: an empty browser may restore an
 * existing cloud workspace later, or the user may intentionally have none.
 */
export function useExpenseCategories() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<ExpenseCategory>(
        (store) => store.expenseCategories,
        { collectionName: 'expenseCategories' }
    );

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
