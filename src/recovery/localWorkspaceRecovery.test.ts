import * as Y from 'yjs';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createLocalBackup, decodeWorkspaceSnapshot, inspectLocalWorkspace } from './localWorkspaceRecovery';
import { parseBackupImportJson } from '@/utils/backupData';

function snapshot(documents: Record<string, Record<string, Record<string, unknown>>>) {
    return Object.entries(documents).map(([name, maps]) => {
        const doc = new Y.Doc();
        for (const [collection, values] of Object.entries(maps)) {
            for (const [key, value] of Object.entries(values)) doc.getMap(collection).set(key, value);
        }
        const updates = [Y.encodeStateAsUpdate(doc)];
        doc.destroy();
        return { name, updates };
    });
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function installStorage(documents = snapshot({ core: { projects: { p: { id: 'p', title: 'Saved' } } } }), options: { journal?: string; blocked?: boolean; corruptStore?: boolean; changed?: boolean } = {}) {
    vi.stubGlobal('location', { origin: 'https://tasktime.pro' });
    vi.stubGlobal('crypto', webcrypto);
    let enumeration = 0;
    const close = vi.fn();
    const factory = {
        databases: vi.fn(async () => options.changed && ++enumeration > 1 ? [] : [
            ...documents.map(doc => ({ name: `tasktime-yjs-${doc.name}` })),
            ...(options.journal ? [{ name: options.journal }] : []),
        ]),
        open: vi.fn(name => {
            const request: any = {};
            queueMicrotask(() => {
                if (options.blocked) { request.onblocked(); return; }
                request.result = {
                    close,
                    objectStoreNames: { contains: () => !options.corruptStore },
                    transaction: (_store: string, mode: string) => {
                        expect(mode).toBe('readonly');
                        const transaction: any = {
                            objectStore: () => ({
                                getAll: () => read(documents.find(doc => `tasktime-yjs-${doc.name}` === name)?.updates),
                                get: () => read({ operationId: 'unfinished' }),
                            }),
                        };
                        function read(result: unknown) {
                            const request: any = { result };
                            queueMicrotask(() => { request.onsuccess(); transaction.oncomplete(); });
                            return request;
                        }
                        return transaction;
                    },
                };
                request.onsuccess();
            });
            return request;
        }),
    };
    vi.stubGlobal('indexedDB', factory);
    return { factory, close };
}

describe('temporary readonly workspace recovery', () => {
    it('reads existing stores, closes handles and creates a validated stable backup', async () => {
        const { close } = installStorage();
        expect((await inspectLocalWorkspace()).hasData).toBe(true);
        expect((await createLocalBackup()).projects[0].title).toBe('Saved');
        expect(close).toHaveBeenCalledTimes(3);
    });

    it('does not open or create storage in an empty browser', async () => {
        const { factory } = installStorage([]);
        expect((await inspectLocalWorkspace()).hasData).toBe(false);
        await expect(createLocalBackup()).rejects.toThrow(/No saved/);
        expect(factory.open).not.toHaveBeenCalled();
    });

    it('rejects unapproved origins and unsupported browser enumeration', async () => {
        installStorage();
        vi.stubGlobal('location', { origin: 'https://app.tasktime.pro' });
        await expect(inspectLocalWorkspace()).rejects.toThrow(/original/);
        vi.stubGlobal('location', { origin: 'https://tasktime.pro' });
        vi.stubGlobal('indexedDB', {});
        await expect(inspectLocalWorkspace()).rejects.toThrow(/enumerate/);
        vi.stubGlobal('indexedDB', undefined);
        expect((await inspectLocalWorkspace()).hasData).toBe(false);
    });

    it('does not export while a restore or cloud transfer is pending', async () => {
        for (const journal of ['tasktime-restore-journal', 'tasktime-db']) {
            installStorage(undefined, { journal });
            await expect(createLocalBackup()).rejects.toThrow(/unfinished/);
        }
    });

    it('reports blocked, unsupported or concurrently changed storage', async () => {
        installStorage(undefined, { blocked: true });
        await expect(createLocalBackup()).rejects.toThrow(/busy/);
        installStorage(undefined, { corruptStore: true });
        await expect(createLocalBackup()).rejects.toThrow(/Unsupported/);
        installStorage(undefined, { changed: true });
        await expect(createLocalBackup()).rejects.toThrow(/changed/);
    });

    it('requires explicit acknowledgement before excluding unfinished timers', async () => {
        installStorage(snapshot({ core: { timers: { t: { elapsedTime: 1000 } } } }));
        await expect(createLocalBackup()).rejects.toThrow(/Unfinished timers/);
        expect(await createLocalBackup({ allowUnfinishedTimers: true })).not.toHaveProperty('timers');
    });

    for (const filename of ['tasktime-sample-backup-v1.3.json', 'tasktime-expenses-tax-backup-v1.3.json', 'tasktime-invoice-edge-backup-v1.3.json', 'tasktime-legacy-billing-parity-v1.4.json', 'tasktime-canceled-invoice-v1.5.json']) {
        it(`preserves every portable collection in ${filename} across archive documents`, () => {
            const original = parseBackupImportJson(readFileSync(`test-data/backups/${filename}`, 'utf8'));
            const documents: Record<string, Record<string, Record<string, unknown>>> = { core: { preferences: original.preferences } };
            for (const [collection, values] of Object.entries(original)) {
                if (!Array.isArray(values)) continue;
                values.forEach((record, index) => {
                    const name = collection === 'timeEntries' ? `entries-${new Date(record.start).getUTCFullYear()}`
                        : index % 2 && ['tasks', 'invoices', 'expenses'].includes(collection) ? `${collection}-archived` : 'core';
                    documents[name] ??= {};
                    documents[name][collection] ??= {};
                    documents[name][collection][record.id] = record;
                });
            }
            const recovered = decodeWorkspaceSnapshot(snapshot(documents)).backup;
            for (const [collection, values] of Object.entries(original)) {
                if (Array.isArray(values)) expect(recovered[collection]).toEqual(expect.arrayContaining(values));
                if (Array.isArray(values)) expect(recovered[collection]).toHaveLength(values.length);
            }
        });
    }

    it('does not advertise an empty or preferences-only browser', () => {
        expect(decodeWorkspaceSnapshot([]).hasData).toBe(false);
        expect(decodeWorkspaceSnapshot(snapshot({ core: { preferences: { currency: 'EUR', theme: 'dark' } } })).hasData).toBe(false);
    });

    it('exports active and archived records through the normal portable import boundary', () => {
        const data = snapshot({
            core: { projects: { p: { id: 'p', title: 'Retained project' } }, tasks: { t: { id: 't', title: 'Current task', projectId: 'p' } } },
            'tasks-archived': { tasks: { old: { id: 'old', title: 'Archived task', projectId: 'p', archived: true } } },
            'entries-2020': { timeEntries: { e: { id: 'e', taskId: 'old', start: 1577836800000, end: 1577840400000 } } },
        });
        const result = decodeWorkspaceSnapshot(data);
        expect(result.hasData).toBe(true);
        const restored = parseBackupImportJson(JSON.stringify(result.backup));
        expect(restored.tasks.map(task => task.id)).toEqual(['t', 'old']);
        expect(restored.timeEntries.map(entry => entry.id)).toEqual(['e']);
    });

    it('detects archive-only data and unfinished timers', () => {
        expect(decodeWorkspaceSnapshot(snapshot({ 'tasks-archived': { tasks: { t: { id: 't', title: 'Saved task' } } } })).hasData).toBe(true);
        const result = decodeWorkspaceSnapshot(snapshot({ core: { timers: { t: { id: 't', elapsedTime: 1000 } } } }));
        expect(result.hasData).toBe(true);
        expect(result.hasUnfinishedTimers).toBe(true);
        expect(result.backup).not.toHaveProperty('timers');
    });

    it('rejects malformed updates and unfinished invoice operations', () => {
        expect(() => decodeWorkspaceSnapshot([{ name: 'core', updates: [new Uint8Array([99])] }])).toThrow();
        expect(() => decodeWorkspaceSnapshot(snapshot({ core: { invoiceBillingOperations: { op: { state: 'prepared' } } } }))).toThrow(/unfinished/i);
    });

    it('does not copy sessions, licences or unrelated maps into portable output', () => {
        const result = decodeWorkspaceSnapshot(snapshot({ core: { sessions: { secret: 'do-not-export' }, projects: { p: { id: 'p', title: 'Project' } } } }));
        expect(JSON.stringify(result.backup)).not.toContain('do-not-export');
    });

    it('deduplicates identical archive copies but rejects conflicting copies', () => {
        const task = { id: 't', title: 'Saved task' };
        const result = decodeWorkspaceSnapshot(snapshot({ core: { tasks: { t: task } }, 'tasks-archived': { tasks: { t: task } } }));
        expect(result.backup.tasks).toHaveLength(1);
        expect(() => decodeWorkspaceSnapshot(snapshot({ core: { tasks: { t: task } }, 'tasks-archived': { tasks: { t: { ...task, title: 'Changed' } } } }))).toThrow(/archive/i);
    });
});
