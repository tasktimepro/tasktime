import { describe, expect, it } from 'vitest';
import { getProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { buildInvoiceTaskData } from '@/components/invoice/InvoiceCalculations';

const hour = 3600000;
const start = new Date(2026, 5, 15, 9).getTime();
const project = { id: 'destination', title: 'Destination', preferredClientId: 'client', hourlyRate: 100 };
const clients = [{ id: 'client', title: 'Client' }];
const tasks = [
    { id: 'parent', title: 'Original parent', projectId: 'original', billable: true },
    { id: 'moved', title: 'Moved work', projectId: project.id, billable: true },
];
const timeEntries = tasks.map(task => ({ id: task.id, taskId: task.id, start, end: start + hour }));
const invoices = [{ id: 'legacy', date: '2026-06-20', status: 'sent', billingPeriodStart: '2026-06-01', billingPeriodEnd: '2026-06-30', tasks: [{ id: 'parent', originalTimeMs: 2 * hour, mergedSubtasks: ['moved'] }] }];

describe('billing eligibility after task moves', () => {
    it('does not rebill moved legacy work in destination project previews', () => {
        const preview = getProjectInvoicePreview(project, { clients, tasks, timeEntries, invoices });
        expect(preview.unbilledHours).toBe(0);
        expect(preview.entrySelections).toEqual([]);
    });
    it('does not rebill moved legacy work in the browser invoice task selector', () => {
        const rows = buildInvoiceTaskData({ projectForData: project, selectedProject: null, tasks, timeEntries, invoices, editableHours: {} });
        expect(rows?.find(row => row.id === 'moved')?.originalTimeMs || 0).toBe(0);
    });
});
