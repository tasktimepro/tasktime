import React, { useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils';
import Modal from './Modal';

/**
 * ExportImport component for backing up and restoring application data
 * Provides JSON export/import functionality for all application data including:
 * - Projects, tasks, time entries, and invoices
 * - Payment methods, business info, client info, and invoice templates  
 * - User preferences (currency, etc.)
 * 
 * Note: Timer state is intentionally excluded from export/import
 */
function ExportImport({ 
    projects, 
    tasks = [], 
    timeEntries = [], 
    invoices = [], 
    paymentMethods = [],
    businessInfos = [],
    clientInfos = [],
    invoiceTemplates = [],
    preferences = {},
    onImport 
}) {
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState('');
    
    /**
     * Calculate total time across all projects
     * @returns {string} Formatted total time
     */
    const calculateTotalTimeAcrossAllProjects = () => {
        const totalMilliseconds = timeEntries.reduce((total, entry) => {
            // Check if entry has valid start and end times
            if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
                !isNaN(entry.start) && !isNaN(entry.end)) {
                return total + (entry.end - entry.start);
            }
            return total;
        }, 0);
        
        // Convert to decimal hours
        const totalHours = millisecondsToHours(totalMilliseconds);
        const roundedHours = Math.round(totalHours * 100) / 100; // Round to 2 decimal places
        
        // Format the time as hours and minutes, plus show decimal hours
        return `${formatDuration(totalMilliseconds)} (${roundedHours.toFixed(2)} hours)`;
    };

    /**
     * Export all project data as JSON file
     */
    const handleExport = () => {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            projects: projects,
            tasks: tasks,
            timeEntries: timeEntries,
            invoices: invoices,
            paymentMethods: paymentMethods,
            businessInfos: businessInfos,
            clientInfos: clientInfos,
            invoiceTemplates: invoiceTemplates,
            preferences: preferences
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasktime-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    /**
     * Parse and validate import data
     */
    const handleImport = () => {
        setImportError('');
        
        try {
            const parsedData = JSON.parse(importData);
            
            // Validate data structure
            if (!parsedData.projects || !Array.isArray(parsedData.projects)) {
                throw new Error('Invalid data format: projects array not found');
            }

            // Basic validation of project structure
            for (const project of parsedData.projects) {
                if (!project.id || !project.title) {
                    throw new Error('Invalid project structure: missing id or title');
                }
            }

            // Validate tasks if present
            if (parsedData.tasks && !Array.isArray(parsedData.tasks)) {
                throw new Error('Invalid data format: tasks must be an array');
            }

            // Validate timeEntries if present
            if (parsedData.timeEntries && !Array.isArray(parsedData.timeEntries)) {
                throw new Error('Invalid data format: timeEntries must be an array');
            }

            // Validate invoices if present
            if (parsedData.invoices && !Array.isArray(parsedData.invoices)) {
                throw new Error('Invalid data format: invoices must be an array');
            }

            // Validate paymentMethods if present
            if (parsedData.paymentMethods && !Array.isArray(parsedData.paymentMethods)) {
                throw new Error('Invalid data format: paymentMethods must be an array');
            }

            // Validate businessInfos if present
            if (parsedData.businessInfos && !Array.isArray(parsedData.businessInfos)) {
                throw new Error('Invalid data format: businessInfos must be an array');
            }

            // Validate clientInfos if present
            if (parsedData.clientInfos && !Array.isArray(parsedData.clientInfos)) {
                throw new Error('Invalid data format: clientInfos must be an array');
            }

            // Validate invoiceTemplates if present
            if (parsedData.invoiceTemplates && !Array.isArray(parsedData.invoiceTemplates)) {
                throw new Error('Invalid data format: invoiceTemplates must be an array');
            }

            // Validate preferences if present
            if (parsedData.preferences && typeof parsedData.preferences !== 'object') {
                throw new Error('Invalid data format: preferences must be an object');
            }

            // Call the import handler with all data
            onImport({
                projects: parsedData.projects,
                tasks: parsedData.tasks || [],
                timeEntries: parsedData.timeEntries || [],
                invoices: parsedData.invoices || [],
                paymentMethods: parsedData.paymentMethods || [],
                businessInfos: parsedData.businessInfos || [],
                clientInfos: parsedData.clientInfos || [],
                invoiceTemplates: parsedData.invoiceTemplates || [],
                preferences: parsedData.preferences || {}
            });
            setShowImportModal(false);
            setImportData('');
            
        } catch (error) {
            setImportError(error.message);
        }
    };

    /**
     * Handle file upload for import
     */
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setImportData(e.target.result);
        };
        reader.readAsText(file);
    };

    // Import modal footer buttons
    const importModalFooter = (
        <div className="flex justify-end gap-3">
            <button
                onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
                Cancel
            </button>
            
            <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
                Import Data
            </button>
        </div>
    );

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            
            <div className="space-y-4">
                {/* Export Section */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <h4 className="font-medium text-gray-900">Export Data</h4>
                        <p className="text-sm text-gray-600">Download all your data including projects, tasks, invoices, settings, and more as JSON</p>
                    </div>
                    
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 border border-yellow-600 text-yellow-600 bg-transparent rounded-lg hover:bg-yellow-50 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                    </button>
                </div>

                {/* Import Section */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <h4 className="font-medium text-gray-900">Import Data</h4>
                        <p className="text-sm text-gray-600">Restore all data including projects, tasks, invoices, settings, and more from JSON backup</p>
                    </div>
                    
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 bg-transparent rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        Import
                    </button>
                </div>

                {/* Data Summary */}
                {(projects.length > 0 || paymentMethods.length > 0 || businessInfos.length > 0 || clientInfos.length > 0 || invoiceTemplates.length > 0) && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-700 mb-2">Current Data</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                            <p>Projects: <span className="font-medium">{projects.length}</span></p>
                            <p>Tasks: <span className="font-medium">{tasks.length}</span></p>
                            <p>Time Entries: <span className="font-medium">{timeEntries.length}</span></p>
                            <p>Invoices: <span className="font-medium">{invoices.length}</span></p>
                            <p>Payment Methods: <span className="font-medium">{paymentMethods.length}</span></p>
                            <p>Business Info: <span className="font-medium">{businessInfos.length}</span></p>
                            <p>Client Info: <span className="font-medium">{clientInfos.length}</span></p>
                            <p>Invoice Templates: <span className="font-medium">{invoiceTemplates.length}</span></p>
                            <p>Total Time: <span className="font-medium">{calculateTotalTimeAcrossAllProjects()}</span></p>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Modal */}
            <Modal 
                isOpen={showImportModal}
                onClose={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportError('');
                }}
                title="Import Data"
                size="2xl"
                footer={importModalFooter}
            >
                <div className="space-y-4">
                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload JSON File
                        </label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Manual Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Or paste JSON data
                        </label>
                        <textarea
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder="Paste JSON data here..."
                            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                    </div>

                    {/* Error Display */}
                    {importError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-700">{importError}</p>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-700">
                            <p className="font-medium">Warning:</p>
                            <p>Importing will replace all current data including projects, tasks, invoices, payment methods, business info, client info, templates, and preferences. Make sure to export your current data first if you want to keep it.</p>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default ExportImport;
