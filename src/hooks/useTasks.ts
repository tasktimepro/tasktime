/**
 * useTasks - React hook for tasks collection
 * 
 * Handles both active and archived tasks with on-demand loading
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { addDays } from 'date-fns';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { Task } from '@/stores/yjs/types';
import { getTodayString, toStorageDate } from '@/utils/dateUtils.ts';
import { findNextRecurringDueDate, findPreviousRecurringDueDate, isRecurringTaskDueOnDate } from '@/utils/recurringUtils.ts';
import { isRecurringCompletedOnDate, toggleRecurringCompletionDate } from '@/utils/recurringCompletionUtils.ts';
import { collectEntities } from '@/stores/yjs/entityUtils';

export interface UseTasksOptions {
    /** Filter to a specific project */
    projectId?: string;
    /** Include archived tasks (triggers lazy loading) */
    includeArchived?: boolean;
}

export function useTasks(options: UseTasksOptions = {}) {
    const { store, isReady, loadArchivedTasks: loadArchived } = useYjs();
    
    // Active tasks from core doc
    const { items: activeTasks, isLoading: activeLoading, get, create, update, remove } = 
        useYjsCollection<Task>((store) => store.tasks);

    // Archived tasks state
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);

    // Load archived tasks when requested
    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoading) return;

        let mounted = true;
        setArchivedLoading(true);

        loadArchived()
            .then(() => {
                if (!mounted) return;
                const archivedMap = store.archivedTasks;
                if (archivedMap) {
                    setArchivedTasks(collectEntities<Task>(archivedMap as any));
                }
                setArchivedLoaded(true);
            })
            .finally(() => {
                if (mounted) setArchivedLoading(false);
            });

        return () => { mounted = false; };
    }, [options.includeArchived, isReady, archivedLoaded, archivedLoading, loadArchived, store]);

    // Subscribe to archived tasks changes
    useEffect(() => {
        if (!archivedLoaded || !store.archivedTasks) return;

        const handler = () => {
            const archivedMap = store.archivedTasks;
            if (archivedMap) {
                setArchivedTasks(collectEntities<Task>(archivedMap as any));
            }
        };

        store.archivedTasks.observeDeep(handler);
        return () => store.archivedTasks?.unobserveDeep(handler);
    }, [archivedLoaded, store]);

    // Combined tasks (if archived are loaded)
    const allTasks = useMemo(() => {
        if (!options.includeArchived) return activeTasks;
        return [...activeTasks, ...archivedTasks];
    }, [activeTasks, archivedTasks, options.includeArchived]);

    // Filter by project
    const filteredTasks = useMemo(() => {
        if (!options.projectId) return allTasks;
        return allTasks.filter(t => t.projectId === options.projectId);
    }, [allTasks, options.projectId]);

    // Active (non-archived) filtered tasks
    const projectActiveTasks = useMemo(() => {
        const tasks = options.projectId 
            ? activeTasks.filter(t => t.projectId === options.projectId)
            : activeTasks;
        return tasks.filter(t => !t.archived);
    }, [activeTasks, options.projectId]);

    // Project archived tasks
    const projectArchivedTasks = useMemo(() => {
        const tasks = options.projectId 
            ? archivedTasks.filter(t => t.projectId === options.projectId)
            : archivedTasks;
        return tasks;
    }, [archivedTasks, options.projectId]);

    // Archive/unarchive operations
    const archiveTask = useCallback(async (id: string) => {
        await store.archiveTask(id);
        // Reload archived if they were loaded
        if (archivedLoaded) {
            const archivedMap = store.archivedTasks;
            if (archivedMap) {
                const tasks: Task[] = [];
                archivedMap.forEach((task) => tasks.push(task));
                setArchivedTasks(tasks);
            }
        }
    }, [store, archivedLoaded]);

    const unarchiveTask = useCallback(async (id: string) => {
        await store.unarchiveTask(id);
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
    }, [store]);

    // Get task hierarchy
    const getRootTasks = useCallback((projectId?: string) => {
        const tasks = projectId 
            ? projectActiveTasks.filter(t => t.projectId === projectId)
            : projectActiveTasks;
        return tasks.filter(t => !t.parentTaskId);
    }, [projectActiveTasks]);

    const getChildTasks = useCallback((parentTaskId: string) => {
        return projectActiveTasks.filter(t => t.parentTaskId === parentTaskId);
    }, [projectActiveTasks]);

    const getStandaloneTasks = useCallback(() => {
        return projectActiveTasks.filter(task => !task.projectId);
    }, [projectActiveTasks]);

    // =========================================================================
    // Recurring Task Completion Helpers
    // =========================================================================

    /**
     * Check if a recurring task is completed on a specific date
     */
    const isCompletedOnDate = useCallback((task: Task, dateStr: string): boolean => {
        if (!task.recurring) {
            // Non-recurring: use standard completed flag
            return task.completed ?? false;
        }
        // Recurring: check completion map
        return isRecurringCompletedOnDate(task.completedDatesByYear, dateStr);
    }, []);

    /**
     * Toggle completion for a recurring task on a specific date
     */
    const toggleRecurringCompletion = useCallback((taskId: string, dateStr: string): Task | undefined => {
        const task = get(taskId);
        if (!task) return undefined;

        const nextCompletedDates = toggleRecurringCompletionDate(task.completedDatesByYear, dateStr);
        return update(taskId, {
            completedDatesByYear: nextCompletedDates,
            skipUntilNextRecurring: false,
            skippedOccurrenceDate: null,
            lastActive: Date.now()
        });
    }, [get, update]);

    /**
     * Temporarily skip the current recurring occurrence until the next one arrives
     */
    const skipRecurringOccurrence = useCallback((taskId: string, dateStr: string): Task | undefined => {
        const task = get(taskId);
        if (!task || !task.recurring) return undefined;

        return update(taskId, {
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: dateStr,
            lastActive: Date.now()
        });
    }, [get, update]);

    const getOverdueTasks = useCallback(() => {
        const today = getTodayString();
        if (!today) return [] as Task[];

        return projectActiveTasks.filter(task => {
            if (task.recurring) return false;
            if (!task.startDate) return false;
            if (task.completed) {
                return task.completedOnDate === today;
            }
            return task.startDate < today;
        });
    }, [projectActiveTasks]);

    const getTasksForToday = useCallback(() => {
        const today = getTodayString();
        if (!today) return [] as Task[];

        const todayDate = new Date();

        return projectActiveTasks.filter(task => {
            if (task.recurring) {
                const createdDateStr = typeof task.createdAt === 'number'
                    ? toStorageDate(task.createdAt)
                    : null;
                const recurringStartStr = task.startDate || createdDateStr;

                if (recurringStartStr && today < recurringStartStr) {
                    return false;
                }

                if (isRecurringTaskDueOnDate(todayDate, task.recurring)) {
                    const isSkippedForToday = Boolean(
                        task.skipUntilNextRecurring
                        && task.skippedOccurrenceDate
                        && task.skippedOccurrenceDate === today
                    );

                    if (isSkippedForToday) return false;
                    return true;
                }

                const previousDueDate = findPreviousRecurringDueDate(todayDate, task.recurring);
                const nextDueDate = findNextRecurringDueDate(todayDate, task.recurring);

                if (!previousDueDate || !nextDueDate) return false;

                const previousDueStr = toStorageDate(previousDueDate);
                const nextDueStr = toStorageDate(nextDueDate);

                if (!previousDueStr || !nextDueStr) return false;
                if (today >= nextDueStr) return false;

                if (recurringStartStr && previousDueStr < recurringStartStr) {
                    return false;
                }

                const wasCompleted = isCompletedOnDate(task, previousDueStr);
                const isSkippedForOccurrence = Boolean(
                    task.skipUntilNextRecurring
                    && task.skippedOccurrenceDate
                    && task.skippedOccurrenceDate === previousDueStr
                );

                if (isSkippedForOccurrence) return false;

                if (!wasCompleted) return true;

                if (!task.lastActive) return false;
                const lastActiveStr = toStorageDate(new Date(task.lastActive));

                return lastActiveStr === today;
            }
            return task.startDate === today;
        });
    }, [projectActiveTasks, isCompletedOnDate]);

    const getUpcomingTasks = useCallback((days = 7) => {
        const today = getTodayString();
        const endDate = toStorageDate(addDays(new Date(), days));
        if (!today || !endDate) return [] as Task[];

        return projectActiveTasks.filter(task => {
            if (task.completed) return false;
            if (task.recurring) return false;
            if (!task.startDate) return false;
            return task.startDate > today && task.startDate <= endDate;
        });
    }, [projectActiveTasks]);

    const getRecurringStatus = useCallback((task: Task, todayStr?: string) => {
        if (!task.recurring) {
            return {
                isDueToday: false,
                isOverdue: false,
                lastDueDateStr: null as string | null,
                nextDueDateStr: null as string | null,
                effectiveDateStr: null as string | null,
            };
        }

        const resolvedToday = todayStr || getTodayString();
        if (!resolvedToday) {
            return {
                isDueToday: false,
                isOverdue: false,
                lastDueDateStr: null as string | null,
                nextDueDateStr: null as string | null,
                effectiveDateStr: null as string | null,
            };
        }

        const todayDate = new Date();

        const createdDateStr = typeof task.createdAt === 'number'
            ? toStorageDate(task.createdAt)
            : null;
        const recurringStartStr = task.startDate || createdDateStr;

        if (recurringStartStr && resolvedToday < recurringStartStr) {
            return {
                isDueToday: false,
                isOverdue: false,
                lastDueDateStr: null as string | null,
                nextDueDateStr: null as string | null,
                effectiveDateStr: null as string | null,
            };
        }

        if (isRecurringTaskDueOnDate(todayDate, task.recurring)) {
            // Determine if skip flag is stale (from a past occurrence) — pure read, no writes
            const skipIsStale = Boolean(
                task.skipUntilNextRecurring
                && task.skippedOccurrenceDate
                && task.skippedOccurrenceDate !== resolvedToday
            );

            const isSkipped = Boolean(
                task.skipUntilNextRecurring
                && task.skippedOccurrenceDate === resolvedToday
                && !skipIsStale
            );

            return {
                isDueToday: true,
                isOverdue: false,
                lastDueDateStr: resolvedToday,
                nextDueDateStr: null as string | null,
                effectiveDateStr: resolvedToday,
                isSkipped,
                _needsSkipReset: skipIsStale,
            };
        }

        const previousDueDate = findPreviousRecurringDueDate(todayDate, task.recurring);
        const nextDueDate = findNextRecurringDueDate(todayDate, task.recurring);
        const previousDueStr = previousDueDate ? toStorageDate(previousDueDate) : null;
        const nextDueStr = nextDueDate ? toStorageDate(nextDueDate) : null;

        const isBeforeRecurringStart = Boolean(recurringStartStr && previousDueStr && previousDueStr < recurringStartStr);
        const wasCompleted = previousDueStr ? isCompletedOnDate(task, previousDueStr) : false;

        const skipIsStaleForOccurrence = Boolean(
            task.skipUntilNextRecurring
            && task.skippedOccurrenceDate
            && previousDueStr
            && task.skippedOccurrenceDate !== previousDueStr
        );

        const isSkippedForOccurrence = Boolean(
            previousDueStr
            && task.skipUntilNextRecurring
            && task.skippedOccurrenceDate
            && task.skippedOccurrenceDate === previousDueStr
            && !skipIsStaleForOccurrence
        );

        const isOverdue = Boolean(
            previousDueStr
                && nextDueStr
                && resolvedToday < nextDueStr
                && !isBeforeRecurringStart
                && !wasCompleted
                && !isSkippedForOccurrence
        );

        return {
            isDueToday: false,
            isOverdue,
            lastDueDateStr: previousDueStr,
            nextDueDateStr: nextDueStr,
            effectiveDateStr: isOverdue ? previousDueStr : null,
            isSkipped: isSkippedForOccurrence,
            _needsSkipReset: skipIsStaleForOccurrence,
        };
    }, [isCompletedOnDate]);

    /**
     * Reset stale skip flags for recurring tasks.
     * Call this explicitly (e.g., on mount or user action), not during render/status checks.
     */
    const resetExpiredSkips = useCallback(() => {
        const today = getTodayString();
        if (!today) return;

        for (const task of projectActiveTasks) {
            if (!task.recurring || !task.skipUntilNextRecurring || !task.skippedOccurrenceDate) continue;
            if (task.skippedOccurrenceDate === today) continue;

            update(task.id, {
                skipUntilNextRecurring: false,
                skippedOccurrenceDate: null,
            });
        }
    }, [projectActiveTasks, update]);

    return {
        // Data
        tasks: filteredTasks,
        activeTasks: projectActiveTasks,
        archivedTasks: projectArchivedTasks,
        isLoading: activeLoading || archivedLoading,
        archivedLoaded,
        
        // CRUD
        getTask: get,
        createTask: create,
        updateTask: update,
        deleteTask: remove,
        
        // Archive operations
        archiveTask,
        unarchiveTask,
        
        // Hierarchy
        getRootTasks,
        getChildTasks,

        // Standalone and date helpers
        getStandaloneTasks,
        getOverdueTasks,
        getTasksForToday,
        getUpcomingTasks,

        // Recurring task completion
        isCompletedOnDate,
        toggleRecurringCompletion,
        skipRecurringOccurrence,
        getRecurringStatus,
        resetExpiredSkips,
    };
}
