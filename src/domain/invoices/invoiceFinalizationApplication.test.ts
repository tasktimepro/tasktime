import { describe, expect, it } from 'vitest';
import type { InvoiceFinalizationPlan } from './invoiceFinalization';
import {
    buildInvoiceEditApplicationPlan,
    buildInvoiceFinalizationApplicationPlan,
    buildFinalizedExpenseUpdates,
    buildFinalizedInvoiceUpdates,
    buildFinalizedQuotedTaskUpdates,
    buildFinalizedTaskCutoffUpdates,
    buildFinalizedTimeEntryUpdates,
    buildProjectInvoiceLinkUpdates,
} from './invoiceFinalizationApplication';

describe('invoice finalization application builders', () => {
    it('builds billed entry, expense, task cutoff, and quoted task update payloads', () => {
        const finalizedAt = 1000;
        const plan = {
            nextTaskCutoffs: new Map([['task-1', 900]]),
        } as Pick<InvoiceFinalizationPlan, 'nextTaskCutoffs'>;

        expect(buildFinalizedTimeEntryUpdates({
            invoiceId: 'invoice-1',
            finalizedAt,
            billedHourlyRate: 125,
        })).toEqual({
            billedAt: finalizedAt,
            billedInvoiceId: 'invoice-1',
            billedHourlyRate: 125,
            updatedAt: finalizedAt,
        });

        expect(buildFinalizedExpenseUpdates({
            invoiceId: 'invoice-1',
            finalizedAt,
        })).toEqual({
            billingStatus: 'billed',
            invoiceId: 'invoice-1',
            billedAt: finalizedAt,
            updatedAt: finalizedAt,
        });

        expect(buildFinalizedTaskCutoffUpdates({
            plan,
            taskId: 'task-1',
            finalizedAt,
        })).toEqual({
            lastBilledAt: 900,
            updatedAt: finalizedAt,
        });

        expect(buildFinalizedQuotedTaskUpdates({
            invoiceId: 'invoice-1',
            finalizedAt,
            claim: {
                taskId: 'quoted-task',
                total: 500,
            },
        })).toEqual({
            estimatedFlatAmount: null,
            quotedAmountBilling: {
                invoiceId: 'invoice-1',
                billedAt: finalizedAt,
                total: 500,
            },
            updatedAt: finalizedAt,
        });
    });

    it('builds project invoice links without duplicating existing references', () => {
        expect(buildProjectInvoiceLinkUpdates({
            project: {
                id: 'project-1',
                title: 'Project',
                invoiceIds: ['invoice-existing'],
            },
            invoiceId: 'invoice-1',
            finalizedAt: 1000,
        })).toEqual({
            invoiceIds: ['invoice-existing', 'invoice-1'],
            updatedAt: 1000,
        });

        expect(buildProjectInvoiceLinkUpdates({
            project: {
                id: 'project-1',
                title: 'Project',
                invoiceIds: ['invoice-1'],
            },
            invoiceId: 'invoice-1',
            finalizedAt: 1000,
        })).toBeNull();
    });

    it('builds finalized invoice status, billing snapshot, and finalized agent draft metadata', () => {
        expect(buildFinalizedInvoiceUpdates({
            finalizedAt: 1000,
            plan: {
                taskLastBilledAt: {
                    'task-1': null,
                    'task-2': 500,
                },
                agentDraft: {
                    finalizationState: 'draft',
                    projectId: 'project-1',
                },
            },
        })).toEqual({
            status: 'sent',
            billingStateSnapshot: {
                version: 1,
                capturedAt: 1000,
                taskLastBilledAt: {
                    'task-1': null,
                    'task-2': 500,
                },
            },
            agentDraft: {
                finalizationState: 'finalized',
                projectId: 'project-1',
                finalizedAt: 1000,
            },
            updatedAt: 1000,
        });
    });

    it('builds a complete finalization application plan from the pure finalization plan', () => {
        const finalizationPlan: InvoiceFinalizationPlan = {
            selectedTaskIds: new Set(['task-1', 'task-quoted']),
            adjustmentEntryIdsToDelete: ['adjustment-delete'],
            adjustmentEntriesToUpdate: [{
                id: 'adjustment-update',
                updates: {
                    end: 1000,
                },
            }],
            adjustmentEntriesToCreate: [{
                id: 'adjustment-create',
                entry: {
                    taskId: 'task-1',
                    start: 900,
                    end: 1000,
                    billedAt: 1000,
                    billedInvoiceId: 'invoice-1',
                },
            }],
            entriesToBill: [{
                entry: {
                    id: 'entry-1',
                    taskId: 'task-1',
                    start: 100,
                    end: 200,
                },
                billedHourlyRate: 125,
            }],
            expensesToBill: [{
                id: 'expense-1',
                title: 'Expense',
                date: '2026-06-26',
                currency: 'USD',
                amount: 10,
                paymentStatus: 'unpaid',
                isPersonal: false,
                billable: true,
                billingStatus: 'unbilled',
                isRecurring: false,
                isTaxExempt: false,
            }],
            taskLastBilledAt: {
                'task-1': null,
            },
            nextTaskCutoffs: new Map([['task-1', 200]]),
            updatedTaskIds: new Set(['task-1']),
            quotedTaskClaims: [{
                taskId: 'task-quoted',
                total: 500,
            }],
            projectIdsToLink: ['project-1', 'project-already-linked'],
            agentDraft: {
                finalizationState: 'draft',
            },
        };

        const applicationPlan = buildInvoiceFinalizationApplicationPlan({
            invoice: {
                id: 'invoice-1',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-0007',
                date: '2026-06-26',
                status: 'draft',
                items: [],
                subtotal: 0,
                total: 0,
            },
            plan: finalizationPlan,
            projects: [
                {
                    id: 'project-1',
                    title: 'Project',
                    invoiceIds: [],
                },
                {
                    id: 'project-already-linked',
                    title: 'Already linked',
                    invoiceIds: ['invoice-1'],
                },
            ],
            invoiceTemplate: {
                id: 'template-1',
                name: 'Template',
                useSequentialNumbers: true,
                currentSequentialNumber: 7,
            },
            invoices: [{
                id: 'invoice-1',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-0007',
                date: '2026-06-26',
                status: 'draft',
                items: [],
                subtotal: 0,
                total: 0,
            }],
            finalizedAt: 1000,
        });

        expect(applicationPlan.adjustmentEntryIdsToDelete).toEqual(['adjustment-delete']);
        expect(applicationPlan.adjustmentEntriesToUpdate[0]).toEqual({
            id: 'adjustment-update',
            updates: {
                end: 1000,
            },
        });
        expect(applicationPlan.adjustmentEntriesToCreate[0].id).toBe('adjustment-create');
        expect(applicationPlan.timeEntryUpdates).toEqual([
            {
                id: 'entry-1',
                updates: {
                    billedAt: 1000,
                    billedInvoiceId: 'invoice-1',
                    billedHourlyRate: 125,
                    updatedAt: 1000,
                },
            },
        ]);
        expect(applicationPlan.expenseUpdates[0]).toEqual({
            id: 'expense-1',
            updates: expect.objectContaining({
                billingStatus: 'billed',
                invoiceId: 'invoice-1',
            }),
        });
        expect(applicationPlan.taskCutoffUpdates[0]).toEqual({
            id: 'task-1',
            updates: {
                lastBilledAt: 200,
                updatedAt: 1000,
            },
        });
        expect(applicationPlan.quotedTaskUpdates[0]).toEqual({
            id: 'task-quoted',
            updates: expect.objectContaining({
                estimatedFlatAmount: null,
                quotedAmountBilling: {
                    invoiceId: 'invoice-1',
                    billedAt: 1000,
                    total: 500,
                },
            }),
        });
        expect(applicationPlan.projectLinkUpdates).toEqual([
            {
                id: 'project-1',
                updates: {
                    invoiceIds: ['invoice-1'],
                    updatedAt: 1000,
                },
            },
        ]);
        expect(applicationPlan.invoiceTemplateSequenceUpdate).toEqual({
            id: 'template-1',
            updates: {
                currentSequentialNumber: 7,
            },
        });
        expect(applicationPlan.invoiceUpdates).toEqual(expect.objectContaining({
            status: 'sent',
        }));
        expect(applicationPlan.invoiceUpdates).not.toHaveProperty('sentAt');
        expect(applicationPlan.billedEntryCount).toBe(1);
        expect(applicationPlan.billedExpenseCount).toBe(1);
        expect(applicationPlan.updatedTaskCount).toBe(1);
        expect(applicationPlan.updatedProjectInvoiceReferences).toBe(true);
        expect(applicationPlan.advancedInvoiceSequence).toBe(true);
    });

    it('builds edit application updates for invoice adjustment, expense, and quoted task changes', () => {
        const applicationPlan = buildInvoiceEditApplicationPlan({
            invoice: {
                id: 'invoice-1',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-1',
                date: '2026-06-27',
                status: 'sent',
                subtotal: 0,
                total: 0,
                items: [],
                tasks: [
                    { id: 'task-kept' },
                    { id: 'task-new-quoted' },
                ],
            } as any,
            plan: {
                adjustmentEntryIdsToDelete: ['adjustment-delete'],
                adjustmentEntriesToUpdate: [{
                    id: 'adjustment-update',
                    updates: {
                        end: 200,
                    },
                }],
                adjustmentEntriesToCreate: [{
                    id: 'adjustment-create',
                    entry: {
                        taskId: 'task-kept',
                        start: 100,
                        end: 200,
                    } as any,
                }],
                quotedTaskClaims: [{
                    taskId: 'task-new-quoted',
                    total: 400,
                }],
            },
            expenses: [
                { id: 'expense-selected', invoiceId: null } as any,
                { id: 'expense-deselected', invoiceId: 'invoice-1' } as any,
                { id: 'expense-other', invoiceId: 'invoice-2' } as any,
            ],
            tasks: [
                {
                    id: 'task-new-quoted',
                    estimatedFlatAmount: 400,
                } as any,
                {
                    id: 'task-removed-quoted',
                    estimatedFlatAmount: null,
                    quotedAmountBilling: {
                        invoiceId: 'invoice-1',
                        billedAt: 90,
                        total: 300,
                    },
                } as any,
                {
                    id: 'task-other-quoted',
                    quotedAmountBilling: {
                        invoiceId: 'invoice-2',
                        billedAt: 90,
                        total: 500,
                    },
                } as any,
            ],
            selectedExpenseIds: ['expense-selected'],
            editedAt: 1000,
        });

        expect(applicationPlan.adjustmentEntryIdsToDelete).toEqual(['adjustment-delete']);
        expect(applicationPlan.adjustmentEntriesToUpdate).toEqual([{
            id: 'adjustment-update',
            updates: {
                end: 200,
            },
        }]);
        expect(applicationPlan.adjustmentEntriesToCreate).toHaveLength(1);
        expect(applicationPlan.expenseUpdates).toEqual([
            {
                id: 'expense-selected',
                updates: {
                    billingStatus: 'billed',
                    invoiceId: 'invoice-1',
                    billedAt: 1000,
                    updatedAt: 1000,
                },
            },
            {
                id: 'expense-deselected',
                updates: {
                    billingStatus: 'unbilled',
                    invoiceId: null,
                    billedAt: null,
                    updatedAt: 1000,
                },
            },
        ]);
        expect(applicationPlan.quotedTaskUpdates).toEqual([
            {
                id: 'task-new-quoted',
                updates: {
                    estimatedFlatAmount: null,
                    quotedAmountBilling: {
                        invoiceId: 'invoice-1',
                        billedAt: 1000,
                        total: 400,
                    },
                    updatedAt: 1000,
                },
            },
            {
                id: 'task-removed-quoted',
                updates: {
                    estimatedFlatAmount: 300,
                    quotedAmountBilling: null,
                    updatedAt: 1000,
                },
            },
        ]);
        expect(applicationPlan.billedExpenseCount).toBe(1);
        expect(applicationPlan.unbilledExpenseCount).toBe(1);
        expect(applicationPlan.claimedQuotedTaskCount).toBe(1);
        expect(applicationPlan.releasedQuotedTaskCount).toBe(1);
    });
});
