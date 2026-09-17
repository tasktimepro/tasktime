import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });

async function seed(page) {
    await page.clock.setFixedTime(new Date('2026-09-08T12:00:00+02:00'));
    await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
    await page.goto('/');
    await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        // Only this test's disposable browser data is seeded.
        store.tasks.clear();
        store.projects.clear();
        store.activeTimeEntries.clear();
        store.expenses.clear();
        store.expenseCategories.clear();
        store.expenseRecurrences.clear();
        store.clients.set('client', objectToYMap({ id: 'client', title: 'Studio', hourlyRate: 100, flatRate: false, color: '#ef4444', defaultCurrency: 'EUR' }));
        store.projects.set('project', objectToYMap({ id: 'project', title: 'Website', preferredClientId: 'client', hourlyRate: 100, flatRate: false, isPersonal: false, invoiceIds: [] }));
        store.tasks.set('weekly', objectToYMap({ id: 'weekly', title: 'Weekly review', projectId: 'project', recurring: { type: 'weekly', weeklyDays: [2] }, completedDatesByYear: { '2026': { '9': [1] } } }));
        store.preferences.set('theme', 'light');
        store.preferences.set('currency', 'EUR');
        await store.docManager.flushPersistence();
    });
}

test('keeps project, client, and Planner phone rails flush with their cards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page);

    const checkRail = async (rail) => {
        await expect(rail).toBeVisible();
        const layout = await rail.evaluate(element => ({
            bottomPadding: getComputedStyle(element).paddingBottom,
            scrollable: element.scrollWidth > element.clientWidth,
        }));
        expect(layout.bottomPadding).toBe('0px');
        expect(layout.scrollable).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };

    await page.goto('/projects');
    await page.getByRole('heading', { name: 'Website', exact: true }).click();
    await checkRail(page.getByTestId('project-metrics-row'));

    await page.goto('/clients');
    await page.getByRole('heading', { name: 'Studio', exact: true }).click();
    await checkRail(page.getByTestId('client-metrics-row'));

    await page.goto('/planner');
    const daySelector = page.locator('main .scrollbar-hide').filter({ has: page.locator('button[aria-pressed]') });
    await checkRail(daySelector);
});

test('keeps index icons neutral while preserving colored project identity in Planner and project details', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        store.plannerAttachments.set('planner-project', objectToYMap({
            id: 'planner-project',
            type: 'project',
            referenceId: 'project',
            mode: 'static',
            sortOrder: 1,
            createdAt: Date.now(),
        }));
        await store.docManager.flushPersistence();
    });

    await page.goto('/projects');

    const projectsHeading = page.getByRole('heading', { name: /^Projects \(1\)$/ });
    const projectHeading = page.getByRole('heading', { name: 'Website', exact: true });
    const projectCard = projectHeading.locator('xpath=ancestor::*[contains(@class,"border-l-4")][1]');

    await expect(projectsHeading.locator('svg')).toHaveClass(/lucide-folder-closed/);
    await expect(projectsHeading.locator('svg')).toHaveClass(/text-muted-foreground/);
    await expect(projectsHeading.locator('svg')).not.toHaveClass(/status-info-text-strong/);
    await expect(projectHeading.locator('svg')).toHaveCount(0);
    await expect(projectCard.locator('..')).toHaveCSS('gap', '24px');

    await page.goto('/clients');
    const clientsHeading = page.getByRole('heading', { name: /^Clients \(1\)$/ });
    await expect(clientsHeading.locator('svg')).toHaveClass(/lucide-users/);
    await expect(clientsHeading.locator('svg')).toHaveClass(/text-muted-foreground/);
    await expect(clientsHeading.locator('svg')).not.toHaveClass(/status-info-text-strong/);

    await page.goto('/projects');
    await projectHeading.click();

    const dashboardIcon = page.getByTestId('project-dashboard-icon');
    await expect(dashboardIcon).toHaveClass(/lucide-folder-closed/);
    await expect(dashboardIcon).toHaveCSS('color', 'rgb(239, 68, 68)');

    await page.goto('/planner');

    const plannerProject = page.getByRole('button', { name: 'Website Item options', exact: true }).first();
    await expect(plannerProject.locator('svg').first()).toHaveClass(/lucide-folder-closed/);
});

