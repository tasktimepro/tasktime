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

// Compatibility exports for existing Google/auth consumers. New hosted-service
// code imports from the provider-neutral module directly.
export { SYNC_WORKER_CONFIG, isMetricsOriginAllowed } from './syncWorker';
