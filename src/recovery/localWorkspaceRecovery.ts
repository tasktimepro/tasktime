import * as Y from 'yjs';
import { BACKUP_VERSION, createBackupPayload, parseBackupImportJson } from '@/utils/backupData';

export interface PersistedRecoveryDocument {
    name: string;
    updates: Uint8Array[];
}

const CORE_COLLECTIONS = [
    'projects', 'clients', 'paymentMethods', 'expenseCategories', 'taxReturnPeriods',
    'businessInfos', 'businessBrandAssets', 'invoiceTemplates', 'emailTemplates',
    'expenseRecurrences', 'dailyGoals', 'plannerAttachments',
] as const;
const DOCUMENT_PATTERN = /^(core|entries-active|entries-\d{4}|tasks-archived|invoices-archived|expenses-archived)$/;

/** Decode only in memory. Never instantiate a persistence or sync provider. */
export function decodeWorkspaceSnapshot(snapshot: PersistedRecoveryDocument[]) {
    const docs = new Map<string, Y.Doc>();
    try {
        for (const { name, updates } of snapshot) {
            if (!DOCUMENT_PATTERN.test(name) || docs.has(name)) throw new Error('Unsupported saved document.');
            const doc = new Y.Doc();
            docs.set(name, doc);
            for (const update of updates) {
                if (!(update instanceof Uint8Array)) throw new Error('Unreadable saved document.');
                Y.applyUpdate(doc, update);
            }
            // Yjs retains unapplied dependencies in its struct store. A truncated
            // persistence log must not become a superficially valid partial export.
            const store = (doc as unknown as { store: { pendingStructs: unknown; pendingDs: unknown } }).store;
            if (store.pendingStructs || store.pendingDs) throw new Error('Incomplete saved document.');
        }
        const records = (name: string, collection: string): Record<string, unknown>[] => {
            const doc = docs.get(name);
            if (!doc?.share.has(collection)) return [];
            return [...doc.getMap(collection).entries()].map(([key, value]) => {
                const record = value instanceof Y.Map ? value.toJSON() : value;
                if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Unreadable saved record.');
                const entity = record as Record<string, unknown>;
                if (collection !== 'timers' && collection !== 'invoiceBillingOperations' && entity.id !== key) {
                    throw new Error('Saved record identity does not match its key.');
                }
                return entity;
            });
        };
        if (records('core', 'invoiceBillingOperations').some(operation => operation.state !== 'complete')) {
            throw new Error('An unfinished invoice operation must be recovered before exporting.');
        }
        const combine = (collection: string, names: string[]) => {
            const result = new Map<unknown, Record<string, unknown>>();
            for (const name of names) {
                for (const value of records(name, collection)) {
                    const previous = result.get(value.id);
                    if (previous && JSON.stringify(previous) !== JSON.stringify(value)) {
                        throw new Error('An archive operation needs recovery before exporting.');
                    }
                    result.set(value.id, value);
                }
            }
            return [...result.values()];
        };
        const core = docs.get('core');
        const preferences = core?.share.has('preferences') ? core.getMap('preferences').toJSON() : {};
        const payload = {
            ...Object.fromEntries(CORE_COLLECTIONS.map(collection => [collection, records('core', collection)])),
            tasks: combine('tasks', ['core', 'tasks-archived']),
            invoices: combine('invoices', ['core', 'invoices-archived']),
            expenses: combine('expenses', ['core', 'expenses-archived']),
            timeEntries: combine('timeEntries', [...docs.keys()].filter(name => name.startsWith('entries-')).sort()),
            preferences,
        };
        // Apply the exact normal backup/import boundary, including relationship
        // validation and supported historical invoice normalization.
        const exportDate = new Date().toISOString();
        const raw = { ...payload, version: BACKUP_VERSION, exportDate, backupType: 'manual' };
        const backup = createBackupPayload({ ...parseBackupImportJson(JSON.stringify(raw)), exportDate, backupType: 'manual' });
        const hasUnfinishedTimers = records('core', 'timers').length > 0;
        const hasData = hasUnfinishedTimers || Object.entries(payload).some(([key, value]) => key !== 'preferences' && Array.isArray(value) && value.length > 0);
        return { hasData, hasUnfinishedTimers, backup };
    } finally {
        for (const doc of docs.values()) doc.destroy();
    }
}

