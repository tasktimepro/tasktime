import { describe, expect, it } from 'vitest';

import { evaluateActiveClientTransition } from './activeClientPolicy';

const FREE = {
    kind: 'canonical' as const,
    accessStatus: 'free' as const,
    activeClientLimit: 1 as const,
};

describe('active-client transition policy', () => {
    const clients = [
        { id: 'active', title: 'Active' },
        { id: 'archived', title: 'Archived', archived: true },
    ];

    it('counts missing archived as active and blocks only a net increase at the limit', () => {
        expect(evaluateActiveClientTransition({ clients, entitlement: FREE, transition: 'create' }))
            .toMatchObject({ allowed: false, code: 'ENTITLEMENT_REQUIRED', activeCount: 1, limit: 1 });
        expect(evaluateActiveClientTransition({
            clients,
            entitlement: FREE,
            transition: 'update',
            existingClientId: 'active',
            nextArchived: false,
        })).toEqual({ allowed: true, reason: 'no_net_increase' });
        expect(evaluateActiveClientTransition({
            clients,
            entitlement: FREE,
            transition: 'update',
            existingClientId: 'active',
            nextArchived: true,
        })).toEqual({ allowed: true, reason: 'no_net_increase' });
    });

    it('preserves imported/downgraded over-limit data and allows archive/delete/edit', () => {
        const overLimit = [...clients, { id: 'second', title: 'Second', archived: false }];
        expect(evaluateActiveClientTransition({
            clients: overLimit,
            entitlement: FREE,
            transition: 'update',
            existingClientId: 'second',
            nextArchived: false,
        })).toEqual({ allowed: true, reason: 'no_net_increase' });
        expect(evaluateActiveClientTransition({ clients: overLimit, entitlement: FREE, transition: 'create' }))
            .toMatchObject({ allowed: false, activeCount: 2 });
    });

    it('allows the universally Free first slot while entitlement is unresolved', () => {
        expect(evaluateActiveClientTransition({
            clients: [],
            entitlement: { kind: 'unresolved', reason: 'network' },
            transition: 'create',
        })).toEqual({ allowed: true, reason: 'under_limit' });
    });

    it('returns recovery—not purchase—for an unresolved net increase beyond the Free slot', () => {
        expect(evaluateActiveClientTransition({
            clients,
            entitlement: { kind: 'unresolved', reason: 'network' },
            transition: 'create',
        })).toEqual({
            allowed: false,
            code: 'ENTITLEMENT_STATUS_UNAVAILABLE',
            feature: 'activeClients',
            recovery: 'retry_or_reconnect',
        });
    });
});
