import React, { useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * ExportImport component for backing up and restoring application data
 * Provides JSON export/import functionality for projects and tasks
 */
function ExportImport({ projects, tasks = [], onImport }) {
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState('');

    /**
     * Export all project data as JSON file
     */
    const handleExport = () => {
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            projects: projects,
            tasks: tasks
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

            // Call the import handler with both projects and tasks
            onImport({
                projects: parsedData.projects,
                tasks: parsedData.tasks || []
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

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup & Restore</h3>
            
            <div className="space-y-4">
                {/* Export Section */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <h4 className="font-medium text-gray-900">Export Data</h4>
                        <p className="text-sm text-gray-600">Download all your projects and tasks as JSON</p>
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
                        <p className="text-sm text-gray-600">Restore projects and tasks from JSON backup</p>
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
                {projects.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Current Data</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                            <p>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                            <p>{tasks.length} total tasks</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Data</h3>
                        
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
                                    <p>Importing will replace all current data. Make sure to export your current data first if you want to keep it.</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex justify-end gap-3 mt-6">
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default ExportImport;
