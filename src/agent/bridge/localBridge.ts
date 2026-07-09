import type { AddressInfo } from 'node:net';
import { type AgentPermissionScope, AgentCommandError } from '@/agent/types';
import { BridgeAuditLog, type BridgeAuditEvent } from './auditLog';
import { createBridgeApprovalToken } from './approvalTokenSigner';
import { BridgePairingStore, type BridgePairingChallenge } from './pairing';
import { BridgeAppSessionServer, type BridgeWebSocketServerOptions } from './server';
import type { AgentAppSessionApprovalGrantPayload, AgentAppSessionApprovalToken, AgentAppSessionResponse } from '@/agent/transport/protocol';

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
    agentId?: string;
    agentLabel?: string;
}

export interface CreateLocalAgentApprovalTokenOptions {
    grantId?: string;
    command: string;
    inputHash: string;
    scopes: AgentPermissionScope[];
    category?: string;
    ttlMs?: number;
    nonce?: string;
}

export class LocalAgentBridge {

    readonly pairingStore = new BridgePairingStore();
    readonly auditLog: BridgeAuditLog;
    readonly server: BridgeAppSessionServer;
    private readonly options: LocalAgentBridgeOptions;
    private readonly approvalGrants = new Map<string, AgentAppSessionApprovalGrantPayload>();

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
            onApprovalGrantReceived: (grant) => {
                this.approvalGrants.set(grant.id, grant);
            },
            onApprovalGrantRevoked: (grantId) => {
                this.approvalGrants.delete(grantId);
            },
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
            agentId: options.agentId,
            agentLabel: options.agentLabel,
        });
    }

    sendCommand(
        requestId: string,
        command: string,
        input?: unknown,
        timeoutMs?: number,
        approval?: AgentAppSessionApprovalToken
    ): Promise<AgentAppSessionResponse> {
        return this.server.sendPairedAppSessionCommand(requestId, command, input, { timeoutMs, approval });
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

    getApprovalGrant(grantId: string): AgentAppSessionApprovalGrantPayload | null {
        return this.approvalGrants.get(grantId) ?? null;
    }

    listApprovalGrants(): AgentAppSessionApprovalGrantPayload[] {
        return Array.from(this.approvalGrants.values());
    }

    getClientCount(): number {
        return this.server.getClientCount();
    }

    getAuthoritativeClientId(): string | null {
        return this.server.getAuthoritativeClientId();
    }

    createApprovalToken(options: CreateLocalAgentApprovalTokenOptions): AgentAppSessionApprovalToken {
        const requestedScopes = dedupeScopes(options.scopes);
        const now = this.options.now ? this.options.now() : Date.now();
        const grant = options.grantId
            ? this.approvalGrants.get(options.grantId) ?? null
            : Array.from(this.approvalGrants.values()).find((item) => hasAllScopes(item.scopes, requestedScopes)) ?? null;

        if (!grant) {
            throw new AgentCommandError('UNAVAILABLE', 'No trusted TaskTime Pro approval grant is available for this bridge process.');
        }

        if (grant.expiresAt != null && grant.expiresAt <= now) {
            throw new AgentCommandError('PERMISSION_DENIED', 'Trusted TaskTime Pro approval grant expired.');
        }

        if (!hasAllScopes(grant.scopes, requestedScopes)) {
            throw new AgentCommandError('PERMISSION_DENIED', 'Trusted TaskTime Pro approval grant does not cover the requested scopes.');
        }

        return createBridgeApprovalToken({
            grant,
            command: options.command,
            inputHash: options.inputHash,
            scopes: requestedScopes,
            category: options.category ?? getBridgeApprovalCategory(options.command, requestedScopes),
            now: () => now,
            ttlMs: options.ttlMs,
            nonce: options.nonce,
        });
    }

    getEndpoint(): string {
        const address = this.server.getAddress();

        if (!address || typeof address === 'string') {
            throw new AgentCommandError('UNAVAILABLE', 'Local agent bridge must be started before creating a pairing challenge.');
        }

        const path = this.options.path ?? '/tasktime-agent';
        const host = formatEndpointHost(this.options.host, address);

        return `ws://${host}:${address.port}${path}`;
    }
}

function dedupeScopes(scopes: AgentPermissionScope[]): AgentPermissionScope[] {
    return [...new Set(scopes)];
}

function hasAllScopes(grantScopes: AgentPermissionScope[], requestedScopes: AgentPermissionScope[]): boolean {
    const grantScopeSet = new Set(grantScopes);

    return requestedScopes.every((scope) => grantScopeSet.has(scope));
}

function getBridgeApprovalCategory(command: string, scopes: AgentPermissionScope[]): string {
    if (scopes.includes('billing')) {
        return 'billing';
    }

    if (scopes.includes('email')) {
        return 'email';
    }

    if (scopes.includes('export')) {
        return 'export';
    }

    if (command.startsWith('delete_') || command.startsWith('cascade_delete_') || command.startsWith('restore_') || command === 'undo_latest_invoice') {
        return 'destructive';
    }

    return 'sensitive';
}

function formatEndpointHost(configuredHost: string, address: AddressInfo): string {
    if (configuredHost === '::1' || address.family === 'IPv6') {
        return '[::1]';
    }

    return configuredHost;
}
