/**
 * useTasks - React hook for tasks collection
 * 
 * Handles both active and archived tasks with on-demand loading
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { addDays } from 'date-fns';
import { useYjs } from '@/contexts/YjsContext';
import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { useYjsCollection } from './useYjsCollection';
import type { MultiTimerState, PlannerAttachment, Task } from '@/stores/yjs/types';
import { getTodayString, toStorageDate } from '@/utils/dateUtils';
import { findNextRecurringDueDate, findPreviousRecurringDueDate, isRecurringTaskDueOnDate } from '@/utils/recurringUtils';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';
import { cleanupAttachmentsForEntity } from '@/stores/yjs/collections/plannerAttachments';
import { collectEntities, updateEntityFields } from '@/stores/yjs/entityUtils';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import { buildTaskDeleteImpactPlan } from '@/domain/deletions/taskDeletion';
import {
    buildRecurringSkipUpdates,
    buildTaskCompletionUpdates,
    buildTaskStatePatchUpdates,
} from '@/domain/tasks/taskStateOperations';
import { WorkEntityOperationError, buildTaskEntity, buildTaskUpdates } from '@/domain/work/workEntityOperations';
import { assertEntityIdentityAvailable } from '@/domain/entities/entityIdentity';
import type { Project } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';

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
        useYjsCollection<Task>((store) => store.tasks, { collectionName: 'tasks' });

    const getOperationProjects = useCallback((): Project[] => {
        if (store.projects) {
            return collectValidatedEntities<Project>('projects', store.projects as any, 'UI task projects');
        }

        return [...new Set(activeTasks.map((task) => task.projectId).filter(Boolean))]
            .map((id) => ({ id: id as string, title: id as string }));
    }, [activeTasks, store]);

    const createTask = useCallback((data: Omit<Task, 'id'> & { id?: string }) => {
        const now = Date.now();
        const id = data.id || generateId();

        assertEntityIdentityAvailable({
            id,
            existingIds: store.archivedTasks?.keys() ?? [],
            label: 'Task',
        });

        return create(buildTaskEntity({
            data,
            id,
            now,
            projects: getOperationProjects(),
            tasks: activeTasks,
        }));
    }, [activeTasks, create, getOperationProjects, store.archivedTasks]);

    const updateTask = useCallback((id: string, updates: Partial<Task>, updateOptions?: { origin?: unknown }) => {
        const existing = get(id);
        if (!existing) return undefined;
        const now = Date.now();
        let normalizedUpdates = buildTaskStatePatchUpdates({ task: existing, updates, now });
        const relationshipChanged = (
            Object.prototype.hasOwnProperty.call(normalizedUpdates, 'projectId')
            && (normalizedUpdates.projectId || null) !== (existing.projectId || null)
        ) || (
            Object.prototype.hasOwnProperty.call(normalizedUpdates, 'parentTaskId')
            && (normalizedUpdates.parentTaskId || null) !== (existing.parentTaskId || null)
        );
        if (relationshipChanged && !store.archivedTasks) {
            throw new WorkEntityOperationError(
                'CONFLICT',
                'Archived task relationships are still loading. Try the update again.',
                { taskId: id },
            );
        }
        const operationTasks = [
            ...activeTasks,
            ...(store.archivedTasks
                ? collectValidatedEntities<Task>('tasks', store.archivedTasks as any, 'UI update archived task relationships')
                : []),
        ];
        const operationTimers = store.timers
            ? collectValidatedEntities<MultiTimerState>('timers', store.timers as any, 'UI update task timers')
            : [];
        if (store.projects) {
            const built = buildTaskUpdates({
                existing,
                updates: normalizedUpdates,
                now,
                projects: getOperationProjects(),
                tasks: operationTasks,
                timers: operationTimers,
            });
            if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'title')) {
                normalizedUpdates = { ...normalizedUpdates, title: built.title };
            }
        }
        const { id: _immutableId, ...persistedUpdates } = normalizedUpdates;
        return updateOptions
            ? update(id, persistedUpdates, updateOptions)
            : update(id, persistedUpdates);
    }, [activeTasks, get, getOperationProjects, store, update]);

    // Archived tasks state
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);
    const archivedLoadTriggered = useRef(false);

    useEffect(() => {
        if (!options.includeArchived || archivedLoaded || !store.archivedTasks) return;

        setArchivedTasks(collectEntities<Task>(store.archivedTasks as any));
        setArchivedLoaded(true);
    }, [options.includeArchived, archivedLoaded, store]);

    // Load archived tasks when requested
    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoadTriggered.current || store.archivedTasks) return;

        archivedLoadTriggered.current = true;
        setArchivedLoading(true);

        loadArchived()
            .then(() => {
                const archivedMap = store.archivedTasks;
                if (archivedMap) {
                    setArchivedTasks(collectEntities<Task>(archivedMap as any));
                }
                setArchivedLoaded(true);
            })
            .finally(() => {
                setArchivedLoading(false);
            });
    }, [options.includeArchived, isReady, archivedLoaded, loadArchived, store]);

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

    useEffect(() => {
        if (!store.archivedTasks) return;

        const archivedMap = store.archivedTasks;
        const loadedArchivedTasks = collectEntities<Task>(archivedMap as any);
        const knownTaskIds = new Set([...activeTasks, ...loadedArchivedTasks].map((task) => task.id));
        const orphanedActiveTasks = activeTasks.filter((task) => (
            Boolean(task.parentTaskId) && !knownTaskIds.has(task.parentTaskId as string)
        ));
        const orphanedArchivedTasks = loadedArchivedTasks.filter((task) => (
            Boolean(task.parentTaskId) && !knownTaskIds.has(task.parentTaskId as string)
        ));

        if (orphanedActiveTasks.length === 0 && orphanedArchivedTasks.length === 0) {
            return;
        }

        orphanedActiveTasks.forEach((task) => {
            update(task.id, { parentTaskId: null });
        });

        if (orphanedArchivedTasks.length > 0) {
            const updatedAt = Date.now();

            orphanedArchivedTasks.forEach((task) => {
                updateEntityFields(archivedMap as any, task.id, {
                    parentTaskId: null,
                    updatedAt,
                });
            });

            setArchivedLoaded(true);
            setArchivedTasks(collectEntities<Task>(archivedMap as any));
        }
    }, [activeTasks, store, update]);

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
        markMeaningfulActivity('task_archive');
        // Reload archived if they were loaded
        if (archivedLoaded) {
            const archivedMap = store.archivedTasks;
            if (archivedMap) {
                setArchivedTasks(collectEntities<Task>(archivedMap as any));
            }
        }
    }, [store, archivedLoaded]);

    const unarchiveTask = useCallback(async (id: string) => {
        await store.unarchiveTask(id);
        markMeaningfulActivity('task_unarchive');
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
    }, [store]);

    const deleteTask = useCallback(async (id: string) => {
        let archivedMap = store.archivedTasks;

        if (!archivedMap) {
            await loadArchived();
            archivedMap = store.archivedTasks;
        }

        const archivedTasksSnapshot = archivedMap
            ? collectEntities<Task>(archivedMap as any)
            : [];
        const plan = buildTaskDeleteImpactPlan({
            taskId: id,
            activeTasks,
            archivedTasks: archivedTasksSnapshot,
            timeEntries: [],
            timers: [],
            invoices: [],
            plannerAttachments: store.plannerAttachments
                ? collectEntities<PlannerAttachment>(store.plannerAttachments as any)
                : [],
        });

        if (!plan) {
            return false;
        }

        const taskIdsToDelete = plan.taskIdsToDelete;
        let removedAny = false;

        taskIdsToDelete.forEach((taskId) => {
            const removedFromActive = remove(taskId);

            if (removedFromActive) {
                cleanupAttachmentsForEntity(store.plannerAttachments as any, taskId);
                removedAny = true;
                return;
            }

            if (!archivedMap?.has(taskId)) {
                return;
            }

            archivedMap.delete(taskId);
            markMeaningfulActivity('task_delete');
            cleanupAttachmentsForEntity(store.plannerAttachments as any, taskId);
            removedAny = true;
        });

        if (archivedMap) {
            setArchivedLoaded(true);
            setArchivedTasks(collectEntities<Task>(archivedMap as any));
        }

        return removedAny;
    }, [activeTasks, remove, store, loadArchived]);

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

        return updateTask(taskId, buildTaskCompletionUpdates({
            task,
            occurrenceDate: dateStr,
            now: Date.now(),
        }));
    }, [get, updateTask]);

    /**
     * Temporarily skip the current recurring occurrence until the next one arrives
     */
    const skipRecurringOccurrence = useCallback((taskId: string, dateStr: string): Task | undefined => {
        const task = get(taskId);
        if (!task || !task.recurring) return undefined;

        return updateTask(taskId, buildRecurringSkipUpdates(task, dateStr, Date.now()));
    }, [get, updateTask]);

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
            const isSkipped = Boolean(
                task.skipUntilNextRecurring
                && task.skippedOccurrenceDate === resolvedToday
            );

            return {
                isDueToday: true,
                isOverdue: false,
                lastDueDateStr: resolvedToday,
                nextDueDateStr: null as string | null,
                effectiveDateStr: resolvedToday,
                isSkipped,
            };
        }

        const previousDueDate = findPreviousRecurringDueDate(todayDate, task.recurring);
        const nextDueDate = findNextRecurringDueDate(todayDate, task.recurring);
        const previousDueStr = previousDueDate ? toStorageDate(previousDueDate) : null;
        const nextDueStr = nextDueDate ? toStorageDate(nextDueDate) : null;

        const isBeforeRecurringStart = Boolean(recurringStartStr && previousDueStr && previousDueStr < recurringStartStr);
        const wasCompleted = previousDueStr ? isCompletedOnDate(task, previousDueStr) : false;

        const isSkippedForOccurrence = Boolean(
            previousDueStr
            && task.skipUntilNextRecurring
            && task.skippedOccurrenceDate
            && task.skippedOccurrenceDate === previousDueStr
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
        };
    }, [isCompletedOnDate]);

    return {
        // Data
        tasks: filteredTasks,
        activeTasks: projectActiveTasks,
        archivedTasks: projectArchivedTasks,
        isLoading: activeLoading || archivedLoading || Boolean(options.includeArchived && !archivedLoaded),
        archivedLoading,
        archivedLoaded,
        
        // CRUD
        getTask: get,
        createTask,
        updateTask,
        deleteTask,
        
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
    };
}
