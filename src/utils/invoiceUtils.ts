/**
 * Invoice utility helpers.
 */

import type { InvoicePaymentCurrencySnapshot } from '@/stores/yjs/types';
import { convertCurrency, normalizeCurrencyCode } from './currencyUtils';
import { parseStoredDate } from './dateUtils';

const SIMPLE_SEQUENTIAL_TOKEN = '{sequential}';

const PAID_INVOICE_STATUS = 'paid';
const DRAFT_INVOICE_STATUS = 'draft';
const SENT_INVOICE_STATUS = 'sent';
const OVERDUE_INVOICE_STATUS = 'overdue';

const INVOICE_STATUS_VALUES = new Set([
    DRAFT_INVOICE_STATUS,
    SENT_INVOICE_STATUS,
    PAID_INVOICE_STATUS,
    OVERDUE_INVOICE_STATUS,
]);

const getStartOfToday = (referenceDate?: Date) => {
    const today = referenceDate ? new Date(referenceDate) : new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const isStoredInvoicePaid = (invoice: any) => {
    return invoice?.status === PAID_INVOICE_STATUS
        || invoice?.paymentProcessed === true
        || typeof invoice?.paidAt === 'number';
};

const getFiniteNumber = (value: any, fallback = 0) => {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
};

const getTrimmedString = (value: any) => {
    return typeof value === 'string' ? value.trim() : '';
};

const pushUniqueProjectId = (target: string[], value: any) => {
    const projectId = getTrimmedString(value);

    if (!projectId || target.includes(projectId)) {
        return;
    }

    target.push(projectId);
};

const getFiniteRecord = (value: any) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const entries = Object.entries(value).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])
    );

    if (entries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(entries) as Record<string, number>;
};

const getNormalizedProjectBreakdowns = (invoice: any) => {
    if (!Array.isArray(invoice?.projectBreakdowns)) {
        return undefined;
    }

    const normalizedBreakdowns = invoice.projectBreakdowns
        .filter((breakdown: any) => breakdown && typeof breakdown === 'object')
        .map((breakdown: any) => ({
            ...breakdown,
            projectId: getTrimmedString(breakdown.projectId),
            projectTitle: getTrimmedString(breakdown.projectTitle),
            clientId: getTrimmedString(breakdown.clientId || invoice?.clientId || invoice?.client?.id),
            totalHours: getFiniteNumber(breakdown.totalHours, 0),
            subtotal: getFiniteNumber(breakdown.subtotal, 0),
            allocatedDiscount: typeof breakdown.allocatedDiscount === 'number' ? breakdown.allocatedDiscount : undefined,
            allocatedShipping: typeof breakdown.allocatedShipping === 'number' ? breakdown.allocatedShipping : undefined,
            allocatedTax: typeof breakdown.allocatedTax === 'number' ? breakdown.allocatedTax : undefined,
            allocatedTotal: typeof breakdown.allocatedTotal === 'number' ? breakdown.allocatedTotal : undefined,
        }))
        .filter((breakdown: any) => breakdown.projectId);

    return normalizedBreakdowns.length > 0 ? normalizedBreakdowns : undefined;
};

const getNormalizedExpenseBreakdownItems = (items: any) => {
    if (!Array.isArray(items)) {
        return undefined;
    }

    const normalizedItems = items
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({
            ...item,
            id: getTrimmedString(item.id),
            title: getTrimmedString(item.title),
            date: getTrimmedString(item.date) || undefined,
            supplierName: item?.supplierName ?? null,
            projectId: getTrimmedString(item.projectId) || null,
            projectTitle: getTrimmedString(item.projectTitle) || undefined,
            amount: getFiniteNumber(item.amount, 0),
            currency: getTrimmedString(item.currency) || undefined,
            originalAmount: typeof item?.originalAmount === 'number' ? item.originalAmount : undefined,
            originalCurrency: getTrimmedString(item.originalCurrency) || undefined,
            exchangeRate: typeof item?.exchangeRate === 'number' ? item.exchangeRate : undefined,
        }))
        .filter((item: any) => item.id && item.title);

    return normalizedItems.length > 0 ? normalizedItems : undefined;
};

