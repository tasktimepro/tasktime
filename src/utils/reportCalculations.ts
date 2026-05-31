import { endOfDay, startOfDay } from 'date-fns';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { parseStoredDate } from './dateUtils';
import { getInvoicePaidAtTimestamp, getInvoiceStatus, getInvoiceTotal, isInvoicePaid } from './invoiceUtils';
import { getBillableDurationMs } from './timeEntryDurationUtils';

const EU_COUNTRY_CODES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE',
]);

const normalizeCountryCode = (value: unknown) => {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
};

export const getExpenseTaxAmount = (expense: any) => {
    if (expense?.isTaxExempt) {
        return 0;
    }

    if (typeof expense?.amountExcludingTax === 'number' && Number.isFinite(expense.amountExcludingTax)) {
        return Math.max(0, (expense.amount || 0) - expense.amountExcludingTax);
    }

    if (typeof expense?.taxRate === 'number' && Number.isFinite(expense.taxRate) && expense.taxRate > 0) {
        return (expense.amount || 0) - ((expense.amount || 0) / (1 + (expense.taxRate / 100)));
    }

    return 0;
};

export const getExpenseNetAmount = (expense: any) => {
    if (typeof expense?.amountExcludingTax === 'number' && Number.isFinite(expense.amountExcludingTax)) {
        return expense.amountExcludingTax;
    }

    const taxAmount = getExpenseTaxAmount(expense);
    return Math.max(0, (expense?.amount || 0) - taxAmount);
};

export const getInvoiceNetAmount = (invoice: any) => {
    if (typeof invoice?.subtotal === 'number' && Number.isFinite(invoice.subtotal)) {
        return invoice.subtotal;
    }

    const total = getInvoiceTotal(invoice);
    const tax = typeof invoice?.tax === 'number' && Number.isFinite(invoice.tax) ? invoice.tax : 0;
    return Math.max(0, total - tax);
};

export const getTaxBucketLabel = ({
    taxLabel,
    taxRate,
    isTaxExempt,
}: {
    taxLabel?: string | null;
    taxRate?: number | null;
    isTaxExempt?: boolean;
}) => {
    const trimmedLabel = typeof taxLabel === 'string' ? taxLabel.trim() : '';

    if (trimmedLabel) {
        return trimmedLabel;
    }

    if (isTaxExempt) {
        return 'Exempt';
    }

    if (typeof taxRate === 'number' && Number.isFinite(taxRate)) {
        return `${taxRate}%`;
    }

    return 'Needs review';
};

export const getExpenseTaxClaimStatus = (expense: any) => {
    if (expense?.taxClaimStatus === 'excluded') {
        return 'excluded';
    }

    if (expense?.taxClaimStatus === 'claimed' || expense?.taxClaimPeriodId) {
        return 'claimed';
    }

    return 'unclaimed';
};

export const getExpenseTaxClaimStatusLabel = (status: 'unclaimed' | 'claimed' | 'excluded') => {
    if (status === 'claimed') {
        return 'Claimed';
    }

    if (status === 'excluded') {
        return 'Excluded';
    }

    return 'Unclaimed';
};

export const getClientGeographyLabel = ({
    businessCountry,
    clientCountry,
}: {
    businessCountry?: string | null;
    clientCountry?: string | null;
}) => {
    const normalizedBusinessCountry = normalizeCountryCode(businessCountry);
    const normalizedClientCountry = normalizeCountryCode(clientCountry);

    if (!normalizedBusinessCountry || !normalizedClientCountry) {
        return 'Needs review';
    }

    if (normalizedBusinessCountry === normalizedClientCountry) {
        return 'Domestic';
    }

    if (EU_COUNTRY_CODES.has(normalizedBusinessCountry) && EU_COUNTRY_CODES.has(normalizedClientCountry)) {
        return 'EU cross-border';
    }

    return 'Non-EU';
};

type TaxSummaryParams = {
    clientsById: Map<string, any>;
    businessInfosById: Map<string, any>;
    expenses: any[];
    invoices: any[];
};

