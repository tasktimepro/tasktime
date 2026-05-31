import { expect, test } from '@playwright/test';
import { createBusinessInfo, createBillableProject, createPersonalProject, openProjectDashboard, projectsHeadingName } from './helpers/tasktime.js';

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

    test('downloads a quote PDF for a quote-stage project without exposing invoice actions', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Quote Project ${now}`;
        const clientTitle = `Playwright Quote Client ${now}`;
        const clientName = `Quote Client ${now}`;
        const businessTitle = `Playwright Quote Business ${now}`;
        const expectedDate = new Date();
        const expectedQuoteDate = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;
        const expectedFilenamePrefix = projectTitle
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);

        await createBusinessInfo(page, {
            title: businessTitle,
            businessName: businessTitle,
            email: 'quotes@example.com',
        });

        await createBillableProject(page, {
            projectTitle,
            clientTitle,
            clientName,
            clientHourlyRate: 125,
            statusMode: 'quote',
            deadline: '2026-06-15',
            budgetAmount: 2400,
        });

        await openProjectDashboard(page, projectTitle);

        await expect(page.getByText('Quote stage')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Generate Quote' })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Generate Invoice/ })).toHaveCount(0);

        await page.getByRole('button', { name: 'Generate Quote' }).click();

        const quoteDialog = page.getByRole('dialog', { name: 'Quote' });
        await expect(quoteDialog).toBeVisible();
        await expect(quoteDialog.getByRole('button', { name: 'Preview' })).toBeVisible();
        await expect(quoteDialog.getByRole('button', { name: 'Send Quote' })).toBeVisible();
        await expect(quoteDialog.getByRole('button', { name: 'Download Quote' })).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            quoteDialog.getByRole('button', { name: 'Download Quote' }).click(),
        ]);

        await expect(download.suggestedFilename()).toBe(`${expectedFilenamePrefix}-quote-${expectedQuoteDate}.pdf`);
    });
});