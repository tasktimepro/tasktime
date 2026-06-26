import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import { getBackupImportCounts, parseBackupImportJson } from '@/utils/backupData';
import { resetOnboardingCompleted } from '@/utils/onboardingUtils';
import { assertPermission, assertReady, requireString } from './shared';

export interface ExportBackupJsonCommandInput {
    exportDate?: string;
    filename?: string;
    refreshFromCloud?: boolean;
}

export interface BackupJsonCommandInput {
    backupJson?: string;
}

export interface RestoreBackupJsonCommandInput extends BackupJsonCommandInput {
    confirmRestore?: boolean;
    confirmationText?: string;
}

export interface DriveBackupCommandInput {
    backupId?: string;
    filename?: string;
}

export interface RestoreDriveBackupCommandInput {
    backupId?: string;
    confirmRestore?: boolean;
    confirmationText?: string;
}

export interface UpdateSyncSettingsCommandInput {
    autoSyncEnabled?: boolean;
    autoSyncMode?: 'backup' | 'sync';
    backupEnabled?: boolean;
    backupFrequencyHours?: number;
    confirmBackupMode?: boolean;
    runSync?: boolean;
}

export interface DeleteAllAccountDataCommandInput {
    confirmDelete?: boolean;
    confirmationText?: string;
    includeDriveData?: boolean;
}

const normalizeJsonFilename = (filename: string) => {
    const trimmed = filename.trim();

    if (!trimmed) {
        return trimmed;
    }

    return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
};

const getDefaultBackupFilename = (timestamp: number) => {
    return `tasktime-backup-${new Date(timestamp).toISOString().slice(0, 10)}.json`;
};

const downloadJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const summarizeBackupInfo = (backup: { id: string; name: string; date: string; modifiedTime: string; sizeLabel?: string }) => ({
    id: backup.id,
    name: backup.name,
    date: backup.date,
    modifiedTime: backup.modifiedTime,
    ...(backup.sizeLabel ? { sizeLabel: backup.sizeLabel } : {}),
});

const parseDownloadedBackup = (data: unknown) => {
    const serialized = JSON.stringify(data);

    if (!serialized) {
        throw new AgentCommandError('INVALID_INPUT', 'Downloaded Drive backup is empty or invalid.');
    }

    return parseBackupImportJson(serialized);
};

async function downloadDriveBackup(context: AgentCommandContext, backupId: string) {
    try {
        return await context.store.downloadBackup(backupId);
    } catch {
        throw new AgentCommandError('UNAVAILABLE', 'Drive backup is unavailable. Connect Google Drive and try again.', {
            backupId,
        });
    }
}

function getCurrentSyncSettings(context: AgentCommandContext) {
    const autoSyncEnabled = context.store.preferences.get('autoSyncEnabled') === true;
    const autoSyncMode = context.store.preferences.get('autoSyncMode') === 'backup' ? 'backup' : 'sync';

    return {
        isDriveConnected: context.store.isDriveConnected(),
        syncState: context.store.getSyncState(),
        syncPhase: context.store.getSyncPhase(),
        driveSyncMode: context.store.getDriveSyncMode(),
        lastSyncedAt: context.store.getLastSyncedAt(),
        pendingSyncChanges: context.store.hasPendingSyncChanges(),
        autoSyncEnabled,
        autoSyncMode,
        backupEnabled: context.store.preferences.get('backupEnabled') ?? true,
        backupFrequencyHours: context.store.preferences.get('backupFrequencyHours') ?? 24,
    };
}

