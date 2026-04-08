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
import { validateCollectionEntity, safeValidateCollectionEntity, type YjsCollectionName } from '@/stores/yjs/validation';

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

export interface UseYjsCollectionOptions {
    collectionName?: YjsCollectionName;
}

/**
 * Generic hook for accessing a Yjs collection
 * 
 * @param getMap - Function to get the Y.Map from the store (called when store is ready)
 * @returns Reactive items array and CRUD operations
 */
export function useYjsCollection<T extends { id: string }>(
    getMap: (store: ReturnType<typeof useYjs>['store']) => Y.Map<string, T>,
    options: UseYjsCollectionOptions = {}
): UseYjsCollectionResult<T> {
    const { store, isReady } = useYjs();

    const readValidItems = useCallback((map: Y.Map<string, unknown>, context: string) => {
        const entities = collectEntities<unknown>(map);

        if (!options.collectionName) {
            return entities as T[];
        }

        const items: T[] = [];

        for (const entity of entities) {
            const validated = safeValidateCollectionEntity<T>(options.collectionName, entity, context);

            if (validated) {
                items.push(validated);
            }
        }

        return items;
    }, [options.collectionName]);

    const getInitialItems = useCallback(() => {
        if (!isReady) return [] as T[];

        try {
            const map = getMap(store);
            return readValidItems(map as unknown as Y.Map<string, unknown>, 'initial collection read');
        } catch {
            return [] as T[];
        }
    }, [getMap, isReady, readValidItems, store]);

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
        
        setItems(readValidItems(yMap as unknown as Y.Map<string, unknown>, 'collection sync'));
    }, [readValidItems, yMap]);

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
        const entity = readEntity<unknown>(yMap.get(id));

        if (entity == null || !options.collectionName) {
            return entity as T | undefined;
        }

        return safeValidateCollectionEntity<T>(options.collectionName, entity, `read ${options.collectionName}.${id}`);
    }, [options.collectionName, yMap]);

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

        const validatedItem = options.collectionName
            ? validateCollectionEntity<T>(options.collectionName, item, `create ${options.collectionName}.${id}`)
            : item as unknown as T;

        const entityMap = objectToYMap(validatedItem as unknown as Record<string, unknown>);
        (yMap as unknown as Y.Map<string, unknown>).set(id, entityMap);

        return validatedItem;
    }, [options.collectionName, yMap]);

    const update = useCallback((id: string, updates: Partial<T>): T | undefined => {
        if (!yMap) return undefined;
        
        const rawMap = yMap as unknown as Y.Map<string, unknown>;
        const existing = rawMap.get(id);
        if (existing == null) return undefined;

        const updatesWithTimestamp = { ...updates, updatedAt: Date.now() } as Record<string, unknown>;

        const existingEntity = existing instanceof Y.Map
            ? yMapToObject<Record<string, unknown>>(existing)
            : existing as Record<string, unknown>;

        const mergedEntity = { ...existingEntity, ...updatesWithTimestamp };
        const validatedEntity = options.collectionName
            ? validateCollectionEntity<T>(options.collectionName, mergedEntity, `update ${options.collectionName}.${id}`)
            : mergedEntity as unknown as T;

        if (existing instanceof Y.Map) {
            // New format: field-level CRDT update
            for (const key of Object.keys(updatesWithTimestamp)) {
                existing.set(key, (validatedEntity as Record<string, unknown>)[key]);
            }

            return validatedEntity;
        }

        // Old format: merge and convert to nested Y.Map
        const entityMap = objectToYMap(validatedEntity as unknown as Record<string, unknown>);
        rawMap.set(id, entityMap);

        return validatedEntity;
    }, [options.collectionName, yMap]);

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
