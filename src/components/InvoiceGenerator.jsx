import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createInvoiceHTML } from '../utils/pdfUtils.ts';
import { millisecondsToHours, toStorageDate, toDisplayDate, timestampToDateString } from '../utils/dateUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import InvoiceModal from './invoice/InvoiceModal';
import InvoiceGeneratorButton from './invoice/InvoiceGeneratorButton';
import InvoicePreviewModal from './invoice/InvoicePreviewModal';
import * as InvoiceHandler from './invoice/InvoiceHandler.ts';
import useInvoicePricing from './invoice/hooks/useInvoicePricing.ts';
import { calculateDueDate, generateInvoiceNumber } from './invoice/utils/invoiceDateUtils.ts';
import { buildInvoiceTaskData } from './invoice/InvoiceCalculations.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useInvoiceTemplates } from '../hooks/useInvoiceTemplates.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { getInvoicesForProject, getLatestInvoiceForProject } from '../utils/invoiceUtils.ts';

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
    // Modal stacking functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    activeModal = null
}) => {
    // Yjs hooks for data access
    const { invoices, createInvoice, updateInvoice } = useInvoices();
    const { projects } = useProjects();
    const { tasks, updateTask } = useTasks();
    const { createEntry, updateEntry, deleteEntry } = useTimeEntries();
    const { expenses, markAsBilled, markAsUnbilled } = useExpenses();
    const { invoiceTemplates, updateInvoiceTemplate } = useInvoiceTemplates();
    const { getTimerForProject } = useTimers();
    
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBusinessInfo, setSelectedBusinessInfo] = useState(null);
    const [selectedClient, setSelectedClient] = useState(client); // Initialize with client prop if provided
    const [selectedProject, setSelectedProject] = useState(project); // Initialize with current project
    const [selectedTemplate, setSelectedTemplate] = useState(null); // Selected invoice template
    const [isProjectContextFixed, setIsProjectContextFixed] = useState(!!project && !client); // Track if opened from project context (but not client context)
    const [isClientContextFixed, setIsClientContextFixed] = useState(!!client); // Track if opened from client context
    const [projectManuallyChanged, setProjectManuallyChanged] = useState(false); // Track manual project changes
    const [handledEditingInvoice, setHandledEditingInvoice] = useState(null); // Track handled editing invoice ID
    const { showSuccess, showError, showWarning } = useToast();
    const didAutoOpenModalRef = useRef(false); // Added a ref to track auto-open state
    const taskInputRef = useRef(null); // Ref for task description input field
    const [isHiddenForNestedModal, setIsHiddenForNestedModal] = useState(false);
    const [invoiceFormState, setInvoiceFormState] = useState(null);

    useEffect(() => {
        if (!showInvoiceForm) {
            setShowPreview(false);
            setPreviewInvoice(null);
        }
    }, [showInvoiceForm]);

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

    const availableExpenses = useMemo(() => {
        const invoiceId = editingInvoice?.id || null;

        if (!selectedClient && !selectedProject) {
            return [];
        }

        return expenses
            .filter((expense) => {
                if (!expense || !expense.billable) return false;

                if (selectedProject?.id) {
                    if (expense.projectId !== selectedProject.id) return false;
                } else if (selectedClient?.id) {
                    if (expense.clientId !== selectedClient.id) return false;
                } else {
                    return false;
                }

                const expenseCurrency = expense.currency || invoiceCurrency;
                if (expenseCurrency !== invoiceCurrency) return false;

                if (expense.billingStatus === 'unbilled') return true;
                if (invoiceId && expense.invoiceId === invoiceId) return true;
                return false;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, selectedClient, selectedProject, editingInvoice, invoiceCurrency]);

    const incompatibleExpensesCount = useMemo(() => {
        if (!selectedClient && !selectedProject) {
            return 0;
        }

        return expenses.filter((expense) => {
            if (!expense || !expense.billable) return false;

            if (selectedProject?.id) {
                if (expense.projectId !== selectedProject.id) return false;
            } else if (selectedClient?.id) {
                if (expense.clientId !== selectedClient.id) return false;
            } else {
                return false;
            }

            const expenseCurrency = expense.currency || invoiceCurrency;
            return expenseCurrency !== invoiceCurrency;
        }).length;
    }, [expenses, selectedClient, selectedProject, invoiceCurrency]);

    // Auto-open the form when showButton is false (modal mode)
    useEffect(() => {
        if (!showButton) { // Modal mode (auto-open is possible)
            // Don't auto-open if:
            // 1. We've already auto-opened
            // 2. We're in client context
            // 3. We're editing an invoice
            // 4. We're handling an editing invoice (crucial addition)
            if (!didAutoOpenModalRef.current && !client && !editingInvoice && !handledEditingInvoice) {
                setShowInvoiceForm(true);
                didAutoOpenModalRef.current = true;
            }
        } else { // Button mode (auto-open is not applicable)
            // Reset the flag if we are no longer in modal mode,
            // so it can auto-open next time if props change to modal mode.
            didAutoOpenModalRef.current = false;
        }
    }, [showButton, client, editingInvoice, handledEditingInvoice]); // Added handledEditingInvoice dependency

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
            const invoiceBusinessInfoId = editingInvoice.businessInfoId || editingInvoice.businessInfo?.id;
            if (invoiceBusinessInfoId) {
                const latestBusinessInfo = businessInfos.find(bi => bi.id === invoiceBusinessInfoId);
                if (latestBusinessInfo) {
                    setSelectedBusinessInfo(latestBusinessInfo);
                    return;
                }
            }

            if (editingInvoice.businessInfo) {
                setSelectedBusinessInfo(editingInvoice.businessInfo);
                return;
            }
        }
        
        // PRIORITY 1: Look for last used business info for this client across all invoices
        if (!projectManuallyChanged && selectedClient && invoices.length > 0) {
            const clientInvoices = invoices
                .filter(invoice => invoice.clientId === selectedClient.id)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation date, newest first
            
            for (const invoice of clientInvoices) {
                if (invoice.businessInfo) {
                    setSelectedBusinessInfo(invoice.businessInfo);
                    return;
                }
            }
        }
        
        // PRIORITY 2: Fall back to project-specific invoice history (only if no client-based history found)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice.businessInfo) {
                    setSelectedBusinessInfo(invoice.businessInfo);
                    return;
                }
            }
        }
        
        // PRIORITY 3: Use default business info if no history found
        const defaultBusinessInfo = businessInfos.find(bi => bi.isDefault);
        if (defaultBusinessInfo) {
            setSelectedBusinessInfo(defaultBusinessInfo);
            return;
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, projectInvoices, businessInfos, selectedBusinessInfo, projectManuallyChanged, selectedClient, invoices]);

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
                return;
            }
        }
        
        // Only use the current project if it's actually provided (not null)
        // This prevents overriding user selections when opening from invoices view
        if (project) {
            setSelectedProject(project);
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
            const invoiceTemplateId = editingInvoice.templateId || editingInvoice.template?.id;
            if (invoiceTemplateId) {
                const latestTemplate = invoiceTemplates.find(t => t.id === invoiceTemplateId);
                if (latestTemplate) {
                    setSelectedTemplate(latestTemplate);
                    return;
                }
            }

            if (editingInvoice.template) {
                setSelectedTemplate(editingInvoice.template);
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
                    if (invoice.template) {
                        setSelectedTemplate(invoice.template);
                        return;
                    }
                }
            }
            
            // PRIORITY 2: Fall back to project-specific template history (only if no client-based history found)
            if (selectedProject?.id) {
                const lastInvoice = getLatestInvoiceForProject(invoices, selectedProject.id);

                if (lastInvoice?.template) {
                    setSelectedTemplate(lastInvoice.template);
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

    const invoiceFormStateKey = useMemo(() => {
        if (editingInvoice?.id) {
            return `invoice:${editingInvoice.id}`;
        }
        if (project?.id) {
            return `project:${project.id}`;
        }
        if (client?.id) {
            return `client:${client.id}`;
        }
        return 'standalone';
    }, [editingInvoice?.id, project?.id, client?.id]);

    const saveInvoiceFormState = useCallback((formData) => {
        setInvoiceFormState({
            ...formData,
            contextKey: invoiceFormStateKey
        });
    }, [invoiceFormStateKey]);

    const getInvoiceFormState = useCallback(() => {
        if (!invoiceFormState || invoiceFormState.contextKey !== invoiceFormStateKey) {
            return null;
        }
        return invoiceFormState;
    }, [invoiceFormState, invoiceFormStateKey]);

    const clearInvoiceFormState = useCallback(() => {
        setInvoiceFormState(null);
    }, []);

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
            setInvoiceNote('');
            setInvoiceDateOverride('');
            setUseInvoiceDateOverride(false);
            setMergedSubtasks({});
        }
    }, [editingInvoice]);

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback((projectForData = null) => {
        return buildInvoiceTaskData({
            projectForData,
            selectedProject,
            tasks,
            timeEntries,
            editableHours
        });
    }, [selectedProject, timeEntries, tasks, editableHours]);

    // Handler assignments (replace function definitions)
    const handleTaskSelectionForBilling = InvoiceHandler.handleTaskSelectionForBilling(setSelectedTasksForBilling);
    const handleHoursChange = InvoiceHandler.handleHoursChange(setEditableHours);
    const handleFlatRateChange = InvoiceHandler.handleFlatRateChange(setTaskFlatRates);
    const handleQuantityChange = InvoiceHandler.handleQuantityChange(setTaskQuantities);
    const handleTaskHourlyRateChange = InvoiceHandler.handleTaskHourlyRateChange(setTaskHourlyRates);
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
    const handleAdditionalTaskHoursChange = InvoiceHandler.handleAdditionalTaskHoursChange(setAdditionalTasks);
    const handleAdditionalTaskFlatRateChange = InvoiceHandler.handleAdditionalTaskFlatRateChange(setAdditionalTasks);
    const handleAdditionalTaskQuantityChange = InvoiceHandler.handleAdditionalTaskQuantityChange(setAdditionalTasks);
    const handleAdditionalTaskHourlyRateChange = InvoiceHandler.handleAdditionalTaskHourlyRateChange(setAdditionalTasks);
    const handleToggleAdditionalTaskFlatRate = InvoiceHandler.handleToggleAdditionalTaskFlatRate(setAdditionalTasks, setUseFlatRate);
    const handleClientSelection = InvoiceHandler.handleClientSelection(setSelectedClient, clients);
    const handleResetInvoiceForm = InvoiceHandler.handleResetInvoiceForm(
        setInvoiceTasks,
        setEditableHours,
        setTaskFlatRates,
        setUseFlatRate,
        setTaskHourlyRates,
        setTaskQuantities,
        setAdditionalTasks,
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
        setUseInvoiceDateOverride
    );
    const handleProjectSelection = InvoiceHandler.handleProjectSelection(
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
    const handleCancel = InvoiceHandler.handleCancel(
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

    /**
     * Calculate pricing breakdown: Subtotal → Discount → Shipping → Tax → Total
     * Supports both hourly rate (from project) and flat rate (per task) pricing
     */
    const calculatePricing = useInvoicePricing({
        invoiceTasks,
        additionalTasks,
        expenseItems: availableExpenses,
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

        updateInvoiceTemplate(template.id, { currentSequentialNumber: template.currentSequentialNumber + 1 });
    }, [updateInvoiceTemplate]);

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
        const hasSelectedItems = selectedTasksCount > 0 || additionalTasks.length > 0 || selectedExpensesCount > 0;
        
        if (!hasSelectedItems) {
            showError('Please select at least one task or expense to bill, or add an additional task');
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
        const totalHours = pricing.totalHours;

        // Generate invoice ID - use selected project or a generic format for standalone invoices
        const invoiceId = editingInvoice 
            ? editingInvoice.id 
            : selectedProject 
                ? `INV-${selectedProject.id.slice(-8)}-${Date.now()}` 
                : `INV-${selectedClient?.id?.slice(-8) || 'STANDALONE'}-${Date.now()}`;

        // Generate invoice number using template
        const invoiceNumber = editingInvoice 
            ? editingInvoice.invoiceNumber 
            : generateInvoiceNumber(selectedTemplate, selectedProject);

        // Calculate due date using template - use override date if available (for both new and editing)
        // Priority: 1. Date override (if enabled), 2. Original date (if editing), 3. Today's date (for new)
        const invoiceDate = useInvoiceDateOverride && invoiceDateOverride
            ? new Date(invoiceDateOverride)
            : editingInvoice 
                ? new Date(editingInvoice.date) 
                : new Date();
        const dueDate = calculateDueDate(selectedTemplate, invoiceDate);

        // Update template sequential number if creating new invoice
        if (applyTemplateSequentialUpdate && !editingInvoice) {
            updateTemplateSequentialNumber(selectedTemplate);
        }

        const resolvedPaymentMethod = selectedPaymentMethod || (() => {
            if (!editingInvoice) return null;
            const paymentMethodId = editingInvoice.paymentMethodId || editingInvoice.paymentMethod?.id;
            if (!paymentMethodId) return editingInvoice.paymentMethod || null;
            return paymentMethods.find(pm => pm.id === paymentMethodId) || editingInvoice.paymentMethod || null;
        })();

        const resolvedBusinessInfo = selectedBusinessInfo || (() => {
            if (!editingInvoice) return null;
            const businessInfoId = editingInvoice.businessInfoId || editingInvoice.businessInfo?.id;
            if (!businessInfoId) return editingInvoice.businessInfo || null;
            return businessInfos.find(bi => bi.id === businessInfoId) || editingInvoice.businessInfo || null;
        })();

        const resolvedTemplate = selectedTemplate || (() => {
            if (!editingInvoice) return null;
            const templateId = editingInvoice.templateId || editingInvoice.template?.id;
            if (!templateId) return editingInvoice.template || null;
            return invoiceTemplates.find(t => t.id === templateId) || editingInvoice.template || null;
        })();

        const selectedExpenseItems = availableExpenses
            .filter((expense) => selectedExpensesForBilling[expense.id])
            .map((expense) => ({
                id: expense.id,
                title: expense.title,
                amount: expense.amount || 0,
                date: expense.date,
                supplierName: expense.supplierName || null,
                currency: expense.currency || invoiceCurrency
            }));

        const expenseInvoiceItems = selectedExpenseItems.map((expense) => ({
            description: expense.title,
            quantity: 1,
            rate: expense.amount,
            amount: expense.amount,
            expenseId: expense.id
        }));

        return {
            id: invoiceId,
            project: selectedProject,
            projectId: selectedProject?.id || null,
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
            tasks: invoiceTasks
                .filter(task => task && task.id && selectedTasksForBilling[task.id]) // Only include selected tasks
                .map(task => ({
                    ...task,
                    hours: editableHours[task?.id] || task?.originalHours || 0,
                    flatRate: taskFlatRates[task.id] || 0,
                    hourlyRate: taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0,
                    useFlatRate: useFlatRate[task.id] || false,
                    quantity: taskQuantities[task.id] || 1, // Include quantity for flat rate tasks
                    isMerged: (task && task.id && mergedSubtasks[task.id]) || false, // Track merged status
                    mergedSubtasks: (task && task.id && mergedSubtasks[task.id]) ? 
                        invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id) : []
                })),
            additionalTasks: additionalTasks.map(task => ({
                ...task,
                hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0
            })),
            expenseItems: selectedExpenseItems,
            items: expenseInvoiceItems,
            taskFlatRates: taskFlatRates,
            useFlatRate: useFlatRate,
            taskHourlyRates: taskHourlyRates,
            taskQuantities: taskQuantities, // Save task quantities state
            mergedSubtasks: mergedSubtasks, // Save merged subtasks state
            note: invoiceNote,
            totalHours: totalHours,
            totalAmount: pricing.total,
            subtotal: pricing.subtotal,
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
            clientId: selectedClient?.id || null,
            currency: selectedClient?.defaultCurrency || getPreferredCurrency(),
            template: resolvedTemplate ? { ...resolvedTemplate } : null,
            templateId: resolvedTemplate?.id || null,
            invoiceNumber: invoiceNumber,
            // Store dates in ISO format (YYYY-MM-DD) for portability
            date: useInvoiceDateOverride && invoiceDateOverride 
                ? toStorageDate(new Date(invoiceDateOverride))
                : (editingInvoice ? editingInvoice.date : toStorageDate(new Date())),
            dateOverride: useInvoiceDateOverride && invoiceDateOverride 
                ? toStorageDate(new Date(invoiceDateOverride))
                : null,
            dueDate: dueDate,
            createdAt: editingInvoice ? editingInvoice.createdAt : Date.now(),
            paymentProcessed: editingInvoice ? editingInvoice.paymentProcessed || false : false,
            htmlContent: createInvoiceHTML({
                id: editingInvoice ? editingInvoice.id : `INV-${selectedProject?.id?.slice(-8) || Date.now()}-${Date.now()}`,
                project: selectedProject,
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
                tasks: invoiceTasks
                    .filter(task => task && selectedTasksForBilling[task?.id]) // Only include selected tasks
                    .map(task => ({
                        ...task,
                        hours: editableHours[task.id] || task.originalHours,
                        flatRate: taskFlatRates[task.id] || 0,
                        hourlyRate: taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0,
                        useFlatRate: useFlatRate[task.id] || false,
                        quantity: taskQuantities[task.id] || 1, // Include quantity for flat rate tasks
                        isMerged: mergedSubtasks[task.id] || false, // Track merged status
                        mergedSubtasks: mergedSubtasks[task?.id] ? 
                            invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task?.id).map(subtask => ({
                                ...subtask,
                                hours: editableHours[subtask.id] || subtask.originalHours,
                                flatRate: taskFlatRates[subtask.id] || 0,
                                hourlyRate: taskHourlyRates[subtask.id] || subtask.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0,
                                useFlatRate: useFlatRate[subtask.id] || false
                            })) : []
                    })),
                additionalTasks: additionalTasks.filter(task => task).map(task => ({
                    ...task,
                    hourlyRate: task?.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0
                })),
                expenseItems: selectedExpenseItems,
                taskFlatRates: taskFlatRates,
                useFlatRate: useFlatRate,
                taskQuantities: taskQuantities, // Include quantities in PDF data
                mergedSubtasks: mergedSubtasks, // Include merged subtasks in PDF data
                note: invoiceNote,
                totalHours: totalHours,
                totalAmount: pricing.total,
                subtotal: pricing.subtotal,
                discount: pricing.discount,
                shipping: pricing.shipping,
                tax: pricing.tax,
                taxRate: pricing.taxRate,
                taxLabel: pricing.taxLabel,
                paymentMethod: resolvedPaymentMethod,
                paymentMethodId: resolvedPaymentMethod?.id || null,
                businessInfo: resolvedBusinessInfo,
                businessInfoId: resolvedBusinessInfo?.id || null,
                template: resolvedTemplate,
                templateId: resolvedTemplate?.id || null,
                invoiceNumber: invoiceNumber,
                // Display dates in locale format for PDF
                date: useInvoiceDateOverride && invoiceDateOverride 
                    ? toDisplayDate(new Date(invoiceDateOverride))
                    : (editingInvoice ? toDisplayDate(editingInvoice.date) : toDisplayDate(new Date())),
                dueDate: dueDate ? toDisplayDate(dueDate) : null,
                currency: selectedClient?.defaultCurrency || getPreferredCurrency()
            })
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

        // Store invoice in the invoices collection
        if (editingInvoice) {
            // Update existing invoice - preserving original createdAt
            updateInvoice(editingInvoice.id, { ...invoiceData, createdAt: editingInvoice.createdAt });
        } else {
            // Add new invoice - createInvoice auto-generates id and timestamps
            createInvoice(invoiceData);
        }

        const adjustmentTimestamp = Date.now();
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

        // Update tasks to set lastBilledAt for billed tasks and projects
        if (selectedProject && !editingInvoice) {
            const currentTime = adjustmentTimestamp;
            
            // Get all task IDs that should be marked as billed (including merged subtasks)
            // Make sure we only include tasks from the current project
            const billedTaskIds = [];
            const projectTasks = tasks.filter(task => task.projectId === selectedProject.id);
            const projectTaskIds = new Set(projectTasks.map(task => task.id));
            
            invoiceTasks.forEach(task => {
                // Verify this task actually belongs to the current project before adding it
                if (selectedTasksForBilling[task.id] && projectTaskIds.has(task.id)) {
                    billedTaskIds.push(task.id);
                    
                    // If this parent task has merged subtasks, include them too
                    if (mergedSubtasks[task.id]) {
                        const subtasks = invoiceTasks.filter(subtask => 
                            subtask.parentTaskId === task.id && projectTaskIds.has(subtask.id)
                        );
                        subtasks.forEach(subtask => {
                            billedTaskIds.push(subtask.id);
                        });
                    }
                }
            });

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

            if (Array.isArray(timeEntries) && timeEntries.length > 0) {
                timeEntries.forEach(entry => {
                    if (!billedRateByTaskId.has(entry.taskId)) return;
                    if (entry.source === 'invoice-adjustment') return;

                    const cutoff = previousBillingCutoffs.get(entry.taskId) || 0;
                    if (entry.start <= cutoff) return;
                    if (!entry.end || entry.end <= entry.start) return;
                    if (entry.start > currentTime) return;

                    updateEntry(entry.id, {
                        billedHourlyRate: billedRateByTaskId.get(entry.taskId),
                        billedAt: currentTime,
                        billedInvoiceId: invoiceId
                    });
                });
            }
            
            // Update lastBilledAt for all tasks that were included in this invoice
            billedTaskIds.forEach(taskId => {
                const task = tasks.find(t => t.id === taskId);
                if (task && task.projectId === selectedProject.id) {
                    updateTask(taskId, { lastBilledAt: currentTime });
                }
            });
            
        }

        // Reset form
        setShowInvoiceForm(false);
        
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
        const invoiceData = buildInvoiceData({ applyTemplateSequentialUpdate: false });
        if (!invoiceData) {
            return;
        }

        setPreviewInvoice(invoiceData);
        setShowPreview(true);
    };

    /**
     * Open invoice form with prepared data or for editing
     */
    const openInvoiceForm = useCallback(() => {
        // Don't open again if it's already open to avoid re-rendering issues
        if (showInvoiceForm) return;
        
        // Check if a timer is currently active (running, not paused)
        if (isTimerActive && !isTimerPaused) {
            showError('Cannot generate an invoice while a timer is active. Please pause the timer first.');
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
            const editingProjectId = editingInvoice.projectId || selectedProject?.id || null;
            const editingClientId = editingInvoice.clientId || selectedClient?.id || null;
            const editingCurrency = editingInvoice.currency || invoiceCurrency;

            expenses
                .filter((expense) => {
                    if (!expense || !expense.billable) return false;
                    if (editingProjectId) {
                        if (expense.projectId !== editingProjectId) return false;
                    } else if (editingClientId) {
                        if (expense.clientId !== editingClientId) return false;
                    } else {
                        return false;
                    }

                    const expenseCurrency = expense.currency || editingCurrency;
                    if (expenseCurrency !== editingCurrency) return false;

                    if (expense.billingStatus === 'unbilled') return true;
                    return expense.invoiceId === editingInvoice.id;
                })
                .forEach((expense) => {
                    initialExpenseSelection[expense.id] = expense.invoiceId === editingInvoice.id;
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
            // Open form with new invoice data
            const tasksData = prepareInvoiceData();
            
            // Even if there are no billable tasks, we still open the form
            // This allows users to manually add tasks with the "Add Task" feature
            if (tasksData) {
                setInvoiceTasks(tasksData);
                // Initialize editable hours with original hours
                const initialHours = {};
                const initialTaskSelection = {};
                const initialFlatRateToggles = {};
                const initialTaskQuantities = {};
                
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                    initialTaskSelection[task.id] = true; // Select all tasks by default
                    
                    // For flat rate projects, pre-toggle all tasks to flat rate
                    if (selectedProject && selectedProject.flatRate) {
                        initialFlatRateToggles[task.id] = true;
                        initialTaskQuantities[task.id] = 1;
                    }
                });
                
                setEditableHours(initialHours);
                setSelectedTasksForBilling(initialTaskSelection);

                const initialExpenseSelection = {};
                availableExpenses.forEach((expense) => {
                    initialExpenseSelection[expense.id] = true;
                });
                setSelectedExpensesForBilling(initialExpenseSelection);
                
                // Apply flat rate toggles for flat rate projects
                if (selectedProject && selectedProject.flatRate) {
                    setUseFlatRate(initialFlatRateToggles);
                    setTaskQuantities(initialTaskQuantities);
                    
                    // Also set the new task flat rate toggle to match project setting
                    setNewTaskUseFlatRate(selectedProject.flatRate);
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
        setShowInvoiceForm(true);
    }, [editingInvoice, prepareInvoiceData, showInvoiceForm, projects, setIsProjectContextFixed, selectedProject, selectedClient, isTimerActive, isTimerPaused, showError, client, availableExpenses, expenses, invoiceCurrency]);

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

    // Calculate unbilled time - initially using the current project (will update when a project is selected)
    // Don't calculate unbilled time in client context or when editing an invoice
    const currentProjectForCalculation = (!client && !editingInvoice) ? (selectedProject || project) : null;
    let unbilledHours = 0;
    let unbilledAmount = 0;

    // Only calculate unbilled time if we have a project context and not in client dashboard
    if (currentProjectForCalculation) {
        // Get all tasks for this project
        const projectTasks = tasks.filter(task => task.projectId === currentProjectForCalculation.id);
        
        // Get explicitly billable tasks (tasks with billable === true)
        const billableTasks = projectTasks.filter(task => task.billable === true);
        const billableTaskIds = billableTasks.map(task => task.id);
        
        // Filter unbilled entries based on individual task billing dates AND billable status
        const unbilledEntries = timeEntries.filter(entry => {
            // Only include entries for tasks that are explicitly marked as billable
            if (!billableTaskIds.includes(entry.taskId)) return false;
            if (entry.source === 'invoice-adjustment') return false;
            
            // Find the task for this entry
            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;
            
            // Use task-specific lastBilledAt - if never billed, all entries are pending
            const taskLastBilledAt = task.lastBilledAt || 0;
            
            // Only include entries created after this task's last billing date
            return entry.start > taskLastBilledAt;
        });

        // Group unbilled entries by task and round each task's hours (same logic as invoice)
        const taskTimeMap = {};
        unbilledEntries.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        // Calculate total rounded hours (matching invoice calculation)
        unbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
            const taskHours = millisecondsToHours(taskTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);

        unbilledAmount = unbilledHours * currentProjectForCalculation.hourlyRate;
    }

    // Invoice Modal
    return (
        <div className="space-y-4">
            {showButton && (
                <InvoiceGeneratorButton
                    onClick={openInvoiceForm}
                    currentProject={currentProjectForCalculation}
                    unbilledHours={unbilledHours}
                    unbilledAmount={unbilledAmount}
                    clients={clients}
                />
            )}
            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <InvoiceModal
                    showInvoiceForm={showInvoiceForm}
                    editingInvoice={editingInvoice}
                    handleCancel={handleCancel}
                    handleSaveInvoice={handleSaveInvoice}
                    handlePreviewInvoice={handlePreviewInvoice}
                    isProjectContextFixed={isProjectContextFixed}
                    isClientContextFixed={isClientContextFixed}
                    projects={projects}
                    selectedProject={selectedProject}
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
                    availableExpenses={availableExpenses}
                    selectedExpensesForBilling={selectedExpensesForBilling}
                    setSelectedExpensesForBilling={setSelectedExpensesForBilling}
                    incompatibleExpensesCount={incompatibleExpensesCount}
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
                    // Modal stacking functions
                    openClientModal={handleOpenClientModal}
                    openProjectModal={handleOpenProjectModal}
                    openBusinessModal={handleOpenBusinessModal}
                    openPaymentMethodModal={handleOpenPaymentMethodModal}
                    openTemplateModal={handleOpenTemplateModal}
                    saveFormState={saveInvoiceFormState}
                    getSavedState={getInvoiceFormState}
                    clearSavedState={clearInvoiceFormState}
                />
            )}
            <InvoicePreviewModal
                isOpen={showPreview && !!previewInvoice}
                onClose={() => setShowPreview(false)}
                title={previewInvoice ? `Invoice Preview - ${previewInvoice.invoiceNumber}` : ''}
                invoice={previewInvoice}
                htmlContent={previewInvoice?.htmlContent}
            />
        </div>
    );
};

export default React.memo(InvoiceGenerator);
