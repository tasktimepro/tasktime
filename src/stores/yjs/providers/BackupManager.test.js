import { describe, expect, it, vi } from 'vitest'
import { BackupManager } from './BackupManager.ts'

function createManifest(backups) {
    return {
        listAppDataFiles: vi.fn()
            .mockResolvedValueOnce(backups)
            .mockResolvedValueOnce([]),
        deleteFileById: vi.fn(async () => undefined),
    }
}

describe('BackupManager', () => {
    it('refreshes every lazy Drive document before creating a backup', async () => {
        const manifest = {
            createFile: vi.fn(async () => 'backup-file-id'),
        }
        const store = {
            exportBackupData: vi.fn(async () => ({ version: '1.4', projects: [] })),
        }
        const manager = new BackupManager(manifest, store)

        await expect(manager.createBackup()).resolves.toBe('backup-file-id')

        expect(store.exportBackupData).toHaveBeenCalledWith({
            backupType: 'automatic',
            refreshLazyDocsFromCloud: true,
        })
    })

    it('deletes every Drive backup and verifies that none remain', async () => {
        const backups = [
            { id: 'backup-1', name: 'tasktime-backup-2026-07-10-0900.json', modifiedTime: '2026-07-10T09:00:00.000Z' },
            { id: 'backup-2', name: 'tasktime-backup-2026-07-09-0900.json', modifiedTime: '2026-07-09T09:00:00.000Z' },
        ]
        const manifest = createManifest(backups)
        const manager = new BackupManager(manifest, {})

        await expect(manager.deleteAllBackups()).resolves.toBeUndefined()

        expect(manifest.deleteFileById).toHaveBeenCalledTimes(2)
        expect(manifest.listAppDataFiles).toHaveBeenCalledTimes(2)
    })

    it('fails the account deletion flow when any Drive backup deletion fails', async () => {
        const backups = [
            { id: 'backup-1', name: 'tasktime-backup-2026-07-10-0900.json', modifiedTime: '2026-07-10T09:00:00.000Z' },
            { id: 'backup-2', name: 'tasktime-backup-2026-07-09-0900.json', modifiedTime: '2026-07-09T09:00:00.000Z' },
        ]
        const manifest = {
            listAppDataFiles: vi.fn()
                .mockResolvedValueOnce(backups)
                .mockResolvedValueOnce([backups[1]]),
            deleteFileById: vi.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Drive unavailable')),
        }
        const manager = new BackupManager(manifest, {})

        await expect(manager.deleteAllBackups()).rejects.toThrow(
            'Your account data was not fully deleted'
        )

        expect(manifest.deleteFileById).toHaveBeenCalledTimes(2)
    })

    it('fails when Drive still lists a backup after successful delete requests', async () => {
        const backup = {
            id: 'backup-1',
            name: 'tasktime-backup-2026-07-10-0900.json',
            modifiedTime: '2026-07-10T09:00:00.000Z',
        }
        const manifest = {
            listAppDataFiles: vi.fn()
                .mockResolvedValueOnce([backup])
                .mockResolvedValueOnce([backup]),
            deleteFileById: vi.fn(async () => undefined),
        }
        const manager = new BackupManager(manifest, {})

        await expect(manager.deleteAllBackups()).rejects.toThrow(
            'Could not delete 1 Drive backup'
        )
    })
})