test('gives Planner project and client titles the hidden menu space until hover or keyboard focus', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        for (const type of ['project', 'client']) {
            const collection = type === 'project' ? store.projects : store.clients;
            collection.get(type).set('title', `Long ${type} name for the weekly planning card`);
            store.plannerAttachments.set(`planner-${type}`, objectToYMap({
                id: `planner-${type}`, type, referenceId: type, mode: 'static',
                sortOrder: 1, createdAt: Date.now(),
            }));
        }
        await store.docManager.flushPersistence();
    });
    await page.goto('/planner');

    for (const width of [1440, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const type of ['project', 'client']) {
            const card = page.getByRole('button', { name: `Long ${type} name for the weekly planning card Item options`, exact: true }).first();
            const title = card.getByText(`Long ${type} name for the weekly planning card`, { exact: true });
            const menu = card.getByRole('button', { name: 'Item options' });
            const titleWidth = () => title.evaluate(element => element.getBoundingClientRect().width);
            await page.getByRole('heading', { name: /^Week/ }).click();
            await page.mouse.move(0, 0);
            await expect(menu).toHaveCSS('opacity', '0');
            // The title reaches the content row's right edge while the menu is hidden.
            expect(await title.evaluate(element => Math.abs(
                element.getBoundingClientRect().right - element.parentElement.parentElement.getBoundingClientRect().right
            ))).toBeLessThan(1);
            const fullWidth = await titleWidth();
            await card.hover();
            await expect(menu).toHaveCSS('opacity', '1');
            await expect(title).toHaveCSS('text-overflow', 'ellipsis');
            expect(await title.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
            expect(fullWidth - await titleWidth()).toBeCloseTo(Math.min(32, fullWidth), 0);
            if (await titleWidth() > 0) {
                expect(await title.evaluate(element => element.getBoundingClientRect().right))
                    .toBeLessThanOrEqual((await menu.boundingBox()).x);
            }
            await page.mouse.move(0, 0);
            await expect.poll(titleWidth).toBe(fullWidth);

            await card.focus();
            await expect(menu).toHaveCSS('opacity', '1');
            expect(fullWidth - await titleWidth()).toBeCloseTo(Math.min(32, fullWidth), 0);
            await page.keyboard.press('Tab');
            await expect(menu).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('menu')).toBeVisible();
            await expect(page).toHaveURL(/\/planner/);
            await page.mouse.move(0, 0);
            await expect(menu).toHaveCSS('opacity', '1');
            expect(fullWidth - await titleWidth()).toBeCloseTo(Math.min(32, fullWidth), 0);
            await page.keyboard.press('Escape');
            await expect(menu).toBeFocused();
            await page.keyboard.press('Tab');
            await expect.poll(titleWidth).toBe(fullWidth);
        }
    }

    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const type of ['project', 'client']) {
            const card = page.getByRole('button', { name: `Long ${type} name for the weekly planning card Item options`, exact: true }).first();
            const title = card.getByText(`Long ${type} name for the weekly planning card`, { exact: true });
            const menu = card.getByRole('button', { name: 'Item options' });
            await expect(menu).toHaveCSS('opacity', '1');
            await expect(title).toHaveCSS('white-space', 'normal');
            expect(await title.evaluate(element => element.getBoundingClientRect().right))
                .toBeLessThanOrEqual((await menu.boundingBox()).x);
            await menu.click();
            await expect(page.getByRole('menu')).toBeVisible();
            await page.keyboard.press('Escape');
        }
    }
});

