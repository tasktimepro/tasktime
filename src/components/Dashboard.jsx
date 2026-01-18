import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import TaskTimer from './TaskTimer';
import {
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';
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
    tasks = [],
    timeEntries = [],
    invoices = [],
    clients = [],
    currentTimer,
    setCurrentTimer,
    setTasks,
    navigateToProject,
    navigateToClient,
    navigateToInvoices,
    setIsPaused,
    setPausedElapsedTime,
    isPaused,
    pausedElapsedTime,
    setTimeEntries
}) => {
    const { showWarning } = useToast();
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
            (!task.completed && !task.archived) || completedInCurrentSession.has(task.id)
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

        // For currently running timer, calculate display time
        if (currentTimer) {
            if (!taskActivity[currentTimer.taskId]) {
                taskActivity[currentTimer.taskId] = {
                    totalTime: 0
                };
            }

            // Add current session time to total time (for display only)
            const currentSessionTime = Date.now() - currentTimer.startTime;
            if (!isPaused) {
                taskActivity[currentTimer.taskId].totalTime += currentSessionTime;
            } else {
                taskActivity[currentTimer.taskId].totalTime += pausedElapsedTime;
            }
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
        if (currentTimer) {
            const currentTime = Date.now();
            enhancedTasks.forEach(task => {
                if (task.id === currentTimer.taskId) {
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
    }, [tasks, timeEntries, projects, taskSearchQuery, completedInCurrentSession, currentTimer, isPaused, pausedElapsedTime]);

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
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
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
            .filter(project => !project.archived) // Only exclude archived projects
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
     * Create a time entry for the current timer session
     */
    const createTimeEntry = useCallback((taskId, startTime, endTime, note = undefined) => {
        return {
            id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            taskId,
            start: startTime,
            end: endTime,
            note: note
        };
    }, []);

    /**
     * Toggle task completion status
     */
    const handleCompleteTask = useCallback((task) => {
        // If called directly with a task (for compatibility), toggle its completion status
        // If called from CustomCheckbox, task will be the checked boolean, so we need to handle this differently
        if (typeof task === 'boolean') {
            // This shouldn't happen with the current usage pattern, but handle gracefully
            return;
        }

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
        if (newCompletedStatus && currentTimer?.taskId === task.id) {
            // Create time entry with proper duration based on pause state
            let timeEntry;

            if (isPaused && pausedElapsedTime > 0) {
                // For paused timer, use the elapsed time we already calculated
                timeEntry = createTimeEntry(
                    task.id,
                    currentTimer.startTime,
                    currentTimer.startTime + pausedElapsedTime,
                    currentTimer.note
                );
            } else {
                // For active timer, calculate duration from start to now
                timeEntry = createTimeEntry(task.id, currentTimer.startTime, now, currentTimer.note);
            }

            setTimeEntries(prev => [...prev, timeEntry]);
            setCurrentTimer(null);
            setIsPaused(false);
            setPausedElapsedTime(0);
        }

        // Update task completion status and lastActive timestamp
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: newCompletedStatus, lastActive: now } : t
            )
        );
    }, [currentTimer, isPaused, pausedElapsedTime, createTimeEntry, setTimeEntries, setCurrentTimer, setIsPaused, setPausedElapsedTime, setTasks, setCompletedInCurrentSession]);

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
        if (shouldDisable && currentTimer && currentTimer.taskId !== task.id) {
            return null;
        }

        return (
            <TaskTimer
                task={task}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                tasks={tasks}
                currentTimer={currentTimer}
                setCurrentTimer={setCurrentTimer}
                isGlobalTimer={true}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                pausedElapsedTime={pausedElapsedTime}
                setPausedElapsedTime={setPausedElapsedTime}
                showTimeDisplay={false}
                size="sm"
                setTasks={setTasks}
            />
        );
    }, [currentTimer, isPaused, pausedElapsedTime, setCurrentTimer, setIsPaused, setPausedElapsedTime, setTimeEntries, timeEntries, setTasks, tasks]);

    /**
     * Render task title with navigation
     */
    const renderTaskTitle = useCallback((task, isCompleted) => {
        const baseClasses = `text-sm font-medium truncate text-left transition-colors ${
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
                    currentTimer={currentTimer}
                    isPaused={isPaused}
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