/** Open only an enumerated existing database; abort any creation/upgrade race. */
function readExistingStore(name: string, store: string, key?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let finished = false;
        let database: IDBDatabase | undefined;
        const done = (error?: Error | DOMException, value?: unknown) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            database?.close();
            if (error) reject(error); else resolve(value);
        };
        const timeout = setTimeout(() => done(new Error('Saved data is busy. Close other TaskTime tabs and try again.')), 10000);
        let request: IDBOpenDBRequest;
        try {
            request = indexedDB.open(name);
        } catch {
            done(new Error('Saved data could not be opened.'));
            return;
        }
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () => done(new Error('Saved data changed or could not be read.'));
        request.onblocked = () => done(new Error('Saved data is busy. Close other TaskTime tabs and try again.'));
        request.onsuccess = () => {
            database = request.result;
            if (finished) { database.close(); return; }
            if (!database.objectStoreNames.contains(store)) { done(new Error('Unsupported saved database.')); return; }
            try {
                const transaction = database.transaction(store, 'readonly');
                const read = key === undefined ? transaction.objectStore(store).getAll() : transaction.objectStore(store).get(key);
                let value: unknown;
                read.onsuccess = () => { value = read.result; };
                transaction.oncomplete = () => done(undefined, value);
                transaction.onerror = transaction.onabort = () => done(new Error('Saved data could not be read.'));
            } catch {
                done(new Error('Saved data could not be read.'));
            }
        };
    });
}

async function readSnapshot(): Promise<PersistedRecoveryDocument[]> {
    if (!['https://tasktime.pro', 'http://localhost:3102', 'http://127.0.0.1:4322', 'http://127.0.0.1:4323', 'http://localhost:3101', 'http://127.0.0.1:3101'].includes(location.origin)) {
        throw new Error('Recovery is only available in the original TaskTime browser origin.');
    }
    if (!globalThis.indexedDB) return [];
    if (!indexedDB.databases) throw new Error('This browser cannot enumerate its saved data. Please contact support before clearing browser storage.');
    const names = (await indexedDB.databases()).map(database => database.name).filter((name): name is string => !!name).sort();
    const documents = names.filter(name => name.startsWith('tasktime-yjs-') && name !== 'tasktime-yjs-registry');
    if (documents.some(name => !DOCUMENT_PATTERN.test(name.slice('tasktime-yjs-'.length)))) throw new Error('Unsupported saved document.');
    if (names.includes('tasktime-restore-journal') && await readExistingStore('tasktime-restore-journal', 'journal', 'active')) {
        throw new Error('An unfinished restore needs recovery before exporting.');
    }
    if (names.includes('tasktime-db') && await readExistingStore('tasktime-db', 'app-data', 'cloud-provider-transfer-journal-v1')) {
        throw new Error('An unfinished cloud transfer needs recovery before exporting.');
    }
    return Promise.all(documents.map(async name => ({
        name: name.slice('tasktime-yjs-'.length),
        updates: await readExistingStore(name, 'updates') as Uint8Array[],
    })));
}

async function fingerprint(snapshot: PersistedRecoveryDocument[]): Promise<string> {
    const hashes = await Promise.all(snapshot.map(async document => {
        const pieces = await Promise.all(document.updates.map(async update => {
            const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(update));
            return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        }));
        return `${document.name}:${pieces.join(',')}`;
    }));
    return hashes.join('|');
}

/** Detection reads existing local records only; ordinary visitors create no DB. */
export async function inspectLocalWorkspace() {
    const { hasData, hasUnfinishedTimers } = decodeWorkspaceSnapshot(await readSnapshot());
    return { hasData, hasUnfinishedTimers };
}

/** Validate a stable local snapshot immediately before offering the download. */
export async function createLocalBackup(options: { allowUnfinishedTimers?: boolean } = {}) {
    const first = await readSnapshot();
    const result = decodeWorkspaceSnapshot(first);
    if (!result.hasData) throw new Error('No saved workspace records were found.');
    if (result.hasUnfinishedTimers && !options.allowUnfinishedTimers) throw new Error('Unfinished timers are not included in portable backups. Stop them first or explicitly continue without them.');
    const second = await readSnapshot();
    if (await fingerprint(first) !== await fingerprint(second)) throw new Error('Saved data changed. Close other TaskTime tabs and try again.');
    return result.backup;
}
