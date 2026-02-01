/**
 * usePlannerItems - React hook for building weekly planner data
 * 
 * Combines:
 * - Planner attachments (manually pinned clients/projects/tasks)
 * - Auto-scheduled tasks (startDate or recurring)
 * 
 * Returns a week structure with items sorted by display priority.
 */

import { useMemo, useCallback } from 'react';
import { addDays, format, isSameDay, startOfWeek, startOfDay, endOfDay } from 'date-fns';
import { usePlannerAttachments } from './usePlannerAttachments';
import { useTasks } from './useTasks';
import { useProjects } from './useProjects';
import { useClients } from './useClients';
import { useTimers } from './useTimers';
import { useTimeEntries } from './useTimeEntries';
import { isRecurringTaskDueOnDate } from '@/utils/recurringUtils';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';
import type { Task, Project, Client, PlannerAttachment } from '@/stores/yjs/types';

// ============================================================================
// Types
// ============================================================================

export interface PlannerItemBase {
    /** Unique key for React rendering */
    key: string;
    /** Display title */
    title: string;
    /** Whether item shows strikethrough (completed) */
    isCompleted: boolean;
    /** Color tag (inherited from client → project → task) */
    color?: string | null;
    /** Estimated hours for this item (from attachment) */
    estimatedHours?: number | null;
    /** Actual time worked in milliseconds (calculated from time entries) */
    actualTimeMs?: number;
}

export interface PlannerClientItem extends PlannerItemBase {
    type: 'client';
    entity: Client;
    attachment: PlannerAttachment;
}

export interface PlannerProjectItem extends PlannerItemBase {
    type: 'project';
    entity: Project;
    attachment: PlannerAttachment;
}

export interface PlannerTaskItem extends PlannerItemBase {
    type: 'task';
    subtype: 'recurring' | 'due' | 'attached' | 'timer';
    entity: Task;
    attachment?: PlannerAttachment;
}

export type PlannerItem = PlannerClientItem | PlannerProjectItem | PlannerTaskItem;

export interface PlannerDay {
    /** Date object for this day */
    date: Date;
    /** ISO date string (YYYY-MM-DD) */
    dateStr: string;
    /** Day of week (0=Sun, 1=Mon, ...) */
    dayOfWeek: number;
    /** Whether this is today */
    isToday: boolean;
    /** Items to display in this column */
    items: PlannerItem[];
    /** Total time worked on this day in milliseconds (from all time entries) */
    totalTimeMs: number;
}

