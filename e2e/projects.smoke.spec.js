import { expect, test } from '@playwright/test';
import { createBusinessInfo, createBillableProject, createPersonalProject, openProjectDashboard, projectsHeadingName } from './helpers/tasktime.js';

test.describe('Projects smoke', () => {

    test('matches the Clients header-to-card spacing on phones', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: /^Projects/ })).toBeVisible();
        await page.evaluate(async () => {
            const store = window.__TASKTIME_STORE__;
            store.clients.set('spacing-client', { id: 'spacing-client', title: 'Spacing client' });
            store.projects.set('spacing-project', { id: 'spacing-project', title: 'Spacing project', isPersonal: true, invoiceIds: [] });
            await store.docManager.flushPersistence();
        });

        const headerGap = async (name) => {
            const heading = page.getByRole('heading', { name: new RegExp(`^${name}`) });
            const header = await heading.locator('..').boundingBox();
            const grid = await heading.locator('..').locator('xpath=following-sibling::div[1]').boundingBox();
            return grid.y - header.y - header.height;
        };

        for (const width of [390, 320, 1024]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto('/projects');
            await expect(page.getByRole('heading', { name: 'Spacing project' })).toBeVisible();
            const projectGap = await headerGap('Projects');
            await page.goto('/clients');
            await expect(page.getByRole('heading', { name: 'Spacing client' })).toBeVisible();
            const clientGap = await headerGap('Clients');
            expect(Math.abs(projectGap - clientGap)).toBeLessThan(2);
            expect(Math.abs(projectGap - (width < 768 ? 24 : 32))).toBeLessThan(2);
        }
    });

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
