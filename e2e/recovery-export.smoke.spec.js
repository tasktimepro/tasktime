import { test, expect } from '@playwright/test';
import * as Y from 'yjs';

const readerPath = '/src/recovery/localWorkspaceRecovery.ts';
const databaseName = 'tasktime-yjs-core';

function updates() {
    const doc = new Y.Doc();
    doc.getMap('projects').set('p', { id: 'p', title: 'Recovery fixture' });
    const result = [...Y.encodeStateAsUpdate(doc)];
    doc.destroy();
    return result;
}

test.beforeEach(async ({ page }) => {
    // Serve a blank page from the test origin so no app initialization can
    // create, repair, or mutate the synthetic recovery workspace.
    await page.route('**/__recovery-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Recovery fixture</title>' }));
    await page.goto('/__recovery-fixture');
});

async function seed(page, rows = updates()) {
    await page.evaluate(async ({ name, rows }) => {
        await new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('updates', { autoIncrement: true });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('updates', 'readwrite');
                tx.objectStore('updates').add(new Uint8Array(rows));
                tx.oncomplete = () => { db.close(); resolve(); };
            };
        });
    }, { name: databaseName, rows });
}

test('fresh browser detection leaves databases absent', async ({ page }) => {
    const result = await page.evaluate(async path => (await import(path)).inspectLocalWorkspace(), readerPath);
    expect(result.hasData).toBe(false);
    expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
});

test('exports existing Yjs data without opening a writable transaction or changing source bytes', async ({ page }) => {
    const originalBytes = updates();
    await seed(page, originalBytes);
    const result = await page.evaluate(async path => {
        const transactions = [];
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (stores, mode, options) {
            transactions.push(mode);
            if (mode !== 'readonly') throw new Error('Recovery attempted a write');
            return original.call(this, stores, mode, options);
        };
        const reader = await import(path);
        const before = await indexedDB.databases();
        const info = await reader.inspectLocalWorkspace();
        const backup = await reader.createLocalBackup();
        return { info, backup, before, after: await indexedDB.databases(), transactions };
    }, readerPath);
    expect(result.info.hasData).toBe(true);
    expect(result.backup.projects).toEqual([{ id: 'p', title: 'Recovery fixture' }]);
    expect(result.before).toEqual(result.after);
    expect(new Set(result.transactions)).toEqual(new Set(['readonly']));
    const bytes = await page.evaluate(async name => new Promise(resolve => {
        const request = indexedDB.open(name);
        request.onsuccess = () => {
            const db = request.result;
            const read = db.transaction('updates', 'readonly').objectStore('updates').getAll();
            read.onsuccess = () => { db.close(); resolve(read.result.map(row => [...row])); };
        };
    }), databaseName);
    // The fixture's random Yjs client id is preserved, not normalized/re-encoded.
    expect(bytes).toEqual([originalBytes]);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(bytes[0]));
    expect(restored.getMap('projects').get('p').title).toBe('Recovery fixture');
    restored.destroy();
});

test('portable download restores through the real app store on a separate origin', async ({ page, context }) => {
    await seed(page);
    const backup = await page.evaluate(async path => (await import(path)).createLocalBackup(), readerPath);
    const target = await context.newPage();
    await target.route('**/__recovery-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Restore fixture</title>' }));
    await target.goto('http://localhost:3101/__recovery-fixture');
    const restored = await target.evaluate(async backup => {
        const { YjsStore } = await import('/src/stores/yjs/YjsStore.ts');
        const { parseBackupImportJson } = await import('/src/utils/backupData.ts');
        const store = new YjsStore();
        try {
            await store.initialize();
            await store.importBackupData(parseBackupImportJson(JSON.stringify(backup)));
            return await store.exportBackupData();
        } finally { store.destroy(); }
    }, backup);
    expect(restored.projects).toEqual(backup.projects);
});

test('concurrent storage changes stop the download', async ({ page }) => {
    await seed(page);
    const error = await page.evaluate(async ({ path, name }) => {
        const enumerate = IDBFactory.prototype.databases;
        let reads = 0;
        IDBFactory.prototype.databases = async function () {
            if (++reads === 2) {
                await new Promise((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(name);
                    request.onsuccess = resolve;
                    request.onerror = reject;
                });
            }
            return enumerate.call(this);
        };
        try { await (await import(path)).createLocalBackup(); return null; }
        catch (error) { return error.message; }
    }, { path: readerPath, name: databaseName });
    expect(error).toMatch(/changed/i);
});

test('corrupt updates fail instead of offering an incomplete backup', async ({ page }) => {
    await seed(page, [99]);
    const message = await page.evaluate(async path => {
        try { await (await import(path)).createLocalBackup(); return null; }
        catch (error) { return error.message; }
    }, readerPath);
    expect(message).toBeTruthy();
});
