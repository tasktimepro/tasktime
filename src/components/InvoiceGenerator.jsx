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

    const [clientInfo, setClientInfo] = useState({
        name: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip: ''
    });

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
     * Generate invoice PDF
     */
    const handleGenerateInvoice = (e) => {
        e.preventDefault();

        if (!clientInfo.name.trim()) {
            alert('Please enter client name');
            return;
        }

        // Get billable time entries (since last billing)
        const lastBilledAt = project.lastBilledAt || project.createdAt;

        const billableEntries = timeEntries.filter(entry => 
            entry.start > lastBilledAt
        );

        if (billableEntries.length === 0) {
            alert('No billable time entries found since last invoice');
            return;
        }

        // Group entries by task
        const taskTimeMap = {};

        billableEntries.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        // Create invoice data
        const invoiceTasks = Object.keys(taskTimeMap).map(taskId => {
            const task = tasks.find(t => t.id === taskId);

            const totalTime = taskTimeMap[taskId];

            const hours = millisecondsToHours(totalTime);

            return {
                title: task ? task.title : 'Unknown Task',
                hours: hours
            };
        }).filter(task => task.hours > 0);

        const totalHours = invoiceTasks.reduce((sum, task) => sum + task.hours, 0);

        const totalAmount = totalHours * project.hourlyRate;

        const invoiceData = {
            project: project,
            client: clientInfo,
            tasks: invoiceTasks,
            totalHours: totalHours,
            totalAmount: totalAmount,
            invoiceNumber: `INV-${project.id.slice(-8)}-${Date.now()}`,
            date: new Date().toLocaleDateString()
        };

        // Generate PDF
        const htmlContent = createInvoiceHTML(invoiceData);

        const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_invoice_${new Date().toISOString().slice(0, 10)}.pdf`;

        generatePDF(htmlContent, filename);

        // Update project's last billed timestamp
        const updatedProjects = projects.map(p => 
            p.id === project.id 
                ? { ...p, lastBilledAt: Date.now() }
                : p
        );

        setProjects(updatedProjects);

        // Reset form
        setShowInvoiceForm(false);

        setClientInfo({
            name: '',
            email: '',
            address: '',
            city: '',
            state: '',
            zip: ''
        });

        alert('Invoice generated successfully!');
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
        <div>
            <button
                onClick={() => setShowInvoiceForm(true)}
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

            {/* Invoice Generation Modal */}
            {showInvoiceForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Generate Invoice
                            </h3>

                            {unbilledHours === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">No unbilled time entries found.</p>

                                    <button
                                        onClick={() => setShowInvoiceForm(false)}
                                        className="mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                                        <p className="text-sm text-gray-600">
                                            Unbilled Hours: <span className="font-medium">{unbilledHours.toFixed(2)}</span>
                                        </p>

                                        <p className="text-sm text-gray-600">
                                            Total Amount: <span className="font-medium">${unbilledAmount.toFixed(2)}</span>
                                        </p>
                                    </div>

                                    <form onSubmit={handleGenerateInvoice} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Client Name *
                                            </label>

                                            <input
                                                type="text"
                                                name="name"
                                                value={clientInfo.name}
                                                onChange={handleClientChange}
                                                required
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                placeholder="Enter client name"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Email
                                            </label>

                                            <input
                                                type="email"
                                                name="email"
                                                value={clientInfo.email}
                                                onChange={handleClientChange}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                placeholder="client@example.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Address
                                            </label>

                                            <input
                                                type="text"
                                                name="address"
                                                value={clientInfo.address}
                                                onChange={handleClientChange}
                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                placeholder="Street address"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    City
                                                </label>

                                                <input
                                                    type="text"
                                                    name="city"
                                                    value={clientInfo.city}
                                                    onChange={handleClientChange}
                                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    State
                                                </label>

                                                <input
                                                    type="text"
                                                    name="state"
                                                    value={clientInfo.state}
                                                    onChange={handleClientChange}
                                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    ZIP
                                                </label>

                                                <input
                                                    type="text"
                                                    name="zip"
                                                    value={clientInfo.zip}
                                                    onChange={handleClientChange}
                                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>
                                        </div>

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
        </div>
    );
};

export default InvoiceGenerator;
