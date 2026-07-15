import type { BusinessInfo, Client, EmailTemplate, Invoice } from '@/stores/yjs/types';
import {
    DEFAULT_ATTACHMENT_TITLE,
    DEFAULT_QUOTE_ATTACHMENT_TITLE,
    DEFAULT_QUOTE_BODY,
    DEFAULT_QUOTE_SUBJECT,
    DEFAULT_REMINDER_BODY,
    DEFAULT_SEND_BODY,
    DEFAULT_SUBJECT,
    getLastMonthPlaceholderValue,
    normalizeAttachmentTitle,
    resolveAttachmentTitle,
    resolveSubject,
    resolveTemplate,
    type EmailSendType,
} from '@/utils/emailTemplateUtils';
import { DEFAULT_CURRENCY, getCurrencySymbol } from '@/utils/currencyUtils';
import { toDisplayDate } from '@/utils/dateUtils';
import { getInvoiceTotal, isInvoiceCanceled } from '@/utils/invoiceUtils';

export interface InvoiceEmailDraftOverrides {
    templateId?: string | null;
    to?: string | null;
    fromName?: string | null;
    replyTo?: string | null;
    subject?: string | null;
    body?: string | null;
    attachmentTitle?: string | null;
    forwardToSelf?: boolean;
}

export interface InvoiceEmailDraft {
    invoiceId: string;
    invoiceNumber: string;
    sendType: EmailSendType;
    templateId: string | null;
    to: string;
    fromName: string;
    replyTo: string;
    subject: string;
    body: string;
    attachmentTitle: string;
    forwardToSelf: boolean;
    forwardTo: string | null;
}

export interface ResolveInvoiceEmailDraftInput {
    invoice: Invoice;
    client?: Client | null;
    businessInfo?: BusinessInfo | null;
    emailTemplates: EmailTemplate[];
    sendType?: EmailSendType;
    overrides?: InvoiceEmailDraftOverrides;
    preferredCurrency?: string;
}

export function resolveInvoiceEmailDraft({
    invoice,
    client,
    businessInfo,
    emailTemplates,
    sendType = 'invoice',
    overrides = {},
    preferredCurrency,
}: ResolveInvoiceEmailDraftInput): InvoiceEmailDraft {
    if (isInvoiceCanceled(invoice)) {
        throw new Error('Canceled invoices cannot be sent by email.');
    }

    const isQuoteSend = sendType === 'quote';
    const isReminderSend = sendType === 'reminder';
    const templateType = isQuoteSend ? 'quote' : 'invoice';
    const templateValues = getInvoiceEmailTemplateValues(invoice, client, businessInfo, preferredCurrency);
    const typedTemplates = [...emailTemplates]
        .filter((template) => template.type === templateType)
        .sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });
    const selectedTemplate = overrides.templateId
        ? typedTemplates.find((template) => template.id === overrides.templateId) || null
        : typedTemplates.find((template) => template.isDefault) || typedTemplates[0] || null;
    const businessName = getBusinessName(businessInfo);
    const defaultReplyToEmail = businessInfo?.email || '';
    const defaultSubjectTemplate = isQuoteSend ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT;
    const defaultBodyTemplate = isQuoteSend
        ? DEFAULT_QUOTE_BODY
        : (isReminderSend ? DEFAULT_REMINDER_BODY : DEFAULT_SEND_BODY);
    const defaultAttachmentTitleTemplate = isQuoteSend
        ? DEFAULT_QUOTE_ATTACHMENT_TITLE
        : DEFAULT_ATTACHMENT_TITLE;
    const templateSubject = selectedTemplate?.subject || defaultSubjectTemplate;
    const templateBody = selectedTemplate
        ? (isReminderSend ? (selectedTemplate.reminderBody || DEFAULT_REMINDER_BODY) : (selectedTemplate.sendBody || defaultBodyTemplate))
        : (isQuoteSend ? defaultBodyTemplate : '');
    const templateAttachmentTitle = selectedTemplate?.attachmentTitle || defaultAttachmentTitleTemplate;
    const resolvedReplyTo = selectedTemplate?.replyTo || defaultReplyToEmail;
    const replyTo = stringOverride(overrides.replyTo, resolvedReplyTo);
    const forwardToSelf = overrides.forwardToSelf === true;
    const forwardTo = forwardToSelf ? (replyTo || defaultReplyToEmail).trim() || null : null;

    return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        sendType,
        templateId: selectedTemplate?.id || null,
        to: stringOverride(overrides.to, client?.email || (invoice as any).client?.email || ''),
        fromName: stringOverride(overrides.fromName, selectedTemplate?.fromName || businessName),
        replyTo,
        subject: stringOverride(overrides.subject, selectedTemplate || isQuoteSend
            ? resolveSubject(templateSubject, sendType, templateValues)
            : ''
        ),
        body: stringOverride(overrides.body, selectedTemplate || isQuoteSend
            ? resolveTemplate(templateBody, templateValues)
            : ''
        ),
        attachmentTitle: normalizeAttachmentTitle(stringOverride(
            overrides.attachmentTitle,
            resolveAttachmentTitle(templateAttachmentTitle, templateValues)
        )),
        forwardToSelf,
        forwardTo,
    };
}

function getInvoiceEmailTemplateValues(invoice: Invoice, client?: Client | null, businessInfo?: BusinessInfo | null, preferredCurrency?: string) {
    const invoiceCurrency = invoice.currency || preferredCurrency || DEFAULT_CURRENCY;
    const currencySymbol = getCurrencySymbol(invoiceCurrency);
    const invoiceTotal = getInvoiceTotal(invoice);

    return {
        invoiceNumber: invoice.invoiceNumber || '',
        clientName: client?.contactPerson || client?.clientName || client?.title || client?.name || '',
        amount: invoiceTotal.toFixed(2),
        currency: currencySymbol,
        dueDate: invoice.dueDate ? toDisplayDate(invoice.dueDate) : 'N/A',
        lastMonth: getLastMonthPlaceholderValue(invoice.date || invoice.dueDate),
        businessName: getBusinessName(businessInfo),
    };
}

function getBusinessName(businessInfo?: BusinessInfo | null): string {
    return businessInfo?.businessName || businessInfo?.name || businessInfo?.title || '';
}

function stringOverride(value: string | null | undefined, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
