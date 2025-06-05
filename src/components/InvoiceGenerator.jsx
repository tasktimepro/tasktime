import { useState, useEffect, useCallback, useMemo } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { createInvoiceHTML } from '../utils/pdfUtils';
import { millisecondsToHours, formatDurationWithSeconds, hoursToMinutes } from '../utils/dateUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { useToast } from '../hooks/useToast';

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
    invoices = [],
    setInvoices
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBusinessInfo, setSelectedBusinessInfo] = useState(null);
    const [selectedClientInfo, setSelectedClientInfo] = useState(null);
    const [selectedProject, setSelectedProject] = useState(project); // Initialize with current project
    const [isProjectContextFixed, setIsProjectContextFixed] = useState(true); // Track if opened from project context
    const { showSuccess, showError } = useToast();

    // Get project invoices from the new structure - memoized to prevent unnecessary re-renders
    const projectInvoices = useMemo(() => {
        // Use the selected project if available, otherwise fall back to the initially passed project
        const currentProject = selectedProject || project;
        return invoices.filter(invoice => 
            (currentProject.invoiceIds || []).includes(invoice.id)
        );
    }, [invoices, selectedProject, project]);

    // Debug logging
    console.log('🔍 InvoiceGenerator - clientInfos:', clientInfos);
    console.log('🔍 InvoiceGenerator - clientInfos.length:', clientInfos.length);

    /**
     * Initialize payment method based on previous invoices or editing invoice
     */
    const initializePaymentMethod = useCallback(() => {
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set
        if (selectedPaymentMethod !== null) {
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
        
        // Look for last used payment method in previous invoices
        if (projectInvoices.length > 0) {
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
    }, [editingInvoice, projectInvoices, paymentMethods, selectedPaymentMethod]);

    /**
     * Initialize business info based on previous invoices or editing invoice
     */
    const initializeBusinessInfo = useCallback(() => {
        // Only initialize on first mount or when editing invoice changes
        // Don't override user selection once set
        if (selectedBusinessInfo !== null) {
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
        
        // Look for last used business info in previous invoices
        if (projectInvoices.length > 0) {
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
    }, [editingInvoice, projectInvoices, businessInfos, selectedBusinessInfo]);

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

        // If user has already made a selection and it still exists in clientInfos, keep it
        if (selectedClientInfo !== null) {
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
        
        // Look for last used client info in previous invoices
        if (projectInvoices.length > 0) {
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
        
        // Auto-select the first client info if nothing else selected
        if (clientInfos.length > 0 && !selectedClientInfo) {
            setSelectedClientInfo(clientInfos[0]);
        }
    }, [editingInvoice, projectInvoices, clientInfos, selectedClientInfo]);

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
     * Handle project selection from dropdown
     */
    const handleProjectSelection = (projectId) => {
        if (projectId === "") {
            setSelectedProject(null);
        } else {
            const selectedProj = projects.find(p => p.id === projectId);
            if (selectedProj) {
                setSelectedProject(selectedProj);
            }
        }
    };

    /**
     * Handle hours modification for invoice tasks
     */
    const handleHoursChange = (taskId, newHours) => {
        const parsedHours = parseFloat(newHours) || 0;
        const roundedHours = Math.round(parsedHours * 100) / 100; // Round to 2 decimal places
        setEditableHours(prev => ({
            ...prev,
            [taskId]: roundedHours
        }));
    };

    /**
     * Calculate pricing breakdown: Subtotal → Discount → Shipping → Tax → Total
     */
    const calculatePricing = useMemo(() => {
        if (!selectedProject || invoiceTasks.length === 0) {
            return {
                subtotal: 0,
                discount: 0,
                shipping: 0,
                tax: 0,
                total: 0,
                taxRate: 0,
                taxLabel: 'VAT'
            };
        }

        const totalHours = invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0);
        const subtotal = totalHours * selectedProject.hourlyRate;

        // Calculate discount
        const discount = discountType === 'percentage' 
            ? (subtotal * (discountValue / 100))
            : discountValue;

        // Subtotal after discount
        const afterDiscount = subtotal - discount;

        // Add shipping
        const shipping = parseFloat(shippingAmount) || 0;
        const afterShipping = afterDiscount + shipping;

        // Calculate tax
        let taxRate = 0;
        let taxLabel = 'VAT';
        
        if (taxOverride.enabled) {
            taxRate = parseFloat(taxOverride.rate) || 0;
            taxLabel = taxOverride.label || 'Tax';
        } else if (selectedProject.taxEnabled) {
            taxRate = parseFloat(selectedProject.taxRate) || 0;
            taxLabel = selectedProject.taxLabel || 'VAT';
        }

        const tax = (afterShipping * (taxRate / 100));
        const total = afterShipping + tax;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            discount: Math.round(discount * 100) / 100,
            shipping: Math.round(shipping * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100,
            taxRate,
            taxLabel
        };
    }, [selectedProject, invoiceTasks, editableHours, discountType, discountValue, shippingAmount, taxOverride]);

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback(() => {
        if (!selectedProject) return null;
        
        // Get billable time entries (since last billing)
        const lastBilledAt = selectedProject.lastBilledAt || selectedProject.createdAt;

        // Only include completed entries (with end time) that are after last billing
        const billableEntries = timeEntries.filter(entry => 
            entry.start > lastBilledAt && entry.end && entry.end > entry.start
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

        // Create invoice tasks with editable hours
        const tasksData = Object.keys(taskTimeMap).map(taskId => {
            const task = tasks.find(t => t.id === taskId);
            const totalTime = taskTimeMap[taskId];
            const calculatedHours = millisecondsToHours(totalTime);
            const roundedHours = Math.round(calculatedHours * 100) / 100; // Round to 2 decimal places
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

        if (!selectedProject) {
            showError('Please select a project');
            return;
        }

        if (invoiceTasks.length === 0) {
            showError('No billable time entries found since last invoice');
            return;
        }

        const pricing = calculatePricing;
        const totalHours = invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.originalHours), 0);

        const invoiceData = {
            id: editingInvoice ? editingInvoice.id : `INV-${selectedProject.id.slice(-8)}-${Date.now()}`,
            project: selectedProject,
            projectId: selectedProject.id,
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
                hours: editableHours[task.id] || task.originalHours
            })),
            totalHours: totalHours,
            totalAmount: pricing.total,
            // Add new pricing breakdown fields
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
            invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `INV-${selectedProject.id.slice(-8)}-${Date.now()}`,
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
                    hours: editableHours[task.id] || task.originalHours
                })),
                totalHours: totalHours,
                totalAmount: pricing.total,
                // Add pricing breakdown for PDF
                subtotal: pricing.subtotal,
                discount: pricing.discount,
                shipping: pricing.shipping,
                tax: pricing.tax,
                taxRate: pricing.taxRate,
                taxLabel: pricing.taxLabel,
                paymentMethod: selectedPaymentMethod,
                businessInfo: selectedBusinessInfo,
                invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `INV-${project.id.slice(-8)}-${Date.now()}`,
                date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
                createdAt: editingInvoice ? editingInvoice.createdAt : Date.now()
            })
        };

        // Store invoice in the new separate invoices structure
        let updatedInvoices;
        let updatedProjectInvoiceIds;
        
        if (editingInvoice) {
            // Update existing invoice
            updatedInvoices = invoices.map(inv => 
                inv.id === editingInvoice.id ? invoiceData : inv
            );
            updatedProjectInvoiceIds = selectedProject.invoiceIds || [];
        } else {
            // Add new invoice
            updatedInvoices = [...invoices, invoiceData];
            updatedProjectInvoiceIds = [...(selectedProject.invoiceIds || []), invoiceData.id];
        }

        // Update invoices storage - check if setInvoices is a function
        if (typeof setInvoices === 'function') {
            setInvoices(updatedInvoices);
        }

        // Update project to include invoice ID
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

        // Reset form
        setShowInvoiceForm(false);
        setInvoiceTasks([]);
        setEditableHours({});
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
            (editingInvoice.tasks || []).forEach(task => {
                initialHours[task.id] = Math.round((task.hours || 0) * 100) / 100; // Round to 2 decimal places
            });
            setEditableHours(initialHours);
            
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
            if (!tasksData) {
                showError('No billable time entries found since last invoice');
                return;
            }
            
            setInvoiceTasks(tasksData);
            // Initialize editable hours with original hours
            const initialHours = {};
            tasksData.forEach(task => {
                initialHours[task.id] = task.originalHours;
            });
            setEditableHours(initialHours);
            
            // When opened from a project context, lock the project selection
            setIsProjectContextFixed(true);
        }
        setShowInvoiceForm(true);
    }, [editingInvoice, prepareInvoiceData, showInvoiceForm, showError, projects, setIsProjectContextFixed]);

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
        // First, clear the editing state immediately if we're in edit mode
        // This prevents another modal from opening with "New Invoice" state
        if (editingInvoice && onInvoiceSaved) {
            onInvoiceSaved(); // This will clear the editing state
        }
        
        // Close the modal and reset state
        setShowInvoiceForm(false);
        setInvoiceTasks([]);
        setEditableHours({});
    };

    // Calculate unbilled time - initially using the current project (will update when a project is selected)
    const currentProjectForCalculation = selectedProject || project;
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
    const unbilledHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
        const taskHours = millisecondsToHours(taskTime);
        const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
        return total + roundedTaskHours;
    }, 0);

    const unbilledAmount = unbilledHours * currentProjectForCalculation.hourlyRate;

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-3">
                <button
                    onClick={openInvoiceForm}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Generate Invoice
                    {unbilledHours > 0 && (
                        <span className="ml-2 px-2 py-1 bg-green-500 text-xs rounded-full">
                            {getCurrencySymbol(currentProjectForCalculation.currency)}{unbilledAmount.toFixed(2)}
                        </span>
                    )}
                </button>
            </div>

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

                        {invoiceTasks.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-gray-500">No billable time entries found.</p>
                                <button
                                    onClick={handleCancel}
                                    className="mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div>
                                <form onSubmit={handleSaveInvoice} className="space-y-5">
                                    {/* Client Info Selection */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                Client
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
                                                    <option value="">Select client information</option>
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

                                    {/* Project Selection */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                Project
                                            </h4>
                                        </div>
                                        <div className="space-y-3">
                                            <select
                                                value={selectedProject?.id || ''}
                                                onChange={(e) => handleProjectSelection(e.target.value)}
                                                className={`block w-full border ${isProjectContextFixed ? 'bg-gray-100' : 'bg-white'} border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2`}
                                                required
                                                disabled={isProjectContextFixed}
                                            >
                                                <option value="">Select project</option>
                                                {projects.map(proj => (
                                                    <option key={proj.id} value={proj.id}>
                                                        {proj.title}
                                                    </option>
                                                ))}
                                            </select>
                                            
                                            {selectedProject && (
                                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>{selectedProject.title}</strong><br/>
                                                        Rate: {getCurrencySymbol(selectedProject.currency)}{selectedProject.hourlyRate}/hour
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tasks with Editable Hours */}
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                                            Tasks & Time
                                        </h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {invoiceTasks.map((task) => {
                                                const currentHours = editableHours[task.id] !== undefined ? editableHours[task.id] : task.hours;
                                                const currentMinutes = hoursToMinutes(currentHours);
                                                // For existing invoices, calculate originalTimeMs from originalHours if not present
                                                const originalTimeMs = task.originalTimeMs || (task.originalHours * 60 * 60 * 1000);
                                                
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
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-right">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={currentHours.toFixed(2)}
                                                                    onChange={(e) => handleHoursChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-gray-300 rounded-md"
                                                                />
                                                            </div>
                                                            <div className="flex-1 text-0">
                                                                <span className="text-sm text-gray-500">hours</span>
                                                                <div className="text-xs text-gray-400">({currentMinutes}min)</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* Comprehensive Pricing & Totals Section */}
                                        <div className="mt-4">
                                            <div className="border border-gray-200 rounded-lg">
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
                                                                    value={discountValue}
                                                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
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
                                                                value={shippingAmount}
                                                                onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                                                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                                                placeholder="0.00"
                                                            />
                                                        </div>

                                                        {/* Tax Override */}
                                                        <div>
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id="taxOverrideEnabled"
                                                                    checked={taxOverride.enabled}
                                                                    onChange={(e) => setTaxOverride(prev => ({ ...prev, enabled: e.target.checked }))}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                                                                            value={taxOverride.rate}
                                                                            onChange={(e) => setTaxOverride(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
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
                                                                <span>Subtotal ({invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0).toFixed(2)}h):</span>
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
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceGenerator;
