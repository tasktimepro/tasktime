/**
 * Provider-neutral configuration for TaskTime's hosted Worker boundary.
 *
 * Billing uses the lifecycle-selected opaque session reference. It never
 * derives identity from an email address or a browser origin.
 */

import { createTaskTimeOriginConfig } from './origins';

export const TASKTIME_ORIGIN_CONFIG = createTaskTimeOriginConfig({
    marketingOrigin: import.meta.env.VITE_MARKETING_ORIGIN as string | undefined,
    appOrigin: import.meta.env.VITE_APP_ORIGIN as string | undefined,
    workerOrigin: import.meta.env.VITE_SYNC_WORKER_URL as string | undefined,
    agentDocsOrigin: import.meta.env.VITE_AGENT_DOCS_ORIGIN as string | undefined,
});

const METRICS_ALLOWED_HOSTNAMES = new Set([
    new URL(TASKTIME_ORIGIN_CONFIG.marketingOrigin).hostname,
    new URL(TASKTIME_ORIGIN_CONFIG.appOrigin).hostname,
]);

function getBrowserHostname(): string | null {
    if (typeof window === 'undefined' || !window.location) return null;
    return window.location.hostname || null;
}

export function isMetricsOriginAllowed(hostname = getBrowserHostname()): boolean {
    return hostname !== null && METRICS_ALLOWED_HOSTNAMES.has(hostname);
}

export const SYNC_WORKER_CONFIG = {
    workerUrl: TASKTIME_ORIGIN_CONFIG.workerOrigin ?? undefined,

    get isEnabled(): boolean {
        return Boolean(this.workerUrl);
    },

    get isMetricsEnabled(): boolean {
        return this.isEnabled && isMetricsOriginAllowed();
    },

    get endpoints() {
        const base = this.workerUrl || '';
        return {
            authInit: `${base}/auth/init`,
            authCallback: `${base}/auth/callback`,
            authRevoke: `${base}/auth/revoke`,
            authStatus: `${base}/auth/status`,
            authAccessToken: `${base}/auth/access-token`,
            dropboxAuthInit: `${base}/auth/dropbox/init`,
            dropboxAuthCallback: `${base}/auth/dropbox/callback`,
            dropboxAuthRevoke: `${base}/auth/dropbox/revoke`,
            dropboxAuthStatus: `${base}/auth/dropbox/status`,
            dropboxAccessToken: `${base}/auth/dropbox/access-token`,
            hostedIdentityTransfer: `${base}/auth/hosted-identity/transfer`,
            drive: `${base}/drive`,
            metricsBatch: `${base}/metrics/batch`,
            pushVapidPublicKey: `${base}/push/vapid-public-key`,
            pushSubscription: `${base}/push/subscription`,
            pushSchedules: `${base}/push/schedules`,
            pushTest: `${base}/push/test`,
            billingCatalog: `${base}/billing/catalog`,
            billingJwks: `${base}/.well-known/tasktime-license-jwks.json`,
            billingStatus: `${base}/billing/status`,
            billingTrialStart: `${base}/billing/trial/start`,
            billingCheckout: `${base}/billing/checkout`,
            billingCheckoutAbandon: `${base}/billing/checkout/abandon`,
            billingPortal: `${base}/billing/portal`,
            billingRefresh: `${base}/billing/refresh`,
            billingAccount: `${base}/billing/account`,
            emailAttemptStatus: `${base}/email/attempt/status`,
        };
    },
};
