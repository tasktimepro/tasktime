import { expect, test } from '@playwright/test';
import { expensesHeadingName, openExpensesPage } from './helpers/tasktime.js';

test.describe('Expenses smoke', () => {

    test('keeps yearly selection inside the repeat dialog and saves the expense', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('tasktime-dark-mode', 'true'));

        for (const viewport of [{ width: 320, height: 700 }, { width: 667, height: 375 }, { width: 1440, height: 900 }]) {
            await page.setViewportSize(viewport);
            await openExpensesPage(page);
            await page.getByRole('button', { name: 'New Expense', exact: true }).click();

            const expenseDialog = page.getByRole('dialog', { name: 'New Expense' });
            await expenseDialog.getByRole('combobox', { name: 'Expense type' }).click();
            await page.getByRole('option', { name: 'Recurring', exact: true }).click();
            await expenseDialog.getByRole('button', { name: 'Monthly (1st)' }).click();

            const repeatDialog = page.getByRole('dialog', { name: 'Repeat' });
            await repeatDialog.getByRole('button', { name: 'Every Year' }).click();
            await expect(repeatDialog.getByRole('button', { name: 'January' })).toBeVisible();
            await expect(repeatDialog.getByRole('button', { name: 'December' })).toBeVisible();
            await expect(repeatDialog.getByRole('spinbutton', { name: 'Yearly day' })).toBeVisible();
            await expect(repeatDialog.getByRole('listbox')).toHaveCount(0);
            await repeatDialog.screenshot({ path: `test-results/yearly-repeat-${viewport.width}.png` });

            const bounds = await repeatDialog.boundingBox();
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
            if (viewport.height < 400) {
                expect(await repeatDialog.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
            }

            await repeatDialog.getByRole('button', { name: 'December' }).click();
            await repeatDialog.getByRole('spinbutton', { name: 'Yearly day' }).fill('31');
            await repeatDialog.getByRole('button', { name: 'Apply' }).click();
            await expect(expenseDialog.getByRole('button', { name: 'Yearly (Dec 31)' })).toBeVisible();
            if (viewport.width !== 1440) {
                await expenseDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
                continue;
            }

            await expenseDialog.getByPlaceholder('Enter expense title').fill('Yearly renewal');
            await expenseDialog.getByLabel(/Amount/i).fill('12.34');
            await expenseDialog.getByRole('button', { name: 'Create Expense' }).click();
            await expect(expenseDialog).not.toBeVisible();

            const readRecurrence = () => page.evaluate(() => Array.from(
                window.__TASKTIME_STORE__.expenseRecurrences.values(), recurrence => recurrence.toJSON(),
            ).find(recurrence => recurrence.title === 'Yearly renewal'));
            await expect.poll(readRecurrence).toMatchObject({ repeat: 'yearly' });
            expect((await readRecurrence()).startDate).toMatch(/-12-31$/);
            await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
            await page.reload();
            await expect(page.getByRole('heading', { name: expensesHeadingName })).toBeVisible();
            await expect.poll(readRecurrence).toMatchObject({ repeat: 'yearly' });
            expect((await readRecurrence()).startDate).toMatch(/-12-31$/);
        }
    });

    test('deletes a newly created expense and closes both dialogs without a false error', async ({ page }) => {
        const title = `Delete check ${Date.now()}`;
        await openExpensesPage(page);
        await page.getByRole('button', { name: 'New Expense', exact: true }).click();

        const newExpense = page.getByRole('dialog', { name: 'New Expense' });
        await newExpense.getByPlaceholder('Enter expense title').fill(title);
        await newExpense.getByLabel(/Amount/i).fill('12.34');
        await newExpense.getByRole('button', { name: 'Create Expense' }).click();
        await expect(newExpense).not.toBeVisible();

        const expenseRow = page.getByRole('button', { name: new RegExp(title) })
            .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
        await expect(expenseRow).toBeVisible();
        await expenseRow.getByRole('button', { name: 'Edit Expense' }).click();

        const editExpense = page.getByRole('dialog', { name: 'Edit Expense' });
        await editExpense.getByRole('button', { name: 'Delete Expense' }).click();
        const confirmDelete = page.getByRole('dialog', { name: 'Delete expense?' });
        await expect(confirmDelete).toBeVisible();
        await confirmDelete.getByRole('button', { name: 'Delete', exact: true }).click();

        await expect(confirmDelete).not.toBeVisible();
        await expect(editExpense).not.toBeVisible();
        await expect(page.getByText('Expense deleted', { exact: true })).toBeVisible();
        await expect(page.getByText('Expense no longer exists.', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);

        await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
        await page.reload();
        await expect(page.getByRole('heading', { name: expensesHeadingName })).toBeVisible();
        await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.expenses.size)).toBe(0);
    });

    test('keeps categories empty through cancelled forms, deletion, and reload', async ({ page }) => {
        await openExpensesPage(page);
        await page.getByRole('button', { name: 'New Expense', exact: true }).click();

        const expenseDialog = page.getByRole('dialog', { name: 'New Expense' });
        await expect(expenseDialog).toBeVisible();
        await expect(expenseDialog.getByPlaceholder('Enter expense title')).toBeVisible();
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.expenseCategories.size)).toBe(0);
        await expenseDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

        const openCategories = async () => {
            await page.getByRole('button', { name: 'More actions', exact: true }).click();
            await page.getByRole('menuitem', { name: 'Manage categories' }).click();
            await expect(page.getByRole('dialog', { name: 'Expense Categories', exact: true })).toBeVisible();
        };
        await openCategories();

        const categoriesDialog = page.getByRole('dialog', { name: 'Expense Categories', exact: true });
        await expect(categoriesDialog.getByText('0 available for new expenses')).toBeVisible();
        await categoriesDialog.getByRole('button', { name: 'Add category', exact: true }).click();

        const addDialog = page.getByRole('dialog', { name: 'Add category', exact: true });
        await addDialog.getByLabel('Name', { exact: true }).fill('My own category');
        await addDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.expenseCategories.size)).toBe(0);

        await categoriesDialog.getByRole('button', { name: 'Add category', exact: true }).click();
        await addDialog.getByLabel('Name', { exact: true }).fill('My own category');
        await addDialog.getByRole('button', { name: 'Add Category', exact: true }).click();
        await expect(categoriesDialog.getByText('1 available for new expenses')).toBeVisible();
        await categoriesDialog.getByRole('button', { name: 'More actions', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog', { name: 'Delete category?' }).getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(categoriesDialog.getByText('0 available for new expenses')).toBeVisible();
        await categoriesDialog.getByRole('button', { name: 'Done', exact: true }).click();
        await openCategories();
        await expect(categoriesDialog.getByText('0 available for new expenses')).toBeVisible();
        await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
        await page.reload();
        await expect(page.getByRole('heading', { name: expensesHeadingName })).toBeVisible();
        await openCategories();
        await expect(categoriesDialog.getByText('0 available for new expenses')).toBeVisible();
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.expenses.size)).toBe(0);
    });

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

        const expenseRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).filter({ has: page.getByRole('heading', { name: expenseTitle, exact: true }) });
        await expect(expenseRow).toBeVisible();
        await expect(expenseRow).toContainText('12.34');

        await expenseRow.getByRole('button', { name: 'Mark as Paid' }).click();

        const paidTab = page.getByRole('tab', { name: /^Paid \(1\)$/ });
        await paidTab.click();

        const paidExpenseRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).filter({ has: page.getByRole('heading', { name: expenseTitle, exact: true }) });
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

        const reloadedPaidRow = page.getByRole('button', { name: new RegExp(expenseTitle) }).filter({ has: page.getByRole('heading', { name: expenseTitle, exact: true }) });
        await expect(reloadedPaidRow).toBeVisible();
        await expect(reloadedPaidRow).toContainText('Paid');
        await expect(reloadedPaidRow).toContainText('12.34');
    });
});

