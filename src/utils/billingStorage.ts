import { openDB } from 'idb';
import type {
    BillingLicensePayloadV1,
    BillingPublicJwk,
} from './billingLicense';

const DB_NAME = 'tasktime-billing-cache';
const DB_VERSION = 2;
const LICENSES_STORE = 'licenses';
const BINDINGS_STORE = 'bindings';
const PUBLIC_STORE = 'public-resources';
const CHECKOUT_STORE = 'checkout-attempts';
const ACTIVE_BINDING_KEY = 'active-v1';
const ACTIVE_CHECKOUT_KEY = 'active-v1';
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_SUBJECT_RECORDS = 8;
const fingerprintEncoder = new TextEncoder();

export type BillingLifecycle = {
    provider: 'google-drive' | 'dropbox';
    generation: number;
    sessionId: string;
};

export type StoredBillingLicenseV1 = {
    version: 1;
    subject: string;
    licenseJti: string;
    token: string;
    payload: BillingLicensePayloadV1;
    keyId: string;
    storedAt: number;
};

export type StoredBillingBindingV1 = {
    version: 1;
    provider: BillingLifecycle['provider'];
    generation: number;
    sessionIdFingerprint: string;
    subject: string;
    licenseJti: string;
    verifiedAt: number;
    verifiedServerTime: number;
    verifiedWallTime: number;
    lastObservedWallTime: number;
    maxTrustedTime: number;
};

export type BillingCacheReadResult =
    | {
        kind: 'hit';
        license: StoredBillingLicenseV1;
        binding: StoredBillingBindingV1;
        trustedTime: number;
    }
    | { kind: 'missing' }
    | { kind: 'clock_untrusted' };

type StoredJwksV1 = {
    version: 1;
    keys: BillingPublicJwk[];
    etag: string | null;
    expiresAt: number;
    storedAt: number;
};

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(LICENSES_STORE)) db.createObjectStore(LICENSES_STORE);
            if (!db.objectStoreNames.contains(BINDINGS_STORE)) db.createObjectStore(BINDINGS_STORE);
            if (!db.objectStoreNames.contains(PUBLIC_STORE)) db.createObjectStore(PUBLIC_STORE);
            if (!db.objectStoreNames.contains(CHECKOUT_STORE)) db.createObjectStore(CHECKOUT_STORE);
        },
    });
}

type StoredPendingCheckoutV1 = {
    version: 1;
    provider: BillingLifecycle['provider'];
    generation: number;
    sessionIdFingerprint: string;
    attemptId: string;
    createdAt: number;
};

function isPendingCheckout(value: unknown): value is StoredPendingCheckoutV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Partial<StoredPendingCheckoutV1>;
    return record.version === 1
        && (record.provider === 'google-drive' || record.provider === 'dropbox')
        && Number.isSafeInteger(record.generation)
        && typeof record.sessionIdFingerprint === 'string'
        && /^[a-f0-9]{64}$/.test(record.sessionIdFingerprint)
        && typeof record.attemptId === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.attemptId)
        && Number.isFinite(record.createdAt);
}

export async function writePendingBillingCheckout(input: {
    lifecycle: BillingLifecycle;
    attemptId: string;
    createdAt?: number;
}): Promise<void> {
    if (!isLifecycle(input.lifecycle)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.attemptId)) {
        throw new Error('INVALID_BILLING_CHECKOUT_ATTEMPT');
    }
    const record: StoredPendingCheckoutV1 = {
        version: 1,
        provider: input.lifecycle.provider,
        generation: input.lifecycle.generation,
        sessionIdFingerprint: await createBillingSessionFingerprint(input.lifecycle.sessionId),
        attemptId: input.attemptId,
        createdAt: input.createdAt ?? Date.now(),
    };
    const db = await getDb();
    await db.transaction(CHECKOUT_STORE, 'readwrite').store.put(record, ACTIVE_CHECKOUT_KEY);
}

export async function readPendingBillingCheckout(
    lifecycle: BillingLifecycle,
): Promise<{ attemptId: string; createdAt: number } | null> {
    if (!isLifecycle(lifecycle)) return null;
    try {
        const db = await getDb();
        const value: unknown = await db.transaction(CHECKOUT_STORE).store.get(ACTIVE_CHECKOUT_KEY);
        if (!isPendingCheckout(value)
            || value.provider !== lifecycle.provider
            || value.generation !== lifecycle.generation
            || value.sessionIdFingerprint !== await createBillingSessionFingerprint(lifecycle.sessionId)) return null;
        return { attemptId: value.attemptId, createdAt: value.createdAt };
    } catch {
        return null;
    }
}

