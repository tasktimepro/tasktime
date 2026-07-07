import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentBridgeSettings from './AgentBridgeSettings';
import { AgentBridgeProvider } from '@/contexts/AgentBridgeContext.jsx';

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
const googleAuthMocks = vi.hoisted(() => ({
    revokeAccess: vi.fn(async () => undefined),
}));
const approvalTokenMocks = vi.hoisted(() => {
    const state = {
        grants: [],
    };

    return {
        state,
        createAgentBridgeApprovalGrant: vi.fn((options) => ({
            id: `grant-${state.grants.length + 1}`,
            clientId: options.clientId,
            label: options.label,
            scopes: [...options.scopes],
            secretKeyBase64Url: 'secret-key',
            createdAt: 1_700_000_000_000,
            expiresAt: null,
            revokedAt: null,
        })),
        saveAgentBridgeApprovalGrant: vi.fn(async (grant) => {
            state.grants = [
                ...state.grants.filter((item) => item.id !== grant.id),
                grant,
            ];
        }),
        listAgentBridgeApprovalGrants: vi.fn(async () => state.grants),
        revokeAgentBridgeApprovalGrant: vi.fn(async (grantId) => {
            state.grants = state.grants.map((grant) => (
                grant.id === grantId
                    ? { ...grant, revokedAt: 1_700_000_010_000 }
                    : grant
            ));
        }),
    };
});

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => yjsMocks,
}));

vi.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => googleAuthMocks,
}));

vi.mock('@/agent/browser/approvalTokens', () => ({
    createAgentBridgeApprovalGrant: approvalTokenMocks.createAgentBridgeApprovalGrant,
    saveAgentBridgeApprovalGrant: approvalTokenMocks.saveAgentBridgeApprovalGrant,
    listAgentBridgeApprovalGrants: approvalTokenMocks.listAgentBridgeApprovalGrants,
    revokeAgentBridgeApprovalGrant: approvalTokenMocks.revokeAgentBridgeApprovalGrant,
}));

function renderAgentBridgeSettings(ui = <AgentBridgeSettings />) {
    return render(
        <AgentBridgeProvider>
            {ui}
        </AgentBridgeProvider>
    );
}

