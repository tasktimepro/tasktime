import React, { useState, useMemo, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useToast } from '../hooks/useToast';
import { toDisplayDate } from '../utils/dateUtils';

/**
 * InvoiceTemplates component - Manages invoice templates with customizable formats
 */
const InvoiceTemplates = ({ 
    invoiceTemplates = [], 
    setInvoiceTemplates,
    autoOpenCreate = false,
    // Modal functions
    openTemplateModal = null,
    editTemplateModal = null
}) => {
    const [showDropdown, setShowDropdown] = useState({});
    const { showSuccess } = useToast();

    // Auto-open create modal when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && openTemplateModal) {
            openTemplateModal();
        }
    }, [autoOpenCreate, openTemplateModal]);

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

    // Handle delete
    const handleDelete = (templateId) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            const updatedTemplates = invoiceTemplates.filter(t => t.id !== templateId);
            setInvoiceTemplates(updatedTemplates);
            showSuccess('Template deleted successfully!');
        }
    };

    // Generate a static timestamp for previews that only changes when component mounts
    const staticTimestamp = useMemo(() => Date.now().toString(), []);
    const staticDate = useMemo(() => new Date(), []);

    // Generate preview invoice number with static timestamp
    const generatePreviewInvoiceNumber = useMemo(() => (template) => {
        const variables = {
            '{projectId}': 'ABCD1234'.slice(-8),
            '{timestamp}': staticTimestamp,
            '{date}': staticDate.toISOString().slice(0, 10).replace(/-/g, ''),
            '{year}': staticDate.getFullYear().toString(),
            '{month}': (staticDate.getMonth() + 1).toString().padStart(2, '0'),
            '{day}': staticDate.getDate().toString().padStart(2, '0'),
            '{sequential}': template.useSequentialNumbers ? 
                (template.currentSequentialNumber || template.sequentialNumberStart || 1).toString().padStart(template.sequentialNumberDigits || 4, '0') : 
                '0001'
        };

        let format = template.invoiceNumberFormat;
        Object.entries(variables).forEach(([key, value]) => {
            format = format.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        });

        return format;
    }, [staticTimestamp, staticDate]);

    // Calculate due date preview showing exact text that will appear in PDF (memoized for consistency)
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
                return `Due date: ${toDisplayDate(daysDate)} (${days} ${days === 1 ? 'day' : 'days'} from invoice date)`;
            }
            
            case 'fixed-weeks': {
                if (!template.dueDateWeeks || template.dueDateWeeks === 0) {
                    return 'Due date: Not specified';
                }
                const weeks = parseInt(template.dueDateWeeks) || 0;
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
                // Backward compatibility with old 'fixed' type
                const defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + (template.dueDateDays || 30));
                return `Due date: ${toDisplayDate(defaultDate)} (${template.dueDateDays || 30} days from invoice date)`;
            }
        }
    }, [staticDate]);

    // Sort templates - default first, then by name
    const sortedTemplates = useMemo(() => {
        return [...invoiceTemplates].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [invoiceTemplates]);

    return (
        <div className="space-y-6">
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
                    onClick={() => openTemplateModal && openTemplateModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    New Template
                </button>
            </div>

            {/* Templates List */}
            {sortedTemplates.length === 0 ? (
                <div className="text-center py-12">
                    <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first invoice template.</p>
                    <div className="mt-6">
                        <button
                            onClick={() => openTemplateModal && openTemplateModal()}
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
                                                    <p>Invoice Number: {generatePreviewInvoiceNumber(template)}</p>
                                                    {template.useSequentialNumbers && (
                                                        <p>Next Sequential: #{template.currentSequentialNumber.toString().padStart(template.sequentialNumberDigits || 4, '0')}</p>
                                                    )}
                                                    <p>{calculateDueDatePreview(template)}</p>
                                                </div>
                                                <p className="mt-2 text-xs text-gray-400">
                                                    Created {toDisplayDate(template.createdAt)}
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
                                                            editTemplateModal && editTemplateModal(template);
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
