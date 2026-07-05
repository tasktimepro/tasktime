import { describe, expect, it } from 'vitest';
import type { AgentPermissionScope } from '@/agent/types';
import type { AgentAppSessionApprovalVerificationRequest } from '@/agent/transport/protocol';
import { createAgentCommandInputHash } from '@/agent/transport/protocol';
import {
    AGENT_APPROVAL_TOKEN_FORMAT,
    createAgentBridgeApprovalGrant,
    createAgentBridgeApprovalSignature,
    verifyAgentBridgeApprovalToken,
    type AgentBridgeApprovalGrant,
    type AgentBridgeApprovalGrantStore,
    type AgentBridgeApprovalNonceRecord,
    type AgentBridgeApprovalSignaturePayload,
} from './approvalTokens';

const NOW = 1_700_000_000_000;
const SECRET_KEY_BASE64_URL = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const DEFAULT_SCOPES: AgentPermissionScope[] = ['read', 'write', 'billing'];

class MemoryApprovalGrantStore implements AgentBridgeApprovalGrantStore {

    readonly grants = new Map<string, AgentBridgeApprovalGrant>();
    readonly nonces = new Map<string, AgentBridgeApprovalNonceRecord>();

    constructor(grants: AgentBridgeApprovalGrant[] = []) {
        for (const grant of grants) {
            this.grants.set(grant.id, grant);
        }
    }

    async getGrant(grantId: string): Promise<AgentBridgeApprovalGrant | null> {
        return this.grants.get(grantId) ?? null;
    }

    async consumeNonce(record: AgentBridgeApprovalNonceRecord): Promise<boolean> {
        if (this.nonces.has(record.key)) {
            return false;
        }

        this.nonces.set(record.key, record);
        return true;
    }

    async pruneExpiredNonces(now: number): Promise<void> {
        for (const [key, record] of this.nonces) {
            if (record.expiresAt <= now) {
                this.nonces.delete(key);
            }
        }
    }
}

function createGrant(overrides: Partial<AgentBridgeApprovalGrant> = {}): AgentBridgeApprovalGrant {
    return {
        id: 'grant-1',
        clientId: 'openclaw-local',
        label: 'OpenClaw local agent',
        scopes: DEFAULT_SCOPES,
        secretKeyBase64Url: SECRET_KEY_BASE64_URL,
        createdAt: NOW - 60_000,
        expiresAt: null,
        revokedAt: null,
        ...overrides,
    };
}

async function createSignedApprovalRequest(options: {
    requestId?: string;
    command?: string;
    input?: unknown;
    inputHash?: string;
    category?: string;
    scopes?: AgentPermissionScope[];
    grantId?: string;
    nonce?: string;
    issuedAt?: number;
    expiresAt?: number;
    secretKeyBase64Url?: string;
    payloadOverrides?: Partial<AgentBridgeApprovalSignaturePayload>;
    approvalOverrides?: Partial<AgentAppSessionApprovalVerificationRequest['approval']>;
} = {}): Promise<{
    grant: AgentBridgeApprovalGrant;
    payload: AgentBridgeApprovalSignaturePayload;
    request: AgentAppSessionApprovalVerificationRequest;
}> {
    const command = options.command ?? 'finalize_invoice';
    const inputHash = options.inputHash ?? await createAgentCommandInputHash(options.input ?? {
        invoiceId: 'invoice-1',
        confirmFinalize: true,
    });
    const scopes = options.scopes ?? DEFAULT_SCOPES;
    const category = options.category ?? 'billing';
    const secretKeyBase64Url = options.secretKeyBase64Url ?? SECRET_KEY_BASE64_URL;
    const payload: AgentBridgeApprovalSignaturePayload = {
        format: AGENT_APPROVAL_TOKEN_FORMAT,
        grantId: options.grantId ?? 'grant-1',
        command,
        inputHash,
        category,
        scopes,
        nonce: options.nonce ?? 'nonce-1',
        issuedAt: options.issuedAt ?? NOW,
        expiresAt: options.expiresAt ?? NOW + 60_000,
        ...options.payloadOverrides,
    };
    const token = await createAgentBridgeApprovalSignature(payload, secretKeyBase64Url);

    return {
        grant: createGrant({
            id: payload.grantId,
            scopes,
            secretKeyBase64Url,
        }),
        payload,
        request: {
            requestId: options.requestId ?? 'approval-request-1',
            command,
            inputHash,
            category,
            scopes,
            approval: {
                format: payload.format,
                grantId: payload.grantId,
                token,
                issuedAt: payload.issuedAt,
                expiresAt: payload.expiresAt,
                nonce: payload.nonce,
                command: payload.command,
                inputHash: payload.inputHash,
                scopes: payload.scopes,
                category: payload.category,
                ...options.approvalOverrides,
            },
        },
    };
}

