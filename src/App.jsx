import { useEffect, useState, useMemo, useRef, useContext, useCallback } from 'react';
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
import { useTimers } from './hooks/useTimers.ts';
import { useUrlState } from './hooks/useUrlState.ts';
import { usePlannerAttachments } from './hooks/usePlannerAttachments.ts';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import ClientList from './components/ClientList';
import ClientDashboard from './components/ClientDashboard';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import Expenses from './components/Expenses';
import Account from './components/Account';
import Invoices from './components/Invoices';
import AuthCallback from './components/AuthCallback';
import TaskViewModal from './components/modals/TaskViewModal';
import TimeEntriesModal from './components/TimeEntriesModal';
import { EntityPickerModal } from './components/planner/index.js';
import GlobalTimerStack from './components/timer/GlobalTimerStack';
import ModalManager from './components/modals/ModalManager';
import FloatingActionButton from './components/FloatingActionButton';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import YjsSyncStatus from './components/sync/YjsSyncStatus';
import { ToastProvider } from './components/ToastContainer';
import { ToastContext } from './contexts/ToastContext.ts';
import { formatDurationWithSeconds } from './utils/dateUtils.ts';
import { getTaskIdsToDelete } from './utils/taskUtils.ts';
import { useTodayString } from './hooks/useDayRollover';
import { ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon, SunIcon, MoonIcon, EyeIcon, EyeOffIcon, PanelLeftCloseIcon, LayoutDashboardIcon, KanbanIcon, HandCoinsIcon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
        deleteTask,
        archiveTask,
        isLoading: tasksLoading 
    } = useTasks();

    const { updateAttachment } = usePlannerAttachments();

    const { 
        entries: timeEntries, 
        createEntry: createTimeEntry,
        deleteEntry,
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

    const { timers, clearTimer, isLoading: timerLoading } = useTimers();
    const focusedTimer = timers[0] || null;
    const timerIsActive = !!focusedTimer;
    const todayStr = useTodayString();

    const isPaused = focusedTimer?.isPaused || false;
    const timerTaskId = focusedTimer?.taskId || null;
    const timerElapsedTime = focusedTimer?.elapsedTime || 0;
    const timerStartTime = focusedTimer?.startTime || null;

    const [totalsHidden, setTotalsHidden] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasktime-totals-hidden');
            if (saved !== null) return saved === 'true';
        }
        return false;
    });

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

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasktime-sidebar-collapsed');
            if (saved !== null) return saved === 'true';
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

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem('tasktime-sidebar-collapsed', String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem('tasktime-totals-hidden', String(totalsHidden));
    }, [totalsHidden]);

    // === Modal State ===
    const [activeModal, setActiveModal] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [modalOptions, setModalOptions] = useState(null);
    const [pendingImport, setPendingImport] = useState(null);
    const [taskViewState, setTaskViewState] = useState({
        isOpen: false,
        task: null,
        dateStr: null,
        attachment: null
    });
    const [taskViewOverlay, setTaskViewOverlay] = useState({
        isOpen: false,
        type: null,
        task: null,
        dateStr: null,
        attachment: null
    });
    const [pendingTaskViewReturn, setPendingTaskViewReturn] = useState(null);
    const [pendingTaskViewOverlayReturn, setPendingTaskViewOverlayReturn] = useState(null);
    const prevActiveModalRef = useRef(activeModal);

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

    const openTaskModal = (task = null) => {
        setActiveModal('task');
        setEditingItem(task);
    };

    const openTaskView = useCallback((task, options = {}) => {
        if (!task) return;
        const { dateStr = todayStr, attachment = null } = options;
        setTaskViewState({
            isOpen: true,
            task,
            dateStr,
            attachment
        });
    }, [todayStr]);

    const closeTaskView = useCallback(() => {
        setTaskViewState({
            isOpen: false,
            task: null,
            dateStr: null,
            attachment: null
        });
    }, []);

    const openTaskViewOverlay = useCallback((type, task, dateStr, attachment) => {
        if (!task) return;
        setPendingTaskViewOverlayReturn({
            task,
            dateStr,
            attachment: attachment || null
        });
        closeTaskView();
        setTaskViewOverlay({
            isOpen: true,
            type,
            task,
            dateStr,
            attachment: attachment || null
        });
    }, [closeTaskView]);

    const closeTaskViewOverlay = useCallback(() => {
        setTaskViewOverlay({
            isOpen: false,
            type: null,
            task: null,
            dateStr: null,
            attachment: null
        });
        if (pendingTaskViewOverlayReturn) {
            setTaskViewState({
                isOpen: true,
                task: pendingTaskViewOverlayReturn.task,
                dateStr: pendingTaskViewOverlayReturn.dateStr,
                attachment: pendingTaskViewOverlayReturn.attachment || null
            });
            setPendingTaskViewOverlayReturn(null);
        }
    }, [pendingTaskViewOverlayReturn]);

    const handleOpenTaskTimeEntries = useCallback((task, dateStr, attachment) => {
        openTaskViewOverlay('time-entries', task, dateStr, attachment);
    }, [openTaskViewOverlay]);

    const handleOpenTaskPlannerOptions = useCallback((task, dateStr, attachment) => {
        openTaskViewOverlay('planner-options', task, dateStr, attachment);
    }, [openTaskViewOverlay]);

    const handleUpdateTaskPlannerOptions = useCallback((entity, scheduleMode, weekday, targetHours) => {
        if (!taskViewOverlay.attachment) return;
        updateAttachment(taskViewOverlay.attachment.id, {
            estimatedHours: targetHours ?? null,
        });
        toast?.showSuccess('Planner options updated');
        closeTaskViewOverlay();
    }, [taskViewOverlay.attachment, updateAttachment, toast, closeTaskViewOverlay]);

    const handleEditTaskFromView = useCallback((task) => {
        if (!task) return;
        setPendingTaskViewReturn({
            task,
            dateStr: taskViewState.dateStr || todayStr,
            attachment: taskViewState.attachment || null
        });
        openTaskModal(task);
    }, [openTaskModal, taskViewState.dateStr, taskViewState.attachment, todayStr]);

    useEffect(() => {
        if (prevActiveModalRef.current === 'task' && !activeModal && pendingTaskViewReturn) {
            setTaskViewState({
                isOpen: true,
                task: pendingTaskViewReturn.task,
                dateStr: pendingTaskViewReturn.dateStr,
                attachment: pendingTaskViewReturn.attachment || null
            });
            setPendingTaskViewReturn(null);
        }
        prevActiveModalRef.current = activeModal;
    }, [activeModal, pendingTaskViewReturn]);

    const handleDeleteTask = useCallback((task) => {
        if (!task) return;

        const taskIdsToDelete = task.parentTaskId
            ? [task.id]
            : getTaskIdsToDelete(task.id, activeTasks);

        const entriesToDelete = timeEntries.filter(entry => taskIdsToDelete.includes(entry.taskId));
        entriesToDelete.forEach(entry => deleteEntry(entry.id));

        timers.forEach(timer => {
            if (taskIdsToDelete.includes(timer.taskId)) {
                clearTimer(timer.projectId);
            }
        });

        taskIdsToDelete.forEach(id => deleteTask(id));
        toast?.showSuccess('Task deleted');
        closeTaskView();
    }, [activeTasks, timeEntries, timers, deleteEntry, clearTimer, deleteTask, toast, closeTaskView]);

    const handleArchiveTask = useCallback((task) => {
        if (!task || task.projectId) return;

        timers.forEach(timer => {
            if (timer.taskId === task.id) {
                clearTimer(timer.projectId || task.id);
            }
        });

        archiveTask(task.id);
        toast?.showSuccess('Task archived');
        closeTaskView();
    }, [archiveTask, timers, clearTimer, toast, closeTaskView]);

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
            document.title = `(Paused) ${pausedTime} - ${currentTaskName} | TaskTime`;
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
    const { urlParams, navigateToProjects, navigateToProject, navigateToClients, navigateToClient, navigateToInvoices, navigateToExpenses, navigateToAccount, navigateToDashboard, navigateToPlanner, updateUrl } = useUrlState();
    
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
        setPendingImport(importData);
    };

    useEffect(() => {
        if (!pendingImport || !isReady) return;

        (pendingImport.projects || []).forEach((project) => createProject(project));
        (pendingImport.tasks || []).forEach((task) => createTask(task));
        (pendingImport.timeEntries || []).forEach((entry) => createTimeEntry(entry));
        (pendingImport.invoices || []).forEach((invoice) => createInvoice(invoice));
        (pendingImport.paymentMethods || []).forEach((method) => createPaymentMethod(method));
        (pendingImport.businessInfos || []).forEach((info) => createBusinessInfo(info));
        (pendingImport.clients || []).forEach((client) => createClient(client));
        (pendingImport.invoiceTemplates || []).forEach((template) => createInvoiceTemplate(template));

        updatePreferences(pendingImport.preferences || {});
        timers.forEach(timer => {
            clearTimer(timer.projectId);
        });
        setPendingImport(null);
    }, [
        pendingImport,
        isReady,
        createProject,
        createTask,
        createTimeEntry,
        createInvoice,
        createPaymentMethod,
        createBusinessInfo,
        createClient,
        createInvoiceTemplate,
        updatePreferences,
        clearTimer,
        timers,
    ]);

    // === Loading Screen ===
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-foreground">Task<span>Time</span></h1>
                    <p className="text-muted-foreground mt-2">Loading your data...</p>
                </div>
            </div>
        );
    }

    const needsExtraTopPadding = ['clients', 'projects', 'invoices', 'expenses', 'account'].includes(activeView);

    const handleSidebarCollapsedAction = (action) => (event) => {
        event.currentTarget.blur();
        action();
    };

    // === Main Render ===
    return (
        <div className={`min-h-screen ${totalsHidden ? 'totals-hidden' : ''}`}>
            <div className="mx-auto w-full max-w-[100rem] px-6 pr-2">
            <div className="flex gap-6">
            {/* Sidebar Navigation */}
            <aside className={`${isSidebarCollapsed ? 'w-18' : 'w-64'} bg-card shadow-sm border border-border rounded-xl flex flex-col h-[calc(100vh-3rem)] sidebar my-6 transition-[width] duration-200`}>
            <TooltipProvider>
                {/* Sidebar Header */}
                <div className={`${isSidebarCollapsed ? 'p-4' : 'p-6'} flex-shrink-0`}>
                    <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
                        {isSidebarCollapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity group"
                                        onClick={handleSidebarCollapsedAction(() => {
                                            setIsSidebarCollapsed(false);
                                        })}
                                        aria-label="Expand sidebar"
                                    >
                                        <div className="relative">
                                            <ClockIcon className="h-6 w-6 text-foreground" />
                                        </div>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center">
                                    Expand sidebar
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <button
                                type="button"
                                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity group"
                                onClick={() => navigateToDashboard()}
                                aria-label="Go to Dashboard"
                            >
                                <div className="relative">
                                    <ClockIcon className="h-6 w-6 text-foreground" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-foreground leading-none">
                                        TaskTime
                                    </h1>
                                </div>
                            </button>
                        )}
                        {!isSidebarCollapsed && (
                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed(true)}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground opacity-70 hover:opacity-100 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                                title="Collapse sidebar"
                                aria-label="Collapse sidebar"
                            >
                                <PanelLeftCloseIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className={`flex-1 ${isSidebarCollapsed ? 'px-2 py-4' : 'px-4 py-6'} overflow-y-auto`}>
                    <ul className={`${isSidebarCollapsed ? 'space-y-1' : 'space-y-2'}`}>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToDashboard())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'dashboard'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Dashboard"
                                        >
                                            <LayoutDashboardIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Dashboard
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToDashboard()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'dashboard'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <LayoutDashboardIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Dashboard
                                </button>
                            )}
                        </li>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToPlanner())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'planner'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Planner"
                                        >
                                            <KanbanIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Planner
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToPlanner()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'planner'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <KanbanIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Planner
                                </button>
                            )}
                        </li>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToClients())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'clients'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Clients"
                                        >
                                            <UserGroupIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Clients
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToClients()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'clients'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <UserGroupIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Clients
                                </button>
                            )}
                        </li>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToProjects())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'projects'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Projects"
                                        >
                                            <ClipboardDocumentCheckIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Projects
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToProjects()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'projects'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <ClipboardDocumentCheckIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Projects
                                </button>
                            )}
                        </li>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToInvoices())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'invoices'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Invoices"
                                        >
                                            <DocumentTextIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Invoices
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToInvoices()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'invoices'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <DocumentTextIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Invoices
                                </button>
                            )}
                        </li>
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToExpenses())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'expenses'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Expenses"
                                        >
                                            <HandCoinsIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Expenses
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToExpenses()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'expenses'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <HandCoinsIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Expenses
                                </button>
                            )}
                        </li>
                    </ul>
                </nav>
                
                {/* Theme Toggle */}
                <div className={`${isSidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4'} border-t border-border ${isSidebarCollapsed ? 'space-y-1' : 'space-y-2'}`}>
                    {isSidebarCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleSidebarCollapsedAction(() => setTotalsHidden(!totalsHidden))}
                                    className="w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    aria-label={totalsHidden ? 'Show totals' : 'Hide totals'}
                                >
                                    {totalsHidden ? (
                                        <EyeIcon className="h-5 w-5 flex-shrink-0" />
                                    ) : (
                                        <EyeOffIcon className="h-5 w-5 flex-shrink-0" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                                {totalsHidden ? 'Show Totals' : 'Hide Totals'}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={() => setTotalsHidden(!totalsHidden)}
                            className="w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
                        >
                            {totalsHidden ? (
                                <EyeIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            ) : (
                                <EyeOffIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            )}
                            {totalsHidden ? 'Show Totals' : 'Hide Totals'}
                        </button>
                    )}
                    {isSidebarCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleSidebarCollapsedAction(() => setDarkMode(!darkMode))}
                                    className="w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    aria-label={darkMode ? 'Light mode' : 'Dark mode'}
                                >
                                    {darkMode ? (
                                        <SunIcon className="h-5 w-5 flex-shrink-0" />
                                    ) : (
                                        <MoonIcon className="h-5 w-5 flex-shrink-0" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                                {darkMode ? 'Light Mode' : 'Dark Mode'}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
                        >
                            {darkMode ? (
                                <SunIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            ) : (
                                <MoonIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            )}
                            {darkMode ? 'Light Mode' : 'Dark Mode'}
                        </button>
                    )}
                    {isSidebarCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleSidebarCollapsedAction(() => navigateToAccount())}
                                    className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                        activeView === 'account'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                    aria-label="Account"
                                >
                                    <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                                Account
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={() => navigateToAccount()}
                            className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                activeView === 'account'
                                    ? 'bg-accent text-accent-foreground font-semibold'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                        >
                            <UserCircleIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                            Account
                        </button>
                    )}
                    <div className={`${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                        <YjsSyncStatus isCompact={isSidebarCollapsed} />
                        <OfflineIndicator isCompact={isSidebarCollapsed} />
                    </div>
                </div>
            </TooltipProvider>
            </aside>

            {/* Main Content */}
            <main className="flex-1 main-content relative">
                <div
                    className="pr-4"
                    style={{
                        paddingTop: showGlobalTimer && timerIsActive ? '5.25rem' : needsExtraTopPadding ? '2rem' : '1.5rem',
                        paddingBottom: '1.5rem',
                        '--app-content-padding-top': showGlobalTimer && timerIsActive ? '5.25rem' : needsExtraTopPadding ? '2rem' : '1.5rem',
                        '--app-content-padding-bottom': '1.5rem',
                    }}
                >
                    {activeView === 'dashboard' && (
                            <ErrorBoundary>
                            <Dashboard
                                projects={projects}
                                invoices={invoices}
                                clients={clients}
                                navigateToProject={navigateToProject}
                                navigateToClient={navigateToClient}
                                navigateToInvoices={navigateToInvoices}
                                onEditTask={openTaskModal}
                                onViewTask={openTaskView}
                            />
                            </ErrorBoundary>
                        )}

                    {activeView === 'auth-callback' && (
                            <AuthCallback />
                        )}

                    {activeView === 'planner' && (
                            <ErrorBoundary>
                            <Planner
                                openClientModal={openClientModal}
                                openProjectModal={openProjectModal}
                                openTaskModal={openTaskModal}
                                activeModal={activeModal}
                                onViewTask={openTaskView}
                            />
                            </ErrorBoundary>
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
                                onBackToProjects={() => window.history.back()}
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
                                openTaskModal={openTaskModal}
                                onViewTask={openTaskView}
                                navigateToClient={navigateToClient}
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
                                onBackToClients={() => window.history.back()}
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

                    {activeView === 'expenses' && (
                            <ErrorBoundary>
                            <Expenses />
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

                    <FloatingActionButton onClick={() => openTaskModal(null)} />
                </div>
                
                {/* Global Timer Display - Fixed at top */}
                {showGlobalTimer && timerIsActive && (
                    <div
                        className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[100rem] z-50 flex justify-center global-timer-mobile pointer-events-none"
                        style={{
                            paddingLeft: isSidebarCollapsed ? '7.5rem' : '19rem',
                            paddingRight: '0.5rem',
                        }}
                    >
                        <div className="w-auto max-w-2xl pointer-events-auto">
                            <GlobalTimerStack
                                navigateToProject={navigateToProject}
                                onOpenTaskView={openTaskView}
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

        {taskViewState.task && (
            <TaskViewModal
                isOpen={taskViewState.isOpen}
                onClose={closeTaskView}
                task={taskViewState.task}
                dateStr={taskViewState.dateStr || todayStr}
                attachment={taskViewState.attachment}
                onEdit={handleEditTaskFromView}
                onDelete={handleDeleteTask}
                onArchive={handleArchiveTask}
                onNavigateToProject={navigateToProject}
                onOpenTimeEntries={handleOpenTaskTimeEntries}
                onOpenPlannerOptions={handleOpenTaskPlannerOptions}
            />
        )}

        {taskViewOverlay.isOpen && taskViewOverlay.type === 'time-entries' && taskViewOverlay.task && (
            <TimeEntriesModal
                isOpen={taskViewOverlay.isOpen}
                onClose={closeTaskViewOverlay}
                task={taskViewOverlay.task}
            />
        )}

        {taskViewOverlay.isOpen && taskViewOverlay.type === 'planner-options' && taskViewOverlay.task && taskViewOverlay.attachment && (
            <EntityPickerModal
                isOpen={taskViewOverlay.isOpen}
                onClose={closeTaskViewOverlay}
                entityType="task"
                dateStr={taskViewOverlay.attachment.date || taskViewOverlay.dateStr}
                onSelect={handleUpdateTaskPlannerOptions}
                mode="edit"
                lockedEntityId={taskViewOverlay.task.id}
                lockedScheduleMode={taskViewOverlay.attachment.mode === 'weekday' ? 'weekday' : 'date'}
                lockedWeekday={taskViewOverlay.attachment.weekday ?? null}
                initialTargetHours={taskViewOverlay.attachment.estimatedHours ?? null}
            />
        )}
        
        {/* PWA Components */}
        <InstallPrompt />
        </div>
    );
}

export default App;