export const getInvoiceProjectIds = (invoice: any): string[] => {
    if (!invoice || typeof invoice !== 'object') {
        return [];
    }

    const projectIds: string[] = [];

    if (Array.isArray(invoice.projectIds)) {
        invoice.projectIds.forEach((projectId: any) => pushUniqueProjectId(projectIds, projectId));
    }

    if (Array.isArray(invoice.projectBreakdowns)) {
        invoice.projectBreakdowns.forEach((breakdown: any) => pushUniqueProjectId(projectIds, breakdown?.projectId));
    }

    pushUniqueProjectId(projectIds, invoice.projectId);
    pushUniqueProjectId(projectIds, invoice.project?.id);

    return projectIds;
};

export const getPrimaryInvoiceProjectId = (invoice: any): string | null => {
    return getInvoiceProjectIds(invoice)[0] || null;
};

export const invoiceBelongsToProject = (invoice: any, projectId: string | null | undefined): boolean => {
    if (!projectId) {
        return false;
    }

    return getInvoiceProjectIds(invoice).includes(projectId);
};

export const isMultiProjectInvoice = (invoice: any): boolean => {
    return getInvoiceProjectIds(invoice).length > 1;
};

const resolveProjectTitleFromCollection = (projects: any[] | Map<string, any> | null | undefined, projectId: string) => {
    if (!projects || !projectId) {
        return '';
    }

    if (projects instanceof Map) {
        return getTrimmedString(projects.get(projectId)?.title);
    }

    if (Array.isArray(projects)) {
        return getTrimmedString(projects.find((project) => project?.id === projectId)?.title);
    }

    return '';
};

export const getInvoiceProjectTitle = (invoice: any, projects?: any[] | Map<string, any> | null): string => {
    const projectIds = getInvoiceProjectIds(invoice);
    const breakdownTitleById = new Map(
        (Array.isArray(invoice?.projectBreakdowns) ? invoice.projectBreakdowns : [])
            .filter((breakdown: any) => breakdown?.projectId && breakdown?.projectTitle)
            .map((breakdown: any) => [breakdown.projectId, getTrimmedString(breakdown.projectTitle)])
    );

    if (projectIds.length === 0) {
        return getTrimmedString(invoice?.project?.title) || 'Unknown Project';
    }

    const titles = projectIds
        .map((projectId) => breakdownTitleById.get(projectId) || resolveProjectTitleFromCollection(projects, projectId) || (projectId === invoice?.projectId ? getTrimmedString(invoice?.project?.title) : ''))
        .filter(Boolean);

    if (titles.length === 0) {
        return projectIds.length > 1 ? 'Multiple projects' : 'Unknown Project';
    }

    if (titles.length === 1) {
        return titles[0];
    }

    if (titles.length === 2) {
        return titles.join(', ');
    }

    return `${titles[0]}, ${titles[1]} +${titles.length - 2} more`;
};

const roundCurrencyAmount = (value: number) => Math.round(value * 100) / 100;
const roundExchangeRate = (value: number) => Math.round(value * 1000000) / 1000000;

