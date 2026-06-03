import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { buildInvoiceHtmlContent, generatePDF, getCurrentInvoiceHtmlContent } from '../utils/pdfUtils.ts';
import { toStorageDate, timestampToDateString } from '../utils/dateUtils.ts';
import {
    DEFAULT_INVOICE_LAYOUT_STYLE,
    DEFAULT_INVOICE_LOGO_PLACEMENT,
    normalizeInvoiceLayoutStyle,
    normalizeInvoiceLogoPlacement,
} from '../utils/invoiceBranding.ts';
import { getCurrencySymbol, getPreferredCurrency, fetchExchangeRates, convertCurrency, normalizeCurrencyCode } from '../utils/currencyUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import InvoiceModal from './invoice/InvoiceModal';
import InvoiceGeneratorButton from './invoice/InvoiceGeneratorButton';
import InvoicePreviewModal from './invoice/InvoicePreviewModal';
import EmailPreviewModal from './invoice/EmailPreviewModal';
import Modal from './Modal';
import * as InvoiceHandler from './invoice/InvoiceHandler.ts';
import useInvoicePricing from './invoice/hooks/useInvoicePricing.ts';
import { calculateDueDate, generateInvoiceNumber } from './invoice/utils/invoiceDateUtils.ts';
import { buildInvoiceTaskData } from './invoice/InvoiceCalculations.ts';
import { orderTasksWithSubtasks } from './invoice/utils/taskOrdering.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useInvoiceTemplates } from '../hooks/useInvoiceTemplates.ts';
import { useBusinessBrandAssets } from '../hooks/useBusinessBrandAssets.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import {
    getInvoicesForProject,
    getInvoiceSequenceRollback,
    getInvoiceTotal,
    getLatestInvoiceForProject,
    getNextSequentialNumberForTemplate,
    resolveCurrentInvoiceTemplate,
} from '../utils/invoiceUtils.ts';
import { getProjectInvoicePreview } from '../utils/invoicePreviewUtils.ts';
import {
    buildProjectQuoteLineItems,
    buildQuoteDocumentData,
    getQuoteNumberTimestamp,
    getQuoteDownloadFilename,
} from '../utils/quoteUtils.ts';
import {
    getBillingPeriodRange,
    getDefaultInvoiceBillingPeriodState,
    getStoredInvoiceBillingPeriodState,
    INVOICE_BILLING_PERIOD_OPTIONS,
    isStoredDateWithinBillingRange,
} from '../utils/billingPeriodUtils.ts';
import { getClientHourlyRate } from '../utils/projectPlanningUtils.ts';

const INVOICE_DRAFT_CACHE = new Map();
const INVOICE_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const areBooleanMapsEqual = (left, right) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key) => left[key] === right[key]);
};

const areNumberMapsEqual = (left, right) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key) => left[key] === right[key]);
};

const areInvoiceTaskListsEqual = (left, right) => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((task, index) => {
        const otherTask = right[index];

        return otherTask
            && task.id === otherTask.id
            && task.projectId === otherTask.projectId
            && task.projectTitle === otherTask.projectTitle
            && task.projectHourlyRate === otherTask.projectHourlyRate
            && task.projectFlatRate === otherTask.projectFlatRate
            && task.title === otherTask.title
            && task.parentTaskId === otherTask.parentTaskId
            && task.originalHours === otherTask.originalHours
            && task.originalTimeMs === otherTask.originalTimeMs
            && task.hours === otherTask.hours
            && task.flatRate === otherTask.flatRate
            && task.hourlyRate === otherTask.hourlyRate
            && task.useFlatRate === otherTask.useFlatRate
            && task.quantity === otherTask.quantity
            && task.isEdited === otherTask.isEdited
            && task.billable === otherTask.billable;
    });
};

const mergeEditingInvoiceTasks = (liveInvoiceTasks, editingInvoice) => {
    const savedInvoiceTasks = (editingInvoice?.tasks || []).filter((task) => task?.id);

    if (savedInvoiceTasks.length === 0) {
        return liveInvoiceTasks;
    }

    const liveTaskMap = new Map(liveInvoiceTasks.map((task) => [task.id, task]));
    const savedTaskIds = new Set(savedInvoiceTasks.map((task) => task.id));

    const mergedSavedTasks = savedInvoiceTasks.map((savedTask) => {
        const liveTask = liveTaskMap.get(savedTask.id) || {};

        return {
            ...liveTask,
            ...savedTask,
            projectId: savedTask.projectId || liveTask.projectId || null,
            projectTitle: savedTask.projectTitle || liveTask.projectTitle || '',
            projectHourlyRate: savedTask.projectHourlyRate ?? liveTask.projectHourlyRate ?? 0,
            projectFlatRate: savedTask.projectFlatRate === true || liveTask.projectFlatRate === true,
            parentTaskId: savedTask.parentTaskId ?? liveTask.parentTaskId ?? null,
            originalHours: savedTask.originalHours ?? savedTask.hours ?? liveTask.originalHours ?? 0,
            originalTimeMs: savedTask.originalTimeMs ?? liveTask.originalTimeMs ?? 0,
            hours: savedTask.hours ?? liveTask.hours ?? savedTask.originalHours ?? 0,
            isEdited: savedTask.isEdited ?? false,
            billable: savedTask.billable ?? liveTask.billable ?? true,
        };
    });

    return [
        ...mergedSavedTasks,
        ...liveInvoiceTasks.filter((task) => !savedTaskIds.has(task.id)),
    ];
};

const getFinitePositiveNumber = (value) => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

const isSameCurrencyAmount = (left, right) => {
    return Math.abs(left - right) < 0.005;
};

const getCurrentQuotedFlatAmount = (task) => {
    const currentQuotedAmount = getFinitePositiveNumber(task?.estimatedFlatAmount);

    if (currentQuotedAmount === null) {
        return null;
    }

    const billedQuotedAmount = getFinitePositiveNumber(task?.quotedAmountBilling?.total);

    if (
        task?.quotedAmountBilling?.invoiceId
        && billedQuotedAmount !== null
        && isSameCurrencyAmount(currentQuotedAmount, billedQuotedAmount)
    ) {
        return null;
    }

    return currentQuotedAmount;
};

const isQuotedFlatInvoiceTask = (task) => {
    return task?.useFlatRate === true || task?.projectFlatRate === true;
};

const areProjectsEquivalent = (left, right) => {
    if (left === right) {
        return true;
    }

    if (!left || !right) {
        return false;
    }

    return left.id === right.id
        && left.title === right.title
        && left.hourlyRate === right.hourlyRate
        && left.flatRate === right.flatRate
        && left.preferredClientId === right.preferredClientId
        && left.isPersonal === right.isPersonal
        && left.statusMode === right.statusMode
        && left.deadline === right.deadline
        && left.budgetAmount === right.budgetAmount
        && left.billableTimeIncrementMinutes === right.billableTimeIncrementMinutes
        && left.archived === right.archived;
};

const pruneExpiredInvoiceDrafts = (referenceTime = Date.now()) => {
    INVOICE_DRAFT_CACHE.forEach((draftState, key) => {
        if (!draftState?.savedAt || (referenceTime - draftState.savedAt) > INVOICE_DRAFT_TTL_MS) {
            INVOICE_DRAFT_CACHE.delete(key);
        }
    });
};

const getCachedInvoiceDraft = (contextKey) => {
    if (!contextKey) {
        return null;
    }

    pruneExpiredInvoiceDrafts();
    return INVOICE_DRAFT_CACHE.get(contextKey) || null;
};

const setCachedInvoiceDraft = (contextKey, draftState) => {
    if (!contextKey) {
        return;
    }

    pruneExpiredInvoiceDrafts();
    const previousDraft = INVOICE_DRAFT_CACHE.get(contextKey) || {};
    INVOICE_DRAFT_CACHE.set(contextKey, {
        ...previousDraft,
        ...draftState,
        contextKey,
        savedAt: Date.now(),
    });
};

const clearCachedInvoiceDraft = (contextKey) => {
    if (!contextKey) {
        return;
    }

    INVOICE_DRAFT_CACHE.delete(contextKey);
};

/**
 * InvoiceGenerator component - Handles invoice generation and client info collection
 */