export async function exportBackupJsonCommand(context: AgentCommandContext, input: ExportBackupJsonCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const backup = await context.store.exportBackupData({
        backupType: 'manual',
        exportDate: input.exportDate,
        refreshFromCloud: input.refreshFromCloud === true,
    });
    const filename = normalizeJsonFilename(input.filename || getDefaultBackupFilename(context.now?.() || Date.now()));

    downloadJsonFile(filename, backup);

    return {
        filename,
        version: backup.version,
        exportDate: backup.exportDate,
        refreshFromCloud: input.refreshFromCloud === true,
        counts: {
            businessBrandAssets: backup.businessBrandAssets.length,
            businessInfos: backup.businessInfos.length,
            clients: backup.clients.length,
            dailyGoals: backup.dailyGoals.length,
            emailTemplates: backup.emailTemplates.length,
            expenseCategories: backup.expenseCategories?.length || 0,
            expenseRecurrences: backup.expenseRecurrences.length,
            expenses: backup.expenses.length,
            invoices: backup.invoices.length,
            invoiceTemplates: backup.invoiceTemplates.length,
            paymentMethods: backup.paymentMethods.length,
            plannerAttachments: backup.plannerAttachments.length,
            projects: backup.projects.length,
            tasks: backup.tasks.length,
            taxReturnPeriods: backup.taxReturnPeriods?.length || 0,
            timeEntries: backup.timeEntries.length,
        },
        downloadStarted: true,
    };
}

export async function listDriveBackupsCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const backups = await context.store.listBackups();

    return {
        backups: backups.map(summarizeBackupInfo),
        count: backups.length,
    };
}

export async function createDriveBackupCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    try {
        const fileId = await context.store.createBackup();

        return {
            created: true,
            fileId,
        };
    } catch {
        throw new AgentCommandError('UNAVAILABLE', 'Drive backup creation is unavailable. Connect Google Drive and try again.');
    }
}

export async function downloadDriveBackupJsonCommand(context: AgentCommandContext, input: DriveBackupCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const backupId = requireString(input.backupId, 'backupId');
    const data = await downloadDriveBackup(context, backupId);
    const backup = parseDownloadedBackup(data);
    const filename = normalizeJsonFilename(input.filename || getDefaultBackupFilename(context.now?.() || Date.now()));

    downloadJsonFile(filename, data);

    return {
        backupId,
        filename,
        version: backup.version || null,
        exportDate: backup.exportDate || null,
        backupType: backup.backupType || null,
        counts: getBackupImportCounts(backup),
        downloadStarted: true,
    };
}

export function previewBackupImportJsonCommand(context: AgentCommandContext, input: BackupJsonCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');

    const backupJson = requireString(input.backupJson, 'backupJson');
    const backup = parseBackupImportJson(backupJson);

    return {
        valid: true,
        version: backup.version || null,
        exportDate: backup.exportDate || null,
        backupType: backup.backupType || null,
        counts: getBackupImportCounts(backup),
        willReplaceCurrentData: true,
        mutatesData: false,
    };
}

async function clearAllDataForRestore(context: AgentCommandContext) {
    if (context.clearAllData) {
        await context.clearAllData();
        return;
    }

    await context.store.clearAllData();
    await context.store.initialize();
}

export async function restoreBackupJsonCommand(context: AgentCommandContext, input: RestoreBackupJsonCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'export');

    if (input.confirmRestore !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'Restoring a backup requires confirmRestore: true.');
    }

    if (input.confirmationText?.trim() !== 'RESTORE') {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must be RESTORE to restore backup data.', {
            field: 'confirmationText',
        });
    }

    const backupJson = requireString(input.backupJson, 'backupJson');
    const backup = parseBackupImportJson(backupJson);
    const counts = getBackupImportCounts(backup);

    await clearAllDataForRestore(context);
    await context.store.importBackupData(backup);

    return {
        restored: true,
        version: backup.version || null,
        exportDate: backup.exportDate || null,
        backupType: backup.backupType || null,
        counts,
        replacedCurrentData: true,
    };
}

export async function restoreDriveBackupCommand(context: AgentCommandContext, input: RestoreDriveBackupCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'export');

    if (input.confirmRestore !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'Restoring a Drive backup requires confirmRestore: true.');
    }

    if (input.confirmationText?.trim() !== 'RESTORE') {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must be RESTORE to restore Drive backup data.', {
            field: 'confirmationText',
        });
    }

    const backupId = requireString(input.backupId, 'backupId');
    const data = await downloadDriveBackup(context, backupId);
    const backup = parseDownloadedBackup(data);
    const counts = getBackupImportCounts(backup);

    await clearAllDataForRestore(context);
    await context.store.importBackupData(backup);

    return {
        restored: true,
        backupId,
        version: backup.version || null,
        exportDate: backup.exportDate || null,
        backupType: backup.backupType || null,
        counts,
        replacedCurrentData: true,
    };
}

