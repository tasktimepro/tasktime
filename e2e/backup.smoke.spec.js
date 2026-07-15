import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTrackedInvoice } from './helpers/tasktime.js';

const FIXED_SMOKE_TIME = '2026-05-21T12:00:00Z';

async function freezePageTime(page, isoString) {
    const fixedNow = new Date(isoString).getTime();

    await page.addInitScript(({ nextFixedNow }) => {
        const NativeDate = Date;

        class FixedDate extends NativeDate {
            constructor(...args) {
                if (args.length === 0) {
                    super(nextFixedNow);
                    return;
                }

                super(...args);
            }

            static now() {
                return nextFixedNow;
            }
        }

        FixedDate.parse = NativeDate.parse;
        FixedDate.UTC = NativeDate.UTC;
        FixedDate.prototype = NativeDate.prototype;

        window.Date = FixedDate;
    }, { nextFixedNow: fixedNow });
}

async function importBackupFixture(page, fixturePath) {
    await page.goto('/account?section=data');
    await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
    await expect(page.getByText('Backup & Restore')).toBeVisible();
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    const importDialog = page.getByRole('dialog', { name: 'Import Data' });
    await expect(importDialog).toBeVisible();
    await importDialog.locator('#file-upload').setInputFiles(fixturePath);
    await expect(importDialog.getByRole('button', { name: 'Import Data' })).toBeEnabled();
    await importDialog.getByRole('button', { name: 'Import Data' }).click();
    await expect(importDialog).not.toBeVisible();
}

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

        await page.goto('/account?section=data');
        await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
        await expect(page.getByText('Backup & Restore')).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Export', exact: true }).click(),
        ]);

        await expect(download.suggestedFilename()).toMatch(/^tasktime-backup-\d{4}-\d{2}-\d{2}\.json$/);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();

        const exportedJson = JSON.parse(await readFile(downloadPath, 'utf8'));

        expect(exportedJson.version).toBe('1.5');
        expect(typeof exportedJson.exportDate).toBe('string');
        expect(exportedJson).not.toHaveProperty('timers');
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
        test.setTimeout(90_000);

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

        await page.goto('/account?section=data');
        await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
        await expect(page.getByText('Backup & Restore')).toBeVisible();

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
        await Promise.all([
            page.waitForEvent('framenavigated', {
                predicate: (frame) => {
                    if (frame !== page.mainFrame()) {
                        return false;
                    }

                    const url = new URL(frame.url());

                    return url.pathname === '/account' && url.searchParams.get('section') === 'data';
                },
            }),
            deleteDialog.getByRole('button', { name: 'Delete All Data' }).click(),
        ]);

        await page.waitForLoadState('load');
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();

        await page.goto('/projects');
        await expect(page.getByText('No projects')).toBeVisible();

        await page.goto('/account?section=data');
        await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
        await expect(page.getByText('Backup & Restore')).toBeVisible();
        await page.getByRole('button', { name: 'Import', exact: true }).click();

        const importDialog = page.getByRole('dialog', { name: 'Import Data' });
        await expect(importDialog).toBeVisible();
        await importDialog.locator('#file-upload').setInputFiles(downloadPath);
        await expect(importDialog.getByRole('button', { name: 'Import Data' })).toBeEnabled();
        await importDialog.getByRole('button', { name: 'Import Data' }).click();

        await expect(importDialog).not.toBeVisible();
        await expect(page.getByText('Current Data')).toBeVisible();
        await expect(page.getByText('Clients: 1')).toBeVisible();
        await expect(page.getByText('Projects: 1')).toBeVisible();
        await expect(page.getByText('Invoices: 1')).toBeVisible();

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();

        await page.goto('/invoices?section=invoices');
        await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();

        const invoicesView = page.locator('main');
        await expect(invoicesView).toContainText(`Client: ${clientName}`);
        await expect(invoicesView).toContainText(`Project: ${projectTitle}`);

        await page.reload();

        await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();
        await expect(invoicesView).toContainText(`Client: ${clientName}`);
        await expect(invoicesView).toContainText(`Project: ${projectTitle}`);
    });

    test('imports the broad sample backup and previews an imported invoice in edit mode', async ({ page }) => {
        const fixturePath = path.resolve(process.cwd(), 'test-data/backups/tasktime-sample-backup-v1.3.json');

        await freezePageTime(page, FIXED_SMOKE_TIME);
        await importBackupFixture(page, fixturePath);

        await expect(page.getByText('Current Data')).toBeVisible();
        await expect(page.getByText(/Projects:\s*5/)).toBeVisible();
        await expect(page.getByText(/Invoices:\s*3/)).toBeVisible();

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: 'Acme Website Redesign' })).toBeVisible();

        await page.goto('/invoices?section=invoices');
        await expect(page.getByRole('heading', { name: /^Invoices \(3\)$/ })).toBeVisible();
        await page.getByRole('tab', { name: /^Outstanding \(1\)$/ }).click();

        const invoiceCard = page
            .getByRole('heading', { name: 'RET-2026-004' })
            .locator('xpath=ancestor::div[contains(@class, "p-4")][1]');

        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText('RET-2026-004');
        await invoiceCard.getByRole('button', { name: 'More actions' }).click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();

        const editDialog = page.getByRole('dialog', { name: 'Edit Invoice' });
        await expect(editDialog).toBeVisible();

        await editDialog.getByRole('button', { name: 'Preview invoice' }).click();

        const previewDialog = page.getByRole('dialog', { name: 'Invoice Preview - RET-2026-004' });
        await expect(previewDialog).toBeVisible();
        await expect(page.getByTestId('invoice-preview-page')).toBeVisible();
        await expect(page.getByTestId('invoice-preview-page')).toContainText('RET-2026-004');
    });
});
