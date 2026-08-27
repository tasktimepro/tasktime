import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import type { AutoSyncMode } from '@/stores/yjs/types';
import { getBackupImportCounts, parseBackupImportJson, type BackupImportPayload } from '@/utils/backupData';
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

export interface CloudBackupCommandInput {
    backupId?: string;
    filename?: string;
}

export interface RestoreCloudBackupCommandInput {
    backupId?: string;
    confirmRestore?: boolean;
    confirmationText?: string;
}

/** @deprecated Use CloudBackupCommandInput with the provider-neutral commands. */
export type DriveBackupCommandInput = CloudBackupCommandInput;
/** @deprecated Use RestoreCloudBackupCommandInput with the provider-neutral commands. */
export type RestoreDriveBackupCommandInput = RestoreCloudBackupCommandInput;

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
    includeCloudData?: boolean;
    /** @deprecated Use includeCloudData. */
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

const parseDownloadedBackup = (data: unknown, providerLabel = 'Cloud') => {
    const serialized = JSON.stringify(data);

    if (!serialized) {
        throw new AgentCommandError('INVALID_INPUT', `Downloaded ${providerLabel} backup is empty or invalid.`);
    }

    return parseBackupImportJson(serialized);
};

function getActiveCloudProvider(context: AgentCommandContext) {
    return context.store.getActiveCloudProviderId();
}

function getActiveCloudProviderLabel(context: AgentCommandContext) {
    return getActiveCloudProvider(context) === 'dropbox' ? 'Dropbox' : 'Google Drive';
}

function assertGoogleDriveBackupAvailable(context: AgentCommandContext) {
    if (getActiveCloudProvider(context) !== 'google-drive' || !context.store.isDriveConnected()) {
        throw new AgentCommandError(
            'UNAVAILABLE',
            'This Drive-named command requires Google Drive to be the active connected provider.',
        );
    }
}

function assertCloudBackupAvailable(context: AgentCommandContext) {
    const provider = getActiveCloudProvider(context);
    if (!provider || !context.store.isCloudConnected()) {
        throw new AgentCommandError('UNAVAILABLE', 'Connect cloud storage and try again.');
    }
    return provider;
}

async function downloadCloudBackup(
    context: AgentCommandContext,
    backupId: string,
    options: { googleOnly?: boolean } = {},
) {
    if (options.googleOnly) assertGoogleDriveBackupAvailable(context);
    else assertCloudBackupAvailable(context);
    try {
        return await context.store.downloadBackup(backupId);
    } catch {
        const providerLabel = options.googleOnly ? 'Drive' : getActiveCloudProviderLabel(context);
        throw new AgentCommandError('UNAVAILABLE', `${providerLabel} backup is unavailable. Connect ${providerLabel} and try again.`, {
            backupId,
        });
    }
}

function getCurrentSyncSettings(context: AgentCommandContext) {
    const autoSyncEnabled = context.store.preferences.get('autoSyncEnabled') === true;
    const autoSyncMode: AutoSyncMode = context.store.preferences.get('autoSyncMode') === 'backup' ? 'backup' : 'sync';

    const activeStorageProvider = getActiveCloudProvider(context);
    const isCloudConnected = context.store.isCloudConnected();

    return {
        activeStorageProvider,
        isCloudConnected,
        isDriveConnected: context.store.isDriveConnected(),
        syncState: context.store.getSyncState(),
        syncPhase: context.store.getSyncPhase(),
        cloudSyncMode: context.store.getDriveSyncMode(),
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

    assertGoogleDriveBackupAvailable(context);
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

    assertGoogleDriveBackupAvailable(context);
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
    const data = await downloadCloudBackup(context, backupId, { googleOnly: true });
    const backup = parseDownloadedBackup(data, 'Drive');
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
    } else {
        await context.store.clearAllData();
        await context.store.initialize();
    }
}

async function replaceAllDataForRestore(context: AgentCommandContext, backup: BackupImportPayload) {
    if (context.restoreBackupData) {
        await context.restoreBackupData(backup);
        return;
    }

    await clearAllDataForRestore(context);
    await context.store.importBackupData(backup);
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

    await replaceAllDataForRestore(context, backup);

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
    const data = await downloadCloudBackup(context, backupId, { googleOnly: true });
    const backup = parseDownloadedBackup(data, 'Drive');
    const counts = getBackupImportCounts(backup);

    await replaceAllDataForRestore(context, backup);

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

export async function listCloudBackupsCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');
    const provider = assertCloudBackupAvailable(context);
    const backups = await context.store.listBackups();

    return {
        provider,
        backups: backups.map(summarizeBackupInfo),
        count: backups.length,
    };
}

export async function createCloudBackupCommand(context: AgentCommandContext) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');
    const provider = assertCloudBackupAvailable(context);

    try {
        const fileId = await context.store.createBackup();
        return { created: true, provider, fileId };
    } catch {
        throw new AgentCommandError(
            'UNAVAILABLE',
            `${getActiveCloudProviderLabel(context)} backup creation is unavailable. Reconnect cloud storage and try again.`,
        );
    }
}

