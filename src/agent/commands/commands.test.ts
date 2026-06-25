import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { objectToYMap, readEntity } from '@/stores/yjs/entityUtils';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    addManualTimeEntryCommand,
    completeTaskCommand,
    createExpenseCommand,
    createInvoiceDraftFromUnbilledWorkCommand,
    createTaskCommand,
    executeAgentCommand,
    finalizeInvoiceCommand,
    findUnbilledTimeCommand,
    focusRunningTimerCommand,
    getClientOverviewCommand,
    getDashboardSummaryCommand,
    getProjectOverviewCommand,
    listInvoicesCommand,
    listRecentEntriesCommand,
    listAgentCommandDefinitions,
    markInvoicePaidCommand,
    markInvoiceUnpaidCommand,
    markExpensePaidCommand,
    openProjectViewCommand,
    previewInvoiceFromUnbilledWorkCommand,
    startTimerCommand,
    stopTimerCommand,
} from './index';

vi.mock('@/utils/usageMetrics', () => ({
    markMeaningfulActivity: vi.fn(),
}));

const readStored = <T,>(map: Y.Map<string, unknown>, id: string): T | undefined => {
    return readEntity<T>(map.get(id));
};

function createContext(): AgentCommandContext & {
    maps: {
        projects: Y.Map<string, unknown>;
        tasks: Y.Map<string, unknown>;
        timers: Y.Map<string, unknown>;
        entries: Y.Map<string, unknown>;
        expenses: Y.Map<string, unknown>;
        clients: Y.Map<string, unknown>;
        preferences: Y.Map<string, unknown>;
        invoices: Y.Map<string, unknown>;
        invoiceTemplates: Y.Map<string, unknown>;
    };
    openedRoutes: string[];
} {
    const coreDoc = new Y.Doc();
    const activeEntriesDoc = new Y.Doc();
    const projects = coreDoc.getMap('projects');
    const tasks = coreDoc.getMap('tasks');
    const timers = coreDoc.getMap('timers');
    const expenses = coreDoc.getMap('expenses');
    const clients = coreDoc.getMap('clients');
    const preferences = coreDoc.getMap('preferences');
    const invoices = coreDoc.getMap('invoices');
    const invoiceTemplates = coreDoc.getMap('invoiceTemplates');
    const entries = activeEntriesDoc.getMap('timeEntries');
    const openedRoutes: string[] = [];
    let nextId = 0;

    preferences.set('currency', 'USD');
    projects.set('project-1', { id: 'project-1', title: 'Project One', hourlyRate: 100, preferredClientId: 'client-1' });
    clients.set('client-1', { id: 'client-1', title: 'Client One' });

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
        invoiceTemplates,
        activeTimeEntries: entries,
        getAllTimeEntries: () => Array.from(entries.values()).map((value) => readEntity(value)).filter(Boolean),
        archiveTask: vi.fn(async (taskId: string) => {
            const task = readStored<Record<string, unknown>>(tasks, taskId);
            if (task) {
                tasks.delete(taskId);
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
        navigation: {
            openRoute: (route) => {
                openedRoutes.push(route);
            },
        },
        maps: {
            projects,
            tasks,
            timers,
            entries,
            expenses,
            clients,
            preferences,
            invoices,
            invoiceTemplates,
        },
        openedRoutes,
    };
}

describe('agent commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('validates navigation targets before opening routes', () => {
        const context = createContext();
        createTaskCommand(context, {
            id: 'task-1',
            title: 'Timed task',
            projectId: 'project-1',
        });
        startTimerCommand(context, { taskId: 'task-1' });

        expect(openProjectViewCommand(context, { projectId: 'project-1' })).toEqual({ route: '/projects/project-1' });
        expect(focusRunningTimerCommand(context, { timerKey: 'project-1' })).toEqual({ route: '/', timerKey: 'project-1' });
        expect(context.openedRoutes).toEqual(['/projects/project-1', '/']);
        expect(() => openProjectViewCommand(context, { projectId: 'missing' })).toThrow(AgentCommandError);
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

        const preview = previewInvoiceFromUnbilledWorkCommand(context, {
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

        const draft = createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
            idempotencyKey: 'draft-1',
        });
        const repeated = createInvoiceDraftFromUnbilledWorkCommand(context, {
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

        const draft = createInvoiceDraftFromUnbilledWorkCommand(context, {
            projectId: 'project-1',
            invoiceDate: '2026-06-25',
            billingPeriodStart: '2026-06-01',
            billingPeriodEnd: '2026-06-30',
        });

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
                sentAt: Date.parse('2026-06-25T12:00:00Z'),
                billingStateSnapshot: expect.objectContaining({
                    taskLastBilledAt: {
                        'task-ui-hourly': Date.parse('2025-05-01T00:00:00Z'),
                        'task-ui-subtask': null,
                        'task-ui-quote': null,
                    },
                }),
            }),
        }));
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
