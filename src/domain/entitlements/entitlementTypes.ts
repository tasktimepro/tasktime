export type BillingAccessStatus = 'free' | 'trial' | 'active' | 'grace' | 'suspended';
export type BillingStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'incomplete'
    | 'incomplete_expired' | 'unpaid' | 'canceled' | 'paused';
export type PaidEntitlement = 'reports.access' | 'invoice.email.send';

export interface EntitlementSnapshotV1 {
    version: 1;
    entitlementRevision: number;
    planConfigVersion: string;
    subject: string;
    plan: 'free' | 'pro';
    accessStatus: BillingAccessStatus;
    billingStatus: BillingStatus;
    source: 'subscription' | 'trial' | 'grant' | 'free';
    trialStatus: 'eligible' | 'active' | 'used';
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    sourceExpiresAt: string | null;
    entitlements: PaidEntitlement[];
    limits: {
        invoiceEmailSendsPerMonth: number;
        cloudSync: true;
        automaticCloudBackups: true;
        webPush: true;
        activeProjects: null;
        activeClients: 1 | null;
        activeTasks: null;
    };
    subscriptionCurrentPeriodStart: string | null;
    subscriptionCurrentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    graceUntil: string | null;
    sourceUpdatedAt: string;
    lastReconciledAt: string | null;
}

export type EntitlementResolution =
    | { kind: 'canonical'; snapshot: EntitlementSnapshotV1 }
    | { kind: 'unresolved'; reason: 'conflict' | 'lifecycle' | 'network' | 'unsupported_version' };

