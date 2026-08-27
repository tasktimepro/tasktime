/**
 * Dropbox entry points ship enabled. An explicit false value remains available
 * as an emergency build-time opt-out; Worker policy still controls whether a
 * new Dropbox session or transfer may actually begin.
 */
export function isDropboxCloudUiEnabled(): boolean {
    return import.meta.env.VITE_DROPBOX_CLOUD_UI_ENABLED !== 'false';
}
