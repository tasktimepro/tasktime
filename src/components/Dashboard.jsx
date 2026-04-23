import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import TaskTimer from './TaskTimer';
import {
    formatDuration,
    parseStoredDate,
    toStorageDate
} from '../utils/dateUtils';
import { addDays, endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns';
import { useToast } from '../hooks/useToast';
import { useTasks } from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimers } from '../hooks/useTimers';
import { useExpenses } from '../hooks/useExpenses';
import { useExpenseRecurrences } from '../hooks/useExpenseRecurrences';
import { usePreferences } from '../hooks/usePreferences';
import { THIRTY_DAYS_MS, ONE_HOUR_MS, ONE_MINUTE_MS } from '../constants/app';
import useCurrencyConversion from './dashboard/hooks/useCurrencyConversion';
import useMetricsCalculation from './dashboard/hooks/useMetricsCalculation';
import MetricsCards from './dashboard/MetricsCards';
import RecentTasks from './dashboard/RecentTasks';
import ProjectsOverview from './dashboard/ProjectsOverview';
import TimeEntriesOverview from './dashboard/TimeEntriesOverview';
import ExpensesOverview from './dashboard/ExpensesOverview';
import { DEFAULT_EXPENSES_FILTER, DEFAULT_TIME_ENTRIES_PROJECT_FILTER } from './dashboard/dashboardWidgetConstants';
import ToDoToday from './dashboard/ToDoToday';
import {
    buildDashboardProjects,
    buildDashboardTasks,
    DEFAULT_PROJECT_FILTER,
    DEFAULT_TASK_FILTER,
} from './dashboard/dashboardOverviewUtils.ts';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { CornerDownRightIcon } from '@/components/ui/icons';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useTodayString } from '@/hooks/useDayRollover';
import { linkifyNodes } from '@/utils/linkifyUtils';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate } from '@/utils/expenseUtils';
import { buildBillableDurationFields } from '@/utils/timeEntryDurationUtils.ts';
import AddTimeEntryModal from '@/components/modals/AddTimeEntryModal';
import { STALE_EXCHANGE_RATES_ERROR } from '../utils/currencyUtils';

const STALE_EXCHANGE_RATES_WARNING_DATE_KEY = 'tasktime-stale-exchange-rates-warning-date';

const getStaleExchangeRatesWarningDate = (todayStr) => {
    return todayStr || toStorageDate(new Date()) || null;
};

const hasShownStaleExchangeRatesWarningOnDate = (dateStr) => {
    if (typeof window === 'undefined' || !dateStr) {
        return false;
    }

    try {
        return localStorage.getItem(STALE_EXCHANGE_RATES_WARNING_DATE_KEY) === dateStr;
    } catch {
        return false;
    }
};

const markStaleExchangeRatesWarningShown = (dateStr) => {
    if (typeof window === 'undefined' || !dateStr) {
        return;
    }

    try {
        localStorage.setItem(STALE_EXCHANGE_RATES_WARNING_DATE_KEY, dateStr);
    } catch {
        // Ignore localStorage failures and continue showing the warning.
    }
};

/**
 * Dashboard component - Main dashboard with metrics, recent tasks, projects, and invoicing overview
 */
