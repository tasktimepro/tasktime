import { useState } from 'react';
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
    timeEntries 
}) => {
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showInvoicePreview, setShowInvoicePreview] = useState(false);
    const [showPreviousInvoices, setShowPreviousInvoices] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const [clientInfo, setClientInfo] = useState({
        name: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip: ''
    });

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
     * Generate invoice PDF and store in project
     */
    const handleGenerateInvoice = (e) => {
        e.preventDefault();

        if (!clientInfo.name.trim()) {
            alert('Please enter client name');
            return;
        }

        if (invoiceTasks.length === 0) {
            alert('No billable time entries found since last invoice');
            return;
        }

        const totalHours = invoiceTasks.reduce((sum, task) => sum + task.hours, 0);
        const totalAmount = totalHours * project.hourlyRate;

        const invoiceData = {
            id: `INV-${project.id.slice(-8)}-${Date.now()}`,
            project: project,
            client: clientInfo,
            tasks: invoiceTasks,
            totalHours: totalHours,
            totalAmount: totalAmount,
            invoiceNumber: `INV-${project.id.slice(-8)}-${Date.now()}`,
            date: new Date().toLocaleDateString(),
            createdAt: Date.now()
        };

        // Generate PDF
        const htmlContent = createInvoiceHTML(invoiceData);
        const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_invoice_${new Date().toISOString().slice(0, 10)}.pdf`;

        generatePDF(htmlContent, filename);

        // Store invoice in project
        const projectInvoices = project.invoices || [];
        const updatedProjects = projects.map(p => 
            p.id === project.id 
                ? { 
                    ...p, 
                    lastBilledAt: Date.now(),
                    invoices: [...projectInvoices, invoiceData]
                }
                : p
        );

        setProjects(updatedProjects);

        // Reset form
        setShowInvoiceForm(false);
        setInvoiceTasks([]);
        setEditableHours({});
        setClientInfo({
            name: '',
            email: '',
            address: '',
            city: '',
            state: '',
            zip: ''
        });

        alert('Invoice generated and saved successfully!');
    };

    /**
     * Open invoice form with prepared data
     */
    const openInvoiceForm = () => {
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
        setShowInvoiceForm(true);
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

                {/* Previous Invoices Toggle */}
                {project.invoices && project.invoices.length > 0 && (
                    <button
                        onClick={() => setShowPreviousInvoices(!showPreviousInvoices)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Previous Invoices ({project.invoices.length})
                    </button>
                )}
            </div>

            {/* Previous Invoices Section */}
            {showPreviousInvoices && project.invoices && project.invoices.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Previous Invoices</h4>
                    <div className="space-y-2">
                        {project.invoices.map((invoice) => (
                            <div key={invoice.id} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                                <div>
                                    <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                                    <p className="text-xs text-gray-500">
                                        {invoice.date} • ${invoice.totalAmount.toFixed(2)} • {invoice.totalHours.toFixed(2)}h
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedInvoice(invoice)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    Preview
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white my-8">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Generate Invoice
                            </h3>

                            {invoiceTasks.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">No billable time entries found.</p>
                                    <button
                                        onClick={() => setShowInvoiceForm(false)}
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

                                    <form onSubmit={handleGenerateInvoice} className="space-y-4">
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
                                                onClick={() => setShowInvoiceForm(false)}
                                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                type="submit"
                                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                            >
                                                Generate PDF
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Preview Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white my-8">
                        <div className="mt-3">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Invoice Preview
                                </h3>
                                <button
                                    onClick={() => setSelectedInvoice(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="mb-4">
                                    <h4 className="font-medium">{selectedInvoice.invoiceNumber}</h4>
                                    <p className="text-sm text-gray-600">Date: {selectedInvoice.date}</p>
                                </div>

                                <div className="mb-4">
                                    <h5 className="text-sm font-medium text-gray-900">Client:</h5>
                                    <p className="text-sm text-gray-600">{selectedInvoice.client.name}</p>
                                    {selectedInvoice.client.email && (
                                        <p className="text-sm text-gray-600">{selectedInvoice.client.email}</p>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <h5 className="text-sm font-medium text-gray-900">Tasks:</h5>
                                    <div className="space-y-1">
                                        {selectedInvoice.tasks.map((task, index) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span>{task.title}</span>
                                                <span>{task.hours.toFixed(2)}h</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t pt-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>Total: {selectedInvoice.totalHours.toFixed(2)} hours</span>
                                        <span>${selectedInvoice.totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceGenerator;
