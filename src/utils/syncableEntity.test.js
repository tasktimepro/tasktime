import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    softDelete,
    softDeleteById,
    softDeleteByIds,
    filterDeleted,
    isDeleted,
    restore,
    purgeTombstones
} from './syncableEntity';

describe('syncableEntity', () => {
    const now = 1705708800000; // Fixed timestamp for testing

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('softDelete', () => {
        it('marks entity as deleted with timestamp', () => {
            const entity = { id: '1', updatedAt: 1000 };
            const result = softDelete(entity);

            expect(result.deletedAt).toBe(now);
            expect(result.updatedAt).toBe(now);
            expect(result.id).toBe('1');
        });

        it('preserves other entity properties', () => {
            const entity = { id: '1', updatedAt: 1000, name: 'Test', count: 5 };
            const result = softDelete(entity);

            expect(result.name).toBe('Test');
            expect(result.count).toBe(5);
        });
    });

    describe('softDeleteById', () => {
        it('marks matching entity as deleted', () => {
            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000 },
                { id: '3', updatedAt: 3000 }
            ];

            const result = softDeleteById(entities, '2');

            expect(result[0].deletedAt).toBeUndefined();
            expect(result[1].deletedAt).toBe(now);
            expect(result[2].deletedAt).toBeUndefined();
        });

        it('returns unchanged array if id not found', () => {
            const entities = [
                { id: '1', updatedAt: 1000 }
            ];

            const result = softDeleteById(entities, 'nonexistent');

            expect(result).toEqual(entities);
        });
    });

    describe('softDeleteByIds', () => {
        it('marks all matching entities as deleted', () => {
            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000 },
                { id: '3', updatedAt: 3000 }
            ];

            const result = softDeleteByIds(entities, ['1', '3']);

            expect(result[0].deletedAt).toBe(now);
            expect(result[1].deletedAt).toBeUndefined();
            expect(result[2].deletedAt).toBe(now);
        });

        it('handles empty ids array', () => {
            const entities = [
                { id: '1', updatedAt: 1000 }
            ];

            const result = softDeleteByIds(entities, []);

            expect(result).toEqual(entities);
        });
    });

    describe('filterDeleted', () => {
        it('removes entities with deletedAt', () => {
            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000, deletedAt: 1500 },
                { id: '3', updatedAt: 3000 }
            ];

            const result = filterDeleted(entities);

            expect(result).toHaveLength(2);
            expect(result.map(e => e.id)).toEqual(['1', '3']);
        });

        it('returns all entities if none deleted', () => {
            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000 }
            ];

            const result = filterDeleted(entities);

            expect(result).toHaveLength(2);
        });
    });

    describe('isDeleted', () => {
        it('returns true for entity with deletedAt', () => {
            const entity = { id: '1', updatedAt: 1000, deletedAt: 500 };
            expect(isDeleted(entity)).toBe(true);
        });

        it('returns false for entity without deletedAt', () => {
            const entity = { id: '1', updatedAt: 1000 };
            expect(isDeleted(entity)).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect(isDeleted(null)).toBe(false);
            expect(isDeleted(undefined)).toBe(false);
        });
    });

    describe('restore', () => {
        it('removes deletedAt from entity', () => {
            const entity = { id: '1', updatedAt: 1000, deletedAt: 500 };
            const result = restore(entity);

            expect(result.deletedAt).toBeUndefined();
            expect(result.updatedAt).toBe(now);
        });

        it('updates updatedAt when restoring', () => {
            const entity = { id: '1', updatedAt: 1000, deletedAt: 500 };
            const result = restore(entity);

            expect(result.updatedAt).toBe(now);
        });
    });

    describe('purgeTombstones', () => {
        it('removes entities deleted older than threshold', () => {
            // Current time is 'now' from vi.setSystemTime
            // Create an entity deleted 1 second ago (within 30 day default)
            // and one deleted 31 days ago (should be purged)
            const recentlyDeleted = now - 1000; // 1 second ago
            const oldDeleted = now - (31 * 24 * 60 * 60 * 1000); // 31 days ago

            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000, deletedAt: oldDeleted },  // >30 days - purge
                { id: '3', updatedAt: 3000, deletedAt: recentlyDeleted }  // <30 days - keep
            ];

            const result = purgeTombstones(entities);

            expect(result).toHaveLength(2);
            expect(result.map(e => e.id)).toEqual(['1', '3']);
        });

        it('keeps all entities if none older than threshold', () => {
            const recentlyDeleted = now - 1000; // 1 second ago

            const entities = [
                { id: '1', updatedAt: 1000 },
                { id: '2', updatedAt: 2000, deletedAt: recentlyDeleted }
            ];

            const result = purgeTombstones(entities);

            expect(result).toHaveLength(2);
        });
    });
});
