import { expect, test } from '@playwright/test';
import { createInlineTask, createPersonalProject, openProjectDashboard } from './helpers/tasktime.js';

test.describe('Tasks and time entries smoke', () => {

    test('creates a task, adds a time entry, and keeps it after reload', async ({ page }) => {
        const projectTitle = `Playwright Project ${Date.now()}`;
        const taskTitle = `Playwright Task ${Date.now()}`;

        await createPersonalProject(page, projectTitle);
        await openProjectDashboard(page, projectTitle);
        await expect(page.getByRole('heading', { name: /^Tasks \(0\)$/ })).toBeVisible();

        await createInlineTask(page, taskTitle);
        await expect(page.getByRole('heading', { name: /^Tasks \(1\)$/ })).toBeVisible();

        await page.getByTitle('View Time Entries').click();
        const timeEntriesDialog = page.getByRole('dialog', { name: `Time Entries - ${taskTitle}` });
        await expect(timeEntriesDialog).toBeVisible();
        await expect(timeEntriesDialog.getByText('No time entries found for this task')).toBeVisible();

        await timeEntriesDialog.getByRole('button', { name: 'Add Entry', exact: true }).click();
        const addEntryDialog = page.getByRole('dialog', { name: 'Add Time Entry' });
        await expect(addEntryDialog).toBeVisible();

        await addEntryDialog.getByLabel('Time spent').fill('1m');
        await addEntryDialog.getByRole('button', { name: 'Add Entry', exact: true }).click();

        await expect(timeEntriesDialog).toBeVisible();
        await expect(timeEntriesDialog.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        await expect(timeEntriesDialog.getByText('Total Time:').locator('..')).toContainText('1m');
        await timeEntriesDialog.getByRole('button', { name: 'Close', exact: true }).click();

        await page.reload();

        await expect(page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();

        await page.getByTitle('View Time Entries').click();
        await expect(timeEntriesDialog.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
        await expect(timeEntriesDialog.getByText('Total Time:').locator('..')).toContainText('1m');
    });
});