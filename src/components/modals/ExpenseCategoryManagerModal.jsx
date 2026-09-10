import { ColorPicker } from '@/components/ui/color-picker';
import { CategoryLabel } from '@/components/expenses/CategoryLabel';
import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { ArchiveBoxIcon, ArchiveRestoreIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpenseCategories } from '@/hooks/useExpenseCategories.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { useToast } from '@/hooks/useToast.ts';

const EMPTY_GROUP_VALUE = '__none__';

const CATEGORY_GROUP_OPTIONS = [
    { value: 'software', label: 'Software' },
    { value: 'office', label: 'Office' },
    { value: 'professional', label: 'Professional' },
    { value: 'banking', label: 'Banking' },
    { value: 'travel', label: 'Travel' },
    { value: 'meals', label: 'Meals' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'taxes', label: 'Taxes' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'other', label: 'Other' },
];

const getCategoryGroupLabel = (group) => {
    if (!group) {
        return '';
    }

    return CATEGORY_GROUP_OPTIONS.find((option) => option.value === group)?.label || group;
};

const createEmptyDraft = () => ({
    name: '',
    group: '',
    color: null,
});

const getUsageLabel = (usage) => {
    const parts = [];

    if (usage.expenses > 0) {
        parts.push(`${usage.expenses} expense${usage.expenses === 1 ? '' : 's'}`);
    }

    if (usage.recurrences > 0) {
        parts.push(`${usage.recurrences} recurring template${usage.recurrences === 1 ? '' : 's'}`);
    }

    if (parts.length === 0) {
        return 'Unused';
    }

    return parts.join(' • ');
};

