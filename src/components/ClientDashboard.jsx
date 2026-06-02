import { ArrowLeftIcon, PlusIcon, BanknotesIcon, ClipboardDocumentCheckIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, ArchiveBoxIcon, TrashIcon, HandCoinsIcon, CheckIcon } from '@/components/ui/icons';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import MetricsDisplay from './MetricsDisplay';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import { fetchExchangeRates, formatCurrency, getCurrencySymbol, getProjectCurrency, getPreferredCurrency, normalizeCurrencyCode } from '../utils/currencyUtils.ts';
import { millisecondsToHours, formatDuration, toDisplayDate, toStorageDate } from '../utils/dateUtils.ts';
import { useClients } from '../hooks/useClients.ts';
import { useToast } from '../hooks/useToast.ts';
import { getInvoiceTotal, getPaidInvoiceConvertedAmount, invoiceBelongsToProject, isInvoicePaid } from '../utils/invoiceUtils.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../hooks/useExpenseRecurrences.ts';
import { usePreferences } from '../hooks/usePreferences.ts';
import { getBillableDurationMs } from '../utils/timeEntryDurationUtils.ts';
import { getProjectDeadlineStatus, isProjectInQuoteMode } from '../utils/projectPlanningUtils.ts';
import { getProjectInvoicePreview } from '../utils/invoicePreviewUtils.ts';
import ExpensesSection from './expenses/ExpensesSection';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import ClientDeleteDialog from './modals/ClientDeleteDialog';
import ClientArchiveDialog from './modals/ClientArchiveDialog';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

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
    activeModal,
    navigateToProject,
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    openExpenseModal,
    openExpenseView
}) => {
    const isMobileLayout = useIsMobileLayout();
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [isInvoicesExpanded, setIsInvoicesExpanded] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showArchivedProjects, setShowArchivedProjects] = useState(false);
    const [mobileInvoiceGenerator, setMobileInvoiceGenerator] = useState(null);
    const { updateClient, deleteClient } = useClients();
    const { deleteProject, updateProject } = useProjects();
    const { deleteTask } = useTasks();
    const { deleteEntry } = useTimeEntries();
    const { deleteInvoice } = useInvoices();
    const { expenses, deleteExpense, unbillExpensesForInvoice } = useExpenses({ includeArchived: true });
    const { recurrences, deleteRecurrence } = useExpenseRecurrences();
    const { preferences } = usePreferences();
    const { showSuccess } = useToast();
    const [exchangeRates, setExchangeRates] = useState(null);
    // Get client's currency
    const clientCurrency = useMemo(() => {
        return client.defaultCurrency || getPreferredCurrency();
    }, [client.defaultCurrency]);

    const getProjectColor = (project) => {
        if (project.color) return project.color;
        if (!project.preferredClientId) return null;

        return client?.color || null;
    };

    const getProjectBorderStyle = (project) => {
        const color = getProjectColor(project);
        return color ? { borderLeftColor: color } : {};
    };

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

    const needsExchangeRatesForProjectExpenses = useMemo(() => {
        const projectsById = new Map(clientProjects.map((project) => [project.id, project]));

        return expenses.some((expense) => {
            if (!expense || expense.billable !== true || expense.billingStatus !== 'unbilled' || !expense.projectId) {
                return false;
            }

            const expenseProject = projectsById.get(expense.projectId);
            if (!expenseProject) {
                return false;
            }

            const projectCurrency = normalizeCurrencyCode(getProjectCurrency(expenseProject, clients));
            const expenseCurrency = normalizeCurrencyCode(expense.currency || projectCurrency);

            return expenseCurrency !== projectCurrency;
        });
    }, [clientProjects, clients, expenses]);

    useEffect(() => {
        if (!needsExchangeRatesForProjectExpenses) {
            return;
        }

        let isActive = true;

        const loadExchangeRates = async () => {
            const { rates } = await fetchExchangeRates();

            if (isActive) {
                setExchangeRates(rates);
            }
        };

        loadExchangeRates();

        return () => {
            isActive = false;
        };
    }, [needsExchangeRatesForProjectExpenses]);

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
        return invoices.filter((invoice) =>
            invoice.clientId === client.id
            || projectIds.some((projectId) => invoiceBelongsToProject(invoice, projectId))
        );
    }, [invoices, clientProjects, client.id]);

    const clientExpenses = useMemo(() => {
        return expenses.filter((expense) => expense.clientId === client.id);
    }, [expenses, client.id]);

    const expenseTotalsByCurrency = useMemo(() => {
        return clientExpenses.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || getPreferredCurrency();
            acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
            return acc;
        }, {});
    }, [clientExpenses, preferences.currency]);

    const unbilledExpenseTotalsByCurrency = useMemo(() => {
        return clientExpenses
            .filter((expense) => expense.billable && expense.billingStatus === 'unbilled')
            .reduce((acc, expense) => {
                const currency = expense.currency || preferences.currency || getPreferredCurrency();
                acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
                return acc;
            }, {});
    }, [clientExpenses, preferences.currency]);

    const formatAmounts = (amounts) => {
        const entries = Object.entries(amounts).filter(([, value]) => value > 0);
        if (entries.length === 0) return '—';
        if (entries.length === 1) {
            const [currency, value] = entries[0];
            return formatCurrency(value, currency);
        }
        return entries.map(([currency, value]) => `${formatCurrency(value, currency)} ${currency}`).join(' · ');
    };

    // Calculate client metrics
    const clientMetrics = useMemo(() => {
        // Total revenue from paid invoices only
        const totalRevenue = clientInvoices.reduce((total, invoice) => {
            if (isInvoicePaid(invoice)) {
                const resolvedPaidAmount = getPaidInvoiceConvertedAmount(invoice, clientCurrency);
                return total + (resolvedPaidAmount.success ? resolvedPaidAmount.amount : getInvoiceTotal(invoice));
            }
            return total;
        }, 0);

        // Unbilled time and potential revenue
        let potentialRevenue = 0;

        clientProjects.forEach(project => {
            if (project.hourlyRate && !project.flatRate) {
                const projectTaskIds = clientTasks
                    .filter(task => task.projectId === project.id)
                    .map(task => task.id);

                const unbilledEntries = clientTimeEntries.filter(entry => {
                    const task = clientTasks.find(t => t.id === entry.taskId);
                    if (!task || !projectTaskIds.includes(entry.taskId)) return false;
                    if (entry.source === 'invoice-adjustment') return false;
                    
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
                    taskTimeMap[entry.taskId] += getBillableDurationMs(entry);
                });

                // Calculate total rounded hours and revenue (matching invoice calculation)
                const projectUnbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
                    const taskHours = millisecondsToHours(taskTime);
                    const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
                    return total + roundedTaskHours;
                }, 0);

                potentialRevenue += projectUnbilledHours * project.hourlyRate;
            }
        });

        // Calculate pending amount from unpaid invoices
        const pendingAmount = clientInvoices.reduce((total, invoice) => {
            if (!isInvoicePaid(invoice)) {
                return total + getInvoiceTotal(invoice);
            }
            return total;
        }, 0);

        return {
            totalRevenue,
            potentialRevenue,
            pendingAmount,
            invoiceCount: clientInvoices.length
        };
    }, [clientCurrency, clientTimeEntries, clientInvoices, clientProjects, clientTasks]);

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

    const handleOpenMobileInvoiceGenerator = useCallback(() => {
        setMobileInvoiceGenerator((previous) => ({
            key: (previous?.key || 0) + 1,
        }));
    }, []);

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
                .filter((invoice) => (
                    invoice.clientId === clientId
                    || relatedProjectIds.some((projectId) => invoiceBelongsToProject(invoice, projectId))
                ))
                .map(i => i.id);
            relatedInvoiceIds.forEach(id => unbillExpensesForInvoice(id));
            relatedInvoiceIds.forEach(id => deleteInvoice(id));

            expenses
                .filter(expense => expense.clientId === clientId || relatedProjectIds.includes(expense.projectId))
                .forEach(expense => deleteExpense(expense.id));

            recurrences
                .filter(recurrence => recurrence.clientId === clientId || relatedProjectIds.includes(recurrence.projectId))
                .forEach(recurrence => deleteRecurrence(recurrence.id));
        } else {
            projects
                .filter(project => project.preferredClientId === clientId)
                .forEach(project => updateProject(project.id, {
                    preferredClientId: null,
                    hourlyRate: null,
                    flatRate: false,
                    isPersonal: true
                }));

            expenses
                .filter(expense => expense.clientId === clientId)
                .forEach(expense => deleteExpense(expense.id));

            recurrences
                .filter(recurrence => recurrence.clientId === clientId)
                .forEach(recurrence => deleteRecurrence(recurrence.id));
        }

        deleteClient(clientId);

        const message = alsoDeleteProjects
            ? `Client and ${related.length} related project(s) deleted successfully.`
            : 'Client deleted successfully.';
        showSuccess(message);
    }, [projects, tasks, timeEntries, invoices, expenses, recurrences, deleteProject, deleteTask, deleteEntry, deleteInvoice, updateProject, deleteClient, deleteExpense, deleteRecurrence, unbillExpensesForInvoice, showSuccess]);

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

    const renderProjectActionChip = (project) => {
        const invoicePreview = getProjectInvoicePreview(project, {
            clients,
            tasks,
            timeEntries,
            expenses,
            exchangeRates,
        });
        const previewTitle = invoicePreview.excludedExpenseCount > 0
            ? `${invoicePreview.excludedExpenseCount} expense${invoicePreview.excludedExpenseCount === 1 ? '' : 's'} excluded until exchange rates are available`
            : 'Estimated invoice total';

        if (invoicePreview.total > 0) {
            return (
                <button
                    onClick={(event) => handleGenerateInvoice(event)}
                    className="inline-flex items-center rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    title={previewTitle}
                >
                    <span className="sensitive-data">
                        {formatCurrency(invoicePreview.total, invoicePreview.currency)}
                    </span>
                </button>
            );
        }

        if (invoicePreview.unpricedHours > 0) {
            return (
                <button
                    onClick={(event) => handleGenerateInvoice(event)}
                    className="inline-flex items-center rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    title={`${invoicePreview.unpricedHours.toFixed(2)} unpriced hours - Click to set rate and generate invoice`}
                >
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {invoicePreview.unpricedHours.toFixed(2)}h
                </button>
            );
        }

        return null;
    };

    const renderProjectSummaryCard = (project, archived = false) => {
        const projectTasksForCard = clientTasks.filter((task) => task.projectId === project.id);
        const projectTimeEntriesForCard = clientTimeEntries.filter((entry) => (
            projectTasksForCard.some((task) => task.id === entry.taskId)
        ));
        const totalTime = projectTimeEntriesForCard.reduce((total, entry) => total + (entry.end - entry.start), 0);
        const actionChip = renderProjectActionChip(project);
        const deadlineStatus = getProjectDeadlineStatus(project);
        const deadlineSummary = deadlineStatus.hasDeadline
            ? (deadlineStatus.isResolved
                ? null
                : deadlineStatus.isOverdue
                ? `${Math.abs(deadlineStatus.daysRemaining || 0)} day${Math.abs(deadlineStatus.daysRemaining || 0) === 1 ? '' : 's'} overdue`
                : deadlineStatus.isToday
                    ? 'Due today'
                    : `${deadlineStatus.daysRemaining} day${deadlineStatus.daysRemaining === 1 ? '' : 's'} remaining`)
            : null;
        const deadlineBadge = deadlineStatus.isResolved ? (
            <Badge variant="success" className="gap-1 whitespace-nowrap">
                <CheckIcon className="h-3 w-3" />
                Completed {toDisplayDate(deadlineStatus.resolvedAt, { month: 'short', day: 'numeric' })}
            </Badge>
        ) : deadlineStatus.isOverdue ? (
            <Badge variant="warning" className="whitespace-nowrap">
                Overdue
            </Badge>
        ) : null;

        return (
            <Card
                key={project.id}
                className="relative flex h-full cursor-pointer border-l-4 transition-shadow hover:shadow-md"
                style={getProjectBorderStyle(project)}
                onClick={() => navigateToProject(project.id)}
            >
                <CardContent className={cn('flex min-h-full flex-1 flex-col', isMobileLayout ? 'p-4' : 'p-4 pt-5')}>
                    <div className="space-y-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate font-medium text-foreground">{project.title}</h3>
                            {isProjectInQuoteMode(project) && (
                                <span className="inline-flex items-center whitespace-nowrap rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    Quote stage
                                </span>
                            )}
                            {archived && (
                                <span className="inline-flex items-center whitespace-nowrap rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Archived
                                </span>
                            )}
                        </div>
                        {project.hourlyRate && !project.flatRate && (
                            <p className="text-sm text-muted-foreground">
                                <span className="sensitive-data">
                                    {getCurrencySymbol(getProjectCurrency(project, clients))}
                                    {project.hourlyRate}/{getProjectCurrency(project, clients)} per hour
                                </span>
                            </p>
                        )}
                        <div className="text-sm text-muted-foreground">
                            <p>{projectTasksForCard.filter((task) => !task.completed && !task.archived).length} active tasks</p>
                            <p>{formatDuration(totalTime)} total time</p>
                        </div>
                        {deadlineStatus.hasDeadline && (
                            <p className="text-sm text-muted-foreground">
                                Deadline <span className="font-medium text-foreground">{toDisplayDate(deadlineStatus.deadline, { month: 'short', day: 'numeric' })}</span>
                                {deadlineSummary ? ` · ${deadlineSummary}` : ''}
                            </p>
                        )}
                    </div>
                    {(deadlineBadge || actionChip) && (
                        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-4">
                            {deadlineBadge}
                            {actionChip}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3 items-center')}>
                <div className={cn('flex items-center min-w-0', isMobileLayout ? 'flex-1 gap-3' : 'space-x-4')}>
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
                            {client.color && (
                                <div
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: client.color }}
                                    title="Client color"
                                />
                            )}
                            <h1 className="text-2xl font-bold text-foreground">{client.title}</h1>
                            {client.archived && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Archived
                                </span>
                            )}
                        </div>
                        {(client.clientName || client.contactPerson) && (
                            <p className="text-sm text-muted-foreground">
                                {[
                                    client.clientName,
                                    client.contactPerson ? client.contactPerson : null
                                ].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                </div>

                <div className={cn('flex items-center gap-3', isMobileLayout && 'shrink-0')}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 rounded-full text-muted-foreground"
                                title="More actions"
                                aria-label="More actions"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isMobileLayout && (
                                <DropdownMenuItem
                                    onSelect={handleOpenMobileInvoiceGenerator}
                                    className="flex items-center space-x-2 pr-5"
                                >
                                    <DocumentTextIcon className="h-4 w-4" />
                                    <span>Generate Invoice</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleEditClient}
                                className="status-warning-action flex items-center space-x-2"
                            >
                                <PencilIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </DropdownMenuItem>
                            {client.archived ? (
                                <DropdownMenuItem
                                    onClick={handleUnarchiveClient}
                                    className="status-info-action flex items-center space-x-2"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Unarchive</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={handleArchiveClient}
                                    className="status-info-action flex items-center space-x-2"
                                >
                                    <ArchiveBoxIcon className="h-4 w-4" />
                                    <span>Archive</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDeleteClient}
                                className="status-danger-action flex items-center space-x-2"
                            >
                                <TrashIcon className="h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Create Invoice Button */}
                    {!isMobileLayout && (
                        <InvoiceGenerator
                            client={client}
                            timeEntries={clientTimeEntries}
                            editingInvoice={editingInvoice}
                            onInvoiceSaved={() => setEditingInvoice(null)}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            activeModal={activeModal}
                            showButton={true}
                            // Modal functions
                            openClientModal={openClientModal}
                            openProjectModal={openProjectModal}
                            openBusinessModal={openBusinessModal}
                            openPaymentMethodModal={openPaymentMethodModal}
                            openTemplateModal={openTemplateModal}
                        />
                    )}
                </div>
            </div>

            {isMobileLayout && (mobileInvoiceGenerator || editingInvoice) && (
                <InvoiceGenerator
                    key={`mobile-client-invoice-generator-${mobileInvoiceGenerator?.key || editingInvoice?.id || 'draft'}`}
                    client={client}
                    timeEntries={clientTimeEntries}
                    editingInvoice={editingInvoice}
                    onInvoiceSaved={() => {
                        setEditingInvoice(null);
                        setMobileInvoiceGenerator(null);
                    }}
                    paymentMethods={paymentMethods}
                    businessInfos={businessInfos}
                    clients={clients}
                    activeModal={activeModal}
                    showButton={false}
                    forceOpenOnMount={!!mobileInvoiceGenerator}
                    openClientModal={openClientModal}
                    openProjectModal={openProjectModal}
                    openBusinessModal={openBusinessModal}
                    openPaymentMethodModal={openPaymentMethodModal}
                    openTemplateModal={openTemplateModal}
                />
            )}

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
            <div
                className={cn(
                    isMobileLayout
                        ? '-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide'
                        : 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'
                )}
                data-testid="client-metrics-row"
            >

                <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                    <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                        <div className="flex items-center w-full">
                            <div className="w-full">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Unbilled</dt>
                                </dl>
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                        <span className="sensitive-data text-foreground font-semibold">
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.potentialRevenue.toFixed(2)}
                                        </span>
                                    </div>
                                    {clientExpenses.length > 0 && (
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <HandCoinsIcon className="h-4 w-4 mr-2" />
                                            <span className="sensitive-data text-foreground font-semibold">
                                                {formatAmounts(unbilledExpenseTotalsByCurrency)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                    <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                        <div className="flex items-center w-full">
                            <div className="flex-shrink-0">
                                <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="ml-4 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Pending</dt>
                                    <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                        <span className="sensitive-data">
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.pendingAmount.toFixed(2)}
                                        </span>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {clientExpenses.length > 0 && (
                    <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                        <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                            <div className="flex items-center w-full">
                                <div className="flex-shrink-0">
                                    <HandCoinsIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">Expenses</dt>
                                        <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                            <span className="sensitive-data">
                                                {formatAmounts(expenseTotalsByCurrency)}
                                            </span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className={cn('h-full', isMobileLayout && 'min-w-[15.5rem] flex-shrink-0')}>
                    <CardContent className={cn('flex items-center h-full', isMobileLayout ? 'p-3' : 'p-5')}>
                        <div className="flex items-center w-full">
                            <div className="flex-shrink-0">
                                <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="ml-4 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Paid Revenue</dt>
                                    <dd className={cn('font-semibold text-foreground', isMobileLayout ? 'text-base' : 'text-lg')}>
                                        <span className="sensitive-data">
                                            {getCurrencySymbol(clientCurrency)}{clientMetrics.totalRevenue.toFixed(2)}
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
                <CardHeader className={cn(isMobileLayout && 'px-3 py-3')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="min-w-0 flex-1 text-lg">
                            Projects ({clientProjects.length})
                        </CardTitle>
                        <Button
                            onClick={handleCreateProject}
                            variant="outline"
                            leadingIcon={PlusIcon}
                            className="shrink-0"
                        >
                            New Project
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
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
                                    {activeClientProjects.map((project) => renderProjectSummaryCard(project))}
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
                                            {archivedClientProjects.map((project) => renderProjectSummaryCard(project, true))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <ExpensesSection
                clientId={client.id}
                clients={clients}
                projects={clientProjects}
                openExpenseModal={openExpenseModal}
                openExpenseView={openExpenseView}
            />

            {/* Invoices Section */}
            <Card>
                <CardHeader className={cn(isMobileLayout && 'px-3 py-3')}>
                    <div className="flex items-center gap-3">
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
                    <CardContent id="client-invoices-list" className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
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
                    <CardHeader className={cn(isMobileLayout && 'px-3 py-3')}>
                        <CardTitle className="text-lg">Time Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
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
