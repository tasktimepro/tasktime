import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    ChartBarIcon, 
    ClockIcon, 
    BanknotesIcon, 
    DocumentTextIcon,
    CheckIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    DocumentCheckIcon,
    ClipboardDocumentCheckIcon,
    CurrencyDollarIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline';
import TaskTimer from './TaskTimer.jsx';
import { 
    getThisMonthRange, 
    getLastMonthRange, 
    getThisYearRange,
    formatDuration,
    formatDurationWithSeconds,
    millisecondsToHours
} from '../utils/dateUtils';
import { getPreferredCurrency, formatCurrency, fetchExchangeRates, convertCurrency, getProjectCurrency } from '../utils/currencyUtils';
import { useToast } from '../hooks/useToast';
import CustomCheckbox from './CustomCheckbox';

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
    const [preferredCurrency, setPreferredCurrency] = useState(getPreferredCurrency());
    const [exchangeRates, setExchangeRates] = useState(null);
    const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);

    // Listen for storage changes to update preferred currency
    useEffect(() => {
        const handleStorageChange = () => {
            setPreferredCurrency(getPreferredCurrency());
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Also listen for custom events in case changes happen within the same tab
        const handlePreferenceChange = () => {
            setPreferredCurrency(getPreferredCurrency());
        };
        
        window.addEventListener('preferenceChanged', handlePreferenceChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('preferenceChanged', handlePreferenceChange);
        };
    }, []);

    // Check if we have multiple currencies in projects and invoices
    const needsExchangeRates = useMemo(() => {
        const projectCurrencies = [...new Set(projects.map(p => getProjectCurrency(p, clients)))];
        const invoiceCurrencies = [...new Set(invoices.map(i => i.currency || preferredCurrency))];
        const allCurrencies = [...new Set([...projectCurrencies, ...invoiceCurrencies])];
        
        return allCurrencies.length > 1;
    }, [projects, invoices, preferredCurrency, clients]);

    // Fetch exchange rates only if we have multiple currencies
    useEffect(() => {
        const loadExchangeRates = async () => {
            if (needsExchangeRates) {
                setExchangeRatesLoading(true);
                const rates = await fetchExchangeRates();
                setExchangeRates(rates);
                setExchangeRatesLoading(false);
                if (!rates) {
                    showWarning('Unable to load current exchange rates. Currency conversion may use outdated rates or show original amounts.');
                }
            } else {
                setExchangeRates(null);
                setExchangeRatesLoading(false);
            }
        };
        loadExchangeRates();
    }, [needsExchangeRates, showWarning]);

    /**
     * Calculate metrics for a given date range
     * When preferred currency is updated, this will be recalculated
     * Now includes both billable time earnings AND invoice amounts
     */
    // Memoize the currency conversion function to prevent unnecessary recalculations
    const convertToCurrency = useMemo(() => {
        return (amountsByCurrency) => {
            // If there's only one currency and it matches preferred, or no exchange rates needed, return as-is
            const currencies = Object.keys(amountsByCurrency);
            if (currencies.length === 1 && currencies[0] === preferredCurrency) {
                return amountsByCurrency;
            }
            
            // Check if we actually need to do any conversions
            const hasNonPreferredCurrency = currencies.some(currency => currency !== preferredCurrency);
            if (!hasNonPreferredCurrency) {
                return amountsByCurrency;
            }

            // Only convert if we have exchange rates and actually need them
            if (needsExchangeRates && exchangeRates) {
                let totalInPreferredCurrency = 0;
                Object.entries(amountsByCurrency).forEach(([currency, amount]) => {
                    if (currency === preferredCurrency) {
                        totalInPreferredCurrency += amount;
                    } else {
                        const convertedAmount = convertCurrency(
                            amount,
                            currency,
                            preferredCurrency,
                            exchangeRates
                        );
                        totalInPreferredCurrency += convertedAmount;
                    }
                });
                const result = { [preferredCurrency]: totalInPreferredCurrency };
                return result;
            }
            
            // If we need exchange rates but don't have them, return original amounts
            return amountsByCurrency;
        };
    }, [preferredCurrency, needsExchangeRates, exchangeRates]);

    const calculateMetrics = useCallback((startTime, endTime) => {
        const entriesInRange = timeEntries.filter(entry => 
            entry.start >= startTime && entry.end <= endTime
        );

        const totalTime = entriesInRange.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        // Calculate billable time earnings using task-by-task rounding for consistency
        const billableEarningsByCurrency = {};
        
        // Group entries by task first, then calculate earnings with proper rounding
        const taskTimeMap = {};
        entriesInRange.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task || task.billable !== true) return; // Only include explicitly billable tasks
            
            const project = projects.find(p => p.id === task.projectId);
            if (!project || !project.hourlyRate) return;

            const taskKey = `${task.id}-${project.id}`;
            if (!taskTimeMap[taskKey]) {
                taskTimeMap[taskKey] = {
                    totalTime: 0,
                    project: project,
                    currency: getProjectCurrency(project, clients)
                };
            }
            taskTimeMap[taskKey].totalTime += (entry.end - entry.start);
        });
        
        // Calculate earnings with task-by-task rounding
        Object.values(taskTimeMap).forEach(({ totalTime, project, currency }) => {
            const taskHours = millisecondsToHours(totalTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            const amount = roundedTaskHours * project.hourlyRate;

            if (!billableEarningsByCurrency[currency]) {
                billableEarningsByCurrency[currency] = 0;
            }
            billableEarningsByCurrency[currency] += amount;
        });

        // Calculate invoice amounts in the given date range
        const invoicesInRange = invoices.filter(invoice => {
            // Use invoice date (which includes overrides) for accurate reporting
            const invoiceDate = invoice.date ? new Date(invoice.date).getTime() : invoice.createdAt;
            if (!invoiceDate) return false;
            return invoiceDate >= startTime && invoiceDate <= endTime;
        });

        // Separate paid and outstanding invoice amounts
        const paidInvoicesByCurrency = {};
        const outstandingInvoicesByCurrency = {};

        invoicesInRange.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.project ? getProjectCurrency(invoice.project, clients) : preferredCurrency;
            
            if (invoice.paymentProcessed) {
                // Paid invoice
                if (!paidInvoicesByCurrency[currency]) {
                    paidInvoicesByCurrency[currency] = 0;
                }
                paidInvoicesByCurrency[currency] += amount;
            } else {
                // Outstanding invoice
                if (!outstandingInvoicesByCurrency[currency]) {
                    outstandingInvoicesByCurrency[currency] = 0;
                }
                outstandingInvoicesByCurrency[currency] += amount;
            }
        });

        return {
            time: totalTime,
            billableEarnings: convertToCurrency(billableEarningsByCurrency),
            paidInvoices: convertToCurrency(paidInvoicesByCurrency),
            outstandingInvoices: convertToCurrency(outstandingInvoicesByCurrency)
        };
    }, [timeEntries, tasks, projects, invoices, convertToCurrency, preferredCurrency, clients]);

    // Calculate date ranges statically (they don't change based on preferences)
    const thisMonthRange = useMemo(() => getThisMonthRange(), []);
    const lastMonthRange = useMemo(() => getLastMonthRange(), []);
    const thisYearRange = useMemo(() => getThisYearRange(), []);
    
    // Calculate metrics with proper memoization
    const thisMonthMetrics = useMemo(() => {
        return calculateMetrics(thisMonthRange.start, thisMonthRange.end);
    }, [thisMonthRange, calculateMetrics]);
    
    const lastMonthMetrics = useMemo(() => {
        return calculateMetrics(lastMonthRange.start, lastMonthRange.end);
    }, [lastMonthRange, calculateMetrics]);
    
    const thisYearMetrics = useMemo(() => {
        return calculateMetrics(thisYearRange.start, thisYearRange.end);
    }, [thisYearRange, calculateMetrics]);

    /**
     * Calculate outstanding invoices metrics
     */
    const invoiceMetrics = useMemo(() => {
        const outstanding = invoices.filter(invoice => !invoice.paymentProcessed);
        const pastDue = outstanding.filter(invoice => {
            if (!invoice.dueDate) return false;
            const dueDate = new Date(invoice.dueDate);
            return dueDate < new Date();
        });

        // Group outstanding invoices by currency first
        const outstandingByCurrency = {};
        outstanding.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.project ? getProjectCurrency(invoice.project, clients) : preferredCurrency;
            
            if (!outstandingByCurrency[currency]) {
                outstandingByCurrency[currency] = 0;
            }
            outstandingByCurrency[currency] += amount;
        });

        // Group past due invoices by currency first
        const pastDueByCurrency = {};
        pastDue.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.project ? getProjectCurrency(invoice.project, clients) : preferredCurrency;
            
            if (!pastDueByCurrency[currency]) {
                pastDueByCurrency[currency] = 0;
            }
            pastDueByCurrency[currency] += amount;
        });

        // Convert using the same logic as other metrics
        const convertedOutstanding = convertToCurrency(outstandingByCurrency);
        const convertedPastDue = convertToCurrency(pastDueByCurrency);

        // Sum the converted amounts
        const outstandingTotal = Object.values(convertedOutstanding).reduce((sum, amount) => sum + amount, 0);
        const pastDueTotal = Object.values(convertedPastDue).reduce((sum, amount) => sum + amount, 0);

        return {
            outstanding: outstanding.length,
            outstandingTotal,
            pastDue: pastDue.length,
            pastDueTotal
        };
    }, [invoices, convertToCurrency, preferredCurrency, clients]);

    /**
     * Get recent active tasks sorted by their most recent activity (any interaction)
     * Tasks completed in current session remain visible until next render
     */
    const recentTasks = useMemo(() => {
        const activeTasks = tasks.filter(task => 
            (!task.completed && !task.archived) || completedInCurrentSession.has(task.id)
        );

        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
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
            const minutes = Math.floor((totalTime % (60 * 60 * 1000)) / (60 * 1000));

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
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
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
     * Calculate current month's unbilled total that matches the monthly metrics calculation
     * This should match the "unbilled" amount shown in "This Month" metrics
     */
    const thisMonthUnbilledTotal = useMemo(() => {
        const billableTotal = Object.values(thisMonthMetrics.billableEarnings).reduce((sum, amount) => sum + amount, 0);
        return billableTotal;
    }, [thisMonthMetrics.billableEarnings]);

    /**
     * Calculate billable hours for the current month metrics
     */
    const thisMonthBillableHours = useMemo(() => {
        // Re-calculate the hours from the time entries for this month
        const entriesInRange = timeEntries.filter(entry => 
            entry.start >= thisMonthRange.start && entry.end <= thisMonthRange.end
        );

        // Group by task and calculate billable hours using the same rounding logic
        const taskTimeMap = {};
        entriesInRange.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task || task.billable !== true) return; // Only include explicitly billable tasks
            
            const project = projects.find(p => p.id === task.projectId);
            if (!project || !project.hourlyRate) return;

            const taskKey = `${task.id}-${project.id}`;
            if (!taskTimeMap[taskKey]) {
                taskTimeMap[taskKey] = { totalTime: 0 };
            }
            taskTimeMap[taskKey].totalTime += (entry.end - entry.start);
        });

        // Calculate total billable hours with task-by-task rounding
        return Object.values(taskTimeMap).reduce((total, { totalTime }) => {
            const taskHours = millisecondsToHours(totalTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);
    }, [timeEntries, tasks, projects, thisMonthRange]);

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
            console.warn('handleCompleteTask called with boolean - this usage pattern is deprecated');
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
        } else if (newCompletedStatus) {
            // Create minimal time entry to update last activity when completing
            const timeEntry = createTimeEntry(task.id, now - 1000, now);
            setTimeEntries(prev => [...prev, timeEntry]);
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
            isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
        }`;

        const title = task.parentTaskId ? (
            <span>
                <span className="text-gray-400 text-xs">↳ </span>
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
                        isCompleted ? 'hover:text-gray-600' : 'hover:text-blue-600'
                    }`}
                    title={`Click to open ${task.project.title} project`}
                >
                    {title}
                </button>
            );
        }

        return <p className={baseClasses}>{title}</p>;
    }, [handleTaskTitleClick]);
    const renderEarningsByCurrency = useCallback((metrics, colorScheme = 'blue') => {
        // Show loading indicator if we need exchange rates and they're still loading
        if (needsExchangeRates && exchangeRatesLoading) {
            return <span className="text-gray-500 text-sm italic">Loading rates...</span>;
        }
        
        const billableTotal = Object.values(metrics.billableEarnings).reduce((sum, amount) => sum + amount, 0);
        const paidTotal = Object.values(metrics.paidInvoices).reduce((sum, amount) => sum + amount, 0);
        const outstandingTotal = Object.values(metrics.outstandingInvoices).reduce((sum, amount) => sum + amount, 0);
        
        // If no earnings at all, show zero
        if (billableTotal === 0 && paidTotal === 0 && outstandingTotal === 0) {
            return <span className="text-gray-500">{formatCurrency(0, preferredCurrency)}</span>;
        }

        const components = [];
        
        // Color mappings for different schemes
        const colorClasses = {
            blue: {
                icon: 'text-blue-600',
                text: 'text-blue-900',
                bg: 'bg-blue-100',
                badge: 'text-blue-800'
            },
            gray: {
                icon: 'text-gray-600',
                text: 'text-gray-900',
                bg: 'bg-gray-100',
                badge: 'text-gray-800'
            },
            green: {
                icon: 'text-green-600',
                text: 'text-green-900',
                bg: 'bg-green-100',
                badge: 'text-green-800'
            }
        };
        
        const colors = colorClasses[colorScheme] || colorClasses.blue;
        
        // Add paid invoices (highest priority)
        if (paidTotal > 0) {
            components.push(
                <div key="paid" className="flex items-center">
                    <BanknotesIcon className={`h-4 w-4 ${colors.icon} mr-1`} />
                    <span className={`font-semibold ${colors.text}`}>
                        {formatCurrency(paidTotal, preferredCurrency)}
                    </span>
                    <span className={`text-xs ${colors.bg} ${colors.badge} px-1.5 py-0.5 rounded ml-1`}>
                        paid
                    </span>
                </div>
            );
        }
        
        // Add outstanding invoices as "pending"
        if (outstandingTotal > 0) {
            components.push(
                <div key="pending" className="flex items-center">
                    <DocumentTextIcon className="h-4 w-4 text-amber-600 mr-1" />
                    <span className="font-semibold text-amber-900">
                        {formatCurrency(outstandingTotal, preferredCurrency)}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1">
                        pending
                    </span>
                </div>
            );
        }
        
        // Add unbilled time as "unbilled"
        if (billableTotal > 0) {
            components.push(
                <div key="unbilled" className="flex items-center">
                    <CurrencyDollarIcon className="h-4 w-4 text-purple-600 mr-1" />
                    <span className="font-semibold text-purple-900">
                        {formatCurrency(billableTotal, preferredCurrency)}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded ml-1">
                        unbilled
                    </span>
                </div>
            );
        }

        return (
            <div className="space-y-1">
                {components}
            </div>
        );
    }, [needsExchangeRates, exchangeRatesLoading, preferredCurrency]);

    return (
        <div className="space-y-6">
            {/* Metrics Section - Full Width */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
                        <h2 className="text-lg font-medium text-gray-900">Reports Overview</h2>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* This Month */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-blue-900">This Month</h3>
                                    <div className="mt-2">
                                        <div className="flex items-center">
                                            <div className="text-lg font-semibold text-blue-900">
                                                {renderEarningsByCurrency(thisMonthMetrics, 'blue')}
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <ClockIcon className="h-4 w-4 text-blue-600 mr-1" />
                                            <span className="text-sm text-blue-700">
                                                {formatDuration(thisMonthMetrics.time)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CalendarDaysIcon className="h-8 w-8 text-blue-600" />
                            </div>
                        </div>

                        {/* Last Month */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">Last Month</h3>
                                    <div className="mt-2">
                                        <div className="flex items-center">
                                            <BanknotesIcon className="h-4 w-4 text-gray-600 mr-1" />
                                            <div className="text-lg font-semibold text-gray-900">
                                                {renderEarningsByCurrency(lastMonthMetrics, 'gray')}
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <ClockIcon className="h-4 w-4 text-gray-600 mr-1" />
                                            <span className="text-sm text-gray-700">
                                                {formatDuration(lastMonthMetrics.time)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CalendarDaysIcon className="h-8 w-8 text-gray-600" />
                            </div>
                        </div>

                        {/* This Year */}
                        <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-green-900">This Year</h3>
                                    <div className="mt-2">
                                        <div className="flex items-center">
                                            {/* <BanknotesIcon className="h-4 w-4 text-green-600 mr-1" /> */}
                                            <div className="text-lg font-semibold text-green-900">
                                                {renderEarningsByCurrency(thisYearMetrics, 'green')}
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <ClockIcon className="h-4 w-4 text-green-600 mr-1" />
                                            <span className="text-sm text-green-700">
                                                {formatDuration(thisYearMetrics.time)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CalendarDaysIcon className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* Invoice Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        {/* Outstanding Invoices */}
                        {invoiceMetrics.outstanding > 0 ? (
                            <button
                                onClick={() => navigateToInvoices({ section: 'invoices', tab: 'outstanding' })}
                                className="bg-amber-50 rounded-lg p-4 text-left hover:bg-amber-100 transition-colors border border-amber-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-amber-900">Outstanding Invoices</h3>
                                        <div className="flex items-center mt-2">
                                            <DocumentTextIcon className="h-4 w-4 text-amber-600 mr-2" />
                                            <span className="text-lg font-semibold text-amber-900">
                                                {invoiceMetrics.outstanding} invoices
                                            </span>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <CurrencyDollarIcon className="h-4 w-4 text-amber-600 mr-2" />
                                            <span className="text-sm text-amber-700">
                                                {formatCurrency(invoiceMetrics.outstandingTotal, preferredCurrency)} total
                                            </span>
                                        </div>
                                    </div>
                                    <DocumentTextIcon className="h-8 w-8 text-amber-600" />
                                </div>
                            </button>
                        ) : (
                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-green-900">Outstanding Invoices</h3>
                                        <div className="flex items-center mt-2">
                                            <CheckIcon className="h-4 w-4 text-green-600 mr-2" />
                                            <span className="text-lg font-semibold text-green-900">
                                                No outstanding invoices
                                            </span>
                                        </div>
                                        <div className="text-sm text-green-700 mt-1">
                                            No outstanding payments
                                        </div>
                                    </div>
                                    <DocumentTextIcon className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                        )}

                        {/* Past Due Invoices */}
                        {invoiceMetrics.pastDue > 0 ? (
                            <button
                                onClick={() => navigateToInvoices({ section: 'invoices', tab: 'overdue' })}
                                className="bg-red-50 rounded-lg p-4 text-left hover:bg-red-100 transition-colors border border-red-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-red-900 flex items-center">
                                            Past Due Invoices
                                        </h3>
                                        <div className="flex items-center mt-2">
                                            <DocumentTextIcon className="h-4 w-4 text-red-600 mr-2" />
                                            <span className="text-lg font-semibold text-red-900">
                                                {invoiceMetrics.pastDue} invoices
                                            </span>
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <CurrencyDollarIcon className="h-4 w-4 text-red-600 mr-2" />
                                            <span className="text-sm text-red-700">
                                                {formatCurrency(invoiceMetrics.pastDueTotal, preferredCurrency)} overdue
                                            </span>
                                        </div>
                                    </div>
                                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                                </div>
                            </button>
                        ) : (
                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-green-900">No Past Due Invoices</h3>
                                        <div className="flex items-center mt-2">
                                            <CheckIcon className="h-4 w-4 text-green-600 mr-2" />
                                            <span className="text-lg font-semibold text-green-900">
                                                All invoices are up-to-date
                                            </span>
                                        </div>
                                        <div className="text-sm text-green-700 mt-1">
                                            Great job staying on top of payments!
                                        </div>
                                    </div>
                                    <DocumentTextIcon className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                        )}

                        {/* Pending Bills This Month Notice */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-blue-900">Pending Bills This Month</h3>
                                    <div className="flex items-center mt-2">
                                        <ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
                                        <span className="text-lg font-semibold text-blue-900">
                                            {thisMonthBillableHours.toFixed(1)}h
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="h-4 w-4 text-blue-600 mr-2" />
                                        <span className="text-sm text-blue-700">
                                            {formatCurrency(thisMonthUnbilledTotal, preferredCurrency)} unbilled
                                        </span>
                                    </div>
                                </div>
                                <ClockIcon className="h-8 w-8 text-blue-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Tasks and Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Tasks Section */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <DocumentCheckIcon className="h-5 w-5 text-blue-600 mr-2" />
                                <h2 className="text-lg font-medium text-gray-900">Recent Tasks</h2>
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search tasks"
                                    value={taskSearchQuery}
                                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {recentTasks.length > 0 ? (
                            <div className="divide-y divide-gray-200">
                                {recentTasks.map((task) => {
                                    // Determine if this task should be disabled
                                    // If any timer is running (not paused) and it's not for this task, disable the task
                                    const isTimerActive = currentTimer?.taskId === task.id;
                                    const shouldDisable = currentTimer && !isPaused && !isTimerActive;
                                    
                                    return (
                                    <div key={task.id} className={`px-6 py-3 hover:bg-gray-50 ${task.completed ? 'bg-gray-50' : ''} ${shouldDisable ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center space-x-3">
                                            <CustomCheckbox
                                                checked={task.completed}
                                                onChange={(checked) => handleCompleteTask(task, checked)}
                                                disabled={shouldDisable}
                                            />
                                            <div className="flex-1 min-w-0 space-y-1">
                                                {renderTaskTitle(task, task.completed)}
                                                <p className={`text-xs truncate ${task.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {task.parentTaskId ? (
                                                        <span>
                                                            Subtask of: {task.parentTask ? task.parentTask.title : 'Unknown Parent'} <span className="mx-1">•</span> {task.project ? (
                                                                <button
                                                                    onClick={() => handleTaskTitleClick(task)}
                                                                    className="text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                                                                    title={`Click to open ${task.project.title} project`}
                                                                >
                                                                    {task.project.title}
                                                                </button>
                                                            ) : 'Unknown Project'}
                                                        </span>
                                                    ) : (
                                                        task.project ? (
                                                            <button
                                                                onClick={() => handleTaskTitleClick(task)}
                                                                className="text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                                                                title={`Click to open ${task.project.title} project`}
                                                            >
                                                                {task.project.title}
                                                            </button>
                                                        ) : 'Unknown Project'
                                                    )}
                                                </p>
                                            </div>
                                            <div className={`text-xs ${task.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {formatDurationWithSeconds(task.recentTime)}
                                            </div>
                                            <div className="flex space-x-1">
                                                {renderTaskControls(task, shouldDisable)}
                                            </div>
                                        </div>
                                        {/* Render subtasks if present */}
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <div className="ml-8 mt-2">
                                                {task.subtasks.map(subtask => {
                                                    const isTimerActive = currentTimer?.taskId === subtask.id;
                                                    const shouldDisable = currentTimer && !isPaused && !isTimerActive;
                                                    const subtaskWithProject = { ...subtask, project: task.project };
                                                    
                                                    return (
                                                        <div key={subtask.id} className={`flex items-center space-x-3 py-2 ${shouldDisable ? 'opacity-50' : ''}`}>
                                                            <CustomCheckbox
                                                                checked={subtask.completed}
                                                                onChange={(checked) => handleCompleteTask(subtask, checked)}
                                                                disabled={shouldDisable}
                                                            />
                                                            <div className="flex-1 min-w-0 space-y-1">
                                                                {renderTaskTitle(subtaskWithProject, subtask.completed)}
                                                                <p className={`text-xs truncate ${subtask.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    {task.project ? (
                                                                        <button
                                                                            onClick={() => handleTaskTitleClick(subtaskWithProject)}
                                                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                                            title={`Click to open ${task.project.title} project`}
                                                                        >
                                                                            {task.project.title}
                                                                        </button>
                                                                    ) : 'Unknown Project'}
                                                                </p>
                                                            </div>
                                                            <div className={`text-xs ${subtask.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {formatDurationWithSeconds(subtask.recentTime)}
                                                            </div>
                                                            <div className="flex space-x-1">
                                                                {renderTaskControls(subtask, shouldDisable)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-6 py-8 text-center text-gray-500">
                                <DocumentCheckIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm">
                                    {taskSearchQuery ? 'No tasks found matching your search' : 'No recent tasks found'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Projects Section */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600 mr-2" />
                                <h2 className="text-lg font-medium text-gray-900">Recent Projects</h2>
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search projects"
                                    value={projectSearchQuery}
                                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {recentProjects.length > 0 ? (
                            <div className="divide-y divide-gray-200">
                                {recentProjects.map((project) => (
                                    <div key={project.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <button
                                                    onClick={() => navigateToProject(project.id)}
                                                    className="text-sm font-medium text-gray-900 truncate hover:underline cursor-pointer hover:text-blue-600 text-left block"
                                                    title={`Click to open ${project.title} project`}
                                                >
                                                    {project.title}
                                                </button>
                                                <div className="text-xs text-gray-500">
                                                    {project.client ? (
                                                        <span>
                                                            <button
                                                                onClick={() => handleClientTitleClick(project.client)}
                                                                className="text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                                                                title={`Click to open ${project.client.title} client dashboard`}
                                                            >
                                                                {project.client.title}
                                                            </button>
                                                            <span> <span className="mx-1">•</span> {project.pendingHours.toFixed(1)}h pending</span>
                                                        </span>
                                                    ) : (
                                                        <span>Personal <span className="mx-1">•</span> {project.pendingHours.toFixed(1)}h pending</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {/* Pending Bills */}
                                                <div className="text-sm font-medium text-gray-900">
                                                    {project.pendingAmount > 0 ? (
                                                        <>
                                                            {formatCurrency(project.pendingAmount, getProjectCurrency(project, clients))}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-500">{formatCurrency(0, getProjectCurrency(project, clients))}</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    bills
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-6 py-8 text-center text-gray-500">
                                <ClipboardDocumentCheckIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm">
                                    {projectSearchQuery ? 'No projects found matching your search' : 'No recent projects found'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Dashboard);
