import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { objectToYMap, readEntity, updateEntityFields } from '@/stores/yjs/entityUtils';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    addManualTimeEntryCommand,
    archiveClientCommand,
    archiveBusinessBrandAssetCommand,
    archiveExpenseCategoryCommand,
    attachPlannerItemCommand,
    archiveProjectCommand,
    archiveTaskCommand,
    cascadeDeleteClientCommand,
    cascadeDeleteProjectCommand,
    cascadeDeleteTaskCommand,
    clearTimerCommand,
    completeTaskCommand,
    createClientCommand,
    createBusinessInfoCommand,
    createBusinessBrandAssetCommand,
    deleteBusinessInfoCommand,
    deleteBusinessBrandAssetCommand,
    deleteTimeEntryCommand,
    deleteAllAccountDataCommand,
    createEmailTemplateCommand,
    createExpenseCategoryCommand,
    createExpenseCommand,
    createExpenseRecurrenceCommand,
    deleteClientCommand,
    deleteExpenseCommand,
    deleteExpenseRecurrenceCommand,
    deleteExpenseCategoryCommand,
    deleteEmailTemplateCommand,
    createInvoiceDraftFromUnbilledWorkCommand,
    createDriveBackupCommand,
    deleteInvoiceTemplateCommand,
    deletePaymentMethodCommand,
    deleteProjectCommand,
    deleteTaskCommand,
    createInvoiceTemplateCommand,
    createPaymentMethodCommand,
    createProjectCommand,
    createTaxReturnPeriodCommand,
    createTaskCommand,
    executeAgentCommand,
    exportAccountantPackCommand,
    exportBackupJsonCommand,
    exportInvoicePdfCommand,
    exportProjectQuotePdfCommand,
    exportReportCsvCommand,
    exportReportPdfCommand,
    finalizeInvoiceCommand,
    findUnbilledTimeCommand,
    focusRunningTimerCommand,
    getClientOverviewCommand,
    getDashboardSummaryCommand,
    getProjectNotesCommand,
    getProjectOverviewCommand,
    getReportSummaryCommand,
    getPreferencesCommand,
    getSyncStatusCommand,
    listDriveBackupsCommand,
    listDailyGoalsCommand,
    listInvoicesCommand,
    listPlannerAttachmentsCommand,
    listRecentEntriesCommand,
    listTaxReturnPeriodsCommand,
    listClientsCommand,
    listBusinessBrandAssetsCommand,
    listBusinessInfosCommand,
    listEmailTemplatesCommand,
    listExpenseCategoriesCommand,
    listExpenseRecurrencesCommand,
    listInvoiceTemplatesCommand,
    listPaymentMethodsCommand,
    listAgentCommandDefinitions,
    markInvoicePaidCommand,
    markInvoiceUnpaidCommand,
    markExpensePaidCommand,
    pauseExpenseRecurrenceCommand,
    markExpensesTaxClaimedCommand,
    markExpensesTaxUnclaimedCommand,
    markTaxReturnPeriodFiledCommand,
    markTaxReturnPeriodPaidCommand,
    pauseTimerCommand,
    previewBackupImportJsonCommand,
    previewDeleteClientCommand,
    previewDeleteProjectCommand,
    previewDeleteTaskCommand,
    previewProjectQuoteCommand,
    previewProjectQuoteEmailCommand,
    previewInvoiceEmailCommand,
    restoreBackupJsonCommand,
    restoreDriveBackupCommand,
    downloadDriveBackupJsonCommand,
    removeDailyGoalCommand,
    removePlannerAttachmentCommand,
    resumeExpenseRecurrenceCommand,
    resumeTimerCommand,
    sendProjectQuoteEmailCommand,
    sendInvoiceEmailCommand,
    setDefaultBusinessInfoCommand,
    setDailyGoalCommand,
    setDefaultEmailTemplateCommand,
    setDefaultInvoiceTemplateCommand,
    setDefaultPaymentMethodCommand,
    undoLatestInvoiceCommand,
    unarchiveClientCommand,
    unarchiveBusinessBrandAssetCommand,
    unarchiveExpenseCategoryCommand,
    unarchiveProjectCommand,
    unarchiveTaskCommand,
    openDashboardViewCommand,
    openAccountViewCommand,
    openPlannerViewCommand,
    openProjectViewCommand,
    openReportsViewCommand,
    previewInvoiceFromUnbilledWorkCommand,
    startTimerCommand,
    stopTimerCommand,
    updateClientCommand,
    updateBusinessBrandAssetCommand,
    updateBusinessInfoCommand,
    updateEmailTemplateCommand,
    updateExpenseCategoryCommand,
    updateExpenseRecurrenceCommand,
    updateInvoiceDraftCommand,
    updateInvoiceTemplateCommand,
    updatePaymentMethodCommand,
    updatePlannerAttachmentCommand,
    updatePreferencesCommand,
    updateProjectCommand,
    updateProjectNotesCommand,
    updateSyncSettingsCommand,
    updateTaxReturnPeriodCommand,
    updateTimerCommand,
    updateTimeEntryCommand,
} from './index';

const pdfMocks = vi.hoisted(() => ({
    generatePDF: vi.fn(async () => undefined),
    generatePDFBase64: vi.fn(async () => 'mock-pdf-base64'),
    generatePDFBlob: vi.fn(async () => new Blob(['mock-pdf'])),
    getCurrentInvoiceHtmlContent: vi.fn(() => '<div>Invoice HTML</div>'),
}));

const emailMocks = vi.hoisted(() => ({
    sendInvoiceEmail: vi.fn(async () => ({ success: true, remaining: 9, forwarded: true })),
}));

const csvMocks = vi.hoisted(() => ({
    buildCsvContent: vi.fn(() => 'mock,csv'),
    downloadCsvFile: vi.fn(),
}));

const zipMocks = vi.hoisted(() => ({
    downloadZipFile: vi.fn(async () => undefined),
}));

const downloadMocks = vi.hoisted(() => ({
    createObjectURL: vi.fn(() => 'blob:agent-backup'),
    revokeObjectURL: vi.fn(),
    linkClick: vi.fn(),
}));

const reportPdfMocks = vi.hoisted(() => ({
    buildMonthlyReportHtml: vi.fn(() => '<div>Monthly Report HTML</div>'),
    exportMonthlyReportPdf: vi.fn(async () => undefined),
    exportClientStatementPdf: vi.fn(async () => undefined),
    exportProjectWorkSummaryPdf: vi.fn(async () => undefined),
    exportInvoicesReportPdf: vi.fn(async () => undefined),
    exportOutstandingReportPdf: vi.fn(async () => undefined),
    exportExpensesReportPdf: vi.fn(async () => undefined),
}));

vi.mock('@/utils/usageMetrics', () => ({
    markMeaningfulActivity: vi.fn(),
}));

vi.mock('@/utils/pdfUtils', () => ({
    generatePDF: (...args: unknown[]) => pdfMocks.generatePDF(...args),
    generatePDFBase64: (...args: unknown[]) => pdfMocks.generatePDFBase64(...args),
    generatePDFBlob: (...args: unknown[]) => pdfMocks.generatePDFBlob(...args),
    getCurrentInvoiceHtmlContent: (...args: unknown[]) => pdfMocks.getCurrentInvoiceHtmlContent(...args),
}));

vi.mock('@/utils/emailService', () => ({
    sendInvoiceEmail: (...args: unknown[]) => emailMocks.sendInvoiceEmail(...args),
    isEmailSendError: (error: unknown) => typeof error === 'object' && error !== null && 'type' in error,
}));

vi.mock('@/utils/reportCsvUtils', () => ({
    buildCsvContent: (...args: unknown[]) => csvMocks.buildCsvContent(...args),
    downloadCsvFile: (...args: unknown[]) => csvMocks.downloadCsvFile(...args),
}));

vi.mock('@/utils/reportZipUtils', () => ({
    downloadZipFile: (...args: unknown[]) => zipMocks.downloadZipFile(...args),
}));

vi.mock('@/utils/reportPdfUtils', () => ({
    buildMonthlyReportHtml: (...args: unknown[]) => reportPdfMocks.buildMonthlyReportHtml(...args),
    exportMonthlyReportPdf: (...args: unknown[]) => reportPdfMocks.exportMonthlyReportPdf(...args),
    exportClientStatementPdf: (...args: unknown[]) => reportPdfMocks.exportClientStatementPdf(...args),
    exportProjectWorkSummaryPdf: (...args: unknown[]) => reportPdfMocks.exportProjectWorkSummaryPdf(...args),
    exportInvoicesReportPdf: (...args: unknown[]) => reportPdfMocks.exportInvoicesReportPdf(...args),
    exportOutstandingReportPdf: (...args: unknown[]) => reportPdfMocks.exportOutstandingReportPdf(...args),
    exportExpensesReportPdf: (...args: unknown[]) => reportPdfMocks.exportExpensesReportPdf(...args),
}));

const readStored = <T,>(map: Y.Map<string, unknown>, id: string): T | undefined => {
    return readEntity<T>(map.get(id));
};

function createContext(): AgentCommandContext & {
    maps: {
        projects: Y.Map<string, unknown>;
        tasks: Y.Map<string, unknown>;
        archivedTasks: Y.Map<string, unknown>;
        timers: Y.Map<string, unknown>;
        entries: Y.Map<string, unknown>;
        expenses: Y.Map<string, unknown>;
        clients: Y.Map<string, unknown>;
        preferences: Y.Map<string, unknown>;
        invoices: Y.Map<string, unknown>;
        invoiceTemplates: Y.Map<string, unknown>;
        businessInfos: Y.Map<string, unknown>;
        businessBrandAssets: Y.Map<string, unknown>;
        emailTemplates: Y.Map<string, unknown>;
        paymentMethods: Y.Map<string, unknown>;
        expenseCategories: Y.Map<string, unknown>;
        expenseRecurrences: Y.Map<string, unknown>;
        plannerAttachments: Y.Map<string, unknown>;
        dailyGoals: Y.Map<string, unknown>;
        taxReturnPeriods: Y.Map<string, unknown>;
    };
    openedRoutes: string[];
} {
    const coreDoc = new Y.Doc();
    const activeEntriesDoc = new Y.Doc();
    const projects = coreDoc.getMap('projects');
    const tasks = coreDoc.getMap('tasks');
    const archivedTasks = new Y.Doc().getMap('tasks');
    const timers = coreDoc.getMap('timers');
    const expenses = coreDoc.getMap('expenses');
    const clients = coreDoc.getMap('clients');
    const preferences = coreDoc.getMap('preferences');
    const invoices = coreDoc.getMap('invoices');
    const invoiceBillingOperations = coreDoc.getMap('invoiceBillingOperations');
    const invoiceTemplates = coreDoc.getMap('invoiceTemplates');
    const businessInfos = coreDoc.getMap('businessInfos');
    const businessBrandAssets = coreDoc.getMap('businessBrandAssets');
    const emailTemplates = coreDoc.getMap('emailTemplates');
    const paymentMethods = coreDoc.getMap('paymentMethods');
    const expenseCategories = coreDoc.getMap('expenseCategories');
    const expenseRecurrences = coreDoc.getMap('expenseRecurrences');
    const plannerAttachments = coreDoc.getMap('plannerAttachments');
    const dailyGoals = coreDoc.getMap('dailyGoals');
    const taxReturnPeriods = coreDoc.getMap('taxReturnPeriods');
    const entries = activeEntriesDoc.getMap('timeEntries');
    const openedRoutes: string[] = [];
    let nextId = 0;

    preferences.set('currency', 'USD');
    projects.set('project-1', { id: 'project-1', title: 'Project One', hourlyRate: 100, preferredClientId: 'client-1' });
    clients.set('client-1', { id: 'client-1', title: 'Client One' });
    const driveBackupPayload = {
        version: '1.4',
        exportDate: '2026-06-25T12:00:00.000Z',
        backupType: 'automatic',
        projects: [{ id: 'project-drive-restored', title: 'Drive Restored Project' }],
        tasks: [{ id: 'task-drive-restored', title: 'Drive Restored Task', projectId: 'project-drive-restored' }],
        timeEntries: [],
        invoices: [],
        paymentMethods: [],
        expenseCategories: [],
        taxReturnPeriods: [],
        businessInfos: [],
        businessBrandAssets: [],
        clients: [{ id: 'client-drive-restored', title: 'Drive Restored Client' }],
        invoiceTemplates: [],
        emailTemplates: [],
        expenses: [],
        expenseRecurrences: [],
        dailyGoals: [],
        plannerAttachments: [],
        preferences: { currency: 'GBP' },
    };

    const store = {
        isReady: true,
        coreDoc,
        activeEntriesDoc,
        projects,
        tasks,
        timers,
        expenses,
        clients,
        preferences,
        invoices,
        invoiceBillingOperations,
        reconcileInvoiceBillingOperations: vi.fn(async () => undefined),
        invoiceTemplates,
        businessInfos,
        businessBrandAssets,
        emailTemplates,
        paymentMethods,
        expenseCategories,
        expenseRecurrences,
        plannerAttachments,
        dailyGoals,
        taxReturnPeriods,
        activeTimeEntries: entries,
        commitInvoiceFinalization: vi.fn(async ({ operationId, desiredInvoice, application }: any) => {
            const entryMaps: Array<Y.Map<string, unknown>> = [entries];
            const years = typeof (store as any).getAvailableYears === 'function'
                ? await (store as any).getAvailableYears()
                : [];
            for (const year of years) {
                const map = await (store as any).loadEntriesForYear(year);
                if (map && !entryMaps.includes(map)) entryMaps.push(map);
            }
            const locateEntry = (id: string) => entryMaps.find((map) => map.has(id));

            invoiceBillingOperations.set(operationId, objectToYMap({
                version: 1,
                operationId,
                invoiceId: desiredInvoice.id,
                kind: 'finalize',
                state: 'complete',
                desiredInvoice,
                application,
                createdAt: 1,
                updatedAt: 1,
                lastCompletedPhase: 'complete',
            }));
            application.adjustmentEntryIdsToDelete.forEach((id: string) => locateEntry(id)?.delete(id));
            application.adjustmentEntriesToUpdate.forEach(({ id, updates }: any) => {
                const map = locateEntry(id);
                if (map) updateEntityFields(map as any, id, updates);
            });
            application.adjustmentEntriesToCreate.forEach(({ id, entry }: any) => entries.set(id, objectToYMap({ id, ...entry })));
            application.timeEntryUpdates.forEach(({ id, updates }: any) => {
                const map = locateEntry(id);
                if (map) updateEntityFields(map as any, id, updates);
            });
            application.expenseUpdates.forEach(({ id, updates }: any) => updateEntityFields(expenses as any, id, updates));
            [...application.taskCutoffUpdates, ...application.quotedTaskUpdates].forEach(({ id, updates }: any) => {
                const map = tasks.has(id) ? tasks : archivedTasks;
                updateEntityFields(map as any, id, updates);
            });
            application.projectLinkUpdates.forEach(({ id, updates }: any) => updateEntityFields(projects as any, id, updates));
            if (application.invoiceTemplateSequenceUpdate) {
                updateEntityFields(
                    invoiceTemplates as any,
                    application.invoiceTemplateSequenceUpdate.id,
                    application.invoiceTemplateSequenceUpdate.updates
                );
            }
            invoices.set(desiredInvoice.id, objectToYMap(desiredInvoice));
            return desiredInvoice;
        }),
        commitInvoiceUndo: vi.fn(async ({ operationId, invoice, application }: any) => {
            const entryMaps: Array<Y.Map<string, unknown>> = [entries];
            const years = typeof (store as any).getAvailableYears === 'function'
                ? await (store as any).getAvailableYears()
                : [];
            for (const year of years) {
                const map = await (store as any).loadEntriesForYear(year);
                if (map && !entryMaps.includes(map)) entryMaps.push(map);
            }
            const locateEntry = (id: string) => entryMaps.find((map) => map.has(id));

            invoiceBillingOperations.set(operationId, objectToYMap({
                version: 1,
                operationId,
                invoiceId: invoice.id,
                kind: 'undo',
                state: 'complete',
                invoice,
                application,
                createdAt: 1,
                updatedAt: 1,
                lastCompletedPhase: 'complete',
            }));
            application.entriesToDelete.forEach((entry: any) => locateEntry(entry.id)?.delete(entry.id));
            application.entriesToClear.forEach(({ entry, updates }: any) => {
                const map = locateEntry(entry.id);
                if (map) updateEntityFields(map as any, entry.id, updates);
            });
            application.expenseUpdatesToUnbill.forEach(({ id, updates }: any) => updateEntityFields(expenses as any, id, updates));
            [...application.quotedTaskUpdates, ...application.taskCutoffUpdates].forEach(({ id, updates }: any) => {
                const map = tasks.has(id) ? tasks : archivedTasks;
                updateEntityFields(map as any, id, updates);
            });
            application.projectUnlinkUpdates.forEach(({ id, updates }: any) => updateEntityFields(projects as any, id, updates));
            if (application.invoiceTemplateSequenceUpdate) {
                updateEntityFields(
                    invoiceTemplates as any,
                    application.invoiceTemplateSequenceUpdate.id,
                    application.invoiceTemplateSequenceUpdate.updates
                );
            }
            invoices.delete(invoice.id);
        }),
        getAllTimeEntries: () => Array.from(entries.values()).map((value) => readEntity(value)).filter(Boolean),
        getAllTasks: vi.fn(async () => [
            ...Array.from(tasks.values()).map((value) => readEntity(value)).filter(Boolean),
            ...Array.from(archivedTasks.values()).map((value) => readEntity(value)).filter(Boolean),
        ]),
        getAllExpenses: vi.fn(async () => Array.from(expenses.values()).map((value) => readEntity(value)).filter(Boolean)),
        loadAllTimeEntries: vi.fn(async () => Array.from(entries.values()).map((value) => readEntity(value)).filter(Boolean)),
        exportBackupData: vi.fn(async (options: Record<string, unknown> = {}) => ({
            version: '1.4',
            exportDate: options.exportDate || '2026-06-25T12:00:00.000Z',
            backupType: options.backupType,
            projects: Array.from(projects.values()).map((value) => readEntity(value)).filter(Boolean),
            tasks: [
                ...Array.from(tasks.values()).map((value) => readEntity(value)).filter(Boolean),
                ...Array.from(archivedTasks.values()).map((value) => readEntity(value)).filter(Boolean),
            ],
            timeEntries: Array.from(entries.values()).map((value) => readEntity(value)).filter(Boolean),
            invoices: Array.from(invoices.values()).map((value) => readEntity(value)).filter(Boolean),
            paymentMethods: Array.from(paymentMethods.values()).map((value) => readEntity(value)).filter(Boolean),
            expenseCategories: Array.from(expenseCategories.values()).map((value) => readEntity(value)).filter(Boolean),
            expenseRecurrences: Array.from(expenseRecurrences.values()).map((value) => readEntity(value)).filter(Boolean),
            taxReturnPeriods: Array.from(taxReturnPeriods.values()).map((value) => readEntity(value)).filter(Boolean),
            businessInfos: Array.from(businessInfos.values()).map((value) => readEntity(value)).filter(Boolean),
            businessBrandAssets: Array.from(businessBrandAssets.values()).map((value) => readEntity(value)).filter(Boolean),
            clients: Array.from(clients.values()).map((value) => readEntity(value)).filter(Boolean),
            invoiceTemplates: Array.from(invoiceTemplates.values()).map((value) => readEntity(value)).filter(Boolean),
            emailTemplates: Array.from(emailTemplates.values()).map((value) => readEntity(value)).filter(Boolean),
            expenses: Array.from(expenses.values()).map((value) => readEntity(value)).filter(Boolean),
            dailyGoals: Array.from(dailyGoals.values()).map((value) => readEntity(value)).filter(Boolean),
            plannerAttachments: Array.from(plannerAttachments.values()).map((value) => readEntity(value)).filter(Boolean),
            preferences: Object.fromEntries(preferences.entries()),
        })),
        clearAllData: vi.fn(async () => {
            projects.clear();
            tasks.clear();
            archivedTasks.clear();
            timers.clear();
            expenses.clear();
            clients.clear();
            preferences.clear();
            invoices.clear();
            invoiceTemplates.clear();
            businessInfos.clear();
            businessBrandAssets.clear();
            emailTemplates.clear();
            paymentMethods.clear();
            expenseCategories.clear();
            expenseRecurrences.clear();
            taxReturnPeriods.clear();
            plannerAttachments.clear();
            dailyGoals.clear();
            entries.clear();
        }),
        initialize: vi.fn(async () => undefined),
        importBackupData: vi.fn(async (data: Record<string, any>) => {
            for (const project of data.projects || []) {
                projects.set(project.id, objectToYMap(project));
            }

            for (const task of data.tasks || []) {
                tasks.set(task.id, objectToYMap(task));
            }

            for (const client of data.clients || []) {
                clients.set(client.id, objectToYMap(client));
            }

            for (const [key, value] of Object.entries(data.preferences || {})) {
                preferences.set(key, value);
            }
        }),
        listBackups: vi.fn(async () => [
            {
                id: 'drive-backup-1',
                name: 'tasktime-backup-2026-06-25-1200.json',
                date: '2026-06-25',
                modifiedTime: '2026-06-25T12:00:00.000Z',
            },
        ]),
        createBackup: vi.fn(async () => 'drive-backup-new'),
        downloadBackup: vi.fn(async () => driveBackupPayload),
        wipeDriveData: vi.fn(async () => undefined),
        deleteAllBackups: vi.fn(async () => undefined),
        isDriveConnected: vi.fn(() => true),
        getSyncState: vi.fn(() => 'idle'),
        getSyncPhase: vi.fn(() => 'idle'),
        getDriveSyncMode: vi.fn(() => {
            if (preferences.get('autoSyncEnabled') !== true) {
                return 'manual';
            }

            return preferences.get('autoSyncMode') === 'backup' ? 'backup' : 'sync';
        }),
        getLastSyncedAt: vi.fn(() => Date.parse('2026-06-25T12:00:00.000Z')),
        hasPendingSyncChanges: vi.fn(() => true),
        setDriveSyncPreferences: vi.fn(),
        forceDriveSync: vi.fn(async () => undefined),
        loadArchivedTasks: vi.fn(async () => archivedTasks),
        archiveTask: vi.fn(async (taskId: string) => {
            const task = readStored<Record<string, unknown>>(tasks, taskId);
            if (task) {
                archivedTasks.set(taskId, objectToYMap({
                    ...task,
                    archived: true,
                    archivedOnDate: '2026-06-25',
                }));
                tasks.delete(taskId);
            }
        }),
        unarchiveTask: vi.fn(async (taskId: string) => {
            const task = readStored<Record<string, unknown>>(archivedTasks, taskId);
            if (task) {
                tasks.set(taskId, objectToYMap({
                    ...task,
                    archived: false,
                    archivedOnDate: null,
                }));
                archivedTasks.delete(taskId);
            }
        }),
    };

    return {
        store: store as any,
        isReady: true,
        now: () => 1_700_000_000_000,
        generateId: () => `agent-id-${nextId++}`,
        permissions: new Set(['read', 'write', 'navigation']),
        idempotency: new Map(),
        revokeDriveAccess: vi.fn(async () => undefined),
        navigation: {
            openRoute: (route) => {
                openedRoutes.push(route);
            },
        },
        maps: {
            projects,
            tasks,
            archivedTasks,
            timers,
            entries,
            expenses,
            clients,
            preferences,
            invoices,
            invoiceTemplates,
            businessInfos,
            businessBrandAssets,
            emailTemplates,
            paymentMethods,
            expenseCategories,
            expenseRecurrences,
            plannerAttachments,
            dailyGoals,
            taxReturnPeriods,
        },
        openedRoutes,
    };
}

