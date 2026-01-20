/**
 * Syncable entity utilities for soft-delete (tombstone) support
 * 
 * All syncable entities should have these fields:
 * - id: string
 * - createdAt: number
 * - updatedAt: number
 * - deletedAt?: number (tombstone - set when soft-deleted)
 */

export interface SyncableEntity {
    id: string;
    createdAt?: number;
    updatedAt: number;
    deletedAt?: number;
}

/**
 * Mark an entity as deleted (soft-delete / tombstone)
 * Instead of removing from the array, we set deletedAt timestamp
 */
export const softDelete = <T extends SyncableEntity>(entity: T): T => {
    const now = Date.now();
    return {
        ...entity,
        deletedAt: now,
        updatedAt: now,
    };
};

/**
 * Soft-delete an entity in an array by ID
 * Returns a new array with the entity marked as deleted
 */
export const softDeleteById = <T extends SyncableEntity>(
    entities: T[],
    id: string
): T[] => {
    return entities.map(entity =>
        entity.id === id ? softDelete(entity) : entity
    );
};

/**
 * Soft-delete multiple entities by IDs
 */
export const softDeleteByIds = <T extends SyncableEntity>(
    entities: T[],
    ids: string[]
): T[] => {
    const idSet = new Set(ids);
    return entities.map(entity =>
        idSet.has(entity.id) ? softDelete(entity) : entity
    );
};

/**
 * Filter out deleted entities for UI display
 * Use this when rendering lists to hide tombstoned items
 */
export const filterDeleted = <T extends SyncableEntity>(entities: T[]): T[] => {
    return entities.filter(entity => !entity.deletedAt);
};

/**
 * Check if an entity is deleted
 */
export const isDeleted = (entity: SyncableEntity): boolean => {
    return entity ? !!entity.deletedAt : false;
};

/**
 * Restore a soft-deleted entity
 */
export const restore = <T extends SyncableEntity>(entity: T): T => {
    const { deletedAt: _, ...rest } = entity;
    return {
        ...rest,
        updatedAt: Date.now(),
    } as T;
};

/**
 * Permanently remove tombstoned entities older than a threshold
 * Call this periodically to clean up old deleted data
 * Default: 30 days
 */
export const purgeTombstones = <T extends SyncableEntity>(
    entities: T[],
    olderThanMs: number = 30 * 24 * 60 * 60 * 1000
): T[] => {
    const cutoff = Date.now() - olderThanMs;
    return entities.filter(entity =>
        !entity.deletedAt || entity.deletedAt > cutoff
    );
};
