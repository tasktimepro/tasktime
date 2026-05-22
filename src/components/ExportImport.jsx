import React, { useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon } from '@/components/ui/icons';
import { formatDuration, millisecondsToHours } from '../utils/dateUtils.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { useExpenses } from '../hooks/useExpenses.ts';
import { useToast } from '../hooks/useToast.ts';
import { markMeaningfulActivity } from '../utils/usageMetrics.ts';
import { useYjs } from '../contexts/YjsContext.tsx';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { BACKUP_VERSION } from '../utils/backupData.ts';

/**
 * ExportImport component for backing up and restoring application data
 * Provides JSON export/import functionality for all application data including:
 * - Projects, tasks, time entries, and invoices
 * - Payment methods, business info, clients, invoice templates, and email templates
 * - User preferences (currency, etc.)
 * 
 * Note: Timer state is intentionally excluded from export/import
 */
const SUPPORTED_VERSIONS = ['1.0', '1.1', BACKUP_VERSION];

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
    const { store } = useYjs();
    const { timers } = useTimers();
    const { expenses: allExpenses } = useExpenses({ includeArchived: true });
    const { showError } = useToast();
    const isTimerActive = timers.length > 0;
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importError, setImportError] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    
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
    const handleExport = async () => {
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

    /**
     * Parse and validate import data
     */
    const handleImport = () => {
        setImportError('');
        
        try {
            const parsedData = JSON.parse(importData);
            
            // Version check
            if (parsedData.version && !SUPPORTED_VERSIONS.includes(parsedData.version)) {
                throw new Error(`Unsupported export version "${parsedData.version}". Supported: ${SUPPORTED_VERSIONS.join(', ')}. You may need to update TaskTime.`);
            }

            // Validate data structure
            if (!parsedData.projects || !Array.isArray(parsedData.projects)) {
                throw new Error('Invalid data format: projects array not found');
            }

            // Deep validation of projects
            const projectIds = new Set();
            for (const project of parsedData.projects) {
                if (!project.id || typeof project.id !== 'string') {
                    throw new Error('Invalid project: missing or non-string id');
                }
                if (!project.title || typeof project.title !== 'string') {
                    throw new Error(`Invalid project "${project.id}": missing or non-string title`);
                }
                if (projectIds.has(project.id)) {
                    throw new Error(`Duplicate project id: ${project.id}`);
                }
                projectIds.add(project.id);
            }

            // Validate tasks if present
            if (parsedData.tasks && !Array.isArray(parsedData.tasks)) {
                throw new Error('Invalid data format: tasks must be an array');
            }
            if (parsedData.tasks) {
                const taskIds = new Set();
                for (const task of parsedData.tasks) {
                    if (!task.id || typeof task.id !== 'string') {
                        throw new Error('Invalid task: missing or non-string id');
                    }
                    if (!task.title || typeof task.title !== 'string') {
                        throw new Error(`Invalid task "${task.id}": missing or non-string title`);
                    }
                    if (taskIds.has(task.id)) {
                        throw new Error(`Duplicate task id: ${task.id}`);
                    }
                    taskIds.add(task.id);
                }

                // Validate task hierarchy: parentTaskId must reference an existing task
                for (const task of parsedData.tasks) {
                    if (task.parentTaskId && !taskIds.has(task.parentTaskId)) {
                        throw new Error(`Task "${task.id}" references non-existent parent task "${task.parentTaskId}"`);
                    }
                }

                // Validate task→project linkage
                for (const task of parsedData.tasks) {
                    if (task.projectId && !projectIds.has(task.projectId)) {
                        throw new Error(`Task "${task.id}" references non-existent project "${task.projectId}"`);
                    }
                }
            }

            // Validate timeEntries if present
            if (parsedData.timeEntries && !Array.isArray(parsedData.timeEntries)) {
                throw new Error('Invalid data format: timeEntries must be an array');
            }
            const taskIds = parsedData.tasks ? new Set(parsedData.tasks.map(t => t.id)) : new Set();
            if (parsedData.timeEntries) {
                for (const entry of parsedData.timeEntries) {
                    if (!entry.id || typeof entry.id !== 'string') {
                        throw new Error('Invalid time entry: missing or non-string id');
                    }
                    if (typeof entry.start !== 'number' || typeof entry.end !== 'number') {
                        throw new Error(`Invalid time entry "${entry.id}": start and end must be numbers`);
                    }
                    if (entry.start > entry.end) {
                        throw new Error(`Invalid time entry "${entry.id}": start time is after end time`);
                    }
                    if (entry.taskId && !taskIds.has(entry.taskId)) {
                        throw new Error(`Time entry "${entry.id}" references non-existent task "${entry.taskId}"`);
                    }
                }
            }

            // Validate invoices if present
            if (parsedData.invoices && !Array.isArray(parsedData.invoices)) {
                throw new Error('Invalid data format: invoices must be an array');
            }
            const invoiceIds = new Set((parsedData.invoices || []).map(i => i.id).filter(Boolean));

            // Validate project invoiceIds references
            for (const project of parsedData.projects) {
                if (project.invoiceIds && Array.isArray(project.invoiceIds)) {
                    for (const invId of project.invoiceIds) {
                        if (!invoiceIds.has(invId)) {
                            throw new Error(`Project "${project.id}" references non-existent invoice "${invId}"`);
                        }
                    }
                }
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

            // Validate emailTemplates if present
            if (parsedData.emailTemplates && !Array.isArray(parsedData.emailTemplates)) {
                throw new Error('Invalid data format: emailTemplates must be an array');
            }

            // Validate expenses if present
            if (parsedData.expenses && !Array.isArray(parsedData.expenses)) {
                throw new Error('Invalid data format: expenses must be an array');
            }

            // Validate expenseRecurrences if present
            if (parsedData.expenseRecurrences && !Array.isArray(parsedData.expenseRecurrences)) {
                throw new Error('Invalid data format: expenseRecurrences must be an array');
            }

            // Validate dailyGoals if present
            if (parsedData.dailyGoals && !Array.isArray(parsedData.dailyGoals)) {
                throw new Error('Invalid data format: dailyGoals must be an array');
            }

            // Validate plannerAttachments if present
            if (parsedData.plannerAttachments && !Array.isArray(parsedData.plannerAttachments)) {
                throw new Error('Invalid data format: plannerAttachments must be an array');
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
                emailTemplates: parsedData.emailTemplates || [],
                expenses: parsedData.expenses || [],
                expenseRecurrences: parsedData.expenseRecurrences || [],
                dailyGoals: parsedData.dailyGoals || [],
                plannerAttachments: parsedData.plannerAttachments || [],
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
                        disabled={isExporting}
                        leadingIcon={ArrowUpTrayIcon}
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
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
