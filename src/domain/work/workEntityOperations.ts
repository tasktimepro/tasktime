import type { Client, MultiTimerState, Project, Task } from '@/stores/yjs/types';

export class WorkEntityOperationError extends Error {
    constructor(
        public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT',
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'WorkEntityOperationError';
    }
}

function requireTitle(title: unknown): string {
    if (typeof title !== 'string' || !title.trim()) {
        throw new WorkEntityOperationError('INVALID_INPUT', 'title is required.', { field: 'title' });
    }
    return title.trim();
}

function assertImmutableIdentity(existingId: string, updatedId: unknown): void {
    if (updatedId !== undefined && updatedId !== existingId) {
        throw new WorkEntityOperationError('INVALID_INPUT', 'Entity identity cannot be changed.', {
            existingId,
            updatedId,
        });
    }
}

function assertClientReference(clientId: string | null | undefined, clients: Client[]): void {
    if (clientId && !clients.some((client) => client.id === clientId)) {
        throw new WorkEntityOperationError('NOT_FOUND', 'Client not found.', { id: clientId });
    }
}

function assertProjectReference(projectId: string | null | undefined, projects: Project[]): void {
    if (projectId && !projects.some((project) => project.id === projectId)) {
        throw new WorkEntityOperationError('NOT_FOUND', 'Project not found.', { id: projectId });
    }
}

function assertTaskRelationships(task: Task, tasks: Task[], projects: Project[]): void {
    assertProjectReference(task.projectId, projects);
    if (task.parentTaskId) {
        if (task.parentTaskId === task.id) {
            throw new WorkEntityOperationError('INVALID_INPUT', 'A task cannot be its own parent.');
        }
        const parent = tasks.find((candidate) => candidate.id === task.parentTaskId);
        if (!parent) {
            throw new WorkEntityOperationError('NOT_FOUND', 'Parent task not found.', { id: task.parentTaskId });
        }
        if ((parent.projectId || null) !== (task.projectId || null)) {
            throw new WorkEntityOperationError('CONFLICT', 'Parent task must belong to the same project.');
        }
        if (task.recurring) {
            throw new WorkEntityOperationError('INVALID_INPUT', 'Subtasks cannot be recurring.');
        }

        const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
        let ancestor: Task | undefined = parent;
        const visited = new Set<string>();
        while (ancestor) {
            if (ancestor.id === task.id) {
                throw new WorkEntityOperationError('CONFLICT', 'Task hierarchy cannot contain a cycle.');
            }
            if (visited.has(ancestor.id)) break;
            visited.add(ancestor.id);
            ancestor = ancestor.parentTaskId ? byId.get(ancestor.parentTaskId) : undefined;
        }
    }

    const crossProjectChild = tasks.find((candidate) => (
        candidate.parentTaskId === task.id
        && (candidate.projectId || null) !== (task.projectId || null)
    ));
    if (crossProjectChild) {
        throw new WorkEntityOperationError('CONFLICT', 'A task with subtasks cannot move to a different project.', {
            childTaskId: crossProjectChild.id,
        });
    }
}

export function buildProjectEntity({
    data,
    id,
    now,
    clients,
}: {
    data: Omit<Project, 'id'> & { id?: string };
    id: string;
    now: number;
    clients: Client[];
}): Project {
    assertClientReference(data.preferredClientId, clients);
    return {
        ...data,
        id,
        title: requireTitle(data.title),
        archived: data.archived ?? false,
        archivedOnDate: data.archivedOnDate ?? null,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
    };
}

export function buildProjectUpdates({
    existing,
    updates,
    now,
    clients,
}: {
    existing: Project;
    updates: Partial<Project>;
    now: number;
    clients: Client[];
}): Project {
    assertImmutableIdentity(existing.id, updates.id);
    const project = { ...existing, ...updates, updatedAt: now };
    project.title = requireTitle(project.title);
    assertClientReference(project.preferredClientId, clients);
    return project;
}

export function buildClientEntity({ data, id, now }: { data: Omit<Client, 'id'> & { id?: string }; id: string; now: number }): Client {
    return {
        ...data,
        id,
        title: requireTitle(data.title),
        archived: data.archived ?? false,
        archivedOnDate: data.archivedOnDate ?? null,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
    };
}

export function buildClientUpdates({ existing, updates, now }: { existing: Client; updates: Partial<Client>; now: number }): Client {
    assertImmutableIdentity(existing.id, updates.id);
    const client = { ...existing, ...updates, updatedAt: now };
    client.title = requireTitle(client.title);
    return client;
}

export function buildTaskEntity({
    data,
    id,
    now,
    projects,
    tasks,
}: {
    data: Omit<Task, 'id'> & { id?: string };
    id: string;
    now: number;
    projects: Project[];
    tasks: Task[];
}): Task {
    const task: Task = {
        ...data,
        id,
        title: requireTitle(data.title),
        completed: data.completed ?? false,
        archived: data.archived ?? false,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
        lastActive: data.lastActive ?? now,
    };
    assertTaskRelationships(task, tasks, projects);
    return task;
}

export function buildTaskUpdates({
    existing,
    updates,
    now,
    projects,
    tasks,
    timers = [],
}: {
    existing: Task;
    updates: Partial<Task>;
    now: number;
    projects: Project[];
    tasks: Task[];
    timers?: MultiTimerState[];
}): Task {
    assertImmutableIdentity(existing.id, updates.id);
    const task: Task = {
        ...existing,
        ...updates,
        title: requireTitle(updates.title ?? existing.title),
        updatedAt: now,
        lastActive: now,
    };
    const projectChanged = (task.projectId || null) !== (existing.projectId || null);
    if (projectChanged && timers.some((timer) => timer.taskId === existing.id)) {
        throw new WorkEntityOperationError(
            'CONFLICT',
            'Stop the active timer before moving this task to another project.',
            { taskId: existing.id },
        );
    }
    assertTaskRelationships(task, tasks, projects);
    return task;
}
