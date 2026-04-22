import * as Y from 'yjs';
import { expect } from '@playwright/test';

export const projectsHeadingName = /^Projects(?:\s+(?:\(\d+\)|\d+))?$/;
export const expensesHeadingName = /^Expenses(?: \(\d+\))?$/;

function objectToYMap(data) {
    const ymap = new Y.Map();

    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            ymap.set(key, value);
        }
    }

    return ymap;
}

function applyCoreEntities(doc, { projects = [], tasks = [], clients = [] }) {
    const projectsMap = doc.getMap('projects');
    const tasksMap = doc.getMap('tasks');
    const clientsMap = doc.getMap('clients');

    for (const project of projects) {
        projectsMap.set(project.id, objectToYMap(project));
    }

    for (const task of tasks) {
        tasksMap.set(task.id, objectToYMap(task));
    }

    for (const client of clients) {
        clientsMap.set(client.id, objectToYMap(client));
    }
}

function encodeCoreState({ projects = [], tasks = [], clients = [] }) {
    const doc = new Y.Doc();
    applyCoreEntities(doc, { projects, tasks, clients });

    return Buffer.from(Y.encodeStateAsUpdate(doc));
}

function encodeCoreDelta({
    baseProjects = [],
    baseTasks = [],
    baseClients = [],
    projects = [],
    tasks = [],
    clients = [],
}) {
    const doc = new Y.Doc();
    applyCoreEntities(doc, {
        projects: baseProjects,
        tasks: baseTasks,
        clients: baseClients,
    });

    const stateVector = Y.encodeStateVector(doc);
    applyCoreEntities(doc, { projects, tasks, clients });

    return Buffer.from(Y.encodeStateAsUpdate(doc, stateVector));
}

function buildCurrentSyncedCoreDoc(state, getFileByName) {
    const manifestFile = getFileByName('tasktime-yjs-manifest.json');

    if (!manifestFile) {
        return null;
    }

    const manifest = parseManifestBody(state.fileBodies.get(manifestFile.id));
    const coreDocManifest = manifest?.documents?.core;
    const coreFile = getFileByName('tasktime-yjs-core.bin');

    if (!coreDocManifest || !coreFile) {
        return null;
    }

    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(state.fileBodies.get(coreFile.id)));

    for (const delta of coreDocManifest.deltas || []) {
        const deltaFile = getFileByName(`tasktime-yjs-core-delta-${delta.id}.bin`);

        if (!deltaFile) {
            continue;
        }

        Y.applyUpdate(doc, new Uint8Array(state.fileBodies.get(deltaFile.id)));
    }

    return doc;
}

function encodeEntriesActiveState({ timeEntries = [] }) {
    const doc = new Y.Doc();
    const timeEntriesMap = doc.getMap('timeEntries');

    for (const timeEntry of timeEntries) {
        timeEntriesMap.set(timeEntry.id, objectToYMap(timeEntry));
    }

    return Buffer.from(Y.encodeStateAsUpdate(doc));
}

export function createRemoteDriveFixture({
    projects = [],
    tasks = [],
    clients = [],
    timeEntries = [],
}) {
    const modifiedTime = new Date().toISOString();
    const manifestId = 'playwright-manifest';
    const coreStateId = 'playwright-core-state';
    const activeEntriesStateId = 'playwright-entries-active-state';

    const manifest = {
        version: 1,
        deviceId: 'playwright-remote-device',
        lastSync: modifiedTime,
        documents: {
            core: {
                stateFile: 'tasktime-yjs-core.bin',
                stateVersion: 1,
                lastCompaction: modifiedTime,
                deltas: [],
            },
            'entries-active': {
                stateFile: 'tasktime-yjs-entries-active.bin',
                stateVersion: 1,
                lastCompaction: modifiedTime,
                deltas: [],
            },
        },
    };

    return {
        modifiedTime,
        files: [
            { id: manifestId, name: 'tasktime-yjs-manifest.json', modifiedTime },
            { id: coreStateId, name: 'tasktime-yjs-core.bin', modifiedTime },
            { id: activeEntriesStateId, name: 'tasktime-yjs-entries-active.bin', modifiedTime },
        ],
        fileBodies: new Map([
            [manifestId, JSON.stringify(manifest)],
            [coreStateId, encodeCoreState({ projects, tasks, clients })],
            [activeEntriesStateId, encodeEntriesActiveState({ timeEntries })],
        ]),
    };
}

