import { describe, expect, it } from 'vitest';
import { getInvoiceDraftEditorRecord, getInvoiceDraftItems, updateDraftSelectionPricing } from './invoiceDraftDocument';

describe('saved invoice draft document compatibility', () => {
    const snapshot = {
        version: 1, capturedAt: 10, invoiceCurrency: 'EUR',
        entries: [{ entryId: 'entry', taskId: 'task', start: 10, end: 3610, actualDurationMs: 3600, billableDurationMs: 3600, billedHourlyRate: 50 }],
        tasks: [{ taskId: 'task', title: 'Design', pricingMode: 'hourly', quantity: 1, rate: 50, amount: 50, quotedAmount: null }],
        expenses: [],
    };
    const agentDraft = {
        id: 'draft', status: 'draft', notes: 'Review together', billingSelectionSnapshot: snapshot,
        items: [{ taskId: 'task', projectId: 'project', description: 'Design', quantity: 1, rate: 50, amount: 50, lineType: 'task', pricingMode: 'hourly' }],
    };

    it('opens agent task items as editable tasks with their captured source duration', () => {
        const document = getInvoiceDraftEditorRecord(agentDraft as any);
        expect(document.tasks).toEqual([expect.objectContaining({ id: 'task', title: 'Design', hours: 1, originalTimeMs: 3600, hourlyRate: 50 })]);
        expect(document.note).toBe('Review together');
        expect(document.additionalTasks).toEqual([]);
    });

    it('retains captured hourly pricing when an agent line edit omits its optional pricing mode', () => {
        const document = getInvoiceDraftEditorRecord({ ...agentDraft, items: [{ ...agentDraft.items[0], pricingMode: undefined }] } as any);
        expect(document.tasks[0]).toMatchObject({ hours: 1, useFlatRate: false });
    });

    it('converts legacy UI tasks, merged subtasks, manual tasks and expenses exactly once', () => {
        const child = { id: 'child', title: 'Detail', hours: 2, hourlyRate: 10 };
        const invoice = { tasks: [{ id: 'task', title: 'Design', hours: 1, hourlyRate: 50, mergedSubtasks: [child] }, child], additionalTasks: [{ id: 'manual', title: 'Review', useFlatRate: true, flatRate: 25, quantity: 1 }], items: [{ description: 'Travel', expenseId: 'expense', quantity: 1, rate: 5, amount: 5 }] };
        const items = getInvoiceDraftItems(invoice as any);
        expect(items.map(item => item.amount)).toEqual([50, 20, 25, 5]);
        expect(items.filter(item => item.taskId === 'child')).toHaveLength(1);
        expect(items.find(item => item.description === 'Review')?.taskId).toBeUndefined();
        expect(items.find(item => item.expenseId)?.lineType).toBe('expense');
    });

    it('updates intentional pricing without changing the saved source entry selection', () => {
        const invoice = { ...agentDraft, items: [{ ...agentDraft.items[0], rate: 60, amount: 60 }] };
        const result = updateDraftSelectionPricing(invoice as any, snapshot as any);
        expect(result.entries).toEqual([{ ...snapshot.entries[0], billedHourlyRate: 60 }]);
        expect(result.tasks[0]).toEqual({ ...snapshot.tasks[0], rate: 60, amount: 60 });
        expect(result.capturedAt).toBe(10);
        expect(updateDraftSelectionPricing({ ...invoice, items: [] } as any, snapshot as any).entries).toEqual([]);
    });

    it('retains an explicit hourly override on a flat project and includes merged work in its flat parent price', () => {
        expect(getInvoiceDraftItems({ tasks: [{ id: 'task', title: 'Hourly override', projectFlatRate: true, useFlatRate: false, hours: 2, hourlyRate: 30 }] } as any)[0].amount).toBe(60);
        const items = getInvoiceDraftItems({ tasks: [{ id: 'parent', title: 'Package', useFlatRate: true, flatRate: 100, quantity: 1, mergedSubtasks: [{ id: 'child', title: 'Included work', hours: 2, hourlyRate: 50 }] }] } as any);
        expect(items.reduce((sum, item) => sum + item.amount, 0)).toBe(100);
        expect(items.find(item => item.taskId === 'child')).toBeDefined();
    });
});
