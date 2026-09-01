import {
    parseEntitlementSnapshot,
} from '@/domain/entitlements/entitlementPolicy';
import type { EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';

export const LICENSE_AUDIENCE = 'urn:tasktime:pro:web' as const;
export const LICENSE_MAX_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const LICENSE_CLOCK_SKEW_SECONDS = 300;

const MAX_TOKEN_BYTES = 131_072;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

export type BillingPublicJwk = {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
    kid: string;
    alg: 'ES256';
    use: 'sig';
};

export type BillingLicensePayloadV1 = EntitlementSnapshotV1 & {
    ver: 1;
    iss: string;
    aud: typeof LICENSE_AUDIENCE;
    sub: string;
    iat: number;
    nbf: number;
    exp: number;
    jti: string;
};

export type BillingLicenseVerification =
    | { ok: true; payload: BillingLicensePayloadV1; keyId: string }
    | { ok: false; code: 'INVALID_FORMAT' | 'INVALID_HEADER' | 'UNKNOWN_KEY' | 'INVALID_SIGNATURE' | 'INVALID_CLAIMS' | 'SUBJECT_MISMATCH' | 'EXPIRED' };

const ENTITLEMENT_KEYS = [
    'accessStatus',
    'billingStatus',
    'cancelAtPeriodEnd',
    'entitlementRevision',
    'entitlements',
    'graceUntil',
    'lastReconciledAt',
    'limits',
    'plan',
    'planConfigVersion',
    'source',
    'sourceExpiresAt',
    'sourceUpdatedAt',
    'subject',
    'subscriptionCurrentPeriodEnd',
    'subscriptionCurrentPeriodStart',
    'trialEndsAt',
    'trialStartedAt',
    'trialStatus',
    'version',
] as const;

const LICENSE_KEYS = [
    ...ENTITLEMENT_KEYS,
    'aud',
    'exp',
    'iat',
    'iss',
    'jti',
    'nbf',
    'sub',
    'ver',
].sort();

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    const sortedExpected = [...expected].sort();
    return actual.length === sortedExpected.length
        && actual.every((key, index) => key === sortedExpected[index]);
}

function requiredKeysWithBoundedAdditions(
    value: Record<string, unknown>,
    required: readonly string[],
): boolean {
    const actual = Object.keys(value);
    if (actual.length > 64 || required.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
        return false;
    }
    const requiredSet = new Set(required);
    return actual.every(key => requiredSet.has(key) || /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key));
}

function decodeBase64Url(value: string, maximum = MAX_TOKEN_BYTES): Uint8Array | null {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > maximum) return null;
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (value.length % 4)) % 4);
    try {
        const binary = atob(padded);
        const decoded = Uint8Array.from(binary, character => character.charCodeAt(0));
        let encoded = '';
        for (const byte of decoded) encoded += String.fromCharCode(byte);
        const canonical = btoa(encoded).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        return canonical === value ? decoded : null;
    } catch {
        return null;
    }
}

function parseCanonicalJson(value: string): unknown {
    const decoded = decodeBase64Url(value);
    if (!decoded) throw new Error('INVALID_BASE64URL');
    const json = decoder.decode(decoded);
    const parsed: unknown = JSON.parse(json);
    // Worker assertions use compact canonical JSON. This also rejects duplicate
    // object members because JSON.parse would otherwise silently keep the last.
    if (JSON.stringify(parsed) !== json) throw new Error('NON_CANONICAL_JSON');
    return parsed;
}

function validPrintableAscii(value: unknown, maximum: number): value is string {
    return typeof value === 'string'
        && value.length >= 1
        && value.length <= maximum
        && /^[\x20-\x7E]+$/.test(value);
}

function validCoordinate(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const bytes = decodeBase64Url(value, 64);
    return bytes?.byteLength === 32;
}

function validPublicKey(value: unknown): value is BillingPublicJwk {
    if (!isRecord(value)
        || !exactKeys(value, ['kty', 'crv', 'x', 'y', 'kid', 'alg', 'use'])) return false;
    return value.kty === 'EC'
        && value.crv === 'P-256'
        && validCoordinate(value.x)
        && validCoordinate(value.y)
        && validPrintableAscii(value.kid, 64)
        && value.alg === 'ES256'
        && value.use === 'sig';
}

export function parseBillingJwks(value: unknown): BillingPublicJwk[] {
    if (!isRecord(value)
        || !exactKeys(value, ['keys'])
        || !Array.isArray(value.keys)
        || value.keys.length < 1
        || value.keys.length > 4
        || value.keys.some(key => !validPublicKey(key))) {
        throw new Error('INVALID_BILLING_JWKS');
    }
    const keys = value.keys as BillingPublicJwk[];
    if (new Set(keys.map(key => key.kid)).size !== keys.length) {
        throw new Error('INVALID_BILLING_JWKS');
    }
    return keys;
}

