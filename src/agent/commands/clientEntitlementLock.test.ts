import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type { AgentCommandContext } from '@/agent/types';
import type { EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import { createClientCommand } from './clients';
import { handleAgentAppSessionRequest } from '@/agent/transport/protocol';

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: { clientLimitEnforcement: true },
}));

function freeSnapshot(): EntitlementSnapshotV1 {
    return {
        version: 1,
        entitlementRevision: 1,
        planConfigVersion: 'test-catalog-1',
        subject: 'principal-test',
        plan: 'free',
        accessStatus: 'free',
        billingStatus: 'none',
        source: 'free',
        trialStatus: 'eligible',
        trialStartedAt: null,
        trialEndsAt: null,
        sourceExpiresAt: null,
        entitlements: [],
        limits: {
            invoiceEmailSendsPerMonth: 0,
            cloudSync: true,
            automaticCloudBackups: true,
            webPush: true,
            activeProjects: null,
            activeClients: 1,
            activeTasks: null,
        },
        subscriptionCurrentPeriodStart: null,
        subscriptionCurrentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
        sourceUpdatedAt: '2026-08-30T00:00:00.000Z',
        lastReconciledAt: null,
    };
}

describe('agent active-client application lock', () => {
    beforeEach(() => {
        let sequence = Promise.resolve<unknown>(undefined);
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: {
                request: vi.fn((name, options, callback) => {
                    expect(name).toBe('tasktime-active-client-application-v1');
                    expect(options).toEqual({ mode: 'exclusive' });
                    const next = sequence.then(() => callback());
                    sequence = next.catch(() => undefined);
                    return next;
                }),
            },
        });
    });

    it('serializes concurrent Free creates so only one transition commits', async () => {
        const doc = new Y.Doc();
        let id = 0;
        const context = {
            store: { clients: doc.getMap('clients') },
            isReady: true,
            permissions: new Set(['write']),
            generateId: () => `client-${++id}`,
            now: () => Date.parse('2026-08-30T12:00:00.000Z'),
            entitlementResolution: { kind: 'canonical', snapshot: freeSnapshot() },
        } as unknown as AgentCommandContext;

        const results = await Promise.allSettled([
            createClientCommand(context, { title: 'First client' }),
            createClientCommand(context, { title: 'Second client' }),
        ]);

        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected')).toMatchObject({
            reason: { code: 'ENTITLEMENT_REQUIRED' },
        });
        expect(context.store.clients.size).toBe(1);
        expect(navigator.locks.request).toHaveBeenCalledTimes(2);
    });

    it('allows a fresh unresolved browser to create its universally Free first client', async () => {
        const doc = new Y.Doc();
        const context = {
            store: { clients: doc.getMap('clients') },
            isReady: true,
            permissions: new Set(['write']),
            generateId: () => 'client-1',
            now: () => Date.parse('2026-08-30T12:00:00.000Z'),
            entitlementResolution: { kind: 'unresolved', reason: 'lifecycle' },
        } as unknown as AgentCommandContext;

        await expect(createClientCommand(context, { title: 'First client' }))
            .resolves.toMatchObject({ id: 'client-1', title: 'First client' });
        expect(context.store.clients.size).toBe(1);

        await expect(createClientCommand(context, { title: 'Second client' }))
            .rejects.toMatchObject({ code: 'ENTITLEMENT_STATUS_UNAVAILABLE' });
    });

    it('rechecks plan authority after a queued agent command acquires the lock', async () => {
        const doc = new Y.Doc();
        const clients = doc.getMap('clients');
        const existing = new Y.Map();
        existing.set('id', 'client-1');
        existing.set('title', 'Existing');
        clients.set('client-1', existing);
        const context = {
            store: { clients }, isReady: true, permissions: new Set(['write']),
            entitlementResolution: { kind: 'canonical', snapshot: {
                ...freeSnapshot(), plan: 'pro', accessStatus: 'active',
            } },
        } as unknown as AgentCommandContext;
        const pending = createClientCommand(context, { title: 'Second' });
        context.entitlementResolution = { kind: 'unresolved', reason: 'lifecycle' };
        await expect(pending).rejects.toMatchObject({ code: 'ENTITLEMENT_STATUS_UNAVAILABLE' });
        expect(clients.size).toBe(1);
    });

    it('preserves live entitlement reads through app-session scope adaptation', async () => {
        const doc = new Y.Doc();
        const clients = doc.getMap('clients');
        clients.set('client-1', { id: 'client-1', title: 'Existing' });
        const context = {
            store: { clients }, isReady: true,
            entitlementResolution: { kind: 'canonical', snapshot: {
                ...freeSnapshot(), plan: 'pro', accessStatus: 'active',
            } },
        } as unknown as AgentCommandContext;
        let apply!: () => Promise<unknown>;
        vi.mocked(navigator.locks.request).mockImplementationOnce((_name, _options, callback) => (
            new Promise((resolve, reject) => {
                apply = () => Promise.resolve().then(() => callback({} as Lock)).then(resolve, reject);
            })
        ));
        const pending = handleAgentAppSessionRequest(context, {
            sessionToken: 'session-token', scopes: new Set(['read', 'write']),
        }, {
            protocolVersion: 1, requestId: 'queued-client', sessionToken: 'session-token',
            command: 'create_client', input: { title: 'Second' },
        });
        expect(apply).toBeTypeOf('function');
        context.entitlementResolution = { kind: 'unresolved', reason: 'lifecycle' };
        await apply();
        await expect(pending).resolves.toMatchObject({ response: {
            ok: false, error: { code: 'ENTITLEMENT_STATUS_UNAVAILABLE' },
        } });
        expect(clients.size).toBe(1);
    });
});
