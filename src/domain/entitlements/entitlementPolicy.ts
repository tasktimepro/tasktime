import type {
    BillingAccessStatus,
    BillingStatus,
    EntitlementResolution,
    EntitlementSnapshotV1,
    PaidEntitlement,
} from './entitlementTypes';

const ACCESS_STATUSES = new Set<BillingAccessStatus>(['free', 'trial', 'active', 'grace', 'suspended']);
const BILLING_STATUSES = new Set<BillingStatus>([
    'none', 'trialing', 'active', 'past_due', 'incomplete', 'incomplete_expired',
    'unpaid', 'canceled', 'paused',
]);
const SOURCES = new Set(['subscription', 'trial', 'grant', 'free']);
const TRIAL_STATUSES = new Set(['eligible', 'active', 'used']);
const KNOWN_ENTITLEMENTS = new Set<PaidEntitlement>(['reports.access', 'invoice.email.send']);

export type EntitlementConnectionState = 'ready' | 'reconnecting' | 'reconnect_required' | 'offline' | 'disconnected';

export type EntitlementState = {
    plan: 'free' | 'pro' | 'unknown';
    accessStatus: BillingAccessStatus | 'unresolved';
    verified: boolean;
    connection: EntitlementConnectionState;
};

export type GetProAction = {
    visible: boolean;
    mode: 'checkout' | 'deferred' | null;
};

/** Shared recovery presentation only; it never grants a protected capability. */
export function getEntitlementRecovery(state: EntitlementState): {
    kind: 'upgrade' | 'billing' | 'status' | 'reconnect' | 'reconnecting' | 'offline';
    title: string;
    actionLabel: string;
    section: 'billing' | 'sync' | null;
} {
    if (state.accessStatus === 'suspended') return {
        kind: 'billing', title: 'Resolve billing to restore Pro', actionLabel: 'Manage billing', section: 'billing',
    };
    if (state.connection === 'offline') return {
        kind: 'offline', title: 'Go online to check Pro access', actionLabel: 'Offline', section: null,
    };
    if (state.connection === 'reconnecting') return {
        kind: 'reconnecting', title: 'Reconnecting and checking your plan', actionLabel: 'Reconnecting…', section: null,
    };
    if (state.connection === 'reconnect_required') return {
        kind: 'reconnect', title: 'Reconnect Cloud Sync to confirm your plan', actionLabel: 'Reconnect Cloud Sync', section: 'sync',
    };
    if (state.plan === 'free' || (!state.verified && state.connection === 'disconnected')) return {
        kind: 'upgrade', title: 'Unlock more with Pro', actionLabel: 'View Pro options', section: 'billing',
    };
    return {
        kind: 'status', title: 'Plan status needs confirmation', actionLabel: 'Check plan status', section: 'billing',
    };
}

function fail(): never {
    throw new Error('INVALID_ENTITLEMENT');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, maximum = 255): value is string {
    return typeof value === 'string' && value.length >= 1 && value.length <= maximum;
}

function validInstant(value: unknown): value is string {
    return boundedString(value, 64) && Number.isFinite(Date.parse(value));
}

function nullableInstant(value: unknown): value is string | null {
    return value === null || validInstant(value);
}

function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
    return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

