import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
            expiresAt: options.expiresAt ?? null,
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
        deleteRevokedAgentBridgeApprovalGrants: vi.fn(async () => {
            const beforeCount = state.grants.length;
            state.grants = state.grants.filter((grant) => !grant.revokedAt);
            return beforeCount - state.grants.length;
        }),
    };
});
const reconnectCredentialMocks = vi.hoisted(() => {
    const state = {
        credential: null,
    };

    return {
        state,
        createAgentBridgeReconnectCredential: vi.fn((_privateKey, options) => ({
            schemaVersion: 1,
            endpoint: options.endpoint,
            bridgeInstanceId: options.registration.bridgeInstanceId,
            keyId: options.registration.keyId,
            privateKey: { type: 'private' },
            createdAt: Date.now(),
            expiresAt: options.registration.expiresAt,
            agentId: options.agentId,
            agentLabel: options.agentLabel,
        })),
        deleteAgentBridgeReconnectCredential: vi.fn(async () => undefined),
        generateAgentBridgeReconnectKeyPair: vi.fn(async () => ({
            privateKey: { type: 'private' },
            publicKeyJwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'public-x',
                y: 'public-y',
            },
        })),
        loadAgentBridgeReconnectCredential: vi.fn(async () => state.credential),
        saveAgentBridgeReconnectCredential: vi.fn(async (credential) => {
            state.credential = credential;
        }),
        signAgentBridgeReconnectChallenge: vi.fn(async () => 'signed-reconnect-proof'),
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
    deleteRevokedAgentBridgeApprovalGrants: approvalTokenMocks.deleteRevokedAgentBridgeApprovalGrants,
}));