export const getInvoiceProjectRevenueBreakdown = (invoice: any) => {
    const projectIds = getInvoiceProjectIds(invoice);
    const invoiceSubtotal = getInvoiceSubtotal(invoice);
    const invoiceDiscount = getFiniteNumber(invoice?.discount, 0);
    const invoiceShipping = getFiniteNumber(invoice?.shipping, 0);
    const invoiceTax = getFiniteNumber(invoice?.tax, 0);
    const invoiceTotal = getInvoiceTotal(invoice);

    const normalizedBreakdowns = getNormalizedProjectBreakdowns(invoice);

    if (normalizedBreakdowns && normalizedBreakdowns.length > 0) {
        return normalizedBreakdowns.map((breakdown) => {
            const ratio = invoiceSubtotal > 0 ? breakdown.subtotal / invoiceSubtotal : 0;
            const allocatedDiscount = typeof breakdown.allocatedDiscount === 'number'
                ? breakdown.allocatedDiscount
                : roundCurrencyAmount(invoiceDiscount * ratio);
            const allocatedShipping = typeof breakdown.allocatedShipping === 'number'
                ? breakdown.allocatedShipping
                : roundCurrencyAmount(invoiceShipping * ratio);
            const allocatedTax = typeof breakdown.allocatedTax === 'number'
                ? breakdown.allocatedTax
                : roundCurrencyAmount(invoiceTax * ratio);
            const allocatedTotal = typeof breakdown.allocatedTotal === 'number'
                ? breakdown.allocatedTotal
                : roundCurrencyAmount(breakdown.subtotal - allocatedDiscount + allocatedShipping + allocatedTax);

            return {
                projectId: breakdown.projectId,
                projectTitle: breakdown.projectTitle || '',
                subtotal: breakdown.subtotal,
                totalHours: breakdown.totalHours,
                allocatedDiscount,
                allocatedShipping,
                allocatedTax,
                allocatedTotal,
            };
        });
    }

    if (projectIds.length === 0) {
        return [];
    }

    const subtotal = invoiceSubtotal || invoiceTotal;
    return [{
        projectId: projectIds[0],
        projectTitle: getInvoiceProjectTitle(invoice),
        subtotal,
        totalHours: getFiniteNumber(invoice?.totalHours, 0),
        allocatedDiscount: invoiceDiscount,
        allocatedShipping: invoiceShipping,
        allocatedTax: invoiceTax,
        allocatedTotal: invoiceTotal,
    }];
};

export const getInvoiceProjectFinancials = (invoice: any, projectId: string | null | undefined) => {
    if (!projectId) {
        return null;
    }

    return getInvoiceProjectRevenueBreakdown(invoice).find((breakdown) => breakdown.projectId === projectId) || null;
};

const normalizePaymentCurrencySnapshot = (invoice: any): InvoicePaymentCurrencySnapshot | null => {
    const snapshot = invoice?.paymentCurrencySnapshot;
    if (!snapshot || typeof snapshot !== 'object') {
        return null;
    }

    const capturedAt = getFiniteNumber(snapshot.capturedAt, 0);
    const sourceAmount = getFiniteNumber(snapshot.sourceAmount, Number.NaN);
    const preferredCurrencyAmount = getFiniteNumber(snapshot.preferredCurrencyAmount, Number.NaN);

    if (!capturedAt || !Number.isFinite(sourceAmount) || !Number.isFinite(preferredCurrencyAmount)) {
        return null;
    }

    return {
        capturedAt,
        sourceCurrency: normalizeCurrencyCode(snapshot.sourceCurrency || invoice?.currency),
        sourceAmount,
        preferredCurrencyAtPayment: normalizeCurrencyCode(snapshot.preferredCurrencyAtPayment),
        preferredCurrencyAmount,
    };
};

export const getInvoicePaidAtTimestamp = (invoice: any): number | null => {
    if (!isStoredInvoicePaid(invoice)) {
        return null;
    }

    if (typeof invoice?.paidAt === 'number' && Number.isFinite(invoice.paidAt)) {
        return invoice.paidAt;
    }

    const snapshot = normalizePaymentCurrencySnapshot(invoice);
    if (snapshot?.capturedAt) {
        return snapshot.capturedAt;
    }

    const invoiceDate = parseStoredDate(getTrimmedString(invoice?.date));
    if (invoiceDate) {
        return invoiceDate.getTime();
    }

    if (typeof invoice?.updatedAt === 'number' && Number.isFinite(invoice.updatedAt)) {
        return invoice.updatedAt;
    }

    if (typeof invoice?.createdAt === 'number' && Number.isFinite(invoice.createdAt)) {
        return invoice.createdAt;
    }

    return null;
};

