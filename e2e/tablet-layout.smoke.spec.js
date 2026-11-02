import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

async function seed(page, theme) {
    await page.clock.setFixedTime(new Date('2026-09-08T12:00:00+02:00'));
    await page.addInitScript(theme => {
        localStorage.setItem('tasktime-onboarding-completed', 'true');
        localStorage.setItem('tasktime-dark-mode', String(theme === 'dark'));
        localStorage.setItem('tasktime-sidebar-collapsed', 'true');
    }, theme);
    await page.goto('/planner');
    await page.waitForFunction(() => window.__TASKTIME_STORE__?.isReady);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        store.preferences.set('weekStartsOn', 1);
        store.projects.set('tablet-project', objectToYMap({ id: 'tablet-project', title: 'Tablet project', invoiceIds: [] }));
        store.plannerAttachments.set('tablet-project-pin', objectToYMap({ id: 'tablet-project-pin', type: 'project', referenceId: 'tablet-project', mode: 'static', sortOrder: 0, createdAt: new Date('2026-09-07').getTime() }));
        for (const [id, date] of [['tuesday', '2026-09-08'], ['wednesday', '2026-09-09']]) {
            store.tasks.set(id, objectToYMap({ id, title: `Tablet ${id} planning task`, projectId: 'tablet-project' }));
            store.plannerAttachments.set(id, objectToYMap({ id, type: 'task', referenceId: id, mode: 'date', date, sortOrder: 1, createdAt: new Date('2026-09-07').getTime() }));
        }
        await store.docManager.flushPersistence();
    });
}

async function expectContained(page) {
    // Read one layout frame; resizing can remove the sidebar or animate its width.
    await expect.poll(() => page.evaluate(() => {
        const main = document.querySelector('main');
        const nav = document.querySelector('aside.sidebar');
        return {
            documentFits: document.documentElement.scrollWidth <= innerWidth,
            mainFits: main.scrollWidth <= main.clientWidth + 1,
            sidebarClear: !nav || main.getBoundingClientRect().left >= nav.getBoundingClientRect().right,
        };
    })).toEqual({ documentFits: true, mainFits: true, sidebarClear: true });
}

async function expectDaySizing(days) {
    const layout = await days.evaluate(element => {
        const style = getComputedStyle(element);
        const availableWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const buttons = [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect());
        return {
            availableWidth,
            gap: parseFloat(style.columnGap),
            widths: buttons.map(button => button.width),
            groupCenter: (buttons[0].left + buttons.at(-1).right) / 2,
            contentCenter: element.getBoundingClientRect().left + parseFloat(style.paddingLeft) + availableWidth / 2,
            scrollable: element.scrollWidth > element.clientWidth,
        };
    });
    const expectedWidth = Math.max(72, Math.min(112, (layout.availableWidth - 6 * layout.gap) / 7));
    for (const width of layout.widths) expect(Math.abs(width - expectedWidth)).toBeLessThan(1);
    if (layout.availableWidth >= 7 * 72 + 6 * layout.gap) {
        expect(layout.scrollable).toBe(false);
        expect(Math.abs(layout.groupCenter - layout.contentCenter)).toBeLessThan(1);
    } else {
        expect(layout.scrollable).toBe(true);
        for (const button of [days.getByRole('button').first(), days.getByRole('button').last()]) {
            await button.scrollIntoViewIfNeeded();
            await expect(button).toBeInViewport({ ratio: 1 });
        }
    }
}

for (const theme of ['light', 'dark']) {
    test(`keeps tablet Planner readable and preserves the selected day through resizing in ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 820, height: 1180 });
        await seed(page, theme);
        const days = page.locator('main .scrollbar-hide').filter({ has: page.locator('button[aria-pressed]') });
        const grid = page.locator('main .grid-cols-7');
        await expect(days).toBeVisible();
        await days.getByRole('button', { name: /^Wed\s*9$/ }).click();

        for (const [width, height] of [[390, 844], [768, 1024], [820, 1180], [834, 1194], [1024, 1366], [1180, 820], [1279, 900], [1280, 900], [1366, 1024], [1440, 1000], [820, 1180]]) {
            await page.setViewportSize({ width, height });
            if (width < 1280) {
                await expect(days).toBeVisible();
                await expect(grid).toBeHidden();
                await expectDaySizing(days);
                await expect(days.getByRole('button', { name: /^Wed\s*9$/ })).toHaveAttribute('aria-pressed', 'true');
                const item = page.locator('main').getByRole('button', { name: /^Tablet wednesday planning task/ }).filter({ visible: true });
                await expect(item).toBeVisible();
                await page.mouse.move(0, 0);
                const project = page.locator('main').getByRole('button', { name: 'Tablet project Item options', exact: true }).filter({ visible: true });
                await expect(project.getByRole('button', { name: 'Item options' })).toHaveCSS('opacity', '1');
                await expect(item.getByText('Tablet wednesday planning task', { exact: true })).toHaveCSS('white-space', 'normal');
            } else {
                await expect(days).toBeHidden();
                await expect(grid).toBeVisible();
            }
            await expectContained(page);
            if ([820, 1024, 1366].includes(width)) await page.screenshot({ path: testInfo.outputPath(`planner-${width}.png`) });
        }
    });

    test(`keeps Account tabs and content inside tablet layouts in ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 820, height: 1180 });
        await seed(page, theme);
        await page.goto('/account?section=preferences');
        const tabs = page.getByRole('tablist');
        for (const [width, height] of [[390, 844], [768, 1024], [820, 1180], [834, 1194], [1024, 1366], [1180, 820], [1280, 900], [1440, 1000]]) {
            await page.setViewportSize({ width, height });
            await expect(tabs).toBeVisible();
            await expectContained(page);
            for (const tab of await tabs.getByRole('tab').all()) {
                expect(await tab.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    const parent = element.parentElement.getBoundingClientRect();
                    return rect.left >= parent.left - 1 && rect.right <= parent.right + 1;
                })).toBe(true);
            }
            await page.getByRole('tab', { name: 'Your Data', exact: true }).click();
            await expect(page).toHaveURL(/section=data/);
            await expect(page.getByRole('heading', { name: 'Your Data', exact: true })).toBeVisible();
            await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
            await expect(page.getByRole('tab', { name: 'Preferences', exact: true })).toHaveAttribute('aria-selected', 'true');
            if ([820, 1024, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`account-${width}.png`) });
        }
        await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible();
        await expect(page.locator('aside.sidebar')).toHaveCSS('width', '256px');
        await page.setViewportSize({ width: 820, height: 1180 });
        await expectContained(page);
        for (const tab of await tabs.getByRole('tab').all()) await expect(tab).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath('account-expanded-sidebar.png') });
    });
}
