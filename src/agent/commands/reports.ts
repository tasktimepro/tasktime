import { endOfDay } from 'date-fns';
import type { AgentCommandContext } from '@/agent/types';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { BusinessBrandAsset, BusinessInfo, Client, Expense, ExpenseCategory, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import {
    buildClientStatementSummary,
    buildExpenseTotalsSummary,
    buildInvoiceRegisterSummary,
    buildOutstandingInvoiceSummary,
    buildProjectWorkSummary,
    buildVatReportSummary,
    getExpenseTaxAmount,
    getExpenseTaxClaimStatus,
    getInvoiceDaysOverdue,
    getInvoiceReportAmount,
    sumInvoiceReportAmountsByCurrency,
} from '@/utils/reportCalculations';
import { getDefaultCustomRange, getDefaultReportPeriod, resolveReportDateRange, type ReportPeriodValue } from '@/utils/reportDateUtils';
import { formatCurrency, getProjectCurrency } from '@/utils/currencyUtils';
import { formatDuration, millisecondsToHours, parseStoredDate, toDisplayDate, toStorageDate } from '@/utils/dateUtils';
import {
    getInvoicePaidAtTimestamp,
    getInvoiceProjectFinancials,
    getInvoiceProjectRevenueBreakdown,
    getInvoiceProjectTitle,
    getInvoiceStatus,
    getInvoiceTotal,
    invoiceBelongsToProject,
    isInvoiceCanceled,
    isInvoiceOutstanding,
    isInvoiceOverdue,
    isInvoicePaid,
    isInvoiceRevenueBearing,
    matchesInvoiceStatusFilter,
} from '@/utils/invoiceUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import { isTimestampStartWithinStoredDateRange } from '@/utils/reportDateBoundary';
import { assertPermission, assertReady } from './shared';

type ReportSection =
    | 'overview'
    | 'monthly'
    | 'statement'
    | 'work-summary'
    | 'tax'
    | 'invoices'
    | 'outstanding'
    | 'expenses'
    | 'hours'
    | 'to-invoice';

interface HoursReportRow {
    key: string;
    projectTitle: string;
    clientTitle: string;
    totalMs: number;
    billableMs: number;
    unbilledBillableMs: number;
    entriesCount: number;
}

interface ToInvoiceReportRow {
    key: string;
    clientTitle: string;
    projectTitle: string;
    uninvoicedHoursMs: number;
    expenseAmountsByCurrency: Record<string, number>;
    expenseCount: number;
    estimatedAmountsByCurrency: Record<string, number>;
    hourlyRate: number;
}

export interface ReportSummaryInput {
    section?: ReportSection;
    period?: ReportPeriodValue;
    customStart?: string | null;
    customEnd?: string | null;
    businessId?: string | null;
    clientId?: string | null;
    projectId?: string | null;
    categoryId?: string | null;
    invoiceStatus?: 'all' | 'non-draft' | 'paid' | 'unpaid' | 'overdue' | 'draft' | 'canceled';
    expenseStatus?: 'all' | 'paid' | 'unpaid' | 'claimed' | 'unclaimed' | 'excluded';
    incomeDateBasis?: 'invoice-date' | 'paid-date';
    expenseDateBasis?: 'expense-date' | 'paid-date';
    includeRows?: boolean;
    rowLimit?: number;
    rowLimitMax?: number;
}

export interface ExportReportCsvInput extends ReportSummaryInput {
    filename?: string;
    section: ReportSection;
}

export interface ExportReportPdfInput extends ReportSummaryInput {
    filename?: string;
    section: 'overview' | 'monthly' | 'statement' | 'work-summary' | 'invoices' | 'outstanding' | 'expenses';
}

export interface ExportAccountantPackInput extends ReportSummaryInput {
    filename?: string;
    includeInvoicePdfs?: boolean;
}

const EMPTY_BUSINESS = 'Unassigned';
const EMPTY_CLIENT = 'No client';
const EMPTY_PROJECT = 'No project';
const EMPTY_CATEGORY = 'No category';
const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 500;
const MAX_EXPORT_ROW_LIMIT = 10_000;

const clampRowLimit = (value: unknown, maxLimit = MAX_ROW_LIMIT, fallback = DEFAULT_ROW_LIMIT) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(1, Math.min(maxLimit, Math.floor(value)));
};

const buildExportFileName = (prefix: string, startDate: string, endDate: string) => `${prefix}-${startDate}-to-${endDate}.csv`;

const buildPdfExportFileName = (prefix: string, startDate: string, endDate: string) => `${prefix}-${startDate}-to-${endDate}.pdf`;

const normalizeCsvFilename = (filename: string) => {
    const trimmed = filename.trim();

    if (!trimmed) {
        return trimmed;
    }

    return trimmed.toLowerCase().endsWith('.csv') ? trimmed : `${trimmed}.csv`;
};

const normalizePdfFilename = (filename: string) => {
    const trimmed = filename.trim();

    if (!trimmed) {
        return trimmed;
    }

    return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
};

const normalizeZipFilename = (filename: string) => {
    const trimmed = filename.trim();

    if (!trimmed) {
        return trimmed;
    }

    return trimmed.toLowerCase().endsWith('.zip') ? trimmed : `${trimmed}.zip`;
};

const stringifyAmountMap = (value: unknown) => {
    if (!value || typeof value !== 'object') {
        return '';
    }

    return Object.entries(value as Record<string, number>)
        .filter(([, amount]) => Number.isFinite(amount) && amount !== 0)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([currency, amount]) => `${currency} ${amount}`)
        .join(' + ');
};

const addCurrencyAmount = (totals: Record<string, number>, currency: string | null | undefined, amount: number) => {
    if (!currency || !Number.isFinite(amount) || amount === 0) {
        return;
    }

    totals[currency] = (totals[currency] || 0) + amount;
};

const addCurrencyTotals = (...currencyTotals: Record<string, number>[]) => {
    const result: Record<string, number> = {};

    currencyTotals.forEach((totals) => {
        Object.entries(totals).forEach(([currency, amount]) => addCurrencyAmount(result, currency, amount));
    });

    return result;
};

const subtractCurrencyTotals = (leftTotals: Record<string, number>, rightTotals: Record<string, number>) => {
    const result: Record<string, number> = {};

    Object.entries(leftTotals).forEach(([currency, amount]) => addCurrencyAmount(result, currency, amount));
    Object.entries(rightTotals).forEach(([currency, amount]) => addCurrencyAmount(result, currency, -amount));

    return result;
};

const sumAmountsByCurrency = <T,>(
    items: T[],
    getCurrency: (item: T) => string | null | undefined,
    getAmount: (item: T) => number
) => {
    return items.reduce<Record<string, number>>((totals, item) => {
        addCurrencyAmount(totals, getCurrency(item), getAmount(item));
        return totals;
    }, {});
};

const matchesStoredDateRange = (dateValue: string | null | undefined, startDate: string, endDate: string) => {
    return Boolean(dateValue && dateValue >= startDate && dateValue <= endDate);
};

const getTimestampDateString = (timestamp: number | null | undefined) => {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
        return null;
    }

    return toStorageDate(timestamp);
};