export const buildExpenseTotalsSummary = (expenses: any[]) => {
    const grossByCurrency: Record<string, number> = {};
    const netByCurrency: Record<string, number> = {};
    const taxByCurrency: Record<string, number> = {};

    let missingTaxMetadataCount = 0;

    expenses.forEach((expense) => {
        const currency = expense?.currency || 'EUR';
        const grossAmount = typeof expense?.amount === 'number' && Number.isFinite(expense.amount) ? expense.amount : 0;
        const netAmount = getExpenseNetAmount(expense);
        const taxAmount = getExpenseTaxAmount(expense);

        grossByCurrency[currency] = (grossByCurrency[currency] || 0) + grossAmount;
        netByCurrency[currency] = (netByCurrency[currency] || 0) + netAmount;
        taxByCurrency[currency] = (taxByCurrency[currency] || 0) + taxAmount;

        if (!expense?.isTaxExempt && typeof expense?.taxRate !== 'number' && !expense?.taxLabel && taxAmount === 0) {
            missingTaxMetadataCount += 1;
        }
    });

    return {
        grossByCurrency,
        netByCurrency,
        taxByCurrency,
        count: expenses.length,
        missingTaxMetadataCount,
    };
};

const buildInvoiceRegisterGroupRows = (
    invoices: any[],
    getLabel: (invoice: any) => string
) => {
    const grouped = new Map();

    invoices.forEach((invoice) => {
        const label = getLabel(invoice);
        const current = grouped.get(label) || {
            label,
            count: 0,
            totalByCurrency: {},
        };

        const currency = invoice?.currency || 'EUR';
        current.count += 1;
        current.totalByCurrency[currency] = (current.totalByCurrency[currency] || 0) + getInvoiceTotal(invoice);

        grouped.set(label, current);
    });

    return Array.from(grouped.values()).sort((rowA, rowB) => {
        if (rowA.count !== rowB.count) {
            return rowB.count - rowA.count;
        }

        return rowA.label.localeCompare(rowB.label);
    });
};

export const buildInvoiceRegisterSummary = ({
    businessInfosById,
    clientsById,
    invoices,
}: InvoiceRegisterSummaryParams) => {
    const totalsByStatus = buildInvoiceRegisterGroupRows(
        invoices,
        (invoice) => getInvoiceStatus(invoice)
    ).sort((rowA, rowB) => {
        const orderA = STATUS_ORDER.get(rowA.label) ?? Number.MAX_SAFE_INTEGER;
        const orderB = STATUS_ORDER.get(rowB.label) ?? Number.MAX_SAFE_INTEGER;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return rowA.label.localeCompare(rowB.label);
    });

    const totalsByClient = buildInvoiceRegisterGroupRows(
        invoices,
        (invoice) => clientsById.get(invoice?.clientId)?.title || 'No client'
    );

    const totalsByBusiness = buildInvoiceRegisterGroupRows(
        invoices,
        (invoice) => {
            const business = invoice?.businessInfoId ? businessInfosById.get(invoice.businessInfoId) : null;
            return business?.businessName || business?.name || business?.title || 'Unassigned';
        }
    );

    const currencyMap = new Map();

    invoices.forEach((invoice) => {
        const currency = invoice?.currency || 'EUR';
        const current = currencyMap.get(currency) || {
            currency,
            count: 0,
            subtotal: 0,
            tax: 0,
            total: 0,
        };

        current.count += 1;
        current.subtotal += typeof invoice?.subtotal === 'number' && Number.isFinite(invoice.subtotal) ? invoice.subtotal : 0;
        current.tax += typeof invoice?.tax === 'number' && Number.isFinite(invoice.tax) ? invoice.tax : 0;
        current.total += getInvoiceTotal(invoice);
        currencyMap.set(currency, current);
    });

    const totalsByCurrency = Array.from(currencyMap.values()).sort((rowA, rowB) => rowA.currency.localeCompare(rowB.currency));

    return {
        totalsByBusiness,
        totalsByClient,
        totalsByCurrency,
        totalsByStatus,
    };
};

const sumRecordsByCurrency = (items: any[], getCurrency: (item: any) => string, getAmount: (item: any) => number) => {
    return items.reduce((totals, item) => {
        const currency = getCurrency(item) || 'EUR';
        const amount = getAmount(item);

        if (!Number.isFinite(amount)) {
            return totals;
        }

        totals[currency] = (totals[currency] || 0) + amount;
        return totals;
    }, {} as Record<string, number>);
};

const isInvoicePaidOnOrBefore = (invoice: any, timestamp: number) => {
    const paidAt = getInvoicePaidAtTimestamp(invoice);
    if (typeof paidAt === 'number' && Number.isFinite(paidAt)) {
        return paidAt <= timestamp;
    }

    return invoice?.status === 'paid' || invoice?.paymentProcessed === true;
};

