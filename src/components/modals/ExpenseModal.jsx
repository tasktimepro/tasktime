/**
 * ExpenseModal component - Modal for creating and editing expenses
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '../CustomCheckbox';
import RecurringPicker from '../task/RecurringPicker';
import CurrencySelect from '@/components/ui/currency-select';
import { useToast } from '../../hooks/useToast.ts';
import { useExpenses } from '../../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../../hooks/useExpenseRecurrences.ts';
import { useClients } from '../../hooks/useClients.ts';
import { useProjects } from '../../hooks/useProjects.ts';
import { useBusinessInfos } from '../../hooks/useBusinessInfos.ts';
import { usePreferences } from '../../hooks/usePreferences.ts';
import { usePaymentMethods } from '../../hooks/usePaymentMethods.ts';
import { buildExpenseFromRecurrence } from '@/utils/expenseUtils';
import { DEFAULT_CURRENCY } from '@/utils/currencyUtils.ts';
import { toStorageDate } from '@/utils/dateUtils.ts';

const NO_CLIENT_VALUE = 'no-client';
const NO_PROJECT_VALUE = 'no-project';
const NO_BUSINESS_VALUE = 'no-business';
const DEFAULT_REPEAT = 'monthly';
const DEFAULT_AMOUNT_TYPE = 'fixed';

const buildEmptyFormData = (todayString, currency) => ({
    title: '',
    note: '',
    date: todayString,
    supplierName: '',
    receiptNumber: '',
    amount: '',
    currency,
    paidOn: '',
    paidBy: '',
    paymentMode: 'manual',
    clientId: NO_CLIENT_VALUE,
    projectId: NO_PROJECT_VALUE,
    businessId: '',
    isPersonal: true,
    billable: false,
    isRecurring: false,
    repeat: DEFAULT_REPEAT,
    startDate: todayString,
    endDate: '',
    amountType: DEFAULT_AMOUNT_TYPE,
    monthlyType: 'first',
    monthlyDay: 1,
    taxNumber: '',
    isTaxExempt: false,
});

const applyScopedProjectContext = (nextFormData, scopedProject, businessInfos, defaultBusinessInfo) => {
    if (!scopedProject) {
        return nextFormData;
    }

    const nextIsPersonal = scopedProject.isPersonal !== false;
    const nextBusinessId = nextIsPersonal
        ? ''
        : (nextFormData.businessId || defaultBusinessInfo?.id || '');
    const selectedBusinessInfo = businessInfos.find((info) => info.id === nextBusinessId);

    return {
        ...nextFormData,
        clientId: nextIsPersonal
            ? NO_CLIENT_VALUE
            : (scopedProject.preferredClientId || NO_CLIENT_VALUE),
        projectId: scopedProject.id,
        businessId: nextBusinessId,
        isPersonal: nextIsPersonal,
        billable: nextIsPersonal ? false : nextFormData.billable,
        taxNumber: nextIsPersonal
            ? ''
            : (selectedBusinessInfo?.taxNumber || nextFormData.taxNumber || ''),
    };
};

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
    const { createExpense, updateExpense, deleteExpense } = useExpenses({ includeArchived: true });
    const { createRecurrence, getRecurrence, updateRecurrence, deleteRecurrence } = useExpenseRecurrences();
    const { clients } = useClients();
    const { projects, getProjectsByClient } = useProjects();
    const { businessInfos, defaultBusinessInfo } = useBusinessInfos();
    const { preferences } = usePreferences();
    const { paymentMethods, defaultPaymentMethod } = usePaymentMethods();

    const todayString = useMemo(() => toStorageDate(new Date()) || '', []);

    const activeClients = useMemo(() => {
        return clients.filter((client) => !client.archived);
    }, [clients]);

    const activeProjects = useMemo(() => {
        return projects.filter((project) => !project.archived);
    }, [projects]);

    const scopedProjectId = !editingExpense && !modalOptions?.recurrenceId
        ? (modalOptions?.projectId || null)
        : null;

    const scopedProject = useMemo(() => {
        if (!scopedProjectId) {
            return null;
        }

        const matchingProject = projects.find((project) => project.id === scopedProjectId);
        if (matchingProject) {
            return matchingProject;
        }

        return {
            id: scopedProjectId,
            preferredClientId: modalOptions?.clientId || null,
            isPersonal: !modalOptions?.clientId,
        };
    }, [modalOptions?.clientId, projects, scopedProjectId]);

    const isProjectContextFixed = Boolean(scopedProjectId);
    const defaultCurrency = preferences.currency || DEFAULT_CURRENCY;
    const emptyFormData = useMemo(() => buildEmptyFormData(todayString, defaultCurrency), [defaultCurrency, todayString]);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const titleInputRef = useRef(null);

    const draftStateKey = useMemo(() => {
        if (!isOpen) {
            return 'closed';
        }

        return JSON.stringify({
            expenseId: editingExpense?.id || null,
            recurrenceId: modalOptions?.recurrenceId || null,
            modalClientId: modalOptions?.clientId || null,
            modalProjectId: modalOptions?.projectId || null,
            modalDate: modalOptions?.date || null,
            modalIsRecurring: Boolean(modalOptions?.isRecurring),
            projectId: scopedProject?.id || null,
            projectIsPersonal: scopedProject ? scopedProject.isPersonal !== false : null,
            projectClientId: scopedProject?.preferredClientId || null,
            defaultBusinessId: defaultBusinessInfo?.id || null,
            defaultPaymentMethodId: defaultPaymentMethod?.id || null,
            defaultCurrency,
        });
    }, [
        defaultBusinessInfo?.id,
        defaultCurrency,
        defaultPaymentMethod?.id,
        editingExpense?.id,
        isOpen,
        modalOptions?.clientId,
        modalOptions?.date,
        modalOptions?.isRecurring,
        modalOptions?.projectId,
        modalOptions?.recurrenceId,
        scopedProject,
    ]);

    const buildDraftState = useCallback(() => {
        if (!isOpen) {
            return {
                key: draftStateKey,
                formData: emptyFormData,
                editingRecurrenceId: null,
                missingRecurrenceId: null,
            };
        }

        const currentEditingExpenseId = editingExpense?.id || null;
        const currentEditingRecurrenceId = modalOptions?.recurrenceId || null;
        const savedState = getSavedState ? getSavedState() : null;
        const savedEditingExpenseId = savedState?.editingExpenseId || null;

        if (savedState && savedEditingExpenseId === currentEditingExpenseId) {
            const restoredFormData = { ...savedState };
            delete restoredFormData.editingExpenseId;

            return {
                key: draftStateKey,
                formData: applyScopedProjectContext(
                    restoredFormData,
                    scopedProject,
                    businessInfos,
                    defaultBusinessInfo,
                ),
                editingRecurrenceId: currentEditingRecurrenceId,
                missingRecurrenceId: null,
            };
        }

        if (editingExpense) {
            const recurrenceTemplate = editingExpense.recurrenceId
                ? getRecurrence(editingExpense.recurrenceId)
                : null;
            const recurrencePaidBy = recurrenceTemplate?.paidBy || null;
            const resolvedPaymentMode = editingExpense.paymentMode
                || recurrenceTemplate?.paymentMode
                || 'manual';
            const shouldInheritEstimate = editingExpense.amountType === 'variable'
                && (!editingExpense.amount || editingExpense.amount <= 0);
            const resolvedAmount = shouldInheritEstimate
                ? recurrenceTemplate?.amount
                : editingExpense.amount;
            const isPersonal = editingExpense.isPersonal !== false;
            const isRecurringSubmission = Boolean(editingExpense.isRecurring);
            const initialPaidBy = isRecurringSubmission
                ? (recurrencePaidBy || editingExpense.paidBy || '')
                : (editingExpense.paidBy || recurrencePaidBy || '');
            const initialPaidOn = isRecurringSubmission
                ? (editingExpense.paidOn || todayString)
                : (editingExpense.paidOn || '');
            const resolvedBusinessId = isPersonal
                ? ''
                : (editingExpense.businessId || defaultBusinessInfo?.id || '');
            const resolvedBusiness = businessInfos.find((info) => info.id === resolvedBusinessId);
            const resolvedTaxNumber = isPersonal
                ? ''
                : (resolvedBusiness?.taxNumber || editingExpense.taxNumber || '');

            return {
                key: draftStateKey,
                formData: {
                    title: editingExpense.title || '',
                    note: editingExpense.note || '',
                    date: editingExpense.date || todayString,
                    supplierName: editingExpense.supplierName || '',
                    receiptNumber: editingExpense.receiptNumber || '',
                    amount: resolvedAmount != null ? String(resolvedAmount) : '',
                    currency: editingExpense.currency || defaultCurrency,
                    paidOn: initialPaidOn,
                    paidBy: initialPaidBy,
                    paymentMode: resolvedPaymentMode,
                    clientId: editingExpense.clientId || NO_CLIENT_VALUE,
                    projectId: editingExpense.projectId || NO_PROJECT_VALUE,
                    businessId: resolvedBusinessId,
                    isPersonal,
                    billable: editingExpense.billable === true,
                    isRecurring: Boolean(editingExpense.isRecurring),
                    repeat: DEFAULT_REPEAT,
                    startDate: editingExpense.date || todayString,
                    endDate: '',
                    amountType: editingExpense.amountType || DEFAULT_AMOUNT_TYPE,
                    monthlyType: (editingExpense.date || todayString).split('-')[2] === '01' ? 'first' : 'specific',
                    monthlyDay: Number((editingExpense.date || todayString).split('-')[2]) || 1,
                    taxNumber: resolvedTaxNumber,
                    isTaxExempt: editingExpense.isTaxExempt === true,
                },
                editingRecurrenceId: null,
                missingRecurrenceId: null,
            };
        }

        if (currentEditingRecurrenceId) {
            const recurrence = getRecurrence(currentEditingRecurrenceId);

            if (!recurrence) {
                return {
                    key: draftStateKey,
                    formData: emptyFormData,
                    editingRecurrenceId: null,
                    missingRecurrenceId: currentEditingRecurrenceId,
                };
            }

            const isPersonal = recurrence.isPersonal !== false;
            const resolvedBusinessId = isPersonal
                ? ''
                : (recurrence.businessId || defaultBusinessInfo?.id || '');
            const resolvedBusiness = businessInfos.find((info) => info.id === resolvedBusinessId);
            const resolvedTaxNumber = isPersonal
                ? ''
                : (resolvedBusiness?.taxNumber || recurrence.taxNumber || '');

            return {
                key: draftStateKey,
                formData: {
                    title: recurrence.title || '',
                    note: recurrence.note || '',
                    date: recurrence.startDate || todayString,
                    supplierName: recurrence.supplierName || '',
                    receiptNumber: '',
                    amount: recurrence.amount != null ? String(recurrence.amount) : '',
                    currency: recurrence.currency || defaultCurrency,
                    paidOn: '',
                    paidBy: recurrence.paidBy || '',
                    paymentMode: recurrence.paymentMode || 'manual',
                    clientId: recurrence.clientId || NO_CLIENT_VALUE,
                    projectId: recurrence.projectId || NO_PROJECT_VALUE,
                    businessId: resolvedBusinessId,
                    isPersonal,
                    billable: recurrence.billable === true,
                    isRecurring: true,
                    repeat: recurrence.repeat || DEFAULT_REPEAT,
                    startDate: recurrence.startDate || todayString,
                    endDate: recurrence.endDate || '',
                    amountType: recurrence.amountType || DEFAULT_AMOUNT_TYPE,
                    monthlyType: recurrence.monthlyType
                        || ((recurrence.startDate || todayString).split('-')[2] === '01' ? 'first' : 'specific'),
                    monthlyDay: recurrence.monthlyDay
                        || Number((recurrence.startDate || todayString).split('-')[2])
                        || 1,
                    taxNumber: resolvedTaxNumber,
                    isTaxExempt: recurrence.isTaxExempt === true,
                },
                editingRecurrenceId: recurrence.id,
                missingRecurrenceId: null,
            };
        }

        const scopedProjectIsPersonal = scopedProject ? scopedProject.isPersonal !== false : null;
        const isPersonal = scopedProjectIsPersonal ?? (!modalOptions?.clientId && !modalOptions?.projectId);
        const initialClientId = scopedProjectIsPersonal === true
            ? NO_CLIENT_VALUE
            : (scopedProject?.preferredClientId || modalOptions?.clientId || NO_CLIENT_VALUE);
        const initialProjectId = scopedProject?.id || modalOptions?.projectId || NO_PROJECT_VALUE;
        const shouldStartRecurring = Boolean(modalOptions?.isRecurring);
        const defaultPaidBy = defaultPaymentMethod?.id || '';
        const defaultBusinessId = isPersonal ? '' : (defaultBusinessInfo?.id || '');
        const defaultBusiness = businessInfos.find((info) => info.id === defaultBusinessId);
        const defaultTaxNumber = isPersonal ? '' : (defaultBusiness?.taxNumber || '');

        return {
            key: draftStateKey,
            formData: applyScopedProjectContext({
                ...emptyFormData,
                date: modalOptions?.date || todayString,
                currency: defaultCurrency,
                paidBy: defaultPaidBy,
                clientId: initialClientId,
                projectId: initialProjectId,
                businessId: defaultBusinessId,
                isPersonal,
                isRecurring: shouldStartRecurring,
                startDate: modalOptions?.date || todayString,
                taxNumber: defaultTaxNumber,
            }, scopedProject, businessInfos, defaultBusinessInfo),
            editingRecurrenceId: null,
            missingRecurrenceId: null,
        };
    }, [
        businessInfos,
        defaultBusinessInfo,
        defaultCurrency,
        defaultPaymentMethod?.id,
        draftStateKey,
        editingExpense,
        emptyFormData,
        getRecurrence,
        getSavedState,
        isOpen,
        modalOptions,
        scopedProject,
        todayString,
    ]);

    const buildDraftStateRef = useRef(buildDraftState);
    buildDraftStateRef.current = buildDraftState;

    const [draftState, setDraftState] = useState(() => ({
        key: 'closed',
        formData: emptyFormData,
        editingRecurrenceId: null,
        missingRecurrenceId: null,
    }));

    useEffect(() => {
        if (!isOpen) {
            setDraftState({
                key: 'closed',
                formData: emptyFormData,
                editingRecurrenceId: null,
                missingRecurrenceId: null,
            });
            return;
        }

        setDraftState(buildDraftStateRef.current());
    }, [draftStateKey, emptyFormData, isOpen]);

    const activeDraftState = draftState;
    const { formData, editingRecurrenceId, missingRecurrenceId } = activeDraftState;
    const isEditingTemplate = Boolean(editingRecurrenceId);
    const isEditingInstance = Boolean(editingExpense) && !isEditingTemplate;
    const isSubmittingRecurring = Boolean(editingExpense?.isRecurring && !editingRecurrenceId);
    const showOneTimeFields = !formData.isRecurring || isEditingInstance;
    const showRecurringFields = formData.isRecurring && !isEditingInstance;
    const typeSelectionLocked = Boolean(editingExpense?.isRecurring || editingRecurrenceId);
    const recurringFieldsLocked = Boolean(editingExpense?.isRecurring && !editingRecurrenceId);

    const setFormData = (updater) => {
        setDraftState((prevState) => {
            const nextFormData = typeof updater === 'function'
                ? updater(prevState.formData)
                : updater;

            if (nextFormData === prevState.formData) {
                return prevState;
            }

            return {
                ...prevState,
                formData: nextFormData,
            };
        });
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const focusTimer = setTimeout(() => {
            titleInputRef.current?.focus();
        }, 0);

        return () => clearTimeout(focusTimer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !missingRecurrenceId) {
            return;
        }

        showError('Recurring expense not found');
    }, [isOpen, missingRecurrenceId, showError]);

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

    const resolvedPaidBy = formData.paidBy || (!editingExpense && !editingRecurrenceId
        ? (defaultPaymentMethod?.id || '')
        : '');

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleBusinessChange = (value) => {
        const nextId = !value || value === NO_BUSINESS_VALUE ? '' : value;
        const selected = businessInfos.find((info) => info.id === nextId);

        setFormData((prev) => ({
            ...prev,
            businessId: nextId,
            taxNumber: selected?.taxNumber || ''
        }));
    };

    const handleClientChange = (value) => {
        if (!value || value === NO_CLIENT_VALUE) {
            setFormData((prev) => ({
                ...prev,
                clientId: NO_CLIENT_VALUE,
                projectId: NO_PROJECT_VALUE,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            clientId: value,
            projectId: NO_PROJECT_VALUE,
        }));
    };

    const handleProjectChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            projectId: value === NO_PROJECT_VALUE ? NO_PROJECT_VALUE : value,
        }));
    };

    const handleBusinessToggle = (checked) => {
        if (!checked) {
            setFormData((prev) => ({
                ...prev,
                isPersonal: true,
                clientId: NO_CLIENT_VALUE,
                projectId: NO_PROJECT_VALUE,
                businessId: '',
                taxNumber: '',
                billable: false,
            }));
            return;
        }

        const defaultId = defaultBusinessInfo?.id || '';
        const selected = businessInfos.find((info) => info.id === defaultId);

        setFormData((prev) => ({
            ...prev,
            isPersonal: false,
            businessId: prev.businessId || defaultId,
            taxNumber: prev.businessId ? prev.taxNumber : (selected?.taxNumber || '')
        }));
    };

    const buildMonthlyDateForMonth = (monthlyType, monthlyDay, year, month) => {
        if (monthlyType === 'last') {
            const lastDay = new Date(year, month + 1, 0).getDate();
            return new Date(year, month, lastDay);
        }

        if (monthlyType === 'first') {
            return new Date(year, month, 1);
        }

        const day = monthlyDay || 1;
        return new Date(year, month, day);
    };

    const getNextMonthlyStartDate = (monthlyType, monthlyDay, todayValue) => {
        const resolvedToday = todayValue ? new Date(todayValue) : new Date();
        const todayDate = Number.isNaN(resolvedToday.getTime()) ? new Date() : resolvedToday;
        const year = todayDate.getFullYear();
        const month = todayDate.getMonth();

        let candidate = buildMonthlyDateForMonth(monthlyType, monthlyDay, year, month);

        if (candidate < todayDate) {
            candidate = buildMonthlyDateForMonth(monthlyType, monthlyDay, year, month + 1);
        }

        return toStorageDate(candidate) || todayString;
    };

    const getNextYearlyStartDate = (yearlyDate, todayValue) => {
        const resolvedToday = todayValue ? new Date(todayValue) : new Date();
        const todayDate = Number.isNaN(resolvedToday.getTime()) ? new Date() : resolvedToday;
        const baseDate = yearlyDate ? new Date(yearlyDate) : todayDate;
        const baseValid = Number.isNaN(baseDate.getTime()) ? todayDate : baseDate;
        const year = todayDate.getFullYear();
        const month = baseValid.getMonth();
        const day = baseValid.getDate();

        let candidate = new Date(year, month, day);

        if (candidate < todayDate) {
            candidate = new Date(year + 1, month, day);
        }

        return toStorageDate(candidate) || todayString;
    };

    const handleExpenseTypeChange = (value) => {
        const nextIsRecurring = value === 'recurring';

        setFormData((prev) => {
            if (prev.isRecurring === nextIsRecurring) {
                return prev;
            }

            if (nextIsRecurring) {
                return {
                    ...prev,
                    isRecurring: true,
                    repeat: DEFAULT_REPEAT,
                    startDate: getNextMonthlyStartDate('first', 1, todayString),
                    paidOn: '',
                    paidBy: '',
                    monthlyType: 'first',
                    monthlyDay: 1,
                };
            }

            return {
                ...prev,
                isRecurring: false,
                date: prev.date || todayString,
                paidOn: prev.paidOn || '',
                paidBy: prev.paidBy || ''
            };
        });
    };

    const handleRecurringConfigChange = (config) => {
        if (!config) {
            return;
        }

        if (config.type === 'yearly') {
            setFormData((prev) => ({
                ...prev,
                isRecurring: true,
                repeat: 'yearly',
                startDate: getNextYearlyStartDate(config.yearlyDate || prev.startDate || todayString, todayString)
            }));
            return;
        }

        if (config.type === 'monthly') {
            const day = config.monthlyDay || 1;
            const monthlyType = config.monthlyType || 'specific';
            setFormData((prev) => ({
                ...prev,
                isRecurring: true,
                repeat: 'monthly',
                startDate: getNextMonthlyStartDate(monthlyType, day, todayString),
                monthlyType,
                monthlyDay: day,
            }));
        }
    };

    const handleRecurringClear = () => {
        if (typeSelectionLocked) {
            return;
        }

        setFormData((prev) => ({
            ...prev,
            isRecurring: false,
            repeat: DEFAULT_REPEAT,
            startDate: todayString,
            monthlyType: 'first',
            monthlyDay: 1,
        }));
    };

    const recurringPickerValue = useMemo(() => {
        if (!formData.isRecurring) {
            return null;
        }

        if (formData.repeat === 'yearly') {
            return {
                type: 'yearly',
                yearlyDate: formData.startDate || todayString
            };
        }

        const startDate = formData.startDate || todayString;
        const day = Number(startDate.split('-')[2]) || 1;
        const monthlyDay = formData.monthlyDay || day;
        const monthlyType = formData.monthlyType || (monthlyDay === 1 ? 'first' : 'specific');

        return {
            type: 'monthly',
            monthlyType,
            monthlyDay
        };
    }, [formData.isRecurring, formData.repeat, formData.startDate, formData.monthlyDay, formData.monthlyType, todayString]);

    const handleSubmit = (event) => {
        event.preventDefault();

        const isEditingTemplate = Boolean(editingRecurrenceId);

        if (!formData.title.trim()) {
            showError('Expense title is required');
            return;
        }

        if (showOneTimeFields && !formData.date) {
            showError('Expense date is required');
            return;
        }

        if (showRecurringFields && !formData.startDate) {
            showError('Recurring start date is required');
            return;
        }

        const amountValue = Number(formData.amount);
        const isVariable = formData.isRecurring && formData.amountType === 'variable';

        if (!isVariable && (!amountValue || amountValue <= 0)) {
            showError('Expense amount is required');
            return;
        }

        const effectiveDate = showOneTimeFields ? formData.date : formData.startDate;
        const effectiveBusinessId = !formData.isPersonal ? (formData.businessId || null) : null;
        const effectiveTaxNumber = !formData.isPersonal ? (selectedBusiness?.taxNumber || null) : null;
        const isAutoPayment = formData.paymentMode === 'auto' && !isVariable;
        const resolvedPaidOn = isAutoPayment
            ? effectiveDate
            : (showOneTimeFields && formData.paidOn ? formData.paidOn : null);

        const payload = {
            title: formData.title.trim(),
            note: formData.note.trim() ? formData.note.trim() : null,
            date: effectiveDate,
            supplierName: formData.supplierName.trim() ? formData.supplierName.trim() : null,
            receiptNumber: formData.receiptNumber.trim() ? formData.receiptNumber.trim() : null,
            currency: formData.currency || DEFAULT_CURRENCY,
            amount: amountValue || 0,
            paidOn: resolvedPaidOn,
            paidBy: resolvedPaidBy || null,
            paymentStatus: isAutoPayment
                ? 'paid'
                : (showOneTimeFields && formData.paidOn ? 'paid' : 'unpaid'),
            paymentMode: formData.paymentMode || 'manual',
            clientId: formData.clientId === NO_CLIENT_VALUE ? null : formData.clientId,
            projectId: formData.projectId === NO_PROJECT_VALUE ? null : formData.projectId,
            businessId: effectiveBusinessId,
            isPersonal: formData.isPersonal,
            billable: formData.billable,
            billingStatus: editingExpense?.billingStatus || 'unbilled',
            invoiceId: editingExpense?.invoiceId || null,
            billedAt: editingExpense?.billedAt || null,
            isRecurring: formData.isRecurring,
            recurrenceId: editingExpense?.recurrenceId || null,
            amountType: formData.isRecurring ? formData.amountType : null,
            taxNumber: effectiveTaxNumber,
            isTaxExempt: formData.isTaxExempt,
        };

        if (isEditingTemplate) {
            const existing = getRecurrence(editingRecurrenceId);
            if (!existing) {
                showError('Recurring expense not found');
                return;
            }

            updateRecurrence(editingRecurrenceId, {
                title: payload.title,
                note: payload.note,
                supplierName: payload.supplierName,
                paidBy: payload.paidBy,
                paymentMode: payload.paymentMode,
                currency: payload.currency,
                amount: amountValue || 0,
                amountType: formData.amountType,
                repeat: formData.repeat,
                startDate: formData.startDate,
                monthlyType: formData.repeat === 'monthly' ? formData.monthlyType : undefined,
                monthlyDay: formData.repeat === 'monthly' ? formData.monthlyDay : undefined,
                endDate: formData.endDate || null,
                clientId: payload.clientId,
                projectId: payload.projectId,
                businessId: payload.businessId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
            });
            showSuccess('Recurring expense updated');

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
            const shouldGenerateInitial = formData.startDate && formData.startDate <= todayString;
            const recurrence = createRecurrence({
                title: payload.title,
                note: payload.note,
                supplierName: payload.supplierName,
                paidBy: payload.paidBy,
                paymentMode: payload.paymentMode,
                currency: payload.currency,
                amount: amountValue || 0,
                amountType: formData.amountType,
                repeat: formData.repeat,
                startDate: formData.startDate,
                monthlyType: formData.repeat === 'monthly' ? formData.monthlyType : undefined,
                monthlyDay: formData.repeat === 'monthly' ? formData.monthlyDay : undefined,
                endDate: formData.endDate || null,
                clientId: payload.clientId,
                projectId: payload.projectId,
                businessId: payload.businessId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
                lastGeneratedDate: shouldGenerateInitial ? formData.startDate : null,
                active: true,
            });

            if (shouldGenerateInitial) {
                const instance = buildExpenseFromRecurrence(recurrence, formData.startDate);
                createExpense(instance);
            }
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

    const selectedBusiness = formData.isPersonal || !formData.businessId
        ? null
        : (businessInfos.find((info) => info.id === formData.businessId) || null);

    const availableProjects = useMemo(() => {
        if (formData.isPersonal) {
            return activeProjects.filter((project) => project.isPersonal && !project.archived);
        }

        if (formData.clientId !== NO_CLIENT_VALUE) {
            return getProjectsByClient(formData.clientId).filter((project) => !project.archived);
        }

        return activeProjects.filter((project) => !project.isPersonal && project.preferredClientId && !project.archived);
    }, [formData.clientId, formData.isPersonal, getProjectsByClient, activeProjects]);

    const handleDeleteTemplate = () => {
        if (!editingRecurrenceId) return;
        setConfirmDialog('delete-recurrence');
    };

    const handleDeleteInstance = () => {
        if (!editingExpense) return;
        setConfirmDialog('delete-instance');
    };

    const confirmDeleteRecurrence = () => {
        if (!editingRecurrenceId) return;
        deleteRecurrence(editingRecurrenceId);
        showSuccess('Recurring expense deleted');
        setConfirmDialog(null);

        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const confirmDeleteInstance = () => {
        if (!editingExpense) return;
        deleteExpense(editingExpense.id);
        showSuccess('Expense deleted');
        setConfirmDialog(null);

        if (clearSavedState) {
            clearSavedState();
        }

        onClose();
    };

    const submitLabel = isSubmittingRecurring
        ? 'Submit'
        : (editingRecurrenceId
            ? 'Save Expense'
            : (editingExpense ? 'Save Expense' : 'Create Expense'));

    const modalFooter = (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-row flex-wrap gap-2 sm:items-center">
                {(isSubmittingRecurring || (editingExpense && !editingRecurrenceId)) && (
                    <Button variant="destructive" type="button" onClick={handleDeleteInstance}>
                        Delete Expense
                    </Button>
                )}
                {editingRecurrenceId && (
                    <Button variant="destructive" type="button" onClick={handleDeleteTemplate}>
                        Delete Expense
                    </Button>
                )}
            </div>
            <div className="flex flex-row flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={handleClose} type="button">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} type="submit">
                    {submitLabel}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={handleClose}
                size="2xl"
                title={isSubmittingRecurring
                    ? `Submit ${editingExpense?.title || 'recurring'} expense`
                    : (editingRecurrenceId && !editingExpense
                        ? 'Edit Recurring Expense'
                        : (editingExpense ? 'Edit Expense' : 'New Expense'))
                }
                footer={modalFooter}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {editingRecurrenceId && (
                        <Notice
                            title="Editing recurring expense"
                            description="Changes apply to future expenses only."
                        />
                    )}

                    {editingExpense?.billingStatus === 'billed' && (
                        <Notice
                            title="Expense is billed"
                            description="This expense is attached to an invoice. Editing won't update that invoice."
                        />
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {!isSubmittingRecurring && (
                            <>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                        value={formData.isRecurring ? 'recurring' : 'one-time'}
                                        onValueChange={handleExpenseTypeChange}
                                        disabled={typeSelectionLocked}
                                    >
                                        <SelectTrigger aria-label="Expense type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="one-time">One-time</SelectItem>
                                            <SelectItem value="recurring">Recurring</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.isRecurring ? (
                                    <div className="space-y-2">
                                        <Label>Repeat</Label>
                                        <RecurringPicker
                                            value={recurringPickerValue}
                                            onChange={handleRecurringConfigChange}
                                            onClear={handleRecurringClear}
                                            disabled={recurringFieldsLocked}
                                            buttonClassName="w-full"
                                            inactiveVariant="ghost"
                                            inactiveClassName="border border-input bg-transparent"
                                            allowedTypes={['monthly', 'yearly']}
                                            monthlyMode="full"
                                        />
                                    </div>
                                ) : (
                                    <div className="hidden md:block" aria-hidden="true" />
                                )}
                            </>
                        )}
                        {!isSubmittingRecurring && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="expense-title">Title <span className="text-destructive-strong">*</span></Label>
                                    <Input
                                        id="expense-title"
                                        ref={titleInputRef}
                                        value={formData.title}
                                        onChange={(event) => handleChange('title', event.target.value)}
                                        placeholder="Enter expense title"
                                    />
                                </div>
                                {showOneTimeFields ? (
                                <div className="space-y-2">
                                    <Label htmlFor="expense-date">Date <span className="text-destructive-strong">*</span></Label>
                                    <Input
                                        id="expense-date"
                                        type="date"
                                        value={formData.date}
                                        onChange={(event) => handleChange('date', event.target.value)}
                                        className="dark:[color-scheme:dark]"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="expense-end">End Date</Label>
                                    <Input
                                        id="expense-end"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(event) => handleChange('endDate', event.target.value)}
                                        disabled={recurringFieldsLocked}
                                        className="dark:[color-scheme:dark]"
                                    />
                                </div>
                            )}
                        </>
                    )}
                    {showRecurringFields && (
                        <div className="space-y-2">
                            <Label>Amount Type</Label>
                            <Select
                                value={formData.amountType}
                                onValueChange={(value) => handleChange('amountType', value)}
                                disabled={recurringFieldsLocked}
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
                    )}
                    {showRecurringFields && (
                        <div className="space-y-2">
                            <Label htmlFor="expense-paid-by-recurring">Payment Method</Label>
                            <Select
                                value={resolvedPaidBy}
                                onValueChange={(value) => handleChange('paidBy', value)}
                            >
                                <SelectTrigger id="expense-paid-by-recurring">
                                    <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {paymentMethods.length > 0 ? (
                                        <SelectGroup>
                                            <SelectLabel>Payment methods</SelectLabel>
                                            {paymentMethods.map((method) => (
                                                <SelectItem key={method.id} value={method.id}>
                                                    {method.title || method.name || 'Untitled'}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ) : (
                                        <SelectGroup>
                                            <SelectLabel>No payment methods found</SelectLabel>
                                        </SelectGroup>
                                    )}
                                    <SelectGroup>
                                        <SelectLabel>Other methods</SelectLabel>
                                        <SelectItem value="card">Card</SelectItem>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="credits">Credits</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <div className="pt-2">
                                <CustomCheckbox
                                    checked={formData.paymentMode === 'auto'}
                                    onChange={(checked) => {
                                        handleChange('paymentMode', checked ? 'auto' : 'manual');
                                        if (checked && formData.paidOn) {
                                            handleChange('paidOn', '');
                                        }
                                    }}
                                    label="Auto-payment"
                                />
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="expense-amount">
                            {isSubmittingRecurring
                                ? 'Amount '
                                : (formData.isRecurring && formData.amountType === 'variable'
                                    ? 'Amount (recurring estimate)'
                                    : 'Amount ')}
                            {!(formData.isRecurring && formData.amountType === 'variable') && (
                                <span className="text-destructive-strong">*</span>
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
                        <CurrencySelect
                            value={formData.currency}
                            onValueChange={(value) => handleChange('currency', value)}
                        />
                    </div>
                    {!isSubmittingRecurring && (
                        <div className="space-y-2">
                            <Label htmlFor="expense-supplier">Supplier / Business</Label>
                            <Input
                                id="expense-supplier"
                                value={formData.supplierName}
                                onChange={(event) => handleChange('supplierName', event.target.value)}
                                placeholder="Supplier name"
                            />
                        </div>
                    )}
                    {showOneTimeFields && (
                        <div className="space-y-2">
                            <Label htmlFor="expense-receipt">Receipt / Invoice #</Label>
                            <Input
                                id="expense-receipt"
                                value={formData.receiptNumber}
                                onChange={(event) => handleChange('receiptNumber', event.target.value)}
                                placeholder="Receipt number"
                            />
                        </div>
                    )}
                    {(isSubmittingRecurring || !formData.isRecurring) && (
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="expense-note">Note</Label>
                            <Textarea
                                id="expense-note"
                                value={formData.note}
                                onChange={(event) => handleChange('note', event.target.value)}
                                placeholder="Optional note"
                            />
                        </div>
                    )}
                </div>

                {showOneTimeFields && (
                    <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground">Payment</div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {!isSubmittingRecurring && (
                                <div className="md:col-span-2">
                                    <CustomCheckbox
                                        checked={formData.paymentMode === 'auto'}
                                        onChange={(checked) => {
                                            handleChange('paymentMode', checked ? 'auto' : 'manual');
                                            if (checked && formData.paidOn) {
                                                handleChange('paidOn', '');
                                            }
                                        }}
                                        label="Auto-payment"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="expense-paid-on">Paid On</Label>
                                <Input
                                    id="expense-paid-on"
                                    type="date"
                                    value={formData.paidOn}
                                    onChange={(event) => handleChange('paidOn', event.target.value)}
                                    disabled={formData.paymentMode === 'auto'}
                                    className="dark:[color-scheme:dark]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expense-paid-by">Payment Method</Label>
                                <Select
                                    value={resolvedPaidBy}
                                    onValueChange={(value) => handleChange('paidBy', value)}
                                >
                                    <SelectTrigger id="expense-paid-by">
                                        <SelectValue placeholder="Select payment method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paymentMethods.length > 0 ? (
                                            <SelectGroup>
                                                <SelectLabel>My payment methods</SelectLabel>
                                                {paymentMethods.map((method) => (
                                                    <SelectItem key={method.id} value={method.id}>
                                                        {method.title || method.name || 'Untitled'}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ) : (
                                            <SelectGroup>
                                                <SelectLabel>No payment methods found</SelectLabel>
                                            </SelectGroup>
                                        )}
                                        <SelectGroup>
                                            <SelectLabel>Other methods</SelectLabel>
                                            <SelectItem value="card">Card</SelectItem>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="credits">Credits</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                {!isSubmittingRecurring && (
                    <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground">Assignment</div>
                        <div className="flex flex-wrap gap-4">
                            <CustomCheckbox
                                checked={!formData.isPersonal}
                                onChange={handleBusinessToggle}
                                disabled={isProjectContextFixed}
                                label="Business Expense"
                            />
                            {!formData.isPersonal && (
                                <CustomCheckbox
                                    checked={formData.billable}
                                    onChange={(checked) => handleChange('billable', checked)}
                                    label="Billable"
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {!formData.isPersonal && (
                                <div className="space-y-2">
                                    <Label htmlFor="expense-client">Client</Label>
                                    <Select
                                        value={formData.clientId === NO_CLIENT_VALUE ? '' : formData.clientId}
                                        onValueChange={handleClientChange}
                                        disabled={isProjectContextFixed}
                                    >
                                        <SelectTrigger id="expense-client">
                                            <SelectValue placeholder="Select client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {formData.clientId !== NO_CLIENT_VALUE && (
                                                <SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>
                                            )}
                                            {activeClients.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="expense-project">Project</Label>
                                <Select
                                    value={formData.projectId === NO_PROJECT_VALUE ? '' : formData.projectId}
                                    onValueChange={handleProjectChange}
                                    disabled={isProjectContextFixed}
                                >
                                    <SelectTrigger id="expense-project">
                                        <SelectValue placeholder="Select project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formData.projectId !== NO_PROJECT_VALUE && (
                                            <SelectItem value={NO_PROJECT_VALUE}>No project</SelectItem>
                                        )}
                                        {availableProjects.map((project) => (
                                            <SelectItem key={project.id} value={project.id}>
                                                {project.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {!formData.isPersonal && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Business</Label>
                                    <Select
                                        value={formData.businessId || ''}
                                        onValueChange={handleBusinessChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select business" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {formData.businessId && (
                                                <SelectItem value={NO_BUSINESS_VALUE}>No business</SelectItem>
                                            )}
                                            {businessInfos.length > 0 ? (
                                                businessInfos.map((info) => (
                                                    <SelectItem key={info.id} value={info.id}>
                                                        {info.title || info.name || info.businessName || 'Untitled business'}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="no-business-found" disabled>
                                                    No businesses found
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="hidden md:block" aria-hidden="true" />
                                <div className="space-y-2">
                                    <Label>
                                        Tax No <span className="text-xs text-muted-foreground">(from selected business)</span>
                                    </Label>
                                    <div className="flex min-h-9 items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                                        <span className={selectedBusiness?.taxNumber ? 'text-foreground' : 'text-muted-foreground'}>
                                            {formData.businessId
                                                ? (selectedBusiness?.taxNumber || 'No tax no available in this business.')
                                                : 'Select a business to see tax no.'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex min-h-9 items-center pt-1 md:mt-6 md:pt-0">
                                    <CustomCheckbox
                                        checked={formData.isTaxExempt}
                                        onChange={(checked) => handleChange('isTaxExempt', checked)}
                                        disabled={!formData.businessId}
                                        label="Tax Exempt"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </Modal>

        <Modal
            isOpen={confirmDialog === 'delete-recurrence'}
            onClose={() => setConfirmDialog(null)}
            title="Delete recurring expense?"
            size="md"
            footer={(
                <div className="flex flex-row flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={confirmDeleteRecurrence}>
                        Delete
                    </Button>
                </div>
            )}
        >
            <Notice
                title={formData.title ? `Deleting "${formData.title}" cannot be undone.` : 'Deleting this recurring expense cannot be undone.'}
                description="Existing expenses already created from this recurrence will remain."
                variant="destructive"
            />
        </Modal>

        <Modal
            isOpen={confirmDialog === 'delete-instance'}
            onClose={() => setConfirmDialog(null)}
            title="Delete expense?"
            size="md"
            footer={(
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={confirmDeleteInstance}>
                        Delete
                    </Button>
                </div>
            )}
        >
            <Notice
                title={editingExpense?.title
                    ? `Deleting "${editingExpense.title}" cannot be undone.`
                    : 'Deleting this expense cannot be undone.'}
                variant="destructive"
            />
        </Modal>
        </>
    );
};

export default ExpenseModal;
