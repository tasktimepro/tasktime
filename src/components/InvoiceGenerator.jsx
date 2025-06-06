import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DocumentTextIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { createInvoiceHTML } from '../utils/pdfUtils';
import { millisecondsToHours } from '../utils/dateUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { useToast } from '../hooks/useToast';
import InvoiceModal from './invoice/InvoiceModal';
import * as InvoiceHandler from './invoice/InvoiceHandler';

/**
 * InvoiceGenerator component - Handles invoice generation and client info collection
 */
const InvoiceGenerator = ({ 
    project, 
    projects, 
    setProjects, 
    tasks,
    setTasks,
    timeEntries,
    currentTimer,
    editingInvoice,
    onInvoiceSaved,
    paymentMethods = [],
    onNavigateToPaymentMethods,
    businessInfos = [],
    onNavigateToBusinessInfo,
    clientInfos = [],
    onNavigateToClientInfo,
    onNavigateToProjects,
    invoices = [],
    setInvoices,
    showButton = true
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBusinessInfo, setSelectedBusinessInfo] = useState(null);
    const [selectedClientInfo, setSelectedClientInfo] = useState(null);
    const [selectedProject, setSelectedProject] = useState(project); // Initialize with current project
    const [isProjectContextFixed, setIsProjectContextFixed] = useState(!!project); // Track if opened from project context
    const [projectManuallyChanged, setProjectManuallyChanged] = useState(false); // Track manual project changes
    const { showSuccess, showError, showWarning } = useToast();
    const didAutoOpenModalRef = useRef(false); // Added a ref to track auto-open state
    const taskInputRef = useRef(null); // Ref for task description input field

    // Get project invoices from the new structure - memoized to prevent unnecessary re-renders
    const projectInvoices = useMemo(() => {
        // Use the selected project if available, otherwise fall back to the initially passed project
        const currentProject = selectedProject || project;
        if (!currentProject) {
            return []; // Return empty array if no project is available
        }
        return invoices.filter(invoice => 
            (currentProject.invoiceIds || []).includes(invoice.id)
        );
    }, [invoices, selectedProject, project]);

    // Auto-open the form when showButton is false (modal mode)
    useEffect(() => {
        if (!showButton) { // Modal mode (auto-open is possible)
            // Only auto-open once when first rendered
            if (!didAutoOpenModalRef.current) {
                setShowInvoiceForm(true);
                didAutoOpenModalRef.current = true;
            }
        } else { // Button mode (auto-open is not applicable)
            // Reset the flag if we are no longer in modal mode,
            // so it can auto-open next time if props change to modal mode.
            didAutoOpenModalRef.current = false;
        }
    }, [showButton]); // Only depend on showButton to prevent re-opening after closing

    /**
     * Initialize payment method based on previous invoices or editing invoice
     */
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

        // If editing an invoice, use its payment method
        if (editingInvoice && editingInvoice.paymentMethodId) {
            const paymentMethod = paymentMethods.find(pm => pm.id === editingInvoice.paymentMethodId);
            if (paymentMethod) {
                setSelectedPaymentMethod(paymentMethod);
                return;
            }
        }
        
        // Look for last used payment method in previous invoices (only if project not manually changed)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice.paymentMethodId) {
                    const paymentMethod = paymentMethods.find(pm => pm.id === invoice.paymentMethodId);
                    if (paymentMethod) {
                        setSelectedPaymentMethod(paymentMethod);
                        return;
                    }
                }
            }
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, projectInvoices, paymentMethods, selectedPaymentMethod, projectManuallyChanged]);

    /**
     * Initialize business info based on previous invoices or editing invoice
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

        // If editing an invoice, use its business info
        if (editingInvoice && editingInvoice.businessInfoId) {
            const businessInfo = businessInfos.find(bi => bi.id === editingInvoice.businessInfoId);
            if (businessInfo) {
                setSelectedBusinessInfo(businessInfo);
                return;
            }
        }
        
        // Look for last used business info in previous invoices (only if project not manually changed)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice.businessInfoId) {
                    const businessInfo = businessInfos.find(bi => bi.id === invoice.businessInfoId);
                    if (businessInfo) {
                        setSelectedBusinessInfo(businessInfo);
                        return;
                    }
                }
            }
        }
        
        // No need to reset to null as that's the initial state
    }, [editingInvoice, projectInvoices, businessInfos, selectedBusinessInfo, projectManuallyChanged]);

    /**
     * Initialize selected client info based on previous invoices or editing invoice
     */
    const initializeSelectedClientInfo = useCallback(() => {
        // If no client infos available, ensure selection is null
        if (clientInfos.length === 0) {
            if (selectedClientInfo !== null) {
                setSelectedClientInfo(null);
            }
            return;
        }

        // Don't override if project was manually changed (user may have gotten auto-populated values)
        if (projectManuallyChanged && selectedClientInfo !== null) {
            return;
        }

        // If user has already made a selection and it still exists in clientInfos, keep it
        if (selectedClientInfo !== null && !editingInvoice) {
            const stillExists = clientInfos.some(ci => ci.id === selectedClientInfo.id);
            if (stillExists) {
                return; // Preserve user selection
            }
            // If their selection no longer exists, continue with initialization
        }

        // If editing an invoice, use its client info ID
        if (editingInvoice && editingInvoice.clientInfoId) {
            const clientInfo = clientInfos.find(ci => ci.id === editingInvoice.clientInfoId);
            if (clientInfo) {
                setSelectedClientInfo(clientInfo);
                return;
            }
        }
        
        // Look for last used client info in previous invoices (only if project not manually changed)
        if (!projectManuallyChanged && projectInvoices.length > 0) {
            for (let i = projectInvoices.length - 1; i >= 0; i--) {
                const invoice = projectInvoices[i];
                if (invoice.clientInfoId) {
                    const clientInfo = clientInfos.find(ci => ci.id === invoice.clientInfoId);
                    if (clientInfo) {
                        setSelectedClientInfo(clientInfo);
                        return;
                    }
                }
            }
        }
        
        // Don't auto-select client info - user should manually select
    }, [editingInvoice, projectInvoices, clientInfos, selectedClientInfo, projectManuallyChanged]);

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
                initializeSelectedClientInfo();
                initializeSelectedProject();
                setHasInitialized(true);
                setCurrentEditingInvoiceId(editingInvoice?.id || null);
            }
        } else {
            // Reset the initialized flag when form is closed
            setHasInitialized(false);
            setCurrentEditingInvoiceId(null);
        }
    }, [
        showInvoiceForm, 
        editingInvoice?.id, // Only track the ID to prevent re-initialization
        initializePaymentMethod, 
        initializeBusinessInfo, 
        initializeSelectedClientInfo,
        initializeSelectedProject,
        paymentMethods.length,
        businessInfos.length,
        clientInfos.length,
        hasInitialized,
        currentEditingInvoiceId
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
    const [invoiceNoteCollapsed, setInvoiceNoteCollapsed] = useState(true);
    
    // Pricing & Totals state
    const [pricingCollapsed, setPricingCollapsed] = useState(true);
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'fixed'
    const [discountValue, setDiscountValue] = useState(0);
    const [shippingAmount, setShippingAmount] = useState(0);
    const [taxOverride, setTaxOverride] = useState({
        enabled: false,
        label: '',
        rate: 0
    });

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
            
            // Initialize merged subtasks state
            if (editingInvoice.mergedSubtasks) {
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
            setMergedSubtasks({});
        }
    }, [editingInvoice]);

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback((projectForData = null) => {
        // Use provided project or default to selected project
        const projectToUse = projectForData || selectedProject;
        if (!projectToUse) return null;
        
        // Get all tasks that belong to this project
        const projectTasks = tasks.filter(task => task.projectId === projectToUse.id);
        const projectTaskIds = projectTasks.map(task => task.id);
        
        // Filter billable entries based on individual task billing dates
        const billableEntries = timeEntries.filter(entry => {
            if (!projectTaskIds.includes(entry.taskId)) return false;
            if (!entry.end || entry.end <= entry.start) return false;
            
            // Find the task for this entry
            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            
            // Use task-specific lastBilledAt, or task creation date if never billed
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            
            // Only include entries created after this task's last billing date
            return entry.start > taskLastBilledAt;
        });
        
        // Get manually marked billable tasks (tasks with billable: true)
        const manuallyBillableTasks = projectTasks.filter(task => task.billable === true);
        
        // If no billable entries and no manually billable tasks, return null
        if (billableEntries.length === 0 && manuallyBillableTasks.length === 0) {
            return null;
        }

        // Group entries by task
        const taskTimeMap = {};

        billableEntries.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        // Add manually billable tasks to the map (even if they have no time)
        manuallyBillableTasks.forEach(task => {
            if (!taskTimeMap[task.id]) {
                taskTimeMap[task.id] = 0; // 0 time for manually marked tasks
            }
        });

        // Prepare tasks data array
        const tasksData = Object.entries(taskTimeMap).map(([taskId, totalTime]) => {
            const task = tasks.find(t => t.id === taskId);
            const hours = millisecondsToHours(totalTime);
            const roundedHours = Math.round(hours * 100) / 100;
            const editedHours = editableHours[taskId] !== undefined ? editableHours[taskId] : roundedHours;
            return {
                id: taskId,
                title: task ? task.title : 'Unknown Task',
                parentTaskId: task ? task.parentTaskId : null, // Include parent task ID for subtask relationship
                originalHours: roundedHours,
                originalTimeMs: totalTime, // Keep the original milliseconds for accurate time display
                hours: editedHours,
                isEdited: editedHours !== roundedHours
            };
        }).filter(task => {
            // Include tasks with time OR manually marked as billable
            const taskData = tasks.find(t => t.id === task.id);
            return task.originalHours > 0 || (taskData && taskData.billable === true);
        });

        return tasksData;
    }, [selectedProject, timeEntries, tasks, editableHours]);

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
        InvoiceHandler.handleFlatRateChange(setTaskFlatRates)
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
    const handleClientInfoSelection = InvoiceHandler.handleClientInfoSelection(setSelectedClientInfo, clientInfos);
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
        setNewTaskQuantity,
        setMergedSubtasks
    );
    const handleProjectSelection = InvoiceHandler.handleProjectSelection(
        setSelectedProject,
        setProjectManuallyChanged,
        handleResetInvoiceForm,
        setSelectedClientInfo,
        setSelectedBusinessInfo,
        setSelectedPaymentMethod,
        setInvoiceTasks,
        setEditableHours,
        setSelectedTasksForBilling,
        projects,
        invoices,
        clientInfos,
        businessInfos,
        paymentMethods,
        prepareInvoiceData
    );
    const handleCancel = InvoiceHandler.handleCancel(
        setShowInvoiceForm,
        handleResetInvoiceForm,
        setProjectManuallyChanged,
        onInvoiceSaved
    );

    /**
     * Calculate pricing breakdown: Subtotal → Discount → Shipping → Tax → Total
     * Supports both hourly rate (from project) and flat rate (per task) pricing
     */
    const calculatePricing = useMemo(() => {
        if (invoiceTasks.length === 0 && additionalTasks.length === 0) {
            return {
                subtotal: 0,
                discount: 0,
                shipping: 0,
                tax: 0,
                total: 0,
                totalHours: 0,
                taxRate: 0,
                taxLabel: 'VAT'
            };
        }

        // Calculate project subtotal by adding up task amounts
        let projectSubtotal = 0;
        let additionalTaskAmount = 0;
        let totalHours = 0;
        
        // Calculate regular project tasks subtotal (only include selected tasks)
        invoiceTasks.forEach(task => {
            // Only include selected tasks in pricing calculation
            if (!selectedTasksForBilling[task.id]) return;
            
            // Skip subtasks if their parent is merged (they're included in parent calculation)
            if (task.parentTaskId && mergedSubtasks[task.parentTaskId]) return;
            
            let taskHours = editableHours[task.id] || task.hours;
            
            // If this task has merged subtasks, include their hours too
            if (mergedSubtasks[task.id]) {
                const subtasks = invoiceTasks.filter(subtask => subtask.parentTaskId === task.id);
                const subtaskHours = subtasks.reduce((total, subtask) => {
                    const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                    return total + hours;
                }, 0);
                taskHours += subtaskHours;
            }
            
            // Always add task hours to total hours, even for flat rate tasks
            totalHours += taskHours;
            
            if (useFlatRate[task.id]) {
                // Use flat rate for this task with quantity
                const quantity = taskQuantities[task.id] || 1;
                projectSubtotal += (taskFlatRates[task.id] || 0) * quantity;
            } else {
                // Use task-specific hourly rate if available, otherwise fall back to project rate
                const hourlyRate = taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || 0;
                projectSubtotal += taskHours * hourlyRate;
            }
        });
        
        // Calculate additional tasks subtotal
        additionalTasks.forEach(task => {
            if (task.useFlatRate) {
                // Use flat rate with quantity
                const quantity = task.quantity || 1;
                additionalTaskAmount += (task.flatRate || 0) * quantity;
            } else {
                const hourlyRate = task.hourlyRate || selectedProject?.hourlyRate || 0;
                const taskHours = task.hours || 0;
                additionalTaskAmount += taskHours * hourlyRate;
                // Add hours to total for hourly tasks
                totalHours += taskHours;
            }
        });
        
        const subtotal = projectSubtotal + additionalTaskAmount;

        // Calculate discount
        const discountVal = discountValue === '' ? 0 : discountValue;
        const discount = discountType === 'percentage' 
            ? (subtotal * (discountVal / 100))
            : discountVal;

        // Subtotal after discount
        const afterDiscount = subtotal - discount;

        // Add shipping
        const shipping = shippingAmount === '' ? 0 : parseFloat(shippingAmount) || 0;
        const afterShipping = afterDiscount + shipping;

        // Calculate tax
        let taxRate = 0;
        let taxLabel = 'VAT';
        
        if (taxOverride.enabled) {
            taxRate = taxOverride.rate === '' ? 0 : parseFloat(taxOverride.rate) || 0;
            taxLabel = taxOverride.label || 'Tax';
        } else if (selectedProject && selectedProject.taxEnabled) {
            taxRate = selectedProject.taxRate || 0;
        }

        const tax = (afterShipping * (taxRate / 100));
        const total = afterShipping + tax;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            discount: Math.round(discount * 100) / 100,
            shipping: Math.round(shipping * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100,
            totalHours: Math.round(totalHours * 100) / 100,
            taxRate,
            taxLabel
        };
    }, [selectedProject, invoiceTasks, additionalTasks, editableHours, 
        discountType, discountValue, shippingAmount, taxOverride, 
        taskFlatRates, useFlatRate, taskHourlyRates, taskQuantities, selectedTasksForBilling, mergedSubtasks]);

    /**
     * Save invoice (create new or update existing)
     */
    const handleSaveInvoice = (e) => {
        e.preventDefault();

        // Validate required information
        if (!selectedClientInfo) {
            showError('Please select client information');
            return;
        }

        // Project selection is now required
        if (!selectedProject) {
            showError('Please select a project');
            return;
        }

        // Check if any tasks are selected for billing
        const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
        const hasSelectedTasks = selectedTasksCount > 0 || additionalTasks.length > 0;
        
        if (!hasSelectedTasks) {
            showError('Please select at least one task to bill or add additional tasks');
            return;
        }

        const pricing = calculatePricing;
        const totalHours = pricing.totalHours;

        // Generate invoice ID - use selected project or a generic format for standalone invoices
        const invoiceId = editingInvoice 
            ? editingInvoice.id 
            : selectedProject 
                ? `INV-${selectedProject.id.slice(-8)}-${Date.now()}` 
                : `INV-${Date.now()}`;

        const invoiceNumber = editingInvoice 
            ? editingInvoice.invoiceNumber 
            : selectedProject 
                ? `INV-${selectedProject.id.slice(-8)}-${Date.now()}` 
                : `INV-${Date.now()}`;

        const invoiceData = {
            id: invoiceId,
            project: selectedProject,
            projectId: selectedProject?.id || null,
            clientInfo: {
                name: selectedClientInfo.clientName || '',
                contactPerson: selectedClientInfo.contactPerson || '',
                email: selectedClientInfo.email || '',
                address: selectedClientInfo.address || '',
                city: selectedClientInfo.city || '',
                state: selectedClientInfo.state || '',
                zip: selectedClientInfo.zip || '',
                country: selectedClientInfo.country || ''
            },
            tasks: invoiceTasks
                .filter(task => selectedTasksForBilling[task.id]) // Only include selected tasks
                .map(task => ({
                    ...task,
                    hours: editableHours[task.id] || task.originalHours,
                    flatRate: taskFlatRates[task.id] || 0,
                    hourlyRate: taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || 0,
                    useFlatRate: useFlatRate[task.id] || false,
                    quantity: taskQuantities[task.id] || 1, // Include quantity for flat rate tasks
                    isMerged: mergedSubtasks[task.id] || false, // Track merged status
                    mergedSubtasks: mergedSubtasks[task.id] ? 
                        invoiceTasks.filter(subtask => subtask.parentTaskId === task.id) : []
                })),
            additionalTasks: additionalTasks.map(task => ({
                ...task,
                hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0
            })),
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
            paymentMethodId: selectedPaymentMethod?.id || null,
            businessInfoId: selectedBusinessInfo?.id || null,
            clientInfoId: selectedClientInfo?.id || null,
            invoiceNumber: invoiceNumber,
            date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
            createdAt: editingInvoice ? editingInvoice.createdAt : Date.now(),
            paymentProcessed: editingInvoice ? editingInvoice.paymentProcessed || false : false,
            htmlContent: createInvoiceHTML({
                id: editingInvoice ? editingInvoice.id : `INV-${selectedProject.id.slice(-8)}-${Date.now()}`,
                project: selectedProject,
                client: {
                    name: selectedClientInfo.clientName || '',
                    contactPerson: selectedClientInfo.contactPerson || '',
                    email: selectedClientInfo.email || '',
                    address: selectedClientInfo.address || '',
                    city: selectedClientInfo.city || '',
                    state: selectedClientInfo.state || '',
                    zip: selectedClientInfo.zip || '',
                    country: selectedClientInfo.country || ''
                },
                tasks: invoiceTasks
                    .filter(task => selectedTasksForBilling[task.id]) // Only include selected tasks
                    .map(task => ({
                        ...task,
                        hours: editableHours[task.id] || task.originalHours,
                        hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0,
                        quantity: taskQuantities[task.id] || 1, // Include quantity for flat rate tasks
                        isMerged: mergedSubtasks[task.id] || false, // Track merged status
                        mergedSubtasks: mergedSubtasks[task.id] ? 
                            invoiceTasks.filter(subtask => subtask.parentTaskId === task.id) : []
                    })),
                additionalTasks: additionalTasks.map(task => ({
                    ...task,
                    hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0
                })),
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
                paymentMethod: selectedPaymentMethod,
                businessInfo: selectedBusinessInfo,
                invoiceNumber: invoiceNumber,
                date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
                createdAt: editingInvoice ? editingInvoice.createdAt : Date.now()
            })
        };

        // Store invoice in the new separate invoices structure
        let updatedInvoices;
        let updatedProjectInvoiceIds = [];
        
        if (editingInvoice) {
            // Update existing invoice
            updatedInvoices = invoices.map(inv => 
                inv.id === editingInvoice.id ? invoiceData : inv
            );
            if (selectedProject) {
                updatedProjectInvoiceIds = selectedProject.invoiceIds || [];
            }
        } else {
            // Add new invoice
            updatedInvoices = [...invoices, invoiceData];
            if (selectedProject) {
                updatedProjectInvoiceIds = [...(selectedProject.invoiceIds || []), invoiceData.id];
            }
        }

        // Update invoices storage - check if setInvoices is a function
        if (typeof setInvoices === 'function') {
            setInvoices(updatedInvoices);
        }

        // Update tasks to set lastBilledAt for billed tasks and projects
        if (selectedProject && !editingInvoice) {
            const currentTime = Date.now();
            
            // Get all task IDs that should be marked as billed (including merged subtasks)
            const billedTaskIds = [];
            
            invoiceTasks.forEach(task => {
                if (selectedTasksForBilling[task.id]) {
                    billedTaskIds.push(task.id);
                    
                    // If this parent task has merged subtasks, include them too
                    if (mergedSubtasks[task.id]) {
                        const subtasks = invoiceTasks.filter(subtask => subtask.parentTaskId === task.id);
                        subtasks.forEach(subtask => {
                            billedTaskIds.push(subtask.id);
                        });
                    }
                }
            });
            
            // Update lastBilledAt for all tasks that were included in this invoice
            const updatedTasks = tasks.map(task => {
                if (billedTaskIds.includes(task.id)) {
                    return { ...task, lastBilledAt: currentTime };
                }
                return task;
            });
            setTasks(updatedTasks);
            
            // Update project to include invoice ID (but don't update project lastBilledAt)
            const updatedProjects = projects.map(p => 
                p.id === selectedProject.id 
                    ? { 
                        ...p, 
                        invoiceIds: updatedProjectInvoiceIds
                    }
                    : p
            );
            setProjects(updatedProjects);
        } else if (selectedProject) {
            // For edited invoices, just update the project invoice IDs
            const updatedProjects = projects.map(p => 
                p.id === selectedProject.id 
                    ? { 
                        ...p, 
                        invoiceIds: updatedProjectInvoiceIds
                    }
                    : p
            );
            setProjects(updatedProjects);
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
     * Open invoice form with prepared data or for editing
     */
    const openInvoiceForm = useCallback(() => {
        // Don't open again if it's already open to avoid re-rendering issues
        if (showInvoiceForm) return;
        
        // Check if a timer is currently active
        if (currentTimer) {
            showError('Cannot generate an invoice while a timer is active. Please stop the timer first.');
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
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                    initialTaskSelection[task.id] = true; // Select all tasks by default
                });
                setEditableHours(initialHours);
                setSelectedTasksForBilling(initialTaskSelection);
                
                // Reset flat rate data
                setTaskFlatRates({});
                setUseFlatRate({});
                setTaskHourlyRates({});
            } else {
                // No billable tasks, but still continue with empty tasks array
                setInvoiceTasks([]);
                setEditableHours({});
                setTaskFlatRates({});
                setUseFlatRate({});
                setTaskHourlyRates({});
                setSelectedTasksForBilling({});
            }
            
            // When opened from a project context, lock the project selection
            setIsProjectContextFixed(true);
        }
        setShowInvoiceForm(true);
    }, [editingInvoice, prepareInvoiceData, showInvoiceForm, projects, setIsProjectContextFixed, selectedProject?.hourlyRate, currentTimer, showError]);

    // Keep track of whether we've handled the current editing invoice
    const [handledEditingInvoice, setHandledEditingInvoice] = useState(null);
    
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
    const currentProjectForCalculation = selectedProject || project;
    let unbilledHours = 0;
    let unbilledAmount = 0;

    // Only calculate unbilled time if we have a project context
    if (currentProjectForCalculation) {
        // Get all tasks for this project
        const projectTasks = tasks.filter(task => task.projectId === currentProjectForCalculation.id);
        
        // Filter unbilled entries based on individual task billing dates
        const unbilledEntries = timeEntries.filter(entry => {
            // Find the task for this entry
            const task = projectTasks.find(t => t.id === entry.taskId);
            if (!task) return false;
            if (!entry.end || entry.end <= entry.start) return false;
            
            // Use task-specific lastBilledAt, or task creation date if never billed
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            
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
                <div className="flex items-center space-x-3">
                    <button
                        onClick={openInvoiceForm}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        <DocumentTextIcon className="h-5 w-5 mr-2" />
                        {currentProjectForCalculation ? 'Generate Invoice' : 'Create Invoice'}
                        {currentProjectForCalculation && unbilledHours > 0 && currentProjectForCalculation.hourlyRate && (
                            <span className="ml-2 px-2 py-1 bg-green-500 text-xs rounded-full">
                                {getCurrencySymbol(currentProjectForCalculation.currency)}{unbilledAmount.toFixed(2)}
                            </span>
                        )}
                        {currentProjectForCalculation && unbilledHours > 0 && !currentProjectForCalculation.hourlyRate && (
                            <span className="ml-2 px-2 py-1 bg-green-500 text-xs rounded-full flex items-center">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                {unbilledHours.toFixed(2)}h
                            </span>
                        )}
                    </button>
                </div>
            )}
            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <InvoiceModal
                    showInvoiceForm={showInvoiceForm}
                    editingInvoice={editingInvoice}
                    handleCancel={handleCancel}
                    handleSaveInvoice={handleSaveInvoice}
                    onNavigateToProjects={onNavigateToProjects}
                    isProjectContextFixed={isProjectContextFixed}
                    projects={projects}
                    selectedProject={selectedProject}
                    handleProjectSelection={handleProjectSelection}
                    clientInfos={clientInfos}
                    selectedClientInfo={selectedClientInfo}
                    handleClientInfoSelection={handleClientInfoSelection}
                    onNavigateToClientInfo={onNavigateToClientInfo}
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
                    handleToggleFlatRate={handleToggleFlatRate}
                    handleAdditionalTaskHoursChange={handleAdditionalTaskHoursChange}
                    handleAdditionalTaskFlatRateChange={handleAdditionalTaskFlatRateChange}
                    handleAdditionalTaskQuantityChange={handleAdditionalTaskQuantityChange}
                    handleAdditionalTaskHourlyRateChange={handleAdditionalTaskHourlyRateChange}
                    pricingCollapsed={pricingCollapsed}
                    setPricingCollapsed={setPricingCollapsed}
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
                    onNavigateToBusinessInfo={onNavigateToBusinessInfo}
                    paymentMethods={paymentMethods}
                    selectedPaymentMethod={selectedPaymentMethod}
                    onNavigateToPaymentMethods={onNavigateToPaymentMethods}
                    invoiceNote={invoiceNote}
                    setInvoiceNote={setInvoiceNote}
                    invoiceNoteCollapsed={invoiceNoteCollapsed}
                    setInvoiceNoteCollapsed={setInvoiceNoteCollapsed}
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
                    mergedSubtasks={mergedSubtasks}
                    handleToggleMergeSubtasks={handleToggleMergeSubtasks}
                    taskInputRef={taskInputRef}
                />
            )}
        </div>
    );
};

export default InvoiceGenerator;
