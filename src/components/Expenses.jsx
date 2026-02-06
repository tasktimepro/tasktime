import { useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, endOfYear, startOfMonth, startOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { useClients } from '@/hooks/useClients.ts';
import { useProjects } from '@/hooks/useProjects.ts';
import { usePreferences } from '@/hooks/usePreferences.ts';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { toStorageDate } from '@/utils/dateUtils.ts';
import { isExpenseInDateRange } from '@/utils/expenseUtils';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseMetrics from '@/components/expenses/ExpenseMetrics';
import ExpenseFilters from '@/components/expenses/ExpenseFilters';

const PERIOD_OPTIONS = [
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
];

/**
 * Expenses component - Main expenses page
 */
const Expenses = ({ openExpenseModal }) => {

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

    const activeClients = useMemo(() => {

        return clients.filter((client) => !client.archived);
    }, [clients]);

    const activeProjects = useMemo(() => {

        return projects.filter((project) => !project.archived);
    }, [projects]);

    const availableProjects = useMemo(() => {
        if (clientId !== 'all') {
            return getProjectsByClient(clientId).filter((project) => !project.archived);
        }
        return activeProjects;
    }, [clientId, getProjectsByClient, activeProjects]);

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

    const filteredExpenses = useMemo(() => {
        let result = expenses;

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

        return [...result].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [
        expenses,
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

    const sumByCurrency = (items) => {
        return items.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || 'EUR';
            acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
            return acc;
        }, {});
    };

    const totalByCurrency = useMemo(() => sumByCurrency(filteredExpenses), [filteredExpenses]);
    const unpaidByCurrency = useMemo(() => sumByCurrency(filteredExpenses.filter((expense) => expense.paymentStatus === 'unpaid')), [filteredExpenses]);
    const paidByCurrency = useMemo(() => sumByCurrency(filteredExpenses.filter((expense) => expense.paymentStatus === 'paid')), [filteredExpenses]);
    const billableByCurrency = useMemo(() => sumByCurrency(filteredExpenses.filter((expense) => expense.billable && expense.billingStatus === 'unbilled')), [filteredExpenses]);

    const formatAmounts = (amounts) => {
        const entries = Object.entries(amounts).filter(([, value]) => value > 0);
        if (entries.length === 0) return '—';
        if (entries.length === 1) {
            const [currency, value] = entries[0];
            return formatCurrency(value, currency);
        }

        return entries.map(([currency, value]) => `${formatCurrency(value, currency)} ${currency}`).join(' · ');
    };

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
        if (!window.confirm(`Delete template "${recurrence.title}"? Existing expenses will remain.`)) {
            return;
        }
        deleteRecurrence(recurrence.id);
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
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => openExpenseModal(null)}>
                        + Add Expense
                    </Button>
                </div>
            </div>

            {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">From</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(event) => setCustomStart(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">To</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(event) => setCustomEnd(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>
                </div>
            )}

            <ExpenseMetrics
                totalLabel={formatAmounts(totalByCurrency)}
                unpaidLabel={formatAmounts(unpaidByCurrency)}
                billableLabel={formatAmounts(billableByCurrency)}
                paidLabel={formatAmounts(paidByCurrency)}
            />

            <ExpenseFilters
                search={search}
                onSearchChange={setSearch}
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

            {sortedRecurrences.length > 0 && (
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                            Recurring Templates ({sortedRecurrences.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {sortedRecurrences.map((recurrence) => {
                                const clientLabel = recurrence.clientId && clientsById.get(recurrence.clientId)?.clientName;
                                const projectLabel = recurrence.projectId && projectsById.get(recurrence.projectId)?.title;
                                const contextLabel = recurrence.isPersonal
                                    ? 'Personal'
                                    : (projectLabel || clientLabel || 'Assigned');

                                return (
                                    <div
                                        key={recurrence.id}
                                        className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {recurrence.title}
                                                </span>
                                                <Badge variant={recurrence.active ? 'default' : 'secondary'}>
                                                    {recurrence.active ? 'Active' : 'Paused'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {recurrence.repeat === 'yearly' ? 'Yearly' : 'Monthly'} · {contextLabel}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Starts {recurrence.startDate}
                                                {recurrence.endDate ? ` · Ends ${recurrence.endDate}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">
                                                {formatCurrency(recurrence.amount || 0, recurrence.currency || preferences.currency)}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleEditTemplate(recurrence)}
                                            >
                                                Edit Template
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => (recurrence.active ? pauseRecurrence(recurrence.id) : resumeRecurrence(recurrence.id))}
                                            >
                                                {recurrence.active ? 'Pause' : 'Resume'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteTemplate(recurrence)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <ExpenseList
                expenses={filteredExpenses}
                clientsById={clientsById}
                projectsById={projectsById}
                onEdit={(expense) => openExpenseModal(expense)}
                onTogglePaid={handleTogglePaid}
            />
        </div>
    );
};

export default Expenses;
