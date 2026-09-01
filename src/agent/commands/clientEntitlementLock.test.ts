import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type { AgentCommandContext } from '@/agent/types';
import type { EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import { createClientCommand } from './clients';

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
});
