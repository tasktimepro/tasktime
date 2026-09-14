import { describe, expect, it } from 'vitest';
import { planInvoiceFinalization } from './invoiceFinalization';

describe('invoice finalization', () => {
    it('accepts a finite decimal hours string from an invoice input without treating it as zero', () => {
        const sourceDurationMs = 25 * 60 * 60 * 1000;
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-browser-hours',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-BROWSER-HOURS',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 1391.5,
                total: 1391.5,
                items: [],
                tasks: [],
                projectBreakdowns: [{
                    projectId: 'project-1',
                    projectTitle: 'Forge',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 25.3,
                    subtotal: 1391.5,
                    tasks: [{
                        id: 'task-1',
                        title: 'Forge Homepage design and development',
                        originalHours: 25,
                        originalTimeMs: sourceDurationMs,
                        hours: '25.3',
                        hourlyRate: '55',
                        useFlatRate: false,
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 55 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'task-1', title: 'Forge Homepage design and development', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([expect.objectContaining({
            id: 'adjustment-1',
            entry: expect.objectContaining({
                taskId: 'task-1',
                source: 'invoice-adjustment',
                billedHourlyRate: 55,
            }),
        })]);
        expect(plan.adjustmentEntriesToCreate[0].entry.end - plan.adjustmentEntriesToCreate[0].entry.start).toBe(18 * 60 * 1000);
        expect(plan.adjustmentEntriesToUpdate).toEqual([]);
        expect(plan.adjustmentEntryIdsToDelete).toEqual([]);
    });

    it('uses the richer saved task copy when a duplicate omits edited hours', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-duplicate-richer-copy',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-DUPLICATE-RICHER',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 125,
                total: 125,
                items: [],
                tasks: [{
                    id: 'task-1',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
                projectBreakdowns: [{
                    projectId: 'project-1',
                    projectTitle: 'Forge',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 1.25,
                    subtotal: 125,
                    tasks: [{
                        id: 'task-1',
                        title: 'Homepage',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 1.25,
                        hourlyRate: 100,
                        useFlatRate: false,
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'task-1', title: 'Homepage', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        });

        expect(plan.adjustmentEntriesToCreate[0].entry.end - plan.adjustmentEntriesToCreate[0].entry.start).toBe(15 * 60 * 1000);
    });

    it('retains merged children from the richer duplicate task copy', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-duplicate-merged-child',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-DUPLICATE-MERGED',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 225,
                total: 225,
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 1,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
                projectBreakdowns: [{
                    projectId: 'project-1',
                    projectTitle: 'Forge',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 2.25,
                    subtotal: 225,
                    tasks: [{
                        id: 'parent-task',
                        title: 'Homepage',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 1,
                        hourlyRate: 100,
                        useFlatRate: false,
                        mergedSubtasks: [{
                            id: 'child-task',
                            title: 'Responsive polish',
                            originalTimeMs: 60 * 60 * 1000,
                            hours: 1.25,
                            hourlyRate: 100,
                            useFlatRate: false,
                        }],
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                { id: 'child-task', title: 'Responsive polish', projectId: 'project-1', parentTaskId: 'parent-task', billable: true },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'child-adjustment',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([expect.objectContaining({
            id: 'child-adjustment',
            entry: expect.objectContaining({ taskId: 'child-task' }),
        })]);
        expect(plan.adjustmentEntriesToCreate[0].entry.end - plan.adjustmentEntriesToCreate[0].entry.start).toBe(15 * 60 * 1000);
    });

    it('rejects conflicting duplicate saved task copies without exposing an internal ID', () => {
        const invoice = {
            id: 'invoice-duplicate-conflict',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-DUPLICATE-CONFLICT',
            date: '2026-09-01',
            status: 'sent',
            subtotal: 100,
            total: 100,
            items: [],
            tasks: [{
                id: 'internal-task-id',
                title: 'Homepage',
                originalTimeMs: 60 * 60 * 1000,
                hours: 1,
                hourlyRate: 100,
                useFlatRate: false,
            }],
            projectBreakdowns: [{
                projectId: 'project-1',
                projectTitle: 'Forge',
                clientId: 'client-1',
                pricingMode: 'hourly',
                totalHours: 0.5,
                subtotal: 50,
                tasks: [{
                    id: 'internal-task-id',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 0.5,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
            }],
        };

        expect(() => planInvoiceFinalization({
            invoice: invoice as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'internal-task-id', title: 'Homepage', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError(expect.objectContaining({
            message: expect.stringMatching(/Invoice data for "Homepage" conflicts between saved task copies/),
        }));

        try {
            planInvoiceFinalization({
                invoice: invoice as any,
                projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
                clients: [{ id: 'client-1', title: 'Forge Wellness' }],
                tasks: [{ id: 'internal-task-id', title: 'Homepage', projectId: 'project-1', billable: true }],
                entries: [],
                expenses: [],
                finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
                createAdjustmentId: () => 'adjustment-1',
            });
        } catch (error) {
            expect((error as Error).message).not.toContain('internal-task-id');
        }
    });

    it('treats an omitted legacy hours value as unchanged source time', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-missing-hours',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-MISSING-HOURS',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 100,
                total: 100,
                items: [],
                tasks: [{
                    id: 'task-1',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'task-1', title: 'Homepage', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([]);
        expect(plan.adjustmentEntriesToUpdate).toEqual([]);
        expect(plan.adjustmentEntryIdsToDelete).toEqual([]);
    });

    it('reports a named validation error for malformed invoice hours', () => {
        expect(() => planInvoiceFinalization({
            invoice: {
                id: 'invoice-malformed-hours',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-MALFORMED-HOURS',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 100,
                total: 100,
                items: [],
                tasks: [{
                    id: 'task-1',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: '1 hour',
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'task-1', title: 'Homepage', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError('Invoice hours for "Homepage" are invalid. Enter a valid number of hours, then try again.');
    });

    it('rejects a reduced subtask that is nested into a merged invoice task', () => {
        const invoice = {
            id: 'invoice-merged-reduction',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-MERGED-REDUCTION',
            date: '2026-09-01',
            status: 'sent',
            subtotal: 150,
            total: 150,
            items: [],
            tasks: [{
                id: 'parent-task',
                title: 'Homepage',
                originalTimeMs: 60 * 60 * 1000,
                hours: 1,
                hourlyRate: 100,
                useFlatRate: false,
                mergedSubtasks: [{
                    id: 'child-task',
                    title: 'Responsive polish',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 0.5,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
            }],
        };

        expect(() => planInvoiceFinalization({
            invoice: invoice as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                { id: 'child-task', title: 'Responsive polish', projectId: 'project-1', parentTaskId: 'parent-task', billable: true },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError(expect.objectContaining({
            message: expect.stringMatching(/Responsive polish.*30m.*1h/),
        }));
    });

    it('creates an adjustment for an increased subtask nested into a merged invoice task', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-merged-increase',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-MERGED-INCREASE',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 225,
                total: 225,
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 1,
                    hourlyRate: 100,
                    useFlatRate: false,
                    mergedSubtasks: [{
                        id: 'child-task',
                        title: 'Responsive polish',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 1.25,
                        useFlatRate: false,
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                {
                    id: 'child-task',
                    title: 'Responsive polish',
                    projectId: 'project-1',
                    parentTaskId: 'parent-task',
                    billable: true,
                },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'child-adjustment',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([expect.objectContaining({
            id: 'child-adjustment',
            entry: expect.objectContaining({
                taskId: 'child-task',
                billedHourlyRate: 100,
            }),
        })]);
        expect(plan.adjustmentEntriesToCreate[0].entry.end - plan.adjustmentEntriesToCreate[0].entry.start).toBe(15 * 60 * 1000);
    });

    it('inherits flat-rate pricing for nested merged subtasks', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-flat-merged-child',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-FLAT-MERGED-CHILD',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 500,
                total: 500,
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 1,
                    flatRate: 500,
                    useFlatRate: true,
                    mergedSubtasks: [{
                        id: 'child-task',
                        title: 'Responsive polish',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 0.5,
                        hourlyRate: 100,
                        useFlatRate: false,
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', flatRate: true }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                {
                    id: 'child-task',
                    title: 'Responsive polish',
                    projectId: 'project-1',
                    parentTaskId: 'parent-task',
                    billable: true,
                    estimatedFlatAmount: 125,
                },
            ],
            entries: [{
                id: 'child-entry',
                taskId: 'child-task',
                start: Date.parse('2026-09-01T09:00:00Z'),
                end: Date.parse('2026-09-01T10:00:00Z'),
                createdAt: Date.parse('2026-09-01T10:00:00Z'),
                updatedAt: Date.parse('2026-09-01T10:00:00Z'),
            }],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([]);
        expect(plan.adjustmentEntriesToUpdate).toEqual([]);
        expect(plan.adjustmentEntryIdsToDelete).toEqual([]);
        expect(plan.quotedTaskClaims).toEqual([]);
        expect(plan.entriesToBill).toEqual([expect.objectContaining({
            entry: expect.objectContaining({ id: 'child-entry' }),
            billedHourlyRate: null,
        })]);
    });

    it('rejects merged subtasks nested deeper than the supported invoice line', () => {
        expect(() => planInvoiceFinalization({
            invoice: {
                id: 'invoice-deep-merged-child',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-DEEP-MERGED',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 300,
                total: 300,
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 1,
                    hourlyRate: 100,
                    useFlatRate: false,
                    mergedSubtasks: [{
                        id: 'child-task',
                        title: 'Responsive polish',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 1,
                        hourlyRate: 100,
                        mergedSubtasks: [{
                            id: 'grandchild-task',
                            title: 'Mobile polish',
                            originalTimeMs: 60 * 60 * 1000,
                            hours: 1,
                            hourlyRate: 100,
                        }],
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                { id: 'child-task', title: 'Responsive polish', projectId: 'project-1', parentTaskId: 'parent-task', billable: true },
                { id: 'grandchild-task', title: 'Mobile polish', projectId: 'project-1', parentTaskId: 'child-task', billable: true },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError('Invoice data for "Responsive polish" contains nested merged subtasks that cannot be safely finalized. Refresh or recreate the invoice, then try again.');
    });

    it('claims a legacy flat quoted task when useFlatRate was omitted', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-legacy-flat-quote',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-LEGACY-FLAT-QUOTE',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 500,
                total: 500,
                items: [],
                tasks: [{
                    id: 'task-1',
                    title: 'Homepage',
                    flatRate: 500,
                    quantity: 1,
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', flatRate: true }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{
                id: 'task-1',
                title: 'Homepage',
                projectId: 'project-1',
                billable: true,
                estimatedFlatAmount: 500,
            }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        });

        expect(plan.quotedTaskClaims).toEqual([{ taskId: 'task-1', total: 500 }]);
    });

    it('inherits hourly pricing for nested merged subtasks', () => {
        const plan = planInvoiceFinalization({
            invoice: {
                id: 'invoice-hourly-merged-child',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-HOURLY-MERGED-CHILD',
                date: '2026-09-01',
                status: 'sent',
                subtotal: 225,
                total: 225,
                items: [],
                tasks: [{
                    id: 'parent-task',
                    title: 'Homepage',
                    originalTimeMs: 60 * 60 * 1000,
                    hours: 1,
                    hourlyRate: 100,
                    useFlatRate: false,
                    mergedSubtasks: [{
                        id: 'child-task',
                        title: 'Responsive polish',
                        originalTimeMs: 60 * 60 * 1000,
                        hours: 1.25,
                        flatRate: 125,
                        useFlatRate: true,
                    }],
                }],
            } as any,
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [
                { id: 'parent-task', title: 'Homepage', projectId: 'project-1', billable: true },
                { id: 'child-task', title: 'Responsive polish', projectId: 'project-1', parentTaskId: 'parent-task', billable: true },
            ],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'child-adjustment',
        });

        expect(plan.adjustmentEntriesToCreate).toEqual([expect.objectContaining({
            id: 'child-adjustment',
            entry: expect.objectContaining({ taskId: 'child-task' }),
        })]);
        expect(plan.adjustmentEntriesToCreate[0].entry.end - plan.adjustmentEntriesToCreate[0].entry.start).toBe(15 * 60 * 1000);
    });

    it('rejects malformed invoice line numbers when checking immutable billing evidence', () => {
        const invoice = {
            id: 'invoice-malformed-line',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-MALFORMED-LINE',
            date: '2026-09-01',
            status: 'sent',
            subtotal: 100,
            total: 100,
            items: [{
                taskId: 'task-1',
                description: 'Homepage',
                quantity: 'not-a-number',
                rate: 100,
                amount: 100,
            }],
            tasks: [{
                id: 'task-1',
                title: 'Homepage',
                originalTimeMs: 0,
                hours: 0,
                hourlyRate: 100,
                useFlatRate: false,
            }],
            billingSelectionSnapshot: {
                version: 1,
                capturedAt: 1,
                invoiceCurrency: 'EUR',
                entries: [],
                tasks: [{
                    taskId: 'task-1',
                    title: 'Homepage',
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
            projects: [{ id: 'project-1', title: 'Forge', hourlyRate: 100 }],
            clients: [{ id: 'client-1', title: 'Forge Wellness' }],
            tasks: [{ id: 'task-1', title: 'Homepage', projectId: 'project-1', billable: true }],
            entries: [],
            expenses: [],
            finalizedAt: Date.parse('2026-09-01T12:00:00Z'),
            createAdjustmentId: () => 'adjustment-1',
        })).toThrowError('Invoice line for task "Homepage" changed after preview. Refresh the invoice before finalizing.');
    });

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
