import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

async function seedExpenses(page) {
    await page.clock.setFixedTime(new Date('2026-09-15T12:00:00+02:00'));
    await page.route('https://open.er-api.com/v6/latest/USD', route => route.fulfill({ json: { rates: { USD: 1, EUR: 0.8 } } }));
    await page.addInitScript(() => {
        localStorage.setItem('tasktime-onboarding-completed', 'true');
        localStorage.setItem('tasktime-dark-mode', 'true');
    });
    await page.goto('/expenses');
    await expect(page.getByRole('region', { name: 'Expense summary' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Expense summary' })).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        store.expenses.clear();
        store.expenseRecurrences.clear();
        store.preferences.set('currency', 'EUR');
        store.preferences.set('theme', 'dark');
        for (const [id, name] of [['software', 'Software & subscriptions'], ['hardware', 'Hardware']]) store.expenseCategories.set(id, { id, name, isDefault: false, archived: false });
        const base = { currency: 'EUR', amount: 100, paymentStatus: 'paid', paidOn: '2026-09-04', date: '2026-09-03', isPersonal: true, billable: false, billingStatus: 'unbilled', isRecurring: false, isTaxExempt: true, paymentMode: 'manual', amountType: 'fixed', createdAt: new Date('2026-09-01T12:00:00').getTime() };
        const records = [
            { id: 'software', title: 'Design software', categoryId: 'software', supplierName: 'Design Tools' },
            { id: 'hardware', title: 'Keyboard', categoryId: 'hardware', currency: 'USD', amount: 100, date: '2026-09-08', paidOn: '2026-09-08', paymentCurrencySnapshot: { sourceCurrency: 'USD', sourceAmount: 100, preferredCurrencyAtPayment: 'EUR', preferredCurrencyAmount: 80, capturedAt: 1 } },
            { id: 'past', title: 'August software', categoryId: 'software', amount: 200, date: '2026-08-05', paidOn: '2026-08-05' },
            { id: 'old', title: 'Older unpaid expense', amount: 25, date: '2026-08-01', paymentStatus: 'unpaid', paidOn: null },
            { id: 'automatic', title: 'Automatic subscription', amount: 30, date: '2026-09-20', paymentMode: 'auto', paidOn: null },
            { id: 'future', title: 'Domain renewal', amount: 20, date: '2026-09-19', paymentStatus: 'unpaid', paidOn: null },
        ];
        records.forEach(record => store.expenses.set(record.id, { ...base, ...record }));
        store.expenseRecurrences.set('monthly', { ...base, id: 'monthly', title: 'Monthly subscription', amount: 49, active: true, repeat: 'monthly', startDate: '2026-08-28', monthlyType: 'specific', monthlyDay: 28, lastGeneratedDate: '2026-08-28', categoryId: 'software' });
        store.expenseRecurrences.set('yearly', { ...base, id: 'yearly', title: 'Yearly membership', amount: 120, active: true, repeat: 'yearly', startDate: '2026-01-01', lastGeneratedDate: '2026-01-01' });
        await store.docManager.flushPersistence();
    });
    await expect(page.getByRole('heading', { name: 'This month spend' }).locator('..')).toContainText('€180.00');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'This month spend' }).locator('..')).toContainText('€180.00');
}

test('reconciles spend, schedules, filters and recorded payment actions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await seedExpenses(page);
    const summary = page.getByRole('region', { name: 'Expense summary' });
    const topCategoryCard = summary.getByRole('heading', { name: 'Top category', exact: true }).locator('..');
    const topCategoryName = topCategoryCard.getByText('Software & subscriptions', { exact: true });
    const topCategoryRing = topCategoryCard.locator('svg[viewBox="0 0 64 64"]');
    await expect(topCategoryName).toHaveCSS('text-overflow', 'ellipsis');
    expect(await topCategoryName.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    const [nameBox, ringBox] = await Promise.all([topCategoryName.boundingBox(), topCategoryRing.boundingBox()]);
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(ringBox.x);
    const recurringCard = summary.getByRole('button', { name: 'Manage recurring expenses' });
    expect((await recurringCard.boundingBox()).height).toBeGreaterThan(60);
    await recurringCard.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Recurring Expenses', exact: true })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: 'Expenses', exact: true }).click();
    await expect(summary).toContainText('−10%');
    await expect(summary.getByRole('heading', { name: 'Recurring expenses', exact: true }).locator('..')).toContainText('€59.00');
    await expect(summary.getByRole('heading', { name: 'Upcoming payments', exact: true }).locator('..')).toContainText('€69.00');
    await expect(page.getByRole('tab', { name: 'Outstanding (1)' })).toBeVisible();
    const expenseStatusTabs = page.getByRole('tab', { name: 'Outstanding (1)' }).locator('xpath=ancestor::*[@role="tablist"][1]');
    await expect(expenseStatusTabs).toHaveCSS('overflow-x', 'auto');
    await expect(expenseStatusTabs).toHaveCSS('overflow-y', 'hidden');
    await expect(page.getByRole('row', { name: 'September 2026 €180.00' })).toHaveCount(1);
    const chart = page.getByRole('application', { name: 'Monthly paid expenses' });
    await chart.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible();
    const upcomingCard = page.getByRole('button', { name: 'View upcoming expenses', exact: true });
    expect((await upcomingCard.boundingBox()).height).toBeGreaterThan(60);
    await upcomingCard.click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole('tab', { name: 'Upcoming (2)' })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: 'Outstanding (1)' }).click();
    await page.getByRole('button', { name: /Older unpaid expense/ }).first().getByRole('button', { name: 'Mark as Paid' }).click();
    await expect(page.getByRole('tab', { name: 'Outstanding (0)' })).toBeVisible();
    // The payment date does not move an August expense into September spend.
    await expect(summary.getByRole('heading', { name: 'This month spend' }).locator('..')).toContainText('€180.00');
    await page.getByRole('button', { name: 'Expense period', exact: true }).click();
    await page.getByRole('button', { name: 'Last Month', exact: true }).click();
    await expect(summary.getByRole('heading', { name: 'Last month spend' }).locator('..')).toContainText('€225.00');
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Expense period', exact: true }).click();
    await page.getByRole('button', { name: 'This Month', exact: true }).click();
    await expect(summary.getByRole('heading', { name: 'This month spend' }).locator('..')).toContainText('€180.00');
    expect(errors).toEqual([]);
});