test('aligns Upcoming with Today and carries expense category color through dashboard, expense cards, and Planner', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        store.expenseCategories.set('software', objectToYMap({ id: 'software', name: 'Software', color: '#3b82f6', archived: false }));
        store.tasks.set('upcoming-task', objectToYMap({ id: 'upcoming-task', title: 'Monthly review', projectId: 'project', startDate: '2026-09-10', completed: false }));
        store.expenses.set('upcoming-expense', objectToYMap({ id: 'upcoming-expense', title: 'Design subscription', categoryId: 'software', clientId: 'client', projectId: 'project', date: '2026-09-10', amount: 29, amountType: 'fixed', currency: 'EUR', paidOn: null, paymentStatus: 'unpaid', paymentMode: 'manual', isPersonal: false, billable: false, isRecurring: false }));
        store.expenses.set('uncategorized-expense', objectToYMap({ id: 'uncategorized-expense', title: 'Internet bills', clientId: 'client', projectId: 'project', date: '2026-09-11', amount: 31, amountType: 'fixed', currency: 'EUR', paidOn: null, paymentStatus: 'unpaid', paymentMode: 'manual', isPersonal: false, billable: false, isRecurring: false }));
        store.expenseRecurrences.set('recurring-expense', objectToYMap({ id: 'recurring-expense', title: 'Recurring design subscription', categoryId: 'software', clientId: 'client', projectId: 'project', repeat: 'monthly', monthlyType: 'specific', monthlyDay: 10, startDate: '2026-09-10', amount: 29, amountType: 'fixed', currency: 'EUR', active: true, isPersonal: false, billable: false, isTaxExempt: false }));
        await store.docManager.flushPersistence();
    });
    await page.reload();

    const upcoming = page.getByRole('region', { name: /^Upcoming \(\d+\)$/ });
    const taskRow = upcoming.getByText('Monthly review', { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " items-center ") and contains(concat(" ", normalize-space(@class), " "), " gap-3 ")][1]');
    const expenseRow = upcoming.getByText('Design subscription', { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " items-center ") and contains(concat(" ", normalize-space(@class), " "), " gap-3 ")][1]');
    await expect(taskRow).toHaveCount(1);
    await expect(expenseRow).toHaveCount(1);
    await expect(expenseRow.getByTestId('category-color-dot')).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await page.screenshot({ path: 'test-results/dashboard-upcoming-alignment.png', fullPage: true });

    await page.goto('/expenses');
    await page.getByRole('tab', { name: /Upcoming \(/ }).click();
    const expenseCard = page.locator('.border-l-4').filter({ hasText: 'Design subscription' }).first();
    await expect(expenseCard).toHaveCSS('border-left-color', 'rgb(59, 130, 246)');
    await expect(expenseCard.getByTestId('category-color-dot')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Recurring Expenses' }).click();
    const recurringCard = page.locator('.border-l-4').filter({ hasText: 'Recurring design subscription' }).first();
    await expect(recurringCard).toHaveCSS('border-left-color', 'rgb(59, 130, 246)');

    await page.goto('/planner');
    const categorizedPlannerExpense = page.locator('.border-l-4').filter({ hasText: 'Design subscription' }).first();
    await expect(categorizedPlannerExpense).toHaveCSS('border-left-color', 'rgb(59, 130, 246)');
    const uncategorizedPlannerExpense = page.locator('.border-l-4').filter({ hasText: 'Internet bills' }).first();
    await expect(uncategorizedPlannerExpense).toHaveCSS('border-left-width', '4px');
    expect(await uncategorizedPlannerExpense.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.borderLeftColor === style.borderTopColor;
    })).toBe(true);
    await page.evaluate(() => window.__TASKTIME_STORE__.expenseCategories.get('software').set('color', '#22c55e'));
    await expect(categorizedPlannerExpense).toHaveCSS('border-left-color', 'rgb(34, 197, 94)');
});

test('keeps page scrolling available and dismisses a three-dot menu after a small threshold', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1024, height: 500 });
    const main = page.locator('main');
    await main.evaluate((element) => { element.scrollTop = 0; });
    expect(await main.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    await page.locator('main').getByText('Tasks', { exact: true })
        .locator('xpath=../../..')
        .getByRole('button', { name: 'More actions' }).first().click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const initialScroll = await main.evaluate((element) => element.scrollTop);

    await page.mouse.wheel(0, 4);
    await expect.poll(() => main.evaluate((element, baseline) => element.scrollTop - baseline, initialScroll)).toBeGreaterThan(0);
    await expect(menu).toBeVisible();

    await page.mouse.wheel(0, 20);
    await expect.poll(() => main.evaluate((element, baseline) => element.scrollTop - baseline, initialScroll)).toBeGreaterThan(8);
    await expect(menu).toHaveCount(0);
});

