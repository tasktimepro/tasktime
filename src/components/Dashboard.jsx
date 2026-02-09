import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import TaskTimer from './TaskTimer';
import {
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';
import { useTasks } from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimers } from '../hooks/useTimers';
import { useExpenses } from '../hooks/useExpenses';
import { usePreferences } from '../hooks/usePreferences';
import { THIRTY_DAYS_MS, ONE_HOUR_MS, ONE_MINUTE_MS } from '../constants/app';
import useCurrencyConversion from './dashboard/hooks/useCurrencyConversion';
import useMetricsCalculation from './dashboard/hooks/useMetricsCalculation';
import MetricsCards from './dashboard/MetricsCards';
import RecentTasks from './dashboard/RecentTasks';
import ProjectsOverview from './dashboard/ProjectsOverview';
import ToDoToday from './dashboard/ToDoToday';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { CornerDownRightIcon } from '@/components/ui/icons';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useTodayString } from '@/hooks/useDayRollover';
import { linkifyNodes } from '@/utils/linkifyUtils';

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
    
    // Use Yjs hooks directly
    const { tasks, updateTask, deleteTask, archiveTask, getOverdueTasks, getTasksForToday, getUpcomingTasks, toggleRecurringCompletion, isCompletedOnDate, getRecurringStatus } = useTasks();
    const { entries: timeEntries, createEntry, deleteEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    const { expenses } = useExpenses();
    const { preferences } = usePreferences();
    const { getForDate } = usePlannerAttachments();
    
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [conversionWarningShown, setConversionWarningShown] = useState(false);
    const lastWarningKeyRef = useRef(null);
    const todayStr = useTodayString();

    const getTaskCompletedStatus = useCallback((task) => {
        if (task.recurring && todayStr) {
            const status = getRecurringStatus(task, todayStr);
            if (status.effectiveDateStr) {
                return isCompletedOnDate(task, status.effectiveDateStr);
            }
            return false;
        }
        return task.completed || false;
    }, [getRecurringStatus, isCompletedOnDate, todayStr]);

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
        tasks,
        projects,
        invoices,
        clients,
        preferredCurrency,
        convertToCurrency
    });

    const expenseMetricsByCurrency = useMemo(() => {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const inMonth = expenses.filter((expense) => {
            const date = new Date(expense.date);
            if (Number.isNaN(date.getTime())) return false;
            return date >= monthStart && date <= monthEnd;
        });

        const initial = { total: {}, unpaid: {}, billableUnbilled: {} };

        return inMonth.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || 'EUR';
            acc.total[currency] = (acc.total[currency] || 0) + (expense.amount || 0);

            if (expense.paymentStatus === 'unpaid') {
                acc.unpaid[currency] = (acc.unpaid[currency] || 0) + (expense.amount || 0);
            }

            if (expense.billable && expense.billingStatus === 'unbilled') {
                acc.billableUnbilled[currency] = (acc.billableUnbilled[currency] || 0) + (expense.amount || 0);
            }

            return acc;
        }, initial);
    }, [expenses, preferences.currency]);

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
            const warningKey = `error:${exchangeRatesError}`;
            if (!conversionWarningShown && lastWarningKeyRef.current !== warningKey) {
                lastWarningKeyRef.current = warningKey;
                showWarning(exchangeRatesError);
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
        missingExchangeRates,
        showWarning
    ]);

    /**
     * Get recent active tasks sorted by their most recent activity (any interaction)
     * Tasks completed in current session remain visible until next render
     */
    const recentTasks = useMemo(() => {
        const activeTasks = tasks.filter(task => {
            if (task.archived) return false;
            if (task.recurring) return true;
            return !getTaskCompletedStatus(task) || task.completedOnDate === todayStr;
        });

        const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
        const recentEntries = timeEntries.filter(entry => entry.start > thirtyDaysAgo);

        // Calculate task activity data
        const taskActivity = {};

        // First pass: collect total time for display purposes
        recentEntries.forEach(entry => {
            if (!taskActivity[entry.taskId]) {
                taskActivity[entry.taskId] = {
                    totalTime: 0  // Just for display purposes
                };
            }

            // Track time for display
            taskActivity[entry.taskId].totalTime += (entry.end - entry.start);
        });

        // For currently running timers, calculate display time
        // Note: timer.elapsedTime is already synchronized via master clock from useTimers
        if (timers.length > 0) {
            timers.forEach(timer => {
                if (!taskActivity[timer.taskId]) {
                    taskActivity[timer.taskId] = {
                        totalTime: 0
                    };
                }

                // Use the pre-computed elapsedTime from useTimers (synchronized via master clock)
                taskActivity[timer.taskId].totalTime += timer.elapsedTime;
            });
        }

        // Enhance tasks with project information and activity data
        const enhancedTasks = activeTasks.map(task => {
            const project = projects.find(p => p.id === task.projectId);
            const totalTime = taskActivity[task.id]?.totalTime || 0;
            const hours = Math.floor(millisecondsToHours(totalTime));
            const minutes = Math.floor((totalTime % ONE_HOUR_MS) / ONE_MINUTE_MS);

            // Add parent task information for subtasks
            let parentTask = null;
            if (task.parentTaskId) {
                parentTask = tasks.find(t => t.id === task.parentTaskId);
                if (parentTask) {
                    const parentProject = projects.find(p => p.id === parentTask.projectId);
                    parentTask = { ...parentTask, project: parentProject };
                }
            }

            // For sorting, use the task's built-in lastActive property,
            // or fall back to createdAt if it doesn't exist yet
            const activityTimestamp = task.lastActive || task.createdAt || 0;

            return {
                ...task,
                // For sorting - any task activity timestamp
                lastActive: activityTimestamp,
                // Just for display
                recentTime: totalTime,
                project: project,
                displayTime: `${hours}h ${minutes}m`,
                parentTask
            };
        });

        // If a task has a running timer, make it appear at the top
        if (timers.length > 0) {
            const currentTime = Date.now();
            enhancedTasks.forEach(task => {
                const hasRunningTimer = timers.some(timer =>
                    timer.taskId === task.id && !timer.isPaused
                );
                if (hasRunningTimer) {
                    task.lastActive = currentTime;
                }
            });
        }

        // Sort by the lastActive property (most recent activity first)
        const sortedTasks = enhancedTasks
            .sort((a, b) => {
                // Pure chronological sort by last activity time - highest (most recent) first
                return b.lastActive - a.lastActive;
            })
            .slice(0, 10);

        // Apply search filter if there's a query
        if (taskSearchQuery.trim()) {
            return sortedTasks.filter(task =>
                task.title.toLowerCase().includes(taskSearchQuery.toLowerCase())
            );
        }

        return sortedTasks;
    }, [tasks, timeEntries, projects, taskSearchQuery, timers, getTaskCompletedStatus, todayStr]);

    /**
     * Get recent projects with total time and pending billable amount
     */
    const recentProjects = useMemo(() => {
        const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
        const recentEntries = timeEntries.filter(entry => entry.start > thirtyDaysAgo);

        // Group by project
        const projectActivity = {};
        recentEntries.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task) return;

            if (!projectActivity[task.projectId]) {
                projectActivity[task.projectId] = {
                    totalTime: 0,
                    lastActivity: 0,
                    taskPendingTime: {}
                };
            }
            projectActivity[task.projectId].totalTime += (entry.end - entry.start);
            projectActivity[task.projectId].lastActivity = Math.max(
                projectActivity[task.projectId].lastActivity,
                entry.end
            );

            // Calculate pending billable time with task-by-task rounding (consistent with invoice calculation)
            // Use task.lastBilledAt only - if never billed, all entries are pending
            const taskLastBilledAt = task.lastBilledAt || 0;
            if (entry.start > taskLastBilledAt && task.billable === true && entry.source !== 'invoice-adjustment') {
                if (!projectActivity[task.projectId].taskPendingTime) {
                    projectActivity[task.projectId].taskPendingTime = {};
                }
                if (!projectActivity[task.projectId].taskPendingTime[task.id]) {
                    projectActivity[task.projectId].taskPendingTime[task.id] = 0;
                }
                projectActivity[task.projectId].taskPendingTime[task.id] += (entry.end - entry.start);
            }
        });

        const projectsWithActivity = projects
            .filter(project => !project.archived) // Exclude archived
            .map(project => {
                // Use project activity if it exists, otherwise use defaults
                const activity = projectActivity[project.id] || { totalTime: 0, lastActivity: 0, taskPendingTime: {} };

                // Calculate pending hours using task-by-task rounding (consistent with invoice calculation)
                let pendingTimeHours = 0;
                if (activity.taskPendingTime) {
                    pendingTimeHours = Object.values(activity.taskPendingTime).reduce((total, taskTime) => {
                        const taskHours = millisecondsToHours(taskTime);
                        const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
                        return total + roundedTaskHours;
                    }, 0);
                }

                // For recent projects, always use original currency and rate - no conversion
                const pendingAmount = project.hourlyRate ? pendingTimeHours * project.hourlyRate : 0;

                // Get client information if project has a client
                const client = project.preferredClientId ? clients.find(c => c.id === project.preferredClientId) : null;

                return {
                    ...project,
                    totalTime: activity.totalTime,
                    lastActivity: activity.lastActivity,
                    pendingHours: pendingTimeHours,
                    pendingAmount,
                    client
                };
            })
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .slice(0, 10);

        if (projectSearchQuery.trim()) {
            return projectsWithActivity.filter(project =>
                project.title.toLowerCase().includes(projectSearchQuery.toLowerCase())
            );
        }

        return projectsWithActivity;
    }, [projects, tasks, timeEntries, projectSearchQuery, clients]);

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
                note: activeTimer.note
            });

            clearTimer(task.projectId || task.id);
        }

        // Update task completion status and lastActive timestamp
        if (task.recurring && todayStr) {
            const status = getRecurringStatus(task, todayStr);
            const effectiveDateStr = status.effectiveDateStr || todayStr;
            toggleRecurringCompletion(task.id, effectiveDateStr);
        } else {
            updateTask(task.id, {
                completed: newCompletedStatus,
                completedOnDate: newCompletedStatus ? todayStr : null,
                lastActive: now
            });
        }
    }, [timers, createEntry, clearTimer, updateTask, getTaskCompletedStatus, toggleRecurringCompletion, todayStr, getRecurringStatus]);

    /**
     * Handle clicking on task title to navigate to project
     */
    const handleTaskTitleClick = useCallback((task) => {
        if (!task) return;

        if (task?.recurring && todayStr) {
            const status = getRecurringStatus(task, todayStr);
            onViewTask?.(task, { dateStr: status.effectiveDateStr || todayStr });
            return;
        }

        onViewTask?.(task, { dateStr: todayStr });
    }, [onViewTask, todayStr, getRecurringStatus]);

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
        const baseClasses = `block w-full text-sm font-medium truncate text-left transition-colors ${
            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
        }`;

        const titleClass = isCompleted ? 'line-through' : '';
        const title = task.parentTaskId ? (
            <span className={`inline-flex items-center ${titleClass}`}>
                <CornerDownRightIcon className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                {task.title}
                {!task.parentTask && <span className="text-red-500 text-xs"> [Parent missing]</span>}
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
                        isCompleted ? 'hover:text-muted-foreground' : 'hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                    title="Open task details"
                >
                    {title}
                </button>
                {(hasProject || hasNote) && (
                    <p className={`text-xs text-muted-foreground truncate ${isCompleted ? 'line-through' : ''}`}>
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
            const parentTask = task.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : null;
            const recurringStatus = task.recurring && todayStr ? getRecurringStatus(task, todayStr) : null;

            return {
                ...task,
                project,
                parentTask,
                recentTime: taskTimeTotals[task.id] || 0,
                recurringStatus
            };
        });
    }, [projects, tasks, taskTimeTotals, getRecurringStatus, todayStr]);

    const overdueTasks = useMemo(() => {
        return enhanceTaskList(getOverdueTasks());
    }, [getOverdueTasks, enhanceTaskList]);

    const attachedTasksForToday = useMemo(() => {
        if (!todayStr) return [];

        const attachments = getForDate(todayStr).filter((attachment) => attachment.type === 'task');
        const tasksById = new Map(tasks.map((task) => [task.id, task]));

        return attachments
            .map((attachment) => tasksById.get(attachment.referenceId))
            .filter(Boolean);
    }, [getForDate, todayStr, tasks]);

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

        const taskIdsToDelete = task.parentTaskId
            ? [task.id]
            : getTaskIdsToDelete(task.id, tasks);

        const entriesToDelete = timeEntries.filter(entry => taskIdsToDelete.includes(entry.taskId));
        entriesToDelete.forEach(entry => deleteEntry(entry.id));

        timers.forEach(timer => {
            if (taskIdsToDelete.includes(timer.taskId)) {
                clearTimer(timer.projectId);
            }
        });

        taskIdsToDelete.forEach(id => deleteTask(id));
        showSuccess('Task deleted');
    }, [tasks, timeEntries, timers, deleteEntry, clearTimer, deleteTask, showSuccess]);

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

            {/* Recent Tasks and Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentTasks
                    recentTasks={recentTasks}
                    taskSearchQuery={taskSearchQuery}
                    setTaskSearchQuery={setTaskSearchQuery}
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
                    projectSearchQuery={projectSearchQuery}
                    setProjectSearchQuery={setProjectSearchQuery}
                    navigateToProject={navigateToProject}
                    handleClientTitleClick={handleClientTitleClick}
                    clients={clients}
                />
            </div>

            <MetricsCards
                thisMonthMetrics={thisMonthMetrics}
                lastMonthMetrics={lastMonthMetrics}
                last90DaysMetrics={last90DaysMetrics}
                invoiceMetrics={invoiceMetrics}
                thisMonthBillableHours={thisMonthBillableHours}
                thisMonthUnbilledDisplay={thisMonthUnbilledDisplay}
                expenseTotalsByCurrency={expenseMetricsByCurrency.total}
                expenseUnpaidByCurrency={expenseMetricsByCurrency.unpaid}
                expenseBillableUnbilledByCurrency={expenseMetricsByCurrency.billableUnbilled}
                hasClients={hasClients}
                preferredCurrency={preferredCurrency}
                formatDuration={formatDuration}
                needsExchangeRates={needsExchangeRates}
                exchangeRatesLoading={exchangeRatesLoading}
                navigateToInvoices={navigateToInvoices}
            />

        </div>
    );
};

export default React.memo(Dashboard);
