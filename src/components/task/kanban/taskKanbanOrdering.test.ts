import { describe, expect, it } from 'vitest';
import {
    buildKanbanCardMoveMutations,
    buildKanbanColumnOrderMutations,
    sortKanbanCards,
    sortKanbanColumns,
} from './taskKanbanOrdering';

describe('taskKanbanOrdering', () => {
    it('keeps existing column fallback order until manual order exists', () => {
        const columns = [
            { id: 'b', title: 'Second', lastActive: 10 },
            { id: 'a', title: 'First', lastActive: 20 },
        ];

        expect(sortKanbanColumns(columns, 'lastActive').map((column) => column.id)).toEqual(['b', 'a']);
    });

    it('uses manual order for columns when present', () => {
        const columns = [
            { id: 'b', title: 'Second', sortOrder: 2000, lastActive: 10 },
            { id: 'a', title: 'First', sortOrder: 1000, lastActive: 20 },
        ];

        expect(sortKanbanColumns(columns, 'lastActive').map((column) => column.id)).toEqual(['a', 'b']);
    });

    it('groups incomplete cards before completed cards until manual order exists', () => {
        const cards = [
            { id: 'done', completed: true, lastActive: 20 },
            { id: 'todo', completed: false, lastActive: 10 },
        ];

        expect(sortKanbanCards(cards).map((card) => card.id)).toEqual(['todo', 'done']);
    });

    it('returns a column sort mutation when columns are reordered', () => {
        const mutations = buildKanbanColumnOrderMutations([
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 2000 },
            { id: 'c', sortOrder: 3000 },
        ], 'c', 'a', 123);

        expect(mutations).toEqual([
            {
                id: 'c',
                updates: {
                    sortOrder: 0,
                    sortOrderUpdatedAt: 123,
                },
            },
        ]);
    });

    it('returns a card sort mutation when cards are reordered inside one column', () => {
        const cards = [
            { id: 'a', parentTaskId: 'parent-1', sortOrder: 1000 },
            { id: 'b', parentTaskId: 'parent-1', sortOrder: 2000 },
            { id: 'c', parentTaskId: 'parent-1', sortOrder: 3000 },
        ];

        const mutations = buildKanbanCardMoveMutations(cards, cards, 'c', 'parent-1', 'a', 123);

        expect(mutations).toEqual([
            {
                id: 'c',
                updates: {
                    sortOrder: 0,
                    sortOrderUpdatedAt: 123,
                },
            },
        ]);
    });

    it('moves a card after lower siblings when reordered downward inside one column', () => {
        const cards = [
            { id: 'a', parentTaskId: 'parent-1', sortOrder: 1000 },
            { id: 'b', parentTaskId: 'parent-1', sortOrder: 2000 },
            { id: 'c', parentTaskId: 'parent-1', sortOrder: 3000 },
        ];

        const mutations = buildKanbanCardMoveMutations(cards, cards, 'a', 'parent-1', 'c', 123);

        expect(mutations).toEqual([
            {
                id: 'a',
                updates: {
                    sortOrder: 4000,
                    sortOrderUpdatedAt: 123,
                },
            },
        ]);
    });

    it('adds parentTaskId when moving a card to another column', () => {
        const sourceCards = [
            { id: 'move-me', parentTaskId: 'parent-1', sortOrder: 1000 },
        ];
        const destinationCards = [
            { id: 'existing', parentTaskId: 'parent-2', sortOrder: 2000 },
        ];

        const mutations = buildKanbanCardMoveMutations(sourceCards, destinationCards, 'move-me', 'parent-2', 'existing', 123);

        expect(mutations).toEqual([
            {
                id: 'move-me',
                updates: {
                    parentTaskId: 'parent-2',
                },
            },
        ]);
    });

    it('still changes parentTaskId when moving to an empty column with a matching sort order', () => {
        const sourceCards = [
            { id: 'move-me', parentTaskId: 'parent-1', sortOrder: 1000 },
        ];

        const mutations = buildKanbanCardMoveMutations(sourceCards, [], 'move-me', 'parent-2', null, 123);

        expect(mutations).toEqual([
            {
                id: 'move-me',
                updates: {
                    parentTaskId: 'parent-2',
                },
            },
        ]);
    });
});
