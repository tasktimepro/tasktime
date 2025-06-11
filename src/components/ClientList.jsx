import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useToast } from '../hooks/useToast';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'dropdown-toggle';

/**
 * ClientList component - Displays and manages the list of clients
 */
const ClientList = ({ 
    clients, 
    setClients, 
    projects = [],
    setProjects,
    tasks = [], 
    setTasks, 
    timeEntries = [], 
    setTimeEntries, 
    invoices = [],
    setInvoices,
    onSelectClient,
    openClientModal,
    editClientModal
}) => {
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by client ID
    const [showArchivedClients, setShowArchivedClients] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [showArchiveProjectsModal, setShowArchiveProjectsModal] = useState(false);
    const [relatedProjects, setRelatedProjects] = useState([]);
    const { showSuccess } = useToast();

    // Form data removed - using modal manager now
    
    // Add event listener for dropdown close behavior
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
     * Get related projects for a client
     */
    const getRelatedProjects = (clientId) => {
        return projects.filter(project => project.preferredClientId === clientId);
    };

    /**
     * Handle client deletion - check for projects first
     */
    const handleDeleteClient = (clientId) => {
        const related = getRelatedProjects(clientId);
        if (related.length > 0) {
            setRelatedProjects(related);
            setClientToDelete(clients.find(c => c.id === clientId));
            setShowDeleteModal(true);
        } else {
            // No related projects, can delete directly
            performClientDeletion(clientId, false);
        }
    };

    /**
     * Handle archive client
     */
    const handleArchiveClient = (clientId) => {
        const related = getRelatedProjects(clientId);
        if (related.length > 0) {
            setRelatedProjects(related);
            setClientToDelete(clients.find(c => c.id === clientId));
            setShowArchiveProjectsModal(true);
        } else {
            // No related projects, can archive directly
            performClientArchive(clientId, false);
        }
    };

    /**
     * Perform actual client deletion
     */
    const performClientDeletion = (clientId, alsoDeleteProjects) => {
        if (alsoDeleteProjects) {
            // Get related projects and their task/time entry IDs
            const relatedProjectIds = getRelatedProjects(clientId).map(p => p.id);
            
            // Delete related projects
            setProjects(projects.filter(project => !relatedProjectIds.includes(project.id)));
            
            // Delete tasks for related projects
            const relatedTaskIds = tasks.filter(task => relatedProjectIds.includes(task.projectId)).map(t => t.id);
            setTasks(tasks.filter(task => !relatedTaskIds.includes(task.id)));
            
            // Delete time entries for related tasks
            setTimeEntries(timeEntries.filter(entry => !relatedTaskIds.includes(entry.taskId)));
            
            // Delete invoices for related projects
            setInvoices(invoices.filter(invoice => !relatedProjectIds.includes(invoice.projectId)));
        } else {
            // Remove client reference from projects
            setProjects(projects.map(project => 
                project.preferredClientId === clientId 
                    ? { ...project, preferredClientId: null }
                    : project
            ));
        }

        // Remove the client
        setClients(clients.filter(client => client.id !== clientId));

        // Show appropriate success message
        const message = alsoDeleteProjects 
            ? `Client and ${relatedProjects.length} related project(s) deleted successfully.`
            : 'Client deleted successfully.';
        showSuccess(message);
    };

    /**
     * Perform actual client archive
     */
    const performClientArchive = (clientId, alsoArchiveProjects) => {
        if (alsoArchiveProjects) {
            // Archive related projects
            const relatedProjectIds = getRelatedProjects(clientId).map(p => p.id);
            setProjects(projects.map(project => 
                relatedProjectIds.includes(project.id)
                    ? { ...project, archived: true }
                    : project
            ));
        }

        // Archive the client
        const updatedClients = clients.map(client =>
            client.id === clientId ? { ...client, archived: true } : client
        );
        setClients(updatedClients);

        // Show appropriate success message
        const message = alsoArchiveProjects 
            ? `Client and ${relatedProjects.length} related project(s) archived successfully.`
            : 'Client archived successfully.';
        showSuccess(message);
    };

    /**
     * Unarchive a client
     */
    const handleUnarchiveClient = (clientId) => {
        const updatedClients = clients.map(client =>
            client.id === clientId ? { ...client, archived: false } : client
        );
        setClients(updatedClients);
        showSuccess('Client unarchived successfully!');
    };

    /**
     * Confirm client deletion (for direct deletion without projects)
     */
    const confirmDeleteClient = () => {
        if (clientToDelete) {
            performClientDeletion(clientToDelete.id, false);
            setClientToDelete(null);
        }
        setShowDeleteModal(false);
    };

    /**
     * Handle force delete client with projects
     */
    const handleForceDelete = () => {
        if (clientToDelete) {
            performClientDeletion(clientToDelete.id, true);
            setShowDeleteModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle archive client from modal
     */
    const handleArchiveFromModal = () => {
        if (clientToDelete) {
            performClientArchive(clientToDelete.id, false);
            setShowArchiveProjectsModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle archive client with projects
     */
    const handleArchiveWithProjects = () => {
        if (clientToDelete) {
            performClientArchive(clientToDelete.id, true);
            setShowArchiveProjectsModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle cancel delete modal
     */
    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setShowArchiveProjectsModal(false);
        setClientToDelete(null);
        setRelatedProjects([]);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    Clients {clients.filter(c => !c.archived).length > 0 && (
                        <span>
                            ({clients.filter(c => !c.archived).length})
                        </span>
                    )}
                </h2>

                <button
                    onClick={() => openClientModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Client
                </button>
            </div>



            {/* Clients Grid */}
            {clients.filter(c => !c.archived).length === 0 && clients.filter(c => c.archived).length === 0 ? (
                <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                        <UserGroupIcon className="h-12 w-12" />
                    </div>

                    <h3 className="mt-2 text-sm font-medium text-gray-900">No clients</h3>

                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new client.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => openClientModal()}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Client
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Active Clients */}
                    {clients.filter(c => !c.archived).length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {clients.filter(c => !c.archived).map((client) => (
                                <div
                                    key={client.id}
                                    className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                                    onClick={() => onSelectClient(client)}
                                >
                                    <div className="p-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-medium text-gray-900 truncate">
                                                {client.title}
                                            </h3>

                                            {/* Three-dot dropdown menu for Edit and Delete */}
                                            <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => {
                                                        const newState = !showDropdown[client.id];
                                                        setShowDropdown(newState ? { [client.id]: true } : {});

                                                        // Dispatch a custom event to close other dropdowns
                                                        const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                            detail: { taskId: client.id, open: newState }
                                                        });
                                                        document.dispatchEvent(event);
                                                    }}
                                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                                    title="More actions"
                                                >
                                                    <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                                </button>

                                                {showDropdown[client.id] && (
                                                    <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                        <div className="py-1">
                                                            <button
                                                                onClick={() => {
                                                                    editClientModal(client);
                                                                    setShowDropdown({});
                                                                }}
                                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleArchiveClient(client.id);
                                                                    setShowDropdown({});
                                                                }}
                                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                                <span>Archive</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleDeleteClient(client.id);
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

                                        {client.clientName && (
                                            <p className="mt-2 text-sm text-gray-600">
                                                {client.clientName}
                                            </p>
                                        )}

                                        {client.contactPerson && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                Contact: {client.contactPerson}
                                            </p>
                                        )}

                                        <p className="mt-1 text-xs text-gray-400">
                                            Created {new Date(client.createdAt).toLocaleDateString()}
                                        </p>

                                        {/* Show related projects count */}
                                        {(() => {
                                            const relatedProjectsCount = getRelatedProjects(client.id).length;
                                            return relatedProjectsCount > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="text-xs text-gray-500">
                                                        {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Archived Clients Section */}
                    {clients.filter(c => c.archived).length > 0 && (
                        <div className="border-t pt-6">
                            <button
                                onClick={() => setShowArchivedClients(!showArchivedClients)}
                                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
                            >
                                {showArchivedClients ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Clients ({clients.filter(c => c.archived).length})
                            </button>

                            {showArchivedClients && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {clients.filter(c => c.archived).map((client) => (
                                        <div
                                            key={client.id}
                                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                                            onClick={() => onSelectClient(client)}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-medium text-gray-900 truncate">
                                                        {client.title}
                                                    </h3>

                                                    {/* Three-dot dropdown menu for Unarchive and Delete */}
                                                    <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                const newState = !showDropdown[client.id];
                                                                setShowDropdown(newState ? { [client.id]: true } : {});

                                                                // Dispatch a custom event to close other dropdowns
                                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                                    detail: { taskId: client.id, open: newState }
                                                                });
                                                                document.dispatchEvent(event);
                                                            }}
                                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                                            title="More actions"
                                                        >
                                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                                        </button>

                                                        {showDropdown[client.id] && (
                                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                                <div className="py-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleUnarchiveClient(client.id);
                                                                            setShowDropdown({});
                                                                        }}
                                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                                    >
                                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                                        <span>Unarchive</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDeleteClient(client.id);
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

                                                {client.clientName && (
                                                    <p className="mt-2 text-sm text-gray-600">
                                                        {client.clientName}
                                                    </p>
                                                )}

                                                {client.contactPerson && (
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Contact: {client.contactPerson}
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-gray-400">
                                                    Created {new Date(client.createdAt).toLocaleDateString()}
                                                </p>

                                                {/* Show related projects count */}
                                                {(() => {
                                                    const relatedProjectsCount = getRelatedProjects(client.id).length;
                                                    return relatedProjectsCount > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                                            <div className="text-xs text-gray-500">
                                                                {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
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
            {showDeleteModal && clientToDelete && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={handleCancelDelete}
                    title="⚠️ Client Has Related Projects"
                    size="md"
                    footer={
                        <div className="flex justify-end">
                            <button
                                onClick={handleCancelDelete}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        
                        <p className="text-sm text-gray-700 mb-6">
                            <strong>Recommended:</strong> Archive this client to preserve project relationships for record-keeping purposes.
                        </p>

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={() => {
                                    handleArchiveClient(clientToDelete.id);
                                    setShowDeleteModal(false);
                                    setClientToDelete(null);
                                    setRelatedProjects([]);
                                }}
                                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Archive Client (Recommended)
                            </button>

                            <button
                                onClick={confirmDeleteClient}
                                className="w-full px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                                Delete & Remove Client Reference
                            </button>

                            <button
                                onClick={handleForceDelete}
                                className="w-full px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                Delete Client & All Projects
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Archive with Projects Modal */}
            {showArchiveProjectsModal && clientToDelete && (
                <Modal
                    isOpen={showArchiveProjectsModal}
                    onClose={handleCancelDelete}
                    title="Archive Client with Related Projects?"
                    size="md"
                    footer={
                        <div className="flex justify-end">
                            <button
                                onClick={handleCancelDelete}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        
                        <p className="text-sm text-gray-700 mb-6">
                            Would you like to archive the related projects as well?
                        </p>

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleArchiveWithProjects}
                                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Archive Client & Projects
                            </button>

                            <button
                                onClick={handleArchiveFromModal}
                                className="w-full px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Archive Client Only
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

ClientList.propTypes = {
    clients: PropTypes.array.isRequired,
    setClients: PropTypes.func.isRequired,
    projects: PropTypes.array,
    setProjects: PropTypes.func,
    tasks: PropTypes.array,
    setTasks: PropTypes.func,
    timeEntries: PropTypes.array,
    setTimeEntries: PropTypes.func,
    invoices: PropTypes.array,
    setInvoices: PropTypes.func,
    onSelectClient: PropTypes.func.isRequired,
    openClientModal: PropTypes.func.isRequired,
    editClientModal: PropTypes.func.isRequired
};

export default ClientList;
