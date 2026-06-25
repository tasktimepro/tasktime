import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentBridgeSettings from './AgentBridgeSettings';

class FakeWebSocket {
    static instances = [];

    readyState = 0;
    sent = [];
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;

    constructor(url) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    send(data) {
        this.sent.push(data);
    }

    close() {
        this.readyState = 3;
        this.onclose?.({});
    }

    open() {
        this.readyState = 1;
        this.onopen?.({});
    }

    error() {
        this.onerror?.({});
    }

    message(data) {
        this.onmessage?.({ data });
    }
}

const yjsMocks = vi.hoisted(() => ({
    store: {
        isReady: true,
    },
    isReady: true,
}));

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => yjsMocks,
}));

describe('AgentBridgeSettings', () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
        yjsMocks.isReady = true;
        window.history.pushState({}, '', '/account?section=agent');
    });

    it('requires explicit loopback pairing details before connecting', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://192.168.1.10:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        expect(screen.getByText('Bridge endpoint must use a loopback host.')).toBeInTheDocument();
        expect(screen.getByText('Endpoint is not local')).toBeInTheDocument();
        expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('shows browser and endpoint diagnostics before connecting', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1/custom-path');

        expect(screen.getByText('Endpoint has no explicit port')).toBeInTheDocument();
        expect(screen.getByText('Unexpected bridge path')).toBeInTheDocument();
    });

    it('connects to the explicit pairing URL and shows memory-only session state', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(FakeWebSocket.instances[0].url).toBe('ws://127.0.0.1:39123/tasktime-agent?pairingId=pairing-1&pairingCode=123456');
        expect(screen.getByText('Endpoint looks local')).toBeInTheDocument();

        act(() => {
            FakeWebSocket.instances[0].open();
            FakeWebSocket.instances[0].message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['read', 'write', 'navigation'],
                expiresAt: Date.now() + 60_000,
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        expect(screen.getByText('read, write, navigation')).toBeInTheDocument();
        expect(screen.getByText('Memory only')).toBeInTheDocument();
        expect(screen.getByLabelText('Pairing code')).toHaveValue('');

        await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));

        expect(FakeWebSocket.instances[0].sent).toEqual([
            JSON.stringify({
                type: 'agent_bridge_control',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                action: 'revoke',
            }),
        ]);
        expect(screen.getAllByText('Disconnected').length).toBeGreaterThan(0);
    });

    it('shows command activity without exposing command input', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
            socket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['read'],
                expiresAt: Date.now() + 60_000,
            }));
            socket.message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'request-1',
                sessionToken: 'paired-token',
                command: 'unsupported_command',
                input: {
                    secret: 'not shown',
                },
            }));
        });

        expect(screen.getAllByText('Acting').length).toBeGreaterThan(0);
        expect(screen.getByText('Running unsupported_command')).toBeInTheDocument();

        await act(async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        });

        await waitFor(() => {
            expect(screen.getByText(/unsupported_command failed/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Agent Activity')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
        expect(screen.queryByText('not shown')).toBeNull();
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-1',
            response: expect.objectContaining({
                ok: false,
                command: 'unsupported_command',
            }),
        }));
    });

    it('requires visible approval for billing commands before sending a response', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
            socket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['read', 'write', 'billing'],
                expiresAt: Date.now() + 60_000,
            }));
            socket.message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'request-billing',
                sessionToken: 'paired-token',
                command: 'mark_invoice_paid',
                input: {
                    invoiceId: 'secret-invoice-id',
                    confirmPaid: true,
                },
            }));
        });

        expect(screen.getByText('Billing Approval')).toBeInTheDocument();
        expect(screen.getAllByText('mark_invoice_paid').length).toBeGreaterThan(0);
        expect(screen.getAllByText('request-billing').length).toBeGreaterThan(0);
        expect(screen.queryByText('secret-invoice-id')).toBeNull();
        expect(socket.sent).toHaveLength(0);

        await userEvent.click(screen.getByRole('button', { name: 'Deny' }));

        await waitFor(() => {
            expect(socket.sent).toHaveLength(1);
        });

        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-billing',
            response: {
                ok: false,
                command: 'mark_invoice_paid',
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Agent command was not approved in TaskTime.',
                },
            },
        }));
        expect(screen.queryByText('Billing Approval')).toBeNull();
    });

    it('opens app routes requested by agent navigation commands', async () => {
        render(<AgentBridgeSettings />);

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
            socket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['navigation'],
                expiresAt: Date.now() + 60_000,
            }));
            socket.message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'request-navigation',
                sessionToken: 'paired-token',
                command: 'open_expenses_view',
                input: {},
            }));
        });

        await act(async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        });

        expect(window.location.pathname).toBe('/expenses');
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-navigation',
            response: expect.objectContaining({
                ok: true,
                command: 'open_expenses_view',
            }),
        }));
    });
});
