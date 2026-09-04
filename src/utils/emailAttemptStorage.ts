import { openDB } from 'idb';
import { createBillingSessionFingerprint, type BillingLifecycle } from './billingStorage';

const DB_NAME = 'tasktime-email-attempts';
const DB_VERSION = 1;
const STORE = 'attempts';
const FINGERPRINT_KEY_DB_NAME = 'tasktime-email-attempt-secrets';
const FINGERPRINT_KEY_DB_VERSION = 1;
const FINGERPRINT_KEY_STORE = 'keys';
const FINGERPRINT_KEY_ID = 'payload-fingerprint-v1';
const FINGERPRINT_KEY_VERSION = 1;
const MAX_RECORDS = 256;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DOCUMENT_SNAPSHOT_IGNORED_KEYS = new Set(['_sync', 'sentAt', 'sentToEmail', 'updatedAt']);
const fingerprintEncoder = new TextEncoder();
export const EMAIL_ATTEMPTS_CHANGED_EVENT = 'tasktime:email-attempts-changed';

export class EmailAttemptCapacityError extends Error {
    readonly code = 'EMAIL_ATTEMPT_CAPACITY';

    constructor() {
        super('Unresolved hosted-email attempt capacity is full.');
        this.name = 'EmailAttemptCapacityError';
    }
}

export class EmailAttemptBindingConflictError extends Error {
    readonly code = 'EMAIL_ATTEMPT_BINDING_CONFLICT';

    constructor() {
        super('Hosted-email attempt identity conflicts with its original binding.');
        this.name = 'EmailAttemptBindingConflictError';
    }
}

export type StoredEmailAttemptV1 = {
    version: 1;
    attemptId: string;
    provider: BillingLifecycle['provider'];
    generation: number;
    sessionIdFingerprint: string;
    idempotencyFingerprint: string;
    documentFingerprint: string;
    payloadFingerprint?: string;
    documentSnapshotFingerprint?: string;
    fingerprintKeyVersion?: 1;
    sendType: 'invoice' | 'reminder' | 'quote';
    state: 'pending' | 'partial' | 'completed' | 'rejected';
    metadataAppliedAt: number | null;
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;
};

export type EmailAttemptDocumentSnapshotValidation =
    | 'match'
    | 'mismatch'
    | 'missing'
    | 'unverifiable';

export type EmailAttemptRecoveryCandidate = {
    attempt: StoredEmailAttemptV1;
    binding: 'bound' | 'same-provider-reconnect' | 'different-provider';
};

type EmailAttemptRecoveryOptions = {
    includeAppliedCompletion?: boolean;
};

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        },
    });
}

function valid(value: unknown): value is StoredEmailAttemptV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Partial<StoredEmailAttemptV1>;
    return record.version === 1
        && typeof record.attemptId === 'string'
        && (record.provider === 'google-drive' || record.provider === 'dropbox')
        && Number.isSafeInteger(record.generation)
        && typeof record.sessionIdFingerprint === 'string'
        && /^[a-f0-9]{64}$/.test(record.sessionIdFingerprint)
        && typeof record.idempotencyFingerprint === 'string'
        && /^[a-f0-9]{64}$/.test(record.idempotencyFingerprint)
        && typeof record.documentFingerprint === 'string'
        && /^[a-f0-9]{64}$/.test(record.documentFingerprint)
        && ((record.payloadFingerprint === undefined
            && record.documentSnapshotFingerprint === undefined)
            || (typeof record.payloadFingerprint === 'string'
                && /^[a-f0-9]{64}$/.test(record.payloadFingerprint)
                && typeof record.documentSnapshotFingerprint === 'string'
                && /^[a-f0-9]{64}$/.test(record.documentSnapshotFingerprint)
                && (record.fingerprintKeyVersion === undefined
                    || record.fingerprintKeyVersion === FINGERPRINT_KEY_VERSION)))
        && ['invoice', 'reminder', 'quote'].includes(String(record.sendType))
        && ['pending', 'partial', 'completed', 'rejected'].includes(String(record.state))
        && (record.metadataAppliedAt === null || Number.isFinite(record.metadataAppliedAt))
        && Number.isFinite(record.createdAt)
        && Number.isFinite(record.updatedAt)
        && (record.expiresAt === undefined
            || (Number.isFinite(record.expiresAt)
                && record.expiresAt === record.createdAt + MAX_AGE_MS));
}