const getInvoicePaymentDateString = (invoice: Invoice) => getTimestampDateString(getInvoicePaidAtTimestamp(invoice));

const scopeInvoiceToProject = (
    invoice: Invoice,
    projectId: string,
    projectsById: Map<string, Project>
) => {
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
    } as Invoice;
};

const getPreferredCurrency = (context: AgentCommandContext) => {
    const value = context.store.preferences.get('currency');
    return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'EUR';
};

const collectReportsData = async (context: AgentCommandContext) => {
    const store = context.store;
    const [expenses, invoices, tasks, timeEntries] = await Promise.all([
        typeof store.getAllExpenses === 'function'
            ? store.getAllExpenses()
            : Promise.resolve(collectValidatedEntities<Expense>('expenses', store.expenses as any, 'agent report expenses')),
        typeof store.getAllInvoices === 'function'
            ? store.getAllInvoices()
            : Promise.resolve(collectValidatedEntities<Invoice>('invoices', store.invoices as any, 'agent report invoices')),
        typeof store.getAllTasks === 'function'
            ? store.getAllTasks()
            : Promise.resolve(collectValidatedEntities<Task>('tasks', store.tasks as any, 'agent report tasks')),
        typeof store.loadAllTimeEntries === 'function'
            ? store.loadAllTimeEntries()
            : Promise.resolve(store.getAllTimeEntries()),
    ]);

    return {
        businessInfos: collectValidatedEntities<BusinessInfo>('businessInfos', store.businessInfos as any, 'agent report business infos'),
        clients: collectValidatedEntities<Client>('clients', store.clients as any, 'agent report clients'),
        expenseCategories: collectValidatedEntities<ExpenseCategory>('expenseCategories', store.expenseCategories as any, 'agent report expense categories'),
        expenses,
        invoices,
        projects: collectValidatedEntities<Project>('projects', store.projects as any, 'agent report projects'),
        tasks,
        timeEntries: timeEntries
            .filter((entry): entry is TimeEntry => !!entry && typeof entry.id === 'string' && typeof entry.taskId === 'string'),
    };
};

