import { describe, expect, it, vi } from 'vitest';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
import {
    ActiveClientPolicyError,
    assertActiveClientApplication,
    runActiveClientApplication,
} from './activeClientApplication';

const free: EntitlementResolution = {
    kind: 'canonical',
    snapshot: {
        accessStatus: 'free',
        limits: { activeClients: 1 },
    } as never,
};

describe('activeClientApplication', () => {
    it('re-reads inside the application boundary and blocks only a net increase', async () => {
        const commit = vi.fn();
        await expect(runActiveClientApplication({
            enforcementEnabled: true,
            readClients: () => [{ id: 'client-1', archived: false }],
            resolution: free,
            transition: 'create',
            commit,
        })).rejects.toBeInstanceOf(ActiveClientPolicyError);
        expect(commit).not.toHaveBeenCalled();

        expect(assertActiveClientApplication({
            enforcementEnabled: true,
            clients: [{ id: 'client-1', archived: false }],
            resolution: free,
            transition: 'update',
            existingClientId: 'client-1',
            nextArchived: true,
        })).toEqual({ allowed: true, reason: 'no_net_increase' });
    });

    it('keeps all behavior unchanged while enforcement is dark', async () => {
        const commit = vi.fn(() => 'created');
        await expect(runActiveClientApplication({
            enforcementEnabled: false,
            readClients: () => [{ id: 'client-1', archived: false }],
            resolution: { kind: 'unresolved', reason: 'network' },
            transition: 'create',
            commit,
        })).resolves.toBe('created');
    });
});