function isUnresolved(record: StoredEmailAttemptV1): boolean {
    return record.metadataAppliedAt === null && record.state !== 'rejected';
}

function isExpired(record: StoredEmailAttemptV1, nowMs: number): boolean {
    return record.createdAt <= nowMs - MAX_AGE_MS;
}

function canonicalizeDocumentSnapshot(value: unknown, depth = 0): string {
    if (value === null) return 'null';
    if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('INVALID_EMAIL_DOCUMENT_SNAPSHOT');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(item => item === undefined
            ? 'null'
            : canonicalizeDocumentSnapshot(item, depth + 1)).join(',')}]`;
    }
    if (!value || typeof value !== 'object') {
        throw new Error('INVALID_EMAIL_DOCUMENT_SNAPSHOT');
    }
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => item !== undefined
            && (depth !== 0 || !DOCUMENT_SNAPSHOT_IGNORED_KEYS.has(key)))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeDocumentSnapshot(item, depth + 1)}`);
    return `{${entries.join(',')}}`;
}

function getFingerprintKeyDb() {
    return openDB(FINGERPRINT_KEY_DB_NAME, FINGERPRINT_KEY_DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(FINGERPRINT_KEY_STORE)) {
                db.createObjectStore(FINGERPRINT_KEY_STORE);
            }
        },
    });
}

function isFingerprintKey(value: unknown): value is CryptoKey {
    return typeof CryptoKey !== 'undefined'
        && value instanceof CryptoKey
        && value.type === 'secret'
        && value.extractable === false
        && value.algorithm.name === 'HMAC'
        && value.usages.length === 1
        && value.usages[0] === 'sign';
}

async function getOrCreateFingerprintKey(): Promise<CryptoKey> {
    const db = await getFingerprintKeyDb();
    const current: unknown = await db.transaction(FINGERPRINT_KEY_STORE).store.get(FINGERPRINT_KEY_ID);
    if (isFingerprintKey(current)) return current;

    const generated = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        false,
        ['sign'],
    ) as CryptoKey;
    const transaction = db.transaction(FINGERPRINT_KEY_STORE, 'readwrite');
    const concurrent: unknown = await transaction.store.get(FINGERPRINT_KEY_ID);
    if (isFingerprintKey(concurrent)) {
        await transaction.done;
        return concurrent;
    }
    await transaction.store.put(generated, FINGERPRINT_KEY_ID);
    await transaction.done;
    return generated;
}

async function createFingerprint(domain: string, value: string): Promise<string> {
    const digest = await crypto.subtle.sign(
        'HMAC',
        await getOrCreateFingerprintKey(),
        fingerprintEncoder.encode(`${domain}:${value}`),
    );
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function createEmailDocumentSnapshotFingerprint(documentSnapshot: unknown): Promise<string> {
    return createFingerprint(
        'tasktime-email-document-snapshot:v1',
        canonicalizeDocumentSnapshot(documentSnapshot),
    );
}

function monotonicAttemptState(
    current: StoredEmailAttemptV1['state'],
    next: StoredEmailAttemptV1['state'],
): StoredEmailAttemptV1['state'] {
    if (current === 'completed' || current === 'rejected') return current;
    if (current === 'partial') return next === 'completed' ? 'completed' : 'partial';
    return next;
}

function notifyAttemptsChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(EMAIL_ATTEMPTS_CHANGED_EVENT));
    }
}

async function listCurrentEmailAttempts(nowMs = Date.now()): Promise<StoredEmailAttemptV1[]> {
    const db = await getDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const values = await transaction.store.getAll() as unknown[];
    const records = values.filter(valid);
    const expired = records.filter(record => isExpired(record, nowMs));
    for (const record of expired) await transaction.store.delete(record.attemptId);
    await transaction.done;
    if (expired.length > 0) notifyAttemptsChanged();
    return records.filter(record => !isExpired(record, nowMs));
}

type StoreEmailAttemptInput = {
    lifecycle: BillingLifecycle;
    attemptId: string;
    sendType: StoredEmailAttemptV1['sendType'];
    idempotencyKey: string;
    documentId: string;
    serializedPayload: string;
    documentSnapshot: unknown;
    state?: StoredEmailAttemptV1['state'];
    nowMs?: number;
};

