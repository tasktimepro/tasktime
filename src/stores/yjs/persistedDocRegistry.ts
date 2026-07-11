import type { DocName } from './types';

const REGISTRY_DB = 'tasktime-yjs-registry';
const REGISTRY_STORE = 'documents';
const memoryFallback = new Set<DocName>();

function openRegistry(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(REGISTRY_DB, 1);

        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(REGISTRY_STORE)) {
                request.result.createObjectStore(REGISTRY_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open the persisted-document registry.'));
        request.onblocked = () => reject(new Error('Persisted-document registry access was blocked by another tab.'));
    });
}

async function executeRegistryTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const database = await openRegistry();

    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(REGISTRY_STORE, mode);
            const request = operation(transaction.objectStore(REGISTRY_STORE));
            let result!: T;

            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () => reject(request.error ?? new Error('Persisted-document registry request failed.'));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error ?? new Error('Persisted-document registry transaction failed.'));
            transaction.onabort = () => reject(transaction.error ?? new Error('Persisted-document registry transaction was aborted.'));
        });
    } finally {
        database.close();
    }
}

export async function registerPersistedDoc(docName: DocName): Promise<void> {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        memoryFallback.add(docName);
        return;
    }

    await executeRegistryTransaction<IDBValidKey>('readwrite', (store) => store.put(Date.now(), docName));
}

export async function unregisterPersistedDocs(docNames: DocName[]): Promise<void> {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        docNames.forEach((docName) => memoryFallback.delete(docName));
        return;
    }

    const database = await openRegistry();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(REGISTRY_STORE, 'readwrite');
            const store = transaction.objectStore(REGISTRY_STORE);

            docNames.forEach((docName) => store.delete(docName));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error('Unable to update the persisted-document registry.'));
            transaction.onabort = () => reject(transaction.error ?? new Error('Persisted-document registry update was aborted.'));
        });
    } finally {
        database.close();
    }
}

export async function listRegisteredPersistedDocs(): Promise<DocName[]> {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        return Array.from(memoryFallback);
    }

    const keys = await executeRegistryTransaction<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return keys.filter((key): key is string => typeof key === 'string') as DocName[];
}
