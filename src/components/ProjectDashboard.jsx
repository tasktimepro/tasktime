import { ArrowLeftIcon, DocumentCheckIcon, ClockIcon, BanknotesIcon, DocumentTextIcon, CurrencyDollarIcon, ChevronDownIcon, PencilIcon, ArchiveBoxIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskTree from './TaskTree';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils.ts';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { getInvoicesForProject } from '../utils/invoiceUtils.ts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import ProjectDeleteDialog from './modals/ProjectDeleteDialog';

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
    navigateToClient
}) => {
    // Invoice editing state
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [isInvoicesExpanded, setIsInvoicesExpanded] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const { showError, showSuccess } = useToast();
    const { getTimerForProject, clearTimer } = useTimers();
    const { deleteProject, archiveProject, unarchiveProject } = useProjects();
    const { deleteTask } = useTasks();
    const { deleteEntry } = useTimeEntries();
    const { deleteInvoice } = useInvoices();
    const projectTimer = getTimerForProject(project.id);
    
    // Get invoices for this project
    const projectInvoices = getInvoicesForProject(invoices, project.id);
    
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
            projectInvoicesForDelete.forEach(invoice => deleteInvoice(invoice.id));
        }

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
    }, [tasks, timeEntries, getTimerForProject, clearTimer, invoices, deleteInvoice, deleteProject, deleteTask, deleteEntry, showSuccess]);

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
    
    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get time entries for this project's tasks
    const projectTaskIds = projectTasks.map(task => task.id);

    const projectTimeEntries = timeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId)
    );

    // Count visible tasks (not completed and not archived, including both parent tasks and subtasks)
    const visibleTasksCount = projectTasks.filter(task => 
        !task.completed && !task.archived
    ).length;

    // Calculate project metrics
    const projectMetrics = useMemo(() => {
        // Total time worked on this project (including invoice adjustments)
        const totalTime = projectTimeEntries
            .reduce((total, entry) => {
                return total + (entry.end - entry.start);
            }, 0);

        // Total revenue from paid invoices only
        const totalRevenue = projectInvoices.reduce((total, invoice) => {
            // Only include invoices that have been marked as paid
            if (invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
            }
            return total;
        }, 0);

        // Calculate pending amount from unpaid invoices
        const pendingAmount = projectInvoices.reduce((total, invoice) => {
            // Only include invoices that have NOT been marked as paid
            if (!invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
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
                taskTimeMap[entry.taskId] += (entry.end - entry.start);
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
            totalTime,
            totalRevenue,
            pendingAmount,
            potentialRevenue,
            activeTaskCount: visibleTasksCount
        };
    }, [projectTimeEntries, projectInvoices, project, projectTasks, visibleTasksCount]);

    const projectClient = useMemo(() => {
        if (!project.preferredClientId) return null;
        return clients.find(client => client.id === project.preferredClientId) || null;
    }, [clients, project.preferredClientId]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
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
                            {project.archived && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Archived
                                </span>
                            )}
                        </div>

                        {project.hourlyRate && (
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
                                        <span className="mx-1">•</span>
                                    </>
                                )}
                                <span className="sensitive-data">
                                    {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:bg-muted rounded-full"
                                title="More actions"
                                aria-label="More actions"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={handleEditProject}
                                className="flex items-center space-x-2 hover:bg-yellow-50 hover:text-yellow-600"
                            >
                                <PencilIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </DropdownMenuItem>
                            {project.archived ? (
                                <DropdownMenuItem
                                    onClick={handleUnarchiveProject}
                                    className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Unarchive</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={handleArchiveProject}
                                    className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Archive</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDeleteProject}
                                className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                            >
                                <TrashIcon className="h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Invoice Generator - Only show for non-personal projects */}
                    {!project.isPersonal && (
                        <InvoiceGenerator
                            project={project}
                            timeEntries={projectTimeEntries}
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
                    )}
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

            {/* Project Metrics - Only show for non-personal projects */}
            {!project.isPersonal && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <DocumentCheckIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Tasks</dt>
                                        <dd className="text-lg font-semibold text-foreground">{projectMetrics.activeTaskCount}</dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <ClockIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Total Time</dt>
                                        <dd className="text-lg font-semibold text-foreground">{formatDuration(projectMetrics.totalTime)}</dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Paid Revenue</dt>
                                        <dd className="text-lg font-semibold text-foreground">
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.totalRevenue.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Pending</dt>
                                        <dd className="text-lg font-semibold text-foreground">
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.pendingAmount.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <CurrencyDollarIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Unbilled</dt>
                                        <dd className="text-lg font-semibold text-foreground">
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.potentialRevenue.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Task Tree */}
            <Card>
                <CardContent className="pt-6">
                    <TaskTree
                        project={project}
                        onEditTask={openTaskModal}
                        onViewTask={onViewTask}
                    />
                </CardContent>
            </Card>

            {/* Invoices Section - Only show for non-personal projects */}
            {!project.isPersonal && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
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
                    </CardHeader>

                    {isInvoicesExpanded && (
                        <CardContent id="project-invoices-list">
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
