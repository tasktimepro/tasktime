import { describe, expect, it } from 'vitest';
import { buildTaskDeleteImpactPlan } from './taskDeletion';
import type { Invoice, MultiTimerState, PlannerAttachment, Task, TimeEntry } from '@/stores/yjs/types';

const baseAttachment = (id: string, referenceId: string): PlannerAttachment => ({
    id,
    referenceId,
    type: 'task',
    mode: 'static',
    sortOrder: 1,
    createdAt: 1,
});

describe('buildTaskDeleteImpactPlan', () => {
    it('plans active task cascades without mutating inputs', () => {
        const activeTasks: Task[] = [
            { id: 'parent', title: 'Parent', projectId: 'project-1' },
            { id: 'child', title: 'Child', projectId: 'project-1', parentTaskId: 'parent' },
        ];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-parent', taskId: 'parent', start: 1, end: 2 },
            { id: 'entry-child', taskId: 'child', start: 3, end: 4 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'child', timerInstanceId: 'timer-1', startTime: 1 },
        ];

        expect(buildTaskDeleteImpactPlan({
            taskId: 'parent',
            activeTasks,
            archivedTasks: [],
            timeEntries,
            timers,
            invoices: [],
            plannerAttachments: [
                baseAttachment('att-parent', 'parent'),
                baseAttachment('att-child', 'child'),
            ],
        })).toEqual({
            taskId: 'parent',
            title: 'Parent',
            archived: false,
            descendantTaskIds: ['child'],
            taskIdsToDelete: ['child', 'parent'],
            timeEntryIdsToDelete: ['entry-child', 'entry-parent'],
            billedTimeEntryIds: [],
            timerKeysToClear: ['project-1'],
            invoiceReferences: [],
            plannerAttachmentIdsToDelete: ['att-child', 'att-parent'],
            canCascadeDeleteSafely: true,
            blockingReasons: [],
        });
    });

    it('blocks invoice and billed-time cascades', () => {
        const invoice: Invoice = {
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-06-26',
            status: 'draft',
            items: [{ description: 'Work', quantity: 1, rate: 100, amount: 100, taskId: 'task-1' }],
            subtotal: 100,
            total: 100,
        };

        expect(buildTaskDeleteImpactPlan({
            taskId: 'task-1',
            activeTasks: [{
                id: 'task-1',
                title: 'Task 1',
                projectId: 'project-1',
                quotedAmountBilling: {
                    invoiceId: 'quoted-invoice',
                    billedAt: 1,
                    total: 100,
                },
            }],
            archivedTasks: [],
            timeEntries: [{
                id: 'entry-billed',
                taskId: 'task-1',
                start: 1,
                end: 2,
                billedAt: 3,
            }],
            timers: [],
            invoices: [invoice],
            plannerAttachments: [],
        })).toEqual(expect.objectContaining({
            invoiceReferences: ['invoice-1', 'quoted-invoice'],
            billedTimeEntryIds: ['entry-billed'],
            canCascadeDeleteSafely: false,
            blockingReasons: ['task_has_invoice_references', 'task_has_billed_time_entries'],
        }));
    });

    it('returns null when the task does not exist', () => {
        expect(buildTaskDeleteImpactPlan({
            taskId: 'missing',
            activeTasks: [],
            archivedTasks: [],
            timeEntries: [],
            timers: [],
            invoices: [],
            plannerAttachments: [],
        })).toBeNull();
    });
});
