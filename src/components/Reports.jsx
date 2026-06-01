import { useEffect, useMemo, useState } from 'react';
import { endOfDay, startOfDay } from 'date-fns';
import { useUrlState } from '@/hooks/useUrlState.ts';
import { useInvoices } from '@/hooks/useInvoices.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useTimeEntries } from '@/hooks/useTimeEntries.ts';
import { useTasks } from '@/hooks/useTasks.ts';
import { useProjects } from '@/hooks/useProjects.ts';
import { useClients } from '@/hooks/useClients.ts';
import { useBusinessInfos } from '@/hooks/useBusinessInfos.ts';
import { useBusinessBrandAssets } from '@/hooks/useBusinessBrandAssets.ts';
import { useExpenseCategories } from '@/hooks/useExpenseCategories.ts';
import { useTaxReturnPeriods } from '@/hooks/useTaxReturnPeriods.ts';
import { useToast } from '@/hooks/useToast.ts';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import CustomCheckbox from '@/components/CustomCheckbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowDownTrayIcon, ChartBarIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, HandCoinsIcon, ReceiptTextIcon, SheetIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import useCurrencyConversion from '@/components/dashboard/hooks/useCurrencyConversion';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportSummaryCards from '@/components/reports/ReportSummaryCards';
import { buildClientStatementSummary, buildExpenseTotalsSummary, buildInvoiceRegisterSummary, buildOutstandingInvoiceSummary, buildProjectWorkSummary, buildVatReportSummary, getExpenseNetAmount, getExpenseTaxAmount, getExpenseTaxClaimStatus, getExpenseTaxClaimStatusLabel, getInvoiceDaysOverdue } from '@/utils/reportCalculations';
import { buildCsvContent, downloadCsvFile } from '@/utils/reportCsvUtils';
import { REPORT_PERIOD_OPTIONS, getDateRangeLabel, getDefaultCustomRange, getDefaultReportPeriod, resolveReportDateRange } from '@/utils/reportDateUtils';
import { ACCOUNTANT_PACK_MANIFEST_COLUMNS, buildAccountantPackManifestRows } from '@/utils/reportPackUtils';
import { downloadZipFile } from '@/utils/reportZipUtils';
import { formatCurrency, getProjectCurrency } from '@/utils/currencyUtils';
import { formatDuration, millisecondsToHours, parseStoredDate, toDisplayDate, toStorageDate } from '@/utils/dateUtils';
import { getInvoicePaidAtTimestamp, getInvoiceProjectFinancials, getInvoiceProjectRevenueBreakdown, getInvoiceProjectTitle, getInvoiceStatus, getInvoiceTotal, invoiceBelongsToProject, isInvoiceOverdue, isInvoicePaid } from '@/utils/invoiceUtils';
import { buildMonthlyReportHtml, exportClientStatementPdf, exportExpensesReportPdf, exportInvoicesReportPdf, exportMonthlyReportPdf, exportOutstandingReportPdf, exportProjectWorkSummaryPdf } from '@/utils/reportPdfUtils';
import { generatePDFBlob, getCurrentInvoiceHtmlContent } from '@/utils/pdfUtils.ts';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';

const REPORT_TABS = [
    { value: 'overview', label: 'Overview', icon: ChartBarIcon },
    { value: 'monthly', label: 'Monthly', icon: ReceiptTextIcon },
    { value: 'statement', label: 'Statement', icon: ReceiptTextIcon },
    { value: 'work-summary', label: 'Work Summary', icon: ReceiptTextIcon },
    { value: 'tax', label: 'Tax', icon: SheetIcon },
    { value: 'invoices', label: 'Invoices', icon: DocumentTextIcon },
    { value: 'outstanding', label: 'Outstanding', icon: DocumentTextIcon },
    { value: 'expenses', label: 'Expenses', icon: HandCoinsIcon },
    { value: 'hours', label: 'Hours', icon: ClockIcon },
];

const REPORT_HEADER_CONTENT = {
    overview: {
        title: 'Reports',
        description: 'Filter once, review key totals at a glance, and export the current slice.',
    },
    monthly: {
        title: 'Monthly Summary',
        description: 'Review the period summary, spot missing data, and export the monthly accounting pack.',
    },
    statement: {
        title: 'Client Statement',
        description: 'See opening balance, activity, payments, and closing balance for the selected client.',
    },
    'work-summary': {
        title: 'Project Work Summary',
        description: 'Summarize worked time by task so you can share a clear project activity report with a client.',
    },
    tax: {
        title: 'VAT / Tax Summary',
        description: 'Review sales tax, expense tax, claim status, and geography breakdowns for the current slice.',
    },
    invoices: {
        title: 'Issued Invoices',
        description: 'Inspect invoice totals, statuses, and register summaries, then export the filtered invoice list.',
    },
    outstanding: {
        title: 'Outstanding / Aging',
        description: 'Track open invoices, overdue balances, and aging buckets as of the selected report date.',
    },
    expenses: {
        title: 'Expenses',
        description: 'Review categorized expenses, tax treatment, and claim state, then mark selected items as claimed.',
    },
    hours: {
        title: 'Hours Worked',
        description: 'Analyze logged time by project and client, including billable and still-unbilled hours.',
    },
    'to-invoice': {
        title: 'To Invoice',
        description: 'Review uninvoiced time and billable expenses without mutating billing state or creating invoices.',
    },
};

const EMPTY_BUSINESS = 'Unassigned';
const EMPTY_CLIENT = 'No client';
const EMPTY_PROJECT = 'No project';
const EMPTY_CATEGORY = 'No category';
const NEW_TAX_RETURN_PERIOD_VALUE = '__new_tax_return_period__';
const REPORTS_LOADER_SETTLE_DELAY_MS = 120;

const formatPercent = (value) => `${value.toFixed(0)}%`;
const slugifyFilePart = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'statement';
const createTaxReturnPeriodDraft = (resolvedRange) => ({
    title: `${getDateRangeLabel(resolvedRange)} VAT return`,
    type: 'vat',
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
    notes: '',
});

const sumAmountsByCurrency = (items, getCurrency, getAmount) => {
    return items.reduce((totals, item) => {
        const currency = getCurrency(item);
        const amount = getAmount(item);

        if (!currency || !Number.isFinite(amount) || amount === 0) {
            return totals;
        }

        totals[currency] = (totals[currency] || 0) + amount;
        return totals;
    }, {});
};

const addCurrencyAmount = (totals, currency, amount) => {
    if (!currency || !Number.isFinite(amount) || amount === 0) {
        return;
    }

    totals[currency] = (totals[currency] || 0) + amount;
};

const subtractCurrencyTotals = (leftTotals, rightTotals) => {
    const result = {};

    Object.entries(leftTotals).forEach(([currency, amount]) => {
        addCurrencyAmount(result, currency, amount);
    });

    Object.entries(rightTotals).forEach(([currency, amount]) => {
        addCurrencyAmount(result, currency, -amount);
    });

    return result;
};

const addCurrencyTotals = (...currencyTotals) => {
    const result = {};

    currencyTotals.forEach((totals) => {
        Object.entries(totals).forEach(([currency, amount]) => {
            addCurrencyAmount(result, currency, amount);
        });
    });

    return result;
};

const matchesStoredDateRange = (dateValue, startDate, endDate) => {
    if (!dateValue) {
        return false;
    }

    return dateValue >= startDate && dateValue <= endDate;
};

const getTimestampDateString = (timestamp) => {
    return typeof timestamp === 'number' ? toStorageDate(timestamp) : null;
};

const getInvoicePaymentDateString = (invoice) => {
    return getTimestampDateString(getInvoicePaidAtTimestamp(invoice));
};

const getInvoicePaymentDisplayDate = (invoice) => {
    const paidAt = getInvoicePaidAtTimestamp(invoice);

    return typeof paidAt === 'number' ? toDisplayDate(paidAt) : '';
};

const getStatusBadgeVariant = (status) => {
    if (status === 'paid') return 'success';
    if (status === 'overdue') return 'error';
    if (status === 'draft') return 'warning';
    return 'secondary';
};

const formatCurrencyBreakdown = ({ amountsByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) => {
    const entries = Object.entries(amountsByCurrency).filter(([, amount]) => Number.isFinite(amount) && amount !== 0);

    if (entries.length === 0) {
        return formatCurrency(0, preferredCurrency);
    }

    if (currencyDisplayMode === 'source') {
        return entries
            .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
            .map(([currency, amount]) => formatCurrency(amount, currency))
            .join(' + ');
    }

    const converted = convertToCurrency(amountsByCurrency);
    if (converted.hadConversionError) {
        return entries
            .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
            .map(([currency, amount]) => formatCurrency(amount, currency))
            .join(' + ');
    }

    const total = Object.values(converted.amounts).reduce((sum, amount) => sum + amount, 0);
    return formatCurrency(total, preferredCurrency);
};

const getCurrencyBreakdownSortTotal = ({ amountsByCurrency, convertToCurrency }) => {
    const converted = convertToCurrency(amountsByCurrency);
    const amounts = converted.hadConversionError ? amountsByCurrency : converted.amounts;

    return Object.values(amounts).reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0);
};

const downloadReport = ({ filename, columns, rows }) => {
    const content = buildCsvContent(columns, rows);
    downloadCsvFile(filename, content);
};

const buildCsvZipEntries = (reports) => {
    return reports.map(({ filename, columns, rows }) => ({
        filename,
        content: buildCsvContent(columns, rows),
    }));
};

const scopeInvoiceToProject = (invoice, projectId, projectsById) => {
    if (!projectId || projectId === 'all') {
        return invoice;
    }

    const projectFinancials = getInvoiceProjectFinancials(invoice, projectId);

    if (!projectFinancials) {
        return null;
    }

    const project = projectsById.get(projectId);

    return {
        ...invoice,
        projectId,
        projectIds: [projectId],
        project: project ? { ...(invoice.project || {}), id: projectId, title: project.title } : invoice.project,
        projectBreakdowns: [{
            projectId,
            projectTitle: projectFinancials.projectTitle || project?.title || '',
            clientId: invoice.clientId,
            pricingMode: 'mixed',
            totalHours: projectFinancials.totalHours || 0,
            subtotal: projectFinancials.subtotal || 0,
            allocatedDiscount: projectFinancials.allocatedDiscount || 0,
            allocatedShipping: projectFinancials.allocatedShipping || 0,
            allocatedTax: projectFinancials.allocatedTax || 0,
            allocatedTotal: projectFinancials.allocatedTotal || 0,
        }],
        subtotal: projectFinancials.subtotal || 0,
        tax: projectFinancials.allocatedTax || 0,
        total: projectFinancials.allocatedTotal || 0,
        totalHours: projectFinancials.totalHours || 0,
    };
};

const buildExportFileName = (prefix, startDate, endDate) => `${prefix}-${startDate}-to-${endDate}.csv`;

const MONTHLY_SUMMARY_EXPORT_COLUMNS = [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
];

const TAX_EXPORT_COLUMNS = [
    { key: 'section', header: 'Section' },
    { key: 'label', header: 'Label' },
    { key: 'currency', header: 'Currency' },
    { key: 'grossAmount', header: 'Gross Amount' },
    { key: 'netAmount', header: 'Net Amount' },
    { key: 'taxAmount', header: 'Tax Amount' },
    { key: 'count', header: 'Count' },
];

const INVOICES_EXPORT_COLUMNS = [
    { key: 'invoiceNumber', header: 'Invoice Number' },
    { key: 'client', header: 'Client' },
    { key: 'business', header: 'Business' },
    { key: 'invoiceDate', header: 'Invoice Date' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'paidDate', header: 'Paid Date' },
    { key: 'status', header: 'Status' },
    { key: 'currency', header: 'Currency' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'tax', header: 'Tax' },
    { key: 'total', header: 'Total' },
    { key: 'project', header: 'Project' },
];

const OUTSTANDING_EXPORT_COLUMNS = [
    { key: 'invoiceNumber', header: 'Invoice Number' },
    { key: 'client', header: 'Client' },
    { key: 'business', header: 'Business' },
    { key: 'project', header: 'Project' },
    { key: 'invoiceDate', header: 'Invoice Date' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'status', header: 'Status' },
    { key: 'daysOverdue', header: 'Days Overdue' },
    { key: 'currency', header: 'Currency' },
    { key: 'total', header: 'Total' },
];

const EXPENSES_EXPORT_COLUMNS = [
    { key: 'date', header: 'Date' },
    { key: 'paidDate', header: 'Paid Date' },
    { key: 'title', header: 'Title' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'category', header: 'Category' },
    { key: 'business', header: 'Business' },
    { key: 'client', header: 'Client' },
    { key: 'project', header: 'Project' },
    { key: 'currency', header: 'Currency' },
    { key: 'amount', header: 'Amount' },
    { key: 'taxAmount', header: 'Tax Amount' },
    { key: 'paymentStatus', header: 'Payment Status' },
    { key: 'billingStatus', header: 'Billing Status' },
    { key: 'claimStatus', header: 'Claim Status' },
    { key: 'claimPeriod', header: 'Claim Period' },
];

const HOURS_EXPORT_COLUMNS = [
    { key: 'project', header: 'Project' },
    { key: 'client', header: 'Client' },
    { key: 'entries', header: 'Entries' },
    { key: 'totalHours', header: 'Total Hours' },
    { key: 'billableHours', header: 'Billable Hours' },
    { key: 'unbilledBillableHours', header: 'Unbilled Billable Hours' },
];

const TIME_ENTRIES_EXPORT_COLUMNS = [
    { key: 'date', header: 'Date' },
    { key: 'startTime', header: 'Start Time' },
    { key: 'endTime', header: 'End Time' },
    { key: 'task', header: 'Task' },
    { key: 'project', header: 'Project' },
    { key: 'client', header: 'Client' },
    { key: 'billable', header: 'Billable' },
    { key: 'durationHours', header: 'Duration Hours' },
    { key: 'billableHours', header: 'Billable Hours' },
    { key: 'billedInvoiceNumber', header: 'Billed Invoice Number' },
    { key: 'note', header: 'Note' },
];

const TO_INVOICE_EXPORT_COLUMNS = [
    { key: 'client', header: 'Client' },
    { key: 'project', header: 'Project' },
    { key: 'uninvoicedHours', header: 'Uninvoiced Hours' },
    { key: 'expenseCount', header: 'Expense Count' },
    { key: 'expenseAmount', header: 'Expense Amount' },
    { key: 'estimatedAmount', header: 'Estimated Amount' },
];

const REVIEW_CHECKLIST_EXPORT_COLUMNS = [
    { key: 'issue', header: 'Issue' },
    { key: 'scope', header: 'Scope' },
    { key: 'count', header: 'Count' },
];

const REPORT_FILTER_DEFAULTS = {
    businessId: 'all',
    clientId: 'all',
    projectId: 'all',
    categoryId: 'all',
    invoiceStatus: 'non-draft',
    expenseStatus: 'all',
    incomeDateBasis: 'invoice-date',
    expenseDateBasis: 'expense-date',
    currencyDisplayMode: 'preferred',
};

const buildSectionClassName = (isMobileLayout) => cn(isMobileLayout ? 'space-y-4' : 'space-y-6');

