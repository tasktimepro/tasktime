/**
 * Email template utilities for invoice email sending.
 *
 * Templates use simple {placeholder} tokens that are resolved against
 * invoice/client/business data before sending.
 */

// ── Default field values for new invoice email templates ─────────────────────

export const DEFAULT_SUBJECT = 'Invoice {invoiceNumber} from {businessName}';

export const DEFAULT_SEND_BODY = `Hi {clientName},

Please find attached invoice {invoiceNumber} for {currency}{amount}.

Payment is due by {dueDate}.

Thank you,
{businessName}`;

export const DEFAULT_REMINDER_BODY = `Hi {clientName},

This is a friendly reminder that invoice {invoiceNumber} for {currency}{amount} was due on {dueDate}.

Please let me know if you have any questions.

Thank you,
{businessName}`;

export const DEFAULT_ATTACHMENT_TITLE = 'invoice-{invoiceNumber}';

// ── Placeholder metadata (for the "Available Variables" UI) ──────────────────

export const EMAIL_PLACEHOLDER_VARIABLES = [
    { key: '{invoiceNumber}', description: 'Invoice number' },
    { key: '{clientName}', description: 'Contact person' },
    { key: '{amount}', description: 'Invoice total' },
    { key: '{currency}', description: 'Currency symbol' },
    { key: '{dueDate}', description: 'Due date' },
    { key: '{businessName}', description: 'Your business name' },
] as const;

// ── Placeholder resolution ───────────────────────────────────────────────────

export interface EmailTemplatePlaceholders {
    invoiceNumber: string;
    clientName: string;
    amount: string;
    currency: string;
    dueDate: string;
    businessName: string;
}

const PLACEHOLDER_KEYS: (keyof EmailTemplatePlaceholders)[] = [
    'invoiceNumber',
    'clientName',
    'amount',
    'currency',
    'dueDate',
    'businessName',
];

/**
 * Replace all {placeholder} tokens in a template string with actual values.
 * Unknown placeholders are left as-is.
 */
export function resolveTemplate(template: string, values: EmailTemplatePlaceholders): string {

    let result = template;

    for (const key of PLACEHOLDER_KEYS) {
        result = result.split(`{${key}}`).join(values[key]);
    }

    return result;
}

/**
 * Resolve a subject template, prepending "Reminder: " for reminder sends.
 */
export function resolveSubject(
    subjectTemplate: string,
    sendType: 'invoice' | 'reminder',
    values: EmailTemplatePlaceholders,
): string {

    const resolved = resolveTemplate(subjectTemplate, values);
    return sendType === 'reminder' ? `Reminder: ${resolved}` : resolved;
}

/**
 * Strip a trailing .pdf extension so callers can append it exactly once later.
 */
export function normalizeAttachmentTitle(title: string): string {

    return title.replace(/\.pdf$/i, '');
}

/**
 * Resolve an attachment title template and append .pdf extension.
 */
export function resolveAttachmentTitle(
    titleTemplate: string,
    values: EmailTemplatePlaceholders,
): string {

    const resolved = normalizeAttachmentTitle(resolveTemplate(titleTemplate, values));
    return resolved.endsWith('.pdf') ? resolved : `${resolved}.pdf`;
}
