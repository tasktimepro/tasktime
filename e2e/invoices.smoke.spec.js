import { expect, test } from '@playwright/test';
import {
    createBillableProject,
    createInlineTask,
    createTrackedInvoice,
    getInvoiceCardByProject,
    openProjectDashboard,
    selectPeriodRangeOption,
} from './helpers/tasktime.js';

async function seedCurrencyState(page, { preferredCurrency, rates }) {
    await page.addInitScript(({ nextPreferredCurrency, nextRates }) => {
        localStorage.setItem('preferences', JSON.stringify({ currency: nextPreferredCurrency }));
        localStorage.setItem('exchangeRatesCache', JSON.stringify({
            timestamp: Date.now(),
            rates: nextRates,
        }));
    }, {
        nextPreferredCurrency: preferredCurrency,
        nextRates: rates,
    });
}

async function updateExchangeRateCache(page, rates) {
    await page.evaluate((nextRates) => {
        localStorage.setItem('exchangeRatesCache', JSON.stringify({
            timestamp: Date.now(),
            rates: nextRates,
        }));
    }, rates);
}

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

    test('freezes paid invoice earned totals after exchange rates change', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Frozen Snapshot Project ${now}`;
        const clientTitle = `Playwright Frozen Snapshot Client ${now}`;
        const clientName = `Frozen Snapshot Client ${now}`;
        const taskTitle = `Playwright Frozen Snapshot Task ${now}`;
        const templateName = `Playwright Frozen Snapshot Template ${now}`;

        await seedCurrencyState(page, {
            preferredCurrency: 'EUR',
            rates: { USD: 1, EUR: 0.5 },
        });

        const { expectedTotal } = await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
            clientHourlyRate: 60,
            clientCurrency: 'USD',
        });
        const invoiceAmount = Number(expectedTotal.replace(/[^\d.]/g, ''));
        const frozenEarnedAmount = `€${(invoiceAmount * 0.5).toFixed(2)}`;
        const liveConvertedAmountAfterRateChange = `€${(invoiceAmount * 0.25).toFixed(2)}`;

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText(expectedTotal);
        await invoiceCard.getByRole('button', { name: 'Mark as Paid' }).click();

        await page.goto('/');
        await expect(page.getByText('Reports Overview')).toBeVisible();

        const thisMonthCard = page.getByRole('heading', { name: 'This Month', exact: true }).locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
        await expect(thisMonthCard).toContainText('earned');
        await expect(thisMonthCard).toContainText(frozenEarnedAmount);

        await updateExchangeRateCache(page, { USD: 1, EUR: 0.25 });
        await page.reload();

        await expect(page.getByText('Reports Overview')).toBeVisible();
        const reloadedThisMonthCard = page.getByRole('heading', { name: 'This Month', exact: true }).locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
        await expect(reloadedThisMonthCard).toContainText('earned');
        await expect(reloadedThisMonthCard).toContainText(frozenEarnedAmount);
        await expect(reloadedThisMonthCard).not.toContainText(liveConvertedAmountAfterRateChange);
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

    test('uses a project billed minimum for invoice totals while keeping actual worked time visible', async ({ page }) => {
        const now = Date.now();
        const projectTitle = `Playwright Minimum Billing Project ${now}`;
        const clientTitle = `Playwright Minimum Billing Client ${now}`;
        const clientName = `Minimum Billing Client ${now}`;
        const taskTitle = `Playwright Minimum Billing Task ${now}`;
        const templateName = `Playwright Minimum Billing Template ${now}`;

        await createBillableProject(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            clientHourlyRate: 60,
            billableTimeIncrementOption: 'Round up to 15 minutes',
        });

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
        await expect(timeEntriesDialog.getByText('Total Time:').locator('..')).not.toContainText('15m');
        await expect(timeEntriesDialog.getByText('Billed:')).toBeVisible();
        await expect(timeEntriesDialog.getByText('15m')).toBeVisible();
        await timeEntriesDialog.getByRole('button', { name: 'Close', exact: true }).click();

        await page.getByRole('button', { name: /^Generate Invoice/ }).first().click();

        const invoiceDialog = page.getByRole('dialog', { name: 'New Invoice' });
        await expect(invoiceDialog).toBeVisible();

        await selectPeriodRangeOption(
            page,
            invoiceDialog.getByRole('button', { name: 'Invoice billing period' }),
            'All Time',
        );

        const selectAllButton = invoiceDialog.getByRole('button', { name: 'Select All', exact: true });
        if (!(await selectAllButton.isVisible())) {
            await invoiceDialog.getByRole('button', { name: /Tasks & Time/i }).click();
        }
        await selectAllButton.click();

        const newTemplateButton = invoiceDialog.getByRole('button', { name: '+ New Template' });
        if (!(await newTemplateButton.isVisible())) {
            await invoiceDialog.getByRole('button', { name: /Invoice Settings/i }).click();
        }
        await newTemplateButton.click();

        const templateDialog = page.getByRole('dialog', { name: 'New Invoice Template' });
        await expect(templateDialog).toBeVisible();
        await templateDialog.locator('input').first().fill(templateName);
        await templateDialog.getByRole('button', { name: 'Create Template' }).click();

        await expect(templateDialog).not.toBeVisible();
        await expect(invoiceDialog).toBeVisible();

        const templateLabel = invoiceDialog.getByText(/Invoice Template/i);
        if (!(await templateLabel.isVisible())) {
            await invoiceDialog.getByRole('button', { name: /Invoice Settings/i }).click();
            await expect(templateLabel).toBeVisible();
        }

        const templateSelect = templateLabel
            .locator('xpath=ancestor::div[contains(@class, "mb-6")][1]')
            .locator('button[role="combobox"]')
            .first();

        await templateSelect.click();
        await page.getByRole('option', { name: templateName, exact: true }).click();
        await expect(templateSelect).toContainText(templateName);

        const pricingToggle = invoiceDialog.getByRole('button', { name: /Pricing & Totals/i });
        let expectedTotal = '';
        await expect.poll(async () => {
            expectedTotal = (await pricingToggle.innerText()).replace('Pricing & Totals', '').trim();
            return expectedTotal;
        }).not.toMatch(/0\.00$/);
        await expect(expectedTotal).toContain('15.00');

        await pricingToggle.click();
        await expect(invoiceDialog.getByText('Subtotal:', { exact: true }).locator('..')).toContainText(expectedTotal);
        await expect(invoiceDialog.getByText('Total:', { exact: true }).locator('..')).toContainText(expectedTotal);

        await invoiceDialog.getByRole('button', { name: 'Generate Invoice', exact: true }).click();
        await expect(invoiceDialog).not.toBeVisible();

        await page.goto('/invoices?section=invoices');
        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();
        await expect(invoiceCard).toContainText(expectedTotal);
    });
});