import type { AgentBridgeSession } from '@/agent/session';
import type { AgentPermissionScope } from '@/agent/types';
import { buildAgentBridgeSessionUrl } from './bridgeEndpoint';

export const AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY = 'tasktime.agent.bridge.session.v1';

const SCHEMA_VERSION = 1;
const MAX_RESUME_LIFETIME_MS = 24 * 60 * 60 * 1000;
const VALID_SCOPES = new Set<AgentPermissionScope>([
    'read',
    'write',
    'billing',
    'export',
    'email',
    'navigation',
]);

export interface AgentBridgeSessionResumeRecord {
    schemaVersion: 1;
    endpoint: string;
    sessionToken: string;
    scopes: AgentPermissionScope[];
    createdAt: number;
    expiresAt: number;
    agentId?: string;
    agentLabel?: string;
}

export interface AgentBridgeSessionStorageLike {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
}

function getSessionStorage(): AgentBridgeSessionStorageLike | null {
    try {
        return globalThis.sessionStorage ?? null;
    } catch {
        return null;
    }
}

function isFiniteTimestamp(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeScopes(value: unknown): AgentPermissionScope[] | null {
    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }

    const scopes: AgentPermissionScope[] = [];

    for (const scope of value) {
        if (typeof scope !== 'string' || !VALID_SCOPES.has(scope as AgentPermissionScope)) {
            return null;
        }

        if (!scopes.includes(scope as AgentPermissionScope)) {
            scopes.push(scope as AgentPermissionScope);
        }
    }

    return scopes;
}

export function validateAgentBridgeSessionResumeRecord(
    value: unknown,
    now: number = Date.now()
): AgentBridgeSessionResumeRecord | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as Partial<AgentBridgeSessionResumeRecord>;
    const endpoint = typeof candidate.endpoint === 'string' ? candidate.endpoint.trim() : '';
    const sessionToken = typeof candidate.sessionToken === 'string' ? candidate.sessionToken.trim() : '';
    const scopes = normalizeScopes(candidate.scopes);

    if (
        candidate.schemaVersion !== SCHEMA_VERSION
        || !endpoint
        || !sessionToken
        || !scopes
        || !isFiniteTimestamp(candidate.createdAt)
        || !isFiniteTimestamp(candidate.expiresAt)
        || candidate.createdAt > candidate.expiresAt
        || candidate.expiresAt <= now
        || candidate.expiresAt - now > MAX_RESUME_LIFETIME_MS
        || (candidate.agentId !== undefined && typeof candidate.agentId !== 'string')
        || (candidate.agentLabel !== undefined && typeof candidate.agentLabel !== 'string')
    ) {
        return null;
    }

    try {
        buildAgentBridgeSessionUrl({ endpoint, sessionToken });
    } catch {
        return null;
    }

    return {
        schemaVersion: SCHEMA_VERSION,
        endpoint,
        sessionToken,
        scopes,
        createdAt: candidate.createdAt,
        expiresAt: candidate.expiresAt,
        ...(candidate.agentId ? { agentId: candidate.agentId } : {}),
        ...(candidate.agentLabel ? { agentLabel: candidate.agentLabel } : {}),
    };
}

export function saveAgentBridgeSessionResumeRecord(
    endpoint: string,
    session: AgentBridgeSession,
    storage: AgentBridgeSessionStorageLike | null = getSessionStorage()
): boolean {
    if (!storage) {
        return false;
    }

    const record = validateAgentBridgeSessionResumeRecord({
        schemaVersion: SCHEMA_VERSION,
        endpoint,
        sessionToken: session.sessionToken,
        scopes: Array.from(session.scopes),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        agentId: session.agentId,
        agentLabel: session.agentLabel,
    }, session.createdAt);

    if (!record) {
        return false;
    }

    try {
        storage.setItem(AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY, JSON.stringify(record));
        return true;
    } catch {
        return false;
    }
}

export function loadAgentBridgeSessionResumeRecord(
    storage: AgentBridgeSessionStorageLike | null = getSessionStorage(),
    now: number = Date.now()
): AgentBridgeSessionResumeRecord | null {
    if (!storage) {
        return null;
    }

    let rawValue: string | null;

    try {
        rawValue = storage.getItem(AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY);
    } catch {
        return null;
    }

    if (!rawValue) {
        return null;
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(rawValue);
    } catch {
        clearAgentBridgeSessionResumeRecord(storage);
        return null;
    }

    const record = validateAgentBridgeSessionResumeRecord(parsed, now);

    if (!record) {
        clearAgentBridgeSessionResumeRecord(storage);
    }

    return record;
}

export function clearAgentBridgeSessionResumeRecord(
    storage: AgentBridgeSessionStorageLike | null = getSessionStorage()
): void {
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY);
    } catch {
        // Restricted browser storage falls back to memory-only behavior.
    }
}

export function createAgentBridgeSessionFromResumeRecord(
    record: AgentBridgeSessionResumeRecord
): AgentBridgeSession {
    return {
        sessionToken: record.sessionToken,
        scopes: new Set(record.scopes),
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        agentId: record.agentId,
        agentLabel: record.agentLabel,
    };
}
