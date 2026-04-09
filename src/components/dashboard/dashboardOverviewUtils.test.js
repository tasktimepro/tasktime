import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildDashboardProjects,
    buildDashboardTasks,
    DEFAULT_PROJECT_FILTER,
    DEFAULT_TASK_FILTER,
} from './dashboardOverviewUtils.ts';

describe('dashboardOverviewUtils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('builds the recent task list from active tasks and keeps running timers at the top', () => {
        const projects = [{ id: 'project-1', title: 'Alpha Project' }];
        const activeTasks = [
            { id: 'task-running', title: 'Running Task', projectId: 'project-1', completed: false, lastActive: 10 },
            { id: 'task-completed-today', title: 'Completed Today', projectId: 'project-1', completed: true, completedOnDate: '2026-04-09', lastActive: 200 },
            { id: 'task-completed-old', title: 'Completed Old', projectId: 'project-1', completed: true, completedOnDate: '2026-04-08', lastActive: 300 },
            { id: 'task-recurring', title: 'Recurring Task', projectId: 'project-1', recurring: { type: 'weekly', weeklyDays: [4] }, lastActive: 150 },
        ];
        const archivedTasks = [
            { id: 'task-archived', title: 'Archived Task', projectId: 'project-1', archived: true, lastActive: 999 },
        ];
        const timeEntries = [
            {
                id: 'entry-1',
                taskId: 'task-running',
                start: Date.now() - 10_000,
                end: Date.now() - 5_000,
            },
        ];
        const timers = [
            { taskId: 'task-running', isPaused: false, elapsedTime: 3_000 },
        ];

        const result = buildDashboardTasks({
            activeTasks,
            archivedTasks,
            projects,
            timeEntries,
            timers,
            taskFilter: DEFAULT_TASK_FILTER,
            taskSearchQuery: '',
            todayStr: '2026-04-09',
            getTaskCompletedStatus: (task) => Boolean(task.completed),
            now: Date.now(),
        });

        expect(result.map((task) => task.id)).toEqual([
            'task-running',
            'task-completed-today',
            'task-recurring',
        ]);
        expect(result[0].recentTime).toBe(8_000);
        expect(result[0].project?.title).toBe('Alpha Project');
    });

    it('returns the requested task categories for recurring, completed, and archived filters', () => {
        const activeTasks = [
            { id: 'task-recurring-b', title: 'Weekly B', recurring: { type: 'weekly', weeklyDays: [4] }, lastActive: 20 },
            { id: 'task-recurring-a', title: 'Weekly A', recurring: { type: 'weekly', weeklyDays: [4] }, lastActive: 30 },
            { id: 'task-completed', title: 'Completed Item', completed: true, completedOnDate: '2026-04-08', lastActive: 40 },
            { id: 'task-open', title: 'Open Item', completed: false, lastActive: 50 },
        ];
        const archivedTasks = [
            { id: 'task-archived', title: 'Archived Item', archived: true, lastActive: 60 },
        ];

        const recurring = buildDashboardTasks({
            activeTasks,
            archivedTasks,
            projects: [],
            timeEntries: [],
            timers: [],
            taskFilter: 'recurring',
            taskSearchQuery: '',
            todayStr: '2026-04-09',
            getTaskCompletedStatus: (task) => Boolean(task.completed),
        });
        const completed = buildDashboardTasks({
            activeTasks,
            archivedTasks,
            projects: [],
            timeEntries: [],
            timers: [],
            taskFilter: 'completed',
            taskSearchQuery: 'completed',
            todayStr: '2026-04-09',
            getTaskCompletedStatus: (task) => Boolean(task.completed),
        });
        const archived = buildDashboardTasks({
            activeTasks,
            archivedTasks,
            projects: [],
            timeEntries: [],
            timers: [],
            taskFilter: 'archived',
            taskSearchQuery: '',
            todayStr: '2026-04-09',
            getTaskCompletedStatus: (task) => Boolean(task.completed),
        });

        expect(recurring.map((task) => task.id)).toEqual(['task-recurring-a', 'task-recurring-b']);
        expect(completed.map((task) => task.id)).toEqual(['task-completed']);
        expect(archived.map((task) => task.id)).toEqual(['task-archived']);
    });

    it('builds recent projects with pending billable totals and excludes archived projects', () => {
        const projects = [
            { id: 'project-1', title: 'Alpha Project', hourlyRate: 100, preferredClientId: 'client-1' },
            { id: 'project-2', title: 'Beta Project', hourlyRate: 75 },
            { id: 'project-3', title: 'Archived Project', hourlyRate: 50, archived: true },
        ];
        const activeTasks = [
            { id: 'task-1', title: 'Billable 1', projectId: 'project-1', billable: true, lastBilledAt: 0 },
            { id: 'task-2', title: 'Billable 2', projectId: 'project-1', billable: true, lastBilledAt: 0 },
            { id: 'task-3', title: 'Unbillable', projectId: 'project-2', billable: false, lastBilledAt: 0 },
            { id: 'task-4', title: 'Archived project task', projectId: 'project-3', billable: true, lastBilledAt: 0 },
        ];
        const timeEntries = [
            {
                id: 'entry-1',
                taskId: 'task-1',
                start: Date.now() - 20_000,
                end: Date.now() - 20_000 + 4_442_400,
            },
            {
                id: 'entry-2',
                taskId: 'task-2',
                start: Date.now() - 10_000,
                end: Date.now() - 10_000 + 4_449_600,
            },
            {
                id: 'entry-3',
                taskId: 'task-3',
                start: Date.now() - 5_000,
                end: Date.now() - 1_000,
            },
            {
                id: 'entry-4',
                taskId: 'task-4',
                start: Date.now() - 3_000,
                end: Date.now() - 2_000,
            },
        ];
        const clients = [{ id: 'client-1', title: 'Acme Client' }];

        const result = buildDashboardProjects({
            projects,
            activeTasks,
            timeEntries,
            clients,
            projectFilter: DEFAULT_PROJECT_FILTER,
            projectSearchQuery: '',
        });

        expect(result.map((project) => project.id)).toEqual(['project-1', 'project-2']);
        expect(result[0].pendingHours).toBeCloseTo(2.47, 2);
        expect(result[0].pendingAmount).toBeCloseTo(247, 2);
        expect(result[0].client?.title).toBe('Acme Client');
    });

    it('returns only unbilled active projects for the unbilled filter and applies search', () => {
        const result = buildDashboardProjects({
            projects: [
                { id: 'project-1', title: 'Alpha Project' },
                { id: 'project-2', title: 'Beta Project' },
                { id: 'project-3', title: 'Gamma Project', archived: true },
            ],
            activeTasks: [
                { id: 'task-1', title: 'Alpha Task', projectId: 'project-1', billable: true, lastBilledAt: 0 },
                { id: 'task-2', title: 'Beta Task', projectId: 'project-2', billable: false, lastBilledAt: 0 },
            ],
            timeEntries: [
                {
                    id: 'entry-1',
                    taskId: 'task-1',
                    start: Date.now() - 5_000,
                    end: Date.now() - 5_000 + 3_600_000,
                },
                {
                    id: 'entry-2',
                    taskId: 'task-2',
                    start: Date.now() - 4_000,
                    end: Date.now() - 1_000,
                },
            ],
            clients: [],
            projectFilter: 'unbilled',
            projectSearchQuery: 'alpha',
        });

        expect(result.map((project) => project.id)).toEqual(['project-1']);
    });
});