describe('AgentBridgeSettings', () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
        yjsMocks.isReady = true;
        googleAuthMocks.revokeAccess.mockClear();
        approvalTokenMocks.state.grants = [];
        approvalTokenMocks.createAgentBridgeApprovalGrant.mockClear();
        approvalTokenMocks.saveAgentBridgeApprovalGrant.mockClear();
        approvalTokenMocks.listAgentBridgeApprovalGrants.mockClear();
        approvalTokenMocks.revokeAgentBridgeApprovalGrant.mockClear();
        window.history.pushState({}, '', '/account?section=agent');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('requires explicit loopback pairing details before connecting', async () => {
        renderAgentBridgeSettings();

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://192.168.1.10:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        expect(screen.getByText('Bridge endpoint must use a loopback host.')).toBeInTheDocument();
        expect(screen.getByText('Endpoint is not local')).toBeInTheDocument();
        expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('shows browser and endpoint diagnostics before connecting', async () => {
        renderAgentBridgeSettings();

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1/custom-path');

        expect(screen.getByText('Endpoint has no explicit port')).toBeInTheDocument();
        expect(screen.getByText('Unexpected bridge path')).toBeInTheDocument();
    });

    it('prefills launch pairing details and scrubs them from the URL before connecting', async () => {
        window.history.pushState({}, '', `/account?section=agent&keep=1&agentBridgeEndpoint=${encodeURIComponent('ws://127.0.0.1:39123/tasktime-agent')}&agentBridgePairingId=pairing-1&agentBridgePairingCode=123456`);

        renderAgentBridgeSettings();

        expect(screen.getByLabelText('Bridge endpoint')).toHaveValue('ws://127.0.0.1:39123/tasktime-agent');
        expect(screen.getByLabelText('Pairing ID')).toHaveValue('pairing-1');
        expect(screen.getByLabelText('Pairing code')).toHaveValue('123456');

        await waitFor(() => {
            const params = new URLSearchParams(window.location.search);
            expect(params.get('section')).toBe('agent');
            expect(params.get('keep')).toBe('1');
            expect(params.has('agentBridgeEndpoint')).toBe(false);
            expect(params.has('agentBridgePairingId')).toBe(false);
            expect(params.has('agentBridgePairingCode')).toBe(false);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(FakeWebSocket.instances[0].url).toBe('ws://127.0.0.1:39123/tasktime-agent?pairingId=pairing-1&pairingCode=123456');
    });

    it('connects to the explicit pairing URL and shows memory-only session state', async () => {
        renderAgentBridgeSettings();

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

    it('creates and revokes a trusted approval grant for the paired local agent', async () => {
        renderAgentBridgeSettings();

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
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Trust Current Agent' }));

        await waitFor(() => {
            expect(approvalTokenMocks.saveAgentBridgeApprovalGrant).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Trusted')).toBeInTheDocument();
        });

        expect(approvalTokenMocks.createAgentBridgeApprovalGrant).toHaveBeenCalledWith({
            clientId: 'ws://127.0.0.1:39123/tasktime-agent',
            label: 'Local agent bridge',
            scopes: ['read', 'write', 'billing'],
        });
        expect(JSON.parse(socket.sent[0])).toEqual({
            type: 'agent_bridge_approval_grant',
            protocolVersion: 1,
            sessionToken: 'paired-token',
            grant: expect.objectContaining({
                id: 'grant-1',
                clientId: 'ws://127.0.0.1:39123/tasktime-agent',
                label: 'Local agent bridge',
                scopes: ['read', 'write', 'billing'],
                secretKeyBase64Url: 'secret-key',
            }),
        });
        expect(screen.getByRole('button', { name: 'Trust Current Agent' })).toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: 'Revoke Grant' }));

        await waitFor(() => {
            expect(approvalTokenMocks.revokeAgentBridgeApprovalGrant).toHaveBeenCalledWith('grant-1', expect.any(Number));
            expect(screen.getByText('Revoked')).toBeInTheDocument();
        });
        expect(JSON.parse(socket.sent[1])).toEqual({
            type: 'agent_bridge_approval_grant_revoke',
            protocolVersion: 1,
            sessionToken: 'paired-token',
            grantId: 'grant-1',
            revokedAt: expect.any(Number),
        });
    });

    it('can disable agent access without affecting the settings page', async () => {
        renderAgentBridgeSettings();

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
                scopes: ['read', 'write'],
                expiresAt: Date.now() + 60_000,
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        await userEvent.click(screen.getByLabelText('Enable local agent access'));

        expect(socket.sent).toEqual([
            JSON.stringify({
                type: 'agent_bridge_control',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                action: 'revoke',
            }),
        ]);
        expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
        expect(screen.getByText('Agent access disabled')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Agent Access' })).toBeInTheDocument();
        expect(screen.getByLabelText('Bridge endpoint')).toBeDisabled();
        expect(screen.getByLabelText('Pairing ID')).toBeDisabled();
        expect(screen.getByLabelText('Pairing code')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();

        await userEvent.click(screen.getByLabelText('Enable local agent access'));

        expect(screen.getByLabelText('Bridge endpoint')).not.toBeDisabled();
        expect(screen.getByLabelText('Pairing ID')).not.toBeDisabled();
        expect(screen.getByLabelText('Pairing code')).not.toBeDisabled();
    });

    it('shows command activity without exposing command input', async () => {
        renderAgentBridgeSettings();

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

    it('requires visible approval for sensitive commands before sending a response', async () => {
        renderAgentBridgeSettings();

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

        await waitFor(() => {
            expect(screen.getByText('Agent Approval')).toBeInTheDocument();
            expect(screen.getAllByText('mark_invoice_paid').length).toBeGreaterThan(0);
            expect(screen.getAllByText('request-billing').length).toBeGreaterThan(0);
        });
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
                    message: 'Agent command was not approved in TaskTime Pro.',
                },
            },
        }));
        expect(screen.queryByText('Agent Approval')).toBeNull();
    });

    it('fails closed when a sensitive command approval times out', async () => {
        renderAgentBridgeSettings();

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        vi.useFakeTimers();

        const socket = FakeWebSocket.instances[0];
        await act(async () => {
            socket.open();
            socket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['read', 'write', 'billing'],
                expiresAt: Date.now() + 180_000,
            }));
            socket.message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'request-timeout',
                sessionToken: 'paired-token',
                command: 'mark_invoice_paid',
                input: {
                    invoiceId: 'secret-invoice-id',
                    confirmPaid: true,
                },
            }));
        });

        expect(screen.getByText('Agent Approval')).toBeInTheDocument();
        expect(socket.sent).toHaveLength(0);

        await act(async () => {
            vi.advanceTimersByTime(110_000);
        });

        expect(socket.sent).toHaveLength(1);

        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-timeout',
            response: {
                ok: false,
                command: 'mark_invoice_paid',
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Agent command was not approved in TaskTime Pro.',
                },
            },
        }));
        expect(screen.queryByText('Agent Approval')).toBeNull();
    });

    it('clears pending sensitive approval when the bridge disconnects', async () => {
        renderAgentBridgeSettings();

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
                requestId: 'request-disconnect',
                sessionToken: 'paired-token',
                command: 'mark_invoice_paid',
                input: {
                    invoiceId: 'secret-invoice-id',
                    confirmPaid: true,
                },
            }));
        });

        await waitFor(() => {
            expect(screen.getByText('Agent Approval')).toBeInTheDocument();
        });

        act(() => {
            socket.close();
        });

        await waitFor(() => {
            expect(screen.queryByText('Agent Approval')).toBeNull();
        });
        expect(socket.sent).toEqual([]);
    });

    it('opens app routes requested by agent navigation commands', async () => {
        renderAgentBridgeSettings();

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

    it('keeps the paired bridge session alive when the settings panel unmounts', async () => {
        const { rerender } = renderAgentBridgeSettings();

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
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        rerender(
            <AgentBridgeProvider>
                <div>Different TaskTime Pro route</div>
            </AgentBridgeProvider>
        );

        act(() => {
            socket.message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'request-background-navigation',
                sessionToken: 'paired-token',
                command: 'open_expenses_view',
                input: {},
            }));
        });

        await act(async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        });

        expect(window.location.pathname).toBe('/expenses');
        expect(socket.readyState).toBe(1);
        expect(JSON.parse(socket.sent[0])).toEqual(expect.objectContaining({
            requestId: 'request-background-navigation',
            response: expect.objectContaining({
                ok: true,
                command: 'open_expenses_view',
            }),
        }));
    });
});
