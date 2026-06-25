import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { toStorageDate } from '@/utils/dateUtils';
import { isRecurringCompletedOnDate, toggleRecurringCompletionDate } from '@/utils/recurringCompletionUtils';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { Project, Task } from '@/stores/yjs/types';
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

export interface UpdateTaskCommandInput {
    taskId: string;
    updates: Partial<Task>;
}

export interface CompleteTaskCommandInput {
    taskId: string;
    occurrenceDate?: string;
}

export function listProjectsCommand(context: AgentCommandContext): Project[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent list projects')
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
