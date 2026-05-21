/**
 * ExpenseModal component - Modal for creating and editing expenses
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
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
import { useExpenseCategories } from '../../hooks/useExpenseCategories.ts';
import { usePreferences } from '../../hooks/usePreferences.ts';
import { usePaymentMethods } from '../../hooks/usePaymentMethods.ts';
import { buildExpenseFromRecurrence } from '@/utils/expenseUtils';
import { DEFAULT_CURRENCY } from '@/utils/currencyUtils.ts';
import { toStorageDate } from '@/utils/dateUtils.ts';
import { parseOptionalNumberInput } from '@/utils/numberInputUtils.ts';

const NO_CLIENT_VALUE = 'no-client';
const NO_PROJECT_VALUE = 'no-project';
const NO_BUSINESS_VALUE = 'no-business';
const NO_CATEGORY_VALUE = 'no-category';
const DEFAULT_REPEAT = 'monthly';
const DEFAULT_AMOUNT_TYPE = 'fixed';
const SUGGESTION_LIMIT = 6;

const hasSelectedClient = (clientId) => Boolean(clientId && clientId !== NO_CLIENT_VALUE);
const hasSelectedProject = (projectId) => Boolean(projectId && projectId !== NO_PROJECT_VALUE);

const getBusinessTaxLabel = (businessInfo) => businessInfo?.taxLabel || 'Tax';

const calculateAmountExcludingTax = (amountValue, taxRateValue) => {
    const amount = parseOptionalNumberInput(amountValue);
    const taxRate = parseOptionalNumberInput(taxRateValue);

    if (amount === null || amount <= 0 || taxRate === null || taxRate < 0) {
        return '';
    }

    const divisor = 1 + (taxRate / 100);

    if (divisor <= 0) {
        return '';
    }

    return (amount / divisor).toFixed(2);
};

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const taxAmountsMatchTotal = (amountValue, amountExcludingTaxValue, taxRateValue) => {
    const total = parseOptionalNumberInput(amountValue);
    const amountExcludingTax = parseOptionalNumberInput(amountExcludingTaxValue);
    const taxRate = parseOptionalNumberInput(taxRateValue);

    if (total === null || amountExcludingTax === null || taxRate === null) {
        return false;
    }

    const calculatedTotal = amountExcludingTax * (1 + (taxRate / 100));

    return roundMoney(calculatedTotal) === roundMoney(total);
};

const buildTaxFormFields = (businessInfo, existingFields = {}) => {
    if (!businessInfo?.taxEnabled) {
        return {
            amountExcludingTax: existingFields.amountExcludingTax ?? '',
            taxLabel: '',
            taxRate: '',
        };
    }

    const existingTaxRate = existingFields.taxRate;
    const hasExistingTaxRate = existingTaxRate !== undefined && existingTaxRate !== null && existingTaxRate !== '';
    const resolvedTaxRate = hasExistingTaxRate ? existingTaxRate : businessInfo.taxRate ?? 0;
    const existingAmountExcludingTax = existingFields.amountExcludingTax;
    const hasExistingAmountExcludingTax = existingAmountExcludingTax !== undefined
        && existingAmountExcludingTax !== null
        && existingAmountExcludingTax !== '';

    return {
        amountExcludingTax: hasExistingAmountExcludingTax
            ? existingAmountExcludingTax
            : calculateAmountExcludingTax(existingFields.amount, resolvedTaxRate),
        taxLabel: existingFields.taxLabel || getBusinessTaxLabel(businessInfo),
        taxRate: String(resolvedTaxRate),
    };
};

const normalizeSuggestionValue = (value) => value.trim().replace(/\s+/g, ' ');

const toSuggestionTimestamp = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (value instanceof Date) {
        const timestamp = value.getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    if (typeof value === 'string' && value.trim()) {
        const timestamp = Date.parse(value);
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    return 0;
};

const compareSuggestionDates = (left, right) => {
    if (left.sortTimestamp !== right.sortTimestamp) {
        return right.sortTimestamp - left.sortTimestamp;
    }

    return right.latestIndex - left.latestIndex;
};

const buildExpenseHistorySuggestions = (expenses, field) => {
    const suggestions = new Map();

    expenses.forEach((expense, index) => {
        const rawValue = typeof expense?.[field] === 'string' ? expense[field] : '';
        const value = normalizeSuggestionValue(rawValue);

        if (!value) {
            return;
        }

        const key = value.toLowerCase();
        const sortTimestamp = toSuggestionTimestamp(expense.updatedAt ?? expense.date ?? expense.createdAt);
        const existing = suggestions.get(key);

        if (!existing) {
            suggestions.set(key, {
                value,
                sortTimestamp,
                latestIndex: index,
            });
            return;
        }

        const nextEntry = {
            value,
            sortTimestamp,
            latestIndex: index,
        };

        if (compareSuggestionDates(nextEntry, existing) < 0) {
            return;
        }

        suggestions.set(key, nextEntry);
    });

    return Array.from(suggestions.values()).sort(compareSuggestionDates);
};

const getSuggestionMatchScore = (suggestionValue, query) => {
    if (!query) {
        return 0;
    }

    if (suggestionValue === query) {
        return 4;
    }

    if (suggestionValue.startsWith(query)) {
        return 3;
    }

    if (suggestionValue.split(/\s+/).some((part) => part.startsWith(query))) {
        return 2;
    }

    if (suggestionValue.includes(query)) {
        return 1;
    }

    return -1;
};

const rankSuggestions = (suggestions, query) => {
    const normalizedQuery = normalizeSuggestionValue(query || '').toLowerCase();

    return suggestions
        .map((suggestion) => ({
            ...suggestion,
            matchScore: getSuggestionMatchScore(suggestion.value.toLowerCase(), normalizedQuery),
        }))
        .filter((suggestion) => suggestion.matchScore >= 0)
        .sort((left, right) => {
            if (left.matchScore !== right.matchScore) {
                return right.matchScore - left.matchScore;
            }

            return compareSuggestionDates(left, right);
        })
        .slice(0, SUGGESTION_LIMIT);
};

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
    categoryId: '',
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
    amountExcludingTax: '',
    taxLabel: '',
    taxRate: '',
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
        ...buildTaxFormFields(selectedBusinessInfo, {
            amountExcludingTax: nextIsPersonal ? '' : nextFormData.amountExcludingTax,
            taxLabel: nextIsPersonal ? '' : nextFormData.taxLabel,
            taxRate: nextIsPersonal ? '' : nextFormData.taxRate,
        }),
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
    const { expenses, createExpense, updateExpense, deleteExpense } = useExpenses({ includeArchived: true });
    const { createRecurrence, getRecurrence, updateRecurrence, deleteRecurrence } = useExpenseRecurrences();
    const { clients } = useClients();
    const { projects, getProjectsByClient } = useProjects();
    const { businessInfos, defaultBusinessInfo } = useBusinessInfos();
    const { expenseCategories } = useExpenseCategories({ seedDefaults: true });
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
    const [activeSuggestionField, setActiveSuggestionField] = useState(null);
    const titleInputRef = useRef(null);
    const oneTimePaymentModeOverrideRef = useRef(null);

    const getDefaultOneTimePaymentState = useCallback((dateValue) => {
        const resolvedDate = dateValue || todayString;
        const shouldAutoPay = Boolean(resolvedDate) && resolvedDate === todayString;

        return {
            paymentMode: shouldAutoPay ? 'auto' : 'manual',
            paidOn: shouldAutoPay ? resolvedDate : '',
        };
    }, [todayString]);

    const resolveNewOneTimePaymentState = useCallback((dateValue) => {
        const resolvedDate = dateValue || todayString;

        if (oneTimePaymentModeOverrideRef.current === 'auto') {
            return {
                paymentMode: 'auto',
                paidOn: resolvedDate,
            };
        }

        if (oneTimePaymentModeOverrideRef.current === 'manual') {
            return {
                paymentMode: 'manual',
                paidOn: '',
            };
        }

        return getDefaultOneTimePaymentState(resolvedDate);
    }, [getDefaultOneTimePaymentState, todayString]);

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
            const initialTaxFields = isPersonal
                ? buildTaxFormFields(null)
                : buildTaxFormFields(resolvedBusiness, {
                    amountExcludingTax: editingExpense.amountExcludingTax != null
                        ? String(editingExpense.amountExcludingTax)
                        : '',
                    taxLabel: editingExpense.taxLabel || '',
                    taxRate: editingExpense.taxRate != null ? String(editingExpense.taxRate) : undefined,
                });

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
                    categoryId: editingExpense.categoryId || '',
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
                    ...initialTaxFields,
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
            const initialTaxFields = isPersonal
                ? buildTaxFormFields(null)
                : buildTaxFormFields(resolvedBusiness, {
                    amountExcludingTax: recurrence.amountExcludingTax != null
                        ? String(recurrence.amountExcludingTax)
                        : '',
                    taxLabel: recurrence.taxLabel || '',
                    taxRate: recurrence.taxRate != null ? String(recurrence.taxRate) : undefined,
                });

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
                    categoryId: recurrence.categoryId || '',
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
                    ...initialTaxFields,
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
        const initialDate = modalOptions?.date || todayString;
        const defaultPaidBy = defaultPaymentMethod?.id || '';
        const defaultBusinessId = isPersonal ? '' : (defaultBusinessInfo?.id || '');
        const defaultBusiness = businessInfos.find((info) => info.id === defaultBusinessId);
        const defaultTaxNumber = isPersonal ? '' : (defaultBusiness?.taxNumber || '');
        const defaultTaxFields = isPersonal ? buildTaxFormFields(null) : buildTaxFormFields(defaultBusiness);
        const initialOneTimePaymentState = shouldStartRecurring
            ? { paymentMode: 'manual', paidOn: '' }
            : resolveNewOneTimePaymentState(initialDate);

        return {
            key: draftStateKey,
            formData: applyScopedProjectContext({
                ...emptyFormData,
                date: initialDate,
                currency: defaultCurrency,
                paidOn: initialOneTimePaymentState.paidOn,
                paidBy: defaultPaidBy,
                paymentMode: initialOneTimePaymentState.paymentMode,
                clientId: initialClientId,
                projectId: initialProjectId,
                businessId: defaultBusinessId,
                isPersonal,
                isRecurring: shouldStartRecurring,
                startDate: initialDate,
                taxNumber: defaultTaxNumber,
                ...defaultTaxFields,
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
        resolveNewOneTimePaymentState,
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

    useEffect(() => {
        oneTimePaymentModeOverrideRef.current = null;
    }, [draftStateKey]);

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

    const titleHistorySuggestions = useMemo(() => buildExpenseHistorySuggestions(expenses, 'title'), [expenses]);
    const supplierHistorySuggestions = useMemo(() => buildExpenseHistorySuggestions(expenses, 'supplierName'), [expenses]);
    const visibleTitleSuggestions = useMemo(() => rankSuggestions(titleHistorySuggestions, formData.title), [formData.title, titleHistorySuggestions]);
    const visibleSupplierSuggestions = useMemo(() => rankSuggestions(supplierHistorySuggestions, formData.supplierName), [formData.supplierName, supplierHistorySuggestions]);
    const showTitleSuggestions = activeSuggestionField === 'title' && visibleTitleSuggestions.length > 0;
    const showSupplierSuggestions = activeSuggestionField === 'supplierName' && visibleSupplierSuggestions.length > 0;

    const selectedBusiness = formData.isPersonal || !formData.businessId
        ? null
        : (businessInfos.find((info) => info.id === formData.businessId) || null);
    const showExpenseTaxFields = Boolean(selectedBusiness?.taxEnabled) && !formData.isTaxExempt;
    const expenseTaxLabel = getBusinessTaxLabel(selectedBusiness);

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleAmountChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            amount: value,
            amountExcludingTax: showExpenseTaxFields
                ? calculateAmountExcludingTax(value, prev.taxRate)
                : prev.amountExcludingTax,
        }));
    };

    const handleTaxRateChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            taxRate: value,
            amountExcludingTax: showExpenseTaxFields
                ? calculateAmountExcludingTax(prev.amount, value)
                : prev.amountExcludingTax,
        }));
    };

    const handleSuggestionSelect = (field, value) => {
        handleChange(field, value);
        setActiveSuggestionField(null);
    };

    const handleBusinessChange = (value) => {
        const nextId = !value || value === NO_BUSINESS_VALUE ? '' : value;
        const selected = businessInfos.find((info) => info.id === nextId);

        setFormData((prev) => ({
            ...prev,
            businessId: nextId,
            taxNumber: selected?.taxNumber || '',
            ...buildTaxFormFields(selected, {
                amount: prev.amount,
            }),
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
                amountExcludingTax: '',
                taxLabel: '',
                taxRate: '',
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
            taxNumber: prev.businessId ? prev.taxNumber : (selected?.taxNumber || ''),
            ...buildTaxFormFields(prev.businessId ? businessInfos.find((info) => info.id === prev.businessId) : selected, {
                amount: prev.amount,
                taxLabel: prev.taxLabel,
                taxRate: prev.taxRate,
            }),
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

            const nextDate = prev.date || todayString;

            if (!editingExpense && !editingRecurrenceId) {
                const nextPaymentState = resolveNewOneTimePaymentState(nextDate);

                return {
                    ...prev,
                    isRecurring: false,
                    date: nextDate,
                    paidOn: nextPaymentState.paidOn,
                    paidBy: prev.paidBy || '',
                    paymentMode: nextPaymentState.paymentMode,
                };
            }

            return {
                ...prev,
                isRecurring: false,
                date: nextDate,
                paidOn: prev.paymentMode === 'auto' ? nextDate : (prev.paidOn || ''),
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

        const nextPaymentState = resolveNewOneTimePaymentState(todayString);

        setFormData((prev) => ({
            ...prev,
            isRecurring: false,
            paymentMode: nextPaymentState.paymentMode,
            paidOn: nextPaymentState.paidOn,
            repeat: DEFAULT_REPEAT,
            startDate: todayString,
            monthlyType: 'first',
            monthlyDay: 1,
        }));
    };

    const handleOneTimeDateChange = (value) => {
        setFormData((prev) => {
            const nextDate = value;
            const nextFormData = {
                ...prev,
                date: nextDate,
            };

            if (!prev.isRecurring && !editingExpense && !editingRecurrenceId) {
                const nextPaymentState = resolveNewOneTimePaymentState(nextDate);

                nextFormData.paymentMode = nextPaymentState.paymentMode;
                nextFormData.paidOn = nextPaymentState.paidOn;
                return nextFormData;
            }

            if (!prev.isRecurring && prev.paymentMode === 'auto') {
                nextFormData.paidOn = nextDate || '';
            }

            return nextFormData;
        });
    };

    const handleOneTimePaymentModeChange = (checked) => {
        oneTimePaymentModeOverrideRef.current = checked ? 'auto' : 'manual';

        setFormData((prev) => ({
            ...prev,
            paymentMode: checked ? 'auto' : 'manual',
            paidOn: checked ? (prev.date || todayString) : '',
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

        if (!formData.isPersonal && !formData.businessId) {
            showError('Business is required for business expenses');
            return;
        }

        if (formData.billable && !hasSelectedClient(formData.clientId)) {
            showError('Client is required for billable expenses');
            return;
        }

        if (showExpenseTaxFields && !isVariable) {
            if (!taxAmountsMatchTotal(formData.amount, formData.amountExcludingTax, formData.taxRate)) {
                showError(`Total amount must match Amount (excl. ${expenseTaxLabel}) plus ${expenseTaxLabel}`);
                return;
            }
        }

        const effectiveDate = showOneTimeFields ? formData.date : formData.startDate;
        const effectiveBusinessId = !formData.isPersonal ? (formData.businessId || null) : null;
        const effectiveTaxNumber = !formData.isPersonal ? (selectedBusiness?.taxNumber || null) : null;
        const amountExcludingTaxValue = parseOptionalNumberInput(formData.amountExcludingTax);
        const taxRateValue = parseOptionalNumberInput(formData.taxRate);
        const effectiveTaxLabel = showExpenseTaxFields
            ? (formData.taxLabel || getBusinessTaxLabel(selectedBusiness))
            : null;
        const effectiveTaxRate = showExpenseTaxFields
            ? (taxRateValue ?? selectedBusiness?.taxRate ?? 0)
            : null;
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
            clientId: hasSelectedClient(formData.clientId) ? formData.clientId : null,
            projectId: hasSelectedProject(formData.projectId) ? formData.projectId : null,
            businessId: effectiveBusinessId,
            categoryId: formData.categoryId || null,
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
            amountExcludingTax: showExpenseTaxFields ? amountExcludingTaxValue : null,
            taxLabel: effectiveTaxLabel,
            taxRate: effectiveTaxRate,
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
                categoryId: payload.categoryId,
                businessId: payload.businessId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
                amountExcludingTax: payload.amountExcludingTax,
                taxLabel: payload.taxLabel,
                taxRate: payload.taxRate,
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
                categoryId: payload.categoryId,
                businessId: payload.businessId,
                isPersonal: payload.isPersonal,
                billable: payload.billable,
                taxNumber: payload.taxNumber,
                isTaxExempt: payload.isTaxExempt,
                amountExcludingTax: payload.amountExcludingTax,
                taxLabel: payload.taxLabel,
                taxRate: payload.taxRate,
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

    const availableProjects = useMemo(() => {
        if (hasSelectedClient(formData.clientId)) {
            return getProjectsByClient(formData.clientId).filter((project) => !project.archived);
        }

        return activeProjects.filter((project) => project.isPersonal && !project.archived);
    }, [formData.clientId, getProjectsByClient, activeProjects]);

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
                                    <div className="relative">
                                        <Input
                                            id="expense-title"
                                            ref={titleInputRef}
                                            value={formData.title}
                                            onFocus={() => setActiveSuggestionField('title')}
                                            onBlur={() => setActiveSuggestionField((current) => (current === 'title' ? null : current))}
                                            onChange={(event) => handleChange('title', event.target.value)}
                                            placeholder="Enter expense title"
                                            aria-autocomplete="list"
                                            aria-controls="expense-title-suggestions"
                                            aria-expanded={showTitleSuggestions}
                                        />
                                        {showTitleSuggestions && (
                                            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                                                <div id="expense-title-suggestions" role="listbox" aria-label="Recent expense titles">
                                                    {visibleTitleSuggestions.map((suggestion) => (
                                                        <button
                                                            key={suggestion.value}
                                                            type="button"
                                                            role="option"
                                                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => handleSuggestionSelect('title', suggestion.value)}
                                                        >
                                                            {suggestion.value}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {showOneTimeFields ? (
                                    <div className="grid grid-cols-2 gap-4 md:contents">
                                        <div className="space-y-2">
                                            <Label htmlFor="expense-date">Date <span className="text-destructive-strong">*</span></Label>
                                            <NativeDateInput
                                                id="expense-date"
                                                value={formData.date}
                                                onChange={(event) => handleOneTimeDateChange(event.target.value)}
                                                className="dark:[color-scheme:dark]"
                                            />
                                        </div>
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
                                                onChange={(event) => handleAmountChange(event.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="expense-end">End Date</Label>
                                        <NativeDateInput
                                            id="expense-end"
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
                    {isSubmittingRecurring && (
                        <div className="space-y-2">
                            <Label htmlFor="expense-amount">
                                Amount <span className="text-destructive-strong">*</span>
                            </Label>
                            <Input
                                id="expense-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.amount}
                                onChange={(event) => handleAmountChange(event.target.value)}
                                placeholder="0.00"
                            />
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
                    {!showOneTimeFields && (
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
                                onChange={(event) => handleAmountChange(event.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    )}
                    {!isSubmittingRecurring ? (
                        <div className="grid grid-cols-2 gap-4 md:contents">
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <CurrencySelect
                                    value={formData.currency}
                                    onValueChange={(value) => handleChange('currency', value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expense-supplier">Supplier / Business</Label>
                                <div className="relative">
                                    <Input
                                        id="expense-supplier"
                                        value={formData.supplierName}
                                        onFocus={() => setActiveSuggestionField('supplierName')}
                                        onBlur={() => setActiveSuggestionField((current) => (current === 'supplierName' ? null : current))}
                                        onChange={(event) => handleChange('supplierName', event.target.value)}
                                        placeholder="Supplier name"
                                        aria-autocomplete="list"
                                        aria-controls="expense-supplier-suggestions"
                                        aria-expanded={showSupplierSuggestions}
                                    />
                                    {showSupplierSuggestions && (
                                        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                                            <div id="expense-supplier-suggestions" role="listbox" aria-label="Recent suppliers">
                                                {visibleSupplierSuggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion.value}
                                                        type="button"
                                                        role="option"
                                                        className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => handleSuggestionSelect('supplierName', suggestion.value)}
                                                    >
                                                        {suggestion.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <CurrencySelect
                                value={formData.currency}
                                onValueChange={(value) => handleChange('currency', value)}
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
                                        onChange={handleOneTimePaymentModeChange}
                                        label="Automatically paid on expense date"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="expense-paid-on">Paid On</Label>
                                <NativeDateInput
                                    id="expense-paid-on"
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
                            {!formData.isPersonal && (
                                <div className="space-y-2">
                                    <Label htmlFor="expense-business">Business</Label>
                                    <Select
                                        value={formData.businessId || ''}
                                        onValueChange={handleBusinessChange}
                                    >
                                        <SelectTrigger id="expense-business">
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
                            )}
                            <div className={`space-y-2 ${!formData.isPersonal ? 'md:col-span-2' : ''}`}>
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
                            <div className={`space-y-2 ${!formData.isPersonal ? 'md:col-span-2' : ''}`}>
                                <Label htmlFor="expense-category">Category</Label>
                                <Select
                                    value={formData.categoryId || ''}
                                    onValueChange={(value) => handleChange('categoryId', value === NO_CATEGORY_VALUE ? '' : value)}
                                >
                                    <SelectTrigger id="expense-category">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formData.categoryId && (
                                            <SelectItem value={NO_CATEGORY_VALUE}>No category</SelectItem>
                                        )}
                                        {expenseCategories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {showExpenseTaxFields && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="expense-tax-rate">{expenseTaxLabel} (%)</Label>
                                        <Input
                                            id="expense-tax-rate"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={formData.taxRate}
                                            onChange={(event) => handleTaxRateChange(event.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="expense-amount-excluding-tax">
                                            Amount (excl. {expenseTaxLabel})
                                        </Label>
                                        <Input
                                            id="expense-amount-excluding-tax"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.amountExcludingTax}
                                            onChange={(event) => handleChange('amountExcludingTax', event.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        {!formData.isPersonal && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                        onChange={(checked) => {
                                            setFormData((prev) => {
                                                if (checked) {
                                                    return {
                                                        ...prev,
                                                        isTaxExempt: true,
                                                        amountExcludingTax: '',
                                                        taxLabel: '',
                                                        taxRate: '',
                                                    };
                                                }

                                                return {
                                                    ...prev,
                                                    isTaxExempt: false,
                                                    ...buildTaxFormFields(selectedBusiness, {
                                                        amount: prev.amount,
                                                    }),
                                                };
                                            });
                                        }}
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
