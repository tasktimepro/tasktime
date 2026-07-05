import type { AgentBridgeSession } from '@/agent/session';
import type { AgentCommandContext, AgentCommandErrorCode, AgentCommandResponse, AgentPermissionScope } from '@/agent/types';
import { agentCommandRequiresApproval, executeAgentCommand, getAgentCommandMetadata } from '@/agent/commands';
import { AGENT_APPROVAL_TOKEN_FORMAT } from '@/agent/approvalTokenFormat';

export const AGENT_APP_SESSION_PROTOCOL_VERSION = 1;
export { AGENT_APPROVAL_TOKEN_FORMAT } from '@/agent/approvalTokenFormat';

export type AgentAppSessionRequest = {
    protocolVersion: 1;
    requestId: string;
    sessionToken: string;
    command: string;
    input?: unknown;
    approval?: AgentAppSessionApprovalToken;
};

export type AgentAppSessionResponse = {
    protocolVersion: 1;
    requestId: string | null;
    response: AgentCommandResponse;
};

export type AgentAppSessionPairingMessage = {
    type: 'agent_bridge_session';
    protocolVersion: 1;
    sessionToken: string;
    scopes: AgentPermissionScope[];
    expiresAt: number;
};

export type AgentAppSessionControlMessage = {
    type: 'agent_bridge_control';
    protocolVersion: 1;
    sessionToken: string;
    action: 'revoke';
};

export type AgentAppSessionApprovalGrantPayload = {
    id: string;
    clientId: string;
    label?: string;
    scopes: AgentPermissionScope[];
    secretKeyBase64Url: string;
    createdAt: number;
    expiresAt?: number | null;
};

export type AgentAppSessionApprovalGrantMessage = {
    type: 'agent_bridge_approval_grant';
    protocolVersion: 1;
    sessionToken: string;
    grant: AgentAppSessionApprovalGrantPayload;
};

export type AgentAppSessionApprovalGrantRevocationMessage = {
    type: 'agent_bridge_approval_grant_revoke';
    protocolVersion: 1;
    sessionToken: string;
    grantId: string;
    revokedAt: number;
};

export type AgentAppSessionState = {
    sessionToken: string;
    scopes: Set<AgentPermissionScope>;
};

export type AgentAppSessionRequestMetadata = Pick<AgentAppSessionRequest, 'requestId' | 'command'>;

export type AgentAppSessionApprovalToken = {
    format?: string;
    grantId?: string;
    token: string;
    issuedAt?: number;
    expiresAt?: number;
    nonce?: string;
    command?: string;
    inputHash?: string;
    scopes?: AgentPermissionScope[];
    category?: string;
};

export interface AgentAppSessionApprovalRequest {
    requestId: string;
    command: string;
    inputHash: string;
    scopes: AgentPermissionScope[];
    category: string;
    approval?: AgentAppSessionApprovalToken;
}

export interface AgentAppSessionApprovalVerificationRequest extends AgentAppSessionApprovalRequest {
    approval: AgentAppSessionApprovalToken;
}

export interface AgentAppSessionRequestHandlingOptions {
    requestApproval?: (request: AgentAppSessionApprovalRequest) => Promise<boolean>;
    verifyApprovalToken?: (request: AgentAppSessionApprovalVerificationRequest) => Promise<boolean>;
}

export function isAgentAppSessionPairingMessage(value: unknown): value is AgentAppSessionPairingMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionPairingMessage>;

    return candidate.type === 'agent_bridge_session'
        && candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.sessionToken === 'string'
        && candidate.sessionToken.trim().length > 0
        && Array.isArray(candidate.scopes)
        && candidate.scopes.every((scope) => typeof scope === 'string')
        && typeof candidate.expiresAt === 'number'
        && Number.isFinite(candidate.expiresAt);
}

export function isAgentAppSessionControlMessage(value: unknown): value is AgentAppSessionControlMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionControlMessage>;

    return candidate.type === 'agent_bridge_control'
        && candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.sessionToken === 'string'
        && candidate.sessionToken.trim().length > 0
        && candidate.action === 'revoke';
}

export function isAgentAppSessionApprovalGrantMessage(value: unknown): value is AgentAppSessionApprovalGrantMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionApprovalGrantMessage>;
    const grant = candidate.grant as Partial<AgentAppSessionApprovalGrantPayload> | undefined;

    return candidate.type === 'agent_bridge_approval_grant'
        && candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.sessionToken === 'string'
        && candidate.sessionToken.trim().length > 0
        && !!grant
        && typeof grant === 'object'
        && typeof grant.id === 'string'
        && grant.id.trim().length > 0
        && typeof grant.clientId === 'string'
        && grant.clientId.trim().length > 0
        && (grant.label === undefined || typeof grant.label === 'string')
        && Array.isArray(grant.scopes)
        && grant.scopes.every((scope) => typeof scope === 'string')
        && typeof grant.secretKeyBase64Url === 'string'
        && grant.secretKeyBase64Url.trim().length > 0
        && typeof grant.createdAt === 'number'
        && Number.isFinite(grant.createdAt)
        && (grant.expiresAt === undefined || grant.expiresAt === null || (typeof grant.expiresAt === 'number' && Number.isFinite(grant.expiresAt)));
}

export function isAgentAppSessionApprovalGrantRevocationMessage(value: unknown): value is AgentAppSessionApprovalGrantRevocationMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionApprovalGrantRevocationMessage>;

    return candidate.type === 'agent_bridge_approval_grant_revoke'
        && candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.sessionToken === 'string'
        && candidate.sessionToken.trim().length > 0
        && typeof candidate.grantId === 'string'
        && candidate.grantId.trim().length > 0
        && typeof candidate.revokedAt === 'number'
        && Number.isFinite(candidate.revokedAt);
}

