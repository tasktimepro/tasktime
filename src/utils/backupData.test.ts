import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, createBackupPayload } from './backupData';

const baseInput = {
    projects: [],
    tasks: [],
    timeEntries: [],
    invoices: [],
    paymentMethods: [],
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
};

describe('backupData', () => {
    it('creates a backup payload with the provided backup type', () => {
        const payload = createBackupPayload({
            ...baseInput,
            exportDate: '2026-04-22T00:00:00.000Z',
            backupType: 'manual',
        });

        expect(payload).toEqual(expect.objectContaining({
            version: BACKUP_VERSION,
            exportDate: '2026-04-22T00:00:00.000Z',
            backupType: 'manual',
            emailTemplates: [],
        }));
    });

    it('omits backupType when none is provided', () => {
        const payload = createBackupPayload(baseInput);

        expect(payload.version).toBe(BACKUP_VERSION);
        expect(payload).not.toHaveProperty('backupType');
        expect(payload.emailTemplates).toEqual([]);
    });
});