vi.mock('@/agent/browser/reconnectCredential', () => ({
    createAgentBridgeReconnectCredential: reconnectCredentialMocks.createAgentBridgeReconnectCredential,
    deleteAgentBridgeReconnectCredential: reconnectCredentialMocks.deleteAgentBridgeReconnectCredential,
    generateAgentBridgeReconnectKeyPair: reconnectCredentialMocks.generateAgentBridgeReconnectKeyPair,
    loadAgentBridgeReconnectCredential: reconnectCredentialMocks.loadAgentBridgeReconnectCredential,
    saveAgentBridgeReconnectCredential: reconnectCredentialMocks.saveAgentBridgeReconnectCredential,
    signAgentBridgeReconnectChallenge: reconnectCredentialMocks.signAgentBridgeReconnectChallenge,
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
        approvalTokenMocks.deleteRevokedAgentBridgeApprovalGrants.mockClear();
        reconnectCredentialMocks.state.credential = null;
        reconnectCredentialMocks.createAgentBridgeReconnectCredential.mockClear();
        reconnectCredentialMocks.deleteAgentBridgeReconnectCredential.mockClear();
        reconnectCredentialMocks.generateAgentBridgeReconnectKeyPair.mockClear();
        reconnectCredentialMocks.loadAgentBridgeReconnectCredential.mockClear();
        reconnectCredentialMocks.saveAgentBridgeReconnectCredential.mockClear();
        reconnectCredentialMocks.signAgentBridgeReconnectChallenge.mockClear();
        window.sessionStorage.clear();
        window.history.pushState({}, '', '/account?section=agent');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
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
        window.history.pushState({}, '', `/account?section=agent&keep=1&agentBridgeEndpoint=${encodeURIComponent('ws://127.0.0.1:39123/tasktime-agent')}&agentBridgePairingId=pairing-1&agentBridgePairingCode=123456&agentBridgeScopes=read%2Cwrite%2Cbilling`);

        renderAgentBridgeSettings();

        expect(screen.getByLabelText('Bridge endpoint')).toHaveValue('ws://127.0.0.1:39123/tasktime-agent');
        expect(screen.getByLabelText('Pairing ID')).toHaveValue('pairing-1');
        expect(screen.getByLabelText('Pairing code')).toHaveValue('123456');
        expect(screen.getByText('Local agent request')).toBeInTheDocument();
        expect(screen.getByText(/requesting these scopes: read, write, billing/i)).toBeInTheDocument();

        await waitFor(() => {
            const params = new URLSearchParams(window.location.search);
            expect(params.get('section')).toBe('agent');
            expect(params.get('keep')).toBe('1');
            expect(params.has('agentBridgeEndpoint')).toBe(false);
            expect(params.has('agentBridgePairingId')).toBe(false);
            expect(params.has('agentBridgePairingCode')).toBe(false);
            expect(params.has('agentBridgeScopes')).toBe(false);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Approve & Connect' }));

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
        expect(screen.getByText('Current tab only')).toBeInTheDocument();
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

    it('creates and revokes an until-revoked trusted approval grant for the paired local agent by default', async () => {
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
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        expect(screen.getByRole('combobox', { name: 'Trust duration' })).toHaveTextContent('Until revoked');
        await userEvent.click(screen.getByRole('button', { name: 'Trust Until Revoked' }));

        await waitFor(() => {
            expect(approvalTokenMocks.saveAgentBridgeApprovalGrant).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Trusted')).toBeInTheDocument();
        });

        expect(approvalTokenMocks.createAgentBridgeApprovalGrant).toHaveBeenCalledWith({
            clientId: 'tasktime.agent.openclaw',
            label: 'OpenClaw on this device',
            scopes: ['read', 'write', 'billing'],
            expiresAt: null,
        });
        expect(JSON.parse(socket.sent[0])).toEqual({
            type: 'agent_bridge_approval_grant',
            protocolVersion: 1,
            sessionToken: 'paired-token',
            grant: expect.objectContaining({
                id: 'grant-1',
                clientId: 'tasktime.agent.openclaw',
                label: 'OpenClaw on this device',
                scopes: ['read', 'write', 'billing'],
                secretKeyBase64Url: 'secret-key',
                expiresAt: null,
            }),
        });
        expect(screen.getByText('Expires: Never')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Trust Until Revoked' })).toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: 'Revoke Grant' }));

        await waitFor(() => {
            expect(approvalTokenMocks.revokeAgentBridgeApprovalGrant).toHaveBeenCalledWith('grant-1', expect.any(Number));
            expect(screen.getByText('Clear Revoked')).toBeInTheDocument();
        });
        expect(JSON.parse(socket.sent[1])).toEqual({
            type: 'agent_bridge_approval_grant_revoke',
            protocolVersion: 1,
            sessionToken: 'paired-token',
            grantId: 'grant-1',
            revokedAt: expect.any(Number),
        });
    });

    it('redelivers an existing trusted approval grant to a newly paired stable agent', async () => {
        approvalTokenMocks.state.grants = [{
            id: 'grant-existing',
            clientId: 'tasktime.agent.openclaw',
            label: 'OpenClaw on this device',
            scopes: ['read', 'write'],
            secretKeyBase64Url: 'secret-key',
            createdAt: 1_700_000_000_000,
            expiresAt: null,
            revokedAt: null,
        }];

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
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(socket.sent.some((message) => {
                const parsed = JSON.parse(message);

                return parsed.type === 'agent_bridge_approval_grant'
                    && parsed.grant.id === 'grant-existing'
                    && parsed.grant.clientId === 'tasktime.agent.openclaw';
            })).toBe(true);
        });

        expect(screen.getByRole('button', { name: 'Trust Until Revoked' })).toBeDisabled();
        expect(screen.getByText('Trusted')).toBeInTheDocument();
        expect(approvalTokenMocks.saveAgentBridgeApprovalGrant).not.toHaveBeenCalled();
    });

    it('can create a time-limited trusted approval grant when selected', async () => {
        renderAgentBridgeSettings();

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        act(() => {
            FakeWebSocket.instances[0].open();
            FakeWebSocket.instances[0].message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['read', 'write'],
                expiresAt: Date.now() + 60_000,
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getByRole('combobox', { name: 'Trust duration' }));
        fireEvent.click(screen.getByRole('option', { name: '30 days' }));
        expect(screen.getByRole('combobox', { name: 'Trust duration' })).toHaveTextContent('30 days');
        await userEvent.click(screen.getByRole('button', { name: 'Trust for 30 Days' }));

        await waitFor(() => {
            expect(approvalTokenMocks.createAgentBridgeApprovalGrant).toHaveBeenCalledWith({
                clientId: 'tasktime.agent.openclaw',
                label: 'OpenClaw on this device',
                scopes: ['read', 'write'],
                expiresAt: expect.any(Number),
            });
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

    it('restores the paired bridge session when the provider remounts after a page refresh', async () => {
        const firstRender = renderAgentBridgeSettings();

        await userEvent.type(screen.getByLabelText('Bridge endpoint'), 'ws://127.0.0.1:39123/tasktime-agent');
        await userEvent.type(screen.getByLabelText('Pairing ID'), 'pairing-1');
        await userEvent.type(screen.getByLabelText('Pairing code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const firstSocket = FakeWebSocket.instances[0];
        act(() => {
            firstSocket.open();
            firstSocket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'refresh-session-token',
                scopes: ['read', 'navigation'],
                expiresAt: Date.now() + 60_000,
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });

        firstRender.unmount();
        renderAgentBridgeSettings();

        await waitFor(() => {
            expect(FakeWebSocket.instances).toHaveLength(2);
        });
        expect(FakeWebSocket.instances[1].url).toBe(
            'ws://127.0.0.1:39123/tasktime-agent?sessionToken=refresh-session-token'
        );
    });

    it('registers a browser-bound reconnect key after pairing when secure storage is available', async () => {
        vi.stubGlobal('indexedDB', {});
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
                scopes: ['read', 'navigation'],
                expiresAt: Date.now() + 60_000,
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(socket.sent.map((message) => JSON.parse(message))).toContainEqual(expect.objectContaining({
                type: 'agent_bridge_reconnect_register',
                sessionToken: 'paired-token',
                publicKeyJwk: expect.objectContaining({
                    kty: 'EC',
                    crv: 'P-256',
                }),
            }));
        });

        act(() => {
            socket.message(JSON.stringify({
                type: 'agent_bridge_reconnect_registered',
                protocolVersion: 1,
                keyId: 'reconnect-key-1',
                bridgeInstanceId: 'bridge-instance-1',
                expiresAt: Date.now() + 60_000,
            }));
        });

        await waitFor(() => {
            expect(reconnectCredentialMocks.saveAgentBridgeReconnectCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
                    keyId: 'reconnect-key-1',
                    bridgeInstanceId: 'bridge-instance-1',
                })
            );
        });
    });

    it('reconnects a newly opened tab with a signed browser-bound challenge and fresh session', async () => {
        vi.stubGlobal('indexedDB', {});
        reconnectCredentialMocks.state.credential = {
            schemaVersion: 1,
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            bridgeInstanceId: 'bridge-instance-1',
            keyId: 'reconnect-key-1',
            privateKey: { type: 'private' },
            createdAt: Date.now() - 1000,
            expiresAt: Date.now() + 60_000,
            agentId: 'tasktime.agent.openclaw',
            agentLabel: 'OpenClaw on this device',
        };

        renderAgentBridgeSettings();

        await waitFor(() => {
            expect(reconnectCredentialMocks.loadAgentBridgeReconnectCredential).toHaveBeenCalled();
            expect(FakeWebSocket.instances).toHaveLength(1);
        });
        const socket = FakeWebSocket.instances[0];
        expect(socket.url).toBe(
            'ws://127.0.0.1:39123/tasktime-agent?reconnectKeyId=reconnect-key-1'
        );

        act(() => {
            socket.open();
            socket.message(JSON.stringify({
                type: 'agent_bridge_reconnect_challenge',
                protocolVersion: 1,
                bridgeInstanceId: 'bridge-instance-1',
                keyId: 'reconnect-key-1',
                challengeId: 'challenge-1',
                nonce: 'nonce-1',
                origin: window.location.origin,
                expiresAt: Date.now() + 30_000,
            }));
        });

        await waitFor(() => {
            expect(reconnectCredentialMocks.signAgentBridgeReconnectChallenge).toHaveBeenCalled();
            expect(socket.sent.map((message) => JSON.parse(message))).toContainEqual({
                type: 'agent_bridge_reconnect_proof',
                protocolVersion: 1,
                keyId: 'reconnect-key-1',
                challengeId: 'challenge-1',
                signature: 'signed-reconnect-proof',
            });
        });

        act(() => {
            socket.message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'fresh-reopen-token',
                scopes: ['read', 'navigation'],
                expiresAt: Date.now() + 60_000,
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });

        await waitFor(() => {
            expect(screen.getAllByText('Paired').length).toBeGreaterThan(0);
        });
        expect(window.sessionStorage.getItem('tasktime.agent.bridge.session.v1')).not.toContain('signed-reconnect-proof');
    });
});
