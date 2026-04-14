import React, { useState, useCallback, useMemo } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon } from '@/components/ui/icons';
import { MoreHorizontal, Mail } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { useEmailTemplates } from '../hooks/useEmailTemplates.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import EmailTemplateModal from './modals/EmailTemplateModal';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * EmailTemplates — card-based list of email templates with CRUD,
 * placed on the Account page.
 */
const EmailTemplates = () => {
    const isMobileLayout = useIsMobileLayout();
    const { showSuccess } = useToast();
    const { sortedTemplates, deleteEmailTemplate } = useEmailTemplates();

    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

    const openCreate = useCallback(() => {
        setEditingTemplate(null);
        setModalOpen(true);
    }, []);

    const openEdit = useCallback((template) => {
        setEditingTemplate(template);
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setEditingTemplate(null);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!pendingDeleteId) return;
        deleteEmailTemplate(pendingDeleteId);
        showSuccess('Email template deleted');
        setPendingDeleteId(null);
    }, [pendingDeleteId, deleteEmailTemplate, showSuccess]);

    const pendingDeleteTemplate = useMemo(
        () => pendingDeleteId ? sortedTemplates.find(t => t.id === pendingDeleteId) : null,
        [pendingDeleteId, sortedTemplates]
    );

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                <div>
                    <div className="flex items-center mb-1">
                        <h2 className="text-2xl font-bold text-foreground">Email Templates</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create and manage email templates for sending invoices.
                    </p>
                </div>
                <Button
                    onClick={openCreate}
                    leadingIcon={PlusIcon}
                    className={cn(isMobileLayout && 'w-full sm:w-auto')}
                >
                    New Template
                </Button>
            </div>

            {/* List */}
            {sortedTemplates.length === 0 ? (
                <div className="text-center py-12">
                    <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No email templates</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create your first email template.
                    </p>
                    <div className="mt-6">
                        <Button onClick={openCreate} leadingIcon={PlusIcon}>
                            New Template
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedTemplates.map((template) => (
                        <Card key={template.id} className="hover:shadow-md transition-shadow">
                            <CardContent className={cn(isMobileLayout ? 'p-4' : 'pt-5')}>
                                <div className={cn('justify-between gap-3', isMobileLayout ? 'space-y-3' : 'flex items-center')}>
                                    <div className="flex-1">
                                        <div className="flex items-start space-x-3 min-w-0">
                                            <Mail className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-medium text-foreground break-words">
                                                        {template.name}
                                                    </h4>
                                                    {template.isDefault && (
                                                        <Badge variant="secondary">Default</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground space-y-1 break-words">
                                                    <p>Type: {template.type}</p>
                                                    <p>From: {template.fromName || 'Default business name'}</p>
                                                    <p>Reply-To: {template.replyTo || 'Default business email'}</p>
                                                </div>
                                                {template.createdAt && (
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        Created {toDisplayDate(template.createdAt)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

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
                                                    onClick={() => openEdit(template)}
                                                    className="status-warning-action cursor-pointer"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                    <span>Edit</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setPendingDeleteId(template.id)}
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

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={Boolean(pendingDeleteId)}
                onClose={() => setPendingDeleteId(null)}
                title="Delete email template?"
                description="This will permanently remove the email template."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
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

            {/* Create / Edit Modal */}
            <EmailTemplateModal
                isOpen={modalOpen}
                onClose={closeModal}
                editingTemplate={editingTemplate}
            />
        </div>
    );
};

export default EmailTemplates;
