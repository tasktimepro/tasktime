import { useEffect, useState, useMemo } from 'react';
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
import { ToastProvider } from './components/ToastContainer';
import { formatDurationWithSeconds } from './utils/dateUtils';
import { ChartBarIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';

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
    
    // Unified timer state (all timer-related data in one IndexedDB key)
    const [timerState, setTimerState, timerStatus] = useIndexedDB('timer', {
        startTime: null,
        taskId: null,
        paused: false,
        elapsedTime: 0,
        note: undefined
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
                note: undefined
            });
        } else {
            setTimerState(prev => ({
                ...prev,
                startTime: timer.startTime,
                taskId: timer.taskId,
                note: timer.note
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-gray-900">
                        Task<span className="text-blue-600">Time</span>
                    </h1>
                    <p className="text-gray-500 mt-2">Loading your data...</p>
                </div>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="min-h-screen bg-gray-50 flex">
                {/* Sidebar Navigation */}
                <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col h-screen sidebar">
                    {/* Sidebar Header */}
                    <div className="p-6 flex-shrink-0">
                        <div 
                            className="flex items-center space-x-3 cursor-pointer hover:text-blue-600 transition-colors group"
                            onClick={() => navigateToDashboard()}
                        >
                            <div className="relative">
                                <ClockIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 leading-none">
                                    Task<span className="text-blue-600">Time</span>
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
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        activeView === 'dashboard'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <ChartBarIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Dashboard
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToClients()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        activeView === 'clients'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <UserGroupIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Clients
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToProjects()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        activeView === 'projects'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <ClipboardDocumentCheckIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Projects
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToInvoices()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        activeView === 'invoices'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <DocumentTextIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Invoices
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateToAccount()}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        activeView === 'account'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <UserCircleIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Account
                                </button>
                            </li>
                        </ul>
                    </nav>
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
                            <div className="bg-white shadow-lg rounded-lg w-auto max-w-2xl shadow-md">
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
        </ToastProvider>
    );
}

export default App;
