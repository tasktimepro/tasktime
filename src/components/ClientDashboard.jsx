import { ArrowLeftIcon, PlusIcon, BanknotesIcon, ClipboardDocumentCheckIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useState, useMemo } from 'react';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency, getPreferredCurrency } from '../utils/currencyUtils';
import { millisecondsToHours, formatDuration } from '../utils/dateUtils';

/**
 * ClientDashboard component - Main dashboard view for a selected client
 */
const ClientDashboard = ({
    client,
    projects,
    setProjects,
    tasks,
    setTasks,
    timeEntries,
    currentTimer,
    isPaused,
    onBackToClients,
    paymentMethods,
    businessInfos,
    clients,
    navigateToProject,
    invoices,
    setInvoices,
    invoiceTemplates,
    setInvoiceTemplates,
    // Modal functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal
}) => {
    // Invoice editing state
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
                    
                    const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
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
                    <button
                        onClick={onBackToClients}
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                        title="Back to Clients"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{client.title}</h1>
                        {client.clientName && (
                            <p className="text-sm text-gray-500">{client.clientName}</p>
                        )}
                        {client.contactPerson && (
                            <p className="text-sm text-gray-500">Contact: {client.contactPerson}</p>
                        )}
                    </div>
                </div>

                {/* Create Invoice Button */}
                <InvoiceGenerator
                    client={client}
                    projects={projects}
                    setProjects={setProjects}
                    tasks={clientTasks}
                    setTasks={setTasks}
                    timeEntries={clientTimeEntries}
                    currentTimer={currentTimer}
                    isPaused={isPaused}
                    editingInvoice={editingInvoice}
                    onInvoiceSaved={() => setEditingInvoice(null)}
                    paymentMethods={paymentMethods}
                    businessInfos={businessInfos}
                    clients={clients}
                    invoices={invoices}
                    setInvoices={setInvoices}
                    invoiceTemplates={invoiceTemplates}
                    setInvoiceTemplates={setInvoiceTemplates}
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
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-600" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Projects</dt>
                                    <dd className="text-lg font-medium text-gray-900">{clientMetrics.projectCount}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                                    <ClockIcon className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Time</dt>
                                    <dd className="text-lg font-medium text-gray-900">{formatDuration(clientMetrics.totalTime)}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                                    <BanknotesIcon className="h-5 w-5 text-green-600" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Paid Revenue</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {getCurrencySymbol(clientCurrency)}{clientMetrics.totalRevenue.toFixed(2)}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-amber-100 rounded-md flex items-center justify-center">
                                    <DocumentTextIcon className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {getCurrencySymbol(clientCurrency)}{clientMetrics.pendingAmount.toFixed(2)}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                                    <CurrencyDollarIcon className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Unbilled</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {getCurrencySymbol(clientCurrency)}{clientMetrics.potentialRevenue.toFixed(2)}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects Section */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">
                            Projects ({clientProjects.length})
                        </h2>
                        <button
                            onClick={handleCreateProject}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-1" />
                            New Project
                        </button>
                    </div>
                </div>
                <div className="p-6">
                    {clientProjects.length === 0 ? (
                        <div className="text-center py-8">
                            <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">No projects for this client yet.</p>
                            <button
                                onClick={handleCreateProject}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Create First Project
                            </button>
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
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative"
                                        onClick={() => navigateToProject(project.id)}
                                    >
                                        <h3 className="font-medium text-gray-900 truncate">{project.title}</h3>
                                        {project.hourlyRate && (
                                            <p className="text-sm text-gray-500 mt-1">
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}
                                                {project.hourlyRate}/{getProjectCurrency(project, clients)} per hour
                                            </p>
                                        )}
                                        <div className="mt-2 text-sm text-gray-600">
                                            <p>{projectTasks.filter(t => !t.completed && !t.archived).length} active tasks</p>
                                            <p>{formatDuration(totalTime)} total time</p>
                                        </div>

                                        {/* Billable Amount Tag or Clock Icon for missing rate */}
                                        {calculateUnbilledAmount(project) > 0 ? (
                                            <div className="absolute bottom-4 right-4">
                                                <button
                                                    onClick={(e) => handleGenerateInvoice(e)}
                                                    className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition-colors"
                                                    title="Click to generate invoice"
                                                >
                                                    {getCurrencySymbol(getProjectCurrency(project, clients))}{calculateUnbilledAmount(project).toFixed(2)}
                                                </button>
                                            </div>
                                        ) : !project.hourlyRate && calculateUnbilledHours(project) > 0 ? (
                                            <div className="absolute bottom-4 right-4">
                                                <button
                                                    onClick={(e) => handleGenerateInvoice(e)}
                                                    className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
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
            </div>

            {/* Invoices Section */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">
                            Invoices ({clientInvoices.length})
                        </h2>
                        
                        {/* Generate Invoice with Client Pre-selected */}
                        <InvoiceGenerator
                            client={client} // Pass client instead of project
                            projects={projects}
                            setProjects={setProjects}
                            tasks={clientTasks}
                            setTasks={setTasks}
                            timeEntries={clientTimeEntries}
                            currentTimer={currentTimer}
                            isPaused={isPaused}
                            editingInvoice={editingInvoice}
                            onInvoiceSaved={() => setEditingInvoice(null)}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            invoices={invoices}
                            setInvoices={setInvoices}
                            invoiceTemplates={invoiceTemplates}
                            setInvoiceTemplates={setInvoiceTemplates}
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

                <div className="p-6">
                    <InvoicesList
                        projectInvoices={clientInvoices}
                        onEditInvoice={handleEditInvoice}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
                        hideNewInvoiceButton={true}
                        setInvoices={setInvoices}
                        invoiceTemplates={invoiceTemplates}
                    />
                </div>
            </div>

            {/* Client Time Metrics */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Time Analytics</h2>
                </div>
                {clientTimeEntries.length > 0 ? (
                    <MetricsDisplay
                        timeEntries={clientTimeEntries}
                        showTitle={false}
                    />
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No time entries for this client yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDashboard;
