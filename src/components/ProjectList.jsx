import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, SortIcon, CheckIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { fetchExchangeRates, formatCurrency, getCurrencySymbol, getProjectCurrency, normalizeCurrencyCode } from '../utils/currencyUtils.ts';
import { toDisplayDate, toStorageDate } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useYjs } from '../contexts/YjsContext';
import { buildProjectDeleteImpactPlan } from '@/domain/deletions/projectDeletion';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../hooks/useExpenseRecurrences.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';
import { getInvoicesForProject, isMultiProjectInvoice } from '../utils/invoiceUtils.ts';
import { buildProjectRecentUpdateMap } from '../utils/activityUtils.ts';
import { getProjectDeadlineStatus, isProjectInQuoteMode } from '@/utils/projectPlanningUtils.ts';
import { getProjectInvoicePreview } from '../utils/invoicePreviewUtils.ts';

import ProjectDeleteDialog from './modals/ProjectDeleteDialog';
/**
 * ProjectList component - Displays and manages the list of projects
 */
const ProjectList = ({ 
    onSelectProject,
    clients = [],
    openProjectModal,
    editProjectModal
}) => {
    const [showArchivedProjects, setShowArchivedProjects] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [exchangeRates, setExchangeRates] = useState(null);
    const { showError, showSuccess } = useToast();
    const { store } = useYjs();
    
    // Yjs hooks for data access
    const { projects, updateProject, deleteProject } = useProjects();
    const { tasks, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { invoices, deleteInvoice } = useInvoices();
    const { expenses, deleteExpense, unbillExpensesForInvoice } = useExpenses({ includeArchived: true });
    const { recurrences, deleteRecurrence } = useExpenseRecurrences();
    const { timers, clearTimer } = useTimers();
    const { preferences, updatePreferences } = usePreferences();

    const projectSort = preferences.projectSort || 'createdAt';

    const clientsById = useMemo(() => {

        const map = new Map();
        clients.forEach(client => {
            map.set(client.id, client);
        });

        return map;
    }, [clients]);

    const needsExchangeRatesForProjectExpenses = useMemo(() => {
        const projectsById = new Map(projects.map((project) => [project.id, project]));

        return expenses.some((expense) => {
            if (!expense || expense.billable !== true || expense.billingStatus !== 'unbilled' || !expense.projectId) {
                return false;
            }

            const expenseProject = projectsById.get(expense.projectId);
            if (!expenseProject) {
                return false;
            }

            const projectCurrency = normalizeCurrencyCode(getProjectCurrency(expenseProject, clients));
            const expenseCurrency = normalizeCurrencyCode(expense.currency || projectCurrency);

            return expenseCurrency !== projectCurrency;
        });
    }, [clients, expenses, projects]);

    useEffect(() => {
        if (!needsExchangeRatesForProjectExpenses) {
            return;
        }

        let isActive = true;

        const loadExchangeRates = async () => {
            const { rates } = await fetchExchangeRates();

            if (isActive) {
                setExchangeRates(rates);
            }
        };

        loadExchangeRates();

        return () => {
            isActive = false;
        };
    }, [needsExchangeRatesForProjectExpenses]);

    const getProjectColor = (project) => {
        if (project.color) return project.color;
        if (!project.preferredClientId) return null;

        return clientsById.get(project.preferredClientId)?.color || null;
    };

    const getProjectBorderStyle = (project) => {
        const color = getProjectColor(project);
        return color ? { borderLeftColor: color } : {};
    };

    const getProjectClient = (project) => {
        if (!project.preferredClientId) return null;
        return clientsById.get(project.preferredClientId) || null;
    };

    const handleSortChange = (value) => {

        updatePreferences({ projectSort: value });
    };

    const activeProjects = useMemo(() => {

        return projects.filter(project => !project.archived);
    }, [projects]);

    const archivedProjects = useMemo(() => {

        return projects.filter(project => project.archived);
    }, [projects]);

    const projectLastActiveMap = useMemo(() => {

        return buildProjectRecentUpdateMap({
            projects,
            tasks,
            timeEntries,
            invoices,
            expenses,
            recurrences,
        });
    }, [projects, tasks, timeEntries, invoices, expenses, recurrences]);

    const sortedActiveProjects = useMemo(() => {

        return sortItems({
            items: activeProjects,
            sortBy: projectSort,
            getName: (project) => project.title || '',
            getCreatedAt: (project) => project.createdAt,
            getLastActive: (project) => projectLastActiveMap.get(project.id),
        });
    }, [activeProjects, projectSort, projectLastActiveMap]);

    const sortedArchivedProjects = useMemo(() => {

        return sortItems({
            items: archivedProjects,
            sortBy: projectSort,
            getName: (project) => project.title || '',
            getCreatedAt: (project) => project.createdAt,
            getLastActive: (project) => projectLastActiveMap.get(project.id),
        });
    }, [archivedProjects, projectSort, projectLastActiveMap]);

    // Update showCreateForm when the prop changes - Removed since using modal manager

    /**
     * Check if a project has associated invoices
     */
    const projectHasInvoices = (projectId) => {
        return getInvoicesForProject(invoices, projectId).length > 0;
    };

    const projectHasSharedInvoices = (projectId) => {
        return getInvoicesForProject(invoices, projectId).some((invoice) => isMultiProjectInvoice(invoice));
    };

    /**
     * Handle project deletion - check for invoices first
     */
    const handleDeleteProject = (projectId) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        // Check if project has invoices before proceeding
        if (projectHasInvoices(projectId)) {
            setProjectToDelete(project);
            setShowDeleteModal(true);
            return;
        }

        // If no invoices, proceed with standard confirmation
        if (window.confirm('Are you sure you want to delete this project? All associated tasks and time entries will be lost.')) {
            performProjectDeletion(projectId);
        }
    };

    /**
     * Perform the actual project deletion
     */
    const performProjectDeletion = (projectId, shouldDeleteInvoices = false) => {
        const deletePlan = buildProjectDeleteImpactPlan({
            projectId,
            includeInvoiceDeletion: shouldDeleteInvoices,
            projects,
            activeTasks: tasks.filter(task => !task.deletedAt),
            archivedTasks: [],
            timeEntries,
            timers,
            invoices,
            expenses,
            expenseRecurrences: recurrences,
            plannerAttachments: [],
        });

        if (!deletePlan) {
            return;
        }

        const projectInvoicesForDelete = getInvoicesForProject(invoices, projectId);
        const sharedInvoices = projectInvoicesForDelete.filter((invoice) => isMultiProjectInvoice(invoice));

        if (shouldDeleteInvoices && sharedInvoices.length > 0) {
            showError('This project is referenced by a shared invoice and cannot be hard-deleted. Archive the project instead.');
            return;
        }

        const taskIdsArray = deletePlan.taskIdsToDelete;

        const projectTimer = timers.find(timer => timer.projectId === projectId);
        if (projectTimer) {
            clearTimer(projectId);
        }

        // Delete all time entries for deleted tasks (Separate document: entries-active)
        const timeEntryIdsToDelete = deletePlan.timeEntryIdsToDelete;
            
        if (timeEntryIdsToDelete.length > 0) {
            // Group time entry deletions in their own transaction on the active-entries document
            store.activeEntriesDoc.transact(() => {
                timeEntryIdsToDelete.forEach(entryId => deleteEntry(entryId));
            });
        }

        // Perform core updates in a single atomic transaction (projects, tasks, invoices)
        store.projects.doc.transact(() => {
            // Delete associated invoices if requested
            if (shouldDeleteInvoices) {
                projectInvoicesForDelete.forEach(invoice => unbillExpensesForInvoice(invoice.id));
                projectInvoicesForDelete.forEach(invoice => deleteInvoice(invoice.id));
            }

            deletePlan.expenseIdsToDelete.forEach(expenseId => deleteExpense(expenseId));

            deletePlan.recurrenceIdsToDelete.forEach(recurrenceId => deleteRecurrence(recurrenceId));

            // Delete the project
            deleteProject(projectId);
            
            // Delete all tasks for this project (including subtasks)
            taskIdsArray.forEach(taskId => deleteTask(taskId));
        });
        
        const deletedTaskCount = taskIdsArray.length;
        const deletedTimeEntriesCount = timeEntryIdsToDelete.length;
        
        // Close the edit form if the deleted project was being edited - Removed since using modal manager

        // Show appropriate success message
        const baseMessage = `Project deleted successfully. ${deletedTaskCount} task${deletedTaskCount !== 1 ? 's' : ''} and ${deletedTimeEntriesCount} time entr${deletedTimeEntriesCount !== 1 ? 'ies' : 'y'} removed.`;
        const invoiceMessage = shouldDeleteInvoices ? ' Associated invoices were also deleted.' : '';
        showSuccess(baseMessage + invoiceMessage);
    };

    /**
     * Handle clicking on billable amount to generate invoice
     */
    const handleGenerateInvoice = (e, project) => {
        e.stopPropagation();
        // Select the project and navigate to dashboard where invoice generation is available
        onSelectProject(project);
    };

    /**
     * Handle archiving a project
     */
    const handleArchiveProject = (projectId) => {
        updateProject(projectId, { archived: true, archivedOnDate: toStorageDate(new Date()) });
        showSuccess('Project archived successfully.');
    };

    /**
     * Handle unarchiving a project
     */
    const handleUnarchiveProject = (projectId) => {
        updateProject(projectId, { archived: false, archivedOnDate: null });
        showSuccess('Project unarchived successfully.');
    };

    const renderProjectValueChip = (project) => {
        if (project.isPersonal) {
            return null;
        }

        const invoicePreview = getProjectInvoicePreview(project, {
            clients,
            tasks,
            timeEntries,
            expenses,
            exchangeRates,
        });
        const previewTitle = invoicePreview.excludedExpenseCount > 0
            ? `${invoicePreview.excludedExpenseCount} expense${invoicePreview.excludedExpenseCount === 1 ? '' : 's'} excluded until exchange rates are available`
            : 'Estimated invoice total';

        if (invoicePreview.total > 0) {
            return (
                <button
                    onClick={(e) => handleGenerateInvoice(e, project)}
                    className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    title={previewTitle}
                >
                    <span className="sensitive-data">
                        {formatCurrency(invoicePreview.total, invoicePreview.currency)}
                    </span>
                </button>
            );
        }

        if (invoicePreview.unpricedHours > 0) {
            return (
                <button
                    onClick={(e) => handleGenerateInvoice(e, project)}
                    className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    title={`${invoicePreview.unpricedHours.toFixed(2)} unpriced hours - Click to set rate and generate invoice`}
                >
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {invoicePreview.unpricedHours.toFixed(2)}h
                </button>
            );
        }

        return null;
    };

    const renderProjectCard = (project, { archived = false } = {}) => {
        const client = getProjectClient(project);
        const projectValueChip = renderProjectValueChip(project);
        const lastActive = projectLastActiveMap.get(project.id);
        const deadlineStatus = getProjectDeadlineStatus(project);
        const deadlineSummary = deadlineStatus.hasDeadline
            ? (deadlineStatus.isResolved
                ? null
                : deadlineStatus.isOverdue
                ? `${Math.abs(deadlineStatus.daysRemaining || 0)} day${Math.abs(deadlineStatus.daysRemaining || 0) === 1 ? '' : 's'} overdue`
                : deadlineStatus.isToday
                    ? 'Due today'
                    : `${deadlineStatus.daysRemaining} day${deadlineStatus.daysRemaining === 1 ? '' : 's'} remaining`)
            : null;
        const deadlineBadge = deadlineStatus.isResolved ? (
            <Badge variant="success" className="gap-1 whitespace-nowrap">
                <CheckIcon className="h-3 w-3" />
                Completed {toDisplayDate(deadlineStatus.resolvedAt, { month: 'short', day: 'numeric' })}
            </Badge>
        ) : deadlineStatus.isOverdue ? (
            <Badge variant="warning" className="whitespace-nowrap">
                Overdue
            </Badge>
        ) : null;

        return (
            <Card
                key={project.id}
                className="relative flex h-full cursor-pointer border-l-4 transition-shadow hover:shadow-md"
                style={getProjectBorderStyle(project)}
                onClick={() => onSelectProject(project)}
            >
                <CardContent className="flex min-h-full flex-1 flex-col p-4 sm:pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2">
                                <h3 className="min-w-0 flex-1 whitespace-normal break-words [overflow-wrap:anywhere] text-base font-medium leading-tight text-foreground sm:text-lg">
                                    {project.title}
                                </h3>
                                {archived && (
                                    <Badge variant="secondary">Archived</Badge>
                                )}
                                {project.isPersonal && (
                                    <Badge variant="secondary">Personal</Badge>
                                )}
                                {!project.isPersonal && isProjectInQuoteMode(project) && (
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Quote stage</Badge>
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground sm:text-sm">
                                <span>Created {toDisplayDate(project.createdAt)}</span>
                                {lastActive ? (
                                    <span>Most recent {toDisplayDate(lastActive)}</span>
                                ) : null}
                            </div>

                            {client?.title && !project.isPersonal && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Client: <span className="font-medium text-foreground">{client.title}</span>
                                </p>
                            )}

                            {project.hourlyRate && !project.flatRate && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    <span className="sensitive-data">
                                        {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                    </span>
                                </p>
                            )}

                            {deadlineStatus.hasDeadline && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Deadline <span className="font-medium text-foreground">{toDisplayDate(deadlineStatus.deadline, { month: 'short', day: 'numeric' })}</span>
                                    {deadlineSummary ? ` · ${deadlineSummary}` : ''}
                                </p>
                            )}
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    onClick={(e) => e.stopPropagation()}
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 rounded-full text-muted-foreground hover:bg-muted"
                                    title="More actions"
                                    aria-label="More actions"
                                >
                                    <MoreHorizontal className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                {!archived && (
                                    <DropdownMenuItem
                                        onClick={() => editProjectModal(project)}
                                        className="status-warning-action flex items-center space-x-2"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => archived ? handleUnarchiveProject(project.id) : handleArchiveProject(project.id)}
                                    className="status-info-action flex items-center space-x-2"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>{archived ? 'Unarchive' : 'Archive'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => archived ? handleDeleteProject(project.id) : (() => {
                                        setProjectToDelete(project);
                                        setShowDeleteModal(true);
                                    })()}
                                    className="status-danger-action flex items-center space-x-2"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {(deadlineBadge || projectValueChip) && (
                        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-4">
                            {deadlineBadge}
                            {projectValueChip}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    /**
     * Confirm project deletion (for direct deletion without invoices)
     */
    const confirmDeleteProject = () => {
        if (projectToDelete) {
            performProjectDeletion(projectToDelete.id, false);
            setProjectToDelete(null);
        }
        setShowDeleteModal(false);
    };

    /**
     * Handle archive project from modal
     */
    const handleArchiveFromModal = () => {
        if (projectToDelete) {
            handleArchiveProject(projectToDelete.id);
            setShowDeleteModal(false);
            setProjectToDelete(null);
        }
    };

    /**
     * Handle force delete project with invoices
     */
    const handleForceDelete = () => {
        if (projectToDelete) {
            performProjectDeletion(projectToDelete.id, true);
            setShowDeleteModal(false);
            setProjectToDelete(null);
        }
    };

    /**
     * Handle cancel delete modal
     */
    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setProjectToDelete(null);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="min-w-0 flex-1 text-2xl font-bold text-foreground">
                    Projects {activeProjects.length > 0 && (
                        <span>
                            ({activeProjects.length})
                        </span>
                    )}
                </h2>

                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <Select value={projectSort} onValueChange={handleSortChange}>
                        <SelectTrigger
                            className="h-9 w-9"
                            aria-label="Sort projects"
                            leadingIcon={SortIcon}
                            hideCaret
                            iconOnly
                        >
                            <span className="sr-only">
                                <SelectValue placeholder="Sort by" />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button 
                        onClick={() => openProjectModal()} 
                        leadingIcon={PlusIcon}
                    >
                        New Project
                    </Button>
                </div>
            </div>



            {/* Projects Grid */}
            {activeProjects.length === 0 && archivedProjects.length === 0 ? (
                <EmptyState
                    icon={ClipboardDocumentCheckIcon}
                    title="No projects"
                    description="Get started by creating your first project."
                    actionLabel="Create First Project"
                    actionIcon={PlusIcon}
                    onAction={() => openProjectModal()}
                />
            ) : (
                <>
                    {/* Active Projects */}
                    {sortedActiveProjects.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {sortedActiveProjects.map((project) => renderProjectCard(project))}
                </div>
                    )}

                    {/* Archived Projects Section */}
                    {projects.filter(p => p.archived).length > 0 && (
                        <div className="border-t pt-6">
                            <button
                                onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                                className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
                            >
                                {showArchivedProjects ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Projects ({archivedProjects.length})
                            </button>

                            {showArchivedProjects && (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {sortedArchivedProjects.map((project) => renderProjectCard(project, { archived: true }))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <ProjectDeleteDialog
                isOpen={showDeleteModal}
                onClose={handleCancelDelete}
                project={projectToDelete}
                hasInvoices={Boolean(projectToDelete && projectHasInvoices(projectToDelete.id))}
                hasSharedInvoices={Boolean(projectToDelete && projectHasSharedInvoices(projectToDelete.id))}
                onConfirmDelete={confirmDeleteProject}
                onArchive={handleArchiveFromModal}
                onForceDelete={handleForceDelete}
            />
        </div>
    );
};

export default ProjectList;
