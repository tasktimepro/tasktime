import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { createAgentBridgeSession, type AgentBridgeSession } from '@/agent/session';
import { AGENT_APP_SESSION_PROTOCOL_VERSION, isAgentAppSessionControlMessage, type AgentAppSessionControlMessage, type AgentAppSessionPairingMessage, type AgentAppSessionRequest, type AgentAppSessionResponse } from '@/agent/transport/protocol';
import { AgentCommandError } from '@/agent/types';
import { BridgeAuditLog, type BridgeAuditEvent } from './auditLog';
import { assertAllowedTaskTimeOrigin, assertLoopbackHost, DEFAULT_ALLOWED_TASKTIME_ORIGINS } from './originPolicy';
import type { BridgePairingChallenge, BridgePairingStore } from './pairing';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_APP_SESSION_PATH = '/tasktime-agent';
const DEFAULT_APP_SESSION_REQUEST_TIMEOUT_MS = 120_000;

export interface BridgeWebSocketServerOptions {
    host: string;
    port: number;
    path?: string;
    allowedOrigins?: Iterable<string>;
    pairing?: BridgeAppSessionPairingOptions;
    auditLog?: BridgeAuditLog;
    onMessage?: (message: unknown, client: BridgeWebSocketClient) => void | Promise<void>;
    onClientConnected?: (client: BridgeWebSocketClient) => void;
    onClientDisconnected?: (client: BridgeWebSocketClient) => void;
    onSessionCreated?: (session: AgentBridgeSession, client: BridgeWebSocketClient, challenge: BridgePairingChallenge) => void;
    onAudit?: (event: BridgeAuditEvent) => void;
}

interface PendingAppSessionResponse {
    client: BridgeWebSocketClient;
    timeoutId: ReturnType<typeof setTimeout>;
    resolve: (response: AgentAppSessionResponse) => void;
    reject: (error: Error) => void;
}

export interface BridgeAppSessionRequestOptions {
    client?: BridgeWebSocketClient;
    timeoutMs?: number;
}

export interface BridgeAppSessionPairingOptions {
    store: BridgePairingStore;
    required?: boolean;
    now?: () => number;
    sessionTtlMs?: number;
    tokenBytes?: number;
    tokenFactory?: (byteLength?: number) => string;
}

interface PairingResult {
    challenge: BridgePairingChallenge;
    session: AgentBridgeSession;
}

export class BridgeWebSocketClient {

    readonly id: string;
    readonly session: AgentBridgeSession | null;
    private readonly socket: Socket;

    constructor(socket: Socket, id: string, session: AgentBridgeSession | null = null) {
        this.id = id;
        this.session = session;
        this.socket = socket;
    }

    sendJson(value: unknown): void {
        if (this.socket.destroyed) {
            return;
        }

        this.socket.write(encodeWebSocketTextFrame(JSON.stringify(value)));
    }

    close(): void {
        this.socket.destroy();
    }
}

export function createWebSocketAccept(key: string): string {
    return createHash('sha1')
        .update(`${key}${WEBSOCKET_GUID}`)
        .digest('base64');
}

export function encodeWebSocketTextFrame(message: string): Buffer {
    const payload = Buffer.from(message);
    const payloadLength = payload.length;

    if (payloadLength < 126) {
        return Buffer.concat([
            Buffer.from([0x81, payloadLength]),
            payload,
        ]);
    }

    if (payloadLength <= 0xffff) {
        const header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(payloadLength, 2);
        return Buffer.concat([header, payload]);
    }

    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
    return Buffer.concat([header, payload]);
}