export async function getReportSummaryCommand(context: AgentCommandContext, input: ReportSummaryInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');

    const customRange = getDefaultCustomRange(new Date(context.now?.() || Date.now()));
    const resolvedRange = resolveReportDateRange({
        period: input.period || getDefaultReportPeriod(),
        customStart: input.customStart || customRange.customStart,
        customEnd: input.customEnd || customRange.customEnd,
        referenceDate: new Date(context.now?.() || Date.now()),
    });
    const businessId = input.businessId || 'all';
    const clientId = input.clientId || 'all';
    const projectId = input.projectId || 'all';
    const categoryId = input.categoryId || 'all';
    const invoiceStatus = input.invoiceStatus || 'non-draft';
    const expenseStatus = input.expenseStatus || 'all';
    const incomeDateBasis = input.incomeDateBasis || 'invoice-date';
    const expenseDateBasis = input.expenseDateBasis || 'expense-date';
    const includeRows = input.includeRows === true;
    const rowLimit = clampRowLimit(input.rowLimit, input.rowLimitMax ?? MAX_ROW_LIMIT);
    const preferredCurrency = getPreferredCurrency(context);
    const reportReferenceDate = endOfDay(parseStoredDate(resolvedRange.endDate) || new Date(context.now?.() || Date.now()));
    const data = await collectReportsData(context);
    const projectsById = new Map(data.projects.map((project) => [project.id, project]));
    const clientsById = new Map(data.clients.map((client) => [client.id, client]));
    const businessInfosById = new Map(data.businessInfos.map((businessInfo) => [businessInfo.id, businessInfo]));
    const expenseCategoriesById = new Map(data.expenseCategories.map((category) => [category.id, category]));
    const tasksById = new Map(data.tasks.map((task) => [task.id, task]));

    const entityFilteredInvoices = data.invoices.filter((invoice) => {
        if (businessId !== 'all' && (invoice.businessInfoId || '') !== businessId) return false;
        if (clientId !== 'all' && invoice.clientId !== clientId) return false;
        if (projectId !== 'all' && !invoiceBelongsToProject(invoice, projectId)) return false;

        return matchesInvoiceStatusFilter(invoice, invoiceStatus);
    });
    const scopedEntityFilteredInvoices = projectId === 'all'
        ? entityFilteredInvoices
        : entityFilteredInvoices
            .map((invoice) => scopeInvoiceToProject(invoice, projectId, projectsById))
            .filter((invoice): invoice is Invoice => Boolean(invoice));
    const financialScopedEntityFilteredInvoices = scopedEntityFilteredInvoices.filter(isInvoiceRevenueBearing);
    const filteredInvoices = scopedEntityFilteredInvoices.filter((invoice) => {
        const dateValue = incomeDateBasis === 'paid-date' ? getInvoicePaymentDateString(invoice) : invoice.date;
        return matchesStoredDateRange(dateValue, resolvedRange.startDate, resolvedRange.endDate);
    });
    const financialFilteredInvoices = filteredInvoices.filter(isInvoiceRevenueBearing);
    const issuedInvoicesInRange = financialScopedEntityFilteredInvoices.filter((invoice) => matchesStoredDateRange(invoice.date, resolvedRange.startDate, resolvedRange.endDate));
    const paidInvoicesInRange = financialScopedEntityFilteredInvoices.filter((invoice) => (
        isInvoicePaid(invoice) && matchesStoredDateRange(getInvoicePaymentDateString(invoice), resolvedRange.startDate, resolvedRange.endDate)
    ));
    const outstandingInvoices = financialScopedEntityFilteredInvoices.filter((invoice) => (
        isInvoiceOutstanding(invoice) && invoice.date <= resolvedRange.endDate
    ));
    const overdueInvoices = outstandingInvoices.filter((invoice) => isInvoiceOverdue(invoice, reportReferenceDate));
    const filteredExpenses = data.expenses.filter((expense) => {
        if (businessId !== 'all' && (expense.businessId || '') !== businessId) return false;
        if (clientId !== 'all' && (expense.clientId || '') !== clientId) return false;
        if (projectId !== 'all' && (expense.projectId || '') !== projectId) return false;
        if (categoryId !== 'all' && (expense.categoryId || '') !== categoryId) return false;
        if (expenseStatus === 'paid' && expense.paymentStatus !== 'paid') return false;
        if (expenseStatus === 'unpaid' && expense.paymentStatus !== 'unpaid') return false;

        const taxClaimStatus = getExpenseTaxClaimStatus(expense);
        if (expenseStatus === 'claimed' && taxClaimStatus !== 'claimed') return false;
        if (expenseStatus === 'unclaimed' && taxClaimStatus !== 'unclaimed') return false;
        if (expenseStatus === 'excluded' && taxClaimStatus !== 'excluded') return false;

        const dateValue = expenseDateBasis === 'paid-date' ? expense.paidOn : expense.date;
        return matchesStoredDateRange(dateValue, resolvedRange.startDate, resolvedRange.endDate);
    });
    const filteredTimeEntries = data.timeEntries
        .filter((entry) => isTimestampStartWithinStoredDateRange(
            entry.start,
            resolvedRange.startDate,
            resolvedRange.endDate,
        ))
        .map((entry) => {
            const task = tasksById.get(entry.taskId) || null;
            const project = task?.projectId ? projectsById.get(task.projectId) || null : null;
            const client = project?.preferredClientId ? clientsById.get(project.preferredClientId) || null : null;

            return { ...entry, task, project, client };
        })
        .filter((entry) => {
            if (!entry.task) return false;
            if (projectId !== 'all' && entry.project?.id !== projectId) return false;
            if (clientId !== 'all' && entry.client?.id !== clientId) return false;
            return true;
        });

    const hoursRows = Array.from(filteredTimeEntries.reduce((grouped, entry) => {
        const projectKey = entry.project?.id || `task:${entry.task!.id}`;
        const existing = grouped.get(projectKey) || {
            key: projectKey,
            projectTitle: entry.project?.title || entry.task!.title || EMPTY_PROJECT,
            clientTitle: entry.client?.title || EMPTY_CLIENT,
            totalMs: 0,
            billableMs: 0,
            unbilledBillableMs: 0,
            entriesCount: 0,
        };
        const actualMs = Math.max(0, (entry.end || 0) - entry.start);
        const billableMs = entry.task!.billable ? getBillableDurationMs(entry) : 0;

        existing.totalMs += actualMs;
        existing.billableMs += billableMs;
        existing.unbilledBillableMs += entry.task!.billable && !entry.billedInvoiceId ? billableMs : 0;
        existing.entriesCount += 1;
        grouped.set(projectKey, existing);
        return grouped;
    }, new Map<string, HoursReportRow>()).values()).sort((rowA, rowB) => rowB.totalMs - rowA.totalMs);

    const unbilledExpenseRows = filteredExpenses.filter((expense) => expense.billable && expense.billingStatus === 'unbilled');
    const activeProjects = data.projects.filter((project) => !project.archived);
    const toInvoiceRows = Array.from(hoursRows.reduce((grouped, row) => {
        const project = activeProjects.find((item) => item.title === row.projectTitle) || activeProjects.find((item) => item.id === row.key);
        const hourlyRate = typeof project?.hourlyRate === 'number' ? project.hourlyRate : 0;
        const projectCurrency = project ? getProjectCurrency(project, data.clients, preferredCurrency) : preferredCurrency;
        const estimatedAmount = hourlyRate > 0
            ? Math.round(millisecondsToHours(row.unbilledBillableMs) * hourlyRate * 100) / 100
            : 0;
        const estimatedAmountsByCurrency: Record<string, number> = {};

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
        return grouped;
    }, new Map<string, ToInvoiceReportRow>()).values());

    const toInvoiceRowsByKey = new Map(toInvoiceRows.map((row) => [row.key, row]));
    unbilledExpenseRows.forEach((expense) => {
        const key = expense.projectId || `expense-client:${expense.clientId || 'none'}`;
        const current = toInvoiceRowsByKey.get(key) || {
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
        toInvoiceRowsByKey.set(key, current);
    });

    const normalizedToInvoiceRows = Array.from(toInvoiceRowsByKey.values())
        .map((row) => ({
            ...row,
            totalAmountsByCurrency: addCurrencyTotals(row.estimatedAmountsByCurrency, row.expenseAmountsByCurrency),
        }))
        .filter((row) => row.uninvoicedHoursMs > 0 || Object.keys(row.expenseAmountsByCurrency).length > 0);

    const revenueIssuedByCurrency = sumInvoiceReportAmountsByCurrency(issuedInvoicesInRange, preferredCurrency);
    const revenuePaidByCurrency = sumInvoiceReportAmountsByCurrency(paidInvoicesInRange, preferredCurrency);
    const outstandingByCurrency = sumAmountsByCurrency(outstandingInvoices, (invoice) => invoice.currency || preferredCurrency, getInvoiceTotal);
    const overdueByCurrency = sumAmountsByCurrency(overdueInvoices, (invoice) => invoice.currency || preferredCurrency, getInvoiceTotal);
    const outputTaxByCurrency = sumAmountsByCurrency(issuedInvoicesInRange, (invoice) => invoice.currency || preferredCurrency, (invoice) => invoice.tax || 0);
    const expensesByCurrency = sumAmountsByCurrency(filteredExpenses, (expense) => expense.currency || preferredCurrency, (expense) => expense.amount || 0);
    const inputTaxByCurrency = sumAmountsByCurrency(
        filteredExpenses.filter((expense) => getExpenseTaxClaimStatus(expense) !== 'excluded'),
        (expense) => expense.currency || preferredCurrency,
        getExpenseTaxAmount
    );
    const totalHoursMs = filteredTimeEntries.reduce((sum, entry) => sum + Math.max(0, (entry.end || 0) - entry.start), 0);
    const billableHoursMs = filteredTimeEntries.reduce((sum, entry) => sum + (entry.task?.billable ? getBillableDurationMs(entry) : 0), 0);
    const vatSummary = buildVatReportSummary({ invoices: financialFilteredInvoices, expenses: filteredExpenses, clientsById, businessInfosById });
    const outstandingSummary = buildOutstandingInvoiceSummary(outstandingInvoices, reportReferenceDate);
    const expenseTotalsSummary = buildExpenseTotalsSummary(filteredExpenses);
    const invoiceRegisterSummary = buildInvoiceRegisterSummary({ invoices: filteredInvoices, clientsById, businessInfosById, preferredCurrency });
    const statementClientIds = Array.from(new Set(financialScopedEntityFilteredInvoices.map((invoice) => invoice.clientId).filter(Boolean)));
    const selectedStatementClientId = clientId !== 'all' ? clientId : (statementClientIds.length === 1 ? statementClientIds[0] : null);
    const statementInvoices = selectedStatementClientId
        ? financialScopedEntityFilteredInvoices.filter((invoice) => invoice.clientId === selectedStatementClientId)
        : [];
    const clientStatementSummary = selectedStatementClientId
        ? buildClientStatementSummary({
            invoices: statementInvoices,
            preferredCurrency,
            startDate: resolvedRange.startDate,
            endDate: resolvedRange.endDate,
            referenceDate: reportReferenceDate,
        })
        : null;
    const workSummaryProjectIds = Array.from(new Set(filteredTimeEntries.map((entry) => entry.project?.id).filter(Boolean)));
    const selectedWorkSummaryProjectId = projectId !== 'all' ? projectId : (workSummaryProjectIds.length === 1 ? workSummaryProjectIds[0] : null);
    const workSummaryEntries = selectedWorkSummaryProjectId
        ? filteredTimeEntries.filter((entry) => entry.project?.id === selectedWorkSummaryProjectId)
        : [];
    const projectWorkSummary = selectedWorkSummaryProjectId ? buildProjectWorkSummary(workSummaryEntries) : null;

    return {
        section: input.section || 'overview',
        filters: {
            businessId,
            categoryId,
            clientId,
            expenseDateBasis,
            expenseStatus,
            incomeDateBasis,
            invoiceStatus,
            projectId,
        },
        rowLimit: includeRows ? rowLimit : undefined,
        rowMetadata: includeRows ? {
            invoices: { total: filteredInvoices.length, returned: Math.min(filteredInvoices.length, rowLimit), truncated: filteredInvoices.length > rowLimit },
            expenses: { total: filteredExpenses.length, returned: Math.min(filteredExpenses.length, rowLimit), truncated: filteredExpenses.length > rowLimit },
            hours: { total: hoursRows.length, returned: Math.min(hoursRows.length, rowLimit), truncated: hoursRows.length > rowLimit },
            timeEntries: { total: filteredTimeEntries.length, returned: Math.min(filteredTimeEntries.length, rowLimit), truncated: filteredTimeEntries.length > rowLimit },
            outstanding: { total: outstandingInvoices.length, returned: Math.min(outstandingInvoices.length, rowLimit), truncated: outstandingInvoices.length > rowLimit },
            toInvoice: { total: normalizedToInvoiceRows.length, returned: Math.min(normalizedToInvoiceRows.length, rowLimit), truncated: normalizedToInvoiceRows.length > rowLimit },
        } : undefined,
        period: resolvedRange,
        preferredCurrency,
        counts: {
            invoices: filteredInvoices.length,
            issuedInvoices: issuedInvoicesInRange.length,
            paidInvoices: paidInvoicesInRange.length,
            outstandingInvoices: outstandingInvoices.length,
            overdueInvoices: overdueInvoices.length,
            expenses: filteredExpenses.length,
            timeEntries: filteredTimeEntries.length,
            toInvoiceGroups: normalizedToInvoiceRows.length,
            reviewItems: vatSummary.needsReview.missingInvoiceBusinessInfo
                + vatSummary.needsReview.missingClientCountry
                + vatSummary.needsReview.missingExpenseTaxMetadata,
        },
        totalsByCurrency: {
            revenueIssued: revenueIssuedByCurrency,
            revenuePaid: revenuePaidByCurrency,
            outstanding: outstandingByCurrency,
            overdue: overdueByCurrency,
            outputTax: outputTaxByCurrency,
            inputTax: inputTaxByCurrency,
            estimatedVatPosition: subtractCurrencyTotals(outputTaxByCurrency, inputTaxByCurrency),
            expenses: expensesByCurrency,
            estimatedProfit: subtractCurrencyTotals(revenuePaidByCurrency, expensesByCurrency),
            uninvoicedExpenses: addCurrencyTotals(...normalizedToInvoiceRows.map((row) => row.expenseAmountsByCurrency)),
            uninvoicedEstimatedTime: addCurrencyTotals(...normalizedToInvoiceRows.map((row) => row.estimatedAmountsByCurrency)),
            uninvoicedValue: addCurrencyTotals(...normalizedToInvoiceRows.map((row) => row.totalAmountsByCurrency)),
        },
        time: {
            totalHoursMs,
            billableHoursMs,
            uninvoicedHoursMs: normalizedToInvoiceRows.reduce((sum, row) => sum + row.uninvoicedHoursMs, 0),
            billableUtilization: totalHoursMs > 0 ? billableHoursMs / totalHoursMs : 0,
        },
        summaries: {
            invoiceRegister: invoiceRegisterSummary,
            tax: vatSummary,
            outstanding: outstandingSummary,
            expenses: expenseTotalsSummary,
            clientStatement: clientStatementSummary,
            projectWork: projectWorkSummary,
        },
        rows: includeRows ? {
            invoices: filteredInvoices.slice(0, rowLimit).map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                client: clientsById.get(invoice.clientId)?.title || EMPTY_CLIENT,
                business: invoice.businessInfoId
                    ? (businessInfosById.get(invoice.businessInfoId)?.businessName || businessInfosById.get(invoice.businessInfoId)?.name || businessInfosById.get(invoice.businessInfoId)?.title || EMPTY_BUSINESS)
                    : EMPTY_BUSINESS,
                invoiceDate: invoice.date,
                dueDate: invoice.dueDate || '',
                paidDate: getInvoicePaymentDateString(invoice) || '',
                status: getInvoiceStatus(invoice, reportReferenceDate),
                canceledAt: invoice.canceledAt ? toDisplayDate(invoice.canceledAt) : '',
                cancellationReason: invoice.cancellationReason || '',
                currency: invoice.currency || preferredCurrency,
                subtotal: invoice.subtotal || 0,
                tax: invoice.tax || 0,
                total: getInvoiceTotal(invoice),
                project: getInvoiceProjectTitle(invoice, projectsById) || EMPTY_PROJECT,
            })),
            expenses: filteredExpenses.slice(0, rowLimit).map((expense) => ({
                id: expense.id,
                date: expense.date,
                paidDate: expense.paidOn || '',
                title: expense.title,
                supplier: expense.supplierName || '',
                category: expense.categoryId ? (expenseCategoriesById.get(expense.categoryId)?.name || EMPTY_CATEGORY) : EMPTY_CATEGORY,
                business: expense.businessId
                    ? (businessInfosById.get(expense.businessId)?.businessName || businessInfosById.get(expense.businessId)?.name || businessInfosById.get(expense.businessId)?.title || EMPTY_BUSINESS)
                    : EMPTY_BUSINESS,
                client: expense.clientId ? (clientsById.get(expense.clientId)?.title || EMPTY_CLIENT) : EMPTY_CLIENT,
                project: expense.projectId ? (projectsById.get(expense.projectId)?.title || EMPTY_PROJECT) : EMPTY_PROJECT,
                currency: expense.currency || preferredCurrency,
                amount: expense.amount || 0,
                taxAmount: getExpenseTaxAmount(expense),
                paymentStatus: expense.paymentStatus,
                billingStatus: expense.billingStatus,
                claimStatus: getExpenseTaxClaimStatus(expense),
            })),
            hours: hoursRows.slice(0, rowLimit),
            timeEntries: filteredTimeEntries.slice(0, rowLimit).map((entry) => {
                const actualMs = Math.max(0, (entry.end || 0) - entry.start);
                const billableMs = entry.task?.billable ? getBillableDurationMs(entry) : 0;
                const billedInvoice = entry.billedInvoiceId
                    ? data.invoices.find((invoice) => invoice.id === entry.billedInvoiceId)
                    : null;

                return {
                    id: entry.id,
                    date: getTimestampDateString(entry.start) || '',
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
                    durationHours: actualMs / 3_600_000,
                    billableHours: billableMs / 3_600_000,
                    billedInvoiceNumber: billedInvoice?.invoiceNumber || '',
                    note: entry.note || '',
                };
            }),
            outstanding: outstandingInvoices.slice(0, rowLimit).map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                client: clientsById.get(invoice.clientId)?.title || EMPTY_CLIENT,
                dueDate: invoice.dueDate || '',
                status: getInvoiceStatus(invoice, reportReferenceDate),
                daysOverdue: getInvoiceDaysOverdue(invoice, reportReferenceDate),
                currency: invoice.currency || preferredCurrency,
                total: getInvoiceTotal(invoice),
            })),
            toInvoice: normalizedToInvoiceRows.slice(0, rowLimit),
            clientStatement: clientStatementSummary ? {
                clientId: selectedStatementClientId,
                clientTitle: selectedStatementClientId ? clientsById.get(selectedStatementClientId)?.title || EMPTY_CLIENT : EMPTY_CLIENT,
                openingBalanceInvoiceIds: clientStatementSummary.openingBalanceInvoices.map((invoice) => invoice.id),
                invoicesIssuedInRangeIds: clientStatementSummary.invoicesIssuedInRange.map((invoice) => invoice.id),
                paymentsRecordedInRangeIds: clientStatementSummary.paymentsRecordedInRange.map((invoice) => invoice.id),
                outstandingInvoiceIds: clientStatementSummary.outstandingInvoices.map((invoice) => invoice.id),
            } : null,
            projectWork: projectWorkSummary ? {
                projectId: selectedWorkSummaryProjectId,
                projectTitle: selectedWorkSummaryProjectId ? projectsById.get(selectedWorkSummaryProjectId)?.title || EMPTY_PROJECT : EMPTY_PROJECT,
                rows: projectWorkSummary.rows.slice(0, rowLimit),
            } : null,
            projectBreakdown: projectId === 'all'
                ? financialFilteredInvoices.flatMap((invoice) => getInvoiceProjectRevenueBreakdown(invoice).map((breakdown) => ({
                    projectId: breakdown.projectId,
                    projectTitle: breakdown.projectTitle || projectsById.get(breakdown.projectId)?.title || EMPTY_PROJECT,
                    ...getInvoiceReportAmount(invoice, preferredCurrency, breakdown.allocatedTotal || 0),
                }))).slice(0, rowLimit)
                : [],
        } : undefined,
    };
}

