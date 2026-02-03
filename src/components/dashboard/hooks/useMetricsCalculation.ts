import { useCallback, useMemo } from 'react';
import { getLastMonthRange, getThisMonthRange, getThisYearRange, millisecondsToHours, parseStoredDate } from '../../../utils/dateUtils';
import { formatCurrency, getProjectCurrency } from '../../../utils/currencyUtils';

type TimeEntry = {
    taskId: string;
    start: number;
    end: number;
    deletedAt?: number;
};

type TaskItem = {
    id: string;
    projectId: string;
    billable?: boolean;
    lastBilledAt?: number;
    deletedAt?: number;
};

type ProjectItem = {
    id: string;
    hourlyRate?: number;
    preferredClientId?: string | null;
};

type ClientItem = {
    id: string;
};

type InvoiceItem = {
    date?: string;
    createdAt?: number;
    totalAmount?: number;
    currency?: string;
    paymentProcessed?: boolean;
    dueDate?: string;
    clientId?: string;
};

type CurrencyConversionResult = {
    amounts: Record<string, number>;
    hadConversionError: boolean;
};

type UseMetricsParams = {
    timeEntries: TimeEntry[];
    tasks: TaskItem[];
    projects: ProjectItem[];
    invoices: InvoiceItem[];
    clients: ClientItem[];
    preferredCurrency: string;
    convertToCurrency: (amounts: Record<string, number>) => CurrencyConversionResult;
};

/**
 * useMetricsCalculation hook - derives dashboard metrics and summaries.
 * @param {Object} params
 * @returns {Object}
 */
