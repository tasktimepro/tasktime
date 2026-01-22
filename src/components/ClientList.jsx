import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusIcon, PencilIcon, TrashIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, UserGroupIcon, SortIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { useClients } from '../hooks/useClients.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';

/**
 * ClientList component - Displays and manages the list of clients
 */
const ClientList = ({ 
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
    
    // Yjs hooks for data access
    const { clients, updateClient, deleteClient } = useClients();
    const { projects, updateProject, deleteProject } = useProjects();
    const { tasks, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { invoices, deleteInvoice } = useInvoices();
    const { preferences, updatePreferences } = usePreferences();

    const clientSort = preferences.clientSort || 'createdAt';

    const handleSortChange = (value) => {

        updatePreferences({ clientSort: value });
    };

    const activeClients = useMemo(() => {

        return clients.filter(client => !client.archived);
    }, [clients]);

    const archivedClients = useMemo(() => {

        return clients.filter(client => client.archived);
    }, [clients]);

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

    const clientLastActiveMap = useMemo(() => {

        const map = new Map();
        projects.forEach(project => {
            const clientId = project.preferredClientId;
            if (!clientId) return;

            const projectLastActive = projectLastActiveMap.get(project.id) || 0;
            const current = map.get(clientId) || 0;
            if (projectLastActive > current) {
                map.set(clientId, projectLastActive);
            }
        });
        return map;
    }, [projects, projectLastActiveMap]);

    const sortedActiveClients = useMemo(() => {

        return sortItems({
            items: activeClients,
            sortBy: clientSort,
            getName: (client) => client.title || client.name || '',
            getCreatedAt: (client) => client.createdAt,
            getLastActive: (client) => clientLastActiveMap.get(client.id),
        });
    }, [activeClients, clientSort, clientLastActiveMap]);

    const sortedArchivedClients = useMemo(() => {

        return sortItems({
            items: archivedClients,
            sortBy: clientSort,
            getName: (client) => client.title || client.name || '',
            getCreatedAt: (client) => client.createdAt,
            getLastActive: (client) => clientLastActiveMap.get(client.id),
        });
    }, [archivedClients, clientSort, clientLastActiveMap]);

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
        const clientRelatedProjects = getRelatedProjects(clientId);
        
        if (alsoDeleteProjects) {
            // Get related projects and their task/time entry IDs
            const relatedProjectIds = clientRelatedProjects.map(p => p.id);
            
            // Delete related projects
            relatedProjectIds.forEach(id => deleteProject(id));
            
            // Delete tasks for related projects
            const relatedTaskIds = tasks
                .filter(task => relatedProjectIds.includes(task.projectId))
                .map(t => t.id);
            relatedTaskIds.forEach(id => deleteTask(id));
            
            // Delete time entries for related tasks
            const relatedTimeEntryIds = timeEntries
                .filter(entry => relatedTaskIds.includes(entry.taskId))
                .map(e => e.id);
            relatedTimeEntryIds.forEach(id => deleteEntry(id));
            
            // Delete invoices for related projects
            const relatedInvoiceIds = invoices
                .filter(invoice => relatedProjectIds.includes(invoice.projectId))
                .map(i => i.id);
            relatedInvoiceIds.forEach(id => deleteInvoice(id));
        } else {
            // Remove client reference from projects (update, not delete)
            projects
                .filter(project => project.preferredClientId === clientId)
                .forEach(project => updateProject(project.id, { preferredClientId: null }));
        }

        // Delete the client
        deleteClient(clientId);

        // Show appropriate success message
        const message = alsoDeleteProjects 
            ? `Client and ${clientRelatedProjects.length} related project(s) deleted successfully.`
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
            relatedProjectIds.forEach(id => updateProject(id, { archived: true }));
        }

        // Archive the client
        updateClient(clientId, { archived: true });

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
        updateClient(clientId, { archived: false });
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
                    Clients {activeClients.length > 0 && (
                        <span>
                            ({activeClients.length})
                        </span>
                    )}
                </h2>

                <div className="flex items-center space-x-3">
                    <Select value={clientSort} onValueChange={handleSortChange}>
                        <SelectTrigger className="w-[152px]" aria-label="Sort clients" leadingIcon={SortIcon}>
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button onClick={() => openClientModal()} leadingIcon={PlusIcon}>
                        New Client
                    </Button>
                </div>
            </div>



            {/* Clients Grid */}
            {activeClients.length === 0 && archivedClients.length === 0 ? (
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
                    {sortedActiveClients.length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {sortedActiveClients.map((client) => (
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
                    {clients.filter(c => c.archived).length > 0 && (
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
                                Archived Clients ({archivedClients.length})
                            </button>

                            {showArchivedClients && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {sortedArchivedClients.map((client) => (
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
    onSelectClient: PropTypes.func.isRequired,
    openClientModal: PropTypes.func.isRequired,
    editClientModal: PropTypes.func.isRequired
};

export default ClientList;
