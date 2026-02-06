import { useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, endOfYear, startOfMonth, startOfYear } from 'date-fns';
import {
    ArrowPathIcon,
    BuildingOfficeIcon,
    CreditCardIcon,
    DocumentDuplicateIcon,
    HandCoinsIcon,
    MoreHorizontalIcon,
    PauseIcon,
    PencilIcon,
    PlayIcon,
    PlusIcon,
    TrashIcon,
} from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import { Notice } from '@/components/ui/notice';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlState } from '@/hooks/useUrlState.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { useClients } from '@/hooks/useClients.ts';
import { useProjects } from '@/hooks/useProjects.ts';
import { usePreferences } from '@/hooks/usePreferences.ts';
import { useToast } from '@/hooks/useToast.ts';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate, isExpenseInDateRange } from '@/utils/expenseUtils';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseFilters from '@/components/expenses/ExpenseFilters';
import PaymentMethods from '@/components/PaymentMethods';
import BusinessInfo from '@/components/BusinessInfo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PERIOD_OPTIONS = [
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
];

/**
 * Expenses component - Main expenses page
 */
const Expenses = ({
    openExpenseModal,
    openExpenseView,
    openPaymentMethodModal,
    editPaymentMethodModal,
    openBusinessModal,
    editBusinessModal,
}) => {

    const { urlParams, updateUrl } = useUrlState();
    const { showSuccess } = useToast();
    const { expenses, markAsPaid, markAsUnpaid, createExpense } = useExpenses();
    const { recurrences, generatePendingExpenses, pauseRecurrence, resumeRecurrence, deleteRecurrence } = useExpenseRecurrences();
    const { clients } = useClients();
    const { projects, getProjectsByClient } = useProjects();
    const { preferences } = usePreferences();

    const [search, setSearch] = useState('');
    const [clientId, setClientId] = useState('all');
    const [projectId, setProjectId] = useState('all');
    const [personalOnly, setPersonalOnly] = useState(false);
    const [billableOnly, setBillableOnly] = useState(false);
    const [recurringOnly, setRecurringOnly] = useState(false);
    const [paidStatus, setPaidStatus] = useState('all');
    const [billedStatus, setBilledStatus] = useState('all');
    const [period, setPeriod] = useState('month');
    const [customStart, setCustomStart] = useState(() => toStorageDate(new Date()) || '');
    const [customEnd, setCustomEnd] = useState(() => toStorageDate(new Date()) || '');
    const initialFiltersAppliedRef = useRef(false);
    const recurrenceGeneratedRef = useRef(false);
    const [pendingDeleteRecurrence, setPendingDeleteRecurrence] = useState(null);
    const todayStr = useMemo(() => toStorageDate(new Date()) || '', []);

    const sideNavItems = useMemo(() => [
        {
            id: 'all',
            name: 'All Expenses',
            icon: HandCoinsIcon,
            description: 'View and manage all expenses'
        },
        {
            id: 'recurring',
            name: 'Recurring Expenses',
            icon: ArrowPathIcon,
            description: 'Manage recurring expenses'
        },
        {
            id: 'payment-methods',
            name: 'Payment Methods',
            icon: CreditCardIcon,
            description: 'Manage payment methods'
        },
        {
            id: 'business-info',
            name: 'Your Business',
            icon: BuildingOfficeIcon,
            description: 'Manage business information'
        }
    ], []);

    const activeTab = urlParams.section || sideNavItems[0].id;

    useEffect(() => {
        if (!urlParams.section) {
            updateUrl({ section: sideNavItems[0].id });
        }
    }, [urlParams.section, updateUrl, sideNavItems]);

    const handleSectionChange = (sectionId) => {
        updateUrl({ section: sectionId, create: null });
    };

    const activeClients = useMemo(() => {

        return clients.filter((client) => !client.archived);
    }, [clients]);

    const activeProjects = useMemo(() => {

        return projects.filter((project) => !project.archived);
    }, [projects]);

    const availableProjects = useMemo(() => {
        if (personalOnly) {
            return activeProjects.filter((project) => project.isPersonal);
        }

        if (clientId !== 'all') {
            return getProjectsByClient(clientId).filter((project) => !project.archived);
        }

        return activeProjects;
    }, [clientId, getProjectsByClient, activeProjects, personalOnly]);

    useEffect(() => {
        if (recurrenceGeneratedRef.current) return;
        generatePendingExpenses(createExpense);
        recurrenceGeneratedRef.current = true;
    }, [generatePendingExpenses, createExpense]);

    useEffect(() => {
        if (initialFiltersAppliedRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const urlClientId = params.get('clientId');
        const urlProjectId = params.get('projectId');

        if (urlClientId) {
            setClientId(urlClientId);
        }

        if (urlProjectId) {
            setProjectId(urlProjectId);
        }

        initialFiltersAppliedRef.current = true;
    }, []);

    const { startDate, endDate } = useMemo(() => {
        const today = new Date();

        if (period === 'month') {
            return {
                startDate: toStorageDate(startOfMonth(today)) || '',
                endDate: toStorageDate(endOfMonth(today)) || '',
            };
        }

        if (period === 'quarter') {
            const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
            const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
            const quarterEnd = endOfMonth(new Date(today.getFullYear(), quarterStartMonth + 2, 1));

            return {
                startDate: toStorageDate(quarterStart) || '',
                endDate: toStorageDate(quarterEnd) || '',
            };
        }

        if (period === 'year') {
            return {
                startDate: toStorageDate(startOfYear(today)) || '',
                endDate: toStorageDate(endOfYear(today)) || '',
            };
        }

        return {
            startDate: customStart,
            endDate: customEnd,
        };
    }, [period, customStart, customEnd]);

    const recurringPreviewExpenses = useMemo(() => {
        if (!startDate || !endDate || !todayStr) {
            return [];
        }

        const dateStart = parseStoredDate(startDate);
        const dateEnd = parseStoredDate(endDate);
        if (!dateStart || !dateEnd) {
            return [];
        }

        const fromDate = parseStoredDate(todayStr) && parseStoredDate(todayStr) > dateStart
            ? todayStr
            : startDate;

        const datesByRecurrence = new Map();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!datesByRecurrence.has(expense.recurrenceId)) {
                datesByRecurrence.set(expense.recurrenceId, new Set());
            }
            datesByRecurrence.get(expense.recurrenceId).add(expense.date);
        });

        return recurrences
            .filter((recurrence) => recurrence.active)
            .map((recurrence) => {
                if (!recurrence.startDate) return null;

                const baseStart = recurrence.lastGeneratedDate
                    ? advanceByRepeat(
                        recurrence.lastGeneratedDate,
                        recurrence.repeat,
                        recurrence.monthlyType,
                        recurrence.monthlyDay
                    )
                    : recurrence.startDate;

                const nextDate = getNextRecurringDate({
                    startDate: baseStart,
                    repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
                    endDate: recurrence.endDate,
                    fromDate,
                });

                if (!nextDate) return null;

                const nextParsed = parseStoredDate(nextDate);
                if (!nextParsed || nextParsed > dateEnd) return null;

                const existingDates = datesByRecurrence.get(recurrence.id);
                if (existingDates?.has(nextDate)) {
                    return null;
                }

                const preview = buildExpenseFromRecurrence(recurrence, nextDate);
                return {
                    ...preview,
                    id: `preview-${recurrence.id}-${nextDate}`,
                    amount: recurrence.amountType === 'variable'
                        ? (recurrence.amount || 0)
                        : recurrence.amount,
                    isPreview: true,
                };
            })
            .filter(Boolean);
    }, [
        endDate,
        expenses,
        recurrences,
        startDate,
        todayStr,
    ]);

    const filteredExpenses = useMemo(() => {
        let result = [...expenses, ...recurringPreviewExpenses];

        if (startDate && endDate) {
            result = result.filter((expense) => isExpenseInDateRange(expense, startDate, endDate));
        }

        if (search.trim()) {
            const query = search.toLowerCase();
            result = result.filter((expense) => [
                expense.title,
                expense.note,
                expense.supplierName,
                expense.receiptNumber,
            ].some((value) => value && value.toLowerCase().includes(query)));
        }

        if (clientId !== 'all') {
            result = result.filter((expense) => expense.clientId === clientId);
        }

        if (projectId !== 'all') {
            result = result.filter((expense) => expense.projectId === projectId);
        }

        if (personalOnly) {
            result = result.filter((expense) => expense.isPersonal);
        }

        if (billableOnly) {
            result = result.filter((expense) => expense.billable);
        }

        if (recurringOnly) {
            result = result.filter((expense) => expense.isRecurring);
        }

        if (paidStatus !== 'all') {
            result = result.filter((expense) => expense.paymentStatus === paidStatus);
        }

        if (billedStatus !== 'all') {
            result = result.filter((expense) => expense.billingStatus === billedStatus);
        }

        const getStatusRank = (expense) => {
            if (expense.paymentStatus === 'paid') return 3;
            if (!expense.date || !todayStr) return 2;
            if (expense.date === todayStr) return 1;
            const expenseDate = parseStoredDate(expense.date);
            const todayDate = parseStoredDate(todayStr);
            if (expenseDate && todayDate && expenseDate < todayDate) return 0;
            return 2;
        };

        return [...result].sort((a, b) => {
            const rankA = getStatusRank(a);
            const rankB = getStatusRank(b);
            if (rankA !== rankB) return rankA - rankB;

            const dateA = parseStoredDate(a.date)?.getTime() || 0;
            const dateB = parseStoredDate(b.date)?.getTime() || 0;
            if (dateA !== dateB) return dateA - dateB;

            return (a.title || '').localeCompare(b.title || '');
        });
    }, [
        expenses,
        recurringPreviewExpenses,
        startDate,
        endDate,
        search,
        clientId,
        projectId,
        personalOnly,
        billableOnly,
        recurringOnly,
        paidStatus,
        billedStatus,
        todayStr,
    ]);

    const clientsById = useMemo(() => {
        const map = new Map();
        clients.forEach((client) => {
            map.set(client.id, client);
        });
        return map;
    }, [clients]);

    const projectsById = useMemo(() => {
        const map = new Map();
        projects.forEach((project) => {
            map.set(project.id, project);
        });
        return map;
    }, [projects]);

    const handleTogglePaid = (expense) => {
        if (expense.paymentStatus === 'paid') {
            markAsUnpaid(expense.id);
            return;
        }

        if (expense.amountType === 'variable' && (!expense.amount || expense.amount <= 0)) {
            openExpenseModal(expense);
            return;
        }

        markAsPaid(expense.id);
    };

    const sortedRecurrences = useMemo(() => {
        return [...recurrences].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }, [recurrences]);

    const handleEditTemplate = (recurrence) => {
        openExpenseModal(null, { recurrenceId: recurrence.id });
    };

    const handleDeleteTemplate = (recurrence) => {
        setPendingDeleteRecurrence(recurrence);
    };

    const confirmDeleteTemplate = () => {
        if (!pendingDeleteRecurrence) return;
        deleteRecurrence(pendingDeleteRecurrence.id);
        showSuccess('Recurring expense deleted');
        setPendingDeleteRecurrence(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Track and manage expenses.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button leadingIcon={PlusIcon} onClick={() => openExpenseModal(null)}>
                        New Expense
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleSectionChange}>
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none">
                    {sideNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <TabsTrigger
                                key={item.id}
                                value={item.id}
                                className="flex items-center py-2 px-1 mr-8 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm whitespace-nowrap transition-colors data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border"
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {item.name}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            <div>
                {activeTab === 'all' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-foreground">
                                All Expenses {filteredExpenses.length > 0 && (
                                    <span>
                                        ({filteredExpenses.length})
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                View and manage all expenses across your workspace.
                            </p>
                        </div>

                        <div className="mt-6">
                            <ExpenseFilters
                                search={search}
                                onSearchChange={setSearch}
                                period={period}
                                onPeriodChange={setPeriod}
                                periodOptions={PERIOD_OPTIONS}
                                customStart={customStart}
                                customEnd={customEnd}
                                onCustomStartChange={setCustomStart}
                                onCustomEndChange={setCustomEnd}
                                clients={activeClients}
                                projects={availableProjects}
                                clientId={clientId}
                                projectId={projectId}
                                onClientChange={(value) => {
                                    setClientId(value);
                                    setProjectId('all');
                                }}
                                onProjectChange={setProjectId}
                                personalOnly={personalOnly}
                                billableOnly={billableOnly}
                                recurringOnly={recurringOnly}
                                onPersonalToggle={setPersonalOnly}
                                onBillableToggle={setBillableOnly}
                                onRecurringToggle={setRecurringOnly}
                                paidStatus={paidStatus}
                                billedStatus={billedStatus}
                                onPaidStatusChange={setPaidStatus}
                                onBilledStatusChange={setBilledStatus}
                            />
                        </div>

                        <div className="mt-6">
                            <ExpenseList
                                expenses={filteredExpenses}
                                clientsById={clientsById}
                                projectsById={projectsById}
                                onView={(expense) => openExpenseView?.(expense)}
                                onEdit={(expense) => openExpenseModal(expense)}
                                onTogglePaid={handleTogglePaid}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'recurring' && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">
                                    Recurring Expenses {sortedRecurrences.length > 0 && (
                                        <span>
                                            ({sortedRecurrences.length})
                                        </span>
                                    )}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage recurring expenses and schedules.
                                </p>
                            </div>
                            <Button leadingIcon={PlusIcon} onClick={() => openExpenseModal(null, { isRecurring: true })}>
                                New Recurring Expense
                            </Button>
                        </div>

                        {sortedRecurrences.length === 0 ? (
                            <div className="text-center py-12">
                                <ArrowPathIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h4 className="mt-2 text-sm font-medium text-foreground">No recurring expenses</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Create a recurring expense to automate repeating expenses.
                                </p>
                                <div className="mt-6">
                                    <Button leadingIcon={PlusIcon} onClick={() => openExpenseModal(null, { isRecurring: true })}>
                                        New Recurring Expense
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedRecurrences.map((recurrence) => {
                                    const clientLabel = recurrence.clientId && clientsById.get(recurrence.clientId)?.title;
                                    const projectLabel = recurrence.projectId && projectsById.get(recurrence.projectId)?.title;
                                    const client = recurrence.clientId ? clientsById.get(recurrence.clientId) : null;
                                    const project = recurrence.projectId ? projectsById.get(recurrence.projectId) : null;
                                    const borderColor = project?.color || client?.color || null;
                                    const contextLabel = recurrence.isPersonal
                                        ? 'Personal'
                                        : (projectLabel || clientLabel || 'Assigned');
                                    const amountLabel = recurrence.amountType === 'variable'
                                        ? (recurrence.amount && recurrence.amount > 0
                                            ? `${formatCurrency(recurrence.amount, recurrence.currency || preferences.currency)} (Est.)`
                                            : 'Variable amount')
                                        : formatCurrency(recurrence.amount || 0, recurrence.currency || preferences.currency);

                                    return (
                                        <Card
                                            key={recurrence.id}
                                            className="hover:shadow-md transition-shadow border-l-4 border-l-border"
                                            style={borderColor ? { borderLeftColor: borderColor } : undefined}
                                        >
                                            <CardContent className="pt-5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3">
                                                            <ArrowPathIcon className="h-6 w-6 text-muted-foreground" />
                                                            <div>
                                                                <div className="flex items-center space-x-2">
                                                                    <h4 className="text-lg font-medium text-foreground">
                                                                        {recurrence.title}
                                                                    </h4>
                                                                    <Badge variant={recurrence.active ? 'default' : 'secondary'}>
                                                                        {recurrence.active ? 'Active' : 'Paused'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="mt-1 text-sm text-muted-foreground space-y-1">
                                                                    <p>{recurrence.repeat === 'yearly' ? 'Yearly' : 'Monthly'} · {contextLabel}</p>
                                                                    <p>Amount: {amountLabel}</p>
                                                                    <p>
                                                                        Starts: {recurrence.startDate}
                                                                        {recurrence.endDate ? ` · Ends ${recurrence.endDate}` : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                                title="More actions"
                                                                aria-label="More actions"
                                                            >
                                                                <MoreHorizontalIcon className="h-5 w-5 group-hover:text-muted-foreground" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleEditTemplate(recurrence)}>
                                                                <PencilIcon className="h-4 w-4" />
                                                                <span>Edit</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => (recurrence.active ? pauseRecurrence(recurrence.id) : resumeRecurrence(recurrence.id))}
                                                            >
                                                                {recurrence.active ? (
                                                                    <PauseIcon className="h-4 w-4" />
                                                                ) : (
                                                                    <PlayIcon className="h-4 w-4" />
                                                                )}
                                                                <span>{recurrence.active ? 'Pause' : 'Resume'}</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDeleteTemplate(recurrence)}>
                                                                <TrashIcon className="h-4 w-4" />
                                                                <span>Delete</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'payment-methods' && (
                    <PaymentMethods
                        autoOpenCreate={urlParams.create === 'payment-method'}
                        openPaymentMethodModal={openPaymentMethodModal}
                        editPaymentMethodModal={editPaymentMethodModal}
                    />
                )}

                {activeTab === 'business-info' && (
                    <BusinessInfo
                        autoOpenCreate={urlParams.create === 'business-info'}
                        openBusinessModal={openBusinessModal}
                        editBusinessModal={editBusinessModal}
                    />
                )}
            </div>

            <Modal
                isOpen={Boolean(pendingDeleteRecurrence)}
                onClose={() => setPendingDeleteRecurrence(null)}
                title="Delete recurring expense?"
                size="md"
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setPendingDeleteRecurrence(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteTemplate}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteRecurrence?.title
                        ? `Deleting "${pendingDeleteRecurrence.title}" cannot be undone.`
                        : 'Deleting this recurring expense cannot be undone.'}
                    description="Existing expenses already created from this recurrence will remain."
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default Expenses;
