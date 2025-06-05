import { useState, useEffect, useCallback } from 'react';
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
    onNavigateToClientInfo
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBusinessInfo, setSelectedBusinessInfo] = useState(null);
    const [selectedClientInfo, setSelectedClientInfo] = useState(null);
    const { showSuccess, showError } = useToast();

    // Debug logging
    console.log('🔍 InvoiceGenerator - clientInfos:', clientInfos);
    console.log('🔍 InvoiceGenerator - clientInfos.length:', clientInfos.length);

    /**
     * Initialize payment method based on previous invoices or editing invoice
     */
    const initializePaymentMethod = useCallback(() => {
        // If editing an invoice, use its payment method
        if (editingInvoice && editingInvoice.paymentMethodId) {
            const paymentMethod = paymentMethods.find(pm => pm.id === editingInvoice.paymentMethodId);
            if (paymentMethod) {
                setSelectedPaymentMethod(paymentMethod);
                return;
            }
        }
        
        // Look for last used payment method in previous invoices
        const previousInvoices = project.invoices || [];
        if (previousInvoices.length > 0) {
            for (let i = previousInvoices.length - 1; i >= 0; i--) {
                const invoice = previousInvoices[i];
                if (invoice.paymentMethodId) {
                    const paymentMethod = paymentMethods.find(pm => pm.id === invoice.paymentMethodId);
                    if (paymentMethod) {
                        setSelectedPaymentMethod(paymentMethod);
                        return;
                    }
                }
            }
        }
        
        // No previous payment method found
        setSelectedPaymentMethod(null);
    }, [editingInvoice, project.invoices, paymentMethods]);

    /**
     * Initialize business info based on previous invoices or editing invoice
     */
    const initializeBusinessInfo = useCallback(() => {
        // If editing an invoice, use its business info
        if (editingInvoice && editingInvoice.businessInfoId) {
            const businessInfo = businessInfos.find(bi => bi.id === editingInvoice.businessInfoId);
            if (businessInfo) {
                setSelectedBusinessInfo(businessInfo);
                return;
            }
        }
        
        // Look for last used business info in previous invoices
        const previousInvoices = project.invoices || [];
        if (previousInvoices.length > 0) {
            for (let i = previousInvoices.length - 1; i >= 0; i--) {
                const invoice = previousInvoices[i];
                if (invoice.businessInfoId) {
                    const businessInfo = businessInfos.find(bi => bi.id === invoice.businessInfoId);
                    if (businessInfo) {
                        setSelectedBusinessInfo(businessInfo);
                        return;
                    }
                }
            }
        }
        
        // No previous business info found
        setSelectedBusinessInfo(null);
    }, [editingInvoice, project.invoices, businessInfos]);

    /**
     * Initialize selected client info based on previous invoices or editing invoice
     */
    const initializeSelectedClientInfo = useCallback(() => {
        if (clientInfos.length === 0) {
            setSelectedClientInfo(null);
            return;
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
        const previousInvoices = project.invoices || [];
        if (previousInvoices.length > 0) {
            for (let i = previousInvoices.length - 1; i >= 0; i--) {
                const invoice = previousInvoices[i];
                if (invoice.clientInfoId) {
                    const clientInfo = clientInfos.find(ci => ci.id === invoice.clientInfoId);
                    if (clientInfo) {
                        setSelectedClientInfo(clientInfo);
                        return;
                    }
                }
            }
        }
        
        // No previous client info found, but auto-select the first one if available
        if (clientInfos.length > 0) {
            setSelectedClientInfo(clientInfos[0]);
        } else {
            setSelectedClientInfo(null);
        }
    }, [editingInvoice, project.invoices, clientInfos]);

    // Initialize payment method when component mounts or dependencies change
    useEffect(() => {
        initializePaymentMethod();
    }, [initializePaymentMethod]);

    // Initialize business info when component mounts or dependencies change
    useEffect(() => {
        initializeBusinessInfo();
    }, [initializeBusinessInfo]);

    // Initialize selected client info when component mounts or dependencies change
    useEffect(() => {
        initializeSelectedClientInfo();
    }, [initializeSelectedClientInfo]);

    const [invoiceTasks, setInvoiceTasks] = useState([]);
    const [editableHours, setEditableHours] = useState({});

    /**
     * Handle client info selection from dropdown
     */
    const handleClientInfoSelection = (clientInfoId) => {
        const clientInfo = clientInfos.find(ci => ci.id === clientInfoId);
        setSelectedClientInfo(clientInfo || null);
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
     * Prepare invoice data
     */
    const prepareInvoiceData = useCallback(() => {
        // Get billable time entries (since last billing)
        const lastBilledAt = project.lastBilledAt || project.createdAt;

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
    }, [project.lastBilledAt, project.createdAt, timeEntries, tasks, editableHours]);

    /**
     * Save invoice (create new or update existing)
     */
    const handleSaveInvoice = (e) => {
        e.preventDefault();

        // Validate client information - must have selected client info
        if (!selectedClientInfo) {
            showError('Please select client information');
            return;
        }

        if (invoiceTasks.length === 0) {
            showError('No billable time entries found since last invoice');
            return;
        }

        const totalHours = invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.originalHours), 0);
        const totalAmount = totalHours * project.hourlyRate;

        const invoiceData = {
            id: editingInvoice ? editingInvoice.id : `INV-${project.id.slice(-8)}-${Date.now()}`,
            project: project,
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
            totalAmount: totalAmount,
            paymentMethodId: selectedPaymentMethod?.id || null,
            businessInfoId: selectedBusinessInfo?.id || null,
            clientInfoId: selectedClientInfo?.id || null,
            invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `INV-${project.id.slice(-8)}-${Date.now()}`,
            date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
            createdAt: editingInvoice ? editingInvoice.createdAt : Date.now(),
            htmlContent: createInvoiceHTML({
                id: editingInvoice ? editingInvoice.id : `INV-${project.id.slice(-8)}-${Date.now()}`,
                project: project,
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
                totalAmount: totalAmount,
                paymentMethod: selectedPaymentMethod,
                businessInfo: selectedBusinessInfo,
                invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `INV-${project.id.slice(-8)}-${Date.now()}`,
                date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
                createdAt: editingInvoice ? editingInvoice.createdAt : Date.now()
            })
        };

        // Store invoice in project
        const projectInvoices = project.invoices || [];
        let updatedInvoices;
        
        if (editingInvoice) {
            // Update existing invoice
            updatedInvoices = projectInvoices.map(inv => 
                inv.id === editingInvoice.id ? invoiceData : inv
            );
        } else {
            // Add new invoice
            updatedInvoices = [...projectInvoices, invoiceData];
        }

        const updatedProjects = projects.map(p => 
            p.id === project.id 
                ? { 
                    ...p, 
                    lastBilledAt: editingInvoice ? p.lastBilledAt : Date.now(),
                    invoices: updatedInvoices
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
        }
        setShowInvoiceForm(true);
    }, [editingInvoice, prepareInvoiceData, showInvoiceForm, showError]);

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

    // Calculate unbilled time
    const lastBilledAt = project.lastBilledAt || project.createdAt;

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

    const unbilledAmount = unbilledHours * project.hourlyRate;

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
                            {getCurrencySymbol(project.currency)}{unbilledAmount.toFixed(2)}
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
                                                    <option value="" disabled>Select client information</option>
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
                                        
                                        {/* Updated Totals */}
                                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                            <div className="flex justify-between text-sm text-blue-800">
                                                <span>Total Hours:</span>
                                                <span className="font-medium">
                                                    {invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0).toFixed(2)}h
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm text-blue-800">
                                                <span>Total Amount:</span>
                                                <span className="font-medium">
                                                    {getCurrencySymbol(project.currency)}{(invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0) * project.hourlyRate).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Business Info Selection */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                Business
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
                                                        const businessInfo = businessInfos.find(bi => bi.id === e.target.value);
                                                        setSelectedBusinessInfo(businessInfo || null);
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
                                                        const paymentMethod = paymentMethods.find(pm => pm.id === e.target.value);
                                                        setSelectedPaymentMethod(paymentMethod || null);
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
