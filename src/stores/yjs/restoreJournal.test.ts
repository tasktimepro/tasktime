import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearRestoreJournal,
    readRestoreJournal,
    writeRestoreJournal,
    type RestoreJournalRecord,
} from './restoreJournal';

describe('restore safety journal fallback', () => {
    afterEach(async () => {
        await clearRestoreJournal();
        vi.unstubAllGlobals();
    });

    it('retains a complete rollback record until it is explicitly cleared', async () => {
        vi.stubGlobal('indexedDB', undefined);

        const record: RestoreJournalRecord = {
            version: 1,
            operationId: 'restore-1',
            createdAt: 100,
            rollback: {
                version: '1.4',
                exportDate: '2026-07-11T08:00:00.000Z',
                backupType: 'manual',
                projects: [{ id: 'project-old', title: 'Old workspace' }],
                tasks: [],
                timeEntries: [],
                invoices: [],
                paymentMethods: [],
                expenseCategories: [],
                taxReturnPeriods: [],
                businessInfos: [],
                businessBrandAssets: [],
                clients: [],
                invoiceTemplates: [],
                emailTemplates: [],
                expenses: [],
                expenseRecurrences: [],
                dailyGoals: [],
                plannerAttachments: [],
                preferences: {},
            },
            rollbackTimers: [],
            replacement: {
                projects: [{ id: 'project-new', title: 'New workspace' }],
            },
        };

        await writeRestoreJournal(record);
        record.rollback.projects[0].title = 'Mutated caller copy';

        await expect(readRestoreJournal()).resolves.toEqual(expect.objectContaining({
            operationId: 'restore-1',
            rollback: expect.objectContaining({
                projects: [{ id: 'project-old', title: 'Old workspace' }],
            }),
        }));

        await clearRestoreJournal();
        await expect(readRestoreJournal()).resolves.toBeNull();
    });
});
