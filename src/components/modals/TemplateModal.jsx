import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../hooks/useToast';
import CustomCheckbox from '../CustomCheckbox';

/**
 * TemplateModal - Modal for creating and editing invoice templates
 */
const TemplateModal = ({
    isOpen,
    onClose,
    invoiceTemplates,
    setInvoiceTemplates,
    editingTemplate = null
}) => {
    const { showSuccess, showError } = useToast();
    
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
                const days = parseInt(template.dueDateDays) || 0;
                const daysDate = new Date(today);
                daysDate.setDate(daysDate.getDate() + days);
                return `Due date: ${daysDate.toLocaleDateString()} (${days} ${days === 1 ? 'day' : 'days'} from invoice date)`;
            }
            
            case 'fixed-weeks': {
                if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                    return 'Due date: Not specified';
                }
                const weeks = parseInt(template.dueDateWeeks) || 0;
                const weeksDate = new Date(today);
                weeksDate.setDate(weeksDate.getDate() + (weeks * 7));
                return `Due date: ${weeksDate.toLocaleDateString()} (${weeks} ${weeks === 1 ? 'week' : 'weeks'} from invoice date)`;
            }
            
            case 'precise-date': {
                if (!template.dueDatePrecise) {
                    return 'Due date: Not specified';
                }
                return `Due date: ${new Date(template.dueDatePrecise).toLocaleDateString()}`;
            }
            
            case 'none': {
                return 'Due date will not be shown';
            }
            
            default: {
                const defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + (template.dueDateDays || 30));
                return `Due date: ${defaultDate.toLocaleDateString()} (${template.dueDateDays || 30} days from invoice date)`;
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

        const templateData = {
            ...formData,
            id: editingTemplate ? editingTemplate.id : `template-${Date.now()}`,
            createdAt: editingTemplate ? editingTemplate.createdAt : Date.now(),
            updatedAt: Date.now(),
            name: formData.name.trim(),
            currentSequentialNumber: editingTemplate ? editingTemplate.currentSequentialNumber : formData.sequentialNumberStart,
            lastSequentialYear: editingTemplate ? editingTemplate.lastSequentialYear : null
        };

        let updatedTemplates;
        if (editingTemplate) {
            // Update existing template
            updatedTemplates = invoiceTemplates.map(t => 
                t.id === editingTemplate.id ? templateData : t
            );
        } else {
            // Add new template
            updatedTemplates = [...invoiceTemplates, templateData];
        }

        // If this template is set as default, remove default from others
        if (formData.isDefault) {
            updatedTemplates = updatedTemplates.map(t => ({
                ...t,
                isDefault: t.id === templateData.id
            }));
        }

        setInvoiceTemplates(updatedTemplates);
        showSuccess(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!');
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
        <div className="flex items-center space-x-4 justify-end">
            {/* Default Checkbox */}
            <div className="flex items-center">
                <CustomCheckbox
                    checked={formData.isDefault}
                    onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                    label="Set as default template"
                    labelClassName="block text-sm text-gray-900"
                />
            </div>

            <div className="flex space-x-3">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="template-form"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Template Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                            placeholder="e.g., Standard Invoice, Project Invoice"
                            required
                        />
                    </div>
                </div>

                {/* Invoice Number Configuration */}
                <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Invoice Number Configuration</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Invoice Number Format <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.invoiceNumberFormat}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumberFormat: e.target.value }))}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                placeholder="e.g., INV-{projectId}-{timestamp}"
                                required
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Preview: <strong>{formPreviewInvoiceNumber}</strong>
                            </p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-md">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Available Variables:</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {formatVariables.map((variable) => (
                                    <div key={variable.key} className="flex items-center">
                                        <code className="bg-gray-200 px-1 rounded text-xs font-mono mr-2">
                                            {variable.key}
                                        </code>
                                        <span className="text-gray-600">{variable.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center">
                            <CustomCheckbox
                                checked={formData.useSequentialNumbers}
                                onChange={(checked) => setFormData(prev => ({ ...prev, useSequentialNumbers: checked }))}
                                label="Use sequential numbering"
                                labelClassName="block text-sm text-gray-900"
                            />
                            <span className="ml-2 text-xs text-gray-500">
                                (Enables {'{sequential}'} variable)
                            </span>
                        </div>

                        {formData.useSequentialNumbers && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Starting Number
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.sequentialNumberStart}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sequentialNumberStart: parseInt(e.target.value) || 1 }))}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Number of Digits
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.sequentialNumberDigits}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sequentialNumberDigits: parseInt(e.target.value) || 4 }))}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
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
                                    labelClassName="block text-sm text-gray-900"
                                />
                                <span className="ml-2 text-xs text-gray-500">
                                    (Restarts at starting number each new year)
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Due Date Configuration */}
                <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Due Date Configuration</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Due Date Type
                            </label>
                            <select
                                value={formData.dueDateType}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    dueDateType: e.target.value,
                                    // Reset related fields when type changes
                                    dueDateDays: e.target.value === 'fixed-days' ? prev.dueDateDays : 0,
                                    dueDateWeeks: e.target.value === 'fixed-weeks' ? prev.dueDateWeeks || 1 : 0,
                                    dueDatePrecise: e.target.value === 'precise-date' ? prev.dueDatePrecise || '' : ''
                                }))}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                            >
                                <option value="fixed-days">Fixed days from invoice date</option>
                                <option value="fixed-weeks">Fixed weeks from invoice date</option>
                                <option value="precise-date">Precise date</option>
                                <option value="none">Don't show due date</option>
                            </select>
                        </div>

                        {/* Days input - only show for fixed-days type */}
                        {formData.dueDateType === 'fixed-days' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Days Until Due
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.dueDateDays}
                                    onChange={(e) => setFormData(prev => ({ ...prev, dueDateDays: parseInt(e.target.value) || 0 }))}
                                    className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                />
                            </div>
                        )}

                        {/* Weeks input - only show for fixed-weeks type */}
                        {formData.dueDateType === 'fixed-weeks' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Weeks Until Due
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.dueDateWeeks || 1}
                                    onChange={(e) => setFormData(prev => ({ ...prev, dueDateWeeks: parseInt(e.target.value) || 1 }))}
                                    className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                />
                            </div>
                        )}

                        {/* Date picker - only show for precise-date type */}
                        {formData.dueDateType === 'precise-date' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Due Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.dueDatePrecise || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, dueDatePrecise: e.target.value }))}
                                    className="mt-1 block w-48 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                />
                            </div>
                        )}

                        {/* Preview - show for all types */}
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
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
