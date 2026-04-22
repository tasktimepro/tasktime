/**
 * Google authentication configuration
 * Includes both direct Google API config and Worker proxy config
 */

export const GOOGLE_CONFIG = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    // Minimal scopes: just email for identification and Drive appdata for sync
    scopes: [
        'email',
        'https://www.googleapis.com/auth/drive.appdata',
    ].join(' '),
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};

const METRICS_ALLOWED_HOSTNAME = 'tasktime.pro';

function getBrowserHostname(): string | null {
    if (typeof window === 'undefined' || !window.location) {
        return null;
    }

    return window.location.hostname || null;
}

export function isMetricsOriginAllowed(hostname = getBrowserHostname()): boolean {
    return hostname === METRICS_ALLOWED_HOSTNAME;
}

/**
 * Sync Worker configuration
 * When VITE_SYNC_WORKER_URL is set, auth and Drive API calls go through the Worker
 */
export const SYNC_WORKER_CONFIG = {
    /**
     * Base URL of the Cloudflare Worker
     * Set via VITE_SYNC_WORKER_URL environment variable
     */
    workerUrl: import.meta.env.VITE_SYNC_WORKER_URL as string | undefined,

    /**
     * Whether to use the Worker proxy for auth and Drive API calls
     */
    get isEnabled(): boolean {
        return Boolean(this.workerUrl);
    },

    /**
     * Whether anonymous metrics should be sent from this app origin
     */
    get isMetricsEnabled(): boolean {
        return this.isEnabled && isMetricsOriginAllowed();
    },

    /**
     * Worker endpoints
     */
    get endpoints() {
        const base = this.workerUrl || '';
        return {
            authInit: `${base}/auth/init`,
            authCallback: `${base}/auth/callback`,
            authRevoke: `${base}/auth/revoke`,
            authStatus: `${base}/auth/status`,
            drive: `${base}/drive`,
            metricsBatch: `${base}/metrics/batch`,
        };
    },
};