test('disables recurrence from task details, enables it from the list, and preserves state across reload', async ({ page }) => {
    await seed(page);
    await page.getByRole('region', { name: 'To Do Today' }).getByText('Weekly review', { exact: true }).click();
    const view = page.getByRole('dialog', { name: 'Weekly review' });
    await view.getByRole('button', { name: 'More actions' }).click();
    const disable = page.getByRole('menuitem', { name: 'Disable recurrence' });
    const edit = page.getByRole('menuitem', { name: 'Edit', exact: true });
    await expect(disable.locator('svg')).toHaveClass(/lucide-calendar-off/);
    const iconToLabelGap = (item) => item.evaluate((element) => {
        const icon = element.querySelector('svg');
        const label = element.querySelector('span');
        return Math.round(label.getBoundingClientRect().left - icon.getBoundingClientRect().right);
    });
    expect(await iconToLabelGap(disable)).toBe(await iconToLabelGap(edit));
    await disable.click();
    await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.tasks.get('weekly').toJSON().recurring.paused)).toBe(true);
    await expect(view.getByRole('heading', { name: 'Weekly review' })).toBeVisible();
    const schedule = view.getByText('Schedule', { exact: true }).locator('..');
    const modalDisabledTag = schedule.getByLabel('Recurring task disabled');
    await expect(modalDisabledTag).toHaveText('Disabled');
    await expect(modalDisabledTag.locator('svg')).toHaveClass(/lucide-calendar-off/);
    expect(await modalDisabledTag.evaluate((element) => {
        const repeatLabel = element.parentElement.firstElementChild;
        const labelRect = repeatLabel.getBoundingClientRect();
        const badgeRect = element.getBoundingClientRect();
        return Math.abs((labelRect.top + labelRect.height / 2) - (badgeRect.top + badgeRect.height / 2));
    })).toBeLessThan(2);
    expect(await modalDisabledTag.evaluate((element) => (
        element.parentElement.getBoundingClientRect().width - element.getBoundingClientRect().width
    ))).toBeGreaterThan(4);
    await page.keyboard.press('Escape');
    await expect(view).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'To Do Today' }).getByText('Weekly review', { exact: true })).toHaveCount(0);
    await page.goto('/projects/project');
    await page.getByRole('button', { name: /Recurring Tasks/ }).click();
    const recurringTaskTitle = page.getByText('Weekly review', { exact: true });
    const recurringTaskCard = recurringTaskTitle.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " border-border ") and contains(concat(" ", normalize-space(@class), " "), " rounded-lg ")][1]');
    const listDisabledTag = recurringTaskCard.getByLabel('Recurring task disabled');
    await expect(recurringTaskTitle.locator('xpath=ancestor::button[1]')).toHaveAccessibleName('Weekly review');
    await expect(listDisabledTag).toHaveText('Disabled');
    await expect(listDisabledTag.locator('svg')).toHaveClass(/lucide-calendar-off/);
    await recurringTaskCard.getByTitle('More actions').click();
    const enable = page.getByRole('menuitem', { name: 'Enable recurrence' });
    await expect(enable.locator('svg')).toHaveClass(/lucide-calendar-check-2/);
    await enable.click();
    await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.tasks.get('weekly').toJSON().recurring)).toEqual({ type: 'weekly', weeklyDays: [2], paused: false, resumeFrom: '2026-09-08' });
    await expect(listDisabledTag).toHaveCount(0);
    await page.evaluate(() => window.__TASKTIME_STORE__.docManager.flushPersistence());
    await page.reload();
    await expect(page.getByText('Weekly review', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => window.__TASKTIME_STORE__.tasks.get('weekly').toJSON().completedDatesByYear)).toEqual({ '2026': { '9': [1] } });
});

test('matches the Planner active timer dot to the running timer state', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        store.timers.set('project', {
            projectId: 'project',
            taskId: 'weekly',
            startTime: Date.now() - 60_000,
            paused: false,
        });
        await store.docManager.flushPersistence();
    });
    await page.goto('/planner');

    const globalTimerIndicator = page.locator('[aria-label="Timer active"].h-3:visible');
    const plannerTimerIndicator = page.locator('[aria-label="Timer active"].h-2:visible');
    await expect(globalTimerIndicator).toBeVisible();
    await expect(plannerTimerIndicator).toBeVisible();

    expect(await plannerTimerIndicator.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(await globalTimerIndicator.evaluate((element) => getComputedStyle(element).backgroundColor));
});