const STATUS_ORDER = new Map([
    ['draft', 0],
    ['sent', 1],
    ['paid', 2],
    ['overdue', 3],
]);

type InvoiceRegisterSummaryParams = {
    businessInfosById: Map<string, any>;
    clientsById: Map<string, any>;
    invoices: any[];
};

export const OUTSTANDING_AGING_BUCKETS = [
    'Needs review',
    'Not due',
    '1-30 days',
    '31-60 days',
    '61-90 days',
    '90+ days',
] as const;

const OUTSTANDING_BUCKET_ORDER = OUTSTANDING_AGING_BUCKETS.reduce((map, label, index) => {
    map.set(label, index);
    return map;
}, new Map<string, number>());

const sumBucketAmountsByCurrency = (rows: any[], amountKey: 'grossAmount' | 'netAmount' | 'taxAmount' | 'total') => {
    return rows.reduce((totals, row) => {
        const currency = row?.currency || 'EUR';
        const amount = row?.[amountKey];

        if (!Number.isFinite(amount)) {
            return totals;
        }

        totals[currency] = (totals[currency] || 0) + amount;
        return totals;
    }, {} as Record<string, number>);
};

const subtractCurrencyTotals = (left: Record<string, number>, right: Record<string, number>) => {
    const currencies = new Set([
        ...Object.keys(left),
        ...Object.keys(right),
    ]);

    return Array.from(currencies).reduce((totals, currency) => {
        totals[currency] = (left[currency] || 0) - (right[currency] || 0);
        return totals;
    }, {} as Record<string, number>);
};

