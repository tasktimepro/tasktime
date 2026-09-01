import { openDB } from 'idb';
import { createBillingSessionFingerprint, type BillingLifecycle } from './billingStorage';

const DB_NAME = 'tasktime-email-attempts';
const DB_VERSION = 1;
const STORE = 'attempts';
const MAX_RECORDS = 32;
const MAX_AGE_MS = 35 * 24 * 60 * 60 * 1000;

export type StoredEmailAttemptV1 = {
    version: 1;
    attemptId: string;
    provider: BillingLifecycle['provider'];
    generation: number;
    sessionIdFingerprint: string;
    idempotencyFingerprint: string;
    documentFingerprint: string;
    sendType: 'invoice' | 'reminder' | 'quote';
    state: 'pending' | 'partial' | 'completed' | 'rejected';
    metadataAppliedAt: number | null;
    createdAt: number;
    updatedAt: number;
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
        && ['invoice', 'reminder', 'quote'].includes(String(record.sendType))
        && ['pending', 'partial', 'completed', 'rejected'].includes(String(record.state))
        && (record.metadataAppliedAt === null || Number.isFinite(record.metadataAppliedAt))
        && Number.isFinite(record.createdAt)
        && Number.isFinite(record.updatedAt);
}

export async function storeEmailAttempt(input: {
    lifecycle: BillingLifecycle;
    attemptId: string;
    sendType: StoredEmailAttemptV1['sendType'];
    idempotencyKey: string;
    documentId: string;
    state?: StoredEmailAttemptV1['state'];
    nowMs?: number;
}): Promise<StoredEmailAttemptV1> {
    const now = input.nowMs ?? Date.now();
    const db = await getDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const prior: unknown = await transaction.store.get(input.attemptId);
    const record: StoredEmailAttemptV1 = {
        version: 1,
        attemptId: input.attemptId,
        provider: input.lifecycle.provider,
        generation: input.lifecycle.generation,
        sessionIdFingerprint: await createBillingSessionFingerprint(input.lifecycle.sessionId),
        idempotencyFingerprint: await createBillingSessionFingerprint(
            `email-idempotency:v1:${input.idempotencyKey}`,
        ),
        documentFingerprint: await createBillingSessionFingerprint(
            `email-document:v1:${input.sendType}:${input.documentId}`,
        ),
        sendType: input.sendType,
        state: input.state ?? 'pending',
        metadataAppliedAt: valid(prior) ? prior.metadataAppliedAt : null,
        createdAt: valid(prior) ? prior.createdAt : now,
        updatedAt: now,
    };
    await transaction.store.put(record, record.attemptId);
    const records = ((await transaction.store.getAll()) as unknown[])
        .filter(valid)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    for (const stale of records.filter((item, index) => (
        index >= MAX_RECORDS || item.updatedAt < now - MAX_AGE_MS
    ))) await transaction.store.delete(stale.attemptId);
    await transaction.done;
    return record;
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
        await transaction.store.put({ ...value, state, updatedAt: nowMs }, attemptId);
        await transaction.done;
        return true;
    } catch {
        return false;
    }
}

export async function listBoundEmailAttempts(
    lifecycle: BillingLifecycle,
): Promise<StoredEmailAttemptV1[]> {
    try {
        const db = await getDb();
        const fingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        const values = await db.transaction(STORE).store.getAll() as unknown[];
        return values.filter(valid).filter(record => (
            record.provider === lifecycle.provider
            && record.generation === lifecycle.generation
            && record.sessionIdFingerprint === fingerprint
        )).sort((left, right) => right.updatedAt - left.updatedAt);
    } catch {
        return [];
    }
}
