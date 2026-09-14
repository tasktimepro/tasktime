import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { collectEntities, objectToYMap, readEntity } from './entityUtils';
import { persistInvoiceDraft, deleteInvoiceDraft, saveInvoiceDraft, finalizeSavedInvoice, refreshInvoiceDraft } from './invoiceDraftOperations';

function fixture() {
    const coreDoc = new Y.Doc();
    const store: any = { coreDoc };
    for (const name of ['invoices', 'projects', 'clients', 'tasks', 'expenses', 'invoiceTemplates', 'invoiceBillingOperations', 'activeTimeEntries', 'archivedTasks', 'archivedExpenses', 'archivedInvoicesSync']) store[name] = coreDoc.getMap(name);
    store.loadArchivedTasks = vi.fn(async () => store.archivedTasks);
    store.loadArchivedExpenses = vi.fn(async () => store.archivedExpenses);
    store.loadArchivedInvoices = vi.fn(async () => store.archivedInvoicesSync);
    store.getAllTimeEntries = () => collectEntities(store.activeTimeEntries);
    store.loadAllTimeEntries = vi.fn(async () => store.getAllTimeEntries());
    store.commitInvoiceFinalization = vi.fn(async ({ desiredInvoice }: any) => desiredInvoice);
    store.projects.set('project', objectToYMap({ id: 'project', title: 'Website', preferredClientId: 'client', hourlyRate: 50 }));
    store.clients.set('client', objectToYMap({ id: 'client', title: 'Studio' }));
    store.tasks.set('task', objectToYMap({ id: 'task', title: 'Design', projectId: 'project', billable: true }));
    const start = 1;
    store.activeTimeEntries.set('entry', objectToYMap({ id: 'entry', taskId: 'task', start, end: start + 3600000 }));
    const draft: any = { id: 'draft', projectId: 'project', projectIds: ['project'], clientId: 'client', status: 'draft', invoiceNumber: 'INV-1', date: '2026-09-14', currency: 'EUR', items: [], tasks: [{ id: 'task', title: 'Design', projectId: 'project', hours: 1, originalTimeMs: 3600000, hourlyRate: 50 }], subtotal: 50, total: 50, createdAt: 1 };
    return { store, draft, start };
}

