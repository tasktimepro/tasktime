import { openDB } from 'idb';
import {
    AGENT_APPROVAL_TOKEN_FORMAT,
    type AgentAppSessionApprovalVerificationRequest,
} from '@/agent/transport/protocol';
import type { AgentPermissionScope } from '@/agent/types';

export { AGENT_APPROVAL_TOKEN_FORMAT } from '@/agent/transport/protocol';

const DB_NAME = 'tasktime-agent-bridge';
const DB_VERSION = 1;
const GRANTS_STORE = 'approval-grants';
const NONCES_STORE = 'approval-nonces';
const CLOCK_SKEW_MS = 60_000;
const MAX_APPROVAL_TOKEN_TTL_MS = 5 * 60_000;

export interface AgentBridgeApprovalGrant {
    id: string;
    clientId: string;
    label?: string;
    scopes: AgentPermissionScope[];
    secretKeyBase64Url: string;
    createdAt: number;
    expiresAt?: number | null;
    revokedAt?: number | null;
}

export interface AgentBridgeApprovalNonceRecord {
    key: string;
    grantId: string;
    nonce: string;
    command: string;
    inputHash: string;
    usedAt: number;
    expiresAt: number;
}

export interface AgentBridgeApprovalGrantStore {
    getGrant: (grantId: string) => Promise<AgentBridgeApprovalGrant | null>;
    consumeNonce: (record: AgentBridgeApprovalNonceRecord) => Promise<boolean>;
    pruneExpiredNonces?: (now: number) => Promise<void>;
}

export interface AgentBridgeApprovalSignaturePayload {
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

export interface VerifyAgentBridgeApprovalTokenOptions {
    now?: () => number;
    store?: AgentBridgeApprovalGrantStore;
}

export interface CreateAgentBridgeApprovalGrantOptions {
    clientId: string;
    label?: string;
    scopes: AgentPermissionScope[];
    now?: () => number;
    id?: string;
    secretKeyBase64Url?: string;
    expiresAt?: number | null;
}

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(GRANTS_STORE)) {
                db.createObjectStore(GRANTS_STORE);
            }

            if (!db.objectStoreNames.contains(NONCES_STORE)) {
                db.createObjectStore(NONCES_STORE);
            }
        },
    });
}

function normalizeBase64Url(value: string): string {
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return normalizeBase64Url(globalThis.btoa(binary));
}

function createRandomBase64Url(byteLength: number): string {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Secure random grant creation is unavailable.');
    }

    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);

    return bytesToBase64Url(bytes);
}

function createRandomId(): string {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `grant-${createRandomBase64Url(16)}`;
}

