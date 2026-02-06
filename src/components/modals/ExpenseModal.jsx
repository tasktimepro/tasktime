/**
 * ExpenseModal component - Modal for creating and editing expenses
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '../CustomCheckbox';
import { useToast } from '../../hooks/useToast.ts';
import { useExpenses } from '../../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../../hooks/useExpenseRecurrences.ts';
import { useClients } from '../../hooks/useClients.ts';
import { useProjects } from '../../hooks/useProjects.ts';
import { usePreferences } from '../../hooks/usePreferences.ts';
import { buildExpenseFromRecurrence } from '@/utils/expenseUtils';
import { CURRENCY_NAMES, DEFAULT_CURRENCY } from '@/utils/currencyUtils.ts';
import { toStorageDate } from '@/utils/dateUtils.ts';

const NO_CLIENT_VALUE = 'no-client';
const NO_PROJECT_VALUE = 'no-project';
const DEFAULT_REPEAT = 'monthly';
const DEFAULT_AMOUNT_TYPE = 'fixed';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.editingExpense
 * @param {Object|null} props.modalOptions
 * @param {Function} props.saveFormState
 * @param {Function} props.getSavedState
 * @param {Function} props.clearSavedState
 */
const ExpenseModal = ({
    isOpen,
    onClose,
    editingExpense = null,
    modalOptions = null,
    saveFormState,
    getSavedState,
    clearSavedState,
}) => {
    const { showSuccess, showError } = useToast();
    const { createExpense, updateExpense } = useExpenses();
    const { createRecurrence, getRecurrence, updateRecurrence, deleteRecurrence } = useExpenseRecurrences();
    const { clients } = useClients();
    const { projects, getProjectsByClient } = useProjects();
    const { preferences } = usePreferences();

    const todayString = useMemo(() => toStorageDate(new Date()) || '', []);
    const currencyOptions = useMemo(() => Object.keys(CURRENCY_NAMES).sort(), []);

    const activeClients = useMemo(() => {
        return clients.filter((client) => !client.archived);
    }, [clients]);

    const activeProjects = useMemo(() => {
        return projects.filter((project) => !project.archived);
    }, [projects]);

    const [formData, setFormData] = useState({
        title: '',
        note: '',
        date: todayString,
        supplierName: '',
        receiptNumber: '',
        amount: '',
        currency: preferences.currency || DEFAULT_CURRENCY,
        paidOn: '',
        paidBy: '',
        clientId: NO_CLIENT_VALUE,
        projectId: NO_PROJECT_VALUE,
        isPersonal: true,
        billable: false,
        isRecurring: false,
        repeat: DEFAULT_REPEAT,
        startDate: todayString,
        endDate: '',
        amountType: DEFAULT_AMOUNT_TYPE,
        taxNumber: '',
        isTaxExempt: false,
    });

    const [editingRecurrenceId, setEditingRecurrenceId] = useState(null);

    const lastInitializedRef = useRef({ initialized: false, expenseId: undefined, recurrenceId: undefined });

    useEffect(() => {
        if (!isOpen) {
            lastInitializedRef.current = { initialized: false, expenseId: undefined, recurrenceId: undefined };
            setEditingRecurrenceId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const currentEditingExpenseId = editingExpense?.id || null;
        const currentEditingRecurrenceId = modalOptions?.recurrenceId || null;

        if (
            lastInitializedRef.current.initialized
            && lastInitializedRef.current.expenseId === currentEditingExpenseId
            && lastInitializedRef.current.recurrenceId === currentEditingRecurrenceId
        ) {
            return;
        }

        lastInitializedRef.current = {
            initialized: true,
            expenseId: currentEditingExpenseId,
            recurrenceId: currentEditingRecurrenceId,
        };

        const savedState = getSavedState ? getSavedState() : null;
        const savedEditingExpenseId = savedState?.editingExpenseId || null;

        if (savedState && savedEditingExpenseId === currentEditingExpenseId) {
            const { editingExpenseId, ...rest } = savedState;
            setFormData((prev) => ({
                ...prev,
                ...rest,
            }));
            return;
        }

        if (editingExpense) {
            setEditingRecurrenceId(null);
            setFormData({
                title: editingExpense.title || '',
                note: editingExpense.note || '',
                date: editingExpense.date || todayString,
                supplierName: editingExpense.supplierName || '',
                receiptNumber: editingExpense.receiptNumber || '',
                amount: editingExpense.amount != null ? String(editingExpense.amount) : '',
                currency: editingExpense.currency || preferences.currency || DEFAULT_CURRENCY,
                paidOn: editingExpense.paidOn || '',
                paidBy: editingExpense.paidBy || '',
                clientId: editingExpense.clientId || NO_CLIENT_VALUE,
                projectId: editingExpense.projectId || NO_PROJECT_VALUE,
                isPersonal: editingExpense.isPersonal !== false,
                billable: editingExpense.billable === true,
                isRecurring: Boolean(editingExpense.isRecurring),
                repeat: DEFAULT_REPEAT,
                startDate: editingExpense.date || todayString,
                endDate: '',
                amountType: editingExpense.amountType || DEFAULT_AMOUNT_TYPE,
                taxNumber: editingExpense.taxNumber || '',
                isTaxExempt: editingExpense.isTaxExempt === true,
            });
            return;
        }

        if (currentEditingRecurrenceId) {
            const recurrence = getRecurrence(currentEditingRecurrenceId);
            if (!recurrence) {
                showError('Recurring template not found');
                return;
            }

            setEditingRecurrenceId(recurrence.id);
            setFormData({
                title: recurrence.title || '',
                note: recurrence.note || '',
                date: recurrence.startDate || todayString,
                supplierName: recurrence.supplierName || '',
                receiptNumber: '',
                amount: recurrence.amount != null ? String(recurrence.amount) : '',
                currency: recurrence.currency || preferences.currency || DEFAULT_CURRENCY,
                paidOn: '',
                paidBy: '',
                clientId: recurrence.clientId || NO_CLIENT_VALUE,
                projectId: recurrence.projectId || NO_PROJECT_VALUE,
                isPersonal: recurrence.isPersonal !== false,
                billable: recurrence.billable === true,
                isRecurring: true,
                repeat: recurrence.repeat || DEFAULT_REPEAT,
                startDate: recurrence.startDate || todayString,
                endDate: recurrence.endDate || '',
                amountType: recurrence.amountType || DEFAULT_AMOUNT_TYPE,
                taxNumber: recurrence.taxNumber || '',
                isTaxExempt: recurrence.isTaxExempt === true,
            });
            return;
        }

        const defaultCurrency = preferences.currency || DEFAULT_CURRENCY;
        const initialClientId = modalOptions?.clientId || NO_CLIENT_VALUE;
        const initialProjectId = modalOptions?.projectId || NO_PROJECT_VALUE;
        const isPersonal = !modalOptions?.clientId && !modalOptions?.projectId;

        setFormData({
            title: '',
            note: '',
            date: modalOptions?.date || todayString,
            supplierName: '',
            receiptNumber: '',
            amount: '',
            currency: defaultCurrency,
            paidOn: '',
            paidBy: '',
            clientId: initialClientId,
            projectId: initialProjectId,
            isPersonal,
            billable: false,
            isRecurring: false,
            repeat: DEFAULT_REPEAT,
            startDate: modalOptions?.date || todayString,
            endDate: '',
            amountType: DEFAULT_AMOUNT_TYPE,
            taxNumber: '',
            isTaxExempt: false,
        });
    }, [isOpen, editingExpense, getSavedState, modalOptions, preferences.currency, todayString]);

    useEffect(() => {
        if (!saveFormState || !isOpen) {
            return;
        }

        const timeoutId = setTimeout(() => {
            saveFormState({
                ...formData,
                editingExpenseId: editingExpense?.id || null,
            });
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [formData, saveFormState, editingExpense, isOpen]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleClientChange = (value) => {
        if (value === NO_CLIENT_VALUE) {
            setFormData((prev) => ({
                ...prev,
                clientId: NO_CLIENT_VALUE,
                projectId: NO_PROJECT_VALUE,
                isPersonal: true,
                billable: false,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            clientId: value,
            projectId: NO_PROJECT_VALUE,
            isPersonal: false,
        }));
    };

    const handleProjectChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            projectId: value === NO_PROJECT_VALUE ? NO_PROJECT_VALUE : value,
            isPersonal: value === NO_PROJECT_VALUE && prev.clientId === NO_CLIENT_VALUE,
        }));
    };

    const handlePersonalToggle = (checked) => {
        if (checked) {
            setFormData((prev) => ({
                ...prev,
                isPersonal: true,
                clientId: NO_CLIENT_VALUE,
                projectId: NO_PROJECT_VALUE,
                billable: false,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            isPersonal: false,
        }));
    };

    const handleRecurringToggle = (checked) => {
        if (editingExpense?.isRecurring) {
            return;
        }

        setFormData((prev) => ({
            ...prev,
            isRecurring: checked,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const isEditingTemplate = Boolean(editingRecurrenceId);

        if (!formData.title.trim()) {
            showError('Expense title is required');
            return;
        }

        if (!formData.date && !isEditingTemplate) {
            showError('Expense date is required');
            return;
        }

        if (isEditingTemplate && !formData.startDate) {
            showError('Recurring start date is required');
            return;
        }

        const amountValue = Number(formData.amount);
        const isVariable = formData.isRecurring && formData.amountType === 'variable';

        if (!isVariable && (!amountValue || amountValue <= 0)) {
            showError('Expense amount is required');
            return;
        }

        const effectiveDate = isEditingTemplate ? formData.startDate : formData.date;

        const payload = {
            title: formData.title.trim(),
            note: formData.note.trim() ? formData.note.trim() : null,
            date: effectiveDate,
            supplierName: formData.supplierName.trim() ? formData.supplierName.trim() : null,
            receiptNumber: formData.receiptNumber.trim() ? formData.receiptNumber.trim() : null,
            currency: formData.currency || DEFAULT_CURRENCY,
            amount: amountValue || 0,
            paidOn: formData.paidOn || null,
            paidBy: formData.paidBy.trim() ? formData.paidBy.trim() : null,
            paymentStatus: formData.paidOn ? 'paid' : 'unpaid',
            clientId: formData.clientId === NO_CLIENT_VALUE ? null : formData.clientId,
            projectId: formData.projectId === NO_PROJECT_VALUE ? null : formData.projectId,
            isPersonal: formData.isPersonal,
            billable: formData.billable,
            billingStatus: editingExpense?.billingStatus || 'unbilled',
            invoiceId: editingExpense?.invoiceId || null,
            billedAt: editingExpense?.billedAt || null,
            isRecurring: formData.isRecurring,
            recurrenceId: editingExpense?.recurrenceId || null,
            amountType: formData.isRecurring ? formData.amountType : null,
            taxNumber: formData.taxNumber.trim() ? formData.taxNumber.trim() : null,
            isTaxExempt: formData.isTaxExempt,
        };

        if (isEditingTemplate) {
            const existing = getRecurrence(editingRecurrenceId);
            if (!existing) {
                showError('Recurring template not found');
                return;
            }

            updateRecurrence(editingRecurrenceId, {
                title: payload.title,
                note: payload.note,
                supplierName: payload.supplierName,
                currency: payload.currency,
                amount: amountValue || 0,
                amountType: formData.amountType,
                repeat: formData.repeat,
                startDate: formData.startDate,
                endDate: formData.endDate || null,
                clientId: payload.clientId,
                projectId: payload.projectId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
            });
            showSuccess('Recurring template updated');

            if (clearSavedState) {
                clearSavedState();
            }

            onClose();
            return;
        }

        if (editingExpense) {
            updateExpense(editingExpense.id, payload);
            showSuccess('Expense updated');
        } else if (formData.isRecurring) {
            const recurrence = createRecurrence({
                title: payload.title,
                note: payload.note,
                supplierName: payload.supplierName,
                currency: payload.currency,
                amount: amountValue || 0,
                amountType: formData.amountType,
                repeat: formData.repeat,
                startDate: formData.startDate,
                endDate: formData.endDate || null,
                clientId: payload.clientId,
                projectId: payload.projectId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
                lastGeneratedDate: formData.startDate,
                active: true,
            });

            const instance = buildExpenseFromRecurrence(recurrence, formData.startDate);
            createExpense(instance);
            showSuccess('Recurring expense created');
        } else {
            createExpense({
                ...payload,
                isRecurring: false,
                recurrenceId: null,
                amountType: null,
            });
            showSuccess('Expense created');
        }

        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const handleClose = () => {
        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const availableProjects = useMemo(() => {
        if (formData.clientId !== NO_CLIENT_VALUE) {
            return getProjectsByClient(formData.clientId).filter((project) => !project.archived);
        }
        return activeProjects;
    }, [formData.clientId, getProjectsByClient, activeProjects]);

    const canBill = formData.clientId !== NO_CLIENT_VALUE || formData.projectId !== NO_PROJECT_VALUE;

    const handleDeleteTemplate = () => {
        if (!editingRecurrenceId) return;
        if (!window.confirm('Delete this recurring template? Existing expenses will not be removed.')) {
            return;
        }

        deleteRecurrence(editingRecurrenceId);
        showSuccess('Recurring template deleted');

        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const modalFooter = (
        <div className="flex justify-between items-center">
            <div>
                {editingRecurrenceId && (
                    <Button variant="destructive" type="button" onClick={handleDeleteTemplate}>
                        Delete Template
                    </Button>
                )}
            </div>
            <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose} type="button">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} type="submit">
                    {editingRecurrenceId ? 'Save Recurrence' : (editingExpense ? 'Save Expense' : 'Create Expense')}
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size="2xl"
            title={editingRecurrenceId && !editingExpense ? 'Edit Recurring Template' : (editingExpense ? 'Edit Expense' : 'New Expense')}
            footer={modalFooter}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {editingExpense?.isRecurring && !editingRecurrenceId && (
                    <Notice
                        title="Recurring expense"
                        description="This is a recurring expense. Editing only updates this instance."
                    >
                        {editingExpense.recurrenceId && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => {
                                    const recurrence = getRecurrence(editingExpense.recurrenceId);
                                    if (!recurrence) {
                                        showError('Recurring template not found');
                                        return;
                                    }
                                    setEditingRecurrenceId(recurrence.id);
                                    setFormData({
                                        title: recurrence.title || '',
                                        note: recurrence.note || '',
                                        date: recurrence.startDate || todayString,
                                        supplierName: recurrence.supplierName || '',
                                        receiptNumber: '',
                                        amount: recurrence.amount != null ? String(recurrence.amount) : '',
                                        currency: recurrence.currency || preferences.currency || DEFAULT_CURRENCY,
                                        paidOn: '',
                                        paidBy: '',
                                        clientId: recurrence.clientId || NO_CLIENT_VALUE,
                                        projectId: recurrence.projectId || NO_PROJECT_VALUE,
                                        isPersonal: recurrence.isPersonal !== false,
                                        billable: recurrence.billable === true,
                                        isRecurring: true,
                                        repeat: recurrence.repeat || DEFAULT_REPEAT,
                                        startDate: recurrence.startDate || todayString,
                                        endDate: recurrence.endDate || '',
                                        amountType: recurrence.amountType || DEFAULT_AMOUNT_TYPE,
                                        taxNumber: recurrence.taxNumber || '',
                                        isTaxExempt: recurrence.isTaxExempt === true,
                                    });
                                }}
                            >
                                Edit template
                            </Button>
                        )}
                    </Notice>
                )}

                {editingRecurrenceId && (
                    <Notice
                        title="Editing recurring template"
                        description="Changes apply to future expenses only."
                    >
                        {editingExpense && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => {
                                    setEditingRecurrenceId(null);
                                    setFormData({
                                        title: editingExpense.title || '',
                                        note: editingExpense.note || '',
                                        date: editingExpense.date || todayString,
                                        supplierName: editingExpense.supplierName || '',
                                        receiptNumber: editingExpense.receiptNumber || '',
                                        amount: editingExpense.amount != null ? String(editingExpense.amount) : '',
                                        currency: editingExpense.currency || preferences.currency || DEFAULT_CURRENCY,
                                        paidOn: editingExpense.paidOn || '',
                                        paidBy: editingExpense.paidBy || '',
                                        clientId: editingExpense.clientId || NO_CLIENT_VALUE,
                                        projectId: editingExpense.projectId || NO_PROJECT_VALUE,
                                        isPersonal: editingExpense.isPersonal !== false,
                                        billable: editingExpense.billable === true,
                                        isRecurring: Boolean(editingExpense.isRecurring),
                                        repeat: DEFAULT_REPEAT,
                                        startDate: editingExpense.date || todayString,
                                        endDate: '',
                                        amountType: editingExpense.amountType || DEFAULT_AMOUNT_TYPE,
                                        taxNumber: editingExpense.taxNumber || '',
                                        isTaxExempt: editingExpense.isTaxExempt === true,
                                    });
                                }}
                            >
                                Edit this instance
                            </Button>
                        )}
                    </Notice>
                )}

                {editingExpense?.billingStatus === 'billed' && (
                    <Notice
                        title="Expense is billed"
                        description="This expense is attached to an invoice. Editing won't update that invoice."
                    />
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="expense-title">Title <span className="text-red-500">*</span></Label>
                        <Input
                            id="expense-title"
                            value={formData.title}
                            onChange={(event) => handleChange('title', event.target.value)}
                            placeholder="Enter expense title"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense-date">Date <span className="text-red-500">*</span></Label>
                        <Input
                            id="expense-date"
                            type="date"
                            value={formData.date}
                            onChange={(event) => handleChange('date', event.target.value)}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="expense-note">Note</Label>
                        <Textarea
                            id="expense-note"
                            value={formData.note}
                            onChange={(event) => handleChange('note', event.target.value)}
                            placeholder="Optional note"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense-supplier">Supplier / Business</Label>
                        <Input
                            id="expense-supplier"
                            value={formData.supplierName}
                            onChange={(event) => handleChange('supplierName', event.target.value)}
                            placeholder="Supplier name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense-receipt">Receipt / Invoice #</Label>
                        <Input
                            id="expense-receipt"
                            value={formData.receiptNumber}
                            onChange={(event) => handleChange('receiptNumber', event.target.value)}
                            placeholder="Receipt number"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense-amount">
                            {formData.isRecurring && formData.amountType === 'variable'
                                ? 'Budget Estimate (optional)'
                                : 'Amount'}
                            {!(formData.isRecurring && formData.amountType === 'variable') && (
                                <span className="text-red-500">*</span>
                            )}
                        </Label>
                        <Input
                            id="expense-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.amount}
                            onChange={(event) => handleChange('amount', event.target.value)}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                                {currencyOptions.map((currency) => (
                                    <SelectItem key={currency} value={currency}>
                                        {currency} — {CURRENCY_NAMES[currency]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground">Payment</div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="expense-paid-on">Paid On</Label>
                            <Input
                                id="expense-paid-on"
                                type="date"
                                value={formData.paidOn}
                                onChange={(event) => handleChange('paidOn', event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expense-paid-by">Paid By</Label>
                            <Input
                                id="expense-paid-by"
                                value={formData.paidBy}
                                onChange={(event) => handleChange('paidBy', event.target.value)}
                                placeholder="Company card, cash, etc."
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground">Assignment</div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Select value={formData.clientId} onValueChange={handleClientChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_CLIENT_VALUE}>Personal</SelectItem>
                                    {activeClients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Project</Label>
                            <Select
                                value={formData.projectId}
                                onValueChange={handleProjectChange}
                                disabled={formData.clientId === NO_CLIENT_VALUE}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_PROJECT_VALUE}>No project</SelectItem>
                                    {availableProjects.map((project) => (
                                        <SelectItem key={project.id} value={project.id}>
                                            {project.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <CustomCheckbox
                            checked={formData.isPersonal}
                            onChange={handlePersonalToggle}
                            label="Mark as Personal"
                        />
                        <CustomCheckbox
                            checked={formData.billable}
                            onChange={(checked) => handleChange('billable', checked)}
                            disabled={!canBill}
                            label="Billable"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground">Recurrence</div>
                    <CustomCheckbox
                        checked={formData.isRecurring}
                        onChange={handleRecurringToggle}
                        label="Recurring"
                        disabled={Boolean(editingExpense?.isRecurring)}
                    />

                    {formData.isRecurring && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Repeat</Label>
                                <Select
                                    value={formData.repeat}
                                    onValueChange={(value) => handleChange('repeat', value)}
                                    disabled={Boolean(editingExpense?.isRecurring)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Repeat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount Type</Label>
                                <Select
                                    value={formData.amountType}
                                    onValueChange={(value) => handleChange('amountType', value)}
                                    disabled={Boolean(editingExpense?.isRecurring)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Amount Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Fixed</SelectItem>
                                        <SelectItem value="variable">Variable</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expense-start">Start Date</Label>
                                <Input
                                    id="expense-start"
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(event) => handleChange('startDate', event.target.value)}
                                    disabled={Boolean(editingExpense?.isRecurring)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expense-end">End Date</Label>
                                <Input
                                    id="expense-end"
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(event) => handleChange('endDate', event.target.value)}
                                    disabled={Boolean(editingExpense?.isRecurring)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground">Tax</div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="expense-tax">Tax No</Label>
                            <Input
                                id="expense-tax"
                                value={formData.taxNumber}
                                onChange={(event) => handleChange('taxNumber', event.target.value)}
                                placeholder="Tax number"
                            />
                        </div>
                        <div className="flex items-center">
                            <CustomCheckbox
                                checked={formData.isTaxExempt}
                                onChange={(checked) => handleChange('isTaxExempt', checked)}
                                label="Tax Exempt"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ExpenseModal;
