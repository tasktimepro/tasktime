import { expect, test as base } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import { buildLocalReviewBillingCatalog } from '../src/config/localReviewPricing';

// Exercise the billing-enabled app and real Vite module graph. The isolated
// server lets us emit a file-watch event without editing shared source files
// or hot-updating the developer's running app.
const test = base.extend({
    reportsServer: [async ({ browserName }, provide) => {
        const server = await createServer({
            cacheDir: `node_modules/.vite-reports-navigation-${browserName}`,
            define: {
                'import.meta.env.VITE_REPORTS_ENTITLEMENT_ENFORCEMENT': JSON.stringify('true'),
                'import.meta.env.VITE_BILLING_UI_ENABLED': JSON.stringify('true'),
            },
            server: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
        });
        await server.listen();
        try {
            await provide(server);
        } finally {
            await server.close();
        }
    }, { scope: 'worker' }],
});

test.beforeEach(async ({ page, reportsServer }) => {
    await page.route('**/billing/catalog*', route => route.fulfill({ json: buildLocalReviewBillingCatalog() }));
    await page.route('https://open.er-api.com/**', route => route.fulfill({ json: { rates: { EUR: 1, USD: 1 } } }));
    await page.addInitScript(() => {
        localStorage.setItem('tasktime-onboarding-completed', 'true');
        window.__reportsDocument = crypto.randomUUID();
    });
    await page.goto(`http://127.0.0.1:${reportsServer.httpServer.address().port}/expenses`);
    await expect(page.getByRole('region', { name: 'Expense summary' })).toHaveAttribute('aria-busy', 'false');
});

async function hotUpdateModal(page, server) {
    const documentId = await page.evaluate(() => window.__reportsDocument);
    const update = page.waitForEvent('console', {
        predicate: message => message.text().includes('hot updated: /src/components/Modal.jsx'),
    });
    server.watcher.emit('change', path.resolve('src/components/Modal.jsx'));
    await update;
    expect(await page.evaluate(() => window.__reportsDocument)).toBe(documentId);
}

function trackRuntimeErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // React's ErrorBoundary handles this failure, so pageerror alone misses it.
    page.on('console', message => {
        if (message.type() === 'error' && /ErrorBoundary caught|must be used within/.test(message.text())) {
            errors.push(message.text());
        }
    });
    return errors;
}

test('opens Reports after a shared-modal hot update and preserves local records and access gates', async ({ page, reportsServer }) => {
    const errors = trackRuntimeErrors(page);
    const advancedRequests = [];
    page.on('request', request => {
        if (request.url().includes('/AdvancedReportsWorkspace')) advancedRequests.push(request.url());
    });
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        window.__reportsStore = store;
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        store.preferences.set('currency', 'EUR');
        store.expenses.set('reports-navigation', {
            id: 'reports-navigation', title: 'Reports navigation expense', amount: 125,
            currency: 'EUR', date, paidOn: date, paymentStatus: 'paid',
            paymentMode: 'manual', isPersonal: true, isRecurring: false,
            billable: false, billingStatus: 'unbilled', isTaxExempt: true,
            amountType: 'fixed', createdAt: today.getTime(),
        });
        await store.docManager.flushPersistence();
    });
    await hotUpdateModal(page, reportsServer);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    const overview = page.getByRole('region', { name: 'Current month' });
    await expect(overview).toContainText('€125.00');
    expect(await page.evaluate(() => window.__TASKTIME_STORE__ === window.__reportsStore)).toBe(true);
    await page.getByRole('tab', { name: 'Monthly', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back to free overview' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to free overview' }).click();
    await expect(overview).toContainText('€125.00');
    await page.reload();
    await expect(overview).toContainText('€125.00');
    await page.getByRole('button', { name: 'Expenses', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Expense summary' })).toContainText('€125.00');
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(overview).toContainText('€125.00');
    expect(advancedRequests).toEqual([]);
    expect(errors).toEqual([]);
});

test('retains billing and agent providers on first Account navigation after a shared-modal hot update', async ({ page, reportsServer }) => {
    const errors = trackRuntimeErrors(page);
    await hotUpdateModal(page, reportsServer);
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('tab', { name: 'Plan & Billing', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Plan options', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Agent Access', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agent Access', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});
