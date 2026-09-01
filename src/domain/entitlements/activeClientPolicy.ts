export type ActiveClientEntitlement =
    | { kind: 'canonical'; accessStatus: 'free' | 'suspended'; activeClientLimit: 1 }
    | { kind: 'canonical'; accessStatus: 'trial' | 'active' | 'grace'; activeClientLimit: null }
    | { kind: 'unresolved'; reason: string };

interface ClientLike {
    id: string;
    archived?: boolean;
}

type Input = {
    clients: readonly ClientLike[];
    entitlement: ActiveClientEntitlement;
    transition: 'create' | 'update';
    existingClientId?: string;
    nextArchived?: boolean;
};

export type ActiveClientDecision =
    | { allowed: true; reason: 'entitled' | 'under_limit' | 'no_net_increase' }
    | {
        allowed: false;
        code: 'ENTITLEMENT_REQUIRED';
        feature: 'activeClients';
        limit: 1;
        activeCount: number;
        recovery: 'upgrade_or_trial';
    }
    | {
        allowed: false;
        code: 'ENTITLEMENT_STATUS_UNAVAILABLE';
        feature: 'activeClients';
        recovery: 'retry_or_reconnect';
    };

export function countActiveClients(clients: readonly ClientLike[]): number {
    return new Set(clients.filter(client => client.archived !== true).map(client => client.id)).size;
}

export function evaluateActiveClientTransition(input: Input): ActiveClientDecision {
    if (input.entitlement.kind === 'unresolved') {
        return {
            allowed: false,
            code: 'ENTITLEMENT_STATUS_UNAVAILABLE',
            feature: 'activeClients',
            recovery: 'retry_or_reconnect',
        };
    }
    if (input.entitlement.activeClientLimit === null) return { allowed: true, reason: 'entitled' };
    const activeCount = countActiveClients(input.clients);
    let netIncrease = input.transition === 'create';
    if (input.transition === 'update') {
        const existing = input.clients.find(client => client.id === input.existingClientId);
        netIncrease = Boolean(existing?.archived === true && input.nextArchived === false);
    }
    if (!netIncrease) return { allowed: true, reason: 'no_net_increase' };
    if (activeCount < input.entitlement.activeClientLimit) return { allowed: true, reason: 'under_limit' };
    return {
        allowed: false,
        code: 'ENTITLEMENT_REQUIRED',
        feature: 'activeClients',
        limit: 1,
        activeCount,
        recovery: 'upgrade_or_trial',
    };
}

