import { Buffer } from 'node:buffer';
import { Socket, type AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { AgentCommandError } from '@/agent/types';
import type { AgentAppSessionRequest, AgentAppSessionResponse } from '@/agent/transport/protocol';
import { verifyAgentBridgeApprovalToken } from '@/agent/browser/approvalTokens';
import {
    BridgeAuditLog,
    type BridgeWebSocketClient,
    BridgeAppSessionServer,
    BridgePairingStore,
    LocalAgentBridge,
    assertAllowedTaskTimeOrigin,
    assertLoopbackHost,
    createBridgePairingChallenge,
    createWebSocketAccept,
    decodeWebSocketTextFrames,
    encodeWebSocketTextFrame,
    getBridgeAuditCommandCategory,
    isAllowedTaskTimeOrigin,
    isLoopbackHost,
} from './index';

function encodeMaskedClientTextFrame(message: string): Buffer {
    const payload = Buffer.from(message);
    const mask = Buffer.from([1, 2, 3, 4]);
    const maskedPayload = Buffer.from(payload);
    const payloadLength = payload.length;
    let header: Buffer;

    for (let index = 0; index < maskedPayload.length; index += 1) {
        maskedPayload[index] ^= mask[index % 4];
    }

    if (payloadLength < 126) {
        header = Buffer.from([0x81, 0x80 | payloadLength]);
    } else if (payloadLength <= 0xffff) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payloadLength, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    return Buffer.concat([header, mask, maskedPayload]);
}

interface TestWebSocketConnection {
    nextMessage: (timeoutMs?: number) => Promise<unknown | null>;
    sendJson: (value: unknown) => void;
    close: () => Promise<void>;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function waitForCondition(predicate: () => boolean, timeoutMs: number = 500): Promise<void> {
    const startedAt = Date.now();

    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for condition.');
        }

        await delay(10);
    }
}

function parseAddress(address: AddressInfo | string | null): AddressInfo {
    if (!address || typeof address === 'string') {
        throw new Error('Expected TCP server address.');
    }

    return address;
}

