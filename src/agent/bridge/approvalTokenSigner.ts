import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { AgentAppSessionApprovalGrantPayload, AgentAppSessionApprovalToken } from '@/agent/transport/protocol';
import { AGENT_APPROVAL_TOKEN_FORMAT } from '@/agent/approvalTokenFormat';
import type { AgentPermissionScope } from '@/agent/types';

const DEFAULT_APPROVAL_TOKEN_TTL_MS = 60_000;

export interface CreateBridgeApprovalTokenOptions {
    grant: AgentAppSessionApprovalGrantPayload;
    command: string;
    inputHash: string;
    scopes: AgentPermissionScope[];
    category: string;
    now?: () => number;
    ttlMs?: number;
    nonce?: string;
}

interface BridgeApprovalSignaturePayload {
    format: string;
    grantId: string;
    command: string;
    inputHash: string;
    category: string;
    scopes: AgentPermissionScope[];
    nonce: string;
    issuedAt: number;
    expiresAt: number;
}

function normalizeScopes(scopes: AgentPermissionScope[]): AgentPermissionScope[] {
    return [...new Set(scopes)].sort();
}

function canonicalize(value: unknown): unknown {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return null;
    }

    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => canonicalize(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, item]) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonicalize(item)])
        );
    }

    return null;
}

function createSignatureInput(payload: BridgeApprovalSignaturePayload): string {
    return JSON.stringify(canonicalize({
        ...payload,
        scopes: normalizeScopes(payload.scopes),
    }));
}

function decodeBase64Url(value: string): Buffer {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

    return Buffer.from(padded, 'base64');
}

function signPayload(payload: BridgeApprovalSignaturePayload, secretKeyBase64Url: string): string {
    return createHmac('sha256', decodeBase64Url(secretKeyBase64Url))
        .update(createSignatureInput(payload))
        .digest('base64url');
}

export function createBridgeApprovalToken(options: CreateBridgeApprovalTokenOptions): AgentAppSessionApprovalToken {
    const issuedAt = options.now ? options.now() : Date.now();
    const expiresAt = issuedAt + (options.ttlMs ?? DEFAULT_APPROVAL_TOKEN_TTL_MS);
    const nonce = options.nonce ?? (typeof randomUUID === 'function' ? randomUUID() : randomBytes(16).toString('base64url'));
    const payload: BridgeApprovalSignaturePayload = {
        format: AGENT_APPROVAL_TOKEN_FORMAT,
        grantId: options.grant.id,
        command: options.command,
        inputHash: options.inputHash,
        category: options.category,
        scopes: normalizeScopes(options.scopes),
        nonce,
        issuedAt,
        expiresAt,
    };

    return {
        format: payload.format,
        grantId: payload.grantId,
        token: signPayload(payload, options.grant.secretKeyBase64Url),
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        nonce: payload.nonce,
        command: payload.command,
        inputHash: payload.inputHash,
        scopes: payload.scopes,
        category: payload.category,
    };
}
