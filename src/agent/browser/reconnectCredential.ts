import { openDB } from 'idb';
import { buildAgentBridgeReconnectUrl } from './bridgeEndpoint';
import {
    createAgentBridgeReconnectSignatureInput,
    type AgentBridgeReconnectChallengeMessage,
    type AgentBridgeReconnectRegisteredMessage,
} from '@/agent/transport/protocol';

const DB_NAME = 'tasktime-agent-reconnect';
const DB_VERSION = 1;
const CREDENTIALS_STORE = 'browser-credentials';
const SCHEMA_VERSION = 1;
const MAX_RECONNECT_AUTHORIZATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface AgentBridgeReconnectCredential {
    schemaVersion: 1;
    endpoint: string;
    bridgeInstanceId: string;
    keyId: string;
    privateKey: CryptoKey;
    createdAt: number;
    expiresAt: number;
    agentId?: string;
    agentLabel?: string;
}

export interface AgentBridgeReconnectCredentialStore {
    list: () => Promise<unknown[]>;
    put: (credential: AgentBridgeReconnectCredential) => Promise<void>;
    delete: (bridgeInstanceId: string) => Promise<void>;
}

export interface CreateAgentBridgeReconnectCredentialOptions {
    endpoint: string;
    registration: AgentBridgeReconnectRegisteredMessage;
    agentId?: string;
    agentLabel?: string;
    now?: () => number;
}

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(CREDENTIALS_STORE)) {
                db.createObjectStore(CREDENTIALS_STORE, { keyPath: 'bridgeInstanceId' });
            }
        },
    });
}

const indexedDbCredentialStore: AgentBridgeReconnectCredentialStore = {
    async list() {
        const db = await getDB();
        return db.getAll(CREDENTIALS_STORE);
    },
    async put(credential) {
        const db = await getDB();
        await db.put(CREDENTIALS_STORE, credential);
    },
    async delete(bridgeInstanceId) {
        const db = await getDB();
        await db.delete(CREDENTIALS_STORE, bridgeInstanceId);
    },
};

function isFiniteTimestamp(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isValidReconnectPrivateKey(value: unknown): value is CryptoKey {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const key = value as CryptoKey;
    const algorithm = key.algorithm as EcKeyAlgorithm | undefined;

    return key.type === 'private'
        && key.extractable === false
        && algorithm?.name === 'ECDSA'
        && algorithm.namedCurve === 'P-256'
        && Array.isArray(key.usages)
        && key.usages.length === 1
        && key.usages[0] === 'sign';
}

export function validateAgentBridgeReconnectCredential(
    value: unknown,
    now: number = Date.now()
): AgentBridgeReconnectCredential | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as Partial<AgentBridgeReconnectCredential>;
    const endpoint = typeof candidate.endpoint === 'string' ? candidate.endpoint.trim() : '';
    const bridgeInstanceId = typeof candidate.bridgeInstanceId === 'string' ? candidate.bridgeInstanceId.trim() : '';
    const keyId = typeof candidate.keyId === 'string' ? candidate.keyId.trim() : '';

    if (
        candidate.schemaVersion !== SCHEMA_VERSION
        || !endpoint
        || !bridgeInstanceId
        || !keyId
        || !isValidReconnectPrivateKey(candidate.privateKey)
        || !isFiniteTimestamp(candidate.createdAt)
        || !isFiniteTimestamp(candidate.expiresAt)
        || candidate.createdAt > candidate.expiresAt
        || candidate.expiresAt <= now
        || candidate.expiresAt - now > MAX_RECONNECT_AUTHORIZATION_LIFETIME_MS
        || (candidate.agentId !== undefined && typeof candidate.agentId !== 'string')
        || (candidate.agentLabel !== undefined && typeof candidate.agentLabel !== 'string')
    ) {
        return null;
    }

    try {
        buildAgentBridgeReconnectUrl({ endpoint, keyId });
    } catch {
        return null;
    }

    return {
        schemaVersion: SCHEMA_VERSION,
        endpoint,
        bridgeInstanceId,
        keyId,
        privateKey: candidate.privateKey,
        createdAt: candidate.createdAt,
        expiresAt: candidate.expiresAt,
        ...(candidate.agentId ? { agentId: candidate.agentId } : {}),
        ...(candidate.agentLabel ? { agentLabel: candidate.agentLabel } : {}),
    };
}

