import type { AgentBridgeSession } from '@/agent/session';
import type { AgentCommandContext, AgentCommandErrorCode, AgentCommandResponse, AgentPermissionScope } from '@/agent/types';
import { agentCommandRequiresApproval, executeAgentCommand } from '@/agent/commands';

export const AGENT_APP_SESSION_PROTOCOL_VERSION = 1;

export type AgentAppSessionRequest = {
    protocolVersion: 1;
    requestId: string;
    sessionToken: string;
    command: string;
    input?: unknown;
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

export type AgentAppSessionState = {
    sessionToken: string;
    scopes: Set<AgentPermissionScope>;
};

export type AgentAppSessionRequestMetadata = Pick<AgentAppSessionRequest, 'requestId' | 'command'>;

export interface AgentAppSessionApprovalRequest {
    requestId: string;
    command: string;
}

export interface AgentAppSessionRequestHandlingOptions {
    requestApproval?: (request: AgentAppSessionApprovalRequest) => Promise<boolean>;
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

export function getAgentAppSessionRequestMetadata(value: unknown): AgentAppSessionRequestMetadata | null {
    if (!isRequest(value)) {
        return null;
    }

    return {
        requestId: value.requestId,
        command: value.command,
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
        const approved = await options.requestApproval?.({
            requestId: rawRequest.requestId,
            command: rawRequest.command,
        });

        if (approved !== true) {
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
