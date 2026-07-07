import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { EyeIcon } from '@/components/ui/icons';
import { useToast } from '../../hooks/useToast.ts';
import { useBusinessBrandAssets } from '../../hooks/useBusinessBrandAssets.ts';
import { useBusinessInfos } from '../../hooks/useBusinessInfos.ts';
import { useInvoiceTemplates } from '../../hooks/useInvoiceTemplates.ts';
import { usePreferences } from '../../hooks/usePreferences.ts';
import { toDisplayDate } from '../../utils/dateUtils.ts';
import {
    DEFAULT_INVOICE_LAYOUT_STYLE,
    DEFAULT_INVOICE_LOGO_PLACEMENT,
    normalizeInvoiceLayoutStyle,
    normalizeInvoiceLogoPlacement,
} from '../../utils/invoiceBranding.ts';
import { generatePDF, getCurrentInvoiceHtmlContent } from '../../utils/pdfUtils.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateVariablesPanel } from '@/components/ui/template-variables-panel';
import InvoicePreviewModal from '../invoice/InvoicePreviewModal';
import CustomCheckbox from '../CustomCheckbox';
import { parseIntegerInputWithFallback } from '@/utils/numberInputUtils.ts';
import { getBillingPeriodRange } from '@/utils/billingPeriodUtils.ts';

const createDefaultFormData = () => ({
    name: '',
    invoiceNumberFormat: 'INV-{projectId}-{timestamp}',
    invoiceNumberPrefix: 'INV',
    invoiceNumberSuffix: '',
    useSequentialNumbers: false,
    sequentialNumberStart: 1,
    sequentialNumberDigits: 4,
    sequentialResetYearly: false,
    dueDateDays: 30,
    dueDateType: 'fixed-days',
    dueDateWeeks: 1,
    dueDatePrecise: '',
    isDefault: false,
    layoutStyle: 'neutral',
    logoPlacement: DEFAULT_INVOICE_LOGO_PLACEMENT,
    showBusinessLogo: true,
    useBusinessPrimaryColor: true,
    showBillingPeriod: true,
    showProjectTitle: true,
});

const createInitialFormData = (template) => {
    if (!template) {
        return createDefaultFormData();
    }

    return {
        ...createDefaultFormData(),
        ...template,
        layoutStyle: normalizeInvoiceLayoutStyle(template.layoutStyle || DEFAULT_INVOICE_LAYOUT_STYLE),
        logoPlacement: normalizeInvoiceLogoPlacement(template.logoPlacement || DEFAULT_INVOICE_LOGO_PLACEMENT),
        showBusinessLogo: template.brandingOptions?.showBusinessLogo ?? true,
        useBusinessPrimaryColor: template.brandingOptions?.useBusinessPrimaryColor ?? true,
        showBillingPeriod: template.showBillingPeriod ?? true,
        showProjectTitle: template.showProjectTitle ?? true,
    };
};

/**
 * TemplateModal - Modal for creating and editing invoice templates
 */
