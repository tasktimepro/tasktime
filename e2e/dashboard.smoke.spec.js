import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

async function seedDashboard(page) {
    await page.clock.setFixedTime(new Date('2026-09-25T12:00:00+02:00'));
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
