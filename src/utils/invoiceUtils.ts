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

const getFiniteRecord = (value: any) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const entries = Object.entries(value).filter(([, rate]) => typeof rate === 'number' && Number.isFinite(rate));
    if (entries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(entries);
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
        supplierName: item?.supplierName ?? null,
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

    let preferredCurrencyAmount = sourceAmount;
    const result = convertCurrency(sourceAmount, sourceCurrency, targetCurrency, normalizedRates);
    preferredCurrencyAmount = result.amount;

    return {
        capturedAt,
        sourceCurrency,
        sourceAmount,
        preferredCurrencyAtPayment: targetCurrency,
        preferredCurrencyAmount,
    };
};

export const getInvoicePaymentCurrencySnapshot = (invoice: any): InvoicePaymentCurrencySnapshot | null => {
    return normalizePaymentCurrencySnapshot(invoice);
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
        projectId: invoice.projectId ?? invoice.project?.id ?? null,
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

const getTemplateIdFromReference = (reference: any) => {

    if (!reference) {
        return null;
    }

    return reference.templateId || reference.template?.id || reference.id || null;
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
export const resolveCurrentInvoiceTemplate = (reference, invoiceTemplates) => {

    if (!reference) {
        return null;
    }

    const templateId = getTemplateIdFromReference(reference);
    const fallbackTemplate = reference.template || reference;

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
export const extractSequentialNumber = (invoiceNumber, template) => {

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
        .filter((value) => Number.isInteger(value));

    if (usedSequentialNumbers.length === 0) {
        return baseSequentialNumber;
    }

    return Math.max(baseSequentialNumber, Math.max(...usedSequentialNumbers) + 1);
};

/**
 * Get invoices for a specific project.
 * @param {Array} invoices
 * @param {string|null|undefined} projectId
 * @returns {Array}
 */
export const getInvoicesForProject = (invoices, projectId) => {

    if (!projectId) {
        return [];
    }

    return (Array.isArray(invoices) ? invoices : []).filter(invoice => invoice?.projectId === projectId);
};

/**
 * Get the latest invoice for a project by creation time.
 * @param {Array} invoices
 * @param {string|null|undefined} projectId
 * @returns {Object|null}
 */
export const getLatestInvoiceForProject = (invoices, projectId) => {

    const projectInvoices = getInvoicesForProject(invoices, projectId)
        .slice()
        .sort((a, b) => getInvoiceSortValue(a) - getInvoiceSortValue(b));

    return projectInvoices.length ? projectInvoices[projectInvoices.length - 1] : null;
};
