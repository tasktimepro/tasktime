import { ArrowLeftIcon, PlusIcon, BanknotesIcon, ClipboardDocumentCheckIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon } from '@/components/ui/icons';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { millisecondsToHours, formatDuration } from '../utils/dateUtils.ts';

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
    // Get client's currency
    const clientCurrency = useMemo(() => {
        return client.defaultCurrency || getPreferredCurrency();
    }, [client.defaultCurrency]);

    // Get projects for this client
    const clientProjects = useMemo(() => {
        return projects.filter(project => project.preferredClientId === client.id);
    }, [projects, client.id]);

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
     * Handle creating a new project for this client
     */
    const handleCreateProject = () => {
        // Open project modal for creating a new project - client will be pre-selected
        openProjectModal(null, { preselectedClientId: client.id });
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
                        <h1 className="text-2xl font-bold text-foreground">{client.title}</h1>
                        {client.clientName && (
                            <p className="text-sm text-muted-foreground">{client.clientName}</p>
                        )}
                        {client.contactPerson && (
                            <p className="text-sm text-muted-foreground">Contact: {client.contactPerson}</p>
                        )}
                    </div>
                </div>

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
                    {clientProjects.length === 0 ? (
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
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {clientProjects.map((project) => {
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
                </CardContent>
            </Card>

            {/* Invoices Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            Invoices ({clientInvoices.length})
                        </CardTitle>
                    </div>
                </CardHeader>

                <CardContent>
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
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No time entries for this client yet.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ClientDashboard;