const Dashboard = ({
    projects = [],
    invoices = [],
    clients = [],
    navigateToProject,
    navigateToClient,
    navigateToInvoices,
    onEditTask,
    onViewTask,
    openExpenseView
}) => {
    const hasClients = clients.length > 0;
    const { showWarning, showSuccess } = useToast();
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [taskFilter, setTaskFilter] = useState(DEFAULT_TASK_FILTER);
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState(DEFAULT_PROJECT_FILTER);
    const [timeEntriesProjectFilter, setTimeEntriesProjectFilter] = useState(DEFAULT_TIME_ENTRIES_PROJECT_FILTER);
    const [expenseFilter, setExpenseFilter] = useState(DEFAULT_EXPENSES_FILTER);
    
    // Use Yjs hooks directly
    const {
        activeTasks,
        archivedTasks,
        updateTask,
        deleteTask,
        archiveTask,
        getOverdueTasks,
        getTasksForToday,
        getUpcomingTasks,
        toggleRecurringCompletion,
        isCompletedOnDate,
        getRecurringStatus,
        resetExpiredSkips,
        archivedLoading,
        archivedLoaded,
    } = useTasks({ includeArchived: true });
    const { entries: timeEntries, createEntry, deleteEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    const { expenses } = useExpenses();
    const { recurrences } = useExpenseRecurrences();
    const { preferences } = usePreferences();
    const { getForDate } = usePlannerAttachments();
    const [conversionWarningShown, setConversionWarningShown] = useState(false);
    const lastWarningKeyRef = useRef(null);
    const todayStr = useTodayString();
    const [showAddEntryModal, setShowAddEntryModal] = useState(false);
    const [addEntryTask, setAddEntryTask] = useState(null);
    const [addEntryDateStr, setAddEntryDateStr] = useState(null);

    // Defer below-fold widgets until after the initial paint so the
    // priority sections (ToDoToday + MetricsCards) appear instantly.
    const [deferredReady, setDeferredReady] = useState(false);
    useEffect(() => { setDeferredReady(true); }, []);

    // Reset stale skip flags once on mount / when date changes
    useEffect(() => {
        resetExpiredSkips();
    }, [todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

    const resolveRecurringActionDate = useCallback((task) => {
        if (!task?.recurring || !todayStr) return null;

        const status = getRecurringStatus(task, todayStr);

        if (status.effectiveDateStr) {
            return status.effectiveDateStr;
        }

        const lastActiveStr = task.lastActive
            ? toStorageDate(new Date(task.lastActive))
            : null;

        if (
            !status.isDueToday
            && !status.isOverdue
            && status.lastDueDateStr
            && lastActiveStr === todayStr
            && isCompletedOnDate(task, status.lastDueDateStr)
        ) {
            return status.lastDueDateStr;
        }

        return todayStr;
    }, [getRecurringStatus, isCompletedOnDate, todayStr]);

    const getTaskCompletedStatus = useCallback((task) => {
        if (task.recurring && todayStr) {
            const actionDateStr = resolveRecurringActionDate(task);
            if (!actionDateStr) return false;
            return isCompletedOnDate(task, actionDateStr);
        }
        return task.completed || false;
    }, [isCompletedOnDate, resolveRecurringActionDate, todayStr]);

    const {
        preferredCurrency,
        exchangeRates,
        exchangeRatesLoading,
        exchangeRatesError,
        needsExchangeRates,
        missingExchangeRates,
        convertToCurrency
    } = useCurrencyConversion({ projects, invoices, clients });

    const {
        thisMonthMetrics,
        lastMonthMetrics,
        last90DaysMetrics,
        invoiceMetrics,
        thisMonthBillableHours,
        thisMonthUnbilledDisplay
    } = useMetricsCalculation({
        timeEntries,
        tasks: activeTasks,
        projects,
        invoices,
        clients,
        preferredCurrency,
        convertToCurrency
    });

    const expenseMetricsByCurrency = useMemo(() => {
        const todayDate = parseStoredDate(todayStr) || new Date();
        const monthStart = startOfMonth(todayDate);
        const monthEnd = endOfMonth(todayDate);
        const lastMonthStart = startOfMonth(subMonths(todayDate, 1));
        const lastMonthEnd = endOfMonth(subMonths(todayDate, 1));
        const last90Start = subDays(todayDate, 89);

        const monthEndStr = toStorageDate(monthEnd) || '';
        const upcomingStart = addDays(todayDate, 1);
        const upcomingStartStr = toStorageDate(upcomingStart) || '';

        const datesByRecurrence = new Map();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!datesByRecurrence.has(expense.recurrenceId)) {
                datesByRecurrence.set(expense.recurrenceId, new Set());
            }
            datesByRecurrence.get(expense.recurrenceId).add(expense.date);
        });

        const recurringPreviews = recurrences
            .filter((recurrence) => recurrence.active)
            .map((recurrence) => {
                if (!upcomingStartStr || !monthEndStr) return null;

                const baseStart = recurrence.lastGeneratedDate
                    ? advanceByRepeat(
                        recurrence.lastGeneratedDate,
                        recurrence.repeat,
                        recurrence.monthlyType,
                        recurrence.monthlyDay
                    )
                    : recurrence.startDate;

                const nextDate = getNextRecurringDate({
                    startDate: baseStart,
                    repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
                    endDate: recurrence.endDate,
                    fromDate: upcomingStartStr,
                });

                if (!nextDate) return null;
                const nextParsed = parseStoredDate(nextDate);
                if (!nextParsed || nextParsed > monthEnd) return null;

                const existingDates = datesByRecurrence.get(recurrence.id);
                if (existingDates?.has(nextDate)) {
                    return null;
                }

                const preview = buildExpenseFromRecurrence(recurrence, nextDate);
                return {
                    ...preview,
                    id: `preview-${recurrence.id}-${nextDate}`,
                    isPreview: true,
                };
            })
            .filter(Boolean);

        const upcomingExpenses = [...expenses, ...recurringPreviews].filter((expense) => {
            const expenseDate = parseStoredDate(expense.date);
            if (!expenseDate) return false;
            if (expenseDate <= todayDate) return false;
            return expenseDate >= monthStart && expenseDate <= monthEnd;
        });

        const addAmount = (acc, key, currency, amount) => {
            acc[key][currency] = (acc[key][currency] || 0) + (amount || 0);
        };

        const initial = {
            upcomingThisMonth: {},
            upcomingThisMonthHasEstimate: false,
            paidThisMonth: {},
            paidLastMonth: {},
            paidLast90Days: {},
        };

        const withUpcoming = upcomingExpenses.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || 'EUR';
            addAmount(acc, 'upcomingThisMonth', currency, expense.amount || 0);
            if (expense.amountType === 'variable') {
                acc.upcomingThisMonthHasEstimate = true;
            }
            return acc;
        }, initial);

        return expenses.reduce((acc, expense) => {
            const expenseDate = parseStoredDate(expense.date);
            if (!expenseDate) return acc;

            const currency = expense.currency || preferences.currency || 'EUR';
            const amount = expense.amount || 0;

            if (expenseDate >= monthStart && expenseDate <= monthEnd && expenseDate <= todayDate && expense.paymentStatus === 'paid') {
                addAmount(acc, 'paidThisMonth', currency, amount);
            }

            if (expense.paymentStatus === 'paid') {
                if (expenseDate >= lastMonthStart && expenseDate <= lastMonthEnd) {
                    addAmount(acc, 'paidLastMonth', currency, amount);
                }

                if (expenseDate >= last90Start && expenseDate <= todayDate) {
                    addAmount(acc, 'paidLast90Days', currency, amount);
                }
            }

            return acc;
        }, withUpcoming);
    }, [expenses, preferences.currency, recurrences, todayStr]);

    const expenseMetrics = useMemo(() => {
        const upcoming = convertToCurrency(expenseMetricsByCurrency.upcomingThisMonth);
        const paidThisMonth = convertToCurrency(expenseMetricsByCurrency.paidThisMonth);
        const paidLastMonth = convertToCurrency(expenseMetricsByCurrency.paidLastMonth);
        const paidLast90Days = convertToCurrency(expenseMetricsByCurrency.paidLast90Days);

        return {
            upcomingThisMonthTotal: upcoming.amounts[preferredCurrency] || 0,
            upcomingThisMonthHasEstimate: expenseMetricsByCurrency.upcomingThisMonthHasEstimate,
            paidThisMonthTotal: paidThisMonth.amounts[preferredCurrency] || 0,
            paidLastMonthTotal: paidLastMonth.amounts[preferredCurrency] || 0,
            paidLast90DaysTotal: paidLast90Days.amounts[preferredCurrency] || 0,
        };
    }, [convertToCurrency, expenseMetricsByCurrency, preferredCurrency]);

    // Show warning if any conversion errors occurred (only once per session)
    useEffect(() => {
        if (!needsExchangeRates || exchangeRatesLoading) {
            return;
        }

        // Wait until exchange rates have been fetched before checking for errors
        // exchangeRates being null means we haven't fetched yet (unless there was an error)
        if (!exchangeRates && !exchangeRatesError) {
            return;
        }

        if (exchangeRatesError) {
            const staleWarningDate = getStaleExchangeRatesWarningDate(todayStr);
            const isStaleExchangeRatesError = exchangeRatesError === STALE_EXCHANGE_RATES_ERROR;
            const warningKey = isStaleExchangeRatesError
                ? `error:${exchangeRatesError}:${staleWarningDate || 'unknown-date'}`
                : `error:${exchangeRatesError}`;

            if (isStaleExchangeRatesError && hasShownStaleExchangeRatesWarningOnDate(staleWarningDate)) {
                return;
            }

            if (!conversionWarningShown && lastWarningKeyRef.current !== warningKey) {
                lastWarningKeyRef.current = warningKey;
                showWarning(exchangeRatesError);

                if (isStaleExchangeRatesError) {
                    markStaleExchangeRatesWarningShown(staleWarningDate);
                }

                setConversionWarningShown(true);
            }
            return;
        }

        if (missingExchangeRates.length > 0) {
            const warningKey = `missing:${missingExchangeRates.join(',')}`;
            if (!conversionWarningShown && lastWarningKeyRef.current !== warningKey) {
                lastWarningKeyRef.current = warningKey;
                showWarning(`Missing exchange rates for: ${missingExchangeRates.join(', ')}. Amounts will show in original currency.`);
                setConversionWarningShown(true);
            }
            return;
        }

        const hasConversionErrors =
            thisMonthMetrics.hadConversionError ||
            lastMonthMetrics.hadConversionError ||
            last90DaysMetrics.hadConversionError;

        if (hasConversionErrors) {
            const warningKey = 'conversion:generic';
            if (!conversionWarningShown && lastWarningKeyRef.current !== warningKey) {
                lastWarningKeyRef.current = warningKey;
                showWarning('Some currency conversions could not be completed. Amounts may be approximate.');
                setConversionWarningShown(true);
            }
        }
    }, [
        thisMonthMetrics,
        lastMonthMetrics,
        last90DaysMetrics,
        conversionWarningShown,
        needsExchangeRates,
        exchangeRatesLoading,
        exchangeRates,
        exchangeRatesError,
        todayStr,
        missingExchangeRates,
        showWarning
    ]);

    /**
     * Get dashboard task list for the selected filter.
     */
    const recentTasks = useMemo(() => {
        return buildDashboardTasks({
            activeTasks,
            archivedTasks,
            projects,
            timeEntries,
            timers,
            taskFilter,
            taskSearchQuery,
            todayStr,
            getTaskCompletedStatus,
        });
    }, [activeTasks, archivedTasks, projects, timeEntries, timers, taskFilter, taskSearchQuery, todayStr, getTaskCompletedStatus]);

    /**
     * Get dashboard project list for the selected filter.
     */
    const recentProjects = useMemo(() => {
        return buildDashboardProjects({
            projects,
            activeTasks,
            timeEntries,
            clients,
            invoices,
            expenses,
            recurrences,
            projectFilter,
            projectSearchQuery,
        });
    }, [projects, activeTasks, timeEntries, clients, invoices, expenses, recurrences, projectFilter, projectSearchQuery]);

    const allTasks = useMemo(() => {
        return [...activeTasks, ...archivedTasks];
    }, [activeTasks, archivedTasks]);

    const tasksById = useMemo(() => {
        return new Map(allTasks.map((task) => [task.id, task]));
    }, [allTasks]);

    const projectsById = useMemo(() => {
        return new Map(projects.map((project) => [project.id, project]));
    }, [projects]);

    const clientsById = useMemo(() => {
        return new Map(clients.map((client) => [client.id, client]));
    }, [clients]);

    const sortedDashboardProjects = useMemo(() => {
        return [...projects]
            .filter((project) => !project.archived)
            .sort((left, right) => left.title.localeCompare(right.title));
    }, [projects]);

    const recurringPreviewExpenses = useMemo(() => {
        if (!todayStr) {
            return [];
        }

        const datesByRecurrence = new Map();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!datesByRecurrence.has(expense.recurrenceId)) {
                datesByRecurrence.set(expense.recurrenceId, new Set());
            }
            datesByRecurrence.get(expense.recurrenceId).add(expense.date);
        });

        return recurrences
            .filter((recurrence) => recurrence.active)
            .map((recurrence) => {
                const baseStart = recurrence.lastGeneratedDate
                    ? advanceByRepeat(
                        recurrence.lastGeneratedDate,
                        recurrence.repeat,
                        recurrence.monthlyType,
                        recurrence.monthlyDay
                    )
                    : recurrence.startDate;

                const nextDate = getNextRecurringDate({
                    startDate: baseStart,
                    repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
                    endDate: recurrence.endDate,
                    fromDate: todayStr,
                });

                if (!nextDate) {
                    return null;
                }

                if (datesByRecurrence.get(recurrence.id)?.has(nextDate)) {
                    return null;
                }

                return {
                    ...buildExpenseFromRecurrence(recurrence, nextDate),
                    id: `dashboard-preview-${recurrence.id}-${nextDate}`,
                    isPreview: true,
                };
            })
            .filter(Boolean);
    }, [expenses, recurrences, todayStr]);

    const dashboardTimeEntries = useMemo(() => {
        const todayDate = parseStoredDate(todayStr);
        const rangeStart = todayDate ? subDays(todayDate, 29) : null;

        return timeEntries
            .map((entry) => {
                const task = tasksById.get(entry.taskId) || null;
                const project = task?.projectId ? projectsById.get(task.projectId) || null : null;

                return {
                    ...entry,
                    task,
                    project,
                };
            })
            .filter((entry) => {
                if (timeEntriesProjectFilter === DEFAULT_TIME_ENTRIES_PROJECT_FILTER) {
                    const entryDateValue = typeof entry.end === 'number' ? entry.end : entry.start;
                    const entryDate = new Date(entryDateValue);

                    if (todayDate && rangeStart) {
                        return entryDate >= rangeStart && entryDate <= todayDate;
                    }

                    return true;
                }

                const entryDateValue = typeof entry.end === 'number' ? entry.end : entry.start;
                const entryDate = new Date(entryDateValue);
                const matchesProject = entry.project?.id === timeEntriesProjectFilter;

                if (!matchesProject) {
                    return false;
                }

                if (todayDate && rangeStart) {
                    return entryDate >= rangeStart && entryDate <= todayDate;
                }

                return true;
            })
            .sort((left, right) => {
                const leftDate = left.end || left.start || 0;
                const rightDate = right.end || right.start || 0;
                return rightDate - leftDate;
            });
    }, [timeEntries, tasksById, projectsById, timeEntriesProjectFilter, todayStr]);

    const dashboardExpenses = useMemo(() => {
        const todayDate = parseStoredDate(todayStr);
        const rangeStart = todayDate ? subDays(todayDate, 29) : null;
        const rangeEnd = todayDate ? addDays(todayDate, 29) : null;
        const resolvedExpenses = expenses.map((expense) => ({
            ...expense,
            client: expense.clientId ? clientsById.get(expense.clientId) || null : null,
            project: expense.projectId ? projectsById.get(expense.projectId) || null : null,
        }));

        const combinedRecurring = [
            ...resolvedExpenses.filter((expense) => expense.recurrenceId),
            ...recurringPreviewExpenses.map((expense) => ({
                ...expense,
                client: expense.clientId ? clientsById.get(expense.clientId) || null : null,
                project: expense.projectId ? projectsById.get(expense.projectId) || null : null,
            })),
        ];

        const isWithinPast30Days = (dateValue) => {
            if (!todayDate || !rangeStart) {
                return true;
            }

            const expenseDate = parseStoredDate(dateValue);
            if (!expenseDate) {
                return false;
            }

            return expenseDate >= rangeStart && expenseDate <= todayDate;
        };

        const isWithinNext30Days = (dateValue) => {
            if (!todayDate || !rangeEnd) {
                return true;
            }

            const expenseDate = parseStoredDate(dateValue);
            if (!expenseDate) {
                return false;
            }

            return expenseDate >= todayDate && expenseDate <= rangeEnd;
        };

        const isWithinDashboardWindow = (dateValue) => {
            if (!todayDate || !rangeStart || !rangeEnd) {
                return true;
            }

            const expenseDate = parseStoredDate(dateValue);
            if (!expenseDate) {
                return false;
            }

            return expenseDate >= rangeStart && expenseDate <= rangeEnd;
        };

        if (expenseFilter === 'paid') {
            return resolvedExpenses
                .filter((expense) => {
                    if (expense.paymentStatus !== 'paid') {
                        return false;
                    }

                    const expenseDate = parseStoredDate(expense.date);
                    if (!expenseDate || !todayDate) {
                        return true;
                    }

                    return isWithinPast30Days(expense.date)
                        && (expense.paymentMode !== 'auto' || expense.amountType === 'variable' || expenseDate <= todayDate);
                    })
                    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
        }

        if (expenseFilter === 'upcoming') {
            return [
                ...resolvedExpenses.filter((expense) => {
                    const expenseDate = parseStoredDate(expense.date);
                    if (!expenseDate || !todayDate) {
                        return false;
                    }

                    if (!isWithinNext30Days(expense.date)) {
                        return false;
                    }

                    return expense.paymentStatus !== 'paid'
                        || (expense.paymentMode === 'auto' && expense.amountType !== 'variable');
                }),
                ...recurringPreviewExpenses.map((expense) => ({
                    ...expense,
                    client: expense.clientId ? clientsById.get(expense.clientId) || null : null,
                    project: expense.projectId ? projectsById.get(expense.projectId) || null : null,
                })),
            ]
                .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
        }

        return combinedRecurring
            .filter((expense) => {
                if (!isWithinDashboardWindow(expense.date)) {
                    return false;
                }

                if (expense.isPreview) {
                    return true;
                }

                const expenseDate = parseStoredDate(expense.date);
                if (!expenseDate || !todayDate) {
                    return true;
                }

                return expenseDate >= todayDate || expense.paymentStatus !== 'paid';
            })
            .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    }, [expenses, clientsById, projectsById, recurringPreviewExpenses, expenseFilter, todayStr]);

    const taskTimeTotals = useMemo(() => {
        const totals = {};

        timeEntries.forEach((entry) => {
            if (!entry || typeof entry.end !== 'number') return;
            if (entry.end <= entry.start) return;

            totals[entry.taskId] = (totals[entry.taskId] || 0) + (entry.end - entry.start);
        });

        if (timers.length > 0) {
            timers.forEach((timer) => {
                if (!timer || !timer.taskId) return;
                totals[timer.taskId] = (totals[timer.taskId] || 0) + (timer.elapsedTime || 0);
            });
        }

        return totals;
    }, [timeEntries, timers]);

    /**
     * Toggle task completion status
     */
    const handleCompleteTask = useCallback((task) => {
        const isCompleted = getTaskCompletedStatus(task);
        const newCompletedStatus = !isCompleted;
        const now = Date.now();

        // If timer is active for this task and we're completing it, stop the timer
        const activeTimer = timers.find(timer => timer.taskId === task.id);
        if (newCompletedStatus && activeTimer) {
            const endTime = activeTimer.isPaused && activeTimer.elapsedTime > 0
                ? activeTimer.startTime + activeTimer.elapsedTime
                : now;

            createEntry({
                taskId: task.id,
                start: activeTimer.startTime,
                end: endTime,
                note: activeTimer.note,
                _stoppedTimerKey: task.projectId || task.id,
                _stoppedTimerInstanceId: activeTimer.timerInstanceId,
                ...buildBillableDurationFields({
                    start: activeTimer.startTime,
                    end: endTime,
                    billingIncrementMinutes: projects.find(project => project.id === task.projectId)?.billableTimeIncrementMinutes,
                }),
            });

            clearTimer(task.projectId || task.id);
        }

        // Update task completion status and lastActive timestamp
        if (task.recurring && todayStr) {
            const effectiveDateStr = resolveRecurringActionDate(task) || todayStr;
            toggleRecurringCompletion(task.id, effectiveDateStr);
            if (newCompletedStatus && task.promptTimeEntry) {
                setAddEntryTask(task);
                setAddEntryDateStr(effectiveDateStr);
                setShowAddEntryModal(true);
            }
        } else {
            updateTask(task.id, {
                completed: newCompletedStatus,
                completedOnDate: newCompletedStatus ? todayStr : null,
                lastActive: now
            });
        }
    }, [timers, createEntry, clearTimer, updateTask, getTaskCompletedStatus, toggleRecurringCompletion, todayStr, resolveRecurringActionDate, projects]);

    /**
     * Handle clicking on task title to navigate to project
     */
    const handleTaskTitleClick = useCallback((task) => {
        if (!task) return;

        if (task?.recurring && todayStr) {
            const effectiveDateStr = resolveRecurringActionDate(task) || todayStr;
            onViewTask?.(task, { dateStr: effectiveDateStr });
            return;
        }

        onViewTask?.(task, { dateStr: todayStr });
    }, [onViewTask, todayStr, resolveRecurringActionDate]);

    const handleProjectTitleClick = useCallback((task) => {
        if (task?.project?.id && navigateToProject) {
            navigateToProject(task.project.id);
        }
    }, [navigateToProject]);

    const handleEditTask = useCallback((task) => {
        if (onEditTask) {
            onEditTask(task);
        }
    }, [onEditTask]);


    /**
     * Handle clicking on client title to navigate to client dashboard
     */
    const handleClientTitleClick = useCallback((client) => {
        if (client?.id && navigateToClient) {
            navigateToClient(client.id);
        }
    }, [navigateToClient]);

    /**
     * Render task timer controls
     */
    const renderTaskControls = useCallback((task, shouldDisable) => {
        if (getTaskCompletedStatus(task)) return null;

        // If timer is active for another task and this task should be disabled, don't render controls
        if (shouldDisable) {
            return null;
        }

        return (
            <TaskTimer
                task={task}
                isGlobalTimer={true}
                showTimeDisplay={false}
                size="sm"
            />
        );
    }, [getTaskCompletedStatus]);

    /**
     * Render task title with navigation
     */
    const renderTaskTitle = useCallback((task, isCompleted) => {
        const baseClasses = `block w-full text-sm font-medium text-left transition-colors whitespace-normal break-words sm:truncate ${
            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
        }`;

        const titleClass = isCompleted ? 'line-through' : '';
        const title = task.parentTaskId ? (
            <span className={`inline-flex items-center ${titleClass}`}>
                <CornerDownRightIcon className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                {task.title}
                {!task.parentTask && <span className="text-destructive-strong text-xs"> [Parent missing]</span>}
            </span>
        ) : (
            <span className={titleClass}>{task.title}</span>
        );

        const hasProject = !!task.project?.title;
        const hasNote = !!task.note;

        return (
            <div className="space-y-1">
                <button
                    onClick={() => handleTaskTitleClick(task)}
                    className={`${baseClasses} cursor-pointer ${
                        isCompleted ? 'hover:text-muted-foreground' : 'hover-status-info-text-strong'
                    }`}
                    title="Open task details"
                >
                    {title}
                </button>
                {(hasProject || hasNote) && (
                    <p className={`text-xs text-muted-foreground whitespace-normal break-words sm:truncate ${isCompleted ? 'line-through' : ''}`}>
                        {hasProject && (
                            <button
                                type="button"
                                onClick={() => handleProjectTitleClick(task)}
                                className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                title={task.project?.title ? `Click to open ${task.project.title} project` : 'Open project'}
                            >
                                {task.project.title}
                            </button>
                        )}
                        {hasProject && hasNote && <span className="mx-1">•</span>}
                        {hasNote && (
                            <span>
                                {linkifyNodes(task.note, React.createElement, {
                                    linkClassName: 'text-muted-foreground hover:text-foreground hover:underline'
                                })}
                            </span>
                        )}
                    </p>
                )}
            </div>
        );
    }, [handleTaskTitleClick, handleProjectTitleClick]);

    const enhanceTaskList = useCallback((list) => {
        return list.map((task) => {
            const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
            const parentTask = task.parentTaskId ? activeTasks.find(t => t.id === task.parentTaskId) : null;
            const recurringStatus = task.recurring && todayStr ? getRecurringStatus(task, todayStr) : null;

            return {
                ...task,
                project,
                parentTask,
                recentTime: taskTimeTotals[task.id] || 0,
                recurringStatus
            };
        });
    }, [projects, activeTasks, taskTimeTotals, getRecurringStatus, todayStr]);

    const overdueTasks = useMemo(() => {
        return enhanceTaskList(getOverdueTasks());
    }, [getOverdueTasks, enhanceTaskList]);

    const attachedTasksForToday = useMemo(() => {
        if (!todayStr) return [];

        const attachments = getForDate(todayStr).filter((attachment) => attachment.type === 'task');
        const tasksById = new Map(activeTasks.map((task) => [task.id, task]));

        return attachments
            .map((attachment) => tasksById.get(attachment.referenceId))
            .filter(Boolean);
    }, [getForDate, todayStr, activeTasks]);

    const tasksForToday = useMemo(() => {
        const baseTasks = getTasksForToday();
        const baseTaskIds = new Set(baseTasks.map((task) => task.id));
        const combined = [
            ...baseTasks,
            ...attachedTasksForToday.filter((task) => !baseTaskIds.has(task.id))
        ];

        return enhanceTaskList(combined);
    }, [getTasksForToday, enhanceTaskList, attachedTasksForToday]);

    const upcomingTasks = useMemo(() => {
        return enhanceTaskList(getUpcomingTasks(7));
    }, [getUpcomingTasks, enhanceTaskList]);

    const handleDeleteTask = useCallback((task) => {
        if (!task) return;

        const availableTasks = task.archived
            ? [...activeTasks, ...archivedTasks]
            : activeTasks;

        const taskIdsToDelete = task.parentTaskId
            ? [task.id]
            : getTaskIdsToDelete(task.id, availableTasks);

        const entriesToDelete = timeEntries.filter(entry => taskIdsToDelete.includes(entry.taskId));
        entriesToDelete.forEach(entry => deleteEntry(entry.id));

        timers.forEach(timer => {
            if (taskIdsToDelete.includes(timer.taskId)) {
                clearTimer(timer.projectId);
            }
        });

        Promise.all(taskIdsToDelete.map(id => deleteTask(id))).then(() => {
            showSuccess('Task deleted');
        });
    }, [activeTasks, archivedTasks, timeEntries, timers, deleteEntry, clearTimer, deleteTask, showSuccess]);

    const handleArchiveTask = useCallback((task) => {
        if (!task || task.projectId) return;

        timers.forEach(timer => {
            if (timer.taskId === task.id) {
                clearTimer(timer.projectId || task.id);
            }
        });

        archiveTask(task.id);
        showSuccess('Task archived');
    }, [archiveTask, timers, clearTimer, showSuccess]);

    const reportsOverview = (
        <MetricsCards
            thisMonthMetrics={thisMonthMetrics}
            lastMonthMetrics={lastMonthMetrics}
            last90DaysMetrics={last90DaysMetrics}
            invoiceMetrics={invoiceMetrics}
            thisMonthBillableHours={thisMonthBillableHours}
            thisMonthUnbilledDisplay={thisMonthUnbilledDisplay}
            expenseThisMonthUpcomingTotal={expenseMetrics.upcomingThisMonthTotal}
            expenseThisMonthUpcomingHasEstimate={expenseMetrics.upcomingThisMonthHasEstimate}
            expenseThisMonthPaidTotal={expenseMetrics.paidThisMonthTotal}
            expenseLastMonthPaidTotal={expenseMetrics.paidLastMonthTotal}
            expenseLast90DaysPaidTotal={expenseMetrics.paidLast90DaysTotal}
            hasClients={hasClients}
            preferredCurrency={preferredCurrency}
            formatDuration={formatDuration}
            needsExchangeRates={needsExchangeRates}
            exchangeRatesLoading={exchangeRatesLoading}
            navigateToInvoices={navigateToInvoices}
        />
    );


    return (
        <div className="space-y-6">
            <ToDoToday
                overdueTasks={overdueTasks}
                tasksForToday={tasksForToday}
                upcomingTasks={upcomingTasks}
                handleCompleteTask={handleCompleteTask}
                getTaskCompletedStatus={getTaskCompletedStatus}
                renderTaskTitle={renderTaskTitle}
                renderTaskControls={renderTaskControls}
                handleProjectTitleClick={handleProjectTitleClick}
                onTaskTitleClick={handleTaskTitleClick}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onArchiveTask={handleArchiveTask}
                openExpenseView={openExpenseView}
            />

            {reportsOverview}

            {/* Below-fold widgets deferred until after initial paint */}
            {deferredReady && (
                <>
                    {/* Recent Tasks and Projects Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <RecentTasks
                            recentTasks={recentTasks}
                            taskFilter={taskFilter}
                            setTaskFilter={setTaskFilter}
                            taskSearchQuery={taskSearchQuery}
                            setTaskSearchQuery={setTaskSearchQuery}
                            isLoading={taskFilter === 'archived' && archivedLoading && !archivedLoaded}
                            handleCompleteTask={handleCompleteTask}
                            getTaskCompletedStatus={getTaskCompletedStatus}
                            renderTaskTitle={renderTaskTitle}
                            handleProjectTitleClick={handleProjectTitleClick}
                            renderTaskControls={renderTaskControls}
                            onEditTask={handleEditTask}
                            onDeleteTask={handleDeleteTask}
                            onArchiveTask={handleArchiveTask}
                        />

                        <ProjectsOverview
                            recentProjects={recentProjects}
                            projectFilter={projectFilter}
                            setProjectFilter={setProjectFilter}
                            projectSearchQuery={projectSearchQuery}
                            setProjectSearchQuery={setProjectSearchQuery}
                            navigateToProject={navigateToProject}
                            handleClientTitleClick={handleClientTitleClick}
                            clients={clients}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <TimeEntriesOverview
                            entries={dashboardTimeEntries}
                            projects={sortedDashboardProjects}
                            projectFilter={timeEntriesProjectFilter}
                            setProjectFilter={setTimeEntriesProjectFilter}
                            onTaskClick={handleTaskTitleClick}
                            onProjectClick={navigateToProject}
                        />

                        <ExpensesOverview
                            expenses={dashboardExpenses}
                            expenseFilter={expenseFilter}
                            setExpenseFilter={setExpenseFilter}
                            preferredCurrency={preferences.currency}
                            onExpenseClick={openExpenseView}
                        />
                    </div>
                </>
            )}

            <AddTimeEntryModal
                isOpen={showAddEntryModal}
                onClose={() => {
                    setShowAddEntryModal(false);
                    setAddEntryTask(null);
                    setAddEntryDateStr(null);
                }}
                task={addEntryTask}
                initialDateStr={addEntryDateStr}
            />

        </div>
    );
};

export default React.memo(Dashboard);
