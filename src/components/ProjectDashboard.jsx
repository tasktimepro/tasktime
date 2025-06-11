import { ArrowLeftIcon, DocumentCheckIcon, ClockIcon, BanknotesIcon, DocumentTextIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { useState, useMemo } from 'react';
import TaskTree from './TaskTree';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';

/**
 * ProjectDashboard component - Main dashboard view for a selected project
 */
const ProjectDashboard = ({
    project,
    projects,
    setProjects,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused,
    setIsPaused,
    pausedElapsedTime,
    setPausedElapsedTime,
    onBackToProjects,
    paymentMethods,
    businessInfos,
    clients,
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
    const { showError } = useToast();
    
    // Get invoices for this project
    const projectInvoices = invoices.filter(invoice => 
        (project.invoiceIds || []).includes(invoice.id)
    );
    
    /**
     * Handle editing an existing invoice
     */
    const handleEditInvoice = (invoice) => {
        // Check if a timer is currently active (running, not paused)
        if (currentTimer && !isPaused) {
            showError('Cannot update an invoice while a timer is active. Please pause the timer first.');
            return;
        }
        
        setEditingInvoice(invoice);
    };
    
    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get time entries for this project's tasks
    const projectTaskIds = projectTasks.map(task => task.id);

    const projectTimeEntries = timeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId)
    );

    // Count visible tasks (not completed and not archived, including both parent tasks and subtasks)
    const visibleTasksCount = projectTasks.filter(task => 
        !task.completed && !task.archived
    ).length;

    // Calculate project metrics
    const projectMetrics = useMemo(() => {
        // Total time worked on this project
        const totalTime = projectTimeEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        // Total revenue from paid invoices only
        const totalRevenue = projectInvoices.reduce((total, invoice) => {
            // Only include invoices that have been marked as paid
            if (invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
            }
            return total;
        }, 0);

        // Calculate pending amount from unpaid invoices
        const pendingAmount = projectInvoices.reduce((total, invoice) => {
            // Only include invoices that have NOT been marked as paid
            if (!invoice.paymentProcessed) {
                return total + (invoice.totalAmount || invoice.total || 0);
            }
            return total;
        }, 0);

        // Calculate unbilled potential revenue
        let potentialRevenue = 0;

        if (project.hourlyRate && !project.flatRate) {
            // Get explicitly billable tasks (tasks with billable === true)
            const billableTasks = projectTasks.filter(task => task.billable === true);
            const billableTaskIds = billableTasks.map(task => task.id);
            
            // Get time entries for billable tasks that haven't been billed yet
            const unbilledEntries = projectTimeEntries.filter(entry => {
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

            potentialRevenue = unbilledHours * project.hourlyRate;
        }

        return {
            totalTime,
            totalRevenue,
            pendingAmount,
            potentialRevenue,
            activeTaskCount: visibleTasksCount
        };
    }, [projectTimeEntries, projectInvoices, project, projectTasks, visibleTasksCount]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBackToProjects}
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                        title="Back to Projects"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>

                        {project.hourlyRate && (
                            <p className="text-sm text-gray-500">
                                {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Invoice Generator - Only show for non-personal projects */}
                {!project.isPersonal && (
                    <InvoiceGenerator
                        project={project}
                        projects={projects}
                        setProjects={setProjects}
                        tasks={projectTasks}
                        setTasks={setTasks}
                        timeEntries={projectTimeEntries}
                        currentTimer={currentTimer}
                        isPaused={isPaused}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
                        invoices={invoices}
                        setInvoices={setInvoices}
                        invoiceTemplates={invoiceTemplates}
                        setInvoiceTemplates={setInvoiceTemplates}
                        // Modal functions
                        openClientModal={openClientModal}
                        openProjectModal={openProjectModal}
                        openBusinessModal={openBusinessModal}
                        openPaymentMethodModal={openPaymentMethodModal}
                        openTemplateModal={openTemplateModal}
                    />
                )}
            </div>

            {/* Project Metrics - Only show for non-personal projects */}
            {!project.isPersonal && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                                        <DocumentCheckIcon className="h-5 w-5 text-gray-600" />
                                    </div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Tasks</dt>
                                        <dd className="text-lg font-medium text-gray-900">{projectMetrics.activeTaskCount}</dd>
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
                                        <dd className="text-lg font-medium text-gray-900">{formatDuration(projectMetrics.totalTime)}</dd>
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
                                            {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.totalRevenue.toFixed(2)}
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
                                            {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.pendingAmount.toFixed(2)}
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
                                            {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.potentialRevenue.toFixed(2)}
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Tree */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">
                        Tasks ({visibleTasksCount})
                    </h2>
                </div>

                <div className="p-6">
                    <TaskTree
                        project={project}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        isGlobalTimer={true}
                    />
                </div>
            </div>

            {/* Invoices Section - Only show for non-personal projects */}
            {!project.isPersonal && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium text-gray-900">
                                Invoices ({projectInvoices.length})
                            </h2>
                            
                            <InvoiceGenerator
                                project={project}
                                projects={projects}
                                setProjects={setProjects}
                                tasks={projectTasks}
                                setTasks={setTasks}
                                timeEntries={projectTimeEntries}
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
                            projectInvoices={projectInvoices}
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
            )}

            {/* Metrics Display */}
            <MetricsDisplay
                project={project}
                timeEntries={projectTimeEntries}
                clients={clients}
            />
        </div>
    );
};

export default ProjectDashboard;
