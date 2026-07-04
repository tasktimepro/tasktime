import { describe, expect, it } from 'vitest';
import {
    BACKUP_VERSION,
    createBackupPayload,
    getBackupImportCounts,
    parseBackupImportJson,
} from './backupData';

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

    it('preserves additive project and task planning fields', () => {
        const payload = createBackupPayload({
            ...baseInput,
            projects: [{
                id: 'project-1',
                title: 'Quoted project',
                statusMode: 'quote',
                deadline: '2026-06-15',
                budgetAmount: 2400,
            }],
            tasks: [{
                id: 'task-1',
                title: 'Discovery',
                projectId: 'project-1',
                estimatedHours: 6,
                estimatedFlatAmount: 900,
            }],
        });

        expect(payload.projects).toEqual([
            expect.objectContaining({
                id: 'project-1',
                statusMode: 'quote',
                deadline: '2026-06-15',
                budgetAmount: 2400,
            }),
        ]);
        expect(payload.tasks).toEqual([
            expect.objectContaining({
                id: 'task-1',
                estimatedHours: 6,
                estimatedFlatAmount: 900,
            }),
        ]);
    });

    it('parses supported backup imports and fills optional collections safely', () => {
        const parsed = parseBackupImportJson(JSON.stringify({
            version: BACKUP_VERSION,
            exportDate: '2026-04-22T00:00:00.000Z',
            backupType: 'automatic',
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [{ id: 'task-1', title: 'Task', projectId: 'project-1' }],
            timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 10, end: 20 }],
            invoices: [{ id: 'invoice-1' }],
            preferences: { theme: 'dark' },
        }));

        expect(parsed).toEqual(expect.objectContaining({
            version: BACKUP_VERSION,
            exportDate: '2026-04-22T00:00:00.000Z',
            backupType: 'automatic',
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [{ id: 'task-1', title: 'Task', projectId: 'project-1' }],
            preferences: { theme: 'dark' },
        }));
        expect(parsed.clients).toEqual([]);
        expect(parsed.expenseCategories).toEqual([]);
    });

    it('rejects malformed import JSON and unsupported versions', () => {
        expect(() => parseBackupImportJson('{')).toThrow('Backup JSON could not be parsed.');
        expect(() => parseBackupImportJson('[]')).toThrow('Backup JSON must be an object.');
        expect(() => parseBackupImportJson(JSON.stringify({
            version: '0.1',
            projects: [],
        }))).toThrow('Unsupported export version');
    });

    it('rejects invalid import collection shapes and duplicate ids', () => {
        expect(() => parseBackupImportJson(JSON.stringify({
            projects: {},
        }))).toThrow('projects must be an array');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: {},
        }))).toThrow('tasks must be an array');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'One' }, { id: 'project-1', title: 'Two' }],
        }))).toThrow('Duplicate project id: project-1');
    });

    it('rejects invalid import entity fields and references', () => {
        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1' }],
        }))).toThrow('missing or non-string title');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [{ id: 'task-1', title: 'Task', projectId: 'missing-project' }],
        }))).toThrow('references non-existent project');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [{ id: 'task-1', title: 'Task', parentTaskId: 'missing-task' }],
        }))).toThrow('references non-existent parent task');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            timeEntries: [{ id: 'entry-1', start: '10', end: 20 }],
        }))).toThrow('start and end must be numbers');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            timeEntries: [{ id: 'entry-1', start: 30, end: 20 }],
        }))).toThrow('start time is after end time');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [{ id: 'task-1', title: 'Task' }],
            timeEntries: [{ id: 'entry-1', taskId: 'missing-task', start: 10, end: 20 }],
        }))).toThrow('references non-existent task');
    });

    it('rejects invalid invoice references and non-object preferences', () => {
        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project', invoiceIds: ['missing-invoice'] }],
            invoices: [],
        }))).toThrow('references non-existent invoice');

        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [{ id: 'project-1', title: 'Project' }],
            preferences: [],
        }))).toThrow('preferences must be an object');
    });

    it('counts imported collections with missing arrays treated as empty', () => {
        const counts = getBackupImportCounts({
            projects: [{ id: 'project-1', title: 'Project' }],
            tasks: [],
            timeEntries: [],
            invoices: [{ id: 'invoice-1' }],
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
        });

        expect(counts).toEqual(expect.objectContaining({
            projects: 1,
            invoices: 1,
            tasks: 0,
            expenseCategories: 0,
            taxReturnPeriods: 0,
        }));
    });
});
