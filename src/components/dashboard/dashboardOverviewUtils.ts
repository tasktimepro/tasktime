import { THIRTY_DAYS_MS } from '@/constants/app';
import { millisecondsToHours } from '@/utils/dateUtils';
import type { Client, Project, Task, TimeEntry } from '@/stores/yjs/types';

type DashboardTimer = {
    taskId?: string | null;
    isPaused?: boolean;
    elapsedTime?: number;
};

type DashboardTask = Task & {
    project: Project | null;
    parentTask: Task | null;
    recentTime: number;
    lastActive: number;
};

type DashboardProject = Project & {
    totalTime: number;
    lastActivity: number;
    pendingHours: number;
    pendingAmount: number;
    client: Client | null;
};

export const DEFAULT_TASK_FILTER = 'recent';
export const DEFAULT_PROJECT_FILTER = 'recent';

export const TASK_FILTER_OPTIONS = [
    { value: 'recent', label: 'Recent' },
    { value: 'recurring', label: 'Recurring' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
] as const;

export const PROJECT_FILTER_OPTIONS = [
    { value: 'recent', label: 'Recent' },
    { value: 'unbilled', label: 'Unbilled' },
] as const;

export type TaskFilterValue = typeof TASK_FILTER_OPTIONS[number]['value'];
export type ProjectFilterValue = typeof PROJECT_FILTER_OPTIONS[number]['value'];

interface BuildDashboardTasksOptions {
    activeTasks: Task[];
    archivedTasks: Task[];
    projects: Project[];
    timeEntries: TimeEntry[];
    timers: DashboardTimer[];
    taskFilter: TaskFilterValue;
    taskSearchQuery: string;
    todayStr?: string | null;
    getTaskCompletedStatus: (task: Task) => boolean;
    now?: number;
}

interface BuildDashboardProjectsOptions {
    projects: Project[];
    activeTasks: Task[];
    timeEntries: TimeEntry[];
    clients: Client[];
    projectFilter: ProjectFilterValue;
    projectSearchQuery: string;
}

const normalizeQuery = (query: string) => query.trim().toLowerCase();

const compareTasksByActivity = (left: DashboardTask, right: DashboardTask) => {
    const activityDiff = right.lastActive - left.lastActive;

    if (activityDiff !== 0) {
        return activityDiff;
    }

    return left.title.localeCompare(right.title);
};

const compareProjectsByActivity = (left: DashboardProject, right: DashboardProject) => {
    const activityDiff = right.lastActivity - left.lastActivity;

    if (activityDiff !== 0) {
        return activityDiff;
    }

    return left.title.localeCompare(right.title);
};

const buildTaskActivityLookup = (timeEntries: TimeEntry[], timers: DashboardTimer[]) => {
    const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
    const recentEntries = timeEntries.filter((entry) => entry.start > thirtyDaysAgo);
    const taskActivity = new Map<string, number>();

    recentEntries.forEach((entry) => {
        taskActivity.set(entry.taskId, (taskActivity.get(entry.taskId) || 0) + (entry.end - entry.start));
    });

    timers.forEach((timer) => {
        if (!timer?.taskId) {
            return;
        }

        taskActivity.set(timer.taskId, (taskActivity.get(timer.taskId) || 0) + (timer.elapsedTime || 0));
    });

    return taskActivity;
};

export const buildDashboardTasks = ({
    activeTasks,
    archivedTasks,
    projects,
    timeEntries,
    timers,
    taskFilter,
    taskSearchQuery,
    todayStr,
    getTaskCompletedStatus,
    now = Date.now(),
}: BuildDashboardTasksOptions): DashboardTask[] => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const allTasksById = new Map([...activeTasks, ...archivedTasks].map((task) => [task.id, task]));
    const taskActivity = buildTaskActivityLookup(timeEntries, timers);
    const query = normalizeQuery(taskSearchQuery);

    const toDashboardTask = (task: Task): DashboardTask => {
        const hasRunningTimer = timers.some((timer) => timer.taskId === task.id && !timer.isPaused);

        return {
            ...task,
            project: task.projectId ? projectById.get(task.projectId) || null : null,
            parentTask: task.parentTaskId ? allTasksById.get(task.parentTaskId) || null : null,
            recentTime: taskActivity.get(task.id) || 0,
            lastActive: hasRunningTimer ? now : (task.lastActive || task.createdAt || 0),
        };
    };

    const sourceTasks = (() => {
        if (taskFilter === 'recurring') {
            return activeTasks.filter((task) => !task.archived && Boolean(task.recurring));
        }

        if (taskFilter === 'completed') {
            return activeTasks.filter((task) => !task.archived && !task.recurring && getTaskCompletedStatus(task));
        }

        if (taskFilter === 'archived') {
            return archivedTasks;
        }

        return activeTasks.filter((task) => {
            if (task.archived) {
                return false;
            }

            if (task.recurring) {
                return true;
            }

            return !getTaskCompletedStatus(task) || task.completedOnDate === todayStr;
        });
    })();

    const filteredTasks = sourceTasks
        .map(toDashboardTask)
        .filter((task) => !query || task.title.toLowerCase().includes(query))
        .sort(compareTasksByActivity);

    if (taskFilter === 'recent') {
        return filteredTasks.slice(0, 10);
    }

    return filteredTasks;
};

