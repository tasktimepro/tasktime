import type { AgentPermissionScope } from '@/agent/types';

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_TOKEN_BYTES = 32;

export interface AgentBridgeSession {
    sessionToken: string;
    scopes: Set<AgentPermissionScope>;
    createdAt: number;
    expiresAt: number;
}

export interface CreateAgentBridgeSessionOptions {
    scopes: Iterable<AgentPermissionScope>;
    now?: () => number;
    ttlMs?: number;
    tokenBytes?: number;
    tokenFactory?: (byteLength?: number) => string;
}

function getCrypto(): Crypto {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Secure random token generation is unavailable.');
    }

    return globalThis.crypto;
}

export function createAgentSessionToken(byteLength: number = DEFAULT_TOKEN_BYTES): string {
    const bytes = new Uint8Array(byteLength);
    getCrypto().getRandomValues(bytes);

    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function createAgentBridgeSession(options: CreateAgentBridgeSessionOptions): AgentBridgeSession {
    const now = options.now ? options.now() : Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;

    return {
        sessionToken: options.tokenFactory ? options.tokenFactory(options.tokenBytes) : createAgentSessionToken(options.tokenBytes),
        scopes: new Set(options.scopes),
        createdAt: now,
        expiresAt: now + ttlMs,
    };
}

export function isAgentBridgeSessionExpired(
    session: AgentBridgeSession,
    now: number = Date.now()
): boolean {
    return now >= session.expiresAt;
}

export function assertAgentBridgeSessionActive(
    session: AgentBridgeSession,
    now: number = Date.now()
): void {
    if (isAgentBridgeSessionExpired(session, now)) {
        throw new Error('Agent bridge session expired.');
    }
}