function sourceCapSeconds(payload: BillingLicensePayloadV1): number | null {
    let cap: string | null = null;
    if (payload.source === 'trial') cap = payload.trialEndsAt;
    if (payload.source === 'subscription' && payload.accessStatus === 'active') {
        cap = payload.subscriptionCurrentPeriodEnd;
    }
    if (payload.source === 'subscription' && payload.accessStatus === 'grace') {
        cap = payload.graceUntil;
    }
    if (payload.source === 'grant') cap = payload.sourceExpiresAt;
    if (!cap) return null;
    const parsed = Date.parse(cap);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function parseClaims(value: unknown): BillingLicensePayloadV1 | null {
    if (!isRecord(value) || !requiredKeysWithBoundedAdditions(value, LICENSE_KEYS)) return null;
    if (value.ver !== 1
        || !validPrintableAscii(value.iss, 255)
        || value.aud !== LICENSE_AUDIENCE
        || !validPrintableAscii(value.sub, 255)
        || !validPrintableAscii(value.jti, 128)
        || !Number.isSafeInteger(value.iat)
        || !Number.isSafeInteger(value.nbf)
        || !Number.isSafeInteger(value.exp)) return null;
    const iat = Number(value.iat);
    const nbf = Number(value.nbf);
    const exp = Number(value.exp);
    if (iat < 0
        || nbf < 0
        || exp <= iat
        || nbf > iat
        || iat - nbf > LICENSE_CLOCK_SKEW_SECONDS
        || exp - iat > LICENSE_MAX_LIFETIME_SECONDS) return null;
    const entitlementInput = Object.fromEntries(
        ENTITLEMENT_KEYS.map(key => [key, value[key]]),
    );
    let snapshot: EntitlementSnapshotV1;
    try {
        snapshot = parseEntitlementSnapshot(entitlementInput);
    } catch {
        return null;
    }
    if (value.sub !== snapshot.subject) return null;
    const payload = { ...value, ...snapshot } as BillingLicensePayloadV1;
    const cap = sourceCapSeconds(payload);
    if (cap !== null && exp > cap) return null;
    return payload;
}

export async function verifyBillingLicense(token: string, options: {
    keys: BillingPublicJwk[];
    expectedSubject: string;
    expectedIssuer: string;
    nowMs: number;
    browserOrigin?: string;
}): Promise<BillingLicenseVerification> {
    // Origin is deliberately not part of license verification. The Worker CORS
    // allowlist independently authorizes browser origins.
    void options.browserOrigin;
    if (typeof token !== 'string' || token.length < 16 || token.length > MAX_TOKEN_BYTES) {
        return { ok: false, code: 'INVALID_FORMAT' };
    }
    const segments = token.split('.');
    if (segments.length !== 3) return { ok: false, code: 'INVALID_FORMAT' };
    let header: unknown;
    let claims: unknown;
    try {
        header = parseCanonicalJson(segments[0]);
        claims = parseCanonicalJson(segments[1]);
    } catch {
        return { ok: false, code: 'INVALID_FORMAT' };
    }
    if (!isRecord(header)
        || !exactKeys(header, ['alg', 'kid', 'typ'])
        || header.alg !== 'ES256'
        || header.typ !== 'TTPL+JWT'
        || !validPrintableAscii(header.kid, 64)) {
        return { ok: false, code: 'INVALID_HEADER' };
    }
    const uniqueKeys = options.keys.length >= 1
        && options.keys.length <= 4
        && new Set(options.keys.map(key => key.kid)).size === options.keys.length;
    if (!uniqueKeys || options.keys.some(key => !validPublicKey(key))) {
        return { ok: false, code: 'UNKNOWN_KEY' };
    }
    const key = options.keys.find(candidate => candidate.kid === header.kid);
    if (!key) return { ok: false, code: 'UNKNOWN_KEY' };
    const signature = decodeBase64Url(segments[2], 128);
    if (!signature || signature.byteLength !== 64) {
        return { ok: false, code: 'INVALID_SIGNATURE' };
    }
    try {
        const imported = await crypto.subtle.importKey(
            'jwk',
            key,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify'],
        );
        const valid = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            imported,
            signature as unknown as BufferSource,
            encoder.encode(`${segments[0]}.${segments[1]}`),
        );
        if (!valid) return { ok: false, code: 'INVALID_SIGNATURE' };
    } catch {
        return { ok: false, code: 'INVALID_SIGNATURE' };
    }
    const payload = parseClaims(claims);
    if (!payload || payload.iss !== options.expectedIssuer) {
        return { ok: false, code: 'INVALID_CLAIMS' };
    }
    if (payload.sub !== options.expectedSubject) {
        return { ok: false, code: 'SUBJECT_MISMATCH' };
    }
    const nowSeconds = Math.floor(options.nowMs / 1000);
    const cap = sourceCapSeconds(payload);
    if (nowSeconds + LICENSE_CLOCK_SKEW_SECONDS < payload.nbf
        || nowSeconds >= payload.exp
        || (cap !== null && nowSeconds >= cap)) {
        return { ok: false, code: 'EXPIRED' };
    }
    return { ok: true, payload, keyId: key.kid };
}
