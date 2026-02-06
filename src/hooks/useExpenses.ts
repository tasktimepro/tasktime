/**
 * useExpenses - React hook for expenses collection
 * 
 * Provides reactive expense data, filtering helpers, and status actions.
 */

import { useCallback, useMemo } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import type { Expense } from '@/stores/yjs/types';

export interface UseExpensesOptions {
    clientId?: string;
    projectId?: string;
    personalOnly?: boolean;
    billableOnly?: boolean;
}

type MarkAsPaidOptions = {
    amount?: number;
    paidOn?: string | null;
    paidBy?: string | null;
};

export function useExpenses(options: UseExpensesOptions = {}) {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<Expense>(
        (store) => store.expenses
    );

    const filteredExpenses = useMemo(() => {
        let result = items;

        if (options.clientId) {
            result = result.filter((expense) => expense.clientId === options.clientId);
        }

        if (options.projectId) {
            result = result.filter((expense) => expense.projectId === options.projectId);
        }

        if (options.personalOnly) {
            result = result.filter((expense) => expense.isPersonal);
        }

        if (options.billableOnly) {
            result = result.filter((expense) => expense.billable);
        }

        return [...result].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });
    }, [items, options.clientId, options.projectId, options.personalOnly, options.billableOnly]);

    const unpaidExpenses = useMemo(
        () => filteredExpenses.filter((expense) => expense.paymentStatus === 'unpaid'),
        [filteredExpenses]
    );

    const paidExpenses = useMemo(
        () => filteredExpenses.filter((expense) => expense.paymentStatus === 'paid'),
        [filteredExpenses]
    );

    const unbilledExpenses = useMemo(
        () => filteredExpenses.filter((expense) => expense.billable && expense.billingStatus === 'unbilled'),
        [filteredExpenses]
    );

    const billedExpenses = useMemo(
        () => filteredExpenses.filter((expense) => expense.billingStatus === 'billed'),
        [filteredExpenses]
    );

    const totals = useMemo(() => {
        const total = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const unpaid = unpaidExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const paid = paidExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const billableUnbilled = unbilledExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

        return { total, unpaid, paid, billableUnbilled };
    }, [filteredExpenses, unpaidExpenses, paidExpenses, unbilledExpenses]);

    const markAsPaid = useCallback((id: string, options: MarkAsPaidOptions = {}) => {
        const expense = get(id);
        if (!expense) return undefined;

        const amount = typeof options.amount === 'number' ? options.amount : expense.amount;
        if (expense.amountType === 'variable' && (!amount || amount <= 0)) {
            throw new Error('Amount is required to mark variable expenses as paid');
        }

        return update(id, {
            amount,
            paidOn: options.paidOn ?? toStorageDate(new Date()),
            paidBy: options.paidBy ?? expense.paidBy ?? null,
            paymentStatus: 'paid',
        });
    }, [get, update]);

    const markAsUnpaid = useCallback((id: string) => {
        return update(id, { paidOn: null, paidBy: null, paymentStatus: 'unpaid' });
    }, [update]);

    const markAsBilled = useCallback((id: string, invoiceId: string) => {
        return update(id, {
            billingStatus: 'billed',
            invoiceId,
            billedAt: Date.now(),
        });
    }, [update]);

    const markAsUnbilled = useCallback((id: string) => {
        return update(id, { billingStatus: 'unbilled', invoiceId: null, billedAt: null });
    }, [update]);

    const unbillExpensesForInvoice = useCallback((invoiceId: string) => {
        items
            .filter((expense) => expense.invoiceId === invoiceId)
            .forEach((expense) => {
                update(expense.id, { billingStatus: 'unbilled', invoiceId: null, billedAt: null });
            });
    }, [items, update]);

    const getExpensesForClient = useCallback((clientId: string) => {
        return items.filter((expense) => expense.clientId === clientId);
    }, [items]);

    const getExpensesForProject = useCallback((projectId: string) => {
        return items.filter((expense) => expense.projectId === projectId);
    }, [items]);

    const getBillableUnbilledForClient = useCallback((clientId: string) => {
        return items.filter((expense) => expense.clientId === clientId && expense.billable && expense.billingStatus === 'unbilled');
    }, [items]);

    const getBillableUnbilledForProject = useCallback((projectId: string) => {
        return items.filter((expense) => expense.projectId === projectId && expense.billable && expense.billingStatus === 'unbilled');
    }, [items]);

    const getOverdueExpenses = useCallback(() => {
        const today = parseStoredDate(toStorageDate(new Date()) || '');
        if (!today) return [];

        return items.filter((expense) => {
            if (expense.paymentStatus !== 'unpaid') return false;
            const expenseDate = parseStoredDate(expense.date);
            return expenseDate ? expenseDate < today : false;
        });
    }, [items]);

    const getUpcomingDueExpenses = useCallback((days: number = 7) => {
        const todayValue = toStorageDate(new Date());
        if (!todayValue) return [];
        const today = parseStoredDate(todayValue);
        if (!today) return [];

        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);

        return items.filter((expense) => {
            if (expense.paymentStatus !== 'unpaid') return false;
            const expenseDate = parseStoredDate(expense.date);
            return expenseDate ? expenseDate >= today && expenseDate <= endDate : false;
        });
    }, [items]);

    return {
        expenses: filteredExpenses,
        unpaidExpenses,
        paidExpenses,
        unbilledExpenses,
        billedExpenses,
        isLoading,
        totals,

        getExpense: get,
        createExpense: create,
        updateExpense: update,
        deleteExpense: remove,

        markAsPaid,
        markAsUnpaid,
        markAsBilled,
        markAsUnbilled,
        unbillExpensesForInvoice,

        getExpensesForClient,
        getExpensesForProject,
        getBillableUnbilledForClient,
        getBillableUnbilledForProject,
        getOverdueExpenses,
        getUpcomingDueExpenses,
    };
}