export function createAgentBridgeSessionFromPairingMessage(
    message: AgentAppSessionPairingMessage,
    createdAt: number = Date.now()
): AgentBridgeSession {
    return {
        sessionToken: message.sessionToken,
        scopes: new Set(message.scopes),
        createdAt,
        expiresAt: message.expiresAt,
    };
}

function errorResponse(
    requestId: string | null,
    command: string,
    code: AgentCommandErrorCode,
    message: string,
    details?: Record<string, unknown>
): AgentAppSessionResponse {
    return {
        protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
        requestId,
        response: {
            ok: false,
            command,
            error: {
                code,
                message,
                details,
            },
        },
    };
}

function isRequest(value: unknown): value is AgentAppSessionRequest {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionRequest>;

    return candidate.protocolVersion === AGENT_APP_SESSION_PROTOCOL_VERSION
        && typeof candidate.requestId === 'string'
        && candidate.requestId.trim().length > 0
        && typeof candidate.sessionToken === 'string'
        && candidate.sessionToken.trim().length > 0
        && typeof candidate.command === 'string'
        && candidate.command.trim().length > 0;
}

function isApprovalToken(value: unknown): value is AgentAppSessionApprovalToken {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AgentAppSessionApprovalToken>;

    return typeof candidate.token === 'string'
        && candidate.token.trim().length > 0
        && (candidate.format === undefined || typeof candidate.format === 'string')
        && (candidate.grantId === undefined || typeof candidate.grantId === 'string')
        && (candidate.issuedAt === undefined || (typeof candidate.issuedAt === 'number' && Number.isFinite(candidate.issuedAt)))
        && (candidate.expiresAt === undefined || (typeof candidate.expiresAt === 'number' && Number.isFinite(candidate.expiresAt)))
        && (candidate.nonce === undefined || typeof candidate.nonce === 'string')
        && (candidate.command === undefined || typeof candidate.command === 'string')
        && (candidate.inputHash === undefined || typeof candidate.inputHash === 'string')
        && (candidate.category === undefined || typeof candidate.category === 'string')
        && (candidate.scopes === undefined || (Array.isArray(candidate.scopes) && candidate.scopes.every((scope) => typeof scope === 'string')));
}

export function getAgentAppSessionRequestMetadata(value: unknown): AgentAppSessionRequestMetadata | null {
    if (!isRequest(value)) {
        return null;
    }

    return {
        requestId: value.requestId,
        command: value.command,
    };
}

function canonicalizeJson(value: unknown): unknown {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return null;
    }

    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => canonicalizeJson(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, item]) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonicalizeJson(item)])
        );
    }

    return null;
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function createAgentCommandInputHash(input: unknown): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Secure input hashing is unavailable.');
    }

    const canonicalJson = JSON.stringify(canonicalizeJson(input ?? {}));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson));

    return `sha256:${toHex(digest)}`;
}

export function getAgentAppSessionApprovalCategory(command: string): string {
    const metadata = getAgentCommandMetadata(command);

    if (!metadata) {
        return 'unknown';
    }

    if (metadata.scopes.includes('billing')) {
        return 'billing';
    }

    if (metadata.scopes.includes('email')) {
        return 'email';
    }

    if (metadata.scopes.includes('export')) {
        return 'export';
    }

    if (command.startsWith('delete_') || command.startsWith('cascade_delete_') || command.startsWith('restore_') || command === 'undo_latest_invoice') {
        return 'destructive';
    }

    return 'sensitive';
}

async function getApprovalRequest(
    rawRequest: AgentAppSessionRequest,
    session: AgentAppSessionState
): Promise<AgentAppSessionApprovalRequest> {
    const metadata = getAgentCommandMetadata(rawRequest.command);

    return {
        requestId: rawRequest.requestId,
        command: rawRequest.command,
        inputHash: await createAgentCommandInputHash(rawRequest.input ?? {}),
        scopes: metadata?.scopes ?? Array.from(session.scopes),
        category: getAgentAppSessionApprovalCategory(rawRequest.command),
        approval: isApprovalToken(rawRequest.approval) ? rawRequest.approval : undefined,
    };
}

export async function handleAgentAppSessionRequest(
    baseContext: AgentCommandContext,
    session: AgentAppSessionState,
    rawRequest: unknown,
    options: AgentAppSessionRequestHandlingOptions = {}
): Promise<AgentAppSessionResponse> {
    if (!isRequest(rawRequest)) {
        return errorResponse(null, 'unknown', 'INVALID_INPUT', 'Invalid agent app-session request.');
    }

    if (rawRequest.sessionToken !== session.sessionToken) {
        return errorResponse(rawRequest.requestId, rawRequest.command, 'PERMISSION_DENIED', 'Invalid agent app-session token.');
    }

    if (agentCommandRequiresApproval(rawRequest.command)) {
        const approvalRequest = await getApprovalRequest(rawRequest, session);
        let approved = false;

        if (approvalRequest.approval && options.verifyApprovalToken) {
            approved = await options.verifyApprovalToken({
                ...approvalRequest,
                approval: approvalRequest.approval,
            });
        }

        if (!approved) {
            approved = await options.requestApproval?.(approvalRequest) === true;
        }

        if (!approved) {
            return errorResponse(rawRequest.requestId, rawRequest.command, 'PERMISSION_DENIED', 'Agent command was not approved in TaskTime.');
        }
    }

    const response = await executeAgentCommand({
        ...baseContext,
        permissions: session.scopes,
    }, rawRequest.command, rawRequest.input ?? {});

    return {
        protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
        requestId: rawRequest.requestId,
        response,
    };
}