describe('agent commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window.URL, 'createObjectURL').mockImplementation(downloadMocks.createObjectURL);
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(downloadMocks.revokeObjectURL);
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(downloadMocks.linkClick);
        pdfMocks.generatePDF.mockResolvedValue(undefined);
        pdfMocks.generatePDFBase64.mockResolvedValue('mock-pdf-base64');
        pdfMocks.generatePDFBlob.mockResolvedValue(new Blob(['mock-pdf']));
        pdfMocks.getCurrentInvoiceHtmlContent.mockReturnValue('<div>Invoice HTML</div>');
        emailMocks.sendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9, forwarded: true });
        csvMocks.buildCsvContent.mockReturnValue('mock,csv');
        zipMocks.downloadZipFile.mockResolvedValue(undefined);
        reportPdfMocks.buildMonthlyReportHtml.mockReturnValue('<div>Monthly Report HTML</div>');
        Object.values(reportPdfMocks).forEach((mock) => mock.mockResolvedValue(undefined));
        reportPdfMocks.buildMonthlyReportHtml.mockReturnValue('<div>Monthly Report HTML</div>');
    });

    it('creates tasks through validated Yjs entities and honors idempotency keys', () => {
        const context = createContext();

        const first = createTaskCommand(context, {
            title: 'Prepare proposal',
            projectId: 'project-1',
            idempotencyKey: 'task-create-1',
        });
        const second = createTaskCommand(context, {
            title: 'Prepare proposal',
            projectId: 'project-1',
            idempotencyKey: 'task-create-1',
        });

        expect(first).toBe(second);
        expect(context.maps.tasks.size).toBe(1);
        expect(readStored(context.maps.tasks, first.id)).toEqual(expect.objectContaining({
            id: first.id,
            title: 'Prepare proposal',
            projectId: 'project-1',
        }));
    });

    it('deletes only unreferenced active or archived tasks with approval', async () => {
        const context = createContext();

        context.maps.tasks.set('task-delete-agent', objectToYMap({
            id: 'task-delete-agent',
            title: 'Task Delete Agent',
            projectId: 'project-1',
        }));
        context.maps.plannerAttachments.set('task-delete-attachment', objectToYMap({
            id: 'task-delete-attachment',
            referenceId: 'task-delete-agent',
            type: 'task',
        }));

        await expect(previewDeleteTaskCommand(context, {
            taskId: 'task-delete-agent',
        })).resolves.toEqual(expect.objectContaining({
            taskId: 'task-delete-agent',
            taskIdsToDelete: ['task-delete-agent'],
            timeEntryIdsToDelete: [],
            timerKeysToClear: [],
            invoiceReferences: [],
            plannerAttachmentIdsToDelete: ['task-delete-attachment'],
            canCascadeDeleteSafely: true,
        }));
        expect(context.maps.tasks.has('task-delete-agent')).toBe(true);

        await expect(deleteTaskCommand(context, {
            taskId: 'task-delete-agent',
        })).rejects.toThrow(/confirmDelete/);
        await expect(deleteTaskCommand(context, {
            taskId: 'task-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-task',
        })).rejects.toThrow(/confirmationText/);

        await expect(deleteTaskCommand(context, {
            taskId: 'task-delete-agent',
            confirmDelete: true,
            confirmationText: 'task-delete-agent',
        })).resolves.toEqual({
            taskId: 'task-delete-agent',
            title: 'Task Delete Agent',
            deleted: true,
            archived: false,
            removedPlannerAttachmentCount: 1,
        });
        expect(context.maps.tasks.has('task-delete-agent')).toBe(false);
        expect(context.maps.plannerAttachments.has('task-delete-attachment')).toBe(false);

        context.maps.archivedTasks.set('task-archived-delete-agent', objectToYMap({
            id: 'task-archived-delete-agent',
            title: 'Task Archived Delete Agent',
            projectId: 'project-1',
            archived: true,
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-archived-delete-agent',
            confirmDelete: true,
            confirmationText: 'task-archived-delete-agent',
        })).resolves.toEqual(expect.objectContaining({
            taskId: 'task-archived-delete-agent',
            deleted: true,
            archived: true,
        }));
        expect(context.maps.archivedTasks.has('task-archived-delete-agent')).toBe(false);

        context.maps.tasks.set('task-cascade-parent', objectToYMap({
            id: 'task-cascade-parent',
            title: 'Task Cascade Parent',
            projectId: 'project-1',
        }));
        context.maps.tasks.set('task-cascade-child', objectToYMap({
            id: 'task-cascade-child',
            title: 'Task Cascade Child',
            projectId: 'project-1',
            parentTaskId: 'task-cascade-parent',
        }));
        context.maps.entries.set('entry-task-cascade-parent', objectToYMap({
            id: 'entry-task-cascade-parent',
            taskId: 'task-cascade-parent',
            start: 1,
            end: 2,
        }));
        context.maps.entries.set('entry-task-cascade-child', objectToYMap({
            id: 'entry-task-cascade-child',
            taskId: 'task-cascade-child',
            start: 3,
            end: 4,
        }));
        context.maps.timers.set('timer-task-cascade', objectToYMap({
            projectId: 'timer-task-cascade',
            taskId: 'task-cascade-child',
            timerInstanceId: 'timer-cascade',
            startTime: Date.parse('2026-06-25T10:00:00Z'),
        }));
        context.maps.plannerAttachments.set('task-cascade-parent-attachment', objectToYMap({
            id: 'task-cascade-parent-attachment',
            referenceId: 'task-cascade-parent',
            type: 'task',
        }));
        context.maps.plannerAttachments.set('task-cascade-child-attachment', objectToYMap({
            id: 'task-cascade-child-attachment',
            referenceId: 'task-cascade-child',
            type: 'task',
        }));

        const cascadePreview = await previewDeleteTaskCommand(context, {
            taskId: 'task-cascade-parent',
        });
        expect(cascadePreview).toEqual(expect.objectContaining({
            taskIdsToDelete: ['task-cascade-child', 'task-cascade-parent'],
            timeEntryIdsToDelete: ['entry-task-cascade-child', 'entry-task-cascade-parent'],
            timerKeysToClear: ['timer-task-cascade'],
            plannerAttachmentIdsToDelete: ['task-cascade-child-attachment', 'task-cascade-parent-attachment'],
            canCascadeDeleteSafely: true,
        }));

        await expect(cascadeDeleteTaskCommand(context, {
            taskId: 'task-cascade-parent',
            confirmDelete: true,
            confirmationText: 'task-cascade-parent',
            expectedTaskIds: cascadePreview.taskIdsToDelete,
            expectedTimeEntryIds: cascadePreview.timeEntryIdsToDelete,
            expectedTimerKeys: cascadePreview.timerKeysToClear,
            expectedPlannerAttachmentIds: cascadePreview.plannerAttachmentIdsToDelete,
        })).resolves.toEqual({
            taskId: 'task-cascade-parent',
            title: 'Task Cascade Parent',
            deleted: true,
            deletedTaskIds: ['task-cascade-child', 'task-cascade-parent'],
            deletedTimeEntryIds: ['entry-task-cascade-child', 'entry-task-cascade-parent'],
            clearedTimerKeys: ['timer-task-cascade'],
            removedPlannerAttachmentCount: 2,
        });
        expect(context.maps.tasks.has('task-cascade-parent')).toBe(false);
        expect(context.maps.tasks.has('task-cascade-child')).toBe(false);
        expect(context.maps.entries.has('entry-task-cascade-parent')).toBe(false);
        expect(context.maps.entries.has('entry-task-cascade-child')).toBe(false);
        expect(context.maps.timers.has('timer-task-cascade')).toBe(false);
        expect(context.maps.plannerAttachments.has('task-cascade-parent-attachment')).toBe(false);
        expect(context.maps.plannerAttachments.has('task-cascade-child-attachment')).toBe(false);

        context.maps.tasks.set('task-cascade-stale', objectToYMap({
            id: 'task-cascade-stale',
            title: 'Task Cascade Stale',
            projectId: 'project-1',
        }));
        await expect(cascadeDeleteTaskCommand(context, {
            taskId: 'task-cascade-stale',
            confirmDelete: true,
            confirmationText: 'task-cascade-stale',
            expectedTaskIds: ['task-cascade-stale', 'stale-child'],
            expectedTimeEntryIds: [],
        })).rejects.toThrow(/expectedTaskIds/);

        context.maps.tasks.set('task-parent-reference', objectToYMap({
            id: 'task-parent-reference',
            title: 'Task Parent Reference',
            projectId: 'project-1',
        }));
        context.maps.tasks.set('task-child-reference', objectToYMap({
            id: 'task-child-reference',
            title: 'Task Child Reference',
            projectId: 'project-1',
            parentTaskId: 'task-parent-reference',
        }));
        await expect(previewDeleteTaskCommand(context, {
            taskId: 'task-parent-reference',
        })).resolves.toEqual(expect.objectContaining({
            taskIdsToDelete: ['task-child-reference', 'task-parent-reference'],
            descendantTaskIds: ['task-child-reference'],
            canCascadeDeleteSafely: true,
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-parent-reference',
            confirmDelete: true,
            confirmationText: 'task-parent-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.tasks.set('task-entry-reference', objectToYMap({
            id: 'task-entry-reference',
            title: 'Task Entry Reference',
            projectId: 'project-1',
        }));
        context.maps.entries.set('entry-task-reference', objectToYMap({
            id: 'entry-task-reference',
            taskId: 'task-entry-reference',
            start: 1,
            end: 2,
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-entry-reference',
            confirmDelete: true,
            confirmationText: 'task-entry-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.tasks.set('task-timer-reference', objectToYMap({
            id: 'task-timer-reference',
            title: 'Task Timer Reference',
            projectId: 'project-1',
        }));
        context.maps.timers.set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-timer-reference',
            timerInstanceId: 'timer-task-reference',
            startTime: Date.parse('2026-06-25T10:00:00Z'),
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-timer-reference',
            confirmDelete: true,
            confirmationText: 'task-timer-reference',
        })).rejects.toThrow(/still referenced/);
        context.maps.timers.delete('project-1');

        context.maps.tasks.set('task-invoice-reference', objectToYMap({
            id: 'task-invoice-reference',
            title: 'Task Invoice Reference',
            projectId: 'project-1',
        }));
        context.maps.invoices.set('invoice-task-reference', objectToYMap({
            id: 'invoice-task-reference',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-TASK',
            date: '2026-06-25',
            status: 'draft',
            items: [{ description: 'Task', quantity: 1, rate: 10, amount: 10, taskId: 'task-invoice-reference' }],
            projectBreakdowns: [{
                projectId: 'project-1',
                projectTitle: 'Project One',
                clientId: 'client-1',
                pricingMode: 'hourly',
                tasks: [{ id: 'task-invoice-reference' }],
                totalHours: 1,
                subtotal: 10,
            }],
            billingStateSnapshot: {
                version: 1,
                capturedAt: Date.parse('2026-06-25T10:00:00Z'),
                taskLastBilledAt: { 'task-invoice-reference': null },
            },
            subtotal: 10,
            total: 10,
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-invoice-reference',
            confirmDelete: true,
            confirmationText: 'task-invoice-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.tasks.set('task-quoted-reference', objectToYMap({
            id: 'task-quoted-reference',
            title: 'Task Quoted Reference',
            projectId: 'project-1',
            quotedAmountBilling: {
                invoiceId: 'invoice-quoted-reference',
                billedAt: Date.parse('2026-06-25T10:00:00Z'),
                total: 100,
            },
        }));
        await expect(previewDeleteTaskCommand(context, {
            taskId: 'task-quoted-reference',
        })).resolves.toEqual(expect.objectContaining({
            invoiceReferences: ['invoice-quoted-reference'],
            canCascadeDeleteSafely: false,
            blockingReasons: ['task_has_invoice_references'],
        }));
        await expect(deleteTaskCommand(context, {
            taskId: 'task-quoted-reference',
            confirmDelete: true,
            confirmationText: 'task-quoted-reference',
        })).rejects.toThrow(/still referenced/);
        await expect(cascadeDeleteTaskCommand(context, {
            taskId: 'task-quoted-reference',
            confirmDelete: true,
            confirmationText: 'task-quoted-reference',
            expectedTaskIds: ['task-quoted-reference'],
            expectedTimeEntryIds: [],
        })).rejects.toThrow(/blocked/);

        context.maps.tasks.set('task-billed-entry-reference', objectToYMap({
            id: 'task-billed-entry-reference',
            title: 'Task Billed Entry Reference',
            projectId: 'project-1',
        }));
        context.maps.entries.set('entry-billed-task-reference', objectToYMap({
            id: 'entry-billed-task-reference',
            taskId: 'task-billed-entry-reference',
            start: 1,
            end: 2,
            billedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));
        const billedPreview = await previewDeleteTaskCommand(context, {
            taskId: 'task-billed-entry-reference',
        });
        expect(billedPreview).toEqual(expect.objectContaining({
            billedTimeEntryIds: ['entry-billed-task-reference'],
            canCascadeDeleteSafely: false,
            blockingReasons: ['task_has_billed_time_entries'],
        }));
        await expect(cascadeDeleteTaskCommand(context, {
            taskId: 'task-billed-entry-reference',
            confirmDelete: true,
            confirmationText: 'task-billed-entry-reference',
            expectedTaskIds: billedPreview.taskIdsToDelete,
            expectedTimeEntryIds: billedPreview.timeEntryIdsToDelete,
        })).rejects.toThrow(/blocked/);

        context.maps.tasks.set('task-dispatch-delete', objectToYMap({
            id: 'task-dispatch-delete',
            title: 'Task Dispatch Delete',
            projectId: 'project-1',
        }));
        await expect(executeAgentCommand(context, 'delete_task', {
            taskId: 'task-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'task-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_task',
            data: expect.objectContaining({
                taskId: 'task-dispatch-delete',
                deleted: true,
            }),
        }));

        context.maps.tasks.set('task-dispatch-cascade', objectToYMap({
            id: 'task-dispatch-cascade',
            title: 'Task Dispatch Cascade',
            projectId: 'project-1',
        }));
        await expect(executeAgentCommand(context, 'cascade_delete_task', {
            taskId: 'task-dispatch-cascade',
            confirmDelete: true,
            confirmationText: 'task-dispatch-cascade',
            expectedTaskIds: ['task-dispatch-cascade'],
            expectedTimeEntryIds: [],
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'cascade_delete_task',
            data: expect.objectContaining({
                taskId: 'task-dispatch-cascade',
                deleted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'preview_delete_task', {
            taskId: 'task-parent-reference',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_delete_task',
            data: expect.objectContaining({
                taskId: 'task-parent-reference',
            }),
        }));
    });

    it('manages clients and deletes only unreferenced clients with approval', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T10:00:00Z');

        const client = createClientCommand(context, {
            id: 'client-agent',
            title: 'Agent Client',
            contactPerson: 'Alex Contact',
            email: 'alex@example.com',
            defaultHourlyRate: 125,
            idempotencyKey: 'client-create-1',
        });

        expect(client).toEqual(expect.objectContaining({
            id: 'client-agent',
            title: 'Agent Client',
            archived: false,
            createdAt: Date.parse('2026-06-25T10:00:00Z'),
            updatedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));
        expect(createClientCommand(context, {
            title: 'Duplicate client',
            idempotencyKey: 'client-create-1',
        }).id).toBe('client-agent');

        const updated = updateClientCommand(context, {
            clientId: 'client-agent',
            updates: {
                title: 'Agent Client Ltd',
                phone: '+155512345',
                disableTax: true,
            },
        });

        expect(updated).toEqual(expect.objectContaining({
            title: 'Agent Client Ltd',
            phone: '+155512345',
            disableTax: true,
        }));

        const archived = archiveClientCommand(context, { clientId: 'client-agent' });
        expect(archived).toEqual(expect.objectContaining({
            archived: true,
            archivedOnDate: '2026-06-25',
        }));
        expect(listClientsCommand(context).map((item) => item.id)).not.toContain('client-agent');
        expect(listClientsCommand(context, { includeArchived: true }).map((item) => item.id)).toContain('client-agent');

        const restored = unarchiveClientCommand(context, { clientId: 'client-agent' });
        expect(restored).toEqual(expect.objectContaining({
            archived: false,
            archivedOnDate: null,
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'create_client', {
            title: 'No permission',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'create_client',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'write' },
            }),
        }));

        context.permissions = new Set(['read', 'write']);
        context.maps.clients.set('client-delete-agent', objectToYMap({
            id: 'client-delete-agent',
            title: 'Client Delete Agent',
        }));
        context.maps.plannerAttachments.set('client-delete-attachment', objectToYMap({
            id: 'client-delete-attachment',
            referenceId: 'client-delete-agent',
            type: 'client',
        }));

        await expect(previewDeleteClientCommand(context, {
            clientId: 'client-delete-agent',
        })).resolves.toEqual(expect.objectContaining({
            clientId: 'client-delete-agent',
            projectIdsToDelete: [],
            projectIdsToConvertToPersonal: [],
            invoiceIds: [],
            expenseIdsToDelete: [],
            recurrenceIdsToDelete: [],
            plannerAttachmentIdsToDelete: ['client-delete-attachment'],
            canCascadeDeleteSafely: true,
        }));

        expect(() => deleteClientCommand(context, {
            clientId: 'client-delete-agent',
        })).toThrow(/confirmDelete/);
        expect(() => deleteClientCommand(context, {
            clientId: 'client-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-client',
        })).toThrow(/confirmationText/);

        const deletedClient = deleteClientCommand(context, {
            clientId: 'client-delete-agent',
            confirmDelete: true,
            confirmationText: 'client-delete-agent',
        });

        expect(deletedClient).toEqual({
            clientId: 'client-delete-agent',
            title: 'Client Delete Agent',
            deleted: true,
            removedPlannerAttachmentCount: 1,
        });
        expect(context.maps.clients.has('client-delete-agent')).toBe(false);
        expect(context.maps.plannerAttachments.has('client-delete-attachment')).toBe(false);

        context.maps.clients.set('client-cascade-convert', objectToYMap({
            id: 'client-cascade-convert',
            title: 'Client Cascade Convert',
        }));
        context.maps.projects.set('project-client-cascade-convert', objectToYMap({
            id: 'project-client-cascade-convert',
            title: 'Project Client Cascade Convert',
            preferredClientId: 'client-cascade-convert',
            hourlyRate: 120,
            flatRate: true,
            isPersonal: false,
        }));
        context.maps.expenses.set('expense-client-cascade-convert', objectToYMap({
            id: 'expense-client-cascade-convert',
            title: 'Client Cascade Convert Expense',
            date: '2026-06-25',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            clientId: 'client-cascade-convert',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }));
        context.maps.expenseRecurrences.set('recurrence-client-cascade-convert', objectToYMap({
            id: 'recurrence-client-cascade-convert',
            title: 'Client Cascade Convert Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            clientId: 'client-cascade-convert',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }));
        context.maps.plannerAttachments.set('client-cascade-convert-attachment', objectToYMap({
            id: 'client-cascade-convert-attachment',
            referenceId: 'client-cascade-convert',
            type: 'client',
        }));

        const clientConvertPreview = await previewDeleteClientCommand(context, {
            clientId: 'client-cascade-convert',
            alsoDeleteProjects: false,
        });
        expect(clientConvertPreview).toEqual(expect.objectContaining({
            projectIdsToDelete: [],
            projectIdsToConvertToPersonal: ['project-client-cascade-convert'],
            expenseIdsToDelete: ['expense-client-cascade-convert'],
            recurrenceIdsToDelete: ['recurrence-client-cascade-convert'],
            plannerAttachmentIdsToDelete: ['client-cascade-convert-attachment'],
            canCascadeDeleteSafely: true,
        }));

        await expect(cascadeDeleteClientCommand(context, {
            clientId: 'client-cascade-convert',
            alsoDeleteProjects: false,
            confirmDelete: true,
            confirmationText: 'client-cascade-convert',
            expectedProjectIdsToConvertToPersonal: clientConvertPreview.projectIdsToConvertToPersonal,
            expectedExpenseIds: clientConvertPreview.expenseIdsToDelete,
            expectedRecurrenceIds: clientConvertPreview.recurrenceIdsToDelete,
            expectedPlannerAttachmentIds: clientConvertPreview.plannerAttachmentIdsToDelete,
        })).resolves.toEqual(expect.objectContaining({
            clientId: 'client-cascade-convert',
            deleted: true,
            alsoDeleteProjects: false,
            convertedProjectIds: ['project-client-cascade-convert'],
            deletedExpenseIds: ['expense-client-cascade-convert'],
            deletedRecurrenceIds: ['recurrence-client-cascade-convert'],
            removedPlannerAttachmentCount: 1,
        }));
        expect(context.maps.clients.has('client-cascade-convert')).toBe(false);
        expect(readStored<any>(context.maps.projects, 'project-client-cascade-convert')).toEqual(expect.objectContaining({
            preferredClientId: null,
            hourlyRate: null,
            flatRate: false,
            isPersonal: true,
        }));
        expect(context.maps.expenses.has('expense-client-cascade-convert')).toBe(false);
        expect(context.maps.expenseRecurrences.has('recurrence-client-cascade-convert')).toBe(false);
        expect(context.maps.plannerAttachments.has('client-cascade-convert-attachment')).toBe(false);

        context.maps.clients.set('client-cascade-delete-projects', objectToYMap({
            id: 'client-cascade-delete-projects',
            title: 'Client Cascade Delete Projects',
        }));
        context.maps.projects.set('project-client-cascade-delete', objectToYMap({
            id: 'project-client-cascade-delete',
            title: 'Project Client Cascade Delete',
            preferredClientId: 'client-cascade-delete-projects',
        }));
        context.maps.tasks.set('task-client-cascade-active', objectToYMap({
            id: 'task-client-cascade-active',
            title: 'Client Cascade Active Task',
            projectId: 'project-client-cascade-delete',
        }));
        context.maps.archivedTasks.set('task-client-cascade-archived', objectToYMap({
            id: 'task-client-cascade-archived',
            title: 'Client Cascade Archived Task',
            projectId: 'project-client-cascade-delete',
            archived: true,
        }));
        context.maps.entries.set('entry-client-cascade-active', objectToYMap({
            id: 'entry-client-cascade-active',
            taskId: 'task-client-cascade-active',
            start: 1,
            end: 2,
        }));
        context.maps.entries.set('entry-client-cascade-archived', objectToYMap({
            id: 'entry-client-cascade-archived',
            taskId: 'task-client-cascade-archived',
            start: 3,
            end: 4,
        }));
        context.maps.timers.set('project-client-cascade-delete', objectToYMap({
            projectId: 'project-client-cascade-delete',
            taskId: 'task-client-cascade-active',
            timerInstanceId: 'timer-client-cascade',
            startTime: Date.parse('2026-06-25T10:00:00Z'),
        }));
        context.maps.expenses.set('expense-client-cascade-delete', objectToYMap({
            id: 'expense-client-cascade-delete',
            title: 'Client Cascade Delete Expense',
            date: '2026-06-25',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            projectId: 'project-client-cascade-delete',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }));
        context.maps.expenseRecurrences.set('recurrence-client-cascade-delete', objectToYMap({
            id: 'recurrence-client-cascade-delete',
            title: 'Client Cascade Delete Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            projectId: 'project-client-cascade-delete',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }));
        context.maps.plannerAttachments.set('client-cascade-delete-attachment', objectToYMap({
            id: 'client-cascade-delete-attachment',
            referenceId: 'client-cascade-delete-projects',
            type: 'client',
        }));
        context.maps.plannerAttachments.set('project-client-cascade-delete-attachment', objectToYMap({
            id: 'project-client-cascade-delete-attachment',
            referenceId: 'project-client-cascade-delete',
            type: 'project',
        }));

        const clientDeleteProjectsPreview = await previewDeleteClientCommand(context, {
            clientId: 'client-cascade-delete-projects',
            alsoDeleteProjects: true,
        });
        expect(clientDeleteProjectsPreview).toEqual(expect.objectContaining({
            projectIdsToDelete: ['project-client-cascade-delete'],
            activeTaskIdsToDelete: ['task-client-cascade-active'],
            archivedTaskIdsToDelete: ['task-client-cascade-archived'],
            timeEntryIdsToDelete: ['entry-client-cascade-active', 'entry-client-cascade-archived'],
            timerKeysToClear: ['project-client-cascade-delete'],
            expenseIdsToDelete: ['expense-client-cascade-delete'],
            recurrenceIdsToDelete: ['recurrence-client-cascade-delete'],
            plannerAttachmentIdsToDelete: ['client-cascade-delete-attachment', 'project-client-cascade-delete-attachment'],
            canCascadeDeleteSafely: true,
        }));

        await expect(cascadeDeleteClientCommand(context, {
            clientId: 'client-cascade-delete-projects',
            alsoDeleteProjects: true,
            confirmDelete: true,
            confirmationText: 'client-cascade-delete-projects',
            expectedProjectIdsToDelete: clientDeleteProjectsPreview.projectIdsToDelete,
            expectedTaskIds: [...clientDeleteProjectsPreview.activeTaskIdsToDelete, ...clientDeleteProjectsPreview.archivedTaskIdsToDelete],
            expectedTimeEntryIds: clientDeleteProjectsPreview.timeEntryIdsToDelete,
            expectedTimerKeys: clientDeleteProjectsPreview.timerKeysToClear,
            expectedExpenseIds: clientDeleteProjectsPreview.expenseIdsToDelete,
            expectedRecurrenceIds: clientDeleteProjectsPreview.recurrenceIdsToDelete,
            expectedPlannerAttachmentIds: clientDeleteProjectsPreview.plannerAttachmentIdsToDelete,
        })).resolves.toEqual(expect.objectContaining({
            clientId: 'client-cascade-delete-projects',
            deleted: true,
            alsoDeleteProjects: true,
            deletedProjectIds: ['project-client-cascade-delete'],
            deletedTaskIds: ['task-client-cascade-active', 'task-client-cascade-archived'],
            deletedTimeEntryIds: ['entry-client-cascade-active', 'entry-client-cascade-archived'],
            clearedTimerKeys: ['project-client-cascade-delete'],
            deletedExpenseIds: ['expense-client-cascade-delete'],
            deletedRecurrenceIds: ['recurrence-client-cascade-delete'],
            removedPlannerAttachmentCount: 2,
        }));
        expect(context.maps.clients.has('client-cascade-delete-projects')).toBe(false);
        expect(context.maps.projects.has('project-client-cascade-delete')).toBe(false);
        expect(context.maps.tasks.has('task-client-cascade-active')).toBe(false);
        expect(context.maps.archivedTasks.has('task-client-cascade-archived')).toBe(false);
        expect(context.maps.entries.has('entry-client-cascade-active')).toBe(false);
        expect(context.maps.entries.has('entry-client-cascade-archived')).toBe(false);
        expect(context.maps.timers.has('project-client-cascade-delete')).toBe(false);
        expect(context.maps.expenses.has('expense-client-cascade-delete')).toBe(false);
        expect(context.maps.expenseRecurrences.has('recurrence-client-cascade-delete')).toBe(false);
        expect(context.maps.plannerAttachments.has('client-cascade-delete-attachment')).toBe(false);
        expect(context.maps.plannerAttachments.has('project-client-cascade-delete-attachment')).toBe(false);

        expect(() => deleteClientCommand(context, {
            clientId: 'client-1',
            confirmDelete: true,
            confirmationText: 'client-1',
        })).toThrow(/still referenced/);
        await expect(previewDeleteClientCommand(context, {
            clientId: 'client-1',
            alsoDeleteProjects: false,
        })).resolves.toEqual(expect.objectContaining({
            clientId: 'client-1',
            projectIdsToConvertToPersonal: ['project-1'],
            projectIdsToDelete: [],
            canCascadeDeleteSafely: true,
        }));

        context.maps.clients.set('client-invoice-reference', objectToYMap({
            id: 'client-invoice-reference',
            title: 'Client Invoice Reference',
        }));
        context.maps.invoices.set('invoice-client-reference', objectToYMap({
            id: 'invoice-client-reference',
            projectId: null,
            clientId: 'client-invoice-reference',
            invoiceNumber: 'INV-CLIENT',
            date: '2026-06-25',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
        }));
        expect(() => deleteClientCommand(context, {
            clientId: 'client-invoice-reference',
            confirmDelete: true,
            confirmationText: 'client-invoice-reference',
        })).toThrow(/still referenced/);
        await expect(cascadeDeleteClientCommand(context, {
            clientId: 'client-invoice-reference',
            confirmDelete: true,
            confirmationText: 'client-invoice-reference',
        })).rejects.toThrow(/blocked/);

        context.maps.clients.set('client-expense-reference', objectToYMap({
            id: 'client-expense-reference',
            title: 'Client Expense Reference',
        }));
        context.maps.expenses.set('expense-client-reference', objectToYMap({
            id: 'expense-client-reference',
            title: 'Client Expense',
            date: '2026-06-25',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            clientId: 'client-expense-reference',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }));
        expect(() => deleteClientCommand(context, {
            clientId: 'client-expense-reference',
            confirmDelete: true,
            confirmationText: 'client-expense-reference',
        })).toThrow(/still referenced/);

        context.maps.clients.set('client-recurrence-reference', objectToYMap({
            id: 'client-recurrence-reference',
            title: 'Client Recurrence Reference',
        }));
        context.maps.expenseRecurrences.set('recurrence-client-reference', objectToYMap({
            id: 'recurrence-client-reference',
            title: 'Client Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            clientId: 'client-recurrence-reference',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }));
        expect(() => deleteClientCommand(context, {
            clientId: 'client-recurrence-reference',
            confirmDelete: true,
            confirmationText: 'client-recurrence-reference',
        })).toThrow(/still referenced/);

        context.maps.clients.set('client-dispatch-delete', objectToYMap({
            id: 'client-dispatch-delete',
            title: 'Client Dispatch Delete',
        }));
        await expect(executeAgentCommand(context, 'delete_client', {
            clientId: 'client-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'client-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_client',
            data: expect.objectContaining({
                clientId: 'client-dispatch-delete',
                deleted: true,
            }),
        }));

        context.maps.clients.set('client-dispatch-cascade', objectToYMap({
            id: 'client-dispatch-cascade',
            title: 'Client Dispatch Cascade',
        }));
        await expect(executeAgentCommand(context, 'cascade_delete_client', {
            clientId: 'client-dispatch-cascade',
            confirmDelete: true,
            confirmationText: 'client-dispatch-cascade',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'cascade_delete_client',
            data: expect.objectContaining({
                clientId: 'client-dispatch-cascade',
                deleted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'preview_delete_client', {
            clientId: 'client-1',
            alsoDeleteProjects: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_delete_client',
            data: expect.objectContaining({
                clientId: 'client-1',
                projectIdsToDelete: ['project-1'],
            }),
        }));
    });

    it('manages projects with client reference validation and archive toggles', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T11:00:00Z');
        context.maps.clients.set('client-agent', objectToYMap({
            id: 'client-agent',
            title: 'Agent Client',
        }));

        const project = createProjectCommand(context, {
            id: 'project-agent',
            title: 'Agent Project',
            preferredClientId: 'client-agent',
            hourlyRate: 150,
            statusMode: 'active',
            idempotencyKey: 'project-create-1',
        });

        expect(project).toEqual(expect.objectContaining({
            id: 'project-agent',
            title: 'Agent Project',
            preferredClientId: 'client-agent',
            archived: false,
        }));
        expect(createProjectCommand(context, {
            title: 'Duplicate project',
            idempotencyKey: 'project-create-1',
        }).id).toBe('project-agent');

        expect(() => createProjectCommand(context, {
            title: 'Bad client project',
            preferredClientId: 'missing-client',
        })).toThrow(/Client not found/);

        const updated = updateProjectCommand(context, {
            projectId: 'project-agent',
            updates: {
                title: 'Agent Project Updated',
                budgetAmount: 2500,
                taskView: 'kanban',
            },
        });

        expect(updated).toEqual(expect.objectContaining({
            title: 'Agent Project Updated',
            budgetAmount: 2500,
            taskView: 'kanban',
        }));

        const archived = archiveProjectCommand(context, { projectId: 'project-agent' });
        expect(archived).toEqual(expect.objectContaining({
            archived: true,
            archivedOnDate: '2026-06-25',
        }));

        const restored = unarchiveProjectCommand(context, { projectId: 'project-agent' });
        expect(restored).toEqual(expect.objectContaining({
            archived: false,
            archivedOnDate: null,
        }));

        await expect(executeAgentCommand(context, 'update_project', {
            projectId: 'project-agent',
            updates: { preferredClientId: 'missing-client' },
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'update_project',
            error: expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        }));

        context.maps.projects.set('project-delete-agent', objectToYMap({
            id: 'project-delete-agent',
            title: 'Project Delete Agent',
        }));
        context.maps.plannerAttachments.set('project-delete-attachment', objectToYMap({
            id: 'project-delete-attachment',
            referenceId: 'project-delete-agent',
            type: 'project',
        }));

        await expect(previewDeleteProjectCommand(context, {
            projectId: 'project-delete-agent',
        })).resolves.toEqual(expect.objectContaining({
            projectId: 'project-delete-agent',
            taskIdsToDelete: [],
            timeEntryIdsToDelete: [],
            timerKeysToClear: [],
            invoiceIds: [],
            expenseIdsToDelete: [],
            recurrenceIdsToDelete: [],
            plannerAttachmentIdsToDelete: ['project-delete-attachment'],
            canCascadeDeleteSafely: true,
        }));

        await expect(deleteProjectCommand(context, {
            projectId: 'project-delete-agent',
        })).rejects.toThrow(/confirmDelete/);
        await expect(deleteProjectCommand(context, {
            projectId: 'project-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-project',
        })).rejects.toThrow(/confirmationText/);

        await expect(deleteProjectCommand(context, {
            projectId: 'project-delete-agent',
            confirmDelete: true,
            confirmationText: 'project-delete-agent',
        })).resolves.toEqual({
            projectId: 'project-delete-agent',
            title: 'Project Delete Agent',
            deleted: true,
            removedPlannerAttachmentCount: 1,
        });
        expect(context.maps.projects.has('project-delete-agent')).toBe(false);
        expect(context.maps.plannerAttachments.has('project-delete-attachment')).toBe(false);

        context.maps.projects.set('project-cascade-agent', objectToYMap({
            id: 'project-cascade-agent',
            title: 'Project Cascade Agent',
        }));
        context.maps.tasks.set('task-project-cascade-active', objectToYMap({
            id: 'task-project-cascade-active',
            title: 'Project Cascade Active Task',
            projectId: 'project-cascade-agent',
        }));
        context.maps.archivedTasks.set('task-project-cascade-archived', objectToYMap({
            id: 'task-project-cascade-archived',
            title: 'Project Cascade Archived Task',
            projectId: 'project-cascade-agent',
            archived: true,
        }));
        context.maps.entries.set('entry-project-cascade-active', objectToYMap({
            id: 'entry-project-cascade-active',
            taskId: 'task-project-cascade-active',
            start: 1,
            end: 2,
        }));
        context.maps.entries.set('entry-project-cascade-archived', objectToYMap({
            id: 'entry-project-cascade-archived',
            taskId: 'task-project-cascade-archived',
            start: 3,
            end: 4,
        }));
        context.maps.timers.set('project-cascade-agent', objectToYMap({
            projectId: 'project-cascade-agent',
            taskId: 'task-project-cascade-active',
            timerInstanceId: 'timer-project-cascade',
            startTime: Date.parse('2026-06-25T10:00:00Z'),
        }));
        context.maps.expenses.set('expense-project-cascade', objectToYMap({
            id: 'expense-project-cascade',
            title: 'Project Cascade Expense',
            date: '2026-06-25',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            projectId: 'project-cascade-agent',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }));
        context.maps.expenseRecurrences.set('recurrence-project-cascade', objectToYMap({
            id: 'recurrence-project-cascade',
            title: 'Project Cascade Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            projectId: 'project-cascade-agent',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }));
        context.maps.plannerAttachments.set('project-cascade-attachment', objectToYMap({
            id: 'project-cascade-attachment',
            referenceId: 'project-cascade-agent',
            type: 'project',
        }));
        context.maps.plannerAttachments.set('task-project-cascade-attachment', objectToYMap({
            id: 'task-project-cascade-attachment',
            referenceId: 'task-project-cascade-active',
            type: 'task',
        }));

        const projectCascadePreview = await previewDeleteProjectCommand(context, {
            projectId: 'project-cascade-agent',
        });
        expect(projectCascadePreview).toEqual(expect.objectContaining({
            activeTaskIds: ['task-project-cascade-active'],
            archivedTaskIds: ['task-project-cascade-archived'],
            taskIdsToDelete: ['task-project-cascade-active', 'task-project-cascade-archived'],
            timeEntryIdsToDelete: ['entry-project-cascade-active', 'entry-project-cascade-archived'],
            timerKeysToClear: ['project-cascade-agent'],
            expenseIdsToDelete: ['expense-project-cascade'],
            recurrenceIdsToDelete: ['recurrence-project-cascade'],
            plannerAttachmentIdsToDelete: ['project-cascade-attachment', 'task-project-cascade-attachment'],
            canCascadeDeleteSafely: true,
        }));

        await expect(cascadeDeleteProjectCommand(context, {
            projectId: 'project-cascade-agent',
            confirmDelete: true,
            confirmationText: 'project-cascade-agent',
            expectedTaskIds: projectCascadePreview.taskIdsToDelete,
            expectedTimeEntryIds: projectCascadePreview.timeEntryIdsToDelete,
            expectedTimerKeys: projectCascadePreview.timerKeysToClear,
            expectedExpenseIds: projectCascadePreview.expenseIdsToDelete,
            expectedRecurrenceIds: projectCascadePreview.recurrenceIdsToDelete,
            expectedPlannerAttachmentIds: projectCascadePreview.plannerAttachmentIdsToDelete,
        })).resolves.toEqual({
            projectId: 'project-cascade-agent',
            title: 'Project Cascade Agent',
            deleted: true,
            deletedTaskIds: ['task-project-cascade-active', 'task-project-cascade-archived'],
            deletedTimeEntryIds: ['entry-project-cascade-active', 'entry-project-cascade-archived'],
            clearedTimerKeys: ['project-cascade-agent'],
            deletedExpenseIds: ['expense-project-cascade'],
            deletedRecurrenceIds: ['recurrence-project-cascade'],
            removedPlannerAttachmentCount: 2,
        });
        expect(context.maps.projects.has('project-cascade-agent')).toBe(false);
        expect(context.maps.tasks.has('task-project-cascade-active')).toBe(false);
        expect(context.maps.archivedTasks.has('task-project-cascade-archived')).toBe(false);
        expect(context.maps.entries.has('entry-project-cascade-active')).toBe(false);
        expect(context.maps.entries.has('entry-project-cascade-archived')).toBe(false);
        expect(context.maps.timers.has('project-cascade-agent')).toBe(false);
        expect(context.maps.expenses.has('expense-project-cascade')).toBe(false);
        expect(context.maps.expenseRecurrences.has('recurrence-project-cascade')).toBe(false);
        expect(context.maps.plannerAttachments.has('project-cascade-attachment')).toBe(false);
        expect(context.maps.plannerAttachments.has('task-project-cascade-attachment')).toBe(false);

        context.maps.projects.set('project-cascade-stale', objectToYMap({
            id: 'project-cascade-stale',
            title: 'Project Cascade Stale',
        }));
        await expect(cascadeDeleteProjectCommand(context, {
            projectId: 'project-cascade-stale',
            confirmDelete: true,
            confirmationText: 'project-cascade-stale',
            expectedTaskIds: ['stale-task'],
            expectedTimeEntryIds: [],
        })).rejects.toThrow(/expectedTaskIds/);

        context.maps.projects.set('project-task-reference', objectToYMap({
            id: 'project-task-reference',
            title: 'Project Task Reference',
        }));
        context.maps.tasks.set('task-project-reference', objectToYMap({
            id: 'task-project-reference',
            title: 'Task Project Reference',
            projectId: 'project-task-reference',
        }));
        context.maps.entries.set('entry-project-reference', objectToYMap({
            id: 'entry-project-reference',
            taskId: 'task-project-reference',
            start: 1,
            end: 2,
        }));
        await expect(previewDeleteProjectCommand(context, {
            projectId: 'project-task-reference',
        })).resolves.toEqual(expect.objectContaining({
            activeTaskIds: ['task-project-reference'],
            taskIdsToDelete: ['task-project-reference'],
            timeEntryIdsToDelete: ['entry-project-reference'],
            canCascadeDeleteSafely: true,
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-task-reference',
            confirmDelete: true,
            confirmationText: 'project-task-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-archived-task-reference', objectToYMap({
            id: 'project-archived-task-reference',
            title: 'Project Archived Task Reference',
        }));
        context.maps.archivedTasks.set('archived-task-project-reference', objectToYMap({
            id: 'archived-task-project-reference',
            title: 'Archived Task Project Reference',
            projectId: 'project-archived-task-reference',
            archived: true,
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-archived-task-reference',
            confirmDelete: true,
            confirmationText: 'project-archived-task-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-invoice-reference', objectToYMap({
            id: 'project-invoice-reference',
            title: 'Project Invoice Reference',
        }));
        context.maps.invoices.set('invoice-project-reference', objectToYMap({
            id: 'invoice-project-reference',
            projectId: 'project-invoice-reference',
            clientId: 'client-1',
            invoiceNumber: 'INV-PROJECT',
            date: '2026-06-25',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
        }));
        await expect(previewDeleteProjectCommand(context, {
            projectId: 'project-invoice-reference',
        })).resolves.toEqual(expect.objectContaining({
            invoiceIds: ['invoice-project-reference'],
            canCascadeDeleteSafely: false,
            blockingReasons: ['project_has_invoices_not_selected_for_delete'],
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-invoice-reference',
            confirmDelete: true,
            confirmationText: 'project-invoice-reference',
        })).rejects.toThrow(/still referenced/);
        await expect(cascadeDeleteProjectCommand(context, {
            projectId: 'project-invoice-reference',
            confirmDelete: true,
            confirmationText: 'project-invoice-reference',
            expectedTaskIds: [],
            expectedTimeEntryIds: [],
        })).rejects.toThrow(/blocked/);

        context.maps.projects.set('project-expense-reference', objectToYMap({
            id: 'project-expense-reference',
            title: 'Project Expense Reference',
        }));
        context.maps.expenses.set('expense-project-reference', objectToYMap({
            id: 'expense-project-reference',
            title: 'Project Expense',
            date: '2026-06-25',
            currency: 'USD',
            amount: 25,
            paymentStatus: 'unpaid',
            projectId: 'project-expense-reference',
            isPersonal: false,
            billable: false,
            billingStatus: 'unbilled',
            isRecurring: false,
            isTaxExempt: false,
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-expense-reference',
            confirmDelete: true,
            confirmationText: 'project-expense-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-recurrence-reference', objectToYMap({
            id: 'project-recurrence-reference',
            title: 'Project Recurrence Reference',
        }));
        context.maps.expenseRecurrences.set('recurrence-project-reference', objectToYMap({
            id: 'recurrence-project-reference',
            title: 'Project Recurrence',
            currency: 'USD',
            amount: 25,
            amountType: 'fixed',
            repeat: 'monthly',
            startDate: '2026-06-01',
            projectId: 'project-recurrence-reference',
            isPersonal: false,
            billable: false,
            isTaxExempt: false,
            active: true,
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-recurrence-reference',
            confirmDelete: true,
            confirmationText: 'project-recurrence-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-timer-reference', objectToYMap({
            id: 'project-timer-reference',
            title: 'Project Timer Reference',
        }));
        context.maps.timers.set('project-timer-reference', objectToYMap({
            projectId: 'project-timer-reference',
            taskId: 'task-timer-reference',
            timerInstanceId: 'timer-1',
            startTime: Date.parse('2026-06-25T10:00:00Z'),
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-timer-reference',
            confirmDelete: true,
            confirmationText: 'project-timer-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-stored-invoice-reference', objectToYMap({
            id: 'project-stored-invoice-reference',
            title: 'Project Stored Invoice Reference',
            invoiceIds: ['invoice-stale-reference'],
        }));
        await expect(deleteProjectCommand(context, {
            projectId: 'project-stored-invoice-reference',
            confirmDelete: true,
            confirmationText: 'project-stored-invoice-reference',
        })).rejects.toThrow(/still referenced/);

        context.maps.projects.set('project-dispatch-delete', objectToYMap({
            id: 'project-dispatch-delete',
            title: 'Project Dispatch Delete',
        }));
        await expect(executeAgentCommand(context, 'delete_project', {
            projectId: 'project-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'project-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_project',
            data: expect.objectContaining({
                projectId: 'project-dispatch-delete',
                deleted: true,
            }),
        }));

        context.maps.projects.set('project-dispatch-cascade', objectToYMap({
            id: 'project-dispatch-cascade',
            title: 'Project Dispatch Cascade',
        }));
        await expect(executeAgentCommand(context, 'cascade_delete_project', {
            projectId: 'project-dispatch-cascade',
            confirmDelete: true,
            confirmationText: 'project-dispatch-cascade',
            expectedTaskIds: [],
            expectedTimeEntryIds: [],
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'cascade_delete_project',
            data: expect.objectContaining({
                projectId: 'project-dispatch-cascade',
                deleted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'preview_delete_project', {
            projectId: 'project-task-reference',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_delete_project',
            data: expect.objectContaining({
                projectId: 'project-task-reference',
                taskIdsToDelete: ['task-project-reference'],
            }),
        }));
    });

    it('manages business profiles and payment methods with default semantics', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');

        const firstBusiness = createBusinessInfoCommand(context, {
            id: 'business-1',
            title: 'TaskTime Pro LLC',
            businessName: 'TaskTime Pro LLC',
            email: 'hello@tasktime.test',
            taxEnabled: true,
            taxLabel: 'VAT',
            taxRate: 22,
            idempotencyKey: 'business-create-1',
        });
        const secondBusiness = createBusinessInfoCommand(context, {
            id: 'business-2',
            title: 'Other LLC',
            businessName: 'Other LLC',
            isDefault: true,
        });

        expect(firstBusiness).toEqual(expect.objectContaining({
            id: 'business-1',
            isDefault: true,
        }));
        expect(secondBusiness).toEqual(expect.objectContaining({
            id: 'business-2',
            isDefault: true,
        }));
        expect(readStored<any>(context.maps.businessInfos, 'business-1')).toEqual(expect.objectContaining({
            isDefault: false,
        }));
        expect(createBusinessInfoCommand(context, {
            title: 'Duplicate',
            businessName: 'Duplicate',
            idempotencyKey: 'business-create-1',
        }).id).toBe('business-1');

        const updatedBusiness = updateBusinessInfoCommand(context, {
            businessInfoId: 'business-1',
            updates: {
                isDefault: true,
                phone: '+386100000',
            },
        });

        expect(updatedBusiness).toEqual(expect.objectContaining({
            isDefault: true,
            phone: '+386100000',
        }));
        expect(readStored<any>(context.maps.businessInfos, 'business-2')).toEqual(expect.objectContaining({
            isDefault: false,
        }));
        expect(listBusinessInfosCommand(context)[0].id).toBe('business-1');

        const firstPayment = createPaymentMethodCommand(context, {
            id: 'payment-1',
            title: 'Bank transfer',
            iban: 'SI56000000000000000',
            custom: [{ label: 'Reference', value: 'INV' }],
        });
        const secondPayment = createPaymentMethodCommand(context, {
            id: 'payment-2',
            title: 'PayPal',
            paypal: 'pay@example.com',
            isDefault: true,
        });

        expect(firstPayment).toEqual(expect.objectContaining({
            isDefault: true,
            createdAt: Date.parse('2026-06-25T12:00:00Z'),
        }));
        expect(secondPayment).toEqual(expect.objectContaining({
            isDefault: true,
        }));
        expect(readStored<any>(context.maps.paymentMethods, 'payment-1')).toEqual(expect.objectContaining({
            isDefault: false,
        }));

        const updatedPayment = updatePaymentMethodCommand(context, {
            paymentMethodId: 'payment-1',
            updates: {
                isDefault: true,
                instructions: 'Pay within 14 days',
            },
        });

        expect(updatedPayment).toEqual(expect.objectContaining({
            isDefault: true,
            instructions: 'Pay within 14 days',
            updatedAt: Date.parse('2026-06-25T12:00:00Z'),
        }));
        expect(readStored<any>(context.maps.paymentMethods, 'payment-2')).toEqual(expect.objectContaining({
            isDefault: false,
        }));

        expect(setDefaultBusinessInfoCommand(context, { businessInfoId: 'business-2' })).toEqual(expect.objectContaining({ isDefault: true }));
        expect(setDefaultPaymentMethodCommand(context, { paymentMethodId: 'payment-2' })).toEqual(expect.objectContaining({ isDefault: true }));
        expect(listPaymentMethodsCommand(context)[0].id).toBe('payment-2');

        createBusinessInfoCommand(context, {
            id: 'business-delete-agent',
            title: 'Delete Business',
            businessName: 'Delete Business',
        });

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-delete-agent',
        })).toThrow(/confirmDelete/);

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-business',
        })).toThrow(/confirmationText/);

        expect(deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-delete-agent',
            confirmDelete: true,
            confirmationText: 'business-delete-agent',
        })).toEqual({
            businessInfoId: 'business-delete-agent',
            title: 'Delete Business',
            deleted: true,
        });
        expect(context.maps.businessInfos.has('business-delete-agent')).toBe(false);

        createBusinessInfoCommand(context, {
            id: 'business-invoice-reference',
            title: 'Invoice Reference Business',
            businessName: 'Invoice Reference Business',
        });
        context.maps.invoices.set('invoice-business-reference', objectToYMap({
            id: 'invoice-business-reference',
            projectId: null,
            clientId: 'client-1',
            invoiceNumber: 'INV-BUSINESS-REFERENCE',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 0,
            total: 0,
            businessInfoId: 'business-invoice-reference',
        }));

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-invoice-reference',
            confirmDelete: true,
            confirmationText: 'business-invoice-reference',
        })).toThrow(/referenced by an invoice/);

        createBusinessInfoCommand(context, {
            id: 'business-asset-reference',
            title: 'Asset Reference Business',
            businessName: 'Asset Reference Business',
        });
        createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-business-info-reference',
            businessInfoId: 'business-asset-reference',
            dataUrl: 'data:image/png;base64,ASSET',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'business-info-asset-reference',
        });

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-asset-reference',
            confirmDelete: true,
            confirmationText: 'business-asset-reference',
        })).toThrow(/business brand asset/);

        createBusinessInfoCommand(context, {
            id: 'business-expense-reference',
            title: 'Expense Reference Business',
            businessName: 'Expense Reference Business',
        });
        createExpenseCommand(context, {
            id: 'expense-business-reference',
            title: 'Business expense',
            date: '2026-06-25',
            amount: 10,
            currency: 'USD',
            isPersonal: false,
            billable: false,
            businessId: 'business-expense-reference',
        });

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-expense-reference',
            confirmDelete: true,
            confirmationText: 'business-expense-reference',
        })).toThrow(/referenced by an expense/);

        createBusinessInfoCommand(context, {
            id: 'business-recurrence-reference',
            title: 'Recurrence Reference Business',
            businessName: 'Recurrence Reference Business',
        });
        createExpenseRecurrenceCommand(context, {
            id: 'recurrence-business-reference',
            title: 'Business recurrence',
            currency: 'USD',
            amount: 15,
            amountType: 'fixed',
            repeat: 'yearly',
            startDate: '2026-06-25',
            isPersonal: true,
            billable: false,
            isTaxExempt: true,
            businessId: 'business-recurrence-reference',
            generateInitial: false,
        });

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-recurrence-reference',
            confirmDelete: true,
            confirmationText: 'business-recurrence-reference',
        })).toThrow(/recurring expense template/);

        createBusinessInfoCommand(context, {
            id: 'business-tax-reference',
            title: 'Tax Reference Business',
            businessName: 'Tax Reference Business',
        });
        createTaxReturnPeriodCommand(context, {
            id: 'tax-business-reference',
            title: 'Business tax return',
            type: 'vat',
            startDate: '2026-06-01',
            endDate: '2026-06-30',
            businessInfoId: 'business-tax-reference',
        });

        expect(() => deleteBusinessInfoCommand(context, {
            businessInfoId: 'business-tax-reference',
            confirmDelete: true,
            confirmationText: 'business-tax-reference',
        })).toThrow(/tax return period/);

        createBusinessInfoCommand(context, {
            id: 'business-dispatch-delete',
            title: 'Dispatch Business Delete',
            businessName: 'Dispatch Business Delete',
        });

        await expect(executeAgentCommand(context, 'delete_business_info', {
            businessInfoId: 'business-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'business-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_business_info',
            data: {
                businessInfoId: 'business-dispatch-delete',
                title: 'Dispatch Business Delete',
                deleted: true,
            },
        }));
        expect(context.maps.businessInfos.has('business-dispatch-delete')).toBe(false);

        createPaymentMethodCommand(context, {
            id: 'payment-delete-agent',
            title: 'Delete payment',
        });

        expect(() => deletePaymentMethodCommand(context, {
            paymentMethodId: 'payment-delete-agent',
        })).toThrow(/confirmDelete/);

        expect(() => deletePaymentMethodCommand(context, {
            paymentMethodId: 'payment-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-payment',
        })).toThrow(/confirmationText/);

        expect(deletePaymentMethodCommand(context, {
            paymentMethodId: 'payment-delete-agent',
            confirmDelete: true,
            confirmationText: 'payment-delete-agent',
        })).toEqual({
            paymentMethodId: 'payment-delete-agent',
            title: 'Delete payment',
            deleted: true,
        });
        expect(context.maps.paymentMethods.has('payment-delete-agent')).toBe(false);

        createPaymentMethodCommand(context, {
            id: 'payment-referenced-agent',
            title: 'Referenced payment',
        });
        context.maps.invoices.set('invoice-payment-reference', objectToYMap({
            id: 'invoice-payment-reference',
            projectId: null,
            clientId: 'client-1',
            invoiceNumber: 'INV-PAYMENT-REFERENCE',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 0,
            total: 0,
            paymentMethodId: 'payment-referenced-agent',
        }));

        expect(() => deletePaymentMethodCommand(context, {
            paymentMethodId: 'payment-referenced-agent',
            confirmDelete: true,
            confirmationText: 'payment-referenced-agent',
        })).toThrow(/referenced by an invoice/);

        createPaymentMethodCommand(context, {
            id: 'payment-dispatch-delete',
            title: 'Dispatch payment delete',
        });

        await expect(executeAgentCommand(context, 'delete_payment_method', {
            paymentMethodId: 'payment-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'payment-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_payment_method',
            data: {
                paymentMethodId: 'payment-dispatch-delete',
                title: 'Dispatch payment delete',
                deleted: true,
            },
        }));
        expect(context.maps.paymentMethods.has('payment-dispatch-delete')).toBe(false);
    });

    it('manages business brand assets and deletes only unreferenced assets with approval', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:30:00Z');
        createBusinessInfoCommand(context, {
            id: 'business-logo-owner',
            title: 'Logo Owner',
            businessName: 'Logo Owner',
        });

        const createdAsset = createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-1',
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,AAAA',
            mimeType: 'image/png',
            fileName: 'logo.png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-1',
        });

        expect(createdAsset).toEqual(expect.objectContaining({
            id: 'brand-asset-1',
            businessInfoId: 'business-logo-owner',
            kind: 'logo',
            createdAt: Date.parse('2026-06-25T12:30:00Z'),
            updatedAt: Date.parse('2026-06-25T12:30:00Z'),
            archivedAt: null,
        }));

        expect(createBusinessBrandAssetCommand(context, {
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,BBBB',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-1',
        }).id).toBe('brand-asset-1');

        expect(listBusinessBrandAssetsCommand(context, {
            businessInfoId: 'business-logo-owner',
        })).toEqual([
            expect.not.objectContaining({
                dataUrl: expect.any(String),
            }),
        ]);
        expect(listBusinessBrandAssetsCommand(context, {
            businessInfoId: 'business-logo-owner',
            includeDataUrl: true,
        })).toEqual([
            expect.objectContaining({
                dataUrl: 'data:image/png;base64,AAAA',
            }),
        ]);

        const updatedAsset = updateBusinessBrandAssetCommand(context, {
            businessBrandAssetId: 'brand-asset-1',
            updates: {
                fileName: 'updated-logo.png',
            },
        });

        expect(updatedAsset).toEqual(expect.objectContaining({
            fileName: 'updated-logo.png',
            updatedAt: Date.parse('2026-06-25T12:30:00Z'),
        }));

        expect(archiveBusinessBrandAssetCommand(context, { businessBrandAssetId: 'brand-asset-1' })).toEqual(expect.objectContaining({
            archivedAt: Date.parse('2026-06-25T12:30:00Z'),
        }));
        expect(listBusinessBrandAssetsCommand(context, { businessInfoId: 'business-logo-owner' })).toEqual([]);
        expect(listBusinessBrandAssetsCommand(context, {
            businessInfoId: 'business-logo-owner',
            includeArchived: true,
        })).toEqual([
            expect.objectContaining({
                id: 'brand-asset-1',
                hasDataUrl: true,
            }),
        ]);

        expect(unarchiveBusinessBrandAssetCommand(context, { businessBrandAssetId: 'brand-asset-1' })).toEqual(expect.objectContaining({
            archivedAt: null,
        }));

        await expect(executeAgentCommand(context, 'archive_business_brand_asset', {
            businessBrandAssetId: 'brand-asset-1',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'archive_business_brand_asset',
            data: expect.objectContaining({
                archivedAt: Date.parse('2026-06-25T12:30:00Z'),
            }),
        }));

        await expect(executeAgentCommand(context, 'create_business_brand_asset', {
            businessInfoId: 'missing-business',
            dataUrl: 'data:image/png;base64,AAAA',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-missing',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'create_business_brand_asset',
            error: expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        }));

        const deleteAsset = createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-delete',
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,CCCC',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-delete',
        });

        expect(() => deleteBusinessBrandAssetCommand(context, {
            businessBrandAssetId: deleteAsset.id,
        })).toThrow(/confirmDelete/);

        expect(() => deleteBusinessBrandAssetCommand(context, {
            businessBrandAssetId: deleteAsset.id,
            confirmDelete: true,
            confirmationText: 'wrong-asset',
        })).toThrow(/confirmationText/);

        expect(deleteBusinessBrandAssetCommand(context, {
            businessBrandAssetId: deleteAsset.id,
            confirmDelete: true,
            confirmationText: deleteAsset.id,
        })).toEqual({
            businessBrandAssetId: deleteAsset.id,
            businessInfoId: 'business-logo-owner',
            contentHash: 'logo-hash-delete',
            deleted: true,
        });
        expect(context.maps.businessBrandAssets.has(deleteAsset.id)).toBe(false);

        const businessReferencedAsset = createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-business-reference',
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,DDDD',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-business-reference',
        });
        updateBusinessInfoCommand(context, {
            businessInfoId: 'business-logo-owner',
            updates: {
                branding: {
                    logoAssetId: businessReferencedAsset.id,
                },
            },
        });

        expect(() => deleteBusinessBrandAssetCommand(context, {
            businessBrandAssetId: businessReferencedAsset.id,
            confirmDelete: true,
            confirmationText: businessReferencedAsset.id,
        })).toThrow(/business profile/);

        const invoiceReferencedAsset = createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-invoice-reference',
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,EEEE',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-invoice-reference',
        });
        context.maps.invoices.set('invoice-brand-asset-reference', objectToYMap({
            id: 'invoice-brand-asset-reference',
            projectId: null,
            clientId: 'client-1',
            invoiceNumber: 'INV-BRAND-ASSET-REFERENCE',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 0,
            total: 0,
            brandingSnapshot: {
                logoPlacement: 'invoice-left-logo-right',
                showBusinessLogo: true,
                useBusinessPrimaryColor: false,
                logoAssetId: invoiceReferencedAsset.id,
            },
        }));

        expect(() => deleteBusinessBrandAssetCommand(context, {
            businessBrandAssetId: invoiceReferencedAsset.id,
            confirmDelete: true,
            confirmationText: invoiceReferencedAsset.id,
        })).toThrow(/invoice branding snapshot/);

        const dispatchAsset = createBusinessBrandAssetCommand(context, {
            id: 'brand-asset-dispatch-delete',
            businessInfoId: 'business-logo-owner',
            dataUrl: 'data:image/png;base64,FFFF',
            mimeType: 'image/png',
            width: 120,
            height: 40,
            byteSize: 3,
            contentHash: 'logo-hash-dispatch-delete',
        });

        await expect(executeAgentCommand(context, 'delete_business_brand_asset', {
            businessBrandAssetId: dispatchAsset.id,
            confirmDelete: true,
            confirmationText: dispatchAsset.id,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_business_brand_asset',
            data: {
                businessBrandAssetId: dispatchAsset.id,
                businessInfoId: 'business-logo-owner',
                contentHash: 'logo-hash-dispatch-delete',
                deleted: true,
            },
        }));
        expect(context.maps.businessBrandAssets.has(dispatchAsset.id)).toBe(false);
    });

    it('manages invoice and email templates with type-aware defaults', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T13:00:00Z');

        const invoiceTemplateOne = createInvoiceTemplateCommand(context, {
            id: 'invoice-template-1',
            name: 'Classic invoices',
            prefix: 'INV-',
            useSequentialNumbers: true,
            isDefault: true,
        });
        const invoiceTemplateTwo = createInvoiceTemplateCommand(context, {
            id: 'invoice-template-2',
            name: 'Neutral invoices',
            layoutStyle: 'neutral',
            isDefault: true,
        });

        expect(invoiceTemplateOne).toEqual(expect.objectContaining({
            currentSequentialNumber: 1,
            isDefault: true,
        }));
        expect(invoiceTemplateTwo).toEqual(expect.objectContaining({
            isDefault: true,
        }));
        expect(readStored<any>(context.maps.invoiceTemplates, 'invoice-template-1')).toEqual(expect.objectContaining({
            isDefault: false,
        }));

        const updatedInvoiceTemplate = updateInvoiceTemplateCommand(context, {
            invoiceTemplateId: 'invoice-template-1',
            updates: {
                isDefault: true,
                defaultDueDays: 14,
            },
        });

        expect(updatedInvoiceTemplate).toEqual(expect.objectContaining({
            isDefault: true,
            defaultDueDays: 14,
        }));
        expect(readStored<any>(context.maps.invoiceTemplates, 'invoice-template-2')).toEqual(expect.objectContaining({
            isDefault: false,
        }));
        expect(setDefaultInvoiceTemplateCommand(context, { invoiceTemplateId: 'invoice-template-2' })).toEqual(expect.objectContaining({ isDefault: true }));
        expect(listInvoiceTemplatesCommand(context)[0].id).toBe('invoice-template-2');

        createInvoiceTemplateCommand(context, {
            id: 'invoice-template-delete',
            name: 'Delete invoice template',
        });

        expect(() => deleteInvoiceTemplateCommand(context, {
            invoiceTemplateId: 'invoice-template-delete',
        })).toThrow(/confirmDelete/);

        expect(() => deleteInvoiceTemplateCommand(context, {
            invoiceTemplateId: 'invoice-template-delete',
            confirmDelete: true,
            confirmationText: 'wrong-template',
        })).toThrow(/confirmationText/);

        expect(deleteInvoiceTemplateCommand(context, {
            invoiceTemplateId: 'invoice-template-delete',
            confirmDelete: true,
            confirmationText: 'invoice-template-delete',
        })).toEqual({
            invoiceTemplateId: 'invoice-template-delete',
            name: 'Delete invoice template',
            deleted: true,
        });
        expect(context.maps.invoiceTemplates.has('invoice-template-delete')).toBe(false);

        createInvoiceTemplateCommand(context, {
            id: 'invoice-template-referenced',
            name: 'Referenced invoice template',
        });
        context.maps.invoices.set('invoice-template-reference', objectToYMap({
            id: 'invoice-template-reference',
            projectId: null,
            clientId: 'client-1',
            invoiceNumber: 'INV-TEMPLATE-REFERENCE',
            date: '2026-06-25',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 0,
            templateId: 'invoice-template-referenced',
        }));

        expect(() => deleteInvoiceTemplateCommand(context, {
            invoiceTemplateId: 'invoice-template-referenced',
            confirmDelete: true,
            confirmationText: 'invoice-template-referenced',
        })).toThrow(/referenced by an invoice/);

        createInvoiceTemplateCommand(context, {
            id: 'invoice-template-dispatch-delete',
            name: 'Dispatch invoice template delete',
        });

        await expect(executeAgentCommand(context, 'delete_invoice_template', {
            invoiceTemplateId: 'invoice-template-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'invoice-template-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_invoice_template',
            data: {
                invoiceTemplateId: 'invoice-template-dispatch-delete',
                name: 'Dispatch invoice template delete',
                deleted: true,
            },
        }));
        expect(context.maps.invoiceTemplates.has('invoice-template-dispatch-delete')).toBe(false);

        const invoiceEmailTemplate = createEmailTemplateCommand(context, {
            id: 'email-template-invoice',
            name: 'Invoice email',
            type: 'invoice',
            subject: 'Invoice {invoiceNumber}',
            sendBody: 'Please pay',
            reminderBody: 'Reminder',
            attachmentTitle: 'invoice-{invoiceNumber}',
            isDefault: true,
        });
        const quoteEmailTemplate = createEmailTemplateCommand(context, {
            id: 'email-template-quote',
            name: 'Quote email',
            type: 'quote',
            subject: 'Quote {invoiceNumber}',
            sendBody: 'Please review',
            reminderBody: 'Quote reminder',
            attachmentTitle: 'quote-{invoiceNumber}',
            isDefault: true,
        });
        const secondInvoiceEmailTemplate = createEmailTemplateCommand(context, {
            id: 'email-template-invoice-2',
            name: 'Invoice email 2',
            type: 'invoice',
            subject: 'Invoice 2 {invoiceNumber}',
            sendBody: 'Please pay 2',
            reminderBody: 'Reminder 2',
            attachmentTitle: 'invoice2-{invoiceNumber}',
            isDefault: true,
        });

        expect(invoiceEmailTemplate).toEqual(expect.objectContaining({
            isDefault: true,
            createdAt: Date.parse('2026-06-25T13:00:00Z'),
        }));
        expect(quoteEmailTemplate).toEqual(expect.objectContaining({
            isDefault: true,
        }));
        expect(secondInvoiceEmailTemplate).toEqual(expect.objectContaining({
            isDefault: true,
        }));
        expect(readStored<any>(context.maps.emailTemplates, 'email-template-invoice')).toEqual(expect.objectContaining({
            isDefault: false,
        }));
        expect(readStored<any>(context.maps.emailTemplates, 'email-template-quote')).toEqual(expect.objectContaining({
            isDefault: true,
        }));

        const updatedEmailTemplate = updateEmailTemplateCommand(context, {
            emailTemplateId: 'email-template-invoice',
            updates: {
                isDefault: true,
                replyTo: 'reply@example.com',
            },
        });

        expect(updatedEmailTemplate).toEqual(expect.objectContaining({
            isDefault: true,
            replyTo: 'reply@example.com',
            updatedAt: Date.parse('2026-06-25T13:00:00Z'),
        }));
        expect(readStored<any>(context.maps.emailTemplates, 'email-template-invoice-2')).toEqual(expect.objectContaining({
            isDefault: false,
        }));
        expect(readStored<any>(context.maps.emailTemplates, 'email-template-quote')).toEqual(expect.objectContaining({
            isDefault: true,
        }));

        expect(setDefaultEmailTemplateCommand(context, { emailTemplateId: 'email-template-invoice-2' })).toEqual(expect.objectContaining({ isDefault: true }));
        expect(listEmailTemplatesCommand(context, { type: 'quote' }).map((template) => template.id)).toEqual(['email-template-quote']);
        expect(await executeAgentCommand(context, 'set_default_email_template', {
            emailTemplateId: 'email-template-invoice',
        })).toEqual(expect.objectContaining({
            ok: true,
            command: 'set_default_email_template',
        }));
    });

    it('deletes email templates only with explicit confirmation', async () => {
        const context = createContext();

        createEmailTemplateCommand(context, {
            id: 'email-template-delete',
            name: 'Delete email template',
            type: 'invoice',
            subject: 'Invoice {{invoiceNumber}}',
            sendBody: 'Invoice body',
            reminderBody: 'Reminder body',
            attachmentTitle: 'Invoice {{invoiceNumber}}',
        });

        expect(() => deleteEmailTemplateCommand(context, {
            emailTemplateId: 'email-template-delete',
        })).toThrow(/confirmDelete/);

        expect(() => deleteEmailTemplateCommand(context, {
            emailTemplateId: 'email-template-delete',
            confirmDelete: true,
            confirmationText: 'wrong-template',
        })).toThrow(/confirmationText/);

        const deleted = deleteEmailTemplateCommand(context, {
            emailTemplateId: 'email-template-delete',
            confirmDelete: true,
            confirmationText: 'email-template-delete',
        });

        expect(deleted).toEqual({
            emailTemplateId: 'email-template-delete',
            name: 'Delete email template',
            type: 'invoice',
            deleted: true,
        });
        expect(context.maps.emailTemplates.has('email-template-delete')).toBe(false);

        createEmailTemplateCommand(context, {
            id: 'email-template-dispatch-delete',
            name: 'Dispatch delete email template',
            type: 'quote',
            subject: 'Quote {{invoiceNumber}}',
            sendBody: 'Quote body',
            reminderBody: 'Quote reminder',
            attachmentTitle: 'Quote {{invoiceNumber}}',
        });

        await expect(executeAgentCommand(context, 'delete_email_template', {
            emailTemplateId: 'email-template-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'email-template-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_email_template',
            data: {
                emailTemplateId: 'email-template-dispatch-delete',
                name: 'Dispatch delete email template',
                type: 'quote',
                deleted: true,
            },
        }));
        expect(context.maps.emailTemplates.has('email-template-dispatch-delete')).toBe(false);
    });

    it('manages expense categories non-destructively through validated settings commands', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T13:00:00Z');

        const createdCategory = createExpenseCategoryCommand(context, {
            id: 'category-agent-tools',
            name: 'AI Tools',
            group: 'software',
            isDefault: true,
        });

        expect(createdCategory).toEqual(expect.objectContaining({
            id: 'category-agent-tools',
            name: 'AI Tools',
            group: 'software',
            isDefault: true,
            archived: false,
            createdAt: Date.parse('2026-06-25T13:00:00Z'),
            updatedAt: Date.parse('2026-06-25T13:00:00Z'),
        }));
        expect(listExpenseCategoriesCommand(context).map((category) => category.id)).toEqual(['category-agent-tools']);

        const updatedCategory = updateExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-agent-tools',
            updates: {
                name: 'Automation Tools',
                group: null,
                isDefault: false,
            },
        });

        expect(updatedCategory).toEqual(expect.objectContaining({
            name: 'Automation Tools',
            group: null,
            isDefault: false,
            updatedAt: Date.parse('2026-06-25T13:00:00Z'),
        }));

        expect(archiveExpenseCategoryCommand(context, { expenseCategoryId: 'category-agent-tools' })).toEqual(expect.objectContaining({
            archived: true,
        }));
        expect(listExpenseCategoriesCommand(context)).toEqual([]);
        expect(listExpenseCategoriesCommand(context, { includeArchived: true }).map((category) => category.id)).toEqual(['category-agent-tools']);

        expect(unarchiveExpenseCategoryCommand(context, { expenseCategoryId: 'category-agent-tools' })).toEqual(expect.objectContaining({
            archived: false,
        }));
        expect(listExpenseCategoriesCommand(context).map((category) => category.id)).toEqual(['category-agent-tools']);

        await expect(executeAgentCommand(context, 'archive_expense_category', {
            expenseCategoryId: 'category-agent-tools',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'archive_expense_category',
            data: expect.objectContaining({
                archived: true,
            }),
        }));
        expect(readStored<any>(context.maps.expenseCategories, 'category-agent-tools')).toEqual(expect.objectContaining({
            archived: true,
        }));
    });

    it('deletes only unreferenced expense categories with explicit confirmation', async () => {
        const context = createContext();

        createExpenseCategoryCommand(context, {
            id: 'category-delete-agent',
            name: 'Delete category',
        });

        expect(() => deleteExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-delete-agent',
        })).toThrow(/confirmDelete/);

        expect(() => deleteExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-category',
        })).toThrow(/confirmationText/);

        const deleted = deleteExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-delete-agent',
            confirmDelete: true,
            confirmationText: 'category-delete-agent',
        });

        expect(deleted).toEqual({
            expenseCategoryId: 'category-delete-agent',
            name: 'Delete category',
            deleted: true,
        });
        expect(context.maps.expenseCategories.has('category-delete-agent')).toBe(false);

        createExpenseCategoryCommand(context, {
            id: 'category-referenced-expense',
            name: 'Referenced expense category',
        });
        createExpenseCommand(context, {
            id: 'expense-category-reference',
            title: 'Categorized expense',
            date: '2026-06-25',
            amount: 10,
            currency: 'USD',
            isPersonal: false,
            billable: false,
            categoryId: 'category-referenced-expense',
        });

        expect(() => deleteExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-referenced-expense',
            confirmDelete: true,
            confirmationText: 'category-referenced-expense',
        })).toThrow(/referenced by an expense/);

        createExpenseCategoryCommand(context, {
            id: 'category-referenced-recurrence',
            name: 'Referenced recurrence category',
        });
        createExpenseRecurrenceCommand(context, {
            id: 'recurrence-category-reference',
            title: 'Categorized recurrence',
            currency: 'USD',
            amount: 15,
            amountType: 'fixed',
            repeat: 'yearly',
            startDate: '2026-06-25',
            isPersonal: true,
            billable: false,
            isTaxExempt: true,
            categoryId: 'category-referenced-recurrence',
            generateInitial: false,
        });

        expect(() => deleteExpenseCategoryCommand(context, {
            expenseCategoryId: 'category-referenced-recurrence',
            confirmDelete: true,
            confirmationText: 'category-referenced-recurrence',
        })).toThrow(/recurring expense template/);

        createExpenseCategoryCommand(context, {
            id: 'category-dispatch-delete',
            name: 'Dispatch delete category',
        });

        await expect(executeAgentCommand(context, 'delete_expense_category', {
            expenseCategoryId: 'category-dispatch-delete',
            confirmDelete: true,
            confirmationText: 'category-dispatch-delete',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_expense_category',
            data: {
                expenseCategoryId: 'category-dispatch-delete',
                name: 'Dispatch delete category',
                deleted: true,
            },
        }));
        expect(context.maps.expenseCategories.has('category-dispatch-delete')).toBe(false);
    });

    it('reads and updates non-sync preferences while rejecting sync controls', async () => {
        const context = createContext();
        context.maps.preferences.set('theme', 'system');
        context.maps.preferences.set('weekStartsOn', 1);
        context.maps.preferences.set('autoSyncEnabled', false);

        const preferences = getPreferencesCommand(context);

        expect(preferences).toEqual(expect.objectContaining({
            currency: 'USD',
            theme: 'system',
            weekStartsOn: 1,
            autoSyncEnabled: false,
        }));

        const updated = updatePreferencesCommand(context, {
            updates: {
                currency: 'EUR',
                theme: 'dark',
                defaultView: 'planner',
                weekStartsOn: 0,
                weeklyGoalTargetHours: 30,
                weeklyGoalTargetEarnings: null,
                systemNotificationTime: '08:30',
            },
        });

        expect(updated).toEqual(expect.objectContaining({
            currency: 'EUR',
            theme: 'dark',
            defaultView: 'planner',
            weekStartsOn: 0,
            weeklyGoalTargetHours: 30,
            weeklyGoalTargetEarnings: null,
            systemNotificationTime: '08:30',
        }));
        expect(context.maps.preferences.get('currency')).toBe('EUR');
        expect(context.maps.preferences.get('autoSyncEnabled')).toBe(false);

        await expect(executeAgentCommand(context, 'update_preferences', {
            updates: {
                autoSyncEnabled: true,
                autoSyncMode: 'backup',
            },
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'update_preferences',
            error: expect.objectContaining({
                code: 'INVALID_INPUT',
                details: {
                    keys: ['autoSyncEnabled', 'autoSyncMode'],
                },
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'update_preferences', {
            updates: {
                theme: 'light',
            },
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'update_preferences',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'write' },
            }),
        }));
    });

    it('reads and updates explicit sync settings through the dedicated account command', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'export']);
        context.maps.preferences.set('autoSyncEnabled', false);
        context.maps.preferences.set('autoSyncMode', 'sync');
        context.maps.preferences.set('backupEnabled', true);
        context.maps.preferences.set('backupFrequencyHours', 24);

        expect(getSyncStatusCommand(context)).toEqual({
            isDriveConnected: true,
            syncState: 'idle',
            syncPhase: 'idle',
            driveSyncMode: 'manual',
            lastSyncedAt: Date.parse('2026-06-25T12:00:00.000Z'),
            pendingSyncChanges: true,
            autoSyncEnabled: false,
            autoSyncMode: 'sync',
            backupEnabled: true,
            backupFrequencyHours: 24,
        });

        await expect(updateSyncSettingsCommand(context, {
            autoSyncEnabled: true,
            autoSyncMode: 'backup',
        })).rejects.toThrow(/confirmBackupMode/);

        const updated = await updateSyncSettingsCommand(context, {
            autoSyncEnabled: true,
            autoSyncMode: 'backup',
            backupEnabled: false,
            backupFrequencyHours: 12,
            confirmBackupMode: true,
            runSync: true,
        });

        expect(updated).toEqual(expect.objectContaining({
            autoSyncEnabled: true,
            autoSyncMode: 'backup',
            backupEnabled: false,
            backupFrequencyHours: 12,
            driveSyncMode: 'backup',
            syncTriggered: true,
        }));
        expect(context.maps.preferences.get('autoSyncEnabled')).toBe(true);
        expect(context.maps.preferences.get('autoSyncMode')).toBe('backup');
        expect(context.maps.preferences.get('backupEnabled')).toBe(false);
        expect(context.maps.preferences.get('backupFrequencyHours')).toBe(12);
        expect(context.store.setDriveSyncPreferences).toHaveBeenCalledWith(true, 'backup');
        expect(context.store.forceDriveSync).toHaveBeenCalledTimes(1);

        await expect(executeAgentCommand(context, 'get_sync_status', {})).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'get_sync_status',
            data: expect.objectContaining({
                autoSyncMode: 'backup',
            }),
        }));

        context.permissions = new Set(['read', 'write']);
        await expect(executeAgentCommand(context, 'update_sync_settings', {
            autoSyncEnabled: false,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'update_sync_settings',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('deletes all account data only with explicit confirmation and Drive inclusion when connected', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'export']);

        await expect(deleteAllAccountDataCommand(context, {
            confirmDelete: false,
            confirmationText: 'DELETE ALL DATA',
            includeDriveData: true,
        })).rejects.toThrow(/confirmDelete/);

        await expect(deleteAllAccountDataCommand(context, {
            confirmDelete: true,
            confirmationText: 'wrong',
            includeDriveData: true,
        })).rejects.toThrow(/confirmationText/);

        await expect(deleteAllAccountDataCommand(context, {
            confirmDelete: true,
            confirmationText: 'DELETE ALL DATA',
        })).rejects.toThrow(/includeDriveData/);

        const deleted = await deleteAllAccountDataCommand(context, {
            confirmDelete: true,
            confirmationText: 'DELETE ALL DATA',
            includeDriveData: true,
        });

        expect(deleted).toEqual({
            deleted: true,
            localDataDeleted: true,
            driveDataDeleted: true,
            driveBackupsDeleted: true,
            driveAccessRevoked: true,
            reloadRecommended: true,
        });
        expect(context.store.wipeDriveData).toHaveBeenCalledTimes(1);
        expect(context.store.deleteAllBackups).toHaveBeenCalledTimes(1);
        expect(context.revokeDriveAccess).toHaveBeenCalledTimes(1);
        expect(context.store.clearAllData).toHaveBeenCalledTimes(1);
        expect(context.store.initialize).toHaveBeenCalledTimes(1);
        expect(context.maps.projects.size).toBe(0);

        await expect(executeAgentCommand(context, 'delete_all_account_data', {
            confirmDelete: true,
            confirmationText: 'DELETE ALL DATA',
            includeDriveData: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_all_account_data',
            data: expect.objectContaining({
                deleted: true,
            }),
        }));

        context.permissions = new Set(['read', 'write']);
        await expect(executeAgentCommand(context, 'delete_all_account_data', {
            confirmDelete: true,
            confirmationText: 'DELETE ALL DATA',
            includeDriveData: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'delete_all_account_data',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('requires an occurrence date when completing recurring tasks', () => {
        const context = createContext();
        const task = createTaskCommand(context, {
            id: 'task-recurring',
            title: 'Weekly review',
            recurring: { type: 'weekly', weeklyDays: [1] },
        });

        expect(() => completeTaskCommand(context, { taskId: task.id })).toThrow(AgentCommandError);

        const completed = completeTaskCommand(context, {
            taskId: task.id,
            occurrenceDate: '2026-06-22',
        });
        const repeated = completeTaskCommand(context, {
            taskId: task.id,
            occurrenceDate: '2026-06-22',
        });

        expect(completed.completedDatesByYear?.['2026']?.['6']).toContain(22);
        expect(repeated.completedDatesByYear?.['2026']?.['6']).toContain(22);
    });

    it('archives and unarchives tasks through the existing multi-doc store behavior', async () => {
        const context = createContext();
        const task = createTaskCommand(context, {
            id: 'task-archive-agent',
            title: 'Archive me',
            projectId: 'project-1',
        });

        await expect(archiveTaskCommand(context, { taskId: task.id })).resolves.toEqual({
            taskId: task.id,
            archived: true,
        });
        expect(context.maps.tasks.has(task.id)).toBe(false);
        expect(readStored(context.maps.archivedTasks, task.id)).toEqual(expect.objectContaining({
            archived: true,
            archivedOnDate: '2026-06-25',
        }));

        await expect(unarchiveTaskCommand(context, { taskId: task.id })).resolves.toEqual({
            taskId: task.id,
            archived: false,
        });
        expect(readStored(context.maps.tasks, task.id)).toEqual(expect.objectContaining({
            archived: false,
            archivedOnDate: null,
        }));
        expect(context.maps.archivedTasks.has(task.id)).toBe(false);

        await expect(unarchiveTaskCommand(context, { taskId: 'missing-archived-task' })).rejects.toThrow(/Archived task not found/);

        await archiveTaskCommand(context, { taskId: task.id });
        await expect(executeAgentCommand(context, 'unarchive_task', {
            taskId: task.id,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'unarchive_task',
            data: {
                taskId: task.id,
                archived: false,
            },
        }));
    });

    it('starts timers without silently replacing an existing timer', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });

        const timer = startTimerCommand(context, { taskId: 'task-1' });

        expect(timer.projectId).toBe('project-1');
        expect(readStored(context.maps.timers, 'project-1')).toEqual(expect.objectContaining({
            taskId: 'task-1',
        }));
        expect(() => startTimerCommand(context, { taskId: 'task-1' })).toThrow(/already active/);
    });

    it('stops timers by creating a time entry and clearing the active timer', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });
        startTimerCommand(context, { taskId: 'task-1' });

        const result = stopTimerCommand(context, { timerKey: 'project-1' });

        expect(result.timerKey).toBe('project-1');
        expect(result.entry.taskId).toBe('task-1');
        expect(context.maps.timers.has('project-1')).toBe(false);
        expect(readStored(context.maps.entries, result.entry.id)).toEqual(expect.objectContaining({
            taskId: 'task-1',
            _stoppedTimerKey: 'project-1',
        }));
    });

    it('reuses a timer-instance entry after entry creation succeeded but timer cleanup did not', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });
        const timer = startTimerCommand(context, { taskId: 'task-1' });
        const recoveredEntry = {
            id: 'existing-stop-entry',
            taskId: 'task-1',
            start: timer.startTime,
            end: timer.startTime + 1_000,
            _stoppedTimerKey: 'project-1',
            _stoppedTimerInstanceId: timer.timerInstanceId,
        };
        context.maps.entries.set(recoveredEntry.id, objectToYMap(recoveredEntry));

        const result = stopTimerCommand(context, { timerKey: 'project-1' });

        expect(result.entry.id).toBe('existing-stop-entry');
        expect(context.maps.entries.size).toBe(1);
        expect(context.maps.timers.has('project-1')).toBe(false);
    });

    it('replays a completed timer stop by durable operation identity after session state is lost', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });
        startTimerCommand(context, { taskId: 'task-1' });

        const first = stopTimerCommand(context, {
            timerKey: 'project-1',
            idempotencyKey: 'stop-operation-1',
        });
        context.idempotency = new Map();
        const replay = stopTimerCommand(context, {
            timerKey: 'project-1',
            idempotencyKey: 'stop-operation-1',
        });

        expect(replay).toEqual(first);
        expect(context.maps.entries.size).toBe(1);
    });

    it('resumes, updates, and approval-confirms timer clearing', async () => {
        const context = createContext();
        let now = 100_000;
        context.now = () => now;
        createTaskCommand(context, {
            id: 'task-timer-parity',
            title: 'Timer parity task',
            projectId: 'project-1',
        });

        startTimerCommand(context, { taskId: 'task-timer-parity', note: 'Initial note' });
        expect(updateTimerCommand(context, {
            timerKey: 'project-1',
            note: 'Updated note',
            startTime: 98_000,
        })).toEqual(expect.objectContaining({
            note: 'Updated note',
            startTime: 98_000,
        }));

        pauseTimerCommand(context, { timerKey: 'project-1', pausedAt: 104_000 });
        now = 110_000;
        expect(resumeTimerCommand(context, { taskId: 'task-timer-parity' })).toEqual(expect.objectContaining({
            paused: false,
            pausedElapsedTime: 0,
            startTime: 104_000,
        }));

        expect(() => clearTimerCommand(context, {
            timerKey: 'project-1',
            confirmClear: true,
            confirmationText: 'wrong',
        })).toThrow(/confirmationText/);
        await expect(executeAgentCommand(context, 'clear_timer', {
            timerKey: 'project-1',
            confirmClear: true,
            confirmationText: 'project-1',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'clear_timer',
            data: {
                timerKey: 'project-1',
                taskId: 'task-timer-parity',
                cleared: true,
            },
        }));
        expect(context.maps.timers.has('project-1')).toBe(false);
    });

    it('manages planner attachments, daily goals, and project notes through typed parity commands', async () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-planner-agent',
            title: 'Planner task',
            projectId: 'project-1',
        });

        const weekResult = attachPlannerItemCommand(context, {
            type: 'task',
            referenceId: 'task-planner-agent',
            mode: 'week',
            weekStartDate: '2026-07-06',
            includeWeekends: false,
            estimatedHours: 40,
        });

        expect(weekResult.created).toHaveLength(5);
        expect(weekResult.created.map((attachment) => attachment.date)).toEqual([
            '2026-07-06',
            '2026-07-07',
            '2026-07-08',
            '2026-07-09',
            '2026-07-10',
        ]);
        expect(weekResult.created.map((attachment) => attachment.estimatedHours)).toEqual([8, 8, 8, 8, 8]);
        expect(() => attachPlannerItemCommand(context, {
            type: 'task',
            referenceId: 'task-planner-agent',
            mode: 'date',
            date: '2026-07-06',
        })).toThrow(/already attached/);

        const overwriteResult = attachPlannerItemCommand(context, {
            type: 'task',
            referenceId: 'task-planner-agent',
            mode: 'week',
            weekStartDate: '2026-07-06',
            includeWeekends: false,
            estimatedHours: 20,
            duplicateMode: 'overwrite',
        });

        expect(overwriteResult.updated).toHaveLength(5);
        expect(overwriteResult.updated.map((attachment) => attachment.estimatedHours)).toEqual([4, 4, 4, 4, 4]);

        const firstAttachmentId = weekResult.created[0].id;
        expect(updatePlannerAttachmentCommand(context, {
            plannerAttachmentId: firstAttachmentId,
            estimatedHours: 2.5,
        })).toEqual(expect.objectContaining({
            id: firstAttachmentId,
            estimatedHours: 2.5,
        }));
        expect(listPlannerAttachmentsCommand(context, {
            type: 'task',
            referenceId: 'task-planner-agent',
        })).toHaveLength(5);
        expect(removePlannerAttachmentCommand(context, {
            plannerAttachmentId: firstAttachmentId,
        })).toEqual({
            plannerAttachmentId: firstAttachmentId,
            referenceId: 'task-planner-agent',
            type: 'task',
            removed: true,
        });
        expect(context.maps.plannerAttachments.has(firstAttachmentId)).toBe(false);

        const everyWeek = await executeAgentCommand(context, 'attach_planner_item', {
            type: 'project',
            referenceId: 'project-1',
            mode: 'every-week',
            weekStartDate: '2026-07-06',
            includeWeekends: false,
            estimatedHours: 10,
        });
        expect(everyWeek).toEqual(expect.objectContaining({
            ok: true,
            command: 'attach_planner_item',
        }));

        expect(setDailyGoalCommand(context, {
            weekday: 1,
            targetHours: 30,
            targetEarnings: -5,
        })).toEqual(expect.objectContaining({
            weekday: 1,
            goal: expect.objectContaining({
                id: '1',
                weekday: 1,
                targetHours: 24,
                targetEarnings: 0,
            }),
            removed: false,
        }));
        expect(listDailyGoalsCommand(context)).toHaveLength(1);
        expect(removeDailyGoalCommand(context, { weekday: 1 })).toEqual({ weekday: 1, removed: true });
        expect(listDailyGoalsCommand(context)).toEqual([]);

        expect(updateProjectNotesCommand(context, {
            projectId: 'project-1',
            plainText: 'Alpha\nBeta',
        })).toEqual(expect.objectContaining({
            projectId: 'project-1',
            plainText: 'Alpha\nBeta',
            notes: expect.objectContaining({
                type: 'tiptap-json',
                plainTextPreview: 'Alpha\nBeta',
            }),
        }));
        expect(getProjectNotesCommand(context, { projectId: 'project-1' })).toEqual(expect.objectContaining({
            plainText: 'Alpha\nBeta',
        }));
        expect(updateProjectNotesCommand(context, {
            projectId: 'project-1',
            clear: true,
        })).toEqual(expect.objectContaining({
            projectId: 'project-1',
            plainText: '',
        }));
    });

    it('rejects manual entries before the task billing cutoff', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-billed',
            title: 'Billed task',
            projectId: 'project-1',
            lastBilledAt: 5000,
        });

        expect(() => addManualTimeEntryCommand(context, {
            taskId: 'task-billed',
            start: 4000,
            end: 4500,
        })).toThrow(/latest billed/);

        const entry = addManualTimeEntryCommand(context, {
            taskId: 'task-billed',
            start: 6000,
            end: 7000,
            note: 'Post-billing work',
        });

        expect(readStored(context.maps.entries, entry.id)).toEqual(expect.objectContaining({
            taskId: 'task-billed',
            note: 'Post-billing work',
        }));
    });

    it('updates active unbilled time entries with billing and overlap validation', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:30:00Z');
        createTaskCommand(context, {
            id: 'task-entry-edit',
            title: 'Entry edit task',
            projectId: 'project-1',
            lastBilledAt: 1000,
        });
        createTaskCommand(context, {
            id: 'task-entry-other',
            title: 'Other task',
            projectId: 'project-1',
        });

        const entry = addManualTimeEntryCommand(context, {
            taskId: 'task-entry-edit',
            start: 2000,
            end: 3000,
            note: 'Original entry',
        });
        addManualTimeEntryCommand(context, {
            taskId: 'task-entry-other',
            start: 5000,
            end: 6000,
        });

        const updated = updateTimeEntryCommand(context, {
            entryId: entry.id,
            start: 3000,
            end: 3900,
            note: 'Updated entry',
            billingIncrementMinutes: 15,
        });

        expect(updated).toEqual(expect.objectContaining({
            id: entry.id,
            taskId: 'task-entry-edit',
            start: 3000,
            end: 3900,
            note: 'Updated entry',
            billedDurationMs: 15 * 60 * 1000,
            billingIncrementMinutes: 15,
            updatedAt: Date.parse('2026-06-25T12:30:00Z'),
        }));
        expect(readStored(context.maps.entries, entry.id)).toEqual(expect.objectContaining({
            note: 'Updated entry',
            billedDurationMs: 15 * 60 * 1000,
            billingIncrementMinutes: 15,
        }));

        expect(() => updateTimeEntryCommand(context, {
            entryId: entry.id,
            start: 900,
        })).toThrow(/latest billed/);

        expect(() => updateTimeEntryCommand(context, {
            entryId: entry.id,
            start: 5500,
            end: 5600,
        })).toThrow(/overlap/i);

        context.maps.entries.set('entry-billed-agent-edit', objectToYMap({
            id: 'entry-billed-agent-edit',
            taskId: 'task-entry-edit',
            start: 7000,
            end: 8000,
            billedAt: 8000,
            billedInvoiceId: 'invoice-entry-edit',
        }));

        expect(() => updateTimeEntryCommand(context, {
            entryId: 'entry-billed-agent-edit',
            note: 'Nope',
        })).toThrow(/Billed time entries/);

        await expect(executeAgentCommand(context, 'update_time_entry', {
            entryId: entry.id,
            note: 'Dispatcher entry note',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'update_time_entry',
            data: expect.objectContaining({
                note: 'Dispatcher entry note',
            }),
        }));
    });

    it('deletes active unbilled time entries only with explicit confirmation', async () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-entry-delete',
            title: 'Entry delete task',
            projectId: 'project-1',
        });

        const entry = addManualTimeEntryCommand(context, {
            taskId: 'task-entry-delete',
            start: 2000,
            end: 5000,
            note: 'Delete me',
        });

        expect(() => deleteTimeEntryCommand(context, {
            entryId: entry.id,
        })).toThrow(/confirmDelete/);

        expect(() => deleteTimeEntryCommand(context, {
            entryId: entry.id,
            confirmDelete: true,
            confirmationText: 'wrong-entry',
        })).toThrow(/confirmationText/);

        const deleted = deleteTimeEntryCommand(context, {
            entryId: entry.id,
            confirmDelete: true,
            confirmationText: entry.id,
        });

        expect(deleted).toEqual({
            entryId: entry.id,
            taskId: 'task-entry-delete',
            start: 2000,
            end: 5000,
            durationMs: 3000,
            deleted: true,
        });
        expect(context.maps.entries.has(entry.id)).toBe(false);

        context.maps.entries.set('entry-billed-agent-delete', objectToYMap({
            id: 'entry-billed-agent-delete',
            taskId: 'task-entry-delete',
            start: 7000,
            end: 8000,
            billedAt: 8000,
            billedInvoiceId: 'invoice-entry-delete',
        }));

        expect(() => deleteTimeEntryCommand(context, {
            entryId: 'entry-billed-agent-delete',
            confirmDelete: true,
            confirmationText: 'entry-billed-agent-delete',
        })).toThrow(/Billed time entries/);

        const dispatchEntry = addManualTimeEntryCommand(context, {
            taskId: 'task-entry-delete',
            start: 9000,
            end: 10000,
        });

        await expect(executeAgentCommand(context, 'delete_time_entry', {
            entryId: dispatchEntry.id,
            confirmDelete: true,
            confirmationText: dispatchEntry.id,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_time_entry',
            data: expect.objectContaining({
                entryId: dispatchEntry.id,
                deleted: true,
            }),
        }));
        expect(context.maps.entries.has(dispatchEntry.id)).toBe(false);
    });

    it('creates expenses and marks same-currency expenses paid without fetching rates', async () => {
        const context = createContext();

        const expense = createExpenseCommand(context, {
            title: 'Hosting',
            date: '2026-06-25',
            amount: 20,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            clientId: 'client-1',
            projectId: 'project-1',
        });

        const paid = await markExpensePaidCommand(context, { expenseId: expense.id, paidBy: 'Card' });

        expect(readStored(context.maps.expenses, expense.id)).toEqual(expect.objectContaining({
            paymentStatus: 'paid',
            paidBy: 'Card',
        }));
        expect(paid.paymentStatus).toBe('paid');
    });

    it('deletes active unbilled and unclaimed expenses only with explicit confirmation', async () => {
        const context = createContext();

        const expense = createExpenseCommand(context, {
            id: 'expense-delete-agent',
            title: 'Delete expense',
            date: '2026-06-25',
            amount: 20,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            clientId: 'client-1',
            projectId: 'project-1',
        });

        expect(() => deleteExpenseCommand(context, {
            expenseId: expense.id,
        })).toThrow(/confirmDelete/);

        expect(() => deleteExpenseCommand(context, {
            expenseId: expense.id,
            confirmDelete: true,
            confirmationText: 'wrong-expense',
        })).toThrow(/confirmationText/);

        const deleted = deleteExpenseCommand(context, {
            expenseId: expense.id,
            confirmDelete: true,
            confirmationText: expense.id,
        });

        expect(deleted).toEqual({
            expenseId: expense.id,
            title: 'Delete expense',
            date: '2026-06-25',
            amount: 20,
            currency: 'USD',
            deleted: true,
        });
        expect(context.maps.expenses.has(expense.id)).toBe(false);

        const billedExpense = createExpenseCommand(context, {
            id: 'expense-billed-agent-delete',
            title: 'Billed expense',
            date: '2026-06-25',
            amount: 30,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            billingStatus: 'billed',
            invoiceId: 'invoice-expense-delete',
        });

        expect(() => deleteExpenseCommand(context, {
            expenseId: billedExpense.id,
            confirmDelete: true,
            confirmationText: billedExpense.id,
        })).toThrow(/Billed expenses/);

        const claimedExpense = createExpenseCommand(context, {
            id: 'expense-claimed-agent-delete',
            title: 'Claimed expense',
            date: '2026-06-25',
            amount: 40,
            currency: 'USD',
            isPersonal: false,
            billable: false,
            taxClaimStatus: 'claimed',
            taxClaimPeriodId: 'period-claimed',
        });

        expect(() => deleteExpenseCommand(context, {
            expenseId: claimedExpense.id,
            confirmDelete: true,
            confirmationText: claimedExpense.id,
        })).toThrow(/Tax-claimed expenses/);

        const dispatchExpense = createExpenseCommand(context, {
            id: 'expense-dispatch-delete',
            title: 'Dispatch delete expense',
            date: '2026-06-25',
            amount: 50,
            currency: 'USD',
            isPersonal: true,
            billable: false,
        });

        await expect(executeAgentCommand(context, 'delete_expense', {
            expenseId: dispatchExpense.id,
            confirmDelete: true,
            confirmationText: dispatchExpense.id,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_expense',
            data: expect.objectContaining({
                expenseId: dispatchExpense.id,
                deleted: true,
            }),
        }));
        expect(context.maps.expenses.has(dispatchExpense.id)).toBe(false);
    });

    it('manages recurring expense templates and generated initial expenses non-destructively', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T10:00:00Z');
        context.maps.businessInfos.set('business-recurring', objectToYMap({
            id: 'business-recurring',
            title: 'Recurring Business',
            businessName: 'Recurring Business',
        }));
        context.maps.expenseCategories.set('category-recurring', objectToYMap({
            id: 'category-recurring',
            name: 'Software',
            isDefault: false,
            archived: false,
        }));

        const created = createExpenseRecurrenceCommand(context, {
            id: 'recurrence-hosting',
            title: 'Monthly hosting',
            note: 'Server',
            supplierName: 'Host Co',
            paidBy: 'Card',
            paymentMode: 'auto',
            currency: 'USD',
            amount: 30,
            amountType: 'fixed',
            repeat: 'monthly',
            monthlyType: 'specific',
            monthlyDay: 25,
            startDate: '2026-06-25',
            clientId: 'client-1',
            projectId: 'project-1',
            businessId: 'business-recurring',
            categoryId: 'category-recurring',
            isPersonal: false,
            billable: true,
            isTaxExempt: false,
            taxLabel: 'VAT',
            taxRate: 22,
        });

        expect(created.recurrence).toEqual(expect.objectContaining({
            id: 'recurrence-hosting',
            title: 'Monthly hosting',
            active: true,
            lastGeneratedDate: '2026-06-25',
            createdAt: Date.parse('2026-06-25T10:00:00Z'),
        }));
        expect(created.generatedExpense).toEqual(expect.objectContaining({
            title: 'Monthly hosting',
            isRecurring: true,
            recurrenceId: 'recurrence-hosting',
            paymentStatus: 'paid',
        }));
        const generatedExpenseId = created.generatedExpense?.id || '';

        expect(readStored<any>(context.maps.expenses, generatedExpenseId)).toEqual(expect.objectContaining({
            amount: 30,
            billingStatus: 'unbilled',
        }));

        const updated = updateExpenseRecurrenceCommand(context, {
            recurrenceId: 'recurrence-hosting',
            updates: {
                title: 'Monthly hosting updated',
                amount: 35,
            },
        });

        expect(updated).toEqual(expect.objectContaining({
            title: 'Monthly hosting updated',
            amount: 35,
            updatedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));
        expect(readStored<any>(context.maps.expenses, generatedExpenseId)).toEqual(expect.objectContaining({
            title: 'Monthly hosting',
            amount: 30,
        }));

        expect(pauseExpenseRecurrenceCommand(context, { recurrenceId: 'recurrence-hosting' })).toEqual(expect.objectContaining({
            active: false,
        }));
        expect(listExpenseRecurrencesCommand(context, { activeOnly: true })).toEqual([]);
        expect(resumeExpenseRecurrenceCommand(context, { recurrenceId: 'recurrence-hosting' })).toEqual(expect.objectContaining({
            active: true,
        }));
        expect(listExpenseRecurrencesCommand(context, { clientId: 'client-1' }).map((recurrence) => recurrence.id)).toEqual(['recurrence-hosting']);

        await expect(executeAgentCommand(context, 'pause_expense_recurrence', {
            recurrenceId: 'recurrence-hosting',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'pause_expense_recurrence',
            data: expect.objectContaining({
                active: false,
            }),
        }));

        await expect(executeAgentCommand(context, 'create_expense_recurrence', {
            title: 'Broken monthly',
            currency: 'USD',
            amount: 10,
            amountType: 'fixed',
            repeat: 'monthly',
            monthlyType: 'specific',
            startDate: '2026-06-25',
            isPersonal: false,
            billable: true,
            isTaxExempt: false,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'create_expense_recurrence',
            error: expect.objectContaining({
                code: 'INVALID_INPUT',
                details: { field: 'monthlyDay' },
            }),
        }));
    });

    it('deletes recurring expense templates with confirmation without deleting generated expenses', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T10:00:00Z');

        const created = createExpenseRecurrenceCommand(context, {
            id: 'recurrence-delete-agent',
            title: 'Delete monthly hosting',
            currency: 'USD',
            amount: 30,
            amountType: 'fixed',
            repeat: 'monthly',
            monthlyType: 'specific',
            monthlyDay: 25,
            startDate: '2026-06-25',
            isPersonal: false,
            billable: true,
            isTaxExempt: false,
            generateInitial: true,
        });
        const generatedExpenseId = created.generatedExpense?.id || '';

        expect(() => deleteExpenseRecurrenceCommand(context, {
            recurrenceId: 'recurrence-delete-agent',
        })).toThrow(/confirmDelete/);

        expect(() => deleteExpenseRecurrenceCommand(context, {
            recurrenceId: 'recurrence-delete-agent',
            confirmDelete: true,
            confirmationText: 'wrong-recurrence',
        })).toThrow(/confirmationText/);

        const deleted = deleteExpenseRecurrenceCommand(context, {
            recurrenceId: 'recurrence-delete-agent',
            confirmDelete: true,
            confirmationText: 'recurrence-delete-agent',
        });

        expect(deleted).toEqual({
            recurrenceId: 'recurrence-delete-agent',
            title: 'Delete monthly hosting',
            generatedExpensesDeleted: 0,
            deleted: true,
        });
        expect(context.maps.expenseRecurrences.has('recurrence-delete-agent')).toBe(false);
        expect(readStored<any>(context.maps.expenses, generatedExpenseId)).toEqual(expect.objectContaining({
            id: generatedExpenseId,
            recurrenceId: 'recurrence-delete-agent',
            isRecurring: true,
        }));

        const dispatchRecurrence = createExpenseRecurrenceCommand(context, {
            id: 'recurrence-dispatch-delete',
            title: 'Dispatch recurrence delete',
            currency: 'USD',
            amount: 45,
            amountType: 'fixed',
            repeat: 'yearly',
            startDate: '2026-06-25',
            isPersonal: true,
            billable: false,
            isTaxExempt: true,
            generateInitial: false,
        });

        await expect(executeAgentCommand(context, 'delete_expense_recurrence', {
            recurrenceId: dispatchRecurrence.recurrence.id,
            confirmDelete: true,
            confirmationText: dispatchRecurrence.recurrence.id,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'delete_expense_recurrence',
            data: expect.objectContaining({
                recurrenceId: dispatchRecurrence.recurrence.id,
                generatedExpensesDeleted: 0,
                deleted: true,
            }),
        }));
        expect(context.maps.expenseRecurrences.has(dispatchRecurrence.recurrence.id)).toBe(false);
    });

    it('manages tax return periods and explicitly marks expenses claimed or unclaimed', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T10:00:00Z');

        const expense = createExpenseCommand(context, {
            id: 'expense-tax',
            title: 'Taxable expense',
            date: '2026-06-10',
            amount: 120,
            currency: 'USD',
            isPersonal: false,
            billable: false,
            clientId: 'client-1',
            projectId: 'project-1',
        });
        const period = createTaxReturnPeriodCommand(context, {
            id: 'tax-period-1',
            title: 'June VAT return',
            type: 'vat',
            startDate: '2026-06-01',
            endDate: '2026-06-30',
            businessInfoId: null,
            idempotencyKey: 'tax-period-create-1',
        });

        expect(period).toEqual(expect.objectContaining({
            id: 'tax-period-1',
            status: 'draft',
            createdAt: Date.parse('2026-06-25T10:00:00Z'),
        }));
        expect(createTaxReturnPeriodCommand(context, {
            title: 'Duplicate period',
            type: 'vat',
            startDate: '2026-06-01',
            endDate: '2026-06-30',
            idempotencyKey: 'tax-period-create-1',
        }).id).toBe('tax-period-1');
        expect(listTaxReturnPeriodsCommand(context)).toEqual([
            expect.objectContaining({ id: 'tax-period-1', title: 'June VAT return' }),
        ]);

        expect(() => updateTaxReturnPeriodCommand(context, {
            taxReturnPeriodId: 'tax-period-1',
            updates: {
                title: 'June VAT return filed',
                status: 'filed',
                filedAt: Date.parse('2026-07-01T09:00:00Z'),
            },
        })).toThrow(/explicit tax status commands/);

        const updatedPeriod = updateTaxReturnPeriodCommand(context, {
            taxReturnPeriodId: 'tax-period-1',
            updates: {
                title: 'June VAT return ready',
            },
        });

        expect(updatedPeriod).toEqual(expect.objectContaining({
            title: 'June VAT return ready',
            status: 'draft',
            updatedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));

        expect(() => markTaxReturnPeriodFiledCommand(context, {
            taxReturnPeriodId: 'tax-period-1',
            confirmFiled: false,
        })).toThrow(/confirmFiled/);

        const filedPeriod = markTaxReturnPeriodFiledCommand(context, {
            taxReturnPeriodId: 'tax-period-1',
            filedAt: Date.parse('2026-07-01T09:00:00Z'),
            confirmFiled: true,
        });

        expect(filedPeriod).toEqual(expect.objectContaining({
            title: 'June VAT return ready',
            status: 'filed',
            filedAt: Date.parse('2026-07-01T09:00:00Z'),
            updatedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));

        const paidPeriod = markTaxReturnPeriodPaidCommand(context, {
            taxReturnPeriodId: 'tax-period-1',
            paidAt: Date.parse('2026-07-05T09:00:00Z'),
            confirmPaid: true,
        });

        expect(paidPeriod).toEqual(expect.objectContaining({
            status: 'paid',
            filedAt: Date.parse('2026-07-01T09:00:00Z'),
            paidAt: Date.parse('2026-07-05T09:00:00Z'),
        }));

        await expect(executeAgentCommand(context, 'mark_tax_return_period_paid', {
            taxReturnPeriodId: 'tax-period-1',
            confirmPaid: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'mark_tax_return_period_paid',
            data: expect.objectContaining({
                status: 'paid',
            }),
        }));

        expect(() => markExpensesTaxClaimedCommand(context, {
            expenseIds: [expense.id],
            taxReturnPeriodId: 'tax-period-1',
            confirmClaim: false,
        })).toThrow(AgentCommandError);

        const claimed = markExpensesTaxClaimedCommand(context, {
            expenseIds: [expense.id, expense.id],
            taxReturnPeriodId: 'tax-period-1',
            confirmClaim: true,
        });

        expect(claimed).toEqual({
            expenseIds: [expense.id],
            taxReturnPeriodId: 'tax-period-1',
            updatedCount: 1,
        });
        expect(readStored(context.maps.expenses, expense.id)).toEqual(expect.objectContaining({
            taxClaimStatus: 'claimed',
            taxClaimPeriodId: 'tax-period-1',
            taxClaimedAt: Date.parse('2026-06-25T10:00:00Z'),
        }));

        expect(markExpensesTaxUnclaimedCommand(context, {
            expenseIds: [expense.id],
            confirmUnclaim: true,
        })).toEqual({
            expenseIds: [expense.id],
            updatedCount: 1,
        });
        expect(readStored(context.maps.expenses, expense.id)).toEqual(expect.objectContaining({
            taxClaimStatus: 'unclaimed',
            taxClaimPeriodId: null,
            taxClaimedAt: null,
        }));

        await expect(executeAgentCommand(context, 'mark_expenses_tax_claimed', {
            expenseIds: [expense.id],
            taxReturnPeriodId: 'tax-period-1',
            confirmClaim: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'mark_expenses_tax_claimed',
        }));
    });

    it('validates navigation targets before opening routes', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });
        startTimerCommand(context, { taskId: 'task-1' });

        expect(openDashboardViewCommand(context)).toEqual({ route: '/' });
        expect(openPlannerViewCommand(context, { year: 2026, week: 5 })).toEqual({ route: '/planner/2026/05' });
        expect(openAccountViewCommand(context, { section: 'agent' })).toEqual({ route: '/account?section=agent' });
        expect(openProjectViewCommand(context, { projectId: 'project-1' })).toEqual({ route: '/projects/project-1' });
        expect(openReportsViewCommand(context)).toEqual({ route: '/reports' });
        expect(focusRunningTimerCommand(context, { timerKey: 'project-1' })).toEqual({ route: '/', timerKey: 'project-1' });
        expect(context.openedRoutes).toEqual(['/', '/planner/2026/05', '/account?section=agent', '/projects/project-1', '/reports', '/']);
        expect(() => openProjectViewCommand(context, { projectId: 'missing' })).toThrow(AgentCommandError);
        expect(() => openPlannerViewCommand(context, { year: 2026 })).toThrow(AgentCommandError);
        expect(() => openAccountViewCommand(context, { section: 'missing' })).toThrow(AgentCommandError);
    });

    it('returns bounded read-only query summaries without exposing raw store records', async () => {
        const context = createContext();
        const task = createTaskCommand(context, {
            id: 'task-query',
            title: 'Query task',
            projectId: 'project-1',
        });

        addManualTimeEntryCommand(context, {
            taskId: task.id,
            start: 10_000,
            end: 20_000,
            note: 'Unbilled work',
        });
        context.maps.entries.set('entry-billed', objectToYMap({
            id: 'entry-billed',
            taskId: task.id,
            start: 30_000,
            end: 40_000,
            billedAt: 40_000,
            billedInvoiceId: 'invoice-1',
        }));
        createExpenseCommand(context, {
            id: 'expense-query',
            title: 'Billable expense',
            date: '2026-06-25',
            amount: 50,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            clientId: 'client-1',
            projectId: 'project-1',
        });
        context.maps.invoices.set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-06-25',
            status: 'draft',
            items: [],
            subtotal: 0,
            total: 100,
        }));

        expect(getDashboardSummaryCommand(context)).toEqual(expect.objectContaining({
            projectCount: 1,
            taskCount: 1,
            openTaskCount: 1,
            unbilledEntryCount: 1,
            unbilledDurationMs: 10_000,
            billableExpenseCount: 1,
            unbilledExpenseCount: 1,
            draftInvoiceCount: 1,
        }));
        expect(getProjectOverviewCommand(context, { projectId: 'project-1' })).toEqual(expect.objectContaining({
            taskCount: 1,
            unbilledEntryCount: 1,
            billableExpenseCount: 1,
            draftInvoiceCount: 1,
        }));
        expect(getClientOverviewCommand(context, { clientId: 'client-1' })).toEqual(expect.objectContaining({
            projectCount: 1,
            billableExpenseCount: 1,
            draftInvoiceCount: 1,
            openInvoiceTotal: 100,
        }));

        expect(findUnbilledTimeCommand(context, { projectId: 'project-1' })).toEqual([
            expect.objectContaining({
                id: 'agent-id-0',
                taskId: task.id,
                projectId: 'project-1',
                billed: false,
                durationMs: 10_000,
                note: 'Unbilled work',
            }),
        ]);
        expect(listRecentEntriesCommand(context, { limit: 1 })).toEqual([
            expect.objectContaining({
                id: 'entry-billed',
                billed: true,
                billedInvoiceId: 'invoice-1',
            }),
        ]);
        expect(listInvoicesCommand(context, {
            clientId: 'client-1',
            status: 'draft',
        })).toEqual([
            {
                id: 'invoice-1',
                invoiceNumber: 'INV-1',
                clientId: 'client-1',
                projectId: 'project-1',
                projectIds: ['project-1'],
                date: '2026-06-25',
                status: 'draft',
                subtotal: 0,
                total: 100,
            },
        ]);

        const response = await executeAgentCommand(context, 'get_dashboard_summary');
        expect(response).toEqual(expect.objectContaining({
            ok: true,
            command: 'get_dashboard_summary',
        }));
        await expect(executeAgentCommand(context, 'list_invoices', {
            projectId: 'project-1',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'list_invoices',
        }));
    });

    it('returns read-only report summaries using Reports-page filters and totals', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        const task = createTaskCommand(context, {
            id: 'task-report',
            title: 'Report task',
            projectId: 'project-1',
            billable: true,
        });

        context.maps.expenseCategories.set('category-software', objectToYMap({
            id: 'category-software',
            name: 'Software',
            group: 'software',
            isDefault: false,
            archived: false,
        }));
        context.maps.businessInfos.set('business-report', objectToYMap({
            id: 'business-report',
            title: 'TaskTime Pro LLC',
            businessName: 'TaskTime Pro LLC',
            country: 'SI',
            isDefault: true,
        }));
        context.maps.clients.set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
            country: 'SI',
        }));
        context.maps.invoices.set('invoice-report', objectToYMap({
            id: 'invoice-report',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            businessInfoId: 'business-report',
            invoiceNumber: 'INV-REPORT',
            date: '2026-06-15',
            dueDate: '2026-06-20',
            status: 'sent',
            items: [],
            subtotal: 100,
            tax: 22,
            taxRate: 22,
            total: 122,
            currency: 'USD',
        }));
        context.maps.expenses.set('expense-report', objectToYMap({
            id: 'expense-report',
            title: 'Report expense',
            date: '2026-06-12',
            amount: 24,
            amountExcludingTax: 20,
            taxRate: 20,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            paymentStatus: 'paid',
            clientId: 'client-1',
            projectId: 'project-1',
            businessId: 'business-report',
            categoryId: 'category-software',
        }));
        context.maps.entries.set('entry-report', objectToYMap({
            id: 'entry-report',
            taskId: task.id,
            start: Date.parse('2026-06-30T23:00:00Z'),
            end: Date.parse('2026-07-01T01:00:00Z'),
        }));
        context.maps.archivedTasks.set(task.id, objectToYMap({
            ...task,
            archived: true,
        }));
        context.maps.tasks.delete(task.id);

        const report = await getReportSummaryCommand(context, {
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
            projectId: 'project-1',
            includeRows: true,
        });

        expect(report).toEqual(expect.objectContaining({
            period: expect.objectContaining({
                startDate: '2026-06-01',
                endDate: '2026-06-30',
            }),
            preferredCurrency: 'USD',
            counts: expect.objectContaining({
                invoices: 1,
                issuedInvoices: 1,
                expenses: 1,
                timeEntries: 1,
                toInvoiceGroups: 1,
            }),
            totalsByCurrency: expect.objectContaining({
                revenueIssued: { USD: 122 },
                expenses: { USD: 24 },
                outputTax: { USD: 22 },
                inputTax: { USD: 4 },
                estimatedVatPosition: { USD: 18 },
            }),
            time: expect.objectContaining({
                totalHoursMs: 7_200_000,
                billableHoursMs: 7_200_000,
                uninvoicedHoursMs: 7_200_000,
                billableUtilization: 1,
            }),
            rows: expect.objectContaining({
                invoices: [
                    expect.objectContaining({
                        invoiceNumber: 'INV-REPORT',
                        total: 122,
                        status: 'overdue',
                    }),
                ],
                expenses: [
                    expect.objectContaining({
                        title: 'Report expense',
                        taxAmount: 4,
                        category: 'Software',
                    }),
                ],
                toInvoice: [
                    expect.objectContaining({
                        projectTitle: 'Project One',
                        uninvoicedHoursMs: 7_200_000,
                    }),
                ],
            }),
        }));

        await expect(executeAgentCommand(context, 'get_report_summary', {
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'get_report_summary',
        }));
    });

    it('exports report CSVs in the browser app context without returning file contents', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        const task = createTaskCommand(context, {
            id: 'task-report-export',
            title: 'Report export task',
            projectId: 'project-1',
            billable: true,
        });

        context.maps.invoices.set('invoice-report-export', objectToYMap({
            id: 'invoice-report-export',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-EXPORT',
            date: '2026-06-15',
            status: 'sent',
            items: [],
            subtotal: 100,
            tax: 0,
            total: 100,
            currency: 'USD',
        }));
        context.maps.invoices.set('invoice-report-export-2', objectToYMap({
            id: 'invoice-report-export-2',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-EXPORT-2',
            date: '2026-06-16',
            status: 'sent',
            items: [],
            subtotal: 50,
            tax: 0,
            total: 50,
            currency: 'USD',
        }));
        context.maps.entries.set('entry-report-export', objectToYMap({
            id: 'entry-report-export',
            taskId: task.id,
            start: Date.parse('2026-06-10T10:00:00Z'),
            end: Date.parse('2026-06-10T11:00:00Z'),
        }));
        context.permissions = new Set(['read', 'export']);

        const exported = await exportReportCsvCommand(context, {
            section: 'invoices',
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
            filename: 'agent-invoices',
            rowLimit: 1,
        });

        expect(exported).toEqual({
            section: 'invoices',
            filename: 'agent-invoices.csv',
            rowCount: 1,
            totalRowCount: 2,
            truncated: true,
            downloadStarted: true,
        });
        expect(csvMocks.buildCsvContent).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ key: 'invoiceNumber', header: 'invoiceNumber' }),
            ]),
            [expect.objectContaining({ invoiceNumber: 'INV-EXPORT', total: 100 })],
        );
        expect(csvMocks.downloadCsvFile).toHaveBeenCalledWith('agent-invoices.csv', 'mock,csv');

        await expect(executeAgentCommand(context, 'export_report_csv', {
            section: 'hours',
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'export_report_csv',
            data: expect.objectContaining({
                filename: 'report-hours-2026-06-01-to-2026-06-30.csv',
                rowCount: 1,
                downloadStarted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'export_report_csv', {
            section: 'invoices',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'export_report_csv',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('exports report PDFs in the browser app context for UI-backed PDF sections', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');

        context.maps.invoices.set('invoice-report-pdf', objectToYMap({
            id: 'invoice-report-pdf',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-PDF-REPORT',
            date: '2026-06-15',
            status: 'sent',
            items: [],
            subtotal: 100,
            tax: 5,
            total: 105,
            currency: 'USD',
        }));
        context.permissions = new Set(['read', 'export']);

        const exported = await exportReportPdfCommand(context, {
            section: 'invoices',
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
            filename: 'issued-agent-report',
        });

        expect(exported).toEqual({
            section: 'invoices',
            filename: 'issued-agent-report.pdf',
            downloadStarted: true,
        });
        expect(reportPdfMocks.exportInvoicesReportPdf).toHaveBeenCalledWith(expect.objectContaining({
            filename: 'issued-agent-report.pdf',
            periodLabel: '2026-06-01 to 2026-06-30',
            rows: [
                expect.objectContaining({
                    invoiceNumber: 'INV-PDF-REPORT',
                    total: '$105.00',
                }),
            ],
        }));

        await expect(executeAgentCommand(context, 'export_report_pdf', {
            section: 'expenses',
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'export_report_pdf',
            data: expect.objectContaining({
                filename: 'report-expenses-2026-06-01-to-2026-06-30.pdf',
                downloadStarted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'export_report_pdf', {
            section: 'invoices',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'export_report_pdf',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('exports accountant packs as browser ZIP downloads without returning file contents', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        const task = createTaskCommand(context, {
            id: 'task-accountant-pack',
            title: 'Accountant pack task',
            projectId: 'project-1',
            billable: true,
        });

        context.maps.businessBrandAssets.set('asset-accountant-pack', objectToYMap({
            id: 'asset-accountant-pack',
            businessInfoId: 'business-1',
            kind: 'logo',
            dataUrl: 'data:image/png;base64,abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            byteSize: 3,
            contentHash: 'hash',
            createdAt: 1,
        }));
        context.maps.invoices.set('invoice-accountant-pack', objectToYMap({
            id: 'invoice-accountant-pack',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-PACK',
            date: '2026-06-15',
            status: 'sent',
            items: [],
            subtotal: 100,
            tax: 5,
            total: 105,
            currency: 'USD',
        }));
        context.maps.entries.set('entry-accountant-pack', objectToYMap({
            id: 'entry-accountant-pack',
            taskId: task.id,
            start: Date.parse('2026-06-10T10:00:00Z'),
            end: Date.parse('2026-06-10T11:00:00Z'),
        }));
        context.permissions = new Set(['read', 'export']);

        const exported = await exportAccountantPackCommand(context, {
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
            filename: 'agent-accountant-pack',
        });

        expect(exported).toEqual({
            filename: 'agent-accountant-pack.zip',
            csvFileCount: 6,
            reportPdfCount: 1,
            invoicePdfCount: 1,
            truncatedSections: [],
            downloadStarted: true,
        });
        expect(reportPdfMocks.buildMonthlyReportHtml).toHaveBeenCalled();
        expect(pdfMocks.getCurrentInvoiceHtmlContent).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'invoice-accountant-pack', invoiceNumber: 'INV-PACK' }),
            [expect.objectContaining({ id: 'client-1' })],
            [expect.objectContaining({ id: 'asset-accountant-pack' })],
        );
        expect(pdfMocks.generatePDFBlob).toHaveBeenCalledTimes(2);
        expect(zipMocks.downloadZipFile).toHaveBeenCalledWith(
            'agent-accountant-pack.zip',
            expect.arrayContaining([
                expect.objectContaining({ filename: 'accountant-pack-manifest.csv' }),
                expect.objectContaining({ filename: 'invoices.csv' }),
                expect.objectContaining({ filename: 'time-entries.csv' }),
                expect.objectContaining({ filename: 'monthly-summary.pdf' }),
                expect.objectContaining({ filename: 'invoice-INV-PACK.pdf' }),
            ]),
        );

        await expect(executeAgentCommand(context, 'export_accountant_pack', {
            period: 'custom',
            customStart: '2026-06-01',
            customEnd: '2026-06-30',
            includeInvoicePdfs: false,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'export_accountant_pack',
            data: expect.objectContaining({
                invoicePdfCount: 0,
                downloadStarted: true,
            }),
        }));
    });

    it('exports backup JSON in the browser app context without returning backup contents', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        context.permissions = new Set(['read', 'export']);

        context.maps.projects.set('project-backup-export', objectToYMap({
            id: 'project-backup-export',
            title: 'Backup Export Project',
        }));
        context.maps.tasks.set('task-backup-export', objectToYMap({
            id: 'task-backup-export',
            title: 'Backup Export Task',
            projectId: 'project-backup-export',
        }));

        const exported = await exportBackupJsonCommand(context, {
            filename: 'agent-backup',
            exportDate: '2026-06-25T12:00:00.000Z',
            refreshFromCloud: true,
        });

        expect(exported).toEqual({
            filename: 'agent-backup.json',
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            refreshFromCloud: true,
            counts: expect.objectContaining({
                projects: 2,
                tasks: 1,
                clients: 1,
            }),
            downloadStarted: true,
        });
        expect(context.store.exportBackupData).toHaveBeenCalledWith({
            backupType: 'manual',
            exportDate: '2026-06-25T12:00:00.000Z',
            refreshFromCloud: true,
        });
        expect(downloadMocks.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);
        expect(downloadMocks.revokeObjectURL).toHaveBeenCalledWith('blob:agent-backup');

        await expect(executeAgentCommand(context, 'export_backup_json', {
            filename: 'default-agent-backup',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'export_backup_json',
            data: expect.objectContaining({
                filename: 'default-agent-backup.json',
                refreshFromCloud: false,
                downloadStarted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'export_backup_json', {})).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'export_backup_json',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('manages Drive backups without returning backup contents through the bridge', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        context.permissions = new Set(['read', 'write', 'export']);

        const backups = await listDriveBackupsCommand(context);
        expect(backups).toEqual({
            count: 1,
            backups: [{
                id: 'drive-backup-1',
                name: 'tasktime-backup-2026-06-25-1200.json',
                date: '2026-06-25',
                modifiedTime: '2026-06-25T12:00:00.000Z',
            }],
        });

        await expect(createDriveBackupCommand(context)).resolves.toEqual({
            created: true,
            fileId: 'drive-backup-new',
        });

        const downloaded = await downloadDriveBackupJsonCommand(context, {
            backupId: 'drive-backup-1',
            filename: 'downloaded-drive-backup',
        });

        expect(downloaded).toEqual({
            backupId: 'drive-backup-1',
            filename: 'downloaded-drive-backup.json',
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            backupType: 'automatic',
            counts: expect.objectContaining({
                projects: 1,
                tasks: 1,
                clients: 1,
            }),
            downloadStarted: true,
        });
        expect(context.store.downloadBackup).toHaveBeenCalledWith('drive-backup-1');
        expect(downloadMocks.linkClick).toHaveBeenCalledTimes(1);

        await expect(restoreDriveBackupCommand(context, {
            backupId: 'drive-backup-1',
            confirmRestore: false,
            confirmationText: 'RESTORE',
        })).rejects.toThrow(/confirmRestore/);

        const restored = await restoreDriveBackupCommand(context, {
            backupId: 'drive-backup-1',
            confirmRestore: true,
            confirmationText: 'RESTORE',
        });

        expect(restored).toEqual({
            restored: true,
            backupId: 'drive-backup-1',
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            backupType: 'automatic',
            counts: expect.objectContaining({
                projects: 1,
                tasks: 1,
                clients: 1,
            }),
            replacedCurrentData: true,
        });
        expect(readStored(context.maps.projects, 'project-drive-restored')).toEqual(expect.objectContaining({
            title: 'Drive Restored Project',
        }));

        await expect(executeAgentCommand(context, 'download_drive_backup_json', {
            backupId: 'drive-backup-1',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'download_drive_backup_json',
            data: expect.objectContaining({
                backupId: 'drive-backup-1',
                downloadStarted: true,
            }),
        }));

        await expect(executeAgentCommand(context, 'restore_drive_backup', {
            backupId: 'drive-backup-1',
            confirmRestore: true,
            confirmationText: 'RESTORE',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'restore_drive_backup',
            data: expect.objectContaining({
                restored: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'list_drive_backups', {})).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'list_drive_backups',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('previews and restores backup JSON with explicit approval-grade confirmation', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'export']);
        const backupJson = JSON.stringify({
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            backupType: 'manual',
            projects: [{ id: 'project-restored', title: 'Restored Project' }],
            tasks: [{ id: 'task-restored', title: 'Restored Task', projectId: 'project-restored' }],
            timeEntries: [],
            invoices: [],
            paymentMethods: [],
            expenseCategories: [],
            taxReturnPeriods: [],
            businessInfos: [],
            businessBrandAssets: [],
            clients: [{ id: 'client-restored', title: 'Restored Client' }],
            invoiceTemplates: [],
            emailTemplates: [],
            expenses: [],
            expenseRecurrences: [],
            dailyGoals: [],
            plannerAttachments: [],
            preferences: { currency: 'EUR' },
        });

        const preview = previewBackupImportJsonCommand(context, { backupJson });

        expect(preview).toEqual({
            valid: true,
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            backupType: 'manual',
            counts: expect.objectContaining({
                projects: 1,
                tasks: 1,
                clients: 1,
            }),
            willReplaceCurrentData: true,
            mutatesData: false,
        });
        expect(readStored(context.maps.projects, 'project-1')).toEqual(expect.objectContaining({
            title: 'Project One',
        }));

        await expect(restoreBackupJsonCommand(context, {
            backupJson,
            confirmRestore: false,
            confirmationText: 'RESTORE',
        })).rejects.toThrow(/confirmRestore/);

        await expect(restoreBackupJsonCommand(context, {
            backupJson,
            confirmRestore: true,
            confirmationText: 'wrong',
        })).rejects.toThrow(/confirmationText/);

        const restored = await restoreBackupJsonCommand(context, {
            backupJson,
            confirmRestore: true,
            confirmationText: 'RESTORE',
        });

        expect(restored).toEqual({
            restored: true,
            version: '1.4',
            exportDate: '2026-06-25T12:00:00.000Z',
            backupType: 'manual',
            counts: expect.objectContaining({
                projects: 1,
                tasks: 1,
                clients: 1,
            }),
            replacedCurrentData: true,
        });
        expect(context.store.clearAllData).toHaveBeenCalledTimes(1);
        expect(context.store.initialize).toHaveBeenCalledTimes(1);
        expect(context.store.importBackupData).toHaveBeenCalledWith(expect.objectContaining({
            projects: [expect.objectContaining({ id: 'project-restored' })],
            preferences: { currency: 'EUR' },
        }));
        expect(readStored(context.maps.projects, 'project-1')).toBeUndefined();
        expect(readStored(context.maps.projects, 'project-restored')).toEqual(expect.objectContaining({
            title: 'Restored Project',
        }));

        await expect(executeAgentCommand(context, 'preview_backup_import_json', {
            backupJson,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_backup_import_json',
            data: expect.objectContaining({
                mutatesData: false,
            }),
        }));

        await expect(executeAgentCommand(context, 'restore_backup_json', {
            backupJson,
            confirmRestore: true,
            confirmationText: 'RESTORE',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'restore_backup_json',
            data: expect.objectContaining({
                restored: true,
            }),
        }));

        context.permissions = new Set(['read', 'write']);
        await expect(executeAgentCommand(context, 'restore_backup_json', {
            backupJson,
            confirmRestore: true,
            confirmationText: 'RESTORE',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'restore_backup_json',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('previews invoice totals from unbilled work without billing side effects', async () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-preview',
            title: 'Preview task',
            projectId: 'project-1',
            billable: true,
        });
        context.maps.entries.set('entry-preview', objectToYMap({
            id: 'entry-preview',
            taskId: 'task-preview',
            start: Date.parse('2026-06-10T10:00:00Z'),
            end: Date.parse('2026-06-10T12:00:00Z'),
        }));
        context.maps.expenses.set('expense-preview', objectToYMap({
            id: 'expense-preview',
            title: 'Preview expense',
            date: '2026-06-10',
            amount: 40,
            currency: 'EUR',
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
        }));

        const preview = await previewInvoiceFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        });

        expect(preview).toEqual(expect.objectContaining({
            projectId: 'project-1',
            projectTitle: 'Project One',
            clientId: 'client-1',
            preview: expect.objectContaining({
                currency: 'EUR',
                taskAmount: 200,
                expenseAmount: 40,
                total: 240,
                unbilledHours: 2,
            }),
            sideEffects: {
                createsInvoice: false,
                marksEntriesBilled: false,
                marksExpensesBilled: false,
                updatesTaskBillingCutoffs: false,
                advancesInvoiceSequence: false,
            },
        }));
        expect(context.maps.invoices.size).toBe(0);
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-preview')).not.toHaveProperty('billedInvoiceId');
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-preview')).toEqual(expect.objectContaining({
            billingStatus: 'unbilled',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-preview')).not.toHaveProperty('lastBilledAt');

        await expect(executeAgentCommand(context, 'preview_invoice_from_unbilled_work', {
            projectId: 'project-1',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_invoice_from_unbilled_work',
        }));
    });

    it('includes archived tasks and complete time-entry history in agent invoice preview', async () => {
        const context = createContext();
        context.maps.archivedTasks.set('task-archived-preview', objectToYMap({
            id: 'task-archived-preview',
            title: 'Archived preview work',
            projectId: 'project-1',
            billable: true,
            archived: true,
            lastBilledAt: Date.parse('2026-06-20T00:00:00Z'),
        }));
        context.maps.entries.set('entry-late-preview', objectToYMap({
            id: 'entry-late-preview',
            taskId: 'task-archived-preview',
            start: Date.parse('2026-06-10T10:00:00Z'),
            end: Date.parse('2026-06-10T11:00:00Z'),
        }));

        const preview = await previewInvoiceFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        });

        expect((context.store as any).getAllTasks).toHaveBeenCalled();
        expect((context.store as any).loadAllTimeEntries).toHaveBeenCalled();
        expect(preview.preview.entrySelections).toEqual([
            expect.objectContaining({ entryId: 'entry-late-preview', taskId: 'task-archived-preview' }),
        ]);
        expect(preview.preview.total).toBe(100);
    });

    it('creates an invoice draft from unbilled work without billing side effects', async () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-draft',
            title: 'Draft task',
            projectId: 'project-1',
            billable: true,
        });
        context.maps.invoiceTemplates.set('template-1', objectToYMap({
            id: 'template-1',
            name: 'Default invoice template',
            isDefault: true,
            invoiceNumberFormat: 'INV-{sequential}',
            useSequentialNumbers: true,
            currentSequentialNumber: 5,
            dueDateType: 'none',
        }));
        context.maps.entries.set('entry-draft', objectToYMap({
            id: 'entry-draft',
            taskId: 'task-draft',
            start: Date.parse('2026-06-11T10:00:00Z'),
            end: Date.parse('2026-06-11T12:00:00Z'),
        }));
        context.maps.expenses.set('expense-draft', objectToYMap({
            id: 'expense-draft',
            title: 'Draft expense',
            date: '2026-06-11',
            amount: 40,
            currency: 'EUR',
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
        }));

        const draft = await createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
            idempotencyKey: 'draft-1',
        });
        const repeated = await createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
            idempotencyKey: 'draft-1',
        });

        expect(repeated).toBe(draft);
        expect(context.maps.invoices.size).toBe(1);
        expect(draft).toEqual(expect.objectContaining({
            preview: expect.objectContaining({
                total: 240,
            }),
            sideEffects: {
                createsInvoice: true,
                marksEntriesBilled: false,
                marksExpensesBilled: false,
                updatesTaskBillingCutoffs: false,
                updatesProjectInvoiceReferences: false,
                advancesInvoiceSequence: false,
            },
        }));
        expect(readStored(context.maps.invoices, draft.invoice.id)).toEqual(expect.objectContaining({
            id: draft.invoice.id,
            invoiceNumber: 'INV-0005',
            projectId: 'project-1',
            clientId: 'client-1',
            status: 'draft',
            subtotal: 240,
            total: 240,
            currency: 'EUR',
            billingSelectionSnapshot: expect.objectContaining({
                version: 1,
                entries: [expect.objectContaining({ entryId: 'entry-draft', taskId: 'task-draft' })],
                tasks: [expect.objectContaining({ taskId: 'task-draft', rate: 100, amount: 200 })],
                expenses: [expect.objectContaining({ expenseId: 'expense-draft', invoiceAmount: 40 })],
            }),
            agentDraft: expect.objectContaining({
                version: 1,
                source: 'tasktime-agent',
                projectId: 'project-1',
                clientId: 'client-1',
                billingPeriodStart: '2026-06-01',
                billingPeriodEnd: '2026-06-30',
                finalizationState: 'draft',
            }),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-draft')).not.toHaveProperty('billedInvoiceId');
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-draft')).toEqual(expect.objectContaining({
            billingStatus: 'unbilled',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-draft')).not.toHaveProperty('lastBilledAt');
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).not.toHaveProperty('invoiceIds');
        expect(readStored<Record<string, unknown>>(context.maps.invoiceTemplates, 'template-1')).toEqual(expect.objectContaining({
            currentSequentialNumber: 5,
        }));

        await expect(executeAgentCommand(context, 'create_invoice_draft', {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
            idempotencyKey: 'draft-2',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'create_invoice_draft',
        }));
    });

    it('edits draft invoice metadata and line items without billing side effects', async () => {
        const context = createContext();
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        context.maps.businessInfos.set('business-draft-edit', objectToYMap({
            id: 'business-draft-edit',
            name: 'Draft Business',
        }));
        context.maps.paymentMethods.set('payment-draft-edit', objectToYMap({
            id: 'payment-draft-edit',
            title: 'Draft Payment',
        }));
        context.maps.invoiceTemplates.set('template-draft-edit', objectToYMap({
            id: 'template-draft-edit',
            name: 'Draft Template',
        }));
        context.maps.invoices.set('invoice-draft-edit', objectToYMap({
            id: 'invoice-draft-edit',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'DRAFT-1',
            date: '2026-06-20',
            status: 'draft',
            items: [{
                description: 'Old item',
                quantity: 1,
                rate: 50,
                amount: 50,
                lineType: 'custom',
            }],
            subtotal: 50,
            tax: 0,
            taxRate: 0,
            total: 50,
            currency: 'USD',
            createdAt: Date.parse('2026-06-20T12:00:00Z'),
        }));

        const updated = updateInvoiceDraftCommand(context, {
            invoiceId: 'invoice-draft-edit',
            updates: {
                invoiceNumber: 'DRAFT-2',
                date: '2026-06-25',
                dueDate: '2026-07-25',
                businessInfoId: 'business-draft-edit',
                paymentMethodId: 'payment-draft-edit',
                templateId: 'template-draft-edit',
                notes: 'Updated draft note',
                items: [
                    {
                        description: 'Design work',
                        quantity: 2,
                        rate: 75,
                        amount: 150,
                        lineType: 'custom',
                    },
                    {
                        description: 'Hosting',
                        quantity: 1,
                        rate: 30,
                        amount: 30,
                        lineType: 'custom',
                    },
                ],
                taxRate: 10,
                discount: 20,
                shipping: 5,
            },
        });

        expect(updated).toEqual({
            invoice: expect.objectContaining({
                id: 'invoice-draft-edit',
                invoiceNumber: 'DRAFT-2',
                status: 'draft',
                subtotal: 180,
                tax: 18,
                total: 183,
                notes: 'Updated draft note',
                updatedAt: Date.parse('2026-06-25T12:00:00Z'),
            }),
            sideEffects: {
                createsInvoice: false,
                marksEntriesBilled: false,
                marksExpensesBilled: false,
                updatesTaskBillingCutoffs: false,
                updatesProjectInvoiceReferences: false,
                advancesInvoiceSequence: false,
            },
        });
        expect(readStored(context.maps.projects, 'project-1')).not.toHaveProperty('invoiceIds');

        expect(() => updateInvoiceDraftCommand(context, {
            invoiceId: 'invoice-draft-edit',
            updates: {
                status: 'sent',
            },
        })).toThrow(/lifecycle/);

        context.maps.invoices.set('invoice-sent-edit', objectToYMap({
            id: 'invoice-sent-edit',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-SENT',
            date: '2026-06-20',
            status: 'sent',
            items: [],
            subtotal: 0,
            total: 0,
        }));

        expect(() => updateInvoiceDraftCommand(context, {
            invoiceId: 'invoice-sent-edit',
            updates: {
                notes: 'Nope',
            },
        })).toThrow(/Only draft invoices/);

        await expect(executeAgentCommand(context, 'update_invoice_draft', {
            invoiceId: 'invoice-draft-edit',
            updates: {
                notes: 'Dispatcher draft note',
            },
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'update_invoice_draft',
            data: expect.objectContaining({
                invoice: expect.objectContaining({
                    notes: 'Dispatcher draft note',
                }),
            }),
        }));
    });

    it('preserves UI-shaped invoice composer state across agent draft edit and finalize', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing', 'navigation']);
        context.now = () => Date.parse('2026-06-25T12:00:00Z');

        createTaskCommand(context, {
            id: 'task-composition',
            title: 'Composition task',
            projectId: 'project-1',
            billable: true,
        });
        createTaskCommand(context, {
            id: 'subtask-composition',
            title: 'Composition subtask',
            projectId: 'project-1',
            parentTaskId: 'task-composition',
            billable: true,
        });
        context.maps.businessInfos.set('business-composition', objectToYMap({
            id: 'business-composition',
            name: 'Composition Business',
            businessName: 'Composition Business LLC',
        }));
        context.maps.paymentMethods.set('payment-composition', objectToYMap({
            id: 'payment-composition',
            title: 'Composition Wire',
        }));
        context.maps.invoiceTemplates.set('template-composition', objectToYMap({
            id: 'template-composition',
            name: 'Composition Template',
            useSequentialNumbers: false,
            logoPlacement: 'invoice-left-logo-right',
        }));
        context.maps.expenses.set('expense-composition', objectToYMap({
            id: 'expense-composition',
            title: 'Composition expense',
            date: '2026-06-12',
            supplierName: 'Composition Vendor',
            currency: 'USD',
            amount: 25,
            paidOn: null,
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
            businessId: null,
            categoryId: null,
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            invoiceId: null,
        }));
        context.maps.expenses.set('expense-client-composition', objectToYMap({
            id: 'expense-client-composition',
            title: 'Client-level composition expense',
            date: '2026-06-13',
            supplierName: 'Client Vendor',
            currency: 'USD',
            amount: 15,
            paidOn: null,
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: null,
            businessId: null,
            categoryId: null,
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            invoiceId: null,
        }));
        context.maps.invoices.set('invoice-composition-draft', objectToYMap({
            id: 'invoice-composition-draft',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'COMP-1',
            date: '2026-06-20',
            status: 'draft',
            items: [],
            subtotal: 0,
            tax: 0,
            taxRate: 0,
            total: 0,
            currency: 'USD',
            createdAt: Date.parse('2026-06-20T12:00:00Z'),
        }));

        const composerUpdates = {
            project: {
                id: 'project-1',
                title: 'Project One',
            },
            projectId: 'project-1',
            projectIds: ['project-1', 'project-1'],
            projectBreakdowns: [{
                projectId: 'project-1',
                projectTitle: 'Project One',
                clientId: 'client-1',
                pricingMode: 'hourly',
                tasks: [{
                    id: 'task-composition',
                    title: 'Composition task',
                    hours: 2,
                    originalHours: 1,
                    hourlyRate: 100,
                    projectHourlyRate: 100,
                    useFlatRate: false,
                    isMerged: true,
                    mergedSubtasks: [{
                        id: 'subtask-composition',
                        title: 'Composition subtask',
                        hours: 0.5,
                        originalHours: 0.5,
                        hourlyRate: 100,
                        useFlatRate: false,
                    }],
                }],
                expenseItems: [{
                    id: 'expense-composition',
                    title: 'Composition expense',
                    amount: 25,
                    projectId: 'project-1',
                }],
                totalHours: 2.5,
                subtotal: 225,
                allocatedDiscount: 20,
                allocatedShipping: 5,
                allocatedTax: 22.5,
                allocatedTotal: 232.5,
            }],
            clientExpenseItems: [{
                id: 'expense-client-composition',
                title: 'Client-level composition expense',
                amount: 15,
                projectId: null,
            }],
            invoiceOnlyExpenseItems: [{
                id: 'invoice-only-composition',
                title: 'Invoice-only composition expense',
                amount: 10,
            }],
            client: {
                id: 'client-1',
                title: 'Client One',
            },
            clientId: 'client-1',
            businessInfo: {
                id: 'business-composition',
                businessName: 'Composition Business LLC',
            },
            businessInfoId: 'business-composition',
            paymentMethod: {
                id: 'payment-composition',
                title: 'Composition Wire',
            },
            paymentMethodId: 'payment-composition',
            invoiceNumber: 'COMP-2',
            date: '2026-06-25',
            dateOverride: '2026-06-25',
            dueDate: '2026-07-25',
            items: [{
                description: 'Composition task',
                quantity: 2,
                rate: 100,
                amount: 200,
                projectId: 'project-1',
                taskId: 'task-composition',
                lineType: 'task',
            }, {
                description: 'Composition expense',
                quantity: 1,
                rate: 25,
                amount: 25,
                projectId: 'project-1',
                expenseId: 'expense-composition',
                lineType: 'expense',
            }, {
                description: 'Client-level composition expense',
                quantity: 1,
                rate: 15,
                amount: 15,
                expenseId: 'expense-client-composition',
                lineType: 'expense',
            }, {
                description: 'Invoice-only composition expense',
                quantity: 1,
                rate: 10,
                amount: 10,
                lineType: 'custom',
            }],
            tasks: [{
                id: 'task-composition',
                title: 'Composition task',
                hours: 2,
                originalHours: 1,
                hourlyRate: 100,
                projectHourlyRate: 100,
                useFlatRate: false,
                isMerged: true,
                mergedSubtasks: [{
                    id: 'subtask-composition',
                    title: 'Composition subtask',
                    hours: 0.5,
                    originalHours: 0.5,
                    hourlyRate: 100,
                    useFlatRate: false,
                }],
            }],
            additionalTasks: [{
                id: 'manual-composition',
                title: 'Manual composition item',
                useFlatRate: true,
                flatRate: 50,
                quantity: 1,
            }],
            expenseItems: [{
                id: 'expense-composition',
                title: 'Composition expense',
                amount: 25,
                projectId: 'project-1',
            }, {
                id: 'expense-client-composition',
                title: 'Client-level composition expense',
                amount: 15,
                projectId: null,
            }],
            taskFlatRates: {
                'task-composition': 200,
            },
            useFlatRate: {
                'task-composition': false,
            },
            taskHourlyRates: {
                'task-composition': 100,
            },
            taskQuantities: {
                'task-composition': 2,
            },
            mergedSubtasks: {
                'task-composition': true,
            },
            note: 'Internal composition note',
            notes: 'Visible composition note',
            totalHours: 2.5,
            subtotal: 250,
            discount: 20,
            discountType: 'fixed',
            discountValue: 20,
            shipping: 5,
            tax: 22.5,
            taxRate: 9,
            taxLabel: 'VAT',
            taxOverride: {
                enabled: true,
                label: 'VAT',
                rate: 9,
            },
            billingPeriodPreset: 'custom',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
            currency: 'USD',
            template: {
                id: 'template-composition',
                name: 'Composition Template',
            },
            templateId: 'template-composition',
            brandingSnapshot: {
                businessInfoId: 'business-composition',
                templateId: 'template-composition',
                layoutStyle: 'classic',
                logoPlacement: 'invoice-left-logo-right',
                showBusinessLogo: false,
                useBusinessPrimaryColor: true,
                primaryColor: '#123456',
                logoAssetId: null,
                logoAssetMeta: null,
            },
            htmlContent: '<section>Rendered composition invoice</section>',
        };

        const updated = updateInvoiceDraftCommand(context, {
            invoiceId: 'invoice-composition-draft',
            updates: composerUpdates,
        });

        expect(updated.invoice).toEqual(expect.objectContaining({
            id: 'invoice-composition-draft',
            invoiceNumber: 'COMP-2',
            status: 'draft',
            projectIds: ['project-1'],
            projectBreakdowns: composerUpdates.projectBreakdowns,
            clientExpenseItems: composerUpdates.clientExpenseItems,
            invoiceOnlyExpenseItems: composerUpdates.invoiceOnlyExpenseItems,
            businessInfo: composerUpdates.businessInfo,
            paymentMethod: composerUpdates.paymentMethod,
            dateOverride: '2026-06-25',
            tasks: composerUpdates.tasks,
            additionalTasks: composerUpdates.additionalTasks,
            taskFlatRates: composerUpdates.taskFlatRates,
            useFlatRate: composerUpdates.useFlatRate,
            taskHourlyRates: composerUpdates.taskHourlyRates,
            taskQuantities: composerUpdates.taskQuantities,
            mergedSubtasks: composerUpdates.mergedSubtasks,
            discountType: 'fixed',
            discountValue: 20,
            taxLabel: 'VAT',
            taxOverride: composerUpdates.taxOverride,
            brandingSnapshot: composerUpdates.brandingSnapshot,
            htmlContent: '<section>Rendered composition invoice</section>',
            subtotal: 250,
            tax: 22.5,
            total: 257.5,
            updatedAt: Date.parse('2026-06-25T12:00:00Z'),
        }));
        expect(updated.sideEffects).toEqual({
            createsInvoice: false,
            marksEntriesBilled: false,
            marksExpensesBilled: false,
            updatesTaskBillingCutoffs: false,
            updatesProjectInvoiceReferences: false,
            advancesInvoiceSequence: false,
        });

        const finalized = await finalizeInvoiceCommand(context, {
            invoiceId: 'invoice-composition-draft',
            confirmFinalize: true,
        });

        expect(finalized.invoice).toEqual(expect.objectContaining({
            id: 'invoice-composition-draft',
            status: 'sent',
            invoiceNumber: 'COMP-2',
            projectIds: ['project-1'],
            projectBreakdowns: composerUpdates.projectBreakdowns,
            clientExpenseItems: composerUpdates.clientExpenseItems,
            invoiceOnlyExpenseItems: composerUpdates.invoiceOnlyExpenseItems,
            tasks: composerUpdates.tasks,
            additionalTasks: composerUpdates.additionalTasks,
            taskFlatRates: composerUpdates.taskFlatRates,
            useFlatRate: composerUpdates.useFlatRate,
            taskHourlyRates: composerUpdates.taskHourlyRates,
            taskQuantities: composerUpdates.taskQuantities,
            mergedSubtasks: composerUpdates.mergedSubtasks,
            taxOverride: composerUpdates.taxOverride,
            brandingSnapshot: composerUpdates.brandingSnapshot,
            htmlContent: '<section>Rendered composition invoice</section>',
            billingStateSnapshot: expect.objectContaining({
                taskLastBilledAt: {
                    'task-composition': null,
                    'subtask-composition': null,
                },
            }),
        }));
        expect(finalized).toEqual(expect.objectContaining({
            billedEntryCount: 0,
            billedExpenseCount: 2,
            updatedProjectInvoiceReferences: true,
            advancedInvoiceSequence: false,
        }));
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-composition')).toEqual(expect.objectContaining({
            billingStatus: 'billed',
            invoiceId: 'invoice-composition-draft',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-client-composition')).toEqual(expect.objectContaining({
            billingStatus: 'billed',
            invoiceId: 'invoice-composition-draft',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).toEqual(expect.objectContaining({
            invoiceIds: ['invoice-composition-draft'],
        }));
    });

    it('finalizes an agent-created invoice draft with explicit billing permission and confirmation', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing', 'navigation']);
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        createTaskCommand(context, {
            id: 'task-finalize',
            title: 'Finalize task',
            projectId: 'project-1',
            billable: true,
        });
        context.maps.invoiceTemplates.set('template-finalize', objectToYMap({
            id: 'template-finalize',
            name: 'Finalize template',
            isDefault: true,
            invoiceNumberFormat: 'INV-{sequential}',
            useSequentialNumbers: true,
            currentSequentialNumber: 7,
            dueDateType: 'none',
        }));
        context.maps.entries.set('entry-finalize', objectToYMap({
            id: 'entry-finalize',
            taskId: 'task-finalize',
            start: Date.parse('2026-06-12T10:00:00Z'),
            end: Date.parse('2026-06-12T12:00:00Z'),
        }));
        context.maps.expenses.set('expense-finalize', objectToYMap({
            id: 'expense-finalize',
            title: 'Finalize expense',
            date: '2026-06-12',
            amount: 40,
            currency: 'EUR',
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
        }));

        const draft = await createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        });

        context.maps.entries.set('entry-after-preview', objectToYMap({
            id: 'entry-after-preview',
            taskId: 'task-finalize',
            start: Date.parse('2026-06-13T10:00:00Z'),
            end: Date.parse('2026-06-13T11:00:00Z'),
        }));

        await expect(finalizeInvoiceCommand(context, {
            invoiceId: draft.invoice.id,
            confirmFinalize: false,
        })).rejects.toThrow(/confirmFinalize/);

        const finalized = await finalizeInvoiceCommand(context, {
            invoiceId: draft.invoice.id,
            confirmFinalize: true,
            idempotencyKey: 'finalize-1',
        });
        const repeated = await finalizeInvoiceCommand(context, {
            invoiceId: draft.invoice.id,
            confirmFinalize: true,
            idempotencyKey: 'finalize-1',
        });

        expect(repeated).toBe(finalized);
        context.idempotency?.clear();
        const replayedAfterSessionLoss = await finalizeInvoiceCommand(context, {
            invoiceId: draft.invoice.id,
            confirmFinalize: true,
            idempotencyKey: 'finalize-1',
        });
        expect(replayedAfterSessionLoss).toEqual(finalized);
        expect(finalized).toEqual(expect.objectContaining({
            billedEntryCount: 1,
            billedExpenseCount: 1,
            updatedTaskCount: 1,
            updatedProjectInvoiceReferences: true,
            advancedInvoiceSequence: true,
            invoice: expect.objectContaining({
                status: 'sent',
                billingStateSnapshot: expect.objectContaining({
                    version: 1,
                    taskLastBilledAt: {
                        'task-finalize': null,
                    },
                }),
                agentDraft: expect.objectContaining({
                    finalizationState: 'finalized',
                    finalizedAt: Date.parse('2026-06-25T12:00:00Z'),
                }),
            }),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-finalize')).toEqual(expect.objectContaining({
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
            billedInvoiceId: draft.invoice.id,
            billedHourlyRate: 100,
        }));
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-after-preview')).not.toHaveProperty('billedInvoiceId');
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-finalize')).toEqual(expect.objectContaining({
            billingStatus: 'billed',
            invoiceId: draft.invoice.id,
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-finalize')).toEqual(expect.objectContaining({
            lastBilledAt: Date.parse('2026-06-12T12:00:00Z'),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).toEqual(expect.objectContaining({
            invoiceIds: [draft.invoice.id],
        }));
        expect(readStored<Record<string, unknown>>(context.maps.invoiceTemplates, 'template-finalize')).toEqual(expect.objectContaining({
            currentSequentialNumber: 8,
        }));

        await expect(executeAgentCommand(context, 'finalize_invoice', {
            invoiceId: draft.invoice.id,
            confirmFinalize: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'finalize_invoice',
            error: expect.objectContaining({
                code: 'CONFLICT',
            }),
        }));
    });

    it('rejects finalization without billing side effects when a selected source record changed after preview', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        createTaskCommand(context, {
            id: 'task-selection-conflict',
            title: 'Selection conflict task',
            projectId: 'project-1',
            billable: true,
        });
        context.maps.entries.set('entry-selection-conflict', objectToYMap({
            id: 'entry-selection-conflict',
            taskId: 'task-selection-conflict',
            start: Date.parse('2026-06-10T10:00:00Z'),
            end: Date.parse('2026-06-10T11:00:00Z'),
        }));

        const draft = await createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        });
        updateEntityFields(context.maps.entries as any, 'entry-selection-conflict', {
            end: Date.parse('2026-06-10T12:00:00Z'),
        });

        await expect(finalizeInvoiceCommand(context, {
            invoiceId: draft.invoice.id,
            confirmFinalize: true,
        })).rejects.toMatchObject({
            code: 'CONFLICT',
            details: expect.objectContaining({ reason: expect.stringMatching(/changed after preview/) }),
        });

        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-selection-conflict')).not.toHaveProperty('billedInvoiceId');
        expect(readStored<Record<string, unknown>>(context.maps.invoices, draft.invoice.id)).toEqual(expect.objectContaining({ status: 'draft' }));
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).not.toHaveProperty('invoiceIds');
    });

    it('finalizes UI-shaped draft invoices with adjustments, quoted tasks, expenses, and historical entries', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        const historicalDoc = new Y.Doc();
        const historicalEntries = historicalDoc.getMap('timeEntries');
        (context.store as any).getAvailableYears = vi.fn(async () => [2025]);
        (context.store as any).loadEntriesForYear = vi.fn(async () => historicalEntries);

        createTaskCommand(context, {
            id: 'task-ui-hourly',
            title: 'UI hourly task',
            projectId: 'project-1',
            billable: true,
            lastBilledAt: Date.parse('2025-05-01T00:00:00Z'),
        });
        createTaskCommand(context, {
            id: 'task-ui-subtask',
            title: 'UI subtask',
            projectId: 'project-1',
            billable: true,
            lastBilledAt: null,
        });
        createTaskCommand(context, {
            id: 'task-ui-quote',
            title: 'UI quote task',
            projectId: 'project-1',
            billable: true,
            estimatedFlatAmount: 500,
        });
        context.maps.invoiceTemplates.set('template-ui', objectToYMap({
            id: 'template-ui',
            name: 'UI template',
            invoiceNumberFormat: 'INV-{sequential}',
            useSequentialNumbers: true,
            currentSequentialNumber: 10,
        }));
        context.maps.entries.set('entry-active-ui', objectToYMap({
            id: 'entry-active-ui',
            taskId: 'task-ui-subtask',
            start: Date.parse('2026-06-12T10:00:00Z'),
            end: Date.parse('2026-06-12T11:00:00Z'),
        }));
        historicalEntries.set('entry-historical-ui', objectToYMap({
            id: 'entry-historical-ui',
            taskId: 'task-ui-hourly',
            start: Date.parse('2025-06-12T10:00:00Z'),
            end: Date.parse('2025-06-12T12:00:00Z'),
        }));
        context.maps.expenses.set('expense-ui', objectToYMap({
            id: 'expense-ui',
            title: 'UI expense',
            date: '2026-06-12',
            amount: 40,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            billingStatus: 'unbilled',
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
        }));
        context.maps.invoices.set('invoice-ui-draft', objectToYMap({
            id: 'invoice-ui-draft',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            templateId: 'template-ui',
            template: {
                id: 'template-ui',
                name: 'UI template',
                invoiceNumberFormat: 'INV-{sequential}',
                useSequentialNumbers: true,
                currentSequentialNumber: 10,
            },
            invoiceNumber: 'INV-0010',
            date: '2026-06-25',
            status: 'draft',
            tasks: [
                {
                    id: 'task-ui-hourly',
                    hours: 3,
                    originalHours: 2,
                    hourlyRate: 125,
                    useFlatRate: false,
                    mergedSubtasks: [{
                        id: 'task-ui-subtask',
                        hours: 1,
                        originalHours: 1,
                        hourlyRate: 90,
                        useFlatRate: false,
                    }],
                },
                {
                    id: 'task-ui-quote',
                    hours: 0,
                    originalHours: 0,
                    flatRate: 500,
                    quantity: 1,
                    useFlatRate: true,
                    projectFlatRate: true,
                },
            ],
            expenseItems: [{
                id: 'expense-ui',
                title: 'UI expense',
                amount: 40,
            }],
            items: [{
                description: 'UI expense',
                quantity: 1,
                rate: 40,
                amount: 40,
                expenseId: 'expense-ui',
                lineType: 'expense',
            }],
            subtotal: 915,
            total: 915,
            billingPeriodStart: '2025-01-01',
            billingPeriodEnd: '2026-12-31',
        }));

        const finalized = await finalizeInvoiceCommand(context, {
            invoiceId: 'invoice-ui-draft',
            confirmFinalize: true,
        });

        expect(finalized).toEqual(expect.objectContaining({
            billedEntryCount: 2,
            billedExpenseCount: 1,
            updatedTaskCount: 2,
            updatedProjectInvoiceReferences: true,
            advancedInvoiceSequence: true,
            invoice: expect.objectContaining({
                status: 'sent',
                billingStateSnapshot: expect.objectContaining({
                    taskLastBilledAt: {
                        'task-ui-hourly': Date.parse('2025-05-01T00:00:00Z'),
                        'task-ui-subtask': null,
                        'task-ui-quote': null,
                    },
                }),
            }),
        }));
        expect(finalized.invoice).not.toHaveProperty('sentAt');
        expect(readStored<Record<string, unknown>>(historicalEntries, 'entry-historical-ui')).toEqual(expect.objectContaining({
            billedInvoiceId: 'invoice-ui-draft',
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
            billedHourlyRate: 125,
        }));
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-active-ui')).toEqual(expect.objectContaining({
            billedInvoiceId: 'invoice-ui-draft',
            billedHourlyRate: 90,
        }));
        expect(Array.from(context.maps.entries.values()).map((value) => readEntity<Record<string, unknown>>(value))).toEqual(expect.arrayContaining([
            expect.objectContaining({
                taskId: 'task-ui-hourly',
                source: 'invoice-adjustment',
                billedInvoiceId: 'invoice-ui-draft',
                billedHourlyRate: 125,
            }),
        ]));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-ui-quote')).toEqual(expect.objectContaining({
            estimatedFlatAmount: null,
            quotedAmountBilling: {
                invoiceId: 'invoice-ui-draft',
                billedAt: Date.parse('2026-06-25T12:00:00Z'),
                total: 500,
            },
        }));
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-ui')).toEqual(expect.objectContaining({
            billingStatus: 'billed',
            invoiceId: 'invoice-ui-draft',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).toEqual(expect.objectContaining({
            invoiceIds: ['invoice-ui-draft'],
        }));
        expect(readStored<Record<string, unknown>>(context.maps.invoiceTemplates, 'template-ui')).toEqual(expect.objectContaining({
            currentSequentialNumber: 11,
        }));
    });

    it('does not bill unrelated project time when a non-agent draft has no explicit task selection', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-25T12:00:00Z');
        createTaskCommand(context, {
            id: 'task-unselected',
            title: 'Unselected billable task',
            projectId: 'project-1',
            billable: true,
        });
        context.maps.entries.set('entry-unselected', objectToYMap({
            id: 'entry-unselected',
            taskId: 'task-unselected',
            start: Date.parse('2026-06-12T10:00:00Z'),
            end: Date.parse('2026-06-12T11:00:00Z'),
        }));
        context.maps.invoices.set('invoice-custom-only', objectToYMap({
            id: 'invoice-custom-only',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-CUSTOM',
            date: '2026-06-25',
            status: 'draft',
            items: [{
                description: 'Custom strategy package',
                quantity: 1,
                rate: 500,
                amount: 500,
                lineType: 'custom',
            }],
            additionalTasks: [{
                id: 'custom-1',
                title: 'Custom strategy package',
                useFlatRate: true,
                flatRate: 500,
                quantity: 1,
            }],
            subtotal: 500,
            total: 500,
        }));

        const finalized = await finalizeInvoiceCommand(context, {
            invoiceId: 'invoice-custom-only',
            confirmFinalize: true,
        });

        expect(finalized.billedEntryCount).toBe(0);
        expect(finalized.updatedTaskCount).toBe(0);
        expect(readStored<Record<string, unknown>>(context.maps.invoices, 'invoice-custom-only')).toEqual(expect.objectContaining({
            status: 'sent',
        }));
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-unselected')).not.toHaveProperty('billedInvoiceId');
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-unselected')).not.toHaveProperty('lastBilledAt');
    });

    it('marks invoices paid with explicit billing permission and payment currency snapshots', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-26T12:00:00Z');
        context.maps.invoices.set('invoice-paid', objectToYMap({
            id: 'invoice-paid',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-PAID',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'EUR',
        }));

        expect(() => markInvoicePaidCommand(context, {
            invoiceId: 'invoice-paid',
            confirmPaid: false,
        })).toThrow(/confirmPaid/);
        expect(() => markInvoicePaidCommand(context, {
            invoiceId: 'invoice-paid',
            confirmPaid: true,
        })).toThrow(/exchangeRates/);

        const paid = markInvoicePaidCommand(context, {
            invoiceId: 'invoice-paid',
            confirmPaid: true,
            exchangeRates: { USD: 1, EUR: 0.8 },
            idempotencyKey: 'paid-1',
        });
        const repeated = markInvoicePaidCommand(context, {
            invoiceId: 'invoice-paid',
            confirmPaid: true,
            exchangeRates: { USD: 1, EUR: 0.8 },
            idempotencyKey: 'paid-1',
        });

        expect(repeated).toBe(paid);
        expect(paid.paymentCurrencySnapshotStored).toBe(true);
        expect(readStored<Record<string, unknown>>(context.maps.invoices, 'invoice-paid')).toEqual(expect.objectContaining({
            status: 'paid',
            paidAt: Date.parse('2026-06-26T12:00:00Z'),
            paymentCurrencySnapshot: {
                capturedAt: Date.parse('2026-06-26T12:00:00Z'),
                sourceCurrency: 'EUR',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'USD',
                preferredCurrencyAmount: 125,
            },
        }));

        await expect(executeAgentCommand(context, 'mark_invoice_paid', {
            invoiceId: 'invoice-paid',
            confirmPaid: true,
            exchangeRates: { USD: 1, EUR: 0.8 },
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'mark_invoice_paid',
        }));
    });

    it('marks invoices unpaid with explicit billing permission and UI status fallback behavior', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-26T12:00:00Z');
        context.maps.invoices.set('invoice-unpaid', objectToYMap({
            id: 'invoice-unpaid',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-UNPAID',
            date: '2026-06-01',
            dueDate: '2026-06-10',
            status: 'paid',
            paidAt: Date.parse('2026-06-12T12:00:00Z'),
            paymentCurrencySnapshot: {
                capturedAt: Date.parse('2026-06-12T12:00:00Z'),
                sourceCurrency: 'EUR',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'USD',
                preferredCurrencyAmount: 125,
            },
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'EUR',
        }));

        expect(() => markInvoiceUnpaidCommand(context, {
            invoiceId: 'invoice-unpaid',
            confirmUnpaid: false,
        })).toThrow(/confirmUnpaid/);

        const unpaid = markInvoiceUnpaidCommand(context, {
            invoiceId: 'invoice-unpaid',
            confirmUnpaid: true,
            referenceAt: Date.parse('2026-06-26T12:00:00Z'),
            idempotencyKey: 'unpaid-1',
        });
        const repeated = markInvoiceUnpaidCommand(context, {
            invoiceId: 'invoice-unpaid',
            confirmUnpaid: true,
            referenceAt: Date.parse('2026-06-26T12:00:00Z'),
            idempotencyKey: 'unpaid-1',
        });

        expect(repeated).toBe(unpaid);
        expect(unpaid.paymentCurrencySnapshotCleared).toBe(true);
        expect(readStored<Record<string, unknown>>(context.maps.invoices, 'invoice-unpaid')).toEqual(expect.objectContaining({
            status: 'sent',
            paidAt: null,
            updatedAt: Date.parse('2026-06-26T12:00:00Z'),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.invoices, 'invoice-unpaid')).not.toHaveProperty('paymentCurrencySnapshot');

        await expect(executeAgentCommand(context, 'mark_invoice_unpaid', {
            invoiceId: 'invoice-unpaid',
            confirmUnpaid: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'mark_invoice_unpaid',
        }));
    });

    it('undoes the latest unpaid invoice with UI-parity billing reversal side effects', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'billing']);
        context.now = () => Date.parse('2026-06-26T12:00:00Z');
        const historicalDoc = new Y.Doc();
        const historicalEntries = historicalDoc.getMap('timeEntries');
        (context.store as any).getAvailableYears = vi.fn(async () => [2025]);
        (context.store as any).loadEntriesForYear = vi.fn(async () => historicalEntries);
        context.maps.projects.set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Project One',
            hourlyRate: 100,
            preferredClientId: 'client-1',
            invoiceIds: ['invoice-undo'],
        }));
        createTaskCommand(context, {
            id: 'task-undo',
            title: 'Undo task',
            projectId: 'project-1',
            billable: true,
            lastBilledAt: Date.parse('2026-06-12T12:00:00Z'),
        });
        createTaskCommand(context, {
            id: 'task-quote-undo',
            title: 'Quoted task',
            projectId: 'project-1',
            billable: true,
            estimatedFlatAmount: null,
            quotedAmountBilling: {
                invoiceId: 'invoice-undo',
                billedAt: Date.parse('2026-06-25T12:00:00Z'),
                total: 500,
            },
        });
        context.maps.entries.set('entry-undo-active', objectToYMap({
            id: 'entry-undo-active',
            taskId: 'task-undo',
            start: Date.parse('2026-06-12T10:00:00Z'),
            end: Date.parse('2026-06-12T12:00:00Z'),
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
            billedInvoiceId: 'invoice-undo',
            billedHourlyRate: 100,
        }));
        context.maps.entries.set('entry-undo-adjustment', objectToYMap({
            id: 'entry-undo-adjustment',
            taskId: 'task-undo',
            start: Date.parse('2026-06-25T11:00:00Z'),
            end: Date.parse('2026-06-25T12:00:00Z'),
            source: 'invoice-adjustment',
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
            billedInvoiceId: 'invoice-undo',
            billedHourlyRate: 100,
        }));
        historicalEntries.set('entry-undo-historical', objectToYMap({
            id: 'entry-undo-historical',
            taskId: 'task-undo',
            start: Date.parse('2025-06-12T10:00:00Z'),
            end: Date.parse('2025-06-12T12:00:00Z'),
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
            billedInvoiceId: 'invoice-undo',
            billedHourlyRate: 100,
        }));
        context.maps.expenses.set('expense-undo', objectToYMap({
            id: 'expense-undo',
            title: 'Undo expense',
            date: '2026-06-12',
            amount: 40,
            currency: 'USD',
            isPersonal: false,
            billable: true,
            billingStatus: 'billed',
            paymentStatus: 'unpaid',
            clientId: 'client-1',
            projectId: 'project-1',
            invoiceId: 'invoice-undo',
            billedAt: Date.parse('2026-06-25T12:00:00Z'),
        }));
        context.maps.invoiceTemplates.set('template-undo', objectToYMap({
            id: 'template-undo',
            name: 'Undo template',
            invoiceNumberFormat: 'INV-{sequential}',
            useSequentialNumbers: true,
            currentSequentialNumber: 8,
        }));
        context.maps.invoices.set('invoice-undo', objectToYMap({
            id: 'invoice-undo',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            templateId: 'template-undo',
            invoiceNumber: 'INV-7',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 640,
            total: 640,
            tasks: [{ id: 'task-undo' }, { id: 'task-quote-undo', useFlatRate: true }],
            billingStateSnapshot: {
                version: 1,
                capturedAt: Date.parse('2026-06-25T12:00:00Z'),
                taskLastBilledAt: {
                    'task-undo': Date.parse('2025-01-01T00:00:00Z'),
                    'task-quote-undo': null,
                },
            },
        }));

        await expect(undoLatestInvoiceCommand(context, {
            invoiceId: 'invoice-undo',
            confirmUndo: true,
            confirmationText: 'wrong',
        })).rejects.toThrow(/confirmationText/);

        const result = await undoLatestInvoiceCommand(context, {
            invoiceId: 'invoice-undo',
            confirmUndo: true,
            confirmationText: 'INV-7',
            idempotencyKey: 'undo-1',
        });
        const repeated = await undoLatestInvoiceCommand(context, {
            invoiceId: 'invoice-undo',
            confirmUndo: true,
            confirmationText: 'INV-7',
            idempotencyKey: 'undo-1',
        });

        expect(repeated).toBe(result);
        context.idempotency?.clear();
        const replayedAfterSessionLoss = await undoLatestInvoiceCommand(context, {
            invoiceId: 'invoice-undo',
            confirmUndo: true,
            confirmationText: 'INV-7',
            idempotencyKey: 'undo-1',
        });
        expect(replayedAfterSessionLoss).toEqual(result);
        expect(result).toEqual({
            invoiceNumber: 'INV-7',
            clearedTimeEntryCount: 2,
            deletedAdjustmentCount: 1,
            unbilledExpenseCount: 1,
            rewoundSequence: true,
        });
        expect(context.maps.invoices.has('invoice-undo')).toBe(false);
        expect(readStored<Record<string, unknown>>(context.maps.entries, 'entry-undo-active')).toEqual(expect.objectContaining({
            billedAt: null,
            billedInvoiceId: null,
            billedHourlyRate: null,
            updatedAt: Date.parse('2026-06-26T12:00:00Z'),
        }));
        expect(readStored<Record<string, unknown>>(historicalEntries, 'entry-undo-historical')).toEqual(expect.objectContaining({
            billedAt: null,
            billedInvoiceId: null,
            billedHourlyRate: null,
        }));
        expect(context.maps.entries.has('entry-undo-adjustment')).toBe(false);
        expect(readStored<Record<string, unknown>>(context.maps.expenses, 'expense-undo')).toEqual(expect.objectContaining({
            billingStatus: 'unbilled',
            invoiceId: null,
            billedAt: null,
        }));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-undo')).toEqual(expect.objectContaining({
            lastBilledAt: Date.parse('2025-01-01T00:00:00Z'),
        }));
        expect(readStored<Record<string, unknown>>(context.maps.tasks, 'task-quote-undo')).toEqual(expect.objectContaining({
            estimatedFlatAmount: 500,
            quotedAmountBilling: null,
        }));
        expect(readStored<Record<string, unknown>>(context.maps.projects, 'project-1')).toEqual(expect.objectContaining({
            invoiceIds: [],
        }));
        expect(readStored<Record<string, unknown>>(context.maps.invoiceTemplates, 'template-undo')).toEqual(expect.objectContaining({
            currentSequentialNumber: 7,
        }));

        await expect(executeAgentCommand(context, 'undo_latest_invoice', {
            invoiceId: 'invoice-undo',
            confirmUndo: true,
            confirmationText: 'INV-7',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'undo_latest_invoice',
            error: expect.objectContaining({
                code: 'NOT_FOUND',
            }),
        }));
    });

    it('exports invoice PDFs in the browser app context without returning PDF bytes', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'export']);
        context.maps.invoices.set('invoice-pdf', objectToYMap({
            id: 'invoice-pdf',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-PDF',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            htmlContent: '<div>stale</div>',
        }));
        context.maps.businessBrandAssets.set('asset-1', objectToYMap({
            id: 'asset-1',
            businessInfoId: 'business-1',
            kind: 'logo',
            dataUrl: 'data:image/png;base64,abc',
            mimeType: 'image/png',
            width: 10,
            height: 10,
            byteSize: 3,
            contentHash: 'hash',
            createdAt: 1,
        }));

        const result = await exportInvoicePdfCommand(context, {
            invoiceId: 'invoice-pdf',
            filename: 'custom-export',
        });

        expect(result).toEqual({
            invoiceId: 'invoice-pdf',
            invoiceNumber: 'INV-PDF',
            filename: 'custom-export.pdf',
            downloadStarted: true,
        });
        expect(pdfMocks.getCurrentInvoiceHtmlContent).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'invoice-pdf', invoiceNumber: 'INV-PDF' }),
            [expect.objectContaining({ id: 'client-1' })],
            [expect.objectContaining({ id: 'asset-1' })],
        );
        expect(pdfMocks.generatePDF).toHaveBeenCalledWith('<div>Invoice HTML</div>', 'custom-export.pdf');

        await expect(executeAgentCommand(context, 'export_invoice_pdf', {
            invoiceId: 'invoice-pdf',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'export_invoice_pdf',
            data: expect.objectContaining({
                filename: 'invoice-INV-PDF.pdf',
                downloadStarted: true,
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'export_invoice_pdf', {
            invoiceId: 'invoice-pdf',
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'export_invoice_pdf',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'export' },
            }),
        }));
    });

    it('previews and sends invoice email through the browser app context', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'email']);
        context.driveSessionId = 'drive-session-1';
        context.now = () => Date.parse('2026-06-25T15:00:00Z');
        context.maps.clients.set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
            contactPerson: 'Alex Client',
            email: 'billing@example.com',
        }));
        context.maps.businessInfos.set('business-1', objectToYMap({
            id: 'business-1',
            title: 'TaskTime Pro LLC',
            businessName: 'TaskTime Pro LLC',
            email: 'hello@tasktime.test',
            isDefault: true,
        }));
        context.maps.emailTemplates.set('email-template-1', objectToYMap({
            id: 'email-template-1',
            name: 'Default invoice email',
            type: 'invoice',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'billing@tasktime.test',
            subject: 'Invoice {invoiceNumber} from {businessName}',
            sendBody: 'Hi {clientName}, pay {currency}{amount} by {dueDate}.',
            reminderBody: 'Reminder for {invoiceNumber}.',
            attachmentTitle: 'invoice-{invoiceNumber}',
            isDefault: true,
        }));
        context.maps.invoices.set('invoice-email', objectToYMap({
            id: 'invoice-email',
            projectId: 'project-1',
            clientId: 'client-1',
            businessInfoId: 'business-1',
            invoiceNumber: 'INV-EMAIL',
            date: '2026-06-25',
            dueDate: '2026-07-09',
            status: 'sent',
            currency: 'USD',
            items: [],
            subtotal: 125,
            total: 125,
        }));

        const preview = previewInvoiceEmailCommand(context, {
            invoiceId: 'invoice-email',
        });

        expect(preview).toEqual(expect.objectContaining({
            invoiceId: 'invoice-email',
            invoiceNumber: 'INV-EMAIL',
            sendType: 'invoice',
            templateId: 'email-template-1',
            to: 'billing@example.com',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'billing@tasktime.test',
            subject: 'Invoice INV-EMAIL from TaskTime Pro LLC',
            body: expect.stringContaining('Hi Alex Client'),
            attachmentTitle: 'invoice-INV-EMAIL',
            forwardTo: null,
        }));

        const result = await sendInvoiceEmailCommand(context, {
            invoiceId: 'invoice-email',
            forwardToSelf: true,
            confirmSend: true,
        });

        expect(pdfMocks.getCurrentInvoiceHtmlContent).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'invoice-email' }),
            [expect.objectContaining({ id: 'client-1' })],
            [],
        );
        expect(pdfMocks.generatePDFBase64).toHaveBeenCalledWith('<div>Invoice HTML</div>');
        expect(emailMocks.sendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'drive-session-1',
            invoiceId: 'invoice-email',
            invoiceNumber: 'INV-EMAIL',
            to: 'billing@example.com',
            forwardTo: 'billing@tasktime.test',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'billing@tasktime.test',
            subject: 'Invoice INV-EMAIL from TaskTime Pro LLC',
            bodyText: expect.stringContaining('Hi Alex Client'),
            pdfBase64: 'mock-pdf-base64',
            sendType: 'invoice',
            attachmentTitle: 'invoice-INV-EMAIL',
        }));
        expect(result).toEqual(expect.objectContaining({
            invoiceId: 'invoice-email',
            invoiceNumber: 'INV-EMAIL',
            sendType: 'invoice',
            to: 'billing@example.com',
            forwarded: true,
            remaining: 9,
            updatedInvoice: true,
            status: 'sent',
            sentAt: Date.parse('2026-06-25T15:00:00Z'),
        }));
        expect(readStored<any>(context.maps.invoices, 'invoice-email')).toEqual(expect.objectContaining({
            status: 'sent',
            sentToEmail: 'billing@example.com',
            sentAt: Date.parse('2026-06-25T15:00:00Z'),
        }));

        await expect(executeAgentCommand(context, 'send_invoice_email', {
            invoiceId: 'invoice-email',
            sendType: 'reminder',
            to: 'custom@example.com',
            subject: 'Manual subject',
            body: 'Manual body',
            attachmentTitle: 'manual.pdf',
            confirmSend: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'send_invoice_email',
            data: expect.objectContaining({
                sendType: 'reminder',
                to: 'custom@example.com',
                status: 'sent',
            }),
        }));

        context.permissions = new Set(['read', 'write']);
        await expect(executeAgentCommand(context, 'send_invoice_email', {
            invoiceId: 'invoice-email',
            confirmSend: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'send_invoice_email',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'email' },
            }),
        }));
    });

    it('previews, exports, and sends non-persistent project quotes without invoice mutations', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'export', 'email']);
        context.driveSessionId = 'drive-session-quote';
        context.now = () => Date.parse('2026-06-26T09:10:11Z');
        context.maps.clients.set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
            clientName: 'Client One Ltd',
            contactPerson: 'Alex Client',
            email: 'quote@example.com',
            defaultCurrency: 'USD',
        }));
        context.maps.projects.set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Quote Project',
            preferredClientId: 'client-1',
            hourlyRate: 150,
            flatRate: false,
            statusMode: 'quote',
        }));
        context.maps.tasks.set('quote-task-1', objectToYMap({
            id: 'quote-task-1',
            projectId: 'project-1',
            title: 'Discovery',
            billable: true,
            estimatedHours: 2,
        }));
        context.maps.businessInfos.set('business-quote', objectToYMap({
            id: 'business-quote',
            title: 'TaskTime Pro Studio',
            businessName: 'TaskTime Pro Studio',
            email: 'hello@tasktime.test',
            isDefault: true,
        }));
        context.maps.invoiceTemplates.set('template-quote', objectToYMap({
            id: 'template-quote',
            name: 'Quote template',
            isDefault: true,
            defaultNotes: 'Default quote note',
        }));
        context.maps.emailTemplates.set('email-template-quote-default', objectToYMap({
            id: 'email-template-quote-default',
            name: 'Default quote email',
            type: 'quote',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'quotes@tasktime.test',
            subject: 'Quote {invoiceNumber} from {businessName}',
            sendBody: 'Hi {clientName}, quote total is {currency}{amount}.',
            reminderBody: 'Quote reminder',
            attachmentTitle: 'quote-{invoiceNumber}',
            isDefault: true,
        }));

        const preview = previewProjectQuoteCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
        });

        expect(preview).toEqual(expect.objectContaining({
            projectId: 'project-1',
            quote: expect.objectContaining({
                id: 'QUOTE-project-1-26091011',
                documentMode: 'quote',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: '26091011',
                total: 300,
                subtotal: 300,
                status: 'sent',
                items: [],
            }),
            sideEffects: {
                createsInvoice: false,
                marksEntriesBilled: false,
                marksExpensesBilled: false,
                updatesTaskBillingCutoffs: false,
                updatesProjectInvoiceReferences: false,
                advancesInvoiceSequence: false,
            },
        }));
        expect(context.maps.invoices.size).toBe(0);

        const pdf = await exportProjectQuotePdfCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
        });

        expect(pdf).toEqual({
            projectId: 'project-1',
            quoteId: 'QUOTE-project-1-26091011',
            quoteNumber: '26091011',
            filename: 'quote-project-quote-2026-06-26.pdf',
            downloadStarted: true,
        });
        expect(pdfMocks.getCurrentInvoiceHtmlContent).toHaveBeenCalledWith(
            expect.objectContaining({ documentMode: 'quote', invoiceNumber: '26091011' }),
            [expect.objectContaining({ id: 'client-1' })],
            [],
        );
        expect(pdfMocks.generatePDF).toHaveBeenCalledWith('<div>Invoice HTML</div>', 'quote-project-quote-2026-06-26.pdf');

        const emailPreview = previewProjectQuoteEmailCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
            forwardToSelf: true,
        });

        expect(emailPreview).toEqual(expect.objectContaining({
            invoiceId: 'QUOTE-project-1-26091011',
            invoiceNumber: '26091011',
            sendType: 'quote',
            templateId: 'email-template-quote-default',
            to: 'quote@example.com',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'quotes@tasktime.test',
            subject: 'Quote 26091011 from TaskTime Pro Studio',
            body: expect.stringContaining('quote total is $300.00'),
            attachmentTitle: 'quote-26091011',
            forwardTo: 'quotes@tasktime.test',
        }));

        await expect(sendProjectQuoteEmailCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
            confirmSend: false,
        })).rejects.toThrow(/confirmSend/);

        const sent = await sendProjectQuoteEmailCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
            confirmSend: true,
            forwardToSelf: true,
            idempotencyKey: 'quote-send-1',
        });
        const repeated = await sendProjectQuoteEmailCommand(context, {
            projectId: 'project-1',
            quoteDate: '2026-06-26',
            quoteTimestamp: '26091011',
            confirmSend: true,
            forwardToSelf: true,
            idempotencyKey: 'quote-send-1',
        });

        expect(repeated).toBe(sent);
        expect(emailMocks.sendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'drive-session-quote',
            invoiceId: 'QUOTE-project-1-26091011',
            invoiceNumber: '26091011',
            to: 'quote@example.com',
            forwardTo: 'quotes@tasktime.test',
            fromName: 'Jane at TaskTime Pro',
            replyTo: 'quotes@tasktime.test',
            subject: 'Quote 26091011 from TaskTime Pro Studio',
            bodyText: expect.stringContaining('quote total is $300.00'),
            pdfBase64: 'mock-pdf-base64',
            sendType: 'quote',
            attachmentTitle: 'quote-26091011',
        }));
        expect(sent).toEqual({
            projectId: 'project-1',
            quoteId: 'QUOTE-project-1-26091011',
            quoteNumber: '26091011',
            sendType: 'quote',
            to: 'quote@example.com',
            forwarded: true,
            remaining: 9,
            updatedInvoice: false,
            sentAt: null,
        });
        expect(context.maps.invoices.size).toBe(0);

        await expect(executeAgentCommand(context, 'preview_project_quote', {
            projectId: 'project-1',
            quoteTimestamp: '26091011',
        })).resolves.toEqual(expect.objectContaining({
            ok: true,
            command: 'preview_project_quote',
            data: expect.objectContaining({
                quote: expect.objectContaining({
                    documentMode: 'quote',
                    invoiceNumber: '26091011',
                }),
            }),
        }));

        context.permissions = new Set(['read']);
        await expect(executeAgentCommand(context, 'send_project_quote_email', {
            projectId: 'project-1',
            confirmSend: true,
        })).resolves.toEqual(expect.objectContaining({
            ok: false,
            command: 'send_project_quote_email',
            error: expect.objectContaining({
                code: 'PERMISSION_DENIED',
                details: { scope: 'email' },
            }),
        }));
    });

    it('dispatches commands through the registry with structured success responses', async () => {
        const context = createContext();

        const response = await executeAgentCommand(context, 'create_task', {
            title: 'Registry task',
            projectId: 'project-1',
        });

        expect(response).toEqual(expect.objectContaining({
            ok: true,
            command: 'create_task',
        }));

        if (response.ok) {
            expect(response.data).toEqual(expect.objectContaining({
                title: 'Registry task',
                projectId: 'project-1',
            }));
        }
    });

    it('fails closed for unsupported commands and missing scopes', async () => {
        const context = createContext();
        context.permissions = new Set(['read']);

        await expect(executeAgentCommand(context, 'not_a_command', {})).resolves.toEqual({
            ok: false,
            command: 'not_a_command',
            error: {
                code: 'INVALID_INPUT',
                message: 'Unsupported agent command: not_a_command',
            },
        });

        await expect(executeAgentCommand(context, 'create_task', { title: 'Denied' })).resolves.toEqual({
            ok: false,
            command: 'create_task',
            error: {
                code: 'PERMISSION_DENIED',
                message: 'Missing write permission.',
                details: { scope: 'write' },
            },
        });

        context.permissions = new Set(['read', 'write']);
        await expect(executeAgentCommand(context, 'finalize_invoice', {
            invoiceId: 'invoice-1',
            confirmFinalize: true,
        })).resolves.toEqual({
            ok: false,
            command: 'finalize_invoice',
            error: {
                code: 'PERMISSION_DENIED',
                message: 'Missing billing permission.',
                details: { scope: 'billing' },
            },
        });
    });

    it('filters command definitions by granted permissions', () => {
        const context = createContext();
        context.permissions = new Set(['read']);

        const definitions = listAgentCommandDefinitions(context);

        expect(definitions.map((definition) => definition.name)).toContain('list_tasks');
        expect(definitions.map((definition) => definition.name)).not.toContain('create_task');
        expect(definitions.every((definition) => !('handler' in definition))).toBe(true);
    });
});
