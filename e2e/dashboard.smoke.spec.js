import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

async function seedDashboard(page, liveClock = false) {
    const time = new Date('2026-09-25T12:00:00+02:00');
    if (liveClock) await page.clock.install({ time });
    else await page.clock.setFixedTime(time);
    await page.addInitScript(() => {
        localStorage.setItem('tasktime-onboarding-completed', 'true');
        localStorage.setItem('tasktime-dark-mode', 'true');
    });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Reports Overview' })).toBeVisible();
    await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        // This is an isolated browser context; replace only its generated welcome example.
        store.tasks.clear();
        store.projects.clear();
        store.activeTimeEntries.clear();
        store.preferences.set('currency', 'EUR');
        store.preferences.set('theme', 'dark');
        store.clients.set('client', { id: 'client', title: 'Acme Studio', defaultCurrency: 'EUR' });
        store.projects.set('project', { id: 'project', title: 'Website redesign', hourlyRate: 100, preferredClientId: 'client', invoiceIds: [], isPersonal: false });
        store.projects.set('internal', { id: 'internal', title: 'Internal work', isPersonal: true, invoiceIds: [] });
        const tasks = [
            { id: 'billable', projectId: 'project', title: 'Build the dashboard', billable: true, startDate: '2026-09-25' },
            { id: 'non-billable', projectId: 'internal', title: 'Review customer feedback', billable: false, startDate: '2026-09-25' },
            { id: 'overdue', projectId: 'project', title: 'Prepare the invoice', billable: true, startDate: '2026-09-24' },
            { id: 'upcoming', projectId: 'project', title: 'Plan next month’s work with a longer task title', billable: true, startDate: '2026-09-28' },
        ];
        tasks.forEach(task => store.tasks.set(task.id, task));
        store.activeTimeEntries.doc.transact(() => {
            for (let day = 1; day <= 25; day++) {
                const start = new Date(2026, 8, day, 9).getTime();
                const billable = day === 13 ? 4.5 * 3600000 : (day % 5 + 1) * 60 * 60000;
                const nonBillable = day === 13 ? 4 * 3600000 : (day % 3 + 1) * 20 * 60000;
                store.activeTimeEntries.set(`b-${day}`, { id: `b-${day}`, taskId: 'billable', start, end: start + billable, billedDurationMs: billable + 600000 });
                store.activeTimeEntries.set(`n-${day}`, { id: `n-${day}`, taskId: 'non-billable', start: start + billable, end: start + billable + nonBillable });
            }
        });
        const priorStart = new Date(2026, 7, 8, 9).getTime();
        store.activeTimeEntries.set('prior-month', { id: 'prior-month', taskId: 'billable', start: priorStart, end: priorStart + 12 * 3600000 });
        const oldStart = new Date(2024, 1, 29, 10).getTime();
        const archivedTasks = await store.loadArchivedTasks();
        archivedTasks.set('old-task', { id: 'old-task', title: 'Historical billable work', projectId: 'project', billable: true, archived: true });
        const oldEntries = await store.loadEntriesForYear(2024);
        oldEntries.set('old-entry', { id: 'old-entry', taskId: 'old-task', start: oldStart, end: oldStart + 7200000 });
        store.invoices.set('overdue-invoice', { id: 'overdue-invoice', invoiceNumber: '2025-001', date: '2025-12-01', dueDate: '2025-12-31', status: 'sent', total: 1250, subtotal: 1250, currency: 'EUR', clientId: 'client', projectId: 'project', items: [], tasks: [] });
        const expense = { title: 'Software subscription', amount: 29, currency: 'EUR', amountType: 'fixed', paymentMode: 'manual', isRecurring: false, isPersonal: false, billable: false, isTaxExempt: true };
        store.expenses.set('paid-expense', { ...expense, id: 'paid-expense', date: '2026-09-10', paymentStatus: 'paid', paidOn: '2026-09-10' });
        store.expenses.set('upcoming-expense', { ...expense, id: 'upcoming-expense', date: '2026-09-28', paymentStatus: 'unpaid', paidOn: null });
        await store.docManager.flushPersistence();
    });
    // Reopen against persisted source data, including the newly available archived year.
    await page.reload();
    await expect(page.getByRole('region', { name: 'Upcoming' }).getByText('Software subscription')).toBeVisible();
    await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
    expect(await page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(51);
}