export function readProjectTitlesFromCoreState(stateBuffer) {
    const doc = new Y.Doc();
    const update = stateBuffer instanceof Uint8Array ? stateBuffer : new Uint8Array(stateBuffer);

    Y.applyUpdate(doc, update);

    const titles = [];
    const projectsMap = doc.getMap('projects');

    projectsMap.forEach((value) => {
        if (value instanceof Y.Map) {
            titles.push(value.get('title'));
            return;
        }

        if (value && typeof value === 'object' && 'title' in value) {
            titles.push(value.title);
        }
    });

    return titles.filter(Boolean);
}

function parseMultipartUpload(request) {
    const contentType = request.headers()['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);

    if (!boundaryMatch) {
        return null;
    }

    const boundary = boundaryMatch[1];
    const raw = request.postDataBuffer()?.toString('latin1') || '';
    const parts = raw.split(`--${boundary}`);
    let metadata = null;
    let fileBuffer = null;

    for (const part of parts) {
        if (!part.includes('Content-Disposition')) {
            continue;
        }

        const separatorIndex = part.indexOf('\r\n\r\n');
        if (separatorIndex === -1) {
            continue;
        }

        const headers = part.slice(0, separatorIndex);
        const body = part.slice(separatorIndex + 4).replace(/\r\n$/, '');

        if (headers.includes('name="metadata"')) {
            metadata = JSON.parse(body);
        }

        if (headers.includes('name="file"')) {
            fileBuffer = Buffer.from(body, 'latin1');
        }
    }

    if (!metadata || !fileBuffer) {
        return null;
    }

    return { metadata, fileBuffer };
}

function readProjectTitlesFromCoreDoc(doc) {
    const projects = doc.getMap('projects');
    const titles = [];

    projects.forEach((projectMap) => {
        titles.push(projectMap.get('title'));
    });

    return titles.filter(Boolean);
}

function readProjectsFromCoreDoc(doc) {
    const projects = doc.getMap('projects');
    const items = [];

    projects.forEach((projectMap, id) => {
        if (projectMap instanceof Y.Map) {
            items.push({
                id,
                title: projectMap.get('title') || null,
                color: projectMap.get('color') || null,
            });
            return;
        }

        if (projectMap && typeof projectMap === 'object') {
            items.push({
                id,
                title: projectMap.title || null,
                color: projectMap.color || null,
            });
        }
    });

    return items;
}

function parseManifestBody(body) {
    const json = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
    return JSON.parse(json);
}

export function createStatefulDriveFixture(initialFixture) {
    const state = {
        modifiedTime: initialFixture.modifiedTime,
        files: initialFixture.files.map((file) => ({ ...file })),
        fileBodies: new Map(initialFixture.fileBodies),
        uploads: [],
    };
    let lastModifiedTimeMs = Number.isFinite(Date.parse(initialFixture.modifiedTime))
        ? Date.parse(initialFixture.modifiedTime)
        : Date.now();
    let nextFileId = 1;

    const touch = () => {
        const now = Date.now();

        lastModifiedTimeMs = now > lastModifiedTimeMs ? now : lastModifiedTimeMs + 1;
        state.modifiedTime = new Date(lastModifiedTimeMs).toISOString();
    };

    const getFileById = (fileId) => {
        return state.files.find((file) => file.id === fileId) || null;
    };

    const getFileByName = (name) => {
        return state.files.find((file) => file.name === name) || null;
    };

    const upsertFile = ({ fileId = null, name, body }) => {
        touch();

        const existing = fileId ? getFileById(fileId) : getFileByName(name);

        if (existing) {
            existing.name = name;
            existing.modifiedTime = state.modifiedTime;
            state.fileBodies.set(existing.id, body);
            return existing;
        }

        const created = {
            id: `playwright-drive-file-${nextFileId++}`,
            name,
            modifiedTime: state.modifiedTime,
        };

        state.files.push(created);
        state.fileBodies.set(created.id, body);
        return created;
    };

    const handleRoute = async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pathParts = url.pathname.split('/');
        const fileId = pathParts[pathParts.length - 1];

        if (request.method() === 'GET') {
            if (url.searchParams.get('alt') === 'media') {
                const body = state.fileBodies.get(fileId);

                if (!body) {
                    await route.fulfill({ status: 404, body: 'Missing fixture file' });
                    return;
                }

                await route.fulfill({
                    status: 200,
                    contentType: fileId.includes('manifest') ? 'application/json' : 'application/octet-stream',
                    body,
                });
                return;
            }

            if (url.searchParams.get('fields') === 'modifiedTime') {
                const targetFile = getFileById(fileId);

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ modifiedTime: targetFile?.modifiedTime || state.modifiedTime }),
                });
                return;
            }

            const query = url.searchParams.get('q');
            const files = query
                ? state.files.filter((file) => query.includes(`name='${file.name}'`))
                : state.files;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ files }),
            });
            return;
        }

        if (request.method() === 'POST' || request.method() === 'PATCH') {
            const upload = parseMultipartUpload(request);

            if (upload) {
                state.uploads.push(upload);

                const savedFile = upsertFile({
                    fileId: request.method() === 'PATCH' ? fileId : null,
                    name: upload.metadata.name,
                    body: upload.fileBuffer,
                });

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: savedFile.id, modifiedTime: savedFile.modifiedTime }),
                });
                return;
            }
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    };

    return {
        ...state,
        handleRoute,
        getFileByName,
        readCurrentCoreProjectTitles() {
            const coreFile = getFileByName('tasktime-yjs-core.bin');

            if (!coreFile) {
                return [];
            }

            return readProjectTitlesFromCoreState(state.fileBodies.get(coreFile.id));
        },
        readCurrentSyncedCoreProjectTitles() {
            const doc = buildCurrentSyncedCoreDoc(state, getFileByName);

            if (!doc) {
                return [];
            }

            return readProjectTitlesFromCoreDoc(doc);
        },
        readCurrentSyncedCoreProjects() {
            const doc = buildCurrentSyncedCoreDoc(state, getFileByName);

            if (!doc) {
                return [];
            }

            return readProjectsFromCoreDoc(doc);
        },
        replaceRemoteCoreState({ projects = [], tasks = [], clients = [] }) {
            const manifestFile = getFileByName('tasktime-yjs-manifest.json');
            const coreFile = getFileByName('tasktime-yjs-core.bin');

            if (!manifestFile || !coreFile) {
                throw new Error('Remote core state fixture is not initialized.');
            }

            touch();

            const manifest = parseManifestBody(state.fileBodies.get(manifestFile.id));
            const coreManifest = manifest.documents?.core;

            if (!coreManifest) {
                throw new Error('Remote manifest is missing the core document.');
            }

            coreManifest.stateVersion = (coreManifest.stateVersion || 0) + 1;
            coreManifest.lastCompaction = state.modifiedTime;
            coreManifest.deltas = [];
            manifest.lastSync = state.modifiedTime;

            upsertFile({
                fileId: coreFile.id,
                name: coreFile.name,
                body: encodeCoreState({ projects, tasks, clients }),
            });
            upsertFile({
                fileId: manifestFile.id,
                name: manifestFile.name,
                body: JSON.stringify(manifest),
            });
        },
        appendRemoteCoreDelta({
            baseProjects = [],
            baseTasks = [],
            baseClients = [],
            projects = [],
            tasks = [],
            clients = [],
        }) {
            const manifestFile = getFileByName('tasktime-yjs-manifest.json');

            if (!manifestFile) {
                throw new Error('Remote manifest fixture is not initialized.');
            }

            touch();

            const manifest = parseManifestBody(state.fileBodies.get(manifestFile.id));
            const coreManifest = manifest.documents?.core;

            if (!coreManifest) {
                throw new Error('Remote manifest is missing the core document.');
            }

            const deltaId = `playwright-${nextFileId++}`;

            coreManifest.deltas.push({
                id: deltaId,
                timestamp: state.modifiedTime,
            });
            manifest.lastSync = state.modifiedTime;

            upsertFile({
                name: `tasktime-yjs-core-delta-${deltaId}.bin`,
                body: encodeCoreDelta({
                    baseProjects,
                    baseTasks,
                    baseClients,
                    projects,
                    tasks,
                    clients,
                }),
            });
            upsertFile({
                fileId: manifestFile.id,
                name: manifestFile.name,
                body: JSON.stringify(manifest),
            });
        },
        appendRemoteProjectPatch({ baseProject, changes }) {
            const manifestFile = getFileByName('tasktime-yjs-manifest.json');

            if (!manifestFile) {
                throw new Error('Remote manifest fixture is not initialized.');
            }

            touch();

            const manifest = parseManifestBody(state.fileBodies.get(manifestFile.id));
            const coreManifest = manifest.documents?.core;

            if (!coreManifest) {
                throw new Error('Remote manifest is missing the core document.');
            }

            const currentDoc = buildCurrentSyncedCoreDoc(state, getFileByName);

            if (!currentDoc) {
                throw new Error('Remote core state fixture is not initialized.');
            }

            const projectsMap = currentDoc.getMap('projects');
            const currentProjectMap = projectsMap.get(baseProject.id);

            if (!(currentProjectMap instanceof Y.Map)) {
                throw new Error(`Remote core project ${baseProject.id} is missing.`);
            }

            const stateVector = Y.encodeStateVector(currentDoc);

            for (const [key, value] of Object.entries(changes)) {
                if (value === undefined) {
                    continue;
                }

                currentProjectMap.set(key, value);
            }

            const deltaId = `playwright-${nextFileId++}`;

            coreManifest.deltas.push({
                id: deltaId,
                timestamp: state.modifiedTime,
            });
            manifest.lastSync = state.modifiedTime;

            upsertFile({
                name: `tasktime-yjs-core-delta-${deltaId}.bin`,
                body: Buffer.from(Y.encodeStateAsUpdate(currentDoc, stateVector)),
            });
            upsertFile({
                fileId: manifestFile.id,
                name: manifestFile.name,
                body: JSON.stringify(manifest),
            });
        },
    };
}

