import * as Y from 'yjs';
import { expect, test } from '@playwright/test';
import {
    createRemoteDriveFixture,
    createStatefulDriveFixture,
    createPersonalProject,
    disconnectDriveFromAccount,
    editProjectFromList,
    getProjectCard,
    installMockDirectDriveRoutes,
    installMockDriveRoutes,
    openProjectDashboard,
    projectsHeadingName,
    seedStoredGoogleSession,
    syncNowFromAccount,
} from './helpers/tasktime.js';

test.describe('Cloud sync smoke', () => {
    test('loads dashboard history and survives refresh without premature sync warnings', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        const initial = createRemoteDriveFixture({ tasks: [{ id: 'active', title: 'Active task', projectId: null }] });
        const manifest = JSON.parse(initial.fileBodies.get('playwright-manifest'));
        const year = new Date().getFullYear();
        const historicalStart = new Date(year, 0, 2, 10).getTime();
        for (const [name, collection, records] of [
            ['tasks-archived', 'tasks', [{ id: 'archived', title: 'Archived history task', projectId: null, archived: true }]],
            [`entries-${year}`, 'timeEntries', [{ id: 'historical-entry', taskId: 'archived', start: historicalStart, end: historicalStart + 3_600_000 }]],
        ]) {
            const doc = new Y.Doc();
            for (const record of records) doc.getMap(collection).set(record.id, new Y.Map(Object.entries(record)));
            const id = `playwright-${name}`;
            const stateFile = `tasktime-yjs-${name}.bin`;
            manifest.documents[name] = { stateFile, stateVersion: 1, deltas: [], lastCompaction: initial.modifiedTime };
            initial.files.push({ id, name: stateFile, modifiedTime: initial.modifiedTime });
            initial.fileBodies.set(id, Buffer.from(Y.encodeStateAsUpdate(doc)));
            doc.destroy();
        }
        initial.fileBodies.set('playwright-manifest', JSON.stringify(manifest));
        const driveFixture = createStatefulDriveFixture(initial);
        await installMockDirectDriveRoutes(page, driveFixture);
        const warnings = [];
        page.on('console', message => {
            if (/Cannot sync: not connected|Validation warning|Rejected corrupt remote/.test(message.text())) warnings.push(message.text());
        });
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            store.preferences.set('autoSyncEnabled', true);
            store.preferences.set('autoSyncMode', 'sync');
            store.preferences.set('backupEnabled', false);
        });
        await seedStoredGoogleSession(page, { sessionId: 'dashboard-history-session', userId: 'dashboard-history-user', email: 'dashboard-history@example.com' });
        await page.goto('/');
        for (let pass = 0; pass < 2; pass++) {
            await expect(page.getByRole('region', { name: 'Dashboard summary' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();
            await expect.poll(() => page.evaluate(async year => {
                const store = window.__TASKTIME_STORE__;
                const tasks = await store.loadArchivedTasks();
                const entries = await store.loadEntriesForYear(year);
                return { title: tasks.get('archived')?.get('title'), taskId: entries.get('historical-entry')?.get('taskId') };
            }, year)).toEqual({ title: 'Archived history task', taskId: 'archived' });
            expect(warnings).toEqual([]);
            if (pass === 0) await page.reload();
        }
        expect(driveFixture.proxyRequestCount()).toBe(0);
    });

    test('restores existing records after first-load onboarding and cancelled expense forms without adding defaults', async ({ page }) => {
        const existingTask = {
            id: 'existing-onboarding-task',
            title: 'Create my first project',
            note: 'A saved task from an older version must be preserved.',
            completed: false,
            archived: false,
        };
        const existingCategories = [
            { id: 'existing-travel', name: 'Travel', group: 'travel', isDefault: true, archived: false },
            { id: 'existing-travel-copy', name: 'Travel', group: 'travel', isDefault: true, archived: false },
            { id: 'existing-custom', name: 'My category', isDefault: false, archived: true, color: '#3b82f6' },
        ];
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            tasks: [existingTask],
            expenseCategories: existingCategories,
        }));
        await installMockDirectDriveRoutes(page, driveFixture);

        await page.goto('/');
        const onboardingDialog = page.getByRole('dialog', { name: 'TaskTime Pro setup' });
        await expect(onboardingDialog).toBeVisible();
        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await onboardingDialog.getByRole('button', { name: 'Next', exact: true }).click();
        await onboardingDialog.getByRole('button', { name: 'Get Started', exact: true }).click();
        await page.goto('/expenses');
        await page.getByRole('button', { name: 'New Expense', exact: true }).click();
        const expenseDialog = page.getByRole('dialog', { name: 'New Expense' });
        await expenseDialog.getByRole('button', { name: 'Manage categories', exact: true }).click();
        const categoriesDialog = page.getByRole('dialog', { name: 'Expense Categories', exact: true });
        await expect(categoriesDialog.getByText('0 available for new expenses')).toBeVisible();
        await categoriesDialog.getByRole('button', { name: 'Done', exact: true }).click();
        await expenseDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

        await seedStoredGoogleSession(page, {
            sessionId: 'playwright-empty-start-restore',
            userId: 'playwright-empty-start-user',
            email: 'playwright-empty-start@example.com',
        });
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();

        const readRestoredRecords = () => page.evaluate(() => {
            const store = window.__TASKTIME_STORE__;
            return {
                tasks: Array.from(store.tasks.values(), (value) => value.toJSON()),
                categories: Array.from(store.expenseCategories.values(), (value) => value.toJSON()),
            };
        });
        await expect.poll(readRestoredRecords).toEqual({ tasks: [existingTask], categories: existingCategories });
        expect(driveFixture.directUploads()).toHaveLength(0);

        await page.reload();
        await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();
        expect(await readRestoredRecords()).toEqual({ tasks: [existingTask], categories: existingCategories });
        expect(driveFixture.directUploads()).toHaveLength(0);
    });

    test('uploads through the direct Google transport without falling back to the Worker proxy', async ({ page }) => {
        const projectTitle = `Playwright Direct Project ${Date.now()}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        const failedRequests = [];

        page.on('requestfailed', (request) => {
            // React StrictMode and reload intentionally abort the independent
            // catalog effect. Preserve every other failure, including all
            // provider requests and non-cancellation billing errors.
            if (new URL(request.url()).pathname === '/billing/catalog'
                && request.failure()?.errorText === 'net::ERR_ABORTED') return;
            failedRequests.push(`${request.url()}: ${request.failure()?.errorText || 'unknown error'}`);
        });

        await installMockDirectDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await seedStoredGoogleSession(page, {
            sessionId: `playwright-direct-session-${Date.now()}`,
            userId: 'playwright-direct-user',
            email: 'playwright-direct@example.com',
        });

        await page.reload();
        await expect.poll(() => driveFixture.statusRequestCount()).toBeGreaterThan(0);
        await expect.poll(() => driveFixture.tokenRequestCount()).toBeGreaterThan(0);
        expect(failedRequests).toEqual([]);
        await expect.poll(() => driveFixture.directRequestCount()).toBeGreaterThan(0);
        // The creation helper navigates to /projects. Finish the initial pull
        // first so that deliberate navigation does not cancel a provider read.
        await expect(page.getByRole('button', { name: 'In sync', exact: true })).toBeVisible();

        await createPersonalProject(page, projectTitle);
        await syncNowFromAccount(page);

        await expect.poll(() => driveFixture.directUploads().length).toBeGreaterThan(0);
        expect(driveFixture.directRequestCount()).toBeGreaterThan(0);
        expect(driveFixture.proxyRequestCount()).toBe(0);
        expect(driveFixture.directUploads().some(({ method }) => method === 'POST')).toBe(true);
        expect(driveFixture.directUploads().some(({ method }) => method === 'PATCH')).toBe(true);
        expect(driveFixture.directUploads().every(({ contentType }) => (
            contentType.startsWith('multipart/related; boundary=tasktime-')
        ))).toBe(true);
        if (process.env.VITE_BILLING_UI_ENABLED === 'true') {
            expect(driveFixture.billingRequestCount()).toBeGreaterThan(0);
        }
        expect(failedRequests).toEqual([]);
    });

    test('pulls remote data on first manual restore when local state is pristine', async ({ page }) => {
        const projectTitle = `Playwright Remote Project ${Date.now()}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            projects: [
                {
                    id: 'playwright-remote-project',
                    title: projectTitle,
                    isPersonal: true,
                    archived: false,
                },
            ],
        }));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByText('No projects')).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-first-fetch-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sync changes' })).toHaveCount(0);
        expect(driveFixture.uploads).toHaveLength(0);

        await page.reload();

        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible({ timeout: 20_000 });
    });

    test('keeps local reconnect changes pending until Sync Now in manual mode', async ({ page }) => {
        const projectTitle = `Playwright Reconnect Project ${Date.now()}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage' })).toBeVisible();

        await createPersonalProject(page, projectTitle);

        expect(driveFixture.readCurrentSyncedCoreProjectTitles()).not.toContain(projectTitle);

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-reconnect-session-${Date.now()}`,
            userId: 'playwright-reconnect-user',
            email: 'playwright-reconnect@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sync changes' })).toBeVisible();
        await expect.poll(() => {
            return driveFixture.readCurrentSyncedCoreProjectTitles().includes(projectTitle);
        }).toBe(false);

        await page.getByRole('button', { name: 'Sync changes' }).click();

        await expect.poll(() => {
            return driveFixture.readCurrentSyncedCoreProjectTitles().includes(projectTitle);
        }).toBe(true);
        await expect(page.getByRole('button', { name: 'Sync changes' })).toHaveCount(0);
    });

    test('merges remote data with disconnected local edits after Sync Now in manual mode', async ({ page }) => {
        const remoteProjectTitle = `Playwright Remote Reconnect Project ${Date.now()}`;
        const localProjectTitle = `Playwright Local Reconnect Project ${Date.now()}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            projects: [
                {
                    id: 'playwright-remote-reconnect-project',
                    title: remoteProjectTitle,
                    isPersonal: true,
                    archived: false,
                },
            ],
        }));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage' })).toBeVisible();

        await createPersonalProject(page, localProjectTitle);

        expect(driveFixture.readCurrentSyncedCoreProjectTitles()).toContain(remoteProjectTitle);
        expect(driveFixture.readCurrentSyncedCoreProjectTitles()).not.toContain(localProjectTitle);

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-reconnect-merge-session-${Date.now()}`,
            userId: 'playwright-reconnect-merge-user',
            email: 'playwright-reconnect-merge@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: localProjectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: remoteProjectTitle, exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Sync changes' })).toBeVisible();
        await expect.poll(() => {
            const titles = driveFixture.readCurrentSyncedCoreProjectTitles();
            return titles.includes(localProjectTitle) && titles.includes(remoteProjectTitle);
        }).toBe(false);

        await syncNowFromAccount(page);
        await page.goto('/projects');

        await expect(page.getByRole('heading', { name: localProjectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: remoteProjectTitle, exact: true })).toBeVisible();
        await expect.poll(() => {
            const titles = driveFixture.readCurrentSyncedCoreProjectTitles();
            return titles.includes(localProjectTitle) && titles.includes(remoteProjectTitle);
        }).toBe(true);
        await expect(page.getByRole('button', { name: 'Sync changes' })).toHaveCount(0);

        await page.reload();

        await expect(page.getByRole('heading', { name: localProjectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: remoteProjectTitle, exact: true })).toBeVisible();
    });

    test('keeps an active timer running after backup auto-sync when older entries exist for the same project', async ({ page }) => {
        const now = Date.now();
        const projectId = `playwright-timer-project-${now}`;
        const taskId = `playwright-timer-task-${now}`;
        const projectTitle = `Playwright Sync Timer Project ${now}`;
        const taskTitle = `Playwright Sync Timer Task ${now}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            projects: [
                {
                    id: projectId,
                    title: projectTitle,
                    isPersonal: true,
                    archived: false,
                },
            ],
            tasks: [
                {
                    id: taskId,
                    projectId,
                    title: taskTitle,
                    completed: false,
                    archived: false,
                },
            ],
            timeEntries: [
                {
                    id: `playwright-old-entry-${now}`,
                    taskId,
                    start: 1_000,
                    end: 2_000,
                    _stoppedTimerKey: projectId,
                },
            ],
        }));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-backup-timer-session-${now}`,
            userId: 'playwright-backup-timer-user',
            email: 'playwright-backup-timer@example.com',
        });

        await page.reload();
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();

        await page.goto('/account?section=sync');
        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();

        const autoSyncCheckbox = page.getByRole('checkbox', { name: 'Enable auto-sync' });
        await expect(autoSyncCheckbox).toBeVisible();
        if (!(await autoSyncCheckbox.isChecked())) {
            await autoSyncCheckbox.click();
        }

        await syncNowFromAccount(page);
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await openProjectDashboard(page, projectTitle);
        await expect(page.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();

        const taskRow = page
            .getByRole('button', { name: taskTitle, exact: true })
            .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]')
            .first();

        const uploadCountBeforeStart = driveFixture.uploads.length;

        await taskRow.getByTitle('Start Timer').first().click();
        await expect(taskRow.getByTitle('Save & Stop Timer').first()).toBeVisible();

        await expect.poll(() => driveFixture.uploads.length, { timeout: 20_000 }).toBeGreaterThan(uploadCountBeforeStart);
        await page.waitForTimeout(1_000);

        await expect(taskRow.getByTitle('Save & Stop Timer').first()).toBeVisible();
        await expect(taskRow.getByTitle('Pause Timer').first()).toBeVisible();
    });

    test('keeps an active timer running after reload reconnect in backup mode when older entries exist for the same project', async ({ page }) => {
        const now = Date.now();
        const projectId = `playwright-reload-timer-project-${now}`;
        const taskId = `playwright-reload-timer-task-${now}`;
        const projectTitle = `Playwright Reload Sync Timer Project ${now}`;
        const taskTitle = `Playwright Reload Sync Timer Task ${now}`;
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            projects: [
                {
                    id: projectId,
                    title: projectTitle,
                    isPersonal: true,
                    archived: false,
                },
            ],
            tasks: [
                {
                    id: taskId,
                    projectId,
                    title: taskTitle,
                    completed: false,
                    archived: false,
                },
            ],
            timeEntries: [
                {
                    id: `playwright-reload-old-entry-${now}`,
                    taskId,
                    start: 1_000,
                    end: 2_000,
                    _stoppedTimerKey: projectId,
                },
            ],
        }));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-reload-backup-timer-session-${now}`,
            userId: 'playwright-reload-backup-timer-user',
            email: 'playwright-reload-backup-timer@example.com',
        });

        await page.reload();
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();

        await page.goto('/account?section=sync');
        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();

        const autoSyncCheckbox = page.getByRole('checkbox', { name: 'Enable auto-sync' });
        await expect(autoSyncCheckbox).toBeVisible();
        if (!(await autoSyncCheckbox.isChecked())) {
            await autoSyncCheckbox.click();
        }

        await syncNowFromAccount(page);
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await openProjectDashboard(page, projectTitle);
        await expect(page.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();

        const taskRow = page
            .getByRole('button', { name: taskTitle, exact: true })
            .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]')
            .first();

        const uploadCountBeforeStart = driveFixture.uploads.length;

        await taskRow.getByTitle('Start Timer').first().click();
        await expect(taskRow.getByTitle('Save & Stop Timer').first()).toBeVisible();

        await expect.poll(() => driveFixture.uploads.length, { timeout: 20_000 }).toBeGreaterThan(uploadCountBeforeStart);

        await page.reload();
        await expect(page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible({ timeout: 20_000 });

        const reloadedTaskRow = page
            .getByRole('button', { name: taskTitle, exact: true })
            .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]')
            .first();

        await expect(reloadedTaskRow.getByTitle('Save & Stop Timer').first()).toBeVisible();
        await expect(reloadedTaskRow.getByTitle('Pause Timer').first()).toBeVisible();
    });

    test('converges same-project remote and disconnected local edits after Sync Now in manual mode', async ({ page }) => {
        // Disconnect, reconcile and reload can exhaust the default total budget on private CI.
        // Keep each assertion's deadline unchanged while allowing the complete journey.
        test.setTimeout(180_000);
        const originalTitle = `Playwright Reconnect Shared Project ${Date.now()}`;
        const localTitle = `Playwright Reconnect Local Title ${Date.now()}`;
        const mergedColorValue = 'rgb(59, 130, 246)';
        const baseProject = {
            id: 'playwright-reconnect-shared-project',
            title: originalTitle,
            isPersonal: true,
            archived: false,
        };
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({
            projects: [baseProject],
        }));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-reconnect-conflict-session-${Date.now()}`,
            userId: 'playwright-reconnect-conflict-user',
            email: 'playwright-reconnect-conflict@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();

        await syncNowFromAccount(page);
        await page.goto('/projects');

        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();

        await disconnectDriveFromAccount(page);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /^(?:Connect|Reconnect) cloud storage$/ })).toBeVisible();

        await editProjectFromList(page, {
            currentTitle: originalTitle,
            nextTitle: localTitle,
        });

        await expect(page.getByRole('heading', { name: localTitle, exact: true })).toBeVisible();
        await expect(driveFixture.readCurrentSyncedCoreProjects().find((project) => project.id === baseProject.id)?.title).toBe(originalTitle);

        driveFixture.appendRemoteProjectPatch({
            baseProject,
            changes: { color: '#3b82f6' },
        });

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-reconnect-conflict-session-restored-${Date.now()}`,
            userId: 'playwright-reconnect-conflict-user',
            email: 'playwright-reconnect-conflict@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: localTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
        await expect(getProjectCard(page, localTitle)).not.toHaveCSS('border-left-color', mergedColorValue);
        await expect(page.getByRole('button', { name: 'Sync changes' })).toBeVisible();
        await expect.poll(() => {
            const project = driveFixture.readCurrentSyncedCoreProjects().find((item) => item.id === baseProject.id);
            return project?.title === localTitle && project?.color === '#3b82f6';
        }).toBe(false);

        await syncNowFromAccount(page);
        await page.goto('/projects');

        await expect(page.getByRole('heading', { name: localTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
        await expect(getProjectCard(page, localTitle)).toHaveCSS('border-left-color', mergedColorValue);
        await expect.poll(() => {
            const project = driveFixture.readCurrentSyncedCoreProjects().find((item) => item.id === baseProject.id);
            return project?.title === localTitle && project?.color === '#3b82f6';
        }).toBe(true);
        await expect(page.getByRole('button', { name: 'Sync changes' })).toHaveCount(0);

        await page.reload();

        await expect(page.getByRole('heading', { name: localTitle, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
        await expect(getProjectCard(page, localTitle)).toHaveCSS('border-left-color', mergedColorValue);
    });

    test('syncs projects across two connected browser contexts without losing either change', async ({ browser }) => {
        test.slow();

        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();

        try {
            await installMockDriveRoutes(contextA, driveFixture);
            await installMockDriveRoutes(contextB, driveFixture);

            const pageA = await contextA.newPage();
            const pageB = await contextB.newPage();

            await Promise.all([
                pageA.goto('/projects'),
                pageB.goto('/projects'),
            ]);

            await Promise.all([
                seedStoredGoogleSession(pageA, {
                    sessionId: `playwright-multicontext-session-a-${Date.now()}`,
                    userId: 'playwright-user-a',
                    email: 'playwright-sync-a@example.com',
                }),
                seedStoredGoogleSession(pageB, {
                    sessionId: `playwright-multicontext-session-b-${Date.now()}`,
                    userId: 'playwright-user-b',
                    email: 'playwright-sync-b@example.com',
                }),
            ]);

            await Promise.all([
                pageA.reload(),
                pageB.reload(),
            ]);

            await Promise.all([
                expect(pageA.getByRole('button', { name: 'In sync' })).toBeVisible(),
                expect(pageB.getByRole('button', { name: 'In sync' })).toBeVisible(),
            ]);

            const projectTitleA = `Playwright Context A Project ${Date.now()}`;
            const projectTitleB = `Playwright Context B Project ${Date.now()}`;

            await createPersonalProject(pageA, projectTitleA);
            await expect(pageA.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await pageA.getByRole('button', { name: 'Sync changes' }).click();
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjectTitles().includes(projectTitleA);
            }).toBe(true);

            await syncNowFromAccount(pageB);

            await pageB.goto('/projects');
            await expect(pageB.getByRole('heading', { name: projectTitleA })).toBeVisible();

            await createPersonalProject(pageB, projectTitleB);
            await expect(pageB.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await pageB.getByRole('button', { name: 'Sync changes' }).click();
            await expect.poll(() => {
                const titles = driveFixture.readCurrentSyncedCoreProjectTitles();
                return titles.includes(projectTitleA) && titles.includes(projectTitleB);
            }).toBe(true);

            await syncNowFromAccount(pageA);

            await pageA.goto('/projects');
            await expect(pageA.getByRole('heading', { name: projectTitleA })).toBeVisible();
            await expect(pageA.getByRole('heading', { name: projectTitleB })).toBeVisible();

            await pageB.reload();
            await expect(pageB.getByRole('heading', { name: projectTitleA })).toBeVisible();
            await expect(pageB.getByRole('heading', { name: projectTitleB })).toBeVisible();

            expect(driveFixture.readCurrentSyncedCoreProjectTitles()).toEqual(
                expect.arrayContaining([projectTitleA, projectTitleB]),
            );
        } finally {
            await Promise.allSettled([
                contextA.close(),
                contextB.close(),
            ]);
        }
    });

    test('converges same-project edits across devices after one device reloads before an explicit sync', async ({ browser }) => {
        test.slow();

        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();

        try {
            await installMockDriveRoutes(contextA, driveFixture);
            await installMockDriveRoutes(contextB, driveFixture);

            const pageA = await contextA.newPage();
            const pageB = await contextB.newPage();

            await Promise.all([
                pageA.goto('/projects'),
                pageB.goto('/projects'),
            ]);

            await Promise.all([
                seedStoredGoogleSession(pageA, {
                    sessionId: `playwright-conflict-session-a-${Date.now()}`,
                    userId: 'playwright-conflict-user-a',
                    email: 'playwright-conflict-a@example.com',
                }),
                seedStoredGoogleSession(pageB, {
                    sessionId: `playwright-conflict-session-b-${Date.now()}`,
                    userId: 'playwright-conflict-user-b',
                    email: 'playwright-conflict-b@example.com',
                }),
            ]);

            await Promise.all([
                pageA.reload(),
                pageB.reload(),
            ]);

            const originalTitle = `Playwright Shared Project ${Date.now()}`;
            const titleFromA = `Playwright Conflict Title A ${Date.now()}`;
            const mergedColorName = 'Blue';
            const mergedColorValue = 'rgb(59, 130, 246)';

            await createPersonalProject(pageA, originalTitle);
            await expect(pageA.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await pageA.getByRole('button', { name: 'Sync changes' }).click();
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjectTitles().includes(originalTitle);
            }).toBe(true);

            await syncNowFromAccount(pageB);
            await pageB.goto('/projects');
            await expect(pageB.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();

            await editProjectFromList(pageA, {
                currentTitle: originalTitle,
                nextTitle: titleFromA,
            });

            // Simulate the page being refreshed before the local change is synced.
            await pageA.reload();
            await expect(pageA.getByRole('heading', { name: titleFromA, exact: true })).toBeVisible();
            await expect(pageA.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjects().find((project) => project.title === titleFromA)?.title;
            }).not.toBe(titleFromA);

            await pageA.getByRole('button', { name: 'Sync changes' }).click();
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjects().find((project) => project.title === titleFromA)?.title;
            }).toBe(titleFromA);

            await editProjectFromList(pageB, {
                currentTitle: originalTitle,
                colorName: mergedColorName,
            });
            await expect(pageB.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await pageB.getByRole('button', { name: 'Sync changes' }).click();
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjects().find((project) => project.title === titleFromA)?.color;
            }).toBe('#3b82f6');

            await syncNowFromAccount(pageA);
            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjects().find((project) => project.title === titleFromA)?.color;
            }).toBe('#3b82f6');
            await pageA.goto('/projects');

            await syncNowFromAccount(pageB);
            await pageB.goto('/projects');

            await Promise.all([
                pageA.reload(),
                pageB.reload(),
            ]);

            await expect(pageA.getByRole('heading', { name: titleFromA, exact: true })).toBeVisible();
            await expect(pageB.getByRole('heading', { name: titleFromA, exact: true })).toBeVisible();
            await expect(pageA.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
            await expect(pageB.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
            await expect(getProjectCard(pageA, titleFromA)).toHaveCSS('border-left-color', mergedColorValue);
            await expect(getProjectCard(pageB, titleFromA)).toHaveCSS('border-left-color', mergedColorValue);
            expect(driveFixture.readCurrentSyncedCoreProjectTitles()).toContain(titleFromA);
        } finally {
            await Promise.allSettled([
                contextA.close(),
                contextB.close(),
            ]);
        }
    });

    test('keeps same-device tabs converged and syncs the shared result without a reload', async ({ browser }) => {
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        const context = await browser.newContext();

        try {
            await installMockDriveRoutes(context, driveFixture);

            const pageA = await context.newPage();
            await pageA.goto('/projects');
            await expect(pageA.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

            await seedStoredGoogleSession(pageA, {
                sessionId: `playwright-same-device-session-${Date.now()}`,
                userId: 'playwright-same-device-user',
                email: 'playwright-same-device@example.com',
            });

            await pageA.reload();
            await expect(pageA.getByRole('button', { name: 'In sync' })).toBeVisible();

            const pageB = await context.newPage();
            await pageB.goto('/projects');

            await Promise.all([
                expect(pageA.getByRole('heading', { name: projectsHeadingName })).toBeVisible(),
                expect(pageB.getByRole('heading', { name: projectsHeadingName })).toBeVisible(),
                expect(pageB.getByRole('button', { name: 'In sync' })).toBeVisible(),
            ]);

            const originalTitle = `Playwright Same Device Project ${Date.now()}`;
            const updatedTitle = `Playwright Same Device Renamed ${Date.now()}`;

            await createPersonalProject(pageA, originalTitle);

            await expect(pageB.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
            await expect(pageB.getByText('No projects')).toHaveCount(0);

            await expect(pageA.getByRole('button', { name: 'Sync changes' })).toBeVisible();
            await pageA.getByRole('button', { name: 'Sync changes' }).click();

            await expect.poll(() => {
                return driveFixture.readCurrentSyncedCoreProjectTitles().includes(originalTitle);
            }).toBe(true);

            await editProjectFromList(pageB, {
                currentTitle: originalTitle,
                nextTitle: updatedTitle,
            });

            await expect(pageA.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();
            await expect(pageA.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
            await expect(pageB.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();

            await Promise.all([
                pageA.reload(),
                pageB.reload(),
            ]);

            await expect(pageA.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();
            await expect(pageB.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();
            await expect(pageA.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
            await expect(pageB.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test('restores a valid Drive session and opens sync settings from the connected status', async ({ page }) => {
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));

        await installMockDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage' })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-valid-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();

        const connectedButton = page.getByRole('button', { name: 'In sync' });
        await expect(connectedButton).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reconnect cloud storage' })).toHaveCount(0);

        await connectedButton.click();

        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();
        await expect(page.getByText('playwright-sync@example.com')).toBeVisible();
    });

    test('offers the moved destination first and keeps source reuse behind a destructive warning', async ({ page }) => {
        const movedFixture = createRemoteDriveFixture({});
        const bindingId = 'playwright-moved-binding';

        movedFixture.files.push({
            id: bindingId,
            name: 'tasktime-cloud-binding.json',
            modifiedTime: movedFixture.modifiedTime,
        });
        movedFixture.fileBodies.set(bindingId, JSON.stringify({
            version: 1,
            workspaceId: '42de9b18-445c-4d28-b5c9-88bc476fc7f1',
            generation: 1,
            activeProvider: 'dropbox',
            state: 'moved',
            operationId: 'f85f92e3-1584-4d77-8292-3a9977adcf44',
            updatedAt: movedFixture.modifiedTime,
        }));

        const driveFixture = createStatefulDriveFixture(movedFixture);
        await installMockDirectDriveRoutes(page, driveFixture);

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await seedStoredGoogleSession(page, {
            sessionId: `playwright-moved-session-${Date.now()}`,
            userId: 'playwright-moved-user',
            email: 'playwright-moved@example.com',
        });

        await page.reload();
        await page.goto('/account?section=sync');

        await expect(page.getByRole('main').getByText('Moved to Dropbox', { exact: true })).toBeVisible();
        await expect(page.getByText('TaskTime data in this Google Drive was moved to Dropbox.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Dropbox' })).toBeVisible();

        await page.getByRole('button', { name: 'Use Google Drive' }).click();

        await expect(page.getByRole('dialog', { name: 'Use Google Drive for a new workspace?' })).toBeVisible();
        await expect(page.getByText(/permanently deletes all TaskTime sync files and backups in Google Drive/i)).toBeVisible();
        await expect(page.getByText(/Dropbox stays unchanged/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Clear & use Google Drive' })).toBeVisible();
    });

    test('falls back to reconnect state when an existing Drive session expires during a later Drive request', async ({ page }) => {
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        let expireDriveRequests = false;

        await page.route('**/auth/status**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ authenticated: true }),
            });
        });

        await page.route('**/drive/files**', async (route) => {
            if (expireDriveRequests) {
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Session expired' }),
                });
                return;
            }

            await driveFixture.handleRoute(route);
        });

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-expiring-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();
        await expect(page.getByRole('button', { name: 'In sync' })).toBeVisible();

        expireDriveRequests = true;

        await page.goto('/account?section=sync');
        await expect(page.getByRole('dialog', { name: 'Reconnect Google Drive' })).toBeVisible();
        await page.getByRole('button', { name: 'Not now' }).click();
        await expect(page.getByRole('dialog', { name: 'Reconnect Google Drive' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();
        await expect(page.getByText('Not connected')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect cloud storage' })).toBeVisible();
    });

    test('shows reconnect state when a previous Drive session is no longer valid', async ({ page }) => {
        await page.route('**/auth/status**', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ authenticated: false }),
            });
        });

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage' })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-invalid-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect cloud storage' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect cloud storage', exact: true })).toHaveCount(0);
    });

    test('shows a sync service error when Google Drive auth init cannot be reached', async ({ page }) => {
        await page.route('**/auth/init', async (route) => {
            await route.abort('failed');
        });

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await page.getByRole('button', { name: 'Connect cloud storage' }).click();

        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();
        await page.getByRole('button', { name: 'Connect Google Drive' }).click();

        await expect(page.getByText(/Unable to reach the Google Drive sync service/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
    });
});