test.describe('Yearly expense in a western timezone', () => {
    test.use({ timezoneId: 'America/Los_Angeles' });

    test('keeps the selected local calendar day when saving a recurrence', async ({ page }) => {
        await openExpensesPage(page);
        await page.getByRole('button', { name: 'New Expense', exact: true }).click();

        const expenseDialog = page.getByRole('dialog', { name: 'New Expense' });
        await expenseDialog.getByRole('combobox', { name: 'Expense type' }).click();
        await page.getByRole('option', { name: 'Recurring', exact: true }).click();
        await expenseDialog.getByRole('button', { name: 'Monthly (1st)' }).click();

        const repeatDialog = page.getByRole('dialog', { name: 'Repeat' });
        await repeatDialog.getByRole('button', { name: 'Every Year' }).click();
        await repeatDialog.getByRole('button', { name: 'December' }).click();
        await repeatDialog.getByRole('spinbutton', { name: 'Yearly day' }).fill('31');
        await repeatDialog.getByRole('button', { name: 'Apply' }).click();
        await expect(expenseDialog.getByRole('button', { name: 'Yearly (Dec 31)' })).toBeVisible();

        await expenseDialog.getByPlaceholder('Enter expense title').fill('Western timezone renewal');
        await expenseDialog.getByLabel(/Amount/i).fill('12.34');
        await expenseDialog.getByRole('button', { name: 'Create Expense' }).click();
        await expect(expenseDialog).not.toBeVisible();

        const recurrence = await page.evaluate(() => Array.from(
            window.__TASKTIME_STORE__.expenseRecurrences.values(), value => value.toJSON(),
        ).find(value => value.title === 'Western timezone renewal'));
        expect(recurrence.startDate).toMatch(/-12-31$/);
    });
});