export async function installMockDriveRoutes(target, driveFixture) {
    await target.route('**/auth/status', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: true }),
        });
    });

    await target.route('**/drive/files**', driveFixture.handleRoute);
}

async function openCreateProjectDialog(page) {
    const createFirstButton = page.getByRole('button', { name: 'Create First Project' });

    if (await createFirstButton.count()) {
        await createFirstButton.click();
    } else {
        await page.getByRole('button', { name: 'New Project' }).click();
    }

    await expect(page.getByRole('dialog', { name: 'Create New Project' })).toBeVisible();
}

export async function seedStoredGoogleSession(page, {
    sessionId,
    userId,
    email,
    createdAt = new Date().toISOString(),
}) {
    await page.evaluate(async (session) => {
        await new Promise((resolve, reject) => {
            const request = window.indexedDB.open('tasktime-db', 1);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains('app-data')) {
                    db.createObjectStore('app-data');
                }
            };

            request.onerror = () => {
                reject(request.error || new Error('Unable to open IndexedDB.'));
            };

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction('app-data', 'readwrite');
                const store = transaction.objectStore('app-data');

                store.put(session, 'google-auth-session');

                transaction.oncomplete = () => {
                    db.close();
                    resolve();
                };

                transaction.onerror = () => {
                    reject(transaction.error || new Error('Unable to store Google auth session.'));
                };
            };
        });
    }, {
        sessionId,
        userId,
        email,
        createdAt,
    });
}

