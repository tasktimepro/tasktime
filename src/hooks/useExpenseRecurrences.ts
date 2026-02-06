/**
 * useExpenseRecurrences - React hook for expense recurrence templates
 */

import { useCallback, useMemo } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { buildExpenseFromRecurrence, getPendingPeriods } from '@/utils/expenseUtils';
import type { Expense, ExpenseRecurrence } from '@/stores/yjs/types';

export function useExpenseRecurrences() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<ExpenseRecurrence>(
        (store) => store.expenseRecurrences
    );

    const activeRecurrences = useMemo(
        () => items.filter((recurrence) => recurrence.active),
        [items]
    );

    const generatePendingExpenses = useCallback((createExpense: (data: Omit<Expense, 'id'> & { id?: string }) => Expense) => {
        activeRecurrences.forEach((recurrence) => {
            const pendingDates = getPendingPeriods({
                startDate: recurrence.startDate,
                lastGeneratedDate: recurrence.lastGeneratedDate,
                endDate: recurrence.endDate,
                repeat: recurrence.repeat,
            });

            if (pendingDates.length === 0) return;

            pendingDates.forEach((dateValue) => {
                const expense = buildExpenseFromRecurrence(recurrence, dateValue);
                createExpense(expense);
            });

            const lastGeneratedDate = pendingDates[pendingDates.length - 1];
            update(recurrence.id, { lastGeneratedDate });
        });
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
