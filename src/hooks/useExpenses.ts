/**
 * useExpenses - React hook for expenses collection
 * 
 * Provides reactive expense data, filtering helpers, and status actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import type { Expense } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';

export interface UseExpensesOptions {
    clientId?: string;
    projectId?: string;
    personalOnly?: boolean;
    billableOnly?: boolean;
    includeArchived?: boolean;
}

type MarkAsPaidOptions = {
    amount?: number;
    paidOn?: string | null;
    paidBy?: string | null;
};

export function useExpenses(options: UseExpensesOptions = {}) {
    const { store, isReady, loadArchivedExpenses } = useYjs();
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);

    const syncExpenses = useCallback(() => {
        if (!isReady) return;

        const collected: Expense[] = [];
        const seenIds = new Set<string>();

        // Active expenses take precedence over archived
        store.expenses.forEach((value) => {
            collected.push(value);
            seenIds.add(value.id);
        });

        if (options.includeArchived && store.archivedExpenses) {
            store.archivedExpenses.forEach((value) => {
                if (!seenIds.has(value.id)) {
                    collected.push(value);
                }
            });
        }

        setAllExpenses(collected);
        setIsLoading(false);
    }, [isReady, store, options.includeArchived]);

    useEffect(() => {
        if (!isReady) return;

        syncExpenses();

        const handler = () => syncExpenses();
        store.expenses.observe(handler);

        return () => store.expenses.unobserve(handler);
    }, [isReady, store, syncExpenses]);

    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoading) return;

        let mounted = true;
        setArchivedLoading(true);

        loadArchivedExpenses()
            .then(() => {
                if (!mounted) return;
                setArchivedLoaded(true);
                syncExpenses();
            })
            .finally(() => {
                if (!mounted) return;
                setArchivedLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [options.includeArchived, isReady, archivedLoaded, archivedLoading, loadArchivedExpenses, syncExpenses]);

    useEffect(() => {
        if (!options.includeArchived || !archivedLoaded || !store.archivedExpenses) return;

        const handler = () => syncExpenses();
        store.archivedExpenses.observe(handler);

        return () => store.archivedExpenses?.unobserve(handler);
    }, [options.includeArchived, archivedLoaded, store, syncExpenses]);

    const filteredExpenses = useMemo(() => {
        let result = allExpenses;

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
    }, [allExpenses, options.clientId, options.projectId, options.personalOnly, options.billableOnly]);

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

    const getExpense = useCallback((id: string): Expense | undefined => {
        const active = store.expenses.get(id);
        if (active) return active;
        if (options.includeArchived && store.archivedExpenses) {
            return store.archivedExpenses.get(id);
        }
        return undefined;
    }, [store, options.includeArchived]);

    const findExpenseMap = useCallback((id: string) => {
        if (store.expenses.has(id)) return store.expenses;
        if (options.includeArchived && store.archivedExpenses?.has(id)) {
            return store.archivedExpenses;
        }
        return null;
    }, [store, options.includeArchived]);

    const createExpense = useCallback((data: Omit<Expense, 'id'> & { id?: string }): Expense => {
        if (!isReady) throw new Error('Store not ready');

        const id = data.id || generateId();
        const now = Date.now();
        const createdAt = typeof (data as { createdAt?: number }).createdAt === 'number'
            ? (data as { createdAt?: number }).createdAt as number
            : now;
        const updatedAt = typeof (data as { updatedAt?: number }).updatedAt === 'number'
            ? (data as { updatedAt?: number }).updatedAt as number
            : now;

        const expense: Expense = {
            ...data,
            id,
            createdAt,
            updatedAt,
        } as Expense;

        store.expenses.set(id, expense);
        return expense;
    }, [isReady, store]);

    const updateExpense = useCallback((id: string, updates: Partial<Expense>): Expense | undefined => {
        if (!isReady) return undefined;

        const map = findExpenseMap(id);
        if (!map) return undefined;

        const existing = map.get(id);
        if (!existing) return undefined;

        const updated: Expense = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
        } as Expense;

        map.set(id, updated);
        return updated;
    }, [isReady, findExpenseMap]);

    const deleteExpense = useCallback((id: string): boolean => {
        if (!isReady) return false;
        const map = findExpenseMap(id);
        if (!map) return false;
        return map.delete(id);
    }, [isReady, findExpenseMap]);

    const markAsPaid = useCallback((id: string, options: MarkAsPaidOptions = {}) => {
        const expense = getExpense(id);
        if (!expense) return undefined;

        const amount = typeof options.amount === 'number' ? options.amount : expense.amount;
        if (expense.amountType === 'variable' && (!amount || amount <= 0)) {
            throw new Error('Amount is required to mark variable expenses as paid');
        }

        return updateExpense(id, {
            amount,
            paidOn: options.paidOn ?? toStorageDate(new Date()),
            paidBy: options.paidBy ?? expense.paidBy ?? null,
            paymentStatus: 'paid',
        });
    }, [getExpense, updateExpense]);

    const markAsUnpaid = useCallback((id: string) => {
        return updateExpense(id, { paidOn: null, paidBy: null, paymentStatus: 'unpaid' });
    }, [updateExpense]);

    const markAsBilled = useCallback((id: string, invoiceId: string) => {
        return updateExpense(id, {
            billingStatus: 'billed',
            invoiceId,
            billedAt: Date.now(),
        });
    }, [updateExpense]);

    const markAsUnbilled = useCallback((id: string) => {
        return updateExpense(id, { billingStatus: 'unbilled', invoiceId: null, billedAt: null });
    }, [updateExpense]);

    const unbillExpensesForInvoice = useCallback((invoiceId: string) => {
        allExpenses
            .filter((expense) => expense.invoiceId === invoiceId)
            .forEach((expense) => {
                updateExpense(expense.id, { billingStatus: 'unbilled', invoiceId: null, billedAt: null });
            });
    }, [allExpenses, updateExpense]);

    const getExpensesForClient = useCallback((clientId: string) => {
        return allExpenses.filter((expense) => expense.clientId === clientId);
    }, [allExpenses]);

    const getExpensesForProject = useCallback((projectId: string) => {
        return allExpenses.filter((expense) => expense.projectId === projectId);
    }, [allExpenses]);

    const getBillableUnbilledForClient = useCallback((clientId: string) => {
        return allExpenses.filter((expense) => expense.clientId === clientId && expense.billable && expense.billingStatus === 'unbilled');
    }, [allExpenses]);

    const getBillableUnbilledForProject = useCallback((projectId: string) => {
        return allExpenses.filter((expense) => expense.projectId === projectId && expense.billable && expense.billingStatus === 'unbilled');
    }, [allExpenses]);

    const getOverdueExpenses = useCallback(() => {
        const today = parseStoredDate(toStorageDate(new Date()) || '');
        if (!today) return [];

        return allExpenses.filter((expense) => {
            if (expense.paymentStatus !== 'unpaid') return false;
            if (expense.paymentMode === 'auto') return false;
            const expenseDate = parseStoredDate(expense.date);
            return expenseDate ? expenseDate < today : false;
        });
    }, [allExpenses]);

    const getUpcomingDueExpenses = useCallback((days: number = 7) => {
        const todayValue = toStorageDate(new Date());
        if (!todayValue) return [];
        const today = parseStoredDate(todayValue);
        if (!today) return [];

        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);

        return allExpenses.filter((expense) => {
            const isAutoPayment = expense.paymentMode === 'auto';
            if (!isAutoPayment && expense.paymentStatus !== 'unpaid') return false;
            const expenseDate = parseStoredDate(expense.date);
            return expenseDate ? expenseDate >= today && expenseDate <= endDate : false;
        });
    }, [allExpenses]);

    return {
        expenses: filteredExpenses,
        unpaidExpenses,
        paidExpenses,
        unbilledExpenses,
        billedExpenses,
        isLoading: isLoading || (options.includeArchived && archivedLoading),
        totals,

        getExpense,
        createExpense,
        updateExpense,
        deleteExpense,

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
