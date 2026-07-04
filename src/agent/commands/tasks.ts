import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { toStorageDate } from '@/utils/dateUtils';
import { isRecurringCompletedOnDate, toggleRecurringCompletionDate } from '@/utils/recurringCompletionUtils';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import { cleanupAttachmentsForEntity } from '@/stores/yjs/collections/plannerAttachments';
import { collectEntities } from '@/stores/yjs/entityUtils';
import { buildProjectDeleteApplicationPlan, buildTaskDeleteApplicationPlan } from '@/domain/deletions/deleteApplication';
import { buildProjectDeleteImpactPlan } from '@/domain/deletions/projectDeletion';
import { buildTaskDeleteImpactPlan } from '@/domain/deletions/taskDeletion';
import type { Client, Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    assertPermission,
    assertReady,
    createValidatedEntity,
    getId,
    getNow,
    readRequiredEntity,
    requireString,
    updateValidatedEntity,
    withIdempotency,
} from './shared';

export interface CreateTaskCommandInput extends Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface CreateProjectCommandInput extends Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdateProjectCommandInput {
    projectId: string;
    updates: Partial<Project>;
}

export interface ArchiveProjectCommandInput {
    projectId: string;
}

export interface DeleteProjectCommandInput {
    projectId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface PreviewDeleteProjectCommandInput {
    projectId: string;
    includeInvoiceDeletion?: boolean;
}

export interface PreviewDeleteProjectResult {
    projectId: string;
    title: string;
    includeInvoiceDeletion: boolean;
    activeTaskIds: string[];
    archivedTaskIds: string[];
    taskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceIds: string[];
    storedInvoiceIds: string[];
    sharedInvoiceIds: string[];
    expenseIdsToDelete: string[];
    billedExpenseIds: string[];
    taxClaimedExpenseIds: string[];
    recurrenceIdsToDelete: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface CascadeDeleteProjectCommandInput {
    projectId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
    expectedTaskIds: string[];
    expectedTimeEntryIds: string[];
    expectedTimerKeys?: string[];
    expectedExpenseIds?: string[];
    expectedRecurrenceIds?: string[];
    expectedPlannerAttachmentIds?: string[];
}

export interface CascadeDeleteProjectResult {
    projectId: string;
    title: string;
    deleted: true;
    deletedTaskIds: string[];
    deletedTimeEntryIds: string[];
    clearedTimerKeys: string[];
    deletedExpenseIds: string[];
    deletedRecurrenceIds: string[];
    removedPlannerAttachmentCount: number;
}

export interface DeleteProjectResult {
    projectId: string;
    title: string;
    deleted: true;
    removedPlannerAttachmentCount: number;
}

export interface UpdateTaskCommandInput {
    taskId: string;
    updates: Partial<Task>;
}

export interface CompleteTaskCommandInput {
    taskId: string;
    occurrenceDate?: string;
}

export interface DeleteTaskCommandInput {
    taskId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface PreviewDeleteTaskCommandInput {
    taskId: string;
}

export interface PreviewDeleteTaskResult {
    taskId: string;
    title: string;
    archived: boolean;
    descendantTaskIds: string[];
    taskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceReferences: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface CascadeDeleteTaskCommandInput {
    taskId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
    expectedTaskIds: string[];
    expectedTimeEntryIds: string[];
    expectedTimerKeys?: string[];
    expectedPlannerAttachmentIds?: string[];
}

export interface CascadeDeleteTaskResult {
    taskId: string;
    title: string;
    deleted: true;
    deletedTaskIds: string[];
    deletedTimeEntryIds: string[];
    clearedTimerKeys: string[];
    removedPlannerAttachmentCount: number;
}

export interface DeleteTaskResult {
    taskId: string;
    title: string;
    deleted: true;
    archived: boolean;
    removedPlannerAttachmentCount: number;
}

function assertConfirmedDelete(input: { confirmDelete?: boolean; confirmationText?: string }, id: string, label: string): void {
    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', `confirmDelete must be true to delete ${label}.`, { id });
    }

