import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Modal from '../Modal';
import EmailTemplateModal from '../modals/EmailTemplateModal.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineFieldHeader } from '@/components/ui/inline-field-header';
import { Send } from 'lucide-react';
import { useYjs } from '@/contexts/YjsContext';
import { useInvoices } from '@/hooks/useInvoices.ts';
import { useEmailTemplates } from '@/hooks/useEmailTemplates.ts';
import { useToast } from '@/hooks/useToast.ts';
import {
    resolveTemplate,
    resolveSubject,
    resolveAttachmentTitle,
    normalizeAttachmentTitle,
    DEFAULT_SUBJECT,
    DEFAULT_SEND_BODY,
    DEFAULT_REMINDER_BODY,
    DEFAULT_ATTACHMENT_TITLE,
} from '@/utils/emailTemplateUtils';
import { sendInvoiceEmail, isEmailSendError } from '@/utils/emailService';
import { getCurrentInvoiceHtmlContent, generatePDFBase64 } from '@/utils/pdfUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '@/utils/currencyUtils.ts';
import { getInvoiceTotal } from '@/utils/invoiceUtils.ts';
import { toDisplayDate } from '@/utils/dateUtils.ts';

/**
 * EmailPreviewModal — shows the user what will be emailed before sending.
 *
 * Features a template selector at the top; all fields are editable per-send.
 */
