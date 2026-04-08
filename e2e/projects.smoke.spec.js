import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

test.describe('Projects smoke', () => {

    test('creates the first personal project and keeps it after reload', async ({ page }) => {
        const projectTitle = `Playwright Personal Project ${Date.now()}`;

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByText('No projects')).toBeVisible();

        await createPersonalProject(page, projectTitle);

        await expect(page.getByText('Personal', { exact: true })).toBeVisible();
        await expect(page.getByText('No projects')).not.toBeVisible();

        await page.reload();

        await expect(page).toHaveURL(/\/projects$/);
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
        await expect(page.getByText('Personal', { exact: true })).toBeVisible();
    });
});