import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

const publicRouteExpectations = [
    {
        path: '/blog/',
        title: 'TaskTime Blog',
        heading: 'Our Blog',
    },
    {
        path: '/privacy/',
        title: 'Privacy Policy | TaskTime',
        heading: 'Privacy Policy',
    },
    {
        path: '/terms/',
        title: 'Terms & Conditions | TaskTime',
        heading: 'Terms & Conditions',
    },
    {
        path: '/contact/',
        title: 'Contact | TaskTime',
        heading: 'Contact',
    },
];

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

async function expectStaticPublicRoute(page, { path, title, heading }) {
    await page.goto(path);

    await expect(page).toHaveTitle(title);
    await expect(page.locator('#root')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
}

test.describe('PWA smoke', () => {
    test('boots from the cached app shell while offline after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const onlinePage = await context.newPage();
            const projectTitle = `Playwright Cached Boot Project ${Date.now()}`;

            await onlinePage.goto('/projects');
            await expect(onlinePage.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

            await createPersonalProject(onlinePage, projectTitle);

            await waitForActiveServiceWorker(onlinePage);

            await context.setOffline(true);

            const offlinePage = await context.newPage();
            await offlinePage.goto('/projects');

            await expect(offlinePage.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
            await expect(offlinePage.getByRole('heading', { name: projectTitle })).toBeVisible();
            await expect(offlinePage.getByText("You're offline")).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test('keeps static public routes out of the app shell after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const page = await context.newPage();

            await page.goto('/');
            await waitForActiveServiceWorker(page);

            for (const routeExpectation of publicRouteExpectations) {
                await test.step(`serves static html for ${routeExpectation.path}`, async () => {
                    await expectStaticPublicRoute(page, routeExpectation);
                });
            }
        } finally {
            await context.close();
        }
    });
});