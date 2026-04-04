/**
 * entityUtils - Utilities for nested Y.Map entity storage
 * 
 * Stores entities as nested Y.Maps instead of plain objects so that
 * concurrent field-level updates from different devices merge correctly
 * via Yjs CRDT, rather than using last-writer-wins on the entire object.
 * 
 * Handles both old format (plain objects) and new format (nested Y.Maps)
 * transparently for backwards compatibility with existing Drive data.
 */

import * as Y from 'yjs';

/**
 * Convert a plain JS object into a nested Y.Map.
 * Each top-level field becomes a key in the Y.Map.
 * Nested objects (e.g., recurringConfig, completedDatesByYear) are stored
 * as opaque JSON values — field-level CRDT merging applies at the entity's
 * top-level fields.
 */
export function objectToYMap(obj: Record<string, unknown>): Y.Map<string, unknown> {

    const ymap = new Y.Map<string, unknown>();

    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            ymap.set(key, value);
        }
    }

    return ymap;
}

/**
 * Convert a Y.Map back to a plain JS object for React consumption.
 */
export function yMapToObject<T>(ymap: Y.Map<string, unknown>): T {

    const obj: Record<string, unknown> = {};

    ymap.forEach((value, key) => {
        obj[key] = value;
    });

    return obj as T;
}

/**
 * Read an entity from a collection Y.Map, handling both storage formats:
 * - New format: nested Y.Map → converted to plain object
 * - Old format: plain object → returned as-is
 */
export function readEntity<T>(value: unknown): T | undefined {

    if (value == null) return undefined;

    if (value instanceof Y.Map) {
        return yMapToObject<T>(value);
    }

    return value as T;
}

/**
 * Create a new entity in the collection using a nested Y.Map.
 */
export function createEntity(
    parentMap: Y.Map<string, unknown>,
    id: string,
    data: Record<string, unknown>,
): void {

    const ymap = objectToYMap(data);
    parentMap.set(id, ymap);
}

/**
 * Update specific fields of an entity, preserving CRDT field-level merging.
 * 
 * If the entity is stored as a nested Y.Map (new format), only the changed
 * fields are written — concurrent updates to different fields from different
 * devices will merge correctly.
 * 
 * If the entity is stored as a plain object (old format from Drive), falls
 * back to full replacement and converts to the new format.
 */
export function updateEntityFields<T extends Record<string, unknown>>(
    parentMap: Y.Map<string, unknown>,
    id: string,
    updates: Partial<T>,
): T | undefined {

    const existing = parentMap.get(id);
    if (existing == null) return undefined;

    if (existing instanceof Y.Map) {
        // New format: field-level update for proper CRDT merge
        for (const [key, value] of Object.entries(updates)) {
            existing.set(key, value);
        }

        return yMapToObject<T>(existing);
    }

    // Old format: merge and convert to new format
    const merged = { ...(existing as Record<string, unknown>), ...updates };
    const ymap = objectToYMap(merged);
    parentMap.set(id, ymap);

    return merged as T;
}

/**
 * Iterate all entities in a collection, converting nested Y.Maps to plain objects.
 */
export function forEachEntity<T>(
    map: Y.Map<string, unknown>,
    fn: (value: T, key: string) => void,
): void {

    map.forEach((value, key) => {
        if (value instanceof Y.Map) {
            fn(yMapToObject<T>(value), key);
        } else if (value != null && typeof value === 'object') {
            fn(value as T, key);
        }
    });
}

/**
 * Collect all entities from a Y.Map into an array.
 */
export function collectEntities<T>(map: Y.Map<string, unknown>): T[] {

    const items: T[] = [];

    forEachEntity<T>(map, (value) => {
        items.push(value);
    });

    return items;
}