describe('agent bridge approval tokens', () => {
    it('creates normalized approval grants for trusted local clients', () => {
        expect(createAgentBridgeApprovalGrant({
            id: 'grant-created',
            clientId: 'openclaw-local',
            label: 'OpenClaw',
            scopes: ['billing', 'read', 'billing', 'write'],
            secretKeyBase64Url: SECRET_KEY_BASE64_URL,
            now: () => NOW,
            expiresAt: NOW + 86_400_000,
        })).toEqual({
            id: 'grant-created',
            clientId: 'openclaw-local',
            label: 'OpenClaw',
            scopes: ['billing', 'read', 'write'],
            secretKeyBase64Url: SECRET_KEY_BASE64_URL,
            createdAt: NOW,
            expiresAt: NOW + 86_400_000,
            revokedAt: null,
        });
    });

    it('accepts a valid stored grant token once and rejects replay', async () => {
        const { grant, request } = await createSignedApprovalRequest({ nonce: 'valid-once' });
        const store = new MemoryApprovalGrantStore([grant]);

        await expect(verifyAgentBridgeApprovalToken(request, {
            store,
            now: () => NOW,
        })).resolves.toBe(true);

        expect(store.nonces.get('grant-1:valid-once')).toEqual(expect.objectContaining({
            grantId: 'grant-1',
            nonce: 'valid-once',
            command: 'finalize_invoice',
            usedAt: NOW,
        }));

        await expect(verifyAgentBridgeApprovalToken(request, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);
    });

    it('rejects tokens when signed request fields no longer match', async () => {
        const { grant, request } = await createSignedApprovalRequest({ nonce: 'request-binding' });
        const store = new MemoryApprovalGrantStore([grant]);

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            inputHash: 'sha256:changed',
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            command: 'send_invoice_email',
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            category: 'email',
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            scopes: ['read', 'write', 'billing', 'export'],
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        expect(store.nonces.size).toBe(0);
    });

    it('rejects tampered signatures', async () => {
        const { grant, request } = await createSignedApprovalRequest({ nonce: 'tampered-signature' });
        const store = new MemoryApprovalGrantStore([grant]);
        const token = request.approval.token;
        const tamperedToken = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            approval: {
                ...request.approval,
                token: tamperedToken,
            },
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        expect(store.nonces.size).toBe(0);
    });

    it('rejects malformed signature tokens without consuming a nonce', async () => {
        const { grant, request } = await createSignedApprovalRequest({ nonce: 'malformed-signature' });
        const store = new MemoryApprovalGrantStore([grant]);

        await expect(verifyAgentBridgeApprovalToken({
            ...request,
            approval: {
                ...request.approval,
                token: 'not valid base64url',
            },
        }, {
            store,
            now: () => NOW,
        })).resolves.toBe(false);

        expect(store.nonces.size).toBe(0);
    });

    it('rejects missing, revoked, expired, and under-scoped grants', async () => {
        const { grant, request } = await createSignedApprovalRequest({ nonce: 'grant-boundary' });
        const invalidGrantStores = [
            new MemoryApprovalGrantStore(),
            new MemoryApprovalGrantStore([{ ...grant, revokedAt: NOW - 1 }]),
            new MemoryApprovalGrantStore([{ ...grant, expiresAt: NOW - 1 }]),
            new MemoryApprovalGrantStore([{ ...grant, scopes: ['read', 'write'] }]),
        ];

        for (const store of invalidGrantStores) {
            await expect(verifyAgentBridgeApprovalToken(request, {
                store,
                now: () => NOW,
            })).resolves.toBe(false);

            expect(store.nonces.size).toBe(0);
        }
    });

    it('rejects stale, future-dated, and too-long-lived tokens', async () => {
        const invalidRequests = [
            await createSignedApprovalRequest({
                nonce: 'expired-token',
                issuedAt: NOW - 1_000,
                expiresAt: NOW - 1,
            }),
            await createSignedApprovalRequest({
                nonce: 'future-token',
                issuedAt: NOW + 60_001,
                expiresAt: NOW + 120_000,
            }),
            await createSignedApprovalRequest({
                nonce: 'oversized-ttl-token',
                issuedAt: NOW,
                expiresAt: NOW + 300_001,
            }),
        ];

        for (const { grant, request } of invalidRequests) {
            const store = new MemoryApprovalGrantStore([grant]);

            await expect(verifyAgentBridgeApprovalToken(request, {
                store,
                now: () => NOW,
            })).resolves.toBe(false);

            expect(store.nonces.size).toBe(0);
        }
    });
});
