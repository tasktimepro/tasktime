import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/stores/yjs/types';
import {
    buildDraftInvoiceItems,
    buildDraftInvoiceUpdates,
    InvoiceDraftValidationError,
    normalizeDraftInvoiceItems,
} from './invoiceDraft';

describe('invoiceDraft', () => {
    it('builds draft invoice items from task and expense preview totals', () => {
        const items = buildDraftInvoiceItems(
            { id: 'project-1', title: 'Website Refresh', flatRate: false },
            {
                currency: 'USD',
                total: 540,
                taskAmount: 480,
                expenseAmount: 60,
                unbilledHours: 4,
                unpricedHours: 0,
                selectedExpenseCount: 1,
                excludedExpenseCount: 0,
            }
        );

        expect(items).toEqual([
            {
                description: 'Website Refresh work',
                quantity: 4,
                rate: 120,
                amount: 480,
                projectId: 'project-1',
                lineType: 'project-subtotal',
                pricingMode: 'hourly',
            },
            {
                description: 'Website Refresh billable expenses',
                quantity: 1,
                rate: 60,
                amount: 60,
                projectId: 'project-1',
                lineType: 'expense',
            },
        ]);
    });

    it('normalizes draft invoice items and rejects invalid item payloads', () => {
        expect(normalizeDraftInvoiceItems([{
            description: 'Design',
            quantity: '2',
            rate: '75',
            amount: '150',
        }])).toEqual([{
            description: 'Design',
            quantity: 2,
            rate: 75,
            amount: 150,
        }]);

        expect(() => normalizeDraftInvoiceItems([{ description: '', quantity: 1, rate: 1, amount: 1 }]))
            .toThrow(InvoiceDraftValidationError);
    });

    it('recalculates subtotal and total when draft items change', () => {
        const existing = {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-06-01',
            status: 'draft',
            items: [],
            subtotal: 50,
            taxRate: 20,
            tax: 10,
            total: 60,
        } satisfies Invoice;

        const updates = buildDraftInvoiceUpdates(existing, {
            items: [
                { description: 'Build', quantity: 2, rate: 100, amount: 200 },
            ],
            discount: 25,
            shipping: 5,
        }, 1234);

        expect(updates).toEqual(expect.objectContaining({
            subtotal: 200,
            tax: 10,
            total: 190,
            updatedAt: 1234,
        }));
    });

    it('deduplicates project IDs and reports invalid project ID payloads', () => {
        const existing = {
            id: 'invoice-1',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-06-01',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
        } satisfies Invoice;

        expect(buildDraftInvoiceUpdates(existing, {
            projectIds: ['project-1', 'project-2', 'project-1'],
        }, 99).projectIds).toEqual(['project-1', 'project-2']);

        expect(() => buildDraftInvoiceUpdates(existing, {
            projectIds: 'project-1',
        }, 99)).toThrow(InvoiceDraftValidationError);
    });
});