const normalizeExistingInvoiceItem = (item: any, index: number) => {
    const description = getTrimmedString(item?.description)
        || getTrimmedString(item?.title)
        || `Invoice Item ${index + 1}`;
    const quantity = getFiniteNumber(item?.quantity, 1);
    const amount = getFiniteNumber(item?.amount, 0);
    const rate = getFiniteNumber(item?.rate, quantity !== 0 ? amount / quantity : amount);

    return {
        ...item,
        description,
        quantity,
        rate,
        amount,
        projectId: getTrimmedString(item?.projectId) || undefined,
        supplierName: item?.supplierName ?? null,
        lineType: item?.lineType,
        rateLabel: getTrimmedString(item?.rateLabel) || undefined,
        quantityLabel: getTrimmedString(item?.quantityLabel) || undefined,
        pricingMode: item?.pricingMode,
    };
};

const buildExpenseInvoiceItem = (expense: any, index: number) => {
    const amount = getFiniteNumber(expense?.amount, 0);

    return {
        description: getTrimmedString(expense?.title) || `Expense Item ${index + 1}`,
        quantity: 1,
        rate: amount,
        amount,
        expenseId: getTrimmedString(expense?.id) || undefined,
        supplierName: expense?.supplierName ?? null,
        originalAmount: typeof expense?.originalAmount === 'number' ? expense.originalAmount : undefined,
        originalCurrency: getTrimmedString(expense?.originalCurrency) || undefined,
        exchangeRate: typeof expense?.exchangeRate === 'number' ? expense.exchangeRate : undefined,
    };
};

const buildTaskInvoiceItem = (task: any, index: number) => {
    const useFlatRate = task?.useFlatRate === true;
    const quantity = useFlatRate
        ? getFiniteNumber(task?.quantity, 1)
        : getFiniteNumber(task?.hours, 0);
    const rate = useFlatRate
        ? getFiniteNumber(task?.flatRate, 0)
        : getFiniteNumber(task?.hourlyRate, 0);
    const amount = getFiniteNumber(task?.amount, quantity * rate);

    return {
        description: getTrimmedString(task?.title)
            || getTrimmedString(task?.description)
            || `Task Item ${index + 1}`,
        quantity,
        rate,
        amount,
        taskId: getTrimmedString(task?.id) || undefined,
    };
};

const getNormalizedInvoiceItems = (invoice: any) => {
    if (Array.isArray(invoice?.items)) {
        return invoice.items
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any, index: number) => normalizeExistingInvoiceItem(item, index));
    }

    const items = [];

    if (Array.isArray(invoice?.expenseItems)) {
        items.push(...invoice.expenseItems
            .filter((expense: any) => expense && typeof expense === 'object')
            .map((expense: any, index: number) => buildExpenseInvoiceItem(expense, index)));
    }

    const taskItems = [
        ...(Array.isArray(invoice?.tasks) ? invoice.tasks : []),
        ...(Array.isArray(invoice?.additionalTasks) ? invoice.additionalTasks : []),
    ];

    items.push(...taskItems
        .filter((task: any) => task && typeof task === 'object')
        .map((task: any, index: number) => buildTaskInvoiceItem(task, index)));

    return items;
};

const resolveBaseInvoiceStatus = (invoice: any) => {
    if (typeof invoice?.status === 'string' && INVOICE_STATUS_VALUES.has(invoice.status)) {
        return invoice.status;
    }

    if (isStoredInvoicePaid(invoice)) {
        return PAID_INVOICE_STATUS;
    }

    return SENT_INVOICE_STATUS;
};

export const getInvoiceTotal = (invoice: any): number => {
    const total = invoice?.total;
    if (typeof total === 'number' && Number.isFinite(total)) {
        return total;
    }

    const legacyTotal = invoice?.totalAmount;
    if (typeof legacyTotal === 'number' && Number.isFinite(legacyTotal)) {
        return legacyTotal;
    }

    const subtotal = invoice?.subtotal;
    if (typeof subtotal === 'number' && Number.isFinite(subtotal)) {
        return subtotal;
    }

    return 0;
};

