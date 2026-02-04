/**
 * Invoice utility helpers.
 */

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
        .sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));

    return projectInvoices.length ? projectInvoices[projectInvoices.length - 1] : null;
};
