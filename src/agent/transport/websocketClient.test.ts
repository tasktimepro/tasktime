import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { readEntity } from '@/stores/yjs/entityUtils';
import type { AgentCommandContext, AgentPermissionScope } from '@/agent/types';
import type { AgentBridgeSession } from '@/agent/session';
import { AgentAppSessionWebSocketClient, type AgentWebSocketLike } from './websocketClient';

vi.mock('@/utils/usageMetrics', () => ({
    markMeaningfulActivity: vi.fn(),
}));

class FakeWebSocket implements AgentWebSocketLike {
    static instances: FakeWebSocket[] = [];

    readyState = 0;
    sent: string[] = [];
    url: string;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sent.push(data);
    }

    close(): void {
        this.readyState = 3;
        this.onclose?.({} as CloseEvent);
    }

    open(): void {
        this.readyState = 1;
        this.onopen?.({} as Event);
    }

    message(data: unknown): void {
        this.onmessage?.({ data } as MessageEvent);
    }
}

function flushPromises(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (predicate()) {
            return;
        }

        await flushPromises();
    }

    throw new Error('Timed out waiting for condition.');
}

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve;
    });

    return { promise, resolve };
}

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
        generateId: () => `ws-id-${nextId++}`,
        idempotency: new Map(),
        tasks,
    };
}

function createSession(overrides: Partial<AgentBridgeSession> = {}): AgentBridgeSession {
    return {
        sessionToken: 'session-token',
        scopes: new Set(['read', 'write']),
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        ...overrides,
    };
}

