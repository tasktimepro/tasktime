import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import type { FocusItem, Project, Task } from '@/stores/yjs/types';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import { groupFocusItems } from '@/domain/focus/focusOperations';
import { addFocusTasks, moveFocusTask, readFocusItems, removeFocusTask } from '@/stores/yjs/focusOperations';
import { assertPermission, assertReady, requireString, withIdempotency } from './shared';

export interface AddFocusTaskInput {
    taskId: string;
    occurrenceDate?: string;
    idempotencyKey?: string;
}

export interface RemoveFocusTaskInput {
    taskId: string;
    selectionId: string;
    idempotencyKey?: string;
}

export interface MoveFocusTaskInput extends RemoveFocusTaskInput {
    direction: 'up' | 'down';
}

export function listFocusTasksCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');
    const items = readFocusItems(context.store);
    const tasks = collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent focus tasks');
    const projects = collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent focus projects');
    const groups = groupFocusItems(items, tasks, projects);
    const visible = new Set(groups.flatMap(group => group.items.map(row => row.item.taskId)));
    return {
        groups: groups.map(group => ({
            projectId: group.id,
            projectTitle: group.title,
            items: group.items.map(({ item, task }) => ({ ...item, taskTitle: task.title, parentTaskId: task.parentTaskId || null, actionable: true })),
        })),
        unavailable: items.filter(item => !visible.has(item.taskId)).map(item => ({ ...item, actionable: false })),
    };
}

export function addFocusTaskCommand(context: AgentCommandContext, input: AddFocusTaskInput): FocusItem {
    assertReady(context);
    assertPermission(context, 'write');
    return withIdempotency(context, input.idempotencyKey, () => {
        const taskId = requireString(input.taskId, 'taskId');
        try {
            addFocusTasks(context.store, [{ taskId, occurrenceDate: input.occurrenceDate }]);
            return readFocusItems(context.store).find(item => item.taskId === taskId)!;
        } catch (cause) {
            throw new AgentCommandError('CONFLICT', cause instanceof Error ? cause.message : 'Could not add this task to Focus.', { taskId });
        }
    });
}

export function removeFocusTaskCommand(context: AgentCommandContext, input: RemoveFocusTaskInput) {
    assertReady(context);
    assertPermission(context, 'write');
    return withIdempotency(context, input.idempotencyKey, () => {
        const taskId = requireString(input.taskId, 'taskId');
        const selectionId = requireString(input.selectionId, 'selectionId');
        const removed = removeFocusTask(context.store, taskId, selectionId);
        if (!removed) throw new AgentCommandError('CONFLICT', 'The Focus selection changed.', { taskId });
        return removed;
    });
}

export function moveFocusTaskCommand(context: AgentCommandContext, input: MoveFocusTaskInput) {
    assertReady(context);
    assertPermission(context, 'write');
    return withIdempotency(context, input.idempotencyKey, () => {
        const taskId = requireString(input.taskId, 'taskId');
        const selectionId = requireString(input.selectionId, 'selectionId');
        if (input.direction !== 'up' && input.direction !== 'down') {
            throw new AgentCommandError('INVALID_INPUT', 'direction must be up or down.');
        }
        try {
            return moveFocusTask(context.store, taskId, input.direction, selectionId);
        } catch (cause) {
            throw new AgentCommandError('CONFLICT', cause instanceof Error ? cause.message : 'Could not move this Focus task.', { taskId });
        }
    });
}