const summarizeBuckets = (
    items: any[],
    getBucketMeta: (item: any) => {
        bucketLabel: string;
        currency: string;
        grossAmount: number;
        netAmount: number;
        taxAmount: number;
    }
) => {
    const grouped = new Map();

    items.forEach((item) => {
        const meta = getBucketMeta(item);
        const key = `${meta.bucketLabel}__${meta.currency}`;
        const current = grouped.get(key) || {
            bucketLabel: meta.bucketLabel,
            currency: meta.currency,
            grossAmount: 0,
            netAmount: 0,
            taxAmount: 0,
            count: 0,
        };

        current.grossAmount += meta.grossAmount;
        current.netAmount += meta.netAmount;
        current.taxAmount += meta.taxAmount;
        current.count += 1;
        grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((rowA, rowB) => {
        if (rowA.bucketLabel !== rowB.bucketLabel) {
            return rowA.bucketLabel.localeCompare(rowB.bucketLabel);
        }

        return rowA.currency.localeCompare(rowB.currency);
    });
};

export const buildVatReportSummary = ({
    clientsById,
    businessInfosById,
    expenses,
    invoices,
}: TaxSummaryParams) => {
    const includedExpenses = expenses.filter((expense) => getExpenseTaxClaimStatus(expense) !== 'excluded');
    const salesBuckets = summarizeBuckets(invoices, (invoice) => ({
        bucketLabel: getTaxBucketLabel({
            taxLabel: invoice?.taxLabel,
            taxRate: invoice?.taxRate,
            isTaxExempt: false,
        }),
        currency: invoice?.currency || 'EUR',
        grossAmount: getInvoiceTotal(invoice),
        netAmount: getInvoiceNetAmount(invoice),
        taxAmount: typeof invoice?.tax === 'number' && Number.isFinite(invoice.tax) ? invoice.tax : 0,
    }));

    const expenseBuckets = summarizeBuckets(expenses, (expense) => ({
        bucketLabel: getTaxBucketLabel({
            taxLabel: expense?.taxLabel,
            taxRate: expense?.taxRate,
            isTaxExempt: expense?.isTaxExempt,
        }),
        currency: expense?.currency || 'EUR',
        grossAmount: expense?.amount || 0,
        netAmount: getExpenseNetAmount(expense),
        taxAmount: getExpenseTaxAmount(expense),
    }));

    const claimStatusBuckets = summarizeBuckets(expenses, (expense) => ({
        bucketLabel: getExpenseTaxClaimStatusLabel(getExpenseTaxClaimStatus(expense)),
        currency: expense?.currency || 'EUR',
        grossAmount: expense?.amount || 0,
        netAmount: getExpenseNetAmount(expense),
        taxAmount: getExpenseTaxAmount(expense),
    }));

    const geographyMap = new Map();
    invoices.forEach((invoice) => {
        const business = invoice?.businessInfoId ? businessInfosById.get(invoice.businessInfoId) : null;
        const client = invoice?.clientId ? clientsById.get(invoice.clientId) : null;
        const geography = getClientGeographyLabel({
            businessCountry: business?.country,
            clientCountry: client?.country,
        });
        const key = `${geography}__${invoice?.currency || 'EUR'}`;
        const current = geographyMap.get(key) || {
            geography,
            currency: invoice?.currency || 'EUR',
            total: 0,
            count: 0,
        };

        current.total += getInvoiceTotal(invoice);
        current.count += 1;
        geographyMap.set(key, current);
    });

    const geographyBuckets = Array.from(geographyMap.values()).sort((rowA, rowB) => {
        if (rowA.geography !== rowB.geography) {
            return rowA.geography.localeCompare(rowB.geography);
        }

        return rowA.currency.localeCompare(rowB.currency);
    });

    const totalOutputTax = salesBuckets.reduce((sum, row) => sum + row.taxAmount, 0);
    const totalInputTax = includedExpenses.reduce((sum, expense) => sum + getExpenseTaxAmount(expense), 0);
    const totalSalesNet = salesBuckets.reduce((sum, row) => sum + row.netAmount, 0);
    const totalExpensesNet = expenseBuckets.reduce((sum, row) => sum + row.netAmount, 0);
    const outputTaxByCurrency = sumBucketAmountsByCurrency(salesBuckets, 'taxAmount');
    const inputTaxByCurrency = sumRecordsByCurrency(
        includedExpenses,
        (expense) => expense?.currency || 'EUR',
        (expense) => getExpenseTaxAmount(expense)
    );
    const salesNetByCurrency = sumBucketAmountsByCurrency(salesBuckets, 'netAmount');
    const expensesNetByCurrency = sumBucketAmountsByCurrency(expenseBuckets, 'netAmount');
    const salesGrossByCurrency = sumBucketAmountsByCurrency(salesBuckets, 'grossAmount');
    const expensesGrossByCurrency = sumBucketAmountsByCurrency(expenseBuckets, 'grossAmount');
    const claimedExpenses = expenses.filter((expense) => getExpenseTaxClaimStatus(expense) === 'claimed');
    const unclaimedExpenses = expenses.filter((expense) => getExpenseTaxClaimStatus(expense) === 'unclaimed');
    const excludedExpenses = expenses.filter((expense) => getExpenseTaxClaimStatus(expense) === 'excluded');
    const claimedInputTaxByCurrency = sumRecordsByCurrency(
        claimedExpenses,
        (expense) => expense?.currency || 'EUR',
        (expense) => getExpenseTaxAmount(expense)
    );
    const unclaimedInputTaxByCurrency = sumRecordsByCurrency(
        unclaimedExpenses,
        (expense) => expense?.currency || 'EUR',
        (expense) => getExpenseTaxAmount(expense)
    );
    const excludedInputTaxByCurrency = sumRecordsByCurrency(
        excludedExpenses,
        (expense) => expense?.currency || 'EUR',
        (expense) => getExpenseTaxAmount(expense)
    );
    const netVatByCurrency = subtractCurrencyTotals(outputTaxByCurrency, inputTaxByCurrency);

    const needsReview = {
        missingInvoiceBusinessInfo: invoices.filter((invoice) => !invoice?.businessInfoId).length,
        missingClientCountry: invoices.filter((invoice) => {
            const client = invoice?.clientId ? clientsById.get(invoice.clientId) : null;
            return !client?.country;
        }).length,
        missingExpenseTaxMetadata: expenses.filter((expense) => {
            if (expense?.isTaxExempt) {
                return false;
            }

            return !expense?.taxLabel && typeof expense?.taxRate !== 'number' && getExpenseTaxAmount(expense) === 0;
        }).length,
        needsReviewSalesBuckets: salesBuckets.filter((row) => row.bucketLabel === 'Needs review').length,
        needsReviewExpenseBuckets: expenseBuckets.filter((row) => row.bucketLabel === 'Needs review').length,
    };

    return {
        claimStatusBuckets,
        expenseBuckets,
        geographyBuckets,
        needsReview,
        salesBuckets,
        totals: {
            claimedInputTax: claimedExpenses.reduce((sum, expense) => sum + getExpenseTaxAmount(expense), 0),
            excludedInputTax: excludedExpenses.reduce((sum, expense) => sum + getExpenseTaxAmount(expense), 0),
            inputTax: totalInputTax,
            netVat: totalOutputTax - totalInputTax,
            outputTax: totalOutputTax,
            expensesNet: totalExpensesNet,
            salesNet: totalSalesNet,
            unclaimedInputTax: unclaimedExpenses.reduce((sum, expense) => sum + getExpenseTaxAmount(expense), 0),
        },
        totalsByCurrency: {
            claimedInputTax: claimedInputTaxByCurrency,
            excludedInputTax: excludedInputTaxByCurrency,
            expensesGross: expensesGrossByCurrency,
            expensesNet: expensesNetByCurrency,
            inputTax: inputTaxByCurrency,
            netVat: netVatByCurrency,
            outputTax: outputTaxByCurrency,
            salesGross: salesGrossByCurrency,
            salesNet: salesNetByCurrency,
            unclaimedInputTax: unclaimedInputTaxByCurrency,
        },
    };
};

export const getInvoiceDaysOverdue = (invoice: any, referenceDate?: Date) => {
    if (!invoice?.dueDate || isInvoicePaid(invoice)) {
        return 0;
    }

    const dueDate = parseStoredDate(invoice.dueDate);
    if (!dueDate) {
        return 0;
    }

    const today = referenceDate ? new Date(referenceDate) : new Date();
    today.setHours(0, 0, 0, 0);

    return Math.max(0, differenceInCalendarDays(today, dueDate));
};

export const getOutstandingAgingBucket = (invoice: any, referenceDate?: Date) => {
    if (!invoice?.dueDate) {
        return 'Needs review';
    }

    const status = getInvoiceStatus(invoice, referenceDate);
    if (status !== 'overdue') {
        return 'Not due';
    }

    const daysOverdue = getInvoiceDaysOverdue(invoice, referenceDate);

    if (daysOverdue <= 30) {
        return '1-30 days';
    }

    if (daysOverdue <= 60) {
        return '31-60 days';
    }

    if (daysOverdue <= 90) {
        return '61-90 days';
    }

    return '90+ days';
};

export const buildOutstandingInvoiceSummary = (invoices: any[], referenceDate?: Date) => {
    const grouped = new Map();

    invoices.forEach((invoice) => {
        if (isInvoicePaid(invoice) || getInvoiceStatus(invoice, referenceDate) === 'draft') {
            return;
        }

        const bucketLabel = getOutstandingAgingBucket(invoice, referenceDate);
        const currency = invoice?.currency || 'EUR';
        const key = `${bucketLabel}__${currency}`;
        const current = grouped.get(key) || {
            bucketLabel,
            currency,
            total: 0,
            count: 0,
        };

        current.total += getInvoiceTotal(invoice);
        current.count += 1;
        grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((rowA, rowB) => {
        const orderA = OUTSTANDING_BUCKET_ORDER.get(rowA.bucketLabel) ?? Number.MAX_SAFE_INTEGER;
        const orderB = OUTSTANDING_BUCKET_ORDER.get(rowB.bucketLabel) ?? Number.MAX_SAFE_INTEGER;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return rowA.currency.localeCompare(rowB.currency);
    });
};

type ClientStatementSummaryParams = {
    invoices: any[];
    startDate: string;
    endDate: string;
    referenceDate?: Date;
};

export const buildClientStatementSummary = ({
    invoices,
    startDate,
    endDate,
    referenceDate,
}: ClientStatementSummaryParams) => {
    const rangeStart = startOfDay(parseStoredDate(startDate) || new Date()).getTime();
    const rangeEnd = endOfDay(parseStoredDate(endDate) || new Date()).getTime();
    const statementEnd = referenceDate ? new Date(referenceDate).getTime() : rangeEnd;

    const nonDraftInvoices = invoices.filter((invoice) => getInvoiceStatus(invoice, referenceDate) !== 'draft');
    const invoicesIssuedInRange = nonDraftInvoices
        .filter((invoice) => invoice?.date && invoice.date >= startDate && invoice.date <= endDate)
        .sort((invoiceA, invoiceB) => invoiceA.date.localeCompare(invoiceB.date));

    const openingBalanceInvoices = nonDraftInvoices
        .filter((invoice) => invoice?.date && invoice.date < startDate)
        .filter((invoice) => !isInvoicePaidOnOrBefore(invoice, rangeStart - 1))
        .sort((invoiceA, invoiceB) => invoiceA.date.localeCompare(invoiceB.date));

    const paymentsRecordedInRange = nonDraftInvoices
        .filter((invoice) => {
            const paidAt = getInvoicePaidAtTimestamp(invoice);

            return typeof paidAt === 'number' && paidAt >= rangeStart && paidAt <= rangeEnd;
        })
        .sort((invoiceA, invoiceB) => (getInvoicePaidAtTimestamp(invoiceA) || 0) - (getInvoicePaidAtTimestamp(invoiceB) || 0));

    const outstandingInvoices = nonDraftInvoices
        .filter((invoice) => invoice?.date && invoice.date <= endDate)
        .filter((invoice) => !isInvoicePaidOnOrBefore(invoice, statementEnd))
        .sort((invoiceA, invoiceB) => {
            const dueDateA = invoiceA?.dueDate || invoiceA?.date || '';
            const dueDateB = invoiceB?.dueDate || invoiceB?.date || '';

            return dueDateA.localeCompare(dueDateB);
        });

    const openingBalanceByCurrency = sumRecordsByCurrency(
        openingBalanceInvoices,
        (invoice) => invoice?.currency || 'EUR',
        (invoice) => getInvoiceTotal(invoice)
    );
    const issuedByCurrency = sumRecordsByCurrency(
        invoicesIssuedInRange,
        (invoice) => invoice?.currency || 'EUR',
        (invoice) => getInvoiceTotal(invoice)
    );
    const paymentsByCurrency = sumRecordsByCurrency(
        paymentsRecordedInRange,
        (invoice) => invoice?.currency || 'EUR',
        (invoice) => getInvoiceTotal(invoice)
    );
    const closingBalanceByCurrency = sumRecordsByCurrency(
        outstandingInvoices,
        (invoice) => invoice?.currency || 'EUR',
        (invoice) => getInvoiceTotal(invoice)
    );

    return {
        invoicesIssuedInRange,
        openingBalanceInvoices,
        outstandingInvoices,
        paymentsRecordedInRange,
        totalsByCurrency: {
            closingBalance: closingBalanceByCurrency,
            issued: issuedByCurrency,
            openingBalance: openingBalanceByCurrency,
            payments: paymentsByCurrency,
        },
    };
};

export const buildProjectWorkSummary = (entries: any[]) => {
    const grouped = new Map();

    entries.forEach((entry) => {
        const taskId = entry?.task?.id || entry?.taskId || `entry:${entry?.id || Math.random()}`;
        const taskTitle = entry?.task?.title || 'Untitled task';
        const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
        const actualMs = typeof entry?.start === 'number' && typeof entry?.end === 'number'
            ? Math.max(0, entry.end - entry.start)
            : 0;
        const billableMs = entry?.task?.billable ? getBillableDurationMs(entry) : 0;

        const current = grouped.get(taskId) || {
            taskId,
            taskTitle,
            actualMs: 0,
            billableMs: 0,
            entriesCount: 0,
            notesCount: 0,
            notedEntries: [],
            firstEntryAt: entry?.start || null,
            lastEntryAt: entry?.end || entry?.start || null,
        };

        current.actualMs += actualMs;
        current.billableMs += billableMs;
        current.entriesCount += 1;
        current.firstEntryAt = current.firstEntryAt === null ? (entry?.start || null) : Math.min(current.firstEntryAt, entry?.start || current.firstEntryAt);
        current.lastEntryAt = current.lastEntryAt === null ? (entry?.end || entry?.start || null) : Math.max(current.lastEntryAt, entry?.end || entry?.start || current.lastEntryAt);

        if (note) {
            current.notesCount += 1;
            current.notedEntries.push({
                id: entry?.id,
                note,
                start: entry?.start || null,
                end: entry?.end || null,
            });
        }

        grouped.set(taskId, current);
    });

    const rows = Array.from(grouped.values()).sort((rowA, rowB) => rowB.actualMs - rowA.actualMs);

    return {
        rows,
        totals: {
            actualMs: rows.reduce((sum, row) => sum + row.actualMs, 0),
            billableMs: rows.reduce((sum, row) => sum + row.billableMs, 0),
            entriesCount: rows.reduce((sum, row) => sum + row.entriesCount, 0),
            notesCount: rows.reduce((sum, row) => sum + row.notesCount, 0),
            tasksCount: rows.length,
        },
    };
};
