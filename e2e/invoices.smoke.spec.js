import { expect, test } from '@playwright/test';
import {
    createTrackedInvoice,
    getInvoiceCardByProject,
} from './helpers/tasktime.js';

test.describe('Invoices smoke', () => {

    test('creates an invoice from tracked time and keeps it after reload', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Invoice Project ${now}`;
        const clientTitle = `Playwright Invoice Client ${now}`;
        const clientName = `Invoice Client ${now}`;
        const taskTitle = `Playwright Invoice Task ${now}`;
        const templateName = `Playwright Template ${now}`;

        const { expectedTotal } = await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText(expectedTotal);
        await expect(page.getByText(`Client: ${clientName}`)).toBeVisible();
        await expect(page.getByText(`Project: ${projectTitle}`)).toBeVisible();
        await expect(page.getByText(`Template: ${templateName}`)).toBeVisible();
        await expect(page.getByRole('tab', { name: /^Outstanding \(1\)$/ })).toBeVisible();

        await page.reload();

        await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();
        await expect(getInvoiceCardByProject(page, projectTitle)).toContainText(expectedTotal);
        await expect(page.getByText(`Client: ${clientName}`)).toBeVisible();
        await expect(page.getByText(`Project: ${projectTitle}`)).toBeVisible();
        await expect(page.getByText(`Template: ${templateName}`)).toBeVisible();
        await expect(page.getByRole('tab', { name: /^Outstanding \(1\)$/ })).toBeVisible();
    });

    test('marks an invoice paid and keeps the paid state after reload', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Paid Invoice Project ${now}`;
        const clientTitle = `Playwright Paid Invoice Client ${now}`;
        const clientName = `Paid Invoice Client ${now}`;
        const taskTitle = `Playwright Paid Invoice Task ${now}`;
        const templateName = `Playwright Paid Template ${now}`;

        const { expectedTotal } = await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText(expectedTotal);
        await invoiceCard.getByRole('button', { name: 'Mark as Paid' }).click();

        const paidTab = page.getByRole('tab', { name: /^Paid \(1\)$/ });
        await expect(paidTab).toBeVisible();
        await paidTab.click();

        const paidInvoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(paidInvoiceCard).toBeVisible();
        await expect(paidInvoiceCard).toContainText('Paid');
        await expect(paidInvoiceCard).toContainText(expectedTotal);
        await expect(paidInvoiceCard).not.toContainText('Mark as Paid');

        await page.reload();

        await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();
        await page.getByRole('tab', { name: /^Paid \(1\)$/ }).click();

        const reloadedPaidInvoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(reloadedPaidInvoiceCard).toBeVisible();
        await expect(reloadedPaidInvoiceCard).toContainText('Paid');
        await expect(reloadedPaidInvoiceCard).toContainText(expectedTotal);
        await expect(reloadedPaidInvoiceCard).not.toContainText('Mark as Paid');
    });

    test('downloads a generated invoice PDF with the expected filename', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Download Invoice Project ${now}`;
        const clientTitle = `Playwright Download Invoice Client ${now}`;
        const clientName = `Download Invoice Client ${now}`;
        const taskTitle = `Playwright Download Invoice Task ${now}`;
        const templateName = `Playwright Download Template ${now}`;

        const { expectedTotal } = await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText(expectedTotal);

        const invoiceNumber = (await invoiceCard.getByRole('heading').innerText()).trim();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            invoiceCard.getByTitle('Download as PDF').click(),
        ]);

        await expect(download.suggestedFilename()).toBe(`invoice-${invoiceNumber}.pdf`);
    });
});