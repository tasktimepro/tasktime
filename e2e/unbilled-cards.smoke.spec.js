import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark']) {
        test(`stacks unbilled amounts below the heading at ${width}px in ${theme}`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.addInitScript(theme => {
                localStorage.setItem('tasktime-onboarding-completed', 'true');
                localStorage.setItem('tasktime-dark-mode', String(theme === 'dark'));
            }, theme);
            await page.goto('/');
            await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
            await page.evaluate(async () => {
                const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
                const store = window.__TASKTIME_STORE__;
                store.preferences.set('currency', 'EUR');
                store.clients.set('studio', objectToYMap({ id: 'studio', title: 'Studio', defaultCurrency: 'EUR', hourlyRate: 100 }));
                store.projects.set('website', objectToYMap({ id: 'website', title: 'Website', preferredClientId: 'studio', hourlyRate: 100, isPersonal: false }));
                store.tasks.set('design', objectToYMap({ id: 'design', title: 'Design', projectId: 'website', billable: true }));
                const start = Date.now() - 30 * 3600000;
                store.activeTimeEntries.set('work', objectToYMap({ id: 'work', taskId: 'design', start, end: start + 27 * 3600000 }));
                for (const [id, amount, billingStatus] of [['travel', 84, 'unbilled'], ['billed', 12, 'billed']]) {
                    store.expenses.set(id, objectToYMap({ id, title: id, date: '2026-09-14', amount, currency: 'EUR', clientId: 'studio', projectId: 'website', billable: true, billingStatus, paymentStatus: 'unpaid', isPersonal: false }));
                }
                await store.docManager.flushPersistence();
            });

            for (const [scope, route] of [['project', '/projects/website'], ['client', '/clients/studio']]) {
                await page.goto(route);
                const content = page.getByTestId(`${scope}-unbilled-metric-content`);
                await expect(content.getByText('Work', { exact: true })).toHaveClass('sr-only');
                await expect(content.getByText('Expenses', { exact: true })).toHaveClass('sr-only');
                await expect(content).toContainText('€2700.00');
                await expect(content).toContainText('€84.00');
                await expect(content).not.toContainText('€96.00');
                const heading = await content.getByText('Unbilled', { exact: true }).boundingBox();
                const work = await content.locator('dd').first().boundingBox();
                const expenses = await content.locator('dd').nth(1).boundingBox();
                expect(work.y).toBeGreaterThanOrEqual(heading.y + heading.height);
                expect(expenses.y).toBeGreaterThanOrEqual(work.y + work.height);
                expect(Math.abs(work.x - heading.x)).toBeLessThanOrEqual(1);
                expect(Math.abs(expenses.x - work.x)).toBeLessThanOrEqual(1);
                const workValue = await content.getByText('€2700.00', { exact: true }).boundingBox();
                const expenseValue = await content.getByText('€84.00', { exact: true }).boundingBox();
                expect(Math.abs(workValue.x - work.x - 24)).toBeLessThanOrEqual(1);
                expect(Math.abs(expenseValue.x - workValue.x)).toBeLessThanOrEqual(1);
                const row = page.getByTestId(`${scope}-metrics-row`);
                const heights = await row.evaluate(element => [...element.children].map(card => card.getBoundingClientRect().height));
                expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
                await row.screenshot({ path: testInfo.outputPath(`${scope}-unbilled-${theme}.png`) });
                expect(await content.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            }

            // Preserve separate currencies, with enough room to wrap on a phone.
            await page.evaluate(async () => {
                const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
                window.__TASKTIME_STORE__.expenses.set('usd', objectToYMap({ id: 'usd', title: 'Other currency', date: '2026-09-14', amount: 12345.67, currency: 'USD', clientId: 'studio', projectId: 'website', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false }));
            });
            const content = page.getByTestId('client-unbilled-metric-content');
            await expect(content).toContainText('EUR');
            await expect(content).toContainText('USD');
            expect(await content.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await content.screenshot({ path: testInfo.outputPath(`unbilled-multiple-currencies-${theme}.png`) });

            // Billed expenses must not leave an empty secondary row behind.
            await page.evaluate(() => {
                for (const expense of window.__TASKTIME_STORE__.expenses.values()) {
                    expense.set('billingStatus', 'billed');
                }
            });
            await expect(content).toContainText('€2700.00');
            await expect(content.getByText('Unbilled', { exact: true })).toBeVisible();
            await expect(content.getByText('Expenses', { exact: true })).toHaveCount(0);
            await expect(content.getByText('Work', { exact: true })).toHaveClass('sr-only');
            await content.screenshot({ path: testInfo.outputPath(`unbilled-work-only-${theme}.png`) });

            // An expense remains clearly identified even when there is no work.
            await page.evaluate(() => {
                const store = window.__TASKTIME_STORE__;
                store.expenses.get('travel').set('billingStatus', 'unbilled');
                store.activeTimeEntries.delete('work');
            });
            await expect(content.getByText('Work', { exact: true })).toHaveClass('sr-only');
            await expect(content.getByText('Expenses', { exact: true })).toHaveClass('sr-only');
            await expect(content).toContainText('€0.00');
            await expect(content).toContainText('€84.00');
            await expect(content).not.toContainText('€2700.00');
        });
    }
}