export async function clearPendingBillingCheckout(): Promise<void> {
    try {
        const db = await getDb();
        await db.transaction(CHECKOUT_STORE, 'readwrite').store.delete(ACTIVE_CHECKOUT_KEY);
    } catch {
        // Recovery metadata cleanup must not block canonical billing refresh.
    }
}

function isLifecycle(value: BillingLifecycle): boolean {
    return (value.provider === 'google-drive' || value.provider === 'dropbox')
        && Number.isSafeInteger(value.generation)
        && value.generation >= 0
        && typeof value.sessionId === 'string'
        && value.sessionId.length >= 1
        && value.sessionId.length <= 4096;
}

function isStoredBinding(value: unknown): value is StoredBillingBindingV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Partial<StoredBillingBindingV1>;
    return record.version === 1
        && (record.provider === 'google-drive' || record.provider === 'dropbox')
        && Number.isSafeInteger(record.generation)
        && typeof record.sessionIdFingerprint === 'string'
        && /^[a-f0-9]{64}$/.test(record.sessionIdFingerprint)
        && typeof record.subject === 'string'
        && typeof record.licenseJti === 'string'
        && Number.isFinite(record.verifiedAt)
        && Number.isFinite(record.verifiedServerTime)
        && Number.isFinite(record.verifiedWallTime)
        && Number.isFinite(record.lastObservedWallTime)
        && Number.isFinite(record.maxTrustedTime);
}

function isStoredLicense(value: unknown): value is StoredBillingLicenseV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Partial<StoredBillingLicenseV1>;
    return record.version === 1
        && typeof record.subject === 'string'
        && typeof record.licenseJti === 'string'
        && typeof record.token === 'string'
        && typeof record.keyId === 'string'
        && Number.isFinite(record.storedAt)
        && Boolean(record.payload)
        && record.payload?.subject === record.subject
        && record.payload?.jti === record.licenseJti;
}

