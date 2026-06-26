import { describe, expect, it } from 'vitest';
import { buildClientDeleteImpactPlan } from './clientDeletion';
import { buildProjectDeleteImpactPlan } from './projectDeletion';
import { buildTaskDeleteImpactPlan } from './taskDeletion';
import type { Client, Expense, ExpenseRecurrence, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';

const attachment = (id: string, referenceId: string, type: PlannerAttachment['type']): PlannerAttachment => ({
    id,
    referenceId,
    type,
    mode: 'static',
    sortOrder: 1,
    createdAt: 1,
});

const expense = (overrides: Partial<Expense>): Expense => ({
    id: 'expense-1',
    title: 'Expense',
    date: '2026-06-27',
    currency: 'USD',
    amount: 10,
    paymentStatus: 'unpaid',
    isPersonal: false,
    billable: false,
    billingStatus: 'unbilled',
    isRecurring: false,
    isTaxExempt: false,
    ...overrides,
});

const recurrence = (overrides: Partial<ExpenseRecurrence>): ExpenseRecurrence => ({
    id: 'recurrence-1',
    title: 'Recurrence',
    currency: 'USD',
    amount: 10,
    amountType: 'fixed',
    repeat: 'monthly',
    startDate: '2026-06-01',
    isPersonal: false,
    billable: false,
    isTaxExempt: false,
    active: true,
    ...overrides,
});

const sorted = (values: string[]) => [...values].sort();

describe('delete impact planner UI parity fixtures', () => {
    it('matches legacy UI main-task delete affected IDs for active and archived descendant tasks', () => {
        const activeTasks: Task[] = [
            { id: 'parent', title: 'Parent', projectId: 'project-1' },
            { id: 'child-active', title: 'Child active', projectId: 'project-1', parentTaskId: 'parent' },
        ];
        const archivedTasks: Task[] = [
            { id: 'child-archived', title: 'Child archived', projectId: 'project-1', parentTaskId: 'parent', archived: true },
        ];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-parent', taskId: 'parent', start: 1, end: 2 },
            { id: 'entry-active', taskId: 'child-active', start: 3, end: 4 },
            { id: 'entry-archived', taskId: 'child-archived', start: 5, end: 6 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'child-active', timerInstanceId: 'timer-1', startTime: 1 },
        ];
        const plannerAttachments = [
            attachment('att-parent', 'parent', 'task'),
            attachment('att-active', 'child-active', 'task'),
            attachment('att-archived', 'child-archived', 'task'),
        ];
        const legacyTaskIdsToDelete = ['child-active', 'child-archived', 'parent'];
        const plan = buildTaskDeleteImpactPlan({
            taskId: 'parent',
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            plannerAttachments,
        });

        expect(plan).toEqual(expect.objectContaining({
            taskIdsToDelete: sorted(legacyTaskIdsToDelete),
            timeEntryIdsToDelete: sorted(timeEntries
                .filter((entry) => legacyTaskIdsToDelete.includes(entry.taskId))
                .map((entry) => entry.id)),
            timerKeysToClear: ['project-1'],
            plannerAttachmentIdsToDelete: sorted(plannerAttachments
                .filter((candidate) => legacyTaskIdsToDelete.includes(candidate.referenceId))
                .map((candidate) => candidate.id)),
        }));
    });

    it('matches legacy UI project delete affected IDs for project-owned records', () => {
        const projects: Project[] = [{ id: 'project-1', title: 'Project' }];
        const activeTasks: Task[] = [{ id: 'task-active', title: 'Task active', projectId: 'project-1' }];
        const archivedTasks: Task[] = [{ id: 'task-archived', title: 'Task archived', projectId: 'project-1', archived: true }];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-active', taskId: 'task-active', start: 1, end: 2 },
            { id: 'entry-archived', taskId: 'task-archived', start: 3, end: 4 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'task-active', timerInstanceId: 'timer-1', startTime: 1 },
        ];
        const expenses = [expense({ id: 'expense-project', projectId: 'project-1' })];
        const expenseRecurrences = [recurrence({ id: 'recurrence-project', projectId: 'project-1' })];
        const plannerAttachments = [
            attachment('att-project', 'project-1', 'project'),
            attachment('att-task', 'task-active', 'task'),
        ];
        const legacyTaskIds = ['task-active', 'task-archived'];
        const plan = buildProjectDeleteImpactPlan({
            projectId: 'project-1',
            projects,
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            expenses,
            expenseRecurrences,
            plannerAttachments,
        });

        expect(plan).toEqual(expect.objectContaining({
            activeTaskIds: ['task-active'],
            archivedTaskIds: ['task-archived'],
            taskIdsToDelete: sorted(legacyTaskIds),
            timeEntryIdsToDelete: sorted(timeEntries.map((entry) => entry.id)),
            timerKeysToClear: ['project-1'],
            expenseIdsToDelete: ['expense-project'],
            recurrenceIdsToDelete: ['recurrence-project'],
            plannerAttachmentIdsToDelete: sorted(plannerAttachments.map((candidate) => candidate.id)),
        }));
    });

    it('matches legacy UI client delete affected IDs for convert-projects and delete-projects branches', () => {
        const clients: Client[] = [{ id: 'client-1', title: 'Client' }];
        const projects: Project[] = [{ id: 'project-1', title: 'Project', preferredClientId: 'client-1' }];
        const activeTasks: Task[] = [{ id: 'task-active', title: 'Task active', projectId: 'project-1' }];
        const archivedTasks: Task[] = [{ id: 'task-archived', title: 'Task archived', projectId: 'project-1', archived: true }];
        const timeEntries: TimeEntry[] = [
            { id: 'entry-active', taskId: 'task-active', start: 1, end: 2 },
            { id: 'entry-archived', taskId: 'task-archived', start: 3, end: 4 },
        ];
        const timers: MultiTimerState[] = [
            { projectId: 'project-1', taskId: 'task-active', timerInstanceId: 'timer-1', startTime: 1 },
        ];
        const expenses = [
            expense({ id: 'expense-client', clientId: 'client-1' }),
            expense({ id: 'expense-project', projectId: 'project-1' }),
        ];
        const expenseRecurrences = [
            recurrence({ id: 'recurrence-client', clientId: 'client-1' }),
            recurrence({ id: 'recurrence-project', projectId: 'project-1' }),
        ];
        const plannerAttachments = [
            attachment('att-client', 'client-1', 'client'),
            attachment('att-project', 'project-1', 'project'),
            attachment('att-task', 'task-active', 'task'),
        ];

        expect(buildClientDeleteImpactPlan({
            clientId: 'client-1',
            alsoDeleteProjects: false,
            clients,
            projects,
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            expenses,
            expenseRecurrences,
            plannerAttachments,
        })).toEqual(expect.objectContaining({
            projectIdsToConvertToPersonal: ['project-1'],
            projectIdsToDelete: [],
            activeTaskIdsToDelete: [],
            archivedTaskIdsToDelete: [],
            timeEntryIdsToDelete: [],
            timerKeysToClear: [],
            expenseIdsToDelete: ['expense-client'],
            recurrenceIdsToDelete: ['recurrence-client'],
            plannerAttachmentIdsToDelete: ['att-client'],
        }));

        expect(buildClientDeleteImpactPlan({
            clientId: 'client-1',
            alsoDeleteProjects: true,
            clients,
            projects,
            activeTasks,
            archivedTasks,
            timeEntries,
            timers,
            invoices: [],
            expenses,
            expenseRecurrences,
            plannerAttachments,
        })).toEqual(expect.objectContaining({
            projectIdsToConvertToPersonal: [],
            projectIdsToDelete: ['project-1'],
            activeTaskIdsToDelete: ['task-active'],
            archivedTaskIdsToDelete: ['task-archived'],
            timeEntryIdsToDelete: sorted(timeEntries.map((entry) => entry.id)),
            timerKeysToClear: ['project-1'],
            expenseIdsToDelete: sorted(['expense-client', 'expense-project']),
            recurrenceIdsToDelete: sorted(['recurrence-client', 'recurrence-project']),
            plannerAttachmentIdsToDelete: sorted(plannerAttachments.map((candidate) => candidate.id)),
        }));
    });
});