export function parseEntitlementSnapshot(value: unknown): EntitlementSnapshotV1 {
    if (!isRecord(value) || value.version !== 1) fail();
    if (!safeInteger(value.entitlementRevision, 1, Number.MAX_SAFE_INTEGER)
        || !boundedString(value.planConfigVersion, 64)
        || !boundedString(value.subject)
        || (value.plan !== 'free' && value.plan !== 'pro')
        || !ACCESS_STATUSES.has(value.accessStatus as BillingAccessStatus)
        || !BILLING_STATUSES.has(value.billingStatus as BillingStatus)
        || !SOURCES.has(value.source as string)
        || !TRIAL_STATUSES.has(value.trialStatus as string)
        || !nullableInstant(value.trialStartedAt)
        || !nullableInstant(value.trialEndsAt)
        || !nullableInstant(value.sourceExpiresAt)
        || !nullableInstant(value.subscriptionCurrentPeriodStart)
        || !nullableInstant(value.subscriptionCurrentPeriodEnd)
        || !nullableInstant(value.graceUntil)
        || !validInstant(value.sourceUpdatedAt)
        || !nullableInstant(value.lastReconciledAt)
        || typeof value.cancelAtPeriodEnd !== 'boolean'
        || !Array.isArray(value.entitlements)) fail();
    const entitlements = value.entitlements;
    if (entitlements.some(item => !boundedString(item, 128))
        || new Set(entitlements).size !== entitlements.length) fail();
    const recognizedEntitlements = entitlements.filter(
        (item): item is PaidEntitlement => KNOWN_ENTITLEMENTS.has(item as PaidEntitlement),
    );
    if (!isRecord(value.limits)
        || !safeInteger(value.limits.invoiceEmailSendsPerMonth, 0, 1_000_000)
        || value.limits.cloudSync !== true
        || value.limits.automaticCloudBackups !== true
        || value.limits.webPush !== true
        || value.limits.activeProjects !== null
        || value.limits.activeTasks !== null
        || (value.limits.activeClients !== 1 && value.limits.activeClients !== null)) fail();
    const access = value.accessStatus as BillingAccessStatus;
    const grantsAccess = access === 'trial' || access === 'active' || access === 'grace';
    if (grantsAccess) {
        if (value.plan !== 'pro'
            || value.limits.activeClients !== null
            || value.limits.invoiceEmailSendsPerMonth < 1
            || recognizedEntitlements.length !== 2
            || !KNOWN_ENTITLEMENTS.has(recognizedEntitlements[0])
            || !KNOWN_ENTITLEMENTS.has(recognizedEntitlements[1])) fail();
    } else if (value.limits.activeClients !== 1
        || value.limits.invoiceEmailSendsPerMonth !== 0
        || recognizedEntitlements.length !== 0) fail();
    if (access === 'free' && (value.plan !== 'free' || value.source !== 'free')) fail();
    if (access === 'suspended' && value.plan !== 'pro') fail();
    if (access === 'trial' && (value.source !== 'trial'
        || value.trialStatus !== 'active'
        || !value.trialStartedAt
        || !value.trialEndsAt
        || Date.parse(value.trialEndsAt as string) <= Date.parse(value.trialStartedAt as string))) fail();
    if (value.source === 'subscription'
        && (!value.subscriptionCurrentPeriodStart
            || !value.subscriptionCurrentPeriodEnd
            || Date.parse(value.subscriptionCurrentPeriodEnd as string)
                <= Date.parse(value.subscriptionCurrentPeriodStart as string))) fail();
    if (access === 'grace' && !value.graceUntil) fail();
    return {
        version: 1,
        entitlementRevision: value.entitlementRevision as number,
        planConfigVersion: value.planConfigVersion as string,
        subject: value.subject as string,
        plan: value.plan as EntitlementSnapshotV1['plan'],
        accessStatus: value.accessStatus as BillingAccessStatus,
        billingStatus: value.billingStatus as BillingStatus,
        source: value.source as EntitlementSnapshotV1['source'],
        trialStatus: value.trialStatus as EntitlementSnapshotV1['trialStatus'],
        trialStartedAt: value.trialStartedAt as string | null,
        trialEndsAt: value.trialEndsAt as string | null,
        sourceExpiresAt: value.sourceExpiresAt as string | null,
        entitlements: recognizedEntitlements,
        limits: {
            invoiceEmailSendsPerMonth: value.limits.invoiceEmailSendsPerMonth as number,
            cloudSync: true,
            automaticCloudBackups: true,
            webPush: true,
            activeProjects: null,
            activeClients: value.limits.activeClients as 1 | null,
            activeTasks: null,
        },
        subscriptionCurrentPeriodStart: value.subscriptionCurrentPeriodStart as string | null,
        subscriptionCurrentPeriodEnd: value.subscriptionCurrentPeriodEnd as string | null,
        cancelAtPeriodEnd: value.cancelAtPeriodEnd as boolean,
        graceUntil: value.graceUntil as string | null,
        sourceUpdatedAt: value.sourceUpdatedAt as string,
        lastReconciledAt: value.lastReconciledAt as string | null,
    };
}

