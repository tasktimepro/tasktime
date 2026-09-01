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
import CustomCheckbox from '@/components/CustomCheckbox';
import { Cloud, Rocket, Send } from 'lucide-react';
import { useYjs } from '@/contexts/YjsContext';
import { useBusinessBrandAssets } from '@/hooks/useBusinessBrandAssets.ts';
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
    DEFAULT_QUOTE_SUBJECT,
    DEFAULT_QUOTE_BODY,
    DEFAULT_ATTACHMENT_TITLE,
    DEFAULT_QUOTE_ATTACHMENT_TITLE,
    getLastMonthPlaceholderValue,
} from '@/utils/emailTemplateUtils';
import { checkEmailAttemptStatus, sendInvoiceEmail, isEmailSendError } from '@/utils/emailService';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import { getCurrentInvoiceHtmlContent, generatePDFBase64 } from '@/utils/pdfUtils.ts';
import { getCurrencySymbol, normalizeCurrencyCode } from '@/utils/currencyUtils.ts';
import { usePreferences } from '@/hooks/usePreferences.ts';
import { getInvoiceTotal, isInvoiceCanceled } from '@/utils/invoiceUtils.ts';
import { toDisplayDate } from '@/utils/dateUtils.ts';
import { useBilling } from '@/contexts/BillingContext';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { evaluateEntitlementFeature } from '@/domain/entitlements/entitlementPolicy';
import { EntitlementNotice } from '@/components/billing/EntitlementNotice';
import { useUrlState } from '@/hooks/useUrlState';
import {
    findBoundUnreconciledEmailAttempt,
    markEmailAttemptMetadataApplied,
} from '@/utils/emailAttemptStorage';

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

    const {
        hostedServiceSessionId,
        activeStorageProvider,
        activeStorageGeneration,
        activeStorageSessionId,
    } = useYjs();
    const { resolution } = useBilling();
    const { updateUrl } = useUrlState();
    const { businessBrandAssets } = useBusinessBrandAssets();
    const { updateInvoice } = useInvoices();
    const { getByType, getDefaultForType } = useEmailTemplates();
    const { showSuccess } = useToast();
    const { preferences } = usePreferences();

    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [pendingAttemptId, setPendingAttemptId] = useState(null);

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
    const [forwardToSelf, setForwardToSelf] = useState(false);

    const businessName = businessInfo?.businessName || businessInfo?.name || businessInfo?.title || '';
    const defaultReplyToEmail = businessInfo?.email || '';
    const invoiceCurrency = invoice?.currency || normalizeCurrencyCode(preferences.currency);
    const currencySymbol = getCurrencySymbol(invoiceCurrency);
    const invoiceTotal = invoice ? getInvoiceTotal(invoice) : 0;
    const isQuoteSend = sendType === 'quote';
    const isReminderSend = sendType === 'reminder';
    const templateType = isQuoteSend ? 'quote' : 'invoice';
    const documentLabel = isQuoteSend ? 'quote' : 'invoice';
    const emailAccess = BILLING_FEATURES.emailEntitlementEnforcement
        ? evaluateEntitlementFeature(resolution, 'invoice.email.send')
        : { allowed: true, reason: 'entitled', upgradeEligible: false };
    const entitlementActionRequired = BILLING_FEATURES.emailEntitlementEnforcement
        && !emailAccess.allowed
        && !pendingAttemptId;
    const billingLifecycle = useMemo(() => activeStorageProvider
        && activeStorageGeneration !== null
        && activeStorageSessionId
        ? {
            provider: activeStorageProvider,
            generation: activeStorageGeneration,
            sessionId: activeStorageSessionId,
        }
        : null, [activeStorageGeneration, activeStorageProvider, activeStorageSessionId]);

    const templateValues = useMemo(() => ({
        invoiceNumber: invoice?.invoiceNumber || '',
        clientName: client?.contactPerson || client?.clientName || client?.title || client?.name || '',
        amount: invoiceTotal.toFixed(2),
        currency: currencySymbol,
        dueDate: invoice?.dueDate ? toDisplayDate(invoice.dueDate) : 'N/A',
        lastMonth: getLastMonthPlaceholderValue(invoice?.date || invoice?.dueDate),
        businessName,
    }), [invoice, client, invoiceTotal, currencySymbol, businessName]);

    const senderForwardAddress = (replyTo || defaultReplyToEmail).trim();

    const defaultSubjectTemplate = isQuoteSend ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT;
    const defaultBodyTemplate = isQuoteSend
        ? DEFAULT_QUOTE_BODY
        : (isReminderSend ? DEFAULT_REMINDER_BODY : DEFAULT_SEND_BODY);
    const defaultAttachmentTitleTemplate = isQuoteSend
        ? DEFAULT_QUOTE_ATTACHMENT_TITLE
        : DEFAULT_ATTACHMENT_TITLE;

    const invoiceTemplates = useMemo(() => getByType(templateType), [getByType, templateType]);
    const availableTemplates = useMemo(() => {
        if (!pendingTemplate) {
            return invoiceTemplates;
        }

        return invoiceTemplates.some((template) => template.id === pendingTemplate.id)
            ? invoiceTemplates
            : [pendingTemplate, ...invoiceTemplates];
    }, [invoiceTemplates, pendingTemplate]);

    const defaultTemplate = useMemo(
        () => availableTemplates.find((template) => template.isDefault) || getDefaultForType(templateType) || availableTemplates[0],
        [availableTemplates, getDefaultForType, templateType]
    );

    /** Apply a template's values to the editable fields */
    const applyTemplate = useCallback((template) => {
        if (!template) {
            setFromName(businessName);
            setReplyTo(defaultReplyToEmail);
            setSubject(isQuoteSend ? resolveSubject(defaultSubjectTemplate, sendType, templateValues) : '');
            setBody(isQuoteSend ? resolveTemplate(defaultBodyTemplate, templateValues) : '');
            setAttachmentTitle(normalizeAttachmentTitle(resolveAttachmentTitle(defaultAttachmentTitleTemplate, templateValues)));
            return;
        }

        setFromName(template.fromName || businessName);
        setReplyTo(template.replyTo || defaultReplyToEmail);
        setSubject(resolveSubject(template.subject || defaultSubjectTemplate, sendType, templateValues));
        setBody(resolveTemplate(
            isReminderSend
                ? (template.reminderBody || DEFAULT_REMINDER_BODY)
                : (template.sendBody || defaultBodyTemplate),
            templateValues
        ));
        setAttachmentTitle(normalizeAttachmentTitle(resolveAttachmentTitle(template.attachmentTitle || defaultAttachmentTitleTemplate, templateValues)));
    }, [businessName, defaultAttachmentTitleTemplate, defaultBodyTemplate, defaultReplyToEmail, defaultSubjectTemplate, isQuoteSend, isReminderSend, sendType, templateValues]);

    // Initialise fields when modal opens or invoice/sendType changes
    useEffect(() => {
        if (!isOpen || !invoice) return;

        setTo(client?.email || invoice?.client?.email || '');
        setError(null);
        setSending(false);
        setPendingAttemptId(null);

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
        setForwardToSelf(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen
            || !invoice
            || !billingLifecycle
            || BILLING_FEATURES.sandbox
            || !BILLING_FEATURES.emailEntitlementEnforcement) return undefined;
        let current = true;
        const documentId = invoice.id || invoice.projectId || invoice.invoiceNumber;
        void findBoundUnreconciledEmailAttempt(
            billingLifecycle,
            documentId,
            sendType,
        ).then((attempt) => {
            if (!current || !attempt) return;
            setPendingAttemptId(attempt.attemptId);
            setError('A previous hosted send needs delivery confirmation before another send can start.');
        });
        return () => {
            current = false;
        };
    }, [billingLifecycle, invoice, isOpen, sendType]);

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

        if (BILLING_FEATURES.sandbox) {
            setError('Hosted Send is disabled in the local billing sandbox. Your draft and manual delivery options remain available.');
            return;
        }

        if (!emailAccess.allowed) {
            setError(emailAccess.reason === 'status_unavailable'
                ? 'Confirm the active TaskTime cloud account and refresh plan status before sending.'
                : 'Hosted email sending requires a Pro trial or subscription. Your draft and manual delivery options remain available.');
            return;
        }

        if (!hostedServiceSessionId) {
            setError(`Connect a cloud provider to enable ${documentLabel} emailing.`);
            return;
        }

        if (!isQuoteSend && invoice.status === 'draft') {
            setError('Finalize this draft before sending it by email.');
            return;
        }

        if (!isQuoteSend && isInvoiceCanceled(invoice)) {
            setError('Canceled invoices cannot be sent by email.');
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

        if (forwardToSelf && !senderForwardAddress) {
            setError('Add a Reply-To or business email before forwarding a copy.');
            return;
        }

        setSending(true);
        setError(null);

        let failureStage = 'prepare';

        try {
            const htmlContent = getCurrentInvoiceHtmlContent(invoice, clients, businessBrandAssets);
            failureStage = 'pdf';
            const pdfBase64 = await generatePDFBase64(htmlContent);
            const documentId = invoice.id || invoice.projectId || invoice.invoiceNumber;

            failureStage = 'send';
            const result = await sendInvoiceEmail({
                sessionId: hostedServiceSessionId,
                invoiceId: documentId,
                invoiceNumber: invoice.invoiceNumber,
                to,
                forwardTo: forwardToSelf ? senderForwardAddress : undefined,
                fromName: fromName || undefined,
                subject,
                bodyText: body,
                replyTo: replyTo || undefined,
                pdfBase64,
                sendType,
                attachmentTitle: normalizeAttachmentTitle(attachmentTitle),
                billingLifecycle: billingLifecycle || undefined,
            });

            if (result.success) {
                failureStage = 'post-send';
                if (!isQuoteSend) {
                    const updates = {
                        sentAt: Date.now(),
                        sentToEmail: to,
                    };

                    updateInvoice(invoice.id, updates);
                }
                if (result.attemptId && billingLifecycle) {
                    await markEmailAttemptMetadataApplied(result.attemptId, billingLifecycle);
                }

                const remaining = result.remaining != null ? ` (${result.remaining} emails remaining this month)` : '';
                const forwardedCopyMessage = !forwardToSelf
                    ? ''
                    : result.forwarded === true
                        ? ` and forwarded to ${senderForwardAddress}`
                        : result.forwarded === false
                            ? `. The copy to ${senderForwardAddress} could not be sent`
                            : '';

                showSuccess(
                    isQuoteSend
                        ? `Quote emailed to ${to}${forwardedCopyMessage}${remaining}`
                        : sendType === 'reminder'
                        ? `Reminder sent to ${to}${forwardedCopyMessage}${remaining}`
                        : `Invoice emailed to ${to}${forwardedCopyMessage}${remaining}`
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
                        setError(`${err.message} (${err.remaining} remaining).`);
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
                    case 'entitlement_required':
                        setError('Hosted email sending requires a Pro trial or subscription. Your draft remains available.');
                        break;
                    case 'billing_suspended':
                        setError('Resolve billing before starting a new hosted email send. Your draft remains available.');
                        break;
                    case 'pending':
                        setPendingAttemptId(err.attemptId);
                        setError(`${err.message} Attempt ${err.attemptId}.`);
                        break;
                    default:
                        setError(err.message || 'Failed to send email');
                }
            } else {
                if (failureStage !== 'pdf') {
                    captureDebugBundleIncident({
                        incidentKey: 'invoice.email_send_unexpected_failed',
                        name: 'TaskTimeInvoiceEmailUnexpectedFailure',
                        message: 'TaskTime Pro invoice email flow failed unexpectedly',
                        error: err,
                        context: {
                            stage: failureStage,
                            sendType,
                            hasForwardToCopy: forwardToSelf,
                            isQuoteSend,
                        },
                        throttleMs: 15 * 60 * 1000,
                    });
                }
                console.error('[EmailPreviewModal] Unexpected error:', err);
                const msg = err instanceof Error ? err.message : String(err);
                setError(`Unexpected error: ${msg}`);
            }
        } finally {
            setSending(false);
        }
    }, [attachmentTitle, billingLifecycle, body, businessBrandAssets, clients, documentLabel, emailAccess.allowed, emailAccess.reason, hostedServiceSessionId, forwardToSelf, fromName, invoice, isQuoteSend, onClose, replyTo, sendType, senderForwardAddress, showSuccess, subject, to, updateInvoice]);

    const handleCheckStatus = useCallback(async () => {
        if (BILLING_FEATURES.sandbox) {
            setError('Delivery status checks are disabled in the local billing sandbox.');
            return;
        }
        if (!pendingAttemptId || !hostedServiceSessionId || !billingLifecycle) return;
        setSending(true);
        setError(null);
        try {
            const attempt = await checkEmailAttemptStatus({
                sessionId: hostedServiceSessionId,
                billingLifecycle,
                attemptId: pendingAttemptId,
            });
            if (attempt.state === 'pending') {
                setError(`Delivery confirmation is still pending. Attempt ${pendingAttemptId}.`);
                return;
            }
            if (attempt.primary.outcome !== 'accepted') {
                setPendingAttemptId(null);
                setError('The email was not accepted. Review the draft before starting a fresh send.');
                return;
            }
            if (!isQuoteSend) {
                updateInvoice(invoice.id, { sentAt: Date.now(), sentToEmail: to });
            }
            await markEmailAttemptMetadataApplied(pendingAttemptId, billingLifecycle);
            showSuccess(`Delivery confirmed for ${to}.`);
            setPendingAttemptId(null);
            onClose();
        } catch (statusError) {
            setError(isEmailSendError(statusError)
                ? statusError.message
                : 'Delivery status could not be confirmed.');
        } finally {
            setSending(false);
        }
    }, [billingLifecycle, hostedServiceSessionId, invoice?.id, isQuoteSend, onClose, pendingAttemptId, showSuccess, to, updateInvoice]);

    const handleClose = useCallback(() => {
        setError(null);
        setSending(false);
        setIsTemplateModalOpen(false);
        onClose();
    }, [onClose]);

    const handleEntitlementAction = () => {
        handleClose();
        updateUrl({
            view: 'account',
            section: emailAccess.reason === 'status_unavailable' ? 'sync' : 'billing',
        });
    };

    if (!invoice) return null;

    const title = isQuoteSend
        ? `Send Quote — ${invoice.invoiceNumber}`
        : sendType === 'reminder'
            ? `Send Reminder — ${invoice.invoiceNumber}`
            : `Send Invoice — ${invoice.invoiceNumber}`;

    const hasTemplates = availableTemplates.length > 0;

    const footer = (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <div className="flex items-center">
                <CustomCheckbox
                    checked={forwardToSelf}
                    onChange={setForwardToSelf}
                    disabled={sending}
                    label="Forward this email to me"
                    labelClassName="block text-sm text-foreground"
                />
            </div>

            <div className="flex flex-row flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={handleClose} disabled={sending}>
                    Cancel
                </Button>
                {entitlementActionRequired ? (
                    <Button
                        leadingIcon={emailAccess.reason === 'status_unavailable' ? Cloud : Rocket}
                        onClick={handleEntitlementAction}
                    >
                        {emailAccess.reason === 'status_unavailable' ? 'Check cloud account' : 'View Pro options'}
                    </Button>
                ) : (
                    <Button
                        onClick={pendingAttemptId ? handleCheckStatus : handleSend}
                        disabled={BILLING_FEATURES.sandbox
                            || sending
                            || (!pendingAttemptId && (!to || !emailAccess.allowed))}
                        leadingIcon={Send}
                    >
                        {sending
                            ? (pendingAttemptId ? 'Checking...' : 'Sending...')
                            : pendingAttemptId
                                ? 'Check status'
                                : (isQuoteSend ? 'Send Quote' : (sendType === 'reminder' ? 'Send Reminder' : 'Send Invoice'))}
                    </Button>
                )}
            </div>
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
                {!hostedServiceSessionId && (
                    <Notice variant="warning" title="Cloud provider required">
                        Connect Google Drive or Dropbox in Account settings to enable {documentLabel} emailing.
                    </Notice>
                )}

                {BILLING_FEATURES.sandbox && (
                    <Notice title="Hosted Send is disabled in the billing sandbox">
                        Billing and entitlement state comes from the local Worker, but hosted email is kept off.
                        Draft editing, PDF preparation, download, copy, and manual delivery remain available.
                    </Notice>
                )}

                {BILLING_FEATURES.emailEntitlementEnforcement && !emailAccess.allowed && (
                    <EntitlementNotice
                        title={emailAccess.reason === 'status_unavailable'
                            ? 'Plan status needs confirmation'
                            : 'Hosted Send is a Pro feature'}
                    >
                        Your email draft, template editing, forwarding choice, PDF preparation, download,
                        and manual delivery workflow remain available. Starting a trial or purchase never sends this draft automatically.
                    </EntitlementNotice>
                )}

                {/* Error display */}
                {error && (
                    <Notice
                        variant={pendingAttemptId ? 'warning' : 'error'}
                        title={pendingAttemptId ? 'Delivery confirmation needed' : 'Send failed'}
                    >
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
                allowedTypes={[templateType]}
                initialType={templateType}
            />
        </>
    );
};

export default EmailPreviewModal;
