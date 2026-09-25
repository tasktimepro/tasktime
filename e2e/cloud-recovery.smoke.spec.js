import { expect, test } from '@playwright/test';
import {
    createPersonalProject,
    createRemoteDriveFixture,
    createStatefulDriveFixture,
    installMockDirectDriveRoutes,
    seedStoredGoogleSession,
} from './helpers/tasktime.js';

// Exercise real auth hooks, credential providers and sync connection lifecycle.
// Local records in manual mode must survive recovery without any cloud write.
for (const provider of ['google-drive', 'dropbox']) {
    for (const failedStage of ['status', 'access-token']) {
        test(`${provider} recovers a temporary ${failedStage} outage and preserves manual local work`, async ({ page }) => {
            await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
            const drive = createStatefulDriveFixture(createRemoteDriveFixture({}));
            await installMockDirectDriveRoutes(page, drive);
            const dropboxRequests = [];
            const unexpected = [];
            const cors = {
                'Access-Control-Allow-Origin': 'http://127.0.0.1:3101',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type, Dropbox-API-Arg, X-Session-Id, X-TaskTime-App-Version',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            };
            await page.route('https://*.dropboxapi.com/**', async route => {
                if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
                const path = new URL(route.request().url()).pathname;
                dropboxRequests.push(path);
                if (path === '/2/files/list_folder') {
                    return route.fulfill({ headers: cors, json: { entries: [], cursor: 'fixture', has_more: false } });
                }
                if (path === '/2/files/get_metadata') {
                    return route.fulfill({ status: 409, headers: cors, json: { error: { '.tag': 'path', path: { '.tag': 'not_found' } } } });
                }
                unexpected.push(path);
                return route.fulfill({ status: 500, headers: cors, json: {} });
            });
            await page.route('**/auth/dropbox/status', route => route.fulfill({
                headers: cors, json: { authenticated: true, provider: 'dropbox' },
            }));
            await page.route('**/auth/dropbox/access-token**', route => route.fulfill({
                headers: cors,
                json: {
                    accessToken: 'dropbox-recovery-fixture', tokenType: 'Bearer',
                    expiresAt: Date.now() + 3_600_000, serverTime: Date.now(),
                    scope: 'files.content.read files.content.write files.metadata.read files.metadata.write',
                },
            }));
            let failures = 0;
            const endpoint = provider === 'dropbox' ? `/auth/dropbox/${failedStage}` : `/auth/${failedStage}`;
            await page.route(`**${endpoint}**`, async route => {
                if (route.request().method() === 'OPTIONS' || failures) return route.fallback();
                failures += 1;
                return route.fulfill({ status: 503, headers: cors, json: { code: 'TOKEN_SERVICE_UNAVAILABLE' } });
            });

            const title = `${provider} local recovery project`;
            await createPersonalProject(page, title);
            if (provider === 'google-drive') {
                await seedStoredGoogleSession(page, { sessionId: 'recovery-google', userId: 'fixture', email: 'recovery@example.test' });
            } else {
                await page.evaluate(async () => {
                    const { storeDropboxSession } = await import('/src/utils/dropboxAuthStorage.ts');
                    const { claimActiveCloudStorageSession } = await import('/src/stores/yjs/cloudStorageLifecycle.ts');
                    const { markPendingChanges } = await import('/src/utils/syncPersistence.ts');
                    await storeDropboxSession({ provider: 'dropbox', sessionId: 'recovery-dropbox', createdAt: new Date().toISOString() });
                    const lifecycle = await claimActiveCloudStorageSession('dropbox', 'recovery-dropbox');
                    // Model an existing Dropbox workspace's pending local edit.
                    // Legacy unbound markers intentionally belong only to Google.
                    markPendingChanges('core', { provider: 'dropbox', generation: lifecycle.active.generation });
                });
            }
            await page.reload();
            await expect.poll(() => failures).toBe(1);
            await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__?.isCloudConnected()), { timeout: 20_000 }).toBe(true);
            await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Sync changes', exact: true })).toBeVisible();
            expect(drive.proxyRequestCount()).toBe(0);
            expect(drive.directUploads()).toHaveLength(0);
            expect(unexpected).toEqual([]);
            if (provider === 'dropbox') {
                expect(dropboxRequests.length).toBeGreaterThan(0);
                expect(drive.directRequestCount()).toBe(0);
            } else {
                expect(drive.directRequestCount()).toBeGreaterThan(0);
                expect(dropboxRequests).toHaveLength(0);
            }
        });
    }
}