const ExpenseCategoryManagerModal = ({
    isOpen,
    onClose,
}) => {
    const { showError, showSuccess } = useToast();
    const {
        allExpenseCategories,
        createExpenseCategory,
        updateExpenseCategory,
        archiveExpenseCategory,
        restoreExpenseCategory,
        deleteExpenseCategory,
    } = useExpenseCategories({ seedDefaults: true });
    const { expenses } = useExpenses({ includeArchived: true });
    const { recurrences } = useExpenseRecurrences();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [draft, setDraft] = useState(createEmptyDraft);
    const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState(null);
    const [deleteBlockedNotice, setDeleteBlockedNotice] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setIsFormOpen(false);
            setEditingCategoryId(null);
            setDraft(createEmptyDraft());
            setPendingDeleteCategoryId(null);
            setDeleteBlockedNotice(null);
        }
    }, [isOpen]);

    const activeCategories = useMemo(() => {
        return allExpenseCategories.filter((category) => !category.archived);
    }, [allExpenseCategories]);

    const archivedCategories = useMemo(() => {
        return allExpenseCategories.filter((category) => category.archived);
    }, [allExpenseCategories]);

    const usageByCategoryId = useMemo(() => {
        const usage = new Map();

        const registerUsage = (categoryId, key) => {
            if (!categoryId) {
                return;
            }

            const current = usage.get(categoryId) || { expenses: 0, recurrences: 0 };
            current[key] += 1;
            usage.set(categoryId, current);
        };

        expenses.forEach((expense) => registerUsage(expense.categoryId, 'expenses'));
        recurrences.forEach((recurrence) => registerUsage(recurrence.categoryId, 'recurrences'));

        return usage;
    }, [expenses, recurrences]);

    const pendingDeleteCategory = pendingDeleteCategoryId
        ? allExpenseCategories.find((category) => category.id === pendingDeleteCategoryId) || null
        : null;

    const resetDraft = () => {
        setIsFormOpen(false);
        setEditingCategoryId(null);
        setDraft(createEmptyDraft());
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const trimmedName = draft.name.trim();

        if (!trimmedName) {
            showError('Category name is required');
            return;
        }

        const payload = {
            name: trimmedName,
            group: draft.group || null,
            color: draft.color || null,
        };

        try {
            if (editingCategoryId) {
                updateExpenseCategory(editingCategoryId, payload);
                showSuccess('Category updated');
            } else {
                createExpenseCategory(payload);
                showSuccess('Category created');
            }

            setDeleteBlockedNotice(null);
            resetDraft();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Unable to save category');
        }
    };

    const handleEdit = (category) => {
        setIsFormOpen(true);
        setEditingCategoryId(category.id);
        setDraft({
            name: category.name || '',
            group: category.group || '',
            color: category.color || null,
        });
    };

    const handleArchive = (category) => {
        archiveExpenseCategory(category.id);
        if (editingCategoryId === category.id) {
            resetDraft();
        }
        setDeleteBlockedNotice(null);
        showSuccess('Category archived');
    };

    const handleRestore = (category) => {
        restoreExpenseCategory(category.id);
        setDeleteBlockedNotice(null);
        showSuccess('Category restored');
    };

    const requestDelete = (category) => {
        const usage = usageByCategoryId.get(category.id) || { expenses: 0, recurrences: 0 };

        if (usage.expenses > 0 || usage.recurrences > 0) {
            setDeleteBlockedNotice({
                categoryName: category.name,
                expenses: usage.expenses,
                recurrences: usage.recurrences,
            });
            return;
        }

        setDeleteBlockedNotice(null);
        setPendingDeleteCategoryId(category.id);
    };

    const confirmDelete = () => {
        if (!pendingDeleteCategoryId) {
            return;
        }

        deleteExpenseCategory(pendingDeleteCategoryId);

        if (editingCategoryId === pendingDeleteCategoryId) {
            resetDraft();
        }

        setDeleteBlockedNotice(null);
        showSuccess('Category deleted');
        setPendingDeleteCategoryId(null);
    };

    const modalFooter = (
        <div className="flex w-full justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
                Done
            </Button>
        </div>
    );

    const renderCategoryRow = (category) => {
        const usage = usageByCategoryId.get(category.id) || { expenses: 0, recurrences: 0 };
        const isEditing = editingCategoryId === category.id;

        return (
            <div key={category.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground"><CategoryLabel category={category} /></p>
                        {category.group ? <Badge variant="outline">{getCategoryGroupLabel(category.group)}</Badge> : null}
                        {category.archived ? <Badge variant="secondary">Archived</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{getUsageLabel(usage)}</p>
                    {isEditing ? (
                        <p className="mt-1 text-xs text-muted-foreground">Editing</p>
                    ) : null}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground"
                            aria-label="More actions"
                            title="More actions"
                        >
                            <MoreHorizontalIcon className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(category)}>
                            <PencilIcon className="h-4 w-4" />
                            <span>Edit</span>
                        </DropdownMenuItem>
                        {category.archived ? (
                            <DropdownMenuItem onClick={() => handleRestore(category)}>
                                <ArchiveRestoreIcon className="h-4 w-4" />
                                <span>Restore</span>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onClick={() => handleArchive(category)}>
                                <ArchiveBoxIcon className="h-4 w-4" />
                                <span>Archive</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            onClick={() => requestDelete(category)}
                            className="status-danger-action cursor-pointer"
                        >
                            <TrashIcon className="h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Expense Categories"
                description="Manage reusable categories for expense entry, filtering, and reports."
                size="2xl"
                footer={modalFooter}
            >
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-foreground">Active categories</h3>
                                <p className="mt-1 text-xs text-muted-foreground">{activeCategories.length} available for new expenses</p>
                            </div>
                            <Button type="button" className="shrink-0" leadingIcon={PlusIcon} onClick={() => { resetDraft(); setIsFormOpen(true); }}>
                                Add category
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {activeCategories.map(renderCategoryRow)}
                        </div>
                    </div>

                    {archivedCategories.length > 0 ? (
                        <div className="space-y-3">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Archived categories</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Hidden from new entries but preserved for older records</p>
                            </div>
                            <div className="space-y-3">
                                {archivedCategories.map(renderCategoryRow)}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Modal>

            <Modal isOpen={isOpen && isFormOpen} onClose={resetDraft}
                title={editingCategoryId ? 'Edit category' : 'Add category'}
                description="Choose a name, optional group, and color tag."
                size="lg"
                footer={<div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetDraft}>Cancel</Button>
                    <Button type="submit" form="expense-category-form">{editingCategoryId ? 'Update Category' : 'Add Category'}</Button>
                </div>}>
                    <form id="expense-category-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="expense-category-name">Name</Label>
                                <Input
                                    required
                                    id="expense-category-name"
                                    value={draft.name}
                                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="e.g. Software & subscriptions"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expense-category-group">Group</Label>
                                <Select
                                    value={draft.group || EMPTY_GROUP_VALUE}
                                    onValueChange={(value) => setDraft((current) => ({ ...current, group: value === EMPTY_GROUP_VALUE ? '' : value }))}
                                >
                                    <SelectTrigger id="expense-category-group">
                                        <SelectValue placeholder="Select group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={EMPTY_GROUP_VALUE}>No group</SelectItem>
                                        {CATEGORY_GROUP_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Color Tag</Label>
                            <ColorPicker value={draft.color} onChange={color => setDraft(current => ({ ...current, color }))} />
                        </div>
                    </form>
            </Modal>

            <Modal
                isOpen={Boolean(deleteBlockedNotice)}
                onClose={() => setDeleteBlockedNotice(null)}
                title={deleteBlockedNotice ? `Can't delete "${deleteBlockedNotice.categoryName}"` : "Can't delete category"}
                description="This category is currently in use and cannot be permanently deleted."
                size="md"
                footer={(
                    <div className="flex justify-end">
                        <Button type="button" variant="outline" onClick={() => setDeleteBlockedNotice(null)}>
                            Close
                        </Button>
                    </div>
                )}
            >
                <Notice
                    description={deleteBlockedNotice
                        ? getUsageLabel({
                            expenses: deleteBlockedNotice.expenses,
                            recurrences: deleteBlockedNotice.recurrences,
                        }) + '. Archive it instead if you want to hide it from new expenses.'
                        : undefined}
                    variant="warning"
                />
            </Modal>

            <Modal
                isOpen={Boolean(pendingDeleteCategoryId)}
                onClose={() => setPendingDeleteCategoryId(null)}
                title="Delete category?"
                description="This will permanently remove the category."
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setPendingDeleteCategoryId(null)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteCategory ? `Deleting "${pendingDeleteCategory.name}" cannot be undone.` : 'Deleting this category cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </>
    );
};

ExpenseCategoryManagerModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ExpenseCategoryManagerModal;