function base64UrlToBytes(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
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

function normalizeScopes(scopes: AgentPermissionScope[]): AgentPermissionScope[] {
    return [...new Set(scopes)].sort();
}

function hasAllScopes(grantScopes: AgentPermissionScope[], requestedScopes: AgentPermissionScope[]): boolean {
    const grantScopeSet = new Set(grantScopes);

    return requestedScopes.every((scope) => grantScopeSet.has(scope));
}

function scopesEqual(left: AgentPermissionScope[], right: AgentPermissionScope[]): boolean {
    const normalizedLeft = normalizeScopes(left);
    const normalizedRight = normalizeScopes(right);

    return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((scope, index) => scope === normalizedRight[index]);
}

async function importHmacKey(secretKeyBase64Url: string): Promise<CryptoKey> {
    return globalThis.crypto.subtle.importKey(
        'raw',
        base64UrlToBytes(secretKeyBase64Url),
        {
            name: 'HMAC',
            hash: 'SHA-256',
        },
        false,
        ['sign', 'verify']
    );
}

function getSignaturePayload(request: AgentAppSessionApprovalVerificationRequest): AgentBridgeApprovalSignaturePayload | null {
    const { approval } = request;

    if (approval.format !== AGENT_APPROVAL_TOKEN_FORMAT) {
        return null;
    }

    if (!approval.grantId || !approval.nonce || typeof approval.issuedAt !== 'number' || typeof approval.expiresAt !== 'number') {
        return null;
    }

    if (approval.command !== request.command || approval.inputHash !== request.inputHash || approval.category !== request.category) {
        return null;
    }

    if (!approval.scopes || !scopesEqual(approval.scopes, request.scopes)) {
        return null;
    }

    return {
        format: AGENT_APPROVAL_TOKEN_FORMAT,
        grantId: approval.grantId,
        command: request.command,
        inputHash: request.inputHash,
        category: request.category,
        scopes: normalizeScopes(request.scopes),
        nonce: approval.nonce,
        issuedAt: approval.issuedAt,
        expiresAt: approval.expiresAt,
    };
}

function isSignaturePayloadTimely(payload: AgentBridgeApprovalSignaturePayload, now: number): boolean {
    if (payload.issuedAt > now + CLOCK_SKEW_MS) {
        return false;
    }

    if (payload.expiresAt <= now) {
        return false;
    }

    return payload.expiresAt - payload.issuedAt <= MAX_APPROVAL_TOKEN_TTL_MS;
}

export function createAgentBridgeApprovalSignatureInput(payload: AgentBridgeApprovalSignaturePayload): string {
    return JSON.stringify(canonicalize({
        ...payload,
        scopes: normalizeScopes(payload.scopes),
    }));
}

export async function createAgentBridgeApprovalSignature(
    payload: AgentBridgeApprovalSignaturePayload,
    secretKeyBase64Url: string
): Promise<string> {
    const key = await importHmacKey(secretKeyBase64Url);
    const signature = await globalThis.crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(createAgentBridgeApprovalSignatureInput(payload))
    );

    return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(
    payload: AgentBridgeApprovalSignaturePayload,
    token: string,
    secretKeyBase64Url: string
): Promise<boolean> {
    const key = await importHmacKey(secretKeyBase64Url);

    return globalThis.crypto.subtle.verify(
        'HMAC',
        key,
        base64UrlToBytes(token),
        new TextEncoder().encode(createAgentBridgeApprovalSignatureInput(payload))
    );
}

const indexedDbGrantStore: AgentBridgeApprovalGrantStore = {
    async getGrant(grantId) {
        const db = await getDB();
        const grant = await db.get(GRANTS_STORE, grantId) as AgentBridgeApprovalGrant | undefined;

        return grant ?? null;
    },
    async consumeNonce(record) {
        const db = await getDB();
        const tx = db.transaction(NONCES_STORE, 'readwrite');
        const existing = await tx.store.get(record.key) as AgentBridgeApprovalNonceRecord | undefined;

        if (existing) {
            await tx.done;
            return false;
        }

        await tx.store.put(record, record.key);
        await tx.done;
        return true;
    },
    async pruneExpiredNonces(now) {
        const db = await getDB();
        const tx = db.transaction(NONCES_STORE, 'readwrite');
        const keys = await tx.store.getAllKeys();

        for (const key of keys) {
            const record = await tx.store.get(key) as AgentBridgeApprovalNonceRecord | undefined;

            if (record && record.expiresAt <= now) {
                await tx.store.delete(key);
            }
        }

        await tx.done;
    },
};

export async function saveAgentBridgeApprovalGrant(grant: AgentBridgeApprovalGrant): Promise<void> {
    const db = await getDB();
    await db.put(GRANTS_STORE, {
        ...grant,
        scopes: normalizeScopes(grant.scopes),
    }, grant.id);
}

export function createAgentBridgeApprovalGrant(
    options: CreateAgentBridgeApprovalGrantOptions
): AgentBridgeApprovalGrant {
    const now = options.now ? options.now() : Date.now();

    return {
        id: options.id ?? createRandomId(),
        clientId: options.clientId,
        label: options.label,
        scopes: normalizeScopes(options.scopes),
        secretKeyBase64Url: options.secretKeyBase64Url ?? createRandomBase64Url(32),
        createdAt: now,
        expiresAt: options.expiresAt ?? null,
        revokedAt: null,
    };
}

export async function listAgentBridgeApprovalGrants(): Promise<AgentBridgeApprovalGrant[]> {
    const db = await getDB();
    return db.getAll(GRANTS_STORE) as Promise<AgentBridgeApprovalGrant[]>;
}

export async function revokeAgentBridgeApprovalGrant(grantId: string, revokedAt: number = Date.now()): Promise<void> {
    const db = await getDB();
    const grant = await db.get(GRANTS_STORE, grantId) as AgentBridgeApprovalGrant | undefined;

    if (!grant) {
        return;
    }

    await db.put(GRANTS_STORE, {
        ...grant,
        revokedAt,
    }, grantId);
}

export async function verifyAgentBridgeApprovalToken(
    request: AgentAppSessionApprovalVerificationRequest,
    options: VerifyAgentBridgeApprovalTokenOptions = {}
): Promise<boolean> {
    const now = options.now ? options.now() : Date.now();
    const store = options.store ?? indexedDbGrantStore;
    const payload = getSignaturePayload(request);

    if (!payload || !isSignaturePayloadTimely(payload, now)) {
        return false;
    }

    const grant = await store.getGrant(payload.grantId);

    if (
        !grant
        || grant.revokedAt != null
        || (grant.expiresAt != null && grant.expiresAt <= now)
    ) {
        return false;
    }

    if (!hasAllScopes(grant.scopes, request.scopes)) {
        return false;
    }

    let signatureValid = false;

    try {
        signatureValid = await verifySignature(payload, request.approval.token, grant.secretKeyBase64Url);
    } catch {
        return false;
    }

    if (!signatureValid) {
        return false;
    }

    const nonceKey = `${payload.grantId}:${payload.nonce}`;
    const consumed = await store.consumeNonce({
        key: nonceKey,
        grantId: payload.grantId,
        nonce: payload.nonce,
        command: payload.command,
        inputHash: payload.inputHash,
        usedAt: now,
        expiresAt: payload.expiresAt,
    });

    if (consumed) {
        await store.pruneExpiredNonces?.(now);
    }

    return consumed;
}

export async function verifyStoredAgentBridgeApprovalToken(
    request: AgentAppSessionApprovalVerificationRequest
): Promise<boolean> {
    return verifyAgentBridgeApprovalToken(request);
}
