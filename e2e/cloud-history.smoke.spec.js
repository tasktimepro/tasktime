import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import { expect, test } from '@playwright/test';
import { createRemoteDriveFixture, createStatefulDriveFixture, installMockDirectDriveRoutes } from './helpers/tasktime.js';

const hash = bytes => createHash('sha256').update(createHash('sha256').update(bytes).digest()).digest('hex');

for (const provider of ['dropbox', 'google-drive']) {
    test(`${provider} dashboard archive loads serialize writes after Account refresh`, async ({ page }) => {
        const initial = createRemoteDriveFixture({ projects: [{ id: 'history-project', title: 'Retained project', isPersonal: true }] });
        const drive = createStatefulDriveFixture(initial);
        const files = new Map();
        let revision = 0;
        const metadata = (name, bytes) => ({
            '.tag': 'file', id: `id:${name}`, name, path_lower: `/sync/${name}`,
            rev: String(++revision), server_modified: new Date().toISOString(),
            size: bytes.length, content_hash: hash(bytes),
        });
        for (const file of initial.files) {
            const bytes = Buffer.from(initial.fileBodies.get(file.id));
            files.set(file.name, { bytes, metadata: metadata(file.name, bytes) });
        }
        const errors = [];
        const conflicts = [];
        let activeUploads = 0;
        let peakUploads = 0;
        page.on('pageerror', error => errors.push(error.message));
        const headers = {
            'Access-Control-Allow-Origin': 'http://127.0.0.1:3101',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, Dropbox-API-Arg, X-Session-Id, X-TaskTime-App-Version',
            'Access-Control-Expose-Headers': 'Dropbox-API-Result',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        };
        if (provider === 'dropbox') {
            await page.route(/^https?:\/\/[^/]+\/billing\//, route => route.fulfill({ status: 503, headers, json: { code: 'BILLING_UNAVAILABLE' } }));
            await page.route('**/auth/dropbox/status', route => route.fulfill({ headers, json: { authenticated: true, provider: 'dropbox' } }));
            await page.route('**/auth/dropbox/access-token**', route => route.fulfill({ headers, json: {
                accessToken: 'history-token-fixture', tokenType: 'Bearer', expiresAt: Date.now() + 3_600_000, serverTime: Date.now(),
                scope: 'files.content.read files.content.write files.metadata.read files.metadata.write',
            } }));
            await page.route('https://*.dropboxapi.com/**', async route => {
                const request = route.request();
                if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
                const endpoint = new URL(request.url()).pathname;
                const args = JSON.parse(request.headers()['dropbox-api-arg'] || request.postData() || '{}');
                const name = args.path?.replace(/^id:/, '').split('/').pop();
                const existing = files.get(name);
                if (endpoint.endsWith('/list_folder')) return route.fulfill({ headers, json: {
                    entries: args.path === '/sync' ? [...files.values()].map(file => file.metadata) : [], cursor: 'done', has_more: false,
                } });
                if (endpoint.endsWith('/get_metadata') || endpoint.endsWith('/download')) {
                    if (!existing) return route.fulfill({ status: 409, headers, json: { error: { '.tag': 'path', path: { '.tag': 'not_found' } } } });
                    if (endpoint.endsWith('/get_metadata')) return route.fulfill({ headers, json: existing.metadata });
                    return route.fulfill({ headers: { ...headers, 'Dropbox-API-Result': JSON.stringify(existing.metadata) }, body: existing.bytes });
                }
                if (endpoint.endsWith('/upload')) {
                    activeUploads += 1;
                    peakUploads = Math.max(peakUploads, activeUploads);
                    // Let overlapping archive writers reach the same stale revision.
                    await new Promise(resolve => setTimeout(resolve, 25));
                    const latest = files.get(name);
                    const stale = args.mode === 'add' ? Boolean(latest) : latest?.metadata.rev !== args.mode?.update;
                    if (stale) {
                        conflicts.push(name);
                        activeUploads -= 1;
                        return route.fulfill({ status: 409, headers, json: { error: { '.tag': 'path', path: { '.tag': 'conflict' } } } });
                    }
                    const bytes = request.postDataBuffer();
                    const updated = { bytes, metadata: metadata(name, bytes) };
                    files.set(name, updated);
                    activeUploads -= 1;
                    return route.fulfill({ headers, json: updated.metadata });
                }
                throw new Error(`Unexpected Dropbox fixture endpoint: ${endpoint}`);
            });
        } else {
            await installMockDirectDriveRoutes(page, drive);
            await page.route('**/upload/drive/v3/**', async route => {
                if (route.request().method() === 'OPTIONS') return route.fallback();
                activeUploads += 1;
                peakUploads = Math.max(peakUploads, activeUploads);
                await new Promise(resolve => setTimeout(resolve, 25));
                await route.fallback();
                activeUploads -= 1;
            });
        }
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        await page.goto('/account?section=sync');
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
        await page.evaluate(async provider => {
            const store = window.__TASKTIME_STORE__;
            store.preferences.set('autoSyncEnabled', true);
            store.preferences.set('autoSyncMode', 'sync');
            store.preferences.set('backupEnabled', false);
            const tasks = await store.loadArchivedTasks();
            tasks.set('retained-task', { id: 'retained-task', title: 'Retained archived task', projectId: 'history-project', archived: true });
            await store.loadArchivedInvoices();
            await store.loadArchivedExpenses();
            await store.docManager.flushPersistence();
            const { claimActiveCloudStorageSession } = await import('/src/stores/yjs/cloudStorageLifecycle.ts');
            const { clearSyncPersistence, setDisconnectedDirtyDocNames } = await import('/src/utils/syncPersistence.ts');
            // Seed existing history without a separate reconnect-upload marker so
            // navigation, rather than the initial connection, opens the archives.
            clearSyncPersistence();
            setDisconnectedDirtyDocNames([]);
            if (provider === 'dropbox') {
                const { storeDropboxSession } = await import('/src/utils/dropboxAuthStorage.ts');
                await storeDropboxSession({ provider: 'dropbox', sessionId: 'history-session-fixture', createdAt: new Date().toISOString() });
            } else {
                const { storeSession } = await import('/src/utils/googleAuthStorage.ts');
                await storeSession({ sessionId: 'history-session-fixture', userId: 'history-user', email: 'history@example.test', createdAt: new Date().toISOString() });
            }
            await claimActiveCloudStorageSession(provider, 'history-session-fixture');
        }, provider);
        await page.reload();
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__?.isCloudConnected())).toBe(true);
        await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
        await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        await expect(page.getByText('Unable to load dashboard history.')).toHaveCount(0);
        const archiveBytes = () => provider === 'dropbox'
            ? files.get('tasktime-yjs-tasks-archived.bin')?.bytes
            : drive.fileBodies.get(drive.getFileByName('tasktime-yjs-tasks-archived.bin')?.id);
        await expect.poll(() => Boolean(archiveBytes())).toBe(true);
        const archive = new Y.Doc();
        Y.applyUpdate(archive, archiveBytes());
        const retained = archive.getMap('tasks').get('retained-task');
        expect(retained instanceof Y.Map ? retained.get('title') : retained.title).toBe('Retained archived task');
        expect(conflicts).toEqual([]);
        expect(peakUploads).toBe(1);
        expect(errors).toEqual([]);
        archive.destroy();
    });
}