test('keeps the original list before insights on phones with accessible actions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await seedExpenses(page);
    await expect(page.getByRole('tab', { name: 'Outstanding (1)' })).toBeVisible();
    for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1100 });
        const summary = page.getByRole('region', { name: 'Expense summary' });
        await expect(summary).toBeVisible();
        await expect(page.getByRole('application', { name: 'Monthly paid expenses' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        if (width < 768) {
            expect(await page.getByRole('tab', { name: 'Outstanding (1)' }).evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('[data-testid="expense-insights"]')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
            expect(await summary.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
            await expect(page.getByRole('button', { name: /Older unpaid expense/ }).first().getByRole('button', { name: 'Mark as Paid' })).toBeVisible();
        }
        await summary.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.querySelectorAll('*').forEach(element => { if (element.scrollTop) element.scrollTop = 0; }));
        await page.screenshot({ path: 'test-results/expenses-' + width + '-dark.png', fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.evaluate(() => window.__TASKTIME_STORE__.preferences.set('theme', 'light'));
    await page.screenshot({ path: 'test-results/expenses-1440-light.png', fullPage: true });
    expect(errors).toEqual([]);
});

test('opens 30-day activity in the shared modal with padded hover rows and working detail navigation', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await seedExpenses(page);
    await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        const base = store.expenses.get('software');
        for (let index = 0; index < 12; index++) {
            store.expenses.set('activity-' + index, { ...base, id: 'activity-' + index, title: 'Activity ' + index, paymentStatus: 'unpaid', paidOn: null });
        }
        for (const [id, date] of [['boundary', '2026-08-17'], ['excluded', '2026-08-16']]) {
            store.expenses.set(id, { ...base, id, title: id + ' activity', paymentStatus: 'unpaid', paidOn: null, createdAt: new Date(date + 'T12:00:00').getTime() });
        }
    });
    const card = page.locator('section[aria-labelledby="expense-activity-title"]');
    await expect(card.getByRole('listitem')).toHaveCount(3);
    const row = card.getByRole('listitem').first().getByRole('button');
    const serviceName = row.getByText('Domain renewal', { exact: true });
    const blue = await row.locator('svg').evaluate(element => getComputedStyle(element).color);
    await row.hover();
    await expect(row).toHaveCSS('cursor', 'pointer');
    await expect(serviceName).toHaveCSS('color', blue);
    expect(await row.evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(8);
    expect(await row.evaluate(element => parseFloat(getComputedStyle(element).paddingRight))).toBeGreaterThanOrEqual(8);
    const originalHeight = (await card.boundingBox()).height;
    const showMore = card.getByRole('button', { name: 'Show more' });
    await showMore.click();
    const modal = page.getByRole('dialog', { name: 'Recent activity', exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Last 30 days');
    await expect(modal.getByText('boundary activity', { exact: true })).toHaveCount(1);
    await expect(modal.getByText('excluded activity', { exact: true })).toHaveCount(0);
    await expect(modal.getByText('Upcoming payment', { exact: true })).toHaveCount(0);
    expect((await card.boundingBox()).height).toBe(originalHeight);
    await modal.getByText('Keyboard', { exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Keyboard', exact: true });
    await expect(details).toBeVisible();
    await details.getByRole('button', { name: 'Close dialog' }).click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(showMore).toBeFocused();
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await showMore.click();
        await expect(modal).toBeVisible();
        const bounds = await modal.boundingBox();
        expect(bounds.width).toBeLessThanOrEqual(width);
        expect(await modal.locator('.overflow-y-auto').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
        await page.screenshot({ path: 'test-results/expense-activity-modal-' + width + '.png' });
        await modal.getByRole('button', { name: 'Close dialog' }).click();
    }
    expect(errors).toEqual([]);
});
