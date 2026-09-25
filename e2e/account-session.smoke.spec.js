import { expect, test } from '@playwright/test';
import {
    createRemoteDriveFixture,
    createStatefulDriveFixture,
    installMockDirectDriveRoutes,
    seedStoredGoogleSession,
} from './helpers/tasktime.js';

for (const width of [1440, 390]) {
    test(`Account keeps Google sign out during sync and offline at ${width}px`, async ({ page, context }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        const fixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        await installMockDirectDriveRoutes(page, fixture);
        let releaseFiles;
        const fileGate = new Promise(resolve => { releaseFiles = resolve; });
        let fileRequested = false;
        await page.route('**/drive/v3/files**', async route => {
            if (route.request().method() === 'OPTIONS') return route.fallback();
            fileRequested = true;
            await fileGate;
            await route.fallback();
        });
        await page.goto('/account?section=sync');
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await seedStoredGoogleSession(page, {
            sessionId: 'account-header-google-fixture', userId: 'account-header-user', email: 'studio@example.test',
        });
        try {
            await page.reload();
            await expect.poll(() => fileRequested).toBe(true);
            await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
        } finally {
            releaseFiles();
        }
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.getSyncState())).toBe('idle');
        await context.setOffline(true);
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Sign out & delete local data?' });
        await expect(dialog.getByRole('button', { name: 'Sync & Sign out' })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
        await context.setOffline(false);
        await page.route('**/auth/status**', route => route.fulfill({
            status: 401, contentType: 'application/json', body: JSON.stringify({ authenticated: false }),
        }));
        await page.reload();
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
    });

    test(`Account retains Dropbox sign out through connection outages at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        let status = 200;
        await page.route('**/auth/dropbox/status', route => route.fulfill({
            status, contentType: 'application/json', body: JSON.stringify(status === 200
                ? { authenticated: true, provider: 'dropbox' }
                : status === 401 ? { authenticated: false } : { error: 'Temporarily unavailable' }),
        }));
        let releaseToken;
        const tokenGate = new Promise(resolve => { releaseToken = resolve; });
        let tokenRequested = false;
        await page.route('**/auth/dropbox/access-token**', async route => {
            tokenRequested = true;
            await tokenGate;
            await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporarily unavailable' }) });
        });
        await page.goto('/account?section=sync');
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await page.evaluate(async () => {
            const { storeDropboxSession } = await import('/src/utils/dropboxAuthStorage.ts');
            const { claimActiveCloudStorageSession } = await import('/src/stores/yjs/cloudStorageLifecycle.ts');
            await storeDropboxSession({ provider: 'dropbox', sessionId: 'account-header-dropbox-fixture', createdAt: new Date().toISOString(), accountEmail: 'studio@example.test' });
            await claimActiveCloudStorageSession('dropbox', 'account-header-dropbox-fixture');
        });
        try {
            await page.reload();
            await expect.poll(() => tokenRequested).toBe(true);
            await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
        } finally {
            releaseToken();
        }
        status = 503;
        await page.reload();
        await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Sign out & delete local data?' });
        await expect(dialog.getByRole('button', { name: 'Sync & Sign out' })).toBeDisabled();
        await dialog.getByRole('button', { name: 'View connection details' }).click();
        await expect(dialog).toBeHidden();
        status = 401;
        await page.reload();
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0);
    });
}


test('Google disconnect restores connection controls and clears account identity without a reload', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    const fixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
    await installMockDirectDriveRoutes(page, fixture);
    await page.goto('/account?section=sync');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await seedStoredGoogleSession(page, {
        sessionId: 'disconnect-ui-fixture', userId: 'disconnect-ui-user', email: 'disconnect@example.test',
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Disconnect from Google Drive?' });
    await dialog.getByRole('button', { name: 'Sync & disconnect', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Connect Google Drive', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByText('disconnect@example.test', { exact: true })).toHaveCount(0);
});
