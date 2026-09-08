import { useCallback, useEffect, useState } from 'react';
import type * as Y from 'yjs';
import { subDays } from 'date-fns';
import { useYjs } from '@/contexts/YjsContext';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { Expense, Invoice, Task, TimeEntry } from '@/stores/yjs/types';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { resolveDashboardComparison, resolveDashboardPeriod, type DashboardRange } from '../dashboardMetrics';

const EMPTY = { tasks: [] as Task[], entries: [] as TimeEntry[], invoices: [] as Invoice[], expenses: [] as Expense[], availableYears: [] as number[] };

/** Subscribe to the required existing Yjs documents; failures never masquerade as zero totals. */
export default function useDashboardHistory(range: DashboardRange, todayStr: string) {
    const { store, isReady } = useYjs();
    const { startDate, endDate } = range;
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ ...EMPTY, key: '', owner: store, loading: true, error: null as string | null });
    const key = `${range.startDate}/${range.endDate}/${todayStr}/${attempt}`;
    const retry = useCallback(() => setAttempt(value => value + 1), []);

    useEffect(() => {
        if (!isReady) return;
        let cancelled = false;
        const maps = { tasks: [store.tasks], invoices: [store.invoices], expenses: [store.expenses], entries: [store.activeTimeEntries] };
        const observed = new Set<Y.Map<string, unknown>>();
        let availableYears: number[] = [];
        let loading = true;
        let error: string | null = null;
        let loadedInvoicePeriods = '';
        const month = resolveDashboardPeriod('this-month', todayStr);
        const recentStart = toStorageDate(subDays(parseStoredDate(todayStr)!, 6))!;
        const ranges = [{ startDate, endDate }, resolveDashboardComparison({ startDate, endDate }).range, { startDate: month.startDate < recentStart ? month.startDate : recentStart, endDate: todayStr }];
        const legacyRangesFor = (invoices: Invoice[]) => invoices
            .filter(invoice => !invoice.billingSelectionSnapshot && invoice.status !== 'draft' && invoice.status !== 'canceled'
                && invoice.billingPeriodStart && invoice.billingPeriodEnd
                && ranges.some(item => invoice.billingPeriodStart! <= item.endDate && invoice.billingPeriodEnd! >= item.startDate))
            .map(invoice => ({ startDate: invoice.billingPeriodStart!, endDate: invoice.billingPeriodEnd! }))
            .sort((left, right) => `${left.startDate}/${left.endDate}`.localeCompare(`${right.startDate}/${right.endDate}`));
        const collect = <T extends { id: string }>(name: 'tasks' | 'invoices' | 'expenses' | 'timeEntries', sources: Y.Map<string, unknown>[]): T[] => {
            const records = new Map<string, T>();
            sources.forEach(source => collectValidatedEntities<T>(name, source, `dashboard ${name}`).forEach(record => {
                if (!records.has(record.id)) records.set(record.id, record);
            }));
            return [...records.values()];
        };
        const refresh = () => {
            if (cancelled) return;
            const invoices = collect<Invoice>('invoices', maps.invoices);
            // A legacy invoice arriving through sync can require additional source
            // years. Hide incomplete totals and rediscover history before publishing.
            if (!loading && !error && loadedInvoicePeriods !== JSON.stringify(legacyRangesFor(invoices))) {
                loading = true;
                setAttempt(value => value + 1);
                return;
            }
            const expenses = collect<Expense>('expenses', maps.expenses);
            const recordYears = [
                ...invoices.flatMap(invoice => [invoice.date, typeof invoice.paidAt === 'number' ? toStorageDate(new Date(invoice.paidAt)) : null]),
                ...expenses.map(expense => expense.date),
            ].filter(Boolean).map(date => Number(date!.slice(0, 4)));
            setState({ key, owner: store, loading, error, availableYears: [...new Set([...availableYears, ...recordYears])],
                tasks: collect<Task>('tasks', maps.tasks), entries: collect<TimeEntry>('timeEntries', maps.entries),
                invoices, expenses,
            });
        };
        const observe = () => {
            Object.values(maps).flat().forEach(map => {
                if (!observed.has(map)) { map.observeDeep(refresh); observed.add(map); }
            });
        };
        observe();
        refresh();
        const load = async () => {
            try {
                // Existing store loaders preserve provider mode, offline behavior and archive reconciliation.
                const [tasks, invoices, expenses, years] = await Promise.all([
                    store.loadArchivedTasks(), store.loadArchivedInvoices(), store.loadArchivedExpenses(), store.getAvailableYears(),
                ]);
                if (cancelled) return;
                maps.tasks.push(tasks); maps.invoices.push(invoices); maps.expenses.push(expenses);
                availableYears = years;
                // Legacy invoice matching requires its complete source interval, even across year boundaries.
                const legacyRanges = legacyRangesFor(collect<Invoice>('invoices', maps.invoices));
                loadedInvoicePeriods = JSON.stringify(legacyRanges);
                const required = years.filter(year => [...ranges, ...legacyRanges].some(item => year >= Number(item.startDate.slice(0, 4)) && year <= Number(item.endDate.slice(0, 4))));
                const entryMaps = await Promise.all(required.map(year => store.loadEntriesForYear(year)));
                if (cancelled) return;
                maps.entries.push(...entryMaps);
                observe();
                loading = false;
                refresh();
            } catch {
                if (cancelled) return;
                loading = false;
                error = 'Unable to load dashboard history.';
                refresh();
            }
        };
        void load();
        return () => {
            cancelled = true;
            observed.forEach(map => map.unobserveDeep(refresh));
        };
    }, [store, isReady, key, startDate, endDate, todayStr]);

    const current = state.key === key && state.owner === store;
    return { ...(current ? state : EMPTY), isLoading: !isReady || !current || state.loading, error: current ? state.error : null, retry };
}
