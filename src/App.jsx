import { useEffect, useState, useMemo, useRef } from 'react';
import './App.css';
import { useIndexedDB, useIndexedDBLoading } from './hooks/useIndexedDB';
import { useUrlState } from './hooks/useUrlState';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import ClientList from './components/ClientList';
import ClientDashboard from './components/ClientDashboard';
import Dashboard from './components/Dashboard';
import Account from './components/Account';
import Invoices from './components/Invoices';
import GlobalTimer from './components/GlobalTimer';
import ModalManager from './components/modals/ModalManager';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import { ToastProvider } from './components/ToastContainer';
import { formatDurationWithSeconds } from './utils/dateUtils';
import { ChartBarIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon, SunIcon, MoonIcon } from '@/components/ui/icons';
import { TIMER_UPDATE_INTERVAL_MS, TIMER_HEARTBEAT_INTERVAL_MS } from './constants/app';

/** Original browser tab title */
const ORIGINAL_TITLE = "TaskTime - Track your time by the task. Invoice without the mess.";

/**
 * Main App component - Entry point for the Task. Time. Track.
 */
function App() {

    // IndexedDB state management
    const [projects, setProjects, projectsStatus] = useIndexedDB('projects', []);
    const [tasks, setTasks, tasksStatus] = useIndexedDB('tasks', []);
    const [timeEntries, setTimeEntries, timeEntriesStatus] = useIndexedDB('timeEntries', []);
    const [paymentMethods, setPaymentMethods, paymentMethodsStatus] = useIndexedDB('paymentMethods', []);
    const [businessInfos, setBusinessInfos, businessInfosStatus] = useIndexedDB('businessInfos', []);
    const [clients, setClients, clientsStatus] = useIndexedDB('clients', []);
    const [invoices, setInvoices, invoicesStatus] = useIndexedDB('invoices', []);
    const [invoiceTemplates, setInvoiceTemplates, invoiceTemplatesStatus] = useIndexedDB('invoiceTemplates', []);
    const [preferences, setPreferences, preferencesStatus] = useIndexedDB('preferences', {});
    
    // Dark mode state - persisted in preferences
    const [darkMode, setDarkMode] = useState(() => {
        // Check if user has a saved preference, otherwise use system preference
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasktime-dark-mode');
            if (saved !== null) return saved === 'true';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });
    
    // Apply dark mode class to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('tasktime-dark-mode', String(darkMode));
    }, [darkMode]);
    
    // Unified timer state (all timer-related data in one IndexedDB key)
    const [timerState, setTimerState, timerStatus] = useIndexedDB('timer', {
        startTime: null,
        taskId: null,
        paused: false,
        elapsedTime: 0,
        note: undefined,
        lastActive: null  // Heartbeat timestamp for crash recovery
    });

    // Track overall loading state
    const isLoading = useIndexedDBLoading([
        projectsStatus,
        tasksStatus,
        timeEntriesStatus,
        paymentMethodsStatus,
        businessInfosStatus,
        clientsStatus,
        invoicesStatus,
        invoiceTemplatesStatus,
        preferencesStatus,
        timerStatus
    ]);
    
    // Modal state for form modals
    const [activeModal, setActiveModal] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [modalOptions, setModalOptions] = useState(null);

    // Modal utility functions
    const openClientModal = (client = null) => {

        setActiveModal('client');
        setEditingItem(client);
    };

    const editClientModal = (client) => {

        setActiveModal('client');
        setEditingItem(client);
    };

    const openProjectModal = (project = null, options = null) => {

        setActiveModal('project');
        setEditingItem(project);

        // Store options for the project modal to use
        if (options) {

            setModalOptions(options);
        } else {

            setModalOptions(null);
        }
    };

    const editProjectModal = (project) => {

        setActiveModal('project');
        setEditingItem(project);
    };

    const openTemplateModal = (template = null) => {

        setActiveModal('template');
        setEditingItem(template);
    };

    const editTemplateModal = (template) => {

        setActiveModal('template');
        setEditingItem(template);
    };

    const openPaymentMethodModal = (paymentMethod = null) => {

        setActiveModal('payment-method');
        setEditingItem(paymentMethod);
    };

    const editPaymentMethodModal = (paymentMethod) => {

        setActiveModal('payment-method');
        setEditingItem(paymentMethod);
    };

    const openBusinessModal = (businessInfo = null) => {

        setActiveModal('business');
        setEditingItem(businessInfo);
    };

    const editBusinessModal = (businessInfo) => {

        setActiveModal('business');
        setEditingItem(businessInfo);
    };

    // Derived state for backward compatibility
    const currentTimer = useMemo(() => {

        return timerState.startTime && timerState.taskId ? {
            startTime: timerState.startTime,
            taskId: timerState.taskId,
            note: timerState.note
        } : null;
    }, [timerState.startTime, timerState.taskId, timerState.note]);
    
    const isPaused = timerState.paused;
    const pausedElapsedTime = timerState.elapsedTime;

    // Helper functions to update timer state
    const setCurrentTimer = (timer) => {
        if (timer === null) {
            setTimerState({
                startTime: null,
                taskId: null,
                paused: false,
                elapsedTime: 0,
                note: undefined,
                lastActive: null
            });
        } else {
            setTimerState(prev => ({
                ...prev,
                startTime: timer.startTime,
                taskId: timer.taskId,
                note: timer.note,
                lastActive: Date.now()  // Set initial heartbeat when timer starts
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

    // Timer heartbeat - periodically save timer state for crash recovery
    // This updates a lastActive timestamp every 30 seconds while timer is running
    useEffect(() => {
        // Only run heartbeat when timer is active and not paused
        if (!currentTimer || isPaused) return;

        const heartbeat = () => {
            setTimerState(prev => ({
                ...prev,
                lastActive: Date.now()
            }));
        };

        // Save immediately when timer starts
        heartbeat();

        // Then save every 30 seconds
        const interval = setInterval(heartbeat, TIMER_HEARTBEAT_INTERVAL_MS);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTimer?.taskId, isPaused]);

    // State for showing/hiding global timer
    const [showGlobalTimer, setShowGlobalTimer] = useState(false);

    // Refs to track latest values for browser tab title (avoids stale closures)
    const timerStateRef = useRef({ currentTimer, isPaused, pausedElapsedTime });
    const tasksRef = useRef(tasks);
    
    // Keep refs updated with latest values
    useEffect(() => {
        timerStateRef.current = { currentTimer, isPaused, pausedElapsedTime };
    }, [currentTimer, isPaused, pausedElapsedTime]);
    
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    // Find current task name (memoized to avoid recalculating on every render)
    const currentTaskName = useMemo(() => {
        if (!currentTimer?.taskId) return null;
        const task = tasks.find(t => t.id === currentTimer.taskId);
        return task?.title || null;
    }, [currentTimer?.taskId, tasks]);

    // Update browser tab title with live timer
    useEffect(() => {
        // No timer active - reset to original title
        if (!currentTimer) {
            document.title = ORIGINAL_TITLE;
            return;
        }
        
        // Task not found yet (still loading) - don't update title
        if (!currentTaskName) {
            return;
        }
        
        // Timer is paused - show static paused state
        if (isPaused) {
            const pausedTime = formatDurationWithSeconds(pausedElapsedTime);
            document.title = `⏸ ${pausedTime} - ${currentTaskName} | TaskTime`;
            return;
        }
        
        // Timer is running - update title every second
        const updateTitle = () => {
            // Use ref to get latest timer state to avoid stale closure
            const { currentTimer: timer } = timerStateRef.current;
            if (!timer) return;
            
            const elapsed = Date.now() - timer.startTime;
            const formattedTime = formatDurationWithSeconds(elapsed);
            // Use latest task name from ref in case it changed
            const taskName = tasksRef.current.find(t => t.id === timer.taskId)?.title || currentTaskName;
            
            document.title = `▶ ${formattedTime} - ${taskName} | TaskTime`;
        };
        
        // Update immediately
        updateTitle();
        
        // Then update every second
        const interval = setInterval(updateTitle, TIMER_UPDATE_INTERVAL_MS);
        
        return () => {
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTimer?.taskId, currentTimer?.startTime, isPaused, pausedElapsedTime, currentTaskName]);

    // URL-based state management
    const { urlParams, navigateToProjects, navigateToProject, navigateToClients, navigateToClient, navigateToInvoices, navigateToAccount, navigateToDashboard, updateUrl } = useUrlState();
    
    // Derived state from URL parameters
    const activeView = urlParams.view;
    const selectedProject = urlParams.projectId 
        ? projects.find(p => p.id === urlParams.projectId) 
        : null;
    const selectedClient = urlParams.clientId 
        ? clients.find(c => c.id === urlParams.clientId) 
        : null;

    // Handle case where project in URL doesn't exist (e.g., deleted project)
    useEffect(() => {

        if (isLoading) return; // Don't redirect while loading

        if (urlParams.projectId && urlParams.view === 'projects' && !selectedProject) {

            navigateToProjects();
        }
    }, [urlParams.projectId, urlParams.view, selectedProject, navigateToProjects, isLoading]);

    // Handle case where client in URL doesn't exist (e.g., deleted client)
    useEffect(() => {

        if (isLoading) return; // Don't redirect while loading

        if (urlParams.clientId && urlParams.view === 'clients' && !selectedClient) {

            navigateToClients();
        }
    }, [urlParams.clientId, urlParams.view, selectedClient, navigateToClients, isLoading]);

    // Show global timer when a timer becomes active or is paused
    useEffect(() => {

        if (currentTimer) {

            setShowGlobalTimer(true);
        }
    }, [currentTimer]);

    /**
     * Handle navigation to projects view with project creation
     */
    const handleNavigateToProjects = () => {

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

        // Import all data types
        setProjects(migratedProjects);
        setTasks(migratedTasks);
        setInvoices(allInvoices);
        setTimeEntries(importData.timeEntries || []);
        setPaymentMethods(importData.paymentMethods || []);
        setBusinessInfos(importData.businessInfos || []);
        setClients(importData.clients || []);
        setInvoiceTemplates(importData.invoiceTemplates || []);
        setPreferences(importData.preferences || {});
        
        // Clear any active timer
        setTimerState({
            startTime: null,
            taskId: null,
            paused: false,
            elapsedTime: 0
        });
    };

    // Show loading state while IndexedDB data is being loaded
    if (isLoading) {

        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-foreground">
                        Task<span className="text-blue-600">Time</span>
                    </h1>
                    <p className="text-muted-foreground mt-2">Loading your data...</p>
                </div>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="min-h-screen bg-background flex">
                {/* Sidebar Navigation */}
                <aside className="w-64 bg-card shadow-sm border-r border-border flex flex-col h-screen sidebar">
                    {/* Sidebar Header */}
                    <div className="p-6 flex-shrink-0">
                        <div 
                            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity group"
                            onClick={() => navigateToDashboard()}
                        >
                            <div className="relative">
                                <ClockIcon className="h-6 w-6 text-foreground" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground leading-none">
                                    TaskTime
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 px-4 py-6 overflow-y-auto">
                        <ul className="space-y-2">
                            <li>
                                <button
                                    onClick={() => navigateToDashboard()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                        activeView === 'dashboard'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <ChartBarIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Dashboard
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToClients()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                        activeView === 'clients'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <UserGroupIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Clients
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToProjects()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                        activeView === 'projects'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <ClipboardDocumentCheckIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Projects
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToInvoices()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                        activeView === 'invoices'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <DocumentTextIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Invoices
                                </button>
                            </li>
                        </ul>
                    </nav>
                    
                    {/* Theme Toggle */}
                    <div className="px-4 py-4 border-t border-border space-y-2">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? (
                                <SunIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            ) : (
                                <MoonIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            )}
                            {darkMode ? 'Light Mode' : 'Dark Mode'}
                        </button>
                        <button
                            onClick={() => navigateToAccount()}
                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                activeView === 'account'
                                    ? 'bg-accent text-accent-foreground font-semibold'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                        >
                            <UserCircleIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            Account
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 main-content relative">
                    <div className={`pl-8 pr-6 pb-8 ${showGlobalTimer && currentTimer ? 'pt-20' : 'pt-8'}`}>{/* Inner content with balanced padding, extra top padding when timer is active */}
                {activeView === 'dashboard' && (
                    <ErrorBoundary>
                    <Dashboard
                        projects={projects}
                        tasks={tasks}
                        timeEntries={timeEntries}
                        invoices={invoices}
                        clients={clients}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        setTasks={setTasks}
                        navigateToProject={navigateToProject}
                        navigateToClient={navigateToClient}
                        navigateToInvoices={navigateToInvoices}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        setTimeEntries={setTimeEntries}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'projects' && !selectedProject && (
                    <ErrorBoundary>
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
                        clients={clients}
                        openProjectModal={openProjectModal}
                        editProjectModal={editProjectModal}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'projects' && selectedProject && (
                    <ErrorBoundary>
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
                        businessInfos={businessInfos}
                        clients={clients}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        // Modal functions
                        openClientModal={openClientModal}
                        openProjectModal={openProjectModal}
                        openBusinessModal={openBusinessModal}
                        openPaymentMethodModal={openPaymentMethodModal}
                        openTemplateModal={openTemplateModal}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'clients' && !selectedClient && (
                    <ErrorBoundary>
                    <ClientList
                        clients={clients}
                        setClients={setClients}
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        onSelectClient={(client) => {
                            navigateToClient(client.id);
                        }}
                        openClientModal={openClientModal}
                        editClientModal={editClientModal}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'clients' && selectedClient && (
                    <ErrorBoundary>
                    <ClientDashboard
                        client={selectedClient}
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        currentTimer={currentTimer}
                        isPaused={isPaused}
                        onBackToClients={() => navigateToClients()}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
                        navigateToProject={navigateToProject}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        // Modal functions
                        openClientModal={openClientModal}
                        openProjectModal={openProjectModal}
                        openBusinessModal={openBusinessModal}
                        openPaymentMethodModal={openPaymentMethodModal}
                        openTemplateModal={openTemplateModal}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'invoices' && (
                    <ErrorBoundary>
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
                        clients={clients}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        updateUrl={updateUrl}
                        navigateToProjects={handleNavigateToProjects}
                        navigateToClients={navigateToClients}
                        openClientModal={openClientModal}
                        openProjectModal={openProjectModal}
                        openTemplateModal={openTemplateModal}
                        editTemplateModal={editTemplateModal}
                        openPaymentMethodModal={openPaymentMethodModal}
                        editPaymentMethodModal={editPaymentMethodModal}
                        openBusinessModal={openBusinessModal}
                        editBusinessModal={editBusinessModal}
                    />
                    </ErrorBoundary>
                )}

                {activeView === 'account' && (
                    <ErrorBoundary>
                    <Account
                        projects={projects}
                        tasks={tasks}
                        timeEntries={timeEntries}
                        invoices={invoices}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
                        invoiceTemplates={invoiceTemplates}
                        preferences={preferences}
                        currentTimer={currentTimer}
                        onImport={handleImport}
                        setProjects={setProjects}
                        setTasks={setTasks}
                        setTimeEntries={setTimeEntries}
                        setInvoices={setInvoices}
                        setPaymentMethods={setPaymentMethods}
                        setBusinessInfos={setBusinessInfos}
                        setClients={setClients}
                        setInvoiceTemplates={setInvoiceTemplates}
                        setPreferences={setPreferences}
                        setCurrentTimer={setCurrentTimer}
                    />
                    </ErrorBoundary>
                )}

                {/* Modal Manager for Form Modals */}
                <ModalManager
                    activeModal={activeModal}
                    setActiveModal={setActiveModal}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    modalOptions={modalOptions}
                    setModalOptions={setModalOptions}
                    clients={clients}
                    setClients={setClients}
                    projects={projects}
                    setProjects={setProjects}
                    tasks={tasks}
                    setTasks={setTasks}
                    timeEntries={timeEntries}
                    setTimeEntries={setTimeEntries}
                    invoices={invoices}
                    setInvoices={setInvoices}
                    invoiceTemplates={invoiceTemplates}
                    setInvoiceTemplates={setInvoiceTemplates}
                    paymentMethods={paymentMethods}
                    setPaymentMethods={setPaymentMethods}
                    businessInfos={businessInfos}
                    setBusinessInfos={setBusinessInfos}
                />
                    </div>
                    
                    {/* Global Timer Display - Fixed at top */}
                    {showGlobalTimer && currentTimer && (
                        <div className="fixed top-4 left-64 right-4 z-50 flex justify-center global-timer-mobile">
                            <div className="bg-card shadow-lg rounded-lg w-auto max-w-2xl shadow-md">
                                <GlobalTimer
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                    tasks={tasks}
                                    projects={projects}
                                    setTimeEntries={setTimeEntries}
                                    timeEntries={timeEntries}
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
                        </div>
                    )}
                </main>
            </div>
            
            {/* PWA Components */}
            <OfflineIndicator />
            <InstallPrompt />
        </ToastProvider>
    );
}

export default App;
