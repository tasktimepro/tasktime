import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { createInvoiceHTML } from '../utils/pdfUtils';
import { millisecondsToHours, formatDurationWithSeconds, hoursToMinutes } from '../utils/dateUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { useToast } from '../hooks/useToast';
import CustomCheckbox from './CustomCheckbox';

/**
 * InvoiceGenerator component - Handles invoice generation and client info collection
 */
const InvoiceGenerator = ({ 
    project, 
    projects, 
    setProjects, 
    tasks, 
    timeEntries,
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
    const { showSuccess, showError } = useToast();
    const didAutoOpenModalRef = useRef(false); // Added a ref to track auto-open state

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

    // Debug logging
    console.log('🔍 InvoiceGenerator - clientInfos:', clientInfos);
    console.log('🔍 InvoiceGenerator - clientInfos.length:', clientInfos.length);

    // Auto-open the form when showButton is false (modal mode)
    useEffect(() => {
        if (!showButton) { // Modal mode (auto-open is possible)
            if (!showInvoiceForm && !didAutoOpenModalRef.current) {
                setShowInvoiceForm(true);
                didAutoOpenModalRef.current = true;
            }
        } else { // Button mode (auto-open is not applicable)
            // Reset the flag if we are no longer in modal mode,
            // so it can auto-open next time if props change to modal mode.
            didAutoOpenModalRef.current = false;
        }
    }, [showButton, showInvoiceForm]); // Replaced the previous useEffect logic

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
        // If editing an invoice, use its project
        if (editingInvoice && editingInvoice.projectId) {
            const invoiceProject = projects.find(p => p.id === editingInvoice.projectId);
            if (invoiceProject) {
                setSelectedProject(invoiceProject);
                return;
            }
        }
        
        // Otherwise, use the current project
        setSelectedProject(project);
    }, [editingInvoice, project, projects]);

    // Track when the form gets shown so we can initialize only then
    const [hasInitialized, setHasInitialized] = useState(false);

    // Initialize all dropdowns together, but only when showInvoiceForm becomes true,
    // or when editing an invoice changes, or when available options change
    useEffect(() => {
        // Only initialize when the form is shown
        if (showInvoiceForm) {
            // We only want to initialize once when the form opens or editing invoice changes
            if (!hasInitialized || editingInvoice) {
                initializePaymentMethod();
                initializeBusinessInfo();
                initializeSelectedClientInfo();
                initializeSelectedProject();
                setHasInitialized(true);
            }
        } else {
            // Reset the initialized flag when form is closed
            setHasInitialized(false);
        }
    }, [
        showInvoiceForm, 
        editingInvoice, 
        initializePaymentMethod, 
        initializeBusinessInfo, 
        initializeSelectedClientInfo,
        initializeSelectedProject,
        paymentMethods.length,
        businessInfos.length,
        clientInfos.length,
        hasInitialized
    ]);

    const [invoiceTasks, setInvoiceTasks] = useState([]);
    const [editableHours, setEditableHours] = useState({});
    const [taskFlatRates, setTaskFlatRates] = useState({}); // For flat rate pricing per task
    const [useFlatRate, setUseFlatRate] = useState({}); // Track which tasks use flat rate vs hourly
    const [taskHourlyRates, setTaskHourlyRates] = useState({}); // For custom hourly rates per task
    
    // Additional tasks state (not related to project)
    const [additionalTasks, setAdditionalTasks] = useState([]);
    const [showAddTaskForm, setShowAddTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskHours, setNewTaskHours] = useState('');
    const [newTaskUseFlatRate, setNewTaskUseFlatRate] = useState(false); // Toggle for new tasks
    const [newTaskHourlyRate, setNewTaskHourlyRate] = useState(''); // Hourly rate for new tasks
    
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
        }
    }, [editingInvoice]);

    /**
     * Handle client info selection from dropdown
     */
    const handleClientInfoSelection = (clientInfoId) => {
        if (clientInfoId === "") {
            setSelectedClientInfo(null);
        } else {
            const clientInfo = clientInfos.find(ci => ci.id === clientInfoId);
            if (clientInfo) {
                setSelectedClientInfo(clientInfo);
            }
        }
    };

    /**
     * Complete form reset - clears all invoice form data
     */
    const resetInvoiceForm = () => {
        setInvoiceTasks([]);
        setEditableHours({});
        setTaskFlatRates({});
        setUseFlatRate({});
        setTaskHourlyRates({});
        setAdditionalTasks([]);
        setInvoiceNote('');
        setDiscountType('percentage');
        setDiscountValue(0);
        setShippingAmount(0);
        setTaxOverride({
            enabled: false,
            label: '',
            rate: 0
        });
        // Don't clear selections here as they will be handled by project selection logic
    };

    /**
     * Handle project selection from dropdown
     */
    const handleProjectSelection = (projectId) => {
        if (projectId === "") {
            setSelectedProject(null);
            // Perform complete form reset when no project is selected
            resetInvoiceForm();
            // Clear other selections when no project is selected
            setSelectedClientInfo(null);
            setSelectedBusinessInfo(null);
            setSelectedPaymentMethod(null);
        } else {
            const selectedProj = projects.find(p => p.id === projectId);
            if (selectedProj) {
                setSelectedProject(selectedProj);
                setProjectManuallyChanged(true); // Mark as manually changed
                
                // Perform complete form reset before applying project pre-selection
                resetInvoiceForm();
                
                // Clear current selections before applying new ones from last invoice
                setSelectedClientInfo(null);
                setSelectedBusinessInfo(null);
                setSelectedPaymentMethod(null);
                
                // Pre-populate Client, Business Info, and Payment Method based on last invoice for this project
                const projectInvoicesForSelection = invoices.filter(invoice => 
                    (selectedProj.invoiceIds || []).includes(invoice.id)
                );
                
                if (projectInvoicesForSelection.length > 0) {
                    // Get the most recent invoice (last in the array)
                    const lastInvoice = projectInvoicesForSelection[projectInvoicesForSelection.length - 1];
                    
                    // Pre-select Client Info if available
                    if (lastInvoice.clientInfoId) {
                        const clientInfo = clientInfos.find(ci => ci.id === lastInvoice.clientInfoId);
                        if (clientInfo) {
                            setSelectedClientInfo(clientInfo);
                        }
                    }
                    
                    // Pre-select Business Info if available
                    if (lastInvoice.businessInfoId) {
                        const businessInfo = businessInfos.find(bi => bi.id === lastInvoice.businessInfoId);
                        if (businessInfo) {
                            setSelectedBusinessInfo(businessInfo);
                        }
                    }
                    
                    // Pre-select Payment Method if available
                    if (lastInvoice.paymentMethodId) {
                        const paymentMethod = paymentMethods.find(pm => pm.id === lastInvoice.paymentMethodId);
                        if (paymentMethod) {
                            setSelectedPaymentMethod(paymentMethod);
                        }
                    }
                }
                
                // Load the specific project's tasks
                const tasksData = prepareInvoiceData(selectedProj);
                
                // Always clear the existing tasks before potentially adding new ones
                setInvoiceTasks([]);
                setEditableHours({});
                
                if (tasksData && tasksData.length > 0) {
                    setInvoiceTasks(tasksData);
                    // Initialize editable hours with original hours
                    const initialHours = {};
                    tasksData.forEach(task => {
                        initialHours[task.id] = task.originalHours;
                    });
                    setEditableHours(initialHours);
                }
                // If no tasks data, the form remains reset (empty)
            }
        }
    };

    /**
     * Handle hours modification for invoice tasks
     */
    const handleHoursChange = (taskId, newHours) => {
        if (newHours === '') {
            setEditableHours(prev => ({
                ...prev,
                [taskId]: ''
            }));
        } else {
            const parsedHours = parseFloat(newHours) || 0;
            const roundedHours = Math.round(parsedHours * 100) / 100; // Round to 2 decimal places
            setEditableHours(prev => ({
                ...prev,
                [taskId]: roundedHours
            }));
        }
    };

    /**
     * Handle flat rate modification for invoice tasks
     */
    const handleFlatRateChange = (taskId, newRate) => {
        if (newRate === '') {
            setTaskFlatRates(prev => ({
                ...prev,
                [taskId]: ''
            }));
        } else {
            const parsedRate = parseFloat(newRate) || 0;
            const roundedRate = Math.round(parsedRate * 100) / 100; // Round to 2 decimal places
            setTaskFlatRates(prev => ({
                ...prev,
                [taskId]: roundedRate
            }));
        }
    };

    /**
     * Handle hourly rate modification for invoice tasks
     */
    const handleTaskHourlyRateChange = (taskId, newRate) => {
        if (newRate === '') {
            setTaskHourlyRates(prev => ({
                ...prev,
                [taskId]: ''
            }));
        } else {
            const parsedRate = parseFloat(newRate) || 0;
            const roundedRate = Math.round(parsedRate * 100) / 100; // Round to 2 decimal places
            setTaskHourlyRates(prev => ({
                ...prev,
                [taskId]: roundedRate
            }));
        }
    };

    /**
     * Toggle task between flat rate and hourly pricing
     */
    const handleToggleFlatRate = (taskId, value) => {
        setUseFlatRate(prev => ({
            ...prev,
            [taskId]: value
        }));
        
        // Initialize flat rate if switching to flat rate
        if (value && !taskFlatRates[taskId]) {
            // Default flat rate based on hourly calculation
            const task = invoiceTasks.find(t => t.id === taskId);
            if (task) {
                const hourlyAmount = (editableHours[taskId] || task.hours) * (selectedProject?.hourlyRate || 0);
                handleFlatRateChange(taskId, hourlyAmount);
            }
        }
    };

    /**
     * Toggle new task between flat rate and hourly pricing
     */
    const handleToggleNewTaskFlatRate = () => {
        setNewTaskUseFlatRate(prev => !prev);
    };

    /**
     * Handle adding additional custom task
     */
    const handleAddAdditionalTask = () => {
        if (!newTaskTitle.trim()) return;
        
        const parsedValue = parseFloat(newTaskHours) || 0;
        const roundedValue = Math.round(parsedValue * 100) / 100;
        
        const newTask = {
            id: `custom-${Date.now()}`,
            title: newTaskTitle.trim(),
            hours: newTaskUseFlatRate ? 0 : roundedValue, // Use 0 hours if using flat rate
            flatRate: newTaskUseFlatRate ? roundedValue : 0, // Use user input as flat rate if flat rate is selected
            hourlyRate: newTaskUseFlatRate ? 0 : (parseFloat(newTaskHourlyRate) || selectedProject?.hourlyRate || 0),
            isCustom: true,
            useFlatRate: newTaskUseFlatRate
        };
        
        setAdditionalTasks(prev => [...prev, newTask]);
        
        // Also update the useFlatRate state for this new task
        if (newTaskUseFlatRate) {
            setUseFlatRate(prev => ({
                ...prev,
                [newTask.id]: true
            }));
        }
        
        setNewTaskTitle('');
        setNewTaskHours('');
        setNewTaskHourlyRate('');
        setNewTaskUseFlatRate(false);
        setShowAddTaskForm(false);
    };

    /**
     * Handle removing additional task
     */
    const handleRemoveAdditionalTask = (taskId) => {
        setAdditionalTasks(prev => prev.filter(task => task.id !== taskId));
    };

    /**
     * Handle editing additional task hours
     */
    const handleAdditionalTaskHoursChange = (taskId, newHours) => {
        if (newHours === '') {
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, hours: '' } : task
            ));
        } else {
            const parsedHours = parseFloat(newHours) || 0;
            const roundedHours = Math.round(parsedHours * 100) / 100;
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, hours: roundedHours } : task
            ));
        }
    };

    /**
     * Handle editing additional task flat rate
     */
    const handleAdditionalTaskFlatRateChange = (taskId, newRate) => {
        if (newRate === '') {
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, flatRate: '' } : task
            ));
        } else {
            const parsedRate = parseFloat(newRate) || 0;
            const roundedRate = Math.round(parsedRate * 100) / 100;
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, flatRate: roundedRate } : task
            ));
        }
    };

    /**
     * Handle editing additional task hourly rate
     */
    const handleAdditionalTaskHourlyRateChange = (taskId, newRate) => {
        if (newRate === '') {
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, hourlyRate: '' } : task
            ));
        } else {
            const parsedRate = parseFloat(newRate) || 0;
            const roundedRate = Math.round(parsedRate * 100) / 100;
            setAdditionalTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, hourlyRate: roundedRate } : task
            ));
        }
    };

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
        
        // Calculate regular project tasks subtotal
        invoiceTasks.forEach(task => {
            const taskHours = editableHours[task.id] || task.hours;
            totalHours += taskHours;
            
            if (useFlatRate[task.id]) {
                // Use flat rate for this task
                projectSubtotal += (taskFlatRates[task.id] || 0);
            } else {
                // Use task-specific hourly rate if available, otherwise fall back to project rate
                const hourlyRate = taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || 0;
                projectSubtotal += taskHours * hourlyRate;
            }
        });
        
        // Calculate additional tasks subtotal
        additionalTasks.forEach(task => {
            if (useFlatRate[task.id]) {
                // Use flat rate
                additionalTaskAmount += task.flatRate;
            } else {
                const hourlyRate = task.hourlyRate || selectedProject?.hourlyRate || 0;
                additionalTaskAmount += task.hours * hourlyRate;
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
        taskFlatRates, useFlatRate, taskHourlyRates]);

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback((projectForData = null) => {
        // Use provided project or default to selected project
        const projectToUse = projectForData || selectedProject;
        if (!projectToUse) return null;
        
        // Get billable time entries (since last billing)
        const lastBilledAt = projectToUse.lastBilledAt || projectToUse.createdAt;
        
        // Get all tasks that belong to this project
        const projectTasks = tasks.filter(task => task.projectId === projectToUse.id);
        const projectTaskIds = projectTasks.map(task => task.id);
        
        // Only include entries that:
        // 1. Belong to this project's tasks
        // 2. Were created after the last billing date
        // 3. Are completed (have an end time)
        const billableEntries = timeEntries.filter(entry => 
            projectTaskIds.includes(entry.taskId) && // Filter by project tasks
            entry.start > lastBilledAt && 
            entry.end && 
            entry.end > entry.start
        );
        
        if (billableEntries.length === 0) {
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

        // Prepare tasks data array
        const tasksData = Object.entries(taskTimeMap).map(([taskId, totalTime]) => {
            const task = tasks.find(t => t.id === taskId);
            const hours = millisecondsToHours(totalTime);
            const roundedHours = Math.round(hours * 100) / 100;
            const editedHours = editableHours[taskId] !== undefined ? editableHours[taskId] : roundedHours;
            return {
                id: taskId,
                title: task ? task.title : 'Unknown Task',
                originalHours: roundedHours,
                originalTimeMs: totalTime, // Keep the original milliseconds for accurate time display
                hours: editedHours,
                isEdited: editedHours !== roundedHours
            };
        }).filter(task => task.originalHours > 0);

        return tasksData;
    }, [selectedProject, timeEntries, tasks, editableHours]);

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

        // Tasks are still required
        if (invoiceTasks.length === 0 && additionalTasks.length === 0) {
            showError('No billable time entries or additional tasks found');
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
                email: selectedClientInfo.email || '',
                address: selectedClientInfo.address || '',
                city: selectedClientInfo.city || '',
                state: selectedClientInfo.state || '',
                zip: selectedClientInfo.zip || ''
            },
            tasks: invoiceTasks.map(task => ({
                ...task,
                hours: editableHours[task.id] || task.originalHours,
                flatRate: taskFlatRates[task.id] || 0,
                hourlyRate: taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || 0,
                useFlatRate: useFlatRate[task.id] || false
            })),
            additionalTasks: additionalTasks.map(task => ({
                ...task,
                hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0
            })),
            taskFlatRates: taskFlatRates,
            useFlatRate: useFlatRate,
            taskHourlyRates: taskHourlyRates,
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
            htmlContent: createInvoiceHTML({
                id: editingInvoice ? editingInvoice.id : `INV-${selectedProject.id.slice(-8)}-${Date.now()}`,
                project: selectedProject,
                client: {
                    name: selectedClientInfo.clientName || '',
                    email: selectedClientInfo.email || '',
                    address: selectedClientInfo.address || '',
                    city: selectedClientInfo.city || '',
                    state: selectedClientInfo.state || '',
                    zip: selectedClientInfo.zip || ''
                },
                tasks: invoiceTasks.map(task => ({
                    ...task,
                    hours: editableHours[task.id] || task.originalHours,
                    hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0
                })),
                additionalTasks: additionalTasks.map(task => ({
                    ...task,
                    hourlyRate: task.hourlyRate || selectedProject?.hourlyRate || 0
                })),
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

        // Update project to include invoice ID (only if we have a selected project)
        if (selectedProject) {
            const updatedProjects = projects.map(p => 
                p.id === selectedProject.id 
                    ? { 
                        ...p, 
                        lastBilledAt: editingInvoice ? p.lastBilledAt : Date.now(),
                        invoiceIds: updatedProjectInvoiceIds
                    }
                    : p
            );
            setProjects(updatedProjects);
        }

        // Reset form
        setShowInvoiceForm(false);
        
        // Use the centralized reset function
        resetInvoiceForm();
        
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
        
        if (editingInvoice) {
            // Open form with existing invoice data
            setInvoiceTasks(editingInvoice.tasks || []);
            const initialHours = {};
            const initialFlatRates = {};
            const initialFlatRateToggles = {};
            const initialHourlyRates = {};
            
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
            });
            
            setEditableHours(initialHours);
            setTaskFlatRates(initialFlatRates);
            setUseFlatRate(initialFlatRateToggles);
            setTaskHourlyRates(initialHourlyRates);
            
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
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                });
                setEditableHours(initialHours);
                
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
            }
            
            // When opened from a project context, lock the project selection
            setIsProjectContextFixed(true);
        }
        setShowInvoiceForm(true);
    }, [editingInvoice, prepareInvoiceData, showInvoiceForm, projects, setIsProjectContextFixed, selectedProject?.hourlyRate]);

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

    /**
     * Handle canceling the form
     */
    const handleCancel = () => {
        // Close the modal and reset state
        setShowInvoiceForm(false);
        didAutoOpenModalRef.current = false; // Reset the flag here
        
        // Use the centralized reset function
        resetInvoiceForm();
        
        // Reset the project manually changed flag
        setProjectManuallyChanged(false);
        
        // Only call onInvoiceSaved to clear editing state if we're actually editing
        // This prevents the issue where canceling triggers the same callback as saving
        if (editingInvoice && onInvoiceSaved) {
            onInvoiceSaved(); // This will clear the editing state in the parent component
        }
    };

    // Calculate unbilled time - initially using the current project (will update when a project is selected)
    const currentProjectForCalculation = selectedProject || project;
    let unbilledHours = 0;
    let unbilledAmount = 0;

    // Only calculate unbilled time if we have a project context
    if (currentProjectForCalculation) {
        const lastBilledAt = currentProjectForCalculation.lastBilledAt || currentProjectForCalculation.createdAt;

        const unbilledEntries = timeEntries.filter(entry => 
            entry.start > lastBilledAt && entry.end && entry.end > entry.start
        );

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
                        {currentProjectForCalculation && unbilledHours > 0 && (
                            <span className="ml-2 px-2 py-1 bg-green-500 text-xs rounded-full">
                                {getCurrencySymbol(currentProjectForCalculation.currency)}{unbilledAmount.toFixed(2)}
                            </span>
                        )}
                    </button>
                </div>
            )}
            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 !mt-0">
                    <div className="relative mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white my-8">
                        
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
                            </h3>
                            <button
                                onClick={handleCancel}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div>
                            <form onSubmit={handleSaveInvoice} className="space-y-5">
                                
                                {/* Project Selection */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            Project <span className="text-red-500">*</span>
                                        </h4>
                                        {onNavigateToProjects && !isProjectContextFixed && !editingInvoice && (
                                            <button
                                                type="button"
                                                onClick={onNavigateToProjects}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                + New Project
                                            </button>
                                        )}
                                    </div>

                                    {projects.length === 0 ? (
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-sm text-yellow-800 mb-3">
                                                No projects found. Create a project to continue with invoice generation.
                                            </p>
                                            {onNavigateToProjects && !isProjectContextFixed && !editingInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={onNavigateToProjects}
                                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                                >
                                                    Create Project
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedProject?.id || ''}
                                                onChange={(e) => handleProjectSelection(e.target.value)}
                                                className={`block w-full border ${(isProjectContextFixed || editingInvoice) ? 'bg-gray-100' : 'bg-white'} border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2`}
                                                required
                                                disabled={isProjectContextFixed || editingInvoice}
                                            >
                                                <option value="" disabled>Select project</option>
                                                {projects.map(proj => (
                                                    <option key={proj.id} value={proj.id}>
                                                        {proj.title}
                                                    </option>
                                                ))}
                                            </select>

                                            {selectedProject && (
                                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>{selectedProject.title}</strong><br />
                                                        Rate: {getCurrencySymbol(selectedProject.currency)}{selectedProject.hourlyRate}/hour
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Client Info Selection */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            Client <span className="text-red-500">*</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={onNavigateToClientInfo}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            + New Client Info
                                        </button>
                                    </div>
                                    
                                    {clientInfos.length === 0 ? (
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-sm text-yellow-800 mb-3">
                                                No client information found. Create one to include client details in the invoice.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={onNavigateToClientInfo}
                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                            >
                                                Create Client Info
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedClientInfo?.id || ''}
                                                onChange={(e) => handleClientInfoSelection(e.target.value)}
                                                className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                                required
                                            >
                                                {/* Make this placeholder not disabled to allow clearing the selection if needed */}
                                                <option value="">Select client info</option>
                                                {clientInfos.map(clientInfo => (
                                                    <option key={clientInfo.id} value={clientInfo.id}>
                                                        {clientInfo.clientName.trim()}
                                                    </option>
                                                ))}
                                            </select>
                                                        {selectedClientInfo && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                <strong>{selectedClientInfo.clientName}</strong><br/>
                                                {selectedClientInfo.email && (
                                                    <span>{selectedClientInfo.email}<br/></span>
                                                )}
                                                {selectedClientInfo.address && (
                                                    <span>{selectedClientInfo.address}<br/></span>
                                                )}
                                                {(selectedClientInfo.city || selectedClientInfo.state || selectedClientInfo.zip) && (
                                                    <span>
                                                        {selectedClientInfo.city ? selectedClientInfo.city + ', ' : ''}
                                                        {selectedClientInfo.state ? selectedClientInfo.state + ' ' : ''}
                                                        {selectedClientInfo.zip || ''}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                        </div>
                                    )}
                                </div>

                                {/* Tasks with Editable Hours */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            Tasks & Time <span className="text-red-500">*</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddTaskForm(true)}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            + Add Task
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {invoiceTasks.map((task) => {
                                            const currentHours = editableHours[task.id] !== undefined ? editableHours[task.id] : task.hours;
                                            const currentMinutes = hoursToMinutes(currentHours);
                                            const currentFlatRate = taskFlatRates[task.id] || 0;
                                            // For existing invoices, calculate originalTimeMs from originalHours if not present
                                            const originalTimeMs = task.originalTimeMs || (task.originalHours * 60 * 60 * 1000);
                                            
                                            // Check if this task uses flat rate
                                            const isUsingFlatRate = useFlatRate[task.id] || false;
                                            
                                            return (
                                                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Original: {formatDurationWithSeconds(originalTimeMs)}
                                                            {task.isEdited && (
                                                                <span className="text-blue-600 ml-2">(Modified)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex items-center space-x-4">
                                                        {/* Add flat rate toggle */}
                                                        <div className="flex items-center">
                                                            <CustomCheckbox
                                                                checked={isUsingFlatRate}
                                                                onChange={() => handleToggleFlatRate(task.id, !isUsingFlatRate)}
                                                            />
                                                            <label htmlFor={`flat-rate-${task.id}`} className="ml-2 text-xs text-gray-700">
                                                                Flat rate
                                                            </label>
                                                        </div>
                                                    
                                                        {isUsingFlatRate ? (
                                                            // Flat rate input
                                                            <div className="text-right">
                                                                <div className="text-xs text-gray-500 mb-1 text-left">{selectedProject?.currency || "USD"}</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={currentFlatRate === '' ? '' : currentFlatRate.toFixed(2)}
                                                                    onChange={(e) => handleFlatRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        ) : (
                                                            // Hours input with custom hourly rate
                                                            <div className="flex items-center space-x-2">
                                                                <div className="text-right">
                                                                    <div className="text-xs text-gray-500 mb-1 text-left">Hours ({currentMinutes}min)</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={currentHours === '' ? '' : currentHours.toFixed(2)}
                                                                        onChange={(e) => handleHoursChange(task.id, e.target.value)}
                                                                        className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                    />
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={taskHourlyRates[task.id] === '' ? '' : (taskHourlyRates[task.id] || selectedProject?.hourlyRate || 0).toFixed(2)}
                                                                        onChange={(e) => handleTaskHourlyRateChange(task.id, e.target.value)}
                                                                        className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Additional Tasks */}
                                        {additionalTasks.map((task) => {
                                            const currentMinutes = hoursToMinutes(task.hours || 0);
                                            const currentFlatRate = task.flatRate || 0;
                                            
                                            // Check if this task uses flat rate (from task object or state)
                                            const isUsingFlatRate = task.useFlatRate || useFlatRate[task.id] || false;
                                            
                                            return (
                                                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Custom task
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        {/* Add flat rate toggle */}
                                                        <div className="flex items-center">
                                                            <CustomCheckbox
                                                                checked={isUsingFlatRate}
                                                                onChange={() => handleToggleFlatRate(task.id, !isUsingFlatRate)}
                                                            />
                                                            <label htmlFor={`flat-rate-${task.id}`} className="ml-2 text-xs text-gray-700">
                                                                Flat rate
                                                            </label>
                                                        </div>
                                                        
                                                        {isUsingFlatRate ? (
                                                            // Flat rate input
                                                            <div className="text-right">
                                                                <div className="text-xs text-gray-500 mb-1 text-left">{selectedProject?.currency || "USD"}</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={currentFlatRate === '' ? '' : currentFlatRate.toFixed(2)}
                                                                    onChange={(e) => handleAdditionalTaskFlatRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        ) : (
                                                            // Hours input with custom hourly rate
                                                            <div className="flex items-center space-x-2">
                                                                <div className="text-right">
                                                                    <div className="text-xs text-gray-500 mb-1 text-left">Hours ({currentMinutes}min)</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={task.hours === '' ? '' : (task.hours || 0).toFixed(2)}
                                                                        onChange={(e) => handleAdditionalTaskHoursChange(task.id, e.target.value)}
                                                                        className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                    />
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={task.hourlyRate === '' ? '' : (task.hourlyRate || selectedProject?.hourlyRate || 0).toFixed(2)}
                                                                        onChange={(e) => handleAdditionalTaskHourlyRateChange(task.id, e.target.value)}
                                                                        className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAdditionalTask(task.id)}
                                                            className="p-1 text-red-600 hover:text-red-800"
                                                            title="Remove task"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Add Task Form */}
                                    {showAddTaskForm && (
                                        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                            <div className="space-y-3">
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={newTaskTitle}
                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                        placeholder="Task description"
                                                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <CustomCheckbox
                                                        checked={newTaskUseFlatRate}
                                                        onChange={handleToggleNewTaskFlatRate}
                                                    />
                                                    <label htmlFor="new-task-flat-rate" className="text-xs text-gray-700">
                                                        Flat rate
                                                    </label>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <div className="flex space-x-2">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">
                                                                {newTaskUseFlatRate ? (selectedProject?.currency || "USD") : `Hours ${newTaskHours ? `(${hoursToMinutes(parseFloat(newTaskHours) || 0)}min)` : ''}`}
                                                            </div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTaskHours}
                                                                onChange={(e) => setNewTaskHours(e.target.value)}
                                                                placeholder={newTaskUseFlatRate ? "0.00" : "Hours"}
                                                                className="w-24 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* New Hourly Rate Input */}
                                                    {!newTaskUseFlatRate && (
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1 text-left">Hourly rate</div>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTaskHourlyRate || selectedProject?.hourlyRate || 0}
                                                                onChange={(e) => setNewTaskHourlyRate(e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-20 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end space-x-2 mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowAddTaskForm(false);
                                                            setNewTaskTitle('');
                                                            setNewTaskHours('');
                                                            setNewTaskHourlyRate('');
                                                            setNewTaskUseFlatRate(false);
                                                        }}
                                                        className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddAdditionalTask}
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                                                    >
                                                        Add Task
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Warning message for no tasks */}
                                    {(invoiceTasks.length + additionalTasks.length) === 0 && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                            <p className="text-sm text-yellow-800">
                                                Please add a task to continue...
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* Comprehensive Pricing & Totals Section */}
                                    <div className="mt-4">
                                        <div className="border border-gray-200 rounded-t-lg">
                                            <button
                                                type="button"
                                                onClick={() => setPricingCollapsed(!pricingCollapsed)}
                                                className="w-full px-4 py-3 text-left border-b border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium text-gray-900">Pricing & Totals</h4>
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-sm font-medium text-blue-600">
                                                            {selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.total.toFixed(2)}
                                                        </span>
                                                        <svg 
                                                            className={`w-5 h-5 text-gray-500 transform transition-transform ${pricingCollapsed ? '' : 'rotate-180'}`} 
                                                            fill="none" 
                                                            stroke="currentColor" 
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </button>

                                            {!pricingCollapsed && (
                                                <div className="p-4 space-y-4">
                                                    {/* Discount Settings */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                                                        <div className="flex space-x-2">
                                                            <select
                                                                value={discountType}
                                                                onChange={(e) => setDiscountType(e.target.value)}
                                                                className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1"
                                                            >
                                                                <option value="percentage">%</option>
                                                                <option value="fixed">{selectedProject ? getCurrencySymbol(selectedProject.currency) : '$'}</option>
                                                            </select>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={discountValue === '' ? '' : discountValue}
                                                                onChange={(e) => {
                                                                    const newValue = e.target.value;
                                                                    if (newValue === '') {
                                                                        setDiscountValue('');
                                                                    } else {
                                                                        setDiscountValue(parseFloat(newValue) || 0);
                                                                    }
                                                                }}
                                                                className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                placeholder={discountType === 'percentage' ? '0.00' : '0.00'}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Shipping */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Shipping</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={shippingAmount === '' ? '' : shippingAmount}
                                                            onChange={(e) => {
                                                                const newValue = e.target.value;
                                                                if (newValue === '') {
                                                                    setShippingAmount('');
                                                                } else {
                                                                    setShippingAmount(parseFloat(newValue) || 0);
                                                                }
                                                            }}
                                                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                            placeholder="0.00"
                                                        />
                                                    </div>

                                                    {/* Tax Override */}
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <CustomCheckbox
                                                                checked={taxOverride.enabled}
                                                                onChange={() => setTaxOverride(prev => ({ ...prev, enabled: !prev.enabled }))}
                                                            />
                                                            <label htmlFor="taxOverrideEnabled" className="text-sm font-medium text-gray-700">
                                                                Override tax settings
                                                            </label>
                                                        </div>
                                                        
                                                        {taxOverride.enabled && (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <input
                                                                        type="text"
                                                                        value={taxOverride.label}
                                                                        onChange={(e) => setTaxOverride(prev => ({ ...prev, label: e.target.value }))}
                                                                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                        placeholder="Tax label"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        max="100"
                                                                        value={taxOverride.rate === '' ? '' : taxOverride.rate}
                                                                        onChange={(e) => {
                                                                            const newValue = e.target.value;
                                                                            if (newValue === '') {
                                                                                setTaxOverride(prev => ({ ...prev, rate: '' }));
                                                                            } else {
                                                                                setTaxOverride(prev => ({ ...prev, rate: parseFloat(newValue) || 0 }));
                                                                            }
                                                                        }}
                                                                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                        placeholder="Rate %"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {!taxOverride.enabled && selectedProject?.taxEnabled && (
                                                            <div className="text-xs text-gray-500">
                                                                Using project tax: {selectedProject.taxLabel} {selectedProject.taxRate}%
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Pricing Breakdown */}
                                                    <div className="border-t pt-3 space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span>Subtotal:</span>
                                                            <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.subtotal.toFixed(2)}</span>
                                                        </div>
                                                        
                                                        {calculatePricing.discount > 0 && (
                                                            <div className="flex justify-between text-sm text-red-600">
                                                                <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : getCurrencySymbol(selectedProject?.currency || 'USD') + discountValue}):</span>
                                                                <span>-{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.discount.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        
                                                        {calculatePricing.shipping > 0 && (
                                                            <div className="flex justify-between text-sm">
                                                                <span>Shipping:</span>
                                                                <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.shipping.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        
                                                        {calculatePricing.tax > 0 && (
                                                            <div className="flex justify-between text-sm">
                                                                <span>{calculatePricing.taxLabel} ({calculatePricing.taxRate}%):</span>
                                                                <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.tax.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex justify-between text-base font-medium border-t pt-2">
                                                            <span>Total:</span>
                                                            <span>{selectedProject ? getCurrencySymbol(selectedProject.currency) : ''}{calculatePricing.total.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Business Info Selection */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            Invoice From
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={onNavigateToBusinessInfo}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            + New Business Info
                                        </button>
                                    </div>
                                    
                                    {businessInfos.length === 0 ? (
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-sm text-yellow-800 mb-3">
                                                No business information found. Create one to include your business details in the invoice.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={onNavigateToBusinessInfo}
                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                            >
                                                Create Business Info
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedBusinessInfo?.id || ''}
                                                onChange={(e) => {
                                                    if (e.target.value === "") {
                                                        setSelectedBusinessInfo(null);
                                                    } else {
                                                        const businessInfo = businessInfos.find(bi => bi.id === e.target.value);
                                                        if (businessInfo) {
                                                            setSelectedBusinessInfo(businessInfo);
                                                        }
                                                    }
                                                }}
                                                className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                            >
                                                <option value="">Select business info (optional)</option>
                                                {businessInfos.map(info => (
                                                    <option key={info.id} value={info.id}>
                                                        {info.title}
                                                    </option>
                                                ))}
                                            </select>
                                            
                                            {selectedBusinessInfo && (
                                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>{selectedBusinessInfo.title}</strong> will be included as "Invoice From" in the invoice.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Method Selection */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            Payment Method
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={onNavigateToPaymentMethods}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            + New Payment Method
                                        </button>
                                    </div>
                                    
                                    {paymentMethods.length === 0 ? (
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-sm text-yellow-800 mb-3">
                                                No payment methods found. Create one to include payment details in your invoice.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={onNavigateToPaymentMethods}
                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                            >
                                                Create Payment Method
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedPaymentMethod?.id || ''}
                                                onChange={(e) => {
                                                    if (e.target.value === "") {
                                                        setSelectedPaymentMethod(null);
                                                    } else {
                                                        const paymentMethod = paymentMethods.find(pm => pm.id === e.target.value);
                                                        if (paymentMethod) {
                                                            setSelectedPaymentMethod(paymentMethod);
                                                        }
                                                    }
                                                }}
                                                className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                            >
                                                <option value="">Select payment method (optional)</option>
                                                {paymentMethods.map(method => (
                                                    <option key={method.id} value={method.id}>
                                                        {method.title}
                                                    </option>
                                                ))}
                                            </select>
                                            
                                            {selectedPaymentMethod && (
                                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>{selectedPaymentMethod.title}</strong> will be included in the invoice payment details.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Invoice Note */}
                                <div className="mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceNoteCollapsed(!invoiceNoteCollapsed)}
                                        className="flex items-center flex-start w-full text-left space-x-2"
                                    >
                                        <label className="block text-sm font-medium text-gray-900">
                                            Invoice Note <span className="text-gray-500 font-normal">(optional)</span>
                                        </label>
                                        <svg
                                            className={`w-4 h-4 transition-transform ${invoiceNoteCollapsed ? 'rotate-0' : 'rotate-180'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {!invoiceNoteCollapsed && (
                                        <div className="mt-2">
                                            <textarea
                                                value={invoiceNote}
                                                onChange={(e) => setInvoiceNote(e.target.value)}
                                                className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                                rows="3"
                                                placeholder="Add any additional notes for the invoice here..."
                                            ></textarea>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                    >
                                        {editingInvoice ? 'Update Invoice' : 'Generate New Invoice'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceGenerator;
