/**
 * usePlannerItems - React hook for building weekly planner data
 * 
 * Combines:
 * - Planner attachments (manually pinned clients/projects/tasks)
 * - Auto-scheduled tasks (startDate or recurring)
 * 
 * Returns a week structure with items sorted by display priority.
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek, startOfDay, endOfDay } from 'date-fns';
import { usePlannerAttachments } from './usePlannerAttachments';
import { useTasks } from './useTasks';
import { useProjects } from './useProjects';
import { useClients } from './useClients';
import { useTimers } from './useTimers';
import { useTimeEntries } from './useTimeEntries';
import { useExpenses } from './useExpenses';
import { useExpenseRecurrences } from './useExpenseRecurrences';
import { useTodayDate, useTodayString } from './useDayRollover';
import { useDailyGoals } from './useDailyGoals';
import { usePreferences } from './usePreferences';
import { isRecurringTaskDueOnDate } from '@/utils/recurringUtils';
import { toStorageDate } from '@/utils/dateUtils';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';
import { buildExpenseFromRecurrence, isRecurringExpenseDueOnDate } from '@/utils/expenseUtils';
import { convertCurrency, fetchExchangeRates, normalizeCurrencyCode } from '@/utils/currencyUtils';
import type { Task, Project, Client, PlannerAttachment, TimeEntry, DailyGoal, Expense } from '@/stores/yjs/types';

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
    /** Whether this item has an active timer (tasks only) */
    isTimerActive?: boolean;
    /** Raw hours before child subtraction */
    rawHours?: number;
    /** Effective hours after child subtraction */
    effectiveHours?: number;
    /** Calculated height percentage (0-1) relative to column */
    heightPercent?: number;
    /** Whether this item's height is derived from time entries */
    isActualBased?: boolean;
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
    subtype: 'recurring' | 'due' | 'attached' | 'timer' | 'worked';
    entity: Task;
    attachment?: PlannerAttachment;
}

export interface PlannerExpenseItem extends PlannerItemBase {
    type: 'expense';
    expense: Expense;
    amount: number;
    amountType: 'fixed' | 'variable';
    currency: string;
    supplierName?: string | null;
    isPreview?: boolean;
}

export type PlannerItem = PlannerClientItem | PlannerProjectItem | PlannerTaskItem | PlannerExpenseItem;

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
    /** Total earnings for this day in default currency */
    totalEarnings: number;
    /** Daily goal for this weekday (if set) */
    dailyGoal: DailyGoal | null;
}

export interface UsePlannerItemsResult {
    /** Array of 7 days (start of week to end of week) */
    weekDays: PlannerDay[];
    /** The start of the current view week */
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
    const { tasks, isLoading: tasksLoading } = useTasks({ includeArchived: true });
    const { projects, isLoading: projectsLoading } = useProjects();
    const { clients, isLoading: clientsLoading } = useClients();
    const { timers } = useTimers();
    const { expenses } = useExpenses();
    const { recurrences } = useExpenseRecurrences();
    const { preferences } = usePreferences();
    const { getGoalForDate } = useDailyGoals();
    const today = useTodayDate();
    const todayStr = useTodayString();

    const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
    const [exchangeRatesLoaded, setExchangeRatesLoaded] = useState(false);

    useEffect(() => {
        if (exchangeRatesLoaded) return;

        const loadRates = async () => {
            const { rates } = await fetchExchangeRates();
            setExchangeRates(rates);
            setExchangeRatesLoaded(true);
        };

        loadRates();
    }, [exchangeRatesLoaded]);

    // Calculate week boundaries for time entries query
    const weekStartsOn = useMemo(
        () => (typeof preferences.weekStartsOn === 'number' ? preferences.weekStartsOn : 1),
        [preferences.weekStartsOn]
    );

