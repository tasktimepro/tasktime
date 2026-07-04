import { describe, expect, it } from 'vitest';
import { buildClientDeleteApplicationPlan, buildProjectDeleteApplicationPlan, buildTaskDeleteApplicationPlan } from './deleteApplication';

describe('delete application plans', () => {
    it('normalizes task delete mutation batches from an impact plan', () => {
        expect(buildTaskDeleteApplicationPlan({
            taskId: 'task-1',
            title: 'Task',
            archived: false,
            descendantTaskIds: ['task-2'],
            taskIdsToDelete: ['task-1', 'task-2'],
            timeEntryIdsToDelete: ['entry-1'],
            billedTimeEntryIds: [],
            timerKeysToClear: ['project-1'],
            invoiceReferences: [],
            plannerAttachmentIdsToDelete: ['attachment-1'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        })).toEqual({
            taskIdsToDelete: ['task-1', 'task-2'],
            timeEntryIdsToDelete: ['entry-1'],
            timerKeysToClear: ['project-1'],
            plannerAttachmentIdsToDelete: ['attachment-1'],
        });
    });

    it('normalizes project delete mutation batches and respects invoice deletion intent', () => {
        const basePlan = {
            projectId: 'project-1',
            title: 'Project',
            activeTaskIds: ['task-1'],
            archivedTaskIds: ['task-2'],
            taskIdsToDelete: ['task-1', 'task-2'],
            timeEntryIdsToDelete: ['entry-1'],
            billedTimeEntryIds: [],
            timerKeysToClear: ['project-1'],
            invoiceIds: ['invoice-1'],
            storedInvoiceIds: [],
            sharedInvoiceIds: [],
            expenseIdsToDelete: ['expense-1'],
            billedExpenseIds: [],
            taxClaimedExpenseIds: [],
            recurrenceIdsToDelete: ['recurrence-1'],
            plannerAttachmentIdsToDelete: ['attachment-1'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        };

        expect(buildProjectDeleteApplicationPlan({
            ...basePlan,
            includeInvoiceDeletion: false,
        })).toEqual(expect.objectContaining({
            projectIdToDelete: 'project-1',
            invoiceIdsToDelete: [],
        }));

        expect(buildProjectDeleteApplicationPlan({
            ...basePlan,
            includeInvoiceDeletion: true,
        })).toEqual(expect.objectContaining({
            projectIdToDelete: 'project-1',
            invoiceIdsToDelete: ['invoice-1'],
            expenseIdsToDelete: ['expense-1'],
            recurrenceIdsToDelete: ['recurrence-1'],
        }));
    });

    it('normalizes client delete mutation batches and project conversion updates', () => {
        expect(buildClientDeleteApplicationPlan({
            clientId: 'client-1',
            title: 'Client',
            alsoDeleteProjects: false,
            includeInvoiceDeletion: false,
            projectIdsToDelete: [],
            projectIdsToConvertToPersonal: ['project-1'],
            activeTaskIdsToDelete: [],
            archivedTaskIdsToDelete: [],
            timeEntryIdsToDelete: [],
            billedTimeEntryIds: [],
            timerKeysToClear: [],
            invoiceIds: ['invoice-1'],
            sharedInvoiceIds: [],
            expenseIdsToDelete: ['expense-1'],
            billedExpenseIds: [],
            taxClaimedExpenseIds: [],
            recurrenceIdsToDelete: ['recurrence-1'],
            plannerAttachmentIdsToDelete: ['attachment-1'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        })).toEqual({
            clientIdToDelete: 'client-1',
            projectIdsToDelete: [],
            projectConversionUpdates: [{
                id: 'project-1',
                updates: {
                    preferredClientId: null,
                    hourlyRate: null,
                    flatRate: false,
                    isPersonal: true,
                },
            }],
            taskIdsToDelete: [],
            timeEntryIdsToDelete: [],
            timerKeysToClear: [],
            invoiceIdsToDelete: [],
            expenseIdsToDelete: ['expense-1'],
            recurrenceIdsToDelete: ['recurrence-1'],
            plannerAttachmentIdsToDelete: ['attachment-1'],
        });
    });
});
