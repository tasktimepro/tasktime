import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import type { YjsStore } from './YjsStore';
import { deleteWorkspaceRecords } from './workspaceDeletion';

function fixture() {
    const docs = new Map<string, Y.Doc>();
    const loaded = new Set(['core', 'entries-active']);
    const doc = (name: string) => {
        if (!docs.has(name)) docs.set(name, new Y.Doc());
        return docs.get(name)!;
    };
    const map = (name: string, collection: string) => doc(name).getMap<any>(collection);
    const load = async (name: string, collection: string) => {
        loaded.add(name);
        return map(name, collection);
    };
    const store = {
        coreDoc: doc('core'),
        projects: map('core', 'projects'), clients: map('core', 'clients'), tasks: map('core', 'tasks'),
        timers: map('core', 'timers'), invoices: map('core', 'invoices'), expenses: map('core', 'expenses'),
        expenseRecurrences: map('core', 'expenseRecurrences'), plannerAttachments: map('core', 'plannerAttachments'),
        invoiceBillingOperations: map('core', 'invoiceBillingOperations'),
        get archivedTasks() { return loaded.has('tasks-archived') ? map('tasks-archived', 'tasks') : null; },
        get archivedInvoicesSync() { return loaded.has('invoices-archived') ? map('invoices-archived', 'invoices') : null; },
        get archivedExpenses() { return loaded.has('expenses-archived') ? map('expenses-archived', 'expenses') : null; },
        loadArchivedTasks: () => load('tasks-archived', 'tasks'),
        loadArchivedInvoices: () => load('invoices-archived', 'invoices'),
        loadArchivedExpenses: () => load('expenses-archived', 'expenses'),
        loadAllTimeEntries: async () => { for (const name of docs.keys()) if (name.startsWith('entries-')) loaded.add(name); },
        getAllTimeEntries: () => [...loaded].filter(name => name.startsWith('entries-')).flatMap(name => [...map(name, 'timeEntries').values()]),
        getLoadedDocuments: () => [...loaded].map(doc),
        flushPersistence: vi.fn(async () => {}),
        assertWorkspaceDeletionReady: vi.fn(),
    } as unknown as YjsStore;
    store.clients.set('c', { id: 'c', title: 'Client' } as any);
    store.projects.set('p', { id: 'p', title: 'Project', preferredClientId: 'c', hourlyRate: 120 } as any);
    store.tasks.set('parent', { id: 'parent', title: 'Parent', projectId: 'p' } as any);
    map('tasks-archived', 'tasks').set('child', { id: 'child', title: 'Child', parentTaskId: 'parent', projectId: 'p', archived: true });
    map('entries-active', 'timeEntries').set('current', { id: 'current', taskId: 'parent', start: 1, end: 60001 });
    map('entries-2024', 'timeEntries').set('history', { id: 'history', taskId: 'child', start: 1, end: 3600001 });
    map('entries-2024', 'timeEntries').set('unrelated', { id: 'unrelated', taskId: 'other', start: 1, end: 12346 });
    store.tasks.set('other', { id: 'other', title: 'Unrelated' } as any);
    store.timers.set('p', { projectId: 'p', taskId: 'child', timerInstanceId: 'timer', startTime: 1 } as any);
    const snapshot = () => JSON.stringify([...docs].map(([name, item]) => [name, item.toJSON()]));
    return { store, map, snapshot };
}

const invoice = { id: 'invoice', projectId: 'p', clientId: 'c', invoiceNumber: 'INV-1', date: '2024-01-01', status: 'paid', items: [], subtotal: 100, total: 100 };
const expense = { id: 'expense', title: 'Expense', date: '2024-01-01', currency: 'EUR', amount: 25, paymentStatus: 'paid', projectId: 'p', isPersonal: false, billable: false, billingStatus: 'unbilled', isRecurring: false, isTaxExempt: false };

