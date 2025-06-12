import { useEffect, useState, useMemo } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useUrlState } from './hooks/useUrlState';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import ClientList from './components/ClientList';
import ClientDashboard from './components/ClientDashboard';
import Dashboard from './components/Dashboard';
import Account from './components/Account';
import Invoices from './components/Invoices';
import GlobalTimer from './components/GlobalTimer';
// import OnboardingModal from './components/OnboardingModal'; // DISABLED
import ModalManager from './components/modals/ModalManager';
import { ToastProvider } from './components/ToastContainer';
import { formatDurationWithSeconds } from './utils/dateUtils';
import { ChartBarIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';

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
    const [clients, setClients] = useLocalStorage('clients', []);
    const [invoices, setInvoices] = useLocalStorage('invoices', []);
    const [invoiceTemplates, setInvoiceTemplates] = useLocalStorage('invoiceTemplates', []);
    const [preferences, setPreferences] = useLocalStorage('preferences', {});
    
    // Onboarding state - DISABLED
    // const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage('hasCompletedOnboarding', false);
    // const [showOnboarding, setShowOnboarding] = useState(false);
    
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
            // We'll need to pass this to the ModalManager
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

    // Detect first-time users and show onboarding - DISABLED
    /*
    useEffect(() => {
        // Check if user has any data OR if localStorage keys exist (indicating they've used the app before)
        const hasAnyData = projects.length > 0 || 
                          tasks.length > 0 || 
                          timeEntries.length > 0 || 
                          invoices.length > 0 || 
                          paymentMethods.length > 0 || 
                          businessInfos.length > 0 || 
                          clients.length > 0 ||
                          invoiceTemplates.length > 0;

        // Check if localStorage keys exist (even if empty) - indicates the user has used the app before
        const hasUsedAppBefore = localStorage.getItem('projects') !== null ||
                                localStorage.getItem('tasks') !== null ||
                                localStorage.getItem('timeEntries') !== null ||
                                localStorage.getItem('invoices') !== null ||
                                localStorage.getItem('paymentMethods') !== null ||
                                localStorage.getItem('businessInfos') !== null ||
                                localStorage.getItem('clients') !== null ||
                                localStorage.getItem('invoiceTemplates') !== null ||
                                localStorage.getItem('preferences') !== null;

        // Show onboarding only if user hasn't completed it AND has no data AND hasn't used the app before
        if (!hasCompletedOnboarding && !hasAnyData && !hasUsedAppBefore) {
            setShowOnboarding(true);
        }
    }, [
        hasCompletedOnboarding, 
        projects.length, 
        tasks.length, 
        timeEntries.length, 
        invoices.length,
        paymentMethods.length,
        businessInfos.length,
        clients.length,
        invoiceTemplates.length
    ]);
    */

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
        if (urlParams.projectId && urlParams.view === 'projects' && !selectedProject) {
            console.warn('Project not found, redirecting to projects view');
            navigateToProjects();
        }
    }, [urlParams.projectId, urlParams.view, selectedProject, navigateToProjects]);

    // Handle case where client in URL doesn't exist (e.g., deleted client)
    useEffect(() => {
        if (urlParams.clientId && urlParams.view === 'clients' && !selectedClient) {
            console.warn('Client not found, redirecting to clients view');
            navigateToClients();
        }
    }, [urlParams.clientId, urlParams.view, selectedClient, navigateToClients]);

    // Show global timer when a timer becomes active or is paused
    useEffect(() => {
        if (currentTimer) {
            setShowGlobalTimer(true);
        }
    }, [currentTimer]);

    // Handle onboarding completion - DISABLED
    /*
    const handleOnboardingComplete = () => {
        setHasCompletedOnboarding(true);
        setShowOnboarding(false);
    };

    const handleOnboardingCreateProject = (projectData) => {
        setProjects(prev => [...prev, projectData]);
    };

    const handleOnboardingCreateTask = (taskData) => {
        setTasks(prev => [...prev, taskData]);
    };
    */

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

    // Check if onboarding is required - DISABLED
    // useEffect(() => {
    //     if (!hasCompletedOnboarding) {
    //         setShowOnboarding(true);
    //     }
    // }, [hasCompletedOnboarding]);

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
                    <div className={`pl-8 pr-6 pt-8 pb-8 ${showGlobalTimer && currentTimer ? 'pt-20' : ''}`}>{/* Inner content with balanced padding, extra top padding when timer is active */}
                {activeView === 'dashboard' && (
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
                        clients={clients}
                        openProjectModal={openProjectModal}
                        editProjectModal={editProjectModal}
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
                )}

                {activeView === 'clients' && !selectedClient && (
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
                )}

                {activeView === 'clients' && selectedClient && (
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
                )}

                {activeView === 'account' && (
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
                )}

                {/* Onboarding Modal - DISABLED */}
                {/*
                <OnboardingModal
                    isOpen={showOnboarding}
                    onComplete={handleOnboardingComplete}
                    onCreateProject={handleOnboardingCreateProject}
                    onCreateTask={handleOnboardingCreateTask}
                />
                */}

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
                            <div className="bg-white shadow-lg rounded-lg w-auto max-w-2xl">
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
                        </div>
                    )}
                </main>
            </div>
        </ToastProvider>
    );
}

export default App;
