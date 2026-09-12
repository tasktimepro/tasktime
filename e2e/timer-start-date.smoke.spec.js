import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

for (const width of [1440, 390]) {
    test(`edits an active timer to yesterday and preserves it after reload at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.setFixedTime(new Date('2026-09-13T00:53:00+02:00'));
        await page.addInitScript(() => {
            localStorage.setItem('tasktime-onboarding-completed', 'true');
            localStorage.setItem('tasktime-dark-mode', 'true');
        });
        await page.goto('/');
        await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        await page.evaluate(async () => {
            const store = window.__TASKTIME_STORE__;
            const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
            store.projects.set('overnight-project', objectToYMap({ id: 'overnight-project', title: 'Website redesign', isPersonal: true, invoiceIds: [] }));
            store.tasks.set('overnight-task', objectToYMap({ id: 'overnight-task', title: 'Refine homepage layout', projectId: 'overnight-project', startDate: '2026-09-12', billable: false }));
            store.timers.set('overnight-project', objectToYMap({ projectId: 'overnight-project', taskId: 'overnight-task', timerInstanceId: 'overnight-fixture', startTime: Date.now() - 60000, paused: false, pausedElapsedTime: 0, note: 'Homepage polish' }));
            store.preferences.set('theme', 'dark');
            await store.docManager.flushPersistence();
        });
        await page.getByTitle('Show timer options', { exact: true }).click();
        await expect(page.getByLabel('Start Date', { exact: true })).toHaveValue('2026-09-13');
        await page.getByLabel('Start Date', { exact: true }).fill('2026-09-12');
        await page.getByLabel('Start Time', { exact: true }).click();
        const fields = page.getByRole('spinbutton');
        await fields.nth(0).fill('23');
        await fields.nth(1).fill('30');
        await fields.nth(2).fill('0');
        await page.getByLabel('Start Time', { exact: true }).click();
        await expect(page.getByLabel('Start Time', { exact: true })).toHaveValue('23:30:00');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.locator('.rounded-lg.border.px-4.py-2').filter({ has: page.locator('#global-timer-start-date') }).screenshot({ path: `test-results/timer-start-date-${width}.png` });
        await page.getByRole('button', { name: 'Update Timer', exact: true }).click();
        await expect(page.getByText('Timer updated successfully', { exact: true })).toBeVisible();
        const expectedStart = new Date('2026-09-12T23:30:00+02:00').getTime();
        await expect.poll(() => page.evaluate(async () => {
            const { readEntity } = await import('/src/stores/yjs/entityUtils.ts');
            return readEntity(window.__TASKTIME_STORE__.timers.get('overnight-project')).startTime;
        })).toBe(expectedStart);
        await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
        await page.reload();
        await page.getByTitle('Show timer options', { exact: true }).click();
        await expect(page.getByLabel('Start Date', { exact: true })).toHaveValue('2026-09-12');
        await expect(page.getByLabel('Start Time', { exact: true })).toHaveValue('23:30:00');
    });
}
