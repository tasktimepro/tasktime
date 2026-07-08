/**
 * Import/export must follow the sync contract source of truth:
 * ./sync/README.md
 */

import React, { useRef, useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon, FileBracesIcon } from '@/components/ui/icons';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useToast } from '../hooks/useToast.ts';
import { markMeaningfulActivity } from '../utils/usageMetrics.ts';
import { useYjs } from '../contexts/YjsContext.tsx';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { parseBackupImportJson } from '../utils/backupData.ts';

/**
 * ExportImport component for backing up and restoring application data
 * Provides JSON export/import functionality for all application data including:
 * - Projects, tasks, time entries, and invoices
 * - Payment methods, business info, clients, invoice templates, and email templates
 * - Expense categories, tax return periods, planner data, and user preferences
 *
 * Active timers are live stopwatch sessions, so they are intentionally excluded
 * from JSON backups. Users should stop timers first to save them as time entries.
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
    emailTemplates = [],
    onImport 
}) {
    const isMobileLayout = useIsMobileLayout();
    const { store, isDriveConnected } = useYjs();
    const { timers } = useTimers();
    const { expenses: allExpenses } = useExpenses({ includeArchived: true });
    const { showError } = useToast();
    const isTimerActive = timers.length > 0;
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showExportTimerWarning, setShowExportTimerWarning] = useState(false);
    const [selectedImportFileName, setSelectedImportFileName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const resetImportState = () => {
        setShowImportModal(false);
        setImportData('');
        setImportError('');
        setSelectedImportFileName('');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
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
    const runExport = async () => {
        setIsExporting(true);

        try {
            const exportData = await store.exportBackupData({
                backupType: 'manual',
                refreshFromCloud: true,
            });
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
            markMeaningfulActivity();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Unable to export backup data.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExport = () => {
        if (isTimerActive) {
            setShowExportTimerWarning(true);
            return;
        }

        void runExport();
    };

    const handleConfirmExportWithActiveTimer = () => {
        setShowExportTimerWarning(false);
        void runExport();
    };

    /**
     * Parse and validate import data
     */
    const handleImport = async () => {
        setImportError('');
        
        try {
            const { version: _version, exportDate: _exportDate, backupType: _backupType, ...backupImportData } = parseBackupImportJson(importData);

            setIsImporting(true);
            await onImport(backupImportData);
            resetImportState();
            
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Import failed.');
        } finally {
            setIsImporting(false);
        }
    };

    /**
     * Handle file upload for import
     */
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setSelectedImportFileName(file.name);

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
                onClick={resetImportState}
                disabled={isImporting}
            >
                Cancel
            </Button>
            
            <Button
                onClick={handleImport}
                disabled={!importData.trim()}
                loading={isImporting}
                loadingText="Importing..."
            >
                Import Data
            </Button>
        </div>
    );

    return (
        <Card>
            <CardContent className={cn(isMobileLayout ? 'p-3' : 'pt-6')}>
                <div className="space-y-4">
                    {/* Export Section */}
                    <div className={cn('flex items-center justify-between rounded-lg bg-muted', isMobileLayout ? 'p-3' : 'p-4')}>
                    <div>
                        <h4 className="font-medium text-foreground">Export Data</h4>
                        <p className="text-sm text-muted-foreground">Download all your data including projects, tasks, invoices, settings, and more as JSON</p>
                    </div>
                    
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        leadingIcon={ArrowUpTrayIcon}
                        loading={isExporting}
                        loadingText="Exporting..."
                    >
                        Export
                    </Button>
                </div>

                {/* Import Section */}
                <div className={cn('flex items-center justify-between rounded-lg bg-muted', isMobileLayout ? 'p-3' : 'p-4')}>
                    <div>
                        <h4 className="font-medium text-foreground">Import Data</h4>
                        <p className="text-sm text-muted-foreground">Restore all data including projects, tasks, invoices, settings, and more from JSON backup</p>
                    </div>
                    
                    <Button
                        variant="outline"
                        onClick={() => setShowImportModal(true)}
                        leadingIcon={ArrowDownTrayIcon}
                    >
                        Import
                    </Button>
                </div>

                {/* Data Summary */}
                {(projects.length > 0 || paymentMethods.length > 0 || businessInfos.length > 0 || clients.length > 0 || invoiceTemplates.length > 0 || emailTemplates.length > 0 || allExpenses.length > 0) && (
                    <div className={cn('rounded-lg bg-muted', isMobileLayout ? 'p-3' : 'p-4')}>
                        <h4 className="font-medium text-foreground mb-2">Current Data</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>Clients: <span className="font-medium">{clients.length}</span></p>
                            <p>Projects: <span className="font-medium">{projects.length}</span></p>
                            <p>Invoices: <span className="font-medium">{invoices.length}</span></p>
                            <p>Expenses: <span className="font-medium">{allExpenses.length}</span></p>
                            <p>Tasks: <span className="font-medium">{tasks.length}</span></p>
                            <p>Time Entries: <span className="font-medium">{timeEntries.length}</span></p>
                            <p>Businesses: <span className="font-medium">{businessInfos.length}</span></p>
                            <p>Payment Methods: <span className="font-medium">{paymentMethods.length}</span></p>
                            <p>Invoice Templates: <span className="font-medium">{invoiceTemplates.length}</span></p>
                            <p>Email Templates: <span className="font-medium">{emailTemplates.length}</span></p>
                            <p>Total Time: <span className="font-medium">{calculateTotalTimeAcrossAllProjects()}</span></p>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Modal */}
            <Modal 
                isOpen={showImportModal}
                onClose={isImporting ? () => {} : resetImportState}
                title="Import Data"
                size="2xl"
                footer={importModalFooter}
            >
                <div className="space-y-4">
                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Upload JSON File</Label>
                        <input
                            ref={fileInputRef}
                            id="file-upload"
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="sr-only"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="outline"
                                leadingIcon={FileBracesIcon}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                            >
                                Choose File
                            </Button>
                            <span className="max-w-full truncate text-sm text-muted-foreground">
                                {selectedImportFileName || 'No file selected'}
                            </span>
                        </div>
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
                            disabled={isImporting}
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
                        <Notice
                            variant="warning"
                            icon={ExclamationTriangleIcon}
                            title="Active Timer Detected!"
                        >
                            <p>
                                You have an active timer running. Importing data will <strong>discard</strong> any unsaved timer progress. Please stop your timer first to save the time entry, or proceed knowing the current timer session will be lost.
                            </p>
                        </Notice>
                    )}

                    {/* Warning */}
                    <Notice
                        variant="warning"
                        icon={ExclamationTriangleIcon}
                        title="Warning"
                        description="Importing will replace all current data including projects, tasks, invoices, payment methods, business info, clients, templates, and preferences. Make sure to export your current data first if you want to keep it."
                    />

                    {isDriveConnected && (
                        <Notice
                            variant="warning"
                            icon={ExclamationTriangleIcon}
                            title="Google Drive is connected"
                            description="Import replaces this device's local data only. It does not replace existing Google Drive data. To make this import the cloud source of truth, first use Cloud Sync > Wipe Drive & disconnect, then import, then reconnect."
                        />
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showExportTimerWarning}
                onClose={() => {
                    if (!isExporting) {
                        setShowExportTimerWarning(false);
                    }
                }}
                title="Active Timer Not Included"
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setShowExportTimerWarning(false)}
                            disabled={isExporting}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={handleConfirmExportWithActiveTimer}
                            loading={isExporting}
                            loadingText="Exporting..."
                        >
                            Export Anyway
                        </Button>
                    </div>
                )}
            >
                <Notice
                    variant="warning"
                    icon={ExclamationTriangleIcon}
                    title="Stop Timer First To Save It"
                >
                    <p>
                        Active timers are not included in JSON backups. Stop your timer first to save it as a time entry, or export anyway knowing the current timer session will not be saved.
                    </p>
                </Notice>
            </Modal>
            </CardContent>
        </Card>
    );
}

export default ExportImport;
