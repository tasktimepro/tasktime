/**
 * YjsDocManager - Manages multiple Yjs documents with lazy loading
 * 
 * This manager handles the multi-document architecture where:
 * - Core documents are always loaded at startup
 * - On-demand documents are loaded only when needed
 * - Each document is persisted to its own IndexedDB database
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { DocName } from './types';

interface ManagedDoc {
    doc: Y.Doc;
    persistence: IndexeddbPersistence;
    loaded: boolean;
}

/**
 * Manages multiple Yjs documents with lazy loading
 */
export class YjsDocManager {

    private docs: Map<DocName, ManagedDoc> = new Map();
    private loadPromises: Map<DocName, Promise<Y.Doc>> = new Map();

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
            .filter(([_, managed]) => managed.loaded)
            .map(([name]) => name);
    }

    /**
     * Destroy all documents and cleanup
     * Call this when the store is being destroyed
     */
    destroy(): void {
        for (const [name, managed] of this.docs) {
            console.log(`[YjsDocManager] Destroying: ${name}`);
            managed.persistence.destroy();
            managed.doc.destroy();
        }
        this.docs.clear();
        this.loadPromises.clear();
    }

    /**
     * Load a document from IndexedDB
     */
    private async loadDoc(name: DocName): Promise<Y.Doc> {
        const doc = new Y.Doc();
        const dbName = `tasktime-yjs-${name}`;
        const persistence = new IndexeddbPersistence(dbName, doc);

        // Wait for IndexedDB to sync
        await new Promise<void>((resolve, reject) => {
            // Set a timeout in case synced event never fires
            const timeout = setTimeout(() => {
                console.warn(`[YjsDocManager] Timeout waiting for sync: ${name}`);
                resolve(); // Resolve anyway to not block the app
            }, 10_000);

            persistence.once('synced', () => {
                clearTimeout(timeout);
                console.log(`[YjsDocManager] Loaded: ${name}`);
                resolve();
            });

            // Handle errors
            persistence.on('error', (error: Error) => {
                clearTimeout(timeout);
                console.error(`[YjsDocManager] Error loading ${name}:`, error);
                reject(error);
            });
        });

        this.docs.set(name, { doc, persistence, loaded: true });
        return doc;
    }
}