export const getInvoiceSubtotal = (invoice: any): number => {
    const subtotal = invoice?.subtotal;
    if (typeof subtotal === 'number' && Number.isFinite(subtotal)) {
        return subtotal;
    }

    return getInvoiceTotal(invoice);
};

export const getInvoiceStatus = (invoice: any, referenceDate?: Date) => {
    const baseStatus = resolveBaseInvoiceStatus(invoice);

    if (baseStatus === PAID_INVOICE_STATUS || baseStatus === DRAFT_INVOICE_STATUS) {
        return baseStatus;
    }

    const dueDate = invoice?.dueDate ? parseStoredDate(invoice.dueDate) : null;
    if (!dueDate) {
        return SENT_INVOICE_STATUS;
    }

    return dueDate < getStartOfToday(referenceDate)
        ? OVERDUE_INVOICE_STATUS
        : SENT_INVOICE_STATUS;
};

export const isInvoicePaid = (invoice: any) => getInvoiceStatus(invoice) === PAID_INVOICE_STATUS;

export const isInvoiceOverdue = (invoice: any, referenceDate?: Date) => getInvoiceStatus(invoice, referenceDate) === OVERDUE_INVOICE_STATUS;

export const createInvoicePaymentCurrencySnapshot = ({
    invoice,
    preferredCurrency,
    exchangeRates,
    capturedAt,
}: {
    invoice: any;
    preferredCurrency: string;
    exchangeRates?: Record<string, number> | null;
    capturedAt: number;
}): InvoicePaymentCurrencySnapshot | null => {
    const sourceCurrency = normalizeCurrencyCode(invoice?.currency);
    const targetCurrency = normalizeCurrencyCode(preferredCurrency);
    const sourceAmount = getInvoiceTotal(invoice);

    if (sourceCurrency === targetCurrency) {
        return null;
    }

    const normalizedRates = getFiniteRecord(exchangeRates);

    const result = convertCurrency(sourceAmount, sourceCurrency, targetCurrency, normalizedRates);

    return createInvoicePaymentCurrencySnapshotFromAmounts({
        sourceCurrency,
        sourceAmount,
        preferredCurrency: targetCurrency,
        preferredCurrencyAmount: result.amount,
        capturedAt,
    });
};

export function createInvoicePaymentCurrencySnapshotFromAmounts({
    sourceCurrency,
    sourceAmount,
    preferredCurrency,
    preferredCurrencyAmount,
    capturedAt,
}: {
    sourceCurrency: string;
    sourceAmount: number;
    preferredCurrency: string;
    preferredCurrencyAmount: number;
    capturedAt: number;
}): InvoicePaymentCurrencySnapshot | null {
    const normalizedSourceCurrency = normalizeCurrencyCode(sourceCurrency);
    const normalizedPreferredCurrency = normalizeCurrencyCode(preferredCurrency);

    if (normalizedSourceCurrency === normalizedPreferredCurrency) {
        return null;
    }

    return {
        capturedAt,
        sourceCurrency: normalizedSourceCurrency,
        sourceAmount: roundCurrencyAmount(sourceAmount),
        preferredCurrencyAtPayment: normalizedPreferredCurrency,
        preferredCurrencyAmount: roundCurrencyAmount(preferredCurrencyAmount),
    };
}

export const getInvoicePaymentCurrencySnapshot = (invoice: any): InvoicePaymentCurrencySnapshot | null => {
    return normalizePaymentCurrencySnapshot(invoice);
};

export const getInvoicePaymentExchangeRate = (invoice: any): number | null => {
    const snapshot = getInvoicePaymentCurrencySnapshot(invoice);

    if (!snapshot || !snapshot.sourceAmount) {
        return null;
    }

    return roundExchangeRate(snapshot.preferredCurrencyAmount / snapshot.sourceAmount);
};

