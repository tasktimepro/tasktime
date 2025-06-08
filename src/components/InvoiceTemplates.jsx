import React, { useState, useMemo, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useToast } from '../hooks/useToast';
import CustomCheckbox from './CustomCheckbox';

/**
 * InvoiceTemplates component - Manages invoice templates with customizable formats
 */
const InvoiceTemplates = ({ 
    invoiceTemplates = [], 
    setInvoiceTemplates,
    autoOpenCreate = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(autoOpenCreate);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showDropdown, setShowDropdown] = useState({});
    const { showSuccess, showError } = useToast();

    // Add event listener for dropdown close behavior
    const DROPDOWN_TOGGLE_EVENT = 'closeOtherDropdowns';

    useEffect(() => {
        const handleCloseDropdowns = (event) => {
            const { templateId, open } = event.detail;
            
            if (open) {
                // Close all dropdowns except the one being opened
                setShowDropdown({ [templateId]: true });
            }
        };

        const handleClickOutside = (event) => {
            if (!event.target.closest('.dropdown-container')) {
                setShowDropdown({});
            }
        };

        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleCloseDropdowns);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleCloseDropdowns);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        invoiceNumberFormat: 'INV-{projectId}-{timestamp}',
        invoiceNumberPrefix: 'INV',
        invoiceNumberSuffix: '',
        useSequentialNumbers: false,
        sequentialNumberStart: 1,
        sequentialNumberDigits: 4,
        sequentialResetYearly: false,
        dueDateDays: 30,
        dueDateType: 'fixed-days', // New default type
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

    // Handle opening create form
    const handleOpenCreate = () => {
        setEditingTemplate(null);
        setFormData({
            name: '',
            description: '',
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
        setShowCreateForm(true);
    };

    // Handle opening edit form
    const handleEdit = (template) => {
        setEditingTemplate(template);
        setFormData({ ...template });
        setShowCreateForm(true);
    };

    // Handle form submission
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
        setShowCreateForm(false);
        setEditingTemplate(null);
        
        showSuccess(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!');
    };

    // Handle delete
    const handleDelete = (templateId) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            const updatedTemplates = invoiceTemplates.filter(t => t.id !== templateId);
            setInvoiceTemplates(updatedTemplates);
            showSuccess('Template deleted successfully!');
        }
    };

    // Generate preview invoice number
    const generatePreviewInvoiceNumber = (template) => {
        const now = new Date();
        const variables = {
            '{projectId}': 'ABCD1234'.slice(-8),
            '{timestamp}': Date.now().toString(),
            '{date}': now.toISOString().slice(0, 10).replace(/-/g, ''),
            '{year}': now.getFullYear().toString(),
            '{month}': (now.getMonth() + 1).toString().padStart(2, '0'),
            '{day}': now.getDate().toString().padStart(2, '0'),
            '{sequential}': template.useSequentialNumbers ? 
                (template.currentSequentialNumber || template.sequentialNumberStart || 1).toString().padStart(template.sequentialNumberDigits || 4, '0') : 
                '0001'
        };

        let format = template.invoiceNumberFormat;
        Object.entries(variables).forEach(([key, value]) => {
            format = format.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        });

        return format;
    };

    // Calculate due date preview showing exact text that will appear in PDF
    const calculateDueDatePreview = (template) => {
        const today = new Date();
        
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
                // Backward compatibility with old 'fixed' type
                const defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + (template.dueDateDays || 30));
                return `Due date: ${defaultDate.toLocaleDateString()} (${template.dueDateDays || 30} days from invoice date)`;
            }
        }
    };

    // Sort templates - default first, then by name
    const sortedTemplates = useMemo(() => {
        return [...invoiceTemplates].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [invoiceTemplates]);

    return (
        <div className={`${(showCreateForm || editingTemplate) ? 'space-y-8' : 'space-y-6'}`}>
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Invoice Templates
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Create and manage invoice templates with custom numbering and due date settings.
                    </p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    New Template
                </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingTemplate) && (
                <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                        {editingTemplate ? 'Edit Invoice Template' : 'Create Invoice Template'}
                    </h4>

                    <form onSubmit={handleSubmit} className="space-y-8">
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Description <span className="text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                                    placeholder="Describe when to use this template..."
                                />
                            </div>

                            <div className="flex items-center">
                                <CustomCheckbox
                                    checked={formData.isDefault}
                                    onChange={() => setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }))}
                                />
                                <label className="ml-2 block text-sm text-gray-900">
                                    Set as default template
                                </label>
                            </div>
                        </div>

                        {/* Invoice Number Configuration */}
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Invoice Number Configuration</h3>
                            
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
                                        Preview: <strong>{generatePreviewInvoiceNumber(formData)}</strong>
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
                                        onChange={() => setFormData(prev => ({ ...prev, useSequentialNumbers: !prev.useSequentialNumbers }))}
                                    />
                                    <label className="ml-2 block text-sm text-gray-900">
                                        Use sequential numbering
                                    </label>
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
                                                Leading Zeros (Digits)
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
                                            onChange={() => setFormData(prev => ({ ...prev, sequentialResetYearly: !prev.sequentialResetYearly }))}
                                        />
                                        <label className="ml-2 block text-sm text-gray-900">
                                            Reset sequential number yearly
                                        </label>
                                        <span className="ml-2 text-xs text-gray-500">
                                            (Restarts at starting number each new year)
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Due Date Configuration */}
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Due Date Configuration</h3>
                            
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
                                        <strong>Preview:</strong> {calculateDueDatePreview(formData)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateForm(false);
                                    setEditingTemplate(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Templates List */}
            {sortedTemplates.length === 0 ? (
                <div className="text-center py-12">
                    <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first invoice template.</p>
                    <div className="mt-6">
                        <button
                            onClick={handleOpenCreate}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" />
                            New Template
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <DocumentDuplicateIcon className="h-6 w-6 text-gray-400" />
                                            <div>
                                                <div className="flex items-center">
                                                    <h4 className="text-lg font-medium text-gray-900">
                                                        {template.name}
                                                    </h4>
                                                    {template.isDefault && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-gray-500 space-y-1">
                                                    {template.description && <p>{template.description}</p>}
                                                    <p>Invoice Number: {generatePreviewInvoiceNumber(template)}</p>
                                                    {template.useSequentialNumbers && (
                                                        <p>Next Sequential: #{template.currentSequentialNumber.toString().padStart(template.sequentialNumberDigits || 4, '0')}</p>
                                                    )}
                                                    <p>{calculateDueDatePreview(template)}</p>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-400">
                                                    Created {new Date(template.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className="relative dropdown-container">
                                        <button
                                            onClick={() => {
                                                const newState = !showDropdown[template.id];
                                                setShowDropdown(newState ? { [template.id]: true } : {});

                                                // Dispatch a custom event to close other dropdowns
                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                    detail: { templateId: template.id, open: newState }
                                                });
                                                document.dispatchEvent(event);
                                            }}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                            title="More actions"
                                        >
                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                        </button>

                                        {showDropdown[template.id] && (
                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            handleEdit(template);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDelete(template.id);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InvoiceTemplates;