function connectTestWebSocket(port: number, path: string = '/tasktime-agent'): Promise<TestWebSocketConnection> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        const messages: unknown[] = [];
        const waiters: Array<(message: unknown) => void> = [];
        let handshakeBuffer = Buffer.alloc(0);
        let handshakeComplete = false;
        let settled = false;

        const pushMessage = (message: unknown) => {
            const waiter = waiters.shift();

            if (waiter) {
                waiter(message);
                return;
            }

            messages.push(message);
        };

        const handleFrameData = (chunk: Buffer) => {
            for (const message of decodeWebSocketTextFrames(chunk)) {
                pushMessage(JSON.parse(message));
            }
        };

        const connection: TestWebSocketConnection = {
            nextMessage: (timeoutMs) => {
                if (messages.length > 0) {
                    const message = messages.shift();
                    return Promise.resolve(message);
                }

                if (typeof timeoutMs === 'number') {
                    return new Promise((nextResolve) => {
                        const waiter = (message: unknown) => {
                            clearTimeout(timeout);
                            nextResolve(message);
                        };
                        const timeout = setTimeout(() => {
                            const index = waiters.indexOf(waiter);

                            if (index >= 0) {
                                waiters.splice(index, 1);
                            }

                            nextResolve(null);
                        }, timeoutMs);

                        waiters.push(waiter);
                    });
                }

                return new Promise((nextResolve) => {
                    waiters.push(nextResolve);
                });
            },
            sendJson: (value) => {
                socket.write(encodeMaskedClientTextFrame(JSON.stringify(value)));
            },
            close: () => new Promise((closeResolve) => {
                if (socket.destroyed) {
                    closeResolve();
                    return;
                }

                const forceClose = setTimeout(() => {
                    socket.destroy();
                }, 25);

                socket.once('close', () => {
                    clearTimeout(forceClose);
                    closeResolve();
                });
                socket.end();
            }),
        };

        socket.on('error', (error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        });

        socket.on('data', (chunk) => {
            if (!handshakeComplete) {
                handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
                const headerEnd = handshakeBuffer.indexOf('\r\n\r\n');

                if (headerEnd === -1) {
                    return;
                }

                const header = handshakeBuffer.subarray(0, headerEnd).toString('utf8');
                const remainder = handshakeBuffer.subarray(headerEnd + 4);

                if (!header.startsWith('HTTP/1.1 101')) {
                    if (!settled) {
                        settled = true;
                        reject(new Error(`Unexpected WebSocket handshake response: ${header}`));
                    }
                    return;
                }

                handshakeComplete = true;

                if (!settled) {
                    settled = true;
                    resolve(connection);
                }

                if (remainder.length > 0) {
                    handleFrameData(remainder);
                }

                return;
            }

            handleFrameData(chunk);
        });

        socket.connect(port, '127.0.0.1', () => {
            socket.write([
                `GET ${path} HTTP/1.1`,
                `Host: 127.0.0.1:${port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                'Origin: http://localhost:3101',
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Version: 13',
                '',
                '',
            ].join('\r\n'));
        });
    });
}

function requestWebSocketHandshake(
    port: number,
    origin: string,
    path: string = '/tasktime-agent'
): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();

        socket.on('error', reject);
        socket.on('data', (chunk) => {
            const response = chunk.toString('utf8');
            socket.destroy();
            resolve(response);
        });

        socket.connect(port, '127.0.0.1', () => {
            socket.write([
                `GET ${path} HTTP/1.1`,
                `Host: 127.0.0.1:${port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Origin: ${origin}`,
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Version: 13',
                '',
                '',
            ].join('\r\n'));
        });
    });
}

describe('agent bridge origin policy', () => {
    it('allows only loopback bind hosts', () => {
        expect(isLoopbackHost('localhost')).toBe(true);
        expect(isLoopbackHost('127.0.0.1')).toBe(true);
        expect(isLoopbackHost('127.44.55.66')).toBe(true);
        expect(isLoopbackHost('::1')).toBe(true);
        expect(isLoopbackHost('0.0.0.0')).toBe(false);
        expect(isLoopbackHost('127.999.999.999')).toBe(false);
        expect(isLoopbackHost('192.168.1.2')).toBe(false);
        expect(() => assertLoopbackHost('0.0.0.0')).toThrow(AgentCommandError);
    });

    it('validates browser origins against the configured allowlist', () => {
        expect(isAllowedTaskTimeOrigin('http://localhost:3101')).toBe(true);
        expect(isAllowedTaskTimeOrigin('https://tasktime.pro/some/path')).toBe(true);
        expect(isAllowedTaskTimeOrigin('https://evil.example')).toBe(false);
        expect(isAllowedTaskTimeOrigin('not a url')).toBe(false);
        expect(() => assertAllowedTaskTimeOrigin('https://evil.example')).toThrow(AgentCommandError);
    });
});

describe('agent bridge pairing', () => {
    it('creates short-lived challenges and consumes them once', () => {
        const store = new BridgePairingStore();
        const challenge = store.create({
            endpoint: 'ws://127.0.0.1:39876/tasktime-agent',
            scopes: ['read', 'write'],
            now: () => 1000,
            ttlMs: 5000,
            idFactory: () => 'pairing-1',
            codeFactory: () => '123456',
        });

        expect(challenge).toEqual({
            id: 'pairing-1',
            code: '123456',
            endpoint: 'ws://127.0.0.1:39876/tasktime-agent',
            scopes: ['read', 'write'],
            createdAt: 1000,
            expiresAt: 6000,
        });

        expect(store.consume('pairing-1', '123456', 5999)).toEqual(challenge);
        expect(() => store.consume('pairing-1', '123456', 5999)).toThrow(AgentCommandError);
    });

    it('rejects expired and invalid pairing codes', () => {
        const expired = createBridgePairingChallenge({
            endpoint: 'ws://127.0.0.1:39876/tasktime-agent',
            scopes: ['read'],
            now: () => 1000,
            ttlMs: 1000,
            idFactory: () => 'expired',
            codeFactory: () => '999999',
        });
        const store = new BridgePairingStore();

        store.create({
            endpoint: expired.endpoint,
            scopes: expired.scopes,
            now: () => expired.createdAt,
            ttlMs: expired.expiresAt - expired.createdAt,
            idFactory: () => expired.id,
            codeFactory: () => expired.code,
        });

        expect(() => store.consume('expired', '000000', 1500)).toThrow(/invalid/);
        expect(() => store.consume('expired', '999999', 2000)).toThrow(/expired/);
    });
});

describe('agent bridge audit log', () => {
    it('classifies commands and keeps a bounded in-memory event list', () => {
        const auditLog = new BridgeAuditLog({
            maxEvents: 2,
            now: () => 1234,
            idFactory: () => 'audit-id',
        });

        auditLog.append({
            action: 'command_dispatched',
            command: 'list_tasks',
        });
        auditLog.append({
            action: 'command_dispatched',
            command: 'create_task',
        });
        auditLog.append({
            action: 'command_dispatched',
            command: 'open_project_view',
        });

        expect(getBridgeAuditCommandCategory('finalize_invoice')).toBe('billing');
        expect(getBridgeAuditCommandCategory('export_invoice_pdf')).toBe('export');
        expect(getBridgeAuditCommandCategory('export_report_csv')).toBe('export');
        expect(getBridgeAuditCommandCategory('send_invoice_email')).toBe('email');
        expect(getBridgeAuditCommandCategory('open_project_view')).toBe('navigation');
        expect(getBridgeAuditCommandCategory('unarchive_task')).toBe('write');
        expect(auditLog.list()).toEqual([
            {
                id: 'audit-id',
                timestamp: 1234,
                action: 'command_dispatched',
                command: 'create_task',
                commandCategory: 'write',
            },
            {
                id: 'audit-id',
                timestamp: 1234,
                action: 'command_dispatched',
                command: 'open_project_view',
                commandCategory: 'navigation',
            },
        ]);
    });
});

describe('agent bridge websocket helpers', () => {
    it('creates the RFC WebSocket accept hash', () => {
        expect(createWebSocketAccept('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    });

    it('encodes server text frames and decodes browser masked text frames', () => {
        const serverFrame = encodeWebSocketTextFrame('hello');

        expect(serverFrame[0]).toBe(0x81);
        expect(serverFrame.subarray(2).toString('utf8')).toBe('hello');
        expect(decodeWebSocketTextFrames(encodeMaskedClientTextFrame('{"ok":true}'))).toEqual(['{"ok":true}']);
    });

    it('refuses non-loopback server construction', () => {
        expect(() => new BridgeAppSessionServer({
            host: '0.0.0.0',
            port: 39876,
        })).toThrow(AgentCommandError);
    });

    it('rejects disallowed browser origins during the WebSocket handshake', async () => {
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
        });

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            const response = await requestWebSocketHandshake(address.port, 'https://evil.example');

            expect(response).toContain('HTTP/1.1 403 Forbidden');
            expect(server.getClientCount()).toBe(0);
        } finally {
            await server.stop();
        }
    });

    it('requires pairing credentials when bridge pairing is enabled', async () => {
        const pairingStore = new BridgePairingStore();
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            pairing: {
                store: pairingStore,
                now: () => 2000,
            },
        });

        pairingStore.create({
            endpoint: 'ws://127.0.0.1:0/tasktime-agent',
            scopes: ['read'],
            now: () => 1000,
            ttlMs: 5000,
            idFactory: () => 'pairing-required',
            codeFactory: () => '123456',
        });

        try {
            await server.start();
            const address = parseAddress(server.getAddress());

            await expect(requestWebSocketHandshake(address.port, 'http://localhost:3101')).resolves.toContain('HTTP/1.1 403 Forbidden');
            await expect(requestWebSocketHandshake(
                address.port,
                'http://localhost:3101',
                '/tasktime-agent?pairingId=pairing-required&pairingCode=000000'
            )).resolves.toContain('HTTP/1.1 403 Forbidden');
            expect(server.getClientCount()).toBe(0);
        } finally {
            await server.stop();
        }
    });

    it('exchanges a short-lived session token after successful pairing', async () => {
        let connectedClientResolve: (client: BridgeWebSocketClient) => void;
        const connectedClient = new Promise<BridgeWebSocketClient>((resolve) => {
            connectedClientResolve = resolve;
        });
        const pairingStore = new BridgePairingStore();
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            pairing: {
                store: pairingStore,
                now: () => 2000,
                sessionTtlMs: 10_000,
                tokenBytes: 8,
                tokenFactory: () => 'paired-session-token',
            },
            onClientConnected: (client) => connectedClientResolve(client),
        });
        let connection: TestWebSocketConnection | null = null;

        pairingStore.create({
            endpoint: 'ws://127.0.0.1:0/tasktime-agent',
            scopes: ['read', 'write'],
            now: () => 1000,
            ttlMs: 5000,
            idFactory: () => 'pairing-success',
            codeFactory: () => '654321',
        });

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            connection = await connectTestWebSocket(
                address.port,
                '/tasktime-agent?pairingId=pairing-success&pairingCode=654321'
            );
            const client = await connectedClient;

            expect(client.session?.sessionToken).toBe('paired-session-token');
            expect(client.session?.scopes).toEqual(new Set(['read', 'write']));
            await expect(connection.nextMessage()).resolves.toEqual({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-session-token',
                scopes: ['read', 'write'],
                expiresAt: 12_000,
            });
            expect(server.createSessionRequest(client, 'paired-request', 'create_task', {
                title: 'Paired task',
            })).toEqual({
                protocolVersion: 1,
                requestId: 'paired-request',
                sessionToken: 'paired-session-token',
                command: 'create_task',
                input: {
                    title: 'Paired task',
                },
            });
            expect(JSON.stringify(server.getAuditEvents())).not.toContain('paired-session-token');

            await expect(requestWebSocketHandshake(
                address.port,
                'http://localhost:3101',
                '/tasktime-agent?pairingId=pairing-success&pairingCode=654321'
            )).resolves.toContain('HTTP/1.1 403 Forbidden');
        } finally {
            await connection?.close();
            await server.stop();
        }
    });

    it('lets a paired app session revoke all bridge app sessions', async () => {
        const connectedClients: BridgeWebSocketClient[] = [];
        const pairingStore = new BridgePairingStore();
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            pairing: {
                store: pairingStore,
                now: () => 3000,
                sessionTtlMs: 10_000,
                tokenFactory: () => 'paired-revoke-token',
            },
            onClientConnected: (client) => {
                connectedClients.push(client);
            },
        });
        let firstConnection: TestWebSocketConnection | null = null;
        let secondConnection: TestWebSocketConnection | null = null;

        pairingStore.create({
            endpoint: 'ws://127.0.0.1:0/tasktime-agent',
            scopes: ['read'],
            now: () => 1000,
            ttlMs: 5000,
            idFactory: () => 'revoke-pairing-1',
            codeFactory: () => '111111',
        });
        pairingStore.create({
            endpoint: 'ws://127.0.0.1:0/tasktime-agent',
            scopes: ['read'],
            now: () => 1000,
            ttlMs: 5000,
            idFactory: () => 'revoke-pairing-2',
            codeFactory: () => '222222',
        });

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            firstConnection = await connectTestWebSocket(
                address.port,
                '/tasktime-agent?pairingId=revoke-pairing-1&pairingCode=111111'
            );
            secondConnection = await connectTestWebSocket(
                address.port,
                '/tasktime-agent?pairingId=revoke-pairing-2&pairingCode=222222'
            );

            await expect(firstConnection.nextMessage()).resolves.toEqual(expect.objectContaining({
                type: 'agent_bridge_session',
                sessionToken: 'paired-revoke-token',
            }));
            await expect(secondConnection.nextMessage()).resolves.toEqual(expect.objectContaining({
                type: 'agent_bridge_session',
                sessionToken: 'paired-revoke-token',
            }));
            expect(server.getClientCount()).toBe(2);

            firstConnection.sendJson({
                type: 'agent_bridge_control',
                protocolVersion: 1,
                sessionToken: 'paired-revoke-token',
                action: 'revoke',
            });

            await waitForCondition(() => server.getClientCount() === 0);

            expect(server.getAuditEvents()).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    action: 'access_revoked',
                    clientId: connectedClients[0].id,
                }),
            ]));
        } finally {
            await firstConnection?.close();
            await secondConnection?.close();
            await server.stop();
        }
    });

    it('stores approval grants delivered by an authenticated paired app session', async () => {
        const bridge = new LocalAgentBridge({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            sessionTtlMs: 10_000,
            tokenFactory: () => 'paired-grant-token',
        });
        let connection: TestWebSocketConnection | null = null;

        try {
            await bridge.start();
            const challenge = bridge.createPairingChallenge({
                scopes: ['read', 'write', 'billing'],
                ttlMs: 5000,
                idFactory: () => 'grant-pairing',
                codeFactory: () => '333333',
            });
            const endpoint = new URL(challenge.endpoint);

            connection = await connectTestWebSocket(
                Number(endpoint.port),
                `${endpoint.pathname}?pairingId=${challenge.id}&pairingCode=${challenge.code}`
            );

            await expect(connection.nextMessage()).resolves.toEqual(expect.objectContaining({
                type: 'agent_bridge_session',
                sessionToken: 'paired-grant-token',
            }));

            connection.sendJson({
                type: 'agent_bridge_approval_grant',
                protocolVersion: 1,
                sessionToken: 'paired-grant-token',
                grant: {
                    id: 'approval-grant-1',
                    clientId: 'openclaw-local',
                    label: 'OpenClaw',
                    scopes: ['read', 'write', 'billing'],
                    secretKeyBase64Url: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
                    createdAt: 1_700_000_000_000,
                    expiresAt: null,
                },
            });

            await waitForCondition(() => bridge.listApprovalGrants().length === 1);

            expect(bridge.getApprovalGrant('approval-grant-1')).toEqual({
                id: 'approval-grant-1',
                clientId: 'openclaw-local',
                label: 'OpenClaw',
                scopes: ['read', 'write', 'billing'],
                secretKeyBase64Url: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
                createdAt: 1_700_000_000_000,
                expiresAt: null,
            });
            const approval = bridge.createApprovalToken({
                grantId: 'approval-grant-1',
                command: 'mark_invoice_paid',
                inputHash: 'sha256:paid',
                scopes: ['read', 'write', 'billing'],
                nonce: 'approval-nonce-1',
            });

            await expect(verifyAgentBridgeApprovalToken({
                requestId: 'request-approval-token',
                command: 'mark_invoice_paid',
                inputHash: 'sha256:paid',
                scopes: ['read', 'write', 'billing'],
                category: 'billing',
                approval,
            }, {
                now: () => Date.now(),
                store: {
                    getGrant: async () => ({
                        id: 'approval-grant-1',
                        clientId: 'openclaw-local',
                        label: 'OpenClaw',
                        scopes: ['read', 'write', 'billing'],
                        secretKeyBase64Url: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
                        createdAt: 1_700_000_000_000,
                        expiresAt: null,
                        revokedAt: null,
                    }),
                    consumeNonce: async () => true,
                },
            })).resolves.toBe(true);
            expect(bridge.getAuditEvents()).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    action: 'approval_grant_received',
                    details: expect.objectContaining({
                        grantId: 'approval-grant-1',
                        grantClientId: 'openclaw-local',
                        scopes: ['read', 'write', 'billing'],
                    }),
                }),
            ]));
            expect(JSON.stringify(bridge.getAuditEvents())).not.toContain('secret-key');

            connection.sendJson({
                type: 'agent_bridge_approval_grant_revoke',
                protocolVersion: 1,
                sessionToken: 'paired-grant-token',
                grantId: 'approval-grant-1',
                revokedAt: 1_700_000_010_000,
            });

            await waitForCondition(() => bridge.listApprovalGrants().length === 0);

            expect(bridge.getApprovalGrant('approval-grant-1')).toBeNull();
            expect(() => bridge.createApprovalToken({
                grantId: 'approval-grant-1',
                command: 'mark_invoice_paid',
                inputHash: 'sha256:paid',
                scopes: ['read', 'write', 'billing'],
            })).toThrow('No trusted TaskTime Pro approval grant is available for this bridge process.');
            expect(bridge.getAuditEvents()).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    action: 'approval_grant_revoked',
                    details: {
                        grantId: 'approval-grant-1',
                        revokedAt: 1_700_000_010_000,
                    },
                }),
            ]));
        } finally {
            await connection?.close();
            await bridge.stop();
        }
    });

    it('round-trips a structured app-session request over a real loopback WebSocket', async () => {
        let connectedClientResolve: (client: BridgeWebSocketClient) => void;
        const connectedClient = new Promise<BridgeWebSocketClient>((resolve) => {
            connectedClientResolve = resolve;
        });
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            onClientConnected: (client) => connectedClientResolve(client),
        });
        let connection: TestWebSocketConnection | null = null;

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            connection = await connectTestWebSocket(address.port);
            await connectedClient;

            const request: AgentAppSessionRequest = {
                protocolVersion: 1,
                requestId: 'request-real-socket',
                sessionToken: 'session-token',
                command: 'create_task',
                input: {
                    title: 'Created through real socket',
                },
            };
            const response: AgentAppSessionResponse = {
                protocolVersion: 1,
                requestId: request.requestId,
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-1',
                    },
                },
            };

            const pendingResponse = server.sendAppSessionRequest(request, { timeoutMs: 1000 });

            await expect(connection.nextMessage()).resolves.toEqual(request);
            connection.sendJson(response);

            await expect(pendingResponse).resolves.toEqual(response);
            expect(server.getAuditEvents()).toEqual([
                expect.objectContaining({
                    action: 'session_connected',
                    clientId: expect.any(String),
                }),
                expect.objectContaining({
                    action: 'command_dispatched',
                    requestId: request.requestId,
                    command: 'create_task',
                    commandCategory: 'write',
                }),
                expect.objectContaining({
                    action: 'command_completed',
                    requestId: request.requestId,
                    command: 'create_task',
                    commandCategory: 'write',
                    ok: true,
                }),
            ]);
            expect(JSON.stringify(server.getAuditEvents())).not.toContain('Created through real socket');
        } finally {
            await connection?.close();
            await server.stop();
        }
    });

    it('routes default requests to the authoritative app session and re-elects after disconnect', async () => {
        const connectedClients: BridgeWebSocketClient[] = [];
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            onClientConnected: (client) => {
                connectedClients.push(client);
            },
        });
        let firstConnection: TestWebSocketConnection | null = null;
        let secondConnection: TestWebSocketConnection | null = null;

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            firstConnection = await connectTestWebSocket(address.port);
            secondConnection = await connectTestWebSocket(address.port);

            expect(connectedClients).toHaveLength(2);
            expect(server.getAuthoritativeClientId()).toBe(connectedClients[0].id);

            const firstRequest: AgentAppSessionRequest = {
                protocolVersion: 1,
                requestId: 'authoritative-request-1',
                sessionToken: 'session-token',
                command: 'create_task',
                input: {
                    title: 'First authoritative task',
                },
            };
            const firstResponse: AgentAppSessionResponse = {
                protocolVersion: 1,
                requestId: firstRequest.requestId,
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-1',
                    },
                },
            };
            const pendingFirst = server.sendAppSessionRequest(firstRequest, { timeoutMs: 1000 });

            await expect(firstConnection.nextMessage()).resolves.toEqual(firstRequest);
            await expect(secondConnection.nextMessage(25)).resolves.toBeNull();
            firstConnection.sendJson(firstResponse);
            await expect(pendingFirst).resolves.toEqual(firstResponse);

            await firstConnection.close();
            await waitForCondition(() => server.getAuthoritativeClientId() === connectedClients[1].id);

            expect(server.getAuthoritativeClientId()).toBe(connectedClients[1].id);

            const secondRequest: AgentAppSessionRequest = {
                protocolVersion: 1,
                requestId: 'authoritative-request-2',
                sessionToken: 'session-token',
                command: 'create_task',
                input: {
                    title: 'Second authoritative task',
                },
            };
            const secondResponse: AgentAppSessionResponse = {
                protocolVersion: 1,
                requestId: secondRequest.requestId,
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-2',
                    },
                },
            };
            const pendingSecond = server.sendAppSessionRequest(secondRequest, { timeoutMs: 1000 });

            await expect(secondConnection.nextMessage()).resolves.toEqual(secondRequest);
            secondConnection.sendJson(secondResponse);
            await expect(pendingSecond).resolves.toEqual(secondResponse);
        } finally {
            await firstConnection?.close();
            await secondConnection?.close();
            await server.stop();
        }
    });

    it('supports explicit disconnect and revoke without persisted data changes', async () => {
        const connectedClients: BridgeWebSocketClient[] = [];
        const server = new BridgeAppSessionServer({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            onClientConnected: (client) => {
                connectedClients.push(client);
            },
        });
        let firstConnection: TestWebSocketConnection | null = null;
        let secondConnection: TestWebSocketConnection | null = null;

        try {
            await server.start();
            const address = parseAddress(server.getAddress());
            firstConnection = await connectTestWebSocket(address.port);
            secondConnection = await connectTestWebSocket(address.port);

            expect(connectedClients).toHaveLength(2);
            expect(server.disconnectClient('missing-client')).toBe(false);
            expect(server.disconnectClient(connectedClients[0].id)).toBe(true);

            await waitForCondition(() => server.getClientCount() === 1);

            expect(server.getAuthoritativeClientId()).toBe(connectedClients[1].id);

            server.revokeAllSessions();
            await waitForCondition(() => server.getClientCount() === 0);

            expect(server.getAuthoritativeClientId()).toBeNull();
            expect(server.getAuditEvents()).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    action: 'session_disconnected',
                    clientId: connectedClients[0].id,
                    details: expect.objectContaining({
                        wasAuthoritative: true,
                        nextAuthoritativeClientId: connectedClients[1].id,
                    }),
                }),
                expect.objectContaining({
                    action: 'session_disconnected',
                    clientId: connectedClients[1].id,
                    details: expect.objectContaining({
                        wasAuthoritative: true,
                        nextAuthoritativeClientId: null,
                    }),
                }),
            ]));
        } finally {
            await firstConnection?.close();
            await secondConnection?.close();
            await server.stop();
        }
    });

    it('wires pairing and command forwarding through the local bridge orchestrator', async () => {
        const bridge = new LocalAgentBridge({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            now: () => 5000,
            sessionTtlMs: 10_000,
            tokenFactory: () => 'local-bridge-session',
        });
        let connection: TestWebSocketConnection | null = null;

        try {
            await bridge.start();

            const challenge = bridge.createPairingChallenge({
                scopes: ['read', 'write'],
                ttlMs: 30_000,
                idFactory: () => 'local-pairing',
                codeFactory: () => '112233',
            });
            const endpoint = new URL(challenge.endpoint);

            expect(challenge.endpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/tasktime-agent$/);

            connection = await connectTestWebSocket(
                Number(endpoint.port),
                `${endpoint.pathname}?pairingId=${challenge.id}&pairingCode=${challenge.code}`
            );

            await expect(connection.nextMessage()).resolves.toEqual({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'local-bridge-session',
                scopes: ['read', 'write'],
                expiresAt: 15_000,
            });

            const pendingResponse = bridge.sendCommand('local-request', 'create_task', {
                title: 'From local bridge',
            }, 1000);
            const appRequest = await connection.nextMessage();

            expect(appRequest).toEqual({
                protocolVersion: 1,
                requestId: 'local-request',
                sessionToken: 'local-bridge-session',
                command: 'create_task',
                input: {
                    title: 'From local bridge',
                },
            });

            connection.sendJson({
                protocolVersion: 1,
                requestId: 'local-request',
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-local',
                    },
                },
            });

            await expect(pendingResponse).resolves.toEqual({
                protocolVersion: 1,
                requestId: 'local-request',
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-local',
                    },
                },
            });
            expect(bridge.getAuditEvents()).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    action: 'pairing_succeeded',
                }),
                expect.objectContaining({
                    action: 'command_completed',
                    requestId: 'local-request',
                    command: 'create_task',
                    commandCategory: 'write',
                }),
            ]));
        } finally {
            await connection?.close();
            await bridge.stop();
        }
    });
});
