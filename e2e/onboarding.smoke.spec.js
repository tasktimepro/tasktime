import { expect, test } from '@playwright/test';

async function expectEmptyWorkspace(page) {
    const populatedCollections = await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;

        return [store.coreDoc, store.activeEntriesDoc].flatMap((doc) => (
            Array.from(doc.share.keys()).filter((name) => doc.getMap(name).size > 0)
        ));
    });

    expect(populatedCollections).toEqual([]);
}

test.describe('Onboarding smoke', () => {
    test('reopens after refresh until the user dismisses it', async ({ page }) => {

        await page.goto('/');

        const onboardingDialog = page.getByRole('dialog', { name: 'TaskTime Pro setup' });
        await expect(onboardingDialog).toBeVisible();
        await expectEmptyWorkspace(page);

        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(onboardingDialog.getByRole('heading', { name: 'Sync with your cloud provider' })).toBeVisible();

        await page.reload();

        const reloadedOnboardingDialog = page.getByRole('dialog', { name: 'TaskTime Pro setup' });
        await expect(reloadedOnboardingDialog).toBeVisible();
        await expect(reloadedOnboardingDialog.getByText('Welcome to TaskTime Pro.')).toBeVisible();
        await expectEmptyWorkspace(page);
    });

    test('walks through the current onboarding steps and stays dismissed after completion', async ({ page }) => {

        await page.goto('/');

        const onboardingDialog = page.getByRole('dialog', { name: 'TaskTime Pro setup' });
        await expect(onboardingDialog).toBeVisible();
        await expect(onboardingDialog.getByText('Welcome to TaskTime Pro.')).toBeVisible();
        await expect(onboardingDialog.getByRole('link', { name: /Learn more about TaskTime Pro/i })).toHaveCount(0);
        await expect(onboardingDialog.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', 'https://tasktime.pro/privacy/');
        await expect(onboardingDialog.getByRole('link', { name: 'Terms', exact: true })).toHaveAttribute('href', 'https://tasktime.pro/terms/');
        await expect(onboardingDialog.getByText('1 of 3')).toBeVisible();

        const topSpacing = await onboardingDialog.evaluate((dialog) => {
            const icon = dialog.querySelector('[data-onboarding-step-icon]');

            return Math.round(icon.getBoundingClientRect().top - dialog.getBoundingClientRect().top);
        });

        expect(topSpacing).toBeGreaterThanOrEqual(16);

        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(onboardingDialog.getByRole('heading', { name: 'Sync with your cloud provider' })).toBeVisible();
        await expect(onboardingDialog.getByText('2 of 3')).toBeVisible();

        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(onboardingDialog.getByRole('heading', { name: 'Working with TaskTime Pro' })).toBeVisible();
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
        await expectEmptyWorkspace(page);

        await page.goto('/');
        await page.reload();

        await expect(page.getByRole('dialog', { name: 'TaskTime Pro setup' })).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Dashboard summary', exact: true })).toBeVisible();
        await expectEmptyWorkspace(page);
    });
});
