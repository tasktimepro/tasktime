import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { readEntity } from '@/stores/yjs/entityUtils';
import type { AgentCommandContext } from '@/agent/types';
import { getAgentAppSessionRequestMetadata, handleAgentAppSessionRequest, isAgentAppSessionControlMessage } from './protocol';

vi.mock('@/utils/usageMetrics', () => ({
    markMeaningfulActivity: vi.fn(),
}));

function createContext(): AgentCommandContext & { tasks: Y.Map<string, unknown> } {
    const coreDoc = new Y.Doc();
    const activeEntriesDoc = new Y.Doc();
    const projects = coreDoc.getMap('projects');
    const tasks = coreDoc.getMap('tasks');
    const timers = coreDoc.getMap('timers');
    const expenses = coreDoc.getMap('expenses');
    const clients = coreDoc.getMap('clients');
    const preferences = coreDoc.getMap('preferences');
    const invoices = coreDoc.getMap('invoices');
    const entries = activeEntriesDoc.getMap('timeEntries');
    let nextId = 0;

    projects.set('project-1', { id: 'project-1', title: 'Project One' });
    preferences.set('currency', 'USD');

    return {
        store: {
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
            activeTimeEntries: entries,
            getAllTimeEntries: () => [],
            archiveTask: vi.fn(),
        } as any,
        isReady: true,
        now: () => 1_700_000_000_000,
        generateId: () => `protocol-id-${nextId++}`,
        idempotency: new Map(),
        tasks,
    };
}

const session = {
    sessionToken: 'session-token',
    scopes: new Set(['read', 'write']),
};

describe('agent app-session protocol', () => {
    it('validates revoke control messages', () => {
        expect(isAgentAppSessionControlMessage({
            type: 'agent_bridge_control',
            protocolVersion: 1,
            sessionToken: 'session-token',
            action: 'revoke',
        })).toBe(true);

        expect(isAgentAppSessionControlMessage({
            type: 'agent_bridge_control',
            protocolVersion: 1,
            sessionToken: 'session-token',
            action: 'disconnect',
        })).toBe(false);
    });

    it('extracts safe request metadata without exposing input', () => {
        expect(getAgentAppSessionRequestMetadata({
            protocolVersion: 1,
            requestId: 'request-metadata',
            sessionToken: 'session-token',
            command: 'create_task',
            input: {
                title: 'Not returned',
            },
        })).toEqual({
            requestId: 'request-metadata',
            command: 'create_task',
        });

        expect(getAgentAppSessionRequestMetadata({ nope: true })).toBeNull();
    });

    it('rejects malformed requests before dispatching', async () => {
        const context = createContext();

        await expect(handleAgentAppSessionRequest(context, session, { nope: true })).resolves.toEqual({
            protocolVersion: 1,
            requestId: null,
            response: {
                ok: false,
                command: 'unknown',
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid agent app-session request.',
                },
            },
        });
    });

    it('rejects bad session tokens', async () => {
        const context = createContext();

        await expect(handleAgentAppSessionRequest(context, session, {
            protocolVersion: 1,
            requestId: 'request-1',
            sessionToken: 'wrong-token',
            command: 'create_task',
            input: { title: 'Denied' },
        })).resolves.toEqual({
            protocolVersion: 1,
            requestId: 'request-1',
            response: {
                ok: false,
                command: 'create_task',
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Invalid agent app-session token.',
                },
            },
        });
    });

    it('dispatches valid requests with session scopes', async () => {
        const context = createContext();

        const response = await handleAgentAppSessionRequest(context, session, {
            protocolVersion: 1,
            requestId: 'request-2',
            sessionToken: 'session-token',
            command: 'create_task',
            input: {
                title: 'From protocol',
                projectId: 'project-1',
            },
        });

        expect(response.protocolVersion).toBe(1);
        expect(response.requestId).toBe('request-2');
        expect(response.response).toEqual(expect.objectContaining({
            ok: true,
            command: 'create_task',
        }));

        const storedTask = readEntity<{ title: string }>(context.tasks.get('protocol-id-0'));
        expect(storedTask?.title).toBe('From protocol');
    });

    it('uses session scopes instead of broader base context permissions', async () => {
        const context = createContext();
        context.permissions = new Set(['read', 'write', 'navigation']);

        const response = await handleAgentAppSessionRequest(context, {
            sessionToken: 'session-token',
            scopes: new Set(['read']),
        }, {
            protocolVersion: 1,
            requestId: 'request-3',
            sessionToken: 'session-token',
            command: 'create_task',
            input: { title: 'Denied by session' },
        });

        expect(response.response).toEqual({
            ok: false,
            command: 'create_task',
            error: {
                code: 'PERMISSION_DENIED',
                message: 'Missing write permission.',
                details: { scope: 'write' },
            },
        });
    });

    it('requires explicit browser approval before dispatching sensitive billing commands', async () => {
        const context = createContext();
        context.store.invoices.set('invoice-approval', {
            id: 'invoice-approval',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-APPROVAL',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'USD',
        });

        const denied = await handleAgentAppSessionRequest(context, {
            sessionToken: 'session-token',
            scopes: new Set(['read', 'write', 'billing']),
        }, {
            protocolVersion: 1,
            requestId: 'request-approval-denied',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-approval',
                confirmPaid: true,
            },
        });

        expect(denied.response).toEqual({
            ok: false,
            command: 'mark_invoice_paid',
            error: {
                code: 'PERMISSION_DENIED',
                message: 'Agent command was not approved in TaskTime.',
            },
        });

        const approvalRequests: unknown[] = [];
        const approved = await handleAgentAppSessionRequest(context, {
            sessionToken: 'session-token',
            scopes: new Set(['read', 'write', 'billing']),
        }, {
            protocolVersion: 1,
            requestId: 'request-approval-approved',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-approval',
                confirmPaid: true,
            },
        }, {
            requestApproval: async (request) => {
                approvalRequests.push(request);
                return true;
            },
        });

        expect(approvalRequests).toEqual([{
            requestId: 'request-approval-approved',
            command: 'mark_invoice_paid',
        }]);
        expect(approved.response).toEqual(expect.objectContaining({
            ok: true,
            command: 'mark_invoice_paid',
        }));
    });
});
