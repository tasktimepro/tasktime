import { expect, test } from '@playwright/test';
import {
    createRemoteDriveFixture,
    createStatefulDriveFixture,
    createPersonalProject,
    disconnectDriveFromAccount,
    editProjectFromList,
    getProjectCard,
    installMockDriveRoutes,
    openProjectDashboard,
    projectsHeadingName,
    seedStoredGoogleSession,
    syncNowFromAccount,
} from './helpers/tasktime.js';

test.describe('Cloud sync smoke', () => {
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
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

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
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

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
        await expect(page.getByRole('button', { name: /Connect Google Drive|Reconnect to Drive/ })).toBeVisible();

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
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-valid-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();

        const connectedButton = page.getByRole('button', { name: 'In sync' });
        await expect(connectedButton).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reconnect to Drive' })).toHaveCount(0);

        await connectedButton.click();

        await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();
        await expect(page.getByText('playwright-sync@example.com')).toBeVisible();
    });

    test('falls back to reconnect state when an existing Drive session expires during a later Drive request', async ({ page }) => {
        const driveFixture = createStatefulDriveFixture(createRemoteDriveFixture({}));
        let expireDriveRequests = false;

        await page.route('**/auth/status', async (route) => {
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
        await expect(page.getByRole('button', { name: 'Reconnect to Drive' })).toBeVisible();
    });

    test('shows reconnect state when a previous Drive session is no longer valid', async ({ page }) => {
        await page.route('**/auth/status', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ authenticated: false }),
            });
        });

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();

        await seedStoredGoogleSession(page, {
            sessionId: `playwright-invalid-session-${Date.now()}`,
            userId: 'playwright-user',
            email: 'playwright-sync@example.com',
        });

        await page.reload();

        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect to Drive' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toHaveCount(0);
    });

    test('shows a sync service error when Google Drive auth init cannot be reached', async ({ page }) => {
        await page.route('**/auth/init', async (route) => {
            await route.abort('failed');
        });

        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

        await page.getByRole('button', { name: 'Connect Google Drive' }).click();

        await expect(page.getByText(/Unable to reach the Google Drive sync service/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
    });
});
