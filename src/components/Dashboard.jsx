import { useState, useMemo, useEffect } from 'react';
import { 
    ChartBarIcon, 
    ClockIcon, 
    BanknotesIcon, 
    DocumentTextIcon,
    PlayIcon,
    PauseIcon,
    StopIcon,
    CheckIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { 
    getThisMonthRange, 
    getLastMonthRange, 
    getThisYearRange,
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils';
import { getPreferredCurrency, formatCurrency, fetchExchangeRates, convertCurrency } from '../utils/currencyUtils';
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
    currentTimer,
    setCurrentTimer,
    setTasks,
    navigateToProject,
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

    // Check if we have multiple currencies in projects
    const uniqueCurrencies = [...new Set(projects.map(p => p.currency || 'USD'))];
    const needsExchangeRates = uniqueCurrencies.length > 1;

    // Fetch exchange rates only if we have multiple currencies
    useEffect(() => {
        const loadExchangeRates = async () => {
            if (needsExchangeRates) {
                setExchangeRatesLoading(true);
                console.log('Multiple currencies detected, fetching exchange rates...');
                const rates = await fetchExchangeRates();
                setExchangeRates(rates);
                setExchangeRatesLoading(false);
                if (rates) {
                    console.log('Exchange rates loaded successfully:', Object.keys(rates).length, 'currencies');
                } else {
                    console.warn('Failed to load exchange rates');
                    showWarning('Unable to load current exchange rates. Currency conversion may use outdated rates or show original amounts.');
                }
            } else {
                console.log('Single currency detected, skipping exchange rate fetch');
                setExchangeRates({}); // Set empty object to avoid null checks
                setExchangeRatesLoading(false);
            }
        };
        loadExchangeRates();
    }, [needsExchangeRates, showWarning]);

    /**
     * Calculate metrics for a given date range
     * When preferred currency is updated, this will be recalculated
     */
    const calculateMetrics = (startTime, endTime) => {
        const entriesInRange = timeEntries.filter(entry => 
            entry.start >= startTime && entry.end <= endTime
        );

        const totalTime = entriesInRange.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        // Calculate earnings by finding the task and project for each entry
        const earningsByCurrency = {};
        entriesInRange.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task) return;
            
            const project = projects.find(p => p.id === task.projectId);
            if (!project || !project.hourlyRate) return;

            const currency = project.currency || 'USD';
            const hoursWorked = millisecondsToHours(entry.end - entry.start);
            const amount = hoursWorked * project.hourlyRate;

            if (!earningsByCurrency[currency]) {
                earningsByCurrency[currency] = 0;
            }
            earningsByCurrency[currency] += amount;
        });

        // Convert earnings to preferred currency if needed
        if (needsExchangeRates && exchangeRates) {
            const convertedEarnings = {};
            Object.keys(earningsByCurrency).forEach(currency => {
                if (currency === preferredCurrency) {
                    // If currency already matches preferred currency, no conversion needed
                    convertedEarnings[preferredCurrency] = (convertedEarnings[preferredCurrency] || 0) + earningsByCurrency[currency];
                } else {
                    // Only convert if currency is different from preferred currency
                    const convertedAmount = convertCurrency(
                        earningsByCurrency[currency],
                        currency,
                        preferredCurrency,
                        exchangeRates
                    );
                    convertedEarnings[preferredCurrency] = (convertedEarnings[preferredCurrency] || 0) + convertedAmount;
                }
            });
            
            return {
                time: totalTime,
                earningsByCurrency: convertedEarnings
            };
        } else {
            // If only one currency or no exchange rates needed, return as-is
            return {
                time: totalTime,
                earningsByCurrency
            };
        }
    };

    // Calculate date ranges statically (they don't change based on preferences)
    const thisMonthRange = useMemo(() => getThisMonthRange(), []);
    const lastMonthRange = useMemo(() => getLastMonthRange(), []);
    const thisYearRange = useMemo(() => getThisYearRange(), []);
    
    // Calculate the metrics directly without additional useMemo
    // They will be recalculated when preferredCurrency changes since Dashboard will rerender    
    const thisMonthMetrics = calculateMetrics(thisMonthRange.start, thisMonthRange.end);
    const lastMonthMetrics = calculateMetrics(lastMonthRange.start, lastMonthRange.end);
    const thisYearMetrics = calculateMetrics(thisYearRange.start, thisYearRange.end);

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

        // Convert all invoice amounts to preferred currency before summing
        const outstandingTotal = outstanding.reduce((total, invoice) => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.currency || 'USD';
            
            // Only convert if currency differs from preferred currency
            if (currency !== preferredCurrency && needsExchangeRates && exchangeRates) {
                const convertedAmount = convertCurrency(amount, currency, preferredCurrency, exchangeRates);
                return total + convertedAmount;
            }
            // If currency matches or no conversion possible, use original amount
            return total + (currency === preferredCurrency ? amount : 0);
        }, 0);

        const pastDueTotal = pastDue.reduce((total, invoice) => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.currency || 'USD';
            
            // Only convert if currency differs from preferred currency
            if (currency !== preferredCurrency && needsExchangeRates && exchangeRates) {
                const convertedAmount = convertCurrency(amount, currency, preferredCurrency, exchangeRates);
                return total + convertedAmount;
            }
            // If currency matches or no conversion possible, use original amount
            return total + (currency === preferredCurrency ? amount : 0);
        }, 0);

        return {
            outstanding: outstanding.length,
            outstandingTotal,
            pastDue: pastDue.length,
            pastDueTotal
        };
    }, [invoices, needsExchangeRates, exchangeRates, preferredCurrency]);    /**
     * Get recent active tasks (tasks with recent time entries, not completed/archived)
     * Now includes both parent tasks and subtasks
     * Tasks completed in current session remain visible until next render
     */
    const recentTasks = useMemo(() => {
        const activeTasks = tasks.filter(task => 
            (!task.completed && !task.archived) || completedInCurrentSession.has(task.id)
        );

        const subtasks = activeTasks.filter(task => task.parentTaskId);
        const parentTasks = activeTasks.filter(task => !task.parentTaskId);

        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentEntries = timeEntries.filter(entry => entry.start > thirtyDaysAgo);

        const taskActivity = {};
        recentEntries.forEach(entry => {
            if (!taskActivity[entry.taskId]) {
                taskActivity[entry.taskId] = { lastActivity: 0, totalTime: 0 };
            }
            taskActivity[entry.taskId].lastActivity = Math.max(
                taskActivity[entry.taskId].lastActivity, 
                entry.end
            );
            taskActivity[entry.taskId].totalTime += (entry.end - entry.start);
        });

        // Consider currently running timer as the most recent activity
        if (currentTimer) {
            const currentTime = Date.now();
            if (!taskActivity[currentTimer.taskId]) {
                taskActivity[currentTimer.taskId] = { lastActivity: 0, totalTime: 0 };
            }
            
            // Use a timestamp far in the future (10 years) to ensure current timer is always at the top
            // This ensures that the active timer is always considered the most recent activity
            const farFutureTimestamp = currentTime + (10 * 365 * 24 * 60 * 60 * 1000); // 10 years in the future
            taskActivity[currentTimer.taskId].lastActivity = farFutureTimestamp;
            
            // Add current session time to total time
            const currentSessionTime = currentTime - currentTimer.startTime;
            if (!isPaused) {
                taskActivity[currentTimer.taskId].totalTime += currentSessionTime;
            } else {
                // If paused, add the paused elapsed time instead
                taskActivity[currentTimer.taskId].totalTime += pausedElapsedTime;
            }
        }

        // First, process all active tasks to add project information
        const enhancedTasks = [...parentTasks, ...subtasks].map(task => {
            const project = projects.find(p => p.id === task.projectId);
            const totalTime = taskActivity[task.id]?.totalTime || 0;
            const hours = Math.floor(millisecondsToHours(totalTime));
            const minutes = Math.floor((totalTime % (60 * 60 * 1000)) / (60 * 1000));

            return {
                ...task,
                lastActivity: taskActivity[task.id]?.lastActivity || 0,
                recentTime: totalTime,
                project: project,
                displayTime: `${hours}h ${minutes}m`
            };
        });

        // Now that tasks have been enhanced, we can find parent tasks from the ENTIRE tasks array
        const tasksWithParents = enhancedTasks.map(task => {
            if (task.parentTaskId) {
                // Look up the parent task from the complete tasks array, not just activeTasks
                const parentTask = tasks.find(t => t.id === task.parentTaskId);
                
                // Find the parent's project if parent exists
                let parentProject = null;
                if (parentTask) {
                    parentProject = projects.find(p => p.id === parentTask.projectId);
                }
                
                return {
                    ...task,
                    parentTask: parentTask ? {
                        ...parentTask,
                        project: parentProject
                    } : null
                };
            }
            return task;
        });

        // Sort by activity and limit to 10 most recent
        const sortedTasks = tasksWithParents
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .slice(0, 10);

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
                    pendingTime: 0
                };
            }
            projectActivity[task.projectId].totalTime += (entry.end - entry.start);
            projectActivity[task.projectId].lastActivity = Math.max(
                projectActivity[task.projectId].lastActivity,
                entry.end
            );
            
            // Calculate pending billable time (entries after last billing)
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            if (entry.start > taskLastBilledAt) {
                projectActivity[task.projectId].pendingTime += (entry.end - entry.start);
            }
        });

        const projectsWithActivity = projects
            .filter(project => projectActivity[project.id])
            .map(project => {
                const pendingTimeHours = millisecondsToHours(projectActivity[project.id].pendingTime);
                // For recent projects, always use original currency and rate - no conversion
                const pendingAmount = project.hourlyRate ? pendingTimeHours * project.hourlyRate : 0;

                return {
                    ...project,
                    totalTime: projectActivity[project.id].totalTime,
                    lastActivity: projectActivity[project.id].lastActivity,
                    pendingHours: pendingTimeHours,
                    pendingAmount
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
    }, [projects, tasks, timeEntries, projectSearchQuery]);

    /**
     * Start timer for a task
     */
    const handleStartTimer = (task) => {
        // Stop any existing timer
        if (currentTimer) {
            setCurrentTimer(null);
        }
        
        // Reset pause state
        setIsPaused(false);
        setPausedElapsedTime(0);
        
        // Start new timer
        setCurrentTimer({
            startTime: Date.now(),
            taskId: task.id
        });
    };

    /**
     * Stop timer for a task
     */
    const handleStopTimer = (task) => {
        if (currentTimer && currentTimer.taskId === task.id) {            
            // Get a timestamp that will be used consistently
            const now = Date.now();
            
            // Create time entry for the elapsed time
            const timeEntry = {
                id: `dashboard-${now}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now
            };
            
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
            setIsPaused(false);
            setPausedElapsedTime(0);
        }
    };

    /**
     * Pause/Resume timer for a task
     */
    const handleTogglePause = (task) => {
        if (currentTimer && currentTimer.taskId === task.id) {
            if (isPaused) {
                // Resume timer
                setCurrentTimer({
                    startTime: Date.now() - pausedElapsedTime,
                    taskId: task.id
                });
                setIsPaused(false);
                setPausedElapsedTime(0);
            } else {
                // Pause timer
                const elapsedTime = Date.now() - currentTimer.startTime;
                setPausedElapsedTime(elapsedTime);
                setIsPaused(true);
            }
        }
    };

    /**
     * Mark task as completed
     */
    const handleCompleteTask = (task) => {
        // Add to completed in current session to keep it visible FIRST
        setCompletedInCurrentSession(prev => new Set([...prev, task.id]));

        const now = Date.now();
        
        // If timer is active for this task, stop it before completing
        if (currentTimer && currentTimer.taskId === task.id) {
            const timeEntry = {
                id: `completion-${now}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now
            };
            setTimeEntries(prev => [...prev, timeEntry]);
            setCurrentTimer(null);
            setIsPaused(false);
            setPausedElapsedTime(0);
        } else {
            // If no timer was active, create a minimal time entry to update the last activity
            // This ensures the completed task moves to the top of the list
            const timeEntry = {
                id: `completion-update-${now}`,
                taskId: task.id,
                start: now - 1000, // 1 second ago
                end: now
            };
            setTimeEntries(prev => [...prev, timeEntry]);
        }

        // Update task completion status using functional update
        setTasks(prevTasks => 
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: true } : t
            )
        );
    };

    /**
     * Handle clicking on task title to navigate to project
     */
    const handleTaskTitleClick = (task) => {
        if (task.project && navigateToProject) {
            navigateToProject(task.project.id);
        }
    };

    /**
     * Render earnings by currency - prioritizes preferred currency
     */
    const renderEarningsByCurrency = (earningsByCurrency) => {
        // Use the current preferred currency from state
        const currentPreferredCurrency = preferredCurrency;
        
        // Show loading indicator if we need exchange rates and they're still loading
        if (needsExchangeRates && exchangeRatesLoading) {
            return <span className="text-gray-500 text-sm italic">Loading rates...</span>;
        }
        
        if (!earningsByCurrency || Object.keys(earningsByCurrency).length === 0) {
            // Force re-render when preferredCurrency changes
            return <span className="text-gray-500" key={currentPreferredCurrency}>{formatCurrency(0, currentPreferredCurrency)}</span>;
        }

        // Sort currencies with preferred currency first (using the current state value)
        const sortedEntries = Object.entries(earningsByCurrency).sort(([currencyA], [currencyB]) => {
            if (currencyA === currentPreferredCurrency) return -1;
            if (currencyB === currentPreferredCurrency) return 1;
            return currencyA.localeCompare(currencyB);
        });

        return sortedEntries.map(([currency, amount], index) => (
            <span key={currency} className="inline-block">
                {index > 0 && <span className="text-gray-400 mx-1">•</span>}
                <span className="font-semibold">
                    {formatCurrency(amount, currency)}
                </span>
                <span className="text-xs text-gray-500 ml-1">{currency}</span>
            </span>
        ));
    };

    return (
        <div className="space-y-6">
            {/* Metrics Section - Full Width */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
                        <h2 className="text-lg font-medium text-gray-900">Metrics Overview</h2>
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
                                            <BanknotesIcon className="h-4 w-4 text-blue-600 mr-1" />
                                            <div className="text-lg font-semibold text-blue-900">
                                                {renderEarningsByCurrency(thisMonthMetrics.earningsByCurrency)}
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
                                                {renderEarningsByCurrency(lastMonthMetrics.earningsByCurrency)}
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
                                            <BanknotesIcon className="h-4 w-4 text-green-600 mr-1" />
                                            <div className="text-lg font-semibold text-green-900">
                                                {renderEarningsByCurrency(thisYearMetrics.earningsByCurrency)}
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
                                onClick={() => navigateToInvoices()}
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
                                onClick={() => navigateToInvoices()}
                                className="bg-red-50 rounded-lg p-4 text-left hover:bg-red-100 transition-colors border border-red-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-red-900 flex items-center">
                                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
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

                        {/* Pending Bills Notice */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-blue-900">Pending Bills</h3>
                                    <div className="flex items-center mt-2">
                                        <ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
                                        <span className="text-lg font-semibold text-blue-900">
                                            {recentProjects.reduce((total, project) => total + project.pendingHours, 0).toFixed(1)}h
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="h-4 w-4 text-blue-600 mr-2" />
                                        <span className="text-sm text-blue-700">
                                            {(() => {
                                                // For Pending Bills overview, convert each amount to preferred currency
                                                const totalUnbilled = recentProjects.reduce((total, project) => {
                                                    const amount = project.pendingAmount || 0;
                                                    const currency = project.currency || 'USD';
                                                    
                                                    // Only convert if currency differs from preferred currency
                                                    if (currency !== preferredCurrency && needsExchangeRates && exchangeRates) {
                                                        const convertedAmount = convertCurrency(
                                                            amount,
                                                            currency,
                                                            preferredCurrency,
                                                            exchangeRates
                                                        );
                                                        return total + convertedAmount;
                                                    }
                                                    // Add original amount if currency matches preferred
                                                    return total + (currency === preferredCurrency ? amount : 0);
                                                }, 0);
                                                return formatCurrency(totalUnbilled, preferredCurrency);
                                            })()} unbilled
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
                            <h2 className="text-lg font-medium text-gray-900">Recent Tasks</h2>
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
                                    const shouldDisable = currentTimer && !isPaused && !isTimerActive && !task.completed;
                                    
                                    return (
                                    <div key={task.id} className={`px-6 py-3 hover:bg-gray-50 ${task.completed ? 'opacity-75 bg-gray-50' : ''} ${shouldDisable ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center space-x-3">
                                            <CustomCheckbox
                                                checked={task.completed}
                                                onChange={() => handleCompleteTask(task)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                disabled={task.completed || shouldDisable}
                                            />
                                            <div className="flex-1 min-w-0">
                                                {task.project ? (
                                                    <button
                                                        onClick={() => handleTaskTitleClick(task)}
                                                        className={`text-sm font-medium truncate text-left hover:underline cursor-pointer transition-colors ${task.completed ? 'line-through text-gray-500 hover:text-gray-600' : 'text-gray-900 hover:text-blue-600'}`}
                                                        title={`Click to open ${task.project.title} project`}
                                                    >
                                                        {/* Always check parentTaskId directly - more reliable than the isSubtask property */}
                                                        {task.parentTaskId ? (
                                                            <span>
                                                                <span className="text-gray-400 text-xs">↳ </span>
                                                                {task.title}
                                                                {!task.parentTask && <span className="text-red-500 text-xs"> [Parent missing]</span>}
                                                            </span>
                                                        ) : (
                                                            task.title
                                                        )}
                                                    </button>
                                                ) : (
                                                    <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                                        {/* Always check parentTaskId directly - more reliable than the isSubtask property */}
                                                        {task.parentTaskId ? (
                                                            <span>
                                                                <span className="text-gray-400 text-xs">↳ </span>
                                                                {task.title}
                                                                {!task.parentTask && <span className="text-red-500 text-xs"> [Parent missing]</span>}
                                                            </span>
                                                        ) : (
                                                            task.title
                                                        )}
                                                    </p>
                                                )}
                                                <p className={`text-xs truncate ${task.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {task.parentTaskId ? (
                                                        <span>
                                                            Subtask of: {task.parentTask ? task.parentTask.title : 'Unknown Parent'} • {task.project ? task.project.title : 'Unknown Project'}
                                                        </span>
                                                    ) : (
                                                        task.project ? task.project.title : 'Unknown Project'
                                                    )}
                                                </p>
                                            </div>
                                            <div className={`text-xs ${task.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {formatDuration(task.recentTime)}
                                            </div>
                                            {!task.completed && (
                                                <div className="flex space-x-1">
                                                    {currentTimer?.taskId === task.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleTogglePause(task)}
                                                                className="p-1.5 rounded-md transition-colors bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                                                                title={isPaused ? "Resume timer" : "Pause timer"}
                                                            >
                                                                {isPaused ? (
                                                                    <PlayIcon className="h-4 w-4" />
                                                                ) : (
                                                                    <PauseIcon className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleStopTimer(task)}
                                                                className="p-1.5 rounded-md transition-colors bg-red-100 text-red-600 hover:bg-red-200"
                                                                title="Stop timer"
                                                            >
                                                                <StopIcon className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartTimer(task)}
                                                            className="p-1.5 rounded-md transition-colors bg-green-100 text-green-600 hover:bg-green-200"
                                                            title="Start timer"
                                                            disabled={shouldDisable}
                                                        >
                                                            <PlayIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* Render subtasks if present */}
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <div className="ml-8 mt-2">
                                                {task.subtasks.map(subtask => {
                                                    // Determine if this subtask should be disabled
                                                    // If any timer is running (not paused) and it's not for this subtask, disable the subtask
                                                    const isTimerActive = currentTimer?.taskId === subtask.id;
                                                    const shouldDisable = currentTimer && !isPaused && !isTimerActive && !subtask.completed;
                                                    
                                                    return (
                                                        <div key={subtask.id} className={`flex items-center space-x-3 py-2 ${shouldDisable ? 'opacity-50' : ''}`}>
                                                            <CustomCheckbox
                                                                checked={subtask.completed}
                                                                onChange={() => handleCompleteTask(subtask)}
                                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                disabled={subtask.completed || shouldDisable}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                {task.project ? (
                                                                    <button
                                                                        onClick={() => handleTaskTitleClick({ ...subtask, project: task.project })}
                                                                        className={`text-sm font-medium truncate text-left hover:underline cursor-pointer transition-colors ${subtask.completed ? 'line-through text-gray-500 hover:text-gray-600' : 'text-gray-900 hover:text-blue-600'}`}
                                                                        title={`Click to open ${task.project.title} project`}
                                                                    >
                                                                        {subtask.title}
                                                                    </button>
                                                                ) : (
                                                                    <p className={`text-sm font-medium truncate ${subtask.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                                                        {subtask.title}
                                                                    </p>
                                                                )}
                                                                <p className={`text-xs truncate ${subtask.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    {task.project ? task.project.title : 'Unknown Project'}
                                                                </p>
                                                            </div>
                                                            <div className={`text-xs ${subtask.completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {formatDuration(subtask.recentTime)}
                                                            </div>
                                                            {!subtask.completed && (
                                                                <div className="flex space-x-1">
                                                                    {currentTimer?.taskId === subtask.id ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleTogglePause(subtask)}
                                                                                className="p-1.5 rounded-md transition-colors bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                                                                                title={isPaused ? "Resume timer" : "Pause timer"}
                                                                            >
                                                                                {isPaused ? (
                                                                                    <PlayIcon className="h-4 w-4" />
                                                                                ) : (
                                                                                    <PauseIcon className="h-4 w-4" />
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleStopTimer(subtask)}
                                                                                className="p-1.5 rounded-md transition-colors bg-red-100 text-red-600 hover:bg-red-200"
                                                                                title="Stop timer"
                                                                            >
                                                                                <StopIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleStartTimer(subtask)}
                                                                            className="p-1.5 rounded-md transition-colors bg-green-100 text-green-600 hover:bg-green-200"
                                                                            title="Start timer"
                                                                            disabled={shouldDisable}
                                                                        >
                                                                            <PlayIcon className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
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
                                <ClockIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
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
                            <h2 className="text-lg font-medium text-gray-900">Recent Projects</h2>
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
                                    <button
                                        key={project.id}
                                        onClick={() => navigateToProject(project.id)}
                                        className="w-full px-6 py-3 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {project.title}
                                                </p>
                                                <div className="flex items-center space-x-4 mt-1">
                                                    <span className="text-xs text-gray-500">
                                                        {formatDuration(project.totalTime)} total
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {project.pendingHours.toFixed(1)}h pending
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {project.pendingAmount > 0 ? (
                                                        <>
                                                            {formatCurrency(project.pendingAmount, project.currency)}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-500">{formatCurrency(0, project.currency)}</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    pending
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-6 py-8 text-center text-gray-500">
                                <ChartBarIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
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

export default Dashboard;
