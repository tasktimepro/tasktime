import { describe, expect, it } from 'vitest';
import {
    buildClearedBilledTimeEntryUpdates,
    buildInvoiceTemplateSequenceRollbackUpdates,
    buildProjectInvoiceUnlinkUpdates,
    buildReleasedQuotedTaskUpdates,
    buildRestoredTaskBillingCutoffUpdates,
    buildUnbilledExpenseUpdates,
} from './invoiceUndoApplication';

describe('invoice undo application builders', () => {
    it('builds billed-entry, expense, task cutoff, and sequence rollback updates', () => {
        expect(buildClearedBilledTimeEntryUpdates({ updatedAt: 100 })).toEqual({
            billedAt: null,
            billedHourlyRate: null,
            billedInvoiceId: null,
            updatedAt: 100,
        });

        expect(buildUnbilledExpenseUpdates({ updatedAt: 100 })).toEqual({
            billingStatus: 'unbilled',
            invoiceId: null,
            billedAt: null,
            updatedAt: 100,
        });

        expect(buildRestoredTaskBillingCutoffUpdates({
            restoredCutoff: 50,
            updatedAt: 100,
        })).toEqual({
            lastBilledAt: 50,
            updatedAt: 100,
        });

        expect(buildInvoiceTemplateSequenceRollbackUpdates({
            currentSequentialNumber: 7,
            updatedAt: 100,
        })).toEqual({
            currentSequentialNumber: 7,
            updatedAt: 100,
        });
    });

    it('builds quoted flat amount release updates using the stored claim total when needed', () => {
        expect(buildReleasedQuotedTaskUpdates({
            task: {
                id: 'task-1',
                title: 'Quoted task',
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: 'invoice-1',
                    billedAt: 90,
                    total: 500,
                },
            },
            updatedAt: 100,
        })).toEqual({
            estimatedFlatAmount: 500,
            quotedAmountBilling: null,
            updatedAt: 100,
        });
    });

    it('builds project invoice unlink updates without touching unrelated projects', () => {
        expect(buildProjectInvoiceUnlinkUpdates({
            project: {
                id: 'project-1',
                title: 'Project',
                invoiceIds: ['invoice-1', 'invoice-2'],
            },
            invoiceId: 'invoice-1',
            updatedAt: 100,
        })).toEqual({
            invoiceIds: ['invoice-2'],
            updatedAt: 100,
        });

        expect(buildProjectInvoiceUnlinkUpdates({
            project: {
                id: 'project-1',
                title: 'Project',
                invoiceIds: ['invoice-2'],
            },
            invoiceId: 'invoice-1',
            updatedAt: 100,
        })).toBeNull();
    });
});