    if (input.confirmationText !== id) {
        throw new AgentCommandError('INVALID_INPUT', `confirmationText must match ${label} ID to delete ${label}.`, { id });
    }
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort();
}

function assertArrayMatches(label: string, expected: string[] | undefined, actual: string[]): void {
    const normalizedExpected = uniqueSorted(Array.isArray(expected) ? expected : []);
    const normalizedActual = uniqueSorted(actual);
    const matches = normalizedExpected.length === normalizedActual.length
        && normalizedExpected.every((value, index) => value === normalizedActual[index]);

    if (!matches) {
        throw new AgentCommandError('CONFLICT', `${label} no longer matches the current delete preview. Refresh the preview before deleting.`, {
            expected: normalizedExpected,
            actual: normalizedActual,
        });
    }
}

export function listProjectsCommand(context: AgentCommandContext): Project[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent list projects')
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

export function createProjectCommand(context: AgentCommandContext, input: CreateProjectCommandInput): Project {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const title = requireString(input.title, 'title');
        const now = getNow(context);
        const id = input.id || getId(context);

        if (input.preferredClientId) {
            readRequiredEntity<Client>(context.store.clients as any, input.preferredClientId, 'Client');
        }

        const project = createValidatedEntity<Project>(context.store.projects as any, 'projects', {
            ...input,
            id,
            title,
            archived: input.archived ?? false,
            archivedOnDate: input.archivedOnDate ?? null,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create project ${id}`);

        markMeaningfulActivity('project_create');
        return project;
    });
}

export function updateProjectCommand(context: AgentCommandContext, input: UpdateProjectCommandInput): Project {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    const updates = input.updates || {};
    readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');

    if (updates.preferredClientId) {
        readRequiredEntity<Client>(context.store.clients as any, updates.preferredClientId, 'Client');
    }

    const updated = updateValidatedEntity<Project>(context.store.projects as any, 'projects', projectId, {
        ...updates,
        updatedAt: getNow(context),
    }, `agent update project ${projectId}`);

    markMeaningfulActivity('project_update');
    return updated;
}

export function archiveProjectCommand(context: AgentCommandContext, input: ArchiveProjectCommandInput): Project {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    const updated = updateValidatedEntity<Project>(context.store.projects as any, 'projects', projectId, {
        archived: true,
        archivedOnDate: toStorageDate(new Date(getNow(context))),
        updatedAt: getNow(context),
    }, `agent archive project ${projectId}`);

    markMeaningfulActivity('project_archive');
    return updated;
}

export function unarchiveProjectCommand(context: AgentCommandContext, input: ArchiveProjectCommandInput): Project {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    const updated = updateValidatedEntity<Project>(context.store.projects as any, 'projects', projectId, {
        archived: false,
        archivedOnDate: null,
        updatedAt: getNow(context),
    }, `agent unarchive project ${projectId}`);

    markMeaningfulActivity('project_unarchive');
    return updated;
}

export async function previewDeleteProjectCommand(context: AgentCommandContext, input: PreviewDeleteProjectCommandInput): Promise<PreviewDeleteProjectResult> {
    assertReady(context);
    assertPermission(context, 'read');

    const projectId = requireString(input.projectId, 'projectId');
    const archivedMap = await context.store.loadArchivedTasks();
    const plan = buildProjectDeleteImpactPlan({
        projectId,
        includeInvoiceDeletion: input.includeInvoiceDeletion === true,
        projects: collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent preview delete project lookup'),
        activeTasks: collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent preview delete project active tasks'),
        archivedTasks: collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent preview delete project archived tasks'),
        timeEntries: context.store.getAllTimeEntries() as TimeEntry[],
        timers: collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent preview delete project timers'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent preview delete project invoices'),
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent preview delete project expenses'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent preview delete project recurrences'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Project not found.', { projectId });
    }

    return {
        ...plan,
    };
}

export async function cascadeDeleteProjectCommand(context: AgentCommandContext, input: CascadeDeleteProjectCommandInput): Promise<CascadeDeleteProjectResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    assertConfirmedDelete(input, projectId, 'project cascade');
    const preview = await previewDeleteProjectCommand(context, { projectId, includeInvoiceDeletion: false });

    assertArrayMatches('expectedTaskIds', input.expectedTaskIds, preview.taskIdsToDelete);
    assertArrayMatches('expectedTimeEntryIds', input.expectedTimeEntryIds, preview.timeEntryIdsToDelete);
    assertArrayMatches('expectedTimerKeys', input.expectedTimerKeys, preview.timerKeysToClear);
    assertArrayMatches('expectedExpenseIds', input.expectedExpenseIds, preview.expenseIdsToDelete);
    assertArrayMatches('expectedRecurrenceIds', input.expectedRecurrenceIds, preview.recurrenceIdsToDelete);
    assertArrayMatches('expectedPlannerAttachmentIds', input.expectedPlannerAttachmentIds, preview.plannerAttachmentIdsToDelete);

    if (!preview.canCascadeDeleteSafely || preview.invoiceIds.length > 0 || preview.storedInvoiceIds.length > 0) {
        throw new AgentCommandError('CONFLICT', 'Project cascade delete is blocked by invoice, billed-time, billed-expense, or tax-claimed references.', {
            projectId,
            blockingReasons: preview.blockingReasons,
            invoiceIds: preview.invoiceIds,
            storedInvoiceIds: preview.storedInvoiceIds,
            billedTimeEntryIds: preview.billedTimeEntryIds,
            billedExpenseIds: preview.billedExpenseIds,
            taxClaimedExpenseIds: preview.taxClaimedExpenseIds,
        });
    }

    const archivedMap = await context.store.loadArchivedTasks();
    let removedPlannerAttachmentCount = 0;
    const applicationPlan = buildProjectDeleteApplicationPlan(preview);

    context.store.activeEntriesDoc.transact(() => {
        applicationPlan.timeEntryIdsToDelete.forEach((entryId) => {
            context.store.activeTimeEntries.delete(entryId);
        });
    });

    context.store.coreDoc.transact(() => {
        applicationPlan.timerKeysToClear.forEach((timerKey) => {
            context.store.timers.delete(timerKey);
        });

        applicationPlan.expenseIdsToDelete.forEach((expenseId) => {
            context.store.expenses.delete(expenseId);
        });

        applicationPlan.recurrenceIdsToDelete.forEach((recurrenceId) => {
            context.store.expenseRecurrences.delete(recurrenceId);
        });

        applicationPlan.taskIdsToDelete.forEach((deleteTaskId) => {
            context.store.tasks.delete(deleteTaskId);
            removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, deleteTaskId);
        });

        context.store.projects.delete(applicationPlan.projectIdToDelete);
        removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, projectId);
    });

    applicationPlan.taskIdsToDelete.forEach((deleteTaskId) => {
        archivedMap.delete(deleteTaskId);
    });

    markMeaningfulActivity('project_delete');

    return {
        projectId,
        title: preview.title,
        deleted: true,
        deletedTaskIds: preview.taskIdsToDelete,
        deletedTimeEntryIds: preview.timeEntryIdsToDelete,
        clearedTimerKeys: preview.timerKeysToClear,
        deletedExpenseIds: preview.expenseIdsToDelete,
        deletedRecurrenceIds: preview.recurrenceIdsToDelete,
        removedPlannerAttachmentCount,
    };
}

export async function deleteProjectCommand(context: AgentCommandContext, input: DeleteProjectCommandInput): Promise<DeleteProjectResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    assertConfirmedDelete(input, projectId, 'project');
    const archivedMap = await context.store.loadArchivedTasks();
    const plan = buildProjectDeleteImpactPlan({
        projectId,
        includeInvoiceDeletion: false,
        projects: collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent delete project lookup'),
        activeTasks: collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent delete project active task refs'),
        archivedTasks: collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent delete project archived task refs'),
        timeEntries: context.store.getAllTimeEntries() as TimeEntry[],
        timers: collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent delete project timer refs'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete project invoice refs'),
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent delete project expense refs'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent delete project recurrence refs'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Project not found.', { projectId });
    }

    if (
        plan.activeTaskIds.length > 0
        || plan.archivedTaskIds.length > 0
        || plan.invoiceIds.length > 0
        || plan.storedInvoiceIds.length > 0
        || plan.expenseIdsToDelete.length > 0
        || plan.recurrenceIdsToDelete.length > 0
        || plan.timerKeysToClear.length > 0
    ) {
        throw new AgentCommandError('CONFLICT', 'Project is still referenced and cannot be hard-deleted through the agent path. Archive it or remove related records explicitly first.', {
            projectId,
            activeTaskReferences: plan.activeTaskIds,
            archivedTaskReferences: plan.archivedTaskIds,
            invoiceReferences: plan.invoiceIds,
            storedInvoiceReferences: plan.storedInvoiceIds,
            expenseReferences: plan.expenseIdsToDelete,
            recurrenceReferences: plan.recurrenceIdsToDelete,
            timerReferences: plan.timerKeysToClear,
        });
    }

    let removedPlannerAttachmentCount = 0;
    context.store.coreDoc.transact(() => {
        context.store.projects.delete(projectId);
        removedPlannerAttachmentCount = cleanupAttachmentsForEntity(context.store.plannerAttachments as any, projectId);
    });

    markMeaningfulActivity('project_delete');

    return {
        projectId,
        title: plan.title,
        deleted: true,
        removedPlannerAttachmentCount,
    };
}

export function listTasksCommand(context: AgentCommandContext, input: { projectId?: string | null } = {}): Task[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent list tasks')
        .filter((task) => !input.projectId || task.projectId === input.projectId)
        .sort((a, b) => (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0));
}

export function createTaskCommand(context: AgentCommandContext, input: CreateTaskCommandInput): Task {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const title = requireString(input.title, 'title');
        const now = getNow(context);
        const id = input.id || getId(context);

        if (input.projectId) {
            readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
        }

        if (input.parentTaskId) {
            readRequiredEntity<Task>(context.store.tasks as any, input.parentTaskId, 'Parent task');

            if (input.recurring) {
                throw new AgentCommandError('INVALID_INPUT', 'Subtasks cannot be recurring.');
            }
        }

        const task = createValidatedEntity<Task>(context.store.tasks as any, 'tasks', {
            ...input,
            id,
            title,
            completed: input.completed ?? false,
            archived: input.archived ?? false,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
            lastActive: input.lastActive ?? now,
        }, `agent create task ${id}`);

        markMeaningfulActivity('task_create');
        return task;
    });
}

export function updateTaskCommand(context: AgentCommandContext, input: UpdateTaskCommandInput): Task {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    const existing = readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');

    if (input.updates.projectId) {
        readRequiredEntity<Project>(context.store.projects as any, input.updates.projectId, 'Project');
    }

    if (input.updates.parentTaskId) {
        readRequiredEntity<Task>(context.store.tasks as any, input.updates.parentTaskId, 'Parent task');
    }

    if ((input.updates.parentTaskId || existing.parentTaskId) && input.updates.recurring) {
        throw new AgentCommandError('INVALID_INPUT', 'Subtasks cannot be recurring.');
    }

    const now = getNow(context);
    const updated = updateValidatedEntity<Task>(context.store.tasks as any, 'tasks', taskId, {
        ...input.updates,
        updatedAt: now,
        lastActive: now,
    }, `agent update task ${taskId}`);

    markMeaningfulActivity('task_update');
    return updated;
}

export function completeTaskCommand(context: AgentCommandContext, input: CompleteTaskCommandInput): Task {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    const task = readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');
    const now = getNow(context);

    if (task.recurring) {
        const occurrenceDate = requireString(input.occurrenceDate, 'occurrenceDate');
        if (isRecurringCompletedOnDate(task.completedDatesByYear, occurrenceDate)) {
            return task;
        }

        const completedDatesByYear = toggleRecurringCompletionDate(task.completedDatesByYear, occurrenceDate);
        const updated = updateValidatedEntity<Task>(context.store.tasks as any, 'tasks', taskId, {
            completedDatesByYear,
            skipUntilNextRecurring: false,
            skippedOccurrenceDate: null,
            updatedAt: now,
            lastActive: now,
        }, `agent complete recurring task ${taskId}`);

        markMeaningfulActivity('task_update');
        return updated;
    }

    if (task.completed) {
        return task;
    }

    const completedOnDate = toStorageDate(new Date(now));
    const updated = updateValidatedEntity<Task>(context.store.tasks as any, 'tasks', taskId, {
        completed: true,
        completedOnDate,
        updatedAt: now,
        lastActive: now,
    }, `agent complete task ${taskId}`);

    markMeaningfulActivity('task_update');
    return updated;
}

export async function archiveTaskCommand(context: AgentCommandContext, input: { taskId: string }): Promise<{ taskId: string; archived: true }> {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    readRequiredEntity<Task>(context.store.tasks as any, taskId, 'Task');

    await context.store.archiveTask(taskId);
    markMeaningfulActivity('task_archive');
    return { taskId, archived: true };
}

export async function unarchiveTaskCommand(context: AgentCommandContext, input: { taskId: string }): Promise<{ taskId: string; archived: false }> {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    const archivedMap = await context.store.loadArchivedTasks();
    const task = collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent unarchive task lookup')
        .find((candidate) => candidate.id === taskId);

    if (!task) {
        throw new AgentCommandError('NOT_FOUND', 'Archived task not found.', { taskId });
    }

    await context.store.unarchiveTask(taskId);
    markMeaningfulActivity('task_unarchive');
    return { taskId, archived: false };
}

export async function previewDeleteTaskCommand(context: AgentCommandContext, input: PreviewDeleteTaskCommandInput): Promise<PreviewDeleteTaskResult> {
    assertReady(context);
    assertPermission(context, 'read');

    const taskId = requireString(input.taskId, 'taskId');
    const archivedMap = await context.store.loadArchivedTasks();
    const plan = buildTaskDeleteImpactPlan({
        taskId,
        activeTasks: collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent preview delete task active refs'),
        archivedTasks: collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent preview delete task archived refs'),
        timeEntries: context.store.getAllTimeEntries() as TimeEntry[],
        timers: collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent preview delete task timers'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent preview delete task invoices'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Task not found.', { taskId });
    }

    return {
        ...plan,
    };
}

export async function cascadeDeleteTaskCommand(context: AgentCommandContext, input: CascadeDeleteTaskCommandInput): Promise<CascadeDeleteTaskResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    assertConfirmedDelete(input, taskId, 'task cascade');
    const preview = await previewDeleteTaskCommand(context, { taskId });

    assertArrayMatches('expectedTaskIds', input.expectedTaskIds, preview.taskIdsToDelete);
    assertArrayMatches('expectedTimeEntryIds', input.expectedTimeEntryIds, preview.timeEntryIdsToDelete);
    assertArrayMatches('expectedTimerKeys', input.expectedTimerKeys, preview.timerKeysToClear);
    assertArrayMatches('expectedPlannerAttachmentIds', input.expectedPlannerAttachmentIds, preview.plannerAttachmentIdsToDelete);

    if (!preview.canCascadeDeleteSafely) {
        throw new AgentCommandError('CONFLICT', 'Task cascade delete is blocked by invoice or billed-time references.', {
            taskId,
            blockingReasons: preview.blockingReasons,
            invoiceReferences: preview.invoiceReferences,
            billedTimeEntryIds: preview.billedTimeEntryIds,
        });
    }

    const archivedMap = await context.store.loadArchivedTasks();
    const taskIdSet = new Set(preview.taskIdsToDelete);
    let removedPlannerAttachmentCount = 0;
    const applicationPlan = buildTaskDeleteApplicationPlan(preview);

    context.store.activeEntriesDoc.transact(() => {
        applicationPlan.timeEntryIdsToDelete.forEach((entryId) => {
            context.store.activeTimeEntries.delete(entryId);
        });
    });

    context.store.coreDoc.transact(() => {
        applicationPlan.timerKeysToClear.forEach((timerKey) => {
            context.store.timers.delete(timerKey);
        });

        applicationPlan.taskIdsToDelete.forEach((deleteTaskId) => {
            context.store.tasks.delete(deleteTaskId);
            removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, deleteTaskId);
        });
    });

    applicationPlan.taskIdsToDelete.forEach((deleteTaskId) => {
        if (taskIdSet.has(deleteTaskId)) {
            archivedMap.delete(deleteTaskId);
        }
    });

    markMeaningfulActivity('task_delete');

    return {
        taskId,
        title: preview.title,
        deleted: true,
        deletedTaskIds: preview.taskIdsToDelete,
        deletedTimeEntryIds: preview.timeEntryIdsToDelete,
        clearedTimerKeys: preview.timerKeysToClear,
        removedPlannerAttachmentCount,
    };
}

export async function deleteTaskCommand(context: AgentCommandContext, input: DeleteTaskCommandInput): Promise<DeleteTaskResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const taskId = requireString(input.taskId, 'taskId');
    assertConfirmedDelete(input, taskId, 'task');
    const archivedMap = await context.store.loadArchivedTasks();
    const plan = buildTaskDeleteImpactPlan({
        taskId,
        activeTasks: collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent delete task active refs'),
        archivedTasks: collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent delete task archived refs'),
        timeEntries: context.store.getAllTimeEntries() as TimeEntry[],
        timers: collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent delete task timer refs'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete task invoices'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Task not found.', { taskId });
    }

    if (plan.descendantTaskIds.length > 0 || plan.timeEntryIdsToDelete.length > 0 || plan.timerKeysToClear.length > 0 || plan.invoiceReferences.length > 0) {
        throw new AgentCommandError('CONFLICT', 'Task is still referenced and cannot be hard-deleted through the agent path. Archive it or remove related records explicitly first.', {
            taskId,
            childReferences: plan.descendantTaskIds,
            timeEntryReferences: plan.timeEntryIdsToDelete,
            timerReferences: plan.timerKeysToClear,
            invoiceReferences: plan.invoiceReferences,
        });
    }

    let removedPlannerAttachmentCount = 0;

    context.store.coreDoc.transact(() => {
        if (!plan.archived) {
            context.store.tasks.delete(taskId);
        }

        removedPlannerAttachmentCount = cleanupAttachmentsForEntity(context.store.plannerAttachments as any, taskId);
    });

    if (plan.archived) {
        archivedMap.delete(taskId);
    }

    markMeaningfulActivity('task_delete');

    return {
        taskId,
        title: plan.title,
        deleted: true,
        archived: plan.archived,
        removedPlannerAttachmentCount,
    };
}