export async function generateAgentBridgeReconnectKeyPair(): Promise<{
    privateKey: CryptoKey;
    publicKeyJwk: JsonWebKey;
}> {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Secure browser reconnect is unavailable.');
    }

    const keyPair = await globalThis.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
    );

    if (!isValidReconnectPrivateKey(keyPair.privateKey)) {
        throw new Error('Browser reconnect key could not be created safely.');
    }

    const publicKeyJwk = await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
        privateKey: keyPair.privateKey,
        publicKeyJwk,
    };
}

export function createAgentBridgeReconnectCredential(
    privateKey: CryptoKey,
    options: CreateAgentBridgeReconnectCredentialOptions
): AgentBridgeReconnectCredential {
    const now = options.now ? options.now() : Date.now();
    const credential = validateAgentBridgeReconnectCredential({
        schemaVersion: SCHEMA_VERSION,
        endpoint: options.endpoint,
        bridgeInstanceId: options.registration.bridgeInstanceId,
        keyId: options.registration.keyId,
        privateKey,
        createdAt: now,
        expiresAt: options.registration.expiresAt,
        agentId: options.agentId,
        agentLabel: options.agentLabel,
    }, now);

    if (!credential) {
        throw new Error('Bridge returned invalid browser reconnect registration.');
    }

    return credential;
}

export async function saveAgentBridgeReconnectCredential(
    credential: AgentBridgeReconnectCredential,
    store: AgentBridgeReconnectCredentialStore = indexedDbCredentialStore
): Promise<void> {
    const validated = validateAgentBridgeReconnectCredential(credential);

    if (!validated) {
        throw new Error('Invalid browser reconnect credential.');
    }

    await store.put(validated);
}

export async function loadAgentBridgeReconnectCredential(
    store: AgentBridgeReconnectCredentialStore = indexedDbCredentialStore,
    now: number = Date.now()
): Promise<AgentBridgeReconnectCredential | null> {
    const records = await store.list();
    const valid: AgentBridgeReconnectCredential[] = [];

    for (const record of records) {
        const bridgeInstanceId = record && typeof record === 'object'
            ? (record as Partial<AgentBridgeReconnectCredential>).bridgeInstanceId
            : undefined;
        const credential = validateAgentBridgeReconnectCredential(record, now);

        if (credential) {
            valid.push(credential);
        } else if (typeof bridgeInstanceId === 'string' && bridgeInstanceId) {
            await store.delete(bridgeInstanceId);
        }
    }

    valid.sort((left, right) => right.createdAt - left.createdAt);
    return valid[0] ?? null;
}

export async function deleteAgentBridgeReconnectCredential(
    bridgeInstanceId: string,
    store: AgentBridgeReconnectCredentialStore = indexedDbCredentialStore
): Promise<void> {
    if (!bridgeInstanceId.trim()) {
        return;
    }

    await store.delete(bridgeInstanceId.trim());
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return globalThis.btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/u, '');
}

export async function signAgentBridgeReconnectChallenge(
    credential: AgentBridgeReconnectCredential,
    challenge: AgentBridgeReconnectChallengeMessage,
    expectedOrigin: string,
    now: number = Date.now()
): Promise<string> {
    const validated = validateAgentBridgeReconnectCredential(credential, now);

    if (
        !validated
        || challenge.bridgeInstanceId !== validated.bridgeInstanceId
        || challenge.keyId !== validated.keyId
        || challenge.origin !== expectedOrigin
        || challenge.expiresAt <= now
    ) {
        throw new Error('Bridge reconnect challenge is invalid or expired.');
    }

    const signature = await globalThis.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        validated.privateKey,
        new TextEncoder().encode(createAgentBridgeReconnectSignatureInput(challenge))
    );

    return bytesToBase64Url(new Uint8Array(signature));
}