describe('shared saved invoice draft operations', () => {
    it('keeps an explicit hourly override hourly through capture and finalization on a flat-rate project', async () => {
        const { store, draft } = fixture();
        store.tasks.set('task', objectToYMap({ id: 'task', title: 'Design', projectId: 'project', billable: true, estimatedFlatAmount: 100 }));
        const saved = await saveInvoiceDraft(store, { ...draft, tasks: [{ ...draft.tasks[0], projectFlatRate: true, useFlatRate: false }] }, null, 10);
        expect(saved.billingSelectionSnapshot?.tasks[0]).toMatchObject({ pricingMode: 'hourly', quotedAmount: null });
        await finalizeSavedInvoice(store, saved, saved, 'finalize', 20);
        expect(store.commitInvoiceFinalization.mock.calls[0][0].application.quotedTaskUpdates).toEqual([]);
        expect(store.commitInvoiceFinalization.mock.calls[0][0].application.timeEntryUpdates[0].updates.billedHourlyRate).toBe(50);
    });
    it('accepts equivalent validated records whose object keys are in a different order', () => {
        const { store, draft } = fixture();
        const saved = persistInvoiceDraft(store, draft, null, 10);
        const reordered = Object.fromEntries(Object.entries(saved).reverse());
        expect(() => deleteInvoiceDraft(store, reordered as any)).not.toThrow();
        expect(store.invoices.size).toBe(0);
    });
    it.each(['changed', 'deleted', 'billed'])('blocks a %s captured expense without billing any source', async change => {
        const { store, draft } = fixture();
        const expense = { id: 'expense', title: 'Travel', date: '2026-09-10', amount: 10, currency: 'EUR', projectId: 'project', clientId: 'client', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false };
        store.expenses.set(expense.id, objectToYMap(expense));
        const saved = await saveInvoiceDraft(store, { ...draft, subtotal: 60, total: 60, items: [{ description: 'Travel', expenseId: 'expense', quantity: 1, rate: 10, amount: 10 }] }, null, 10);
        if (change === 'deleted') store.expenses.delete(expense.id);
        else store.expenses.set(expense.id, objectToYMap({ ...expense, ...(change === 'changed' ? { amount: 20 } : { billingStatus: 'billed', invoiceId: 'other' }) }));
        await expect(finalizeSavedInvoice(store, saved, saved, 'finalize', 20)).rejects.toThrow();
        expect(store.commitInvoiceFinalization).not.toHaveBeenCalled();
        expect(readEntity(store.activeTimeEntries.get('entry'))).not.toHaveProperty('billedInvoiceId');
    });

    it('refreshes client expenses once across projects and rebuilds PDF and project groups', async () => {
        const { store, draft } = fixture();
        store.projects.set('second', objectToYMap({ id: 'second', title: 'Brand', preferredClientId: 'client', hourlyRate: 50 }));
        const saved = await saveInvoiceDraft(store, { ...draft, projectIds: ['project', 'second'], billingPeriodStart: '1970-01-01', billingPeriodEnd: '1970-01-31' }, null, 4000000);
        store.expenses.set('client-expense', objectToYMap({ id: 'client-expense', title: 'Travel', date: '1970-01-01', amount: 10, currency: 'EUR', projectId: null, clientId: 'client', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false }));
        const refreshed = await refreshInvoiceDraft(store, saved, saved, null, 8000000);
        expect(refreshed.total).toBe(60);
        expect(refreshed.billingSelectionSnapshot?.expenses).toHaveLength(1);
        expect(refreshed.expenseItems).toEqual([expect.objectContaining({ id: 'client-expense', amount: 10 })]);
        expect(refreshed.clientExpenseItems).toHaveLength(1);
        expect(refreshed.projectBreakdowns.map((project: any) => project.subtotal)).toEqual([50, 0]);
        expect(refreshed.projectBreakdowns[0].allocatedTotal).toBe(50);
    });

    it('keeps empty saved expense selections empty even when eligible expenses are added later', async () => {
        const { store, draft } = fixture();
        const saved = await saveInvoiceDraft(store, draft, null, 10);
        store.expenses.set('later', objectToYMap({ id: 'later', title: 'Travel', date: '2026-09-10', amount: 10, currency: 'EUR', projectId: 'project', clientId: 'client', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false }));
        await finalizeSavedInvoice(store, saved, saved, 'finalize', 20);
        expect(store.commitInvoiceFinalization.mock.calls[0][0].application.expenseUpdates).toEqual([]);
    });
    it('refreshes client-only expenses within the saved period and preserves manual lines', async () => {
        const { store, draft } = fixture();
        const saved = await saveInvoiceDraft(store, { ...draft, projectId: null, projectIds: [], tasks: [],
            additionalTasks: [{ id: 'manual', title: 'Handling', useFlatRate: true, flatRate: 5, quantity: 1 }],
            subtotal: 5, total: 5, billingPeriodStart: '2026-09-01', billingPeriodEnd: '2026-09-30' }, null, 10);
        const expense = { title: 'Travel', date: '2026-09-10', amount: 10, currency: 'EUR', clientId: 'client', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false };
        for (const row of [
            { ...expense, id: 'client-expense' },
            { ...expense, id: 'foreign-currency', currency: 'USD', amount: 20 },
            { ...expense, id: 'other-client', clientId: 'other' },
            { ...expense, id: 'project-expense', projectId: 'project' },
            { ...expense, id: 'outside-period', date: '2026-10-01' },
            { ...expense, id: 'already-billed', billingStatus: 'billed', invoiceId: 'issued' },
        ]) store.expenses.set(row.id, objectToYMap(row));
        await expect(refreshInvoiceDraft(store, saved, saved, null, 20)).rejects.toThrow(/exchange rates/);
        expect(readEntity(store.invoices.get(saved.id))).toEqual(saved);
        const refreshed = await refreshInvoiceDraft(store, saved, saved, { USD: 1, EUR: 0.5 }, 30);
        expect(refreshed.billingSelectionSnapshot?.expenses.map(expense => expense.expenseId)).toEqual(['client-expense', 'foreign-currency']);
        expect(refreshed.total).toBe(25);
        expect(refreshed.clientExpenseItems).toHaveLength(2);
        expect(refreshed.projectBreakdowns).toEqual([]);
        expect(refreshed.items.find(item => item.description === 'Handling')?.amount).toBe(5);
        expect(store.invoiceBillingOperations.size).toBe(0);
        await finalizeSavedInvoice(store, refreshed, refreshed, 'finalize-client', 40);
        expect(store.commitInvoiceFinalization.mock.calls[0][0].application.expenseUpdates.map((expense: any) => expense.id)).toEqual(['client-expense', 'foreign-currency']);
    });
    it('refuses an inconsistent saved total before writing any billing operation', async () => {
        const { store, draft } = fixture();
        const saved = await saveInvoiceDraft(store, { ...draft, subtotal: 100, total: 100 }, null, 10);
        await expect(finalizeSavedInvoice(store, saved, saved, 'finalize', 20)).rejects.toThrow(/subtotal/);
        expect(store.commitInvoiceFinalization).not.toHaveBeenCalled();
    });
    it('allocates automatic final numbers around archived invoices without reserving numbers on save', async () => {
        const { store, draft } = fixture();
        store.invoiceTemplates.set('template', objectToYMap({ id: 'template', name: 'Template', useSequentialNumbers: true, currentSequentialNumber: 1, sequentialNumberDigits: 3, invoiceNumberFormat: 'INV-{year}-{sequential}' }));
        store.archivedInvoicesSync.set('issued', objectToYMap({ ...draft, id: 'issued', invoiceNumber: 'INV-2026-001', status: 'sent', templateId: 'template' }));
        const saved = await saveInvoiceDraft(store, { ...draft, templateId: 'template' }, null, 10);
        expect(readEntity<any>(store.invoiceTemplates.get('template')).currentSequentialNumber).toBe(1);
        const result = await finalizeSavedInvoice(store, saved, saved, 'finalize', 20);
        expect(result.invoice.invoiceNumber).toBe('INV-2026-002');
        expect(result.application.invoiceTemplateSequenceUpdate?.updates.currentSequentialNumber).toBe(3);
    });

    it('rejects source claims held by another pending invoice operation', async () => {
        const { store, draft } = fixture();
        const saved = await saveInvoiceDraft(store, draft, null, 10);
        store.invoiceBillingOperations.set('other', objectToYMap({ kind: 'finalize', invoiceId: 'other', state: 'prepared', desiredInvoice: { invoiceNumber: 'OTHER' }, application: { timeEntryUpdates: [{ id: 'entry' }], expenseUpdates: [], quotedTaskUpdates: [] } }));
        await expect(finalizeSavedInvoice(store, saved, saved, 'finalize', 20)).rejects.toThrow(/another invoice/);
        expect(store.commitInvoiceFinalization).not.toHaveBeenCalled();
    });

    it('refreshes selected work explicitly while retaining manual items, notes and invoice adjustments', async () => {
        const { store, draft, start } = fixture();
        const saved = await saveInvoiceDraft(store, { ...draft, billingPeriodStart: '1970-01-01', billingPeriodEnd: '1970-01-31', notes: 'Month end', additionalTasks: [{ id: 'manual', title: 'Review', useFlatRate: true, flatRate: 20, quantity: 1 }], discount: 5, discountType: 'fixed', discountValue: 5, shipping: 2, taxRate: 10 }, null, 4000000);
        store.activeTimeEntries.set('later', objectToYMap({ id: 'later', taskId: 'task', start: start + 7200000, end: start + 10800000 }));
        const refreshed = await refreshInvoiceDraft(store, saved, saved, null, 12000000);
        expect(refreshed.billingSelectionSnapshot?.entries.map((entry: any) => entry.entryId)).toEqual(['entry', 'later']);
        expect(refreshed.notes).toBe('Month end');
        expect(refreshed.items.find((item: any) => item.description === 'Review')?.amount).toBe(20);
        expect(refreshed.subtotal).toBe(120);
        expect(refreshed.total).toBe(128.7);
        expect(store.invoiceBillingOperations.size).toBe(0);
    });

    it('saves the selected source snapshot without any billing effects and preserves it after later tracking', async () => {
        const { store, draft, start } = fixture();
        const saved = await saveInvoiceDraft(store, draft, null, 10);
        expect(saved.billingSelectionSnapshot?.entries.map((entry: any) => entry.entryId)).toEqual(['entry']);
        expect(readEntity(store.activeTimeEntries.get('entry'))).not.toHaveProperty('billedInvoiceId');
        expect(readEntity(store.tasks.get('task'))).not.toHaveProperty('lastBilledAt');
        expect(store.invoiceBillingOperations.size).toBe(0);
        store.activeTimeEntries.set('later', objectToYMap({ id: 'later', taskId: 'task', start: start + 7200000, end: start + 10800000 }));
        const edited = await saveInvoiceDraft(store, { ...saved, note: 'Ready' }, saved, 20);
        expect(edited.billingSelectionSnapshot?.entries).toEqual(saved.billingSelectionSnapshot?.entries);
        expect(edited.total).toBe(50);
        await finalizeSavedInvoice(store, edited, edited, 'operation', 30);
        expect(store.commitInvoiceFinalization.mock.calls[0][0].application.timeEntryUpdates.map((entry: any) => entry.id)).toEqual(['entry']);
    });

    it('rejects stale saves and deletions, including a draft being finalized', () => {
        const { store, draft } = fixture();
        const saved = persistInvoiceDraft(store, draft, null, 10);
        persistInvoiceDraft(store, { ...saved, notes: 'Newer' }, saved, 20);
        expect(() => persistInvoiceDraft(store, { ...saved, notes: 'Stale' }, saved, 30)).toThrow(/changed/);
        expect(() => deleteInvoiceDraft(store, saved)).toThrow(/changed/);
        const current: any = readEntity(store.invoices.get(saved.id));
        store.invoiceBillingOperations.set('pending', objectToYMap({ invoiceId: saved.id, state: 'prepared' }));
        expect(() => deleteInvoiceDraft(store, current)).toThrow(/billing operation/);
        store.invoiceBillingOperations.delete('pending');
        deleteInvoiceDraft(store, current);
        expect(store.invoices.size).toBe(0);
        expect(() => persistInvoiceDraft(store, saved, current, 40)).toThrow(/changed/);
    });

    it('rechecks the draft after history loads and leaves no billing operation on conflict', async () => {
        const { store, draft } = fixture();
        const saved = await saveInvoiceDraft(store, draft, null, 10);
        store.loadAllTimeEntries.mockImplementationOnce(async () => {
            store.invoices.delete(saved.id);
            return store.getAllTimeEntries();
        });
        await expect(finalizeSavedInvoice(store, saved, saved, 'operation', 30)).rejects.toThrow(/changed/);
        expect(store.commitInvoiceFinalization).not.toHaveBeenCalled();
    });
});
