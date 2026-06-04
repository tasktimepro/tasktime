/**
 * YjsDocManager - Manages multiple Yjs documents with lazy loading
 *
 * Sync contract source of truth: ../../components/sync/README.md
 * 
 * This manager handles the multi-document architecture where:
 * - Core documents are always loaded at startup
 * - On-demand documents are loaded only when needed
 * - Each document is persisted to its own IndexedDB database
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { DocName } from './types';

class BroadcastChannelSync {
    private channel: BroadcastChannel | null;
    private doc: Y.Doc;
    private readonly channelName: string;
    private readonly updateHandler: (update: Uint8Array, origin: unknown) => void;

    constructor(name: string, doc: Y.Doc) {
        this.doc = doc;
        this.channelName = `tasktime-yjs-${name}`;

        if (typeof BroadcastChannel === 'undefined') {
            this.channel = null;
            this.updateHandler = () => {};
            return;
        }

        this.channel = new BroadcastChannel(this.channelName);
        this.updateHandler = (update: Uint8Array, origin: unknown) => {
            if (!this.channel || origin === this || origin === 'remote') {
                return;
            }

            this.channel.postMessage(update);
        };

        this.doc.on('update', this.updateHandler);
        this.channel.onmessage = (event) => {
            const data = event.data;
            if (!data) return;

            if (data instanceof Uint8Array) {
                Y.applyUpdate(this.doc, data, 'remote');
                return;
            }

            if (data instanceof ArrayBuffer) {
                Y.applyUpdate(this.doc, new Uint8Array(data), 'remote');
            }
        };
    }

    destroy(): void {
        if (this.channel) {
            this.channel.close();
        }

        this.doc.off('update', this.updateHandler);
    }
}

interface ManagedDoc {
    doc: Y.Doc;
    persistence: IndexeddbPersistence;
    broadcast: BroadcastChannelSync | null;
    loaded: boolean;
}

/**
 * Manages multiple Yjs documents with lazy loading
 */
export class YjsDocManager {

    private docs: Map<DocName, ManagedDoc> = new Map();
    private loadPromises: Map<DocName, Promise<Y.Doc>> = new Map();
    private errorListeners: Set<(error: Error, docName: DocName) => void> = new Set();

    /**
     * Subscribe to persistence errors (e.g., IndexedDB quota exceeded)
     */
    onPersistenceError(callback: (error: Error, docName: DocName) => void): () => void {
        this.errorListeners.add(callback);
        return () => this.errorListeners.delete(callback);
    }

    private emitPersistenceError(error: Error, docName: DocName): void {
        for (const callback of this.errorListeners) {
            callback(error, docName);
        }
    }

    /**
     * Check if an error is a storage quota exceeded error
     */
    static isQuotaError(error: unknown): boolean {
        if (error instanceof DOMException) {
            return error.name === 'QuotaExceededError' || error.code === 22;
        }

        const message = error instanceof Error ? error.message : String(error);
        return message.includes('QuotaExceededError') || message.includes('storage quota');
    }

    /**
     * Get or create a document (lazy initialization)
     * Returns a promise that resolves when the document is loaded from IndexedDB
     */
    async getDoc(name: DocName): Promise<Y.Doc> {

        // Return if already loaded
        const existing = this.docs.get(name);
        if (existing?.loaded) {
            return existing.doc;
        }

        // Return existing promise if currently loading
        const existingPromise = this.loadPromises.get(name);
        if (existingPromise) {
            return existingPromise;
        }

        // Start loading
        const loadPromise = this.loadDoc(name);
        this.loadPromises.set(name, loadPromise);

        try {
            const doc = await loadPromise;
            this.loadPromises.delete(name);
            return doc;
        } catch (error) {
            this.loadPromises.delete(name);
            throw error;
        }
    }

    /**
     * Check if a document is loaded
     */
    isLoaded(name: DocName): boolean {
        return this.docs.get(name)?.loaded ?? false;
    }

    /**
     * Get document synchronously (only if already loaded)
     * Returns null if the document is not loaded yet
     */
    getDocSync(name: DocName): Y.Doc | null {
        const managed = this.docs.get(name);
        return managed?.loaded ? managed.doc : null;
    }

