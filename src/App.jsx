import { useEffect, useState, useMemo, useRef, useContext } from 'react';
import './App.css';
import { YjsProvider, useYjs } from './contexts/YjsContext.tsx';
import { useProjects } from './hooks/useProjects.ts';
import { useTasks } from './hooks/useTasks.ts';
import { useTimeEntries } from './hooks/useTimeEntries.ts';
import { useClients } from './hooks/useClients.ts';
import { useInvoices } from './hooks/useInvoices.ts';
import { useBusinessInfos } from './hooks/useBusinessInfos.ts';
import { useInvoiceTemplates } from './hooks/useInvoiceTemplates.ts';
import { usePaymentMethods } from './hooks/usePaymentMethods.ts';
import { usePreferences } from './hooks/usePreferences.ts';
import { useTimer } from './hooks/useTimer.ts';
import { useUrlState } from './hooks/useUrlState.ts';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import ClientList from './components/ClientList';
import ClientDashboard from './components/ClientDashboard';
import Dashboard from './components/Dashboard';
import Account from './components/Account';
import Invoices from './components/Invoices';
import AuthCallback from './components/AuthCallback';
import GlobalTimer from './components/GlobalTimer';
import ModalManager from './components/modals/ModalManager';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import YjsSyncStatus from './components/sync/YjsSyncStatus';
import { ToastProvider } from './components/ToastContainer';
import { ToastContext } from './contexts/ToastContext.ts';
import { formatDurationWithSeconds } from './utils/dateUtils.ts';
import { ChartBarIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon, SunIcon, MoonIcon } from '@/components/ui/icons';
import { TIMER_UPDATE_INTERVAL_MS } from './constants/app.ts';

/** Original browser tab title */
const ORIGINAL_TITLE = "TaskTime - Track your time by the task. Invoice without the mess.";

/**
 * Main App component - Entry point for TaskTime
 * Now powered by Yjs for conflict-free sync
 */
function App() {
    return (
        <ToastProvider>
            <YjsProvider>
                <AppContent />
            </YjsProvider>
        </ToastProvider>
    );
}

/**
 * Inner app content that consumes Yjs hooks
 */