export function decodeWebSocketTextFrames(buffer: Buffer): string[] {
    const messages: string[] = [];
    let offset = 0;

    while (offset + 2 <= buffer.length) {
        const firstByte = buffer[offset];
        const secondByte = buffer[offset + 1];
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) === 0x80;
        let payloadLength = secondByte & 0x7f;
        offset += 2;

        if (payloadLength === 126) {
            if (offset + 2 > buffer.length) break;
            payloadLength = buffer.readUInt16BE(offset);
            offset += 2;
        } else if (payloadLength === 127) {
            if (offset + 8 > buffer.length) break;
            const longLength = buffer.readBigUInt64BE(offset);
            if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) break;
            payloadLength = Number(longLength);
            offset += 8;
        }

        let mask: Buffer | null = null;
        if (isMasked) {
            if (offset + 4 > buffer.length) break;
            mask = buffer.subarray(offset, offset + 4);
            offset += 4;
        }

        if (offset + payloadLength > buffer.length) break;

        const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
        offset += payloadLength;

        if (mask) {
            for (let index = 0; index < payload.length; index += 1) {
                payload[index] ^= mask[index % 4];
            }
        }

        if (opcode === 0x1) {
            messages.push(payload.toString('utf8'));
        }
    }

    return messages;
}

function getRequestUrl(request: IncomingMessage): URL {
    const host = request.headers.host || '127.0.0.1';
    return new URL(request.url || '/', `http://${host}`);
}

function isAgentAppSessionResponse(value: unknown): value is AgentAppSessionResponse {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionResponse>;
    const response = candidate.response as Partial<AgentAppSessionResponse['response']> | undefined;

    return candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.requestId === 'string'
        && !!response
        && typeof response === 'object'
        && typeof response.command === 'string'
        && typeof response.ok === 'boolean';
}

export class BridgeAppSessionServer {

    private readonly options: BridgeWebSocketServerOptions;
    private readonly auditLog: BridgeAuditLog;
    private readonly clients = new Set<BridgeWebSocketClient>();
    private readonly pendingResponses = new Map<string, PendingAppSessionResponse>();
    private server: Server | null = null;
    private nextClientId = 0;
    private authoritativeClientId: string | null = null;

    constructor(options: BridgeWebSocketServerOptions) {
        assertLoopbackHost(options.host);
        this.options = options;
        this.auditLog = options.auditLog ?? new BridgeAuditLog();
    }

    async start(): Promise<void> {
        if (this.server) {
            return;
        }

        const server = createServer();
        this.server = server;

        server.on('upgrade', (request, socket) => {
            void this.handleUpgrade(request, socket);
        });

        await new Promise<void>((resolve) => {
            server.listen(this.options.port, this.options.host, resolve);
        });
    }

