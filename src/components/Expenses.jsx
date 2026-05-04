import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from 'date-fns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { useUrlState } from '@/hooks/useUrlState.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { useClients } from '@/hooks/useClients.ts';
import { useProjects } from '@/hooks/useProjects.ts';
import { usePreferences } from '@/hooks/usePreferences.ts';
import { useToast } from '@/hooks/useToast.ts';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate, isExpenseInDateRange } from '@/utils/expenseUtils';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseFilters from '@/components/expenses/ExpenseFilters';
import PaymentMethods from '@/components/PaymentMethods';
import BusinessInfo from '@/components/BusinessInfo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FilterIcon, MagnifyingGlassIcon, XMarkIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
    { value: 'month', label: 'This Month' },
    { value: 'last-month', label: 'Last Month' },
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
    const isMobileLayout = useIsMobileLayout();

    const { urlParams, updateUrl } = useUrlState();
    const { showSuccess, showError } = useToast();
    const { expenses, markAsPaid, markAsUnpaid, createExpense } = useExpenses({ includeArchived: true });
    const {
        recurrences,
        isLoading: expenseRecurrencesLoading,
        generatePendingExpenses,
        pauseRecurrence,
        resumeRecurrence,
        deleteRecurrence,
    } = useExpenseRecurrences();
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
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const todayStr = useMemo(() => toStorageDate(new Date()) || '', []);

    const sideNavItems = useMemo(() => [
        {
            id: 'all',
            name: 'Expenses',
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
        if (expenseRecurrencesLoading || recurrenceGeneratedRef.current) return;
        generatePendingExpenses(createExpense);
        recurrenceGeneratedRef.current = true;
    }, [expenseRecurrencesLoading, generatePendingExpenses, createExpense]);

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

    const { historicalStartDate, historicalEndDate, upcomingStartDate, upcomingEndDate } = useMemo(() => {
        const today = new Date();
        const todayValue = toStorageDate(today) || '';

        if (period === 'month') {
            return {
                historicalStartDate: toStorageDate(startOfMonth(today)) || '',
                historicalEndDate: toStorageDate(endOfMonth(today)) || '',
                upcomingStartDate: todayValue,
                upcomingEndDate: toStorageDate(endOfMonth(today)) || '',
            };
        }

        if (period === 'quarter') {
            const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
            const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
            const quarterEnd = endOfMonth(new Date(today.getFullYear(), quarterStartMonth + 2, 1));

            return {
                historicalStartDate: toStorageDate(quarterStart) || '',
                historicalEndDate: toStorageDate(quarterEnd) || '',
                upcomingStartDate: todayValue,
                upcomingEndDate: toStorageDate(quarterEnd) || '',
            };
        }

        if (period === 'last-month') {
            const lastMonth = subMonths(today, 1);

            return {
                historicalStartDate: toStorageDate(startOfMonth(lastMonth)) || '',
                historicalEndDate: toStorageDate(endOfMonth(lastMonth)) || '',
                upcomingStartDate: toStorageDate(startOfMonth(lastMonth)) || '',
                upcomingEndDate: toStorageDate(endOfMonth(lastMonth)) || '',
            };
        }

        if (period === 'year') {
            return {
                historicalStartDate: toStorageDate(startOfYear(today)) || '',
                historicalEndDate: toStorageDate(endOfYear(today)) || '',
                upcomingStartDate: todayValue,
                upcomingEndDate: toStorageDate(endOfYear(today)) || '',
            };
        }

        return {
            historicalStartDate: customStart,
            historicalEndDate: customEnd,
            upcomingStartDate: customStart,
            upcomingEndDate: customEnd,
        };
    }, [period, customStart, customEnd]);

    const recurringPreviewExpenses = useMemo(() => {
        if (!upcomingStartDate || !upcomingEndDate || !todayStr) {
            return [];
        }

        const dateStart = parseStoredDate(upcomingStartDate);
        const dateEnd = parseStoredDate(upcomingEndDate);
        if (!dateStart || !dateEnd) {
            return [];
        }

        const fromDate = parseStoredDate(todayStr) && parseStoredDate(todayStr) > dateStart
            ? todayStr
            : upcomingStartDate;

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
        expenses,
        recurrences,
        upcomingEndDate,
        upcomingStartDate,
        todayStr,
    ]);

    const commonFilteredExpenses = useMemo(() => {
        let result = [...expenses, ...recurringPreviewExpenses];

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

    const historicalPeriodExpenses = useMemo(() => {
        if (!historicalStartDate || !historicalEndDate) {
            return commonFilteredExpenses;
        }

        return commonFilteredExpenses.filter((expense) => isExpenseInDateRange(expense, historicalStartDate, historicalEndDate));
    }, [commonFilteredExpenses, historicalStartDate, historicalEndDate]);

    const upcomingPeriodExpenses = useMemo(() => {
        if (!upcomingStartDate || !upcomingEndDate) {
            return commonFilteredExpenses;
        }

        return commonFilteredExpenses.filter((expense) => isExpenseInDateRange(expense, upcomingStartDate, upcomingEndDate));
    }, [commonFilteredExpenses, upcomingStartDate, upcomingEndDate]);

    const todayDate = useMemo(() => parseStoredDate(todayStr), [todayStr]);

    const getEffectivePaymentStatus = (expense) => {
        if (expense.isPreview) return 'unpaid';
        return expense.paymentStatus;
    };

    const getDateMs = useCallback((value) => parseStoredDate(value)?.getTime() || 0, []);

    const compareByDueDateAscThenTitle = useCallback((a, b) => {
        const dateDiff = getDateMs(a.date) - getDateMs(b.date);
        if (dateDiff !== 0) return dateDiff;
        return (a.title || '').localeCompare(b.title || '');
    }, [getDateMs]);

    const comparePaidByMostRecent = useCallback((a, b) => {
        const paidDiff = getDateMs(b.paidOn) - getDateMs(a.paidOn);
        if (paidDiff !== 0) return paidDiff;

        const dateDiff = getDateMs(b.date) - getDateMs(a.date);
        if (dateDiff !== 0) return dateDiff;

        return (a.title || '').localeCompare(b.title || '');
    }, [getDateMs]);

    const outstandingExpenses = useMemo(() => {
        return commonFilteredExpenses
            .filter((expense) => {
                if (getEffectivePaymentStatus(expense) === 'paid') return false;
                if (!todayDate) return false;
                const expenseDate = parseStoredDate(expense.date);
                if (!expenseDate) return false;
                return expenseDate <= todayDate;
            })
            .sort(compareByDueDateAscThenTitle);
    }, [commonFilteredExpenses, todayDate, compareByDueDateAscThenTitle]);

    const upcomingExpenses = useMemo(() => {
        return upcomingPeriodExpenses
            .filter((expense) => {
                if (getEffectivePaymentStatus(expense) === 'paid') return false;
                if (!todayDate) return true;
                const expenseDate = parseStoredDate(expense.date);
                if (!expenseDate) return true;
                return expenseDate > todayDate;
            })
            .sort(compareByDueDateAscThenTitle);
    }, [upcomingPeriodExpenses, todayDate, compareByDueDateAscThenTitle]);

    const paidExpenses = useMemo(() => {
        return historicalPeriodExpenses
            .filter((expense) => getEffectivePaymentStatus(expense) === 'paid')
            .sort(comparePaidByMostRecent);
    }, [historicalPeriodExpenses, comparePaidByMostRecent]);

    const totalVisibleExpenseCount = outstandingExpenses.length + upcomingExpenses.length + paidExpenses.length;

    const defaultStatusTab = useMemo(() => {
        if (outstandingExpenses.length > 0) return 'outstanding';
        if (upcomingExpenses.length > 0) return 'upcoming';
        return 'paid';
    }, [outstandingExpenses.length, upcomingExpenses.length]);

    const [activeStatusTab, setActiveStatusTab] = useState(defaultStatusTab);
    const previousDefaultTab = useRef(defaultStatusTab);

    useEffect(() => {
        if (previousDefaultTab.current !== defaultStatusTab && activeStatusTab === previousDefaultTab.current) {
            setActiveStatusTab(defaultStatusTab);
        }
        previousDefaultTab.current = defaultStatusTab;
    }, [defaultStatusTab, activeStatusTab]);

    const displayedExpenses = useMemo(() => {
        if (activeStatusTab === 'paid') return paidExpenses;
        if (activeStatusTab === 'upcoming') return upcomingExpenses;
        return outstandingExpenses;
    }, [activeStatusTab, outstandingExpenses, upcomingExpenses, paidExpenses]);

    const hasStatusFilters = activeStatusTab !== 'outstanding';

    const hasActiveFilters = useMemo(() => {
        if (search.trim()) return true;
        if (clientId !== 'all') return true;
        if (projectId !== 'all') return true;
        if (personalOnly || billableOnly || recurringOnly) return true;
        if (paidStatus !== 'all' || billedStatus !== 'all') return true;
        if (activeStatusTab !== 'outstanding' && period !== 'month') return true;
        return false;
    }, [
        activeStatusTab,
        search,
        clientId,
        projectId,
        personalOnly,
        billableOnly,
        recurringOnly,
        paidStatus,
        billedStatus,
        period,
    ]);

    const activeFilterCount = useMemo(() => {
        let count = 0;

        if (search.trim()) count += 1;
        if (period !== 'month') count += 1;
        if (clientId !== 'all') count += 1;
        if (projectId !== 'all') count += 1;
        if (personalOnly) count += 1;
        if (billableOnly) count += 1;
        if (recurringOnly) count += 1;
        if (paidStatus !== 'all') count += 1;
        if (billedStatus !== 'all') count += 1;

        return count;
    }, [search, period, clientId, projectId, personalOnly, billableOnly, recurringOnly, paidStatus, billedStatus]);

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

    const handleTogglePaid = async (expense) => {
        if (expense.paymentStatus === 'paid') {
            markAsUnpaid(expense.id);
            return;
        }

        if (expense.amountType === 'variable' && (!expense.amount || expense.amount <= 0)) {
            openExpenseModal(expense);
            return;
        }

        try {
            await markAsPaid(expense.id);
        } catch (error) {
            showError(error?.message || 'Unable to mark expense as paid');
        }
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

    const resetAllFilters = () => {
        setSearch('');
        setClientId('all');
        setProjectId('all');
        setPersonalOnly(false);
        setBillableOnly(false);
        setRecurringOnly(false);
        setPaidStatus('all');
        setBilledStatus('all');
        setPeriod('month');
        setCustomStart(toStorageDate(new Date()) || '');
        setCustomEnd(toStorageDate(new Date()) || '');
    };

    useEffect(() => {
        setIsMobileFiltersOpen(false);
    }, [activeTab]);

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            <Tabs value={activeTab} onValueChange={handleSectionChange}>
                <TabsList className={cn(
                    'w-full bg-transparent rounded-none',
                    isMobileLayout
                        ? 'h-auto flex-wrap justify-start gap-2 border-0 p-0'
                        : 'justify-start border-b border-border p-0'
                )}>
                    {sideNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <TabsTrigger
                                key={item.id}
                                value={item.id}
                                className={cn(
                                    'flex items-center font-medium text-sm whitespace-nowrap transition-colors',
                                    isMobileLayout
                                        ? 'rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                        : 'mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                                )}
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
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">
                                    Expenses {totalVisibleExpenseCount > 0 && (
                                        <span>
                                            ({totalVisibleExpenseCount})
                                        </span>
                                    )}
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    View and manage all expenses across your workspace.
                                </p>
                            </div>
                            <Button className="w-full sm:w-auto" leadingIcon={PlusIcon} onClick={() => openExpenseModal(null)}>
                                New Expense
                            </Button>
                        </div>

                        <div className="mt-6 hidden md:block">
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

                        <div className="mt-6 space-y-3 md:hidden">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search expenses..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                                <Select value={period} onValueChange={setPeriod}>
                                    <SelectTrigger>
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

                                <Button
                                    variant="outline"
                                    leadingIcon={FilterIcon}
                                    className="shrink-0"
                                    onClick={() => setIsMobileFiltersOpen(true)}
                                >
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant="secondary" className="ml-1 min-w-5 justify-center px-1.5 py-0 text-[11px]">
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            </div>

                            {period === 'custom' && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-sm text-muted-foreground">From</span>
                                        <NativeDateInput
                                            value={customStart}
                                            onChange={(event) => setCustomStart(event.target.value)}
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-base"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-sm text-muted-foreground">To</span>
                                        <NativeDateInput
                                            value={customEnd}
                                            onChange={(event) => setCustomEnd(event.target.value)}
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-base"
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab}>
                                <TabsList className={cn(
                                    'w-full bg-transparent rounded-none',
                                    isMobileLayout
                                        ? 'h-auto flex-wrap justify-start gap-2 border-0 p-0'
                                        : 'h-auto justify-start gap-2 overflow-x-auto whitespace-nowrap border-b border-border p-0'
                                )}>
                                    <TabsTrigger
                                        value="outstanding"
                                        className={cn(
                                            isMobileLayout
                                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                                : 'shrink-0 px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                                        )}
                                    >
                                        Outstanding ({outstandingExpenses.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="upcoming"
                                        className={cn(
                                            isMobileLayout
                                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                                : 'shrink-0 px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                                        )}
                                    >
                                        Upcoming ({upcomingExpenses.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="paid"
                                        className={cn(
                                            isMobileLayout
                                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                                : 'shrink-0 px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                                        )}
                                    >
                                        Paid ({paidExpenses.length})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="mt-6">
                            <ExpenseList
                                expenses={displayedExpenses}
                                hasAnyExpenses={totalVisibleExpenseCount > 0}
                                hasActiveFilters={hasActiveFilters || hasStatusFilters}
                                clientsById={clientsById}
                                projectsById={projectsById}
                                onView={(expense) => openExpenseView?.(expense)}
                                onEdit={(expense) => openExpenseModal(expense)}
                                onTogglePaid={handleTogglePaid}
                                onCreateFirst={() => openExpenseModal(null)}
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
                                                                    <p>Amount: <span className="sensitive-data">{amountLabel}</span></p>
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
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteTemplate(recurrence)}
                                                                className="status-danger-action"
                                                            >
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

            <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
                <DialogContent className="left-0 right-0 top-auto bottom-0 max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-[1.75rem] rounded-b-none border-x-0 border-b-0 p-0 md:hidden">
                    <DialogHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-xl">Filters</DialogTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Narrow expenses by assignment, type, and status.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                aria-label="Close filters"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
                        <ExpenseFilters
                            advancedOnly
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

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={resetAllFilters}>
                                Reset filters
                            </Button>
                            <Button onClick={() => setIsMobileFiltersOpen(false)}>
                                Apply filters
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Expenses;
