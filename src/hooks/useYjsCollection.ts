/**
 * useYjsCollection - Generic hook for reactive Yjs Y.Map collections
 * 
 * Provides:
 * - Reactive state that updates when the Y.Map changes
 * - Type-safe CRUD operations
 * - Loading state tracking
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { useYjs } from '@/contexts/YjsContext';
import { generateId } from '@/utils/idUtils';
import { readEntity, objectToYMap, yMapToObject, collectEntities } from '@/stores/yjs/entityUtils';

export interface UseYjsCollectionResult<T extends { id: string }> {
    /** All items in the collection */
    items: T[];
    /** Whether the collection is still loading */
    isLoading: boolean;
    /** Get a single item by ID */
    get: (id: string) => T | undefined;
    /** Create a new item (ID is optional - auto-generated if not provided) */
    create: (data: Omit<T, 'id'> & { id?: string }) => T;
    /** Update an existing item (automatically updates updatedAt timestamp) */
    update: (id: string, updates: Partial<T>) => T | undefined;
    /** Delete an item */
    remove: (id: string) => boolean;
}

/**
 * Generic hook for accessing a Yjs collection
 * 
 * @param getMap - Function to get the Y.Map from the store (called when store is ready)
 * @returns Reactive items array and CRUD operations
 */
export function useYjsCollection<T extends { id: string }>(
    getMap: (store: ReturnType<typeof useYjs>['store']) => Y.Map<string, T>
): UseYjsCollectionResult<T> {
    const { store, isReady } = useYjs();
    const getInitialItems = useCallback(() => {
        if (!isReady) return [] as T[];

        try {
            const map = getMap(store);
            return collectEntities<T>(map as unknown as Y.Map<string, unknown>);
        } catch {
            return [] as T[];
        }
    }, [getMap, isReady, store]);

    // Start with a snapshot if the store is already ready to avoid empty-state flicker on mount
    const [items, setItems] = useState<T[]>(getInitialItems);
    const [isLoading, setIsLoading] = useState(!isReady);

    // Get the Y.Map (memoized to avoid recreating on every render)
    const yMap = useMemo(() => {
        if (!isReady) return null;
        try {
            return getMap(store);
        } catch {
            return null;
        }
    }, [store, isReady, getMap]);

    // Sync state from Yjs to React
    const syncState = useCallback(() => {
        if (!yMap) return;
        
        setItems(collectEntities<T>(yMap as unknown as Y.Map<string, unknown>));
    }, [yMap]);

    // Initial load and subscribe to changes
    // Uses observeDeep to detect field-level changes in nested Y.Maps
    useEffect(() => {
        if (!yMap) return;

        // Initial sync
        syncState();
        setIsLoading(false);

        // Subscribe to changes (observeDeep catches nested Y.Map field updates)
        const handler = () => syncState();
        yMap.observeDeep(handler);

        return () => yMap.unobserveDeep(handler);
    }, [yMap, syncState]);

    // CRUD operations
    const get = useCallback((id: string): T | undefined => {
        if (!yMap) return undefined;
        return readEntity<T>(yMap.get(id));
    }, [yMap]);

    const create = useCallback((data: Omit<T, 'id'> & { id?: string }): T => {
        if (!yMap) {
            throw new Error('Collection not ready');
        }
        const id = (data as { id?: string }).id || generateId();
        const now = Date.now();
        const createdAt = typeof (data as { createdAt?: number }).createdAt === 'number'
            ? (data as { createdAt?: number }).createdAt as number
            : now;
        const updatedAt = typeof (data as { updatedAt?: number }).updatedAt === 'number'
            ? (data as { updatedAt?: number }).updatedAt as number
            : now;
        const item = { 
            ...data, 
            id,
            createdAt,
            updatedAt,
        } as unknown as Record<string, unknown>;

        const entityMap = objectToYMap(item);
        (yMap as unknown as Y.Map<string, unknown>).set(id, entityMap);

        return item as unknown as T;
    }, [yMap]);

    const update = useCallback((id: string, updates: Partial<T>): T | undefined => {
        if (!yMap) return undefined;
        
        const rawMap = yMap as unknown as Y.Map<string, unknown>;
        const existing = rawMap.get(id);
        if (existing == null) return undefined;

        const updatesWithTimestamp = { ...updates, updatedAt: Date.now() } as Record<string, unknown>;

        if (existing instanceof Y.Map) {
            // New format: field-level CRDT update
            for (const [key, value] of Object.entries(updatesWithTimestamp)) {
                existing.set(key, value);
            }

            return yMapToObject<T>(existing);
        }

        // Old format: merge and convert to nested Y.Map
        const merged = { ...(existing as Record<string, unknown>), ...updatesWithTimestamp };
        const entityMap = objectToYMap(merged);
        rawMap.set(id, entityMap);

        return merged as unknown as T;
    }, [yMap]);

    const remove = useCallback((id: string): boolean => {
        if (!yMap) return false;
        return yMap.delete(id);
    }, [yMap]);

    return {
        items,
        isLoading,
        get,
        create,
        update,
        remove,
    };
}
