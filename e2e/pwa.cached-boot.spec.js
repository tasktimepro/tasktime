import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

test.describe('PWA smoke', () => {
    test('boots from the cached app shell while offline after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const onlinePage = await context.newPage();
            const projectTitle = `Playwright Cached Boot Project ${Date.now()}`;

            await onlinePage.goto('/projects');
            await expect(onlinePage.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

            await createPersonalProject(onlinePage, projectTitle);

            await expect.poll(async () => {
                return onlinePage.evaluate(async () => {
                    const registration = await navigator.serviceWorker.ready;
                    return Boolean(registration.active);
                });
            }).toBe(true);

            await onlinePage.reload();

            await expect.poll(() => {
                return onlinePage.evaluate(() => Boolean(navigator.serviceWorker.controller));
            }).toBe(true);

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
});