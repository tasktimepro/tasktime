import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

const editor = (page) => page.locator('.rounded-lg.border.px-4.py-2').filter({ has: page.locator('#global-timer-start-day') });
const readTimer = (page) => page.evaluate(async () => {
    const { readEntity } = await import('/src/stores/yjs/entityUtils.ts');
    return readEntity(window.__TASKTIME_STORE__.timers.get('date-project'));
});
const openEditor = async (page) => {
    await page.getByTitle('Show timer options', { exact: true }).click();
};
const setTime = async (page, time) => {
    await page.getByLabel('Start Time', { exact: true }).click();
    for (const [index, value] of time.split(':').entries()) {
        await page.getByRole('spinbutton').nth(index).fill(value);
    }
    await page.getByLabel('Start Time', { exact: true }).click();
};
const chooseDay = async (page, name) => {
    // Exercise the select through the keyboard inside the focusable timer card.
    await page.getByRole('combobox', { name: 'Start Day' }).press('Space');
    await page.getByRole('option', { name, exact: true }).focus();
    await page.getByRole('option', { name, exact: true }).press('Enter');
};
const checkErrorNotice = async (page, testInfo, theme) => {
    const notice = page.getByRole('group', { name: 'Timer preview' }).getByRole('alert');
    await expect(notice.locator('svg')).toBeVisible();
    const contrast = await notice.evaluate((element) => {
        const luminance = (color) => {
            const linear = color.match(/[\d.]+/g).slice(0, 3).map(value => {
                const channel = Number(value) / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        };
        const background = luminance(getComputedStyle(element).backgroundColor);
        const ratio = (color) => {
            const foreground = luminance(color);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        };
        return {
            dark: document.documentElement.classList.contains('dark'),
            text: ratio(getComputedStyle(element.querySelector('p')).color),
            icon: ratio(getComputedStyle(element.querySelector('svg')).color),
        };
    });
    expect(contrast.dark).toBe(theme === 'dark');
    expect(contrast.text).toBeGreaterThanOrEqual(4.5);
    expect(contrast.icon).toBeGreaterThanOrEqual(3);
    await editor(page).screenshot({ path: testInfo.outputPath(`${theme}-error-notice.png`) });
};
const seedTimer = async (page, { startTime, paused = false, archivedOverlap = false, theme = 'light' }) => {
    await page.evaluate(async ({ startTime, paused, archivedOverlap, theme }) => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        store.projects.set('date-project', objectToYMap({ id: 'date-project', title: 'Website redesign', isPersonal: true, invoiceIds: [] }));
        store.tasks.set('date-task', objectToYMap({ id: 'date-task', title: 'Refine homepage layout', projectId: 'date-project', billable: false }));
        store.timers.set('date-project', objectToYMap({ projectId: 'date-project', taskId: 'date-task', timerInstanceId: 'date-fixture', startTime, paused, pausedElapsedTime: paused ? 431000 : 0, note: 'Homepage polish' }));
        localStorage.setItem('tasktime-dark-mode', String(theme === 'dark'));
        if (paused) {
            store.activeTimeEntries.set('september-work', objectToYMap({ id: 'september-work', taskId: 'date-task', start: new Date('2026-09-13T16:43:00+02:00').getTime(), end: new Date('2026-09-14T00:43:00+02:00').getTime() }));
        }
        if (archivedOverlap) {
            const oldTasks = await store.loadArchivedTasks();
            oldTasks.set('old-task', objectToYMap({ id: 'old-task', title: 'Archived project work', projectId: 'date-project', archived: true }));
            const oldEntries = await store.loadEntriesForYear(2025);
            oldEntries.set('old-entry', objectToYMap({ id: 'old-entry', taskId: 'old-task', start: startTime - 55000, end: startTime - 5000 }));
        }
        await store.docManager.flushPersistence();
    }, { startTime, paused, archivedOverlap, theme });
    await page.reload();
    await expect(page.getByTitle('Show timer options', { exact: true })).toBeVisible();
};

for (const width of [1440, 390]) {
    test.describe(`${width}px timer editor`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.clock.setFixedTime(new Date('2026-09-14T00:15:00+02:00'));
            await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
            await page.goto('/');
            await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        });

        test(`previews yesterday and preserves a running timer after reload at ${width}px`, async ({ page }, testInfo) => {
            await seedTimer(page, { startTime: new Date('2026-09-14T00:14:00+02:00').getTime(), theme: 'dark' });
            await openEditor(page);
            await expect(page.getByLabel('Start Date', { exact: true })).toHaveCount(0);
            await expect(page.getByRole('combobox', { name: 'Start Day' })).toHaveText('Today');
            await page.getByRole('combobox', { name: 'Start Day' }).press('Space');
            await expect(page.getByRole('option')).toHaveText(['Today', 'Yesterday']);
            await page.getByRole('option', { name: 'Yesterday', exact: true }).click();
            await setTime(page, '23:30:00');
            const preview = page.getByRole('group', { name: 'Timer preview' });
            await expect(preview).toContainText('45m');
            await expect(preview).toContainText('Yesterday 23:30:00 → Today 00:15:00 (now)');
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await editor(page).screenshot({ path: testInfo.outputPath('running-preview.png') });
            await chooseDay(page, 'Today');
            await expect(preview).toContainText('Start time cannot be in the future');
            await expect(page.getByRole('button', { name: 'Update Timer', exact: true })).toBeDisabled();
            await checkErrorNotice(page, testInfo, 'dark');
            await chooseDay(page, 'Yesterday');
            await page.getByRole('button', { name: 'Update Timer', exact: true }).click();
            await expect(page.getByText('Timer updated successfully', { exact: true })).toBeVisible();
            const expectedStart = new Date('2026-09-13T23:30:00+02:00').getTime();
            await expect.poll(() => readTimer(page)).toMatchObject({ startTime: expectedStart });
            await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
            await page.reload();
            await openEditor(page);
            await expect(page.getByRole('combobox', { name: 'Start Day' })).toHaveText('Yesterday');
            await expect(page.getByLabel('Start Time', { exact: true })).toHaveValue('23:30:00');
            await expect(preview).toContainText('45m');
        });

        test(`preserves an older paused timer through preview, edit, reload and stop at ${width}px`, async ({ page }, testInfo) => {
            const originalStart = new Date('2026-08-27T23:50:45+02:00').getTime();
            await seedTimer(page, { startTime: originalStart, paused: true });
            const original = await readTimer(page);
            await openEditor(page);
            await expect(page.getByRole('combobox', { name: 'Start Day' })).toHaveText('Aug 27, 2026');
            const preview = page.getByRole('group', { name: 'Timer preview' });
            await expect(preview).toContainText('7m 11s');
            await expect(preview).toContainText('Aug 27, 2026 23:50:45 → Aug 27, 2026 23:57:56 (paused)');
            await chooseDay(page, 'Yesterday');
            await expect(preview).toContainText('Start time cannot be after the timer was paused');
            await expect(page.getByRole('button', { name: 'Update Timer', exact: true })).toBeDisabled();
            await checkErrorNotice(page, testInfo, 'light');
            expect(await readTimer(page)).toEqual(original);
            await chooseDay(page, 'Aug 27, 2026');
            await setTime(page, '23:49:45');
            await expect(preview).toContainText('8m 11s');
            await expect(preview).toContainText('23:57:56 (paused)');
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await editor(page).screenshot({ path: testInfo.outputPath('paused-preview.png') });
            await page.getByRole('button', { name: 'Update Timer', exact: true }).click();
            await expect(page.getByText('Timer updated successfully', { exact: true })).toBeVisible();
            await expect.poll(() => readTimer(page)).toMatchObject({ startTime: originalStart - 60000, pausedElapsedTime: 491000, paused: true });
            await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
            await page.reload();
            await openEditor(page);
            await expect(preview).toContainText('8m 11s');
            await editor(page).getByRole('button', { name: 'Save & Stop Timer', exact: true }).click();
            await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.timers.has('date-project'))).toBe(false);
            const saved = await page.evaluate(() => window.__TASKTIME_STORE__.getAllTimeEntries().filter(entry => entry._stoppedTimerInstanceId === 'date-fixture'));
            expect(saved).toHaveLength(1);
            expect(saved[0]).toMatchObject({ start: originalStart - 60000, end: originalStart + 431000 });
        });

        test(`retains complete-history validation for an older timer at ${width}px`, async ({ page }) => {
            const originalStart = new Date('2025-12-31T23:50:45+01:00').getTime();
            await seedTimer(page, { startTime: originalStart, paused: true, archivedOverlap: true });
            const original = await readTimer(page);
            await openEditor(page);
            await expect(page.getByRole('combobox', { name: 'Start Day' })).toHaveText('Dec 31, 2025');
            await setTime(page, '23:49:45');
            await page.getByRole('button', { name: 'Update Timer', exact: true }).click();
            await expect(page.getByText(/Time range overlaps with existing entry for "Archived project work"/)).toBeVisible();
            expect(await readTimer(page)).toEqual(original);
            await expect(page.getByLabel('Start Time', { exact: true })).toHaveValue('23:49:45');
            await expect(page.getByRole('button', { name: 'Update Timer', exact: true })).toBeEnabled();
        });
    });
}