const InvoiceGenerator = ({ 
    project, 
    client, // Add client prop for pre-selection
    timeEntries,
    editingInvoice,
    onInvoiceSaved,
    paymentMethods = [],
    businessInfos = [],
    clients = [],
    showButton = true,
    forceOpenOnMount = false,
    // Modal stacking functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    activeModal = null,
    mode = 'invoice'
}) => {
    const isQuoteMode = mode === 'quote';
    // Yjs hooks for data access
    const { invoices, createInvoice, updateInvoice, undoLatestInvoice, canUndoInvoice } = useInvoices();
    const { projects } = useProjects();
    const { tasks, updateTask } = useTasks();
    const { createEntry, updateEntry, deleteEntry } = useTimeEntries();
    const { expenses, markAsBilled, markAsUnbilled } = useExpenses();
    const { invoiceTemplates, updateInvoiceTemplate } = useInvoiceTemplates();
    const { businessBrandAssets, getBusinessBrandAsset } = useBusinessBrandAssets();
    const { getTimerForProject } = useTimers();
    
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [quoteEmailDocument, setQuoteEmailDocument] = useState(null);
    const [quoteNumberTimestamp, setQuoteNumberTimestamp] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBusinessInfo, setSelectedBusinessInfo] = useState(null);
    const [selectedClient, setSelectedClient] = useState(client); // Initialize with client prop if provided
    const [selectedProject, setSelectedProject] = useState(project); // Initialize with current project
    const [selectedAdditionalProjectIds, setSelectedAdditionalProjectIds] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null); // Selected invoice template
    const [isProjectContextFixed, setIsProjectContextFixed] = useState(!!project && !client); // Track if opened from project context (but not client context)
    const [isClientContextFixed, setIsClientContextFixed] = useState(!!client); // Track if opened from client context
    const [projectManuallyChanged, setProjectManuallyChanged] = useState(false); // Track manual project changes
    const [handledEditingInvoice, setHandledEditingInvoice] = useState(null); // Track handled editing invoice ID
    const { showSuccess, showError, showWarning } = useToast();
    const didAutoOpenModalRef = useRef(false); // Added a ref to track auto-open state
    const taskInputRef = useRef(null); // Ref for task description input field
    const [isHiddenForNestedModal, setIsHiddenForNestedModal] = useState(false);
    const [exchangeRates, setExchangeRates] = useState(null);
    const [exchangeRatesError, setExchangeRatesError] = useState(null);
    const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
    const [showUndoInvoiceConfirm, setShowUndoInvoiceConfirm] = useState(false);
    const [undoInvoiceConfirmationText, setUndoInvoiceConfirmationText] = useState('');
    const [isUndoingInvoice, setIsUndoingInvoice] = useState(false);
    const defaultBillingPeriodState = useMemo(() => getDefaultInvoiceBillingPeriodState(), []);
    const [billingPeriodPreset, setBillingPeriodPreset] = useState(defaultBillingPeriodState.preset);
    const [billingPeriodStart, setBillingPeriodStart] = useState(defaultBillingPeriodState.startDate);
    const [billingPeriodEnd, setBillingPeriodEnd] = useState(defaultBillingPeriodState.endDate);
    const [pendingDraftRestore, setPendingDraftRestore] = useState(null);

    const { startDate: activeBillingPeriodStart, endDate: activeBillingPeriodEnd } = useMemo(() => {
        return getBillingPeriodRange({
            preset: billingPeriodPreset,
            customStart: billingPeriodStart,
            customEnd: billingPeriodEnd,
        });
    }, [billingPeriodEnd, billingPeriodPreset, billingPeriodStart]);

    const selectedProjectIdsForInvoice = useMemo(() => {
        const ids = [];

        if (selectedProject?.id) {
            ids.push(selectedProject.id);
        }

        selectedAdditionalProjectIds.forEach((projectId) => {
            if (projectId && !ids.includes(projectId)) {
                ids.push(projectId);
            }
        });

        return ids;
    }, [selectedAdditionalProjectIds, selectedProject?.id]);

    const selectedProjectsForInvoice = useMemo(() => {
        return selectedProjectIdsForInvoice
            .map((projectId) => {
                if (selectedProject?.id === projectId) {
                    return selectedProject;
                }

                if (project?.id === projectId) {
                    return project;
                }

                return projects.find((item) => item.id === projectId) || null;
            })
            .filter(Boolean);
    }, [project, projects, selectedProject, selectedProjectIdsForInvoice]);

    useEffect(() => {
        setSelectedAdditionalProjectIds((prev) => {
            const next = prev.filter((projectId) => {
                if (!projectId || projectId === selectedProject?.id) {
                    return false;
                }

                const matchingProject = projects.find((item) => item.id === projectId);
                if (!matchingProject) {
                    return false;
                }

                if (!selectedClient?.id) {
                    return true;
                }

                return matchingProject.preferredClientId === selectedClient.id;
            });

            return next.length === prev.length ? prev : next;
        });
    }, [projects, selectedClient?.id, selectedProject?.id]);

    useEffect(() => {
        if (!selectedProject?.id) {
            return;
        }

        const latestSelectedProject = (project?.id === selectedProject.id ? project : null)
            || projects.find((item) => item.id === selectedProject.id)
            || null;

        if (!latestSelectedProject || areProjectsEquivalent(selectedProject, latestSelectedProject)) {
            return;
        }

        setSelectedProject(latestSelectedProject);
    }, [project, projects, selectedProject]);

    useEffect(() => {
        if (!showInvoiceForm) {
            setShowPreview(false);
            setPreviewInvoice(null);

            if (!isHiddenForNestedModal) {
                setQuoteNumberTimestamp('');
            }
        }
    }, [isHiddenForNestedModal, showInvoiceForm]);

    useEffect(() => {
        if (isHiddenForNestedModal && !activeModal) {
            setShowInvoiceForm(true);
            setIsHiddenForNestedModal(false);
        }
    }, [isHiddenForNestedModal, activeModal]);

    const timerProjectId = selectedProject?.id || project?.id;
    const projectTimer = timerProjectId ? getTimerForProject(timerProjectId) : null;
    const isTimerActive = !!projectTimer;
    const isTimerPaused = projectTimer?.isPaused || false;

    // Get project invoices from the new structure - memoized to prevent unnecessary re-renders
    const projectInvoices = useMemo(() => {
        // Use the selected project if available, otherwise fall back to the initially passed project
        const currentProject = selectedProject || project;
        if (!currentProject) {
            return []; // Return empty array if no project is available
        }
        return getInvoicesForProject(invoices, currentProject.id);
    }, [invoices, selectedProject, project]);

    const invoiceCurrency = selectedClient?.defaultCurrency || getPreferredCurrency();
    const normalizedInvoiceCurrency = normalizeCurrencyCode(invoiceCurrency);
    const selectedClientHourlyRate = getClientHourlyRate(selectedClient);

    useEffect(() => {
        let isActive = true;

        const loadRates = async () => {
            setExchangeRatesLoading(true);
            const { rates, error } = await fetchExchangeRates();
            if (!isActive) return;
            setExchangeRates(rates);
            setExchangeRatesError(error);
            setExchangeRatesLoading(false);
        };

        loadRates();

        return () => {
            isActive = false;
        };
    }, []);

    const editingExpenseItemMap = useMemo(() => {
        if (!editingInvoice?.items) return new Map();
        return new Map(
            editingInvoice.items
                .filter((item) => item?.expenseId)
                .map((item) => [item.expenseId, item])
        );
    }, [editingInvoice]);

    const getScopedAvailableExpenses = useCallback((projectsForScope = [], clientForScope = null, invoiceId = null) => {
        const scopedProjectIds = new Set(
            (Array.isArray(projectsForScope) ? projectsForScope : [])
                .map((projectItem) => projectItem?.id)
                .filter(Boolean)
        );
        const scopedClientIds = new Set(
            (Array.isArray(projectsForScope) ? projectsForScope : [])
                .map((projectItem) => projectItem?.preferredClientId)
                .filter(Boolean)
        );

        if (clientForScope?.id) {
            scopedClientIds.add(clientForScope.id);
        }

        if (scopedProjectIds.size === 0 && scopedClientIds.size === 0) {
            return [];
        }

        return expenses
            .filter((expense) => {
                if (!expense || !expense.billable) return false;

                if (expense.projectId) {
                    if (!scopedProjectIds.has(expense.projectId)) return false;
                } else {
                    if (!expense.clientId || !scopedClientIds.has(expense.clientId)) return false;
                }

                if (!isStoredDateWithinBillingRange(expense.date, activeBillingPeriodStart, activeBillingPeriodEnd)) {
                    return false;
                }

                if (expense.billingStatus === 'unbilled') return true;
                if (invoiceId && expense.invoiceId === invoiceId) return true;
                return false;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [activeBillingPeriodEnd, activeBillingPeriodStart, expenses]);

    const availableExpenses = useMemo(() => {
        return getScopedAvailableExpenses(selectedProjectsForInvoice, selectedClient, editingInvoice?.id || null);
    }, [editingInvoice, getScopedAvailableExpenses, selectedClient, selectedProjectsForInvoice]);

    const availableExpensesWithConversion = useMemo(() => {
        return availableExpenses.map((expense) => {
            const originalAmount = expense.amount || 0;
            const originalCurrency = normalizeCurrencyCode(expense.currency || invoiceCurrency);
            const existingItem = editingExpenseItemMap.get(expense.id);

            if (existingItem && Number.isFinite(existingItem.amount)) {
                const storedOriginalAmount = Number.isFinite(existingItem.originalAmount)
                    ? existingItem.originalAmount
                    : originalAmount;
                const storedOriginalCurrency = normalizeCurrencyCode(existingItem.originalCurrency || originalCurrency);
                const exchangeRate = Number.isFinite(existingItem.exchangeRate)
                    ? existingItem.exchangeRate
                    : (storedOriginalAmount ? existingItem.amount / storedOriginalAmount : 1);

                return {
                    ...expense,
                    projectTitle: expense.projectId ? (projects.find((projectItem) => projectItem.id === expense.projectId)?.title || '') : '',
                    convertedAmount: existingItem.amount,
                    exchangeRate,
                    originalAmount: storedOriginalAmount,
                    originalCurrency: storedOriginalCurrency,
                    isConvertible: true,
                    conversionError: null
                };
            }

            if (originalCurrency === normalizedInvoiceCurrency) {
                return {
                    ...expense,
                    projectTitle: expense.projectId ? (projects.find((projectItem) => projectItem.id === expense.projectId)?.title || '') : '',
                    convertedAmount: originalAmount,
                    exchangeRate: 1,
                    originalAmount,
                    originalCurrency,
                    isConvertible: true,
                    conversionError: null
                };
            }

            const conversion = convertCurrency(
                originalAmount,
                originalCurrency,
                normalizedInvoiceCurrency,
                exchangeRates
            );

            if (!conversion.success) {
                return {
                    ...expense,
                    projectTitle: expense.projectId ? (projects.find((projectItem) => projectItem.id === expense.projectId)?.title || '') : '',
                    convertedAmount: originalAmount,
                    exchangeRate: undefined,
                    originalAmount,
                    originalCurrency,
                    isConvertible: false,
                    conversionError: conversion.error || 'Exchange rate unavailable'
                };
            }

            const convertedAmount = conversion.amount;
            const exchangeRate = originalAmount
                ? Math.round((convertedAmount / originalAmount) * 1000000) / 1000000
                : 1;

            return {
                ...expense,
                projectTitle: expense.projectId ? (projects.find((projectItem) => projectItem.id === expense.projectId)?.title || '') : '',
                convertedAmount,
                exchangeRate,
                originalAmount,
                originalCurrency,
                isConvertible: true,
                conversionError: null
            };
        });
    }, [availableExpenses, editingExpenseItemMap, exchangeRates, invoiceCurrency, normalizedInvoiceCurrency, projects]);

    const conversionUnavailableCount = useMemo(() => {
        return availableExpensesWithConversion.filter((expense) => !expense.isConvertible).length;
    }, [availableExpensesWithConversion]);

    const shouldSelectExpenseByDefault = useCallback((expense) => {
        if (!expense || expense.isConvertible === false) {
            return false;
        }

        if (expense.projectId) {
            return true;
        }

        return !project || !!client;
    }, [client, project]);

    const resolveCurrentBusinessInfo = useCallback((businessInfoSource) => {
        if (!businessInfoSource) {
            return null;
        }

        const businessInfoId = businessInfoSource.businessInfoId
            || businessInfoSource.businessInfo?.id
            || businessInfoSource.id;

        if (!businessInfoId) {
            return businessInfoSource.businessInfo || businessInfoSource;
        }

        return businessInfos.find((businessInfo) => businessInfo.id === businessInfoId)
            || businessInfoSource.businessInfo
            || businessInfoSource;
    }, [businessInfos]);

    // Auto-open the form when showButton is false (modal mode)
    useEffect(() => {
        if (!showButton) { // Modal mode (auto-open is possible)
            const canAutoOpenFromContext = !client && !editingInvoice && !handledEditingInvoice;

            if (!didAutoOpenModalRef.current && (forceOpenOnMount || canAutoOpenFromContext)) {
                setShowInvoiceForm(true);
                didAutoOpenModalRef.current = true;
            }
        } else { // Button mode (auto-open is not applicable)
            // Reset the flag if we are no longer in modal mode,
            // so it can auto-open next time if props change to modal mode.
            didAutoOpenModalRef.current = false;
        }
    }, [showButton, client, editingInvoice, handledEditingInvoice, forceOpenOnMount]); // Added handledEditingInvoice dependency

    /**
     * Initialize payment method based on previous invoices or editing invoice
     * Prioritizes client-based invoice history over project-based history
     */
    const [selectedExpensesForBilling, setSelectedExpensesForBilling] = useState({});
    const initializePaymentMethod = useCallback(() => {
        // Don't override if project was manually changed (user may have gotten auto-populated values)
        if (projectManuallyChanged && selectedPaymentMethod !== null) {
            return;
        }
        
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set
        if (selectedPaymentMethod !== null && !editingInvoice) {
            return; // User has already made a selection, keep it
        }

        // If editing an invoice, prefer the latest payment method data
        if (editingInvoice) {
            const invoicePaymentMethodId = editingInvoice.paymentMethodId || editingInvoice.paymentMethod?.id;
            if (invoicePaymentMethodId) {
                const latestPaymentMethod = paymentMethods.find(pm => pm.id === invoicePaymentMethodId);
                if (latestPaymentMethod) {
                    setSelectedPaymentMethod(latestPaymentMethod);
                    return;
                }
            }

            if (editingInvoice.paymentMethod) {
                setSelectedPaymentMethod(editingInvoice.paymentMethod);
                return;
            }
        }
        
        // PRIORITY 1: Look for last used payment method for this client across all invoices
        if (!projectManuallyChanged && selectedClient && invoices.length > 0) {
            const clientInvoices = invoices
                .filter(invoice => invoice.clientId === selectedClient.id)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation date, newest first
            
            for (const invoice of clientInvoices) {
                if (invoice.paymentMethod) {
                    setSelectedPaymentMethod(invoice.paymentMethod);
                    return;
                }
            }
        }
        
        // PRIORITY 2: Fall back to project-specific invoice history (only if no client-based history found)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice.paymentMethod) {
                    setSelectedPaymentMethod(invoice.paymentMethod);
                    return;
                }
            }
        }
        
        // PRIORITY 3: Use default payment method if no history found
        const defaultPaymentMethod = paymentMethods.find(pm => pm.isDefault);
        if (defaultPaymentMethod) {
            setSelectedPaymentMethod(defaultPaymentMethod);
            return;
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, projectInvoices, paymentMethods, selectedPaymentMethod, projectManuallyChanged, selectedClient, invoices]);

    /**
     * Initialize business info based on previous invoices or editing invoice
     * Prioritizes client-based invoice history over project-based history
     */
    const initializeBusinessInfo = useCallback(() => {
        // Don't override if project was manually changed (user may have gotten auto-populated values)
        if (projectManuallyChanged && selectedBusinessInfo !== null) {
            return;
        }
        
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set
        if (selectedBusinessInfo !== null && !editingInvoice) {
            return; // User has already made a selection, keep it
        }

        // If editing an invoice, prefer the latest business info data
        if (editingInvoice) {
            const resolvedBusinessInfo = resolveCurrentBusinessInfo(editingInvoice);
            if (resolvedBusinessInfo) {
                setSelectedBusinessInfo(resolvedBusinessInfo);
                return;
            }
        }
        
        // PRIORITY 1: Look for last used business info for this client across all invoices
        if (!projectManuallyChanged && selectedClient && invoices.length > 0) {
            const clientInvoices = invoices
                .filter(invoice => invoice.clientId === selectedClient.id)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation date, newest first
            
            for (const invoice of clientInvoices) {
                const resolvedBusinessInfo = resolveCurrentBusinessInfo(invoice);
                if (resolvedBusinessInfo) {
                    setSelectedBusinessInfo(resolvedBusinessInfo);
                    return;
                }
            }
        }
        
        // PRIORITY 2: Fall back to project-specific invoice history (only if no client-based history found)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                const resolvedBusinessInfo = resolveCurrentBusinessInfo(invoice);
                if (resolvedBusinessInfo) {
                    setSelectedBusinessInfo(resolvedBusinessInfo);
                    return;
                }
            }
        }
        
        // PRIORITY 3: Use default business info if no history found
        const defaultBusinessInfo = businessInfos.find(bi => bi.isDefault) || businessInfos[0];
        if (defaultBusinessInfo) {
            setSelectedBusinessInfo(defaultBusinessInfo);
            return;
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, projectInvoices, businessInfos, selectedBusinessInfo, projectManuallyChanged, selectedClient, invoices, resolveCurrentBusinessInfo]);

    /**
     * Initialize selected client info based on previous invoices or editing invoice
     * Prioritizes explicit client prop, then editing invoice, then project preferred client, then project history
     */
    const initializeSelectedClient = useCallback(() => {
        // If no clients available, ensure selection is null
        if (clients.length === 0) {
            if (selectedClient !== null) {
                setSelectedClient(null);
            }
            return;
        }

        // Don't override if project was manually changed (user may have gotten auto-populated values)
        if (projectManuallyChanged && selectedClient !== null) {
            return;
        }

        // If user has already made a selection and it still exists in clients, keep it
        if (selectedClient !== null && !editingInvoice) {
            const stillExists = clients.some(ci => ci && ci.id === selectedClient?.id);
            if (stillExists) {
                return; // Preserve user selection
            }
            // If their selection no longer exists, continue with initialization
        }

        // If editing an invoice, use its client info ID
        if (editingInvoice && editingInvoice.clientId) {
            const clientFromInvoice = clients.find(ci => ci && ci.id === editingInvoice?.clientId);
            if (clientFromInvoice) {
                setSelectedClient(clientFromInvoice);
                return;
            }
        }

        // If a client prop is provided (from ClientDashboard), use it
        if (client && !editingInvoice) {
            setSelectedClient(client);
            return;
        }
        
        // Check for project's preferred client info first (only if project not manually changed)
        if (!projectManuallyChanged && selectedProject?.preferredClientId) {
            const preferredClient = clients.find(ci => ci && ci.id === selectedProject?.preferredClientId);
            if (preferredClient) {
                setSelectedClient(preferredClient);
                return;
            }
        }
        
        // Look for last used client info in previous invoices for this project (only if project not manually changed)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice?.clientId) {
                    const client = clients.find(ci => ci && ci.id === invoice?.clientId);
                    if (client) {
                        setSelectedClient(client);
                        return;
                    }
                }
            }
        }
        
        // Don't auto-select client info - user should manually select
    }, [editingInvoice, projectInvoices, clients, selectedClient, projectManuallyChanged, selectedProject?.preferredClientId, client]);

    /**
     * Initialize selected project based on current project or editing invoice
     */
    const initializeSelectedProject = useCallback(() => {
        // Don't override if project was manually changed (user may have gotten auto-populated values)
        if (projectManuallyChanged && selectedProject !== null) {
            return;
        }
        
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set
        if (selectedProject !== null && !editingInvoice) {
            return; // User has already made a selection, keep it
        }

        // If editing an invoice, use its project
        if (editingInvoice && editingInvoice.projectId) {
            const invoiceProject = projects.find(p => p.id === editingInvoice.projectId);
            if (invoiceProject) {
                setSelectedProject(invoiceProject);
                setSelectedAdditionalProjectIds(
                    (Array.isArray(editingInvoice.projectIds) ? editingInvoice.projectIds : [])
                        .filter((projectId) => projectId && projectId !== invoiceProject.id)
                );
                return;
            }
        }
        
        // Only use the current project if it's actually provided (not null)
        // This prevents overriding user selections when opening from invoices view
        if (project) {
            setSelectedProject(project);
            setSelectedAdditionalProjectIds([]);
        }
        // If project is null (like when opened from invoices view), don't set anything
        // and let the user make their selection
    }, [editingInvoice, project, projects, selectedProject, projectManuallyChanged]);

    /**
     * Initialize selected template based on default template or editing invoice
     * Prioritizes client-based invoice history over project-based history
     */
    const initializeSelectedTemplate = useCallback(() => {
        // Don't override if project was manually changed and user has already made a selection
        if (projectManuallyChanged && selectedTemplate !== null) {
            return;
        }
        
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set, UNLESS we have a project pre-selection case
        // (when coming from project dashboard, we want project-specific template to override any default)
        if (selectedTemplate !== null && !editingInvoice && projectManuallyChanged) {
            return; // User has already made a manual selection, keep it
        }

        // If editing an invoice and it has a template reference, use latest template data
        if (editingInvoice) {
            const latestTemplate = resolveCurrentInvoiceTemplate(editingInvoice, invoiceTemplates);
            if (latestTemplate) {
                setSelectedTemplate(latestTemplate);
                return;
            }
        }
        
        // If not editing an invoice, we need to select a template
        if (!editingInvoice && invoiceTemplates.length > 0) {
            // PRIORITY 1: Look for last used template for this client across all invoices
            if (selectedClient && invoices.length > 0) {
                const clientInvoices = invoices
                    .filter(invoice => invoice.clientId === selectedClient.id)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation date, newest first
                
                for (const invoice of clientInvoices) {
                    const latestTemplate = resolveCurrentInvoiceTemplate(invoice, invoiceTemplates);
                    if (latestTemplate) {
                        setSelectedTemplate(latestTemplate);
                        return;
                    }
                }
            }
            
            // PRIORITY 2: Fall back to project-specific template history (only if no client-based history found)
            if (selectedProject?.id) {
                const lastInvoice = getLatestInvoiceForProject(invoices, selectedProject.id);
                const latestTemplate = resolveCurrentInvoiceTemplate(lastInvoice, invoiceTemplates);

                if (latestTemplate) {
                    setSelectedTemplate(latestTemplate);
                    return;
                }
            }
            
            // PRIORITY 3: Use default template if no history found
            if (selectedTemplate === null) {
                const defaultTemplate = invoiceTemplates.find(t => t.isDefault);
                if (defaultTemplate) {
                    setSelectedTemplate(defaultTemplate);
                    return;
                }
                
                // If no default template, select the first one
                setSelectedTemplate(invoiceTemplates[0]);
                return;
            }
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, invoiceTemplates, selectedTemplate, projectManuallyChanged, selectedProject?.id, invoices, selectedClient]);

    // Track when the form gets shown so we can initialize only then
    const [hasInitialized, setHasInitialized] = useState(false);
    const [currentEditingInvoiceId, setCurrentEditingInvoiceId] = useState(null);

    // Initialize all dropdowns together, but only when showInvoiceForm becomes true,
    // or when editing an invoice changes, or when available options change
    useEffect(() => {
        // Only initialize when the form is shown
        if (showInvoiceForm) {
            // Check if we have a new editing invoice or if we haven't initialized yet
            const isNewEditingInvoice = editingInvoice?.id !== currentEditingInvoiceId;
            
            // We only want to initialize once when the form opens or when a different editing invoice is set
            if (!hasInitialized || isNewEditingInvoice) {
                initializePaymentMethod();
                initializeBusinessInfo();
                initializeSelectedClient();
                initializeSelectedProject();
                initializeSelectedTemplate();
                setHasInitialized(true);
                setCurrentEditingInvoiceId(editingInvoice?.id || null);
            }
        } else if (!isHiddenForNestedModal) {
            // Reset the initialized flag when form is closed (skip if temporarily hidden)
            setHasInitialized(false);
            setCurrentEditingInvoiceId(null);
        }
    }, [
        showInvoiceForm, 
        editingInvoice?.id, // Only track the ID to prevent re-initialization
        initializePaymentMethod, 
        initializeBusinessInfo, 
        initializeSelectedClient,
        initializeSelectedProject,
        initializeSelectedTemplate,
        paymentMethods.length,
        businessInfos.length,
        clients.length,
        hasInitialized,
        currentEditingInvoiceId,
        isHiddenForNestedModal
    ]);

    const [invoiceTasks, setInvoiceTasks] = useState([]);
    const [editableHours, setEditableHours] = useState({});
    const [taskFlatRates, setTaskFlatRates] = useState({}); // For flat rate pricing per task
    const [useFlatRate, setUseFlatRate] = useState({}); // Track which tasks use flat rate vs hourly
    const [taskHourlyRates, setTaskHourlyRates] = useState({}); // For custom hourly rates per task
    const [taskQuantities, setTaskQuantities] = useState({}); // For quantities on flat rate tasks
    
    // Merged subtasks state
    const [mergedSubtasks, setMergedSubtasks] = useState({}); // Track which parent tasks have merged subtasks
    
    // Additional tasks state (not related to project)
    const [additionalTasks, setAdditionalTasks] = useState([]);
    const [showAddTaskForm, setShowAddTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskHours, setNewTaskHours] = useState('');
    const [newTaskUseFlatRate, setNewTaskUseFlatRate] = useState(false); // Toggle for new tasks
    const [newTaskHourlyRate, setNewTaskHourlyRate] = useState(''); // Hourly rate for new tasks
    const [newTaskQuantity, setNewTaskQuantity] = useState(1); // Quantity for new flat rate tasks

    // Additional invoice-only expenses state
    const [additionalExpenses, setAdditionalExpenses] = useState([]);
    const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
    const [newExpenseTitle, setNewExpenseTitle] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseCurrency, setNewExpenseCurrency] = useState(normalizedInvoiceCurrency);
    const [newExpenseSupplierName, setNewExpenseSupplierName] = useState('');
    
    // Task selection state for selective billing
    const [selectedTasksForBilling, setSelectedTasksForBilling] = useState({});
    
    // Invoice note state
    const [invoiceNote, setInvoiceNote] = useState('');
    
    // Invoice date override state
    const [invoiceDateOverride, setInvoiceDateOverride] = useState('');
    const [useInvoiceDateOverride, setUseInvoiceDateOverride] = useState(false);
    
    // Pricing & Totals state
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'fixed'
    const [discountValue, setDiscountValue] = useState(0);
    const [shippingAmount, setShippingAmount] = useState(0);
    const [taxOverride, setTaxOverride] = useState({
        enabled: false,
        label: '',
        rate: 0
    });

    const getCurrentDraftPayload = useCallback(() => {
        return {
            selectedClientId: selectedClient?.id || null,
            selectedClientSnapshot: selectedClient ? { ...selectedClient } : null,
            selectedProjectId: selectedProject?.id || null,
            selectedProjectSnapshot: selectedProject ? { ...selectedProject } : null,
            selectedAdditionalProjectIds: [...selectedAdditionalProjectIds],
            selectedPaymentMethodId: selectedPaymentMethod?.id || null,
            selectedPaymentMethodSnapshot: selectedPaymentMethod ? { ...selectedPaymentMethod } : null,
            selectedBusinessInfoId: selectedBusinessInfo?.id || null,
            selectedBusinessInfoSnapshot: selectedBusinessInfo ? { ...selectedBusinessInfo } : null,
            selectedTemplateId: selectedTemplate?.id || null,
            selectedTemplateSnapshot: selectedTemplate ? { ...selectedTemplate } : null,
            isProjectContextFixed,
            isClientContextFixed,
            projectManuallyChanged,
            quoteNumberTimestamp,
            billingPeriodPreset,
            billingPeriodStart,
            billingPeriodEnd,
            editableHours: { ...editableHours },
            taskFlatRates: { ...taskFlatRates },
            useFlatRate: { ...useFlatRate },
            taskHourlyRates: { ...taskHourlyRates },
            taskQuantities: { ...taskQuantities },
            mergedSubtasks: { ...mergedSubtasks },
            additionalTasks: [...additionalTasks],
            additionalExpenses: [...additionalExpenses],
            selectedTasksForBilling: { ...selectedTasksForBilling },
            selectedExpensesForBilling: { ...selectedExpensesForBilling },
            invoiceNote,
            invoiceDateOverride,
            useInvoiceDateOverride,
            discountType,
            discountValue,
            shippingAmount,
            taxOverride: taxOverride ? { ...taxOverride } : null,
            showAddTaskForm,
            newTaskTitle,
            newTaskHours,
            newTaskUseFlatRate,
            newTaskHourlyRate,
            newTaskQuantity,
            showAddExpenseForm,
            newExpenseTitle,
            newExpenseAmount,
            newExpenseCurrency,
            newExpenseSupplierName,
        };
    }, [
        additionalExpenses,
        additionalTasks,
        billingPeriodEnd,
        billingPeriodPreset,
        billingPeriodStart,
        discountType,
        discountValue,
        editableHours,
        invoiceDateOverride,
        invoiceNote,
        isClientContextFixed,
        isProjectContextFixed,
        mergedSubtasks,
        newExpenseAmount,
        newExpenseCurrency,
        newExpenseSupplierName,
        newExpenseTitle,
        newTaskHourlyRate,
        newTaskHours,
        newTaskQuantity,
        newTaskTitle,
        newTaskUseFlatRate,
        projectManuallyChanged,
        quoteNumberTimestamp,
        selectedAdditionalProjectIds,
        selectedBusinessInfo,
        selectedClient,
        selectedExpensesForBilling,
        selectedPaymentMethod,
        selectedProject,
        selectedTasksForBilling,
        selectedTemplate,
        shippingAmount,
        showAddExpenseForm,
        showAddTaskForm,
        taskFlatRates,
        taskHourlyRates,
        taskQuantities,
        taxOverride,
        useFlatRate,
        useInvoiceDateOverride,
    ]);

    const invoiceFormStateKey = useMemo(() => {
        if (editingInvoice?.id) {
            return `${mode}:invoice:${editingInvoice.id}`;
        }
        if (project?.id) {
            return `${mode}:project:${project.id}`;
        }
        if (client?.id) {
            return `${mode}:client:${client.id}`;
        }
        return `${mode}:standalone`;
    }, [client?.id, editingInvoice?.id, mode, project?.id]);

    const saveInvoiceFormState = useCallback((formData) => {
        setCachedInvoiceDraft(invoiceFormStateKey, formData);
    }, [invoiceFormStateKey]);

    const getInvoiceFormState = useCallback(() => {
        return getCachedInvoiceDraft(invoiceFormStateKey);
    }, [invoiceFormStateKey]);

    const clearInvoiceFormState = useCallback(() => {
        clearCachedInvoiceDraft(invoiceFormStateKey);
    }, [invoiceFormStateKey]);

    useEffect(() => {
        if (!showInvoiceForm) {
            return;
        }

        const timeoutId = setTimeout(() => {
            saveInvoiceFormState(getCurrentDraftPayload());
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [getCurrentDraftPayload, saveInvoiceFormState, showInvoiceForm]);

    const hideInvoiceFormForNestedModal = useCallback(() => {
        if (!showInvoiceForm) return;
        setIsHiddenForNestedModal(true);
        setShowInvoiceForm(false);
    }, [showInvoiceForm]);

    const handleOpenClientModal = useCallback((...args) => {
        hideInvoiceFormForNestedModal();
        openClientModal?.(...args);
    }, [hideInvoiceFormForNestedModal, openClientModal]);

    const handleOpenProjectModal = useCallback((...args) => {
        hideInvoiceFormForNestedModal();
        openProjectModal?.(...args);
    }, [hideInvoiceFormForNestedModal, openProjectModal]);

    const handleOpenBusinessModal = useCallback((...args) => {
        hideInvoiceFormForNestedModal();
        openBusinessModal?.(...args);
    }, [hideInvoiceFormForNestedModal, openBusinessModal]);

    const handleOpenPaymentMethodModal = useCallback((...args) => {
        hideInvoiceFormForNestedModal();
        openPaymentMethodModal?.(...args);
    }, [hideInvoiceFormForNestedModal, openPaymentMethodModal]);

    const handleOpenTemplateModal = useCallback((...args) => {
        hideInvoiceFormForNestedModal();
        openTemplateModal?.(...args);
    }, [hideInvoiceFormForNestedModal, openTemplateModal]);

    const resolveProjectFromDraft = useCallback((projectId, fallbackProject = null) => {
        if (!projectId) {
            return null;
        }

        if (project?.id === projectId) {
            return project;
        }

        return projects.find((projectItem) => projectItem.id === projectId) || fallbackProject || null;
    }, [project, projects]);

    const resolveClientFromDraft = useCallback((clientId, fallbackClient = null) => {
        if (!clientId) {
            return null;
        }

        if (client?.id === clientId) {
            return client;
        }

        return clients.find((clientItem) => clientItem.id === clientId) || fallbackClient || null;
    }, [client, clients]);

    const resolvePaymentMethodFromDraft = useCallback((paymentMethodId, fallbackPaymentMethod = null) => {
        if (!paymentMethodId) {
            return fallbackPaymentMethod || null;
        }

        return paymentMethods.find((paymentMethod) => paymentMethod.id === paymentMethodId) || fallbackPaymentMethod || null;
    }, [paymentMethods]);

    const resolveBusinessInfoFromDraft = useCallback((businessInfoId, fallbackBusinessInfo = null) => {
        if (!businessInfoId) {
            return fallbackBusinessInfo || null;
        }

        return businessInfos.find((businessInfo) => businessInfo.id === businessInfoId) || fallbackBusinessInfo || null;
    }, [businessInfos]);

    const resolveTemplateFromDraft = useCallback((templateId, fallbackTemplate = null) => {
        if (!templateId) {
            return fallbackTemplate || null;
        }

        return invoiceTemplates.find((template) => template.id === templateId) || fallbackTemplate || null;
    }, [invoiceTemplates]);

    const applyDraftPayload = useCallback((draftState) => {
        if (!draftState) {
            return;
        }

        setSelectedClient(resolveClientFromDraft(draftState.selectedClientId, draftState.selectedClientSnapshot));
        setSelectedProject(resolveProjectFromDraft(draftState.selectedProjectId, draftState.selectedProjectSnapshot));
        setSelectedAdditionalProjectIds(
            (draftState.selectedAdditionalProjectIds || []).filter((projectId) => resolveProjectFromDraft(projectId))
        );
        setSelectedPaymentMethod(resolvePaymentMethodFromDraft(draftState.selectedPaymentMethodId, draftState.selectedPaymentMethodSnapshot));
        setSelectedBusinessInfo(resolveBusinessInfoFromDraft(draftState.selectedBusinessInfoId, draftState.selectedBusinessInfoSnapshot));
        setSelectedTemplate(resolveTemplateFromDraft(draftState.selectedTemplateId, draftState.selectedTemplateSnapshot));
        setIsProjectContextFixed(draftState.isProjectContextFixed ?? (!!project && !client));
        setIsClientContextFixed(draftState.isClientContextFixed ?? !!client);
        setProjectManuallyChanged(draftState.projectManuallyChanged ?? false);
        setQuoteNumberTimestamp(draftState.quoteNumberTimestamp || '');
        setBillingPeriodPreset(draftState.billingPeriodPreset || defaultBillingPeriodState.preset);
        setBillingPeriodStart(draftState.billingPeriodStart || defaultBillingPeriodState.startDate);
        setBillingPeriodEnd(draftState.billingPeriodEnd || defaultBillingPeriodState.endDate);
        setEditableHours(draftState.editableHours || {});
        setTaskFlatRates(draftState.taskFlatRates || {});
        setUseFlatRate(draftState.useFlatRate || {});
        setTaskHourlyRates(draftState.taskHourlyRates || {});
        setTaskQuantities(draftState.taskQuantities || {});
        setMergedSubtasks(draftState.mergedSubtasks || {});
        setAdditionalTasks(draftState.additionalTasks || []);
        setAdditionalExpenses(draftState.additionalExpenses || []);
        setSelectedTasksForBilling(draftState.selectedTasksForBilling || {});
        setSelectedExpensesForBilling(draftState.selectedExpensesForBilling || {});
        setInvoiceNote(draftState.invoiceNote || '');
        setInvoiceDateOverride(draftState.invoiceDateOverride || '');
        setUseInvoiceDateOverride(draftState.useInvoiceDateOverride === true);
        setDiscountType(draftState.discountType || 'percentage');
        setDiscountValue(draftState.discountValue ?? 0);
        setShippingAmount(draftState.shippingAmount ?? 0);
        setTaxOverride(draftState.taxOverride || {
            enabled: false,
            label: '',
            rate: 0
        });
        setShowAddTaskForm(draftState.showAddTaskForm === true);
        setNewTaskTitle(draftState.newTaskTitle || '');
        setNewTaskHours(draftState.newTaskHours || '');
        setNewTaskUseFlatRate(draftState.newTaskUseFlatRate === true);
        setNewTaskHourlyRate(draftState.newTaskHourlyRate || '');
        setNewTaskQuantity(draftState.newTaskQuantity ?? 1);
        setShowAddExpenseForm(draftState.showAddExpenseForm === true);
        setNewExpenseTitle(draftState.newExpenseTitle || '');
        setNewExpenseAmount(draftState.newExpenseAmount || '');
        setNewExpenseCurrency(draftState.newExpenseCurrency || normalizedInvoiceCurrency);
        setNewExpenseSupplierName(draftState.newExpenseSupplierName || '');
    }, [
        client,
        defaultBillingPeriodState.endDate,
        defaultBillingPeriodState.preset,
        defaultBillingPeriodState.startDate,
        normalizedInvoiceCurrency,
        project,
        resolveBusinessInfoFromDraft,
        resolveClientFromDraft,
        resolvePaymentMethodFromDraft,
        resolveProjectFromDraft,
        resolveTemplateFromDraft,
    ]);

    /**
     * Initialize pricing state when editing an invoice
     */
    useEffect(() => {
        if (editingInvoice) {
            // Initialize discount settings
            if (editingInvoice.discountType) {
                setDiscountType(editingInvoice.discountType);
            }
            if (editingInvoice.discountValue !== undefined) {
                setDiscountValue(editingInvoice.discountValue);
            }
            
            // Initialize shipping
            if (editingInvoice.shipping !== undefined) {
                setShippingAmount(editingInvoice.shipping);
            }
            
            // Initialize tax override
            if (editingInvoice.taxOverride) {
                setTaxOverride(editingInvoice.taxOverride);
            }
            
            // Initialize additional tasks
            if (editingInvoice.additionalTasks) {
                setAdditionalTasks(editingInvoice.additionalTasks);
            }

            const storedBillingPeriodState = getStoredInvoiceBillingPeriodState(editingInvoice);
            setBillingPeriodPreset(storedBillingPeriodState.preset);
            setBillingPeriodStart(storedBillingPeriodState.startDate);
            setBillingPeriodEnd(storedBillingPeriodState.endDate);

            const invoiceOnlyItems = (editingInvoice.items || [])
                .filter((item) => item && !item.expenseId)
                .map((item, index) => ({
                    id: item.id || `invoice-only-${editingInvoice.id}-${index}`,
                    title: item.description || 'Invoice Expense',
                    amount: Number(item.amount) || 0,
                    currency: normalizedInvoiceCurrency,
                    originalAmount: Number.isFinite(item.originalAmount) ? item.originalAmount : (Number(item.amount) || 0),
                    originalCurrency: item.originalCurrency || normalizedInvoiceCurrency,
                    exchangeRate: Number.isFinite(item.exchangeRate)
                        ? item.exchangeRate
                        : (item.originalAmount ? item.amount / item.originalAmount : 1),
                    supplierName: item.supplierName || null
                }));
            setAdditionalExpenses(invoiceOnlyItems);
            
            // Initialize invoice note
            if (editingInvoice.note) {
                setInvoiceNote(editingInvoice.note);
            }
            
            // Initialize invoice date override
            if (editingInvoice.dateOverride) {
                // Convert stored date override to YYYY-MM-DD format for date input
                // Handle both old format (YYYY-MM-DD) and new format (MM/DD/YYYY)
                let dateForInput;
                try {
                    const date = new Date(editingInvoice.dateOverride);
                    if (isNaN(date.getTime())) {
                        // If invalid date, don't set override
                        setInvoiceDateOverride('');
                        setUseInvoiceDateOverride(false);
                    } else {
                        // Convert to YYYY-MM-DD format for HTML date input using local time
                        dateForInput = timestampToDateString(date.getTime());
                        setInvoiceDateOverride(dateForInput);
                        setUseInvoiceDateOverride(true);
                    }
                } catch {
                    // If date parsing fails, don't set override
                    setInvoiceDateOverride('');
                    setUseInvoiceDateOverride(false);
                }
            }
            
            // Initialize merged subtasks state
            if (editingInvoice && editingInvoice.mergedSubtasks) {
                setMergedSubtasks(editingInvoice.mergedSubtasks);
            }
        } else {
            // Reset pricing state for new invoices
            setDiscountType('percentage');
            setDiscountValue(0);
            setShippingAmount(0);
            setTaxOverride({
                enabled: false,
                label: '',
                rate: 0
            });
            setAdditionalTasks([]);
            setAdditionalExpenses([]);
            setInvoiceNote('');
            setInvoiceDateOverride('');
            setUseInvoiceDateOverride(false);
            setBillingPeriodPreset(defaultBillingPeriodState.preset);
            setBillingPeriodStart(defaultBillingPeriodState.startDate);
            setBillingPeriodEnd(defaultBillingPeriodState.endDate);
            setMergedSubtasks({});
            setShowAddExpenseForm(false);
            setNewExpenseTitle('');
            setNewExpenseAmount('');
            setNewExpenseSupplierName('');
            setNewExpenseCurrency(normalizedInvoiceCurrency);
        }
    }, [defaultBillingPeriodState, editingInvoice, normalizedInvoiceCurrency]);

    useEffect(() => {
        if (!showAddExpenseForm) {
            setNewExpenseCurrency(normalizedInvoiceCurrency);
        }
    }, [normalizedInvoiceCurrency, showAddExpenseForm]);

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback((projectForData = null) => {
        return buildInvoiceTaskData({
            projectForData,
            selectedProject,
            tasks,
            timeEntries,
            editableHours: {},
            billingPeriodStart: activeBillingPeriodStart,
            billingPeriodEnd: activeBillingPeriodEnd,
        });
    }, [activeBillingPeriodEnd, activeBillingPeriodStart, selectedProject, timeEntries, tasks]);

    const prepareInvoiceDataForProjects = useCallback((projectsForData = []) => {
        return projectsForData.flatMap((projectForData) => {
            return (prepareInvoiceData(projectForData) || []).map((task) => ({
                ...task,
                projectId: projectForData.id,
                projectTitle: projectForData.title,
                projectHourlyRate: typeof projectForData.hourlyRate === 'number' ? projectForData.hourlyRate : 0,
                projectFlatRate: projectForData.flatRate === true,
                hourlyRate: typeof task.hourlyRate === 'number'
                    ? task.hourlyRate
                    : (typeof projectForData.hourlyRate === 'number' ? projectForData.hourlyRate : 0),
            }));
        });
    }, [prepareInvoiceData]);

    useEffect(() => {
        if (!showInvoiceForm) {
            return;
        }

        if (isQuoteMode) {
            return;
        }

        const projectsForInvoice = selectedProjectsForInvoice.length > 0
            ? selectedProjectsForInvoice
            : [
                selectedProject
                || (editingInvoice?.projectId ? projects.find((item) => item.id === editingInvoice.projectId) : null)
                || project
                || null
            ].filter(Boolean);

        if (projectsForInvoice.length === 0 && !editingInvoice?.tasks?.length) {
            setInvoiceTasks((prev) => (prev.length === 0 ? prev : []));
            setSelectedTasksForBilling((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }

        const nextLiveTasks = projectsForInvoice.length === 0
            ? []
            : prepareInvoiceDataForProjects(projectsForInvoice);
        const nextTasks = editingInvoice
            ? mergeEditingInvoiceTasks(nextLiveTasks, editingInvoice)
            : nextLiveTasks;
        const editingTaskMap = new Map((editingInvoice?.tasks || []).map((task) => [task.id, task]));
        const previousInvoiceTaskMap = new Map(invoiceTasks.map((task) => [task.id, task]));

        setInvoiceTasks((prev) => (areInvoiceTaskListsEqual(prev, nextTasks) ? prev : nextTasks));
        setEditableHours((prev) => {
            const next = {};

            nextTasks.forEach((task) => {
                if (prev[task.id] !== undefined) {
                    if (editingInvoice && editingTaskMap.has(task.id)) {
                        next[task.id] = prev[task.id];
                        return;
                    }

                    const previousTask = previousInvoiceTaskMap.get(task.id);
                    const previousOriginalHours = previousTask
                        ? Math.round((Number(previousTask.originalHours) || 0) * 100) / 100
                        : null;
                    const previousEditableHours = Math.round((Number(prev[task.id]) || 0) * 100) / 100;

                    next[task.id] = previousOriginalHours !== null && previousEditableHours === previousOriginalHours
                        ? task.originalHours
                        : prev[task.id];
                    return;
                }

                const editingTask = editingTaskMap.get(task.id);
                next[task.id] = editingTask
                    ? Math.round((Number(editingTask.hours) || 0) * 100) / 100
                    : task.originalHours;
            });

            return areNumberMapsEqual(prev, next) ? prev : next;
        });

        setSelectedTasksForBilling((prev) => {
            const next = {};

            nextTasks.forEach((task) => {
                if (prev[task.id] !== undefined) {
                    next[task.id] = prev[task.id];
                    return;
                }

                next[task.id] = editingInvoice ? editingTaskMap.has(task.id) : true;
            });

            return areBooleanMapsEqual(prev, next) ? prev : next;
        });
    }, [editingInvoice, invoiceTasks, isQuoteMode, prepareInvoiceDataForProjects, project, projects, selectedProject, selectedProjectsForInvoice, showInvoiceForm]);

    useEffect(() => {
        if (!showInvoiceForm) {
            return;
        }

        const editingExpenseIds = new Set(
            (editingInvoice?.items || [])
                .filter((item) => item?.expenseId)
                .map((item) => item.expenseId)
        );

        setSelectedExpensesForBilling((prev) => {
            const next = {};

            availableExpensesWithConversion.forEach((expense) => {
                if (!expense.isConvertible) {
                    return;
                }

                if (prev[expense.id] !== undefined) {
                    next[expense.id] = prev[expense.id];
                    return;
                }

                next[expense.id] = editingInvoice
                    ? editingExpenseIds.has(expense.id) || expense.invoiceId === editingInvoice.id
                    : shouldSelectExpenseByDefault(expense);
            });

            return areBooleanMapsEqual(prev, next) ? prev : next;
        });
    }, [availableExpensesWithConversion, editingInvoice, shouldSelectExpenseByDefault, showInvoiceForm]);

    useEffect(() => {
        if (!showInvoiceForm) {
            return;
        }

        const flatRateProjectIds = new Set(
            selectedProjectsForInvoice
                .filter((projectItem) => projectItem?.flatRate)
                .map((projectItem) => projectItem.id)
        );

        if (flatRateProjectIds.size === 0) {
            return;
        }

        const taskEstimateMap = new Map(
            tasks
                .filter((task) => task.projectId && flatRateProjectIds.has(task.projectId))
                .map((task) => [task.id, getCurrentQuotedFlatAmount(task)])
        );

        setUseFlatRate((prev) => {
            const next = { ...prev };
            let hasChanges = false;

            invoiceTasks.forEach((task) => {
                if (next[task.id] === undefined) {
                    next[task.id] = task.projectFlatRate === true;
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });

        setTaskQuantities((prev) => {
            const next = { ...prev };
            let hasChanges = false;

            invoiceTasks.forEach((task) => {
                if (next[task.id] === undefined) {
                    next[task.id] = 1;
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });

        setTaskFlatRates((prev) => {
            const next = { ...prev };
            let hasChanges = false;

            invoiceTasks.forEach((task) => {
                if (next[task.id] !== undefined) {
                    return;
                }

                const estimatedFlatAmount = taskEstimateMap.get(task.id);

                if (typeof estimatedFlatAmount === 'number' && Number.isFinite(estimatedFlatAmount)) {
                    next[task.id] = estimatedFlatAmount;
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });

        setNewTaskUseFlatRate(selectedProjectsForInvoice.some((projectItem) => projectItem?.flatRate));
    }, [invoiceTasks, selectedProjectsForInvoice, showInvoiceForm, tasks]);

    useEffect(() => {
        if (!showInvoiceForm || !pendingDraftRestore) {
            return;
        }

        applyDraftPayload(pendingDraftRestore);
        setPendingDraftRestore(null);
    }, [applyDraftPayload, pendingDraftRestore, showInvoiceForm]);

    // Handler assignments (replace function definitions)
    const handleTaskSelectionForBilling = InvoiceHandler.handleTaskSelectionForBilling(setSelectedTasksForBilling);
    const handleHoursChange = InvoiceHandler.handleHoursChange(setEditableHours);
    const handleFlatRateChange = InvoiceHandler.handleFlatRateChange(setTaskFlatRates);
    const handleQuantityChange = InvoiceHandler.handleQuantityChange(setTaskQuantities);
    const handleTaskHourlyRateChange = InvoiceHandler.handleTaskHourlyRateChange(setTaskHourlyRates);
    const handleToggleFlatRate = InvoiceHandler.handleToggleFlatRate(
        setUseFlatRate,
        setTaskFlatRates,
        setTaskQuantities,
        invoiceTasks,
        editableHours,
        selectedProject,
        taskFlatRates,
        taskQuantities,
        handleFlatRateChange
    );
    const handleToggleNewTaskFlatRate = InvoiceHandler.handleToggleNewTaskFlatRate(setNewTaskUseFlatRate);
    const handleToggleMergeSubtasks = InvoiceHandler.handleToggleMergeSubtasks(
        setMergedSubtasks,
        setSelectedTasksForBilling,
        invoiceTasks,
        taskHourlyRates,
        selectedProject?.hourlyRate,
        showWarning
    );
    const handleTemplateSelection = InvoiceHandler.handleTemplateSelection(setSelectedTemplate, invoiceTemplates);
    
    // Function to focus the task input field
    const focusTaskInput = useCallback(() => {
        if (taskInputRef.current) {
            taskInputRef.current.focus();
        }
    }, []);
    
    const handleAddAdditionalTask = InvoiceHandler.handleAddAdditionalTask(
        setAdditionalTasks,
        setUseFlatRate,
        newTaskTitle,
        newTaskHours,
        newTaskUseFlatRate,
        newTaskHourlyRate,
        selectedProject,
        selectedClient,
        newTaskQuantity,
        setNewTaskTitle,
        setNewTaskHours,
        setNewTaskHourlyRate,
        setNewTaskUseFlatRate,
        setNewTaskQuantity,
        setShowAddTaskForm,
        showError,
        focusTaskInput
    );
    const handleRemoveAdditionalTask = InvoiceHandler.handleRemoveAdditionalTask(setAdditionalTasks);
    const handleAddAdditionalExpense = useCallback(() => {
        const trimmedTitle = newExpenseTitle.trim();
        if (!trimmedTitle) {
            showError('Please enter an expense description');
            return;
        }

        const parsedAmount = parseFloat(newExpenseAmount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            showError('Expense amount must be greater than zero');
            return;
        }

        const originalCurrency = normalizeCurrencyCode(newExpenseCurrency || normalizedInvoiceCurrency);
        let convertedAmount = parsedAmount;
        let exchangeRate = 1;

        if (originalCurrency !== normalizedInvoiceCurrency) {
            const conversion = convertCurrency(
                parsedAmount,
                originalCurrency,
                normalizedInvoiceCurrency,
                exchangeRates
            );

            if (!conversion.success) {
                showError(conversion.error || 'Exchange rate unavailable');
                return;
            }

            convertedAmount = conversion.amount;
            exchangeRate = parsedAmount
                ? Math.round((convertedAmount / parsedAmount) * 1000000) / 1000000
                : 1;
        }

        const roundedAmount = Math.round(convertedAmount * 100) / 100;
        const supplierName = newExpenseSupplierName.trim();

        setAdditionalExpenses((prev) => ([
            ...prev,
            {
                id: `custom-expense-${Date.now()}`,
                title: trimmedTitle,
                amount: roundedAmount,
                currency: normalizedInvoiceCurrency,
                originalAmount: parsedAmount,
                originalCurrency,
                exchangeRate,
                supplierName: supplierName || null
            }
        ]));

        setNewExpenseTitle('');
        setNewExpenseAmount('');
        setNewExpenseSupplierName('');
        setNewExpenseCurrency(normalizedInvoiceCurrency);
        setShowAddExpenseForm(false);
    }, [
        newExpenseTitle,
        newExpenseAmount,
        newExpenseCurrency,
        newExpenseSupplierName,
        normalizedInvoiceCurrency,
        exchangeRates,
        showError
    ]);
    const handleRemoveAdditionalExpense = useCallback((expenseId) => {
        setAdditionalExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
    }, []);
    const handleAdditionalTaskHoursChange = InvoiceHandler.handleAdditionalTaskHoursChange(setAdditionalTasks);
    const handleAdditionalTaskFlatRateChange = InvoiceHandler.handleAdditionalTaskFlatRateChange(setAdditionalTasks);
    const handleAdditionalTaskQuantityChange = InvoiceHandler.handleAdditionalTaskQuantityChange(setAdditionalTasks);
    const handleAdditionalTaskHourlyRateChange = InvoiceHandler.handleAdditionalTaskHourlyRateChange(setAdditionalTasks);
    const handleToggleAdditionalTaskFlatRate = InvoiceHandler.handleToggleAdditionalTaskFlatRate(setAdditionalTasks, setUseFlatRate);
    const baseHandleClientSelection = InvoiceHandler.handleClientSelection(setSelectedClient, clients);
    const handleResetInvoiceForm = InvoiceHandler.handleResetInvoiceForm(
        setInvoiceTasks,
        setEditableHours,
        setTaskFlatRates,
        setUseFlatRate,
        setTaskHourlyRates,
        setTaskQuantities,
        setAdditionalTasks,
        setAdditionalExpenses,
        setInvoiceNote,
        setDiscountType,
        setDiscountValue,
        setShippingAmount,
        setTaxOverride,
        setSelectedTasksForBilling,
        setSelectedExpensesForBilling,
        setNewTaskQuantity,
        setMergedSubtasks,
        setInvoiceDateOverride,
        setUseInvoiceDateOverride,
        setShowAddExpenseForm,
        setNewExpenseTitle,
        setNewExpenseAmount,
        setNewExpenseCurrency,
        setNewExpenseSupplierName
    );
    const baseHandleProjectSelection = InvoiceHandler.handleProjectSelection(
        setSelectedProject,
        setProjectManuallyChanged,
        handleResetInvoiceForm,
        setSelectedClient,
        setSelectedBusinessInfo,
        setSelectedPaymentMethod,
        setInvoiceTasks,
        setEditableHours,
        setSelectedTasksForBilling,
        projects,
        invoices,
        clients,
        businessInfos,
        paymentMethods,
        prepareInvoiceData,
        setSelectedTemplate,
        invoiceTemplates,
        setUseFlatRate,
        setTaskQuantities,
        setNewTaskUseFlatRate
    );
    const baseHandleCancel = InvoiceHandler.handleCancel(
        setShowInvoiceForm,
        handleResetInvoiceForm,
        setProjectManuallyChanged,
        onInvoiceSaved,
        setShowAddTaskForm,
        setNewTaskTitle,
        setNewTaskHours,
        setNewTaskHourlyRate,
        setNewTaskQuantity,
        setNewTaskUseFlatRate
    );

    const handleClientSelection = useCallback((clientId) => {
        const nextClient = clientId
            ? clients.find((clientItem) => clientItem && clientItem.id === clientId) || null
            : null;
        const shouldResetProjectContext = selectedProject && nextClient && selectedProject.preferredClientId !== nextClient.id;
        const shouldClearProjectContext = selectedProject && !nextClient;

        if (shouldResetProjectContext || shouldClearProjectContext) {
            setSelectedProject(null);
            setSelectedAdditionalProjectIds([]);
            handleResetInvoiceForm();
        } else if (nextClient?.id !== selectedClient?.id) {
            setSelectedAdditionalProjectIds([]);
        }

        baseHandleClientSelection(clientId);
    }, [baseHandleClientSelection, clients, handleResetInvoiceForm, selectedClient?.id, selectedProject]);

    const handleProjectSelection = useCallback((projectId) => {
        setSelectedAdditionalProjectIds([]);
        baseHandleProjectSelection(projectId);
    }, [baseHandleProjectSelection]);

    const handleCloseInvoice = useCallback(() => {
        saveInvoiceFormState(getCurrentDraftPayload());
        setSelectedAdditionalProjectIds([]);
        baseHandleCancel();
    }, [baseHandleCancel, getCurrentDraftPayload, saveInvoiceFormState]);

    const handleCloseInvoiceWithoutDraft = useCallback(() => {
        clearInvoiceFormState();
        setPendingDraftRestore(null);
        setSelectedAdditionalProjectIds([]);
        baseHandleCancel();
    }, [baseHandleCancel, clearInvoiceFormState]);

    const canUndoEditingInvoice = useMemo(() => {
        if (isQuoteMode || !editingInvoice) {
            return false;
        }

        return canUndoInvoice(editingInvoice);
    }, [canUndoInvoice, editingInvoice, isQuoteMode]);

    const closeUndoInvoiceConfirm = useCallback(() => {
        if (isUndoingInvoice) {
            return;
        }

        setShowUndoInvoiceConfirm(false);
        setUndoInvoiceConfirmationText('');
    }, [isUndoingInvoice]);

    const openUndoInvoiceConfirm = useCallback(() => {
        if (!canUndoEditingInvoice) {
            return;
        }

        setUndoInvoiceConfirmationText('');
        setShowUndoInvoiceConfirm(true);
    }, [canUndoEditingInvoice]);

    const handleConfirmUndoInvoice = useCallback(async () => {
        if (!editingInvoice) {
            return;
        }

        const invoiceToUndo = editingInvoice;
        const expectedConfirmation = invoiceToUndo.invoiceNumber || '';
        if (undoInvoiceConfirmationText.trim() !== expectedConfirmation) {
            showError(`Type ${expectedConfirmation} to confirm.`);
            return;
        }

        setIsUndoingInvoice(true);
        setShowUndoInvoiceConfirm(false);
        setUndoInvoiceConfirmationText('');
        setShowPreview(false);
        setPreviewInvoice(null);
        handleCloseInvoiceWithoutDraft();

        try {
            const result = await undoLatestInvoice(invoiceToUndo.id);

            const sequenceMessage = result?.rewoundSequence
                ? ' Next invoice number was restored.'
                : '';

            showSuccess(
                `Invoice ${result?.invoiceNumber || invoiceToUndo.invoiceNumber} undone. ${result?.clearedTimeEntryCount || 0} billed entr${result?.clearedTimeEntryCount === 1 ? 'y' : 'ies'} restored, ${result?.deletedAdjustmentCount || 0} invoice adjustment${result?.deletedAdjustmentCount === 1 ? '' : 's'} removed, and ${result?.unbilledExpenseCount || 0} expense${result?.unbilledExpenseCount === 1 ? '' : 's'} unbilled.${sequenceMessage}`
            );
        } catch (error) {
            showError(error.message || 'Unable to undo this invoice.');
        } finally {
            setIsUndoingInvoice(false);
        }
    }, [
        editingInvoice,
        handleCloseInvoiceWithoutDraft,
        showError,
        showSuccess,
        undoInvoiceConfirmationText,
        undoLatestInvoice,
    ]);

    /**
     * Calculate pricing breakdown: Subtotal → Discount → Shipping → Tax → Total
     * Supports both hourly rate (from project) and flat rate (per task) pricing
     */
    const calculatePricing = useInvoicePricing({
        invoiceTasks,
        additionalTasks,
        expenseItems: availableExpensesWithConversion.map((expense) => ({
            ...expense,
            amount: expense.convertedAmount
        })),
        invoiceOnlyExpenses: additionalExpenses,
        editableHours,
        discountType,
        discountValue,
        shippingAmount,
        taxOverride,
        taskFlatRates,
        useFlatRate,
        taskHourlyRates,
        taskQuantities,
        selectedTasksForBilling,
        selectedExpensesForBilling,
        mergedSubtasks,
        selectedBusinessInfo,
        selectedClient,
        selectedProject
    });

    /**
     * Update template sequential number
     */
    const updateTemplateSequentialNumber = useCallback((template) => {
        if (!template || !template.useSequentialNumbers) return;

        const nextSequentialNumber = (template.currentSequentialNumber || 1) + 1;
        updateInvoiceTemplate(template.id, { currentSequentialNumber: nextSequentialNumber });
    }, [updateInvoiceTemplate]);

    const parseInvoiceNumber = useCallback((value, fallback = 0) => {
        const parsedValue = Number.parseFloat(String(value ?? ''));
        return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }, []);

    const getInvoiceTaskAmount = useCallback((task, mergedTaskList = []) => {
        const hasExplicitFlatRate = task?.flatRate !== undefined;
        const usesTaskFlatRate = task?.useFlatRate === true || (task?.useFlatRate !== false && hasExplicitFlatRate);

        if (usesTaskFlatRate) {
            return parseInvoiceNumber(task?.flatRate) * parseInvoiceNumber(task?.quantity, 1);
        }

        const fallbackHourlyRate = parseInvoiceNumber(task?.projectHourlyRate) || parseInvoiceNumber(selectedProject?.hourlyRate) || parseInvoiceNumber(selectedClientHourlyRate);
        const parentHourlyRate = parseInvoiceNumber(task?.hourlyRate) || fallbackHourlyRate;
        let taskAmount = parseInvoiceNumber(task?.hours) * parentHourlyRate;

        mergedTaskList.forEach((mergedTask) => {
            const mergedTaskHourlyRate = parseInvoiceNumber(mergedTask?.hourlyRate) || fallbackHourlyRate;
            taskAmount += parseInvoiceNumber(mergedTask?.hours) * mergedTaskHourlyRate;
        });

        return taskAmount;
    }, [parseInvoiceNumber, selectedClientHourlyRate, selectedProject?.hourlyRate]);

    const getNormalizedDocumentTasks = useCallback(() => {
        const orderedSelectedInvoiceTasks = orderTasksWithSubtasks(
            invoiceTasks.filter(task => task && task.id && selectedTasksForBilling[task.id])
        );

        return orderedSelectedInvoiceTasks
            .map(task => ({
                ...task,
                projectId: task.projectId || null,
                projectTitle: task.projectTitle || '',
                projectHourlyRate: task.projectHourlyRate || 0,
                projectFlatRate: task.projectFlatRate === true,
                hours: editableHours[task?.id] || task?.originalHours || 0,
                flatRate: taskFlatRates[task.id] ?? task.flatRate ?? 0,
                hourlyRate: taskHourlyRates[task.id] || task.hourlyRate || task.projectHourlyRate || selectedProject?.hourlyRate || selectedClientHourlyRate || 0,
                useFlatRate: Object.prototype.hasOwnProperty.call(useFlatRate, task.id)
                    ? useFlatRate[task.id]
                    : task.useFlatRate === true,
                quantity: taskQuantities[task.id] || task.quantity || 1,
                isMerged: (task && task.id && mergedSubtasks[task.id]) || false,
                mergedSubtasks: (task && task.id && mergedSubtasks[task.id])
                    ? invoiceTasks
                        .filter(subtask => subtask && subtask.parentTaskId === task.id)
                        .map(subtask => ({
                            ...subtask,
                            projectId: subtask.projectId || task.projectId || null,
                            projectTitle: subtask.projectTitle || task.projectTitle || '',
                            projectHourlyRate: subtask.projectHourlyRate || task.projectHourlyRate || 0,
                            projectFlatRate: subtask.projectFlatRate === true || task.projectFlatRate === true,
                            hours: editableHours[subtask.id] || subtask.originalHours || 0,
                            flatRate: taskFlatRates[subtask.id] ?? subtask.flatRate ?? 0,
                            hourlyRate: taskHourlyRates[subtask.id] || subtask.hourlyRate || subtask.projectHourlyRate || task.projectHourlyRate || selectedProject?.hourlyRate || selectedClientHourlyRate || 0,
                            useFlatRate: Object.prototype.hasOwnProperty.call(useFlatRate, subtask.id)
                                ? useFlatRate[subtask.id]
                                : subtask.useFlatRate === true,
                            quantity: taskQuantities[subtask.id] || subtask.quantity || 1
                        }))
                    : []
            }))
            .filter((task) => getInvoiceTaskAmount(task, task.isMerged ? task.mergedSubtasks : []) > 0);
    }, [editableHours, getInvoiceTaskAmount, invoiceTasks, mergedSubtasks, selectedClientHourlyRate, selectedProject?.hourlyRate, selectedTasksForBilling, taskFlatRates, taskHourlyRates, taskQuantities, useFlatRate]);

    const getNormalizedAdditionalDocumentTasks = useCallback(() => {
        return additionalTasks
            .filter(task => task)
            .map(task => ({
                ...task,
                hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || selectedClientHourlyRate || 0
            }))
            .filter((task) => getInvoiceTaskAmount(task) > 0);
    }, [additionalTasks, getInvoiceTaskAmount, selectedClientHourlyRate, selectedProject?.hourlyRate]);

    const buildInvoiceProjectBreakdowns = useCallback((documentTasks, expenseItems, pricing) => {
        const projectById = new Map(selectedProjectsForInvoice.map((projectItem) => [projectItem.id, projectItem]));
        const taskGroups = new Map();

        (documentTasks || []).forEach((task) => {
            const projectId = task?.projectId;
            if (!projectId) {
                return;
            }

            const existing = taskGroups.get(projectId) || { tasks: [], expenseItems: [] };
            existing.tasks.push(task);
            taskGroups.set(projectId, existing);
        });

        (expenseItems || []).forEach((expense) => {
            const projectId = expense.projectId || null;
            if (!projectId) {
                return;
            }

            const existing = taskGroups.get(projectId) || { tasks: [], expenseItems: [] };
            existing.expenseItems.push(expense);
            taskGroups.set(projectId, existing);
        });

        const projectBreakdowns = Array.from(taskGroups.entries()).map(([projectId, group]) => {
            const projectItem = projectById.get(projectId);
            const taskSubtotal = group.tasks.reduce((sum, task) => {
                return sum + getInvoiceTaskAmount(task, task.isMerged ? task.mergedSubtasks : []);
            }, 0);
            const expenseSubtotal = group.expenseItems.reduce((sum, expense) => sum + (expense.amount || 0), 0);
            const totalHours = group.tasks
                .filter((task) => !task.useFlatRate)
                .reduce((sum, task) => {
                    const mergedHours = Array.isArray(task.mergedSubtasks)
                        ? task.mergedSubtasks.reduce((mergedTotal, mergedTask) => mergedTotal + (Number(mergedTask.hours) || 0), 0)
                        : 0;
                    return sum + (Number(task.hours) || 0) + mergedHours;
                }, 0);
            const pricingModes = new Set(
                group.tasks.map((task) => (task.useFlatRate ? 'flat' : 'hourly'))
            );
            const pricingMode = pricingModes.size > 1
                ? 'mixed'
                : (pricingModes.values().next().value || (projectItem?.flatRate ? 'flat' : 'hourly'));

            return {
                projectId,
                projectTitle: projectItem?.title || group.tasks[0]?.projectTitle || 'Unknown Project',
                clientId: selectedClient?.id || '',
                pricingMode,
                tasks: group.tasks,
                expenseItems: group.expenseItems,
                totalHours: Math.round(totalHours * 100) / 100,
                subtotal: Math.round((taskSubtotal + expenseSubtotal) * 100) / 100,
            };
        });
        const invoiceSubtotal = Number(pricing?.subtotal) || 0;
        const invoiceDiscount = Number(pricing?.discount) || 0;
        const invoiceShipping = Number(pricing?.shipping) || 0;
        const invoiceTax = Number(pricing?.tax) || 0;

        return projectBreakdowns.map((breakdown) => {
            const ratio = invoiceSubtotal > 0 ? breakdown.subtotal / invoiceSubtotal : 0;
            const allocatedDiscount = Math.round(invoiceDiscount * ratio * 100) / 100;
            const allocatedShipping = Math.round(invoiceShipping * ratio * 100) / 100;
            const allocatedTax = Math.round(invoiceTax * ratio * 100) / 100;

            return {
                ...breakdown,
                allocatedDiscount,
                allocatedShipping,
                allocatedTax,
                allocatedTotal: Math.round((breakdown.subtotal - allocatedDiscount + allocatedShipping + allocatedTax) * 100) / 100,
            };
        });
    }, [getInvoiceTaskAmount, selectedClient?.id, selectedProjectsForInvoice]);

    const buildQuoteData = useCallback(() => {
        if (!selectedProject) {
            showError('Please select a project before generating a quote.');
            return null;
        }

        try {
            const quoteDate = useInvoiceDateOverride && invoiceDateOverride
                ? toStorageDate(new Date(invoiceDateOverride))
                : toStorageDate(new Date());

            return buildQuoteDocumentData({
                project: selectedProject,
                tasks,
                clients,
                businessInfos,
                paymentMethods,
                invoiceTemplates,
                client: selectedClient || null,
                businessInfo: resolveCurrentBusinessInfo(selectedBusinessInfo),
                paymentMethod: selectedPaymentMethod || null,
                template: selectedTemplate || null,
                note: invoiceNote,
                quoteTasks: getNormalizedDocumentTasks(),
                additionalTasks: getNormalizedAdditionalDocumentTasks(),
                quoteDate,
                quoteTimestamp: quoteNumberTimestamp || getQuoteNumberTimestamp(),
            });
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Unable to prepare quote.');
            return null;
        }
    }, [businessInfos, clients, getNormalizedAdditionalDocumentTasks, getNormalizedDocumentTasks, invoiceDateOverride, invoiceNote, invoiceTemplates, paymentMethods, quoteNumberTimestamp, resolveCurrentBusinessInfo, selectedBusinessInfo, selectedClient, selectedPaymentMethod, selectedProject, selectedTemplate, showError, tasks, useInvoiceDateOverride]);

    /**
     * Build invoice data for preview or save
     */
    const buildInvoiceData = ({ applyTemplateSequentialUpdate = false } = {}) => {
        // Validate required information
        if (!selectedClient) {
            showError('Please select client information');
            return null;
        }

        // Template selection is required
        if (!selectedTemplate) {
            showError('Please select an invoice template');
            return null;
        }

        // Check if any tasks are selected for billing
        const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
        const selectedExpensesCount = Object.values(selectedExpensesForBilling).filter(Boolean).length;
        const hasSelectedItems = selectedTasksCount > 0 || additionalTasks.length > 0 || selectedExpensesCount > 0 || additionalExpenses.length > 0;
        
        if (!hasSelectedItems) {
            showError('Please select at least one task or expense to bill, or add an additional item');
            return null;
        }

        // Validate invoice date override is not in the future
        if (useInvoiceDateOverride && invoiceDateOverride) {
            const overrideDate = new Date(invoiceDateOverride);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // Set to end of today for comparison
            
            if (overrideDate > today) {
                showError('Invoice date cannot be set to a future date');
                return null;
            }
        }

        const pricing = calculatePricing;

        if (pricing.total <= 0) {
            showWarning('Invoice total must be greater than 0 to generate an invoice');
            return null;
        }

        const totalHours = pricing.totalHours;

        // Calculate due date using template - use override date if available (for both new and editing)
        // Priority: 1. Date override (if enabled), 2. Original date (if editing), 3. Today's date (for new)
        const invoiceDate = useInvoiceDateOverride && invoiceDateOverride
            ? new Date(invoiceDateOverride)
            : editingInvoice 
                ? new Date(editingInvoice.date) 
                : new Date();

        const resolvedTemplate = selectedTemplate
            ? resolveCurrentInvoiceTemplate(selectedTemplate, invoiceTemplates)
            : (() => {
                if (!editingInvoice) return null;
                return resolveCurrentInvoiceTemplate(editingInvoice, invoiceTemplates);
            })();

        if (!resolvedTemplate) {
            showError('Please select an invoice template');
            return null;
        }

        const nextSequentialNumber = !editingInvoice
            ? getNextSequentialNumberForTemplate(resolvedTemplate, invoices)
            : null;
        const templateForInvoiceNumber = nextSequentialNumber === null
            ? resolvedTemplate
            : {
                ...resolvedTemplate,
                currentSequentialNumber: nextSequentialNumber,
            };

        // Generate invoice ID - use selected project or a generic format for standalone invoices
        const invoiceId = editingInvoice 
            ? editingInvoice.id 
            : selectedProject 
                ? `INV-${selectedProject.id.slice(-8)}-${Date.now()}` 
                : `INV-${selectedClient?.id?.slice(-8) || 'STANDALONE'}-${Date.now()}`;

        // Generate invoice number using the latest template state
        const invoiceNumber = editingInvoice 
            ? editingInvoice.invoiceNumber 
            : generateInvoiceNumber(templateForInvoiceNumber, selectedProject, { issuedAt: invoiceDate });
        const dueDate = calculateDueDate(resolvedTemplate, invoiceDate);

        // Update template sequential number if creating new invoice
        if (applyTemplateSequentialUpdate && !editingInvoice) {
            updateTemplateSequentialNumber(templateForInvoiceNumber);
        }

        const resolvedPaymentMethod = selectedPaymentMethod || (() => {
            if (!editingInvoice) return null;
            const paymentMethodId = editingInvoice.paymentMethodId || editingInvoice.paymentMethod?.id;
            if (!paymentMethodId) return editingInvoice.paymentMethod || null;
            return paymentMethods.find(pm => pm.id === paymentMethodId) || editingInvoice.paymentMethod || null;
        })();

        const resolvedBusinessInfo = resolveCurrentBusinessInfo(selectedBusinessInfo) || (() => {
            if (!editingInvoice) return null;
            return resolveCurrentBusinessInfo(editingInvoice);
        })();

        const selectedExpenseItems = availableExpensesWithConversion
            .filter((expense) => selectedExpensesForBilling[expense.id] && expense.isConvertible !== false)
            .map((expense) => ({
                id: expense.id,
                title: expense.title,
                projectId: expense.projectId || null,
                projectTitle: expense.projectId ? (projects.find((projectItem) => projectItem.id === expense.projectId)?.title || '') : '',
                amount: expense.convertedAmount || 0,
                date: expense.date,
                supplierName: expense.supplierName || null,
                currency: normalizedInvoiceCurrency,
                originalAmount: expense.originalAmount,
                originalCurrency: expense.originalCurrency,
                exchangeRate: expense.exchangeRate
            }));

        const projectExpenseItems = selectedExpenseItems.filter((expense) => expense.projectId);
        const clientExpenseItems = selectedExpenseItems.filter((expense) => !expense.projectId);

        const invoiceOnlyExpenseItems = additionalExpenses.map((expense) => ({
            id: expense.id,
            title: expense.title,
            amount: expense.amount || 0,
            supplierName: expense.supplierName || null,
            currency: normalizedInvoiceCurrency,
            originalAmount: expense.originalAmount || expense.amount || 0,
            originalCurrency: expense.originalCurrency || normalizedInvoiceCurrency,
            exchangeRate: expense.exchangeRate || 1
        }));

        const allExpenseItems = [...selectedExpenseItems, ...invoiceOnlyExpenseItems];

        const expenseInvoiceItems = selectedExpenseItems.map((expense) => ({
            description: expense.title,
            quantity: 1,
            rate: expense.amount,
            amount: expense.amount,
            expenseId: expense.id,
            originalAmount: expense.originalAmount,
            originalCurrency: expense.originalCurrency,
            exchangeRate: expense.exchangeRate
        }));

        const invoiceOnlyItems = invoiceOnlyExpenseItems.map((expense) => ({
            description: expense.title,
            quantity: 1,
            rate: expense.amount,
            amount: expense.amount,
            originalAmount: expense.originalAmount,
            originalCurrency: expense.originalCurrency,
            exchangeRate: expense.exchangeRate,
            supplierName: expense.supplierName || null
        }));

        const normalizedSelectedInvoiceTasks = getNormalizedDocumentTasks();
        const normalizedAdditionalTasks = getNormalizedAdditionalDocumentTasks();
        const invoiceProjectBreakdowns = buildInvoiceProjectBreakdowns(normalizedSelectedInvoiceTasks, projectExpenseItems, pricing);

        const resolvedBrandAsset = resolvedBusinessInfo?.branding?.logoAssetId
            ? getBusinessBrandAsset(resolvedBusinessInfo.branding.logoAssetId)
            : null;
        const brandingSnapshot = {
            businessInfoId: resolvedBusinessInfo?.id || null,
            templateId: resolvedTemplate?.id || null,
            layoutStyle: normalizeInvoiceLayoutStyle(resolvedTemplate?.layoutStyle || DEFAULT_INVOICE_LAYOUT_STYLE),
            logoPlacement: normalizeInvoiceLogoPlacement(resolvedTemplate?.logoPlacement || DEFAULT_INVOICE_LOGO_PLACEMENT),
            showBusinessLogo: resolvedTemplate?.brandingOptions?.showBusinessLogo ?? true,
            useBusinessPrimaryColor: resolvedTemplate?.brandingOptions?.useBusinessPrimaryColor ?? true,
            primaryColor: resolvedBusinessInfo?.branding?.primaryColor || null,
            logoAssetId: resolvedBrandAsset?.id || null,
            logoAssetMeta: resolvedBrandAsset ? {
                mimeType: resolvedBrandAsset.mimeType,
                width: resolvedBrandAsset.width,
                height: resolvedBrandAsset.height,
                byteSize: resolvedBrandAsset.byteSize,
                contentHash: resolvedBrandAsset.contentHash,
            } : null,
        };

        return {
            id: invoiceId,
            project: selectedProject,
            projectId: selectedProject?.id || null,
            projectIds: selectedProjectIdsForInvoice,
            projectBreakdowns: invoiceProjectBreakdowns,
            clientExpenseItems,
            invoiceOnlyExpenseItems,
            client: {
                name: selectedClient?.clientName || '',
                contactPerson: selectedClient?.contactPerson || '',
                email: selectedClient?.email || '',
                address: selectedClient?.address || '',
                city: selectedClient?.city || '',
                state: selectedClient?.state || '',
                zip: selectedClient?.zip || '',
                country: selectedClient?.country || ''
            },
            tasks: normalizedSelectedInvoiceTasks,
            additionalTasks: normalizedAdditionalTasks,
            expenseItems: allExpenseItems,
            items: [...expenseInvoiceItems, ...invoiceOnlyItems],
            taskFlatRates: taskFlatRates,
            useFlatRate: useFlatRate,
            taskHourlyRates: taskHourlyRates,
            taskQuantities: taskQuantities, // Save task quantities state
            mergedSubtasks: mergedSubtasks, // Save merged subtasks state
            note: invoiceNote,
            totalHours: totalHours,
            subtotal: pricing.subtotal,
            total: pricing.total,
            discount: pricing.discount,
            discountType: discountType,
            discountValue: discountValue,
            shipping: pricing.shipping,
            tax: pricing.tax,
            taxRate: pricing.taxRate,
            taxLabel: pricing.taxLabel,
            taxOverride: taxOverride.enabled ? taxOverride : null,
            paymentMethod: resolvedPaymentMethod ? { ...resolvedPaymentMethod } : null,
            paymentMethodId: resolvedPaymentMethod?.id || null,
            businessInfo: resolvedBusinessInfo ? { ...resolvedBusinessInfo } : null,
            businessInfoId: resolvedBusinessInfo?.id || null,
            brandingSnapshot,
            billingPeriodPreset,
            billingPeriodStart: activeBillingPeriodStart || null,
            billingPeriodEnd: activeBillingPeriodEnd || null,
            clientId: selectedClient?.id || null,
            currency: selectedClient?.defaultCurrency || getPreferredCurrency(),
            template: resolvedTemplate ? { ...resolvedTemplate } : null,
            templateId: resolvedTemplate?.id || null,
            invoiceNumber: invoiceNumber,
            status: editingInvoice?.status || 'sent',
            // Store dates in ISO format (YYYY-MM-DD) for portability
            date: useInvoiceDateOverride && invoiceDateOverride 
                ? toStorageDate(new Date(invoiceDateOverride))
                : (editingInvoice ? editingInvoice.date : toStorageDate(new Date())),
            dateOverride: useInvoiceDateOverride && invoiceDateOverride 
                ? toStorageDate(new Date(invoiceDateOverride))
                : null,
            dueDate: dueDate,
            createdAt: editingInvoice ? editingInvoice.createdAt : Date.now(),
            htmlContent: null,
        };
    };

    const syncInvoiceAdjustments = useCallback((invoiceData, adjustmentTimestamp) => {
        if (!invoiceData || !Array.isArray(invoiceData.tasks)) return;

        const invoiceId = invoiceData.id;
        const existingAdjustments = timeEntries.filter(entry =>
            entry.source === 'invoice-adjustment' && entry.billedInvoiceId === invoiceId
        );
        const existingByTaskId = new Map(existingAdjustments.map(entry => [entry.taskId, entry]));

        const tasksToAdjust = invoiceData.tasks.filter(task => task && task.id);
        const taskIdsToAdjust = new Set(tasksToAdjust.map(task => task.id));

        tasksToAdjust.forEach(task => {
            if (task.useFlatRate) return;

            const originalMs = Number.isFinite(task.originalTimeMs)
                ? task.originalTimeMs
                : (Number(task.originalHours) || 0) * 3600000;
            const desiredMs = (Number(task.hours) || 0) * 3600000;
            const deltaMs = desiredMs - originalMs;

            const existingEntry = existingByTaskId.get(task.id);

            if (deltaMs <= 0) {
                if (existingEntry) {
                    deleteEntry(existingEntry.id);
                }
                return;
            }

            const startTime = existingEntry?.start || (adjustmentTimestamp - deltaMs);
            const endTime = startTime + deltaMs;
            const hourlyRate = Number.isFinite(task.hourlyRate) ? task.hourlyRate : null;

            if (existingEntry) {
                updateEntry(existingEntry.id, {
                    start: startTime,
                    end: endTime,
                    note: 'Invoice adjustment',
                    source: 'invoice-adjustment',
                    billedAt: adjustmentTimestamp,
                    billedInvoiceId: invoiceId,
                    billedHourlyRate: hourlyRate
                });
                return;
            }

            createEntry({
                taskId: task.id,
                start: startTime,
                end: endTime,
                note: 'Invoice adjustment',
                source: 'invoice-adjustment',
                billedAt: adjustmentTimestamp,
                billedInvoiceId: invoiceId,
                billedHourlyRate: hourlyRate
            });
        });

        existingAdjustments.forEach(entry => {
            if (!taskIdsToAdjust.has(entry.taskId)) {
                deleteEntry(entry.id);
            }
        });
    }, [timeEntries, createEntry, updateEntry, deleteEntry]);

    const getBilledTaskIdsForInvoiceCreation = () => {
        const billedTaskIds = new Set();
        const invoiceTaskIds = new Set(invoiceTasks.map((task) => task.id));

        invoiceTasks.forEach(task => {
            if (selectedTasksForBilling[task.id] && invoiceTaskIds.has(task.id)) {
                billedTaskIds.add(task.id);

                if (mergedSubtasks[task.id]) {
                    const subtasks = invoiceTasks.filter(subtask =>
                        subtask.parentTaskId === task.id && invoiceTaskIds.has(subtask.id)
                    );
                    subtasks.forEach(subtask => {
                        billedTaskIds.add(subtask.id);
                    });
                }
            }
        });

        return Array.from(billedTaskIds);
    };

    const buildBillingStateSnapshot = (snapshotTimestamp) => {
        const taskLastBilledAt = {};
        const billedTaskIds = getBilledTaskIdsForInvoiceCreation();

        billedTaskIds.forEach(taskId => {
            const task = tasks.find(t => t.id === taskId);
            taskLastBilledAt[taskId] = task?.lastBilledAt || null;
        });

        return {
            version: 1,
            capturedAt: snapshotTimestamp,
            taskLastBilledAt,
        };
    };

    /**
     * Save invoice (create new or update existing)
     */
    const handleSaveInvoice = (e) => {
        e.preventDefault();
        const invoiceData = buildInvoiceData({ applyTemplateSequentialUpdate: true });
        if (!invoiceData) {
            return;
        }

        const invoiceId = invoiceData.id;
        const adjustmentTimestamp = Date.now();

        if (!editingInvoice && !isQuoteMode) {
            invoiceData.billingStateSnapshot = buildBillingStateSnapshot(adjustmentTimestamp);
        }

        // Store invoice in the invoices collection
        if (editingInvoice) {
            // Update existing invoice - preserving original createdAt
            updateInvoice(editingInvoice.id, { ...invoiceData, createdAt: editingInvoice.createdAt });
        } else {
            // Add new invoice - createInvoice auto-generates id and timestamps
            createInvoice(invoiceData);
        }

        syncInvoiceAdjustments(invoiceData, adjustmentTimestamp);

        const selectedExpenseIds = new Set(
            Object.keys(selectedExpensesForBilling).filter((expenseId) => selectedExpensesForBilling[expenseId])
        );
        const previouslyBilledExpenseIds = new Set(
            expenses.filter((expense) => expense.invoiceId === invoiceId).map((expense) => expense.id)
        );

        selectedExpenseIds.forEach((expenseId) => {
            markAsBilled(expenseId, invoiceId);
        });

        previouslyBilledExpenseIds.forEach((expenseId) => {
            if (!selectedExpenseIds.has(expenseId)) {
                markAsUnbilled(expenseId);
            }
        });

        const invoiceTaskMap = new Map((invoiceData.tasks || []).map((task) => [task.id, task]));

        tasks.forEach((task) => {
            if (!task?.id) {
                return;
            }

            const invoiceTask = invoiceTaskMap.get(task.id);
            const existingQuoteAmount = getCurrentQuotedFlatAmount(task);

            if (
                invoiceTask
                && isQuotedFlatInvoiceTask(invoiceTask)
                && existingQuoteAmount !== null
                && (!editingInvoice || !task.quotedAmountBilling?.invoiceId)
            ) {
                updateTask(task.id, {
                    estimatedFlatAmount: null,
                    quotedAmountBilling: {
                        invoiceId,
                        billedAt: adjustmentTimestamp,
                        total: existingQuoteAmount
                    }
                });
                return;
            }

            if (
                editingInvoice
                && task.quotedAmountBilling?.invoiceId === invoiceId
                && !invoiceTask
            ) {
                const restoredQuoteAmount = existingQuoteAmount ?? task.quotedAmountBilling.total;

                updateTask(task.id, {
                    estimatedFlatAmount: restoredQuoteAmount,
                    quotedAmountBilling: null
                });
            }
        });

        // Update tasks to set lastBilledAt for billed tasks
        if (!editingInvoice) {
            const currentTime = adjustmentTimestamp;
            const billedTaskIds = getBilledTaskIdsForInvoiceCreation();

            const billedRateByTaskId = new Map();
            (invoiceData.tasks || []).forEach(task => {
                const rate = Number.isFinite(task.hourlyRate) ? task.hourlyRate : 0;
                billedRateByTaskId.set(task.id, rate);

                if (task.isMerged && Array.isArray(task.mergedSubtasks)) {
                    task.mergedSubtasks.forEach(subtask => {
                        const subtaskRate = Number.isFinite(subtask.hourlyRate) ? subtask.hourlyRate : rate;
                        billedRateByTaskId.set(subtask.id, subtaskRate);
                    });
                }
            });

            const previousBillingCutoffs = new Map();
            billedTaskIds.forEach(taskId => {
                const task = tasks.find(t => t.id === taskId);
                previousBillingCutoffs.set(taskId, task?.lastBilledAt || 0);
            });

            const nextBillingCutoffs = new Map(previousBillingCutoffs);

            if (Array.isArray(timeEntries) && timeEntries.length > 0) {
                timeEntries.forEach(entry => {
                    if (!billedRateByTaskId.has(entry.taskId)) return;
                    if (entry.source === 'invoice-adjustment') return;

                    const cutoff = previousBillingCutoffs.get(entry.taskId) || 0;
                    if (entry.start <= cutoff) return;
                    if (!entry.end || entry.end <= entry.start) return;
                    if (entry.start > currentTime) return;
                    if (!isStoredDateWithinBillingRange(entry.start, activeBillingPeriodStart, activeBillingPeriodEnd)) return;

                    updateEntry(entry.id, {
                        billedHourlyRate: billedRateByTaskId.get(entry.taskId),
                        billedAt: currentTime,
                        billedInvoiceId: invoiceId
                    });

                    const nextCutoff = Math.max(nextBillingCutoffs.get(entry.taskId) || 0, entry.end);
                    nextBillingCutoffs.set(entry.taskId, nextCutoff);
                });
            }
            
            // Update lastBilledAt using the latest billed entry end per task.
            // Using invoice creation time can block valid backdated entries.
            billedTaskIds.forEach(taskId => {
                const task = tasks.find(t => t.id === taskId);
                const previousCutoff = previousBillingCutoffs.get(taskId) || 0;
                const nextCutoff = nextBillingCutoffs.get(taskId) || 0;

                if (task && nextCutoff > previousCutoff) {
                    updateTask(taskId, { lastBilledAt: nextCutoff });
                }
            });
            
        }

        // Reset form
        setShowInvoiceForm(false);
        setSelectedAdditionalProjectIds([]);
        clearInvoiceFormState();
        setPendingDraftRestore(null);
        
        // Use the centralized reset function
        handleResetInvoiceForm();
        
        // Reset the project manually changed flag
        setProjectManuallyChanged(false);
        
        // Keep selected client info so it stays for next invoice
        
        // Call callback if provided
        if (onInvoiceSaved) {
            onInvoiceSaved();
        }
        
        // Show appropriate toast notification based on action (new or update)
        if (editingInvoice) {
            showSuccess('Invoice updated successfully!');
        } else {
            showSuccess('Invoice saved successfully! You can view, edit, or download it from the Invoices tab.');
        }
    };

    /**
     * Preview invoice in modal
     */
    const handlePreviewInvoice = () => {
        const documentData = isQuoteMode
            ? buildQuoteData()
            : buildInvoiceData({ applyTemplateSequentialUpdate: false });

        if (!documentData) {
            return;
        }

        setPreviewInvoice(documentData);
        setShowPreview(true);
    };

    const handleSendQuote = useCallback(() => {
        const quoteData = buildQuoteData();
        if (!quoteData) {
            return;
        }

        setQuoteEmailDocument(quoteData);
    }, [buildQuoteData]);

    const handleDownloadQuote = useCallback(async () => {
        const quoteData = buildQuoteData();
        if (!quoteData) {
            return;
        }

        const htmlContent = buildInvoiceHtmlContent(quoteData, clients, businessBrandAssets);
        await generatePDF(htmlContent, getQuoteDownloadFilename(selectedProject?.title || 'quote', quoteData.date));
        showSuccess('Quote downloaded');
    }, [buildQuoteData, businessBrandAssets, clients, selectedProject?.title, showSuccess]);

    /**
     * Open invoice form with prepared data or for editing
     */
    const openInvoiceForm = useCallback(() => {
        // Don't open again if it's already open to avoid re-rendering issues
        if (showInvoiceForm) return;
        
        // Check if a timer is currently active (running, not paused)
        if (isTimerActive && !isTimerPaused) {
            showError(`Cannot generate a ${isQuoteMode ? 'quote' : 'invoice'} while a timer is active. Please pause the timer first.`);
            return;
        }
        
        if (editingInvoice) {
            // Open form with existing invoice data
            setInvoiceTasks(editingInvoice.tasks || []);
            const initialHours = {};
            const initialFlatRates = {};
            const initialFlatRateToggles = {};
            const initialHourlyRates = {};
            const initialTaskQuantities = {};
            
            (editingInvoice.tasks || []).forEach(task => {
                initialHours[task.id] = Math.round((task.hours || 0) * 100) / 100; // Round to 2 decimal places
                
                // Load flat rate data if available
                if (task.flatRate) {
                    initialFlatRates[task.id] = task.flatRate;
                }
                
                // Load flat rate toggle state
                if (task.useFlatRate || (editingInvoice.useFlatRate && editingInvoice.useFlatRate[task.id])) {
                    initialFlatRateToggles[task.id] = true;
                }
                
                // Load custom hourly rates
                if (task.hourlyRate && task.hourlyRate !== selectedProject?.hourlyRate) {
                    initialHourlyRates[task.id] = task.hourlyRate;
                } else if (editingInvoice.taskHourlyRates && editingInvoice.taskHourlyRates[task.id]) {
                    initialHourlyRates[task.id] = editingInvoice.taskHourlyRates[task.id];
                }
                
                // Load task quantities for flat rate tasks
                if (task.quantity) {
                    initialTaskQuantities[task.id] = task.quantity;
                } else if (editingInvoice.taskQuantities && editingInvoice.taskQuantities[task.id]) {
                    initialTaskQuantities[task.id] = editingInvoice.taskQuantities[task.id];
                }
            });
            
            setEditableHours(initialHours);
            setTaskFlatRates(initialFlatRates);
            setUseFlatRate(initialFlatRateToggles);
            setTaskHourlyRates(initialHourlyRates);
            setTaskQuantities(initialTaskQuantities);
            
            // For editing invoices, initialize task selection based on which tasks were included in the original invoice
            const allTasksSelected = {};
            if (editingInvoice.tasks && editingInvoice.tasks.length > 0) {
                // Get the IDs of tasks that were included in the original invoice
                const originalTaskIds = editingInvoice.tasks.map(task => task.id);
                (editingInvoice.tasks || []).forEach(task => {
                    allTasksSelected[task.id] = originalTaskIds.includes(task.id);
                });
            } else {
                // Fallback: select all tasks if no original task data
                (editingInvoice.tasks || []).forEach(task => {
                    allTasksSelected[task.id] = true;
                });
            }
            setSelectedTasksForBilling(allTasksSelected);

            const initialExpenseSelection = {};
            const editingProjectIds = new Set(
                (Array.isArray(editingInvoice.projectIds) ? editingInvoice.projectIds : [editingInvoice.projectId || selectedProject?.id || null])
                    .filter(Boolean)
            );
            const editingClientId = editingInvoice.clientId || selectedClient?.id || null;
            const editingExpenseIds = new Set(
                (editingInvoice.items || [])
                    .filter((item) => item?.expenseId)
                    .map((item) => item.expenseId)
            );

            expenses
                .filter((expense) => {
                    if (!expense || !expense.billable) return false;
                    if (expense.projectId) {
                        if (editingProjectIds.size === 0 || !editingProjectIds.has(expense.projectId)) return false;
                    } else if (editingClientId) {
                        if (expense.clientId !== editingClientId) return false;
                    } else {
                        return false;
                    }

                    if (expense.billingStatus === 'unbilled') return true;
                    return expense.invoiceId === editingInvoice.id;
                })
                .forEach((expense) => {
                    initialExpenseSelection[expense.id] = editingExpenseIds.has(expense.id) || expense.invoiceId === editingInvoice.id;
                });
            setSelectedExpensesForBilling(initialExpenseSelection);
            
            // If the invoice has a projectId, set the selected project
            if (editingInvoice.projectId) {
                const invoiceProject = projects.find(p => p.id === editingInvoice.projectId);
                if (invoiceProject) {
                    setSelectedProject(invoiceProject);
                }
            }
            
            // When editing, project selection is allowed
            setIsProjectContextFixed(false);
        } else {
            if (isQuoteMode && !quoteNumberTimestamp) {
                setQuoteNumberTimestamp(getQuoteNumberTimestamp());
            }

            // Open form with new invoice data
            const quoteLineItems = isQuoteMode && selectedProject
                ? buildProjectQuoteLineItems({ project: selectedProject, tasks, clients })
                : null;
            const tasksData = isQuoteMode
                ? (quoteLineItems?.quoteTasks || []).map((task) => ({
                    ...task,
                    projectId: selectedProject?.id || null,
                    projectTitle: selectedProject?.title || '',
                    projectHourlyRate: typeof selectedProject?.hourlyRate === 'number' ? selectedProject.hourlyRate : 0,
                    projectFlatRate: selectedProject?.flatRate === true,
                    hourlyRate: typeof task.hourlyRate === 'number'
                        ? task.hourlyRate
                        : (typeof selectedProject?.hourlyRate === 'number' ? selectedProject.hourlyRate : 0),
                }))
                : prepareInvoiceDataForProjects(selectedProjectsForInvoice.length > 0 ? selectedProjectsForInvoice : (selectedProject ? [selectedProject] : []));
            
            // Even if there are no billable tasks, we still open the form
            // This allows users to manually add tasks with the "New Task" feature
            if (tasksData) {
                setInvoiceTasks(tasksData);
                // Initialize editable hours with original hours
                const initialHours = {};
                const initialTaskSelection = {};
                const initialTaskFlatRates = {};
                const initialFlatRateToggles = {};
                const initialTaskQuantities = {};
                
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                    initialTaskSelection[task.id] = true; // Select all tasks by default
                    
                    // For flat rate projects, pre-toggle all tasks to flat rate
                    if (task.projectFlatRate === true) {
                        const sourceTask = tasks.find((candidate) => candidate.id === task.id);
                        const estimatedFlatAmount = getCurrentQuotedFlatAmount(sourceTask);
                        const flatRateAmount = typeof task.flatRate === 'number' && Number.isFinite(task.flatRate)
                            ? task.flatRate
                            : (estimatedFlatAmount !== null ? estimatedFlatAmount : 0);

                        initialFlatRateToggles[task.id] = true;
                        initialTaskFlatRates[task.id] = flatRateAmount;
                        initialTaskQuantities[task.id] = 1;
                    }
                });
                
                setEditableHours(initialHours);
                setSelectedTasksForBilling(initialTaskSelection);

                if (isQuoteMode) {
                    setAdditionalTasks(quoteLineItems?.additionalTasks || []);
                    setAdditionalExpenses([]);
                }

                const initialExpenseSelection = {};
                if (!isQuoteMode) {
                    availableExpensesWithConversion.forEach((expense) => {
                        if (!shouldSelectExpenseByDefault(expense)) return;
                        initialExpenseSelection[expense.id] = true;
                    });
                }
                setSelectedExpensesForBilling(initialExpenseSelection);
                
                // Apply flat rate toggles for flat rate projects
                if (selectedProjectsForInvoice.some((projectItem) => projectItem?.flatRate)) {
                    setTaskFlatRates(initialTaskFlatRates);
                    setUseFlatRate(initialFlatRateToggles);
                    setTaskQuantities(initialTaskQuantities);
                    
                    // Also set the new task flat rate toggle to match project setting
                    setNewTaskUseFlatRate(selectedProject?.flatRate || false);
                } else {
                    // Reset flat rate data for hourly projects
                    setTaskFlatRates({});
                    setUseFlatRate({});
                    setTaskHourlyRates({});
                    setNewTaskUseFlatRate(false);
                }
            } else {
                // No billable tasks, but still continue with empty tasks array
                setInvoiceTasks([]);
                setEditableHours({});
                setTaskFlatRates({});
                setUseFlatRate({});
                setTaskHourlyRates({});
                setSelectedTasksForBilling({});
                setSelectedExpensesForBilling({});
                if (isQuoteMode) {
                    setAdditionalTasks(quoteLineItems?.additionalTasks || []);
                    setAdditionalExpenses([]);
                }
                
                // Set new task flat rate toggle based on project setting even when no billable tasks
                if (selectedProject && selectedProject.flatRate) {
                    setNewTaskUseFlatRate(true);
                } else {
                    setNewTaskUseFlatRate(false);
                }
            }
            
            // When opened from a project context (but not client context), lock the project selection
            // If we have a client prop, we're in client context mode and should allow project selection
            if (!client) {
                setIsProjectContextFixed(true);
                setIsClientContextFixed(false);
            } else {
                setIsProjectContextFixed(false); // Ensure project context is not fixed in client context
                setIsClientContextFixed(true);
            }
        }
        setPendingDraftRestore(getInvoiceFormState());
        setShowInvoiceForm(true);
    }, [availableExpensesWithConversion, client, clients, editingInvoice, expenses, getInvoiceFormState, isQuoteMode, isTimerActive, isTimerPaused, prepareInvoiceDataForProjects, projects, quoteNumberTimestamp, selectedClient, selectedProject, selectedProjectsForInvoice, setIsProjectContextFixed, shouldSelectExpenseByDefault, showError, showInvoiceForm, tasks]);

    // Auto-open form when editing an invoice
    useEffect(() => {
        // Only open if we have a new editing invoice and the modal isn't already shown
        if (editingInvoice && !showInvoiceForm && editingInvoice.id !== handledEditingInvoice) {
            setHandledEditingInvoice(editingInvoice.id);
            openInvoiceForm();
        } else if (!editingInvoice) {
            // Reset the handled state when not editing
            setHandledEditingInvoice(null);
        }
    }, [editingInvoice, openInvoiceForm, showInvoiceForm, handledEditingInvoice]);

    // Calculate the project-context invoice preview total before the modal opens.
    const currentProjectForCalculation = (!client && !editingInvoice) ? (selectedProject || project) : null;
    const invoicePreview = currentProjectForCalculation
        ? getProjectInvoicePreview(currentProjectForCalculation, {
            clients,
            tasks,
            timeEntries,
            expenses,
            exchangeRates,
            billingPeriodStart: activeBillingPeriodStart,
            billingPeriodEnd: activeBillingPeriodEnd,
        })
        : null;

    // Invoice Modal
    return (
        <div className="space-y-4">
            {showButton && (
                <InvoiceGeneratorButton
                    onClick={openInvoiceForm}
                    currentProject={currentProjectForCalculation}
                    invoicePreview={invoicePreview}
                    clients={clients}
                    mode={mode}
                />
            )}
            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <InvoiceModal
                    showInvoiceForm={showInvoiceForm}
                    editingInvoice={editingInvoice}
                    handleClose={handleCloseInvoice}
                    handleSaveInvoice={handleSaveInvoice}
                    handlePreviewInvoice={handlePreviewInvoice}
                    handleSendQuote={handleSendQuote}
                    handleDownloadQuote={handleDownloadQuote}
                    canUndoInvoice={canUndoEditingInvoice}
                    handleUndoInvoice={openUndoInvoiceConfirm}
                    mode={mode}
                    isProjectContextFixed={isProjectContextFixed}
                    isClientContextFixed={isClientContextFixed}
                    projects={projects}
                    selectedProject={selectedProject}
                    selectedAdditionalProjectIds={selectedAdditionalProjectIds}
                    setSelectedAdditionalProjectIds={setSelectedAdditionalProjectIds}
                    handleProjectSelection={handleProjectSelection}
                    clients={clients}
                    selectedClient={selectedClient}
                    handleClientSelection={handleClientSelection}
                    invoiceTasks={invoiceTasks}
                    setShowAddTaskForm={setShowAddTaskForm}
                    showAddTaskForm={showAddTaskForm}
                    newTaskTitle={newTaskTitle}
                    setNewTaskTitle={setNewTaskTitle}
                    newTaskUseFlatRate={newTaskUseFlatRate}
                    handleToggleNewTaskFlatRate={handleToggleNewTaskFlatRate}
                    newTaskQuantity={newTaskQuantity}
                    setNewTaskQuantity={setNewTaskQuantity}
                    newTaskHours={newTaskHours}
                    setNewTaskHours={setNewTaskHours}
                    newTaskHourlyRate={newTaskHourlyRate}
                    setNewTaskHourlyRate={setNewTaskHourlyRate}
                    additionalTasks={additionalTasks}
                    handleAddAdditionalTask={handleAddAdditionalTask}
                    handleRemoveAdditionalTask={handleRemoveAdditionalTask}
                    handleTaskSelectionForBilling={handleTaskSelectionForBilling}
                    handleHoursChange={handleHoursChange}
                    handleToggleFlatRate={handleToggleFlatRate}
                    handleFlatRateChange={handleFlatRateChange}
                    handleQuantityChange={handleQuantityChange}
                    handleTaskHourlyRateChange={handleTaskHourlyRateChange}
                    handleAdditionalTaskHoursChange={handleAdditionalTaskHoursChange}
                    handleAdditionalTaskFlatRateChange={handleAdditionalTaskFlatRateChange}
                    handleAdditionalTaskQuantityChange={handleAdditionalTaskQuantityChange}
                    handleAdditionalTaskHourlyRateChange={handleAdditionalTaskHourlyRateChange}
                    handleToggleAdditionalTaskFlatRate={handleToggleAdditionalTaskFlatRate}
                    calculatePricing={calculatePricing}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    discountValue={discountValue}
                    setDiscountValue={setDiscountValue}
                    shippingAmount={shippingAmount}
                    setShippingAmount={setShippingAmount}
                    taxOverride={taxOverride}
                    setTaxOverride={setTaxOverride}
                    getCurrencySymbol={getCurrencySymbol}
                    businessInfos={businessInfos}
                    selectedBusinessInfo={selectedBusinessInfo}
                    paymentMethods={paymentMethods}
                    selectedPaymentMethod={selectedPaymentMethod}
                    invoiceNote={invoiceNote}
                    setInvoiceNote={setInvoiceNote}
                    editableHours={editableHours}
                    taskFlatRates={taskFlatRates}
                    useFlatRate={useFlatRate}
                    taskHourlyRates={taskHourlyRates}
                    taskQuantities={taskQuantities}
                    setNewTaskUseFlatRate={setNewTaskUseFlatRate}
                    selectedTasksForBilling={selectedTasksForBilling}
                    setSelectedBusinessInfo={setSelectedBusinessInfo}
                    setSelectedPaymentMethod={setSelectedPaymentMethod}
                    setSelectedTasksForBilling={setSelectedTasksForBilling}
                    availableExpenses={availableExpensesWithConversion}
                    selectedExpensesForBilling={selectedExpensesForBilling}
                    setSelectedExpensesForBilling={setSelectedExpensesForBilling}
                    additionalExpenses={additionalExpenses}
                    showAddExpenseForm={showAddExpenseForm}
                    setShowAddExpenseForm={setShowAddExpenseForm}
                    newExpenseTitle={newExpenseTitle}
                    setNewExpenseTitle={setNewExpenseTitle}
                    newExpenseAmount={newExpenseAmount}
                    setNewExpenseAmount={setNewExpenseAmount}
                    newExpenseCurrency={newExpenseCurrency}
                    setNewExpenseCurrency={setNewExpenseCurrency}
                    newExpenseSupplierName={newExpenseSupplierName}
                    setNewExpenseSupplierName={setNewExpenseSupplierName}
                    handleAddAdditionalExpense={handleAddAdditionalExpense}
                    handleRemoveAdditionalExpense={handleRemoveAdditionalExpense}
                    conversionUnavailableCount={conversionUnavailableCount}
                    exchangeRatesError={exchangeRatesError}
                    exchangeRatesLoading={exchangeRatesLoading}
                    mergedSubtasks={mergedSubtasks}
                    handleToggleMergeSubtasks={handleToggleMergeSubtasks}
                    taskInputRef={taskInputRef}
                    invoiceTemplates={invoiceTemplates}
                    selectedTemplate={selectedTemplate}
                    handleTemplateSelection={handleTemplateSelection}
                    invoiceDateOverride={invoiceDateOverride}
                    setInvoiceDateOverride={setInvoiceDateOverride}
                    useInvoiceDateOverride={useInvoiceDateOverride}
                    setUseInvoiceDateOverride={setUseInvoiceDateOverride}
                    billingPeriodPreset={billingPeriodPreset}
                    setBillingPeriodPreset={setBillingPeriodPreset}
                    billingPeriodStart={billingPeriodStart}
                    setBillingPeriodStart={setBillingPeriodStart}
                    billingPeriodEnd={billingPeriodEnd}
                    setBillingPeriodEnd={setBillingPeriodEnd}
                    billingPeriodOptions={INVOICE_BILLING_PERIOD_OPTIONS}
                    // Modal stacking functions
                    openClientModal={handleOpenClientModal}
                    openProjectModal={handleOpenProjectModal}
                    openBusinessModal={handleOpenBusinessModal}
                    openPaymentMethodModal={handleOpenPaymentMethodModal}
                    openTemplateModal={handleOpenTemplateModal}
                    saveFormState={saveInvoiceFormState}
                    getSavedState={getInvoiceFormState}
                />
            )}
            {quoteEmailDocument && (
                <EmailPreviewModal
                    isOpen={true}
                    onClose={() => setQuoteEmailDocument(null)}
                    invoice={quoteEmailDocument}
                    client={selectedClient || client || null}
                    businessInfo={quoteEmailDocument.businessInfo || null}
                    clients={clients}
                    sendType="quote"
                />
            )}
            <InvoicePreviewModal
                isOpen={showPreview && !!previewInvoice}
                onClose={() => setShowPreview(false)}
                title={previewInvoice ? `${previewInvoice.documentMode === 'quote' ? 'Quote' : 'Invoice'} Preview - ${previewInvoice.invoiceNumber}` : ''}
                invoice={previewInvoice}
                htmlContent={previewInvoice ? getCurrentInvoiceHtmlContent(previewInvoice, clients, businessBrandAssets) : ''}
            />
            <Modal
                isOpen={showUndoInvoiceConfirm}
                onClose={closeUndoInvoiceConfirm}
                title="Undo latest invoice?"
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="destructive"
                            onClick={handleConfirmUndoInvoice}
                            loading={isUndoingInvoice}
                            loadingText="Undoing Invoice"
                            disabled={undoInvoiceConfirmationText.trim() !== (editingInvoice?.invoiceNumber || '')}
                        >
                            Undo Invoice
                        </Button>
                        <Button
                            variant="outline"
                            onClick={closeUndoInvoiceConfirm}
                            disabled={isUndoingInvoice}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            >
                {editingInvoice && (() => {
                    const template = resolveCurrentInvoiceTemplate(editingInvoice, invoiceTemplates);
                    const sequenceRollback = getInvoiceSequenceRollback(editingInvoice, template, invoices);

                    return (
                        <div className="space-y-4">
                            <Notice
                                title="This will restore billing state as if the invoice was never generated."
                                variant="warning"
                            >
                                <p>
                                    The invoice record will be removed, billed time entries will be restored, invoice adjustments deleted, quoted flat amounts released, and linked expenses marked unbilled again.
                                </p>
                            </Notice>

                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                    Invoice: <span className="font-medium text-foreground">{editingInvoice.invoiceNumber}</span>
                                </p>
                                <p>
                                    Total: <span className="font-medium text-foreground">
                                        {getCurrencySymbol(editingInvoice.currency || getPreferredCurrency())}{getInvoiceTotal(editingInvoice).toFixed(2)}
                                    </span>
                                </p>
                                <p>
                                    Invoice number sequence: <span className="font-medium text-foreground">
                                        {sequenceRollback.canRollback ? 'Will be restored' : 'Will stay as-is'}
                                    </span>
                                </p>
                                {sequenceRollback.reason && (
                                    <p>{sequenceRollback.reason}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="undo-edit-invoice-confirmation" className="block">
                                    Type <strong>{editingInvoice.invoiceNumber}</strong> to confirm:
                                </Label>
                                <Input
                                    id="undo-edit-invoice-confirmation"
                                    type="text"
                                    value={undoInvoiceConfirmationText}
                                    onChange={(event) => setUndoInvoiceConfirmationText(event.target.value)}
                                    placeholder={editingInvoice.invoiceNumber}
                                    disabled={isUndoingInvoice}
                                />
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default React.memo(InvoiceGenerator);
