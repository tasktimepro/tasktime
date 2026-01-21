import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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

    const { isReady, syncState, isSyncing } = useYjs();

    // === Yjs Data Hooks ===
    const { 
        projects, 
        createProject, 
        updateProject, 
        deleteProject,
        isLoading: projectsLoading 
    } = useProjects();
    
    const { 
        tasks: activeTasks, 
        createTask, 
        updateTask, 
        deleteTask,
        archiveTask,
        isLoading: tasksLoading 
    } = useTasks();
    
    const { 
        entries: timeEntries, 
        createEntry: createTimeEntry, 
        updateEntry: updateTimeEntry, 
        deleteEntry: deleteTimeEntry,
        isLoading: entriesLoading 
    } = useTimeEntries();
    
    const { 
        clients, 
        createClient, 
        updateClient, 
        deleteClient,
        isLoading: clientsLoading 
    } = useClients();
    
    const { 
        invoices, 
        createInvoice, 
        updateInvoice, 
        deleteInvoice,
        isLoading: invoicesLoading 
    } = useInvoices();
    
    const { 
        businessInfos, 
        createBusinessInfo, 
        updateBusinessInfo, 
        deleteBusinessInfo,
        isLoading: businessLoading 
    } = useBusinessInfos();
    
    const { 
        invoiceTemplates, 
        createInvoiceTemplate, 
        updateInvoiceTemplate, 
        deleteInvoiceTemplate,
        isLoading: templatesLoading 
    } = useInvoiceTemplates();
    
    const { 
        paymentMethods, 
        createPaymentMethod, 
        updatePaymentMethod, 
        deletePaymentMethod,
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
        note: timerNote,
        startTime: timerStartTime,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        setNote: setTimerNote,
        clearTimer,
        isLoading: timerLoading 
    } = useTimer();

    // === Loading State ===
    const isLoading = !isReady || projectsLoading || tasksLoading || entriesLoading || 
        clientsLoading || invoicesLoading || businessLoading || templatesLoading || 
        paymentsLoading || preferencesLoading || timerLoading;

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

    // === Timer Compatibility Layer ===
    // Create objects that match the old interface for child components
    const currentTimer = useMemo(() => {
        if (!timerIsActive || !timerTaskId) return null;
        return {
            startTime: timerStartTime,
            taskId: timerTaskId,
            note: timerNote
        };
    }, [timerIsActive, timerTaskId, timerStartTime, timerNote]);

    const pausedElapsedTime = timerElapsedTime;

    // Wrapper functions to match old interface
    const setCurrentTimer = useCallback((timer) => {
        if (timer === null) {
            clearTimer();
        } else {
            startTimer(timer.taskId, timer.note);
        }
    }, [clearTimer, startTimer]);

    const setIsPaused = useCallback((paused) => {
        if (paused) {
            pauseTimer();
        } else {
            resumeTimer();
        }
    }, [pauseTimer, resumeTimer]);

    const setPausedElapsedTime = useCallback(() => {
        // This is now handled internally by useTimer
        // Kept for interface compatibility
    }, []);

    // === State Setter Wrappers ===
    // These wrap Yjs operations in a setState-like interface for backward compatibility
    const setProjects = useCallback((updater) => {
        if (typeof updater === 'function') {
            const current = projects;
            const updated = updater(current);
            // Sync the changes
            updated.forEach(p => {
                const existing = projects.find(ep => ep.id === p.id);
                if (!existing) {
                    createProject(p);
                } else if (JSON.stringify(existing) !== JSON.stringify(p)) {
                    updateProject(p.id, p);
                }
            });
            // Handle deletions
            projects.forEach(p => {
                if (!updated.find(up => up.id === p.id)) {
                    deleteProject(p.id);
                }
            });
        } else {
            // Direct array assignment - replace all
            updater.forEach(p => {
                const existing = projects.find(ep => ep.id === p.id);
                if (!existing) {
                    createProject(p);
                } else if (JSON.stringify(existing) !== JSON.stringify(p)) {
                    updateProject(p.id, p);
                }
            });
            projects.forEach(p => {
                if (!updater.find(up => up.id === p.id)) {
                    deleteProject(p.id);
                }
            });
        }
    }, [projects, createProject, updateProject, deleteProject]);

    const setTasks = useCallback((updater) => {
        const current = activeTasks;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(t => {
            const existing = current.find(et => et.id === t.id);
            if (!existing) {
                createTask(t);
            } else if (JSON.stringify(existing) !== JSON.stringify(t)) {
                updateTask(t.id, t);
            }
        });
        current.forEach(t => {
            if (!updated.find(ut => ut.id === t.id)) {
                deleteTask(t.id);
            }
        });
    }, [activeTasks, createTask, updateTask, deleteTask]);

    const setTimeEntries = useCallback((updater) => {
        const current = timeEntries;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(e => {
            const existing = current.find(ee => ee.id === e.id);
            if (!existing) {
                createTimeEntry(e);
            } else if (JSON.stringify(existing) !== JSON.stringify(e)) {
                updateTimeEntry(e.id, e);
            }
        });
        current.forEach(e => {
            if (!updated.find(ue => ue.id === e.id)) {
                deleteTimeEntry(e.id);
            }
        });
    }, [timeEntries, createTimeEntry, updateTimeEntry, deleteTimeEntry]);

    const setClients = useCallback((updater) => {
        const current = clients;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(c => {
            const existing = current.find(ec => ec.id === c.id);
            if (!existing) {
                createClient(c);
            } else if (JSON.stringify(existing) !== JSON.stringify(c)) {
                updateClient(c.id, c);
            }
        });
        current.forEach(c => {
            if (!updated.find(uc => uc.id === c.id)) {
                deleteClient(c.id);
            }
        });
    }, [clients, createClient, updateClient, deleteClient]);

    const setInvoices = useCallback((updater) => {
        const current = invoices;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(i => {
            const existing = current.find(ei => ei.id === i.id);
            if (!existing) {
                createInvoice(i);
            } else if (JSON.stringify(existing) !== JSON.stringify(i)) {
                updateInvoice(i.id, i);
            }
        });
        current.forEach(i => {
            if (!updated.find(ui => ui.id === i.id)) {
                deleteInvoice(i.id);
            }
        });
    }, [invoices, createInvoice, updateInvoice, deleteInvoice]);

    const setBusinessInfos = useCallback((updater) => {
        const current = businessInfos;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(b => {
            const existing = current.find(eb => eb.id === b.id);
            if (!existing) {
                createBusinessInfo(b);
            } else if (JSON.stringify(existing) !== JSON.stringify(b)) {
                updateBusinessInfo(b.id, b);
            }
        });
        current.forEach(b => {
            if (!updated.find(ub => ub.id === b.id)) {
                deleteBusinessInfo(b.id);
            }
        });
    }, [businessInfos, createBusinessInfo, updateBusinessInfo, deleteBusinessInfo]);

    const setInvoiceTemplates = useCallback((updater) => {
        const current = invoiceTemplates;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(t => {
            const existing = current.find(et => et.id === t.id);
            if (!existing) {
                createInvoiceTemplate(t);
            } else if (JSON.stringify(existing) !== JSON.stringify(t)) {
                updateInvoiceTemplate(t.id, t);
            }
        });
        current.forEach(t => {
            if (!updated.find(ut => ut.id === t.id)) {
                deleteInvoiceTemplate(t.id);
            }
        });
    }, [invoiceTemplates, createInvoiceTemplate, updateInvoiceTemplate, deleteInvoiceTemplate]);

    const setPaymentMethods = useCallback((updater) => {
        const current = paymentMethods;
        const updated = typeof updater === 'function' ? updater(current) : updater;
        
        updated.forEach(p => {
            const existing = current.find(ep => ep.id === p.id);
            if (!existing) {
                createPaymentMethod(p);
            } else if (JSON.stringify(existing) !== JSON.stringify(p)) {
                updatePaymentMethod(p.id, p);
            }
        });
        current.forEach(p => {
            if (!updated.find(up => up.id === p.id)) {
                deletePaymentMethod(p.id);
            }
        });
    }, [paymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod]);

    const setPreferences = useCallback((updater) => {
        const updated = typeof updater === 'function' ? updater(preferences) : updater;
        updatePreferences(updated);
    }, [preferences, updatePreferences]);

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
        if (currentTimer) {
            setShowGlobalTimer(true);
        }
    }, [currentTimer]);

    // === Browser Tab Title ===
    const timerStateRef = useRef({ currentTimer, isPaused, pausedElapsedTime });
    const tasksRef = useRef(activeTasks);
    
    useEffect(() => {
        timerStateRef.current = { currentTimer, isPaused, pausedElapsedTime };
    }, [currentTimer, isPaused, pausedElapsedTime]);
    
    useEffect(() => {
        tasksRef.current = activeTasks;
    }, [activeTasks]);

    const currentTaskName = useMemo(() => {
        if (!currentTimer?.taskId) return null;
        const task = activeTasks.find(t => t.id === currentTimer.taskId);
        return task?.title || null;
    }, [currentTimer?.taskId, activeTasks]);

    useEffect(() => {
        if (!currentTimer) {
            document.title = ORIGINAL_TITLE;
            return;
        }
        
        if (!currentTaskName) return;
        
        if (isPaused) {
            const pausedTime = formatDurationWithSeconds(pausedElapsedTime);
            document.title = `⏸ ${pausedTime} - ${currentTaskName} | TaskTime`;
            return;
        }
        
        const updateTitle = () => {
            const { currentTimer: timer } = timerStateRef.current;
            if (!timer) return;
            
            const elapsed = Date.now() - timer.startTime;
            const formattedTime = formatDurationWithSeconds(elapsed);
            const taskName = tasksRef.current.find(t => t.id === timer.taskId)?.title || currentTaskName;
            
            document.title = `▶ ${formattedTime} - ${taskName} | TaskTime`;
        };
        
        updateTitle();
        const interval = setInterval(updateTitle, TIMER_UPDATE_INTERVAL_MS);
        
        return () => clearInterval(interval);
    }, [currentTimer?.taskId, currentTimer?.startTime, isPaused, pausedElapsedTime, currentTaskName]);

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
    const handleImport = (importData) => {
        const migratedTasks = (importData.tasks || []).map(task => ({
            ...task,
            completed: task.completed || false,
            archived: task.archived || false
        }));

        const allInvoices = importData.invoices || [];
        const migratedProjects = (importData.projects || []).map(project => {
            const projectInvoices = project.invoices || [];
            allInvoices.push(...projectInvoices);
            return {
                ...project,
                invoiceIds: projectInvoices.map(invoice => invoice.id)
            };
        });

        setProjects(migratedProjects);
        setTasks(migratedTasks);
        setInvoices(allInvoices);
        setTimeEntries(importData.timeEntries || []);
        setPaymentMethods(importData.paymentMethods || []);
        setBusinessInfos(importData.businessInfos || []);
        setClients(importData.clients || []);
        setInvoiceTemplates(importData.invoiceTemplates || []);
        setPreferences(importData.preferences || {});
        clearTimer();
    };

    // === Loading Screen ===
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-foreground">
                        Task<span>Time</span>
                    </h1>
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
                <div className={`pr-4 pb-6 ${showGlobalTimer && currentTimer ? 'pt-20' : 'pt-6'}`}>
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
                    setProjects={setProjects}
                    tasks={activeTasks}
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
                    setProjects={setProjects}
                    tasks={activeTasks}
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
                    tasks={activeTasks}
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
                {showGlobalTimer && currentTimer && (
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