test('saving an open task editor preserves a newer pause and its active timer', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.__TASKTIME_STORE__.tasks.get('weekly').set('recurring', {
        type: 'weekly', weeklyDays: [2], paused: false, resumeFrom: '2026-09-01',
    }));
    await page.getByRole('region', { name: 'To Do Today' }).getByText('Weekly review', { exact: true }).click();
    await page.getByRole('dialog', { name: 'Weekly review' }).getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Task' });
    await editor.getByLabel('Task Title').fill('Weekly review renamed');
    const preserved = await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        store.tasks.get('weekly').set('recurring', { type: 'weekly', weeklyDays: [2], paused: true, resumeFrom: '2026-09-08' });
        store.tasks.get('weekly').set('skipUntilNextRecurring', true);
        store.tasks.get('weekly').set('skippedOccurrenceDate', '2026-09-08');
        store.timers.set('project', { projectId: 'project', taskId: 'weekly', startTime: Date.now() - 60_000, paused: false });
        return { timers: store.timers.toJSON(), entries: store.activeTimeEntries.toJSON() };
    });
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor).toHaveCount(0);
    expect(await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        return { task: store.tasks.get('weekly').toJSON(), timers: store.timers.toJSON(), entries: store.activeTimeEntries.toJSON() };
    })).toEqual({
        ...preserved,
        task: expect.objectContaining({ title: 'Weekly review renamed',
            recurring: { type: 'weekly', weeklyDays: [2], paused: true, resumeFrom: '2026-09-08' },
            skipUntilNextRecurring: true, skippedOccurrenceDate: '2026-09-08',
            completedDatesByYear: { '2026': { '9': [1] } },
        }),
    });
});

