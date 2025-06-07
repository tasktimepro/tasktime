import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import TaskTree from './TaskTree';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol } from '../utils/currencyUtils';
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
    onNavigateToPaymentMethods,
    businessInfos,
    onNavigateToBusinessInfo,
    clientInfos,
    onNavigateToClientInfo,
    onNavigateToProjects,
    invoices,
    setInvoices,
    invoiceTemplates,
    setInvoiceTemplates,
    onNavigateToTemplates
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBackToProjects}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>

                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>

                        {project.hourlyRate && (
                            <p className="text-sm text-gray-500">
                                {`${getCurrencySymbol(project.currency)}${project.hourlyRate}/${project.currency} per hour`}
                            </p>
                        )}
                    </div>
                </div>

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
                    onNavigateToPaymentMethods={onNavigateToPaymentMethods}
                    businessInfos={businessInfos}
                    onNavigateToBusinessInfo={onNavigateToBusinessInfo}
                    clientInfos={clientInfos}
                    onNavigateToClientInfo={onNavigateToClientInfo}
                    onNavigateToProjects={onNavigateToProjects}
                    invoices={invoices}
                    setInvoices={setInvoices}
                    invoiceTemplates={invoiceTemplates}
                    setInvoiceTemplates={setInvoiceTemplates}
                    onNavigateToTemplates={onNavigateToTemplates}
                />
            </div>

            {/* Task Tree */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">
                        Tasks ({visibleTasksCount})
                    </h2>
                </div>

                <div className="p-6">
                    <div className="scrollable-container-fixed">
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
                        />
                    </div>
                </div>
            </div>

            {/* Invoices Section */}
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
                            onNavigateToPaymentMethods={onNavigateToPaymentMethods}
                            businessInfos={businessInfos}
                            onNavigateToBusinessInfo={onNavigateToBusinessInfo}
                            clientInfos={clientInfos}
                            onNavigateToClientInfo={onNavigateToClientInfo}
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
                            projectInvoices={projectInvoices}
                            onEditInvoice={handleEditInvoice}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clientInfos={clientInfos}
                            hideNewInvoiceButton={true}
                            setInvoices={setInvoices}
                            invoiceTemplates={invoiceTemplates}
                        />
                    </div>
                </div>
            </div>

            {/* Metrics Display */}
            <MetricsDisplay
                project={project}
                timeEntries={projectTimeEntries}
            />
        </div>
    );
};

export default ProjectDashboard;
