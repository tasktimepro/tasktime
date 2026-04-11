import { expect, test } from '@playwright/test';

test.describe('Onboarding smoke', () => {
    test('walks through the current onboarding steps and stays dismissed after completion', async ({ page }) => {

        await page.goto('/');

        const onboardingDialog = page.getByRole('dialog', { name: 'TaskTime setup' });
        await expect(onboardingDialog).toBeVisible();
        await expect(onboardingDialog.getByText('Welcome to TaskTime.')).toBeVisible();
        await expect(onboardingDialog.getByText('1 of 3')).toBeVisible();

        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(onboardingDialog.getByRole('heading', { name: 'Sync with Google Drive' })).toBeVisible();
        await expect(onboardingDialog.getByText('2 of 3')).toBeVisible();

        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(onboardingDialog.getByRole('heading', { name: 'Working with TaskTime' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Projects' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Tasks' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Clients' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Expenses' })).toBeVisible();
        await expect(onboardingDialog.getByRole('heading', { name: 'Invoices' })).toBeVisible();
        await expect(onboardingDialog.getByText('3 of 3')).toBeVisible();

        await expect(onboardingDialog.getByRole('button', { name: 'Get Started', exact: true })).toBeVisible();

        await onboardingDialog.getByRole('button', { name: 'Get Started', exact: true }).click();

        await expect(onboardingDialog).not.toBeVisible();

        await page.goto('/');
        await page.reload();

        await expect(page.getByRole('dialog', { name: 'TaskTime setup' })).toHaveCount(0);
    });
});