    /**
     * Get all loaded document names
     */
    getLoadedDocs(): DocName[] {
        return Array.from(this.docs.entries())
            .filter(([, managed]) => managed.loaded)
            .map(([name]) => name);
    }

    async listPersistedDocs(): Promise<DocName[]> {
        const persistedDocs = new Set<DocName>(this.getLoadedDocs());

        if (typeof indexedDB === 'undefined') {
            return Array.from(persistedDocs);
        }

        const indexedDbWithDatabases = indexedDB as IDBFactory & {
            databases?: () => Promise<Array<{ name?: string }>>;
        };

        if (!indexedDbWithDatabases.databases) {
            return Array.from(persistedDocs);
        }

        try {
            const databases = await indexedDbWithDatabases.databases();

            for (const database of databases) {
                const name = database.name;

                if (!name?.startsWith('tasktime-yjs-')) {
                    continue;
                }

                const docName = name.slice('tasktime-yjs-'.length);

                if (docName === 'core'
                    || docName === 'tasks-archived'
                    || docName === 'entries-active'
                    || docName === 'expenses-archived'
                    || docName === 'invoices-archived'
                    || /^entries-\d+$/.test(docName)) {
                    persistedDocs.add(docName as DocName);
                }
            }
        } catch (error) {
            console.warn('[YjsDocManager] Unable to enumerate persisted docs:', error);
        }

        return Array.from(persistedDocs);
    }

    /**
     * Destroy all documents and cleanup
     * Call this when the store is being destroyed
     */
    destroy(): void {
        for (const [name, managed] of this.docs) {
            console.log(`[YjsDocManager] Destroying: ${name}`);
            managed.broadcast?.destroy();
            managed.persistence.destroy();
            managed.doc.destroy();
        }
        this.docs.clear();
        this.loadPromises.clear();
    }

    /**
     * Delete IndexedDB databases for the given doc names
     */
    async deleteDatabases(docNames: DocName[]): Promise<void> {
        if (typeof indexedDB === 'undefined') {
            return;
        }

        await Promise.all(docNames.map((name) => {
            return new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(`tasktime-yjs-${name}`);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
            });
        }));
    }

    /**
     * Load a document from IndexedDB
     */
    private async loadDoc(name: DocName): Promise<Y.Doc> {
        const doc = new Y.Doc();
        const dbName = `tasktime-yjs-${name}`;
        const persistence = new IndexeddbPersistence(dbName, doc);
        const broadcast = new BroadcastChannelSync(name, doc);

        // Wait for IndexedDB to sync
        await new Promise<void>((resolve, reject) => {
            // Set a timeout in case synced event never fires
            const timeout = setTimeout(() => {
                console.warn(`[YjsDocManager] Timeout waiting for sync: ${name} — proceeding with potentially incomplete data`);
                resolve(); // Resolve anyway to not block the app
            }, 10_000);

            // Handle errors during initial load
            const handleInitialLoadError = (error: Error) => {
                clearTimeout(timeout);
                persistence.off('error', handleInitialLoadError);
                console.error(`[YjsDocManager] Error loading ${name}:`, error);
                reject(error);
            };

            persistence.on('error', handleInitialLoadError);

            if (persistence.synced) {
                clearTimeout(timeout);
                persistence.off('error', handleInitialLoadError);
                console.log(`[YjsDocManager] Loaded: ${name}`);
                resolve();
                return;
            }

            persistence.whenSynced.then(() => {
                clearTimeout(timeout);
                persistence.off('error', handleInitialLoadError);
                console.log(`[YjsDocManager] Loaded: ${name}`);
                resolve();
            });
        });

        // Subscribe to ongoing persistence errors (e.g., quota exceeded on subsequent writes)
        persistence.on('error', (error: Error) => {
            console.error(`[YjsDocManager] Persistence error for ${name}:`, error);
            this.emitPersistenceError(error, name);
        });

        this.docs.set(name, { doc, persistence, broadcast, loaded: true });
        return doc;
    }
}