    const weekStart = useMemo(() => {
        const thisWeekStart = startOfWeek(today, { weekStartsOn });
        return addDays(thisWeekStart, weekOffset * 7);
    }, [today, weekOffset, weekStartsOn]);

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
    const safeTodayStr = useMemo(() => todayStr || format(today, 'yyyy-MM-dd'), [todayStr, today]);

    const defaultCurrency = useMemo(
        () => normalizeCurrencyCode(preferences.currency),
        [preferences.currency]
    );

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

    const isTaskVisibleOnDate = useCallback((task: Task, dateStr: string): boolean => {
        const createdDate = typeof task.createdAt === 'number'
            ? toStorageDate(task.createdAt)
            : null;

        if (createdDate && dateStr < createdDate) {
            return false;
        }

        if (task.archived) {
            if (!task.archivedOnDate) return false;
            return dateStr <= task.archivedOnDate;
        }

        return true;
    }, []);

    const isClientVisibleOnDate = useCallback((client: Client, dateStr: string): boolean => {
        if (!client.archived) return true;

        const archivedOnDate = client.archivedOnDate || safeTodayStr;
        return dateStr <= archivedOnDate;
    }, [safeTodayStr]);

    const isProjectVisibleOnDate = useCallback((project: Project, dateStr: string): boolean => {
        if (!project.archived) return true;

        const archivedOnDate = project.archivedOnDate || safeTodayStr;
        return dateStr <= archivedOnDate;
    }, [safeTodayStr]);

    // Get color for a project (project color or inherited from client)
    const getProjectColor = useCallback((project: Project): string | null => {
        if (project.color) return project.color;
        if (project.preferredClientId) {
            const client = clientsById.get(project.preferredClientId);
            return client?.color || null;
        }
        return null;
    }, [clientsById]);

    const getClientCurrency = useCallback((clientId?: string | null): string => {
        if (!clientId) return defaultCurrency;
        const client = clientsById.get(clientId);
        return normalizeCurrencyCode(client?.defaultCurrency || defaultCurrency);
    }, [clientsById, defaultCurrency]);

    const convertToDefaultCurrency = useCallback((amount: number, fromCurrency: string): number => {
        const normalizedFrom = normalizeCurrencyCode(fromCurrency);
        if (normalizedFrom === defaultCurrency) return amount;

        const result = convertCurrency(amount, normalizedFrom, defaultCurrency, exchangeRates);
        return result.success ? result.amount : amount;
    }, [defaultCurrency, exchangeRates]);

    // Get color for a task (inherited from project → client)
    const getTaskColor = useCallback((task: Task): string | null => {
        if (task.projectId) {
            const project = projectsById.get(task.projectId);
            if (project) return getProjectColor(project);
        }
        return null;
    }, [projectsById, getProjectColor]);

    const getExpenseColor = useCallback((expense: Expense): string | null => {
        if (expense.projectId) {
            const project = projectsById.get(expense.projectId);
            if (project) return getProjectColor(project);
        }
        if (expense.clientId) {
            const client = clientsById.get(expense.clientId);
            return client?.color || null;
        }
        return null;
    }, [projectsById, clientsById, getProjectColor]);