describe('AgentAppSessionWebSocketClient', () => {
    beforeEach(() => {
        vi.useRealTimers();
        FakeWebSocket.instances = [];
    });

    it('connects only to the explicitly configured URL and reports status', () => {
        const statuses: string[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
            onStatusChange: (status) => statuses.push(status),
        });

        client.connect();

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(FakeWebSocket.instances[0].url).toBe('ws://127.0.0.1:39876/tasktime-agent');
        expect(statuses).toEqual(['connecting']);

        FakeWebSocket.instances[0].open();

        expect(client.getStatus()).toBe('open');
        expect(statuses).toEqual(['connecting', 'open']);
    });

    it('dispatches valid command messages and sends structured responses', async () => {
        const context = createContext();
        const starts: unknown[] = [];
        const activities: unknown[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
            onCommandStart: (activity) => starts.push(activity),
            onCommandActivity: (activity) => activities.push(activity),
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-1',
            sessionToken: 'session-token',
            command: 'create_task',
            input: {
                title: 'Created through socket',
                projectId: 'project-1',
            },
        }));
        await flushPromises();

        expect(socket.sent).toHaveLength(1);
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            protocolVersion: 1,
            requestId: 'request-1',
            response: expect.objectContaining({
                ok: true,
                command: 'create_task',
            }),
        }));
        expect(starts).toEqual([{
            requestId: 'request-1',
            command: 'create_task',
        }]);
        expect(activities).toEqual([{
            requestId: 'request-1',
            command: 'create_task',
            ok: true,
            errorCode: undefined,
        }]);
        expect(readEntity<{ title: string }>(context.tasks.get('ws-id-0'))?.title).toBe('Created through socket');
    });

    it('pauses sensitive billing commands for browser approval before dispatching', async () => {
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
        const approvals: unknown[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession({ scopes: new Set(['read', 'write', 'billing']) }),
            WebSocketCtor: FakeWebSocket,
            onCommandApprovalRequest: async (request) => {
                approvals.push(request);
                return true;
            },
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-approval',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-approval',
                confirmPaid: true,
            },
        }));
        await waitForCondition(() => approvals.length === 1 && socket.sent.length === 1);

        expect(approvals).toEqual([expect.objectContaining({
            requestId: 'request-approval',
            command: 'mark_invoice_paid',
            category: 'billing',
        })]);
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-approval',
            response: expect.objectContaining({
                ok: true,
                command: 'mark_invoice_paid',
            }),
        }));
        expect(readEntity<{ status: string }>(context.store.invoices.get('invoice-approval'))?.status).toBe('paid');
    });

    it('uses verified approval tokens without showing browser approval', async () => {
        const context = createContext();
        context.store.invoices.set('invoice-token-approval', {
            id: 'invoice-token-approval',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-TOKEN',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'USD',
        });
        const approvalPrompt = vi.fn(async () => false);
        const verifier = vi.fn(async (request) => request.approval.token === 'signed-chat-approval');
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession({ scopes: new Set(['read', 'write', 'billing']) }),
            WebSocketCtor: FakeWebSocket,
            onCommandApprovalRequest: approvalPrompt,
            verifyApprovalToken: verifier,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-token-approval',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-token-approval',
                confirmPaid: true,
            },
            approval: {
                token: 'signed-chat-approval',
                command: 'mark_invoice_paid',
                category: 'billing',
            },
        }));
        await waitForCondition(() => verifier.mock.calls.length === 1 && socket.sent.length === 1);

        expect(verifier).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'request-token-approval',
            command: 'mark_invoice_paid',
            category: 'billing',
            approval: expect.objectContaining({
                token: 'signed-chat-approval',
            }),
        }));
        expect(approvalPrompt).not.toHaveBeenCalled();
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-token-approval',
            response: expect.objectContaining({
                ok: true,
                command: 'mark_invoice_paid',
            }),
        }));
        expect(readEntity<{ status: string }>(context.store.invoices.get('invoice-token-approval'))?.status).toBe('paid');
    });

    it('serializes app-session command execution in the browser client', async () => {
        const context = createContext();
        context.store.invoices.set('invoice-serialized', {
            id: 'invoice-serialized',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-SERIAL',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'USD',
        });
        const approval = createDeferred<boolean>();
        const starts: unknown[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession({ scopes: new Set(['read', 'write', 'billing']) }),
            WebSocketCtor: FakeWebSocket,
            onCommandStart: (activity) => starts.push(activity),
            onCommandApprovalRequest: () => approval.promise,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-first',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-serialized',
                confirmPaid: true,
            },
        }));
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-second',
            sessionToken: 'session-token',
            command: 'create_task',
            input: {
                title: 'Queued task',
                projectId: 'project-1',
            },
        }));
        await flushPromises();

        expect(starts).toEqual([{
            requestId: 'request-first',
            command: 'mark_invoice_paid',
        }]);
        expect(socket.sent).toHaveLength(0);

        approval.resolve(true);
        await flushPromises();
        await flushPromises();

        expect(starts).toEqual([
            {
                requestId: 'request-first',
                command: 'mark_invoice_paid',
            },
            {
                requestId: 'request-second',
                command: 'create_task',
            },
        ]);
        expect(socket.sent).toHaveLength(2);
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-first',
            response: expect.objectContaining({
                ok: true,
                command: 'mark_invoice_paid',
            }),
        }));
        expect(JSON.parse(socket.sent[1])).toEqual(expect.objectContaining({
            requestId: 'request-second',
            response: expect.objectContaining({
                ok: true,
                command: 'create_task',
            }),
        }));
        expect(readEntity<{ title: string }>(context.tasks.get('ws-id-0'))?.title).toBe('Queued task');
    });

    it('does not run queued writes after the app-session socket closes during approval', async () => {
        const context = createContext();
        context.store.invoices.set('invoice-interrupted', {
            id: 'invoice-interrupted',
            projectId: 'project-1',
            projectIds: ['project-1'],
            clientId: 'client-1',
            invoiceNumber: 'INV-INTERRUPTED',
            date: '2026-06-25',
            status: 'sent',
            items: [],
            subtotal: 100,
            total: 100,
            currency: 'USD',
        });
        const approval = createDeferred<boolean>();
        const starts: unknown[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession({ scopes: new Set(['read', 'write', 'billing']) }),
            WebSocketCtor: FakeWebSocket,
            onCommandStart: (activity) => starts.push(activity),
            onCommandApprovalRequest: () => approval.promise,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-first',
            sessionToken: 'session-token',
            command: 'mark_invoice_paid',
            input: {
                invoiceId: 'invoice-interrupted',
                confirmPaid: true,
            },
        }));
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-second',
            sessionToken: 'session-token',
            command: 'create_task',
            input: {
                title: 'Should not run',
                projectId: 'project-1',
            },
        }));
        await flushPromises();

        expect(starts).toEqual([{
            requestId: 'request-first',
            command: 'mark_invoice_paid',
        }]);

        socket.close();
        approval.resolve(false);
        await flushPromises();
        await flushPromises();

        expect(starts).toEqual([{
            requestId: 'request-first',
            command: 'mark_invoice_paid',
        }]);
        expect(socket.sent).toEqual([]);
        expect(readEntity<{ title: string }>(context.tasks.get('ws-id-0'))).toBeUndefined();
        expect(readEntity<{ status: string }>(context.store.invoices.get('invoice-interrupted'))?.status).toBe('sent');
    });

    it('accepts an in-band pairing session message before dispatching commands', async () => {
        const context = createContext();
        const sessions: AgentBridgeSession[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent?pairingId=pairing-1&pairingCode=123456',
            context,
            WebSocketCtor: FakeWebSocket,
            onSessionChange: (session) => sessions.push(session),
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            type: 'agent_bridge_session',
            protocolVersion: 1,
            sessionToken: 'paired-token',
            scopes: ['read', 'write'],
            expiresAt: Date.now() + 60_000,
        }));
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-paired',
            sessionToken: 'paired-token',
            command: 'create_task',
            input: {
                title: 'Created after pairing',
                projectId: 'project-1',
            },
        }));
        await flushPromises();

        expect(sessions).toHaveLength(1);
        expect(sessions[0].sessionToken).toBe('paired-token');
        expect(sessions[0].scopes).toEqual(new Set(['read', 'write']));
        expect(socket.sent).toHaveLength(1);
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-paired',
            response: expect.objectContaining({
                ok: true,
                command: 'create_task',
            }),
        }));
        expect(readEntity<{ title: string }>(context.tasks.get('ws-id-0'))?.title).toBe('Created after pairing');
    });

    it('rejects command messages before an app-session is paired', async () => {
        const context = createContext();
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent?pairingId=pairing-1&pairingCode=123456',
            context,
            WebSocketCtor: FakeWebSocket,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message(JSON.stringify({
            protocolVersion: 1,
            requestId: 'request-denied',
            sessionToken: 'paired-token',
            command: 'create_task',
            input: {
                title: 'Denied before pairing',
                projectId: 'project-1',
            },
        }));
        await flushPromises();

        expect(JSON.parse(socket.sent[0])).toEqual({
            protocolVersion: 1,
            requestId: null,
            response: {
                ok: false,
                command: 'unknown',
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Agent bridge session is not paired.',
                },
            },
        });
        expect(context.tasks.size).toBe(0);
    });

    it('sends structured errors for invalid JSON messages', async () => {
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        socket.message('{not json');
        await flushPromises();

        expect(JSON.parse(socket.sent[0])).toEqual({
            protocolVersion: 1,
            requestId: null,
            response: {
                ok: false,
                command: 'unknown',
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid JSON app-session message.',
                },
            },
        });
    });

    it('rejects expired sessions before dispatching', async () => {
        const context = createContext();
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context,
            session: createSession({ expiresAt: Date.now() - 1 }),
            WebSocketCtor: FakeWebSocket,
        });

        expect(() => client.connect()).toThrow('Agent bridge session expired.');
        expect(context.tasks.size).toBe(0);
    });

    it('reconnects to the same explicit URL after an unexpected close when enabled', () => {
        vi.useFakeTimers();
        const statuses: string[] = [];
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
            autoReconnect: true,
            reconnectDelayMs: 250,
            maxReconnectAttempts: 2,
            onStatusChange: (status) => statuses.push(status),
        });

        client.connect();
        const firstSocket = FakeWebSocket.instances[0];
        firstSocket.open();
        firstSocket.close();

        expect(client.getStatus()).toBe('closed');
        expect(FakeWebSocket.instances).toHaveLength(1);

        vi.advanceTimersByTime(249);
        expect(FakeWebSocket.instances).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(FakeWebSocket.instances[1].url).toBe('ws://127.0.0.1:39876/tasktime-agent');
        expect(statuses).toEqual(['connecting', 'open', 'closed', 'connecting']);
    });

    it('does not reconnect after an explicit client close', () => {
        vi.useFakeTimers();
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
            autoReconnect: true,
            reconnectDelayMs: 250,
        });

        client.connect();
        FakeWebSocket.instances[0].open();
        client.close();
        vi.advanceTimersByTime(1000);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(client.getStatus()).toBe('closed');
    });

    it('sends an authenticated revoke control message before closing', () => {
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
        });

        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.open();
        client.revoke();

        expect(socket.sent).toEqual([
            JSON.stringify({
                type: 'agent_bridge_control',
                protocolVersion: 1,
                sessionToken: 'session-token',
                action: 'revoke',
            }),
        ]);
        expect(client.getStatus()).toBe('closed');
    });

    it('sends approval grants only over an active paired session', () => {
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
        });
        const grant = {
            id: 'grant-1',
            clientId: 'openclaw-local',
            label: 'OpenClaw',
            scopes: ['read', 'write', 'billing'] as AgentPermissionScope[],
            secretKeyBase64Url: 'secret-key',
            createdAt: 1_700_000_000_000,
            expiresAt: null,
        };

        expect(client.sendApprovalGrant(grant)).toBe(false);

        client.connect();
        const socket = FakeWebSocket.instances[0];

        expect(client.sendApprovalGrant(grant)).toBe(false);
        socket.open();
        expect(client.sendApprovalGrant(grant)).toBe(true);

        expect(socket.sent).toEqual([
            JSON.stringify({
                type: 'agent_bridge_approval_grant',
                protocolVersion: 1,
                sessionToken: 'session-token',
                grant,
            }),
        ]);
    });

    it('sends approval grant revocations only over an active paired session', () => {
        const client = new AgentAppSessionWebSocketClient({
            url: 'ws://127.0.0.1:39876/tasktime-agent',
            context: createContext(),
            session: createSession(),
            WebSocketCtor: FakeWebSocket,
        });

        expect(client.sendApprovalGrantRevocation('grant-1', 1_700_000_010_000)).toBe(false);

        client.connect();
        const socket = FakeWebSocket.instances[0];

        expect(client.sendApprovalGrantRevocation('grant-1', 1_700_000_010_000)).toBe(false);
        socket.open();
        expect(client.sendApprovalGrantRevocation('grant-1', 1_700_000_010_000)).toBe(true);

        expect(socket.sent).toEqual([
            JSON.stringify({
                type: 'agent_bridge_approval_grant_revoke',
                protocolVersion: 1,
                sessionToken: 'session-token',
                grantId: 'grant-1',
                revokedAt: 1_700_000_010_000,
            }),
        ]);
    });
});
