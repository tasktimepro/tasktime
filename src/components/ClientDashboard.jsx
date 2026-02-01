import { ArrowLeftIcon, PlusIcon, BanknotesIcon, ClipboardDocumentCheckIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, ArchiveBoxIcon, TrashIcon } from '@/components/ui/icons';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { millisecondsToHours, formatDuration, toStorageDate } from '../utils/dateUtils.ts';
import { useClients } from '../hooks/useClients.ts';
import { useToast } from '../hooks/useToast.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import ClientDeleteDialog from './modals/ClientDeleteDialog';
import ClientArchiveDialog from './modals/ClientArchiveDialog';

/**
 * ClientDashboard component - Main dashboard view for a selected client
 */
const ClientDashboard = ({
    client,
    projects,
    tasks,
    timeEntries,
    onBackToClients,
    paymentMethods,
    businessInfos,
    clients,
    invoices,
    invoiceTemplates,
    navigateToProject,
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal
}) => {
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [isInvoicesExpanded, setIsInvoicesExpanded] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showArchivedProjects, setShowArchivedProjects] = useState(false);
    const { updateClient, deleteClient } = useClients();
    const { deleteProject, updateProject } = useProjects();
    const { deleteTask } = useTasks();
    const { deleteEntry } = useTimeEntries();
    const { deleteInvoice } = useInvoices();
    const { showSuccess } = useToast();
    // Get client's currency
    const clientCurrency = useMemo(() => {
        return client.defaultCurrency || getPreferredCurrency();
    }, [client.defaultCurrency]);

    // Get projects for this client
    const clientProjects = useMemo(() => {
        return projects.filter(project => project.preferredClientId === client.id);
    }, [projects, client.id]);

    const activeClientProjects = useMemo(() => {
        return clientProjects.filter(project => !project.archived);
    }, [clientProjects]);

    const archivedClientProjects = useMemo(() => {
        return clientProjects.filter(project => project.archived);
    }, [clientProjects]);

    // Get tasks for client projects
    const clientTasks = useMemo(() => {
        const projectIds = clientProjects.map(p => p.id);
        return tasks.filter(task => projectIds.includes(task.projectId));
    }, [tasks, clientProjects]);

    // Get time entries for client tasks
    const clientTimeEntries = useMemo(() => {
        const taskIds = clientTasks.map(t => t.id);
        return timeEntries.filter(entry => taskIds.includes(entry.taskId));
    }, [timeEntries, clientTasks]);

    // Get invoices for this client (either project-specific or client-specific)
    const clientInvoices = useMemo(() => {
        const projectIds = clientProjects.map(p => p.id);
        return invoices.filter(invoice => 
            projectIds.includes(invoice.projectId) || invoice.clientId === client.id
        );
    }, [invoices, clientProjects, client.id]);

    // Calculate client metrics
    const clientMetrics = useMemo(() => {
        // Total time worked
        const totalTime = clientTimeEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);
    
        // Total revenue from paid invoices only
        const totalRevenue = clientInvoices.reduce((total, invoice) => {
            // Only include invoices that have been marked as paid
            if (invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
            }
            return total;
        }, 0);

        // Unbilled time and potential revenue
        let unbilledTime = 0;
        let potentialRevenue = 0;

        clientProjects.forEach(project => {
            if (project.hourlyRate && !project.flatRate) {
                const projectTaskIds = clientTasks
                    .filter(task => task.projectId === project.id)
                    .map(task => task.id);

                const unbilledEntries = clientTimeEntries.filter(entry => {
                    const task = clientTasks.find(t => t.id === entry.taskId);
                    if (!task || !projectTaskIds.includes(entry.taskId)) return false;
                    
                    // Use task.lastBilledAt only - if never billed, all entries are pending
                    const taskLastBilledAt = task.lastBilledAt || 0;
                    return entry.start > taskLastBilledAt && task.billable === true;
                });

                // Group unbilled entries by task and calculate with proper rounding
                const taskTimeMap = {};
                unbilledEntries.forEach(entry => {
                    if (!taskTimeMap[entry.taskId]) {
                        taskTimeMap[entry.taskId] = 0;
                    }
                    taskTimeMap[entry.taskId] += (entry.end - entry.start);
                });

                // Calculate total rounded hours and revenue (matching invoice calculation)
                const projectUnbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
                    const taskHours = millisecondsToHours(taskTime);
                    const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
                    return total + roundedTaskHours;
                }, 0);

                const projectUnbilledTime = projectUnbilledHours * 60 * 60 * 1000; // Convert back to milliseconds for consistency
                unbilledTime += projectUnbilledTime;
                potentialRevenue += projectUnbilledHours * project.hourlyRate;
            }
        });

        // Calculate pending amount from unpaid invoices
        const pendingAmount = clientInvoices.reduce((total, invoice) => {
            // Only include invoices that have NOT been marked as paid
            if (!invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
            }
            return total;
        }, 0);

        return {
            totalTime,
            totalRevenue,
            unbilledTime,
            potentialRevenue,
            pendingAmount,
            projectCount: clientProjects.length,
            invoiceCount: clientInvoices.length
        };
    }, [clientTimeEntries, clientInvoices, clientProjects, clientTasks]);

    /**
     * Calculate unbilled amount for a project (requires hourly rate)
     */
    const calculateUnbilledAmount = (project) => {
        // If it's a flat rate project or no hourly rate is set, return 0 for the amount
        if (project.flatRate || !project.hourlyRate) return 0;
        
        // Get tasks for this project
        const projectTasks = clientTasks.filter(task => task.projectId === project.id);
        
        // Get explicitly billable tasks (tasks with billable === true)
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);
        
        // Get time entries for this project's tasks with task-level billing filtering
        const unbilledEntries = clientTimeEntries.filter(entry => {
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

        return unbilledHours * project.hourlyRate;
    };

    /**
     * Calculate unbilled hours for a project (without rate requirement)
     */
    const calculateUnbilledHours = (project) => {
        // Get tasks for this project
        const projectTasks = clientTasks.filter(task => task.projectId === project.id);
        
        // Get explicitly billable tasks (tasks with billable === true)
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);
        
        // Get time entries for this project's tasks with task-level billing filtering
        const unbilledEntries = clientTimeEntries.filter(entry => {
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

        return unbilledHours;
    };

    /**
     * Handle generating invoice for a project
     */
    const handleGenerateInvoice = (e) => {
        e.stopPropagation();
        // Open project modal for invoice generation
        openProjectModal();
    };

    /**
     * Handle editing an invoice
     */
    const handleEditInvoice = (invoice) => {
        setEditingInvoice(invoice);
    };

    /**
     * Toggle invoices section visibility
     */
    const toggleInvoicesExpanded = () => {
        setIsInvoicesExpanded((prev) => !prev);
    };

    /**
     * Handle creating a new project for this client
     */
    const handleCreateProject = () => {
        // Open project modal for creating a new project - client will be pre-selected
        openProjectModal(null, { preselectedClientId: client.id });
    };

    const performClientDeletion = useCallback((clientId, alsoDeleteProjects) => {
        const related = projects.filter(project => project.preferredClientId === clientId);

        if (alsoDeleteProjects) {
            const relatedProjectIds = related.map(p => p.id);

            relatedProjectIds.forEach(id => deleteProject(id));

            const relatedTaskIds = tasks
                .filter(task => relatedProjectIds.includes(task.projectId))
                .map(t => t.id);
            relatedTaskIds.forEach(id => deleteTask(id));

            const relatedTimeEntryIds = timeEntries
                .filter(entry => relatedTaskIds.includes(entry.taskId))
                .map(e => e.id);
            relatedTimeEntryIds.forEach(id => deleteEntry(id));

            const relatedInvoiceIds = invoices
                .filter(invoice => relatedProjectIds.includes(invoice.projectId))
                .map(i => i.id);
            relatedInvoiceIds.forEach(id => deleteInvoice(id));
        } else {
            projects
                .filter(project => project.preferredClientId === clientId)
                .forEach(project => updateProject(project.id, {
                    preferredClientId: null,
                    hourlyRate: null,
                    flatRate: false,
                    isPersonal: true
                }));
        }

        deleteClient(clientId);

        const message = alsoDeleteProjects
            ? `Client and ${related.length} related project(s) deleted successfully.`
            : 'Client deleted successfully.';
        showSuccess(message);
    }, [projects, tasks, timeEntries, invoices, deleteProject, deleteTask, deleteEntry, deleteInvoice, updateProject, deleteClient, showSuccess]);

    const handleEditClient = () => {
        openClientModal?.(client);
    };

    const handleArchiveClient = () => {
        setShowArchiveModal(true);
    };

    const handleUnarchiveClient = () => {
        updateClient(client.id, { archived: false, archivedOnDate: null });
        showSuccess('Client unarchived');
    };

    const handleDeleteClient = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        performClientDeletion(client.id, false);
        setShowDeleteModal(false);
        onBackToClients();
    };

    const handleForceDelete = () => {
        performClientDeletion(client.id, true);
        setShowDeleteModal(false);
        onBackToClients();
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
    };

    const handleCloseArchiveModal = () => {
        setShowArchiveModal(false);
    };

    const handleArchiveOnly = () => {
        const archivedOnDate = toStorageDate(new Date());
        updateClient(client.id, { archived: true, archivedOnDate });
        showSuccess('Client archived');
        setShowArchiveModal(false);
    };

    const handleArchiveWithProjects = () => {
        const archivedOnDate = toStorageDate(new Date());
        const relatedProjectIds = clientProjects.map(project => project.id);
        relatedProjectIds.forEach(id => updateProject(id, { archived: true, archivedOnDate }));
        updateClient(client.id, { archived: true, archivedOnDate });
        showSuccess(`Client and ${clientProjects.length} related project(s) archived successfully.`);
        setShowArchiveModal(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onBackToClients}
                        className="text-muted-foreground hover:text-foreground"
                        title="Back to Clients"
                        aria-label="Back to Clients"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Button>

                    <div>
                        <div className="flex items-center flex-wrap gap-2">
                            <h1 className="text-2xl font-bold text-foreground">{client.title}</h1>
                            {client.archived && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Archived
                                </span>
                            )}
                        </div>
                        {client.clientName && (
                            <p className="text-sm text-muted-foreground">{client.clientName}</p>
                        )}
                        {client.contactPerson && (
                            <p className="text-sm text-muted-foreground">Contact: {client.contactPerson}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
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
                                onClick={handleEditClient}
                                className="flex items-center space-x-2 hover:bg-yellow-50 hover:text-yellow-600"
                            >
                                <PencilIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </DropdownMenuItem>
                            {client.archived ? (
                                <DropdownMenuItem
                                    onClick={handleUnarchiveClient}
                                    className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Unarchive</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={handleArchiveClient}
                                    className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Archive</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDeleteClient}
                                className="flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
                            >
                                <TrashIcon className="h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Create Invoice Button */}
                    <InvoiceGenerator
                        client={client}
                        timeEntries={clientTimeEntries}
                        editingInvoice={editingInvoice}
                        onInvoiceSaved={() => setEditingInvoice(null)}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
                        showButton={true}
                        // Modal functions
                        openClientModal={openClientModal}
                        openProjectModal={openProjectModal}
                        openBusinessModal={openBusinessModal}
                        openPaymentMethodModal={openPaymentMethodModal}
                        openTemplateModal={openTemplateModal}
                    />
                </div>
            </div>

            <ClientDeleteDialog
                isOpen={showDeleteModal}
                onClose={handleCloseDeleteModal}
                client={client}
                relatedProjects={clientProjects}
                onArchiveRecommended={() => {
                    handleArchiveOnly();
                    handleCloseDeleteModal();
                }}
                onDeleteOnly={handleConfirmDelete}
                onDeleteAll={handleForceDelete}
            />

            <ClientArchiveDialog
                isOpen={showArchiveModal}
                onClose={handleCloseArchiveModal}
                client={client}
                relatedProjects={clientProjects}
                onArchiveWithProjects={handleArchiveWithProjects}
                onArchiveOnly={handleArchiveOnly}
            />

            {/* Client Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card>
                    <CardContent className="pt-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <ClipboardDocumentCheckIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="ml-4 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Projects</dt>
                                    <dd className="text-lg font-semibold text-foreground">{clientMetrics.projectCount}</dd>
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
                                    <dd className="text-lg font-semibold text-foreground">{formatDuration(clientMetrics.totalTime)}</dd>
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
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.totalRevenue.toFixed(2)}
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
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.pendingAmount.toFixed(2)}
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
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.potentialRevenue.toFixed(2)}
                                        </span>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Projects Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            Projects ({clientProjects.length})
                        </CardTitle>
                        <Button
                            onClick={handleCreateProject}
                            variant="outline"
                            leadingIcon={PlusIcon}
                        >
                            New Project
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {activeClientProjects.length === 0 && archivedClientProjects.length === 0 ? (
                        <div className="text-center py-8">
                            <ClipboardDocumentCheckIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">No projects for this client yet.</p>
                            <Button
                                onClick={handleCreateProject}
                                leadingIcon={PlusIcon}
                            >
                                Create First Project
                            </Button>
                        </div>
                    ) : (
                        <>
                            {activeClientProjects.length > 0 && (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {activeClientProjects.map((project) => {
                                        const projectTasks = clientTasks.filter(task => task.projectId === project.id);
                                        const projectTimeEntries = clientTimeEntries.filter(entry => 
                                            projectTasks.some(task => task.id === entry.taskId)
                                        );
                                        const totalTime = projectTimeEntries.reduce((total, entry) => 
                                            total + (entry.end - entry.start), 0
                                        );

                                        return (
                                            <div
                                                key={project.id}
                                                className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative"
                                                onClick={() => navigateToProject(project.id)}
                                            >
                                                <h3 className="font-medium text-foreground truncate">{project.title}</h3>
                                                {project.hourlyRate && (
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        <span className="sensitive-data">
                                                            {getCurrencySymbol(getProjectCurrency(project, clients))}
                                                            {project.hourlyRate}/{getProjectCurrency(project, clients)} per hour
                                                        </span>
                                                    </p>
                                                )}
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    <p>{projectTasks.filter(t => !t.completed && !t.archived).length} active tasks</p>
                                                    <p>{formatDuration(totalTime)} total time</p>
                                                </div>

                                                {/* Billable Amount Tag or Clock Icon for missing rate */}
                                                {calculateUnbilledAmount(project) > 0 ? (
                                                    <div className="absolute bottom-4 right-4">
                                                        <button
                                                            onClick={(e) => handleGenerateInvoice(e)}
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
                                                            onClick={(e) => handleGenerateInvoice(e)}
                                                            className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full hover:bg-primary/90 transition-colors"
                                                            title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                                        >
                                                            <ClockIcon className="h-3 w-3 mr-1" />
                                                            {calculateUnbilledHours(project).toFixed(2)}h
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {archivedClientProjects.length > 0 && (
                                <div className={`${activeClientProjects.length > 0 ? 'mt-6' : ''} border-t border-border pt-6`}>
                                    <button
                                        type="button"
                                        onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                                        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
                                    >
                                        {showArchivedProjects ? (
                                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                                        ) : (
                                            <ChevronRightIcon className="h-4 w-4 mr-1" />
                                        )}
                                        Archived Projects ({archivedClientProjects.length})
                                    </button>

                                    {showArchivedProjects && (
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {archivedClientProjects.map((project) => {
                                                const projectTasks = clientTasks.filter(task => task.projectId === project.id);
                                                const projectTimeEntries = clientTimeEntries.filter(entry => 
                                                    projectTasks.some(task => task.id === entry.taskId)
                                                );
                                                const totalTime = projectTimeEntries.reduce((total, entry) => 
                                                    total + (entry.end - entry.start), 0
                                                );

                                                return (
                                                    <div
                                                        key={project.id}
                                                        className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative"
                                                        onClick={() => navigateToProject(project.id)}
                                                    >
                                                        <div className="flex items-center min-w-0">
                                                            <h3 className="font-medium text-foreground truncate">{project.title}</h3>
                                                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                                                Archived
                                                            </span>
                                                        </div>
                                                        {project.hourlyRate && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                <span className="sensitive-data">
                                                                    {getCurrencySymbol(getProjectCurrency(project, clients))}
                                                                    {project.hourlyRate}/{getProjectCurrency(project, clients)} per hour
                                                                </span>
                                                            </p>
                                                        )}
                                                        <div className="mt-2 text-sm text-muted-foreground">
                                                            <p>{projectTasks.filter(t => !t.completed && !t.archived).length} active tasks</p>
                                                            <p>{formatDuration(totalTime)} total time</p>
                                                        </div>

                                                        {/* Billable Amount Tag or Clock Icon for missing rate */}
                                                        {calculateUnbilledAmount(project) > 0 ? (
                                                            <div className="absolute bottom-4 right-4">
                                                                <button
                                                                    onClick={(e) => handleGenerateInvoice(e)}
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
                                                                    onClick={(e) => handleGenerateInvoice(e)}
                                                                    className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full hover:bg-primary/90 transition-colors"
                                                                    title={`${calculateUnbilledHours(project).toFixed(2)} unbilled hours - Click to set rate and generate invoice`}
                                                                >
                                                                    <ClockIcon className="h-3 w-3 mr-1" />
                                                                    {calculateUnbilledHours(project).toFixed(2)}h
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Invoices Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={toggleInvoicesExpanded}
                            aria-expanded={isInvoicesExpanded}
                            aria-controls="client-invoices-list"
                            className="flex items-center gap-2 rounded-md text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <CardTitle className="text-lg">
                                Invoices ({clientInvoices.length})
                            </CardTitle>
                            <ChevronDownIcon
                                className={`h-4 w-4 text-muted-foreground transition-transform cursor-pointer ${isInvoicesExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </div>
                </CardHeader>

                {isInvoicesExpanded && (
                    <CardContent id="client-invoices-list">
                        <InvoicesList
                            projectInvoices={clientInvoices}
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

            {/* Client Time Metrics */}
            {clientTimeEntries.length > 0 ? (
                <MetricsDisplay
                    title="Time Analytics"
                    timeEntries={clientTimeEntries}
                />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Time Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EmptyState
                            icon={ClockIcon}
                            description="No time entries for this client yet."
                            className="py-8"
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ClientDashboard;
