import { describe, it, expect } from 'vitest';
import { sortItems } from './sortUtils';

describe('sortUtils', () => {

    const items = [
        { id: 'a', name: 'beta', createdAt: 100, lastActive: 5 },
        { id: 'b', name: 'Alpha', createdAt: 200, lastActive: 15 },
        { id: 'c', name: 'gamma', createdAt: null, lastActive: null },
    ];

    const baseArgs = {
        getName: (item) => item.name,
        getCreatedAt: (item) => item.createdAt,
        getLastActive: (item) => item.lastActive,
    };

    it('defaults to createdAt when sortBy is missing', () => {
        const sorted = sortItems({
            items,
            sortBy: null,
            ...baseArgs,
        });

        expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    });

    it('sorts by name case-insensitively', () => {
        const sorted = sortItems({
            items,
            sortBy: 'name',
            ...baseArgs,
        });

        expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    });

    it('sorts by lastActive descending with nulls last', () => {
        const sorted = sortItems({
            items,
            sortBy: 'lastActive',
            ...baseArgs,
        });

        expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    });
});