export async function selectComboboxOption(page, trigger, optionName) {
    await trigger.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function setPersonalProjectState(projectDialog, isPersonal) {
    const personalProjectCheckbox = projectDialog.getByRole('checkbox', { name: /Personal project \(Not billable\)/i });
    const currentState = await personalProjectCheckbox.getAttribute('data-state');
    const isCurrentlyPersonal = currentState === 'checked';

    if (isCurrentlyPersonal !== isPersonal) {
        await personalProjectCheckbox.click();
    }
}

export async function createPersonalProject(page, projectTitle) {
    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
    await openCreateProjectDialog(page);

    const projectDialog = page.getByRole('dialog', { name: 'Create New Project' });

    await expect(projectDialog).toBeVisible();
    await projectDialog.getByLabel(/Project Title/i).fill(projectTitle);
    await setPersonalProjectState(projectDialog, true);
    await projectDialog.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
}

export async function syncNowFromAccount(page) {
    await page.goto('/account?section=sync');
    await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();

    const syncNowButton = page.getByRole('button', { name: 'Sync Now' });

    await expect(syncNowButton).toBeVisible();
    await expect(syncNowButton).toBeEnabled({ timeout: 20000 });
    await syncNowButton.click();
    await expect(page.getByText('Synced successfully')).toBeVisible({ timeout: 20000 });
    await expect(syncNowButton).toBeEnabled({ timeout: 20000 });
}

export async function disconnectDriveFromAccount(page) {
    await page.goto('/account?section=sync');
    await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();

    const disconnectButton = page.getByRole('button', { name: 'Disconnect' });

    await expect(disconnectButton).toBeVisible();
    await disconnectButton.click();

    const dialog = page.getByRole('dialog', { name: 'Disconnect from Google Drive?' });

    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Sync & Disconnect' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Disconnected from Google Drive')).toBeVisible();
    await expect(page.getByText('Not connected')).toBeVisible();
}

