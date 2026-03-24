import { useMemo, useState } from 'react';
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
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, SortIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils.ts';
import { millisecondsToHours, toDisplayDate, toStorageDate } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useYjs } from '../contexts/YjsContext';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../hooks/useExpenseRecurrences.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';
import { getInvoicesForProject } from '../utils/invoiceUtils.ts';

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
    const { showSuccess } = useToast();
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

    const taskProjectMap = useMemo(() => {

        const map = new Map();
        tasks.forEach(task => {
            if (task.projectId) {
                map.set(task.id, task.projectId);
            }
        });
        return map;
    }, [tasks]);

    const projectTaskActiveMap = useMemo(() => {

        const map = new Map();
        tasks.forEach(task => {
            if (!task.projectId) return;

            const lastActive = task.lastActive || 0;
            const current = map.get(task.projectId) || 0;

            if (lastActive > current) {
                map.set(task.projectId, lastActive);
            }
        });

        return map;
    }, [tasks]);

    const projectLastActiveMap = useMemo(() => {

        const map = new Map();
        timeEntries.forEach(entry => {
            const projectId = taskProjectMap.get(entry.taskId);
            if (!projectId) return;

            const activityTime = entry.end && entry.end > 0 ? entry.end : entry.start;
            if (!activityTime) return;

            const current = map.get(projectId) || 0;
            if (activityTime > current) {
                map.set(projectId, activityTime);
            }
        });

        projectTaskActiveMap.forEach((lastActive, projectId) => {
            const current = map.get(projectId) || 0;
            if (lastActive > current) {
                map.set(projectId, lastActive);
            }
        });

        return map;
    }, [timeEntries, taskProjectMap, projectTaskActiveMap]);

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
        // Get all task IDs that need to be deleted (including subtasks)
        const projectTasks = tasks.filter(task => task.projectId === projectId && !task.deletedAt);
        const allTaskIdsToDelete = new Set();
        
        // Add all project tasks and their subtasks
        projectTasks.forEach(task => {
            const taskIds = getTaskIdsToDelete(task.id, tasks);
            taskIds.forEach(id => allTaskIdsToDelete.add(id));
        });

        const taskIdsArray = Array.from(allTaskIdsToDelete);

        const projectTimer = timers.find(timer => timer.projectId === projectId);
        if (projectTimer) {
            clearTimer(projectId);
        }

        // Delete all time entries for deleted tasks (Separate document: entries-active)
        const timeEntryIdsToDelete = timeEntries
            .filter(entry => allTaskIdsToDelete.has(entry.taskId))
            .map(entry => entry.id);
            
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

            // Delete the project
            deleteProject(projectId);
            
            // Delete all tasks for this project (including subtasks)
            taskIdsArray.forEach(taskId => deleteTask(taskId));
        });
        
        const deletedTaskCount = allTaskIdsToDelete.size;
        const deletedTimeEntriesCount = timeEntryIdsToDelete.length;
        
        // Close the edit form if the deleted project was being edited - Removed since using modal manager

        // Show appropriate success message
        const baseMessage = `Project deleted successfully. ${deletedTaskCount} task${deletedTaskCount !== 1 ? 's' : ''} and ${deletedTimeEntriesCount} time entr${deletedTimeEntriesCount !== 1 ? 'ies' : 'y'} removed.`;
        const invoiceMessage = shouldDeleteInvoices ? ' Associated invoices were also deleted.' : '';
        showSuccess(baseMessage + invoiceMessage);
    };

    /**
     * Calculate unbilled amount for a project (requires hourly rate)
     */
    const calculateUnbilledAmount = (project) => {
        if (project.flatRate || !project.hourlyRate) return 0;

        const projectTasks = tasks.filter(task => task.projectId === project.id);
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);

        const unbilledEntries = timeEntries.filter(entry => {
            if (!billableTaskIds.includes(entry.taskId)) return false;
            if (entry.source === 'invoice-adjustment') return false;

            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;

            const taskLastBilledAt = task.lastBilledAt || 0;
            return entry.start > taskLastBilledAt;
        });

        const taskTimeMap = {};
        unbilledEntries.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        const unbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
            const taskHours = millisecondsToHours(taskTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);

        return unbilledHours * project.hourlyRate;
    };

    /**
     * Calculate unbilled hours for a project (without rate requirement)
     */
    const calculateUnbilledHours = (project) => {
        const projectTasks = tasks.filter(task => task.projectId === project.id);
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);

        const unbilledEntries = timeEntries.filter(entry => {
            if (!billableTaskIds.includes(entry.taskId)) return false;
            if (entry.source === 'invoice-adjustment') return false;

            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;

            const taskLastBilledAt = task.lastBilledAt || 0;
            return entry.start > taskLastBilledAt;
        });

        const taskTimeMap = {};
        unbilledEntries.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        return Object.values(taskTimeMap).reduce((total, taskTime) => {
            const taskHours = millisecondsToHours(taskTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);
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
        if (!project.isPersonal && calculateUnbilledAmount(project) > 0) {
            return (
                <button
                    onClick={(e) => handleGenerateInvoice(e, project)}
                    className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    title="Click to generate invoice"
                >
                    <span className="sensitive-data">
                        {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                    </span>
                </button>
            );
        }

        if (!project.isPersonal && !project.hourlyRate && calculateUnbilledHours(project) > 0) {
            return (
                <button
                    onClick={(e) => handleGenerateInvoice(e, project)}
                    className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                >
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {calculateUnbilledHours(project).toFixed(2)}h
                </button>
            );
        }

        return null;
    };

    const renderProjectCard = (project, { archived = false } = {}) => {
        const client = getProjectClient(project);
        const projectValueChip = renderProjectValueChip(project);
        const lastActive = projectLastActiveMap.get(project.id);

        return (
            <Card
                key={project.id}
                className="relative cursor-pointer border-l-4 transition-shadow hover:shadow-md"
                style={getProjectBorderStyle(project)}
                onClick={() => onSelectProject(project)}
            >
                <CardContent className="p-4 sm:pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-medium text-foreground sm:text-lg">
                                    {project.title}
                                </h3>
                                {archived && (
                                    <Badge variant="secondary">Archived</Badge>
                                )}
                                {project.isPersonal && (
                                    <Badge variant="secondary">Personal</Badge>
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground sm:text-sm">
                                <span>Created {toDisplayDate(project.createdAt)}</span>
                                {lastActive ? (
                                    <span>Last active {toDisplayDate(lastActive)}</span>
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
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {archived ? (
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted group"
                                        title="More actions"
                                        aria-label="More actions"
                                    >
                                        <MoreHorizontal className="h-5 w-5 group-hover:text-muted-foreground" />
                                    </button>
                                ) : (
                                    <Button
                                        onClick={(e) => e.stopPropagation()}
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full text-muted-foreground hover:bg-muted"
                                        title="More actions"
                                        aria-label="More actions"
                                    >
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                )}
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

                    {projectValueChip && (
                        <div className="mt-4 flex justify-start sm:justify-end">
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-bold text-foreground">
                    Projects {activeProjects.length > 0 && (
                        <span>
                            ({activeProjects.length})
                        </span>
                    )}
                </h2>

                <div className="flex items-center justify-between gap-3 sm:justify-start">
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
                        className="sm:w-auto"
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
                onConfirmDelete={confirmDeleteProject}
                onArchive={handleArchiveFromModal}
                onForceDelete={handleForceDelete}
            />
        </div>
    );
};

export default ProjectList;