export type StoreEmailAttemptDisposition = {
    record: StoredEmailAttemptV1;
    created: boolean;
};

async function writeEmailAttempt(input: StoreEmailAttemptInput): Promise<StoreEmailAttemptDisposition> {
    const now = input.nowMs ?? Date.now();
    const sessionIdFingerprint = await createBillingSessionFingerprint(input.lifecycle.sessionId);
    const idempotencyFingerprint = await createBillingSessionFingerprint(
        `email-idempotency:v1:${input.idempotencyKey}`,
    );
    const documentFingerprint = await createBillingSessionFingerprint(
        `email-document:v1:${input.sendType}:${input.documentId}`,
    );
    const payloadFingerprint = await createFingerprint(
        'tasktime-email-payload-fingerprint:v1',
        input.serializedPayload,
    );
    const documentSnapshotFingerprint = await createEmailDocumentSnapshotFingerprint(
        input.documentSnapshot,
    );
    const db = await getDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const prior: unknown = await transaction.store.get(input.attemptId);
    const priorIsValid = valid(prior);
    const expirationCutoff = now - MAX_AGE_MS;
    const priorIsCurrent = priorIsValid && !isExpired(prior, now);
    if (priorIsCurrent && (
        prior.provider !== input.lifecycle.provider
        || prior.generation !== input.lifecycle.generation
        || prior.sessionIdFingerprint !== sessionIdFingerprint
        || prior.idempotencyFingerprint !== idempotencyFingerprint
        || prior.documentFingerprint !== documentFingerprint
        || prior.payloadFingerprint !== payloadFingerprint
        || prior.documentSnapshotFingerprint !== documentSnapshotFingerprint
        || prior.sendType !== input.sendType
    )) {
        await transaction.done;
        throw new EmailAttemptBindingConflictError();
    }
    const records = ((await transaction.store.getAll()) as unknown[])
        .filter(valid);
    const resolvedOldestFirst = records
        .filter(record => record.createdAt >= expirationCutoff
            && !isUnresolved(record)
            && record.attemptId !== input.attemptId)
        .sort((left, right) => left.updatedAt - right.updatedAt);
    const deletions = new Set(records
        .filter(record => isExpired(record, now))
        .map(record => record.attemptId));
    let retainedCount = records.filter(record => !deletions.has(record.attemptId)).length;

    if (!priorIsCurrent) {
        for (const resolved of resolvedOldestFirst) {
            if (retainedCount < MAX_RECORDS) break;
            if (!deletions.has(resolved.attemptId)) {
                deletions.add(resolved.attemptId);
                retainedCount -= 1;
            }
        }
        if (retainedCount >= MAX_RECORDS) {
            await transaction.done;
            throw new EmailAttemptCapacityError();
        }
    }

    for (const attemptId of deletions) await transaction.store.delete(attemptId);
    const record: StoredEmailAttemptV1 = {
        version: 1,
        attemptId: input.attemptId,
        provider: input.lifecycle.provider,
        generation: input.lifecycle.generation,
        sessionIdFingerprint,
        idempotencyFingerprint,
        documentFingerprint,
        payloadFingerprint,
        documentSnapshotFingerprint,
        fingerprintKeyVersion: FINGERPRINT_KEY_VERSION,
        sendType: input.sendType,
        state: priorIsCurrent
            ? (input.state ? monotonicAttemptState(prior.state, input.state) : prior.state)
            : (input.state ?? 'pending'),
        metadataAppliedAt: priorIsCurrent ? prior.metadataAppliedAt : null,
        createdAt: priorIsCurrent ? prior.createdAt : now,
        updatedAt: now,
        expiresAt: priorIsCurrent
            ? (prior.expiresAt ?? prior.createdAt + MAX_AGE_MS)
            : now + MAX_AGE_MS,
    };
    await transaction.store.put(record, record.attemptId);
    await transaction.done;
    notifyAttemptsChanged();
    return { record, created: !priorIsCurrent };
}

export async function storeEmailAttempt(input: StoreEmailAttemptInput): Promise<StoredEmailAttemptV1> {
    return (await writeEmailAttempt(input)).record;
}

export async function storeEmailAttemptWithDisposition(
    input: StoreEmailAttemptInput,
): Promise<StoreEmailAttemptDisposition> {
    return writeEmailAttempt(input);
}

