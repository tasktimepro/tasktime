import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createTrackedInvoice } from './helpers/tasktime.js';

test.describe('Backup smoke', () => {

    test('exports tracked data as JSON with the expected entities', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Backup Project ${now}`;
        const clientTitle = `Playwright Backup Client ${now}`;
        const clientName = `Backup Client ${now}`;
        const taskTitle = `Playwright Backup Task ${now}`;
        const templateName = `Playwright Backup Template ${now}`;

        await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        await page.goto('/account?section=backup');
        await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Export', exact: true }).click(),
        ]);

        await expect(download.suggestedFilename()).toMatch(/^tasktime-backup-\d{4}-\d{2}-\d{2}\.json$/);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();

        const exportedJson = JSON.parse(await readFile(downloadPath, 'utf8'));

        expect(exportedJson.version).toBe('1.1');
        expect(typeof exportedJson.exportDate).toBe('string');
        expect(exportedJson.projects).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: projectTitle }),
        ]));
        expect(exportedJson.tasks).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: taskTitle }),
        ]));
        expect(exportedJson.clients).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: clientTitle, clientName }),
        ]));
        expect(exportedJson.invoices).toHaveLength(1);
        expect(exportedJson.invoices[0]).toEqual(expect.objectContaining({
            clientId: expect.any(String),
            invoiceNumber: expect.any(String),
            project: expect.objectContaining({ title: projectTitle }),
        }));
    });

    test('restores exported data after clearing local data', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Restore Project ${now}`;
        const clientTitle = `Playwright Restore Client ${now}`;
        const clientName = `Restore Client ${now}`;
        const taskTitle = `Playwright Restore Task ${now}`;
        const templateName = `Playwright Restore Template ${now}`;

        await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        await page.goto('/account?section=backup');
        await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Export', exact: true }).click(),
        ]);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();

        await page.goto('/account?section=data');
        await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
        await page.getByRole('button', { name: 'Delete All Account Data', exact: true }).click();

        const deleteDialog = page.getByRole('dialog', { name: 'Delete All Account Data' });
        await expect(deleteDialog).toBeVisible();
        await deleteDialog.getByLabel(/Type .*delete all data.* to confirm:/i).fill('delete all data');
        await deleteDialog.getByRole('button', { name: 'Delete All Data' }).click();

        await page.waitForLoadState('networkidle');

        await page.goto('/projects');
        await expect(page.getByText('No projects')).toBeVisible();

        await page.goto('/account?section=backup');
        await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toBeVisible();
        await page.getByRole('button', { name: 'Import', exact: true }).click();

        const importDialog = page.getByRole('dialog', { name: 'Import Data' });
        await expect(importDialog).toBeVisible();
        await importDialog.locator('#file-upload').setInputFiles(downloadPath);
        await importDialog.getByRole('button', { name: 'Import Data' }).click();

        await expect(importDialog).not.toBeVisible();
        await expect(page.getByText('Current Data')).toBeVisible();
        await expect(page.getByText('Projects: 1')).toBeVisible();
        await expect(page.getByText('Invoices: 1')).toBeVisible();

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();

        await page.goto('/invoices?section=invoices');
        await expect(page.getByText(`Client: ${clientName}`)).toBeVisible();
        await expect(page.getByText(`Project: ${projectTitle}`)).toBeVisible();

        await page.reload();

        await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();
        await expect(page.getByText(`Client: ${clientName}`)).toBeVisible();
        await expect(page.getByText(`Project: ${projectTitle}`)).toBeVisible();
    });
});