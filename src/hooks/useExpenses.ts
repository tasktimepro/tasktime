/**
 * useExpenses - React hook for expenses collection
 * 
 * Provides reactive expense data, filtering helpers, and status actions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import type { Expense } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';
import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { objectToYMap, updateEntityFields } from '@/stores/yjs/entityUtils';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';
import { fetchExchangeRates, normalizeCurrencyCode } from '@/utils/currencyUtils';
import { createExpensePaymentCurrencySnapshot, getExpensePaymentCurrencySnapshot } from '@/utils/expenseUtils';

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

const SNAPSHOT_SENSITIVE_EXPENSE_FIELDS = ['amount', 'currency', 'date', 'paidOn', 'paymentStatus'] as const;

const shouldStoreExpensePaymentSnapshot = (expense: Partial<Expense>, preferredCurrency: string) => {
    return normalizeCurrencyCode(expense.currency || preferredCurrency) !== preferredCurrency;
};

export function useExpenses(options: UseExpensesOptions = {}) {
    const { store, isReady, loadArchivedExpenses } = useYjs();
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);
    const archivedLoadTriggered = useRef(false);

    const syncExpenses = useCallback(() => {
        if (!isReady) return;

        const collected: Expense[] = [];
        const seenIds = new Set<string>();

        // Active expenses take precedence over archived
        for (const expense of collectValidatedEntities<Expense>('expenses', store.expenses as any, 'active expenses sync')) {
            collected.push(expense);
            seenIds.add(expense.id);
        }

        if (options.includeArchived && store.archivedExpenses) {
            for (const expense of collectValidatedEntities<Expense>('expenses', store.archivedExpenses as any, 'archived expenses sync')) {
                if (!seenIds.has(expense.id)) {
                    collected.push(expense);
                }
            }
        }

        setAllExpenses(collected);
        setIsLoading(false);
    }, [isReady, store, options.includeArchived]);

    useEffect(() => {
        if (!isReady) return;

        syncExpenses();

        const handler = () => syncExpenses();
        store.expenses.observeDeep(handler);

        return () => store.expenses.unobserveDeep(handler);
    }, [isReady, store, syncExpenses]);

    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoadTriggered.current) return;

        archivedLoadTriggered.current = true;
        setArchivedLoading(true);

        loadArchivedExpenses()
            .then(() => {
                setArchivedLoaded(true);
                syncExpenses();
            })
            .finally(() => {
                setArchivedLoading(false);
            });
    }, [options.includeArchived, isReady, archivedLoaded, loadArchivedExpenses, syncExpenses]);

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
        const active = readValidatedEntity<Expense>('expenses', store.expenses.get(id), `read expense ${id}`);
        if (active) return active;
        if (options.includeArchived && store.archivedExpenses) {
            return readValidatedEntity<Expense>('expenses', store.archivedExpenses.get(id), `read archived expense ${id}`);
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

    const getPreferredCurrency = useCallback(() => {
        const storedPreference = store.preferences?.get?.('currency');
        return normalizeCurrencyCode(typeof storedPreference === 'string' ? storedPreference : undefined);
    }, [store]);

    const applyValidatedExpenseUpdate = useCallback((
        map: typeof store.expenses,
        id: string,
        updatesWithTimestamp: Record<string, unknown>,
        validated: Expense
    ) => {
        const result = updateEntityFields(map as any, id, updatesWithTimestamp);
        if (!result) {
            const entityMap = objectToYMap(validated as unknown as Record<string, unknown>);
            (map as any).set(id, entityMap);
        }

        markMeaningfulActivity();
        return validated;
    }, [store]);

    const ensureExpensePaymentSnapshot = useCallback(async (id: string): Promise<Expense | undefined> => {
        const map = findExpenseMap(id);
        if (!map) return undefined;

        const expense = readValidatedEntity<Expense>('expenses', map.get(id), `ensure expense payment snapshot ${id}`);
        if (!expense || expense.paymentStatus !== 'paid') {
            return expense;
        }

        if (getExpensePaymentCurrencySnapshot(expense)) {
            return expense;
        }

        const preferredCurrency = getPreferredCurrency();
        if (!shouldStoreExpensePaymentSnapshot(expense, preferredCurrency)) {
            return expense;
        }

        const expenseCurrency = normalizeCurrencyCode(expense.currency || preferredCurrency);
        const { rates, error } = await fetchExchangeRates();

        if (!rates && expenseCurrency !== preferredCurrency) {
            throw new Error(error || 'Unable to load exchange rates for expense payment snapshot.');
        }

        const updatedAt = Date.now();
        const snapshot = createExpensePaymentCurrencySnapshot({
            expense: {
                ...expense,
                updatedAt,
            },
            preferredCurrency,
            exchangeRates: rates,
        });
        const merged = {
            ...expense,
            paymentCurrencySnapshot: snapshot,
            updatedAt,
        };
        const validated = validateCollectionEntity<Expense>('expenses', merged, `update expense ${id} payment snapshot`);

        return applyValidatedExpenseUpdate(map, id, {
            paymentCurrencySnapshot: snapshot,
            updatedAt,
        }, validated);
    }, [applyValidatedExpenseUpdate, findExpenseMap, getPreferredCurrency]);

    const queueExpensePaymentSnapshot = useCallback((id: string) => {
        void ensureExpensePaymentSnapshot(id).catch((error) => {
            console.warn(`[useExpenses] Unable to persist payment snapshot for expense ${id}:`, error);
        });
    }, [ensureExpensePaymentSnapshot]);

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

        const validatedExpense = validateCollectionEntity<Expense>('expenses', expense, `create expense ${id}`);

        const entityMap = objectToYMap(validatedExpense as unknown as Record<string, unknown>);
        (store.expenses as any).set(id, entityMap);
        markMeaningfulActivity();

        if (validatedExpense.paymentStatus === 'paid' && !getExpensePaymentCurrencySnapshot(validatedExpense)) {
            const preferredCurrency = getPreferredCurrency();

            if (shouldStoreExpensePaymentSnapshot(validatedExpense, preferredCurrency)) {
                queueExpensePaymentSnapshot(id);
            }
        }

        return validatedExpense;
    }, [getPreferredCurrency, isReady, queueExpensePaymentSnapshot, store]);

    const updateExpense = useCallback((id: string, updates: Partial<Expense>): Expense | undefined => {
        if (!isReady) return undefined;

        const map = findExpenseMap(id);
        if (!map) return undefined;

        const existing = readValidatedEntity<Expense>('expenses', map.get(id), `update expense ${id}`);
        if (!existing) return undefined;

        const updatesWithTimestamp = { ...updates, updatedAt: Date.now() } as Record<string, unknown>;
        const nextExpense = { ...existing, ...updatesWithTimestamp };
        const preferredCurrency = getPreferredCurrency();
        const shouldStoreSnapshot = (updatesWithTimestamp.paymentStatus ?? existing.paymentStatus) === 'paid'
            && shouldStoreExpensePaymentSnapshot(nextExpense, preferredCurrency);
        const hasProvidedPaymentSnapshot = Object.prototype.hasOwnProperty.call(updatesWithTimestamp, 'paymentCurrencySnapshot')
            && Boolean(getExpensePaymentCurrencySnapshot(nextExpense));
        const shouldRefreshPaymentSnapshot = shouldStoreSnapshot
            && !hasProvidedPaymentSnapshot
            && (
                updatesWithTimestamp.paymentCurrencySnapshot === null
                || !getExpensePaymentCurrencySnapshot(nextExpense)
                || SNAPSHOT_SENSITIVE_EXPENSE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(updatesWithTimestamp, field))
            );

        if (!shouldStoreSnapshot && Object.prototype.hasOwnProperty.call(existing, 'paymentCurrencySnapshot')) {
            updatesWithTimestamp.paymentCurrencySnapshot = undefined;
        } else if (shouldRefreshPaymentSnapshot) {
            updatesWithTimestamp.paymentCurrencySnapshot = undefined;
        }

        const merged = { ...existing, ...updatesWithTimestamp };
        const validated = validateCollectionEntity<Expense>('expenses', merged, `update expense ${id}`);

        applyValidatedExpenseUpdate(map, id, updatesWithTimestamp, validated);

        if (shouldRefreshPaymentSnapshot) {
            queueExpensePaymentSnapshot(id);
        }

        return validated;
    }, [applyValidatedExpenseUpdate, getPreferredCurrency, isReady, findExpenseMap, queueExpensePaymentSnapshot]);

    const deleteExpense = useCallback((id: string): boolean => {
        if (!isReady) return false;
        const map = findExpenseMap(id);
        if (!map) return false;
        const removed = map.delete(id);

        if (removed) {
            markMeaningfulActivity();
        }

        return removed;
    }, [isReady, findExpenseMap]);

    const markAsPaid = useCallback(async (id: string, options: MarkAsPaidOptions = {}) => {
        const expense = getExpense(id);
        if (!expense) return undefined;

        const amount = typeof options.amount === 'number' ? options.amount : expense.amount;
        if (expense.amountType === 'variable' && (!amount || amount <= 0)) {
            throw new Error('Amount is required to mark variable expenses as paid');
        }

        const preferredCurrency = getPreferredCurrency();
        const requiresSnapshot = shouldStoreExpensePaymentSnapshot(expense, preferredCurrency);
        let rates: Record<string, number> | null = null;
        let error: string | null = null;

        if (requiresSnapshot) {
            ({ rates, error } = await fetchExchangeRates());

            if (!rates) {
                throw new Error(error || 'Unable to load exchange rates for expense payment snapshot.');
            }
        }

        const paidOn = options.paidOn ?? toStorageDate(new Date());
        const paidBy = options.paidBy ?? expense.paidBy ?? null;
        const paidExpense = {
            ...expense,
            amount,
            paidOn,
            paidBy,
            paymentStatus: 'paid' as const,
        };

        return updateExpense(id, {
            amount,
            paidOn,
            paidBy,
            paymentStatus: 'paid',
            paymentCurrencySnapshot: createExpensePaymentCurrencySnapshot({
                expense: paidExpense,
                preferredCurrency,
                exchangeRates: rates,
            }) ?? undefined,
        });
    }, [getExpense, getPreferredCurrency, updateExpense]);

    const markAsUnpaid = useCallback((id: string) => {
        return updateExpense(id, { paidOn: null, paidBy: null, paymentStatus: 'unpaid', paymentCurrencySnapshot: undefined });
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
        ensureExpensePaymentSnapshot,
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
