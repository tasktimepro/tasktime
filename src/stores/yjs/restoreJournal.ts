import type { BackupImportPayload, BackupPayload } from '@/utils/backupData';
import type { MultiTimerState } from './types';

const RESTORE_JOURNAL_DB = 'tasktime-restore-journal';
const RESTORE_JOURNAL_STORE = 'journal';
const RESTORE_JOURNAL_KEY = 'active';

export interface RestoreJournalRecord {
    version: 1;
    operationId: string;
    createdAt: number;
    rollback: BackupPayload;
    rollbackTimers: MultiTimerState[];
    replacement: BackupImportPayload;
}

let memoryFallback: RestoreJournalRecord | null = null;

function openJournalDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(RESTORE_JOURNAL_DB, 1);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(RESTORE_JOURNAL_STORE)) {
                database.createObjectStore(RESTORE_JOURNAL_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open the restore safety journal.'));
        request.onblocked = () => reject(new Error('Unable to open the restore safety journal. Close other TaskTime Pro tabs and try again.'));
    });
}

async function runJournalTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const database = await openJournalDatabase();

    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(RESTORE_JOURNAL_STORE, mode);
            const request = operation(transaction.objectStore(RESTORE_JOURNAL_STORE));
            let result!: T;

            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () => reject(request.error ?? new Error('Restore safety journal request failed.'));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error ?? new Error('Restore safety journal transaction failed.'));
            transaction.onabort = () => reject(transaction.error ?? new Error('Restore safety journal transaction was aborted.'));
        });
    } finally {
        database.close();
    }
}

export async function readRestoreJournal(): Promise<RestoreJournalRecord | null> {
    if (typeof indexedDB === 'undefined') {
        return memoryFallback;
    }

    const record = await runJournalTransaction<RestoreJournalRecord | undefined>(
        'readonly',
        (store) => store.get(RESTORE_JOURNAL_KEY),
    );

    return record ?? null;
}

export async function writeRestoreJournal(record: RestoreJournalRecord): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryFallback = structuredClone(record);
        return;
    }

    await runJournalTransaction<IDBValidKey>(
        'readwrite',
        (store) => store.put(record, RESTORE_JOURNAL_KEY),
    );
}

export async function clearRestoreJournal(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryFallback = null;
        return;
    }

    await runJournalTransaction<undefined>(
        'readwrite',
        (store) => store.delete(RESTORE_JOURNAL_KEY),
    );
}