export function getSyncStatusCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');

    return getCurrentSyncSettings(context);
}

export async function updateSyncSettingsCommand(context: AgentCommandContext, input: UpdateSyncSettingsCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'export');

    const current = getCurrentSyncSettings(context);
    const nextAutoSyncEnabled = input.autoSyncEnabled ?? current.autoSyncEnabled;
    const nextAutoSyncMode = input.autoSyncMode ?? current.autoSyncMode;

    if (input.autoSyncEnabled !== undefined && typeof input.autoSyncEnabled !== 'boolean') {
        throw new AgentCommandError('INVALID_INPUT', 'autoSyncEnabled must be a boolean.', { field: 'autoSyncEnabled' });
    }

    if (input.autoSyncMode !== undefined && input.autoSyncMode !== 'backup' && input.autoSyncMode !== 'sync') {
        throw new AgentCommandError('INVALID_INPUT', 'autoSyncMode must be backup or sync.', { field: 'autoSyncMode' });
    }

    if (input.backupEnabled !== undefined && typeof input.backupEnabled !== 'boolean') {
        throw new AgentCommandError('INVALID_INPUT', 'backupEnabled must be a boolean.', { field: 'backupEnabled' });
    }

    if (input.backupFrequencyHours !== undefined && (!Number.isInteger(input.backupFrequencyHours) || input.backupFrequencyHours < 1)) {
        throw new AgentCommandError('INVALID_INPUT', 'backupFrequencyHours must be an integer of at least 1.', {
            field: 'backupFrequencyHours',
        });
    }

    if (nextAutoSyncEnabled && nextAutoSyncMode === 'backup' && input.confirmBackupMode !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'Enabling backup mode requires confirmBackupMode: true.');
    }

    context.store.preferences.set('autoSyncEnabled', nextAutoSyncEnabled);
    context.store.preferences.set('autoSyncMode', nextAutoSyncMode);
    context.store.setDriveSyncPreferences(nextAutoSyncEnabled, nextAutoSyncMode);

    if (input.backupEnabled !== undefined) {
        context.store.preferences.set('backupEnabled', input.backupEnabled);
    }

    if (input.backupFrequencyHours !== undefined) {
        context.store.preferences.set('backupFrequencyHours', input.backupFrequencyHours);
    }

    let syncTriggered = false;

    if (input.runSync === true && context.store.isDriveConnected()) {
        try {
            await context.store.forceDriveSync();
            syncTriggered = true;
        } catch {
            throw new AgentCommandError('UNAVAILABLE', 'Sync settings were saved, but the requested sync failed. Check Google Drive connection and try Sync Now.');
        }
    }

    return {
        ...getCurrentSyncSettings(context),
        syncTriggered,
    };
}

export async function deleteAllAccountDataCommand(context: AgentCommandContext, input: DeleteAllAccountDataCommandInput = {}) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'export');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'Deleting all account data requires confirmDelete: true.');
    }

    if (input.confirmationText?.trim() !== 'DELETE ALL DATA') {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must be DELETE ALL DATA to delete all account data.', {
            field: 'confirmationText',
        });
    }

    const isDriveConnected = context.store.isDriveConnected();

    if (isDriveConnected && input.includeDriveData !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'includeDriveData must be true when Google Drive is connected.', {
            field: 'includeDriveData',
        });
    }

    let driveDataDeleted = false;
    let driveBackupsDeleted = false;
    let driveAccessRevoked = false;

    if (isDriveConnected) {
        await context.store.wipeDriveData();
        driveDataDeleted = true;

        await context.store.deleteAllBackups();
        driveBackupsDeleted = true;

        if (context.revokeDriveAccess) {
            await context.revokeDriveAccess();
            driveAccessRevoked = true;
        }
    }

    await clearAllDataForRestore(context);
    resetOnboardingCompleted();

    return {
        deleted: true,
        localDataDeleted: true,
        driveDataDeleted,
        driveBackupsDeleted,
        driveAccessRevoked,
        reloadRecommended: true,
    };
}
