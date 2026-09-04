import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
    findUnreconciledEmailAttemptForRecovery,
    markEmailAttemptMetadataApplied,
    validateBoundEmailAttemptDocumentSnapshot,
} from '@/utils/emailAttemptStorage';

const MAX_AUTOMATIC_DELIVERY_CHECKS = 6;
const AUTOMATIC_DELIVERY_CHECK_DELAY_MS = 2_000;
const AUTOMATIC_DELIVERY_SPINNER_BUDGET_MS = 12_000;
const AUTOMATIC_DELIVERY_BUDGET_EXCEEDED = Symbol('automatic-delivery-budget-exceeded');

function formatEmailUsageReset(periodEnd) {
    const timestamp = Date.parse(periodEnd || '');
    if (!Number.isFinite(timestamp)) return null;
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(timestamp);
}

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
    const { resolution, status } = useBilling();
    const { updateUrl } = useUrlState();
    const { businessBrandAssets } = useBusinessBrandAssets();
    const { invoices: currentInvoices = [], updateInvoice } = useInvoices();
    const { getByType, getDefaultForType } = useEmailTemplates();
    const { showSuccess, showWarning } = useToast();
    const { preferences } = usePreferences();

    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [pendingAttemptId, setPendingAttemptId] = useState(null);
    const [pendingMessage, setPendingMessage] = useState(null);
    const [deliveryProtection, setDeliveryProtection] = useState(null);
    const [automaticChecksStopped, setAutomaticChecksStopped] = useState(false);
    const checkingAttemptRef = useRef(null);
    const automaticCheckCountRef = useRef(0);
    const automaticRecoveryStartedAtRef = useRef(null);
    const pendingRecipientRef = useRef('');
    const primaryApplicationRef = useRef(null);
    const statusTimerRef = useRef(null);
    const recoveryGenerationRef = useRef(0);
    const recoveryLifecycleKeyRef = useRef(null);
    const modalIsOpenRef = useRef(isOpen);
    const currentInvoicesRef = useRef(currentInvoices);
    const recoveryLifecycleKey = isOpen && invoice
        ? `${sendType}:${invoice.id || invoice.projectId || invoice.invoiceNumber}`
        : null;
    if (recoveryLifecycleKeyRef.current !== recoveryLifecycleKey) {
        recoveryLifecycleKeyRef.current = recoveryLifecycleKey;
        recoveryGenerationRef.current += 1;
        checkingAttemptRef.current = null;
    }
    modalIsOpenRef.current = isOpen;
    currentInvoicesRef.current = currentInvoices;

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
    const canonicalEmailUsage = resolution.kind === 'canonical'
        && status?.usage?.invoiceEmail?.available === true
        && status.usage.invoiceEmail.entitled === true
        && Number.isSafeInteger(status.usage.invoiceEmail.effectiveRemaining)
        ? status.usage.invoiceEmail
        : null;
    const emailUsageRemaining = canonicalEmailUsage?.effectiveRemaining ?? null;
    const emailUsageReset = formatEmailUsageReset(canonicalEmailUsage?.window?.periodEnd);
    const forwardingUnavailable = emailUsageRemaining !== null && emailUsageRemaining < 2;
    const hostedSendUnavailable = emailUsageRemaining === 0;
    const billingLifecycle = useMemo(() => activeStorageProvider
        && activeStorageGeneration !== null
        && activeStorageSessionId
        && hostedServiceSessionId === activeStorageSessionId
        ? {
            provider: activeStorageProvider,
            generation: activeStorageGeneration,
            sessionId: activeStorageSessionId,
        }
        : null, [activeStorageGeneration, activeStorageProvider, activeStorageSessionId, hostedServiceSessionId]);

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

    useEffect(() => {
        if (forwardToSelf && forwardingUnavailable) setForwardToSelf(false);
    }, [forwardToSelf, forwardingUnavailable]);

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
        setPendingMessage(null);
        setDeliveryProtection(null);
        setAutomaticChecksStopped(false);
        automaticCheckCountRef.current = 0;
        automaticRecoveryStartedAtRef.current = null;
        pendingRecipientRef.current = '';
        primaryApplicationRef.current = null;

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

    const protectConfirmedDelivery = useCallback((attemptId) => {
        if (statusTimerRef.current !== null) {
            window.clearTimeout(statusTimerRef.current);
            statusTimerRef.current = null;
        }
        setPendingAttemptId(attemptId);
        setDeliveryProtection('confirmed');
        setAutomaticChecksStopped(true);
        setPendingMessage('Delivery was confirmed, but TaskTime could not finish saving the confirmation locally. You can safely close this window; TaskTime will keep applying it automatically from the invoice list.');
        setError(null);
    }, []);

    const applyAcceptedDelivery = useCallback(async ({
        attemptId,
        acceptedAt,
        recipient = '',
        isCurrent = () => true,
    }) => {
        if (!isCurrent()) return 'stale';
        const acceptedAtMs = acceptedAt ? Date.parse(acceptedAt) : NaN;
        const sentAt = Number.isFinite(acceptedAtMs)
            ? acceptedAtMs
            : BILLING_FEATURES.emailEntitlementEnforcement
                ? null
                : Date.now();

        if (sentAt === null) {
            if (!isCurrent()) return 'stale';
            protectConfirmedDelivery(attemptId);
            return 'protected';
        }

        try {
            const primaryApplicationKey = `${attemptId || 'legacy'}:${sentAt}:${recipient}`;
            if (isQuoteSend) return 'applied';

            const currentInvoice = BILLING_FEATURES.emailEntitlementEnforcement
                ? currentInvoicesRef.current.find(candidate => candidate.id === invoice.id)
                : invoice;
            if (!currentInvoice || isInvoiceCanceled(currentInvoice)) return 'mismatch';

            if (BILLING_FEATURES.emailEntitlementEnforcement) {
                if (!attemptId || !billingLifecycle) {
                    protectConfirmedDelivery(attemptId);
                    return 'protected';
                }
                const validation = await validateBoundEmailAttemptDocumentSnapshot(
                    attemptId,
                    billingLifecycle,
                    currentInvoice,
                );
                if (!isCurrent()) return 'stale';
                if (validation === 'mismatch') return 'mismatch';
                if (validation !== 'match') {
                    protectConfirmedDelivery(attemptId);
                    return 'protected';
                }
            }

            if (primaryApplicationRef.current !== primaryApplicationKey) {
                if (!isCurrent()) return 'stale';
                await Promise.resolve(updateInvoice(currentInvoice.id, {
                    sentAt,
                    ...(recipient ? { sentToEmail: recipient } : {}),
                }));
                if (!isCurrent()) return 'stale';
                primaryApplicationRef.current = primaryApplicationKey;
            }
            return 'applied';
        } catch {
            if (!isCurrent()) return 'stale';
            if (attemptId) {
                protectConfirmedDelivery(attemptId);
                return 'protected';
            }
            throw new Error('Local delivery confirmation could not be applied.');
        }
    }, [billingLifecycle, invoice, isQuoteSend, protectConfirmedDelivery, updateInvoice]);

    const finishAttemptReconciliation = useCallback(async (attemptId, isCurrent = () => true) => {
        if (!isCurrent()) return false;
        if (!attemptId || !billingLifecycle) return true;
        const applied = await markEmailAttemptMetadataApplied(attemptId, billingLifecycle);
        if (!isCurrent()) return false;
        if (!applied) {
            protectConfirmedDelivery(attemptId);
            return false;
        }
        return true;
    }, [billingLifecycle, protectConfirmedDelivery]);

    const reconcilePendingAttempt = useCallback(async (
        attemptId,
        recipient = '',
        recoveryBinding = null,
    ) => {
        if (!attemptId
            || !hostedServiceSessionId
            || !billingLifecycle
            || !modalIsOpenRef.current
            || checkingAttemptRef.current !== null
            || automaticChecksStopped) return;

        const recoveryGeneration = recoveryGenerationRef.current;
        const isCurrentRecovery = () => modalIsOpenRef.current
            && recoveryGenerationRef.current === recoveryGeneration;
        const statusCheckToken = Symbol('hosted-email-status-check');

        if (automaticRecoveryStartedAtRef.current === null) {
            automaticRecoveryStartedAtRef.current = Date.now();
        }
        const stopWithCalmProtection = (message = 'Delivery could not be confirmed yet. TaskTime has protected this email from being sent again. You can safely close this window.') => {
            if (!isCurrentRecovery()) return;
            setAutomaticChecksStopped(true);
            setDeliveryProtection('pending');
            setPendingMessage(message);
            setError(null);
        };
        const spinnerDeadline = automaticRecoveryStartedAtRef.current
            + AUTOMATIC_DELIVERY_SPINNER_BUDGET_MS;
        const remainingSpinnerBudget = spinnerDeadline - Date.now();
        if (remainingSpinnerBudget <= 0) {
            stopWithCalmProtection();
            return;
        }

        if (automaticCheckCountRef.current >= MAX_AUTOMATIC_DELIVERY_CHECKS) {
            stopWithCalmProtection('Delivery is still being confirmed. TaskTime has protected this email from being sent again. You can safely close this window.');
            return;
        }

        checkingAttemptRef.current = statusCheckToken;
        automaticCheckCountRef.current += 1;
        let shouldScheduleNextCheck = false;
        let spinnerBudgetTimer = null;
        if (recipient) pendingRecipientRef.current = recipient;
        setPendingAttemptId(attemptId);
        setDeliveryProtection('pending');
        setPendingMessage('TaskTime is checking automatically. You can safely close this window.');
        setError(null);

        try {
            const attempt = await Promise.race([
                checkEmailAttemptStatus({
                    sessionId: hostedServiceSessionId,
                    billingLifecycle,
                    attemptId,
                    ...(recoveryBinding ? { recoveryBinding } : {}),
                }),
                new Promise((_, reject) => {
                    spinnerBudgetTimer = window.setTimeout(
                        () => reject(AUTOMATIC_DELIVERY_BUDGET_EXCEEDED),
                        remainingSpinnerBudget,
                    );
                }),
            ]);
            if (!isCurrentRecovery()) return;
            const hasPendingPart = attempt.primary.outcome === 'pending'
                || attempt.forward?.outcome === 'pending';
            let primaryApplication = 'applied';
            if (attempt.primary.outcome === 'accepted') {
                primaryApplication = await applyAcceptedDelivery({
                    attemptId,
                    acceptedAt: attempt.primary.acceptedAt,
                    recipient: pendingRecipientRef.current,
                    isCurrent: isCurrentRecovery,
                });
                if (primaryApplication === 'protected' || primaryApplication === 'stale') return;
            }
            if (!isCurrentRecovery()) return;
            if (attempt.state === 'pending' || hasPendingPart) {
                if (automaticCheckCountRef.current >= MAX_AUTOMATIC_DELIVERY_CHECKS) {
                    setAutomaticChecksStopped(true);
                    setPendingMessage(primaryApplication === 'mismatch'
                        ? 'The primary email was delivered for an earlier version. The requested copy is still being confirmed, and TaskTime has protected this email from being sent again.'
                        : 'Delivery is still being confirmed. TaskTime has protected this email from being sent again. You can safely close this window.');
                } else {
                    setPendingMessage(primaryApplication === 'mismatch'
                        ? 'The primary email was delivered for an earlier version. TaskTime is checking the requested copy automatically.'
                        : 'TaskTime is checking automatically. You can safely close this window.');
                    shouldScheduleNextCheck = true;
                }
                return;
            }
            if (attempt.primary.outcome !== 'accepted') {
                if (attempt.state !== 'rejected') {
                    const finalized = await finishAttemptReconciliation(
                        attemptId,
                        isCurrentRecovery,
                    );
                    if (!finalized) return;
                }
                if (!isCurrentRecovery()) return;
                setPendingAttemptId(null);
                setPendingMessage(null);
                setDeliveryProtection(null);
                setError('The email was not accepted. Review the draft before sending again.');
                return;
            }
            const finalized = await finishAttemptReconciliation(
                attemptId,
                isCurrentRecovery,
            );
            if (!finalized) return;
            if (!isCurrentRecovery()) return;
            if (primaryApplication === 'mismatch') {
                showWarning('The email was delivered for an earlier version of this invoice. The current invoice was not marked as sent.');
                setPendingAttemptId(null);
                setPendingMessage(null);
                setDeliveryProtection(null);
                onClose();
                return;
            }
            const forwardWasNotSent = attempt.forward?.outcome === 'rejected';
            if (forwardWasNotSent) {
                const deliveryLabel = isQuoteSend
                    ? 'Quote'
                    : isReminderSend
                        ? 'Reminder'
                        : 'Invoice';
                showWarning(`${deliveryLabel} emailed successfully, but the requested copy was not sent.`);
                setPendingAttemptId(null);
                setPendingMessage(null);
                setDeliveryProtection(null);
                onClose();
                return;
            }
            const confirmedRecipient = pendingRecipientRef.current;
            showSuccess(confirmedRecipient
                ? `Delivery confirmed for ${confirmedRecipient}.`
                : 'Delivery confirmed.');
            setPendingAttemptId(null);
            setPendingMessage(null);
            setDeliveryProtection(null);
            onClose();
        } catch (statusError) {
            if (!isCurrentRecovery()) return;
            if (statusError === AUTOMATIC_DELIVERY_BUDGET_EXCEEDED) {
                stopWithCalmProtection();
                return;
            }
            if (isEmailSendError(statusError) && statusError.type === 'attempt_dormant') {
                setPendingAttemptId(attemptId);
                setDeliveryProtection('protected');
                setAutomaticChecksStopped(true);
                setPendingMessage(statusError.message);
                setError(null);
                return;
            }
            if (isEmailSendError(statusError) && statusError.type === 'attempt_not_found') {
                setPendingAttemptId(null);
                setPendingMessage(null);
                setDeliveryProtection(null);
                setError(null);
                return;
            }
            if (automaticCheckCountRef.current >= MAX_AUTOMATIC_DELIVERY_CHECKS) {
                setAutomaticChecksStopped(true);
                setPendingMessage('Delivery could not be confirmed yet. TaskTime has protected this email from being sent again. You can safely close this window.');
            } else {
                setPendingMessage('Delivery could not be confirmed yet. TaskTime will check again automatically.');
                shouldScheduleNextCheck = true;
            }
        } finally {
            if (spinnerBudgetTimer !== null) {
                window.clearTimeout(spinnerBudgetTimer);
            }
            if (checkingAttemptRef.current === statusCheckToken) {
                checkingAttemptRef.current = null;
            }
            if (isCurrentRecovery()
                && shouldScheduleNextCheck
                && automaticCheckCountRef.current < MAX_AUTOMATIC_DELIVERY_CHECKS) {
                const remainingBudgetAfterCheck = spinnerDeadline - Date.now();
                if (remainingBudgetAfterCheck <= 0) {
                    stopWithCalmProtection();
                } else {
                    statusTimerRef.current = window.setTimeout(() => {
                        statusTimerRef.current = null;
                        if (!isCurrentRecovery()) return;
                        void reconcilePendingAttempt(attemptId, '', recoveryBinding);
                    }, Math.min(AUTOMATIC_DELIVERY_CHECK_DELAY_MS, remainingBudgetAfterCheck));
                }
            }
        }
    }, [applyAcceptedDelivery, automaticChecksStopped, billingLifecycle, finishAttemptReconciliation, hostedServiceSessionId, isQuoteSend, isReminderSend, onClose, showSuccess, showWarning]);

    useEffect(() => {
        if (!isOpen
            || !invoice
            || !billingLifecycle
            || !BILLING_FEATURES.emailEntitlementEnforcement) return undefined;
        let current = true;
        const documentId = invoice.id || invoice.projectId || invoice.invoiceNumber;
        const currentInvoice = currentInvoices.find(candidate => candidate.id === invoice.id) ?? invoice;
        void findUnreconciledEmailAttemptForRecovery(
            billingLifecycle,
            documentId,
            sendType,
            {
                includeAppliedCompletion: sendType === 'invoice' && !currentInvoice.sentAt,
            },
        ).then((candidate) => {
            if (!current || !candidate) return;
            const recoveryBinding = candidate.binding === 'same-provider-reconnect'
                ? { kind: candidate.binding, documentId, sendType }
                : candidate.binding === 'different-provider'
                    ? { kind: 'cross-provider-status-proof', documentId, sendType }
                    : null;
            void reconcilePendingAttempt(candidate.attempt.attemptId, '', recoveryBinding);
        });
        return () => {
            current = false;
        };
    }, [billingLifecycle, currentInvoices, invoice, isOpen, reconcilePendingAttempt, sendType]);

    useEffect(() => () => {
        modalIsOpenRef.current = false;
        recoveryGenerationRef.current += 1;
        checkingAttemptRef.current = null;
        if (statusTimerRef.current !== null) {
            window.clearTimeout(statusTimerRef.current);
        }
    }, []);

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
        setPendingMessage(null);

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

        if (BILLING_FEATURES.emailEntitlementEnforcement && !billingLifecycle) {
            setError('Reconnect cloud sync before sending so TaskTime can confirm the active account.');
            return;
        }

        if (hostedSendUnavailable) {
            setError('No hosted email sends remain in the current allowance. The reset date is shown below.');
            return;
        }

        if (forwardToSelf && forwardingUnavailable) {
            setForwardToSelf(false);
            setError('Forwarding a copy requires two available sends. The primary email remains ready to send.');
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

        automaticCheckCountRef.current = 0;
        automaticRecoveryStartedAtRef.current = null;
        setAutomaticChecksStopped(false);
        setSending(true);
        setError(null);

        const sendGeneration = recoveryGenerationRef.current;
        const isCurrentSend = () => modalIsOpenRef.current
            && recoveryGenerationRef.current === sendGeneration;

        let failureStage = 'prepare';

        try {
            const htmlContent = getCurrentInvoiceHtmlContent(invoice, clients, businessBrandAssets);
            failureStage = 'pdf';
            const pdfBase64 = await generatePDFBase64(htmlContent);
            if (!isCurrentSend()) return;
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
                documentSnapshot: invoice,
            });
            if (!isCurrentSend()) return;

            if (result.success) {
                failureStage = 'post-send';
                const application = await applyAcceptedDelivery({
                    attemptId: result.attemptId || null,
                    acceptedAt: result.primaryAcceptedAt || null,
                    recipient: to,
                    isCurrent: isCurrentSend,
                });
                if (application === 'protected' || application === 'stale') return;
                const finalized = await finishAttemptReconciliation(
                    result.attemptId || null,
                    isCurrentSend,
                );
                if (!finalized) return;
                if (!isCurrentSend()) return;

                if (application === 'mismatch') {
                    showWarning('The email was delivered for an earlier version of this invoice. The current invoice was not marked as sent.');
                    onClose();
                    return;
                }

                const remaining = result.remaining != null ? ` (${result.remaining} emails remaining this month)` : '';
                const forwardedCopyMessage = !forwardToSelf
                    ? ''
                    : result.forwarded === true
                        ? ` and forwarded to ${senderForwardAddress}`
                        : result.forwarded === false
                            ? `. The copy to ${senderForwardAddress} could not be sent`
                            : '';

                const deliveryMessage = isQuoteSend
                    ? `Quote emailed to ${to}${forwardedCopyMessage}${remaining}`
                    : sendType === 'reminder'
                        ? `Reminder sent to ${to}${forwardedCopyMessage}${remaining}`
                        : `Invoice emailed to ${to}${forwardedCopyMessage}${remaining}`;
                if (forwardToSelf && result.forwarded === false) {
                    showWarning(deliveryMessage);
                } else {
                    showSuccess(deliveryMessage);
                }
                onClose();
            }
        } catch (err) {
            if (!isCurrentSend()) return;

            if (isEmailSendError(err)) {
                switch (err.type) {
                    case 'auth':
                        setError('Session expired. Please reconnect cloud sync and try again.');
                        break;
                    case 'quota_exceeded':
                        setError(`${err.message} (${err.remaining} remaining).`);
                        break;
                    case 'rate_limited':
                        setError(err.message);
                        break;
                    case 'already_sent':
                        setError(sendType === 'reminder'
                            ? 'This reminder has already been sent.'
                            : 'This invoice has already been emailed. Use "Send Reminder" for overdue invoices.');
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
                    case 'client_upgrade_required':
                        setError(err.message);
                        break;
                    case 'attempt_capacity':
                    case 'attempt_conflict':
                        setError(err.message);
                        break;
                    case 'attempt_dormant':
                        setPendingAttemptId(err.attemptId);
                        setDeliveryProtection('protected');
                        setAutomaticChecksStopped(true);
                        setPendingMessage(err.message);
                        break;
                    case 'pending':
                        if (err.primaryAcceptedAt) {
                            const primaryApplication = await applyAcceptedDelivery({
                                attemptId: err.attemptId,
                                acceptedAt: err.primaryAcceptedAt,
                                recipient: to,
                                isCurrent: isCurrentSend,
                            });
                            if (primaryApplication === 'protected' || primaryApplication === 'stale') break;
                        }
                        if (!isCurrentSend()) break;
                        await reconcilePendingAttempt(err.attemptId, to);
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
            if (isCurrentSend()) setSending(false);
        }
    }, [applyAcceptedDelivery, attachmentTitle, billingLifecycle, body, businessBrandAssets, clients, documentLabel, emailAccess.allowed, emailAccess.reason, finishAttemptReconciliation, forwardingUnavailable, hostedSendUnavailable, hostedServiceSessionId, forwardToSelf, fromName, invoice, isQuoteSend, onClose, reconcilePendingAttempt, replyTo, sendType, senderForwardAddress, showSuccess, showWarning, subject, to]);

    const handleClose = useCallback(() => {
        modalIsOpenRef.current = false;
        recoveryGenerationRef.current += 1;
        checkingAttemptRef.current = null;
        setError(null);
        setPendingMessage(null);
        setPendingAttemptId(null);
        setDeliveryProtection(null);
        setAutomaticChecksStopped(false);
        automaticCheckCountRef.current = 0;
        primaryApplicationRef.current = null;
        setSending(false);
        if (statusTimerRef.current !== null) {
            window.clearTimeout(statusTimerRef.current);
            statusTimerRef.current = null;
        }
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
            <div className="flex flex-col gap-1">
                <CustomCheckbox
                    checked={forwardToSelf}
                    onChange={setForwardToSelf}
                    disabled={sending || Boolean(pendingAttemptId) || forwardingUnavailable}
                    label="Forward this email to me"
                    labelClassName="block text-sm text-foreground"
                />
                {emailUsageRemaining !== null && (
                    <p className="text-xs text-muted-foreground">
                        {emailUsageRemaining} hosted email {emailUsageRemaining === 1 ? 'send' : 'sends'} remaining
                        {emailUsageReset ? ` · resets ${emailUsageReset} (UTC)` : ''}.
                    </p>
                )}
                {forwardingUnavailable && emailUsageRemaining === 1 && (
                    <p className="text-xs text-muted-foreground">
                        Forwarding a copy requires two available sends.
                    </p>
                )}
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
                    pendingAttemptId ? (
                        automaticChecksStopped ? (
                            <Button disabled variant="secondary">
                                {deliveryProtection === 'confirmed' || deliveryProtection === 'protected'
                                    ? 'Delivery protected'
                                    : 'Delivery pending'}
                            </Button>
                        ) : (
                            <Button loading loadingText="Confirming delivery">
                                Confirming delivery
                            </Button>
                        )
                    ) : (
                        <Button
                            onClick={handleSend}
                            disabled={sending || !to || !emailAccess.allowed || hostedSendUnavailable}
                            loading={sending}
                            loadingText="Sending..."
                            leadingIcon={Send}
                        >
                            {isQuoteSend ? 'Send Quote' : (sendType === 'reminder' ? 'Send Reminder' : 'Send Invoice')}
                        </Button>
                    )
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

                {pendingAttemptId && pendingMessage && (
                    <Notice title={automaticChecksStopped
                        ? (deliveryProtection === 'confirmed'
                            ? 'Delivery confirmed'
                            : deliveryProtection === 'protected'
                                ? 'Delivery protected'
                                : 'Delivery pending')
                        : 'Confirming delivery'}>
                        {pendingMessage}
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
                allowedTypes={[templateType]}
                initialType={templateType}
            />
        </>
    );
};

export default EmailPreviewModal;