export async function validateBoundEmailAttemptDocumentSnapshot(
    attemptId: string,
    lifecycle: BillingLifecycle,
    documentSnapshot: unknown,
): Promise<EmailAttemptDocumentSnapshotValidation> {
    try {
        const db = await getDb();
        const value: unknown = await db.transaction(STORE).store.get(attemptId);
        const sessionIdFingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        if (!valid(value)
            || isExpired(value, Date.now())
            || value.provider !== lifecycle.provider
            || value.generation !== lifecycle.generation
            || value.sessionIdFingerprint !== sessionIdFingerprint) {
            return 'missing';
        }
        if (!value.documentSnapshotFingerprint
            || value.fingerprintKeyVersion !== FINGERPRINT_KEY_VERSION) return 'unverifiable';
        const currentFingerprint = await createEmailDocumentSnapshotFingerprint(documentSnapshot);
        return currentFingerprint === value.documentSnapshotFingerprint ? 'match' : 'mismatch';
    } catch {
        return 'unverifiable';
    }
}

export async function findBoundUnreconciledEmailAttempt(
    lifecycle: BillingLifecycle,
    documentId: string,
    sendType: StoredEmailAttemptV1['sendType'],
): Promise<StoredEmailAttemptV1 | null> {
    const fingerprint = await createBillingSessionFingerprint(
        `email-document:v1:${sendType}:${documentId}`,
    );
    const records = await listBoundEmailAttempts(lifecycle);
    return records.find(record => record.documentFingerprint === fingerprint
        && record.metadataAppliedAt === null
        && record.state !== 'rejected') ?? null;
}

export async function findUnreconciledEmailAttemptForRecovery(
    lifecycle: BillingLifecycle,
    documentId: string,
    sendType: StoredEmailAttemptV1['sendType'],
    options: EmailAttemptRecoveryOptions = {},
): Promise<EmailAttemptRecoveryCandidate | null> {
    try {
        const documentFingerprint = await createBillingSessionFingerprint(
            `email-document:v1:${sendType}:${documentId}`,
        );
        const sessionIdFingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        // The marker store and y-indexeddb commit independently. A terminal
        // accepted-primary marker must remain available when sentAt was lost
        // between those commits, but callers opt in only while sentAt is absent.
        const candidates = (await listCurrentEmailAttempts())
            .filter(record => (isUnresolved(record)
                || (options.includeAppliedCompletion === true
                    && (record.state === 'completed' || record.state === 'partial')
                    && record.metadataAppliedAt !== null))
                && record.documentFingerprint === documentFingerprint
                && record.sendType === sendType)
            .sort((left, right) => right.updatedAt - left.updatedAt);
        const bound = candidates.find(record => record.provider === lifecycle.provider
            && record.generation === lifecycle.generation
            && record.sessionIdFingerprint === sessionIdFingerprint);
        if (bound) return { attempt: bound, binding: 'bound' };
        const sameProvider = candidates.find(record => record.provider === lifecycle.provider);
        if (sameProvider) {
            return { attempt: sameProvider, binding: 'same-provider-reconnect' };
        }
        const differentProvider = candidates[0];
        return differentProvider
            ? { attempt: differentProvider, binding: 'different-provider' }
            : null;
    } catch {
        return null;
    }
}

export async function rebindEmailAttemptAfterOwnedStatus(input: {
    attemptId: string;
    lifecycle: BillingLifecycle;
    documentId: string;
    sendType: StoredEmailAttemptV1['sendType'];
    state: StoredEmailAttemptV1['state'];
    allowProviderChange?: boolean;
    nowMs?: number;
}): Promise<boolean> {
    try {
        const now = input.nowMs ?? Date.now();
        const sessionIdFingerprint = await createBillingSessionFingerprint(input.lifecycle.sessionId);
        const documentFingerprint = await createBillingSessionFingerprint(
            `email-document:v1:${input.sendType}:${input.documentId}`,
        );
        const db = await getDb();
        const transaction = db.transaction(STORE, 'readwrite');
        const value: unknown = await transaction.store.get(input.attemptId);
        const isAppliedCompletionRecovery = valid(value)
            && (value.state === 'completed' || value.state === 'partial')
            && value.metadataAppliedAt !== null
            && (input.state === 'completed' || input.state === 'partial');
        if (!valid(value)
            || (!isUnresolved(value) && !isAppliedCompletionRecovery)
            || (!input.allowProviderChange && value.provider !== input.lifecycle.provider)
            || value.documentFingerprint !== documentFingerprint
            || value.sendType !== input.sendType) {
            await transaction.done;
            return false;
        }
        const nextState = monotonicAttemptState(value.state, input.state);
        const alreadyBound = value.generation === input.lifecycle.generation
            && value.sessionIdFingerprint === sessionIdFingerprint;
        if (alreadyBound && value.state === nextState) {
            await transaction.done;
            return true;
        }
        await transaction.store.put({
            ...value,
            provider: input.lifecycle.provider,
            generation: input.lifecycle.generation,
            sessionIdFingerprint,
            state: nextState,
            updatedAt: now,
        }, input.attemptId);
        await transaction.done;
        notifyAttemptsChanged();
        return true;
    } catch {
        return false;
    }
}

