import { describe, expect, it } from 'vitest';
import {
    WorkEntityOperationError,
    buildClientUpdates,
    buildProjectEntity,
    buildProjectUpdates,
    buildTaskEntity,
    buildTaskUpdates,
} from './workEntityOperations';

const projects = [{ id: 'project-1', title: 'Project' }, { id: 'project-2', title: 'Other' }];

describe('work entity operations', () => {
    it('creates relationship-safe tasks and projects', () => {
        const task = buildTaskEntity({
            data: { title: 'Child', projectId: 'project-1', parentTaskId: 'parent' },
            id: 'child',
            now: 10,
            projects,
            tasks: [{ id: 'parent', title: 'Parent', projectId: 'project-1' }],
        });
        const project = buildProjectEntity({
            data: { title: 'Project', preferredClientId: 'client-1' },
            id: 'project-3',
            now: 10,
            clients: [{ id: 'client-1', title: 'Client' }],
        });

        expect(task.parentTaskId).toBe('parent');
        expect(project.preferredClientId).toBe('client-1');
    });

    it('rejects cross-project, recurring, self, and cyclic parent relationships', () => {
        const existing = { id: 'task-1', title: 'Task', projectId: 'project-1' };
        expect(() => buildTaskUpdates({
            existing,
            updates: { parentTaskId: 'other-parent', recurring: { type: 'weekly', weeklyDays: [1] } },
            now: 10,
            projects,
            tasks: [existing, { id: 'other-parent', title: 'Other', projectId: 'project-2' }],
        })).toThrow(WorkEntityOperationError);
        expect(() => buildTaskUpdates({ existing, updates: { parentTaskId: 'task-1' }, now: 10, projects, tasks: [existing] }))
            .toThrow(WorkEntityOperationError);
        expect(() => buildTaskUpdates({
            existing,
            updates: { parentTaskId: 'parent', recurring: { type: 'weekly', weeklyDays: [1] } },
            now: 10,
            projects,
            tasks: [existing, { id: 'parent', title: 'Parent', projectId: 'project-1' }],
        })).toThrow(/Subtasks cannot be recurring/);

        const child = { id: 'child', title: 'Child', projectId: 'project-1', parentTaskId: 'task-1' };
        expect(() => buildTaskUpdates({
            existing,
            updates: { parentTaskId: 'child' },
            now: 10,
            projects,
            tasks: [existing, child],
        })).toThrow(/cycle/);
        expect(() => buildTaskUpdates({
            existing,
            updates: { projectId: 'project-2' },
            now: 10,
            projects,
            tasks: [existing, { ...child, archived: true }],
        })).toThrow(/cannot move/);
    });

    it('keeps entity identities immutable and blocks moving a running task', () => {
        const existingTask = { id: 'task-1', title: 'Task', projectId: 'project-1' };

        expect(() => buildProjectUpdates({
            existing: projects[0],
            updates: { id: 'project-2' },
            now: 10,
            clients: [],
        })).toThrow(/identity/i);
        expect(() => buildClientUpdates({
            existing: { id: 'client-1', title: 'Client' },
            updates: { id: 'client-2' },
            now: 10,
        })).toThrow(/identity/i);
        expect(() => buildTaskUpdates({
            existing: existingTask,
            updates: { id: 'task-2' },
            now: 10,
            projects,
            tasks: [existingTask],
        })).toThrow(/identity/i);
        expect(() => buildTaskUpdates({
            existing: existingTask,
            updates: { projectId: 'project-2' },
            now: 10,
            projects,
            tasks: [existingTask],
            timers: [{
                projectId: 'project-1',
                taskId: existingTask.id,
                startTime: 1,
                paused: false,
            }],
        })).toThrow(/Stop the active timer/i);
    });
});