const useMetricsCalculation = ({
    timeEntries,
    tasks,
    projects,
    invoices,
    clients,
    preferredCurrency,
    convertToCurrency
}: UseMetricsParams) => {
    /**
     * Calculate metrics for a given date range
     * When preferred currency is updated, this will be recalculated
     * Now includes both billable time earnings AND invoice amounts
     */
    const calculateMetrics = useCallback((startTime: number, endTime: number) => {
        const entriesInRange = timeEntries.filter(entry =>
            entry.start >= startTime && entry.end <= endTime && !entry.deletedAt
        );

        const totalTime = entriesInRange.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        // Calculate unbilled time earnings using task-by-task rounding for consistency
        const billableEarningsByCurrency: Record<string, number> = {};

        // Group entries by task first, then calculate earnings with proper rounding
        const taskTimeMap: Record<string, { totalTime: number; project: ProjectItem; currency: string }> = {};
        entriesInRange.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task || task.deletedAt || task.billable !== true) return; // Only include explicitly billable tasks, skip deleted tasks

            // Only include unbilled entries (after last billing date)
            const billingCutoff = task.lastBilledAt || 0;
            if (entry.start <= billingCutoff) return;

            const project = projects.find(p => p.id === task.projectId);
            if (!project || !project.hourlyRate) return;

            const taskKey = `${task.id}-${project.id}`;
            if (!taskTimeMap[taskKey]) {
                taskTimeMap[taskKey] = {
                    totalTime: 0,
                    project: project,
                    currency: getProjectCurrency(project, clients)
                };
            }
            taskTimeMap[taskKey].totalTime += (entry.end - entry.start);
        });

        // Calculate earnings with task-by-task rounding
        Object.values(taskTimeMap).forEach(({ totalTime, project, currency }) => {
            const taskHours = millisecondsToHours(totalTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            const amount = roundedTaskHours * (project.hourlyRate || 0);

            if (!billableEarningsByCurrency[currency]) {
                billableEarningsByCurrency[currency] = 0;
            }
            billableEarningsByCurrency[currency] += amount;
        });

        // Calculate invoice amounts in the given date range
        const invoicesInRange = invoices.filter(invoice => {
            // Use invoice date for accurate reporting
            const parsedDate = parseStoredDate(invoice.date);
            const invoiceDate = parsedDate ? parsedDate.getTime() : null;
            if (!invoiceDate) return false;
            return invoiceDate >= startTime && invoiceDate <= endTime;
        });

        // Group paid and outstanding invoices by currency
        const paidInvoicesByCurrency: Record<string, number> = {};
        const outstandingInvoicesByCurrency: Record<string, number> = {};
        invoicesInRange.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            const currency = invoice.currency || preferredCurrency;

            if (invoice.paymentProcessed) {
                if (!paidInvoicesByCurrency[currency]) {
                    paidInvoicesByCurrency[currency] = 0;
                }
                paidInvoicesByCurrency[currency] += amount;
            } else {
                if (!outstandingInvoicesByCurrency[currency]) {
                    outstandingInvoicesByCurrency[currency] = 0;
                }
                outstandingInvoicesByCurrency[currency] += amount;
            }
        });

        // Convert currencies using the preferred currency
        const billableResult = convertToCurrency(billableEarningsByCurrency);
        const paidResult = convertToCurrency(paidInvoicesByCurrency);
        const outstandingResult = convertToCurrency(outstandingInvoicesByCurrency);

        return {
            time: totalTime,
            billableEarnings: billableResult.amounts,
            paidInvoices: paidResult.amounts,
            outstandingInvoices: outstandingResult.amounts,
            hadConversionError: billableResult.hadConversionError || paidResult.hadConversionError || outstandingResult.hadConversionError
        };
    }, [timeEntries, tasks, projects, invoices, convertToCurrency, preferredCurrency, clients]);

    // Calculate date ranges statically
    const thisMonthRange = useMemo(() => getThisMonthRange(), []);
    const lastMonthRange = useMemo(() => getLastMonthRange(), []);
    const last90DaysRange = useMemo(() => {
        const now = new Date();
        const end = now.getTime();
        const start = new Date(now.setDate(now.getDate() - 90)).setHours(0, 0, 0, 0);
        return { start, end };
    }, []);

    // Calculate metrics with proper memoization
    const thisMonthMetrics = useMemo(() => {
        return calculateMetrics(thisMonthRange.start, thisMonthRange.end);
    }, [thisMonthRange, calculateMetrics]);

    const lastMonthMetrics = useMemo(() => {
        return calculateMetrics(lastMonthRange.start, lastMonthRange.end);
    }, [lastMonthRange, calculateMetrics]);

    const last90DaysMetrics = useMemo(() => {
        return calculateMetrics(last90DaysRange.start, last90DaysRange.end);
    }, [last90DaysRange, calculateMetrics]);

    /**
     * Calculate outstanding invoices metrics
     */
    const invoiceMetrics = useMemo(() => {
        const outstanding = invoices.filter(invoice => !invoice.paymentProcessed);
        const pastDue = outstanding.filter(invoice => {
            if (!invoice.dueDate) return false;
            // parseStoredDate handles ISO date strings and timestamps
            const dueDate = parseStoredDate(invoice.dueDate);
            if (!dueDate) return false;
            return dueDate < new Date();
        });

        // Group outstanding invoices by currency first
        const outstandingByCurrency: Record<string, number> = {};
        outstanding.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            // Invoices store their currency directly - use it, or fall back to preferred currency
            const currency = invoice.currency || preferredCurrency;

            if (!outstandingByCurrency[currency]) {
                outstandingByCurrency[currency] = 0;
            }
            outstandingByCurrency[currency] += amount;
        });

        // Group past due invoices by currency first
        const pastDueByCurrency: Record<string, number> = {};
        pastDue.forEach(invoice => {
            const amount = invoice.totalAmount || 0;
            // Invoices store their currency directly - use it, or fall back to preferred currency
            const currency = invoice.currency || preferredCurrency;

            if (!pastDueByCurrency[currency]) {
                pastDueByCurrency[currency] = 0;
            }
            pastDueByCurrency[currency] += amount;
        });

        // Convert using the same logic as other metrics
        const convertedOutstandingResult = convertToCurrency(outstandingByCurrency);
        const convertedPastDueResult = convertToCurrency(pastDueByCurrency);

        // Sum the converted amounts
        const outstandingTotal = Object.values(convertedOutstandingResult.amounts).reduce((sum, amount) => sum + amount, 0);
        const pastDueTotal = Object.values(convertedPastDueResult.amounts).reduce((sum, amount) => sum + amount, 0);

        return {
            outstanding: outstanding.length,
            outstandingTotal,
            pastDue: pastDue.length,
            pastDueTotal,
            hadConversionError: convertedOutstandingResult.hadConversionError || convertedPastDueResult.hadConversionError
        };
    }, [invoices, convertToCurrency, preferredCurrency]);

    /**
     * Calculate current month's unbilled total that matches the monthly metrics calculation
     * This should match the "unbilled" amount shown in "This Month" metrics
     */
    const thisMonthUnbilledTotal = useMemo(() => {
        const billableTotal = Object.values(thisMonthMetrics.billableEarnings).reduce((sum, amount) => sum + amount, 0);
        return billableTotal;
    }, [thisMonthMetrics.billableEarnings]);

    /**
     * Format this month's unbilled total with multi-currency fallback
     */
    const thisMonthUnbilledDisplay = useMemo(() => {
        const entries = Object.entries(thisMonthMetrics.billableEarnings)
            .filter(([, amount]) => amount > 0);

        if (entries.length === 0) {
            return formatCurrency(0, preferredCurrency);
        }

        const shouldShowOriginalCurrency = thisMonthMetrics.hadConversionError && entries.some(([currency]) => currency !== preferredCurrency);

        if (shouldShowOriginalCurrency) {
            return entries
                .map(([currency, amount]) => formatCurrency(amount, currency))
                .join(' + ');
        }

        const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
        return formatCurrency(total, preferredCurrency);
    }, [thisMonthMetrics.billableEarnings, thisMonthMetrics.hadConversionError, preferredCurrency]);

    /**
     * Calculate billable hours for the current month metrics
     */
    const thisMonthBillableHours = useMemo(() => {
        // Re-calculate the hours from the time entries for this month
        const entriesInRange = timeEntries.filter(entry =>
            entry.start >= thisMonthRange.start && entry.end <= thisMonthRange.end
        );

        // Group by task and calculate billable hours using the same rounding logic
        const taskTimeMap: Record<string, { totalTime: number }> = {};
        entriesInRange.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task || task.billable !== true) return; // Only include explicitly billable tasks

            const project = projects.find(p => p.id === task.projectId);
            if (!project || !project.hourlyRate) return;

            const taskKey = `${task.id}-${project.id}`;
            if (!taskTimeMap[taskKey]) {
                taskTimeMap[taskKey] = { totalTime: 0 };
            }
            taskTimeMap[taskKey].totalTime += (entry.end - entry.start);
        });

        // Calculate total billable hours with task-by-task rounding
        return Object.values(taskTimeMap).reduce((total, { totalTime }) => {
            const taskHours = millisecondsToHours(totalTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);
    }, [timeEntries, tasks, projects, thisMonthRange]);

    return {
        thisMonthMetrics,
        lastMonthMetrics,
        last90DaysMetrics,
        invoiceMetrics,
        thisMonthBillableHours,
        thisMonthUnbilledTotal,
        thisMonthUnbilledDisplay
    };
};

export default useMetricsCalculation;
