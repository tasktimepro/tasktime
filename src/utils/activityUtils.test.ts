import { describe, expect, it } from 'vitest';
import { buildClientRecentUpdateMap, buildProjectRecentUpdateMap } from './activityUtils';

describe('activityUtils', () => {
    it('prefers time entry mutation timestamps over backdated work timestamps for project recency', () => {
        const projectRecentUpdateMap = buildProjectRecentUpdateMap({
            projects: [
                { id: 'project-1', title: 'Alpha', createdAt: 10, updatedAt: 20 },
                { id: 'project-2', title: 'Beta', createdAt: 10, updatedAt: 400 },
            ],
            tasks: [
                { id: 'task-1', title: 'Alpha Task', projectId: 'project-1', lastActive: 30 },
                { id: 'task-2', title: 'Beta Task', projectId: 'project-2', lastActive: 50 },
            ],
            timeEntries: [
                { id: 'entry-1', taskId: 'task-1', start: 100, end: 200, createdAt: 900, updatedAt: 900 },
                { id: 'entry-2', taskId: 'task-2', start: 500, end: 600 },
            ],
            invoices: [],
            expenses: [],
            recurrences: [],
        });

        expect(projectRecentUpdateMap.get('project-1')).toBe(900);
        expect(projectRecentUpdateMap.get('project-1')).toBeGreaterThan(projectRecentUpdateMap.get('project-2') || 0);
    });

    it('includes related project and direct client updates when computing client recency', () => {
        const projectRecentUpdateMap = buildProjectRecentUpdateMap({
            projects: [
                { id: 'project-1', title: 'Alpha', preferredClientId: 'client-1', updatedAt: 300 },
                { id: 'project-2', title: 'Beta', preferredClientId: 'client-2', updatedAt: 400 },
            ],
            tasks: [],
            timeEntries: [],
            invoices: [],
            expenses: [],
            recurrences: [],
        });

        const clientRecentUpdateMap = buildClientRecentUpdateMap({
            clients: [
                { id: 'client-1', title: 'Acme', updatedAt: 100 },
                { id: 'client-2', title: 'Bravo', updatedAt: 100 },
            ],
            projects: [
                { id: 'project-1', title: 'Alpha', preferredClientId: 'client-1' },
                { id: 'project-2', title: 'Beta', preferredClientId: 'client-2' },
            ],
            invoices: [
                {
                    id: 'invoice-1',
                    projectId: 'project-1',
                    clientId: 'client-1',
                    invoiceNumber: 'INV-1',
                    date: '2026-04-14',
                    status: 'draft',
                    items: [],
                    subtotal: 0,
                    total: 0,
                    updatedAt: 950,
                },
            ],
            expenses: [],
            recurrences: [],
            projectRecentUpdateMap,
        });

        expect(clientRecentUpdateMap.get('client-1')).toBe(950);
        expect(clientRecentUpdateMap.get('client-2')).toBe(400);
    });

    it('applies shared invoice updates to each linked project', () => {
        const projectRecentUpdateMap = buildProjectRecentUpdateMap({
            projects: [
                { id: 'project-1', title: 'Alpha', updatedAt: 100 },
                { id: 'project-2', title: 'Beta', updatedAt: 100 },
            ],
            tasks: [],
            timeEntries: [],
            invoices: [
                {
                    id: 'invoice-shared',
                    projectId: 'project-1',
                    projectIds: ['project-1', 'project-2'],
                    clientId: 'client-1',
                    invoiceNumber: 'INV-1',
                    date: '2026-04-14',
                    status: 'draft',
                    items: [],
                    subtotal: 0,
                    total: 0,
                    updatedAt: 950,
                },
            ],
            expenses: [],
            recurrences: [],
        });

        expect(projectRecentUpdateMap.get('project-1')).toBe(950);
        expect(projectRecentUpdateMap.get('project-2')).toBe(950);
    });
});
