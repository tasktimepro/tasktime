import type { AddressInfo } from 'node:net';
import { type AgentPermissionScope, AgentCommandError } from '@/agent/types';
import { BridgeAuditLog, type BridgeAuditEvent } from './auditLog';
import { BridgePairingStore, type BridgePairingChallenge } from './pairing';
import { BridgeAppSessionServer, type BridgeWebSocketServerOptions } from './server';
import type { AgentAppSessionResponse } from '@/agent/transport/protocol';

export interface LocalAgentBridgeOptions {
    host: string;
    port: number;
    path?: string;
    allowedOrigins?: Iterable<string>;
    auditLog?: BridgeAuditLog;
    now?: () => number;
    sessionTtlMs?: number;
    tokenBytes?: number;
    tokenFactory?: (byteLength?: number) => string;
    onAudit?: (event: BridgeAuditEvent) => void;
}

export interface CreateLocalAgentPairingOptions {
    scopes: AgentPermissionScope[];
    ttlMs?: number;
    codeLength?: number;
    idFactory?: () => string;
    codeFactory?: (length: number) => string;
}

export class LocalAgentBridge {

    readonly pairingStore = new BridgePairingStore();
    readonly auditLog: BridgeAuditLog;
    readonly server: BridgeAppSessionServer;
    private readonly options: LocalAgentBridgeOptions;

    constructor(options: LocalAgentBridgeOptions) {
        this.options = options;
        this.auditLog = options.auditLog ?? new BridgeAuditLog();

        const serverOptions: BridgeWebSocketServerOptions = {
            host: options.host,
            port: options.port,
            path: options.path,
            allowedOrigins: options.allowedOrigins,
            auditLog: this.auditLog,
            pairing: {
                store: this.pairingStore,
                now: options.now,
                sessionTtlMs: options.sessionTtlMs,
                tokenBytes: options.tokenBytes,
                tokenFactory: options.tokenFactory,
            },
            onAudit: options.onAudit,
        };

        this.server = new BridgeAppSessionServer(serverOptions);
    }

    async start(): Promise<void> {
        await this.server.start();
    }

    async stop(): Promise<void> {
        await this.server.stop();
    }

    createPairingChallenge(options: CreateLocalAgentPairingOptions): BridgePairingChallenge {
        return this.pairingStore.create({
            endpoint: this.getEndpoint(),
            scopes: options.scopes,
            now: this.options.now,
            ttlMs: options.ttlMs,
            codeLength: options.codeLength,
            idFactory: options.idFactory,
            codeFactory: options.codeFactory,
        });
    }

    sendCommand(
        requestId: string,
        command: string,
        input?: unknown,
        timeoutMs?: number
    ): Promise<AgentAppSessionResponse> {
        return this.server.sendPairedAppSessionCommand(requestId, command, input, { timeoutMs });
    }

    disconnectClient(clientId: string): boolean {
        return this.server.disconnectClient(clientId);
    }

    revoke(): void {
        this.server.revokeAllSessions();
    }

    getAuditEvents(): BridgeAuditEvent[] {
        return this.auditLog.list();
    }

    private getEndpoint(): string {
        const address = this.server.getAddress();

        if (!address || typeof address === 'string') {
            throw new AgentCommandError('UNAVAILABLE', 'Local agent bridge must be started before creating a pairing challenge.');
        }

        const path = this.options.path ?? '/tasktime-agent';
        const host = formatEndpointHost(this.options.host, address);

        return `ws://${host}:${address.port}${path}`;
    }
}

function formatEndpointHost(configuredHost: string, address: AddressInfo): string {
    if (configuredHost === '::1' || address.family === 'IPv6') {
        return '[::1]';
    }

    return configuredHost;
}