export async function createBillingSessionFingerprint(sessionId: string): Promise<string> {
    if (!sessionId || sessionId.length > 4096) throw new Error('INVALID_BILLING_LIFECYCLE');
    const digest = await crypto.subtle.digest(
        'SHA-256',
        fingerprintEncoder.encode(`tasktime-billing-session-fingerprint:v1:${sessionId}`),
    );
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function pruneLicenses(store: {
    getAll(): Promise<unknown[]>;
    delete(key: string): Promise<unknown>;
}, keepSubject: string): Promise<void> {
    const records = (await store.getAll()).filter(isStoredLicense)
        .sort((left, right) => right.storedAt - left.storedAt);
    for (const record of records.slice(MAX_SUBJECT_RECORDS)) {
        if (record.subject !== keepSubject) await store.delete(record.subject);
    }
}

export async function writeVerifiedBillingCache(input: {
    lifecycle: BillingLifecycle;
    subject: string;
    token: string;
    payload: BillingLicensePayloadV1;
    keyId: string;
    serverTime: number;
    wallTime: number;
    authoritativeOnlineRebase?: boolean;
}): Promise<void> {
    if (!isLifecycle(input.lifecycle)
        || input.subject !== input.payload.subject
        || input.payload.jti.length < 1
        || input.token.length < 1
        || !Number.isFinite(input.serverTime)
        || !Number.isFinite(input.wallTime)) {
        throw new Error('INVALID_BILLING_CACHE_WRITE');
    }
    const sessionIdFingerprint = await createBillingSessionFingerprint(input.lifecycle.sessionId);
    const db = await getDb();
    const transaction = db.transaction([LICENSES_STORE, BINDINGS_STORE], 'readwrite');
    const licenses = transaction.objectStore(LICENSES_STORE);
    const bindings = transaction.objectStore(BINDINGS_STORE);
    const previous: unknown = await bindings.get(ACTIVE_BINDING_KEY);
    const sameLifecycle = isStoredBinding(previous)
        && previous.provider === input.lifecycle.provider
        && previous.generation === input.lifecycle.generation
        && previous.sessionIdFingerprint === sessionIdFingerprint;
    const priorMaximum = sameLifecycle && !input.authoritativeOnlineRebase
        ? previous.maxTrustedTime
        : input.serverTime;
    const license: StoredBillingLicenseV1 = {
        version: 1,
        subject: input.subject,
        licenseJti: input.payload.jti,
        token: input.token,
        payload: input.payload,
        keyId: input.keyId,
        storedAt: input.wallTime,
    };
    const binding: StoredBillingBindingV1 = {
        version: 1,
        provider: input.lifecycle.provider,
        generation: input.lifecycle.generation,
        sessionIdFingerprint,
        subject: input.subject,
        licenseJti: input.payload.jti,
        verifiedAt: input.wallTime,
        verifiedServerTime: input.serverTime,
        verifiedWallTime: input.wallTime,
        lastObservedWallTime: input.wallTime,
        maxTrustedTime: Math.max(input.serverTime, priorMaximum),
    };
    await licenses.put(license, input.subject);
    await bindings.put(binding, ACTIVE_BINDING_KEY);
    await pruneLicenses(licenses, input.subject);
    await transaction.done;
}

export async function readBoundBillingCache(
    lifecycle: BillingLifecycle,
    wallTime = Date.now(),
): Promise<BillingCacheReadResult> {
    if (!isLifecycle(lifecycle) || !Number.isFinite(wallTime)) return { kind: 'missing' };
    try {
        const sessionIdFingerprint = await createBillingSessionFingerprint(lifecycle.sessionId);
        const db = await getDb();
        const transaction = db.transaction([LICENSES_STORE, BINDINGS_STORE], 'readwrite');
        const licenses = transaction.objectStore(LICENSES_STORE);
        const bindings = transaction.objectStore(BINDINGS_STORE);
        const storedBinding: unknown = await bindings.get(ACTIVE_BINDING_KEY);
        if (!isStoredBinding(storedBinding)
            || storedBinding.provider !== lifecycle.provider
            || storedBinding.generation !== lifecycle.generation
            || storedBinding.sessionIdFingerprint !== sessionIdFingerprint) {
            await transaction.done;
            return { kind: 'missing' };
        }
        if (wallTime + CLOCK_ROLLBACK_TOLERANCE_MS < storedBinding.lastObservedWallTime) {
            await transaction.done;
            return { kind: 'clock_untrusted' };
        }
        const storedLicense: unknown = await licenses.get(storedBinding.subject);
        if (!isStoredLicense(storedLicense)
            || storedLicense.licenseJti !== storedBinding.licenseJti) {
            await bindings.delete(ACTIVE_BINDING_KEY);
            await transaction.done;
            return { kind: 'missing' };
        }
        const elapsedWallTime = Math.max(0, wallTime - storedBinding.verifiedWallTime);
        const trustedTime = Math.max(
            storedBinding.maxTrustedTime,
            storedBinding.verifiedServerTime + elapsedWallTime,
        );
        const binding = {
            ...storedBinding,
            lastObservedWallTime: Math.max(storedBinding.lastObservedWallTime, wallTime),
            maxTrustedTime: trustedTime,
        };
        await bindings.put(binding, ACTIVE_BINDING_KEY);
        await transaction.done;
        return { kind: 'hit', license: storedLicense, binding, trustedTime };
    } catch {
        return { kind: 'missing' };
    }
}

export async function clearActiveBillingBinding(): Promise<void> {
    try {
        const db = await getDb();
        await db.transaction(BINDINGS_STORE, 'readwrite').store.delete(ACTIVE_BINDING_KEY);
    } catch {
        // Cache cleanup must remain fail-safe and never block provider sign-out.
    }
}

export async function writeCachedBillingJwks(input: StoredJwksV1): Promise<void> {
    const db = await getDb();
    await db.transaction(PUBLIC_STORE, 'readwrite').store.put(input, 'jwks-v1');
}

export async function readCachedBillingJwks(nowMs = Date.now()): Promise<StoredJwksV1 | null> {
    try {
        const db = await getDb();
        const value: unknown = await db.transaction(PUBLIC_STORE).store.get('jwks-v1');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const record = value as Partial<StoredJwksV1>;
        if (record.version !== 1
            || !Array.isArray(record.keys)
            || record.keys.length < 1
            || record.keys.length > 4
            || !Number.isFinite(record.expiresAt)
            || Number(record.expiresAt) <= nowMs) return null;
        return record as StoredJwksV1;
    } catch {
        return null;
    }
}
