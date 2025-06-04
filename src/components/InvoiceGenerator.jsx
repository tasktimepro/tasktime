import { useState, useEffect, useCallback } from 'react';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { createInvoiceHTML } from '../utils/pdfUtils';
import { millisecondsToHours, formatDurationWithSeconds, hoursToMinutes } from '../utils/dateUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { useToast } from '../hooks/useToast';
import { generateId } from '../utils/idUtils';

/**
 * Modal component for creating a new payment method
 */
const CreatePaymentMethodModal = ({ onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: '',
        fullName: '',
        bank: '',
        iban: '',
        swift: '',
        bankAddress: '',
        paypal: '',
        custom: []
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            return;
        }

        const newPaymentMethod = {
            id: generateId(),
            title: formData.title.trim(),
            fullName: formData.fullName.trim(),
            bank: formData.bank.trim(),
            iban: formData.iban.trim(),
            swift: formData.swift.trim(),
            bankAddress: formData.bankAddress.trim(),
            paypal: formData.paypal.trim(),
            custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
            createdAt: Date.now()
        };

        onSave(newPaymentMethod);
    };

    const addCustomField = () => {
        setFormData(prev => ({
            ...prev,
            custom: [...prev.custom, { label: '', value: '' }]
        }));
    };

    const removeCustomField = (index) => {
        setFormData(prev => ({
            ...prev,
            custom: prev.custom.filter((_, i) => i !== index)
        }));
    };

    const handleCustomFieldChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            custom: prev.custom.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
            <div className="relative mx-auto p-5 border max-w-md shadow-lg rounded-md bg-white my-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Create Payment Method
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Title *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            placeholder="e.g., Business Bank Account"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Account Holder Name
                        </label>
                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Bank Name
                        </label>
                        <input
                            type="text"
                            name="bank"
                            value={formData.bank}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            IBAN
                        </label>
                        <input
                            type="text"
                            name="iban"
                            value={formData.iban}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            PayPal Email
                        </label>
                        <input
                            type="email"
                            name="paypal"
                            value={formData.paypal}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        />
                    </div>

                    {formData.custom.map((field, index) => (
                        <div key={index} className="flex space-x-2">
                            <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                                placeholder="Field name"
                                className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            />
                            <input
                                type="text"
                                value={field.value}
                                onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                placeholder="Value"
                                className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            />
                            <button
                                type="button"
                                onClick={() => removeCustomField(index)}
                                className="px-2 py-1 text-red-600 hover:text-red-800"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addCustomField}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        + Add custom field
                    </button>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

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
    setPaymentMethods
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [showCreatePaymentMethod, setShowCreatePaymentMethod] = useState(false);
    const { showSuccess, showError } = useToast();

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
     * Initialize client info based on previous invoices or editing invoice
     */
    const initializeClientInfo = useCallback(() => {
        // If editing an invoice, use its client info
        if (editingInvoice) {
            return editingInvoice.clientInfo || editingInvoice.client || {
                name: '',
                email: '',
                address: '',
                city: '',
                state: '',
                zip: ''
            };
        }
        
        const previousInvoices = project.invoices || [];
        if (previousInvoices.length > 0) {
            // Get the most recent invoice's client info
            const latestInvoice = previousInvoices[previousInvoices.length - 1];
            return latestInvoice.clientInfo || latestInvoice.client || {
                name: '',
                email: '',
                address: '',
                city: '',
                state: '',
                zip: ''
            };
        }
        return {
            name: '',
            email: '',
            address: '',
            city: '',
            state: '',
            zip: ''
        };
    }, [editingInvoice, project.invoices]);

    const [clientInfo, setClientInfo] = useState(initializeClientInfo);

    // Update client info when editing invoice changes
    useEffect(() => {
        setClientInfo(initializeClientInfo);
    }, [initializeClientInfo]);

    // Initialize payment method when component mounts or dependencies change
    useEffect(() => {
        initializePaymentMethod();
    }, [initializePaymentMethod]);

    const [invoiceTasks, setInvoiceTasks] = useState([]);
    const [editableHours, setEditableHours] = useState({});

    /**
     * Handle client info input changes
     */
    const handleClientChange = (e) => {
        const { name, value } = e.target;

        setClientInfo(prev => ({
            ...prev,
            [name]: value
        }));
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

        if (!clientInfo.name.trim()) {
            showError('Please enter client name');
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
            clientInfo: clientInfo,
            tasks: invoiceTasks.map(task => ({
                ...task,
                hours: editableHours[task.id] || task.originalHours
            })),
            totalHours: totalHours,
            totalAmount: totalAmount,
            paymentMethodId: selectedPaymentMethod?.id || null,
            invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `INV-${project.id.slice(-8)}-${Date.now()}`,
            date: editingInvoice ? editingInvoice.date : new Date().toLocaleDateString(),
            createdAt: editingInvoice ? editingInvoice.createdAt : Date.now(),
            htmlContent: createInvoiceHTML({
                id: editingInvoice ? editingInvoice.id : `INV-${project.id.slice(-8)}-${Date.now()}`,
                project: project,
                client: clientInfo,
                tasks: invoiceTasks.map(task => ({
                    ...task,
                    hours: editableHours[task.id] || task.originalHours
                })),
                totalHours: totalHours,
                totalAmount: totalAmount,
                paymentMethod: selectedPaymentMethod,
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
        // Don't reset client info so it stays for next invoice
        
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
        // This prevents another modal from opening with "Save Invoice" state
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
                        
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {editingInvoice ? 'Edit Invoice' : 'Save Invoice'}
                        </h3>

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
                                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                                        <div className="flex justify-between text-sm">
                                            <span>Total Hours:</span>
                                            <span className="font-medium">
                                                {invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0).toFixed(2)}h
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Total Amount:</span>
                                            <span className="font-medium">
                                                {getCurrencySymbol(project.currency)}{(invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0) * project.hourlyRate).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveInvoice} className="space-y-4">
                                    {/* Payment Method Selection */}
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                                            Payment Method
                                        </h4>
                                        
                                        {paymentMethods.length === 0 ? (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                                <p className="text-sm text-yellow-800 mb-3">
                                                    No payment methods found. Create one to include payment details in your invoice.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCreatePaymentMethod(true)}
                                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200"
                                                >
                                                    <PlusIcon className="h-4 w-4 mr-2" />
                                                    Create Payment Method
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center space-x-3">
                                                    <select
                                                        value={selectedPaymentMethod?.id || ''}
                                                        onChange={(e) => {
                                                            const paymentMethod = paymentMethods.find(pm => pm.id === e.target.value);
                                                            setSelectedPaymentMethod(paymentMethod || null);
                                                        }}
                                                        className="flex-1 block border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-2"
                                                    >
                                                        <option value="">Select payment method (optional)</option>
                                                        {paymentMethods.map(method => (
                                                            <option key={method.id} value={method.id}>
                                                                {method.title}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCreatePaymentMethod(true)}
                                                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                                        title="Create new payment method"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                
                                                {selectedPaymentMethod && (
                                                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                                                        <p className="text-sm text-green-800">
                                                            <strong>{selectedPaymentMethod.title}</strong> will be included in the invoice payment details.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Client Information Form */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Client Name *
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={clientInfo.name}
                                                onChange={handleClientChange}
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                placeholder="Enter client name"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={clientInfo.email}
                                                onChange={handleClientChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                placeholder="client@example.com"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Address
                                            </label>
                                            <input
                                                type="text"
                                                name="address"
                                                value={clientInfo.address}
                                                onChange={handleClientChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                placeholder="Street address"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                City
                                            </label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={clientInfo.city}
                                                onChange={handleClientChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                State/ZIP
                                            </label>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="text"
                                                    name="state"
                                                    value={clientInfo.state}
                                                    onChange={handleClientChange}
                                                    className="mt-1 flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                    placeholder="State"
                                                />
                                                <input
                                                    type="text"
                                                    name="zip"
                                                    value={clientInfo.zip}
                                                    onChange={handleClientChange}
                                                    className="mt-1 w-24 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                    placeholder="ZIP"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <br />

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
                                            {editingInvoice ? 'Update Invoice' : 'Save Invoice'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Payment Method Modal */}
            {showCreatePaymentMethod && (
                <CreatePaymentMethodModal
                    onClose={() => setShowCreatePaymentMethod(false)}
                    onSave={(newPaymentMethod) => {
                        setPaymentMethods(prev => [...prev, newPaymentMethod]);
                        setSelectedPaymentMethod(newPaymentMethod);
                        setShowCreatePaymentMethod(false);
                        showSuccess('Payment method created successfully!');
                    }}
                />
            )}
        </div>
    );
};

export default InvoiceGenerator;
