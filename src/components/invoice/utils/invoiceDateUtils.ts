import { toStorageDate } from '../../../utils/dateUtils';

type InvoiceTemplate = {
    invoiceNumberFormat: string;
    useSequentialNumbers?: boolean;
    currentSequentialNumber?: number;
    sequentialNumberDigits?: number;
    dueDateType?: 'fixed-days' | 'fixed-weeks' | 'precise-date' | 'none' | string;
    dueDateDays?: number | string;
    dueDateWeeks?: number | string;
    dueDatePrecise?: string;
};

type ProjectInfo = {
    id: string;
};

type GenerateInvoiceNumberOptions = {
    sequenceNumber?: number;
    issuedAt?: Date | string | number | null;
    timestamp?: number;
};

/**
 * generateInvoiceNumber - Generates an invoice number based on template.
 */
export const generateInvoiceNumber = (
    template: InvoiceTemplate | null | undefined,
    project?: ProjectInfo | null,
    options: GenerateInvoiceNumberOptions = {}
): string => {

    if (!template) {
        // Fallback to original logic if no template
        return project
            ? `INV-${project.id.slice(-8)}-${Date.now()}`
            : `INV-${Date.now()}`;
    }

    const issuedAt = options.issuedAt ? new Date(options.issuedAt) : new Date();
    const now = Number.isNaN(issuedAt.getTime()) ? new Date() : issuedAt;
    const sequentialNumber = options.sequenceNumber ?? template.currentSequentialNumber ?? 0;
    const sequentialDigits = template.sequentialNumberDigits || 4;
    const variables: Record<string, string> = {
        '{projectId}': project ? project.id.slice(-8) : 'NOPROJECT',
        '{timestamp}': String(options.timestamp ?? Date.now()),
        '{date}': now.toISOString().slice(0, 10).replace(/-/g, ''),
        '{year}': now.getFullYear().toString(),
        '{month}': (now.getMonth() + 1).toString().padStart(2, '0'),
        '{day}': now.getDate().toString().padStart(2, '0'),
        '{sequential}': template.useSequentialNumbers
            ? String(sequentialNumber).padStart(sequentialDigits, '0')
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
export const calculateDueDate = (
    template: InvoiceTemplate | null | undefined,
    invoiceDate: Date = new Date()
): string | null => {

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
            dueDate.setDate(dueDate.getDate() + parseInt(String(template.dueDateDays)));
            return toStorageDate(dueDate);
        }

        case 'fixed-weeks': {
            if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                return null; // No due date
            }
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + (parseInt(String(template.dueDateWeeks)) * 7));
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
            return null;
        }
    }
};
