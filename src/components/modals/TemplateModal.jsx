import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { PlusIcon } from '@/components/ui/icons';
import { useToast } from '../../hooks/useToast.ts';
import { useInvoiceTemplates } from '../../hooks/useInvoiceTemplates.ts';
import { toDisplayDate } from '../../utils/dateUtils.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomCheckbox from '../CustomCheckbox';
import { parseIntegerInputWithFallback } from '@/utils/numberInputUtils.ts';

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
    
    const [formData, setFormData] = useState({
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
        isDefault: false
    });

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
        if (editingTemplate) {
            setFormData({ ...editingTemplate });
        } else {
            setFormData({
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
                isDefault: false
            });
        }
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
                return `Due date: ${toDisplayDate(daysDate)} (${days} ${days === 1 ? 'day' : 'days'} from invoice date)`;
            }
            
            case 'fixed-weeks': {
                if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                    return 'Due date: Not specified';
                }
                const weeks = parseIntegerInputWithFallback(template.dueDateWeeks, 0, { min: 0 });
                const weeksDate = new Date(today);
                weeksDate.setDate(weeksDate.getDate() + (weeks * 7));
                return `Due date: ${toDisplayDate(weeksDate)} (${weeks} ${weeks === 1 ? 'week' : 'weeks'} from invoice date)`;
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
                return `Due date: ${toDisplayDate(defaultDate)} (${template.dueDateDays || 30} days from invoice date)`;
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

        if (editingTemplate) {
            // Update existing template
            updateInvoiceTemplate(editingTemplate.id, {
                ...formData,
                name: formData.name.trim(),
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
                ...formData,
                name: formData.name.trim(),
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

    // Modal footer with action buttons
    const modalFooter = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            {/* Default Checkbox */}
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
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingTemplate ? 'Edit Invoice Template' : 'Create Invoice Template'}
            size="3xl"
            footer={modalFooter}
        >
            <form id="template-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
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
                </div>

                {/* Invoice Number Configuration */}
                <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-foreground mb-4">Invoice Number Configuration</h3>
                    
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

                        <div className="bg-muted p-4 rounded-md">
                            <h4 className="text-sm font-medium text-foreground mb-2">Available Variables:</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {formatVariables.map((variable) => (
                                    <div key={variable.key} className="flex items-center">
                                        <code className="bg-background px-1 rounded text-xs font-mono mr-2 border">
                                            {variable.key}
                                        </code>
                                        <span className="text-muted-foreground">{variable.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

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
                </div>

                {/* Due Date Configuration */}
                <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-foreground mb-4">Due Date Configuration</h3>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
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

                        {/* Days input - only show for fixed-days type */}
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

                        {/* Weeks input - only show for fixed-weeks type */}
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

                        {/* Date picker - only show for precise-date type */}
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

                        {/* Preview - show for all types */}
                        <div className="bg-muted border border-border rounded-md p-3">
                            <p className="text-sm text-foreground">
                                <strong>Preview:</strong> {formPreviewDueDate}
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default TemplateModal;
