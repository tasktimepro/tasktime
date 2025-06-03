import { useState, useEffect } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { generatePDF, createInvoiceHTML } from '../utils/pdfUtils';
import { millisecondsToHours } from '../utils/dateUtils';

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
    onInvoiceSaved 
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);

    /**
     * Initialize client info based on previous invoices or editing invoice
     */
    const initializeClientInfo = () => {
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
    };

    const [clientInfo, setClientInfo] = useState(initializeClientInfo);

    // Update client info when editing invoice changes
    useEffect(() => {
        setClientInfo(initializeClientInfo());
    }, [editingInvoice]);

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
        setEditableHours(prev => ({
            ...prev,
            [taskId]: parseFloat(newHours) || 0
        }));
    };

    /**
     * Prepare invoice data
     */
    const prepareInvoiceData = () => {
        // Get billable time entries (since last billing)
        const lastBilledAt = project.lastBilledAt || project.createdAt;

        const billableEntries = timeEntries.filter(entry => 
            entry.start > lastBilledAt
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
            const editedHours = editableHours[taskId] !== undefined ? editableHours[taskId] : calculatedHours;

            return {
                id: taskId,
                title: task ? task.title : 'Unknown Task',
                originalHours: calculatedHours,
                hours: editedHours,
                isEdited: editedHours !== calculatedHours
            };
        }).filter(task => task.originalHours > 0);

        return tasksData;
    };

    /**
     * Save invoice (create new or update existing)
     */
    const handleSaveInvoice = (e) => {
        e.preventDefault();

        if (!clientInfo.name.trim()) {
            alert('Please enter client name');
            return;
        }

        if (invoiceTasks.length === 0) {
            alert('No billable time entries found since last invoice');
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
        
        const action = editingInvoice ? 'updated' : 'saved';
        alert(`Invoice ${action} successfully! You can view, edit, or download it from the Invoices tab.`);
    };

    /**
     * Open invoice form with prepared data or for editing
     */
    const openInvoiceForm = () => {
        if (editingInvoice) {
            // Open form with existing invoice data
            setInvoiceTasks(editingInvoice.tasks || []);
            const initialHours = {};
            (editingInvoice.tasks || []).forEach(task => {
                initialHours[task.id] = task.hours;
            });
            setEditableHours(initialHours);
        } else {
            // Open form with new invoice data
            const tasksData = prepareInvoiceData();
            if (!tasksData) {
                alert('No billable time entries found since last invoice');
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
    };

    // Auto-open form when editing an invoice
    useEffect(() => {
        if (editingInvoice) {
            openInvoiceForm();
        }
    }, [editingInvoice]);

    /**
     * Handle canceling the form
     */
    const handleCancel = () => {
        setShowInvoiceForm(false);
        setInvoiceTasks([]);
        setEditableHours({});
        if (onInvoiceSaved) {
            onInvoiceSaved(); // This will clear the editing state
        }
    };

    // Calculate unbilled time
    const lastBilledAt = project.lastBilledAt || project.createdAt;

    const unbilledEntries = timeEntries.filter(entry => 
        entry.start > lastBilledAt
    );

    const unbilledTime = unbilledEntries.reduce((total, entry) => {
        return total + (entry.end - entry.start);
    }, 0);

    const unbilledHours = millisecondsToHours(unbilledTime);

    const unbilledAmount = unbilledHours * project.hourlyRate;

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-3">
                <button
                    onClick={openInvoiceForm}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Generate Invoice
                    {unbilledHours > 0 && (
                        <span className="ml-2 px-2 py-1 bg-green-500 text-xs rounded-full">
                            ${unbilledAmount.toFixed(2)}
                        </span>
                    )}
                </button>
            </div>

            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white my-8">
                        <div className="mt-3">
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
                                            Tasks & Hours (Click to modify)
                                        </h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {invoiceTasks.map((task) => (
                                                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Original: {task.originalHours.toFixed(2)}h
                                                            {task.isEdited && (
                                                                <span className="text-blue-600 ml-2">(Modified)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="number"
                                                            step="0.25"
                                                            min="0"
                                                            value={editableHours[task.id] || task.hours}
                                                            onChange={(e) => handleHoursChange(task.id, e.target.value)}
                                                            className="w-20 text-sm border-gray-300 rounded-md"
                                                        />
                                                        <span className="text-sm text-gray-500">hours</span>
                                                    </div>
                                                </div>
                                            ))}
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
                                                    ${(invoiceTasks.reduce((sum, task) => sum + (editableHours[task.id] || task.hours), 0) * project.hourlyRate).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSaveInvoice} className="space-y-4">
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
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
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
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
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
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
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
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
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
                                                        className="mt-1 flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
                                                        placeholder="State"
                                                    />
                                                    <input
                                                        type="text"
                                                        name="zip"
                                                        value={clientInfo.zip}
                                                        onChange={handleClientChange}
                                                        className="mt-1 w-24 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
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
                </div>
            )}
        </div>
    );
};

export default InvoiceGenerator;
