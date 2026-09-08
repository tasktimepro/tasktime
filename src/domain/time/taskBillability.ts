import type { Client, Project, Task } from '@/stores/yjs/types';

/** Client-project context required before offering or automatically setting billability. */
export function canTaskBeBillable(task: Task | null | undefined, project: Project | null | undefined): boolean {
    return Boolean(task?.projectId && project?.id === task.projectId
        && project.isPersonal !== true && project.preferredClientId);
}

/** Current work classification, independent of invoice claims and stored duration snapshots. */
export function isBillableTask(task: Task | null | undefined, project: Project | null | undefined, client: Client | null | undefined): boolean {
    return task?.billable === true && canTaskBeBillable(task, project)
        && Boolean(client?.id && client.id === project?.preferredClientId);
}

/** Resolve current relationships without rewriting a task's saved billable preference. */
export function getBillableTaskIds(tasks: Task[], projects: Project[], clients: Client[]): Set<string> {
    const projectMap = new Map(projects.map(project => [project.id, project]));
    const clientMap = new Map(clients.map(client => [client.id, client]));
    return new Set(tasks.filter(task => {
        const project = projectMap.get(task.projectId || '');
        return isBillableTask(task, project, clientMap.get(project?.preferredClientId || ''));
    }).map(task => task.id));
}