export async function downloadCloudBackupJsonCommand(
    context: AgentCommandContext,
    input: CloudBackupCommandInput = {},
) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');
    const provider = assertCloudBackupAvailable(context);
    const backupId = requireString(input.backupId, 'backupId');
    const data = await downloadCloudBackup(context, backupId);
    const backup = parseDownloadedBackup(data, getActiveCloudProviderLabel(context));
    const filename = normalizeJsonFilename(input.filename || getDefaultBackupFilename(context.now?.() || Date.now()));

    downloadJsonFile(filename, data);
    return {
        provider,
        backupId,
        filename,
        version: backup.version || null,
        exportDate: backup.exportDate || null,
        backupType: backup.backupType || null,
        counts: getBackupImportCounts(backup),
        downloadStarted: true,
    };
}

export async function restoreCloudBackupCommand(
    context: AgentCommandContext,
    input: RestoreCloudBackupCommandInput = {},
) {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'export');
    const provider = assertCloudBackupAvailable(context);

    if (input.confirmRestore !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'Restoring a cloud backup requires confirmRestore: true.');
    }
    if (input.confirmationText?.trim() !== 'RESTORE') {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must be RESTORE to restore cloud backup data.', {
            field: 'confirmationText',
        });
    }

    const backupId = requireString(input.backupId, 'backupId');
    const data = await downloadCloudBackup(context, backupId);
    const backup = parseDownloadedBackup(data, getActiveCloudProviderLabel(context));
    const counts = getBackupImportCounts(backup);
    await replaceAllDataForRestore(context, backup);

    return {
        restored: true,
        provider,
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
    const activeProvider = getActiveCloudProvider(context);
    if (activeProvider === 'google-drive') {
        context.store.setDriveSyncPreferences(nextAutoSyncEnabled, nextAutoSyncMode);
    } else {
        context.store.setCloudSyncPreferences(nextAutoSyncEnabled, nextAutoSyncMode);
    }

    if (input.backupEnabled !== undefined) {
        context.store.preferences.set('backupEnabled', input.backupEnabled);
    }

    if (input.backupFrequencyHours !== undefined) {
        context.store.preferences.set('backupFrequencyHours', input.backupFrequencyHours);
    }

    let syncTriggered = false;

    if (input.runSync === true && context.store.isCloudConnected()) {
        try {
            if (activeProvider === 'google-drive') await context.store.forceDriveSync();
            else await context.store.forceCloudSync();
            syncTriggered = true;
        } catch {
            throw new AgentCommandError('UNAVAILABLE', 'Sync settings were saved, but the requested sync failed. Check the active cloud connection and try Sync Now.');
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

    const activeProvider = getActiveCloudProvider(context);
    const isCloudConnected = context.store.isCloudConnected();
    if (activeProvider && !isCloudConnected) {
        throw new AgentCommandError(
            'UNAVAILABLE',
            `Reconnect ${getActiveCloudProviderLabel(context)} before deleting all account data.`,
        );
    }
    if (isCloudConnected && !activeProvider) {
        throw new AgentCommandError('UNAVAILABLE', 'The active cloud provider could not be verified.');
    }

    const includeCloudData = input.includeCloudData === true || input.includeDriveData === true;
    if (isCloudConnected && !includeCloudData) {
        throw new AgentCommandError('INVALID_INPUT', 'includeCloudData (or legacy includeDriveData) must be true when cloud storage is connected.', {
            field: 'includeCloudData',
        });
    }

    let cloudDataDeleted = false;
    let cloudBackupsDeleted = false;
    let cloudAccessRevoked = false;

    if (isCloudConnected) {
        await context.store.wipeCloudData();
        cloudDataDeleted = true;

        await context.store.deleteAllBackups();
        cloudBackupsDeleted = true;

        if (context.disconnectActiveCloudSession) {
            await context.disconnectActiveCloudSession({ revoke: true });
            cloudAccessRevoked = true;
        } else if (activeProvider === 'google-drive' && context.revokeDriveAccess) {
            // Compatibility for older embedded clients during rolling upgrade.
            await context.revokeDriveAccess();
            cloudAccessRevoked = true;
        } else {
            throw new AgentCommandError('UNAVAILABLE', 'Cloud authorization could not be revoked safely.');
        }
    }

    await clearAllDataForRestore(context);
    resetOnboardingCompleted();

    return {
        deleted: true,
        localDataDeleted: true,
        cloudProvider: activeProvider,
        cloudDataDeleted,
        cloudBackupsDeleted,
        cloudAccessRevoked,
        // Preserve the legacy Google result fields for existing agent clients.
        driveDataDeleted: activeProvider === 'google-drive' && cloudDataDeleted,
        driveBackupsDeleted: activeProvider === 'google-drive' && cloudBackupsDeleted,
        driveAccessRevoked: activeProvider === 'google-drive' && cloudAccessRevoked,
        reloadRecommended: true,
    };
}