describe('workspace deletion durability', () => {
    it('refuses to plan from unpulled cloud history without mutating local records', async () => {
        const { store, map } = fixture();
        vi.mocked(store.assertWorkspaceDeletionReady).mockImplementation(() => { throw new Error('Use Sync Now'); });
        await expect(deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' })).rejects.toThrow('Use Sync Now');
        expect(store.tasks.has('parent')).toBe(true);
        expect(map('entries-2024', 'timeEntries').has('history')).toBe(true);
    });

    it('does not discard malformed stored dependencies while planning a delete', async () => {
        const { store, map } = fixture();
        map('entries-2024', 'timeEntries').set('malformed', { id: 'malformed', taskId: 'parent', start: 5, end: 1 });
        await expect(deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' })).rejects.toThrow('could not be read');
        expect(store.tasks.has('parent')).toBe(true);
        expect(map('entries-active', 'timeEntries').has('current')).toBe(true);
    });

    it('requires the caller to approve the complete current scope before mutations', async () => {
        const { store, map } = fixture();
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p' }, { validate: () => { throw new Error('Scope changed'); } })).rejects.toThrow('Scope changed');
        expect(map('entries-active', 'timeEntries').has('current')).toBe(true);
        expect(store.tasks.has('parent')).toBe(true);
    });

    it('checks a strict caller billing policy again when an invoice arrives during deletion', async () => {
        const { store, map } = fixture();
        await expect(deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' }, {
            validateRemaining: plan => { if (!plan.canCascadeDeleteSafely) throw new Error('Billing changed'); },
            onPhase: phase => {
                if (phase === 'dependents') map('invoices-archived', 'invoices').set('invoice', { ...invoice, items: [{ taskId: 'parent', description: 'Work', quantity: 1, rate: 100, amount: 100 }] });
            },
        })).rejects.toThrow('Billing changed');
        expect(store.tasks.has('parent')).toBe(true);
        expect(store.archivedInvoicesSync!.has('invoice')).toBe(true);
    });

    it('blocks shared invoices even when force deletion was requested', async () => {
        const { store, map } = fixture();
        map('invoices-archived', 'invoices').set('invoice', { ...invoice, projectIds: ['p', 'other'] });
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p', includeInvoiceDeletion: true })).rejects.toThrow('Shared invoices');
        expect(map('entries-active', 'timeEntries').has('current')).toBe(true);
    });

    it('does not delete an invoice still claiming time on a task moved outside the cascade', async () => {
        const { store, map } = fixture();
        map('invoices-archived', 'invoices').set('invoice', invoice);
        map('entries-2024', 'timeEntries').set('unrelated', { id: 'unrelated', taskId: 'other', start: 1, end: 2, billedInvoiceId: 'invoice' });
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p', includeInvoiceDeletion: true })).rejects.toThrow('outside this deletion');
        expect(store.archivedInvoicesSync!.has('invoice')).toBe(true);
        expect(map('entries-active', 'timeEntries').has('current')).toBe(true);
    });

    it.each(['task', 'project', 'client'] as const)('deletes the full %s scope across lazy history and preserves unrelated time', async kind => {
        const { store, map } = fixture();
        // A partially archived duplicate must also be removed.
        map('entries-active', 'timeEntries').set('history', map('entries-2024', 'timeEntries').get('history'));
        await deleteWorkspaceRecords(store, { kind, id: kind === 'task' ? 'parent' : kind === 'project' ? 'p' : 'c', alsoDeleteProjects: true });
        expect(map('entries-active', 'timeEntries').size).toBe(0);
        expect([...map('entries-2024', 'timeEntries').keys()]).toEqual(['unrelated']);
        expect([...store.tasks.keys()]).toEqual(['other']);
        expect(store.archivedTasks!.size).toBe(0);
        expect(store.timers.size).toBe(0);
        expect(store.projects.has('p')).toBe(kind === 'task');
        expect(store.clients.has('c')).toBe(kind !== 'client');
    });

    it.each(['dependents', 'invoices', 'tasks'])('can retry after interruption at %s without orphaning remaining work', async phase => {
        const { store, map } = fixture();
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p' }, { onPhase: reached => {
            if (reached === phase) throw new Error('Interrupted');
        } })).rejects.toThrow('Interrupted');
        expect(store.projects.has('p')).toBe(true);
        for (const entry of store.getAllTimeEntries()) expect(store.tasks.has(entry.taskId) || store.archivedTasks!.has(entry.taskId)).toBe(true);
        await deleteWorkspaceRecords(store, { kind: 'project', id: 'p' });
        expect(store.projects.has('p')).toBe(false);
        expect(map('entries-2024', 'timeEntries').has('history')).toBe(false);
    });

    it('keeps parents when persistence fails and reports failure', async () => {
        const { store } = fixture();
        vi.mocked(store.flushPersistence).mockRejectedValueOnce(new Error('Storage unavailable'));
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p' })).rejects.toThrow('Storage unavailable');
        expect(store.tasks.has('parent')).toBe(true);
        expect(store.projects.has('p')).toBe(true);
    });

    it('retains the task if dependent deletions could not be persisted', async () => {
        const { store } = fixture();
        vi.mocked(store.flushPersistence).mockResolvedValueOnce().mockRejectedValueOnce(new Error('Disk full'));
        await expect(deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' })).rejects.toThrow('Disk full');
        expect(store.tasks.has('parent')).toBe(true);
        expect(store.archivedTasks!.has('child')).toBe(true);
    });

    it.each(['invoice', 'tax', 'pending'])('preflights the %s guard before removing any dependent', async guard => {
        const { store, map, snapshot } = fixture();
        if (guard === 'invoice') map('invoices-archived', 'invoices').set('invoice', invoice);
        if (guard === 'tax') map('expenses-archived', 'expenses').set('expense', { ...expense, taxClaimStatus: 'claimed', taxClaimPeriodId: 'period' });
        if (guard === 'pending') store.invoiceBillingOperations.set('op', { state: 'prepared' } as any);
        // Load empty maps before snapshotting so only product mutations are compared.
        await store.loadArchivedTasks(); await store.loadArchivedInvoices(); await store.loadArchivedExpenses();
        const before = snapshot();
        await expect(deleteWorkspaceRecords(store, { kind: 'project', id: 'p' })).rejects.toThrow();
        expect(snapshot()).toBe(before);
    });

    it('deletes an explicitly selected archived invoice without changing other invoice snapshots', async () => {
        const { store, map } = fixture();
        map('invoices-archived', 'invoices').set('invoice', invoice);
        const other = { ...invoice, id: 'other-invoice', projectId: 'other', clientId: 'other', total: 312.47 };
        store.invoices.set('other-invoice', other as any);
        map('expenses-archived', 'expenses').set('expense', { ...expense, invoiceId: 'invoice', billingStatus: 'billed', billedAt: 1 });
        await deleteWorkspaceRecords(store, { kind: 'project', id: 'p', includeInvoiceDeletion: true });
        expect(store.archivedInvoicesSync!.has('invoice')).toBe(false);
        expect(store.archivedExpenses!.has('expense')).toBe(false);
        expect(store.invoices.get('other-invoice')).toEqual(other);
    });

    it('preserves a finalized invoice when the user explicitly deletes its task', async () => {
        const { store, map } = fixture();
        map('invoices-archived', 'invoices').set('invoice', { ...invoice, items: [{ taskId: 'parent', description: 'Historical work', quantity: 1, rate: 100, amount: 100 }] });
        await deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' });
        expect(store.archivedInvoicesSync!.get('invoice')).toMatchObject({ total: 100, items: [{ taskId: 'parent', amount: 100 }] });
    });

    it('converts retained client projects to personal without deleting their recorded time', async () => {
        const { store, map } = fixture();
        await deleteWorkspaceRecords(store, { kind: 'client', id: 'c' });
        expect(store.clients.has('c')).toBe(false);
        expect(store.projects.toJSON().p).toMatchObject({ preferredClientId: null, hourlyRate: null, flatRate: false, isPersonal: true });
        expect(map('entries-2024', 'timeEntries').has('history')).toBe(true);
    });

    it('keeps a task when new time arrives during deletion instead of deleting unreviewed work', async () => {
        const { store, map } = fixture();
        await expect(deleteWorkspaceRecords(store, { kind: 'task', id: 'parent' }, { onPhase: phase => {
            if (phase === 'dependents') map('entries-active', 'timeEntries').set('new', { id: 'new', taskId: 'child', start: 1, end: 2 });
        } })).rejects.toThrow('Related work changed');
        expect(store.archivedTasks!.has('child')).toBe(true);
        expect(store.tasks.has('parent')).toBe(true);
        expect(map('entries-active', 'timeEntries').has('new')).toBe(true);
    });

    it('keeps a client if a new project arrives during the operation', async () => {
        const { store } = fixture();
        await expect(deleteWorkspaceRecords(store, { kind: 'client', id: 'c' }, { onPhase: phase => {
            if (phase === 'dependents') store.projects.set('new', { id: 'new', title: 'New', preferredClientId: 'c' } as any);
        } })).rejects.toThrow('Related work changed');
        expect(store.clients.has('c')).toBe(true);
        expect(store.projects.has('new')).toBe(true);
    });
});
