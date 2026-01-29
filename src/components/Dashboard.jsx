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
import { THIRTY_DAYS_MS, ONE_HOUR_MS, ONE_MINUTE_MS } from '../constants/app';
import useCurrencyConversion from './dashboard/hooks/useCurrencyConversion';
import useMetricsCalculation from './dashboard/hooks/useMetricsCalculation';
import MetricsCards from './dashboard/MetricsCards';
import RecentTasks from './dashboard/RecentTasks';
import ProjectsOverview from './dashboard/ProjectsOverview';

/**
 * Dashboard component - Main dashboard with metrics, recent tasks, projects, and invoicing overview
 */
const Dashboard = ({
    projects = [],
    invoices = [],
    clients = [],
    navigateToProject,
    navigateToClient,
    navigateToInvoices
}) => {
    const hasClients = clients.length > 0;
    const { showWarning } = useToast();
    
    // Use Yjs hooks directly
    const { tasks, updateTask } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [completedInCurrentSession, setCompletedInCurrentSession] = useState(new Set());
    const [conversionWarningShown, setConversionWarningShown] = useState(false);
    const lastWarningKeyRef = useRef(null);

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
        thisYearMetrics,
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
            thisYearMetrics.hadConversionError;

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
        thisYearMetrics,
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
        const activeTasks = tasks.filter(task =>
            ((!task.completed && !task.archived) || completedInCurrentSession.has(task.id))
        );

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
    }, [tasks, timeEntries, projects, taskSearchQuery, completedInCurrentSession, timers]);

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
            if (entry.start > taskLastBilledAt && task.billable === true) {
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

    /**
     * Toggle task completion status
     */
    const handleCompleteTask = useCallback((task) => {
        const newCompletedStatus = !task.completed;
        const now = Date.now();

        // If completing a task, add to completed in current session to keep it visible
        if (newCompletedStatus) {
            setCompletedInCurrentSession(prev => new Set([...prev, task.id]));
        } else {
            // If unchecking a task, remove it from completed in current session
            setCompletedInCurrentSession(prev => {
                const newSet = new Set(prev);
                newSet.delete(task.id);
                return newSet;
            });
        }

        // If timer is active for this task and we're completing it, stop the timer
        const activeTimer = timers.find(timer => timer.taskId === task.id);
        if (newCompletedStatus && activeTimer && task.projectId) {
            const endTime = activeTimer.isPaused && activeTimer.elapsedTime > 0
                ? activeTimer.startTime + activeTimer.elapsedTime
                : now;

            createEntry({
                taskId: task.id,
                start: activeTimer.startTime,
                end: endTime,
                note: activeTimer.note
            });

            clearTimer(task.projectId);
        }

        // Update task completion status and lastActive timestamp
        updateTask(task.id, { completed: newCompletedStatus, lastActive: now });
    }, [timers, createEntry, clearTimer, updateTask, setCompletedInCurrentSession]);

    /**
     * Handle clicking on task title to navigate to project
     */
    const handleTaskTitleClick = useCallback((task) => {
        if (task.project?.id && navigateToProject) {
            navigateToProject(task.project.id);
        }
    }, [navigateToProject]);

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
        if (task.completed) return null;

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
    }, []);

    /**
     * Render task title with navigation
     */
    const renderTaskTitle = useCallback((task, isCompleted) => {
        const baseClasses = `block w-full text-sm font-medium truncate text-left transition-colors ${
            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
        }`;

        const title = task.parentTaskId ? (
            <span>
                <span className="text-muted-foreground text-xs">↳ </span>
                {task.title}
                {!task.parentTask && <span className="text-red-500 text-xs"> [Parent missing]</span>}
            </span>
        ) : (
            task.title
        );

        if (task.project?.id) {
            return (
                <button
                    onClick={() => handleTaskTitleClick(task)}
                    className={`${baseClasses} hover:underline cursor-pointer ${
                        isCompleted ? 'hover:text-muted-foreground' : 'hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                    title={`Click to open ${task.project.title} project`}
                >
                    {title}
                </button>
            );
        }

        return <p className={baseClasses}>{title}</p>;
    }, [handleTaskTitleClick]);

    return (
        <div className="space-y-6">
            <MetricsCards
                thisMonthMetrics={thisMonthMetrics}
                lastMonthMetrics={lastMonthMetrics}
                thisYearMetrics={thisYearMetrics}
                invoiceMetrics={invoiceMetrics}
                thisMonthBillableHours={thisMonthBillableHours}
                thisMonthUnbilledDisplay={thisMonthUnbilledDisplay}
                hasClients={hasClients}
                preferredCurrency={preferredCurrency}
                formatDuration={formatDuration}
                needsExchangeRates={needsExchangeRates}
                exchangeRatesLoading={exchangeRatesLoading}
                navigateToInvoices={navigateToInvoices}
            />

            {/* Recent Tasks and Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentTasks
                    recentTasks={recentTasks}
                    taskSearchQuery={taskSearchQuery}
                    setTaskSearchQuery={setTaskSearchQuery}
                    handleCompleteTask={handleCompleteTask}
                    renderTaskTitle={renderTaskTitle}
                    handleTaskTitleClick={handleTaskTitleClick}
                    renderTaskControls={renderTaskControls}
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
        </div>
    );
};

export default React.memo(Dashboard);
