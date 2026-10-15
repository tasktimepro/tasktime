import { expect, test } from '@playwright/test';

for (const width of [1280, 390, 320]) {
    test(`Focus assembles and completes a cross-project shortlist at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: /^Projects/ })).toBeVisible();
        await page.evaluate(async () => {
            const store = window.__TASKTIME_STORE__;
            store.projects.set('focus-project', { id: 'focus-project', title: 'Atlas', isPersonal: true, invoiceIds: [] });
            store.tasks.set('focus-existing', { id: 'focus-existing', title: 'Review proposal', projectId: 'focus-project' });
            await store.docManager.flushPersistence();
        });

        await page.getByRole('button', { name: width < 768 ? 'Focus' : 'Open Focus' }).click();
        const dialog = page.getByRole('dialog', { name: 'Focus' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Add tasks', exact: true }).click();
        await dialog.getByRole('checkbox', { name: /Review proposal/ }).check();
        await dialog.getByRole('button', { name: 'Add selected (1)' }).click();
        await expect(dialog.getByRole('region', { name: 'Atlas' })).toContainText('Review proposal');

        await dialog.getByRole('button', { name: 'Add tasks', exact: true }).click();
        await dialog.getByRole('textbox', { name: 'New task title' }).fill('Prepare notes');
        await dialog.getByRole('combobox', { name: 'New task project' }).selectOption('focus-project');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        await expect(dialog.getByRole('region', { name: 'Atlas' })).toContainText('Prepare notes');
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();

        await dialog.getByRole('region', { name: 'Atlas' }).getByRole('button', { name: 'Start Timer' }).first().click();
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.timers.size)).toBe(1);
        await dialog.getByRole('checkbox', { name: 'Complete Review proposal' }).click();
        await expect(dialog.getByRole('region', { name: 'Atlas' })).not.toContainText('Review proposal');
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.timers.size)).toBe(0);
        await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(1);
        await dialog.getByRole('button', { name: 'Undo' }).click();
        await expect(dialog.getByRole('region', { name: 'Atlas' })).toContainText('Review proposal');
        expect(await page.evaluate(() => window.__TASKTIME_STORE__.activeTimeEntries.size)).toBe(1);

        await page.reload();
        await expect(dialog).toContainText('Prepare notes');
        await expect(dialog).toContainText('Review proposal');
        await dialog.getByRole('button', { name: 'Exit Focus' }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page).not.toHaveURL(/focus=1/);
    });
}

test('Focus preserves route history while planning unassigned and project work', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    await page.goto('/projects?section=active&source=focus-test');
    await expect(page.getByRole('heading', { name: /^Projects/ })).toBeVisible();
    await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        store.projects.set('atlas', { id: 'atlas', title: 'Atlas', isPersonal: true, invoiceIds: [] });
        store.tasks.set('brief', { id: 'brief', title: 'Write brief' });
        store.tasks.set('review', { id: 'review', title: 'Review Atlas' , projectId: 'atlas' });
        store.tasks.set('send', { id: 'send', title: 'Send Atlas', projectId: 'atlas' });
    });

    await page.getByRole('button', { name: 'Open Focus' }).click();
    const dialog = page.getByRole('dialog', { name: 'Focus' });
    await expect(page).toHaveURL(/\/projects\?section=active&source=focus-test&focus=1/);
    await dialog.getByRole('button', { name: 'Add tasks', exact: true }).click();
    await dialog.getByRole('checkbox', { name: /Write brief/ }).check();
    await dialog.getByRole('checkbox', { name: /Review Atlas/ }).check();
    await dialog.getByRole('checkbox', { name: /Send Atlas/ }).check();
    await dialog.getByRole('button', { name: 'Add selected (3)' }).click();
    await expect(dialog.getByRole('region', { name: 'Unassigned' })).toContainText('Write brief');
    const atlas = dialog.getByRole('region', { name: 'Atlas' });
    await expect(atlas).toContainText('Review Atlas');
    await expect(atlas).toContainText('Send Atlas');
    await atlas.getByRole('button', { name: 'Move Send Atlas up' }).click();
    await expect(atlas.getByText('Send Atlas')).toBeVisible();
    await expect(atlas.getByText('Next up')).toHaveCount(1);
    await expect(atlas.locator('button', { hasText: 'Send Atlas' })).toContainText('Next up');

    await page.goBack();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/projects\?section=active&source=focus-test$/);
    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(atlas).toContainText('Send Atlas');
    await dialog.getByRole('button', { name: 'Exit Focus' }).click();
    await expect(page).toHaveURL(/\/projects\?section=active&source=focus-test$/);
});

test('Focus keeps task details above the overlay and Escape closes one layer at a time', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /^Projects/ })).toBeVisible();
    await page.evaluate(() => {
        window.__TASKTIME_STORE__.tasks.set('focus-details', { id: 'focus-details', title: 'Inspect focus details' });
    });
    await page.getByRole('button', { name: 'Open Focus' }).click();
    const focus = page.getByRole('dialog', { name: 'Focus' });
    await focus.getByRole('button', { name: 'Add tasks', exact: true }).click();
    await focus.getByRole('checkbox', { name: /Inspect focus details/ }).check();
    await focus.getByRole('button', { name: 'Add selected (1)' }).click();
    await focus.getByRole('button', { name: 'Inspect focus detailsNext up', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Inspect focus details' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Inspect focus details' })).not.toBeVisible();
    await expect(focus).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(focus).not.toBeVisible();
});

test('Focus sound has one owning tab and saved cadence needs a local entry gesture', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'chromium', 'Web Audio and Web Lock ownership is exercised in Chromium.');
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    await page.goto('/?focus=1');
    const first = page.getByRole('dialog', { name: 'Focus' });
    await first.getByRole('button', { name: 'Add tasks', exact: true }).click();
    await first.getByRole('textbox', { name: 'New task title' }).fill('Sound task');
    await first.getByRole('button', { name: 'Create', exact: true }).click();
    await first.getByRole('button', { name: 'Close', exact: true }).click();
    await first.getByRole('combobox', { name: 'Reminder' }).selectOption('20');
    await first.getByRole('button', { name: 'Start Timer' }).click();
    await expect(first.getByText('Reminders active.')).toBeVisible();

    const secondPage = await context.newPage();
    await secondPage.goto('/?focus=1');
    const second = secondPage.getByRole('dialog', { name: 'Focus' });
    await expect(second.getByRole('combobox', { name: 'Reminder' })).toHaveValue('20');
    await expect(second.getByText('Enable sound for reminders on this device.')).toBeVisible();
    await second.getByRole('button', { name: 'Enable sound' }).click();
    await expect(second.getByText('Sound is active in another tab.')).toBeVisible();

    await first.getByRole('button', { name: 'Exit Focus' }).click();
    await expect(second.getByText('Reminders active.')).toBeVisible({ timeout: 10000 });
    await secondPage.close();
    await page.getByRole('button', { name: 'Open Focus' }).click();
    await expect(first.getByText('Reminders active.')).toBeVisible({ timeout: 10000 });
});
