import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState, useMemo } from 'react';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils';
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
    onNavigateToPaymentMethods,
    businessInfos,
    onNavigateToBusinessInfo,
    clients,
    onNavigateToClients,
    onNavigateToProjects,
    navigateToProject,
    invoices,
    setInvoices,
    invoiceTemplates,
    setInvoiceTemplates,
    onNavigateToTemplates
}) => {
    // Invoice editing state
    const [editingInvoice, setEditingInvoice] = useState(null);

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

        // Total revenue from invoices
        const totalRevenue = clientInvoices.reduce((total, invoice) => {
            return total + (invoice.total || 0);
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
                    return entry.start > taskLastBilledAt && task.billable !== false;
                });

                const projectUnbilledTime = unbilledEntries.reduce((total, entry) => {
                    return total + (entry.end - entry.start);
                }, 0);

                unbilledTime += projectUnbilledTime;
                potentialRevenue += millisecondsToHours(projectUnbilledTime) * project.hourlyRate;
            }
        });

        return {
            totalTime,
            totalRevenue,
            unbilledTime,
            potentialRevenue,
            projectCount: clientProjects.length,
            invoiceCount: clientInvoices.length
        };
    }, [clientTimeEntries, clientInvoices, clientProjects, clientTasks]);

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
        // Navigate to projects with create form and pre-select this client
        onNavigateToProjects({ create: 'project', preselectedClientId: client.id });
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

                {/* New Project Button */}
                <button
                    onClick={handleCreateProject}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Project
                </button>
            </div>

            {/* Client Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                                    <span className="text-blue-600 font-semibold text-sm">P</span>
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
                                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                                    <span className="text-green-600 font-semibold text-sm">T</span>
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
                                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                                    <span className="text-purple-600 font-semibold text-sm">$</span>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Revenue</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        ${clientMetrics.totalRevenue.toFixed(2)}
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
                                    <span className="text-amber-600 font-semibold text-sm">U</span>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Unbilled</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        ${clientMetrics.potentialRevenue.toFixed(2)}
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
                    <h2 className="text-lg font-medium text-gray-900">
                        Projects ({clientProjects.length})
                    </h2>
                </div>
                <div className="p-6">
                    {clientProjects.length === 0 ? (
                        <div className="text-center py-8">
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
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
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
                            onNavigateToPaymentMethods={onNavigateToPaymentMethods}
                            businessInfos={businessInfos}
                            onNavigateToBusinessInfo={onNavigateToBusinessInfo}
                            clients={clients}
                            onNavigateToClients={onNavigateToClients}
                            invoices={invoices}
                            setInvoices={setInvoices}
                            invoiceTemplates={invoiceTemplates}
                            setInvoiceTemplates={setInvoiceTemplates}
                            onNavigateToTemplates={onNavigateToTemplates}
                        />
                    </div>
                </div>

                <div className="p-6">
                    <div className="scrollable-container">
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
            </div>

            {/* Client Time Metrics */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Time Analytics</h2>
                </div>
                <div className="p-6">
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
        </div>
    );
};

export default ClientDashboard;
