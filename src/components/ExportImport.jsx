import React, { useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils.ts';
import { useTimer } from '../hooks/useTimer.ts';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

/**
 * ExportImport component for backing up and restoring application data
 * Provides JSON export/import functionality for all application data including:
 * - Projects, tasks, time entries, and invoices
 * - Payment methods, business info, clients, and invoice templates  
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
    clients = [],
    invoiceTemplates = [],
    preferences = {},
    onImport 
}) {
    const { isActive: isTimerActive } = useTimer();
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
            clients: clients,
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

            // Validate clients if present
            if (parsedData.clients && !Array.isArray(parsedData.clients)) {
                throw new Error('Invalid data format: clients must be an array');
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
                clients: parsedData.clients || [],
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
            <Button
                variant="secondary"
                onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportError('');
                }}
            >
                Cancel
            </Button>
            
            <Button
                onClick={handleImport}
                disabled={!importData.trim()}
            >
                Import Data
            </Button>
        </div>
    );

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {/* Export Section */}
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                        <h4 className="font-medium text-foreground">Export Data</h4>
                        <p className="text-sm text-muted-foreground">Download all your data including projects, tasks, invoices, settings, and more as JSON</p>
                    </div>
                    
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        leadingIcon={ArrowDownTrayIcon}
                    >
                        Export
                    </Button>
                </div>

                {/* Import Section */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                        <h4 className="font-medium text-foreground">Import Data</h4>
                        <p className="text-sm text-muted-foreground">Restore all data including projects, tasks, invoices, settings, and more from JSON backup</p>
                    </div>
                    
                    <Button
                        variant="outline"
                        onClick={() => setShowImportModal(true)}
                        leadingIcon={ArrowUpTrayIcon}
                    >
                        Import
                    </Button>
                </div>

                {/* Data Summary */}
                {(projects.length > 0 || paymentMethods.length > 0 || businessInfos.length > 0 || clients.length > 0 || invoiceTemplates.length > 0) && (
                    <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Current Data</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>Clients: <span className="font-medium">{clients.length}</span></p>
                            <p>Projects: <span className="font-medium">{projects.length}</span></p>
                            <p>Invoices: <span className="font-medium">{invoices.length}</span></p>
                            <p>Tasks: <span className="font-medium">{tasks.length}</span></p>
                            <p>Time Entries: <span className="font-medium">{timeEntries.length}</span></p>
                            <p>Businesses: <span className="font-medium">{businessInfos.length}</span></p>
                            <p>Payment Methods: <span className="font-medium">{paymentMethods.length}</span></p>
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
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Upload JSON File</Label>
                        <input
                            id="file-upload"
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    {/* Manual Input */}
                    <div className="space-y-2">
                        <Label htmlFor="json-data">Or paste JSON data</Label>
                        <Textarea
                            id="json-data"
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder="Paste JSON data here..."
                            className="h-40 font-mono text-sm"
                        />
                    </div>

                    {/* Error Display */}
                    {importError && (
                        <div className="flex items-center gap-2 p-3 bg-muted border border-border rounded-lg">
                            <ExclamationTriangleIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm text-foreground">{importError}</p>
                        </div>
                    )}

                    {/* Active Timer Warning */}
                    {isTimerActive && (
                        <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg">
                            <ExclamationTriangleIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-foreground">
                                <p className="font-medium">Active Timer Detected!</p>
                                <p className="text-muted-foreground">You have an active timer running. Importing data will <strong>stop and discard</strong> any unsaved timer progress. Please stop your timer first to save the time entry, or proceed knowing the current timer session will be lost.</p>
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg">
                        <ExclamationTriangleIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-foreground">
                            <p className="font-medium">Warning:</p>
                            <p className="text-muted-foreground">Importing will replace all current data including projects, tasks, invoices, payment methods, business info, clients, templates, and preferences. Make sure to export your current data first if you want to keep it.</p>
                        </div>
                    </div>
                </div>
            </Modal>
            </CardContent>
        </Card>
    );
}

export default ExportImport;