function ReportSection({
    title,
    action,
    children,
}) {
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

const buildBreakdownRows = ({
    items,
    getLabel,
    getAmount,
    getCurrency,
    convertToCurrency,
    currencyDisplayMode,
    preferredCurrency,
    limit = 5,
}) => {
    const grouped = items.reduce((map, item) => {
        const label = getLabel(item);
        const amount = getAmount(item);
        const currency = getCurrency(item);

        if (!label || !currency || !Number.isFinite(amount) || amount === 0) {
            return map;
        }

        const totals = map.get(label) || {};
        addCurrencyAmount(totals, currency, amount);
        map.set(label, totals);

        return map;
    }, new Map());

    return Array.from(grouped.entries())
        .sort(([, totalsA], [, totalsB]) => {
            return getCurrencyBreakdownSortTotal({ amountsByCurrency: totalsB, convertToCurrency })
                - getCurrencyBreakdownSortTotal({ amountsByCurrency: totalsA, convertToCurrency });
        })
        .slice(0, limit)
        .map(([label, amountsByCurrency]) => ({
            label,
            value: formatCurrencyBreakdown({
                amountsByCurrency,
                convertToCurrency,
                currencyDisplayMode,
                preferredCurrency,
            }),
        }));
};

function Reports({ onReadyChange = null }) {
    const isMobileLayout = useIsMobileLayout();
    const { urlParams, updateUrl } = useUrlState();
    const { showError, showSuccess } = useToast();
    const { invoices } = useInvoices({ includeArchived: true });
    const {
        expenses,
        markManyAsClaimed,
        markManyAsUnclaimed,
    } = useExpenses({ includeArchived: true });
    const { projects } = useProjects();
    const { clients } = useClients();
    const { businessInfos } = useBusinessInfos();
    const { businessBrandAssets } = useBusinessBrandAssets();
    const { allExpenseCategories } = useExpenseCategories();
    const {
        taxReturnPeriods,
        createTaxReturnPeriod,
    } = useTaxReturnPeriods();
    const { activeTasks, archivedTasks } = useTasks({ includeArchived: true });
    const [period, setPeriod] = useState(getDefaultReportPeriod);
    const [customRange] = useState(() => getDefaultCustomRange());
    const [customStart, setCustomStart] = useState(customRange.customStart);
    const [customEnd, setCustomEnd] = useState(customRange.customEnd);
    const [businessId, setBusinessId] = useState(REPORT_FILTER_DEFAULTS.businessId);
    const [clientId, setClientId] = useState(REPORT_FILTER_DEFAULTS.clientId);
    const [projectId, setProjectId] = useState(REPORT_FILTER_DEFAULTS.projectId);
    const [categoryId, setCategoryId] = useState(REPORT_FILTER_DEFAULTS.categoryId);
    const [invoiceStatus, setInvoiceStatus] = useState(REPORT_FILTER_DEFAULTS.invoiceStatus);
    const [expenseStatus, setExpenseStatus] = useState(REPORT_FILTER_DEFAULTS.expenseStatus);
    const [incomeDateBasis, setIncomeDateBasis] = useState(REPORT_FILTER_DEFAULTS.incomeDateBasis);
    const [expenseDateBasis, setExpenseDateBasis] = useState(REPORT_FILTER_DEFAULTS.expenseDateBasis);
    const [currencyDisplayMode, setCurrencyDisplayMode] = useState(REPORT_FILTER_DEFAULTS.currencyDisplayMode);
    const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
    const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

    const resolvedRange = useMemo(() => {
        return resolveReportDateRange({
            period,
            customStart,
            customEnd,
        });
    }, [period, customStart, customEnd]);
    const [claimPeriodDraft, setClaimPeriodDraft] = useState(() => createTaxReturnPeriodDraft(resolvedRange));
    const [selectedTaxReturnPeriodId, setSelectedTaxReturnPeriodId] = useState(NEW_TAX_RETURN_PERIOD_VALUE);

    const reportReferenceDate = useMemo(() => {
        return endOfDay(parseStoredDate(resolvedRange.endDate) || new Date());
    }, [resolvedRange.endDate]);

    const {
        preferredCurrency,
        convertToCurrency,
        exchangeRatesError,
        missingExchangeRates,
    } = useCurrencyConversion({ projects, invoices, clients });

    const { entries: timeEntries, isLoadingMore: loadingHistoricalEntries } = useTimeEntries({
        startDate: startOfDay(parseStoredDate(resolvedRange.startDate) || new Date()).getTime(),
        endDate: endOfDay(parseStoredDate(resolvedRange.endDate) || new Date()).getTime(),
    });
    const [isReportContentPaintReady, setIsReportContentPaintReady] = useState(false);

    useEffect(() => {
        if (loadingHistoricalEntries) {
            setIsReportContentPaintReady(false);
            return;
        }

        const scheduleFrame = globalThis.requestAnimationFrame
            ? globalThis.requestAnimationFrame.bind(globalThis)
            : (callback) => window.setTimeout(callback, 16);
        const cancelFrame = globalThis.cancelAnimationFrame
            ? globalThis.cancelAnimationFrame.bind(globalThis)
            : (handle) => window.clearTimeout(handle);

        let secondFrameHandle = 0;
        let settleTimeoutHandle = 0;
        const firstFrameHandle = scheduleFrame(() => {
            secondFrameHandle = scheduleFrame(() => {
                settleTimeoutHandle = window.setTimeout(() => {
                    setIsReportContentPaintReady(true);
                }, REPORTS_LOADER_SETTLE_DELAY_MS);
            });
        });

        return () => {
            cancelFrame(firstFrameHandle);
            if (secondFrameHandle) {
                cancelFrame(secondFrameHandle);
            }
            if (settleTimeoutHandle) {
                window.clearTimeout(settleTimeoutHandle);
            }
        };
    }, [loadingHistoricalEntries]);

    useEffect(() => {
        onReadyChange?.(!loadingHistoricalEntries && isReportContentPaintReady);
    }, [isReportContentPaintReady, loadingHistoricalEntries, onReadyChange]);

    const allTasks = useMemo(() => [...activeTasks, ...archivedTasks], [activeTasks, archivedTasks]);
    const invoicesById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
    const tasksById = useMemo(() => new Map(allTasks.map((task) => [task.id, task])), [allTasks]);
    const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
    const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
    const businessInfosById = useMemo(() => new Map(businessInfos.map((businessInfo) => [businessInfo.id, businessInfo])), [businessInfos]);
    const expenseCategoriesById = useMemo(() => new Map(allExpenseCategories.map((category) => [category.id, category])), [allExpenseCategories]);
    const taxReturnPeriodsById = useMemo(() => new Map(taxReturnPeriods.map((period) => [period.id, period])), [taxReturnPeriods]);

    const activeTab = urlParams.section || 'overview';
    const headerContent = REPORT_HEADER_CONTENT[activeTab] || REPORT_HEADER_CONTENT.overview;

    useEffect(() => {
        if (!urlParams.section) {
            updateUrl({ section: 'overview' });
        }
    }, [updateUrl, urlParams.section]);

    const handleSectionChange = (section) => {
        updateUrl({ section, create: null, tab: null });
    };

    const handleResetFilters = () => {
        const defaultCustomRange = getDefaultCustomRange();

        setPeriod(getDefaultReportPeriod());
        setCustomStart(defaultCustomRange.customStart);
        setCustomEnd(defaultCustomRange.customEnd);
        setBusinessId(REPORT_FILTER_DEFAULTS.businessId);
        setClientId(REPORT_FILTER_DEFAULTS.clientId);
        setProjectId(REPORT_FILTER_DEFAULTS.projectId);
        setCategoryId(REPORT_FILTER_DEFAULTS.categoryId);
        setInvoiceStatus(REPORT_FILTER_DEFAULTS.invoiceStatus);
        setExpenseStatus(REPORT_FILTER_DEFAULTS.expenseStatus);
        setIncomeDateBasis(REPORT_FILTER_DEFAULTS.incomeDateBasis);
        setExpenseDateBasis(REPORT_FILTER_DEFAULTS.expenseDateBasis);
        setCurrencyDisplayMode(REPORT_FILTER_DEFAULTS.currencyDisplayMode);
        setSelectedExpenseIds([]);
    };

    const activeClients = useMemo(() => {
        return clients.filter((client) => !client.archived);
    }, [clients]);

    const activeProjects = useMemo(() => {
        return projects.filter((project) => !project.archived);
    }, [projects]);

    const availableProjects = useMemo(() => {
        if (clientId === 'all') {
            return activeProjects;
        }

        return activeProjects.filter((project) => project.preferredClientId === clientId);
    }, [activeProjects, clientId]);

    useEffect(() => {
        if (projectId !== 'all' && !availableProjects.some((project) => project.id === projectId)) {
            setProjectId('all');
        }
    }, [availableProjects, projectId]);

    useEffect(() => {
        setClaimPeriodDraft((current) => {
            if (isClaimDialogOpen) {
                return current;
            }

            return createTaxReturnPeriodDraft(resolvedRange);
        });
    }, [isClaimDialogOpen, resolvedRange]);

    const availableTaxReturnPeriods = useMemo(() => {
        return taxReturnPeriods.filter((taxReturnPeriod) => {
            if (businessId === 'all') {
                return true;
            }

            return (taxReturnPeriod.businessInfoId || '') === businessId;
        });
    }, [businessId, taxReturnPeriods]);

    const entityFilteredInvoices = useMemo(() => {
        return invoices.filter((invoice) => {
            if (businessId !== 'all' && (invoice.businessInfoId || '') !== businessId) {
                return false;
            }

            if (clientId !== 'all' && invoice.clientId !== clientId) {
                return false;
            }

            if (projectId !== 'all' && !invoiceBelongsToProject(invoice, projectId)) {
                return false;
            }

            const status = getInvoiceStatus(invoice);
            if (invoiceStatus === 'non-draft' && status === 'draft') {
                return false;
            }
            if (invoiceStatus === 'paid' && !isInvoicePaid(invoice)) {
                return false;
            }
            if (invoiceStatus === 'unpaid' && (isInvoicePaid(invoice) || status === 'draft')) {
                return false;
            }
            if (invoiceStatus === 'overdue' && !isInvoiceOverdue(invoice)) {
                return false;
            }
            if (invoiceStatus === 'draft' && status !== 'draft') {
                return false;
            }

            return true;
        });
    }, [businessId, clientId, invoiceStatus, invoices, projectId]);

    const scopedEntityFilteredInvoices = useMemo(() => {
        if (projectId === 'all') {
            return entityFilteredInvoices;
        }

        return entityFilteredInvoices
            .map((invoice) => scopeInvoiceToProject(invoice, projectId, projectsById))
            .filter(Boolean);
    }, [entityFilteredInvoices, projectId, projectsById]);

    const statementClientIds = useMemo(() => {
        return Array.from(new Set(
            scopedEntityFilteredInvoices
                .map((invoice) => invoice.clientId)
                .filter(Boolean)
        ));
    }, [scopedEntityFilteredInvoices]);

    const selectedStatementClientId = clientId !== 'all'
        ? clientId
        : (statementClientIds.length === 1 ? statementClientIds[0] : null);

    const statementClient = selectedStatementClientId ? clientsById.get(selectedStatementClientId) : null;

    const statementInvoices = useMemo(() => {
        if (!selectedStatementClientId) {
            return [];
        }

        return scopedEntityFilteredInvoices.filter((invoice) => invoice.clientId === selectedStatementClientId);
    }, [scopedEntityFilteredInvoices, selectedStatementClientId]);

    const filteredInvoices = useMemo(() => {
        return scopedEntityFilteredInvoices.filter((invoice) => {
            const dateValue = incomeDateBasis === 'paid-date'
                ? getInvoicePaymentDateString(invoice)
                : invoice.date;

            return matchesStoredDateRange(dateValue, resolvedRange.startDate, resolvedRange.endDate);
        });
    }, [incomeDateBasis, resolvedRange.endDate, resolvedRange.startDate, scopedEntityFilteredInvoices]);

    const issuedInvoicesInRange = useMemo(() => {
        return scopedEntityFilteredInvoices.filter((invoice) => matchesStoredDateRange(invoice.date, resolvedRange.startDate, resolvedRange.endDate));
    }, [resolvedRange.endDate, resolvedRange.startDate, scopedEntityFilteredInvoices]);

    const paidInvoicesInRange = useMemo(() => {
        return scopedEntityFilteredInvoices.filter((invoice) => {
            if (!isInvoicePaid(invoice)) {
                return false;
            }

            return matchesStoredDateRange(getInvoicePaymentDateString(invoice), resolvedRange.startDate, resolvedRange.endDate);
        });
    }, [resolvedRange.endDate, resolvedRange.startDate, scopedEntityFilteredInvoices]);

    const outstandingInvoices = useMemo(() => {
        return scopedEntityFilteredInvoices.filter((invoice) => {
            if (isInvoicePaid(invoice) || getInvoiceStatus(invoice) === 'draft') {
                return false;
            }

            return invoice.date <= resolvedRange.endDate;
        });
    }, [resolvedRange.endDate, scopedEntityFilteredInvoices]);

    const overdueInvoices = useMemo(() => {
        return outstandingInvoices.filter((invoice) => isInvoiceOverdue(invoice, reportReferenceDate));
    }, [outstandingInvoices, reportReferenceDate]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            if (businessId !== 'all' && (expense.businessId || '') !== businessId) {
                return false;
            }

            if (clientId !== 'all' && (expense.clientId || '') !== clientId) {
                return false;
            }

            if (projectId !== 'all' && (expense.projectId || '') !== projectId) {
                return false;
            }

            if (categoryId !== 'all' && (expense.categoryId || '') !== categoryId) {
                return false;
            }

            if (expenseStatus === 'paid' && expense.paymentStatus !== 'paid') {
                return false;
            }

            if (expenseStatus === 'unpaid' && expense.paymentStatus !== 'unpaid') {
                return false;
            }

            const taxClaimStatus = getExpenseTaxClaimStatus(expense);
            if (expenseStatus === 'claimed' && taxClaimStatus !== 'claimed') {
                return false;
            }

            if (expenseStatus === 'unclaimed' && taxClaimStatus !== 'unclaimed') {
                return false;
            }

            if (expenseStatus === 'excluded' && taxClaimStatus !== 'excluded') {
                return false;
            }

            const dateValue = expenseDateBasis === 'paid-date'
                ? expense.paidOn
                : expense.date;

            return matchesStoredDateRange(dateValue, resolvedRange.startDate, resolvedRange.endDate);
        });
    }, [businessId, categoryId, clientId, expenseDateBasis, expenseStatus, expenses, projectId, resolvedRange.endDate, resolvedRange.startDate]);

    const selectedExpenses = useMemo(() => {
        const selectedIds = new Set(selectedExpenseIds);
        return filteredExpenses.filter((expense) => selectedIds.has(expense.id));
    }, [filteredExpenses, selectedExpenseIds]);

    useEffect(() => {
        const visibleExpenseIds = new Set(filteredExpenses.map((expense) => expense.id));

        setSelectedExpenseIds((current) => {
            const next = current.filter((id) => visibleExpenseIds.has(id));

            if (next.length === current.length) {
                return current;
            }

            return next;
        });
    }, [filteredExpenses]);

    const toggleExpenseSelection = (expenseId, checked) => {
        setSelectedExpenseIds((current) => {
            if (checked) {
                return current.includes(expenseId) ? current : [...current, expenseId];
            }

            return current.filter((id) => id !== expenseId);
        });
    };

    const toggleAllExpensesSelection = (checked) => {
        setSelectedExpenseIds(checked ? filteredExpenses.map((expense) => expense.id) : []);
    };

    const selectedExpenseCount = selectedExpenses.length;
    const allFilteredExpensesSelected = filteredExpenses.length > 0 && selectedExpenseCount === filteredExpenses.length;

    const openClaimDialog = () => {
        if (selectedExpenseCount === 0) {
            showError('Select at least one expense to claim');
            return;
        }

        const matchingPeriod = availableTaxReturnPeriods.find((taxReturnPeriod) => {
            return taxReturnPeriod.startDate === resolvedRange.startDate
                && taxReturnPeriod.endDate === resolvedRange.endDate
                && (businessId === 'all' || (taxReturnPeriod.businessInfoId || '') === businessId);
        });

        setSelectedTaxReturnPeriodId(matchingPeriod?.id || NEW_TAX_RETURN_PERIOD_VALUE);
        setClaimPeriodDraft(createTaxReturnPeriodDraft(resolvedRange));
        setIsClaimDialogOpen(true);
    };

    const closeClaimDialog = () => {
        setIsClaimDialogOpen(false);
        setSelectedTaxReturnPeriodId(NEW_TAX_RETURN_PERIOD_VALUE);
        setClaimPeriodDraft(createTaxReturnPeriodDraft(resolvedRange));
    };

    const markSelectedExpensesAsClaimed = () => {
        if (selectedExpenseCount === 0) {
            showError('Select at least one expense to claim');
            return;
        }

        let taxReturnPeriodId = selectedTaxReturnPeriodId;

        if (taxReturnPeriodId === NEW_TAX_RETURN_PERIOD_VALUE) {
            const trimmedTitle = claimPeriodDraft.title.trim();

            if (!trimmedTitle) {
                showError('Tax return period title is required');
                return;
            }

            if (!claimPeriodDraft.startDate || !claimPeriodDraft.endDate) {
                showError('Tax return period dates are required');
                return;
            }

            if (claimPeriodDraft.endDate < claimPeriodDraft.startDate) {
                showError('Tax return period end date must be after the start date');
                return;
            }

            const createdTaxReturnPeriod = createTaxReturnPeriod({
                title: trimmedTitle,
                type: claimPeriodDraft.type,
                startDate: claimPeriodDraft.startDate,
                endDate: claimPeriodDraft.endDate,
                businessInfoId: businessId === 'all' ? null : businessId,
                status: 'draft',
                notes: claimPeriodDraft.notes.trim() || null,
            });

            taxReturnPeriodId = createdTaxReturnPeriod.id;
        }

        markManyAsClaimed(selectedExpenses.map((expense) => expense.id), taxReturnPeriodId);
        showSuccess(`${selectedExpenseCount} expense${selectedExpenseCount === 1 ? '' : 's'} marked as claimed`);
        setSelectedExpenseIds([]);
        closeClaimDialog();
    };

    const markSelectedExpensesAsUnclaimed = () => {
        if (selectedExpenseCount === 0) {
            showError('Select at least one expense to unclaim');
            return;
        }

        markManyAsUnclaimed(selectedExpenses.map((expense) => expense.id));
        showSuccess(`${selectedExpenseCount} expense${selectedExpenseCount === 1 ? '' : 's'} marked as unclaimed`);
        setSelectedExpenseIds([]);
    };

    const filteredTimeEntries = useMemo(() => {
        return timeEntries
            .map((entry) => {
                const task = tasksById.get(entry.taskId);
                const project = task?.projectId ? projectsById.get(task.projectId) : null;
                const client = project?.preferredClientId ? clientsById.get(project.preferredClientId) : null;

                return {
                    ...entry,
                    task: task || null,
                    project: project || null,
                    client: client || null,
                };
            })
            .filter((entry) => {
                if (!entry.task) {
                    return false;
                }

                if (projectId !== 'all' && entry.project?.id !== projectId) {
                    return false;
                }

                if (clientId !== 'all' && entry.client?.id !== clientId) {
                    return false;
                }

                return true;
            });
    }, [clientId, clientsById, projectId, projectsById, tasksById, timeEntries]);

    const workSummaryProjectIds = useMemo(() => {
        return Array.from(new Set(
            filteredTimeEntries
                .map((entry) => entry.project?.id)
                .filter(Boolean)
        ));
    }, [filteredTimeEntries]);

    const selectedWorkSummaryProjectId = projectId !== 'all'
        ? projectId
        : (workSummaryProjectIds.length === 1 ? workSummaryProjectIds[0] : null);

    const workSummaryProject = selectedWorkSummaryProjectId ? projectsById.get(selectedWorkSummaryProjectId) : null;
    const workSummaryClient = workSummaryProject?.preferredClientId ? clientsById.get(workSummaryProject.preferredClientId) : null;

    const workSummaryEntries = useMemo(() => {
        if (!selectedWorkSummaryProjectId) {
            return [];
        }

        return filteredTimeEntries.filter((entry) => entry.project?.id === selectedWorkSummaryProjectId);
    }, [filteredTimeEntries, selectedWorkSummaryProjectId]);

    const hoursRows = useMemo(() => {
        const grouped = new Map();

        filteredTimeEntries.forEach((entry) => {
            const projectKey = entry.project?.id || `task:${entry.task.id}`;
            const existing = grouped.get(projectKey) || {
                key: projectKey,
                projectTitle: entry.project?.title || entry.task.title || EMPTY_PROJECT,
                clientTitle: entry.client?.title || EMPTY_CLIENT,
                totalMs: 0,
                billableMs: 0,
                unbilledBillableMs: 0,
                entriesCount: 0,
            };

            const actualMs = Math.max(0, (entry.end || 0) - entry.start);
            const billableMs = entry.task.billable ? getBillableDurationMs(entry) : 0;
            const unbilledBillableMs = entry.task.billable && !entry.billedInvoiceId ? billableMs : 0;

            existing.totalMs += actualMs;
            existing.billableMs += billableMs;
            existing.unbilledBillableMs += unbilledBillableMs;
            existing.entriesCount += 1;

            grouped.set(projectKey, existing);
        });

        return Array.from(grouped.values()).sort((rowA, rowB) => rowB.totalMs - rowA.totalMs);
    }, [filteredTimeEntries]);

    const unbilledExpenseRows = useMemo(() => {
        return filteredExpenses.filter((expense) => expense.billable && expense.billingStatus === 'unbilled');
    }, [filteredExpenses]);

    const toInvoiceRows = useMemo(() => {
        const grouped = new Map();

        hoursRows.forEach((row) => {
            const project = activeProjects.find((item) => item.title === row.projectTitle)
                || activeProjects.find((item) => item.id === row.key);
            const hourlyRate = typeof project?.hourlyRate === 'number' ? project.hourlyRate : 0;
            const projectCurrency = project ? getProjectCurrency(project, clients) : preferredCurrency;
            const estimatedAmount = hourlyRate > 0
                ? Math.round(millisecondsToHours(row.unbilledBillableMs) * hourlyRate * 100) / 100
                : 0;
            const estimatedAmountsByCurrency = {};
            addCurrencyAmount(estimatedAmountsByCurrency, projectCurrency, estimatedAmount);

            grouped.set(row.key, {
                key: row.key,
                clientTitle: row.clientTitle,
                projectTitle: row.projectTitle,
                uninvoicedHoursMs: row.unbilledBillableMs,
                expenseAmountsByCurrency: {},
                expenseCount: 0,
                estimatedAmountsByCurrency,
                hourlyRate,
            });
        });

        unbilledExpenseRows.forEach((expense) => {
            const key = expense.projectId || `expense-client:${expense.clientId || 'none'}`;
            const current = grouped.get(key) || {
                key,
                clientTitle: expense.clientId ? (clientsById.get(expense.clientId)?.title || EMPTY_CLIENT) : EMPTY_CLIENT,
                projectTitle: expense.projectId ? (projectsById.get(expense.projectId)?.title || EMPTY_PROJECT) : EMPTY_PROJECT,
                uninvoicedHoursMs: 0,
                expenseAmountsByCurrency: {},
                expenseCount: 0,
                estimatedAmountsByCurrency: {},
                hourlyRate: 0,
            };

            addCurrencyAmount(current.expenseAmountsByCurrency, expense.currency || preferredCurrency, expense.amount || 0);
            current.expenseCount += 1;
            grouped.set(key, current);
        });

        return Array.from(grouped.values())
            .map((row) => ({
                ...row,
                totalAmountsByCurrency: addCurrencyTotals(row.estimatedAmountsByCurrency, row.expenseAmountsByCurrency),
            }))
            .filter((row) => row.uninvoicedHoursMs > 0 || Object.keys(row.expenseAmountsByCurrency).length > 0)
            .sort((rowA, rowB) => {
                return getCurrencyBreakdownSortTotal({ amountsByCurrency: rowB.totalAmountsByCurrency, convertToCurrency })
                    - getCurrencyBreakdownSortTotal({ amountsByCurrency: rowA.totalAmountsByCurrency, convertToCurrency });
            });
    }, [activeProjects, clients, clientsById, convertToCurrency, hoursRows, preferredCurrency, projectsById, unbilledExpenseRows]);

    const missingDataReviewCount = useMemo(() => {
        let count = 0;

        count += filteredInvoices.filter((invoice) => !invoice.businessInfoId).length;
        count += filteredInvoices.filter((invoice) => {
            const client = clientsById.get(invoice.clientId);
            return client && !client.country;
        }).length;
        count += filteredExpenses.filter((expense) => !expense.isTaxExempt && !expense.taxLabel && typeof expense.taxRate !== 'number').length;

        return count;
    }, [clientsById, filteredExpenses, filteredInvoices]);

    const metadataReviewRows = useMemo(() => {
        return [
            {
                label: 'Invoices without business profile',
                count: filteredInvoices.filter((invoice) => !invoice.businessInfoId).length,
            },
            {
                label: 'Invoices without client country',
                count: filteredInvoices.filter((invoice) => {
                    const client = clientsById.get(invoice.clientId);
                    return client && !client.country;
                }).length,
            },
            {
                label: 'Expenses missing tax metadata',
                count: filteredExpenses.filter((expense) => !expense.isTaxExempt && !expense.taxLabel && typeof expense.taxRate !== 'number').length,
            },
        ].filter((row) => row.count > 0);
    }, [clientsById, filteredExpenses, filteredInvoices]);

    const revenueIssuedByCurrency = useMemo(() => {
        return sumAmountsByCurrency(issuedInvoicesInRange, (invoice) => invoice.currency || preferredCurrency, (invoice) => getInvoiceTotal(invoice));
    }, [issuedInvoicesInRange, preferredCurrency]);

    const revenuePaidByCurrency = useMemo(() => {
        return sumAmountsByCurrency(
            paidInvoicesInRange,
            (invoice) => invoice.currency || preferredCurrency,
            (invoice) => getInvoiceTotal(invoice)
        );
    }, [paidInvoicesInRange, preferredCurrency]);

    const outstandingByCurrency = useMemo(() => {
        return sumAmountsByCurrency(outstandingInvoices, (invoice) => invoice.currency || preferredCurrency, (invoice) => getInvoiceTotal(invoice));
    }, [outstandingInvoices, preferredCurrency]);

    const overdueByCurrency = useMemo(() => {
        return sumAmountsByCurrency(overdueInvoices, (invoice) => invoice.currency || preferredCurrency, (invoice) => getInvoiceTotal(invoice));
    }, [overdueInvoices, preferredCurrency]);

    const outputTaxByCurrency = useMemo(() => {
        return sumAmountsByCurrency(issuedInvoicesInRange, (invoice) => invoice.currency || preferredCurrency, (invoice) => invoice.tax || 0);
    }, [issuedInvoicesInRange, preferredCurrency]);

    const expensesByCurrency = useMemo(() => {
        return sumAmountsByCurrency(filteredExpenses, (expense) => expense.currency || preferredCurrency, (expense) => expense.amount || 0);
    }, [filteredExpenses, preferredCurrency]);

    const inputTaxByCurrency = useMemo(() => {
        return sumAmountsByCurrency(
            filteredExpenses.filter((expense) => getExpenseTaxClaimStatus(expense) !== 'excluded'),
            (expense) => expense.currency || preferredCurrency,
            (expense) => getExpenseTaxAmount(expense)
        );
    }, [filteredExpenses, preferredCurrency]);

    const totalHoursMs = useMemo(() => filteredTimeEntries.reduce((sum, entry) => sum + Math.max(0, (entry.end || 0) - entry.start), 0), [filteredTimeEntries]);
    const billableHoursMs = useMemo(() => filteredTimeEntries.reduce((sum, entry) => sum + (entry.task?.billable ? getBillableDurationMs(entry) : 0), 0), [filteredTimeEntries]);
    const totalUninvoicedHoursMs = useMemo(() => toInvoiceRows.reduce((sum, row) => sum + row.uninvoicedHoursMs, 0), [toInvoiceRows]);
    const totalUninvoicedExpenseByCurrency = useMemo(() => {
        return addCurrencyTotals(...toInvoiceRows.map((row) => row.expenseAmountsByCurrency));
    }, [toInvoiceRows]);
    const totalUninvoicedEstimatedByCurrency = useMemo(() => {
        return addCurrencyTotals(...toInvoiceRows.map((row) => row.estimatedAmountsByCurrency));
    }, [toInvoiceRows]);
    const totalUninvoicedValueByCurrency = useMemo(() => {
        return addCurrencyTotals(totalUninvoicedExpenseByCurrency, totalUninvoicedEstimatedByCurrency);
    }, [totalUninvoicedEstimatedByCurrency, totalUninvoicedExpenseByCurrency]);
    const monthlyEstimatedProfitByCurrency = useMemo(() => {
        return subtractCurrencyTotals(revenuePaidByCurrency, expensesByCurrency);
    }, [expensesByCurrency, revenuePaidByCurrency]);
    const monthlyEstimatedVatPositionByCurrency = useMemo(() => {
        return subtractCurrencyTotals(outputTaxByCurrency, inputTaxByCurrency);
    }, [inputTaxByCurrency, outputTaxByCurrency]);

    const topClientBreakdown = useMemo(() => {
        return buildBreakdownRows({
            items: filteredInvoices,
            getLabel: (invoice) => clientsById.get(invoice.clientId)?.title || EMPTY_CLIENT,
            getAmount: (invoice) => getInvoiceTotal(invoice),
            getCurrency: (invoice) => invoice.currency || preferredCurrency,
            convertToCurrency,
            currencyDisplayMode,
            preferredCurrency,
        });
    }, [clientsById, convertToCurrency, currencyDisplayMode, filteredInvoices, preferredCurrency]);

    const topProjectBreakdown = useMemo(() => {
        const projectRevenueRows = projectId === 'all'
            ? filteredInvoices.flatMap((invoice) => {
                const breakdowns = getInvoiceProjectRevenueBreakdown(invoice);

                if (breakdowns.length === 0) {
                    return [{
                        projectTitle: getInvoiceProjectTitle(invoice, projectsById) || EMPTY_PROJECT,
                        amount: getInvoiceTotal(invoice),
                        currency: invoice.currency || preferredCurrency,
                    }];
                }

                return breakdowns.map((breakdown) => ({
                    projectTitle: breakdown.projectTitle || projectsById.get(breakdown.projectId)?.title || EMPTY_PROJECT,
                    amount: breakdown.allocatedTotal || 0,
                    currency: invoice.currency || preferredCurrency,
                }));
            })
            : filteredInvoices.map((invoice) => ({
                projectTitle: getInvoiceProjectTitle(invoice, projectsById) || EMPTY_PROJECT,
                amount: getInvoiceTotal(invoice),
                currency: invoice.currency || preferredCurrency,
            }));

        return buildBreakdownRows({
            items: projectRevenueRows,
            getLabel: (row) => row.projectTitle || EMPTY_PROJECT,
            getAmount: (row) => row.amount || 0,
            getCurrency: (row) => row.currency || preferredCurrency,
            convertToCurrency,
            currencyDisplayMode,
            preferredCurrency,
        });
    }, [convertToCurrency, currencyDisplayMode, filteredInvoices, preferredCurrency, projectId, projectsById]);

    const topExpenseCategoryBreakdown = useMemo(() => {
        return buildBreakdownRows({
            items: filteredExpenses,
            getLabel: (expense) => expense.categoryId ? (expenseCategoriesById.get(expense.categoryId)?.name || EMPTY_CATEGORY) : EMPTY_CATEGORY,
            getAmount: (expense) => expense.amount || 0,
            getCurrency: (expense) => expense.currency || preferredCurrency,
            convertToCurrency,
            currencyDisplayMode,
            preferredCurrency,
        });
    }, [convertToCurrency, currencyDisplayMode, expenseCategoriesById, filteredExpenses, preferredCurrency]);

    const monthlySummaryRows = useMemo(() => {
        return [
            { metric: 'Period', value: getDateRangeLabel(resolvedRange) },
            { metric: 'Revenue Issued', value: formatCurrencyBreakdown({ amountsByCurrency: revenueIssuedByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Payments Received', value: formatCurrencyBreakdown({ amountsByCurrency: revenuePaidByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Expenses', value: formatCurrencyBreakdown({ amountsByCurrency: expensesByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Output Tax', value: formatCurrencyBreakdown({ amountsByCurrency: outputTaxByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Input Tax', value: formatCurrencyBreakdown({ amountsByCurrency: inputTaxByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Estimated VAT Position', value: formatCurrencyBreakdown({ amountsByCurrency: monthlyEstimatedVatPositionByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Estimated Profit', value: formatCurrencyBreakdown({ amountsByCurrency: monthlyEstimatedProfitByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }) },
            { metric: 'Hours Worked', value: formatDuration(totalHoursMs) },
            { metric: 'Billable Utilization', value: formatPercent(totalHoursMs > 0 ? (billableHoursMs / totalHoursMs) * 100 : 0) },
            { metric: 'Outstanding Invoices', value: `${outstandingInvoices.length}` },
            { metric: 'Overdue Invoices', value: `${overdueInvoices.length}` },
        ];
    }, [
        billableHoursMs,
        convertToCurrency,
        currencyDisplayMode,
        expensesByCurrency,
        inputTaxByCurrency,
        monthlyEstimatedProfitByCurrency,
        monthlyEstimatedVatPositionByCurrency,
        overdueInvoices.length,
        outstandingInvoices.length,
        outputTaxByCurrency,
        preferredCurrency,
        resolvedRange,
        revenueIssuedByCurrency,
        revenuePaidByCurrency,
        totalHoursMs,
    ]);

    const vatSummary = useMemo(() => {
        return buildVatReportSummary({
            invoices: filteredInvoices,
            expenses: filteredExpenses,
            clientsById,
            businessInfosById,
        });
    }, [businessInfosById, clientsById, filteredExpenses, filteredInvoices]);

    const vatReviewItems = useMemo(() => {
        return [
            {
                key: 'missingInvoiceBusinessInfo',
                label: 'Invoices without business profile',
                count: vatSummary.needsReview.missingInvoiceBusinessInfo,
            },
            {
                key: 'missingClientCountry',
                label: 'Invoices without client country',
                count: vatSummary.needsReview.missingClientCountry,
            },
            {
                key: 'missingExpenseTaxMetadata',
                label: 'Expenses without tax metadata',
                count: vatSummary.needsReview.missingExpenseTaxMetadata,
            },
            {
                key: 'needsReviewSalesBuckets',
                label: 'Sales bucketed as needs review',
                count: vatSummary.needsReview.needsReviewSalesBuckets,
            },
            {
                key: 'needsReviewExpenseBuckets',
                label: 'Expense buckets marked needs review',
                count: vatSummary.needsReview.needsReviewExpenseBuckets,
            },
        ].filter((item) => item.count > 0);
    }, [vatSummary.needsReview]);

    const summaryCards = useMemo(() => {
        const utilization = totalHoursMs > 0 ? (billableHoursMs / totalHoursMs) * 100 : 0;

        return {
            revenueIssued: {
                value: formatCurrencyBreakdown({ amountsByCurrency: revenueIssuedByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${issuedInvoicesInRange.length} invoice${issuedInvoicesInRange.length === 1 ? '' : 's'} issued`,
            },
            revenuePaid: {
                value: formatCurrencyBreakdown({ amountsByCurrency: revenuePaidByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${paidInvoicesInRange.length} invoice${paidInvoicesInRange.length === 1 ? '' : 's'} paid`,
            },
            outstanding: {
                value: formatCurrencyBreakdown({ amountsByCurrency: outstandingByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${outstandingInvoices.length} invoices still open`,
            },
            overdue: {
                value: formatCurrencyBreakdown({ amountsByCurrency: overdueByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${overdueInvoices.length} invoices past due`,
            },
            outputTax: {
                value: formatCurrencyBreakdown({ amountsByCurrency: outputTaxByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${issuedInvoicesInRange.length} invoices with tax totals`,
            },
            expenses: {
                value: formatCurrencyBreakdown({ amountsByCurrency: expensesByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: `${filteredExpenses.length} expenses in range`,
            },
            estimatedProfit: {
                value: formatCurrencyBreakdown({ amountsByCurrency: monthlyEstimatedProfitByCurrency, convertToCurrency, currencyDisplayMode, preferredCurrency }),
                subtitle: 'Paid revenue minus filtered expenses',
            },
            hoursWorked: {
                value: formatDuration(totalHoursMs),
                subtitle: `${formatDuration(billableHoursMs)} billable`,
            },
            uninvoicedWork: {
                value: formatDuration(totalUninvoicedHoursMs),
                subtitle: `${toInvoiceRows.length} groups • ${formatCurrencyBreakdown({
                    amountsByCurrency: totalUninvoicedExpenseByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                })}`,
            },
            billableUtilization: {
                value: formatPercent(utilization),
                subtitle: `${formatDuration(billableHoursMs)} billable of ${formatDuration(totalHoursMs)}`,
            },
        };
    }, [
        billableHoursMs,
        convertToCurrency,
        currencyDisplayMode,
        expensesByCurrency,
        filteredExpenses.length,
        monthlyEstimatedProfitByCurrency,
        overdueByCurrency,
        overdueInvoices.length,
        outstandingByCurrency,
        outstandingInvoices.length,
        outputTaxByCurrency,
        paidInvoicesInRange.length,
        preferredCurrency,
        revenueIssuedByCurrency,
        revenuePaidByCurrency,
        toInvoiceRows.length,
        totalHoursMs,
        totalUninvoicedExpenseByCurrency,
        totalUninvoicedHoursMs,
        issuedInvoicesInRange.length,
    ]);

    const shouldShowBusinessFilterNotice = businessId !== 'all';

    const invoicesExportRows = useMemo(() => {
        return filteredInvoices.map((invoice) => ({
            invoiceNumber: invoice.invoiceNumber,
            client: clientsById.get(invoice.clientId)?.title || EMPTY_CLIENT,
            business: invoice.businessInfoId ? (businessInfosById.get(invoice.businessInfoId)?.businessName || businessInfosById.get(invoice.businessInfoId)?.name || businessInfosById.get(invoice.businessInfoId)?.title || EMPTY_BUSINESS) : EMPTY_BUSINESS,
            invoiceDate: invoice.date,
            dueDate: invoice.dueDate || '',
            paidDate: getInvoicePaymentDateString(invoice) || '',
            status: getInvoiceStatus(invoice),
            currency: invoice.currency || preferredCurrency,
            subtotal: invoice.subtotal || 0,
            tax: invoice.tax || 0,
            total: getInvoiceTotal(invoice),
            project: getInvoiceProjectTitle(invoice, projectsById) || EMPTY_PROJECT,
        }));
    }, [businessInfosById, clientsById, filteredInvoices, preferredCurrency, projectsById]);

    const invoiceRegisterSummary = useMemo(() => {
        return buildInvoiceRegisterSummary({
            invoices: filteredInvoices,
            clientsById,
            businessInfosById,
        });
    }, [businessInfosById, clientsById, filteredInvoices]);

    const invoiceRegisterSummarySections = useMemo(() => {
        const buildAmountLabel = (row) => {
            return `${row.count} invoices • ${formatCurrencyBreakdown({
                amountsByCurrency: row.totalByCurrency,
                convertToCurrency,
                currencyDisplayMode,
                preferredCurrency,
            })}`;
        };

        return [
            {
                title: 'By status',
                rows: invoiceRegisterSummary.totalsByStatus.map((row) => ({
                    label: row.label,
                    value: buildAmountLabel(row),
                })),
            },
            {
                title: 'By client',
                rows: invoiceRegisterSummary.totalsByClient.slice(0, 5).map((row) => ({
                    label: row.label,
                    value: buildAmountLabel(row),
                })),
            },
            {
                title: 'By business',
                rows: invoiceRegisterSummary.totalsByBusiness.slice(0, 5).map((row) => ({
                    label: row.label,
                    value: buildAmountLabel(row),
                })),
            },
            {
                title: 'By currency',
                rows: invoiceRegisterSummary.totalsByCurrency.map((row) => ({
                    label: row.currency,
                    value: `${row.count} invoices • ${formatCurrency(row.total, row.currency)}`,
                })),
            },
        ].filter((section) => section.rows.length > 0);
    }, [
        convertToCurrency,
        currencyDisplayMode,
        invoiceRegisterSummary.totalsByBusiness,
        invoiceRegisterSummary.totalsByClient,
        invoiceRegisterSummary.totalsByCurrency,
        invoiceRegisterSummary.totalsByStatus,
        preferredCurrency,
    ]);

    const expensesExportRows = useMemo(() => {
        return filteredExpenses.map((expense) => ({
            date: expense.date,
            paidDate: expense.paidOn || '',
            title: expense.title,
            supplier: expense.supplierName || '',
            category: expense.categoryId ? (expenseCategoriesById.get(expense.categoryId)?.name || EMPTY_CATEGORY) : EMPTY_CATEGORY,
            business: expense.businessId ? (businessInfosById.get(expense.businessId)?.businessName || businessInfosById.get(expense.businessId)?.name || businessInfosById.get(expense.businessId)?.title || EMPTY_BUSINESS) : EMPTY_BUSINESS,
            client: expense.clientId ? (clientsById.get(expense.clientId)?.title || EMPTY_CLIENT) : EMPTY_CLIENT,
            project: expense.projectId ? (projectsById.get(expense.projectId)?.title || EMPTY_PROJECT) : EMPTY_PROJECT,
            currency: expense.currency || preferredCurrency,
            amount: expense.amount || 0,
            taxAmount: getExpenseTaxAmount(expense),
            paymentStatus: expense.paymentStatus,
            billingStatus: expense.billingStatus,
            claimStatus: getExpenseTaxClaimStatusLabel(getExpenseTaxClaimStatus(expense)),
            claimPeriod: expense.taxClaimPeriodId ? (taxReturnPeriodsById.get(expense.taxClaimPeriodId)?.title || 'Unknown period') : '',
        }));
    }, [businessInfosById, clientsById, expenseCategoriesById, filteredExpenses, preferredCurrency, projectsById, taxReturnPeriodsById]);

    const hoursExportRows = useMemo(() => {
        return hoursRows.map((row) => ({
            project: row.projectTitle,
            client: row.clientTitle,
            entries: row.entriesCount,
            totalHours: (row.totalMs / (1000 * 60 * 60)).toFixed(2),
            billableHours: (row.billableMs / (1000 * 60 * 60)).toFixed(2),
            unbilledBillableHours: (row.unbilledBillableMs / (1000 * 60 * 60)).toFixed(2),
        }));
    }, [hoursRows]);

    const timeEntriesExportRows = useMemo(() => {
        return filteredTimeEntries.map((entry) => {
            const billedInvoice = entry.billedInvoiceId ? invoicesById.get(entry.billedInvoiceId) : null;
            const actualMs = Math.max(0, (entry.end || 0) - entry.start);
            const billableMs = entry.task?.billable ? getBillableDurationMs(entry) : 0;

            return {
                date: toStorageDate(entry.start) || '',
                startTime: toDisplayDate(entry.start, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                endTime: toDisplayDate(entry.end, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                task: entry.task?.title || '',
                project: entry.project?.title || EMPTY_PROJECT,
                client: entry.client?.title || EMPTY_CLIENT,
                billable: entry.task?.billable ? 'yes' : 'no',
                durationHours: (actualMs / (1000 * 60 * 60)).toFixed(2),
                billableHours: (billableMs / (1000 * 60 * 60)).toFixed(2),
                billedInvoiceNumber: billedInvoice?.invoiceNumber || '',
                note: entry.note || '',
            };
        });
    }, [filteredTimeEntries, invoicesById]);

    const taxExportRows = useMemo(() => {
        const salesRows = vatSummary.salesBuckets.map((row) => ({
            section: 'Sales',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount.toFixed(2),
            netAmount: row.netAmount.toFixed(2),
            taxAmount: row.taxAmount.toFixed(2),
            count: row.count,
        }));

        const expenseRows = vatSummary.expenseBuckets.map((row) => ({
            section: 'Expenses',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount.toFixed(2),
            netAmount: row.netAmount.toFixed(2),
            taxAmount: row.taxAmount.toFixed(2),
            count: row.count,
        }));

        const claimRows = vatSummary.claimStatusBuckets.map((row) => ({
            section: 'Claim status',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount.toFixed(2),
            netAmount: row.netAmount.toFixed(2),
            taxAmount: row.taxAmount.toFixed(2),
            count: row.count,
        }));

        const geographyRows = vatSummary.geographyBuckets.map((row) => ({
            section: 'Geography',
            label: row.geography,
            currency: row.currency,
            grossAmount: row.total.toFixed(2),
            netAmount: '',
            taxAmount: '',
            count: row.count,
        }));

        const reviewRows = vatReviewItems.map((row) => ({
            section: 'Needs Review',
            label: row.label,
            currency: '',
            grossAmount: '',
            netAmount: '',
            taxAmount: '',
            count: row.count,
        }));

        return [
            ...salesRows,
            ...expenseRows,
            ...claimRows,
            ...geographyRows,
            ...reviewRows,
        ];
    }, [vatReviewItems, vatSummary.claimStatusBuckets, vatSummary.expenseBuckets, vatSummary.geographyBuckets, vatSummary.salesBuckets]);

    const outstandingSummary = useMemo(() => {
        return buildOutstandingInvoiceSummary(outstandingInvoices, reportReferenceDate);
    }, [outstandingInvoices, reportReferenceDate]);

    const expenseTotalsSummary = useMemo(() => {
        return buildExpenseTotalsSummary(filteredExpenses);
    }, [filteredExpenses]);

    const reviewChecklistRows = useMemo(() => {
        const outstandingNeedsReviewCount = outstandingSummary
            .filter((row) => row.bucketLabel === 'Needs review')
            .reduce((sum, row) => sum + row.count, 0);

        return [
            {
                issue: 'Invoices without business profile',
                scope: 'Invoices',
                count: vatSummary.needsReview.missingInvoiceBusinessInfo,
            },
            {
                issue: 'Invoices without client country',
                scope: 'Invoices',
                count: vatSummary.needsReview.missingClientCountry,
            },
            {
                issue: 'Expenses without tax metadata',
                scope: 'Expenses',
                count: vatSummary.needsReview.missingExpenseTaxMetadata,
            },
            {
                issue: 'Expenses without category',
                scope: 'Expenses',
                count: filteredExpenses.filter((expense) => !expense.categoryId).length,
            },
            {
                issue: 'Sales bucketed as needs review',
                scope: 'Tax summary',
                count: vatSummary.needsReview.needsReviewSalesBuckets,
            },
            {
                issue: 'Expense buckets marked needs review',
                scope: 'Tax summary',
                count: vatSummary.needsReview.needsReviewExpenseBuckets,
            },
            {
                issue: 'Outstanding invoices missing due date',
                scope: 'Outstanding',
                count: outstandingNeedsReviewCount,
            },
        ].filter((row) => row.count > 0);
    }, [filteredExpenses, outstandingSummary, vatSummary.needsReview]);

    const expenseSummaryRows = useMemo(() => {
        return [
            {
                label: 'Ex VAT',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: expenseTotalsSummary.netByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'VAT amount',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: expenseTotalsSummary.taxByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Inc VAT',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: expenseTotalsSummary.grossByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Needs review',
                value: `${expenseTotalsSummary.missingTaxMetadataCount}`,
            },
        ];
    }, [
        convertToCurrency,
        currencyDisplayMode,
        expenseTotalsSummary.grossByCurrency,
        expenseTotalsSummary.missingTaxMetadataCount,
        expenseTotalsSummary.netByCurrency,
        expenseTotalsSummary.taxByCurrency,
        preferredCurrency,
    ]);

    const selectedBusinessLabel = businessId !== 'all'
        ? (businessInfosById.get(businessId)?.businessName || businessInfosById.get(businessId)?.name || businessInfosById.get(businessId)?.title || EMPTY_BUSINESS)
        : 'All businesses';

    const generatedAtLabel = toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' });
    const periodLabel = getDateRangeLabel(resolvedRange);

    const clientStatementSummary = useMemo(() => {
        if (!selectedStatementClientId) {
            return null;
        }

        return buildClientStatementSummary({
            invoices: statementInvoices,
            startDate: resolvedRange.startDate,
            endDate: resolvedRange.endDate,
            referenceDate: reportReferenceDate,
        });
    }, [reportReferenceDate, resolvedRange.endDate, resolvedRange.startDate, selectedStatementClientId, statementInvoices]);

    const projectWorkSummary = useMemo(() => {
        if (!selectedWorkSummaryProjectId) {
            return null;
        }

        return buildProjectWorkSummary(workSummaryEntries);
    }, [selectedWorkSummaryProjectId, workSummaryEntries]);

    const outstandingExportRows = useMemo(() => {
        return outstandingInvoices
            .map((invoice) => {
                const client = clientsById.get(invoice.clientId);
                const project = invoice.projectId ? projectsById.get(invoice.projectId) : null;
                const business = invoice.businessInfoId ? businessInfosById.get(invoice.businessInfoId) : null;
                const daysOverdue = getInvoiceDaysOverdue(invoice, reportReferenceDate);
                const status = getInvoiceStatus(invoice, reportReferenceDate);

                return {
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    client: client?.title || EMPTY_CLIENT,
                    business: business?.businessName || business?.name || business?.title || EMPTY_BUSINESS,
                    project: getInvoiceProjectTitle(invoice, projectsById) || project?.title || EMPTY_PROJECT,
                    invoiceDate: invoice.date,
                    dueDate: invoice.dueDate || '',
                    status,
                    daysOverdue,
                    currency: invoice.currency || preferredCurrency,
                    total: getInvoiceTotal(invoice),
                };
            })
            .sort((rowA, rowB) => rowB.daysOverdue - rowA.daysOverdue || rowA.dueDate.localeCompare(rowB.dueDate));
    }, [businessInfosById, clientsById, outstandingInvoices, preferredCurrency, projectsById, reportReferenceDate]);

    const outstandingSummaryRows = useMemo(() => {
        return [
            {
                label: 'Outstanding total',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: outstandingByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Overdue total',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: overdueByCurrency,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Oldest overdue',
                value: `${Math.max(0, ...outstandingExportRows.map((row) => row.daysOverdue))} days`,
            },
            {
                label: 'Needs review',
                value: `${outstandingSummary.filter((row) => row.bucketLabel === 'Needs review').reduce((sum, row) => sum + row.count, 0)}`,
            },
        ];
    }, [
        convertToCurrency,
        currencyDisplayMode,
        outstandingByCurrency,
        outstandingExportRows,
        outstandingSummary,
        overdueByCurrency,
        preferredCurrency,
    ]);

    const outstandingAgingSummaryRows = useMemo(() => {
        return outstandingSummary.map((row) => ({
            label: `${row.bucketLabel} (${row.currency})`,
            value: `${row.count} invoices • ${formatCurrency(row.total, row.currency)}`,
        }));
    }, [outstandingSummary]);

    const clientStatementSummaryRows = useMemo(() => {
        if (!clientStatementSummary) {
            return [];
        }

        return [
            {
                label: 'Opening balance',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: clientStatementSummary.totalsByCurrency.openingBalance,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Invoices issued',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: clientStatementSummary.totalsByCurrency.issued,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Payments recorded',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: clientStatementSummary.totalsByCurrency.payments,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
            {
                label: 'Closing balance',
                value: formatCurrencyBreakdown({
                    amountsByCurrency: clientStatementSummary.totalsByCurrency.closingBalance,
                    convertToCurrency,
                    currencyDisplayMode,
                    preferredCurrency,
                }),
            },
        ];
    }, [clientStatementSummary, convertToCurrency, currencyDisplayMode, preferredCurrency]);

    const clientStatementExportRows = useMemo(() => {
        if (!clientStatementSummary) {
            return [];
        }

        const openingRows = clientStatementSummary.openingBalanceInvoices.map((invoice) => ({
            section: 'Opening balance',
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            dueDate: invoice.dueDate || '',
            paidDate: '',
            status: getInvoiceStatus(invoice, reportReferenceDate),
            currency: invoice.currency || preferredCurrency,
            total: getInvoiceTotal(invoice),
        }));

        const issuedRows = clientStatementSummary.invoicesIssuedInRange.map((invoice) => ({
            section: 'Issued in period',
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            dueDate: invoice.dueDate || '',
            paidDate: getInvoicePaymentDateString(invoice) || '',
            status: getInvoiceStatus(invoice, reportReferenceDate),
            currency: invoice.currency || preferredCurrency,
            total: getInvoiceTotal(invoice),
        }));

        const paymentRows = clientStatementSummary.paymentsRecordedInRange.map((invoice) => ({
            section: 'Payments in period',
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            dueDate: invoice.dueDate || '',
            paidDate: getInvoicePaymentDateString(invoice) || '',
            status: 'paid',
            currency: invoice.currency || preferredCurrency,
            total: getInvoiceTotal(invoice),
        }));

        const outstandingRows = clientStatementSummary.outstandingInvoices.map((invoice) => ({
            section: 'Outstanding at statement date',
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            dueDate: invoice.dueDate || '',
            paidDate: '',
            status: getInvoiceStatus(invoice, reportReferenceDate),
            currency: invoice.currency || preferredCurrency,
            total: getInvoiceTotal(invoice),
        }));

        return [
            ...openingRows,
            ...issuedRows,
            ...paymentRows,
            ...outstandingRows,
        ];
    }, [clientStatementSummary, preferredCurrency, reportReferenceDate]);

    const projectWorkSummaryRows = useMemo(() => {
        if (!projectWorkSummary) {
            return [];
        }

        return projectWorkSummary.rows.map((row) => ({
            task: row.taskTitle,
            entries: `${row.entriesCount}`,
            totalDuration: formatDuration(row.actualMs),
            billableDuration: formatDuration(row.billableMs),
            notes: `${row.notesCount}`,
            firstWorked: row.firstEntryAt ? toDisplayDate(row.firstEntryAt) : '',
            lastWorked: row.lastEntryAt ? toDisplayDate(row.lastEntryAt) : '',
        }));
    }, [projectWorkSummary]);

    const projectWorkSummaryPdfRows = useMemo(() => {
        return projectWorkSummaryRows.map((row) => ({
            task: row.task,
            entries: row.entries,
            totalDuration: row.totalDuration,
            billableDuration: row.billableDuration,
        }));
    }, [projectWorkSummaryRows]);

    const projectWorkSummaryMetrics = useMemo(() => {
        if (!projectWorkSummary) {
            return [];
        }

        const hourlyRate = typeof workSummaryProject?.hourlyRate === 'number' ? workSummaryProject.hourlyRate : 0;
        const projectCurrency = workSummaryProject ? getProjectCurrency(workSummaryProject, clients) : preferredCurrency;
        const estimatedAmount = hourlyRate > 0
            ? Math.round(millisecondsToHours(projectWorkSummary.totals.billableMs) * hourlyRate * 100) / 100
            : 0;

        return [
            { label: 'Total worked', value: formatDuration(projectWorkSummary.totals.actualMs) },
            { label: 'Billable worked', value: formatDuration(projectWorkSummary.totals.billableMs) },
            { label: 'Tasks covered', value: `${projectWorkSummary.totals.tasksCount}` },
            { label: 'Entries logged', value: `${projectWorkSummary.totals.entriesCount}` },
            { label: 'Noted entries', value: `${projectWorkSummary.totals.notesCount}` },
            { label: 'Estimated billable amount', value: formatCurrency(estimatedAmount, projectCurrency) },
        ];
    }, [clients, preferredCurrency, projectWorkSummary, workSummaryProject]);

    const toInvoiceExportRows = useMemo(() => {
        return toInvoiceRows.map((row) => ({
            client: row.clientTitle,
            project: row.projectTitle,
            uninvoicedHours: (row.uninvoicedHoursMs / (1000 * 60 * 60)).toFixed(2),
            expenseCount: row.expenseCount,
            expenseAmount: formatCurrencyBreakdown({
                amountsByCurrency: row.expenseAmountsByCurrency,
                convertToCurrency,
                currencyDisplayMode,
                preferredCurrency,
            }),
            estimatedAmount: formatCurrencyBreakdown({
                amountsByCurrency: row.estimatedAmountsByCurrency,
                convertToCurrency,
                currencyDisplayMode,
                preferredCurrency,
            }),
        }));
    }, [convertToCurrency, currencyDisplayMode, preferredCurrency, toInvoiceRows]);

    const accountantPackCsvFiles = useMemo(() => {
        return [
            {
                filename: 'invoices.csv',
                columns: INVOICES_EXPORT_COLUMNS,
                rows: invoicesExportRows,
            },
            {
                filename: 'expenses.csv',
                columns: EXPENSES_EXPORT_COLUMNS,
                rows: expensesExportRows,
            },
            {
                filename: 'time-entries.csv',
                columns: TIME_ENTRIES_EXPORT_COLUMNS,
                rows: timeEntriesExportRows,
            },
            {
                filename: 'tax-summary.csv',
                columns: TAX_EXPORT_COLUMNS,
                rows: taxExportRows,
            },
            {
                filename: 'review-checklist.csv',
                columns: REVIEW_CHECKLIST_EXPORT_COLUMNS,
                rows: reviewChecklistRows,
            },
        ];
    }, [
        expensesExportRows,
        invoicesExportRows,
        reviewChecklistRows,
        taxExportRows,
        timeEntriesExportRows,
    ]);

    const accountantPackPdfFiles = useMemo(() => {
        return [
            {
                filename: 'monthly-summary.pdf',
                htmlContent: buildMonthlyReportHtml({
                    businessLabel: selectedBusinessLabel,
                    generatedAtLabel,
                    periodLabel,
                    summaryRows: monthlySummaryRows.map((row) => ({ label: row.metric, value: row.value })),
                    topClientBreakdown,
                    categoryBreakdown: topExpenseCategoryBreakdown,
                    projectBreakdown: topProjectBreakdown,
                    reviewRows: reviewChecklistRows.map((row) => ({
                        label: row.issue,
                        value: `${row.count} ${row.scope.toLowerCase()}`,
                    })),
                }),
            },
        ];
    }, [
        generatedAtLabel,
        monthlySummaryRows,
        periodLabel,
        reviewChecklistRows,
        selectedBusinessLabel,
        topClientBreakdown,
        topExpenseCategoryBreakdown,
        topProjectBreakdown,
    ]);

    const accountantPackInvoicePdfFiles = useMemo(() => {
        return filteredInvoices
            .filter((invoice) => invoice.invoiceNumber)
            .map((invoice) => ({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                filename: `invoice-${invoice.invoiceNumber}.pdf`,
                htmlContent: getCurrentInvoiceHtmlContent(invoice, clients, businessBrandAssets),
            }));
    }, [businessBrandAssets, clients, filteredInvoices]);

    const accountantPackManifestRows = useMemo(() => {
        return buildAccountantPackManifestRows({
            csvFiles: accountantPackCsvFiles,
            pdfFiles: accountantPackPdfFiles,
            invoicePdfFiles: accountantPackInvoicePdfFiles,
        });
    }, [accountantPackCsvFiles, accountantPackInvoicePdfFiles, accountantPackPdfFiles]);

    const runAccountantPackExport = async () => {
        const reportPdfEntries = await Promise.all(accountantPackPdfFiles.map(async (file) => ({
            filename: file.filename,
            content: await generatePDFBlob(file.htmlContent),
        })));
        const invoicePdfEntries = await Promise.all(accountantPackInvoicePdfFiles.map(async (file) => ({
            filename: file.filename,
            content: await generatePDFBlob(file.htmlContent),
        })));

        await downloadZipFile('accountant-pack.zip', [
            {
                filename: 'accountant-pack-manifest.csv',
                content: buildCsvContent(ACCOUNTANT_PACK_MANIFEST_COLUMNS, accountantPackManifestRows),
            },
            ...buildCsvZipEntries(accountantPackCsvFiles),
            ...reportPdfEntries,
            ...invoicePdfEntries,
        ]);
    };

    return (
        <div className={buildSectionClassName(isMobileLayout)}>
            <Tabs value={activeTab} onValueChange={handleSectionChange}>
                <div className={cn(
                    'overflow-x-auto pb-1 scrollbar-hide',
                    isMobileLayout ? '-mx-4 px-4' : ''
                )}>
                    <TabsList className={cn(
                        'bg-transparent rounded-none w-max min-w-full flex-nowrap',
                        isMobileLayout
                            ? 'h-auto justify-start gap-2 border-0 p-0'
                            : 'h-auto justify-start border-b border-border p-0'
                    )}>
                        {REPORT_TABS.map((tab) => {
                            const Icon = tab.icon;

                            return (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className={cn(
                                        'flex items-center font-medium text-sm whitespace-nowrap transition-colors',
                                        isMobileLayout
                                            ? 'shrink-0 rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                            : 'shrink-0 mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                                    )}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    {tab.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
            </Tabs>

            <div className={buildSectionClassName(isMobileLayout)}>
                <div className={cn('flex flex-wrap justify-between gap-4', isMobileLayout ? 'items-start' : 'items-center')}>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{headerContent.title}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {headerContent.description}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{getDateRangeLabel(resolvedRange)}</Badge>
                        {missingDataReviewCount > 0 ? (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            badgeVariants({ variant: 'warning' }),
                                            'cursor-pointer gap-1.5 border shadow-none'
                                        )}
                                        aria-label={`Needs review: ${missingDataReviewCount} record${missingDataReviewCount === 1 ? '' : 's'}`}
                                    >
                                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                        <span>Needs review</span>
                                        <span>{missingDataReviewCount}</span>
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Records needing review</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                        <p className="text-sm text-muted-foreground">
                                            {missingDataReviewCount} filtered record{missingDataReviewCount === 1 ? '' : 's'} {missingDataReviewCount === 1 ? 'is' : 'are'} missing business, country, or tax metadata that affects cleaner accounting exports.
                                        </p>
                                        <div className="space-y-2">
                                            {metadataReviewRows.map((row) => (
                                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                    <p className="text-sm text-foreground">{row.label}</p>
                                                    <Badge variant="warning" className="shrink-0">
                                                        {row.count}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        ) : null}
                    </div>
                </div>

                <ReportFilters
                    businessId={businessId}
                    businessInfos={businessInfos}
                    clientId={clientId}
                    categoryId={categoryId}
                    categories={allExpenseCategories}
                    clients={activeClients}
                    currencyDisplayMode={currencyDisplayMode}
                    customEnd={customEnd}
                    customStart={customStart}
                    expenseDateBasis={expenseDateBasis}
                    expenseStatus={expenseStatus}
                    incomeDateBasis={incomeDateBasis}
                    invoiceStatus={invoiceStatus}
                    onBusinessIdChange={setBusinessId}
                    onClientIdChange={setClientId}
                    onCategoryIdChange={setCategoryId}
                    onCurrencyDisplayModeChange={setCurrencyDisplayMode}
                    onCustomEndChange={setCustomEnd}
                    onCustomStartChange={setCustomStart}
                    onExpenseDateBasisChange={setExpenseDateBasis}
                    onExpenseStatusChange={setExpenseStatus}
                    onIncomeDateBasisChange={setIncomeDateBasis}
                    onInvoiceStatusChange={setInvoiceStatus}
                    onPeriodChange={setPeriod}
                    onProjectIdChange={setProjectId}
                    onResetFilters={handleResetFilters}
                    period={period}
                    periodOptions={REPORT_PERIOD_OPTIONS}
                    projectId={projectId}
                    projects={availableProjects}
                />

                {exchangeRatesError ? (
                    <Notice
                        title="Currency conversion is partially limited"
                        description={missingExchangeRates.length > 0
                            ? `Missing rates for ${missingExchangeRates.join(', ')}. Showing source-currency totals where needed.`
                            : exchangeRatesError}
                        variant="warning"
                    />
                ) : null}

                {shouldShowBusinessFilterNotice ? (
                    <Notice
                        title="Business filter is partial for time-based reports"
                        description="Invoices and expenses are scoped by business profile. Hours and uninvoiced work still follow client/project filters until business attribution is added to those records."
                        compact
                    />
                ) : null}

                <div className="min-h-[24rem]">
                        {activeTab === 'overview' && (
                            <div className={buildSectionClassName(isMobileLayout)}>
                                <ReportSummaryCards cards={summaryCards} />
                            </div>
                        )}

                        {activeTab === 'monthly' && (
                            <div className={buildSectionClassName(isMobileLayout)}>
                        <ReportSection
                            title="Monthly summary"
                            action={(
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        leadingIcon={ArrowDownTrayIcon}
                                        onClick={() => downloadReport({
                                            filename: buildExportFileName('monthly-summary', resolvedRange.startDate, resolvedRange.endDate),
                                            columns: MONTHLY_SUMMARY_EXPORT_COLUMNS,
                                            rows: monthlySummaryRows,
                                        })}
                                    >
                                        Export CSV
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        leadingIcon={ArrowDownTrayIcon}
                                        onClick={() => {
                                            void downloadZipFile(`monthly-csv-pack-${resolvedRange.startDate}-to-${resolvedRange.endDate}.zip`, buildCsvZipEntries([
                                                {
                                                    filename: buildExportFileName('monthly-summary', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: MONTHLY_SUMMARY_EXPORT_COLUMNS,
                                                    rows: monthlySummaryRows,
                                                },
                                                {
                                                    filename: buildExportFileName('monthly-invoices', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: INVOICES_EXPORT_COLUMNS,
                                                    rows: invoicesExportRows,
                                                },
                                                {
                                                    filename: buildExportFileName('monthly-expenses', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: EXPENSES_EXPORT_COLUMNS,
                                                    rows: expensesExportRows,
                                                },
                                                {
                                                    filename: buildExportFileName('monthly-hours', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: HOURS_EXPORT_COLUMNS,
                                                    rows: hoursExportRows,
                                                },
                                                {
                                                    filename: buildExportFileName('monthly-tax-summary', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: TAX_EXPORT_COLUMNS,
                                                    rows: taxExportRows,
                                                },
                                                {
                                                    filename: buildExportFileName('monthly-review-checklist', resolvedRange.startDate, resolvedRange.endDate),
                                                    columns: REVIEW_CHECKLIST_EXPORT_COLUMNS,
                                                    rows: reviewChecklistRows,
                                                },
                                            ]));
                                        }}
                                    >
                                        Export CSV pack
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        leadingIcon={ArrowDownTrayIcon}
                                        onClick={() => {
                                            void runAccountantPackExport();
                                        }}
                                    >
                                        Export accountant pack
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        leadingIcon={ArrowDownTrayIcon}
                                        onClick={() => exportMonthlyReportPdf({
                                            filename: `monthly-report-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                            businessLabel: selectedBusinessLabel,
                                            generatedAtLabel,
                                            periodLabel,
                                            summaryRows: monthlySummaryRows.map((row) => ({ label: row.metric, value: row.value })),
                                            topClientBreakdown,
                                            categoryBreakdown: topExpenseCategoryBreakdown,
                                            projectBreakdown: topProjectBreakdown,
                                            reviewRows: reviewChecklistRows.map((row) => ({
                                                label: row.issue,
                                                value: `${row.count} ${row.scope.toLowerCase()}`,
                                            })),
                                        })}
                                    >
                                        Export PDF
                                    </Button>
                                </div>
                            )}
                        >
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg border border-border p-3">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated profit</p>
                                    <p className="mt-2 text-lg font-semibold text-foreground">
                                        {formatCurrencyBreakdown({
                                            amountsByCurrency: monthlyEstimatedProfitByCurrency,
                                            convertToCurrency,
                                            currencyDisplayMode,
                                            preferredCurrency,
                                        })}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">Paid revenue minus filtered expenses</p>
                                </div>
                                <div className="rounded-lg border border-border p-3">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated VAT position</p>
                                    <p className="mt-2 text-lg font-semibold text-foreground">
                                        {formatCurrencyBreakdown({
                                            amountsByCurrency: monthlyEstimatedVatPositionByCurrency,
                                            convertToCurrency,
                                            currencyDisplayMode,
                                            preferredCurrency,
                                        })}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">Output tax minus input tax</p>
                                </div>
                                <div className="rounded-lg border border-border p-3">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hours worked</p>
                                    <p className="mt-2 text-lg font-semibold text-foreground">{formatDuration(totalHoursMs)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{formatDuration(billableHoursMs)} billable</p>
                                </div>
                                <div className="rounded-lg border border-border p-3">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uninvoiced value</p>
                                    <p className="mt-2 text-lg font-semibold text-foreground">
                                        {formatCurrencyBreakdown({
                                            amountsByCurrency: totalUninvoicedValueByCurrency,
                                            convertToCurrency,
                                            currencyDisplayMode,
                                            preferredCurrency,
                                        })}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">{toInvoiceRows.length} open billing groups</p>
                                </div>
                            </div>

                            <Notice
                                title="Accountant pack contents"
                                description={`${accountantPackCsvFiles.length + 1} CSV files, ${accountantPackPdfFiles.length} report PDF, and ${accountantPackInvoicePdfFiles.length} invoice PDFs will be downloaded for this slice.`}
                                compact
                            />

                            <div className="space-y-4">
                                <section aria-labelledby="monthly-summary-lines-heading" className="space-y-2">
                                    <h3 id="monthly-summary-lines-heading" className="text-sm font-semibold text-foreground">Summary lines</h3>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                        {monthlySummaryRows.map((row) => (
                                            <div key={row.metric} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                <p className="text-sm text-muted-foreground">{row.metric}</p>
                                                <p className="text-sm font-semibold text-foreground">{row.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="grid gap-4 xl:grid-cols-4">
                                    <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-foreground">Top clients</h3>
                                    <div className="space-y-2">
                                        {topClientBreakdown.length === 0 ? (
                                            <Notice title="No client totals in this slice" compact />
                                        ) : (
                                            topClientBreakdown.map((row) => (
                                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                    <p className="text-sm text-muted-foreground">{row.label}</p>
                                                    <p className="text-sm font-semibold text-foreground">{row.value}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Top projects</h3>
                                        <div className="space-y-2">
                                            {topProjectBreakdown.length === 0 ? (
                                                <Notice title="No project totals in this slice" compact />
                                            ) : (
                                                topProjectBreakdown.map((row) => (
                                                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                        <p className="text-sm text-muted-foreground">{row.label}</p>
                                                        <p className="text-sm font-semibold text-foreground">{row.value}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Expense categories</h3>
                                        <div className="space-y-2">
                                            {topExpenseCategoryBreakdown.length === 0 ? (
                                                <Notice title="No expense category totals in this slice" compact />
                                            ) : (
                                                topExpenseCategoryBreakdown.map((row) => (
                                                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                        <p className="text-sm text-muted-foreground">{row.label}</p>
                                                        <p className="text-sm font-semibold text-foreground">{row.value}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Needs review</h3>
                                        <div className="space-y-2">
                                            {reviewChecklistRows.length === 0 ? (
                                                <Notice title="No review issues in this slice" compact />
                                            ) : (
                                                reviewChecklistRows.map((row) => (
                                                    <div key={`${row.issue}-${row.scope}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-foreground">{row.issue}</p>
                                                            <p className="mt-1 text-xs text-muted-foreground">{row.scope}</p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">{row.count}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ReportSection>
                    </div>
                )}

                {activeTab === 'statement' && (
                    <div className={buildSectionClassName(isMobileLayout)}>
                        {!selectedStatementClientId ? (
                            <Notice
                                title="Select a single client to build a statement"
                                description="Use the top-level client filter, or narrow the current slice until it only includes one client."
                            />
                        ) : (
                            <ReportSection
                                title="Client statement"
                                action={(
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leadingIcon={ArrowDownTrayIcon}
                                            onClick={() => downloadReport({
                                                filename: buildExportFileName(`client-statement-${slugifyFilePart(statementClient?.title || 'client')}`, resolvedRange.startDate, resolvedRange.endDate),
                                                columns: [
                                                    { key: 'section', header: 'Section' },
                                                    { key: 'invoiceNumber', header: 'Invoice Number' },
                                                    { key: 'date', header: 'Invoice Date' },
                                                    { key: 'dueDate', header: 'Due Date' },
                                                    { key: 'paidDate', header: 'Paid Date' },
                                                    { key: 'status', header: 'Status' },
                                                    { key: 'currency', header: 'Currency' },
                                                    { key: 'total', header: 'Total' },
                                                ],
                                                rows: clientStatementExportRows,
                                            })}
                                        >
                                            Export CSV
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leadingIcon={ArrowDownTrayIcon}
                                            onClick={() => exportClientStatementPdf({
                                                filename: `client-statement-${slugifyFilePart(statementClient?.title || 'client')}-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                                businessLabel: businessId !== 'all'
                                                    ? (businessInfosById.get(businessId)?.businessName || businessInfosById.get(businessId)?.name || businessInfosById.get(businessId)?.title || EMPTY_BUSINESS)
                                                    : 'All businesses',
                                                clientLabel: statementClient?.title || EMPTY_CLIENT,
                                                generatedAtLabel: toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
                                                periodLabel: getDateRangeLabel(resolvedRange),
                                                statementDateLabel: toDisplayDate(reportReferenceDate),
                                                summaryRows: clientStatementSummaryRows,
                                                openingRows: (clientStatementSummary?.openingBalanceInvoices || []).map((invoice) => ({
                                                    invoiceNumber: invoice.invoiceNumber,
                                                    date: toDisplayDate(invoice.date),
                                                    dueDate: invoice.dueDate ? toDisplayDate(invoice.dueDate) : '',
                                                    status: getInvoiceStatus(invoice, reportReferenceDate),
                                                    amount: formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency),
                                                })),
                                                paymentRows: (clientStatementSummary?.paymentsRecordedInRange || []).map((invoice) => ({
                                                    invoiceNumber: invoice.invoiceNumber,
                                                    paidDate: getInvoicePaymentDisplayDate(invoice),
                                                    amount: formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency),
                                                })),
                                                outstandingRows: (clientStatementSummary?.outstandingInvoices || []).map((invoice) => ({
                                                    invoiceNumber: invoice.invoiceNumber,
                                                    date: toDisplayDate(invoice.date),
                                                    dueDate: invoice.dueDate ? toDisplayDate(invoice.dueDate) : '',
                                                    status: getInvoiceStatus(invoice, reportReferenceDate),
                                                    amount: formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency),
                                                })),
                                            })}
                                        >
                                            Export PDF
                                        </Button>
                                    </div>
                                )}
                            >
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {clientStatementSummaryRows.map((row) => (
                                        <div key={row.label} className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{row.value}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{statementClient?.title || EMPTY_CLIENT}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Opening balance</h3>
                                        <div className="space-y-2">
                                            {(clientStatementSummary?.openingBalanceInvoices || []).length === 0 ? (
                                                <Notice title="No opening balance before this range" compact />
                                            ) : (
                                                clientStatementSummary.openingBalanceInvoices.map((invoice) => (
                                                    <div key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Issued {toDisplayDate(invoice.date)}
                                                                {invoice.dueDate ? ` • Due ${toDisplayDate(invoice.dueDate)}` : ''}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Invoices issued in period</h3>
                                        <div className="space-y-2">
                                            {(clientStatementSummary?.invoicesIssuedInRange || []).length === 0 ? (
                                                <Notice title="No invoices issued in this period" compact />
                                            ) : (
                                                clientStatementSummary.invoicesIssuedInRange.map((invoice) => (
                                                    <div key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                                                                <Badge variant={getStatusBadgeVariant(getInvoiceStatus(invoice, reportReferenceDate))}>
                                                                    {getInvoiceStatus(invoice, reportReferenceDate)}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Issued {toDisplayDate(invoice.date)}
                                                                {invoice.dueDate ? ` • Due ${toDisplayDate(invoice.dueDate)}` : ''}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Payments recorded</h3>
                                        <div className="space-y-2">
                                            {(clientStatementSummary?.paymentsRecordedInRange || []).length === 0 ? (
                                                <Notice title="No payments recorded in this period" compact />
                                            ) : (
                                                clientStatementSummary.paymentsRecordedInRange.map((invoice) => (
                                                    <div key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Paid {getInvoicePaymentDisplayDate(invoice)}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">Outstanding at statement date</h3>
                                        <div className="space-y-2">
                                            {(clientStatementSummary?.outstandingInvoices || []).length === 0 ? (
                                                <Notice title="No outstanding invoices at the statement date" compact />
                                            ) : (
                                                clientStatementSummary.outstandingInvoices.map((invoice) => (
                                                    <div key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                                                                <Badge variant={getStatusBadgeVariant(getInvoiceStatus(invoice, reportReferenceDate))}>
                                                                    {getInvoiceStatus(invoice, reportReferenceDate)}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Issued {toDisplayDate(invoice.date)}
                                                                {invoice.dueDate ? ` • Due ${toDisplayDate(invoice.dueDate)}` : ''}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </ReportSection>
                        )}
                    </div>
                )}

                {activeTab === 'work-summary' && (
                    <div className={buildSectionClassName(isMobileLayout)}>
                        {!selectedWorkSummaryProjectId ? (
                            <Notice
                                title="Select a single project to build a work summary"
                                description="Use the top-level project filter, or narrow the current slice until it only includes one project."
                            />
                        ) : (
                            <ReportSection
                                title="Project work summary"
                                action={(
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leadingIcon={ArrowDownTrayIcon}
                                            onClick={() => downloadReport({
                                                filename: buildExportFileName(`project-work-summary-${slugifyFilePart(workSummaryProject?.title || 'project')}`, resolvedRange.startDate, resolvedRange.endDate),
                                                columns: [
                                                    { key: 'task', header: 'Task' },
                                                    { key: 'entries', header: 'Entries' },
                                                    { key: 'totalDuration', header: 'Total Duration' },
                                                    { key: 'billableDuration', header: 'Billable Duration' },
                                                    { key: 'notes', header: 'Notes Count' },
                                                    { key: 'firstWorked', header: 'First Worked' },
                                                    { key: 'lastWorked', header: 'Last Worked' },
                                                ],
                                                rows: projectWorkSummaryRows,
                                            })}
                                        >
                                            Export CSV
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leadingIcon={ArrowDownTrayIcon}
                                            onClick={() => exportProjectWorkSummaryPdf({
                                                filename: `project-work-summary-${slugifyFilePart(workSummaryProject?.title || 'project')}-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                                clientLabel: workSummaryClient?.title || EMPTY_CLIENT,
                                                generatedAtLabel: toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
                                                periodLabel: getDateRangeLabel(resolvedRange),
                                                projectLabel: workSummaryProject?.title || EMPTY_PROJECT,
                                                summaryRows: projectWorkSummaryMetrics,
                                                taskRows: projectWorkSummaryPdfRows,
                                            })}
                                        >
                                            Export PDF
                                        </Button>
                                    </div>
                                )}
                            >
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {projectWorkSummaryMetrics.map((row) => (
                                        <div key={row.label} className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{row.value}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{workSummaryProject?.title || EMPTY_PROJECT}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
                                    {projectWorkSummaryRows.length === 0 ? (
                                        <Notice title="No worked tasks in this period" description="There are no time entries for this project in the selected range." compact />
                                    ) : (
                                        <div className="space-y-2">
                                            {projectWorkSummaryRows.map((row) => (
                                                <div key={row.task} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-foreground">{row.task}</p>
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {row.entries} entries
                                                            {' • '}
                                                            {row.notes} notes
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {row.firstWorked ? `First ${row.firstWorked}` : ''}
                                                            {row.firstWorked && row.lastWorked ? ' • ' : ''}
                                                            {row.lastWorked ? `Last ${row.lastWorked}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-foreground">{row.totalDuration}</p>
                                                        <p className="text-xs text-muted-foreground">Billable {row.billableDuration}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </ReportSection>
                        )}
                    </div>
                )}

                {activeTab === 'tax' && (
                    <div className={buildSectionClassName(isMobileLayout)}>
                        <ReportSection
                            title="VAT / tax summary"
                            action={(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('tax-summary', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: TAX_EXPORT_COLUMNS,
                                        rows: taxExportRows,
                                    })}
                                >
                                    Export CSV
                                </Button>
                            )}
                        >
                            {vatReviewItems.length > 0 ? (
                                <Notice
                                    title="Some tax records need review"
                                    description={vatReviewItems.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(' • ')}
                                    variant="warning"
                                />
                            ) : null}

                            {(vatSummary.salesBuckets.length === 0 && vatSummary.expenseBuckets.length === 0) ? (
                                <Notice
                                    title="No tax-relevant records in this period"
                                    description="Adjust the date, business, client, project, or status filters to expand the slice."
                                    compact
                                />
                            ) : (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sales net</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">
                                                {formatCurrencyBreakdown({
                                                    amountsByCurrency: vatSummary.totalsByCurrency.salesNet,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">{filteredInvoices.length} invoices in scope</p>
                                        </div>
                                        <div className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output tax</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">
                                                {formatCurrencyBreakdown({
                                                    amountsByCurrency: vatSummary.totalsByCurrency.outputTax,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">Invoice tax collected in this slice</p>
                                        </div>
                                        <div className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input tax</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">
                                                {formatCurrencyBreakdown({
                                                    amountsByCurrency: vatSummary.totalsByCurrency.inputTax,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">{filteredExpenses.length} expenses in scope</p>
                                        </div>
                                        <div className="rounded-lg border border-border p-3">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated VAT position</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">
                                                {formatCurrencyBreakdown({
                                                    amountsByCurrency: vatSummary.totalsByCurrency.netVat,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">Output tax minus input tax</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-4">
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-foreground">Sales buckets</h3>
                                            <div className="space-y-2">
                                                {vatSummary.salesBuckets.length === 0 ? (
                                                    <Notice title="No invoice tax rows in this slice" compact />
                                                ) : (
                                                    vatSummary.salesBuckets.map((row) => (
                                                        <div key={`${row.bucketLabel}-${row.currency}`} className="rounded-lg border border-border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold text-foreground">{row.bucketLabel}</p>
                                                                <p className="text-sm font-semibold text-foreground">{formatCurrency(row.grossAmount, row.currency)}</p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Net {formatCurrency(row.netAmount, row.currency)}
                                                                {' • '}
                                                                Tax {formatCurrency(row.taxAmount, row.currency)}
                                                                {' • '}
                                                                {row.count} invoices
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-foreground">Expense buckets</h3>
                                            <div className="space-y-2">
                                                {vatSummary.expenseBuckets.length === 0 ? (
                                                    <Notice title="No expense tax rows in this slice" compact />
                                                ) : (
                                                    vatSummary.expenseBuckets.map((row) => (
                                                        <div key={`${row.bucketLabel}-${row.currency}`} className="rounded-lg border border-border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold text-foreground">{row.bucketLabel}</p>
                                                                <p className="text-sm font-semibold text-foreground">{formatCurrency(row.grossAmount, row.currency)}</p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Net {formatCurrency(row.netAmount, row.currency)}
                                                                {' • '}
                                                                Tax {formatCurrency(row.taxAmount, row.currency)}
                                                                {' • '}
                                                                {row.count} expenses
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-foreground">Claim status</h3>
                                            <div className="space-y-2">
                                                {vatSummary.claimStatusBuckets.length === 0 ? (
                                                    <Notice title="No claim-state rows in this slice" compact />
                                                ) : (
                                                    vatSummary.claimStatusBuckets.map((row) => (
                                                        <div key={`${row.bucketLabel}-${row.currency}`} className="rounded-lg border border-border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold text-foreground">{row.bucketLabel}</p>
                                                                <p className="text-sm font-semibold text-foreground">{formatCurrency(row.taxAmount, row.currency)}</p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Net {formatCurrency(row.netAmount, row.currency)}
                                                                {' • '}
                                                                Gross {formatCurrency(row.grossAmount, row.currency)}
                                                                {' • '}
                                                                {row.count} expenses
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-foreground">Client geography</h3>
                                            <div className="space-y-2">
                                                {vatSummary.geographyBuckets.length === 0 ? (
                                                    <Notice title="No invoice geography rows in this slice" compact />
                                                ) : (
                                                    vatSummary.geographyBuckets.map((row) => (
                                                        <div key={`${row.geography}-${row.currency}`} className="rounded-lg border border-border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold text-foreground">{row.geography}</p>
                                                                <p className="text-sm font-semibold text-foreground">{formatCurrency(row.total, row.currency)}</p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">{row.count} invoices</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </ReportSection>
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <ReportSection
                        title="Issued invoices"
                        action={(
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('invoices', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: INVOICES_EXPORT_COLUMNS,
                                        rows: invoicesExportRows,
                                    })}
                                >
                                    Export CSV
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => exportInvoicesReportPdf({
                                        filename: `issued-invoices-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                        businessLabel: businessId !== 'all'
                                            ? (businessInfosById.get(businessId)?.businessName || businessInfosById.get(businessId)?.name || businessInfosById.get(businessId)?.title || EMPTY_BUSINESS)
                                            : 'All businesses',
                                        generatedAtLabel: toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
                                        periodLabel: getDateRangeLabel(resolvedRange),
                                        summarySections: invoiceRegisterSummarySections,
                                        rows: invoicesExportRows.map((row) => ({
                                            invoiceNumber: row.invoiceNumber,
                                            client: row.client,
                                            business: row.business,
                                            project: row.project,
                                            invoiceDate: row.invoiceDate ? toDisplayDate(row.invoiceDate) : '',
                                            dueDate: row.dueDate ? toDisplayDate(row.dueDate) : '',
                                            paidDate: row.paidDate ? toDisplayDate(row.paidDate) : '',
                                            status: row.status,
                                            currency: row.currency,
                                            subtotal: formatCurrency(row.subtotal, row.currency),
                                            tax: formatCurrency(row.tax, row.currency),
                                            total: formatCurrency(row.total, row.currency),
                                        })),
                                    })}
                                >
                                    Export PDF
                                </Button>
                            </div>
                        )}
                    >
                        {filteredInvoices.length === 0 ? (
                            <Notice title="No invoices in this period" description="Adjust the date or status filters to expand the slice." compact />
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-4 xl:grid-cols-4">
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">By status</h3>
                                        <div className="space-y-2">
                                            {invoiceRegisterSummary.totalsByStatus.map((row) => (
                                                <div key={row.label} className="rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-foreground capitalize">{row.label}</p>
                                                        <p className="text-sm font-semibold text-foreground">
                                                            {formatCurrencyBreakdown({
                                                                amountsByCurrency: row.totalByCurrency,
                                                                convertToCurrency,
                                                                currencyDisplayMode,
                                                                preferredCurrency,
                                                            })}
                                                        </p>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.count} invoices</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">By client</h3>
                                        <div className="space-y-2">
                                            {invoiceRegisterSummary.totalsByClient.slice(0, 5).map((row) => (
                                                <div key={row.label} className="rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-foreground">{row.label}</p>
                                                        <p className="text-sm font-semibold text-foreground">
                                                            {formatCurrencyBreakdown({
                                                                amountsByCurrency: row.totalByCurrency,
                                                                convertToCurrency,
                                                                currencyDisplayMode,
                                                                preferredCurrency,
                                                            })}
                                                        </p>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.count} invoices</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">By business</h3>
                                        <div className="space-y-2">
                                            {invoiceRegisterSummary.totalsByBusiness.slice(0, 5).map((row) => (
                                                <div key={row.label} className="rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-foreground">{row.label}</p>
                                                        <p className="text-sm font-semibold text-foreground">
                                                            {formatCurrencyBreakdown({
                                                                amountsByCurrency: row.totalByCurrency,
                                                                convertToCurrency,
                                                                currencyDisplayMode,
                                                                preferredCurrency,
                                                            })}
                                                        </p>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.count} invoices</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">By currency</h3>
                                        <div className="space-y-2">
                                            {invoiceRegisterSummary.totalsByCurrency.map((row) => (
                                                <div key={row.currency} className="rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-foreground">{row.currency}</p>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(row.total, row.currency)}</p>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Subtotal {formatCurrency(row.subtotal, row.currency)}
                                                        {' • '}
                                                        Tax {formatCurrency(row.tax, row.currency)}
                                                        {' • '}
                                                        {row.count} invoices
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {filteredInvoices.map((invoice) => {
                                        const client = clientsById.get(invoice.clientId);
                                        const business = invoice.businessInfoId ? businessInfosById.get(invoice.businessInfoId) : null;
                                        const project = invoice.projectId ? projectsById.get(invoice.projectId) : null;
                                        const status = getInvoiceStatus(invoice);

                                        return (
                                            <div key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                                                        <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {client?.title || EMPTY_CLIENT}
                                                        {' • '}
                                                        {getInvoiceProjectTitle(invoice, projectsById) || project?.title || EMPTY_PROJECT}
                                                        {' • '}
                                                        {business?.businessName || business?.name || business?.title || EMPTY_BUSINESS}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Issued {toDisplayDate(invoice.date)}{invoice.dueDate ? ` • Due ${toDisplayDate(invoice.dueDate)}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-foreground">{formatCurrency(getInvoiceTotal(invoice), invoice.currency || preferredCurrency)}</p>
                                                    <p className="text-xs text-muted-foreground">Tax {formatCurrency(invoice.tax || 0, invoice.currency || preferredCurrency)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </ReportSection>
                )}

                {activeTab === 'outstanding' && (
                    <ReportSection
                        title="Outstanding / aging"
                        action={(
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('outstanding-invoices', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: OUTSTANDING_EXPORT_COLUMNS,
                                        rows: outstandingExportRows,
                                    })}
                                >
                                    Export CSV
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => exportOutstandingReportPdf({
                                        filename: `outstanding-invoices-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                        businessLabel: businessId !== 'all'
                                            ? (businessInfosById.get(businessId)?.businessName || businessInfosById.get(businessId)?.name || businessInfosById.get(businessId)?.title || EMPTY_BUSINESS)
                                            : 'All businesses',
                                        generatedAtLabel: toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
                                        periodLabel: getDateRangeLabel(resolvedRange),
                                        referenceDateLabel: toDisplayDate(reportReferenceDate),
                                        summaryRows: outstandingSummaryRows,
                                        agingRows: outstandingAgingSummaryRows,
                                        invoiceRows: outstandingExportRows.map((row) => ({
                                            invoiceNumber: row.invoiceNumber,
                                            client: row.client,
                                            invoiceDate: toDisplayDate(row.invoiceDate),
                                            dueDate: row.dueDate ? toDisplayDate(row.dueDate) : 'No due date',
                                            status: row.status,
                                            daysOverdue: `${row.daysOverdue}`,
                                            amount: formatCurrency(row.total, row.currency),
                                        })),
                                    })}
                                >
                                    Export PDF
                                </Button>
                            </div>
                        )}
                    >
                        {outstandingInvoices.length === 0 ? (
                            <Notice
                                title="No outstanding invoices in this slice"
                                description="Adjust the date or invoice status filters to expand the aging view."
                                compact
                            />
                        ) : (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outstanding total</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {formatCurrencyBreakdown({
                                                amountsByCurrency: outstandingByCurrency,
                                                convertToCurrency,
                                                currencyDisplayMode,
                                                preferredCurrency,
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">{outstandingInvoices.length} invoices still open</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overdue total</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {formatCurrencyBreakdown({
                                                amountsByCurrency: overdueByCurrency,
                                                convertToCurrency,
                                                currencyDisplayMode,
                                                preferredCurrency,
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">{overdueInvoices.length} invoices past due</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oldest overdue</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {Math.max(0, ...outstandingExportRows.map((row) => row.daysOverdue))} days
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">Measured at {toDisplayDate(reportReferenceDate)}</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs review</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {outstandingSummary.filter((row) => row.bucketLabel === 'Needs review').reduce((sum, row) => sum + row.count, 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">Outstanding invoices without due date</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 xl:grid-cols-3">
                                    <div className="space-y-2 xl:col-span-1">
                                        <h3 className="text-sm font-semibold text-foreground">Aging buckets</h3>
                                        <div className="space-y-2">
                                            {outstandingSummary.map((row) => (
                                                <div key={`${row.bucketLabel}-${row.currency}`} className="rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-foreground">{row.bucketLabel}</p>
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(row.total, row.currency)}</p>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.count} invoices</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 xl:col-span-2">
                                        <h3 className="text-sm font-semibold text-foreground">Outstanding invoices</h3>
                                        <div className="space-y-2">
                                            {outstandingExportRows.map((row) => (
                                                <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-semibold text-foreground">{row.invoiceNumber}</p>
                                                            <Badge variant={getStatusBadgeVariant(row.status)}>{row.status}</Badge>
                                                            {row.daysOverdue > 0 ? <Badge variant="warning">{row.daysOverdue}d overdue</Badge> : null}
                                                        </div>
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {row.client}
                                                            {' • '}
                                                            {row.project}
                                                            {' • '}
                                                            {row.business}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Issued {toDisplayDate(row.invoiceDate)}
                                                            {row.dueDate ? ` • Due ${toDisplayDate(row.dueDate)}` : ' • No due date'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-foreground">{formatCurrency(row.total, row.currency)}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {row.daysOverdue > 0 ? `${row.daysOverdue} days overdue` : 'Not due yet'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </ReportSection>
                )}

                {activeTab === 'expenses' && (
                    <ReportSection
                        title="Expenses"
                        action={(
                            <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('expenses', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: EXPENSES_EXPORT_COLUMNS,
                                        rows: expensesExportRows,
                                })}
                            >
                                Export CSV
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                leadingIcon={ArrowDownTrayIcon}
                                onClick={() => exportExpensesReportPdf({
                                    filename: `expenses-${resolvedRange.startDate}-to-${resolvedRange.endDate}.pdf`,
                                    businessLabel: businessId !== 'all'
                                        ? (businessInfosById.get(businessId)?.businessName || businessInfosById.get(businessId)?.name || businessInfosById.get(businessId)?.title || EMPTY_BUSINESS)
                                        : 'All businesses',
                                    generatedAtLabel: toDisplayDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
                                    periodLabel: getDateRangeLabel(resolvedRange),
                                    summaryRows: expenseSummaryRows,
                                    rows: filteredExpenses.map((expense) => ({
                                        date: toDisplayDate(expense.date),
                                        paidDate: expense.paidOn ? toDisplayDate(expense.paidOn) : '',
                                        title: expense.title || '',
                                        supplier: expense.supplierName || '',
                                        category: expense.categoryId ? (expenseCategoriesById.get(expense.categoryId)?.name || EMPTY_CATEGORY) : EMPTY_CATEGORY,
                                        business: expense.businessId ? (businessInfosById.get(expense.businessId)?.businessName || businessInfosById.get(expense.businessId)?.name || businessInfosById.get(expense.businessId)?.title || EMPTY_BUSINESS) : EMPTY_BUSINESS,
                                        client: expense.clientId ? (clientsById.get(expense.clientId)?.title || EMPTY_CLIENT) : EMPTY_CLIENT,
                                        project: expense.projectId ? (projectsById.get(expense.projectId)?.title || EMPTY_PROJECT) : EMPTY_PROJECT,
                                        paymentStatus: expense.paymentStatus || '',
                                        billingStatus: expense.billingStatus || '',
                                        netAmount: formatCurrency(getExpenseNetAmount(expense), expense.currency || preferredCurrency),
                                        taxAmount: formatCurrency(getExpenseTaxAmount(expense), expense.currency || preferredCurrency),
                                        grossAmount: formatCurrency(expense.amount || 0, expense.currency || preferredCurrency),
                                    })),
                                })}
                            >
                                Export PDF
                            </Button>
                            </div>
                        )}
                    >
                        {filteredExpenses.length === 0 ? (
                            <Notice title="No expenses in this period" description="Adjust the date or expense filters to expand the slice." compact />
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ex VAT</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {formatCurrencyBreakdown({
                                                amountsByCurrency: expenseTotalsSummary.netByCurrency,
                                                convertToCurrency,
                                                currencyDisplayMode,
                                                preferredCurrency,
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">Net expense amount before tax</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">VAT amount</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {formatCurrencyBreakdown({
                                                amountsByCurrency: expenseTotalsSummary.taxByCurrency,
                                                convertToCurrency,
                                                currencyDisplayMode,
                                                preferredCurrency,
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">Derived from current expense tax fields</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inc VAT</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">
                                            {formatCurrencyBreakdown({
                                                amountsByCurrency: expenseTotalsSummary.grossByCurrency,
                                                convertToCurrency,
                                                currencyDisplayMode,
                                                preferredCurrency,
                                            })}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">{expenseTotalsSummary.count} expenses in scope</p>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs review</p>
                                        <p className="mt-2 text-lg font-semibold text-foreground">{expenseTotalsSummary.missingTaxMetadataCount}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">Expenses without enough tax metadata</p>
                                    </div>
                                </div>

                                {expenseTotalsSummary.missingTaxMetadataCount > 0 ? (
                                    <Notice
                                        title="Some expense totals need tax review"
                                        description={`${expenseTotalsSummary.missingTaxMetadataCount} expenses are included in gross totals but do not have enough tax metadata for a cleaner VAT breakdown.`}
                                        compact
                                        variant="warning"
                                    />
                                ) : null}

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                                    <div className="flex items-center gap-3">
                                        <CustomCheckbox
                                            checked={allFilteredExpensesSelected}
                                            onChange={toggleAllExpensesSelection}
                                            label={`Select all ${filteredExpenses.length} expenses`}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {selectedExpenseCount > 0
                                                ? `${selectedExpenseCount} selected`
                                                : 'Select expenses to mark them as claimed or unclaimed'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={markSelectedExpensesAsUnclaimed}
                                            disabled={selectedExpenseCount === 0}
                                        >
                                            Mark selected as unclaimed
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={openClaimDialog}
                                            disabled={selectedExpenseCount === 0}
                                        >
                                            Mark selected as claimed
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {filteredExpenses.map((expense) => {
                                        const business = expense.businessId ? businessInfosById.get(expense.businessId) : null;
                                        const client = expense.clientId ? clientsById.get(expense.clientId) : null;
                                        const project = expense.projectId ? projectsById.get(expense.projectId) : null;
                                        const category = expense.categoryId ? expenseCategoriesById.get(expense.categoryId) : null;
                                        const taxClaimStatus = getExpenseTaxClaimStatus(expense);
                                        const taxReturnPeriod = expense.taxClaimPeriodId ? taxReturnPeriodsById.get(expense.taxClaimPeriodId) : null;
                                        const claimBadgeVariant = taxClaimStatus === 'claimed'
                                            ? 'success'
                                            : (taxClaimStatus === 'excluded' ? 'secondary' : 'outline');

                                        return (
                                            <div key={expense.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                <div className="pt-0.5">
                                                    <Checkbox
                                                        checked={selectedExpenseIds.includes(expense.id)}
                                                        onCheckedChange={(checked) => toggleExpenseSelection(expense.id, checked === true)}
                                                        aria-label={`Select ${expense.title}`}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-foreground">{expense.title}</p>
                                                        <Badge variant={expense.paymentStatus === 'paid' ? 'success' : 'warning'}>
                                                            {expense.paymentStatus}
                                                        </Badge>
                                                        {expense.billable ? <Badge variant="outline">Billable</Badge> : null}
                                                        <Badge variant={claimBadgeVariant}>
                                                            {getExpenseTaxClaimStatusLabel(taxClaimStatus)}
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {expense.supplierName || 'No supplier'}
                                                        {' • '}
                                                        {project?.title || client?.title || business?.businessName || business?.name || business?.title || EMPTY_BUSINESS}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {category?.name || EMPTY_CATEGORY}
                                                        {taxReturnPeriod ? ` • ${taxReturnPeriod.title}` : ''}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {toDisplayDate(expense.date)}{expense.paidOn ? ` • Paid ${toDisplayDate(expense.paidOn)}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-foreground">{formatCurrency(expense.amount || 0, expense.currency || preferredCurrency)}</p>
                                                    <p className="text-xs text-muted-foreground">Tax {formatCurrency(getExpenseTaxAmount(expense), expense.currency || preferredCurrency)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </ReportSection>
                )}

                {activeTab === 'hours' && (
                    <ReportSection
                        title="Hours worked"
                        action={(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('hours', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: HOURS_EXPORT_COLUMNS,
                                        rows: hoursExportRows,
                                    })}
                                >
                                    Export CSV
                            </Button>
                        )}
                    >
                        {hoursRows.length === 0 ? (
                            <Notice title="No time entries in this period" description="Adjust the period or project/client filters to expand the slice." compact />
                        ) : (
                            <div className="space-y-3">
                                {hoursRows.map((row) => (
                                    <div key={row.key} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground">{row.projectTitle}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{row.clientTitle}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{row.entriesCount} entries</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-foreground">{formatDuration(row.totalMs)}</p>
                                            <p className="text-xs text-muted-foreground">Billable {formatDuration(row.billableMs)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReportSection>
                )}

                {activeTab === 'to-invoice' && (
                    <ReportSection
                        title="To invoice"
                        action={(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    leadingIcon={ArrowDownTrayIcon}
                                    onClick={() => downloadReport({
                                        filename: buildExportFileName('to-invoice', resolvedRange.startDate, resolvedRange.endDate),
                                        columns: TO_INVOICE_EXPORT_COLUMNS,
                                        rows: toInvoiceExportRows,
                                    })}
                                >
                                    Export CSV
                            </Button>
                        )}
                    >
                        <Notice
                            title="Read-only in Phase 1"
                            description="This view highlights uninvoiced work and billable expenses without mutating billing state or generating invoices yet."
                            compact
                        />
                        {toInvoiceRows.length === 0 ? (
                            <Notice title="No uninvoiced work found" description="Nothing billable is currently left open inside the selected slice." compact />
                        ) : (
                            <div className="space-y-3">
                                {toInvoiceRows.map((row) => (
                                    <div key={row.key} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground">{row.projectTitle}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{row.clientTitle}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {formatDuration(row.uninvoicedHoursMs)} uninvoiced • {row.expenseCount} billable expenses
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-foreground">
                                                {formatCurrencyBreakdown({
                                                    amountsByCurrency: row.totalAmountsByCurrency,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Time {formatCurrencyBreakdown({
                                                    amountsByCurrency: row.estimatedAmountsByCurrency,
                                                    convertToCurrency,
                                                    currencyDisplayMode,
                                                    preferredCurrency,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReportSection>
                )}
                </div>

                <Dialog open={isClaimDialogOpen} onOpenChange={(open) => {
                    if (!open) {
                        closeClaimDialog();
                    }
                }}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Mark selected expenses as claimed</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <Notice
                                title={`${selectedExpenseCount} expense${selectedExpenseCount === 1 ? '' : 's'} selected`}
                                description="Pick an existing tax return period or create a new one for this claim batch."
                                compact
                            />

                            <div className="space-y-2">
                                <Label htmlFor="tax-return-period-select">Tax return period</Label>
                                <Select value={selectedTaxReturnPeriodId} onValueChange={setSelectedTaxReturnPeriodId}>
                                    <SelectTrigger id="tax-return-period-select">
                                        <SelectValue placeholder="Choose a tax return period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NEW_TAX_RETURN_PERIOD_VALUE}>Create new period</SelectItem>
                                        {availableTaxReturnPeriods.map((taxReturnPeriod) => (
                                            <SelectItem key={taxReturnPeriod.id} value={taxReturnPeriod.id}>
                                                {taxReturnPeriod.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedTaxReturnPeriodId === NEW_TAX_RETURN_PERIOD_VALUE ? (
                                <div className="space-y-4 rounded-lg border border-border p-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tax-return-period-title">Period title</Label>
                                        <Input
                                            id="tax-return-period-title"
                                            value={claimPeriodDraft.title}
                                            onChange={(event) => setClaimPeriodDraft((current) => ({
                                                ...current,
                                                title: event.target.value,
                                            }))}
                                            placeholder="May 2026 VAT return"
                                        />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="tax-return-period-start">Start date</Label>
                                            <NativeDateInput
                                                id="tax-return-period-start"
                                                value={claimPeriodDraft.startDate}
                                                onChange={(event) => setClaimPeriodDraft((current) => ({
                                                    ...current,
                                                    startDate: event.target.value,
                                                }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="tax-return-period-end">End date</Label>
                                            <NativeDateInput
                                                id="tax-return-period-end"
                                                value={claimPeriodDraft.endDate}
                                                onChange={(event) => setClaimPeriodDraft((current) => ({
                                                    ...current,
                                                    endDate: event.target.value,
                                                }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tax-return-period-type">Period type</Label>
                                        <Select
                                            value={claimPeriodDraft.type}
                                            onValueChange={(value) => setClaimPeriodDraft((current) => ({
                                                ...current,
                                                type: value,
                                            }))}
                                        >
                                            <SelectTrigger id="tax-return-period-type">
                                                <SelectValue placeholder="Period type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="vat">VAT</SelectItem>
                                                <SelectItem value="income-tax">Income tax</SelectItem>
                                                <SelectItem value="sales-tax">Sales tax</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tax-return-period-notes">Notes</Label>
                                        <Textarea
                                            id="tax-return-period-notes"
                                            value={claimPeriodDraft.notes}
                                            onChange={(event) => setClaimPeriodDraft((current) => ({
                                                ...current,
                                                notes: event.target.value,
                                            }))}
                                            placeholder="Optional filing notes"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={closeClaimDialog}>
                                    Cancel
                                </Button>
                                <Button type="button" onClick={markSelectedExpensesAsClaimed}>
                                    Mark as claimed
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

export default Reports;
