import { useEffect, useState, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useUrlState } from './hooks/useUrlState';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import Dashboard from './components/Dashboard';
import Account from './components/Account';
import Invoices from './components/Invoices';
import GlobalTimer from './components/GlobalTimer';
import { ToastProvider } from './components/ToastContainer';
import { formatDurationWithSeconds } from './utils/dateUtils';
import { ClockIcon } from '@heroicons/react/24/outline';

/**
 * Main App component - Entry point for the Task. Time. Track.
 */
function App() {
    console.log('✅ App component is rendering successfully');
    
    // localStorage state management
    const [projects, setProjects] = useLocalStorage('projects', []);
    const [tasks, setTasks] = useLocalStorage('tasks', []);
    const [timeEntries, setTimeEntries] = useLocalStorage('timeEntries', []);
    const [paymentMethods, setPaymentMethods] = useLocalStorage('paymentMethods', []);
    const [businessInfos, setBusinessInfos] = useLocalStorage('businessInfos', []);
    const [clientInfos, setClientInfos] = useLocalStorage('clientInfos', []);
    const [invoices, setInvoices] = useLocalStorage('invoices', []);
    const [invoiceTemplates, setInvoiceTemplates] = useLocalStorage('invoiceTemplates', []);
    
    // Unified timer state (all timer-related data in one localStorage key)
    const [timerState, setTimerState] = useLocalStorage('timer', {
        startTime: null,
        taskId: null,
        paused: false,
        elapsedTime: 0
    });

    // Derived state for backward compatibility
    const currentTimer = useMemo(() => {
        return timerState.startTime && timerState.taskId ? {
            startTime: timerState.startTime,
            taskId: timerState.taskId
        } : null;
    }, [timerState.startTime, timerState.taskId]);
    
    const isPaused = timerState.paused;
    const pausedElapsedTime = timerState.elapsedTime;

    // Helper functions to update timer state
    const setCurrentTimer = (timer) => {
        if (timer === null) {
            setTimerState({
                startTime: null,
                taskId: null,
                paused: false,
                elapsedTime: 0
            });
        } else {
            setTimerState(prev => ({
                ...prev,
                startTime: timer.startTime,
                taskId: timer.taskId
            }));
        }
    };

    const setIsPaused = (paused) => {
        setTimerState(prev => ({
            ...prev,
            paused
        }));
    };

    const setPausedElapsedTime = (elapsedTime) => {
        setTimerState(prev => ({
            ...prev,
            elapsedTime
        }));
    };

    // State for showing/hiding global timer
    const [showGlobalTimer, setShowGlobalTimer] = useState(false);

    // Update browser tab title with live timer
    useEffect(() => {
        const originalTitle = "TaskTime - Track your time by the task. Invoice without the mess.";
        
        if (currentTimer && !isPaused) {
            // Only update title if we have the task data available
            const currentTask = tasks.find(task => task.id === currentTimer.taskId);
            if (!currentTask) {
                // Task data not loaded yet, don't update title
                return;
            }
            
            // Update title every second when timer is running
            const updateTitle = () => {
                const now = Date.now();
                const elapsed = now - currentTimer.startTime;
                const formattedTime = formatDurationWithSeconds(elapsed);
                const taskName = currentTask.title;
                
                document.title = `▶ ${formattedTime} - ${taskName} | TaskTime`;
            };
            
            // Update immediately
            updateTitle();
            
            // Then update every second
            const interval = setInterval(updateTitle, 1000);
            
            return () => clearInterval(interval);
        } else if (currentTimer && isPaused) {
            // Only update title if we have the task data available
            const currentTask = tasks.find(task => task.id === currentTimer.taskId);
            if (!currentTask) {
                // Task data not loaded yet, don't update title
                return;
            }
            
            // Show paused state in title
            const pausedTime = formatDurationWithSeconds(pausedElapsedTime);
            const taskName = currentTask.title;
            
            document.title = `⏸ ${pausedTime} - ${taskName} | TaskTime`;
        } else {
            // Reset to original title when no timer is active
            document.title = originalTitle;
        }
        
        // Cleanup function to reset title
        return () => {
            if (!currentTimer) {
                document.title = originalTitle;
            }
        };
    }, [currentTimer, isPaused, pausedElapsedTime, tasks]);

    console.log('📊 Loaded projects:', projects.length);

    // URL-based state management
    const { urlParams, navigateToProjects, navigateToProject, navigateToInvoices, navigateToAccount, navigateToDashboard, updateUrl } = useUrlState();
    
    // Derived state from URL parameters
    const activeView = urlParams.view;
    const selectedProject = urlParams.projectId 
        ? projects.find(p => p.id === urlParams.projectId) 
        : null;

    // Handle case where project in URL doesn't exist (e.g., deleted project)
    useEffect(() => {
        if (urlParams.projectId && urlParams.view === 'projects' && !selectedProject) {
            console.warn('Project not found, redirecting to projects view');
            navigateToProjects();
        }
    }, [urlParams.projectId, urlParams.view, selectedProject, navigateToProjects]);

    // Show global timer when a timer becomes active or is paused
    useEffect(() => {
        if (currentTimer) {
            setShowGlobalTimer(true);
        }
    }, [currentTimer]);

    /**
     * Handle navigation to payment methods creation from invoice generator
     */
    const handleNavigateToPaymentMethods = () => {
        navigateToInvoices({ section: 'payment-methods', create: 'payment-method' });
    };

    /**
     * Handle navigation to business info creation from invoice generator
     */
    const handleNavigateToBusinessInfo = () => {
        navigateToInvoices({ section: 'business-info', create: 'business-info' });
    };

    /**
     * Handle navigation to client info creation from invoice generator
     */
    const handleNavigateToClientInfo = () => {
        navigateToInvoices({ section: 'client-info', create: 'client-info' });
    };

    /**
     * Handle navigation to invoice templates from invoice generator
     */
    const handleNavigateToTemplates = () => {
        navigateToInvoices({ section: 'templates', create: 'template' });
    };

    /**
     * Handle navigation to projects view with project creation
     */
    const handleNavigateToProjects = () => {
        // Use the navigateToProjects function with a parameter to open the create form
        navigateToProjects({ create: 'project' });
    };

    /**
     * Handle data import from ExportImport component
     */
    const handleImport = (importData) => {
        // Migrate tasks to include new fields if needed
        const migratedTasks = (importData.tasks || []).map(task => ({
            ...task,
            completed: task.completed || false,
            archived: task.archived || false
        }));

        // Extract invoices from projects and migrate to separate storage
        const allInvoices = importData.invoices || [];
        const migratedProjects = (importData.projects || []).map(project => {
            const projectInvoices = project.invoices || [];
            
            // Add project invoices to the global invoices array
            allInvoices.push(...projectInvoices);
            
            // Store only invoice IDs in the project
            return {
                ...project,
                invoiceIds: projectInvoices.map(invoice => invoice.id)
            };
        });

        setProjects(migratedProjects);
        setTasks(migratedTasks);
        setInvoices(allInvoices);
        setTimeEntries(importData.timeEntries || []); // Import time entries if provided
        setTimerState({
            startTime: null,
            taskId: null,
            paused: false,
            elapsedTime: 0
        }); // Clear any active timer
    };

    return (
        <ToastProvider>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div 
                            className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 transition-colors group"
                            onClick={() => navigateToDashboard()}
                        >
                            <div className="relative">
                                {/* <img
                                    src="/tasktime-icon.png"
                                    alt="TaskTime Icon"
                                    className="h-8 w-8 group-hover:opacity-90 transition-opacity"
                                /> */}
                                <ClockIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 leading-none">
                                    Task<span className="text-blue-600">Time</span>
                                </h1>
                                <p className="text-xs text-gray-500 leading-none mt-1">Your freelance flow simplified</p>
                            </div>
                        </div>
                        
                        {/* Global Timer Display */}
                        {showGlobalTimer && currentTimer && (
                            <div className="flex-1 flex justify-center">
                                <GlobalTimer
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                    tasks={tasks}
                                    projects={projects}
                                    setTimeEntries={setTimeEntries}
                                    isPaused={isPaused}
                                    setIsPaused={setIsPaused}
                                    pausedElapsedTime={pausedElapsedTime}
                                    setPausedElapsedTime={setPausedElapsedTime}
                                    navigateToProject={navigateToProject}
                                    setTasks={setTasks}
                                    onClose={() => {
                                        setShowGlobalTimer(false);
                                        setIsPaused(false);
                                    }}
                                />
                            </div>
                        )}
                        
                        <div className="flex space-x-4">
                            <button
                                onClick={() => navigateToDashboard()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'dashboard'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => navigateToProjects()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'projects'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Projects
                            </button>
                            <button
                                onClick={() => navigateToInvoices()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'invoices'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Invoices
                            </button>
                            <button
                                onClick={() => navigateToAccount()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'account'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Account
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 content-area">
                {activeView === 'dashboard' && (
                    <Dashboard
                        projects={projects}
                        tasks={tasks}
                        timeEntries={timeEntries}
                        invoices={invoices}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        setTasks={setTasks}
                        navigateToProject={navigateToProject}
                        navigateToInvoices={navigateToInvoices}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        setTimeEntries={setTimeEntries}
                    />
                )}

                {activeView === 'projects' && !selectedProject && (
                    <ProjectList
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        onSelectProject={(project) => {
                            navigateToProject(project.id);
                        }}
                        clientInfos={clientInfos}
                        showCreateForm={urlParams.create === 'project'}
                    />
                )}

                {activeView === 'projects' && selectedProject && (
                    <ProjectDashboard
                        project={selectedProject}
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        onBackToProjects={() => navigateToProjects()}
                        paymentMethods={paymentMethods}
                        onNavigateToPaymentMethods={handleNavigateToPaymentMethods}
                        businessInfos={businessInfos}
                        onNavigateToBusinessInfo={handleNavigateToBusinessInfo}
                        clientInfos={clientInfos}
                        onNavigateToClientInfo={handleNavigateToClientInfo}
                        onNavigateToProjects={handleNavigateToProjects}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        onNavigateToTemplates={handleNavigateToTemplates}
                    />
                )}

                {activeView === 'invoices' && (
                    <Invoices
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        currentTimer={currentTimer}
                        isPaused={isPaused}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        paymentMethods={paymentMethods}
                        setPaymentMethods={setPaymentMethods}
                        businessInfos={businessInfos}
                        setBusinessInfos={setBusinessInfos}
                        clientInfos={clientInfos}
                        setClientInfos={setClientInfos}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        updateUrl={updateUrl}
                        navigateToProjects={handleNavigateToProjects}
                    />
                )}

                {activeView === 'account' && (
                    <Account
                        projects={projects}
                        tasks={tasks}
                        timeEntries={timeEntries}
                        invoices={invoices}
                        onImport={handleImport}
                        setProjects={setProjects}
                        setTasks={setTasks}
                        setTimeEntries={setTimeEntries}
                        setInvoices={setInvoices}
                        setPaymentMethods={setPaymentMethods}
                        setBusinessInfos={setBusinessInfos}
                        setClientInfos={setClientInfos}
                        setInvoiceTemplates={setInvoiceTemplates}
                        setCurrentTimer={setCurrentTimer}
                    />
                )}
            </main>
        </div>
        </ToastProvider>
    );
}

export default App;
