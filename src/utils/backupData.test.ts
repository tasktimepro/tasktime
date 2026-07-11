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
            invoices: [{
                id: 'invoice-1',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-1',
                date: '2026-04-22',
                status: 'draft',
                items: [],
                subtotal: 0,
                total: 0,
            }],
            clients: [{ id: 'client-1', title: 'Client' }],
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
        expect(parsed.clients).toEqual([{ id: 'client-1', title: 'Client' }]);
        expect(parsed.expenseCategories).toEqual([]);
    });

    it.each(['1.0', '1.1', '1.3', '1.4'])('imports advertised backup version %s', (version) => {
        const parsed = parseBackupImportJson(JSON.stringify({
            version,
            exportDate: '2024-01-02T00:00:00.000Z',
            projects: [{ id: 'project-legacy', title: 'Legacy project' }],
            tasks: [{ id: 'task-legacy', title: 'Legacy task', projectId: 'project-legacy' }],
            timeEntries: [{ id: 'entry-legacy', taskId: 'task-legacy', start: 10, end: 20 }],
            clients: [{ id: 'client-legacy', title: 'Legacy client' }],
            invoices: [{
                id: 'invoice-legacy',
                project: { id: 'project-legacy' },
                client: { id: 'client-legacy' },
                invoiceNumber: 'INV-LEGACY',
                date: '2024-01-02',
                status: 'sent',
                subtotal: 100,
                totalAmount: 100,
                tasks: [{ id: 'task-legacy', title: 'Legacy task', hours: 1, hourlyRate: 100 }],
            }],
        }));

        expect(parsed.version).toBe(version);
        expect(parsed.invoices).toEqual([
            expect.objectContaining({
                id: 'invoice-legacy',
                projectId: 'project-legacy',
                clientId: 'client-legacy',
                total: 100,
                items: [expect.objectContaining({ taskId: 'task-legacy', amount: 100 })],
            }),
        ]);
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

    it('rejects schema-invalid invoice data during preview validation', () => {
        expect(() => parseBackupImportJson(JSON.stringify({
            projects: [],
            invoices: [{ id: 'invoice-1' }],
        }))).toThrow('Invalid invoices entity in backup invoice invoice-1');
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
