import React, { useMemo, useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { useInvoiceTemplates } from '../hooks/useInvoiceTemplates.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * InvoiceTemplates component - Manages invoice templates with customizable formats
 */
const InvoiceTemplates = ({ 
    autoOpenCreate = false,
    // Modal functions
    openTemplateModal = null,
    editTemplateModal = null
}) => {
    const isMobileLayout = useIsMobileLayout();
    const { showSuccess } = useToast();
    const { invoiceTemplates, deleteInvoiceTemplate } = useInvoiceTemplates();
    const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState(null);

    // Auto-open create modal when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && openTemplateModal) {
            openTemplateModal();
        }
    }, [autoOpenCreate, openTemplateModal]);

    // Handle delete
    const handleDelete = (templateId) => {

        setPendingDeleteTemplateId(templateId);
    };

    const closeDeleteTemplateModal = () => {

        setPendingDeleteTemplateId(null);
    };

    const confirmDeleteTemplate = () => {

        if (!pendingDeleteTemplateId) {

            return;
        }

        deleteInvoiceTemplate(pendingDeleteTemplateId);
        showSuccess('Template deleted successfully!');
        setPendingDeleteTemplateId(null);
    };

    const pendingDeleteTemplate = pendingDeleteTemplateId
        ? invoiceTemplates.find((template) => template.id === pendingDeleteTemplateId)
        : null;

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
                return 'Due date will not be shown';
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
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">
                        Invoice Templates
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create and manage invoice templates with custom numbering and due date settings.
                    </p>
                </div>
                <Button
                    onClick={() => openTemplateModal && openTemplateModal()}
                    leadingIcon={PlusIcon}
                    className={cn(isMobileLayout && 'w-full sm:w-auto')}
                >
                    New Template
                </Button>
            </div>

            {/* Templates List */}
            {sortedTemplates.length === 0 ? (
                <div className="text-center py-12">
                    <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No templates</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first invoice template.</p>
                    <div className="mt-6">
                        <Button
                            onClick={() => openTemplateModal && openTemplateModal()}
                            leadingIcon={PlusIcon}
                        >
                            New Template
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className="hover:shadow-md transition-shadow"
                        >
                            <CardContent className={cn(isMobileLayout ? 'p-4' : 'pt-5')}>
                                <div className={cn('justify-between gap-3', isMobileLayout ? 'space-y-3' : 'flex items-center')}>
                                    <div className="flex-1">
                                        <div className="flex items-start space-x-3 min-w-0">
                                            <DocumentDuplicateIcon className="h-6 w-6 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-medium text-foreground break-words">
                                                        {template.name}
                                                    </h4>
                                                    {template.isDefault && (
                                                        <Badge variant="secondary" className="ml-2">Default</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground space-y-1 break-words">
                                                    <p>Invoice Number: {generatePreviewInvoiceNumber(template)}</p>
                                                    {template.useSequentialNumbers && (
                                                        <p>Next Sequential: #{template.currentSequentialNumber.toString().padStart(template.sequentialNumberDigits || 4, '0')}</p>
                                                    )}
                                                    <p>{calculateDueDatePreview(template)}</p>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Created {toDisplayDate(template.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className={cn(isMobileLayout && 'flex justify-end')}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                title="More actions"
                                                aria-label="More actions"
                                            >
                                                <MoreHorizontal className="h-5 w-5 group-hover:text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => editTemplateModal && editTemplateModal(template)}
                                                className="status-warning-action cursor-pointer"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(template.id)}
                                                className="status-danger-action cursor-pointer"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                isOpen={Boolean(pendingDeleteTemplateId)}
                onClose={closeDeleteTemplateModal}
                title="Delete template?"
                description="This will permanently remove the invoice template."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteTemplateModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteTemplate}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteTemplate
                        ? `Deleting "${pendingDeleteTemplate.name}" cannot be undone.`
                        : 'Deleting this template cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default InvoiceTemplates;
