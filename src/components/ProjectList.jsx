import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, ClockIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils';
import { millisecondsToHours } from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';
import { getTaskIdsToDelete } from '../utils/taskUtils';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'dropdown-toggle';

/**
 * ProjectList component - Displays and manages the list of projects
 */
const ProjectList = ({ 
    projects, 
    setProjects, 
    tasks = [], 
    setTasks, 
    timeEntries = [], 
    setTimeEntries, 
    currentTimer, 
    setCurrentTimer, 
    onSelectProject,
    invoices = [],
    setInvoices,
    clients = [],
    openProjectModal,
    editProjectModal
}) => {
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by project ID
    const [showArchivedProjects, setShowArchivedProjects] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const { showSuccess } = useToast();

    // Update showCreateForm when the prop changes - Removed since using modal manager
    
    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleDropdownToggle = (event) => {
            const { taskId, open } = event.detail;
            if (!open) {
                // Close all dropdowns when any dropdown is closed
                setShowDropdown({});
            } else {
                // Close other dropdowns when a new one opens
                setShowDropdown({ [taskId]: true });
            }
        };

        const handleClickOutside = (event) => {
            // Close dropdowns when clicking outside
            if (!event.target.closest('.dropdown-container')) {
                setShowDropdown({});
            }
        };

        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        document.addEventListener('click', handleClickOutside);
        
        return () => {
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

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
        // Check if project has invoices before proceeding
        if (projectHasInvoices(projectId)) {
            setProjectToDelete(projectId);
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
    const performProjectDeletion = (projectId, deleteInvoices = false) => {
        // Get all task IDs that need to be deleted (including subtasks)
        const projectTasks = tasks.filter(task => task.projectId === projectId);
        const allTaskIdsToDelete = new Set();
        
        // Add all project tasks and their subtasks
        projectTasks.forEach(task => {
            const taskIds = getTaskIdsToDelete(task.id, tasks);
            taskIds.forEach(id => allTaskIdsToDelete.add(id));
        });

        // Check if current timer is running on any task that will be deleted
        if (currentTimer && allTaskIdsToDelete.has(currentTimer.taskId)) {
            setCurrentTimer(null);
        }

        // If deleteInvoices is true, remove associated invoices
        if (deleteInvoices) {
            const project = projects.find(p => p.id === projectId);
            if (project && project.invoiceIds && project.invoiceIds.length > 0) {
                const updatedInvoices = invoices.filter(invoice => 
                    !project.invoiceIds.includes(invoice.id)
                );
                setInvoices(updatedInvoices);
            }
        }

        // Remove the project
        setProjects(projects.filter(project => project.id !== projectId));
        
        // Remove all tasks for this project (including subtasks)
        const updatedTasks = tasks.filter(task => !allTaskIdsToDelete.has(task.id));
        setTasks(updatedTasks);
        
        // Remove all time entries for deleted tasks
        const updatedTimeEntries = timeEntries.filter(entry => 
            !allTaskIdsToDelete.has(entry.taskId)
        );
        setTimeEntries(updatedTimeEntries);
        
        const deletedTaskCount = allTaskIdsToDelete.size;
        const deletedTimeEntriesCount = timeEntries.length - updatedTimeEntries.length;
        
        // Close the edit form if the deleted project was being edited - Removed since using modal manager

        // Show appropriate success message
        const baseMessage = `Project deleted successfully. ${deletedTaskCount} task${deletedTaskCount !== 1 ? 's' : ''} and ${deletedTimeEntriesCount} time entr${deletedTimeEntriesCount !== 1 ? 'ies' : 'y'} removed.`;
        const invoiceMessage = deleteInvoices ? ' Associated invoices were also deleted.' : '';
        showSuccess(baseMessage + invoiceMessage);
    };

    /**
     * Archive a project
     */
    const handleArchiveProject = (projectId) => {
        const updatedProjects = projects.map(project =>
            project.id === projectId ? { ...project, archived: true } : project
        );
        setProjects(updatedProjects);
        showSuccess('Project archived successfully!');
    };

    /**
     * Unarchive a project
     */
    const handleUnarchiveProject = (projectId) => {
        const updatedProjects = projects.map(project =>
            project.id === projectId ? { ...project, archived: false } : project
        );
        setProjects(updatedProjects);
        showSuccess('Project unarchived successfully!');
    };

    /**
     * Calculate unbilled amount for a project
     */
    const calculateUnbilledAmount = (project) => {
        // If it's a flat rate project or no hourly rate is set, return 0 for the amount
        if (project.flatRate || !project.hourlyRate) return 0;
        
        // Get tasks for this project
        const projectTasks = tasks.filter(task => task.projectId === project.id);
        
        // Get explicitly billable tasks (tasks with billable === true)
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);
        
        // Get time entries for this project's tasks with task-level billing filtering
        const unbilledEntries = timeEntries.filter(entry => {
            // Only include entries for tasks that are explicitly marked as billable
            if (!billableTaskIds.includes(entry.taskId)) return false;
            
            // Find the task for this entry
            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;
            
            // Use task-specific lastBilledAt, or task creation date if never billed
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            
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

        return unbilledHours * project.hourlyRate;
    };

    /**
     * Calculate unbilled hours for a project (without rate requirement)
     */
    const calculateUnbilledHours = (project) => {
        // Get tasks for this project
        const projectTasks = tasks.filter(task => task.projectId === project.id);
        
        // Get explicitly billable tasks (tasks with billable === true)
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);
        
        // Get time entries for this project's tasks with task-level billing filtering
        const unbilledEntries = timeEntries.filter(entry => {
            // Only include entries for tasks that are explicitly marked as billable
            if (!billableTaskIds.includes(entry.taskId)) return false;
            
            // Find the task for this entry
            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;
            
            // Use task-specific lastBilledAt, or task creation date if never billed
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            
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

        return unbilledHours;
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
                <h2 className="text-2xl font-bold text-gray-900">
                    Projects {projects.filter(p => !p.archived).length > 0 && (
                        <span>
                            ({projects.filter(p => !p.archived).length})
                        </span>
                    )}
                </h2>

                <button
                    onClick={() => openProjectModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Project
                </button>
            </div>



            {/* Projects Grid */}
            {projects.filter(p => !p.archived).length === 0 && projects.filter(p => p.archived).length === 0 ? (
                <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                        <ClipboardDocumentCheckIcon className="h-12 w-12" />
                    </div>

                    <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>

                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => openProjectModal()}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Project
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Active Projects */}
                    {projects.filter(p => !p.archived).length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {projects.filter(p => !p.archived).map((project) => (
                        <div
                            key={project.id}
                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                            onClick={() => onSelectProject(project)}
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-gray-900 truncate">
                                        {project.title}
                                    </h3>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => {
                                                const newState = !showDropdown[project.id];
                                                setShowDropdown(newState ? { [project.id]: true } : {});

                                                // Dispatch a custom event to close other dropdowns
                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                    detail: { taskId: project.id, open: newState }
                                                });
                                                document.dispatchEvent(event);
                                            }}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                            title="More actions"
                                        >
                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                        </button>

                                        {showDropdown[project.id] && (
                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            editProjectModal(project);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleArchiveProject(project.id);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                    >
                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                        <span>Archive</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setProjectToDelete(project); // Set the project to be deleted
                                                            setShowDeleteModal(true); // Show the delete confirmation modal
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {project.hourlyRate && !project.flatRate && (
                                    <p className="mt-2 text-sm text-gray-500">
                                        {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                    </p>
                                )}

                                <p className="mt-1 text-xs text-gray-400">
                                    Created {new Date(project.createdAt).toLocaleDateString()}
                                    {project.isPersonal && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            Personal
                                        </span>
                                    )}
                                </p>

                                {/* Billable Amount Tag or Clock Icon for missing rate - Only show for non-personal projects */}
                                {!project.isPersonal && calculateUnbilledAmount(project) > 0 ? (
                                    <div className="absolute bottom-4 right-4">
                                        <button
                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                            className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition-colors"
                                            title="Click to generate invoice"
                                        >
                                            {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                                        </button>
                                    </div>
                                ) : !project.isPersonal && !project.hourlyRate && calculateUnbilledHours(project) > 0 ? (
                                    <div className="absolute bottom-4 right-4">
                                        <button
                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
                                            title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                        >
                                            <ClockIcon className="h-3 w-3 mr-1" />
                                            {calculateUnbilledHours(project).toFixed(2)}h
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
                    )}

                    {/* Archived Projects Section */}
                    {projects.filter(p => p.archived).length > 0 && (
                        <div className="border-t pt-6">
                            <button
                                onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
                            >
                                {showArchivedProjects ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Projects ({projects.filter(p => p.archived).length})
                            </button>

                            {showArchivedProjects && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {projects.filter(p => p.archived).map((project) => (
                                        <div
                                            key={project.id}
                                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                                            onClick={() => onSelectProject(project)}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-medium text-gray-900 truncate">
                                                        {project.title}
                                                    </h3>

                                                    {/* Three-dot dropdown menu for Unarchive and Delete */}
                                                    <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                const newState = !showDropdown[project.id];
                                                                setShowDropdown(newState ? { [project.id]: true } : {});

                                                                // Dispatch a custom event to close other dropdowns
                                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                                    detail: { taskId: project.id, open: newState }
                                                                });
                                                                document.dispatchEvent(event);
                                                            }}
                                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                                            title="More actions"
                                                        >
                                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                                        </button>

                                                        {showDropdown[project.id] && (
                                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                                <div className="py-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleUnarchiveProject(project.id);
                                                                            setShowDropdown({});
                                                                        }}
                                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                                    >
                                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                                        <span>Unarchive</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDeleteProject(project.id);
                                                                            setShowDropdown({});
                                                                        }}
                                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                        <span>Delete</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {project.hourlyRate && !project.flatRate && (
                                                    <p className="mt-2 text-sm text-gray-500">
                                                        {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-gray-400">
                                                    Created {new Date(project.createdAt).toLocaleDateString()}
                                                    {project.isPersonal && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                            Personal
                                                        </span>
                                                    )}
                                                </p>

                                                {/* Billable Amount Tag or Clock Icon for missing rate */}
                                                {calculateUnbilledAmount(project) > 0 ? (
                                                    <div className="absolute bottom-4 right-4">
                                                        <button
                                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                                            className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition-colors"
                                                            title="Click to generate invoice"
                                                        >
                                                            {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                                                        </button>
                                                    </div>
                                                ) : !project.hourlyRate && calculateUnbilledHours(project) > 0 ? (
                                                    <div className="absolute bottom-4 right-4">
                                                        <button
                                                            onClick={(e) => handleGenerateInvoice(e, project)}
                                                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
                                                            title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                                        >
                                                            <ClockIcon className="h-3 w-3 mr-1" />
                                                            {calculateUnbilledHours(project).toFixed(2)}h
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && projectToDelete && (() => {
                const hasInvoices = projectHasInvoices(projectToDelete.id);
                
                return (
                    <Modal
                        isOpen={showDeleteModal}
                        onClose={handleCancelDelete}
                        title={hasInvoices ? "⚠️ Project Has Invoices" : "Confirm Deletion"}
                        size="md"
                        footer={
                            hasInvoices ? (
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={handleCancelDelete}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={handleCancelDelete}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={confirmDeleteProject}
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                        Delete Project
                                    </button>
                                </div>
                            )
                        }
                    >
                        {hasInvoices ? (
                            <>
                                <p className="text-sm text-gray-700 mb-4">
                                    The project "<span className="font-semibold">{projectToDelete.title}</span>" has invoices attached to it.
                                </p>

                                <p className="text-sm text-gray-700 mb-6">
                                    <strong>Recommended:</strong> Archive this project to preserve the invoices for record-keeping purposes.
                                </p>

                                <div className="flex flex-col space-y-3">
                                    <button
                                        onClick={handleArchiveFromModal}
                                        className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Archive Project (Recommended)
                                    </button>

                                    <button
                                        onClick={handleForceDelete}
                                        className="w-full px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                        Force Delete Project & All Invoices
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-gray-700">
                                Are you sure you want to delete the project "<span className="font-semibold">{projectToDelete.title}</span>"? This action cannot be undone.
                            </p>
                        )}
                    </Modal>
                );
            })()}
        </div>
    );
};

export default ProjectList;
