import { describe, expect, it } from 'vitest';
import { buildProjectQuoteLineItems, buildQuoteDocumentData, getQuoteDownloadFilename } from './quoteUtils';
import { buildProjectQuoteLineItems, buildQuoteDocumentData, getQuoteDownloadFilename, getQuoteNumberTimestamp } from './quoteUtils';

describe('quoteUtils', () => {
    it('builds hourly quote document data from task estimates', () => {
        const quote = buildQuoteDocumentData({
            project: {
                id: 'project-1',
                title: 'Website Refresh',
                preferredClientId: 'client-1',
                hourlyRate: 120,
                flatRate: false,
            },
            tasks: [
                { id: 'task-1', title: 'Discovery', projectId: 'project-1', estimatedHours: 3 },
                { id: 'task-2', title: 'Build', projectId: 'project-1', estimatedHours: 5 },
            ],
            clients: [{ id: 'client-1', title: 'Acme', clientName: 'Acme Ltd', defaultCurrency: 'USD' }],
            businessInfos: [{ id: 'business-1', title: 'TaskTime Studio', isDefault: true }],
            quoteDate: '2026-05-29',
            quoteTimestamp: '29112233',
        });

        expect(quote).toEqual(expect.objectContaining({
            documentMode: 'quote',
            invoiceNumber: '29112233',
            total: 960,
            subtotal: 960,
            totalHours: 8,
            currency: 'USD',
        }));
        expect(quote.tasks).toEqual([
            expect.objectContaining({ title: 'Discovery', hours: 3, hourlyRate: 120 }),
            expect.objectContaining({ title: 'Build', hours: 5, hourlyRate: 120 }),
        ]);
    });

    it('falls back to project budget when no task estimate amount exists', () => {
        const quote = buildQuoteDocumentData({
            project: {
                id: 'project-1',
                title: 'Brand Sprint',
                preferredClientId: 'client-1',
                flatRate: true,
                budgetAmount: 1800,
            },
            tasks: [{ id: 'task-1', title: 'Planning', projectId: 'project-1', estimatedHours: 6 }],
            clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }],
            businessInfos: [{ id: 'business-1', title: 'TaskTime Studio', isDefault: true }],
            quoteDate: '2026-05-29',
            quoteTimestamp: '29112233',
        });

        expect(quote.tasks).toEqual([]);
        expect(quote.additionalTasks).toEqual([
            expect.objectContaining({ title: 'Project budget / target', flatRate: 1800 }),
        ]);
        expect(quote.total).toBe(1800);
    });

    it('preserves original hours for quote line items used by the shared modal', () => {
        const lineItems = buildProjectQuoteLineItems({
            project: {
                id: 'project-1',
                title: 'Website Refresh',
                preferredClientId: 'client-1',
                hourlyRate: 120,
                flatRate: false,
            },
            tasks: [
                { id: 'task-1', title: 'Discovery', projectId: 'project-1', estimatedHours: 3 },
            ],
            clients: [{ id: 'client-1', title: 'Acme', clientName: 'Acme Ltd', defaultCurrency: 'USD' }],
        });

        expect(lineItems.quoteTasks).toEqual([
            expect.objectContaining({
                id: 'task-1',
                title: 'Discovery',
                originalHours: 3,
                hours: 3,
                hourlyRate: 120,
            }),
        ]);
    });

    it('builds a deterministic quote filename', () => {
        expect(getQuoteDownloadFilename('Website Refresh', '2026-05-29')).toBe('website-refresh-quote-2026-05-29.pdf');
    });

    it('builds a compact quote timestamp identifier', () => {
        expect(getQuoteNumberTimestamp(new Date('2026-05-29T11:22:33'))).toBe('29112233');
    });
});