export function getProjectCard(page, projectTitle) {
    return page
        .getByRole('heading', { name: projectTitle, exact: true })
    .locator('xpath=ancestor::*[contains(@class,"border-l-4")][1]');
}

export async function editProjectFromList(page, { currentTitle, nextTitle, colorName }) {
    const projectCard = getProjectCard(page, currentTitle);

    await projectCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const projectDialog = page.getByRole('dialog', { name: 'Edit Project' });
    await expect(projectDialog).toBeVisible();

    if (nextTitle) {
        const titleInput = projectDialog.getByLabel(/Project Title/i);
        await titleInput.fill(nextTitle);
    }

    if (colorName) {
        await projectDialog.getByRole('button', { name: `Select ${colorName} color` }).click();
    }

    await projectDialog.getByRole('button', { name: 'Update Project' }).click();

    await expect(projectDialog).not.toBeVisible();
    await expect(page.getByText('Project updated successfully!')).toBeVisible();

    const visibleTitle = nextTitle || currentTitle;
    await expect(page.getByRole('heading', { name: visibleTitle, exact: true })).toBeVisible();
}

export async function renameProjectFromList(page, { currentTitle, nextTitle }) {
    await editProjectFromList(page, { currentTitle, nextTitle });
}

export async function createBillableProject(page, {
    projectTitle,
    clientTitle,
    clientName,
    clientHourlyRate,
    clientCurrency = null,
    billableTimeIncrementOption = null,
}) {
    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
    await openCreateProjectDialog(page);

    const projectDialog = page.getByRole('dialog', { name: 'Create New Project' });
    await expect(projectDialog).toBeVisible();

    await setPersonalProjectState(projectDialog, false);

    await projectDialog.getByRole('button', { name: '+ New Client' }).click();

    const clientDialog = page.getByRole('dialog', { name: 'Create New Client' });
    await expect(clientDialog).toBeVisible();

    await clientDialog.getByLabel(/Client Title/i).fill(clientTitle);
    await clientDialog.getByLabel(/Business\/Name/i).fill(clientName);
    await clientDialog.getByRole('button', { name: /Pricing & Taxes/i }).click();
    await clientDialog.getByLabel(/Hourly Rate/i).fill(String(clientHourlyRate));

    if (clientCurrency) {
        await clientDialog.getByRole('combobox', { name: 'Default Currency' }).click();
        await page.getByRole('option', { name: new RegExp(`^${clientCurrency} - `) }).click();
    }

    await clientDialog.getByRole('button', { name: 'Create Client' }).click();

    await expect(clientDialog).not.toBeVisible();
    await expect(projectDialog).toBeVisible();

    await projectDialog.getByLabel(/Project Title/i).fill(projectTitle);
    await selectComboboxOption(
        page,
        projectDialog.locator('button[role="combobox"]').first(),
        clientTitle,
    );

    if (billableTimeIncrementOption) {
        await selectComboboxOption(
            page,
            projectDialog.getByRole('combobox', { name: 'Minimum billed time increment' }),
            billableTimeIncrementOption,
        );
    }

    await projectDialog.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
}