test.describe('Dashboard smoke', () => {
    test('keeps a standalone task moved to a no-client project non-billable after reload', async ({ page }) => {
        await seedDashboard(page);
        const reports = page.getByRole('region', { name: 'Reports Overview' });
        const entriesBefore = await page.evaluate(() => JSON.stringify(Array.from(window.__TASKTIME_STORE__.activeTimeEntries.values())));
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.tasks.set('billable', { ...store.tasks.get('billable'), projectId: null, billable: true });
        });
        await expect(reports.getByRole('row', { name: '25 Sep 0s 1h 40m 1h 40m', exact: true })).toHaveCount(1);
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.tasks.set('billable', { ...store.tasks.get('billable'), projectId: 'internal' });
        });
        await expect(reports.getByRole('row', { name: '25 Sep 0s 1h 40m 1h 40m', exact: true })).toHaveCount(1);
        await page.reload();
        await expect(reports.getByRole('row', { name: '25 Sep 0s 1h 40m 1h 40m', exact: true })).toHaveCount(1);
        expect(await page.evaluate(() => JSON.stringify(Array.from(window.__TASKTIME_STORE__.activeTimeEntries.values())))).toBe(entriesBefore);
        // Restoring a client relationship uses the retained preference immediately.
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.tasks.set('billable', { ...store.tasks.get('billable'), projectId: 'project' });
        });
        await expect(reports.getByRole('row', { name: '25 Sep 1h 40m 1h 40m', exact: true })).toHaveCount(1);
    });

    test('updates live tracked time each minute without changing financial values or writing entries', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await seedDashboard(page, true);
        await page.clock.pauseAt(new Date('2026-09-25T12:01:00+02:00'));
        const summary = page.getByRole('region', { name: 'Dashboard summary' });
        const reports = page.getByRole('region', { name: 'Reports Overview' });
        const today = summary.getByRole('heading', { name: 'Tracked today', exact: true }).locator('../..');
        const tracked = reports.getByRole('heading', { name: 'Tracked time', exact: true }).locator('../..');
        const unbilled = reports.getByRole('heading', { name: 'Unbilled amount', exact: true }).locator('../..');
        const moneyBefore = await unbilled.innerText();
        await expect(today).toContainText('1h 40m');
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.timers.set('project', { projectId: 'project', taskId: 'billable', timerInstanceId: 'dashboard-live',
                startTime: Date.now() - 3600000, paused: false, pausedElapsedTime: 0 });
            window.__dashboardLiveWrites = 0;
            store.timers.doc.on('update', () => window.__dashboardLiveWrites++);
            store.activeEntriesDoc.on('update', () => window.__dashboardLiveWrites++);
        });
        await expect(today).toContainText('2h 40m');
        await expect(tracked).toContainText('incl. active');
        await expect(reports.getByRole('row', { name: '25 Sep 2h 40m 2h 40m', exact: true })).toHaveCount(1);
        const initialTracked = await tracked.innerText();
        await page.clock.runFor(30000);
        expect(await tracked.innerText()).toBe(initialTracked);
        await page.clock.runFor(30000);
        await expect(today).toContainText('2h 41m');
        await expect(reports.getByRole('row', { name: '25 Sep 2h 1m 40m 2h 41m', exact: true })).toHaveCount(1);
        expect(await unbilled.innerText()).toBe(moneyBefore);
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(51);
        expect(await page.evaluate(() => window.__dashboardLiveWrites)).toBe(0);
        await page.getByTitle('Pause Timer', { exact: true }).first().click();
        await page.clock.runFor(60000);
        await expect(today).toContainText('2h 41m');
        expect(await unbilled.innerText()).toBe(moneyBefore);
        await page.getByTitle('Save & Stop Timer', { exact: true }).first().click();
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.timers.size)).toBe(0);
        await expect(today).toContainText('2h 41m');
        await expect(tracked).not.toContainText('incl. active');
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(52);
        await page.reload();
        await expect(today).toContainText('2h 41m');
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(52);
        expect(errors).toEqual([]);
    });

    test('keeps other tasks in a running timer project from opening on the dashboard', async ({ page }) => {
        await seedDashboard(page);
        await page.evaluate(() => {
            window.__TASKTIME_STORE__.timers.set('project', {
                projectId: 'project',
                taskId: 'billable',
                timerInstanceId: 'dashboard-disabled-task',
                startTime: Date.now() - 60_000,
                paused: false,
                pausedElapsedTime: 0,
            });
        });

        const today = page.getByRole('region', { name: /^To Do Today/ });
        const upcoming = page.getByRole('region', { name: 'Upcoming' });
        const activeTaskTitle = today.getByRole('button', { name: 'Build the dashboard', exact: true });
        const upcomingBlockedTitle = upcoming.getByRole('button', {
            name: 'Plan next month’s work with a longer task title',
            exact: true,
        });

        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            const blockedTaskTitles = page.getByRole('button', { name: 'Prepare the invoice', exact: true });
            await expect(blockedTaskTitles).toHaveCount(2);
            await expect(blockedTaskTitles.nth(0)).toBeDisabled();
            await expect(blockedTaskTitles.nth(1)).toBeDisabled();
            await expect(blockedTaskTitles.nth(0)).toHaveAttribute(
                'title',
                'Another task in this project is currently running',
            );
            await expect(upcomingBlockedTitle).toBeDisabled();
            await expect(activeTaskTitle).toBeEnabled();
            await expect(today.getByRole('button', { name: 'Open task details' })).toHaveCount(0);
        }

        await page.getByRole('button', { name: 'Prepare the invoice', exact: true }).first()
            .evaluate((element) => element.click());
        await expect(page.getByRole('dialog', { name: 'Prepare the invoice' })).toHaveCount(0);

        await activeTaskTitle.click();
        await expect(page.getByRole('dialog', { name: 'Build the dashboard' })).toBeVisible();
    });

    test('keeps project folder icons compact, metadata aligned and project names keyboard navigable in both themes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await seedDashboard(page);
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.projects.set('project', { ...store.projects.get('project'), color: '#eab308', title: 'Website redesign with a longer project name' });
            store.projects.set('internal', { ...store.projects.get('internal'), color: null });
            store.clients.set('client', { ...store.clients.get('client'), color: '#172554' });
            store.projects.set('inherited', { id: 'inherited', title: 'Client color', preferredClientId: 'client', color: null, isPersonal: false, invoiceIds: [] });
        });
        const projects = page.getByRole('region', { name: 'Projects', exact: true });
        const projectName = projects.getByRole('button', { name: 'Website redesign with a longer project name', exact: true });
        const icon = projectName.getByTestId('project-color-icon');
        const metadata = projectName.locator('xpath=following-sibling::*[@data-testid="project-metadata"]');
        for (const theme of ['dark', 'light']) {
            await page.setViewportSize({ width: 1440, height: 900 });
            if (theme === 'light') {
                await page.getByRole('button', { name: 'Light Mode', exact: true }).click();
                await expect(page.locator('html')).not.toHaveClass(/dark/);
            } else await expect(page.locator('html')).toHaveClass(/dark/);
            await expect(icon).toHaveClass(/lucide-folder-closed/);
            await expect(icon).toHaveCSS('color', 'rgb(234, 179, 8)');
            const inherited = projects.getByRole('button', { name: 'Client color', exact: true });
            await expect(inherited.getByTestId('project-color-icon')).toHaveCSS('color', 'rgb(23, 37, 84)');
            for (const width of [1440, 390, 320]) {
                await page.setViewportSize({ width, height: 900 });
                await projectName.scrollIntoViewIfNeeded();
                const bounds = await icon.boundingBox();
                const metadataBounds = await metadata.boundingBox();
                expect(bounds.width).toBe(14);
                expect(bounds.height).toBe(14);
                expect(Math.abs(metadataBounds.x - bounds.x)).toBeLessThan(1);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                await projectName.focus();
                await expect(projectName).toBeFocused();
                await projects.screenshot({ path: `test-results/project-icons-${width}-${theme}.png` });
            }
        }
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/projects\/project(?:\?|$)/);
        expect(errors).toEqual([]);
    });

    test('survives successful currency-rate loading and reloads with the cached rates', async ({ page }) => {
        const errors = [];
        let requests = 0;
        let releaseRates;
        const ratesReady = new Promise(resolve => { releaseRates = resolve; });
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://open.er-api.com/v6/latest/USD', async route => {
            requests++;
            await ratesReady;
            await route.fulfill({ json: { rates: { USD: 1, EUR: 0.8 } } });
        });
        await seedDashboard(page);
        await page.evaluate(async () => {
            const store = window.__TASKTIME_STORE__;
            const expense = store.expenses.get('paid-expense');
            store.expenses.set(expense.id, { ...expense, currency: 'USD', amount: 100 });
            await store.docManager.flushPersistence();
        });
        await expect.poll(() => requests).toBe(1);
        const reports = page.getByRole('region', { name: 'Reports Overview' });
        await expect(reports).toBeVisible();
        releaseRates();
        const expensesCard = reports.getByRole('heading', { name: 'Expenses', exact: true }).locator('../..');
        await expect(expensesCard).toContainText('€80.00');
        await expect(page.getByRole('heading', { name: 'Something went wrong', exact: true })).toHaveCount(0);
        await page.reload();
        await expect(expensesCard).toContainText('€80.00');
        await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        expect(requests).toBe(1);
        expect(errors).toEqual([]);
    });

    test('reconciles stacked time, historical periods and unchanged summary timeframes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewportSize({ width: 1440, height: 1100 });
        await seedDashboard(page);
        const summary = page.getByRole('region', { name: 'Dashboard summary' });
        await expect(summary).toContainText('€1250.00');
        const before = await summary.innerText();
        const reports = page.getByRole('region', { name: 'Reports Overview' });
        await expect(reports.getByText('Daily values', { exact: true })).toHaveCount(0);
        await expect(reports.getByText(/Upcoming expenses in this period/)).toHaveCount(0);
        await expect(reports.getByRole('row', { name: '25 Sep 1h 40m 1h 40m' })).toHaveCount(1);
        await expect(reports.locator('.recharts-cartesian-axis-tick-value').filter({ hasText: /^9h$/ })).toBeVisible();
        const currentTrackedCard = reports.getByRole('heading', { name: 'Tracked time', exact: true }).locator('../..');
        await expect(currentTrackedCard).toContainText('+695.8%');
        const chart = page.getByRole('application', { name: 'Daily tracked hours, split into billable and non-billable time' });
        await chart.focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Non-billable');
        await page.keyboard.press('Tab');
        await reports.getByRole('combobox', { name: 'Dashboard report period' }).click();
        await page.getByRole('option', { name: 'February 2024', exact: true }).click();
        await expect(reports.getByRole('heading', { name: 'Tracked time', exact: true }).locator('../..')).toContainText('2h');
        await expect(reports.locator('.recharts-cartesian-axis-tick-value').filter({ hasText: /^8h$/ })).toBeVisible();
        expect(await summary.innerText()).toBe(before);
        await page.context().setOffline(true);
        await reports.getByRole('combobox', { name: 'Dashboard report period' }).click();
        await page.getByRole('option', { name: 'This Month', exact: true }).click();
        await expect(reports.getByTestId('dashboard-hours-chart')).toBeVisible();
        await expect(reports.getByText('Loading report…')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('keeps phone actions first and stats horizontally scrollable, with no page overflow', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await seedDashboard(page);
        await expect(page.getByText('Next 7 days', { exact: true })).toHaveCount(0);
        for (const width of [390, 320, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            const today = await page.getByRole('region', { name: /^To Do Today/ }).boundingBox();
            const upcoming = await page.getByRole('region', { name: 'Upcoming' }).boundingBox();
            const summary = await page.getByRole('region', { name: 'Dashboard summary' }).boundingBox();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            if (width < 768) {
                expect(today.y).toBeLessThan(upcoming.y);
                expect(upcoming.y).toBeLessThan(summary.y);
                expect(await page.getByRole('region', { name: 'Dashboard summary' }).evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
            } else expect(summary.y).toBeLessThan(today.y);
            if (width === 1440) {
                expect(Math.abs(today.y - upcoming.y)).toBeLessThan(2);
                const metrics = await page.getByTestId('dashboard-report-metrics').boundingBox();
                const chartPanel = await page.getByRole('region', { name: 'Hours tracked', exact: true }).boundingBox();
                expect(Math.abs(metrics.y - chartPanel.y)).toBeLessThan(2);
                expect(Math.abs(metrics.height - chartPanel.height)).toBeLessThan(2);
                const legend = await page.getByRole('group', { name: 'Chart legend' }).boundingBox();
                const title = await page.getByRole('heading', { name: 'Hours tracked', exact: true }).boundingBox();
                expect(Math.abs(legend.y + legend.height / 2 - title.y - title.height / 2)).toBeLessThan(2);
                expect(Math.abs(legend.x + legend.width - chartPanel.x - chartPanel.width)).toBeLessThan(20);
            }
            await page.screenshot({ path: `test-results/dashboard-${width}-dark.png`, fullPage: true });
        }
        await page.getByRole('button', { name: 'Light Mode', exact: true }).click();
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        await page.screenshot({ path: 'test-results/dashboard-1440-light.png', fullPage: true });
    });
});