    async stop(): Promise<void> {
        const server = this.server;
        this.server = null;

        this.rejectPendingResponses(new AgentCommandError('UNAVAILABLE', 'Agent bridge server stopped.'));

        for (const client of this.clients) {
            client.close();
        }

        this.clients.clear();
        this.authoritativeClientId = null;

        if (!server) {
            return;
        }

        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getAuthoritativeClientId(): string | null {
        return this.authoritativeClientId;
    }

    getAuditEvents(): BridgeAuditEvent[] {
        return this.auditLog.list();
    }

    getAddress(): AddressInfo | string | null {
        return this.server?.address() ?? null;
    }

    broadcastJson(value: unknown): void {
        for (const client of this.clients) {
            client.sendJson(value);
        }
    }

    disconnectClient(clientId: string): boolean {
        const client = Array.from(this.clients).find((item) => item.id === clientId);

        if (!client) {
            return false;
        }

        client.close();
        return true;
    }

    revokeAllSessions(revokedByClientId?: string): void {
        this.audit({
            action: 'access_revoked',
            clientId: revokedByClientId,
        });
        this.rejectPendingResponses(new AgentCommandError('PERMISSION_DENIED', 'TaskTime agent bridge access was revoked.'));

        for (const client of this.clients) {
            client.close();
        }
    }

    createSessionRequest(
        client: BridgeWebSocketClient,
        requestId: string,
        command: string,
        input?: unknown
    ): AgentAppSessionRequest {
        if (!client.session) {
            throw new AgentCommandError('PERMISSION_DENIED', 'TaskTime app session is not paired.');
        }

        return {
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            requestId,
            sessionToken: client.session.sessionToken,
            command,
            input,
        };
    }

    sendPairedAppSessionCommand(
        requestId: string,
        command: string,
        input?: unknown,
        options: Omit<BridgeAppSessionRequestOptions, 'client'> = {}
    ): Promise<AgentAppSessionResponse> {
        const client = this.getAuthoritativeClient();
        const request = this.createSessionRequest(client, requestId, command, input);

        return this.sendAppSessionRequest(request, {
            ...options,
            client,
        });
    }

    sendAppSessionRequest(
        request: AgentAppSessionRequest,
        options: BridgeAppSessionRequestOptions = {}
    ): Promise<AgentAppSessionResponse> {
        const client = options.client || this.getAuthoritativeClient();

        if (this.pendingResponses.has(request.requestId)) {
            throw new AgentCommandError('CONFLICT', 'Agent app-session request ID is already pending.', {
                requestId: request.requestId,
            });
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingResponses.delete(request.requestId);
                this.audit({
                    action: 'command_failed',
                    clientId: client.id,
                    requestId: request.requestId,
                    command: request.command,
                    ok: false,
                    errorCode: 'UNAVAILABLE',
                    details: {
                        reason: 'timeout',
                    },
                });
                reject(new AgentCommandError('UNAVAILABLE', 'Agent app-session request timed out.', {
                    requestId: request.requestId,
                }));
            }, options.timeoutMs ?? DEFAULT_APP_SESSION_REQUEST_TIMEOUT_MS);

            this.pendingResponses.set(request.requestId, {
                client,
                timeoutId,
                resolve,
                reject,
            });

            client.sendJson(request);
            this.audit({
                action: 'command_dispatched',
                clientId: client.id,
                requestId: request.requestId,
                command: request.command,
            });
        });
    }

    private getAuthoritativeClient(): BridgeWebSocketClient {
        if (this.clients.size === 0) {
            throw new AgentCommandError('UNAVAILABLE', 'No TaskTime app session is connected.');
        }

        const client = Array.from(this.clients).find((item) => item.id === this.authoritativeClientId);

        if (!client) {
            throw new AgentCommandError('UNAVAILABLE', 'No authoritative TaskTime app session is available.');
        }

        return client;
    }

    private electAuthoritativeClient(): void {
        this.authoritativeClientId = Array.from(this.clients)[0]?.id ?? null;
    }

    private resolvePendingResponse(response: AgentAppSessionResponse, client: BridgeWebSocketClient): boolean {
        const requestId = response.requestId;

        if (!requestId) {
            return false;
        }

        const pending = this.pendingResponses.get(requestId);

        if (!pending || pending.client !== client) {
            return false;
        }

        clearTimeout(pending.timeoutId);
        this.pendingResponses.delete(requestId);
        pending.resolve(response);
        this.audit({
            action: response.response.ok ? 'command_completed' : 'command_failed',
            clientId: client.id,
            requestId,
            command: response.response.command,
            ok: response.response.ok,
            errorCode: response.response.ok ? undefined : response.response.error.code,
        });
        return true;
    }

    private handleControlMessage(message: AgentAppSessionControlMessage, client: BridgeWebSocketClient): boolean {
        if (!client.session || message.sessionToken !== client.session.sessionToken) {
            client.close();
            return true;
        }

        if (message.action === 'revoke') {
            this.revokeAllSessions(client.id);
            return true;
        }

        return false;
    }

    private rejectPendingResponses(error: Error, client?: BridgeWebSocketClient): void {
        for (const [requestId, pending] of this.pendingResponses) {
            if (client && pending.client !== client) {
                continue;
            }

            clearTimeout(pending.timeoutId);
            this.pendingResponses.delete(requestId);
            pending.reject(error);
        }
    }

    private createPairingSession(requestUrl: URL): PairingResult | null {
        const pairing = this.options.pairing;

        if (!pairing) {
            return null;
        }

        const pairingId = requestUrl.searchParams.get('pairingId');
        const pairingCode = requestUrl.searchParams.get('pairingCode');

        if (!pairingId || !pairingCode) {
            if (pairing.required === false) {
                return null;
            }

            throw new AgentCommandError('PERMISSION_DENIED', 'Pairing credentials are required for the TaskTime agent bridge.');
        }

        const now = pairing.now ? pairing.now() : Date.now();
        const challenge = pairing.store.consume(pairingId, pairingCode, now);
        const session = createAgentBridgeSession({
            scopes: challenge.scopes,
            now: () => now,
            ttlMs: pairing.sessionTtlMs,
            tokenBytes: pairing.tokenBytes,
            tokenFactory: pairing.tokenFactory,
        });

        return { challenge, session };
    }

    private createPairingMessage(session: AgentBridgeSession): AgentAppSessionPairingMessage {
        return {
            type: 'agent_bridge_session',
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            sessionToken: session.sessionToken,
            scopes: Array.from(session.scopes),
            expiresAt: session.expiresAt,
        };
    }

    private audit(input: Parameters<BridgeAuditLog['append']>[0]): void {
        const event = this.auditLog.append(input);
        this.options.onAudit?.(event);
    }

    private async handleUpgrade(request: IncomingMessage, socket: Socket): Promise<void> {
        try {
            assertAllowedTaskTimeOrigin(request.headers.origin, this.options.allowedOrigins || DEFAULT_ALLOWED_TASKTIME_ORIGINS);

            const requestUrl = getRequestUrl(request);

            if (requestUrl.pathname !== (this.options.path || DEFAULT_APP_SESSION_PATH)) {
                throw new Error('Invalid agent bridge WebSocket path.');
            }

            const key = request.headers['sec-websocket-key'];
            if (typeof key !== 'string' || !key.trim()) {
                throw new Error('Missing WebSocket key.');
            }

            const pairingResult = this.createPairingSession(requestUrl);

            socket.write([
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Accept: ${createWebSocketAccept(key)}`,
                '',
                '',
            ].join('\r\n'));

            const client = new BridgeWebSocketClient(socket, `client-${this.nextClientId++}`, pairingResult?.session ?? null);
            this.clients.add(client);

            if (!this.authoritativeClientId) {
                this.authoritativeClientId = client.id;
            }

            this.audit({
                action: 'session_connected',
                clientId: client.id,
                details: {
                    paired: !!pairingResult,
                    authoritative: this.authoritativeClientId === client.id,
                },
            });

            if (pairingResult) {
                client.sendJson(this.createPairingMessage(pairingResult.session));
                this.audit({
                    action: 'pairing_succeeded',
                    clientId: client.id,
                    details: {
                        pairingId: pairingResult.challenge.id,
                        scopes: pairingResult.challenge.scopes,
                        expiresAt: pairingResult.session.expiresAt,
                    },
                });
                this.options.onSessionCreated?.(pairingResult.session, client, pairingResult.challenge);
            }

            this.options.onClientConnected?.(client);

            socket.on('data', (chunk: Buffer) => {
                for (const message of decodeWebSocketTextFrames(chunk)) {
                    let parsed: unknown;

                    try {
                        parsed = JSON.parse(message);
                    } catch {
                        parsed = message;
                    }

                    if (isAgentAppSessionResponse(parsed) && this.resolvePendingResponse(parsed, client)) {
                        continue;
                    }

                    if (isAgentAppSessionControlMessage(parsed) && this.handleControlMessage(parsed, client)) {
                        continue;
                    }

                    void this.options.onMessage?.(parsed, client);
                }
            });

            socket.on('end', () => {
                socket.destroy();
            });

            socket.on('close', () => {
                const wasAuthoritative = this.authoritativeClientId === client.id;
                this.clients.delete(client);
                if (wasAuthoritative) {
                    this.electAuthoritativeClient();
                }
                this.rejectPendingResponses(new AgentCommandError('UNAVAILABLE', 'TaskTime app session disconnected.'), client);
                this.audit({
                    action: 'session_disconnected',
                    clientId: client.id,
                    details: {
                        wasAuthoritative,
                        nextAuthoritativeClientId: this.authoritativeClientId,
                    },
                });
                this.options.onClientDisconnected?.(client);
            });
        } catch {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
        }
    }
}
