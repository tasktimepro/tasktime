import { expect, test } from '@playwright/test';
import { expensesHeadingName, openExpensesPage } from './helpers/tasktime.js';

test.describe('Expenses smoke', () => {

    test('creates an expense, marks it paid, and keeps the paid state after reload', async ({ page }) => {
        const expenseTitle = `Playwright Expense ${Date.now()}`;

        await openExpensesPage(page);
        await expect(page.getByText('No expenses yet')).toBeVisible();

        await page.getByRole('button', { name: 'Create First Expense' }).click();

        const expenseDialog = page.getByRole('dialog', { name: 'New Expense' });
        await expect(expenseDialog).toBeVisible();

        const titleInput = expenseDialog.getByPlaceholder('Enter expense title');

        await expect(titleInput).toBeVisible({ timeout: 20_000 });
        await titleInput.fill(expenseTitle);
        await expenseDialog.getByLabel(/Amount/i).fill('12.34');

        const autoPaidCheckbox = expenseDialog.getByRole('checkbox', { name: /Automatically paid on expense date/i });
        if ((await autoPaidCheckbox.getAttribute('data-state')) === 'checked') {
            await autoPaidCheckbox.click();
        }

        await expenseDialog.getByRole('button', { name: 'Create Expense' }).click();

        await expect(expenseDialog).not.toBeVisible();

        const outstandingTab = page.getByRole('tab', { name: /^Outstanding \(1\)$/ });
        await expect(outstandingTab).toBeVisible();

        const expenseRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).first();
        await expect(expenseRow).toBeVisible();
        await expect(expenseRow).toContainText('12.34');

        await expenseRow.getByRole('button', { name: 'Mark as Paid' }).click();

        const paidTab = page.getByRole('tab', { name: /^Paid \(1\)$/ });
        await paidTab.click();

        const paidExpenseRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).first();
        await expect(paidExpenseRow).toBeVisible();
        await expect(paidExpenseRow).toContainText('Paid');
        await expect(paidExpenseRow).toContainText('12.34');

        await paidExpenseRow.click();

        const expenseViewDialog = page.getByRole('dialog', { name: expenseTitle });
        await expect(expenseViewDialog).toBeVisible();
        await expect(expenseViewDialog).toContainText('Paid');
        await expect(expenseViewDialog).toContainText('12.34');
        await expenseViewDialog.getByRole('button', { name: 'Close dialog' }).click();

        await page.reload();

        await expect(page.getByRole('heading', { name: expensesHeadingName })).toBeVisible();
        await page.getByRole('tab', { name: /^Paid \(1\)$/ }).click();

        const reloadedPaidRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).first();
        await expect(reloadedPaidRow).toBeVisible();
        await expect(reloadedPaidRow).toContainText('Paid');
        await expect(reloadedPaidRow).toContainText('12.34');
    });
});