export interface UsePlannerItemsResult {
    /** Array of 7 days (Mon-Sun) */
    weekDays: PlannerDay[];
    /** The Monday of the current view */
    weekStart: Date;
    /** ISO string for the week start */
    weekStartStr: string;
    /** Loading state */
    isLoading: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Build weekly planner data
 * 
 * @param weekOffset - Number of weeks offset from current week (0 = this week, 1 = next week, -1 = last week)
 */
export function usePlannerItems(weekOffset: number = 0): UsePlannerItemsResult {
    const { getForDate, isLoading: attachmentsLoading } = usePlannerAttachments();
    const { tasks, isLoading: tasksLoading } = useTasks();
    const { projects, isLoading: projectsLoading } = useProjects();
    const { clients, isLoading: clientsLoading } = useClients();
    const { timers } = useTimers();

    // Calculate week boundaries for time entries query
    const weekStart = useMemo(() => {
        const now = new Date();
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        return addDays(thisWeekStart, weekOffset * 7);
    }, [weekOffset]);

    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

    // Load time entries for the week
    const { entries } = useTimeEntries({
        startDate: startOfDay(weekStart).getTime(),
        endDate: endOfDay(weekEnd).getTime(),
    });

    const isLoading = attachmentsLoading || tasksLoading || projectsLoading || clientsLoading;

    const weekStartStr = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart]);

    // Get task IDs with active timers
    const activeTimerTaskIds = useMemo(() => {
        return new Set(timers.map(t => t.taskId));
    }, [timers]);

    // Today's date string for timer task filtering
    const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    // Build client lookup
    const clientsById = useMemo(() => {
        const map = new Map<string, Client>();
        clients.forEach((c) => map.set(c.id, c));
        return map;
    }, [clients]);

    // Build project lookup
    const projectsById = useMemo(() => {
        const map = new Map<string, Project>();
        projects.forEach((p) => map.set(p.id, p));
        return map;
    }, [projects]);

    // Check if a task is completed for a specific date
    const isTaskCompletedOnDate = useCallback((task: Task, dateStr: string): boolean => {
        if (task.recurring) {
            // Recurring task: check completion map
            return isRecurringCompletedOnDate(task.completedDatesByYear, dateStr);
        }
        // Regular task: use completed flag
        return task.completed ?? false;
    }, []);

    // Get color for a project (project color or inherited from client)
    const getProjectColor = useCallback((project: Project): string | null => {
        if (project.color) return project.color;
        if (project.preferredClientId) {
            const client = clientsById.get(project.preferredClientId);
            return client?.color || null;
        }
        return null;
    }, [clientsById]);

    // Get color for a task (inherited from project → client)
    const getTaskColor = useCallback((task: Task): string | null => {
        if (task.projectId) {
            const project = projectsById.get(task.projectId);
            if (project) return getProjectColor(project);
        }
        return null;
    }, [projectsById, getProjectColor]);

    // Build lookup of taskId → projectId
    const taskProjectMap = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => {
            if (t.projectId) map.set(t.id, t.projectId);
        });
        return map;
    }, [tasks]);

    // Build lookup of projectId → clientId
    const projectClientMap = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((p) => {
            if (p.preferredClientId) map.set(p.id, p.preferredClientId);
        });
        return map;
    }, [projects]);

    // Get time entries for a specific date
    const getEntriesForDate = useCallback((dateStr: string) => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();
        return entries.filter((e) => e.start >= dayStart && e.start <= dayEnd);
    }, [entries]);

    // Calculate total time for a specific task on a date
    const getTaskTimeOnDate = useCallback((taskId: string, dateStr: string): number => {
        const dayEntries = getEntriesForDate(dateStr);
        return dayEntries
            .filter((e) => e.taskId === taskId)
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [getEntriesForDate]);

    // Calculate total time for a project on a date (all its tasks)
    const getProjectTimeOnDate = useCallback((projectId: string, dateStr: string): number => {
        const dayEntries = getEntriesForDate(dateStr);
        return dayEntries
            .filter((e) => taskProjectMap.get(e.taskId) === projectId)
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [getEntriesForDate, taskProjectMap]);

    // Calculate total time for a client on a date (all its projects' tasks)
    const getClientTimeOnDate = useCallback((clientId: string, dateStr: string): number => {
        const dayEntries = getEntriesForDate(dateStr);
        return dayEntries
            .filter((e) => {
                const projectId = taskProjectMap.get(e.taskId);
                if (!projectId) return false;
                return projectClientMap.get(projectId) === clientId;
            })
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [getEntriesForDate, taskProjectMap, projectClientMap]);

    // Calculate total time for a date (all entries)
    const getTotalTimeOnDate = useCallback((dateStr: string): number => {
        const dayEntries = getEntriesForDate(dateStr);
        return dayEntries.reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [getEntriesForDate]);

    // Build items for a single day
    const buildDayItems = useCallback((date: Date, dateStr: string): PlannerItem[] => {
        const attachments = getForDate(dateStr);
        const items: PlannerItem[] = [];

        // 1. Attached clients (sorted alphabetically)
        const clientAttachments = attachments
            .filter((a) => a.type === 'client')
            .map((a) => ({ attachment: a, entity: clientsById.get(a.referenceId) }))
            .filter((item): item is { attachment: PlannerAttachment; entity: Client } => !!item.entity)
            .sort((a, b) => (a.entity.title || '').localeCompare(b.entity.title || ''));

        clientAttachments.forEach(({ attachment, entity }) => {
            items.push({
                key: `client-${attachment.id}`,
                type: 'client',
                title: entity.title || '',
                isCompleted: false, // Clients can't be "completed"
                color: entity.color || null,
                estimatedHours: attachment.estimatedHours || null,
                actualTimeMs: getClientTimeOnDate(entity.id, dateStr),
                entity,
                attachment,
            });
        });

        // 2. Attached projects (sorted alphabetically)
        const projectAttachments = attachments
            .filter((a) => a.type === 'project')
            .map((a) => ({ attachment: a, entity: projectsById.get(a.referenceId) }))
            .filter((item): item is { attachment: PlannerAttachment; entity: Project } => !!item.entity)
            .sort((a, b) => a.entity.title.localeCompare(b.entity.title));

        projectAttachments.forEach(({ attachment, entity }) => {
            items.push({
                key: `project-${attachment.id}`,
                type: 'project',
                title: entity.title,
                isCompleted: false, // Projects can't be "completed"
                color: getProjectColor(entity),
                estimatedHours: attachment.estimatedHours || null,
                actualTimeMs: getProjectTimeOnDate(entity.id, dateStr),
                entity,
                attachment,
            });
        });

        // Track task IDs already added via attachments
        const addedTaskIds = new Set<string>();

        // 3. Attached tasks (sorted alphabetically)
        const taskAttachments = attachments
            .filter((a) => a.type === 'task')
            .map((a) => ({ attachment: a, entity: tasks.find((t) => t.id === a.referenceId) }))
            .filter((item): item is { attachment: PlannerAttachment; entity: Task } => 
                !!item.entity && !item.entity.archived
            )
            .sort((a, b) => a.entity.title.localeCompare(b.entity.title));

        taskAttachments.forEach(({ attachment, entity }) => {
            addedTaskIds.add(entity.id);
            // Check if this task has an active timer (only relevant for today)
            const hasActiveTimer = dateStr === todayStr && activeTimerTaskIds.has(entity.id);
            items.push({
                key: `task-attached-${attachment.id}`,
                type: 'task',
                subtype: hasActiveTimer ? 'timer' : 'attached',
                title: entity.title,
                isCompleted: isTaskCompletedOnDate(entity, dateStr),
                color: getTaskColor(entity),
                estimatedHours: attachment.estimatedHours || null,
                actualTimeMs: getTaskTimeOnDate(entity.id, dateStr),
                entity,
                attachment,
            });
        });

        // 4. Recurring tasks matching this day (sorted alphabetically)
        const recurringTasks = tasks
            .filter((t) => !t.archived && t.recurring && !addedTaskIds.has(t.id))
            .filter((t) => dateStr >= todayStr && isRecurringTaskDueOnDate(date, t.recurring))
            .sort((a, b) => a.title.localeCompare(b.title));

        recurringTasks.forEach((task) => {
            addedTaskIds.add(task.id);
            items.push({
                key: `task-recurring-${task.id}-${dateStr}`,
                type: 'task',
                subtype: 'recurring',
                title: task.title,
                isCompleted: isTaskCompletedOnDate(task, dateStr),
                color: getTaskColor(task),
                actualTimeMs: getTaskTimeOnDate(task.id, dateStr),
                entity: task,
            });
        });

        // 5. Tasks with startDate matching this day (sorted alphabetically)
        const dueTasks = tasks
            .filter((t) => !t.archived && t.startDate === dateStr && !t.recurring && !addedTaskIds.has(t.id))
            .sort((a, b) => a.title.localeCompare(b.title));

        dueTasks.forEach((task) => {
            addedTaskIds.add(task.id);
            items.push({
                key: `task-due-${task.id}`,
                type: 'task',
                subtype: 'due',
                title: task.title,
                isCompleted: isTaskCompletedOnDate(task, dateStr),
                color: getTaskColor(task),
                actualTimeMs: getTaskTimeOnDate(task.id, dateStr),
                entity: task,
            });
        });

        // 6. Tasks with active timers (only for today, sorted alphabetically)
        if (dateStr === todayStr) {
            const timerTasks = tasks
                .filter((t) => !t.archived && activeTimerTaskIds.has(t.id) && !addedTaskIds.has(t.id))
                .sort((a, b) => a.title.localeCompare(b.title));

            timerTasks.forEach((task) => {
                items.push({
                    key: `task-timer-${task.id}`,
                    type: 'task',
                    subtype: 'timer',
                    title: task.title,
                    isCompleted: false, // Active timer tasks are not completed
                    color: getTaskColor(task),
                    actualTimeMs: getTaskTimeOnDate(task.id, dateStr),
                    entity: task,
                });
            });
        }

        return items;
    }, [getForDate, clientsById, projectsById, tasks, isTaskCompletedOnDate, getTaskColor, getClientTimeOnDate, getProjectTimeOnDate, getTaskTimeOnDate, activeTimerTaskIds, todayStr]);

    // Build the full week
    const weekDays = useMemo((): PlannerDay[] => {
        const today = new Date();
        return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
            const date = addDays(weekStart, offset);
            const dateStr = format(date, 'yyyy-MM-dd');

            return {
                date,
                dateStr,
                dayOfWeek: date.getDay(),
                isToday: isSameDay(date, today),
                items: buildDayItems(date, dateStr),
                totalTimeMs: getTotalTimeOnDate(dateStr),
            };
        });
    }, [weekStart, buildDayItems, getTotalTimeOnDate]);

    return {
        weekDays,
        weekStart,
        weekStartStr,
        isLoading,
    };
}