const EmailPreviewModal = ({
    isOpen,
    onClose,
    invoice,
    client,
    businessInfo,
    clients,
    sendType = 'invoice',
}) => {

    const NO_TEMPLATE_ID = '__no_email_template__';

    const { driveSessionId } = useYjs();
    const { updateInvoice } = useInvoices();
    const { getByType, getDefaultForType } = useEmailTemplates();
    const { showSuccess } = useToast();

    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    // Editable fields (initialised from selected template)
    const [to, setTo] = useState('');
    const [fromName, setFromName] = useState('');
    const [replyTo, setReplyTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachmentTitle, setAttachmentTitle] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [preferredTemplateId, setPreferredTemplateId] = useState('');
    const [pendingTemplate, setPendingTemplate] = useState(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    const businessName = businessInfo?.businessName || businessInfo?.name || businessInfo?.title || '';
    const defaultReplyToEmail = businessInfo?.email || '';
    const invoiceCurrency = invoice?.currency || getPreferredCurrency();
    const currencySymbol = getCurrencySymbol(invoiceCurrency);
    const invoiceTotal = invoice ? getInvoiceTotal(invoice) : 0;

    const templateValues = useMemo(() => ({
        invoiceNumber: invoice?.invoiceNumber || '',
        clientName: client?.contactPerson || client?.clientName || client?.title || '',
        amount: invoiceTotal.toFixed(2),
        currency: currencySymbol,
        dueDate: invoice?.dueDate ? toDisplayDate(invoice.dueDate) : 'N/A',
        businessName,
    }), [invoice, client, invoiceTotal, currencySymbol, businessName]);

    const invoiceTemplates = useMemo(() => getByType('invoice'), [getByType]);
    const availableTemplates = useMemo(() => {
        if (!pendingTemplate) {
            return invoiceTemplates;
        }

        return invoiceTemplates.some((template) => template.id === pendingTemplate.id)
            ? invoiceTemplates
            : [pendingTemplate, ...invoiceTemplates];
    }, [invoiceTemplates, pendingTemplate]);

    const defaultTemplate = useMemo(
        () => availableTemplates.find((template) => template.isDefault) || getDefaultForType('invoice') || availableTemplates[0],
        [availableTemplates, getDefaultForType]
    );

    /** Apply a template's values to the editable fields */
    const applyTemplate = useCallback((template) => {
        if (!template) {
            setFromName(businessName);
            setReplyTo(defaultReplyToEmail);
            setSubject('');
            setBody('');
            setAttachmentTitle(normalizeAttachmentTitle(resolveAttachmentTitle(DEFAULT_ATTACHMENT_TITLE, templateValues)));
            return;
        }

        setFromName(template.fromName || businessName);
        setReplyTo(template.replyTo || defaultReplyToEmail);
        setSubject(resolveSubject(template.subject || DEFAULT_SUBJECT, sendType, templateValues));
        setBody(resolveTemplate(
            sendType === 'reminder'
                ? (template.reminderBody || DEFAULT_REMINDER_BODY)
                : (template.sendBody || DEFAULT_SEND_BODY),
            templateValues
        ));
        setAttachmentTitle(normalizeAttachmentTitle(resolveAttachmentTitle(template.attachmentTitle || DEFAULT_ATTACHMENT_TITLE, templateValues)));
    }, [businessName, defaultReplyToEmail, sendType, templateValues]);

    // Initialise fields when modal opens or invoice/sendType changes
    useEffect(() => {
        if (!isOpen || !invoice) return;

        setTo(client?.email || '');
        setError(null);
        setSending(false);

        const tpl = availableTemplates.find((template) => template.id === preferredTemplateId)
            || defaultTemplate
            || null;

        setSelectedTemplateId(tpl?.id || NO_TEMPLATE_ID);
        applyTemplate(tpl);
    }, [isOpen, invoice, client, sendType, defaultTemplate, availableTemplates, preferredTemplateId, applyTemplate, NO_TEMPLATE_ID]);

    useEffect(() => {
        if (isOpen) {
            return;
        }

        setSelectedTemplateId('');
        setPreferredTemplateId('');
        setPendingTemplate(null);
        setIsTemplateModalOpen(false);
    }, [isOpen]);

    // When the user switches template, re-apply
    const handleTemplateChange = useCallback((templateId) => {
        setPreferredTemplateId(templateId);
        setSelectedTemplateId(templateId);
        const tpl = templateId === NO_TEMPLATE_ID
            ? null
            : availableTemplates.find(t => t.id === templateId);
        applyTemplate(tpl);
    }, [availableTemplates, applyTemplate, NO_TEMPLATE_ID]);

    const handleTemplateSaved = useCallback((template) => {
        if (!template) {
            return;
        }

        setPendingTemplate(template);
        setPreferredTemplateId(template.id);
        setSelectedTemplateId(template.id);
        applyTemplate(template);
        setIsTemplateModalOpen(false);
    }, [applyTemplate]);

    const handleSend = useCallback(async () => {

        if (!driveSessionId) {
            setError('Connect cloud sync to enable invoice emailing.');
            return;
        }

        if (!to) {
            setError('Recipient email is required.');
            return;
        }

        if (!subject.trim()) {
            setError('Subject is required. Select a template or enter a subject above.');
            return;
        }

        setSending(true);
        setError(null);

        try {
            const htmlContent = getCurrentInvoiceHtmlContent(invoice, clients);
            const pdfBase64 = await generatePDFBase64(htmlContent);

            const result = await sendInvoiceEmail({
                sessionId: driveSessionId,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                to,
                fromName: fromName || undefined,
                subject,
                bodyText: body,
                replyTo: replyTo || undefined,
                pdfBase64,
                sendType,
                attachmentTitle: normalizeAttachmentTitle(attachmentTitle),
            });

            if (result.success) {
                const updates = {
                    sentAt: Date.now(),
                    sentToEmail: to,
                };

                if (sendType === 'invoice' && invoice.status === 'draft') {
                    updates.status = 'sent';
                }

                updateInvoice(invoice.id, updates);

                const remaining = result.remaining != null ? ` (${result.remaining} emails remaining this month)` : '';
                showSuccess(
                    sendType === 'reminder'
                        ? `Reminder sent to ${to}${remaining}`
                        : `Invoice emailed to ${to}${remaining}`
                );
                onClose();
            }
        } catch (err) {

            if (isEmailSendError(err)) {
                switch (err.type) {
                    case 'auth':
                        setError('Session expired. Please reconnect cloud sync and try again.');
                        break;
                    case 'quota_exceeded':
                        setError(`Monthly email limit reached (${err.remaining} remaining). Try again next month.`);
                        break;
                    case 'already_sent':
                        setError('This invoice has already been emailed. Use "Send Reminder" for overdue invoices.');
                        break;
                    case 'validation':
                        setError(err.message);
                        break;
                    case 'provider':
                        setError('Email delivery failed. Please try again later.');
                        break;
                    default:
                        setError(err.message || 'Failed to send email');
                }
            } else {
                console.error('[EmailPreviewModal] Unexpected error:', err);
                const msg = err instanceof Error ? err.message : String(err);
                setError(`Unexpected error: ${msg}`);
            }
        } finally {
            setSending(false);
        }
    }, [driveSessionId, to, fromName, invoice, clients, subject, body, attachmentTitle, replyTo, sendType, updateInvoice, showSuccess, onClose]);

    const handleClose = useCallback(() => {
        setError(null);
        setSending(false);
        setIsTemplateModalOpen(false);
        onClose();
    }, [onClose]);

    if (!invoice) return null;

    const title = sendType === 'reminder'
        ? `Send Reminder — ${invoice.invoiceNumber}`
        : `Send Invoice — ${invoice.invoiceNumber}`;

    const hasTemplates = availableTemplates.length > 0;

    const footer = (
        <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancel
            </Button>
            <Button
                onClick={handleSend}
                disabled={sending || !to}
                leadingIcon={Send}
            >
                {sending ? 'Sending...' : (sendType === 'reminder' ? 'Send Reminder' : 'Send Invoice')}
            </Button>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isOpen && !isTemplateModalOpen}
                onClose={handleClose}
                title={title}
                size="2xl"
                footer={footer}
            >
                <div className="space-y-4">
                {/* Precondition warnings */}
                {!driveSessionId && (
                    <Notice variant="warning" title="Cloud sync required">
                        Connect cloud sync in Account settings to enable invoice emailing.
                    </Notice>
                )}

                {/* Error display */}
                {error && (
                    <Notice variant="error" title="Send failed">
                        {error}
                    </Notice>
                )}

                {/* Template selector */}
                <div className="space-y-1">
                    <InlineFieldHeader
                        action={(
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => setIsTemplateModalOpen(true)}
                            >
                                + New Template
                            </Button>
                        )}
                    >
                        <Label className="text-xs text-muted-foreground">Email Template</Label>
                    </InlineFieldHeader>

                    {hasTemplates ? (
                        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_TEMPLATE_ID}>No email template</SelectItem>
                                {availableTemplates.map(tpl => (
                                    <SelectItem key={tpl.id} value={tpl.id}>
                                        {tpl.name}{tpl.isDefault ? ' (Default)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_TEMPLATE_ID}>No email template</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* To */}
                <div className="space-y-1">
                    <Label htmlFor="email-send-to" className="text-xs text-muted-foreground">To</Label>
                    <Input
                        id="email-send-to"
                        type="email"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="recipient@example.com"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor="email-send-fromName" className="text-xs text-muted-foreground">From Name</Label>
                        <Input
                            id="email-send-fromName"
                            value={fromName}
                            onChange={(e) => setFromName(e.target.value)}
                            placeholder="Sender display name"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="email-send-replyTo" className="text-xs text-muted-foreground">Reply-To</Label>
                        <Input
                            id="email-send-replyTo"
                            type="email"
                            value={replyTo}
                            onChange={(e) => setReplyTo(e.target.value)}
                            placeholder="reply@example.com"
                        />
                    </div>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                    <Label htmlFor="email-send-subject" className="text-xs text-muted-foreground">Subject</Label>
                    <Input
                        id="email-send-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                </div>

                {/* Body */}
                <div className="space-y-1">
                    <Label htmlFor="email-send-body" className="text-xs text-muted-foreground">Message</Label>
                    <Textarea
                        id="email-send-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={8}
                        className="font-mono text-sm resize-y"
                    />
                </div>

                {/* Attachment title */}
                <div className="space-y-1">
                    <Label htmlFor="email-send-attachment" className="text-xs text-muted-foreground">Attachment Filename</Label>
                    <Input
                        id="email-send-attachment"
                        value={attachmentTitle}
                        onChange={(e) => setAttachmentTitle(normalizeAttachmentTitle(e.target.value))}
                    />
                </div>
                </div>
            </Modal>

            <EmailTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSaved={handleTemplateSaved}
            />
        </>
    );
};

export default EmailPreviewModal;