export async function exportReportCsvCommand(context: AgentCommandContext, input: ExportReportCsvInput) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const section = input.section;
    const report = await getReportSummaryCommand(context, {
        ...input,
        includeRows: true,
        rowLimit: input.rowLimit ?? MAX_ROW_LIMIT,
    }) as any;
    const rows = buildReportCsvRows(section, report);
    const columns = rows.length > 0
        ? Object.keys(rows[0]).map((key) => ({ key, header: key }))
        : getEmptyReportCsvColumns(section);
    const defaultFilename = buildExportFileName(`report-${section}`, report.period.startDate, report.period.endDate);
    const filename = normalizeCsvFilename(input.filename || defaultFilename);
    const { buildCsvContent, downloadCsvFile } = await import('@/utils/reportCsvUtils');

    downloadCsvFile(filename, buildCsvContent(columns as any, rows));
    const metadataKey = section === 'to-invoice' ? 'toInvoice' : section;
    const rowMetadata = report.rowMetadata?.[metadataKey];

    return {
        section,
        filename,
        rowCount: rows.length,
        totalRowCount: rowMetadata?.total ?? rows.length,
        truncated: rowMetadata?.truncated ?? false,
        downloadStarted: true,
    };
}

export async function exportReportPdfCommand(context: AgentCommandContext, input: ExportReportPdfInput) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const section = input.section;
    const report = await getReportSummaryCommand(context, {
        ...input,
        includeRows: true,
        rowLimit: input.rowLimit ?? MAX_ROW_LIMIT,
    }) as any;
    const filename = normalizePdfFilename(input.filename || buildPdfExportFileName(`report-${section}`, report.period.startDate, report.period.endDate));
    const reportPdfUtils = await import('@/utils/reportPdfUtils');
    const payload = buildReportPdfPayload(context, section, report, filename);

    if (section === 'overview' || section === 'monthly') {
        await reportPdfUtils.exportMonthlyReportPdf(payload as any);
    } else if (section === 'statement') {
        await reportPdfUtils.exportClientStatementPdf(payload as any);
    } else if (section === 'work-summary') {
        await reportPdfUtils.exportProjectWorkSummaryPdf(payload as any);
    } else if (section === 'invoices') {
        await reportPdfUtils.exportInvoicesReportPdf(payload as any);
    } else if (section === 'outstanding') {
        await reportPdfUtils.exportOutstandingReportPdf(payload as any);
    } else if (section === 'expenses') {
        await reportPdfUtils.exportExpensesReportPdf(payload as any);
    }

    return {
        section,
        filename,
        downloadStarted: true,
    };
}

