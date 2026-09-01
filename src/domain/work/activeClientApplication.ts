import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
import {
    evaluateActiveClientTransition,
    type ActiveClientDecision,
    type ActiveClientEntitlement,
} from '@/domain/entitlements/activeClientPolicy';

type ClientLike = { id: string; archived?: boolean };

export class ActiveClientPolicyError extends Error {
    constructor(readonly decision: Exclude<ActiveClientDecision, { allowed: true }>) {
        super(decision.code);
        this.name = 'ActiveClientPolicyError';
    }
}

export function activeClientEntitlementFromResolution(
    resolution: EntitlementResolution,
): ActiveClientEntitlement {
    if (resolution.kind === 'unresolved') return { kind: 'unresolved', reason: resolution.reason };
    const { accessStatus } = resolution.snapshot;
    if (accessStatus === 'trial' || accessStatus === 'active' || accessStatus === 'grace') {
        return { kind: 'canonical', accessStatus, activeClientLimit: null };
    }
    return { kind: 'canonical', accessStatus, activeClientLimit: 1 };
}

export function assertActiveClientApplication(input: {
    enforcementEnabled: boolean;
    clients: readonly ClientLike[];
    resolution: EntitlementResolution;
    transition: 'create' | 'update';
    existingClientId?: string;
    nextArchived?: boolean;
}): ActiveClientDecision {
    if (!input.enforcementEnabled) return { allowed: true, reason: 'no_net_increase' };
    const decision = evaluateActiveClientTransition({
        clients: input.clients,
        entitlement: activeClientEntitlementFromResolution(input.resolution),
        transition: input.transition,
        existingClientId: input.existingClientId,
        nextArchived: input.nextArchived,
    });
    if (decision.allowed === false) throw new ActiveClientPolicyError(decision);
    return decision;
}

/**
 * Serialize the final re-read and commit when Web Locks are available. Import,
 * restore, sync, archive, edit, and delete flows never call this boundary.
 */
export async function runActiveClientApplication<T>(input: {
    enforcementEnabled: boolean;
    readClients: () => readonly ClientLike[];
    resolution: EntitlementResolution;
    transition: 'create' | 'update';
    existingClientId?: string;
    nextArchived?: boolean;
    commit: () => T | Promise<T>;
}): Promise<T> {
    if (!input.enforcementEnabled) return await input.commit();
    const apply = async () => {
        assertActiveClientApplication({
            enforcementEnabled: input.enforcementEnabled,
            clients: input.readClients(),
            resolution: input.resolution,
            transition: input.transition,
            existingClientId: input.existingClientId,
            nextArchived: input.nextArchived,
        });
        return await input.commit();
    };
    if (typeof navigator === 'undefined' || !navigator.locks) {
        return await apply();
    }
    return await navigator.locks.request('tasktime-active-client-application-v1', {
        mode: 'exclusive',
    }, apply);
}

export function isActiveClientPolicyError(error: unknown): error is ActiveClientPolicyError {
    return error instanceof ActiveClientPolicyError;
}
