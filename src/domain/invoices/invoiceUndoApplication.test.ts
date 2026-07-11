import { describe, expect, it } from 'vitest';
import {
    buildClearedBilledTimeEntryUpdates,
    buildInvoiceUndoApplicationPlan,
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

    it('builds a complete undo application plan from the pure undo plan', () => {
        const billedEntry = {
            id: 'entry-1',
            taskId: 'task-1',
            start: 10,
            end: 20,
            billedInvoiceId: 'invoice-1',
        } as any;
        const adjustmentEntry = {
            id: 'entry-adjustment',
            taskId: 'task-1',
            source: 'invoice-adjustment',
            start: 10,
            end: 20,
            billedInvoiceId: 'invoice-1',
        } as any;
        const plan = buildInvoiceUndoApplicationPlan({
            invoiceId: 'invoice-1',
            undoPlan: {
                entriesToDelete: [adjustmentEntry],
                entriesToClear: [billedEntry],
                expenseIdsToUnbill: ['expense-1'],
                taskLastBilledAtRestorations: new Map([['task-1', 90]]),
                clearedTimeEntryCount: 1,
                deletedAdjustmentCount: 1,
            },
            expenses: [
                { id: 'expense-1', invoiceId: 'invoice-1' } as any,
                { id: 'expense-2', invoiceId: 'invoice-2' } as any,
            ],
            tasks: [
                {
                    id: 'task-1',
                    quotedAmountBilling: {
                        invoiceId: 'invoice-1',
                        billedAt: 80,
                        total: 300,
                    },
                    estimatedFlatAmount: null,
                } as any,
                {
                    id: 'task-2',
                    quotedAmountBilling: {
                        invoiceId: 'invoice-2',
                        billedAt: 80,
                        total: 300,
                    },
                } as any,
            ],
            projects: [
                { id: 'project-1', invoiceIds: ['invoice-1', 'invoice-2'] } as any,
                { id: 'project-2', invoiceIds: ['invoice-2'] } as any,
            ],
            sequenceRollback: {
                canRollback: true,
                nextSequentialNumber: 11,
            },
            templateId: 'template-1',
            undoneAt: 100,
        });

        expect(plan.entriesToDelete).toEqual([adjustmentEntry]);
        expect(plan.entriesToClear).toEqual([{
            entry: billedEntry,
            updates: {
                billedAt: null,
                billedHourlyRate: null,
                billedInvoiceId: null,
                updatedAt: 100,
            },
        }]);
        expect(plan.expenseUpdatesToUnbill).toEqual([{
            id: 'expense-1',
            updates: {
                billingStatus: 'unbilled',
                invoiceId: null,
                billedAt: null,
                updatedAt: 100,
            },
        }]);
        expect(plan.quotedTaskUpdates).toEqual([{
            id: 'task-1',
            updates: {
                estimatedFlatAmount: 300,
                quotedAmountBilling: null,
                updatedAt: 100,
            },
        }]);
        expect(plan.taskCutoffUpdates).toEqual([{
            id: 'task-1',
            expectedLastBilledAt: null,
            updates: {
                lastBilledAt: 90,
                updatedAt: 100,
            },
        }]);
        expect(plan.projectUnlinkUpdates).toEqual([{
            id: 'project-1',
            updates: {
                invoiceIds: ['invoice-2'],
                updatedAt: 100,
            },
        }]);
        expect(plan.invoiceTemplateSequenceUpdate).toEqual({
            id: 'template-1',
            updates: {
                currentSequentialNumber: 11,
                updatedAt: 100,
            },
        });
        expect(plan.clearedTimeEntryCount).toBe(1);
        expect(plan.deletedAdjustmentCount).toBe(1);
        expect(plan.unbilledExpenseCount).toBe(1);
        expect(plan.rewoundSequence).toBe(true);
    });
});
