import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

async function waitForActiveServiceWorker(page) {
    await expect.poll(async () => {
        return page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return Boolean(registration.active);
        });
    }).toBe(true);

    await page.goto(page.url(), { waitUntil: 'domcontentloaded' });

    await expect.poll(() => {
        return page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    }).toBe(true);
}

test.describe('PWA smoke', () => {
    test('retains the app install manifest, same-origin identity and real icon resources', async ({ page, request }) => {
        await page.goto('/');
        await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
        const robots = await (await request.get('/robots.txt')).text();
        expect(robots).toContain('Allow: /');
        expect(robots).not.toMatch(/^Disallow:\s*\/$/m);
        const response = await request.get('/manifest.json');
        expect(response.status()).toBe(200);
        const manifest = await response.json();
        expect(manifest.name).toBe('TaskTime Pro');
        expect(manifest.start_url).toBe('/');
        expect(manifest.id ?? manifest.start_url).toBe('/');
        expect(manifest.scope ?? '/').toBe('/');
        expect(manifest.display).toBe('standalone');
        for (const size of [192, 512]) {
            const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
            expect(icon.type).toBe('image/png');
            expect(icon.src).toMatch(/^\/icons\//);
            const dimensions = await page.evaluate(async src => {
                const image = new Image();
                image.src = src;
                await image.decode();
                return [image.naturalWidth, image.naturalHeight];
            }, icon.src);
            expect(dimensions).toEqual([size, size]);
        }
        await waitForActiveServiceWorker(page);
        expect(await page.evaluate(async () => new URL((await navigator.serviceWorker.ready).scope).origin)).toBe(new URL(page.url()).origin);
    });

    test('stays usable offline after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const page = await context.newPage();
            const projectTitle = `Playwright Cached Boot Project ${Date.now()}`;

            await page.goto('/projects');
            await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

            await createPersonalProject(page, projectTitle);

            await waitForActiveServiceWorker(page);

            await context.setOffline(true);

            await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
            await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
            await expect(page.getByText("You're offline")).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test('opens the dashboard chart offline before its first dashboard visit', async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByTestId('dashboard-hours-chart')).toHaveCount(0);
        await waitForActiveServiceWorker(page);
        await context.setOffline(true);
        await page.goto('/');
        await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        await expect(page.getByText('Daily values', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('table', { name: 'Actual time tracked each day' })).toHaveCount(1);
        await page.getByRole('application', { name: 'Daily tracked hours, split into billable and non-billable time' }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Non-billable');
        await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Total');
        expect(errors).toEqual([]);
    });

    test('opens the expense overview and chart offline before its first expense visit', async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await waitForActiveServiceWorker(page);
        await context.setOffline(true);
        await page.goto('/expenses');
        await expect(page.getByRole('region', { name: 'Expense summary' })).toBeVisible();
        await expect(page.getByRole('application', { name: 'Monthly paid expenses' })).toBeVisible();
        await expect(page.getByRole('table', { name: 'Monthly paid expense values' })).toHaveCount(1);
        await expect(page.getByText('Loading expense overview…')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('excludes public navigation from the active service worker and emits a site redirect', async ({ page, context }) => {
        await page.goto('/');
        await waitForActiveServiceWorker(page);
        let redirect;
        // Intercept the original navigation: Playwright does not route a second
        // request in an HTTP redirect chain. Never visit the live site in CI.
        // This handler is reached only when the active SW lets the request out.
        await page.route('**/privacy/?from=app', async route => {
            const response = await route.fetch({ maxRedirects: 0 });
            redirect = { status: response.status(), location: response.headers().location };
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Public site</h1>' });
        });
        await page.goto('/privacy/?from=app');
        expect(redirect).toEqual({ status: 302, location: 'https://tasktime.pro/privacy/?from=app' });
        await expect(page.getByRole('heading', { name: 'Public site' })).toBeVisible();
        await expect(page.locator('#root')).toHaveCount(0);
        await context.setOffline(true);
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
    });
});