export async function exportAccountantPackCommand(context: AgentCommandContext, input: ExportAccountantPackInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const report = await getReportSummaryCommand(context, {
        ...input,
        section: 'monthly',
        includeRows: true,
        rowLimit: input.rowLimit ?? MAX_EXPORT_ROW_LIMIT,
        rowLimitMax: MAX_EXPORT_ROW_LIMIT,
    }) as any;
    const filename = normalizeZipFilename(input.filename || 'accountant-pack.zip');
    const { buildCsvContent } = await import('@/utils/reportCsvUtils');
    const { downloadZipFile } = await import('@/utils/reportZipUtils');
    const { ACCOUNTANT_PACK_MANIFEST_COLUMNS, buildAccountantPackManifestRows } = await import('@/utils/reportPackUtils');
    const { buildMonthlyReportHtml } = await import('@/utils/reportPdfUtils');
    const { generatePDFBlob, getCurrentInvoiceHtmlContent } = await import('@/utils/pdfUtils');
    const csvFiles = buildAccountantPackCsvFiles(report);
    const monthlyPdfFilename = 'monthly-summary.pdf';
    const monthlyPdfHtml = buildMonthlyReportHtml(buildReportPdfPayload(context, 'monthly', report, monthlyPdfFilename) as any);
    const reportPdfEntries = [{
        filename: monthlyPdfFilename,
        content: await generatePDFBlob(monthlyPdfHtml),
    }];
    const invoicePdfFiles = input.includeInvoicePdfs === false
        ? []
        : await buildAccountantPackInvoicePdfFiles(
            context,
            report,
            getCurrentInvoiceHtmlContent,
            input.invoiceStatus === 'canceled'
        );
    const invoicePdfEntries = await Promise.all(invoicePdfFiles.map(async (file) => ({
        filename: file.filename,
        content: await generatePDFBlob(file.htmlContent),
    })));
    const manifestRows = buildAccountantPackManifestRows({
        csvFiles: csvFiles.map((file) => ({
            filename: file.filename,
            columns: file.columns as any,
            rows: file.rows,
        })),
        pdfFiles: [{
            filename: monthlyPdfFilename,
            exporter: async () => undefined,
            payload: {},
        }],
        invoicePdfFiles: invoicePdfFiles.map(({ filename: invoiceFilename, invoiceId, invoiceNumber }) => ({
            filename: invoiceFilename,
            invoiceId,
            invoiceNumber,
        })),
    });

    await downloadZipFile(filename, [
        {
            filename: 'accountant-pack-manifest.csv',
            content: buildCsvContent(ACCOUNTANT_PACK_MANIFEST_COLUMNS as any, manifestRows as any),
        },
        ...csvFiles.map((file) => ({
            filename: file.filename,
            content: buildCsvContent(file.columns as any, file.rows),
        })),
        ...reportPdfEntries,
        ...invoicePdfEntries,
    ]);

    return {
        filename,
        csvFileCount: csvFiles.length,
        reportPdfCount: reportPdfEntries.length,
        invoicePdfCount: invoicePdfEntries.length,
        truncatedSections: Object.entries(report.rowMetadata || {})
            .filter(([, metadata]: [string, any]) => metadata.truncated)
            .map(([section]) => section),
        downloadStarted: true,
    };
}