export const getPaidInvoiceConvertedAmount = (
    invoice: any,
    targetCurrency: string
): { amount: number; currency: string; success: boolean; usedSnapshot: boolean } => {
    const normalizedTargetCurrency = normalizeCurrencyCode(targetCurrency);
    const snapshot = getInvoicePaymentCurrencySnapshot(invoice);

    if (!snapshot) {
        const invoiceCurrency = normalizeCurrencyCode(invoice?.currency);
        return {
            amount: getInvoiceTotal(invoice),
            currency: invoiceCurrency,
            success: invoiceCurrency === normalizedTargetCurrency,
            usedSnapshot: false,
        };
    }

    if (normalizedTargetCurrency === snapshot.preferredCurrencyAtPayment) {
        return {
            amount: snapshot.preferredCurrencyAmount,
            currency: normalizedTargetCurrency,
            success: true,
            usedSnapshot: true,
        };
    }

    if (normalizedTargetCurrency === snapshot.sourceCurrency) {
        return {
            amount: snapshot.sourceAmount,
            currency: normalizedTargetCurrency,
            success: true,
            usedSnapshot: true,
        };
    }

    return {
        amount: snapshot.sourceAmount,
        currency: snapshot.sourceCurrency,
        success: false,
        usedSnapshot: true,
    };
};

export const normalizeInvoiceRecord = (invoice: any, referenceDate?: Date) => {
    if (!invoice || typeof invoice !== 'object') {
        return invoice;
    }

    const items = getNormalizedInvoiceItems(invoice);
    const subtotal = getInvoiceSubtotal(invoice);
    const total = getInvoiceTotal(invoice);
    const status = getInvoiceStatus({
        ...invoice,
        items,
        subtotal,
        total,
    }, referenceDate);

    const normalized = {
        ...invoice,
        projectId: getPrimaryInvoiceProjectId(invoice),
        projectIds: getInvoiceProjectIds(invoice),
        projectBreakdowns: getNormalizedProjectBreakdowns(invoice),
        clientExpenseItems: getNormalizedExpenseBreakdownItems(invoice.clientExpenseItems),
        invoiceOnlyExpenseItems: getNormalizedExpenseBreakdownItems(invoice.invoiceOnlyExpenseItems),
        clientId: invoice.clientId ?? invoice.client?.id ?? null,
        items,
        subtotal,
        total,
        status,
        paidAt: typeof invoice.paidAt === 'number' ? invoice.paidAt : null,
        paymentCurrencySnapshot: normalizePaymentCurrencySnapshot(invoice),
        businessInfoId: invoice.businessInfoId ?? invoice.businessInfo?.id ?? null,
        paymentMethodId: invoice.paymentMethodId ?? invoice.paymentMethod?.id ?? null,
        dueDate: invoice.dueDate ?? null,
    };

    delete normalized.totalAmount;
    delete normalized.paymentProcessed;

    return normalized;
};

export const getInvoiceStatusAfterMarkingUnpaid = (invoice: any, referenceDate?: Date) => {
    if (resolveBaseInvoiceStatus(invoice) === DRAFT_INVOICE_STATUS) {
        return DRAFT_INVOICE_STATUS;
    }

    return isInvoiceOverdue(invoice, referenceDate)
        ? OVERDUE_INVOICE_STATUS
        : SENT_INVOICE_STATUS;
};

const getInvoiceSortValue = (invoice: any) => {

    if (typeof invoice?.createdAt === 'number') {
        return invoice.createdAt;
    }

    if (invoice?.date) {
        const parsedDate = new Date(invoice.date).getTime();
        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    return 0;
};

const isTemplateLikeReference = (reference: any) => {

    if (!reference || typeof reference !== 'object') {
        return false;
    }

    return typeof reference.invoiceNumberFormat === 'string'
        || typeof reference.prefix === 'string'
        || typeof reference.useSequentialNumbers === 'boolean'
        || typeof reference.currentSequentialNumber === 'number'
        || typeof reference.sequentialNumberDigits === 'number'
        || typeof reference.defaultDueDays === 'number';
};

const getTemplateIdFromReference = (reference: any, invoiceTemplates?: any[] | null) => {

    if (!reference) {
        return null;
    }

    if (reference.templateId) {
        return reference.templateId;
    }

    if (reference.template?.id) {
        return reference.template.id;
    }

    if (!reference.id || !Array.isArray(invoiceTemplates)) {
        return null;
    }

    return invoiceTemplates.some((template) => template?.id === reference.id)
        ? reference.id
        : null;
};

const isSimpleSequentialTemplate = (template: any) => {

    const format = template?.invoiceNumberFormat;
    if (!template?.useSequentialNumbers || typeof format !== 'string' || !format.includes(SIMPLE_SEQUENTIAL_TOKEN)) {
        return false;
    }

    const formatWithoutSequential = format.replace(/\{sequential\}/g, '');
    return !/\{[^}]+\}/.test(formatWithoutSequential);
};