function AppContent() {
    const { isReady, isSyncing, manualSyncInProgress, hasPendingSyncChanges, clearAllData } = useYjs();
    const toast = useContext(ToastContext);

    // === Yjs Data Hooks ===
    const { 
        projects, 
        createProject, 
        isLoading: projectsLoading 
    } = useProjects();

    const { 
        tasks: activeTasks, 
        createTask,
        isLoading: tasksLoading 
    } = useTasks();

    const { 
        entries: timeEntries, 
        createEntry: createTimeEntry,
        isLoading: entriesLoading 
    } = useTimeEntries();

    const { 
        clients, 
        createClient,
        isLoading: clientsLoading 
    } = useClients();

    const { 
        invoices, 
        createInvoice,
        isLoading: invoicesLoading 
    } = useInvoices();

    const { 
        businessInfos, 
        createBusinessInfo,
        isLoading: businessLoading 
    } = useBusinessInfos();

    const { 
        invoiceTemplates, 
        createInvoiceTemplate,
        isLoading: templatesLoading 
    } = useInvoiceTemplates();

    const { 
        paymentMethods, 
        createPaymentMethod,
        isLoading: paymentsLoading 
    } = usePaymentMethods();

    const { 
        preferences, 
        updatePreferences,
        isLoading: preferencesLoading 
    } = usePreferences();

    const { 
        isActive: timerIsActive,
        isPaused,
        taskId: timerTaskId,
        elapsedTime: timerElapsedTime,
        startTime: timerStartTime,
        clearTimer,
        isLoading: timerLoading 
    } = useTimer();

    // === Loading State ===
    const isLoading = !isReady || projectsLoading || tasksLoading || entriesLoading || 
        clientsLoading || invoicesLoading || businessLoading || templatesLoading || 
        paymentsLoading || preferencesLoading || timerLoading;

    // Show a one-time toast if the user mouses out while uploads are in-flight
    const syncToastShownRef = useRef(false);

    // Reset the toast guard when syncing finishes
    useEffect(() => {
        if (!isSyncing && !manualSyncInProgress) {
            syncToastShownRef.current = false;
        }
    }, [isSyncing, manualSyncInProgress]);

    useEffect(() => {
        if (typeof window === 'undefined' || !toast) {
            return undefined;
        }

        const handleMouseOut = (event) => {
            if (!manualSyncInProgress) {
                return;
            }

            if (!hasPendingSyncChanges()) {
                return;
            }

            // Only fire when the pointer leaves the window (not when hovering child elements)
            const { clientX, clientY, relatedTarget } = event;
            const leavingWindow = relatedTarget === null && (
                clientX <= 0 ||
                clientY <= 0 ||
                clientX >= window.innerWidth ||
                clientY >= window.innerHeight
            );
            if (!leavingWindow || syncToastShownRef.current) {
                return;
            }

            syncToastShownRef.current = true;
            toast.showInfo('Uploading changes… your data is safe locally.', 3500);
        };

        window.addEventListener('mouseout', handleMouseOut);
        return () => window.removeEventListener('mouseout', handleMouseOut);

    }, [isSyncing, manualSyncInProgress, hasPendingSyncChanges, toast]);

    // === Dark Mode ===
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasktime-dark-mode');
            if (saved !== null) return saved === 'true';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });
    
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('tasktime-dark-mode', String(darkMode));
    }, [darkMode]);

    // === Modal State ===
    const [activeModal, setActiveModal] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [modalOptions, setModalOptions] = useState(null);

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
        setModalOptions(options || null);
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

    // === Global Timer UI State ===
    const [showGlobalTimer, setShowGlobalTimer] = useState(false);

    // Show global timer when a timer becomes active
    useEffect(() => {
        if (timerIsActive) {
            setShowGlobalTimer(true);
        }
    }, [timerIsActive]);

    // === Browser Tab Title ===
    const timerStateRef = useRef({ timerTaskId, timerStartTime, timerElapsedTime, isPaused });
    const tasksRef = useRef(activeTasks);
    
    useEffect(() => {
        timerStateRef.current = { timerTaskId, timerStartTime, timerElapsedTime, isPaused };
    }, [timerTaskId, timerStartTime, timerElapsedTime, isPaused]);
    
    useEffect(() => {
        tasksRef.current = activeTasks;
    }, [activeTasks]);

    const currentTaskName = useMemo(() => {
        if (!timerTaskId) return null;
        const task = activeTasks.find(t => t.id === timerTaskId);
        return task?.title || null;
    }, [timerTaskId, activeTasks]);

    useEffect(() => {
        if (!timerIsActive || !timerTaskId) {
            document.title = ORIGINAL_TITLE;
            return;
        }
        
        if (!currentTaskName) return;
        
        if (isPaused) {
            const pausedTime = formatDurationWithSeconds(timerElapsedTime);
            document.title = `⏸ ${pausedTime} - ${currentTaskName} | TaskTime`;
            return;
        }
        
        const updateTitle = () => {
            const { timerStartTime: startTime, timerTaskId: activeTaskId } = timerStateRef.current;
            if (!startTime || !activeTaskId) return;
            
            const elapsed = Date.now() - startTime;
            const formattedTime = formatDurationWithSeconds(elapsed);
            const taskName = tasksRef.current.find(t => t.id === activeTaskId)?.title || currentTaskName;
            
            document.title = `▶ ${formattedTime} - ${taskName} | TaskTime`;
        };
        
        updateTitle();
        const interval = setInterval(updateTitle, TIMER_UPDATE_INTERVAL_MS);
        
        return () => clearInterval(interval);
    }, [timerTaskId, timerStartTime, timerIsActive, isPaused, timerElapsedTime, currentTaskName]);

    // === URL State ===
    const { urlParams, navigateToProjects, navigateToProject, navigateToClients, navigateToClient, navigateToInvoices, navigateToAccount, navigateToDashboard, updateUrl } = useUrlState();
    
    const activeView = urlParams.view;
    const selectedProject = urlParams.projectId 
        ? projects.find(p => p.id === urlParams.projectId) 
        : null;
    const selectedClient = urlParams.clientId 
        ? clients.find(c => c.id === urlParams.clientId) 
        : null;

    // Handle missing project/client in URL
    useEffect(() => {
        if (isLoading) return;
        if (urlParams.projectId && urlParams.view === 'projects' && !selectedProject) {
            navigateToProjects();
        }
    }, [urlParams.projectId, urlParams.view, selectedProject, navigateToProjects, isLoading]);

    useEffect(() => {
        if (isLoading) return;
        if (urlParams.clientId && urlParams.view === 'clients' && !selectedClient) {
            navigateToClients();
        }
    }, [urlParams.clientId, urlParams.view, selectedClient, navigateToClients, isLoading]);

    const handleNavigateToProjects = () => {
        navigateToProjects({ create: 'project' });
    };

    // === Import Handler ===
    const handleImport = async (importData) => {
        await clearAllData();

        (importData.projects || []).forEach((project) => createProject(project));
        (importData.tasks || []).forEach((task) => createTask(task));
        (importData.timeEntries || []).forEach((entry) => createTimeEntry(entry));
        (importData.invoices || []).forEach((invoice) => createInvoice(invoice));
        (importData.paymentMethods || []).forEach((method) => createPaymentMethod(method));
        (importData.businessInfos || []).forEach((info) => createBusinessInfo(info));
        (importData.clients || []).forEach((client) => createClient(client));
        (importData.invoiceTemplates || []).forEach((template) => createInvoiceTemplate(template));

        updatePreferences(importData.preferences || {});
        clearTimer();
    };

    // === Loading Screen ===
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-foreground">Task<span>Time</span></h1>
                    <p className="text-muted-foreground mt-2">Loading your data...</p>
                </div>
            </div>
        );
    }

    // === Main Render ===
    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto w-full max-w-[100rem] px-6">
            <div className="flex gap-6">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-card shadow-sm border border-border rounded-xl flex flex-col h-[calc(100vh-3rem)] sidebar my-6">
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
                    <YjsSyncStatus className="mt-2" />
                    <OfflineIndicator className="mt-2" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 main-content relative">
                <div className={`pr-4 pb-6 ${showGlobalTimer && timerIsActive ? 'pt-20' : 'pt-6'}`}>
                    {activeView === 'dashboard' && (
                            <ErrorBoundary>
                            <Dashboard
                                projects={projects}
                                invoices={invoices}
                                clients={clients}
                                navigateToProject={navigateToProject}
                                navigateToClient={navigateToClient}
                                navigateToInvoices={navigateToInvoices}
                            />
                            </ErrorBoundary>
                        )}

                    {activeView === 'auth-callback' && (
                            <AuthCallback />
                        )}

                    {activeView === 'projects' && !selectedProject && (
                            <ErrorBoundary>
                            <ProjectList
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
                                tasks={activeTasks}
                                timeEntries={timeEntries}
                                onBackToProjects={() => navigateToProjects()}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                invoices={invoices}
                                invoiceTemplates={invoiceTemplates}
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
                                tasks={activeTasks}
                                timeEntries={timeEntries}
                                onBackToClients={() => navigateToClients()}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                navigateToProject={navigateToProject}
                                invoices={invoices}
                                invoiceTemplates={invoiceTemplates}
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
                                tasks={activeTasks}
                                timeEntries={timeEntries}
                                invoices={invoices}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                invoiceTemplates={invoiceTemplates}
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
                                tasks={activeTasks}
                                timeEntries={timeEntries}
                                invoices={invoices}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                invoiceTemplates={invoiceTemplates}
                                onImport={handleImport}
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
                    />
                </div>
                
                {/* Global Timer Display - Fixed at top */}
                {showGlobalTimer && timerIsActive && (
                    <div className="fixed top-4 left-[calc(1.5rem+16rem+1.5rem)] right-6 z-50 flex justify-center global-timer-mobile">
                        <div className="bg-card shadow-lg rounded-lg w-auto max-w-2xl shadow-md">
                            <GlobalTimer
                                navigateToProject={navigateToProject}
                                onClose={() => {
                                    setShowGlobalTimer(false);
                                }}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
        </div>
        
        {/* PWA Components */}
        <InstallPrompt />
        </div>
    );
}

export default App;
