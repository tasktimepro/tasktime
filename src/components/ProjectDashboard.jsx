import { ArrowLeftIcon, DocumentCheckIcon, ClockIcon, BanknotesIcon, DocumentTextIcon, CurrencyDollarIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskTree from './TaskTree';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { getCurrencySymbol, getProjectCurrency } from '../utils/currencyUtils.ts';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimer } from '../hooks/useTimer.ts';

/**
 * ProjectDashboard component - Main dashboard view for a selected project
 */
const ProjectDashboard = ({
    project,
    tasks,
    timeEntries,
    onBackToProjects,
    paymentMethods,
    businessInfos,
    clients,
    invoices,
    invoiceTemplates,
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
    const { isActive: isTimerActive, isPaused } = useTimer();
    
    // Get invoices for this project
    const projectInvoices = invoices.filter(invoice => 
        (project.invoiceIds || []).includes(invoice.id)
    );
    
    /**
     * Handle editing an existing invoice
     */
    const handleEditInvoice = (invoice) => {
        // Check if a timer is currently active (running, not paused)
        if (isTimerActive && !isPaused) {
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
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onBackToProjects}
                        className="text-muted-foreground hover:text-foreground"
                        title="Back to Projects"
                        aria-label="Back to Projects"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Button>

                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>

                        {project.hourlyRate && (
                            <p className="text-sm text-muted-foreground">
                                <span className="sensitive-data">
                                    {`${getCurrencySymbol(getProjectCurrency(project, clients))}${project.hourlyRate}/${getProjectCurrency(project, clients)} per hour`}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Invoice Generator - Only show for non-personal projects */}
                {!project.isPersonal && (
                    <InvoiceGenerator
                        project={project}
                        timeEntries={projectTimeEntries}
                        paymentMethods={paymentMethods}
                        businessInfos={businessInfos}
                        clients={clients}
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
                    <Card>
                        <CardContent className="pt-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <DocumentCheckIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Tasks</dt>
                                        <dd className="text-lg font-semibold text-foreground">{projectMetrics.activeTaskCount}</dd>
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
                                        <dd className="text-lg font-semibold text-foreground">{formatDuration(projectMetrics.totalTime)}</dd>
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
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.totalRevenue.toFixed(2)}
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
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.pendingAmount.toFixed(2)}
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
                                                {getCurrencySymbol(getProjectCurrency(project, clients))}{projectMetrics.potentialRevenue.toFixed(2)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Task Tree */}
            <Card>
                <CardContent className="pt-6">
                    <TaskTree
                        project={project}
                    />
                </CardContent>
            </Card>

            {/* Invoices Section - Only show for non-personal projects */}
            {!project.isPersonal && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                                Invoices ({projectInvoices.length})
                            </CardTitle>
                            
                            <InvoiceGenerator
                                project={project}
                                timeEntries={projectTimeEntries}
                                editingInvoice={editingInvoice}
                                onInvoiceSaved={() => setEditingInvoice(null)}
                                paymentMethods={paymentMethods}
                                businessInfos={businessInfos}
                                clients={clients}
                                // Modal functions
                                openClientModal={openClientModal}
                                openProjectModal={openProjectModal}
                                openBusinessModal={openBusinessModal}
                                openPaymentMethodModal={openPaymentMethodModal}
                                openTemplateModal={openTemplateModal}
                            />
                        </div>
                    </CardHeader>

                    <CardContent>
                        <InvoicesList
                            projectInvoices={projectInvoices}
                            onEditInvoice={handleEditInvoice}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            hideNewInvoiceButton={true}
                            invoiceTemplates={invoiceTemplates}
                        />
                    </CardContent>
                </Card>
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
