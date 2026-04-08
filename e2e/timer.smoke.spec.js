import { expect, test } from '@playwright/test';
import { createInlineTask, createPersonalProject, openProjectDashboard } from './helpers/tasktime.js';

test.describe('Timer smoke', () => {

    test('creates a time entry when stopping a timer and keeps it after reload', async ({ page }) => {
        const projectTitle = `Playwright Timer Project ${Date.now()}`;
        const taskTitle = `Playwright Timer Task ${Date.now()}`;

        await createPersonalProject(page, projectTitle);
        await openProjectDashboard(page, projectTitle);

        await expect(page.getByRole('heading', { name: /^Tasks \(0\)$/ })).toBeVisible();
        await createInlineTask(page, taskTitle);

        const taskRow = page
            .getByRole('button', { name: taskTitle, exact: true })
            .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]')
            .first();

        await taskRow.getByTitle('Start Timer').first().click();
        await page.waitForTimeout(2500);
        await taskRow.getByTitle('Save & Stop Timer').first().click();

        const timeEntriesDialog = page.getByRole('dialog', { name: `Time Entries - ${taskTitle}` });

        await page.getByTitle('View Time Entries').click();
        await expect(timeEntriesDialog.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        await expect(timeEntriesDialog.getByText('Total Time:').locator('..')).toContainText(/[1-9]\d*s/);
        await timeEntriesDialog.getByRole('button', { name: 'Close', exact: true }).click();

        await page.reload();

        await expect(page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();

        await page.getByTitle('View Time Entries').click();
        await expect(timeEntriesDialog.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        await expect(timeEntriesDialog.getByText('Total Time:').locator('..')).toContainText(/[1-9]\d*s/);
    });
});