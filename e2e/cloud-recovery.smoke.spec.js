import { expect, test } from '@playwright/test';
import {
    createPersonalProject,
    createRemoteDriveFixture,
    createStatefulDriveFixture,
    installMockDirectDriveRoutes,
    projectsHeadingName,
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

test('Google Drive recovers an accepted delta upload returning fileIdInUse without losing local or remote work', async ({ page, browserName }) => {
    const capturedUploadBodies = [];
    if (browserName === 'webkit') {
        // Playwright's WebKit request API omits Blob bodies. Copy their bytes
        // for the provider fixture while sending the original fetch unchanged.
        await page.exposeFunction('__captureDriveUploadBody', (url, bytes) => {
            capturedUploadBodies.push({ url, body: Buffer.from(bytes) });
        });
        await page.addInitScript(() => {
            const originalFetch = window.fetch.bind(window);
            window.fetch = async (input, options) => {
                if (typeof input === 'string'
                    && input.startsWith('https://www.googleapis.com/upload/drive/v3/')
                    && options?.body instanceof Blob) {
                    await window.__captureDriveUploadBody(input, Array.from(new Uint8Array(await options.body.arrayBuffer())));
                }
                return originalFetch(input, options);
            };
        });
    }
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    const retainedTitle = 'Retained remote project';
    const newTitle = 'Project saved during upload recovery';
    const drive = createStatefulDriveFixture(createRemoteDriveFixture({
        projects: [{ id: 'retained-project', title: retainedTitle, isPersonal: true }],
    }));
    const handleRoute = drive.handleRoute;
    let armed = false;
    let recoveredId = null;
    let readbacks = 0;
    const syncErrors = [];
    page.on('pageerror', error => syncErrors.push(error.message));
    page.on('console', message => {
        if (/\[DriveSync\].*(Sync failed|Failed to push)/.test(message.text())) syncErrors.push(message.text());
    });
    drive.handleRoute = async route => {
        let request = route.request();
        const url = new URL(request.url());
        if (browserName === 'webkit' && url.pathname.startsWith('/upload/drive/v3/')) {
            const originalRequest = request;
            const originalRoute = route;
            const bodyIndex = capturedUploadBodies.findIndex(entry => entry.url === request.url());
            expect(bodyIndex).toBeGreaterThanOrEqual(0);
            const [{ body }] = capturedUploadBodies.splice(bodyIndex, 1);
            request = {
                url: () => originalRequest.url(),
                method: () => originalRequest.method(),
                headers: () => originalRequest.headers(),
                postDataBuffer: () => originalRequest.postDataBuffer() ?? body,
            };
            route = { request: () => request, fulfill: response => originalRoute.fulfill(response) };
        }
        if (armed && !recoveredId && request.method() === 'POST'
            && request.postDataBuffer()?.toString('latin1').includes('tasktime-yjs-core-delta-')) {
            // Keep the accepted bytes, then model Google's response to a replay
            // of the same pre-generated ID after an ambiguous upload outcome.
            return handleRoute({
                request: () => request,
                fulfill: async response => {
                    recoveredId = JSON.parse(response.body).id;
                    await route.fulfill({
                        ...response,
                        status: 409,
                        body: JSON.stringify({ error: { errors: [{ reason: 'fileIdInUse' }] } }),
                    });
                },
            });
        }
        if (recoveredId && request.method() === 'GET'
            && url.pathname === `/drive/v3/files/${recoveredId}`
            && url.searchParams.has('fields')) {
            readbacks += 1;
            const file = drive.files.find(candidate => candidate.id === recoveredId);
            return route.fulfill({
                headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3101' },
                json: {
                    ...file,
                    mimeType: 'application/octet-stream',
                    parents: ['opaque-application-data-folder-id'],
                    spaces: ['appDataFolder'],
                    trashed: false,
                },
            });
        }
        return handleRoute(route);
    };
    await installMockDirectDriveRoutes(page, drive);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
    await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        store.preferences.set('autoSyncEnabled', true);
        store.preferences.set('autoSyncMode', 'sync');
        store.preferences.set('backupEnabled', false);
    });
    await seedStoredGoogleSession(page, {
        sessionId: 'upload-recovery-session', userId: 'fixture', email: 'upload-recovery@example.test',
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();

    armed = true;
    await createPersonalProject(page, newTitle);
    await expect.poll(() => readbacks).toBe(1);
    await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();
    expect(drive.readCurrentSyncedCoreProjectTitles().sort()).toEqual([newTitle, retainedTitle].sort());
    expect(drive.uploads.filter(({ metadata }) => metadata.id === recoveredId)).toHaveLength(1);
    expect(drive.proxyRequestCount()).toBe(0);
    expect(syncErrors).toEqual([]);

    await page.reload();
    await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: retainedTitle, exact: true })).toBeVisible();
    expect(drive.readCurrentSyncedCoreProjectTitles().sort()).toEqual([newTitle, retainedTitle].sort());
    expect(syncErrors).toEqual([]);
    expect(capturedUploadBodies).toEqual([]);
});
