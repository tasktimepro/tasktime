import { expect, test } from '@playwright/test';
import { projectsHeadingName } from './helpers/tasktime.js';

test.describe('Offline smoke', () => {

    test('shows offline status, allows local project creation offline, and keeps it after reconnect', async ({ page }) => {
        const projectTitle = `Playwright Offline Project ${Date.now()}`;

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

        await page.context().setOffline(true);
        await page.evaluate(() => {
            window.dispatchEvent(new Event('offline'));
        });

        await expect(page.getByText("You're offline")).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Create First Project' }).click();

        const projectDialog = page.getByRole('dialog', { name: 'Create New Project' });
        await expect(projectDialog).toBeVisible();
        await projectDialog.getByLabel(/Project Title/i).fill(projectTitle);
        await projectDialog.getByLabel(/Personal project \(Not billable\)/i).click();
        await projectDialog.getByRole('button', { name: 'Create Project' }).click();

        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
        await expect(page.getByText("You're offline")).toBeVisible();

        await page.context().setOffline(false);
        await page.evaluate(() => {
            window.dispatchEvent(new Event('online'));
        });

        await expect(page.getByText("You're offline")).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

        await page.reload();

        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
    });
});