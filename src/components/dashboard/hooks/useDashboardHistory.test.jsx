import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import useDashboardHistory from './useDashboardHistory';

const context = vi.hoisted(() => ({ value: null }));
vi.mock('@/contexts/YjsContext', () => ({ useYjs: () => context.value }));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const map = () => new Y.Doc().getMap('data');

describe('dashboard history', () => {
    let store;
    let archives;
    beforeEach(() => {
        archives = { tasks: map(), invoices: map(), expenses: map(), entries: map() };
        store = {
            tasks: map(), invoices: map(), expenses: map(), activeTimeEntries: map(),
            loadArchivedTasks: vi.fn(async () => archives.tasks),
            loadArchivedInvoices: vi.fn(async () => archives.invoices),
            loadArchivedExpenses: vi.fn(async () => archives.expenses),
            getAvailableYears: vi.fn(async () => [2024, 2025, 2026]),
            loadEntriesForYear: vi.fn(async () => archives.entries),
        };
        context.value = { store, isReady: true };
    });

    it('loads only relevant years, includes archived records, deduplicates active records, and observes edits', async () => {
        archives.tasks.set('t', { id: 't', title: 'Old', billable: true });
        store.tasks.set('t', { id: 't', title: 'Current', billable: false });
        archives.entries.set('entry', { id: 'entry', taskId: 't', start: 1, end: 1001 });
        const { result, unmount } = renderHook(() => useDashboardHistory({ startDate: '2025-12-01', endDate: '2025-12-31' }, '2026-01-05'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(store.loadEntriesForYear.mock.calls.map(call => call[0]).sort()).toEqual([2025, 2026]);
        expect(result.current.tasks).toEqual([{ id: 't', title: 'Current', billable: false }]);
        expect(result.current.entries).toHaveLength(1);
        act(() => archives.entries.set('next', { id: 'next', taskId: 't', start: 1001, end: 2001 }));
        expect(result.current.entries).toHaveLength(2);
        const unobserve = vi.spyOn(archives.entries, 'unobserveDeep');
        unmount();
        expect(unobserve).toHaveBeenCalled();
    });

    it('hides stale results during period changes, ignores stale requests, and offers retry on failure', async () => {
        const pending = deferred();
        store.loadEntriesForYear.mockImplementation(year => year === 2024 ? pending.promise : Promise.resolve(archives.entries));
        const { result, rerender } = renderHook(({ year }) => useDashboardHistory({ startDate: `${year}-01-01`, endDate: `${year}-01-31` }, '2026-09-08'), { initialProps: { year: 2024 } });
        await waitFor(() => expect(store.loadEntriesForYear).toHaveBeenCalledWith(2024));
        rerender({ year: 2026 });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        act(() => pending.resolve(map()));
        expect(result.current.error).toBeNull();
        store.loadEntriesForYear.mockRejectedValue(new Error('local read failed'));
        rerender({ year: 2024 });
        await waitFor(() => expect(result.current.error).toBe('Unable to load dashboard history.'));
        store.loadEntriesForYear.mockResolvedValue(archives.entries);
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toBeNull();
    });

    it('loads the prior calendar month across an archive-year boundary for report comparisons', async () => {
        const { result } = renderHook(() => useDashboardHistory({ startDate: '2025-01-01', endDate: '2025-01-31' }, '2026-09-08'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(store.loadEntriesForYear.mock.calls.map(call => call[0]).sort()).toEqual([2024, 2025, 2026]);
    });

    it('loads complete legacy billing intervals when invoices arrive after the first history read', async () => {
        const { result } = renderHook(() => useDashboardHistory({ startDate: '2026-01-01', endDate: '2026-01-31' }, '2026-01-15'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(store.loadEntriesForYear).not.toHaveBeenCalledWith(2024);
        act(() => archives.invoices.set('legacy', {
            id: 'legacy', date: '2026-01-10', status: 'sent', total: 100, subtotal: 100, currency: 'EUR', clientId: 'c', invoiceNumber: '1', items: [],
            billingPeriodStart: '2024-12-01', billingPeriodEnd: '2026-01-10', tasks: [],
        }));
        await waitFor(() => expect(store.loadEntriesForYear).toHaveBeenCalledWith(2024));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.invoices).toHaveLength(1);
        expect(store.loadEntriesForYear).toHaveBeenCalledWith(2025);
    });

    it('waits for the store and discovers expense-only historical years', async () => {
        context.value.isReady = false;
        archives.expenses.set('old', { id: 'old', title: 'Old expense', amount: 10, currency: 'EUR', date: '2020-02-01', paymentStatus: 'paid', isPersonal: true, billable: false });
        const { result, rerender } = renderHook(() => useDashboardHistory({ startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-09-08'));
        expect(result.current.isLoading).toBe(true);
        expect(store.loadArchivedTasks).not.toHaveBeenCalled();
        context.value.isReady = true;
        rerender();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.availableYears).toContain(2020);
    });
});