const getTemplateInvoices = (
    invoices: any[] | null | undefined,
    templateId: string | null,
    excludeInvoiceId?: string
) => {

    return (Array.isArray(invoices) ? invoices : [])
        .filter((invoice) => getTemplateIdFromReference(invoice) === templateId)
        .filter((invoice) => invoice?.id !== excludeInvoiceId)
        .sort((a, b) => getInvoiceSortValue(a) - getInvoiceSortValue(b));
};

/**
 * Resolve an invoice template reference back to the latest live template record.
 * Accepts either a template object or an invoice object containing template/templateId.
 * @param {Object|null|undefined} reference
 * @param {Array} invoiceTemplates
 * @returns {Object|null}
 */
export const resolveCurrentInvoiceTemplate = (
    reference: any,
    invoiceTemplates: any[] | null | undefined
) => {

    if (!reference) {
        return null;
    }

    const templateId = getTemplateIdFromReference(reference, invoiceTemplates);
    const fallbackTemplate = reference.template || (isTemplateLikeReference(reference) ? reference : null);

    if (!templateId) {
        return fallbackTemplate || null;
    }

    const latestTemplate = (Array.isArray(invoiceTemplates) ? invoiceTemplates : []).find(
        (template) => template?.id === templateId
    );

    return latestTemplate || fallbackTemplate || null;
};

/**
 * Extract the sequential number from an invoice number for simple prefix/suffix formats.
 * @param {string} invoiceNumber
 * @param {Object|null|undefined} template
 * @returns {number|null}
 */
export const extractSequentialNumber = (invoiceNumber: any, template: any) => {

    if (typeof invoiceNumber !== 'string' || !isSimpleSequentialTemplate(template)) {
        return null;
    }

    const [prefix, suffix = ''] = template.invoiceNumberFormat.split(SIMPLE_SEQUENTIAL_TOKEN);
    if (!invoiceNumber.startsWith(prefix) || (suffix && !invoiceNumber.endsWith(suffix))) {
        return null;
    }

    const endIndex = suffix ? -suffix.length : undefined;
    const numericSegment = invoiceNumber.slice(prefix.length, endIndex);
    if (!/^\d+$/.test(numericSegment)) {
        return null;
    }

    return Number.parseInt(numericSegment, 10);
};

/**
 * Return the next safe sequential number for a template, accounting for existing invoices.
 * @param {Object|null|undefined} template
 * @param {Array} invoices
 * @param {Object} options
 * @returns {number}
 */
export const getNextSequentialNumberForTemplate = (
    template: any,
    invoices: any[] | null | undefined,
    options: { excludeInvoiceId?: string } = {}
) => {

    const baseSequentialNumber = template?.currentSequentialNumber || 1;
    if (!template?.id || !isSimpleSequentialTemplate(template)) {
        return baseSequentialNumber;
    }

    const usedSequentialNumbers = getTemplateInvoices(invoices, template.id, options.excludeInvoiceId)
        .map((invoice) => extractSequentialNumber(invoice?.invoiceNumber, template))
        .filter((value): value is number => Number.isInteger(value));

    if (usedSequentialNumbers.length === 0) {
        return baseSequentialNumber;
    }

    return Math.max(baseSequentialNumber, Math.max(...usedSequentialNumbers) + 1);
};