    const expenseDatesByRecurrence = useMemo(() => {
        const map = new Map<string, Set<string>>();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!map.has(expense.recurrenceId)) {
                map.set(expense.recurrenceId, new Set());
            }
            map.get(expense.recurrenceId)?.add(expense.date);
        });
        return map;
    }, [expenses]);

    // Build lookup of taskId → projectId
    const taskProjectMap = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => {
            if (t.projectId) map.set(t.id, t.projectId);
        });
        return map;
    }, [tasks]);

    // Build lookup of taskId → task
    const tasksById = useMemo(() => {
        const map = new Map<string, Task>();
        tasks.forEach((t) => map.set(t.id, t));
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

    const getEntryOverlapMs = useCallback((entry: TimeEntry, dayStart: number, dayEnd: number): number => {
        if (!entry || typeof entry.end !== 'number') return 0;
        if (entry.end <= entry.start) return 0;

        const overlapStart = Math.max(entry.start, dayStart);
        const overlapEnd = Math.min(entry.end, dayEnd);

        if (overlapEnd <= overlapStart) return 0;
        return overlapEnd - overlapStart;
    }, []);

    // Calculate total time for a specific task on a date
    const getTaskTimeOnDate = useCallback((taskId: string, dateStr: string): number => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();
        const entryTime = entries
            .filter((e) => e.taskId === taskId)
            .reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);

        if (dateStr !== todayStr) {
            return entryTime;
        }

        const activeTimer = timers.find((timer) => timer.taskId === taskId && !timer.isPaused);
        if (!activeTimer) {
            return entryTime;
        }

        const timerStart = activeTimer.startTime;
        const timerEnd = activeTimer.startTime + activeTimer.elapsedTime;
        const overlapStart = Math.max(timerStart, dayStart);
        const overlapEnd = Math.min(timerEnd, dayEnd);
        const runningMs = overlapEnd > overlapStart ? (overlapEnd - overlapStart) : 0;

        return entryTime + runningMs;
    }, [entries, getEntryOverlapMs, timers, todayStr]);

    // Calculate total time for a project on a date (all its tasks)
    const getProjectTimeOnDate = useCallback((projectId: string, dateStr: string): number => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();
        return entries
            .filter((e) => taskProjectMap.get(e.taskId) === projectId)
            .reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);
    }, [entries, taskProjectMap, getEntryOverlapMs]);

    // Calculate total time for a client on a date (all its projects' tasks)
    const getClientTimeOnDate = useCallback((clientId: string, dateStr: string): number => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();
        return entries
            .filter((e) => {
                const projectId = taskProjectMap.get(e.taskId);
                if (!projectId) return false;
                return projectClientMap.get(projectId) === clientId;
            })
            .reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);
    }, [entries, taskProjectMap, projectClientMap, getEntryOverlapMs]);

    // Calculate total time for a date (all entries)
    const getTotalTimeOnDate = useCallback((dateStr: string): number => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();
        return entries.reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);
    }, [entries, getEntryOverlapMs]);

    const getHourlyRateForTask = useCallback((task: Task): { rate: number; currency: string } => {
        const project = task.projectId ? projectsById.get(task.projectId) : null;
        const clientId = project?.preferredClientId || null;
        const client = clientId ? clientsById.get(clientId) : null;

        const rate = project?.hourlyRate
            ?? client?.defaultHourlyRate
            ?? client?.hourlyRate
            ?? 0;

        const currency = getClientCurrency(clientId);

        return { rate, currency };
    }, [projectsById, clientsById, getClientCurrency]);

    // Calculate total earnings for a date (billable entries only, converted to default currency)
    const getTotalEarningsOnDate = useCallback((dateStr: string): number => {
        const dayStart = startOfDay(new Date(dateStr)).getTime();
        const dayEnd = endOfDay(new Date(dateStr)).getTime();

        return entries.reduce((sum, entry) => {
            if (!entry || typeof entry.end !== 'number') return sum;
            const overlap = getEntryOverlapMs(entry, dayStart, dayEnd);
            if (overlap <= 0) return sum;

            const task = tasksById.get(entry.taskId);
            if (!task || !task.billable) return sum;

            const hours = overlap / 3600000;
            const billedRate = typeof entry.billedHourlyRate === 'number'
                ? entry.billedHourlyRate
                : null;

            const { rate, currency } = getHourlyRateForTask(task);
            const hourlyRate = billedRate ?? rate;
            if (!hourlyRate || hourlyRate <= 0) return sum;

            const earnings = hours * hourlyRate;
            const converted = convertToDefaultCurrency(earnings, currency);
            return sum + converted;
        }, 0);
    }, [entries, getEntryOverlapMs, tasksById, getHourlyRateForTask, convertToDefaultCurrency]);

    // Build items for a single day
    const buildDayItems = useCallback((date: Date, dateStr: string): PlannerItem[] => {
        const attachments = getForDate(dateStr);
        const items: PlannerItem[] = [];
        const dayStart = startOfDay(date).getTime();
        const dayEnd = endOfDay(date).getTime();

        const taskTimeMap = new Map<string, number>();
        entries.forEach((entry) => {
            if (!entry || typeof entry.end !== 'number') return;
            const overlap = getEntryOverlapMs(entry, dayStart, dayEnd);
            if (overlap <= 0) return;
            const current = taskTimeMap.get(entry.taskId) || 0;
            taskTimeMap.set(entry.taskId, current + overlap);
        });

        // 1. Attached clients (sorted alphabetically)
        const clientAttachments = attachments
            .filter((a) => a.type === 'client')
            .map((a) => ({ attachment: a, entity: clientsById.get(a.referenceId) }))
            .filter((item): item is { attachment: PlannerAttachment; entity: Client } => {
                if (!item.entity) return false;
                return isClientVisibleOnDate(item.entity, dateStr);
            })
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
            .filter((item): item is { attachment: PlannerAttachment; entity: Project } => {
                if (!item.entity) return false;
                return isProjectVisibleOnDate(item.entity, dateStr);
            })
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
            .filter((item): item is { attachment: PlannerAttachment; entity: Task } => {
                if (!item.entity) return false;
                if (isTaskVisibleOnDate(item.entity, dateStr)) return true;
                return item.attachment.mode === 'date' && item.attachment.date === dateStr;
            })
            .sort((a, b) => a.entity.title.localeCompare(b.entity.title));

        taskAttachments.forEach(({ attachment, entity }) => {
            addedTaskIds.add(entity.id);
            // Check if this task has an active timer (only relevant for today)
            const hasActiveTimer = dateStr === safeTodayStr && activeTimerTaskIds.has(entity.id);
            items.push({
                key: `task-attached-${attachment.id}`,
                type: 'task',
                subtype: 'attached',
                title: entity.title,
                isCompleted: isTaskCompletedOnDate(entity, dateStr),
                color: getTaskColor(entity),
                estimatedHours: attachment.estimatedHours || null,
                actualTimeMs: getTaskTimeOnDate(entity.id, dateStr),
                isTimerActive: hasActiveTimer,
                entity,
                attachment,
            });
        });

        // 4. Recurring tasks matching this day (sorted alphabetically)
        const recurringTasks = tasks
            .filter((t) => t.recurring && !addedTaskIds.has(t.id))
            .filter((t) => isTaskVisibleOnDate(t, dateStr) && isRecurringTaskDueOnDate(date, t.recurring))
            .sort((a, b) => a.title.localeCompare(b.title));

        recurringTasks.forEach((task) => {
            addedTaskIds.add(task.id);
            const hasActiveTimer = dateStr === safeTodayStr && activeTimerTaskIds.has(task.id);
            items.push({
                key: `task-recurring-${task.id}-${dateStr}`,
                type: 'task',
                subtype: 'recurring',
                title: task.title,
                isCompleted: isTaskCompletedOnDate(task, dateStr),
                color: getTaskColor(task),
                actualTimeMs: getTaskTimeOnDate(task.id, dateStr),
                isTimerActive: hasActiveTimer,
                entity: task,
            });
        });

        // 5. Tasks with startDate matching this day (sorted alphabetically)
        const dueTasks = tasks
            .filter((t) => t.startDate === dateStr && !t.recurring && !addedTaskIds.has(t.id))
            .filter((t) => isTaskVisibleOnDate(t, dateStr))
            .sort((a, b) => a.title.localeCompare(b.title));

        dueTasks.forEach((task) => {
            addedTaskIds.add(task.id);
            const hasActiveTimer = dateStr === safeTodayStr && activeTimerTaskIds.has(task.id);
            items.push({
                key: `task-due-${task.id}`,
                type: 'task',
                subtype: 'due',
                title: task.title,
                isCompleted: isTaskCompletedOnDate(task, dateStr),
                color: getTaskColor(task),
                actualTimeMs: getTaskTimeOnDate(task.id, dateStr),
                isTimerActive: hasActiveTimer,
                entity: task,
            });
        });

        // 6. Tasks with time entries on this day (sorted alphabetically)
        const workedTasks = Array.from(taskTimeMap.entries())
            .map(([taskId, timeMs]) => ({ task: tasksById.get(taskId), timeMs }))
            .filter((item): item is { task: Task; timeMs: number } => Boolean(item.task))
            .filter((item) => !addedTaskIds.has(item.task.id))
            .filter((item) => isTaskVisibleOnDate(item.task, dateStr))
            .sort((a, b) => a.task.title.localeCompare(b.task.title));

        workedTasks.forEach(({ task, timeMs }) => {
            addedTaskIds.add(task.id);
            const hasActiveTimer = dateStr === safeTodayStr && activeTimerTaskIds.has(task.id);
            items.push({
                key: `task-worked-${task.id}-${dateStr}`,
                type: 'task',
                subtype: 'worked',
                title: task.title,
                isCompleted: isTaskCompletedOnDate(task, dateStr),
                color: getTaskColor(task),
                actualTimeMs: timeMs,
                isTimerActive: hasActiveTimer,
                entity: task,
            });
        });

        // 7. Tasks with active timers (only for today, sorted alphabetically)
        if (dateStr === safeTodayStr) {
            const timerTasks = tasks
                .filter((t) => activeTimerTaskIds.has(t.id) && !addedTaskIds.has(t.id))
                .filter((t) => isTaskVisibleOnDate(t, dateStr))
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
                    isTimerActive: true,
                    entity: task,
                });
            });
        }

        // 8. Expenses for this day (unpaid first, then paid)
        const dayExpenses = expenses
            .filter((expense) => expense.date === dateStr)
            .sort((a, b) => {
                if (a.paymentStatus === b.paymentStatus) {
                    return a.title.localeCompare(b.title);
                }
                return a.paymentStatus === 'unpaid' ? -1 : 1;
            });

        dayExpenses.forEach((expense) => {
            items.push({
                key: `expense-${expense.id}-${dateStr}`,
                type: 'expense',
                title: expense.title,
                isCompleted: expense.paymentStatus === 'paid',
                color: getExpenseColor(expense),
                amount: expense.amount || 0,
                amountType: expense.amountType || 'fixed',
                currency: expense.currency || defaultCurrency,
                supplierName: expense.supplierName || null,
                expense,
            });
        });

        // 9. Recurring expense previews (no instance yet)
        const recurringPreviews = recurrences
            .filter((recurrence) => recurrence.active)
            .filter(() => dateStr >= safeTodayStr)
            .filter((recurrence) => isRecurringExpenseDueOnDate(recurrence, dateStr))
            .filter((recurrence) => !expenseDatesByRecurrence.get(recurrence.id)?.has(dateStr))
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        recurringPreviews.forEach((recurrence) => {
            const preview = buildExpenseFromRecurrence(recurrence, dateStr);
            const previewExpense = {
                ...preview,
                id: `preview-${recurrence.id}-${dateStr}`,
                amount: recurrence.amountType === 'variable'
                    ? (recurrence.amount || 0)
                    : recurrence.amount,
                isPreview: true,
            };

            items.push({
                key: `expense-preview-${recurrence.id}-${dateStr}`,
                type: 'expense',
                title: previewExpense.title,
                isCompleted: false,
                color: getExpenseColor(previewExpense),
                amount: previewExpense.amount || 0,
                amountType: previewExpense.amountType || 'fixed',
                currency: previewExpense.currency || defaultCurrency,
                supplierName: previewExpense.supplierName || null,
                expense: previewExpense,
                isPreview: true,
            });
        });

        const dailyGoal = getGoalForDate(dateStr);
        const dayTargetHours = 24;

        const projectItemsById = new Map<string, PlannerProjectItem>();
        const clientItemsById = new Map<string, PlannerClientItem>();
        const itemHours = new Map<string, {
            rawHours: number;
            effectiveHours: number;
            actualHours: number;
            isActualBased: boolean;
        }>();

        items.forEach((item) => {
            const actualHours = (item.actualTimeMs || 0) / 3600000;
            const hasEstimate = typeof item.estimatedHours === 'number' && item.estimatedHours >= 0;
            const rawHours = hasEstimate
                ? (item.estimatedHours || 0)
                : (actualHours > 0 ? actualHours : 0);

            let effectiveHours = rawHours;
            let isActualBased = false;

            if (actualHours > rawHours) {
                effectiveHours = actualHours;
                isActualBased = true;
            }

            itemHours.set(item.key, { rawHours, effectiveHours, actualHours, isActualBased });

            if (item.type === 'project') {
                projectItemsById.set(item.entity.id, item);
            }

            if (item.type === 'client') {
                clientItemsById.set(item.entity.id, item);
            }
        });

        const taskHoursByProject = new Map<string, number>();
        const taskHoursByClient = new Map<string, number>();

        items.forEach((item) => {
            if (item.type !== 'task') return;
            const hours = itemHours.get(item.key)?.effectiveHours || 0;
            const projectId = item.entity.projectId || null;

            if (projectId && projectItemsById.has(projectId)) {
                taskHoursByProject.set(projectId, (taskHoursByProject.get(projectId) || 0) + hours);
                return;
            }

            if (projectId) {
                const clientId = projectClientMap.get(projectId) || null;
                if (clientId && clientItemsById.has(clientId)) {
                    taskHoursByClient.set(clientId, (taskHoursByClient.get(clientId) || 0) + hours);
                }
            }
        });

        const projectRawHoursById = new Map<string, number>();
        items.forEach((item) => {
            if (item.type !== 'project') return;
            const rawHours = itemHours.get(item.key)?.rawHours || 0;
            projectRawHoursById.set(item.entity.id, rawHours);
        });

        return items.map((item) => {
            const base = itemHours.get(item.key);
            if (!base) return item;

            let effectiveHours = base.effectiveHours;

            if (item.type === 'project') {
                const childHours = taskHoursByProject.get(item.entity.id) || 0;
                effectiveHours = Math.max(0, effectiveHours - childHours);
            }

            if (item.type === 'client') {
                let childProjectHours = 0;
                projectItemsById.forEach((projectItem) => {
                    if (projectItem.entity.preferredClientId === item.entity.id) {
                        childProjectHours += projectRawHoursById.get(projectItem.entity.id) || 0;
                    }
                });

                const childTaskHours = taskHoursByClient.get(item.entity.id) || 0;
                effectiveHours = Math.max(0, effectiveHours - childProjectHours - childTaskHours);
            }

            const heightPercent = dayTargetHours > 0 ? (effectiveHours / dayTargetHours) : 0;

            return {
                ...item,
                rawHours: base.rawHours,
                effectiveHours,
                heightPercent,
                isActualBased: base.isActualBased,
            };
        });
    }, [getForDate, clientsById, projectsById, tasks, tasksById, entries, expenses, recurrences, expenseDatesByRecurrence, isTaskCompletedOnDate, isTaskVisibleOnDate, isClientVisibleOnDate, isProjectVisibleOnDate, getTaskColor, getExpenseColor, getClientTimeOnDate, getProjectTimeOnDate, getTaskTimeOnDate, activeTimerTaskIds, safeTodayStr, getEntryOverlapMs, getGoalForDate, projectClientMap, defaultCurrency]);

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
                totalEarnings: getTotalEarningsOnDate(dateStr),
                dailyGoal: getGoalForDate(dateStr),
            };
        });
    }, [weekStart, buildDayItems, getTotalTimeOnDate, getTotalEarningsOnDate, getGoalForDate]);

    return {
        weekDays,
        weekStart,
        weekStartStr,
        isLoading,
    };
}
