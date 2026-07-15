import { describe, expect, it } from 'vitest';
import type { Invoice, Task, TimeEntry } from '@/stores/yjs/types';
import {
    collectLegacyBilledTimeEntryIds,
    getInvoiceEligibleTimeEntries,
} from './invoiceEligibility';

const task: Task = {
    id: 'task-1',
    projectId: 'project-1',
    title: 'Synthetic work',
    billable: true,
    lastBilledAt: 10_000,
};

const legacyInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
    id: 'invoice-legacy',
    projectId: 'project-1',
    clientId: 'client-1',
    invoiceNumber: 'SYN-001',
    date: '2026-05-02',
    status: 'paid',
    items: [],
    subtotal: 200,
    total: 200,
    billingPeriodStart: '2026-05-01',
    billingPeriodEnd: '2026-05-31',
    createdAt: 20_000,
    tasks: [{
        id: 'task-1',
        originalHours: 2,
        originalTimeMs: 2 * 60 * 60 * 1000,
    }],
    ...overrides,
} as Invoice);

describe('invoiceEligibility', () => {
    it('recovers markerless legacy billing only when the invoice duration matches exactly', () => {
        const entries: TimeEntry[] = [
            {
                id: 'entry-linked',
                taskId: 'task-1',
                start: new Date(2026, 4, 1, 9).getTime(),
                end: new Date(2026, 4, 1, 10).getTime(),
                billedInvoiceId: 'invoice-legacy',
            },
            {
                id: 'entry-markerless',
                taskId: 'task-1',
                start: new Date(2026, 4, 1, 10).getTime(),
                end: new Date(2026, 4, 1, 11).getTime(),
                createdAt: 15_000,
            },
        ];

        expect(collectLegacyBilledTimeEntryIds({
            tasks: [task],
            timeEntries: entries,
            invoices: [legacyInvoice()],
        })).toEqual(new Set(['entry-markerless']));
        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: entries,
            invoices: [legacyInvoice()],
        })).toEqual([]);
    });

    it('leaves ambiguous markerless duration eligible', () => {
        const entry: TimeEntry = {
            id: 'entry-ambiguous',
            taskId: 'task-1',
            start: new Date(2026, 4, 1, 9).getTime(),
            end: new Date(2026, 4, 1, 12).getTime(),
            createdAt: 15_000,
        };

        expect(collectLegacyBilledTimeEntryIds({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice()],
        })).toEqual(new Set());
        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice()],
        }).map((candidate) => candidate.id)).toEqual(['entry-ambiguous']);
    });

    it('keeps work created after the legacy invoice eligible even when it is backdated', () => {
        const entry: TimeEntry = {
            id: 'entry-late',
            taskId: 'task-1',
            start: new Date(2026, 4, 1, 9).getTime(),
            end: new Date(2026, 4, 1, 11).getTime(),
            createdAt: 30_000,
        };

        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice()],
        }).map((candidate) => candidate.id)).toEqual(['entry-late']);
    });

    it('does not infer legacy allocations from drafts or modern selection snapshots', () => {
        const entry: TimeEntry = {
            id: 'entry-unbilled',
            taskId: 'task-1',
            start: new Date(2026, 4, 1, 9).getTime(),
            end: new Date(2026, 4, 1, 11).getTime(),
            createdAt: 15_000,
        };

        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice({ status: 'draft' })],
        }).map((candidate) => candidate.id)).toEqual(['entry-unbilled']);
        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice({
                billingSelectionSnapshot: {
                    version: 1,
                    capturedAt: 1,
                    invoiceCurrency: 'CHF',
                    entries: [],
                    tasks: [],
                    expenses: [],
                },
            })],
        }).map((candidate) => candidate.id)).toEqual(['entry-unbilled']);
        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice({ billingPeriodEnd: undefined })],
        }).map((candidate) => candidate.id)).toEqual(['entry-unbilled']);
    });

    it('does not treat a canceled legacy invoice as active billing evidence', () => {
        const entry: TimeEntry = {
            id: 'entry-canceled-legacy',
            taskId: 'task-1',
            start: new Date(2026, 4, 1, 9).getTime(),
            end: new Date(2026, 4, 1, 11).getTime(),
            createdAt: 15_000,
        };

        expect(collectLegacyBilledTimeEntryIds({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice({
                status: 'canceled',
                canceledAt: 30_000,
                cancellationReason: 'Duplicate invoice',
            })],
        })).toEqual(new Set());
        expect(getInvoiceEligibleTimeEntries({
            tasks: [task],
            timeEntries: [entry],
            invoices: [legacyInvoice({
                status: 'canceled',
                canceledAt: 30_000,
                cancellationReason: 'Duplicate invoice',
            })],
        }).map((candidate) => candidate.id)).toEqual(['entry-canceled-legacy']);
    });
});
