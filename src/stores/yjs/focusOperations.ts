import type { YjsStore } from './YjsStore';
import type { FocusItem, Project, Task } from './types';
import { readEntity, objectToYMap } from './entityUtils';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from './validation';
import { buildTaskEntity } from '@/domain/work/workEntityOperations';
import { buildFocusItem, groupFocusItems, isFocusItemActionable, moveFocusItem, shouldRetireFocusItem } from '@/domain/focus/focusOperations';
import { generateId } from '@/utils/idUtils';

export interface FocusSelectionInput {
    taskId: string;
    occurrenceDate?: string;
}

export function readFocusItems(store: YjsStore): FocusItem[] {
    const items: FocusItem[] = [];
    store.focusItems.forEach((value, key) => {
        const item = readValidatedEntity<FocusItem>('focusItems', value, `focus selection ${key}`);
        if (item?.id === key) items.push(item);
    });
    return items;
}

/** Add a validated batch in one core transaction. Repeated matching adds are no-ops. */
export function addFocusTasks(store: YjsStore, selection: FocusSelectionInput[], options: {
    now?: number;
    generateId?: () => string;
} = {}): FocusItem[] {
    const existing = readFocusItems(store);
    const projects = collectValidatedEntities<Project>('projects', store.projects as any, 'focus projects');
    const pending: FocusItem[] = [];
    for (const input of selection) {
        const task = readEntity<Task>(store.tasks.get(input.taskId));
        if (!task) throw new Error('This task is no longer available.');
        const prior = [...existing, ...pending].find(item => item.taskId === task.id);
        if (prior && prior.occurrenceDate === input.occurrenceDate) continue;
        const item = buildFocusItem({
            task,
            projects,
            existing: [...existing, ...pending],
            occurrenceDate: input.occurrenceDate,
            now: options.now ?? Date.now(),
            selectionId: (options.generateId ?? generateId)(),
        });
        pending.push(validateCollectionEntity<FocusItem>('focusItems', item, 'add focus task'));
    }
    store.coreDoc.transact(() => {
        pending.forEach(item => store.focusItems.set(item.id, item));
    });
    return pending;
}

/** Create a normal task and its Focus selection in the same core transaction. */
export function createFocusTask(store: YjsStore, title: string, projectId?: string | null, options: {
    now?: number;
    taskId?: string;
    selectionId?: string;
} = {}): Task {
    const now = options.now ?? Date.now();
    const taskId = options.taskId ?? generateId();
    if (store.tasks.has(taskId) || store.archivedTasks?.has(taskId)) throw new Error('This task ID already exists.');
    const projects = collectValidatedEntities<Project>('projects', store.projects as any, 'focus projects');
    const tasks = collectValidatedEntities<Task>('tasks', store.tasks as any, 'focus tasks');
    const task = validateCollectionEntity<Task>('tasks', buildTaskEntity({
        data: { title, ...(projectId ? { projectId } : {}) },
        id: taskId,
        now,
        projects,
        tasks,
    }), 'create focus task');
    const item = validateCollectionEntity<FocusItem>('focusItems', buildFocusItem({
        task,
        projects,
        existing: readFocusItems(store),
        now,
        selectionId: options.selectionId ?? generateId(),
    }), 'create focus selection');
    store.coreDoc.transact(() => {
        (store.tasks as any).set(task.id, objectToYMap(task as unknown as Record<string, unknown>));
        store.focusItems.set(item.id, item);
    });
    return task;
}

/** A delayed remove never deletes a later generation of the same selection. */
export function removeFocusTask(store: YjsStore, taskId: string, expectedSelectionId: string): FocusItem | null {
    const item = readEntity<FocusItem>(store.focusItems.get(taskId));
    if (!item || item.selectionId !== expectedSelectionId) return null;
    store.focusItems.delete(taskId);
    return item;
}

/** Restore only when there is no newer selection and the task is still eligible. */
export function restoreFocusTask(store: YjsStore, item: FocusItem): boolean {
    if (store.focusItems.has(item.id)) return false;
    const task = readEntity<Task>(store.tasks.get(item.taskId));
    if (!task || !isFocusItemActionable(item, task)) return false;
    if (task.projectId) {
        const project = readEntity<Project>(store.projects.get(task.projectId));
        if (!project || project.archived || project.archivedOnDate) return false;
    }
    store.focusItems.set(item.id, validateCollectionEntity<FocusItem>('focusItems', item, 'restore focus task'));
    return true;
}

export function moveFocusTask(store: YjsStore, taskId: string, direction: 'up' | 'down', expectedSelectionId: string): FocusItem[] {
    const groups = groupFocusItems(
        readFocusItems(store),
        collectValidatedEntities<Task>('tasks', store.tasks as any, 'focus tasks'),
        collectValidatedEntities<Project>('projects', store.projects as any, 'focus projects'),
    );
    const group = groups.find(candidate => candidate.items.some(row => row.item.taskId === taskId));
    if (!group) throw new Error('This task is no longer available in Focus.');
    const item = group.items.find(row => row.item.taskId === taskId)!.item;
    if (item.selectionId !== expectedSelectionId) throw new Error('The Focus list changed. Try again.');
    const moved = moveFocusItem(group.items.map(row => row.item), taskId, direction);
    store.coreDoc.transact(() => moved.forEach(next => {
        const current = readEntity<FocusItem>(store.focusItems.get(next.id));
        if (current?.selectionId === next.selectionId && current.position !== next.position) {
            store.focusItems.set(next.id, validateCollectionEntity<FocusItem>('focusItems', next, 'move focus task'));
        }
    }));
    return moved;
}

/** Completion may arrive from the UI, an agent, or another synced device. */
export function retireCompletedFocusTasks(store: YjsStore): number {
    const toDelete = readFocusItems(store).filter(item => {
        const task = readEntity<Task>(store.tasks.get(item.taskId));
        if (!task) return false;
        const project = task.projectId ? readEntity<Project>(store.projects.get(task.projectId)) : null;
        return shouldRetireFocusItem(item, task) || Boolean(task.archived || task.archivedOnDate
            || project?.archived || project?.archivedOnDate);
    });
    if (!toDelete.length) return 0;
    store.coreDoc.transact(() => toDelete.forEach(item => {
        const current = readEntity<FocusItem>(store.focusItems.get(item.id));
        if (current?.selectionId === item.selectionId) store.focusItems.delete(item.id);
    }));
    return toDelete.length;
}
