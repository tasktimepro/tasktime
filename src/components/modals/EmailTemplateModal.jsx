import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal';
import { useToast } from '../../hooks/useToast.ts';
import { useEmailTemplates } from '../../hooks/useEmailTemplates.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateVariablesPanel } from '@/components/ui/template-variables-panel';
import { Textarea } from '@/components/ui/textarea';
import CustomCheckbox from '../CustomCheckbox';
import {
    DEFAULT_SUBJECT,
    DEFAULT_SEND_BODY,
    DEFAULT_REMINDER_BODY,
    DEFAULT_QUOTE_SUBJECT,
    DEFAULT_QUOTE_BODY,
    DEFAULT_ATTACHMENT_TITLE,
    DEFAULT_QUOTE_ATTACHMENT_TITLE,
    EMAIL_PLACEHOLDER_VARIABLES,
    normalizeAttachmentTitle,
} from '../../utils/emailTemplateUtils.ts';

/**
 * EmailTemplateModal — create / edit an email template.
 * Mirrors the TemplateModal pattern: form with Available Variables panel,
 * "Set as default" checkbox in the footer.
 */
const EmailTemplateModal = ({
    isOpen,
    onClose,
    editingTemplate = null,
    onSaved = null,
    allowedTypes = ['invoice', 'quote'],
    initialType = 'invoice',
}) => {
    const { showSuccess, showError } = useToast();
    const { createEmailTemplate, updateEmailTemplate, setDefault } = useEmailTemplates();

    const [formData, setFormData] = useState({
        name: '',
        type: initialType,
        fromName: '',
        replyTo: '',
        subject: initialType === 'quote' ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT,
        sendBody: initialType === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_SEND_BODY,
        reminderBody: initialType === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_REMINDER_BODY,
        attachmentTitle: initialType === 'quote' ? DEFAULT_QUOTE_ATTACHMENT_TITLE : DEFAULT_ATTACHMENT_TITLE,
        isDefault: false,
    });

    // Populate form when editing
    useEffect(() => {
        if (editingTemplate) {
            setFormData({
                name: editingTemplate.name || '',
                type: editingTemplate.type || initialType,
                fromName: editingTemplate.fromName || '',
                replyTo: editingTemplate.replyTo || '',
                subject: editingTemplate.subject || (editingTemplate.type === 'quote' ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT),
                sendBody: editingTemplate.sendBody || (editingTemplate.type === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_SEND_BODY),
                reminderBody: editingTemplate.reminderBody || (editingTemplate.type === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_REMINDER_BODY),
                attachmentTitle: normalizeAttachmentTitle(editingTemplate.attachmentTitle || (editingTemplate.type === 'quote' ? DEFAULT_QUOTE_ATTACHMENT_TITLE : DEFAULT_ATTACHMENT_TITLE)),
                isDefault: editingTemplate.isDefault || false,
            });
        } else {
            setFormData({
                name: '',
                type: initialType,
                fromName: '',
                replyTo: '',
                subject: initialType === 'quote' ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT,
                sendBody: initialType === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_SEND_BODY,
                reminderBody: initialType === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_REMINDER_BODY,
                attachmentTitle: normalizeAttachmentTitle(initialType === 'quote' ? DEFAULT_QUOTE_ATTACHMENT_TITLE : DEFAULT_ATTACHMENT_TITLE),
                isDefault: false,
            });
        }
    }, [editingTemplate, initialType, isOpen]);

    const handleTypeChange = useCallback((value) => {
        setFormData((prev) => ({
            ...prev,
            type: value,
            subject: value === 'quote' ? DEFAULT_QUOTE_SUBJECT : DEFAULT_SUBJECT,
            sendBody: value === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_SEND_BODY,
            reminderBody: value === 'quote' ? DEFAULT_QUOTE_BODY : DEFAULT_REMINDER_BODY,
            attachmentTitle: normalizeAttachmentTitle(value === 'quote' ? DEFAULT_QUOTE_ATTACHMENT_TITLE : DEFAULT_ATTACHMENT_TITLE),
        }));
    }, []);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();

        const trimmedName = formData.name.trim();
        const normalizedAttachmentTitle = normalizeAttachmentTitle(formData.attachmentTitle.trim());

        if (!trimmedName) {
            showError('Template name is required');
            return;
        }

        if (!formData.subject.trim()) {
            showError('Subject is required');
            return;
        }

        const now = Date.now();
        let savedTemplate = null;

        if (editingTemplate) {
            savedTemplate = {
                ...editingTemplate,
                name: trimmedName,
                type: formData.type,
                fromName: formData.fromName.trim(),
                replyTo: formData.replyTo.trim(),
                subject: formData.subject,
                sendBody: formData.sendBody,
                reminderBody: formData.reminderBody,
                attachmentTitle: normalizedAttachmentTitle,
                isDefault: formData.isDefault,
                updatedAt: now,
            };

            updateEmailTemplate(editingTemplate.id, {
                name: trimmedName,
                type: formData.type,
                fromName: formData.fromName.trim(),
                replyTo: formData.replyTo.trim(),
                subject: formData.subject,
                sendBody: formData.sendBody,
                reminderBody: formData.reminderBody,
                attachmentTitle: normalizedAttachmentTitle,
                updatedAt: now,
            });

            if (formData.isDefault) {
                setDefault(editingTemplate.id);
            }

            showSuccess('Email template updated');
        } else {
            const created = createEmailTemplate({
                name: trimmedName,
                type: formData.type,
                fromName: formData.fromName.trim(),
                replyTo: formData.replyTo.trim(),
                subject: formData.subject,
                sendBody: formData.sendBody,
                reminderBody: formData.reminderBody,
                attachmentTitle: normalizedAttachmentTitle,
                isDefault: formData.isDefault,
                createdAt: now,
                updatedAt: now,
            });

            savedTemplate = created ? {
                ...created,
                name: trimmedName,
                type: formData.type,
                fromName: formData.fromName.trim(),
                replyTo: formData.replyTo.trim(),
                subject: formData.subject,
                sendBody: formData.sendBody,
                reminderBody: formData.reminderBody,
                attachmentTitle: normalizedAttachmentTitle,
                isDefault: formData.isDefault,
                createdAt: created.createdAt ?? now,
                updatedAt: now,
            } : null;

            if (formData.isDefault && created?.id) {
                setDefault(created.id);
            }

            showSuccess('Email template created');
        }

        onSaved?.(savedTemplate);

        onClose();
    }, [formData, editingTemplate, createEmailTemplate, updateEmailTemplate, setDefault, showSuccess, showError, onClose, onSaved]);

    const handleCancel = () => {
        onClose();
    };

    const modalFooter = (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <div className="flex items-center">
                <CustomCheckbox
                    checked={formData.isDefault}
                    onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                    label="Set as default template"
                    labelClassName="block text-sm text-foreground"
                />
            </div>

            <div className="flex flex-row flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button type="submit" form="email-template-form">
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCancel}
            title={editingTemplate ? 'Edit Email Template' : 'New Email Template'}
            size="3xl"
            footer={modalFooter}
        >
            <form id="email-template-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Template Name */}
                        <div className="space-y-2">
                            <Label htmlFor="email-tpl-name">
                                Template Name <span className="text-destructive-strong">*</span>
                            </Label>
                            <Input
                                id="email-tpl-name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Standard Invoice Email"
                                required
                            />
                        </div>

                        {/* Template Type */}
                        <div className="space-y-2">
                            <Label htmlFor="email-tpl-type">Template Type</Label>
                            <Select value={formData.type} onValueChange={handleTypeChange} disabled={Boolean(editingTemplate && !allowedTypes.includes(editingTemplate.type))}>
                                <SelectTrigger id="email-tpl-type">
                                    <SelectValue placeholder="Select template type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allowedTypes.includes('invoice') && <SelectItem value="invoice">Invoice</SelectItem>}
                                    {allowedTypes.includes('quote') && <SelectItem value="quote">Quote</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email-tpl-fromName">From Name</Label>
                            <Input
                                id="email-tpl-fromName"
                                value={formData.fromName}
                                onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
                                placeholder="e.g. Jane at Acme"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email-tpl-replyTo">Reply-To</Label>
                            <Input
                                id="email-tpl-replyTo"
                                type="email"
                                value={formData.replyTo}
                                onChange={(e) => setFormData(prev => ({ ...prev, replyTo: e.target.value }))}
                                placeholder="e.g. hello@yourbusiness.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Available Variables */}
                <TemplateVariablesPanel
                    title="Available Variables"
                    description="Tap or click a variable to copy it, then paste it into your subject or message."
                    variables={EMAIL_PLACEHOLDER_VARIABLES}
                />

                {/* Subject */}
                <div className="space-y-2">
                    <Label htmlFor="email-tpl-subject">Email Subject</Label>
                    <Input
                        id="email-tpl-subject"
                        value={formData.subject}
                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Invoice {invoiceNumber} from {businessName}"
                    />
                </div>

                {/* Invoice Send Body */}
                <div className="space-y-2">
                    <Label htmlFor="email-tpl-sendBody">{formData.type === 'quote' ? 'Quote Body' : 'Invoice Body'}</Label>
                    <Textarea
                        id="email-tpl-sendBody"
                        value={formData.sendBody}
                        onChange={(e) => setFormData(prev => ({ ...prev, sendBody: e.target.value }))}
                        rows={6}
                        className="font-mono text-sm resize-y"
                    />
                </div>

                {formData.type !== 'quote' && (
                    <div className="space-y-2">
                        <Label htmlFor="email-tpl-reminderBody">Reminder Body</Label>
                        <Textarea
                            id="email-tpl-reminderBody"
                            value={formData.reminderBody}
                            onChange={(e) => setFormData(prev => ({ ...prev, reminderBody: e.target.value }))}
                            rows={6}
                            className="font-mono text-sm resize-y"
                        />
                    </div>
                )}

                {/* Attachment Title */}
                <div className="space-y-2">
                    <Label htmlFor="email-tpl-attachmentTitle">Attachment Filename</Label>
                    <Input
                        id="email-tpl-attachmentTitle"
                        value={formData.attachmentTitle}
                        onChange={(e) => setFormData(prev => ({
                            ...prev,
                            attachmentTitle: normalizeAttachmentTitle(e.target.value),
                        }))}
                        placeholder="invoice-{invoiceNumber}"
                    />
                    <p className="text-xs text-muted-foreground">.pdf will be appended automatically</p>
                </div>
            </form>
        </Modal>
    );
};

export default EmailTemplateModal;
