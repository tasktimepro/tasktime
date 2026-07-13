/**
 * useExpenseRecurrences - React hook for expense recurrence templates
 */

import { useCallback, useMemo } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { buildExpenseFromRecurrence, getPendingPeriods } from '@/utils/expenseUtils';
import type { Expense, ExpenseRecurrence } from '@/stores/yjs/types';

export function useExpenseRecurrences() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<ExpenseRecurrence>(
        (store) => store.expenseRecurrences,
        { collectionName: 'expenseRecurrences' }
    );

    const activeRecurrences = useMemo(
        () => items.filter((recurrence) => recurrence.active),
        [items]
    );

    const generatePendingExpenses = useCallback(async (
        createExpense: (data: Omit<Expense, 'id'> & { id?: string }) => Expense | Promise<Expense>,
        existingExpenseIds?: Set<string>,
    ): Promise<void> => {
        for (const recurrence of activeRecurrences) {
            const pendingDates = getPendingPeriods({
                startDate: recurrence.startDate,
                lastGeneratedDate: recurrence.lastGeneratedDate,
                endDate: recurrence.endDate,
                repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
            });

            if (pendingDates.length === 0) continue;

            for (const dateValue of pendingDates) {
                const expense = buildExpenseFromRecurrence(recurrence, dateValue);
                if (existingExpenseIds?.has(expense.id)) continue;
                await createExpense(expense);
                existingExpenseIds?.add(expense.id);
            }

            const lastGeneratedDate = pendingDates[pendingDates.length - 1];
            update(recurrence.id, { lastGeneratedDate });
        }
    }, [activeRecurrences, update]);

    const pauseRecurrence = useCallback((id: string) => {
        return update(id, { active: false });
    }, [update]);

    const resumeRecurrence = useCallback((id: string) => {
        return update(id, { active: true });
    }, [update]);

    return {
        recurrences: items,
        activeRecurrences,
        isLoading,

        getRecurrence: get,
        createRecurrence: create,
        updateRecurrence: update,
        deleteRecurrence: remove,

        generatePendingExpenses,
        pauseRecurrence,
        resumeRecurrence,
    };
}