export async function findBoundEmailAttemptByIdempotency(
    lifecycle: BillingLifecycle,
    idempotencyKey: string,
): Promise<StoredEmailAttemptV1 | null> {
    const fingerprint = await createBillingSessionFingerprint(
        `email-idempotency:v1:${idempotencyKey}`,
    );
    const records = await listBoundEmailAttempts(lifecycle);
    return records.find(record => record.idempotencyFingerprint === fingerprint) ?? null;
}

export async function markEmailAttemptMetadataApplied(
    attemptId: string,
    lifecycle: BillingLifecycle,
    nowMs = Date.now(),
): Promise<boolean> {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE, 'readwrite');
        const value: unknown = await transaction.store.get(attemptId);
        const fingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        if (!valid(value)
            || value.provider !== lifecycle.provider
            || value.generation !== lifecycle.generation
            || value.sessionIdFingerprint !== fingerprint) {
            await transaction.done;
            return false;
        }
        await transaction.store.put({
            ...value,
            metadataAppliedAt: value.metadataAppliedAt ?? nowMs,
            updatedAt: nowMs,
        }, attemptId);
        await transaction.done;
        notifyAttemptsChanged();
        return true;
    } catch {
        return false;
    }
}

export async function releasePendingEmailAttemptWithoutDurableEvidence(
    attemptId: string,
    lifecycle: BillingLifecycle,
    nowMs = Date.now(),
): Promise<boolean> {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE, 'readwrite');
        const value: unknown = await transaction.store.get(attemptId);
        const fingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        if (!valid(value)
            || value.provider !== lifecycle.provider
            || value.generation !== lifecycle.generation
            || value.sessionIdFingerprint !== fingerprint
            || value.state !== 'pending'
            || value.metadataAppliedAt !== null) {
            await transaction.done;
            return false;
        }
        await transaction.store.put({ ...value, state: 'rejected', updatedAt: nowMs }, attemptId);
        await transaction.done;
        notifyAttemptsChanged();
        return true;
    } catch {
        return false;
    }
}

export async function updateEmailAttemptState(
    attemptId: string,
    lifecycle: BillingLifecycle,
    state: StoredEmailAttemptV1['state'],
    nowMs = Date.now(),
): Promise<boolean> {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE, 'readwrite');
        const value: unknown = await transaction.store.get(attemptId);
        const fingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        if (!valid(value)
            || value.provider !== lifecycle.provider
            || value.generation !== lifecycle.generation
            || value.sessionIdFingerprint !== fingerprint) {
            await transaction.done;
            return false;
        }
        const nextState = monotonicAttemptState(value.state, state);
        if (value.state === nextState) {
            await transaction.done;
            return true;
        }
        await transaction.store.put({ ...value, state: nextState, updatedAt: nowMs }, attemptId);
        await transaction.done;
        notifyAttemptsChanged();
        return true;
    } catch {
        return false;
    }
}

export async function listBoundEmailAttempts(
    lifecycle: BillingLifecycle,
): Promise<StoredEmailAttemptV1[]> {
    try {
        const fingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        return (await listCurrentEmailAttempts()).filter(record => (
            record.provider === lifecycle.provider
            && record.generation === lifecycle.generation
            && record.sessionIdFingerprint === fingerprint
        )).sort((left, right) => right.updatedAt - left.updatedAt);
    } catch {
        return [];
    }
}
