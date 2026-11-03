import { expect, test } from '@playwright/test';
import { createInlineTask, createPersonalProject, openProjectDashboard } from './helpers/tasktime.js';

async function serveLocalApp(page) {
    // This test uses a synthetic build token and intercepts every external request.
    await page.route('https://**/*', route => route.abort());
    // Exercise the actual production-origin gate using only the local artifact.
    await page.route('https://app.tasktime.pro/**', async route => {
        const url = new URL(route.request().url());
        const response = await route.fetch({ url: `http://127.0.0.1:4174${url.pathname}${url.search}` });
        await route.fulfill({ response });
    });
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
}

test('production timer journey emits anonymous analytics without workspace contents or record IDs', async ({ page }) => {
    const events = [];
    await serveLocalApp(page);
    await page.route('https://api.debugbundle.com/**', async route => {
        const batch = route.request().postDataJSON()?.events ?? [];
        events.push(...batch.filter(event => event.event_type === 'analytics_event'));
        await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ accepted: batch.length, rejected: 0, errors: [] }) });
    });

    await createPersonalProject(page, 'Private analytics fixture project');
    await openProjectDashboard(page, 'Private analytics fixture project');
    const projectId = new URL(page.url()).pathname.split('/')[2];
    await createInlineTask(page, 'Private analytics fixture task');
    const row = page.getByRole('button', { name: 'Private analytics fixture task', exact: true })
        .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]').first();
    await row.getByTitle('Start Timer').first().click();
    await page.waitForTimeout(2500);
    await row.getByTitle('Save & Stop Timer').first().click();

    await expect.poll(() => events.some(event => event.payload.signal.conversion_key === 'tracked_time')).toBe(true);
    expect(events.filter(event => event.payload.kind === 'funnel_step').map(event => event.payload.signal.step_key))
        .toEqual(['app_opened', 'timer_started', 'time_recorded']);
    expect(events.filter(event => event.payload.kind === 'page_view').map(event => event.payload.route.path))
        .toEqual(['/projects', '/projects/:id']);
    expect(events.filter(event => event.payload.kind === 'action').map(event => event.payload.signal.action_key))
        .toEqual(expect.arrayContaining(['project_create', 'task_create', 'timer_start', 'timer_stop']));
    for (const event of events) {
        expect(event.correlation.visitor_id_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(event.correlation.user_id_hash).toBeNull();
        expect(event.payload.custom_dimensions).toEqual({});
    }
    expect(JSON.stringify(events)).not.toContain(projectId);
    expect(JSON.stringify(events)).not.toContain('Private analytics fixture');
    const visitorHashes = new Set(events.map(event => event.correlation.visitor_id_hash));
    expect(visitorHashes.size).toBe(1);
    const visitorHash = [...visitorHashes][0];
    const initialSession = events[0].correlation.session_id;
    const visitorEntries = await page.evaluate(() => Object.entries(localStorage)
        .filter(([key]) => key.startsWith('debugbundle.analytics.visitor.v1.')));
    expect(visitorEntries).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(visitorEntries[0][1]);

    await page.getByTitle('View Time Entries').click();
    await expect(page.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Private analytics fixture task', exact: true })).toBeVisible();
    await expect.poll(() => events.some(event => event.correlation.session_id !== initialSession
        && event.correlation.visitor_id_hash === visitorHash)).toBe(true);
    expect(new Set(events.map(event => event.correlation.visitor_id_hash))).toEqual(visitorHashes);
});

for (const failure of ['network', 'storage']) {
    test(`unavailable analytics ${failure} cannot prevent task creation, timer completion or persistence`, async ({ page }) => {
        const pageErrors = [];
        const events = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await serveLocalApp(page);
        if (failure === 'storage') await page.addInitScript(() => {
            const originalGet = Storage.prototype.getItem;
            const originalSet = Storage.prototype.setItem;
            Storage.prototype.getItem = function (key) {
                if (key.startsWith('debugbundle.analytics.visitor.v1.')) throw new DOMException('Storage blocked', 'SecurityError');
                return originalGet.call(this, key);
            };
            Storage.prototype.setItem = function (key, value) {
                if (key.startsWith('debugbundle.analytics.visitor.v1.')) throw new DOMException('Storage blocked', 'SecurityError');
                return originalSet.call(this, key, value);
            };
        });
        let analyticsRequests = 0;
        await page.route('https://api.debugbundle.com/**', route => {
            analyticsRequests += 1;
            if (failure === 'network') return route.abort('blockedbyclient');
            const batch = route.request().postDataJSON()?.events ?? [];
            events.push(...batch.filter(event => event.event_type === 'analytics_event'));
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ accepted: batch.length, rejected: 0, errors: [] }) });
        });

        await createPersonalProject(page, 'Blocked analytics project');
        await openProjectDashboard(page, 'Blocked analytics project');
        await createInlineTask(page, 'Offline-safe timer task');
        const row = page.getByRole('button', { name: 'Offline-safe timer task', exact: true })
            .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]').first();
        await row.getByTitle('Start Timer').first().click();
        await page.waitForTimeout(2500);
        await row.getByTitle('Save & Stop Timer').first().click();
        await page.getByTitle('View Time Entries').click();
        await expect(page.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Offline-safe timer task', exact: true })).toBeVisible();
        await page.getByTitle('View Time Entries').click();
        await expect(page.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        expect(analyticsRequests).toBeGreaterThan(0);
        if (failure === 'storage') {
            await expect.poll(() => events.length).toBeGreaterThan(0);
            expect(events.every(event => event.correlation.visitor_id_hash === null)).toBe(true);
        }
        expect(pageErrors).toEqual([]);
    });
}
