import { describe, expect, it } from 'vitest';
import {
    LICENSE_AUDIENCE,
    parseBillingJwks,
    verifyBillingLicense,
    type BillingPublicJwk,
} from './billingLicense';

const encoder = new TextEncoder();

function encode(value: unknown): string {
    const bytes = encoder.encode(JSON.stringify(value));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function fixture(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
    );
    const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const key: BillingPublicJwk = {
        kty: 'EC',
        crv: 'P-256',
        x: exported.x!,
        y: exported.y!,
        kid: 'test-key',
        alg: 'ES256',
        use: 'sig',
    };
    const nowSeconds = 1_787_140_800;
    const payload = {
        version: 1,
        entitlementRevision: 4,
        planConfigVersion: 'test-catalog-1',
        subject: 'principal-1',
        plan: 'pro',
        accessStatus: 'trial',
        billingStatus: 'none',
        source: 'trial',
        trialStatus: 'active',
        trialStartedAt: '2026-08-19T12:00:00.000Z',
        trialEndsAt: '2026-09-18T12:00:00.000Z',
        sourceExpiresAt: null,
        entitlements: ['reports.access', 'invoice.email.send'],
        limits: {
            invoiceEmailSendsPerMonth: 100,
            cloudSync: true,
            automaticCloudBackups: true,
            webPush: true,
            activeProjects: null,
            activeClients: null,
            activeTasks: null,
        },
        subscriptionCurrentPeriodStart: null,
        subscriptionCurrentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
        sourceUpdatedAt: '2026-08-19T12:00:00.000Z',
        lastReconciledAt: null,
        ver: 1,
        iss: 'https://sync.tasktime.pro',
        aud: LICENSE_AUDIENCE,
        sub: 'principal-1',
        iat: nowSeconds,
        nbf: nowSeconds - 300,
        exp: nowSeconds + 86_400,
        jti: 'license-1',
        ...overrides,
    };
    const header = { alg: 'ES256', kid: 'test-key', typ: 'TTPL+JWT', ...headerOverrides };
    const protectedSegment = encode(header);
    const payloadSegment = encode(payload);
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        encoder.encode(`${protectedSegment}.${payloadSegment}`),
    );
    let binary = '';
    for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
    const signatureSegment = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return { token: `${protectedSegment}.${payloadSegment}.${signatureSegment}`, key, nowSeconds };
}

describe('verifyBillingLicense', () => {
    it('accepts only a bounded, unique ES256 public-key set', async () => {
        const { key } = await fixture();
        expect(parseBillingJwks({ keys: [key] })).toEqual([key]);
        expect(() => parseBillingJwks({ keys: [key, key] })).toThrow('INVALID_BILLING_JWKS');
        expect(() => parseBillingJwks({ keys: [{ ...key, future: true }] }))
            .toThrow('INVALID_BILLING_JWKS');
    });

    it('accepts the stable logical audience independently of either app origin', async () => {
        const { token, key, nowSeconds } = await fixture();
        for (const browserOrigin of ['https://tasktime.pro', 'https://app.tasktime.pro']) {
            const result = await verifyBillingLicense(token, {
                keys: [key],
                expectedSubject: 'principal-1',
                expectedIssuer: 'https://sync.tasktime.pro',
                nowMs: nowSeconds * 1000,
                browserOrigin,
            });
            expect(result.ok).toBe(true);
        }
    });

    it('rejects another subject, a source cap violation, and malicious JOSE headers', async () => {
        const subject = await fixture({ sub: 'principal-2', subject: 'principal-2' });
        expect((await verifyBillingLicense(subject.token, {
            keys: [subject.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: subject.nowSeconds * 1000,
        })).code).toBe('SUBJECT_MISMATCH');

        const capped = await fixture({ exp: 1_790_000_000 });
        expect((await verifyBillingLicense(capped.token, {
            keys: [capped.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: capped.nowSeconds * 1000,
        })).code).toBe('INVALID_CLAIMS');

        const malicious = await fixture({}, { jku: 'https://attacker.example/jwks' });
        expect((await verifyBillingLicense(malicious.token, {
            keys: [malicious.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: malicious.nowSeconds * 1000,
        })).code).toBe('INVALID_HEADER');
    });

    it('ignores additive fields and unknown entitlement names without granting them', async () => {
        const additive = await fixture({
            futureProjection: { version: 1 },
            entitlements: ['reports.access', 'invoice.email.send', 'future.unknown'],
            limits: {
                invoiceEmailSendsPerMonth: 100,
                cloudSync: true,
                automaticCloudBackups: true,
                webPush: true,
                activeProjects: null,
                activeClients: null,
                activeTasks: null,
                futureLimit: 3,
            },
        });
        const result = await verifyBillingLicense(additive.token, {
            keys: [additive.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: additive.nowSeconds * 1000,
        });
        expect(result).toMatchObject({
            ok: true,
            payload: { entitlements: ['reports.access', 'invoice.email.send'] },
        });
    });

    it('rejects assertions longer than seven days', async () => {

        const long = await fixture({ exp: 1_787_140_800 + (8 * 86_400) });
        expect((await verifyBillingLicense(long.token, {
            keys: [long.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: long.nowSeconds * 1000,
        })).code).toBe('INVALID_CLAIMS');
    });

    it('fails closed for malformed, unknown-key, invalid-signature, issuer, and expired assertions', async () => {
        expect((await verifyBillingLicense('short', {
            keys: [], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: 0,
        })).code).toBe('INVALID_FORMAT');

        const signed = await fixture();
        expect((await verifyBillingLicense(signed.token, {
            keys: [], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: signed.nowSeconds * 1000,
        })).code).toBe('UNKNOWN_KEY');

        expect((await verifyBillingLicense(`${signed.token.split('.').slice(0, 2).join('.')}.A`, {
            keys: [signed.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: signed.nowSeconds * 1000,
        })).code).toBe('INVALID_SIGNATURE');

        expect((await verifyBillingLicense(signed.token, {
            keys: [signed.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://billing.example', nowMs: signed.nowSeconds * 1000,
        })).code).toBe('INVALID_CLAIMS');

        expect((await verifyBillingLicense(signed.token, {
            keys: [signed.key], expectedSubject: 'principal-1',
            expectedIssuer: 'https://sync.tasktime.pro', nowMs: (signed.nowSeconds + 86_400) * 1000,
        })).code).toBe('EXPIRED');
    });
});
