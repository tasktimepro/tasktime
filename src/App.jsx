import { lazy, Suspense, useEffect, useState, useMemo, useRef, useContext, useCallback } from 'react';
import './App.css';
import { YjsProvider, useYjs } from './contexts/YjsContext.tsx';
import { useProjects } from './hooks/useProjects.ts';
import { useTasks } from './hooks/useTasks.ts';
import { useTimeEntries } from './hooks/useTimeEntries.ts';
import { useClients } from './hooks/useClients.ts';
import { useInvoices } from './hooks/useInvoices.ts';
import { useBusinessInfos } from './hooks/useBusinessInfos.ts';
import { useInvoiceTemplates } from './hooks/useInvoiceTemplates.ts';
import { useEmailTemplates } from './hooks/useEmailTemplates.ts';
import { usePaymentMethods } from './hooks/usePaymentMethods.ts';
import { useExpenses } from './hooks/useExpenses.ts';
import { useExpenseRecurrences } from './hooks/useExpenseRecurrences.ts';
import { usePreferences } from './hooks/usePreferences.ts';
import { useTimers } from './hooks/useTimers.ts';
import { useGoogleAuth } from './hooks/useGoogleAuth.ts';
import { useUrlState } from './hooks/useUrlState.ts';
import { usePlannerAttachments } from './hooks/usePlannerAttachments.ts';
import { useDailyGoals } from './hooks/useDailyGoals.ts';
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
import OnboardingModal from './components/OnboardingModal';
import TaskViewModal from './components/modals/TaskViewModal';
import ExpenseViewModal from './components/modals/ExpenseViewModal';
import TimeEntriesModal from './components/TimeEntriesModal';
import { EntityPickerModal } from './components/planner/index.js';
import GlobalTimerStack from './components/timer/GlobalTimerStack';
import ModalManager from './components/modals/ModalManager';
import FloatingActionButton from './components/FloatingActionButton';
import ErrorBoundary from './components/ErrorBoundary';
import CloudSyncStatusPanel from './components/sync/CloudSyncStatusPanel';
import { getYjsSyncStatusDescriptor, SYNC_STATUS_KIND } from './components/sync/syncStatusDescriptor';
import MobileBottomNav from './components/app/MobileBottomNav';
import MobileMoreSheet from './components/app/MobileMoreSheet';
import { ToastProvider } from './components/ToastContainer';
import { ToastContext } from './contexts/ToastContext.ts';
import { formatDurationWithSeconds } from './utils/dateUtils.ts';
import { buildExpenseFromRecurrence } from './utils/expenseUtils.ts';
import {
    hasCompletedOnboarding,
    hasPendingOnboarding,
    setOnboardingCompleted,
    setOnboardingPending,
} from './utils/onboardingUtils.ts';
import { getTaskIdsToDelete } from './utils/taskUtils.ts';
import { setUsageMetricsSessionId, startUsageMetrics } from './utils/usageMetrics.ts';
import { buildTodoNotificationSchedules, getTodoNotificationReplaceHorizonUntil } from './utils/todoNotificationSchedule.ts';
import { getCurrentPushSubscription, getPushSupportState, uploadPushSchedules } from './utils/pushNotificationClient.ts';
import { useTodayString } from './hooks/useDayRollover';
import { useDarkModePreference } from './hooks/useDarkModePreference.ts';
import { SYNC_WORKER_CONFIG } from './config/google.ts';
import { ClipboardDocumentCheckIcon, DocumentTextIcon, UserCircleIcon, ClockIcon, UserGroupIcon, SunIcon, MoonIcon, EyeIcon, EyeOffIcon, PanelLeftCloseIcon, LayoutDashboardIcon, KanbanIcon, HandCoinsIcon, ChartBarIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { APP_VERSION, TIMER_UPDATE_INTERVAL_MS } from './constants/app.ts';

const Reports = lazy(() => import('./components/Reports'));

function ReportsPageLoader() {
    return (
        <div
            className={cn(
                'absolute inset-0 z-10 flex items-center justify-center bg-background px-6 py-10'
            )}
            role="status"
            aria-live="polite"
        >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Spinner className="h-9 w-9 text-foreground" />
                <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Loading reports</p>
                    <p className="text-sm text-muted-foreground">Preparing the reports workspace.</p>
                </div>
            </div>
        </div>
    );
}

/** Original browser tab title */
const ORIGINAL_TITLE = "TaskTime";
const MOBILE_SYNC_SUCCESS_VISIBILITY_MS = 1000;
const MOBILE_SYNC_FADE_DURATION_MS = 200;
const MOBILE_SYNC_VISIBLE_KINDS = new Set([
    SYNC_STATUS_KIND.CONNECTING,
    SYNC_STATUS_KIND.CHECKING,
    SYNC_STATUS_KIND.DOWNLOADING,
    SYNC_STATUS_KIND.UPLOADING,
    SYNC_STATUS_KIND.SYNCING,
    SYNC_STATUS_KIND.SYNCED,
]);
const ONBOARDING_SEED_TASK_TITLE = 'Create my first project';
const PUSH_SCHEDULE_SYNC_DEBOUNCE_MS = 2000;

const PAGE_TITLE_MAP = {
    dashboard: 'Dashboard',
    planner: 'Planner',
    clients: 'Clients',
    projects: 'Projects',
    invoices: 'Invoices',
    reports: 'Reports',
    expenses: 'Expenses',
    account: 'Account'
};

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
    const {
        isReady,
        isSyncing,
        syncState,
        syncPhase,
        isDriveConnected,
        isConnecting,
        hasSynced,
        manualSyncInProgress,
        hasPendingSyncChanges,
        pendingSyncChanges,
        forceSyncDrive,
        autoSyncEnabled,
        lastSyncedAt,
        clearAllData,
        driveSessionId,
        store,
    } = useYjs();
    const { hadPreviousSession, isLoading: authLoading, isSignedIn } = useGoogleAuth();
    const toast = useContext(ToastContext);
    const [isSyncIndicatorOffline, setIsSyncIndicatorOffline] = useState(() => {
        if (typeof navigator === 'undefined') {
            return false;
        }

        return !navigator.onLine;
    });
    const [showMobileSyncButton, setShowMobileSyncButton] = useState(false);
    const [isMobileSyncButtonFadingOut, setIsMobileSyncButtonFadingOut] = useState(false);
    const [isReportsViewReady, setIsReportsViewReady] = useState(false);
    const mobileSyncHideTimeoutRef = useRef(null);
    const mobileSyncFadeTimeoutRef = useRef(null);
    const mobileSyncedFlashShownRef = useRef(false);
    const mainContentRef = useRef(null);

    useEffect(() => {
        return startUsageMetrics({
            endpoint: SYNC_WORKER_CONFIG.isMetricsEnabled ? SYNC_WORKER_CONFIG.endpoints.metricsBatch : null,
            appVersion: APP_VERSION,
        });
    }, []);

    useEffect(() => {
        const updateOfflineState = () => {
            setIsSyncIndicatorOffline(!navigator.onLine);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                updateOfflineState();
            }
        };

        updateOfflineState();

        window.addEventListener('online', updateOfflineState);
        window.addEventListener('offline', updateOfflineState);
        window.addEventListener('focus', updateOfflineState);
        document.addEventListener('visibilitychange', handleVisibility);

        const interval = setInterval(updateOfflineState, 5000);

        return () => {
            window.removeEventListener('online', updateOfflineState);
            window.removeEventListener('offline', updateOfflineState);
            window.removeEventListener('focus', updateOfflineState);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        setUsageMetricsSessionId(driveSessionId);
    }, [driveSessionId]);

    // === Yjs Data Hooks ===
    const { 
        projects, 
        isLoading: projectsLoading 
    } = useProjects();

    const { 
        tasks: activeTasks, 
        createTask,
        deleteTask,
        archiveTask,
        isLoading: tasksLoading 
    } = useTasks();

    const { updateAttachment, attachments: plannerAttachments } = usePlannerAttachments();

    const { 
        entries: timeEntries, 
        deleteEntry,
        isLoading: entriesLoading 
    } = useTimeEntries();

    const { 
        clients, 
        isLoading: clientsLoading 
    } = useClients();

    const { 
        invoices, 
        isLoading: invoicesLoading 
    } = useInvoices();

    const {
        expenses,
        createExpense,
    } = useExpenses();

    const {
        recurrences,
        isLoading: expenseRecurrencesLoading,
        generatePendingExpenses,
        updateRecurrence,
    } = useExpenseRecurrences();

    const { 
        businessInfos, 
        isLoading: businessLoading 
    } = useBusinessInfos();

    const { 
        invoiceTemplates, 
        isLoading: templatesLoading 
    } = useInvoiceTemplates();

    const {
        emailTemplates,
    } = useEmailTemplates();

    const { 
        paymentMethods, 
        isLoading: paymentsLoading 
    } = usePaymentMethods();

    const { 
        preferences, 
        isLoading: preferencesLoading 
    } = usePreferences();

    const { timers, clearTimer, isLoading: timerLoading } = useTimers();
    const { goals: dailyGoals } = useDailyGoals();
    const focusedTimer = timers[0] || null;
    const timerIsActive = !!focusedTimer;
    const todayStr = useTodayString();
    const onboardingSeedTaskCreatedRef = useRef(false);
    const lastExpenseGenerationDayRef = useRef(null);

    useEffect(() => {
        if (
            !isReady
            || expenseRecurrencesLoading
            || !todayStr
            || lastExpenseGenerationDayRef.current === todayStr
        ) {
            return;
        }

        generatePendingExpenses(createExpense, new Set(expenses.map((e) => e.id)));
        lastExpenseGenerationDayRef.current = todayStr;
    }, [isReady, expenseRecurrencesLoading, todayStr, generatePendingExpenses, createExpense, expenses]);

    const isPaused = focusedTimer?.isPaused || false;
    const timerTaskId = focusedTimer?.taskId || null;
    const timerElapsedTime = focusedTimer?.elapsedTime || 0;
    const timerStartTime = focusedTimer?.startTime || null;

    const autoHideTotalsOnRevisit = preferences.autoHideTotalsOnRevisit === true;
    const [totalsHidden, setTotalsHidden] = useState(() => {
        if (autoHideTotalsOnRevisit) {
            return true;
        }
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

    useEffect(() => {
        if (
            isLoading
            || preferences.systemNotificationsEnabled !== true
            || !todayStr
            || typeof window === 'undefined'
            || typeof window.Notification === 'undefined'
            || window.Notification.permission !== 'granted'
        ) {
            return undefined;
        }

        if (!getPushSupportState().supported) {
            return undefined;
        }

        let canceled = false;
        const timeoutId = window.setTimeout(() => {
            getCurrentPushSubscription()
                .then((subscription) => {
                    if (canceled || !subscription) {
                        return;
                    }

                    const startDate = new Date();
                    const schedules = buildTodoNotificationSchedules({
                        tasks: activeTasks,
                        expenses,
                        expenseRecurrences: recurrences,
                        startDate,
                        notificationTime: preferences.systemNotificationTime || '09:00',
                    });

                    return uploadPushSchedules({
                        subscriptionEndpoint: subscription.endpoint,
                        schedules,
                        replaceHorizonUntil: getTodoNotificationReplaceHorizonUntil(startDate),
                    });
                })
                .catch((error) => {
                    console.warn('[Push] Failed to sync notification schedules:', error);
                });
        }, PUSH_SCHEDULE_SYNC_DEBOUNCE_MS);

        return () => {
            canceled = true;
            window.clearTimeout(timeoutId);
        };
    }, [activeTasks, expenses, isLoading, preferences.systemNotificationTime, preferences.systemNotificationsEnabled, recurrences, todayStr]);

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
    const [darkMode, setDarkMode] = useDarkModePreference();

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasktime-sidebar-collapsed');
            if (saved !== null) return saved === 'true';
        }
        return false;
    });
    const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(() => hasCompletedOnboarding());
    const [isOnboardingPending, setIsOnboardingPending] = useState(() => hasPendingOnboarding());
    const [showOnboarding, setShowOnboarding] = useState(false);
    
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

    useEffect(() => {
        if (!autoHideTotalsOnRevisit) {
            return;
        }

        setTotalsHidden(true);
    }, [autoHideTotalsOnRevisit]);

    useEffect(() => {
        if (!autoHideTotalsOnRevisit || typeof window === 'undefined') {
            return;
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                setTotalsHidden(true);
            }
        };

        window.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pageshow', handleVisibility);
        window.addEventListener('focus', handleVisibility);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('pageshow', handleVisibility);
            window.removeEventListener('focus', handleVisibility);
        };
    }, [autoHideTotalsOnRevisit]);

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
    const [expenseViewState, setExpenseViewState] = useState({
        isOpen: false,
        expense: null
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
    const [pendingExpenseViewReturn, setPendingExpenseViewReturn] = useState(null);
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

    const openTaskModal = useCallback((task = null, options = null) => {
        setActiveModal('task');
        setEditingItem(task);
        setModalOptions(options || null);
    }, []);

    const openExpenseModal = useCallback((expense = null, options = null) => {
        setActiveModal('expense');
        setEditingItem(expense);
        setModalOptions(options || null);
    }, []);

    const openExpenseView = useCallback((expense) => {
        if (!expense) return;

        const resolvedExpense = expense.isPreview && expense.recurrenceId && expense.date
            ? expenses.find((item) => item.recurrenceId === expense.recurrenceId && item.date === expense.date)
            : null;
        let targetExpense = resolvedExpense || expense;

        if (
            targetExpense.isPreview
            && targetExpense.recurrenceId
            && targetExpense.date
            && todayStr
            && targetExpense.date <= todayStr
        ) {
            const recurrence = recurrences.find((item) => item.id === targetExpense.recurrenceId);

            if (recurrence) {
                targetExpense = createExpense(buildExpenseFromRecurrence(recurrence, targetExpense.date));

                if (!recurrence.lastGeneratedDate || recurrence.lastGeneratedDate < targetExpense.date) {
                    updateRecurrence(recurrence.id, { lastGeneratedDate: targetExpense.date });
                }
            }
        }

        const isPreview = Boolean(targetExpense.isPreview);

        if (isPreview) {
            setExpenseViewState({
                isOpen: true,
                expense: targetExpense
            });
            return;
        }

        const needsSubmit = targetExpense.isRecurring
            && targetExpense.amountType === 'variable'
            && (!targetExpense.amount || targetExpense.amount <= 0)
            && targetExpense.paymentStatus === 'unpaid';

        if (needsSubmit) {
            openExpenseModal(targetExpense);
            return;
        }

        setExpenseViewState({
            isOpen: true,
            expense: targetExpense
        });
    }, [expenses, recurrences, todayStr, createExpense, updateRecurrence, openExpenseModal]);

    const closeExpenseView = useCallback(() => {
        setExpenseViewState({
            isOpen: false,
            expense: null
        });
    }, []);

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

    const handleEditExpenseFromView = useCallback((expense) => {
        if (!expense) return;
        setPendingExpenseViewReturn({ expense });
        openExpenseModal(expense);
        closeExpenseView();
    }, [openExpenseModal, closeExpenseView]);

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

        if (prevActiveModalRef.current === 'expense' && !activeModal && pendingExpenseViewReturn) {
            setExpenseViewState({
                isOpen: true,
                expense: pendingExpenseViewReturn.expense
            });
            setPendingExpenseViewReturn(null);
        }

        prevActiveModalRef.current = activeModal;
    }, [activeModal, pendingTaskViewReturn, pendingExpenseViewReturn]);

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
        if (!timerIsActive || !timerTaskId) return;
        
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
    const { urlParams, navigateToProjects, navigateToProject, navigateToClients, navigateToClient, navigateToInvoices, navigateToReports, navigateToExpenses, navigateToAccount, navigateToDashboard, navigateToPlanner, updateUrl } = useUrlState();
    const routeScrollKey = useMemo(() => {
        return [
            urlParams.view,
            urlParams.projectId || '',
            urlParams.clientId || '',
            urlParams.year || '',
            urlParams.week || '',
        ].join(':');
    }, [urlParams.clientId, urlParams.projectId, urlParams.view, urlParams.week, urlParams.year]);

    const handleOpenMobileSyncSettings = useCallback(() => {
        navigateToAccount({ section: 'sync' });
    }, [navigateToAccount]);

    const handleMobileManualSync = useCallback(async () => {
        await forceSyncDrive();
    }, [forceSyncDrive]);

    const mobileSyncStatus = useMemo(() => {
        return getYjsSyncStatusDescriptor({
            isReady,
            authLoading,
            isOffline: isSyncIndicatorOffline,
            isDriveConnected,
            isConnecting,
            hadPreviousSession,
            syncState,
            syncPhase,
            lastSyncedAt,
            manualSyncInProgress,
            pendingSyncChanges,
            autoSyncEnabled,
            isSyncing,
            hasSynced,
            onConnect: undefined,
            onCloudOptions: handleOpenMobileSyncSettings,
            onManualSync: handleMobileManualSync,
        });
    }, [
        autoSyncEnabled,
        authLoading,
        handleMobileManualSync,
        handleOpenMobileSyncSettings,
        hadPreviousSession,
        hasSynced,
        isConnecting,
        isDriveConnected,
        isReady,
        isSyncIndicatorOffline,
        isSyncing,
        lastSyncedAt,
        manualSyncInProgress,
        pendingSyncChanges,
        syncPhase,
        syncState,
    ]);

    useEffect(() => {
        if (mobileSyncHideTimeoutRef.current) {
            clearTimeout(mobileSyncHideTimeoutRef.current);
            mobileSyncHideTimeoutRef.current = null;
        }

        if (mobileSyncFadeTimeoutRef.current) {
            clearTimeout(mobileSyncFadeTimeoutRef.current);
            mobileSyncFadeTimeoutRef.current = null;
        }

        const shouldRenderMobileSyncButton = MOBILE_SYNC_VISIBLE_KINDS.has(mobileSyncStatus.kind);

        if (!shouldRenderMobileSyncButton) {
            mobileSyncedFlashShownRef.current = false;
            setShowMobileSyncButton(false);
            setIsMobileSyncButtonFadingOut(false);
            return;
        }

        if (mobileSyncStatus.kind !== SYNC_STATUS_KIND.SYNCED) {
            mobileSyncedFlashShownRef.current = false;
            setShowMobileSyncButton(true);
            setIsMobileSyncButtonFadingOut(false);
            return;
        }

        // SYNCED state: show brief green flash then fade out
        if (!showMobileSyncButton) {
            if (mobileSyncedFlashShownRef.current) {
                return;
            }

            mobileSyncedFlashShownRef.current = true;
            setShowMobileSyncButton(true);
            return;
        }

        mobileSyncedFlashShownRef.current = true;

        mobileSyncHideTimeoutRef.current = setTimeout(() => {
            setIsMobileSyncButtonFadingOut(true);

            mobileSyncFadeTimeoutRef.current = setTimeout(() => {
                setShowMobileSyncButton(false);
                setIsMobileSyncButtonFadingOut(false);
            }, MOBILE_SYNC_FADE_DURATION_MS);
        }, MOBILE_SYNC_SUCCESS_VISIBILITY_MS);
    }, [mobileSyncStatus.kind, showMobileSyncButton]);

    useEffect(() => {
        return () => {
            if (mobileSyncHideTimeoutRef.current) {
                clearTimeout(mobileSyncHideTimeoutRef.current);
            }

            if (mobileSyncFadeTimeoutRef.current) {
                clearTimeout(mobileSyncFadeTimeoutRef.current);
            }
        };
    }, []);

    const mobileMoreButton = useMemo(() => {
        if (!showMobileSyncButton) {
            return null;
        }

        return {
            ariaLabel: `More. ${mobileSyncStatus.text}`,
            Icon: mobileSyncStatus.icon,
            isFadingOut: isMobileSyncButtonFadingOut,
            label: mobileSyncStatus.kind === SYNC_STATUS_KIND.SYNCED
                ? 'Synced'
                : mobileSyncStatus.kind === SYNC_STATUS_KIND.PENDING
                    ? 'Sync'
                    : 'Syncing',
            toneClassName: `${mobileSyncStatus.tone} hover:bg-accent hover:text-accent-foreground`,
        };
    }, [isMobileSyncButtonFadingOut, mobileSyncStatus, showMobileSyncButton]);

    const mobileMoreButtonBadge = useMemo(() => {
        if (showMobileSyncButton) {
            return null;
        }

        if (mobileSyncStatus.kind === SYNC_STATUS_KIND.OFFLINE) {
            return {
                description: 'Offline. Sync is unavailable until you reconnect.',
                toneClassName: 'status-warning-fill',
            };
        }

        if (mobileSyncStatus.kind === SYNC_STATUS_KIND.ERROR) {
            return {
                description: 'Sync needs attention. Open More to review sync settings.',
                toneClassName: 'status-danger-fill',
            };
        }

        if (mobileSyncStatus.kind === SYNC_STATUS_KIND.DISCONNECTED && hadPreviousSession && !authLoading && !isSignedIn) {
            return {
                description: 'Drive disconnected. Open More to reconnect sync.',
                toneClassName: 'status-danger-fill',
            };
        }

        if (mobileSyncStatus.kind === SYNC_STATUS_KIND.PENDING) {
            return {
                description: 'Changes waiting to sync. Open More to review.',
                toneClassName: 'status-warning-fill',
            };
        }



        return null;
    }, [authLoading, hadPreviousSession, isSignedIn, mobileSyncStatus.kind, showMobileSyncButton]);
    
    const activeView = urlParams.view;

    useEffect(() => {
        if (activeView !== 'reports') {
            setIsReportsViewReady(false);
        }
    }, [activeView]);

    const hasPersistedWorkspaceData = (
        projects.length > 0
        || activeTasks.length > 0
        || timeEntries.length > 0
        || clients.length > 0
        || invoices.length > 0
        || businessInfos.length > 0
        || invoiceTemplates.length > 0
        || paymentMethods.length > 0
        || expenses.length > 0
        || recurrences.length > 0
        || dailyGoals.length > 0
        || plannerAttachments.length > 0
    );
    const selectedProject = urlParams.projectId 
        ? projects.find(p => p.id === urlParams.projectId) 
        : null;
    const selectedClient = urlParams.clientId 
        ? clients.find(c => c.id === urlParams.clientId) 
        : null;
    const handleQuickCreateTask = useCallback(() => {
        openTaskModal(null);
    }, [openTaskModal]);
    const handleQuickCreateExpense = useCallback(() => {
        openExpenseModal(null);
    }, [openExpenseModal]);

    useEffect(() => {
        const mainContent = mainContentRef.current;

        if (mainContent) {
            if (typeof mainContent.scrollTo === 'function') {
                mainContent.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            } else {
                mainContent.scrollTop = 0;
                mainContent.scrollLeft = 0;
            }
        }

        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [routeScrollKey]);

    useEffect(() => {
        if (timerIsActive && timerTaskId) return;

        const pageTitle = PAGE_TITLE_MAP[activeView] || ORIGINAL_TITLE;
        document.title = pageTitle === ORIGINAL_TITLE ? ORIGINAL_TITLE : `${pageTitle} | TaskTime`;
    }, [activeView, timerIsActive, timerTaskId]);

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

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (activeView !== 'dashboard') {
            setShowOnboarding(false);
            return;
        }

        const shouldShowOnboarding = !isOnboardingCompleted && (isOnboardingPending || !hasPersistedWorkspaceData);

        if (!shouldShowOnboarding) {
            return;
        }

        if (!isOnboardingPending) {
            setOnboardingPending(true);
            setIsOnboardingPending(true);
        }

        if (!onboardingSeedTaskCreatedRef.current && todayStr && !hasPersistedWorkspaceData) {
            createTask({
                title: ONBOARDING_SEED_TASK_TITLE,
                note: 'Start the timer, head to projects, and create your first one.',
                startDate: todayStr,
            });
            onboardingSeedTaskCreatedRef.current = true;
        }

        setShowOnboarding(true);
    }, [activeView, createTask, hasPersistedWorkspaceData, isLoading, isOnboardingCompleted, isOnboardingPending, todayStr]);

    const handleCompleteOnboarding = useCallback(() => {
        setOnboardingPending(false);
        setOnboardingCompleted(true);
        setIsOnboardingCompleted(true);
        setIsOnboardingPending(false);
        setShowOnboarding(false);
    }, []);

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

        (async () => {
            try {
                await store.importBackupData(pendingImport);
                setPendingImport(null);
            } catch (error) {
                toast?.showError(error instanceof Error ? error.message : 'Import failed.');
            }
        })();
    }, [
        pendingImport,
        isReady,
        store,
        toast,
    ]);

    const [isMobileLayout, setIsMobileLayout] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return false;
        }

        return window.matchMedia('(max-width: 767px)').matches;
    });
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const handleChange = (event) => {
            setIsMobileLayout(event.matches);
        };

        setIsMobileLayout(mediaQuery.matches);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        document.documentElement.classList.toggle('mobile-layout', isMobileLayout);
        document.body.classList.toggle('mobile-layout', isMobileLayout);

        return () => {
            document.documentElement.classList.remove('mobile-layout');
            document.body.classList.remove('mobile-layout');
        };
    }, [isMobileLayout]);

    useEffect(() => {
        setIsMoreMenuOpen(false);
    }, [activeView, selectedProject, selectedClient]);

    const needsExtraTopPadding = ['clients', 'projects', 'invoices', 'reports', 'expenses', 'account'].includes(activeView);
    const isMoreViewActive = ['clients', 'invoices', 'reports', 'account'].includes(activeView);
    const isMobilePrimarySelectionVisible = !isMoreMenuOpen;
    const mobileTopPadding = showGlobalTimer && timerIsActive ? '5.5rem' : '1rem';
    const mobileBottomPadding = '7rem';
    const desktopTopPadding = showGlobalTimer && timerIsActive ? '5.25rem' : needsExtraTopPadding ? '2rem' : '1.5rem';
    const desktopBottomPadding = '1.5rem';
    const mobilePrimaryNavItems = [
        {
            key: 'dashboard',
            label: 'Dashboard',
            Icon: LayoutDashboardIcon,
            isActive: isMobilePrimarySelectionVisible && activeView === 'dashboard',
            onClick: () => navigateToDashboard(),
        },
        {
            key: 'planner',
            label: 'Planner',
            Icon: KanbanIcon,
            isActive: isMobilePrimarySelectionVisible && activeView === 'planner',
            onClick: () => navigateToPlanner(),
        },
        {
            key: 'projects',
            label: 'Projects',
            Icon: ClipboardDocumentCheckIcon,
            isActive: isMobilePrimarySelectionVisible && activeView === 'projects',
            onClick: () => navigateToProjects(),
        },
        {
            key: 'expenses',
            label: 'Expenses',
            Icon: HandCoinsIcon,
            isActive: isMobilePrimarySelectionVisible && activeView === 'expenses',
            onClick: () => navigateToExpenses(),
        },
    ];
    const mobileMoreNavItems = [
        {
            key: 'clients',
            label: 'Clients',
            description: 'View clients and client detail pages',
            Icon: UserGroupIcon,
            onClick: () => navigateToClients(),
        },
        {
            key: 'invoices',
            label: 'Invoices',
            description: 'Open invoice management and templates',
            Icon: DocumentTextIcon,
            onClick: () => navigateToInvoices(),
        },
        {
            key: 'reports',
            label: 'Reports',
            description: 'Review totals and export options',
            Icon: ChartBarIcon,
            onClick: () => navigateToReports(),
        },
    ];
    const handleMoreSheetAction = (action) => () => {
        setIsMoreMenuOpen(false);
        action();
    };

    // === Loading Screen ===
    if (isLoading) {
        return (
            <div className="app-viewport-shell flex items-center justify-center">
                <div className="text-center">
                    <ClockIcon className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h1 className="text-xl font-semibold text-foreground">Task<span>Time</span></h1>
                    <p className="text-muted-foreground mt-2">Loading your data...</p>
                </div>
            </div>
        );
    }

    if (activeView === 'auth-callback') {
        return <AuthCallback />;
    }

    const handleSidebarCollapsedAction = (action) => (event) => {
        event.currentTarget.blur();
        action();
    };

    // === Main Render ===
    return (
        <div className={`app-viewport-shell ${totalsHidden ? 'totals-hidden' : ''}`}>
            <div className={isMobileLayout ? 'w-full' : 'mx-auto w-full max-w-[100rem] px-6 pr-2'}>
            <div className={isMobileLayout ? 'app-viewport-shell' : 'flex gap-6'}>
            {/* Sidebar Navigation */}
            {!isMobileLayout && (
            <aside className={`${isSidebarCollapsed ? 'w-18' : 'w-64'} bg-card shadow-sm border border-border rounded-xl flex flex-col h-[calc(var(--viewport-height)-3rem)] sidebar my-6 transition-[width] duration-200`}>
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
                                            aria-label="Plan & Track"
                                        >
                                            <KanbanIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Plan & Track
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
                                    Plan & Track
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
                        <li>
                            {isSidebarCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleSidebarCollapsedAction(() => navigateToReports())}
                                            className={`w-10 mx-auto justify-center px-2 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer ${
                                                activeView === 'reports'
                                                    ? 'bg-accent text-accent-foreground font-semibold'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-label="Reports"
                                        >
                                            <ChartBarIcon className="h-5 w-5 flex-shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center">
                                        Reports
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={() => navigateToReports()}
                                    className={`w-full px-3 py-2 flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                        activeView === 'reports'
                                            ? 'bg-accent text-accent-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    <ChartBarIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    Reports
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
                        <CloudSyncStatusPanel isCompact={isSidebarCollapsed} />
                    </div>
                </div>
            </TooltipProvider>
            </aside>
            )}

            {/* Main Content */}
            <main ref={mainContentRef} className={`main-content relative ${isMobileLayout ? 'app-viewport-shell' : 'flex-1'}`}>
                <div
                    className={isMobileLayout ? 'app-shell-content px-4' : 'app-shell-content pr-4'}
                    style={{
                        '--app-content-padding-top': isMobileLayout ? mobileTopPadding : desktopTopPadding,
                        '--app-content-padding-bottom': isMobileLayout ? mobileBottomPadding : desktopBottomPadding,
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
                                openExpenseView={openExpenseView}
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
                                openExpenseView={openExpenseView}
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
                                activeModal={activeModal}
                                openClientModal={openClientModal}
                                openProjectModal={openProjectModal}
                                openBusinessModal={openBusinessModal}
                                openPaymentMethodModal={openPaymentMethodModal}
                                openTemplateModal={openTemplateModal}
                                openTaskModal={openTaskModal}
                                onViewTask={openTaskView}
                                navigateToClient={navigateToClient}
                                openExpenseModal={openExpenseModal}
                                openExpenseView={openExpenseView}
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
                                activeModal={activeModal}
                                openClientModal={openClientModal}
                                openProjectModal={openProjectModal}
                                openBusinessModal={openBusinessModal}
                                openPaymentMethodModal={openPaymentMethodModal}
                                openTemplateModal={openTemplateModal}
                                openExpenseModal={openExpenseModal}
                                openExpenseView={openExpenseView}
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
                                activeModal={activeModal}
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
                            <Expenses
                                openExpenseModal={openExpenseModal}
                                openExpenseView={openExpenseView}
                                openPaymentMethodModal={openPaymentMethodModal}
                                editPaymentMethodModal={editPaymentMethodModal}
                                openBusinessModal={openBusinessModal}
                                editBusinessModal={editBusinessModal}
                            />
                            </ErrorBoundary>
                        )}

                    {activeView === 'reports' && (
                            <ErrorBoundary>
                                <div className="relative min-h-[calc(100vh-16rem)]" aria-busy={!isReportsViewReady}>
                                    {!isReportsViewReady ? <ReportsPageLoader /> : null}
                                    <Suspense fallback={null}>
                                        <div className={cn(!isReportsViewReady && 'pointer-events-none opacity-0')}>
                                            <Reports onReadyChange={setIsReportsViewReady} />
                                        </div>
                                    </Suspense>
                                </div>
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
                                emailTemplates={emailTemplates}
                                expenses={expenses}
                                expenseRecurrences={recurrences}
                                dailyGoals={dailyGoals}
                                plannerAttachments={plannerAttachments}
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

                    {(!isMobileLayout || activeView !== 'auth-callback') && (
                        <FloatingActionButton
                            onTaskClick={handleQuickCreateTask}
                            onExpenseClick={handleQuickCreateExpense}
                            className={isMobileLayout ? 'mobile-floating-action-button bottom-safe-fab right-4' : ''}
                        />
                    )}
                </div>
                
                {/* Global Timer Display - Fixed at top */}
                {!isMobileLayout && showGlobalTimer && timerIsActive && (
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
                                enableHoverExpansion={true}
                                enableManualToggle={false}
                            />
                        </div>
                    </div>
                )}

                {isMobileLayout && showGlobalTimer && timerIsActive && (
                    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-safe-top pointer-events-none md:hidden">
                        <div className="pointer-events-auto mt-3 w-full max-w-2xl">
                            <GlobalTimerStack
                                navigateToProject={navigateToProject}
                                onOpenTaskView={openTaskView}
                                onClose={() => {
                                    setShowGlobalTimer(false);
                                }}
                                enableHoverExpansion={false}
                                enableManualToggle={true}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
        </div>

        {isMobileLayout && (
            <>
                <MobileBottomNav
                    items={mobilePrimaryNavItems}
                    isMoreActive={isMoreViewActive || isMoreMenuOpen}
                    moreButton={mobileMoreButton}
                    moreButtonBadge={mobileMoreButtonBadge}
                    onOpenMore={() => setIsMoreMenuOpen((isOpen) => !isOpen)}
                />

                <MobileMoreSheet
                    darkMode={darkMode}
                    isOpen={isMoreMenuOpen}
                    items={mobileMoreNavItems.map((item) => ({
                        ...item,
                        onClick: handleMoreSheetAction(item.onClick),
                    }))}
                    onOpenAccount={handleMoreSheetAction(() => navigateToAccount())}
                    onClose={() => setIsMoreMenuOpen(false)}
                    onOpenChange={setIsMoreMenuOpen}
                    onToggleDarkMode={() => setDarkMode((currentValue) => !currentValue)}
                    onToggleTotals={() => setTotalsHidden((currentValue) => !currentValue)}
                    totalsHidden={totalsHidden}
                />
            </>
        )}

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

        {expenseViewState.expense && (
            <ExpenseViewModal
                isOpen={expenseViewState.isOpen}
                onClose={closeExpenseView}
                expense={expenseViewState.expense}
                onEdit={handleEditExpenseFromView}
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

        <OnboardingModal
            key={`onboarding-${showOnboarding ? 'open' : 'closed'}`}
            isOpen={showOnboarding}
            onComplete={handleCompleteOnboarding}
        />
        
        </div>
    );
}

export default App;