export function conservativeEntitlement(
    reason: 'conflict' | 'lifecycle' | 'network' | 'unsupported_version',
): EntitlementResolution {
    return { kind: 'unresolved', reason };
}

/**
 * Derive the shared display state without conflating a verified plan with the
 * temporary readiness of its online billing transport.
 */
export function deriveEntitlementState(input: {
    resolution: EntitlementResolution;
    offline: boolean;
    hasActiveCloudAccount: boolean;
    isCloudAccountLoading: boolean;
    isBillingConnectionReady: boolean;
    isBillingReconnecting: boolean;
    needsCloudReconnect: boolean;
}): EntitlementState {
    const accessStatus = input.resolution.kind === 'canonical'
        ? input.resolution.snapshot.accessStatus
        : 'unresolved';
    const plan = accessStatus === 'unresolved'
        ? 'unknown'
        : accessStatus === 'free'
            ? 'free'
            : 'pro';
    const connection: EntitlementConnectionState = input.offline
        ? 'offline'
        : input.isBillingConnectionReady
            ? 'ready'
            : input.needsCloudReconnect
                ? 'reconnect_required'
                : input.isCloudAccountLoading
                    || input.isBillingReconnecting
                    || input.hasActiveCloudAccount
                    ? 'reconnecting'
                    : 'disconnected';
    return {
        plan,
        accessStatus,
        verified: input.resolution.kind === 'canonical',
        connection,
    };
}

/**
 * Keep every Get Pro entry point aligned with Plan & Billing. A canonical
 * Checkout offer may be used only while its account transport is ready. The
 * deferred comparison action is reserved for a genuinely fresh, online,
 * account-free browser; reconnect and unresolved-account states use recovery
 * copy instead of inviting a possibly existing Pro user to purchase again.
 */
export function evaluateGetProAction(input: {
    entitlementState: EntitlementState;
    hasCanonicalStatus: boolean;
    hasCheckoutOffer: boolean;
    catalogPurchaseEnabled: boolean;
    proOfferCount: number;
    isPermanentComplimentaryPro: boolean;
}): GetProAction {
    if (input.entitlementState.connection !== 'ready'
        && input.entitlementState.connection !== 'disconnected') {
        return { visible: false, mode: null };
    }
    if (input.hasCanonicalStatus) {
        if (input.entitlementState.connection !== 'ready'
            || !input.hasCheckoutOffer
            || input.entitlementState.accessStatus === 'suspended'
            || input.isPermanentComplimentaryPro) {
            return { visible: false, mode: null };
        }
        return { visible: true, mode: 'checkout' };
    }
    if (input.entitlementState.connection !== 'disconnected'
        || input.entitlementState.plan === 'pro'
        || !input.catalogPurchaseEnabled
        || input.proOfferCount < 1) {
        return { visible: false, mode: null };
    }
    return { visible: true, mode: 'deferred' };
}

export function evaluateEntitlementFeature(
    resolution: EntitlementResolution,
    feature: PaidEntitlement,
): { allowed: boolean; reason: 'entitled' | 'entitlement_required' | 'status_unavailable'; upgradeEligible: boolean } {
    if (resolution.kind !== 'canonical') {
        return { allowed: false, reason: 'status_unavailable', upgradeEligible: false };
    }
    if (resolution.snapshot.entitlements.includes(feature)
        && (resolution.snapshot.accessStatus === 'trial'
            || resolution.snapshot.accessStatus === 'active'
            || resolution.snapshot.accessStatus === 'grace')) {
        return { allowed: true, reason: 'entitled', upgradeEligible: false };
    }
    return {
        allowed: false,
        reason: 'entitlement_required',
        upgradeEligible: resolution.snapshot.accessStatus === 'free',
    };
}