export const buildDashboardProjects = ({
    projects,
    activeTasks,
    timeEntries,
    clients,
    projectFilter,
    projectSearchQuery,
}: BuildDashboardProjectsOptions): DashboardProject[] => {
    const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
    const query = normalizeQuery(projectSearchQuery);
    const recentEntries = timeEntries.filter((entry) => entry.start > thirtyDaysAgo);
    const taskById = new Map(activeTasks.map((task) => [task.id, task]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const projectActivity = new Map<string, { totalTime: number; lastActivity: number; taskPendingTime: Record<string, number> }>();

    recentEntries.forEach((entry) => {
        const task = taskById.get(entry.taskId);

        if (!task?.projectId) {
            return;
        }

        const currentActivity = projectActivity.get(task.projectId) || {
            totalTime: 0,
            lastActivity: 0,
            taskPendingTime: {},
        };

        currentActivity.totalTime += (entry.end - entry.start);
        currentActivity.lastActivity = Math.max(currentActivity.lastActivity, entry.end);

        const taskLastBilledAt = task.lastBilledAt || 0;
        if (entry.start > taskLastBilledAt && task.billable === true && entry.source !== 'invoice-adjustment') {
            currentActivity.taskPendingTime[task.id] = (currentActivity.taskPendingTime[task.id] || 0) + (entry.end - entry.start);
        }

        projectActivity.set(task.projectId, currentActivity);
    });

    const visibleProjects = projects
        .filter((project) => !project.archived)
        .map((project) => {
            const activity = projectActivity.get(project.id) || {
                totalTime: 0,
                lastActivity: 0,
                taskPendingTime: {},
            };

            const pendingHours = Object.values(activity.taskPendingTime).reduce((total, taskTime) => {
                const taskHours = millisecondsToHours(taskTime);
                const roundedTaskHours = Math.round(taskHours * 100) / 100;
                return total + roundedTaskHours;
            }, 0);

            return {
                ...project,
                totalTime: activity.totalTime,
                lastActivity: activity.lastActivity,
                pendingHours,
                pendingAmount: project.hourlyRate ? pendingHours * project.hourlyRate : 0,
                client: project.preferredClientId ? clientById.get(project.preferredClientId) || null : null,
            };
        })
        .sort(compareProjectsByActivity);

    const filteredProjects = visibleProjects
        .filter((project) => {
            if (projectFilter === 'unbilled') {
                return project.pendingHours > 0;
            }

            return true;
        })
        .filter((project) => !query || project.title.toLowerCase().includes(query));

    if (projectFilter === 'recent') {
        return filteredProjects.slice(0, 10);
    }

    return filteredProjects;
};