import { describe, expect, it } from 'vitest';
import type { InvoiceFinalizationPlan } from './invoiceFinalization';
import {
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
            sentAt: 1000,
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
            sentAt: 1000,
        }));
        expect(applicationPlan.billedEntryCount).toBe(1);
        expect(applicationPlan.billedExpenseCount).toBe(1);
        expect(applicationPlan.updatedTaskCount).toBe(1);
        expect(applicationPlan.updatedProjectInvoiceReferences).toBe(true);
        expect(applicationPlan.advancedInvoiceSequence).toBe(true);
    });
});
