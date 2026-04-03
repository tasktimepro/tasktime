/**
 * Invoice utility helpers.
 */

const SIMPLE_SEQUENTIAL_TOKEN = '{sequential}';

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