test('uses separate category forms and displays their original color in both themes', async ({ page }) => {
    await seed(page);
    await page.goto('/expenses');
    await page.getByRole('button', { name: 'More actions', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Manage categories' }).click();
    await page.getByRole('button', { name: 'Add category', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add category', exact: true });
    await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Design tools');
    await form.getByRole('button', { name: 'Select Blue color' }).click();
    await page.screenshot({ path: 'test-results/category-form-light.png', fullPage: true });
    await form.getByRole('button', { name: 'Add Category', exact: true }).click();
    await expect(form).toHaveCount(0);
    const manager = page.getByRole('dialog', { name: 'Expense Categories' });
    const categoryHeader = manager.getByText('Active categories').locator('..').locator('..');
    await expect(categoryHeader).toHaveCSS('display', 'flex');
    await expect(categoryHeader).toHaveCSS('justify-content', 'space-between');
    const row = manager.getByText('Design tools', { exact: true }).locator('xpath=ancestor::div[contains(@class,"border")][1]');
    await expect(row.getByTestId('category-color-dot')).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        const category = [...store.expenseCategories.values()]
            .map((value) => value.toJSON())
            .find((value) => value.name === 'Design tools');
        store.expenses.set('category-dialog-expense', objectToYMap({
            id: 'category-dialog-expense', title: 'Design expense', date: '2026-09-08', currency: 'EUR', amount: 20,
            paymentStatus: 'paid', categoryId: category.id, isPersonal: true, billable: false,
            billingStatus: 'unbilled', isRecurring: false, isTaxExempt: false,
        }));
    });
    await row.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const blockedDelete = page.getByRole('dialog', { name: 'Can\'t delete "Design tools"' });
    await expect(blockedDelete).toContainText('1 expense. Archive it instead if you want to hide it from new expenses.');
    await page.screenshot({ path: 'test-results/category-delete-blocked-dialog.png', fullPage: true });
    await blockedDelete.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(blockedDelete).toHaveCount(0);
    await row.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit category' });
    await edit.getByRole('button', { name: 'Clear color' }).click();
    await edit.getByRole('button', { name: 'Update Category' }).click();
    await expect(row.getByTestId('category-color-dot')).not.toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await manager.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Dark Mode', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'More actions', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Manage categories' }).click();
    await page.getByRole('button', { name: 'Add category', exact: true }).click();
    await page.screenshot({ path: 'test-results/category-form-dark.png', fullPage: true });
    await page.getByRole('dialog', { name: 'Add category' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await manager.getByRole('button', { name: 'Done' }).click();
    await page.goto('/account?section=preferences');
    const signInTrigger = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(signInTrigger.locator('svg')).toHaveCount(1);
    await signInTrigger.click();
    const signIn = page.getByRole('dialog', { name: 'Sign in' });
    const google = signIn.getByRole('button', { name: 'Continue with Google Drive' });
    const dropbox = signIn.getByRole('button', { name: 'Continue with Dropbox' });
    await expect(google).toBeVisible();
    await expect(dropbox).toBeVisible();
    await expect(google).toHaveClass(/bg-primary/);
    await expect(dropbox).toHaveClass(/bg-primary/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/account-sign-in-phone.png', fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeFocused();
    await expect(page).toHaveURL(/section=preferences/);
});

test('offers category-only propagation for a recurring expense and keeps category details dynamic', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
        const store = window.__TASKTIME_STORE__;
        const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
        const expenseBase = {
            currency: 'EUR', amount: 12, paymentStatus: 'paid', paymentMode: 'auto', paidOn: '2026-09-01',
            isPersonal: true, billable: false, billingStatus: 'unbilled', isRecurring: true,
            recurrenceId: 'streaming', amountType: 'fixed', isTaxExempt: false,
        };
        store.expenseCategories.set('software', objectToYMap({ id: 'software', name: 'Software', group: 'software', color: '#ef4444', archived: false }));
        store.expenseCategories.set('office', objectToYMap({ id: 'office', name: 'Office', group: 'office', color: '#3b82f6', archived: false }));
        store.expenseRecurrences.set('streaming', objectToYMap({
            id: 'streaming', title: 'Streaming service', categoryId: null, repeat: 'monthly', monthlyType: 'specific',
            monthlyDay: 1, startDate: '2026-08-01', lastGeneratedDate: '2026-09-01', amount: 12,
            amountType: 'fixed', paymentMode: 'auto', currency: 'EUR', active: true,
            isPersonal: true, billable: false, isTaxExempt: false,
        }));
        store.expenseRecurrences.set('hosting', objectToYMap({
            id: 'hosting', title: 'Hosting service', categoryId: 'office', repeat: 'monthly', monthlyType: 'specific',
            monthlyDay: 15, startDate: '2026-08-15', lastGeneratedDate: '2026-08-15', amount: 30,
            amountType: 'fixed', paymentMode: 'auto', currency: 'EUR', active: true,
            isPersonal: true, billable: false, isTaxExempt: false,
        }));
        store.expenses.set('streaming-september', objectToYMap({
            ...expenseBase, id: 'streaming-september', title: 'September streaming service',
            date: '2026-09-01', categoryId: null,
        }));
        store.expenses.set('streaming-august', objectToYMap({
            ...expenseBase, id: 'streaming-august', title: 'August streaming service',
            date: '2026-08-01', paidOn: '2026-08-01', categoryId: 'office',
        }));
        await store.docManager.flushPersistence();
    });
    await page.goto('/expenses');
    await page.getByRole('tab', { name: 'Recurring Expenses', exact: true }).click();
    const recurrenceCard = page.locator('.border-l-4').filter({ hasText: 'Streaming service' }).first();
    await recurrenceCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Recurring Expense' });
    await editor.getByRole('textbox', { name: /^Title/ }).fill('Updated streaming service');
    await editor.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Software', exact: true }).click();
    await editor.getByRole('button', { name: 'Manage categories' }).click();
    await page.getByRole('dialog', { name: 'Expense Categories' }).getByRole('button', { name: 'Done' }).click();
    await expect(editor.getByRole('textbox', { name: /^Title/ })).toHaveValue('Updated streaming service');
    await expect(editor.getByLabel('Category')).toContainText('Software');
    await editor.getByRole('button', { name: 'Save Expense' }).click();

    const propagation = page.getByRole('dialog', { name: 'Update existing expenses?' });
    await expect(propagation).toContainText('1 existing expense from this recurrence still has no category');
    await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.expenseRecurrences.get('streaming').toJSON().categoryId)).toBe('software');
    expect(await page.evaluate(() => window.__TASKTIME_STORE__.expenses.get('streaming-september').toJSON().categoryId)).toBeNull();
    await page.screenshot({ path: 'test-results/recurring-expense-category-propagation.png', fullPage: true });
    await propagation.getByRole('button', { name: 'Update 1 existing expense' }).click();

    await expect(editor).toHaveCount(0);
    const hostingCard = page.locator('.border-l-4').filter({ hasText: 'Hosting service' }).first();
    await hostingCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const hostingEditor = page.getByRole('dialog', { name: 'Edit Recurring Expense' });
    await expect(hostingEditor.getByRole('textbox', { name: /^Title/ })).toHaveValue('Hosting service');
    await expect(hostingEditor.getByLabel('Category')).toContainText('Office');
    await hostingEditor.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => ({
        september: window.__TASKTIME_STORE__.expenses.get('streaming-september').toJSON(),
        august: window.__TASKTIME_STORE__.expenses.get('streaming-august').toJSON(),
    }))).toEqual({
        september: expect.objectContaining({ title: 'September streaming service', categoryId: 'software' }),
        august: expect.objectContaining({ title: 'August streaming service', categoryId: 'office' }),
    });

    await page.getByRole('tab', { name: 'Expenses', exact: true }).click();
    await page.getByRole('tab', { name: /Paid \(/ }).click();
    const expenseCard = page.locator('.border-l-4').filter({ hasText: 'September streaming service' }).first();
    await expect(expenseCard).toContainText('Category: Software');
    await expect(expenseCard).toHaveCSS('border-left-color', 'rgb(239, 68, 68)');
    await page.evaluate(() => {
        const category = window.__TASKTIME_STORE__.expenseCategories.get('software');
        category.set('name', 'Online services');
        category.set('group', 'professional');
        category.set('color', '#3b82f6');
    });
    await expect(expenseCard).toContainText('Category: Online services');
    await expect(expenseCard).toHaveCSS('border-left-color', 'rgb(59, 130, 246)');
});

