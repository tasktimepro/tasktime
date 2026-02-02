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
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';

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
    
    // Yjs hooks for data access
    const { projects, updateProject, deleteProject } = useProjects();
    const { tasks, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { deleteInvoice } = useInvoices();
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
        return color ? { borderLeftColor: color } : undefined;
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
        const project = projects.find(p => p.id === projectId);
        return project && project.invoiceIds && project.invoiceIds.length > 0;
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

        // If shouldDeleteInvoices is true, delete associated invoices
        if (shouldDeleteInvoices) {
            const project = projects.find(p => p.id === projectId);
            if (project && project.invoiceIds && project.invoiceIds.length > 0) {
                project.invoiceIds.forEach(invoiceId => deleteInvoice(invoiceId));
            }
        }

        // Delete the project
        deleteProject(projectId);
        
        // Delete all tasks for this project (including subtasks)
        taskIdsArray.forEach(taskId => deleteTask(taskId));
        
        // Delete all time entries for deleted tasks
        const timeEntryIdsToDelete = timeEntries
            .filter(entry => allTaskIdsToDelete.has(entry.taskId))
            .map(entry => entry.id);
        timeEntryIdsToDelete.forEach(entryId => deleteEntry(entryId));
        
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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">
                    Projects {activeProjects.length > 0 && (
                        <span>
                            ({activeProjects.length})
                        </span>
                    )}
                </h2>

                <div className="flex items-center space-x-3">
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
                    description="Get started by creating a new project."
                    actionLabel="New Project"
                    actionIcon={PlusIcon}
                    onAction={() => openProjectModal()}
                />
            ) : (
                <>
                    {/* Active Projects */}
                    {sortedActiveProjects.length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {sortedActiveProjects.map((project) => (
                                <Card
                                    key={project.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer relative border-l-4 border-l-transparent"
                                    style={getProjectBorderStyle(project)}
                                    onClick={() => onSelectProject(project)}
                                >
                                    <CardContent className="pt-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-medium text-foreground truncate">
                                                {project.title}
                                            </h3>

                                            {/* Three-dot dropdown menu for Edit and Delete */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        onClick={(e) => e.stopPropagation()}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-muted-foreground hover:bg-muted rounded-full"
                                                        title="More actions"
                                                        aria-label="More actions"
                                                    >
                                                        <MoreHorizontal className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem
                                                        onClick={() => editProjectModal(project)}
                                                        className="flex items-center space-x-2 hover:bg-yellow-50 hover:text-yellow-600"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleArchiveProject(project.id)}
                                                        className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                                    >
                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                        <span>Archive</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setProjectToDelete(project);
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {project.hourlyRate && !project.flatRate && (
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                <span className="sensitive-data">
                                                    {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                                </span>
                                            </p>
                                        )}

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Created {toDisplayDate(project.createdAt)}
                                            {project.isPersonal && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                                                    Personal
                                                </span>
                                            )}
                                        </p>

                                        {/* Billable Amount Tag or Clock Icon for missing rate - Only show for non-personal projects */}
                                        {!project.isPersonal && calculateUnbilledAmount(project) > 0 ? (
                                            <div className="absolute bottom-4 right-4">
                                                <button
                                                    onClick={(e) => handleGenerateInvoice(e, project)}
                                                    className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full hover:bg-primary/90 transition-colors"
                                                    title="Click to generate invoice"
                                                >
                                                    <span className="sensitive-data">
                                                        {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                                                    </span>
                                                </button>
                                            </div>
                                        ) : !project.isPersonal && !project.hourlyRate && calculateUnbilledHours(project) > 0 ? (
                                            <div className="absolute bottom-4 right-4">
                                                <button
                                                    onClick={(e) => handleGenerateInvoice(e, project)}
                                                    className="inline-flex items-center px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full hover:bg-secondary/80 transition-colors"
                                                    title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                                >
                                                    <ClockIcon className="h-3 w-3 mr-1" />
                                                    {calculateUnbilledHours(project).toFixed(2)}h
                                                </button>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            ))}
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
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {sortedArchivedProjects.map((project) => (
                                        <Card
                                            key={project.id}
                                            className="hover:shadow-md transition-shadow cursor-pointer relative border-l-4 border-l-transparent"
                                            style={getProjectBorderStyle(project)}
                                            onClick={() => onSelectProject(project)}
                                        >
                                            <CardContent className="pt-5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center min-w-0">
                                                        <h3 className="text-lg font-medium text-foreground truncate">
                                                            {project.title}
                                                        </h3>
                                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                                            Archived
                                                        </span>
                                                    </div>

                                                    {/* Three-dot dropdown menu for Unarchive and Delete */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-1 text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                                title="More actions"
                                                            >
                                                                <MoreHorizontal className="h-5 w-5 group-hover:text-muted-foreground" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuItem
                                                                onClick={() => handleUnarchiveProject(project.id)}
                                                                className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                                <span>Unarchive</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteProject(project.id)}
                                                                className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                <span>Delete</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>

                                                {project.hourlyRate && !project.flatRate && (
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        <span className="sensitive-data">
                                                            {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                                        </span>
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Created {toDisplayDate(project.createdAt)}
                                                    {project.isPersonal && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                                                            Personal
                                                        </span>
                                                    )}
                                                </p>

                                                {/* Billable Amount Tag or Clock Icon for missing rate */}
                                                {calculateUnbilledAmount(project) > 0 ? (
                                                    <div className="absolute bottom-4 right-4">
                                                        <button
                                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                                            className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full hover:bg-primary/90 transition-colors"
                                                            title="Click to generate invoice"
                                                        >
                                                            <span className="sensitive-data">
                                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                                                            </span>
                                                        </button>
                                                    </div>
                                                ) : !project.hourlyRate && calculateUnbilledHours(project) > 0 ? (
                                                    <div className="absolute bottom-4 right-4">
                                                        <button
                                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                                            className="inline-flex items-center px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full hover:bg-secondary/80 transition-colors"
                                                            title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                                        >
                                                            <ClockIcon className="h-3 w-3 mr-1" />
                                                            {calculateUnbilledHours(project).toFixed(2)}h
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </CardContent>
                                        </Card>
                                    ))}
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
