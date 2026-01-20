import PropTypes from 'prop-types';
import { useState } from 'react';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusIcon, PencilIcon, TrashIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, UserGroupIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { softDeleteById, softDeleteByIds, isDeleted } from '../utils/syncableEntity.ts';

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
    const [showArchivedClients, setShowArchivedClients] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [showArchiveProjectsModal, setShowArchiveProjectsModal] = useState(false);
    const [relatedProjects, setRelatedProjects] = useState([]);
    const { showSuccess } = useToast();

    // Form data removed - using modal manager now

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
     * Perform actual client deletion (soft-delete with tombstones)
     */
    const performClientDeletion = (clientId, alsoDeleteProjects) => {
        const relatedProjects = getRelatedProjects(clientId);
        
        if (alsoDeleteProjects) {
            // Get related projects and their task/time entry IDs
            const relatedProjectIds = relatedProjects.map(p => p.id);
            
            // Soft-delete related projects
            setProjects(softDeleteByIds(projects, relatedProjectIds));
            
            // Soft-delete tasks for related projects
            const relatedTaskIds = tasks
                .filter(task => relatedProjectIds.includes(task.projectId))
                .map(t => t.id);
            setTasks(softDeleteByIds(tasks, relatedTaskIds));
            
            // Soft-delete time entries for related tasks
            const relatedTimeEntryIds = timeEntries
                .filter(entry => relatedTaskIds.includes(entry.taskId))
                .map(e => e.id);
            setTimeEntries(softDeleteByIds(timeEntries, relatedTimeEntryIds));
            
            // Soft-delete invoices for related projects
            const relatedInvoiceIds = invoices
                .filter(invoice => relatedProjectIds.includes(invoice.projectId))
                .map(i => i.id);
            setInvoices(softDeleteByIds(invoices, relatedInvoiceIds));
        } else {
            // Remove client reference from projects (update, not delete)
            const now = Date.now();
            setProjects(projects.map(project => 
                project.preferredClientId === clientId 
                    ? { ...project, preferredClientId: null, updatedAt: now }
                    : project
            ));
        }

        // Soft-delete the client
        setClients(softDeleteById(clients, clientId));

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
                <h2 className="text-2xl font-bold text-foreground">
                    Clients {clients.filter(c => !c.archived && !isDeleted(c)).length > 0 && (
                        <span>
                            ({clients.filter(c => !c.archived && !isDeleted(c)).length})
                        </span>
                    )}
                </h2>

                <Button onClick={() => openClientModal()} leadingIcon={PlusIcon}>
                    New Client
                </Button>
            </div>



            {/* Clients Grid */}
            {clients.filter(c => !c.archived && !isDeleted(c)).length === 0 && clients.filter(c => c.archived && !isDeleted(c)).length === 0 ? (
                <EmptyState
                    icon={UserGroupIcon}
                    title="No clients"
                    description="Get started by creating a new client."
                    actionLabel="New Client"
                    actionIcon={PlusIcon}
                    onAction={() => openClientModal()}
                />
            ) : (
                <>
                    {/* Active Clients */}
                    {clients.filter(c => !c.archived && !isDeleted(c)).length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {clients.filter(c => !c.archived && !isDeleted(c)).map((client) => (
                                <Card
                                    key={client.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer relative"
                                    onClick={() => onSelectClient(client)}
                                >
                                    <CardContent className="pt-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-medium text-foreground truncate">
                                                {client.title}
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
                                                        onClick={() => editClientModal(client)}
                                                        className="flex items-center space-x-2 hover:bg-yellow-50 hover:text-yellow-600"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleArchiveClient(client.id)}
                                                        className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                                    >
                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                        <span>Archive</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteClient(client.id)}
                                                        className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {client.clientName && (
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                {client.clientName}
                                            </p>
                                        )}

                                        {client.contactPerson && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Contact: {client.contactPerson}
                                            </p>
                                        )}

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Created {toDisplayDate(client.createdAt)}
                                        </p>

                                        {/* Show related projects count */}
                                        {(() => {
                                            const relatedProjectsCount = getRelatedProjects(client.id).length;
                                            return relatedProjectsCount > 0 && (
                                                <div className="mt-3 pt-3 border-t border-border">
                                                    <div className="text-xs text-muted-foreground">
                                                        {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Archived Clients Section */}
                    {clients.filter(c => c.archived && !isDeleted(c)).length > 0 && (
                        <div className="border-t pt-6">
                            <button
                                onClick={() => setShowArchivedClients(!showArchivedClients)}
                                className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4"
                            >
                                {showArchivedClients ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Clients ({clients.filter(c => c.archived && !isDeleted(c)).length})
                            </button>

                            {showArchivedClients && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {clients.filter(c => c.archived && !isDeleted(c)).map((client) => (
                                        <Card
                                            key={client.id}
                                            className="hover:shadow-md transition-shadow cursor-pointer relative"
                                            onClick={() => onSelectClient(client)}
                                        >
                                            <CardContent className="pt-5">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-medium text-foreground truncate">
                                                        {client.title}
                                                    </h3>

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
                                                                onClick={() => handleUnarchiveClient(client.id)}
                                                                className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                                <span>Unarchive</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteClient(client.id)}
                                                                className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                <span>Delete</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>

                                                {client.clientName && (
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        {client.clientName}
                                                    </p>
                                                )}

                                                {client.contactPerson && (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        Contact: {client.contactPerson}
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Created {toDisplayDate(client.createdAt)}
                                                </p>

                                                {/* Show related projects count */}
                                                {(() => {
                                                    const relatedProjectsCount = getRelatedProjects(client.id).length;
                                                    return relatedProjectsCount > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-border">
                                                            <div className="text-xs text-muted-foreground">
                                                                {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
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
                                className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                            >
                                Cancel
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-foreground mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        
                        <p className="text-sm text-foreground mb-6">
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
                                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                            >
                                Archive Client (Recommended)
                            </button>

                            <button
                                onClick={confirmDeleteClient}
                                className="w-full px-4 py-2 border border-yellow-300 dark:border-yellow-700 rounded-md shadow-sm text-sm font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-100 dark:hover:bg-yellow-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                                Delete & Remove Client Reference
                            </button>

                            <button
                                onClick={handleForceDelete}
                                className="w-full px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
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
                                className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                            >
                                Cancel
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-foreground mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        
                        <p className="text-sm text-foreground mb-6">
                            Would you like to archive the related projects as well?
                        </p>

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleArchiveWithProjects}
                                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                            >
                                Archive Client & Projects
                            </button>

                            <button
                                onClick={handleArchiveFromModal}
                                className="w-full px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
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
