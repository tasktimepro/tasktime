// @ts-nocheck
/**
 * BackupManager - Automated daily backups to Google Drive
 *
 * Sync contract source of truth: ../../../components/sync/README.md
 * 
 * Creates full JSON snapshots of all data in appDataFolder.
 * Independent from Yjs sync — sync operations cannot delete backups.
 * 
 * Retention policy:
 * - Keep the latest backup per day for the last 7 days
 * - Keep 1 weekly backup (Sunday) for the last 4 weeks
 * - ~11 files max
 * 
 * File naming: tasktime-backup-YYYY-MM-DD-HHmm.json
 */

import { ManifestManager } from './ManifestManager';
import type { YjsStore } from '../YjsStore';

const BACKUP_PREFIX = 'tasktime-backup-';

/** Number of recent daily backups to retain */
const DAILY_RETENTION = 7;

/** Number of weekly (Sunday) backups to retain */
const WEEKLY_RETENTION = 4;

export interface BackupInfo {
    id: string;
    name: string;
    date: string;
    modifiedTime: string;
    sizeLabel?: string;
}

export class BackupManager {

    private manifest: ManifestManager;
    private store: YjsStore;
    private lastBackupAt: number | null = null;

    constructor(manifest: ManifestManager, store: YjsStore) {
        this.manifest = manifest;
        this.store = store;
    }

    /**
     * Check if a file is a backup file (by name prefix)
     */
    static isBackupFile(name: string): boolean {
        return name.startsWith(BACKUP_PREFIX);
    }

    /**
     * Create a backup if enough time has passed since the last one.
     * Called after each successful sync.
     * 
     * @param frequencyHours - Minimum hours between backups (user preference)
     */
    async maybeCreateBackup(frequencyHours: number): Promise<boolean> {
        try {
            // Fast path: skip Drive listing if we know it's too soon
            const frequencyMs = frequencyHours * 60 * 60 * 1000;
            if (this.lastBackupAt != null && (Date.now() - this.lastBackupAt) < frequencyMs) {
                return false;
            }

            const backups = await this.listBackups();

            if (backups.length > 0) {
                const latest = backups[0]; // sorted newest first
                const latestTime = new Date(latest.modifiedTime).getTime();
                this.lastBackupAt = latestTime;
                const hoursSince = (Date.now() - latestTime) / (1000 * 60 * 60);

                if (hoursSince < frequencyHours) {
                    return false;
                }
            }

            await this.createBackup();
            this.lastBackupAt = Date.now();
            await this.pruneBackups();
            return true;
        } catch (error) {
            // Backup failures should never break sync
            console.error('[BackupManager] maybeCreateBackup failed:', error);
            return false;
        }
    }

    /**
     * Create a full backup snapshot
     */
    async createBackup(): Promise<string> {
        const data = await this.store.exportBackupData({
            backupType: 'automatic',
            refreshLazyDocsFromCloud: true,
        });
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeStr = now.toISOString().slice(11, 16).replace(':', ''); // HHmm
        const fileName = `${BACKUP_PREFIX}${dateStr}-${timeStr}.json`;

        const fileId = await this.manifest.createFile(fileName, blob);
        console.log(`[BackupManager] Created backup: ${fileName}`);
        return fileId;
    }

    /**
     * List all backups, sorted by date (newest first)
     */
    async listBackups(): Promise<BackupInfo[]> {
        const allFiles = await this.manifest.listAppDataFiles();

        return allFiles
            .filter(f => BackupManager.isBackupFile(f.name))
            .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
            .map(f => ({
                id: f.id,
                name: f.name,
                date: this.extractDateFromName(f.name),
                modifiedTime: f.modifiedTime,
            }));
    }

    /**
     * Download and return a specific backup's content
     */
    async downloadBackup(fileId: string): Promise<unknown> {
        return this.manifest.downloadFileAsJson(fileId);
    }

    /**
     * Delete all backup files (for "delete all account data" flow)
     */
    async deleteAllBackups(): Promise<void> {
        const backups = await this.listBackups();
        const failures: Array<{ backup: BackupInfo; error: unknown }> = [];

        for (const backup of backups) {
            try {
                await this.manifest.deleteFileById(backup.id);
            } catch (error) {
                failures.push({ backup, error });
            }
        }

        const remainingBackups = await this.listBackups();

        if (failures.length > 0 || remainingBackups.length > 0) {
            const failedNames = new Set([
                ...failures.map(({ backup }) => backup.name),
                ...remainingBackups.map((backup) => backup.name),
            ]);

            throw new Error(
                `Could not delete ${failedNames.size} Drive backup${failedNames.size === 1 ? '' : 's'}. `
                + 'Your account data was not fully deleted. Check your connection and retry before disconnecting Drive.'
            );
        }

        console.log(`[BackupManager] Deleted ${backups.length} backups`);
    }

    /**
     * Prune old backups according to retention policy.
     * Keep last N daily + last M weekly (Sunday).
     */
    private async pruneBackups(): Promise<void> {
        const backups = await this.listBackups();
        if (backups.length === 0) return;

        // Group by date (YYYY-MM-DD)
        const byDate = new Map<string, BackupInfo[]>();

        for (const b of backups) {
            const group = byDate.get(b.date) || [];
            group.push(b);
            byDate.set(b.date, group);
        }

        // Sort dates newest first
        const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

        const keepIds = new Set<string>();

        // Keep the latest backup for the most recent N days
        let dailyKept = 0;

        for (const date of sortedDates) {
            if (dailyKept >= DAILY_RETENTION) break;
            const group = byDate.get(date)!;
            keepIds.add(group[0].id); // newest for that day
            dailyKept++;
        }

        // Keep the latest Sunday backup for the last M weeks
        let weeklyKept = 0;

        for (const date of sortedDates) {
            if (weeklyKept >= WEEKLY_RETENTION) break;
            const dayOfWeek = new Date(date + 'T00:00:00').getDay();

            if (dayOfWeek === 0) { // Sunday
                const group = byDate.get(date)!;
                keepIds.add(group[0].id);
                weeklyKept++;
            }
        }

        // Delete everything not in the keep set
        const toDelete = backups.filter(b => !keepIds.has(b.id));

        for (const b of toDelete) {
            try {
                await this.manifest.deleteFileById(b.id);
            } catch (error) {
                console.warn(`[BackupManager] Prune failed for ${b.name}:`, error);
            }
        }

        if (toDelete.length > 0) {
            console.log(`[BackupManager] Pruned ${toDelete.length} old backups, kept ${keepIds.size}`);
        }
    }

    /**
     * Extract YYYY-MM-DD from a backup filename
     */
    private extractDateFromName(name: string): string {
        // tasktime-backup-YYYY-MM-DD-HHmm.json → YYYY-MM-DD
        const match = name.match(/tasktime-backup-(\d{4}-\d{2}-\d{2})/);
        return match?.[1] ?? 'unknown';
    }
}