export async function openProjectDashboard(page, projectTitle) {
    await page.getByRole('heading', { name: projectTitle }).click();

    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
}

export async function createInlineTask(page, taskTitle) {
    await page.getByRole('button', { name: 'New Task', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create New Task' })).toBeVisible();

    await page.getByPlaceholder('Enter task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByRole('button', { name: taskTitle, exact: true })).toBeVisible();
}

export async function openExpensesPage(page) {
    await page.goto('/expenses?section=all');
    await expect(page.getByRole('heading', { name: expensesHeadingName })).toBeVisible();
}

export async function createTrackedInvoice(page, {
    projectTitle,
    clientTitle,
    clientName,
    taskTitle,
    templateName,
    clientHourlyRate = 125,
    clientCurrency = null,
}) {
    await createBillableProject(page, {
        projectTitle,
        clientTitle,
        clientName,
        clientHourlyRate,
        clientCurrency,
    });
    await openProjectDashboard(page, projectTitle);

    await expect(page.getByRole('heading', { name: /^Tasks \(0\)$/ })).toBeVisible();
    await createInlineTask(page, taskTitle);

    await page.getByTitle('View Time Entries').click();
    const timeEntriesDialog = page.getByRole('dialog', { name: `Time Entries - ${taskTitle}` });
    await expect(timeEntriesDialog).toBeVisible();

    await timeEntriesDialog.getByRole('button', { name: 'Add Entry', exact: true }).click();
    const addEntryDialog = page.getByRole('dialog', { name: 'Add Time Entry' });
    await expect(addEntryDialog).toBeVisible();

    await addEntryDialog.getByLabel('Time spent').fill('1m');
    await addEntryDialog.getByRole('button', { name: 'Add Entry', exact: true }).click();

    await expect(timeEntriesDialog.getByRole('heading', { name: 'Current Time Entries (1)' })).toBeVisible();
    await timeEntriesDialog.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: /^Generate Invoice/ }).first().click();

    const invoiceDialog = page.getByRole('dialog', { name: 'New Invoice' });
    await expect(invoiceDialog).toBeVisible();

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

    await selectComboboxOption(
        page,
        templateSelect,
        templateName,
    );
    await expect(templateSelect).toContainText(templateName);

    const pricingToggle = invoiceDialog.getByRole('button', { name: /Pricing & Totals/i });
    const expectedTotal = (await pricingToggle.innerText()).replace('Pricing & Totals', '').trim();
    await expect(pricingToggle).toContainText(expectedTotal);

    await pricingToggle.click();
    await expect(invoiceDialog.getByText('Subtotal:', { exact: true }).locator('..')).toContainText(expectedTotal);
    await expect(invoiceDialog.getByText('Total:', { exact: true }).locator('..')).toContainText(expectedTotal);

    await invoiceDialog.getByRole('button', { name: 'Generate Invoice', exact: true }).click();

    await expect(invoiceDialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Invoices \(1\)$/ })).toBeVisible();

    await page.goto('/invoices?section=invoices');
    await expect(page.getByRole('heading', { name: /^Invoices \(1\)$/ })).toBeVisible();

    return {
        projectTitle,
        clientTitle,
        clientName,
        taskTitle,
        templateName,
        expectedTotal,
    };
}

export function getInvoiceCardByProject(page, projectTitle) {
    return page
        .getByText(`Project: ${projectTitle}`)
        .locator('xpath=ancestor::div[contains(@class, "p-4")][1]');
}