const TemplateModal = ({
    isOpen,
    onClose,
    editingTemplate = null
}) => {
    const { showSuccess, showError } = useToast();
    const { invoiceTemplates, createInvoiceTemplate, updateInvoiceTemplate, setDefault } = useInvoiceTemplates();
    const { defaultBusinessInfo } = useBusinessInfos();
    const { businessBrandAssets, getBusinessBrandAsset } = useBusinessBrandAssets();
    const { preferences } = usePreferences();
    
    const [formData, setFormData] = useState(createDefaultFormData);
    const [showPreview, setShowPreview] = useState(false);

    // Available format variables for invoice numbers
    const formatVariables = [
        { key: '{projectId}', description: 'Project ID (last 8 characters)' },
        { key: '{timestamp}', description: 'Current timestamp' },
        { key: '{date}', description: 'Current date (YYYYMMDD)' },
        { key: '{year}', description: 'Current year (YYYY)' },
        { key: '{month}', description: 'Current month (MM)' },
        { key: '{day}', description: 'Current day (DD)' },
        { key: '{sequential}', description: 'Sequential number (requires sequential numbering enabled)' }
    ];

    // Initialize form data when editing
    useEffect(() => {
        setFormData(createInitialFormData(editingTemplate));
    }, [editingTemplate, isOpen]);

    // Generate a static timestamp for previews
    const staticTimestamp = useMemo(() => Date.now().toString(), []);
    const staticDate = useMemo(() => new Date(), []);

    // Generate preview invoice number
    const generatePreviewInvoiceNumber = useMemo(() => (template) => {
        const projectId = "ABC12345";
        const timestamp = staticTimestamp;
        const date = staticDate.toISOString().slice(0, 10).replace(/-/g, '');
        const year = staticDate.getFullYear().toString();
        const month = (staticDate.getMonth() + 1).toString().padStart(2, '0');
        const day = staticDate.getDate().toString().padStart(2, '0');
        const sequential = (template.currentSequentialNumber || template.sequentialNumberStart || 1)
            .toString().padStart(template.sequentialNumberDigits || 4, '0');

        let format = template.invoiceNumberFormat || 'INV-{projectId}-{timestamp}';
        
        format = format.replace(/\{projectId\}/g, projectId.slice(-8));
        format = format.replace(/\{timestamp\}/g, timestamp);
        format = format.replace(/\{date\}/g, date);
        format = format.replace(/\{year\}/g, year);
        format = format.replace(/\{month\}/g, month);
        format = format.replace(/\{day\}/g, day);
        format = format.replace(/\{sequential\}/g, sequential);

        return format;
    }, [staticTimestamp, staticDate]);

    // Calculate due date preview
    const calculateDueDatePreview = useMemo(() => (template) => {
        const today = staticDate;
        
        switch (template.dueDateType) {
            case 'fixed-days': {
                if (!template.dueDateDays || template.dueDateDays === 0) {
                    return 'Due date: Not specified';
                }
                const days = parseIntegerInputWithFallback(template.dueDateDays, 0, { min: 0 });
                const daysDate = new Date(today);
                daysDate.setDate(daysDate.getDate() + days);
                return `Due date: ${toDisplayDate(daysDate)}`;
            }
            
            case 'fixed-weeks': {
                if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                    return 'Due date: Not specified';
                }
                const weeks = parseIntegerInputWithFallback(template.dueDateWeeks, 0, { min: 0 });
                const weeksDate = new Date(today);
                weeksDate.setDate(weeksDate.getDate() + (weeks * 7));
                return `Due date: ${toDisplayDate(weeksDate)}`;
            }
            
            case 'precise-date': {
                if (!template.dueDatePrecise) {
                    return 'Due date: Not specified';
                }
                return `Due date: ${toDisplayDate(template.dueDatePrecise)}`;
            }
            
            case 'none': {
                return 'Due date will not be shown';
            }
            
            default: {
                const defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + (template.dueDateDays || 30));
                return `Due date: ${toDisplayDate(defaultDate)}`;
            }
        }
    }, [staticDate]);

    // Memoized previews for form data
    const formPreviewInvoiceNumber = useMemo(() => {
        return generatePreviewInvoiceNumber(formData);
    }, [formData, generatePreviewInvoiceNumber]);

    const formPreviewDueDate = useMemo(() => {
        return calculateDueDatePreview(formData);
    }, [formData, calculateDueDatePreview]);

    const previewInvoice = useMemo(() => {
        const logoAsset = defaultBusinessInfo?.branding?.logoAssetId
            ? getBusinessBrandAsset(defaultBusinessInfo.branding.logoAssetId)
            : null;
        const sampleBillingPeriod = getBillingPeriodRange({
            preset: 'month',
            today: staticDate,
        });

        return {
            id: `template-preview-${editingTemplate?.id || 'draft'}`,
            invoiceNumber: formPreviewInvoiceNumber,
            client: {
                name: 'Sample Client Ltd',
                address: '42 Sample Street',
                city: 'London',
                state: '',
                zip: 'SW1A 1AA',
                country: 'United Kingdom',
            },
            project: {
                title: 'Website redesign',
                hourlyRate: 95,
            },
            tasks: [{
                id: 'template-preview-task',
                title: 'Design and implementation',
                hours: 12,
                hourlyRate: 95,
                useFlatRate: false,
            }],
            additionalTasks: [{
                id: 'template-preview-extra',
                title: 'Project setup',
                flatRate: 180,
                quantity: 1,
                useFlatRate: true,
            }],
            expenseItems: [],
            note: formData.defaultNotes || '',
            totalHours: 12,
            subtotal: 1320,
            total: 1320,
            discount: 0,
            shipping: 0,
            tax: 0,
            taxRate: 0,
            taxLabel: 'Tax',
            paymentMethod: {
                fullName: 'Owen Farrugia',
                bank: 'TaskTime Pro Bank',
                iban: 'GB29NWBK60161331926819',
                swift: 'TTIMEGB2L',
                custom: [{ label: 'Reference', value: 'Use invoice number as payment reference' }],
            },
            businessInfo: defaultBusinessInfo || null,
            businessInfoId: defaultBusinessInfo?.id || null,
            template: {
                ...formData,
                id: editingTemplate?.id || 'template-preview',
                brandingOptions: {
                    showBusinessLogo: formData.showBusinessLogo,
                    useBusinessPrimaryColor: formData.useBusinessPrimaryColor,
                },
            },
            templateId: editingTemplate?.id || null,
            brandingSnapshot: {
                businessInfoId: defaultBusinessInfo?.id || null,
                templateId: editingTemplate?.id || null,
                layoutStyle: normalizeInvoiceLayoutStyle(formData.layoutStyle || DEFAULT_INVOICE_LAYOUT_STYLE),
                logoPlacement: normalizeInvoiceLogoPlacement(formData.logoPlacement || DEFAULT_INVOICE_LOGO_PLACEMENT),
                showBusinessLogo: formData.showBusinessLogo ?? true,
                useBusinessPrimaryColor: formData.useBusinessPrimaryColor ?? true,
                primaryColor: defaultBusinessInfo?.branding?.primaryColor || null,
                logoAssetId: logoAsset?.id || null,
                logoAssetMeta: logoAsset ? {
                    mimeType: logoAsset.mimeType,
                    width: logoAsset.width,
                    height: logoAsset.height,
                    byteSize: logoAsset.byteSize,
                    contentHash: logoAsset.contentHash,
                } : null,
            },
            date: toDisplayDate(staticDate),
            dueDate: formPreviewDueDate.startsWith('Due date: ') ? formPreviewDueDate.slice('Due date: '.length) : null,
            billingPeriodPreset: 'month',
            billingPeriodStart: sampleBillingPeriod.startDate,
            billingPeriodEnd: sampleBillingPeriod.endDate,
            currency: preferences.currency,
            htmlContent: null,
        };
    }, [defaultBusinessInfo, editingTemplate?.id, formData, formPreviewDueDate, formPreviewInvoiceNumber, getBusinessBrandAsset, preferences.currency, staticDate]);

    const previewHtmlContent = useMemo(() => {
        return getCurrentInvoiceHtmlContent(previewInvoice, [], businessBrandAssets);
    }, [businessBrandAssets, previewInvoice]);

    const handleDownloadSample = async () => {
        try {
            const templateSlug = (formData.name || 'untitled-template')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'untitled-template';

            await generatePDF(previewHtmlContent, `${templateSlug}-sample.pdf`);
        } catch {
            showError('Failed to download sample PDF');
        }
    };

    /**
     * Handle form submission
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            showError('Template name is required');
            return;
        }

        if (!formData.invoiceNumberFormat.trim()) {
            showError('Invoice number format is required');
            return;
        }

        if (formData.useSequentialNumbers && formData.sequentialNumberStart < 1) {
            showError('Sequential number start must be at least 1');
            return;
        }

        if (formData.dueDateDays < 0) {
            showError('Due date days cannot be negative');
            return;
        }

        // Check for duplicate names (excluding current template if editing)
        const existingTemplate = invoiceTemplates.find(t => 
            t.name.toLowerCase() === formData.name.toLowerCase() && 
            (!editingTemplate || t.id !== editingTemplate.id)
        );
        
        if (existingTemplate) {
            showError('A template with this name already exists');
            return;
        }

        const {
            showBusinessLogo,
            useBusinessPrimaryColor,
            ...templatePayload
        } = formData;

        if (editingTemplate) {
            // Update existing template
            updateInvoiceTemplate(editingTemplate.id, {
                ...templatePayload,
                name: templatePayload.name.trim(),
                brandingOptions: {
                    showBusinessLogo,
                    useBusinessPrimaryColor,
                },
                currentSequentialNumber: editingTemplate.currentSequentialNumber || formData.sequentialNumberStart,
                lastSequentialYear: editingTemplate.lastSequentialYear || null
            });

            // If this template is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(editingTemplate.id);
            }

            showSuccess('Template updated successfully!');
        } else {
            // Add new template
            const newTemplate = createInvoiceTemplate({
                id: `template-${Date.now()}`,
                ...templatePayload,
                name: templatePayload.name.trim(),
                brandingOptions: {
                    showBusinessLogo,
                    useBusinessPrimaryColor,
                },
                currentSequentialNumber: formData.sequentialNumberStart,
                lastSequentialYear: null
            });

            // If this template is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(newTemplate.id);
            }

            showSuccess('Template created successfully!');
        }

        onClose();
    };

    /**
     * Handle cancel
     */
    const handleCancel = () => {
        onClose();
    };

    const handlePreview = () => {
        setShowPreview(true);
    };

    // Modal footer with action buttons
    const modalFooter = (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                aria-label="Preview invoice"
                className="gap-0 self-start px-2.5 sm:gap-2 sm:px-4"
                leadingIcon={EyeIcon}
            >
                <span className="hidden sm:inline">Preview</span>
            </Button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                <div className="flex items-center">
                    <CustomCheckbox
                        checked={formData.isDefault}
                        onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                        label="Set as default template"
                        labelClassName="block text-sm text-foreground"
                    />
                </div>

                <div className="flex flex-row flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="template-form"
                    >
                        {editingTemplate ? 'Update Template' : 'Create Template'}
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingTemplate ? 'Edit Invoice Template' : 'New Invoice Template'}
            size="3xl"
            footer={modalFooter}
        >
            <form id="template-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label>
                        Template Name <span className="text-destructive-strong">*</span>
                    </Label>
                    <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Standard Invoice, Project Invoice"
                        required
            />
        </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>
                            Layout Style
                        </Label>
                        <Select
                            value={formData.layoutStyle}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, layoutStyle: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="neutral">Minimal</SelectItem>
                                <SelectItem value="classic">Classic</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>
                            Header Alignment
                        </Label>
                        <Select
                            value={formData.logoPlacement}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, logoPlacement: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice-left-logo-right">Invoice Left, Logo Right</SelectItem>
                                <SelectItem value="invoice-center-logo-center">Invoice & Logo Center</SelectItem>
                                <SelectItem value="invoice-right-logo-left">Invoice Right, Logo Left</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>
                            Invoice Number Format <span className="text-destructive-strong">*</span>
                        </Label>
                        <Input
                            type="text"
                            value={formData.invoiceNumberFormat}
                            onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumberFormat: e.target.value }))}
                            placeholder="e.g., INV-{projectId}-{timestamp}"
                            required
                        />
                        <p className="text-sm text-muted-foreground">
                            Preview: <strong>{formPreviewInvoiceNumber}</strong>
                        </p>
                    </div>

                    <TemplateVariablesPanel
                        title="Available Variables"
                        description="Tap or click a variable to copy it. These placeholders are replaced when an invoice number is generated."
                        variables={formatVariables}
                    />

                    <div className="flex items-center">
                        <CustomCheckbox
                            checked={formData.useSequentialNumbers}
                            onChange={(checked) => setFormData(prev => ({ ...prev, useSequentialNumbers: checked }))}
                            label="Use sequential numbering"
                            labelClassName="block text-sm text-foreground"
                        />
                        <span className="ml-2 text-xs text-muted-foreground">
                            (Enables {'{sequential}'} variable)
                        </span>
                    </div>

                    {formData.useSequentialNumbers && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>
                                    Starting Number
                                </Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.sequentialNumberStart}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sequentialNumberStart: parseIntegerInputWithFallback(e.target.value, 1, { min: 1 }) }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Number of Digits
                                </Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={formData.sequentialNumberDigits}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sequentialNumberDigits: parseIntegerInputWithFallback(e.target.value, 4, { min: 1, max: 10 }) }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Preview: {(formData.sequentialNumberStart).toString().padStart(formData.sequentialNumberDigits || 4, '0')}
                                </p>
                            </div>
                        </div>
                    )}

                    {formData.useSequentialNumbers && (
                        <div className="flex items-center">
                            <CustomCheckbox
                                checked={formData.sequentialResetYearly}
                                onChange={(checked) => setFormData(prev => ({ ...prev, sequentialResetYearly: checked }))}
                                label="Reset sequential number yearly"
                                labelClassName="block text-sm text-foreground"
                            />
                            <span className="ml-2 text-xs text-muted-foreground">
                                (Restarts at starting number each new year)
                            </span>
                        </div>
                    )}

                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    <h4 className="text-sm font-medium text-foreground">Invoice Content</h4>
                    <div className="flex items-center">
                        <CustomCheckbox
                            checked={formData.showBillingPeriod}
                            onChange={(checked) => setFormData(prev => ({ ...prev, showBillingPeriod: checked }))}
                            label="Show billing period"
                            labelClassName="block text-sm text-foreground"
                        />
                    </div>
                    <div className="flex items-center">
                        <CustomCheckbox
                            checked={formData.showProjectTitle}
                            onChange={(checked) => setFormData(prev => ({ ...prev, showProjectTitle: checked }))}
                            label="Show project title"
                            labelClassName="block text-sm text-foreground"
                        />
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label>
                            Due Date Type
                        </Label>
                        <Select
                            value={formData.dueDateType}
                            onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                dueDateType: value,
                                // Reset related fields when type changes
                                dueDateDays: value === 'fixed-days' ? prev.dueDateDays : 0,
                                dueDateWeeks: value === 'fixed-weeks' ? prev.dueDateWeeks || 1 : 0,
                                dueDatePrecise: value === 'precise-date' ? prev.dueDatePrecise || '' : ''
                            }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select due date type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed-days">Fixed days from invoice date</SelectItem>
                                <SelectItem value="fixed-weeks">Fixed weeks from invoice date</SelectItem>
                                <SelectItem value="precise-date">Precise date</SelectItem>
                                <SelectItem value="none">Don't show due date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.dueDateType === 'fixed-days' && (
                        <div className="space-y-2">
                            <Label>
                                Days Until Due
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={formData.dueDateDays}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDateDays: parseIntegerInputWithFallback(e.target.value, 0, { min: 0 }) }))}
                                className="w-24"
                            />
                        </div>
                    )}

                    {formData.dueDateType === 'fixed-weeks' && (
                        <div className="space-y-2">
                            <Label>
                                Weeks Until Due
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.dueDateWeeks || 1}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDateWeeks: parseIntegerInputWithFallback(e.target.value, 1, { min: 1 }) }))}
                                className="w-24"
                            />
                        </div>
                    )}

                    {formData.dueDateType === 'precise-date' && (
                        <div className="space-y-2">
                            <Label>
                                Due Date
                            </Label>
                            <NativeDateInput
                                value={formData.dueDatePrecise || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDatePrecise: e.target.value }))}
                                className="w-48"
                            />
                        </div>
                    )}

                    <div className="bg-muted border border-border rounded-md p-3">
                        <p className="text-sm text-foreground">
                            <strong>Preview:</strong> {formPreviewDueDate}
                        </p>
                    </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    <h4 className="text-sm font-medium text-foreground">Branding Display</h4>
                    <div className="flex items-center">
                        <CustomCheckbox
                            checked={formData.showBusinessLogo}
                            onChange={(checked) => setFormData(prev => ({ ...prev, showBusinessLogo: checked }))}
                            label="Show business logo"
                            labelClassName="block text-sm text-foreground"
                        />
                    </div>
                    <div className="flex items-center">
                        <CustomCheckbox
                            checked={formData.useBusinessPrimaryColor}
                            onChange={(checked) => setFormData(prev => ({ ...prev, useBusinessPrimaryColor: checked }))}
                            label="Use business primary color"
                            labelClassName="block text-sm text-foreground"
                        />
                    </div>
                </div>
            </form>

            <InvoicePreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                title={`Template Preview - ${formData.name || 'Untitled Template'}`}
                invoice={previewInvoice}
                htmlContent={previewHtmlContent}
                onDownload={handleDownloadSample}
                downloadLabel="Download Sample PDF"
            />
        </Modal>
    );
};

export default TemplateModal;