test('keeps the sidebar title on one line and project sections collapsible', async ({ page }) => {
    await seed(page);
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    const title = page.locator('aside h1');
    await expect(title).toHaveCSS('white-space', 'nowrap');
    await expect(title).toHaveCSS('text-overflow', 'ellipsis');
    await expect.poll(() => title.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'More actions', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Project' });
    await expect(dialog.getByRole('button', { name: 'Billing & Timer Rules' })).toHaveAttribute('aria-expanded', 'false');
    await dialog.getByRole('button', { name: 'Billing & Timer Rules' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Override client rate for this project' })).toBeVisible();
    await page.screenshot({ path: 'test-results/project-sections-light.png', fullPage: true });
    await dialog.getByRole('button', { name: 'Project Planning' }).click();
    await dialog.getByLabel('Target budget').fill('-1');
    await dialog.getByRole('button', { name: 'Project Planning' }).click();
    await dialog.getByRole('button', { name: 'Update Project' }).click();
    await expect(dialog.getByRole('button', { name: 'Project Planning' })).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByLabel('Target budget')).toBeFocused();
    await dialog.getByLabel('Target budget').fill('2400');
    await dialog.getByRole('button', { name: 'Project Planning' }).click();
    await dialog.getByRole('button', { name: 'Update Project' }).click();
    await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.projects.get('project').toJSON().budgetAmount)).toBe(2400);
});

test('reveals missing inherited rates and rejects zero overrides inside collapsed billing settings', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => {
        const store = window.__TASKTIME_STORE__;
        store.clients.get('client').set('hourlyRate', null);
        store.projects.get('project').set('hourlyRate', null);
    });
    await page.goto('/projects');
    await page.getByRole('button', { name: 'More actions', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Project' });
    const billing = dialog.getByRole('button', { name: 'Billing & Timer Rules' });
    await dialog.getByRole('button', { name: 'Update Project' }).click();
    await expect(billing).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByRole('alert')).toContainText('hourly rate greater than 0');
    const override = dialog.getByRole('checkbox', { name: 'Override client rate for this project' });
    await expect(override).toBeFocused();
    await override.click();
    await dialog.getByLabel('Hourly Rate').fill('0');
    await billing.click();
    await dialog.getByRole('button', { name: 'Update Project' }).click();
    await expect(dialog.getByLabel('Hourly Rate')).toBeFocused();
    await dialog.getByLabel('Hourly Rate').fill('75');
    await billing.click();
    await dialog.getByRole('button', { name: 'Update Project' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__TASKTIME_STORE__.projects.get('project').toJSON().hourlyRate)).toBe(75);
});