const buildReportPdfPayload = (
    context: AgentCommandContext,
    section: ExportReportPdfInput['section'],
    report: any,
    filename: string
) => {
    const generatedAtLabel = toDisplayDate(new Date(context.now?.() || Date.now()), { year: 'numeric', month: 'short', day: 'numeric' });
    const periodLabel = `${report.period.startDate} to ${report.period.endDate}`;
    const businessLabel = getBusinessLabel(context, report.filters.businessId);

    if (section === 'overview' || section === 'monthly') {
        return {
            filename,
            businessLabel,
            generatedAtLabel,
            periodLabel,
            summaryRows: buildReportCsvRows('monthly', report).map((row) => ({
                label: String(row.metric),
                value: String(row.value),
            })),
            topClientBreakdown: report.summaries.invoiceRegister.totalsByClient.slice(0, 5).map((row: any) => ({
                label: row.label,
                value: `${row.count} invoices - ${stringifyAmountMap(row.totalByCurrency)}`,
            })),
            projectBreakdown: (report.rows.projectBreakdown || []).slice(0, 5).map((row: any) => ({
                label: row.projectTitle,
                value: `${row.currency} ${row.amount}`,
            })),
            categoryBreakdown: report.summaries.tax.expenseBuckets.slice(0, 5).map((row: any) => ({
                label: row.bucketLabel,
                value: `${row.currency} ${row.grossAmount}`,
            })),
            reviewRows: Object.entries(report.summaries.tax.needsReview)
                .filter(([, count]) => typeof count === 'number' && count > 0)
                .map(([label, count]) => ({ label, value: String(count) })),
        };
    }

    if (section === 'statement') {
        const statement = report.summaries.clientStatement;
        const clientTitle = report.rows.clientStatement?.clientTitle || EMPTY_CLIENT;
        const invoiceRows = (items: any[]) => items.map((invoice) => ({
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date ? toDisplayDate(invoice.date) : '',
            dueDate: invoice.dueDate ? toDisplayDate(invoice.dueDate) : '',
            status: getInvoiceStatus(invoice),
            amount: formatInvoiceReportAmount(invoice, report.preferredCurrency),
        }));
        const paymentRows = (statement?.paymentsRecordedInRange || []).map((invoice: any) => ({
            invoiceNumber: invoice.invoiceNumber,
            paidDate: getInvoicePaymentDateString(invoice) || '',
            amount: formatInvoiceReportAmount(invoice, report.preferredCurrency),
        }));

        return {
            filename,
            businessLabel,
            clientLabel: clientTitle,
            generatedAtLabel,
            periodLabel,
            statementDateLabel: toDisplayDate(report.period.endDate),
            summaryRows: [
                { label: 'Opening balance', value: stringifyAmountMap(statement?.totalsByCurrency.openingBalance) },
                { label: 'Invoices issued', value: stringifyAmountMap(statement?.totalsByCurrency.issued) },
                { label: 'Payments recorded', value: stringifyAmountMap(statement?.totalsByCurrency.payments) },
                { label: 'Closing balance', value: stringifyAmountMap(statement?.totalsByCurrency.closingBalance) },
            ],
            openingRows: invoiceRows(statement?.openingBalanceInvoices || []),
            outstandingRows: invoiceRows(statement?.outstandingInvoices || []),
            paymentRows,
        };
    }

    if (section === 'work-summary') {
        const projectWork = report.summaries.projectWork;
        const projectTitle = report.rows.projectWork?.projectTitle || EMPTY_PROJECT;

        return {
            filename,
            clientLabel: '',
            generatedAtLabel,
            periodLabel,
            projectLabel: projectTitle,
            summaryRows: [
                { label: 'Total worked', value: formatDuration(projectWork?.totals.actualMs || 0) },
                { label: 'Billable worked', value: formatDuration(projectWork?.totals.billableMs || 0) },
                { label: 'Tasks covered', value: String(projectWork?.totals.tasksCount || 0) },
                { label: 'Entries logged', value: String(projectWork?.totals.entriesCount || 0) },
                { label: 'Noted entries', value: String(projectWork?.totals.notesCount || 0) },
            ],
            taskRows: (projectWork?.rows || []).map((row: any) => ({
                task: row.taskTitle,
                entries: String(row.entriesCount),
                totalDuration: formatDuration(row.actualMs),
                billableDuration: formatDuration(row.billableMs),
            })),
        };
    }

    if (section === 'invoices') {
        return {
            filename,
            businessLabel,
            generatedAtLabel,
            periodLabel,
            summarySections: buildInvoiceRegisterSummarySections(report),
            rows: (report.rows.invoices || []).map((row: any) => ({
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
        };
    }

    if (section === 'outstanding') {
        const outstandingRows = report.rows.outstanding || [];

        return {
            filename,
            businessLabel,
            generatedAtLabel,
            periodLabel,
            referenceDateLabel: toDisplayDate(report.period.endDate),
            summaryRows: [
                { label: 'Outstanding total', value: stringifyAmountMap(report.totalsByCurrency.outstanding) },
                { label: 'Overdue total', value: stringifyAmountMap(report.totalsByCurrency.overdue) },
                { label: 'Oldest overdue', value: `${Math.max(0, ...outstandingRows.map((row: any) => row.daysOverdue || 0))} days` },
            ],
            agingRows: report.summaries.outstanding.map((row: any) => ({
                label: `${row.bucketLabel} (${row.currency})`,
                value: `${row.count} invoices - ${formatCurrency(row.total, row.currency)}`,
            })),
            invoiceRows: outstandingRows.map((row: any) => ({
                invoiceNumber: row.invoiceNumber,
                client: row.client,
                invoiceDate: '',
                dueDate: row.dueDate ? toDisplayDate(row.dueDate) : '',
                status: row.status,
                daysOverdue: String(row.daysOverdue),
                amount: formatCurrency(row.total, row.currency),
            })),
        };
    }

    return {
        filename,
        businessLabel,
        generatedAtLabel,
        periodLabel,
        summaryRows: [
            { label: 'Ex VAT', value: stringifyAmountMap(report.summaries.expenses.netByCurrency) },
            { label: 'VAT amount', value: stringifyAmountMap(report.summaries.expenses.taxByCurrency) },
            { label: 'Inc VAT', value: stringifyAmountMap(report.summaries.expenses.grossByCurrency) },
            { label: 'Needs review', value: String(report.summaries.expenses.missingTaxMetadataCount) },
        ],
        rows: (report.rows.expenses || []).map((row: any) => ({
            date: row.date ? toDisplayDate(row.date) : '',
            paidDate: row.paidDate ? toDisplayDate(row.paidDate) : '',
            title: row.title,
            supplier: row.supplier,
            category: row.category,
            business: row.business,
            client: row.client,
            project: row.project,
            paymentStatus: row.paymentStatus,
            billingStatus: row.billingStatus,
            netAmount: formatCurrency(Math.max(0, (row.amount || 0) - (row.taxAmount || 0)), row.currency),
            taxAmount: formatCurrency(row.taxAmount || 0, row.currency),
            grossAmount: formatCurrency(row.amount || 0, row.currency),
        })),
    };
};

const getBusinessLabel = (context: AgentCommandContext, businessId: string) => {
    if (!businessId || businessId === 'all') {
        return 'All businesses';
    }

    const businessInfos = collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent report pdf business infos');
    const business = businessInfos.find((item) => item.id === businessId);

    return business?.businessName || business?.name || business?.title || EMPTY_BUSINESS;
};

const formatInvoiceReportAmount = (invoice: Invoice, preferredCurrency: string) => {
    const invoiceAmount = getInvoiceReportAmount(invoice, preferredCurrency);
    return formatCurrency(invoiceAmount.amount, invoiceAmount.currency);
};

const buildInvoiceRegisterSummarySections = (report: any) => {
    const summary = report.summaries.invoiceRegister;
    const amountLabel = (row: any) => `${row.count} invoices - ${stringifyAmountMap(row.totalByCurrency)}`;

    return [
        {
            title: 'By status',
            rows: summary.totalsByStatus.map((row: any) => ({ label: row.label, value: amountLabel(row) })),
        },
        {
            title: 'By client',
            rows: summary.totalsByClient.slice(0, 5).map((row: any) => ({ label: row.label, value: amountLabel(row) })),
        },
        {
            title: 'By business',
            rows: summary.totalsByBusiness.slice(0, 5).map((row: any) => ({ label: row.label, value: amountLabel(row) })),
        },
        {
            title: 'By currency',
            rows: summary.totalsByCurrency.map((row: any) => ({
                label: row.currency,
                value: `${row.count} invoices - ${formatCurrency(row.total, row.currency)}`,
            })),
        },
    ].filter((section) => section.rows.length > 0);
};

const csvColumnsFromRows = (section: ReportSection, rows: Array<Record<string, unknown>>) => {
    if (rows.length > 0) {
        return Object.keys(rows[0]).map((key) => ({ key, header: key }));
    }

    return getEmptyReportCsvColumns(section);
};

const buildAccountantPackCsvFiles = (report: any) => {
    const monthlyRows = buildReportCsvRows('monthly', report);
    const invoiceRows = buildReportCsvRows('invoices', report);
    const expenseRows = buildReportCsvRows('expenses', report);
    const timeEntryRows = report.rows.timeEntries || [];
    const taxRows = buildReportCsvRows('tax', report);
    const reviewRows = buildReviewChecklistRows(report);

    return [
        {
            filename: 'monthly-summary.csv',
            columns: csvColumnsFromRows('monthly', monthlyRows),
            rows: monthlyRows,
        },
        {
            filename: 'invoices.csv',
            columns: csvColumnsFromRows('invoices', invoiceRows),
            rows: invoiceRows,
        },
        {
            filename: 'expenses.csv',
            columns: csvColumnsFromRows('expenses', expenseRows),
            rows: expenseRows,
        },
        {
            filename: 'time-entries.csv',
            columns: timeEntryRows.length > 0
                ? Object.keys(timeEntryRows[0]).map((key) => ({ key, header: key }))
                : [
                    { key: 'date', header: 'date' },
                    { key: 'startTime', header: 'startTime' },
                    { key: 'endTime', header: 'endTime' },
                    { key: 'task', header: 'task' },
                    { key: 'project', header: 'project' },
                    { key: 'client', header: 'client' },
                    { key: 'billable', header: 'billable' },
                    { key: 'durationHours', header: 'durationHours' },
                    { key: 'billableHours', header: 'billableHours' },
                    { key: 'billedInvoiceNumber', header: 'billedInvoiceNumber' },
                    { key: 'note', header: 'note' },
                ],
            rows: timeEntryRows,
        },
        {
            filename: 'tax-summary.csv',
            columns: csvColumnsFromRows('tax', taxRows),
            rows: taxRows,
        },
        {
            filename: 'review-checklist.csv',
            columns: reviewRows.length > 0
                ? Object.keys(reviewRows[0]).map((key) => ({ key, header: key }))
                : [
                    { key: 'issue', header: 'issue' },
                    { key: 'scope', header: 'scope' },
                    { key: 'count', header: 'count' },
                ],
            rows: reviewRows,
        },
    ];
};

const buildReviewChecklistRows = (report: any) => {
    const outstandingNeedsReviewCount = (report.summaries.outstanding || [])
        .filter((row: any) => row.bucketLabel === 'Needs review')
        .reduce((sum: number, row: any) => sum + (row.count || 0), 0);

    return [
        {
            issue: 'Invoices without business profile',
            scope: 'Invoices',
            count: report.summaries.tax.needsReview.missingInvoiceBusinessInfo,
        },
        {
            issue: 'Invoices without client country',
            scope: 'Invoices',
            count: report.summaries.tax.needsReview.missingClientCountry,
        },
        {
            issue: 'Expenses without tax metadata',
            scope: 'Expenses',
            count: report.summaries.tax.needsReview.missingExpenseTaxMetadata,
        },
        {
            issue: 'Expenses without category',
            scope: 'Expenses',
            count: (report.rows.expenses || []).filter((expense: any) => expense.category === EMPTY_CATEGORY).length,
        },
        {
            issue: 'Sales bucketed as needs review',
            scope: 'Tax summary',
            count: report.summaries.tax.needsReview.needsReviewSalesBuckets,
        },
        {
            issue: 'Expense buckets marked needs review',
            scope: 'Tax summary',
            count: report.summaries.tax.needsReview.needsReviewExpenseBuckets,
        },
        {
            issue: 'Outstanding invoices missing due date',
            scope: 'Outstanding',
            count: outstandingNeedsReviewCount,
        },
    ].filter((row) => row.count > 0);
};

const buildAccountantPackInvoicePdfFiles = async (
    context: AgentCommandContext,
    report: any,
    getCurrentInvoiceHtmlContent: (invoice: any, clients: any[], businessBrandAssets: any[]) => string,
    includeCanceled: boolean
) => {
    const invoiceIds = new Set((report.rows.invoices || []).map((invoice: any) => invoice.id).filter(Boolean));
    const allInvoices = typeof context.store.getAllInvoices === 'function'
        ? await context.store.getAllInvoices()
        : collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent accountant pack invoices');
    const invoices = allInvoices
        .filter((invoice) => invoiceIds.has(invoice.id) && invoice.invoiceNumber)
        .filter((invoice) => includeCanceled || !isInvoiceCanceled(invoice));
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent accountant pack clients');
    const businessBrandAssets = collectValidatedEntities<BusinessBrandAsset>('businessBrandAssets', context.store.businessBrandAssets as any, 'agent accountant pack brand assets');
    const usedFilenames = new Set<string>();

    return invoices.map((invoice) => {
        const safeInvoiceNumber = String(invoice.invoiceNumber)
            .normalize('NFKC')
            .split('')
            .map((character) => character.charCodeAt(0) < 32 ? '-' : character)
            .join('')
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '') || 'invoice';
        const baseFilename = `invoice-${safeInvoiceNumber}`;
        let filename = `${baseFilename}.pdf`;
        let duplicateIndex = 2;

        while (usedFilenames.has(filename.toLowerCase())) {
            filename = `${baseFilename}-${duplicateIndex}.pdf`;
            duplicateIndex += 1;
        }

        usedFilenames.add(filename.toLowerCase());

        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            filename,
            htmlContent: getCurrentInvoiceHtmlContent(invoice as any, clients as any, businessBrandAssets as any),
        };
    });
};

const getEmptyReportCsvColumns = (section: ReportSection) => {
    const fallbackColumns: Record<ReportSection, string[]> = {
        overview: ['metric', 'value'],
        monthly: ['metric', 'value'],
        statement: ['section', 'invoiceNumber', 'date', 'dueDate', 'paidDate', 'status', 'currency', 'total'],
        'work-summary': ['task', 'entries', 'totalDurationMs', 'billableDurationMs', 'notes', 'firstWorkedAt', 'lastWorkedAt'],
        tax: ['section', 'label', 'currency', 'grossAmount', 'netAmount', 'taxAmount', 'count'],
        invoices: ['id', 'invoiceNumber', 'client', 'business', 'invoiceDate', 'dueDate', 'paidDate', 'status', 'canceledAt', 'cancellationReason', 'currency', 'subtotal', 'tax', 'total', 'project'],
        outstanding: ['id', 'invoiceNumber', 'client', 'dueDate', 'status', 'daysOverdue', 'currency', 'total'],
        expenses: ['id', 'date', 'paidDate', 'title', 'supplier', 'category', 'business', 'client', 'project', 'currency', 'amount', 'taxAmount', 'paymentStatus', 'billingStatus', 'claimStatus'],
        hours: ['project', 'client', 'entries', 'totalHours', 'billableHours', 'unbilledBillableHours'],
        'to-invoice': ['client', 'project', 'uninvoicedHours', 'expenseCount', 'expenseAmount', 'estimatedAmount', 'totalAmount'],
    };

    return fallbackColumns[section].map((key) => ({ key, header: key }));
};

const buildReportCsvRows = (section: ReportSection, report: any): Array<Record<string, unknown>> => {
    if (section === 'overview' || section === 'monthly') {
        return [
            { metric: 'Period', value: `${report.period.startDate} to ${report.period.endDate}` },
            { metric: 'Revenue issued', value: stringifyAmountMap(report.totalsByCurrency.revenueIssued) },
            { metric: 'Payments received', value: stringifyAmountMap(report.totalsByCurrency.revenuePaid) },
            { metric: 'Expenses', value: stringifyAmountMap(report.totalsByCurrency.expenses) },
            { metric: 'Output tax', value: stringifyAmountMap(report.totalsByCurrency.outputTax) },
            { metric: 'Input tax', value: stringifyAmountMap(report.totalsByCurrency.inputTax) },
            { metric: 'Estimated tax position', value: stringifyAmountMap(report.totalsByCurrency.estimatedVatPosition) },
            { metric: 'Estimated profit', value: stringifyAmountMap(report.totalsByCurrency.estimatedProfit) },
            { metric: 'Hours worked', value: report.time.totalHoursMs / 3_600_000 },
            { metric: 'Billable utilization', value: report.time.billableUtilization },
            { metric: 'Outstanding invoices', value: report.counts.outstandingInvoices },
            { metric: 'Overdue invoices', value: report.counts.overdueInvoices },
        ];
    }

    if (section === 'tax') {
        const tax = report.summaries.tax;
        const salesRows = tax.salesBuckets.map((row: any) => ({
            section: 'Sales',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount,
            netAmount: row.netAmount,
            taxAmount: row.taxAmount,
            count: row.count,
        }));
        const expenseRows = tax.expenseBuckets.map((row: any) => ({
            section: 'Expenses',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount,
            netAmount: row.netAmount,
            taxAmount: row.taxAmount,
            count: row.count,
        }));
        const claimRows = tax.claimStatusBuckets.map((row: any) => ({
            section: 'Claim status',
            label: row.bucketLabel,
            currency: row.currency,
            grossAmount: row.grossAmount,
            netAmount: row.netAmount,
            taxAmount: row.taxAmount,
            count: row.count,
        }));
        const geographyRows = tax.geographyBuckets.map((row: any) => ({
            section: 'Geography',
            label: row.geography,
            currency: row.currency,
            grossAmount: row.total,
            netAmount: '',
            taxAmount: '',
            count: row.count,
        }));
        const reviewRows = Object.entries(tax.needsReview)
            .filter(([, count]) => typeof count === 'number' && count > 0)
            .map(([label, count]) => ({
                section: 'Needs review',
                label,
                currency: '',
                grossAmount: '',
                netAmount: '',
                taxAmount: '',
                count,
            }));

        return [...salesRows, ...expenseRows, ...claimRows, ...geographyRows, ...reviewRows];
    }

    if (section === 'hours') {
        return (report.rows.hours || []).map((row: any) => ({
            project: row.projectTitle,
            client: row.clientTitle,
            entries: row.entriesCount,
            totalHours: row.totalMs / 3_600_000,
            billableHours: row.billableMs / 3_600_000,
            unbilledBillableHours: row.unbilledBillableMs / 3_600_000,
        }));
    }

    if (section === 'to-invoice') {
        return (report.rows.toInvoice || []).map((row: any) => ({
            client: row.clientTitle,
            project: row.projectTitle,
            uninvoicedHours: row.uninvoicedHoursMs / 3_600_000,
            expenseCount: row.expenseCount,
            expenseAmount: stringifyAmountMap(row.expenseAmountsByCurrency),
            estimatedAmount: stringifyAmountMap(row.estimatedAmountsByCurrency),
            totalAmount: stringifyAmountMap(row.totalAmountsByCurrency),
        }));
    }

    if (section === 'statement') {
        const statement = report.summaries.clientStatement;

        if (!statement) {
            return [];
        }

        const invoiceRows = (items: any[], rowSection: string, paidOverride = false) => items.map((invoice) => {
            const invoiceAmount = getInvoiceReportAmount(invoice, report.preferredCurrency);

            return {
                section: rowSection,
                invoiceNumber: invoice.invoiceNumber,
                date: invoice.date,
                dueDate: invoice.dueDate || '',
                paidDate: paidOverride ? getInvoicePaymentDateString(invoice) || '' : '',
                status: paidOverride ? 'paid' : getInvoiceStatus(invoice),
                currency: invoiceAmount.currency,
                total: invoiceAmount.amount,
            };
        });

        return [
            ...invoiceRows(statement.openingBalanceInvoices, 'Opening balance'),
            ...invoiceRows(statement.invoicesIssuedInRange, 'Issued in period'),
            ...invoiceRows(statement.paymentsRecordedInRange, 'Payments in period', true),
            ...invoiceRows(statement.outstandingInvoices, 'Outstanding at statement date'),
        ];
    }

    if (section === 'work-summary') {
        return (report.summaries.projectWork?.rows || []).map((row: any) => ({
            task: row.taskTitle,
            entries: row.entriesCount,
            totalDurationMs: row.actualMs,
            billableDurationMs: row.billableMs,
            notes: row.notesCount,
            firstWorkedAt: row.firstEntryAt || '',
            lastWorkedAt: row.lastEntryAt || '',
        }));
    }

    if (section === 'invoices') {
        return report.rows.invoices || [];
    }

    if (section === 'outstanding') {
        return report.rows.outstanding || [];
    }

    if (section === 'expenses') {
        return report.rows.expenses || [];
    }

    return [];
};
