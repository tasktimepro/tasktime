import { toStorageDate } from '../../../utils/dateUtils';

/**
 * generateInvoiceNumber - Generates an invoice number based on template.
 */
export const generateInvoiceNumber = (template, project) => {

    if (!template) {
        // Fallback to original logic if no template
        return project
            ? `INV-${project.id.slice(-8)}-${Date.now()}`
            : `INV-${Date.now()}`;
    }

    const now = new Date();
    const variables = {
        '{projectId}': project ? project.id.slice(-8) : 'NOPROJECT',
        '{timestamp}': Date.now().toString(),
        '{date}': now.toISOString().slice(0, 10).replace(/-/g, ''),
        '{year}': now.getFullYear().toString(),
        '{month}': (now.getMonth() + 1).toString().padStart(2, '0'),
        '{day}': now.getDate().toString().padStart(2, '0'),
        '{sequential}': template.useSequentialNumbers
            ? template.currentSequentialNumber.toString().padStart(4, '0')
            : '0001'
    };

    let format = template.invoiceNumberFormat;
    Object.entries(variables).forEach(([key, value]) => {
        format = format.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return format;
};

/**
 * calculateDueDate - Calculates due date using template settings.
 * Returns ISO format (YYYY-MM-DD) for storage portability.
 */
export const calculateDueDate = (template, invoiceDate = new Date()) => {

    if (!template) {
        // Default to 30 days if no template
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30);
        return toStorageDate(dueDate);
    }

    switch (template.dueDateType) {
        case 'fixed-days': {
            if (!template.dueDateDays || template.dueDateDays === 0) {
                return null; // No due date
            }
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + parseInt(template.dueDateDays));
            return toStorageDate(dueDate);
        }

        case 'fixed-weeks': {
            if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                return null; // No due date
            }
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + (parseInt(template.dueDateWeeks) * 7));
            return toStorageDate(dueDate);
        }

        case 'precise-date': {
            if (!template.dueDatePrecise) {
                return null; // No due date
            }
            return toStorageDate(new Date(template.dueDatePrecise));
        }

        case 'none': {
            return null; // No due date to be shown
        }

        default: {
            // Backward compatibility with old 'fixed' and 'net' types
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + (template.dueDateDays || 30));
            return toStorageDate(dueDate);
        }
    }
};
