import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDropboxCloudUiEnabled } from './cloudProviders';

describe('cloud provider configuration', () => {

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('enables Dropbox entry points by default', () => {
        vi.stubEnv('VITE_DROPBOX_CLOUD_UI_ENABLED', '');

        expect(isDropboxCloudUiEnabled()).toBe(true);
    });

    it('retains an explicit emergency opt-out', () => {
        vi.stubEnv('VITE_DROPBOX_CLOUD_UI_ENABLED', 'false');

        expect(isDropboxCloudUiEnabled()).toBe(false);
    });
});
