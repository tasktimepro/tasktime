import { describe, expect, it } from 'vitest';
import { planInvoiceFinalization } from './invoiceFinalization';

describe('invoice finalization', () => {
    it('does not expose an ID stored as a legacy snapshot title', () => {
        const legacyTaskId = '343160a3-867c-4924-b6d7-f8493828c40d';
        const invoice = {
            id: 'invoice-legacy',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-LEGACY',
            date: '2026-09-01',
            status: 'draft',
            subtotal: 100,
            total: 100,
            items: [],
            billingSelectionSnapshot: {
                version: 1,
                capturedAt: 1,
                invoiceCurrency: 'EUR',
                entries: [],
                tasks: [{
                    taskId: legacyTaskId,
                    title: legacyTaskId,
                    pricingMode: 'hourly',
                    quantity: 1,
                    rate: 100,
                    amount: 100,
                    quotedAmount: null,
                }],
                expenses: [],
            },
        };

        expect(() => planInvoiceFinalization({
            invoice: invoice as any,
            projects: [{ id: 'project-1', title: 'Project' }],
            clients: [{ id: 'client-1', title: 'Client' }],
            tasks: [],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError(expect.objectContaining({
            message: expect.not.stringContaining(legacyTaskId),
        }));
    });

    it('reports every reduced task by name and duration without exposing internal IDs', () => {
        const invoice = {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-09-01',
            status: 'sent',
            subtotal: 100,
            total: 100,
            items: [],
            tasks: [
                {
                    id: 'internal-task-alpha',
                    title: 'Discovery workshop',
                    originalHours: 1,
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 0.5,
                    hourlyRate: 100,
                    useFlatRate: false,
                },
                {
                    id: 'internal-task-beta',
                    title: 'Implementation',
                    originalHours: 2,
                    originalTimeMs: 2 * 60 * 60 * 1000,
                    hours: 1.5,
                    hourlyRate: 100,
                    useFlatRate: false,
                },
            ],
        };

        expect(() => planInvoiceFinalization({
            invoice: invoice as any,
            projects: [{ id: 'project-1', title: 'Project' }],
            clients: [{ id: 'client-1', title: 'Client' }],
            tasks: [
                { id: 'internal-task-alpha', title: 'Discovery workshop', projectId: 'project-1', billable: true },
                { id: 'internal-task-beta', title: 'Implementation', projectId: 'project-1', billable: true },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError(expect.objectContaining({
            message: expect.stringMatching(/Discovery workshop.*30m.*1h.*Implementation.*1h 30m.*2h/),
        }));

        try {
            planInvoiceFinalization({
                invoice: invoice as any,
                projects: [{ id: 'project-1', title: 'Project' }],
                clients: [{ id: 'client-1', title: 'Client' }],
                tasks: [
                    { id: 'internal-task-alpha', title: 'Discovery workshop', projectId: 'project-1', billable: true },
                    { id: 'internal-task-beta', title: 'Implementation', projectId: 'project-1', billable: true },
                ],
                entries: [],
                expenses: [],
                finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
                createAdjustmentId: () => 'adjustment-1',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            expect(message).not.toContain('internal-task-alpha');
            expect(message).not.toContain('internal-task-beta');
        }
    });
});
