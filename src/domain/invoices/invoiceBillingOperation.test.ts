import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/stores/yjs/types';
import {
    createInvoiceCancellationOperation,
    isInvoiceBillingOperation,
} from './invoiceBillingOperation';

describe('invoice billing cancellation operation', () => {
    it('creates and accepts a version-1 cancellation journal variant', () => {
        const invoice = {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-41',
            date: '2026-07-14',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
        } as Invoice;
        const desiredInvoice = {
            ...invoice,
            status: 'canceled',
            canceledAt: 1_000,
            cancellationReason: 'Duplicate invoice',
            updatedAt: 1_000,
        } as Invoice;
        const application = {
            entriesToDelete: [],
            entriesToClear: [],
            expenseUpdatesToUnbill: [],
            quotedTaskUpdates: [],
            taskCutoffUpdates: [],
            invoiceUpdates: {
                status: 'canceled' as const,
                canceledAt: 1_000,
                cancellationReason: 'Duplicate invoice',
                updatedAt: 1_000,
            },
            releasedTimeEntryCount: 0,
            deletedAdjustmentCount: 0,
            releasedExpenseCount: 0,
            releasedQuotedTaskCount: 0,
            restoredTaskCutoffCount: 0,
            retainedProjectLinkCount: 1,
        };

        const operation = createInvoiceCancellationOperation({
            operationId: 'cancel-1',
            invoice,
            desiredInvoice,
            application,
            createdAt: 1_000,
        });

        expect(operation).toEqual(expect.objectContaining({
            version: 1,
            operationId: 'cancel-1',
            invoiceId: 'invoice-1',
            kind: 'cancel',
            state: 'prepared',
            lastCompletedPhase: 'prepared',
            invoice,
            desiredInvoice,
            application,
        }));
        expect(isInvoiceBillingOperation(operation)).toBe(true);
        expect(isInvoiceBillingOperation({
            ...operation,
            desiredInvoice: { ...desiredInvoice, id: 'other' },
        })).toBe(false);
        expect(isInvoiceBillingOperation({
            ...operation,
            application: {
                ...application,
                invoiceUpdates: {
                    ...application.invoiceUpdates,
                    total: 0,
                },
            },
        })).toBe(false);
        expect(isInvoiceBillingOperation({
            ...operation,
            desiredInvoice: {
                ...desiredInvoice,
                total: 0,
            },
        })).toBe(false);
        expect(isInvoiceBillingOperation({
            ...operation,
            application: {
                ...application,
                entriesToClear: [{
                    entry: {
                        id: 'entry-1',
                        taskId: 'task-1',
                        start: 1,
                        end: 2,
                        billedInvoiceId: invoice.id,
                    },
                    updates: {
                        billedAt: null,
                        billedHourlyRate: null,
                        billedInvoiceId: null,
                        updatedAt: 1_000,
                        note: 'Unexpected journal mutation',
                    },
                }],
            },
        })).toBe(false);
    });
});
