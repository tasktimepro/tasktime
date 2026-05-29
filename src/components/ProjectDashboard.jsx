import { ArrowLeftIcon, BanknotesIcon, DocumentTextIcon, CurrencyDollarIcon, ChevronDownIcon, PencilIcon, ArchiveBoxIcon, TrashIcon, HandCoinsIcon, CheckIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TaskTree from './TaskTree';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { formatCurrency, getCurrencySymbol, getProjectCurrency, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { millisecondsToHours, toDisplayDate } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { getInvoiceTotal, getPaidInvoiceConvertedAmount, isInvoicePaid } from '../utils/invoiceUtils.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../hooks/useExpenseRecurrences.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { getInvoicesForProject } from '../utils/invoiceUtils.ts';
import { getBillableDurationMs } from '../utils/timeEntryDurationUtils.ts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import ProjectDeleteDialog from './modals/ProjectDeleteDialog';
import ExpensesSection from './expenses/ExpensesSection';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProjectNotesEditor from './ProjectNotesEditor';
import {
    getProjectDeadlineStatus,
    getProjectEstimateSummary,
    isProjectInQuoteMode,
} from '@/utils/projectPlanningUtils.ts';

function formatHoursMetric(value) {
    if (!Number.isFinite(value)) {
        return '0';
    }

    const roundedValue = Math.round(value * 100) / 100;

    return Number.isInteger(roundedValue) ? roundedValue.toString() : roundedValue.toFixed(2);
}

/**
 * ProjectDashboard component - Main dashboard view for a selected project
 */
const ProjectDashboard = ({
    project,
    tasks,
    timeEntries,
    onBackToProjects,
    paymentMethods,
    businessInfos,
    clients,
    invoices,
    invoiceTemplates,
    activeModal,
    // Modal functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    openTaskModal,
    onViewTask,
    navigateToClient,
    openExpenseModal,
    openExpenseView
}) => {
    const isMobileLayout = useIsMobileLayout();
    // Invoice editing state
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [isInvoicesExpanded, setIsInvoicesExpanded] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [activeTab, setActiveTab] = useState('tasks');
    const [mobileDocumentGenerator, setMobileDocumentGenerator] = useState(null);
    const { showError, showSuccess } = useToast();
    const { getTimerForProject, clearTimer } = useTimers();
    const { deleteProject, archiveProject, unarchiveProject, updateProject } = useProjects();
    const { deleteTask } = useTasks();
    const { deleteEntry } = useTimeEntries();
    const { deleteInvoice } = useInvoices();
    const { expenses, deleteExpense, unbillExpensesForInvoice } = useExpenses({ includeArchived: true });
    const { recurrences, deleteRecurrence } = useExpenseRecurrences();
    const { preferences } = usePreferences();
    const projectTimer = getTimerForProject(project.id);
    const projectCurrency = useMemo(() => getProjectCurrency(project, clients), [clients, project]);
    
    // Get invoices for this project
    const projectInvoices = getInvoicesForProject(invoices, project.id);

    const projectExpenses = useMemo(() => {
        return expenses.filter((expense) => expense.projectId === project.id);
    }, [expenses, project.id]);

    const expenseTotalsByCurrency = useMemo(() => {
        return projectExpenses.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || getPreferredCurrency();
            acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
            return acc;
        }, {});
    }, [projectExpenses, preferences.currency]);

    const unbilledExpenseTotalsByCurrency = useMemo(() => {
        return projectExpenses
            .filter((expense) => expense.billable && expense.billingStatus === 'unbilled')
            .reduce((acc, expense) => {
                const currency = expense.currency || preferences.currency || getPreferredCurrency();
                acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
                return acc;
            }, {});
    }, [projectExpenses, preferences.currency]);

    const formatAmounts = (amounts) => {
        const entries = Object.entries(amounts).filter(([, value]) => value > 0);
        if (entries.length === 0) return '—';
        if (entries.length === 1) {
            const [currency, value] = entries[0];
            return formatCurrency(value, currency);
        }
        return entries.map(([currency, value]) => `${formatCurrency(value, currency)} ${currency}`).join(' · ');
    };
    
    /**
     * Handle editing an existing invoice
     */
    const handleEditInvoice = (invoice) => {
        // Check if a timer is currently active (running, not paused)
        if (projectTimer && !projectTimer.isPaused) {
            showError('Cannot update an invoice while a timer is active. Please pause the timer first.');
            return;
        }
        
        setEditingInvoice(invoice);
    };

    /**
     * Toggle invoices section visibility
     */
    const toggleInvoicesExpanded = () => {
        setIsInvoicesExpanded((prev) => !prev);
    };

    const performProjectDeletion = useCallback((projectId, shouldDeleteInvoices = false) => {
        const projectTasks = tasks.filter(task => task.projectId === projectId && !task.deletedAt);
        const allTaskIdsToDelete = new Set();

        projectTasks.forEach(task => {
            const taskIds = getTaskIdsToDelete(task.id, tasks);
            taskIds.forEach(id => allTaskIdsToDelete.add(id));
        });

        const taskIdsArray = Array.from(allTaskIdsToDelete);

        const timerForProject = getTimerForProject(projectId);
        if (timerForProject) {
            clearTimer(projectId);
        }

        if (shouldDeleteInvoices) {
            const projectInvoicesForDelete = getInvoicesForProject(invoices, projectId);
            projectInvoicesForDelete.forEach(invoice => unbillExpensesForInvoice(invoice.id));
            projectInvoicesForDelete.forEach(invoice => deleteInvoice(invoice.id));
        }

        expenses
            .filter(expense => expense.projectId === projectId)
            .forEach(expense => deleteExpense(expense.id));

        recurrences
            .filter(recurrence => recurrence.projectId === projectId)
            .forEach(recurrence => deleteRecurrence(recurrence.id));

        deleteProject(projectId);
        taskIdsArray.forEach(taskId => deleteTask(taskId));

        const timeEntryIdsToDelete = timeEntries
            .filter(entry => allTaskIdsToDelete.has(entry.taskId))
            .map(entry => entry.id);
        timeEntryIdsToDelete.forEach(entryId => deleteEntry(entryId));

        const deletedTaskCount = allTaskIdsToDelete.size;
        const deletedTimeEntriesCount = timeEntryIdsToDelete.length;
        const baseMessage = `Project deleted successfully. ${deletedTaskCount} task${deletedTaskCount !== 1 ? 's' : ''} and ${deletedTimeEntriesCount} time entr${deletedTimeEntriesCount !== 1 ? 'ies' : 'y'} removed.`;
        const invoiceMessage = shouldDeleteInvoices ? ' Associated invoices were also deleted.' : '';
        showSuccess(baseMessage + invoiceMessage);
    }, [tasks, timeEntries, expenses, recurrences, getTimerForProject, clearTimer, invoices, deleteInvoice, deleteProject, deleteTask, deleteEntry, deleteExpense, deleteRecurrence, unbillExpensesForInvoice, showSuccess]);

    const handleEditProject = () => {
        openProjectModal?.(project);
    };

    const handleArchiveProject = () => {
        archiveProject(project.id);
        showSuccess('Project archived');
    };

    const handleUnarchiveProject = () => {
        unarchiveProject(project.id);
        showSuccess('Project unarchived');
    };

    const handleDeleteProject = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        performProjectDeletion(project.id, false);
        setShowDeleteModal(false);
        onBackToProjects();
    };

    const handleForceDelete = () => {
        performProjectDeletion(project.id, true);
        setShowDeleteModal(false);
        onBackToProjects();
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
    };

    const handleOpenMobileDocumentGenerator = useCallback((mode) => {
        setMobileDocumentGenerator((previous) => ({
            mode,
            key: (previous?.key || 0) + 1,
        }));
    }, []);

    const handleResolveDeadline = useCallback(() => {
        if (!project.deadline) {
            return;
        }

        updateProject(project.id, { deadlineResolvedAt: Date.now() });
        showSuccess('Project deadline marked complete.');
    }, [project.deadline, project.id, showSuccess, updateProject]);

    const handleReopenDeadline = useCallback(() => {
        if (!project.deadline) {
            return;
        }

        updateProject(project.id, { deadlineResolvedAt: null });
        showSuccess('Project deadline reopened.');
    }, [project.deadline, project.id, showSuccess, updateProject]);

    const projectIsQuoteMode = isProjectInQuoteMode(project);
    const showActivateProjectActions = projectIsQuoteMode && !project.archived && !project.isPersonal;

    const handleActivateProject = useCallback(() => {
        if (!showActivateProjectActions) {
            return;
        }

        updateProject(project.id, { statusMode: 'active' });
        showSuccess('Project is now active and ready to generate invoices.');
    }, [project.id, showActivateProjectActions, showSuccess, updateProject]);

    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get time entries for this project's tasks
    const projectTaskIds = projectTasks.map(task => task.id);

    const projectTimeEntries = timeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId)
    );

    // Calculate project metrics
    const projectMetrics = useMemo(() => {
        // Total revenue from paid invoices only
        const totalRevenue = projectInvoices.reduce((total, invoice) => {
            if (isInvoicePaid(invoice)) {
                const resolvedPaidAmount = getPaidInvoiceConvertedAmount(invoice, projectCurrency);
                return total + (resolvedPaidAmount.success ? resolvedPaidAmount.amount : getInvoiceTotal(invoice));
            }
            return total;
        }, 0);

        // Calculate pending amount from unpaid invoices
        const pendingAmount = projectInvoices.reduce((total, invoice) => {
            if (!isInvoicePaid(invoice)) {
                return total + getInvoiceTotal(invoice);
            }
            return total;
        }, 0);

        // Calculate unbilled potential revenue
        let potentialRevenue = 0;

        if (project.hourlyRate && !project.flatRate) {
            // Get explicitly billable tasks (tasks with billable === true)
            const billableTasks = projectTasks.filter(task => task.billable === true);
            const billableTaskIds = billableTasks.map(task => task.id);
            
            // Get time entries for billable tasks that haven't been billed yet
            const unbilledEntries = projectTimeEntries.filter(entry => {
                // Only include entries for tasks that are explicitly marked as billable
                if (!billableTaskIds.includes(entry.taskId)) return false;
                
                // Find the task for this entry
                const task = projectTasks.find(t => t.id === entry.taskId);
                if (!task) return false;
                if (!entry.end || entry.end <= entry.start) return false;
                
                // Use task-specific lastBilledAt - if never billed, all entries are pending
                const taskLastBilledAt = task.lastBilledAt || 0;
                
                // Only include entries created after this task's last billing date
                return entry.start > taskLastBilledAt;
            });

            // Group unbilled entries by task and round each task's hours (same logic as invoice)
            const taskTimeMap = {};
            unbilledEntries.forEach(entry => {
                if (!taskTimeMap[entry.taskId]) {
                    taskTimeMap[entry.taskId] = 0;
                }
                taskTimeMap[entry.taskId] += getBillableDurationMs(entry);
            });

            // Calculate total rounded hours (matching invoice calculation)
            const unbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
                const taskHours = millisecondsToHours(taskTime);
                const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
                return total + roundedTaskHours;
            }, 0);

            potentialRevenue = unbilledHours * project.hourlyRate;
        }

        return {
            totalRevenue,
            pendingAmount,
            potentialRevenue
        };
    }, [projectCurrency, projectTimeEntries, projectInvoices, project, projectTasks]);

    const projectClient = useMemo(() => {
        if (!project.preferredClientId) return null;
        return clients.find(client => client.id === project.preferredClientId) || null;
    }, [clients, project.preferredClientId]);

    const planningSummary = useMemo(() => {
        return getProjectEstimateSummary(
            project,
            tasks,
            timeEntries,
            clients,
            preferences.currency || getPreferredCurrency()
        );
    }, [clients, preferences.currency, project, tasks, timeEntries]);

    const deadlineStatus = useMemo(() => getProjectDeadlineStatus(project), [project]);
    const hasPlanningMetrics = !project.isPersonal && (
        planningSummary.hasTaskEstimates
        || planningSummary.hasBudgetAmount
        || deadlineStatus.hasDeadline
    );
    const estimateProgressRatio = planningSummary.estimatedHours > 0
        ? planningSummary.actualHours / planningSummary.estimatedHours
        : null;
    const projectedEarnings = Math.max(
        projectMetrics.totalRevenue + projectMetrics.pendingAmount + projectMetrics.potentialRevenue,
        planningSummary.estimatedAmount
    );
    const targetProgressRatio = planningSummary.effectiveTargetAmount && planningSummary.effectiveTargetAmount > 0
        ? projectedEarnings / planningSummary.effectiveTargetAmount
        : null;
    const targetAmountDelta = planningSummary.effectiveTargetAmount !== null
        ? planningSummary.effectiveTargetAmount - projectedEarnings
        : null;
    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3 items-center')}>
                <div className={cn('flex items-center min-w-0', isMobileLayout ? 'flex-1 gap-3' : 'space-x-4')}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onBackToProjects}
                        className="text-muted-foreground hover:text-foreground"
                        title="Back to Projects"
                        aria-label="Back to Projects"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Button>

                    <div>
                        <div className="flex items-center flex-wrap gap-2">
                            {(project.color || projectClient?.color) && (
                                <div
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || projectClient?.color }}
                                    title={project.color ? "Project color" : "Client inherited color"}
                                />
                            )}
                            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
                            {projectIsQuoteMode && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    Quote stage
                                </span>
                            )}
                            {project.archived && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Archived
                                </span>
                            )}
                        </div>

                        {(projectClient || (project.hourlyRate && !project.flatRate)) && (
                            <p className="text-sm text-muted-foreground">
                                {projectClient && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => navigateToClient?.(projectClient.id)}
                                            className="hover:text-foreground hover:underline cursor-pointer"
                                        >
                                            {projectClient.title}
                                        </button>
                                        {project.hourlyRate && !project.flatRate && (
                                            <span className="mx-1">•</span>
                                        )}
                                    </>
                                )}
                                {project.hourlyRate && !project.flatRate && (
                                    <span className="sensitive-data">
                                        {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                <div className={cn('flex items-center gap-3', isMobileLayout && 'shrink-0')}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 rounded-full text-muted-foreground"
                                title="More actions"
                                aria-label="More actions"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {!project.isPersonal && isMobileLayout && (
                                <DropdownMenuItem
                                    onSelect={() => handleOpenMobileDocumentGenerator(projectIsQuoteMode ? 'quote' : 'invoice')}
                                    className="flex items-center space-x-2 pr-5"
                                >
                                    <DocumentTextIcon className="h-4 w-4" />
                                    <span>{projectIsQuoteMode ? 'Generate Quote' : 'Generate Invoice'}</span>
                                </DropdownMenuItem>
                            )}
                            {showActivateProjectActions && (
                                <DropdownMenuItem
                                    onClick={handleActivateProject}
                                    className="status-success-action flex items-center space-x-2 pr-5"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    <span>Activate Project</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleEditProject}
                                className="status-warning-action flex items-center space-x-2 pr-5"
                            >
                                <PencilIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </DropdownMenuItem>
                            {project.archived ? (
                                <DropdownMenuItem
                                    onClick={handleUnarchiveProject}
                                    className="status-info-action flex items-center space-x-2 pr-5"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Unarchive</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={handleArchiveProject}
                                    className="status-info-action flex items-center space-x-2 pr-5"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Archive</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDeleteProject}
                                className="status-danger-action flex items-center space-x-2 pr-5"
                            >
                                <TrashIcon className="h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {!project.isPersonal && (!isMobileLayout && (
                        <InvoiceGenerator
                            project={project}
                            timeEntries={projectTimeEntries}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            activeModal={activeModal}
                            mode={projectIsQuoteMode ? 'quote' : 'invoice'}
                            // Modal functions
                            openClientModal={openClientModal}
                            openProjectModal={openProjectModal}
                            openBusinessModal={openBusinessModal}
                            openPaymentMethodModal={openPaymentMethodModal}
                            openTemplateModal={openTemplateModal}
                        />
                    ))}
                </div>
            </div>

            <ProjectDeleteDialog
                isOpen={showDeleteModal}
                onClose={handleCloseDeleteModal}
                project={project}
                hasInvoices={projectInvoices.length > 0}
                onConfirmDelete={handleConfirmDelete}
                onArchive={() => {
                    handleArchiveProject();
                    handleCloseDeleteModal();
                }}
                onForceDelete={handleForceDelete}
            />

            {mobileDocumentGenerator && (
                <InvoiceGenerator
                    key={`mobile-document-generator-${mobileDocumentGenerator.mode}-${mobileDocumentGenerator.key}`}
                    project={project}
                    timeEntries={projectTimeEntries}
                    paymentMethods={paymentMethods}
                    businessInfos={businessInfos}
                    clients={clients}
                    activeModal={activeModal}
                    showButton={false}
                    mode={mobileDocumentGenerator.mode}
                    openClientModal={openClientModal}
                    openProjectModal={openProjectModal}
                    openBusinessModal={openBusinessModal}
                    openPaymentMethodModal={openPaymentMethodModal}
                    openTemplateModal={openTemplateModal}
                />
            )}

            {/* Project Metrics - Only show for non-personal projects */}
            {!project.isPersonal && (
                <div
                    className={cn(
                        isMobileLayout
                            ? '-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide'
                            : 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'
                    )}
                    data-testid="project-metrics-row"
                >
                    <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                        <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                            <div className="flex items-center w-full">
                                <div className="w-full">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Unbilled</dt>
                                    </dl>
                                    <div className="mt-2 space-y-1">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                            <span className="sensitive-data text-foreground font-semibold">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.potentialRevenue.toFixed(2)}
                                            </span>
                                        </div>
                                        {projectExpenses.length > 0 && (
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <HandCoinsIcon className="h-4 w-4 mr-2" />
                                                <span className="sensitive-data text-foreground font-semibold">
                                                    {formatAmounts(unbilledExpenseTotalsByCurrency)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                        <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                            <div className="flex items-center w-full">
                                <div className="flex-shrink-0">
                                    <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Pending</dt>
                                        <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.pendingAmount.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {projectExpenses.length > 0 && (
                        <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                            <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                                <div className="flex items-center w-full">
                                    <div className="flex-shrink-0">
                                        <HandCoinsIcon className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="ml-4 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-muted-foreground truncate">Expenses</dt>
                                            <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                                <span className="sensitive-data">
                                                    {formatAmounts(expenseTotalsByCurrency)}
                                                </span>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                        <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                            <div className="flex items-center w-full">
                                <div className="flex-shrink-0">
                                    <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Paid Revenue</dt>
                                        <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.totalRevenue.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={cn(
                    'w-full bg-transparent rounded-none',
                    isMobileLayout
                        ? 'h-auto flex-wrap justify-start gap-2 border-0 p-0'
                        : 'justify-start border-b border-border p-0'
                )}>
                    <TabsTrigger
                        value="tasks"
                        className={cn(
                            'font-medium text-sm whitespace-nowrap transition-colors',
                            isMobileLayout
                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                : 'mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                        )}
                    >
                        Tasks
                    </TabsTrigger>
                    <TabsTrigger
                        value="notes"
                        className={cn(
                            'font-medium text-sm whitespace-nowrap transition-colors',
                            isMobileLayout
                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                : 'mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                        )}
                    >
                        Notes
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-4">
                    <Card>
                        <CardContent className={cn(isMobileLayout ? 'px-3 py-3' : 'pt-6')}>
                            <TaskTree
                                project={project}
                                onEditTask={openTaskModal}
                                onViewTask={onViewTask}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                    <ProjectNotesEditor key={project.id} project={project} />
                </TabsContent>
            </Tabs>

            {hasPlanningMetrics && (
                <Card data-testid="planning-progress-card">
                    <CardHeader className={cn(isMobileLayout && 'px-3 py-3')}>
                        <div className="flex flex-wrap items-center gap-3">
                            <CardTitle className="text-lg">Planning &amp; Progress</CardTitle>
                            {showActivateProjectActions && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    leadingIcon={CheckIcon}
                                    className="ml-auto"
                                    onClick={handleActivateProject}
                                >
                                    Activate Project
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className={cn(isMobileLayout ? 'space-y-4 px-3 pb-3 pt-0' : 'space-y-4')}>
                        <div className={cn('grid gap-4', isMobileLayout ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3')}>
                            {planningSummary.hasTaskEstimates && (
                                <div className="space-y-2 rounded-lg border border-border p-4">
                                    <p className="text-sm font-medium text-foreground">Estimated hours</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatHoursMetric(planningSummary.actualHours)} of {formatHoursMetric(planningSummary.estimatedHours)} hours tracked
                                    </p>
                                    {estimateProgressRatio !== null && (
                                        <>
                                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary"
                                                    style={{ width: `${Math.min(estimateProgressRatio * 100, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {Math.round(estimateProgressRatio * 100)}% of estimated hours used
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {(planningSummary.estimatedAmount > 0 || planningSummary.hasBudgetAmount) && (
                                <div className="space-y-2 rounded-lg border border-border p-4">
                                    <p className="text-sm font-medium text-foreground">Target amount</p>
                                    {planningSummary.effectiveTargetAmount !== null && (
                                        <p className="text-sm text-muted-foreground sensitive-data">
                                            Target amount: {formatCurrency(planningSummary.effectiveTargetAmount, planningSummary.currency)}
                                        </p>
                                    )}
                                    {targetProgressRatio !== null && (
                                        <>
                                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-foreground"
                                                    style={{ width: `${Math.min(targetProgressRatio * 100, 100)}%` }}
                                                />
                                            </div>
                                            {targetAmountDelta !== null && (
                                                <p className="text-xs text-muted-foreground sensitive-data">
                                                    {targetAmountDelta > 0
                                                        ? `Remaining to target: ${formatCurrency(targetAmountDelta, planningSummary.currency)}`
                                                        : targetAmountDelta < 0
                                                            ? `Ahead of target by ${formatCurrency(Math.abs(targetAmountDelta), planningSummary.currency)}`
                                                            : 'On target'}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground sensitive-data">
                                                Projected earnings: {formatCurrency(projectedEarnings, planningSummary.currency)}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {deadlineStatus.hasDeadline && (
                                <div className="space-y-2 rounded-lg border border-border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">Deadline</p>
                                        {deadlineStatus.isResolved && (
                                            <Badge variant="success" className="gap-1 whitespace-nowrap">
                                                <CheckIcon className="h-3 w-3" />
                                                Completed {toDisplayDate(deadlineStatus.resolvedAt, { month: 'short', day: 'numeric' })}
                                            </Badge>
                                        )}
                                        {!deadlineStatus.isResolved && deadlineStatus.isOverdue && (
                                            <Badge variant="warning" className="whitespace-nowrap">
                                                Overdue
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-foreground">
                                        {deadlineStatus.deadline}
                                    </p>
                                    {!deadlineStatus.isResolved && (
                                        <p className="text-sm text-muted-foreground">
                                            {deadlineStatus.isOverdue
                                                ? `${Math.abs(deadlineStatus.daysRemaining || 0)} day${Math.abs(deadlineStatus.daysRemaining || 0) === 1 ? '' : 's'} overdue`
                                                : deadlineStatus.isToday
                                                    ? 'Due today'
                                                    : `${deadlineStatus.daysRemaining} day${deadlineStatus.daysRemaining === 1 ? '' : 's'} remaining`}
                                        </p>
                                    )}
                                    {!project.archived && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-1"
                                            onClick={deadlineStatus.isResolved ? handleReopenDeadline : handleResolveDeadline}
                                        >
                                            {deadlineStatus.isResolved ? 'Reopen deadline' : 'Mark complete'}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <ExpensesSection
                clientId={projectClient?.id}
                projectId={project.id}
                openExpenseModal={openExpenseModal}
                openExpenseView={openExpenseView}
            />

            {/* Invoices Section - Only show for active non-personal projects */}
            {!project.isPersonal && !projectIsQuoteMode && (
                <Card>
                    <CardHeader className={cn(isMobileLayout && 'px-3 py-3')}>
                        <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                            <button
                                type="button"
                                onClick={toggleInvoicesExpanded}
                                aria-expanded={isInvoicesExpanded}
                                aria-controls="project-invoices-list"
                                className="flex items-center gap-2 rounded-md text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <CardTitle className="text-lg">
                                    Invoices ({projectInvoices.length})
                                </CardTitle>
                                <ChevronDownIcon
                                    className={`h-4 w-4 text-muted-foreground transition-transform cursor-pointer ${isInvoicesExpanded ? 'rotate-180' : ''}`}
                                />
                            </button>
                            
                            <div className={cn(isMobileLayout && 'w-full flex justify-end')}>
                                <InvoiceGenerator
                                    project={project}
                                    timeEntries={projectTimeEntries}
                                    editingInvoice={editingInvoice}
                                    onInvoiceSaved={() => setEditingInvoice(null)}
                                    paymentMethods={paymentMethods}
                                    businessInfos={businessInfos}
                                    clients={clients}
                                    activeModal={activeModal}
                                    // Modal functions
                                    openClientModal={openClientModal}
                                    openProjectModal={openProjectModal}
                                    openBusinessModal={openBusinessModal}
                                    openPaymentMethodModal={openPaymentMethodModal}
                                    openTemplateModal={openTemplateModal}
                                />
                            </div>
                        </div>
                    </CardHeader>

                    {isInvoicesExpanded && (
                        <CardContent id="project-invoices-list" className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
                            <InvoicesList
                                projectInvoices={projectInvoices}
                                onEditInvoice={handleEditInvoice}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                hideNewInvoiceButton={true}
                                invoiceTemplates={invoiceTemplates}
                            />
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Metrics Display */}
            <MetricsDisplay
                project={project}
                timeEntries={projectTimeEntries}
                clients={clients}
            />
        </div>
    );
};

export default ProjectDashboard;
