/**
 * Syncable entity utilities for sync metadata and soft-delete (tombstone) support
 * 
 * All syncable entities should have these fields:
 * - id: string
 * - createdAt: number
 * - updatedAt: number
 * - _syncSeq?: number (monotonic sequence for tie-breaking same-millisecond edits)
 * - deletedAt?: number (tombstone - set when soft-deleted)
 */

export interface SyncableEntity {
    id: string;
    createdAt?: number;
    updatedAt: number;
    _syncSeq?: number;
    deletedAt?: number;
}

// Monotonic sequence counter for tie-breaking same-millisecond updates
// This ensures deterministic ordering even when Date.now() returns same value
let syncSequence = 0;

/**
 * Get the next sync sequence number (monotonically increasing)
 */
export const getNextSyncSeq = (): number => {
    return ++syncSequence;
};

/**
 * Generate sync metadata for a NEW entity (create operation)
 * Use this when creating any new entity to ensure proper sync fields
 */
export const withCreateMetadata = <T extends Record<string, unknown>>(
    entity: T
): T & { createdAt: number; updatedAt: number; _syncSeq: number } => {
    const now = Date.now();
    return {
        ...entity,
        createdAt: now,
        updatedAt: now,
        _syncSeq: getNextSyncSeq(),
    };
};

/**
 * Generate sync metadata for an EXISTING entity (update operation)
 * Preserves createdAt, updates updatedAt and _syncSeq
 */
export const withUpdateMetadata = <T extends { createdAt?: number }>(
    entity: T
): T & { updatedAt: number; _syncSeq: number } => {
    return {
        ...entity,
        updatedAt: Date.now(),
        _syncSeq: getNextSyncSeq(),
    };
};

/**
 * Update an entity in an array by ID, applying update metadata
 * Returns a new array with the updated entity
 */
export const updateEntityById = <T extends SyncableEntity>(
    entities: T[],
    id: string,
    updates: Partial<T>
): T[] => {
    return entities.map(entity =>
        entity.id === id
            ? withUpdateMetadata({ ...entity, ...updates })
            : entity
    );
};

/**
 * Compare two entities to determine which one wins in a merge
 * Returns: negative if a wins, positive if b wins, 0 if equal
 * 
 * Priority order:
 * 1. Higher updatedAt wins
 * 2. If same updatedAt, higher _syncSeq wins
 * 3. If both same, compare IDs for deterministic result
 */
export const compareForMerge = (a: SyncableEntity, b: SyncableEntity): number => {
    // First compare updatedAt timestamps
    const aUpdated = a.updatedAt || 0;
    const bUpdated = b.updatedAt || 0;
    
    if (aUpdated !== bUpdated) {
        return bUpdated - aUpdated; // Higher timestamp wins (positive means b wins)
    }
    
    // Same timestamp - compare sync sequence
    const aSeq = a._syncSeq || 0;
    const bSeq = b._syncSeq || 0;
    
    if (aSeq !== bSeq) {
        return bSeq - aSeq; // Higher sequence wins
    }
    
    // Ultimate tie-breaker: compare IDs lexicographically
    // This ensures deterministic, reproducible results
    return a.id.localeCompare(b.id);
};

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
        _syncSeq: getNextSyncSeq(),
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
        _syncSeq: getNextSyncSeq(),
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