const getLatestInvoice = (invoices: any[] | null | undefined) => {

    const sortedInvoices = (Array.isArray(invoices) ? invoices : [])
        .filter((invoice) => invoice && typeof invoice === 'object')
        .slice()
        .sort((a, b) => getInvoiceSortValue(a) - getInvoiceSortValue(b));

    return sortedInvoices.length > 0
        ? sortedInvoices[sortedInvoices.length - 1]
        : null;
};

export const getLatestUndoableInvoice = (invoices: any[] | null | undefined) => {

    const latestInvoice = getLatestInvoice(invoices);
    if (!latestInvoice) {
        return null;
    }

    return isInvoicePaid(latestInvoice)
        ? null
        : latestInvoice;
};

export const getInvoiceUndoBlockReason = (invoice: any, invoices: any[] | null | undefined) => {

    if (!invoice || typeof invoice !== 'object' || !invoice.id) {
        return 'Invoice not found.';
    }

    if (isInvoicePaid(invoice)) {
        return 'Paid invoices cannot be undone.';
    }

    const latestUndoableInvoice = getLatestUndoableInvoice(invoices);
    if (!latestUndoableInvoice) {
        return 'Only the latest unpaid invoice can be undone.';
    }

    if (latestUndoableInvoice.id !== invoice.id) {
        return 'Only the latest unpaid invoice can be undone.';
    }

    return null;
};

export const canUndoInvoice = (invoice: any, invoices: any[] | null | undefined) => {
    return getInvoiceUndoBlockReason(invoice, invoices) === null;
};

export const getInvoiceSequenceRollback = (
    invoice: any,
    template: any,
    invoices: any[] | null | undefined,
) => {

    if (!invoice?.id || !template?.id || !template?.useSequentialNumbers) {
        return {
            canRollback: false,
            nextSequentialNumber: null,
            reason: null,
        };
    }

    const currentSequentialNumber = typeof template.currentSequentialNumber === 'number'
        ? template.currentSequentialNumber
        : null;
    const invoiceSequentialNumber = extractSequentialNumber(invoice.invoiceNumber, template);

    if (!currentSequentialNumber || !invoiceSequentialNumber) {
        return {
            canRollback: false,
            nextSequentialNumber: null,
            reason: null,
        };
    }

    const expectedCurrentSequentialNumber = invoiceSequentialNumber + 1;

    if (currentSequentialNumber !== expectedCurrentSequentialNumber) {
        return {
            canRollback: false,
            nextSequentialNumber: null,
            reason: 'Template sequence has advanced since this invoice was created.',
        };
    }

    const remainingSequentialNumbers = getTemplateInvoices(invoices, template.id, invoice.id)
        .map((existingInvoice) => extractSequentialNumber(existingInvoice?.invoiceNumber, template))
        .filter((value): value is number => Number.isInteger(value));

    if (remainingSequentialNumbers.some((value) => value >= invoiceSequentialNumber)) {
        return {
            canRollback: false,
            nextSequentialNumber: null,
            reason: 'Existing invoice numbers prevent rewinding the template sequence.',
        };
    }

    return {
        canRollback: true,
        nextSequentialNumber: invoiceSequentialNumber,
        reason: null,
    };
};

/**
 * Get invoices for a specific project.
 * @param {Array} invoices
 * @param {string|null|undefined} projectId
 * @returns {Array}
 */
export const getInvoicesForProject = (invoices: any[] | null | undefined, projectId: string | null | undefined) => {

    if (!projectId) {
        return [];
    }

    return (Array.isArray(invoices) ? invoices : []).filter(invoice => invoiceBelongsToProject(invoice, projectId));
};

/**
 * Get the latest invoice for a project by creation time.
 * @param {Array} invoices
 * @param {string|null|undefined} projectId
 * @returns {Object|null}
 */
export const getLatestInvoiceForProject = (invoices: any[] | null | undefined, projectId: string | null | undefined) => {

    const projectInvoices = getInvoicesForProject(invoices, projectId)
        .slice()
        .sort((a, b) => getInvoiceSortValue(a) - getInvoiceSortValue(b));

    return projectInvoices.length ? projectInvoices[projectInvoices.length - 1] : null;
};
