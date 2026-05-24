import { describe, expect, it } from 'vitest';
import {
    buildTaskAppendOrderPlan,
    buildTaskContainerMoveOrderUpdates,
    buildRebalancedTaskOrderUpdates,
    buildTaskMoveOrderUpdates,
    getTaskRankBetween,
    hasManualTaskOrder,
    insertTaskItem,
    reorderTaskItems,
    sortTasksByManualOrder,
    TASK_ORDER_STEP,
} from './taskOrderingUtils';

describe('taskOrderingUtils', () => {
    it('sorts ordered tasks before unordered fallback tasks', () => {
        const tasks = [
            { id: 'recent', title: 'Recent', lastActive: 30 },
            { id: 'ordered-2', title: 'B', sortOrder: 2000, lastActive: 10 },
            { id: 'old', title: 'Old', lastActive: 5 },
            { id: 'ordered-1', title: 'A', sortOrder: 1000, lastActive: 1 },
        ];

        expect(sortTasksByManualOrder(tasks).map((task) => task.id)).toEqual([
            'ordered-1',
            'ordered-2',
            'recent',
            'old',
        ]);
    });

    it('supports name and createdAt fallback sorting for unordered tasks', () => {
        const tasks = [
            { id: 'c', title: 'Charlie', createdAt: 100 },
            { id: 'a', title: 'Alpha', createdAt: 300 },
            { id: 'b', title: 'Beta', createdAt: 200 },
        ];

        expect(sortTasksByManualOrder(tasks, 'name').map((task) => task.id)).toEqual(['a', 'b', 'c']);
        expect(sortTasksByManualOrder(tasks, 'createdAt').map((task) => task.id)).toEqual(['a', 'b', 'c']);
    });

    it('uses ids as the fallback tie-breaker when unordered tasks share activity timestamps', () => {
        const tasks = [
            { id: 'b', lastActive: 100 },
            { id: 'a', lastActive: 100 },
        ];

        expect(sortTasksByManualOrder(tasks).map((task) => task.id)).toEqual(['a', 'b']);
    });

    it('detects whether a scope has manual ordering', () => {
        expect(hasManualTaskOrder([{ id: 'a' }, { id: 'b', sortOrder: null }])).toBe(false);
        expect(hasManualTaskOrder([{ id: 'a' }, { id: 'b', sortOrder: 1000 }])).toBe(true);
    });

    it('reorders items by active and target ids', () => {
        const reordered = reorderTaskItems([
            { id: 'a' },
            { id: 'b' },
            { id: 'c' },
        ], 'a', 'c');

        expect(reordered.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    });

    it('leaves item order unchanged when reorder ids are missing or identical', () => {
        const items = [{ id: 'a' }, { id: 'b' }];

        expect(reorderTaskItems(items, 'missing', 'b')).toBe(items);
        expect(reorderTaskItems(items, 'a', 'missing')).toBe(items);
        expect(reorderTaskItems(items, 'a', 'a')).toBe(items);
    });

    it('inserts moved items before a target or at the end', () => {
        const item = { id: 'a' };
        const items = [{ id: 'b' }, { id: 'c' }];

        expect(insertTaskItem(items, item, 'c').map((candidate) => candidate.id)).toEqual(['b', 'a', 'c']);
        expect(insertTaskItem(items, item, null).map((candidate) => candidate.id)).toEqual(['b', 'c', 'a']);
    });

    it('inserts moved items at the end when the requested target is missing', () => {
        const item = { id: 'a' };
        const items = [{ id: 'b' }, { id: 'c' }];

        expect(insertTaskItem(items, item, 'missing').map((candidate) => candidate.id)).toEqual(['b', 'c', 'a']);
    });

    it('calculates sparse ranks between neighbors', () => {
        expect(getTaskRankBetween(null, null)).toBe(TASK_ORDER_STEP);
        expect(getTaskRankBetween(1000, null)).toBe(2000);
        expect(getTaskRankBetween(null, 1000)).toBe(0);
        expect(getTaskRankBetween(1000, 3000)).toBe(2000);
    });

    it('returns null when sparse ranks are too close together', () => {
        expect(getTaskRankBetween(1000, 1000)).toBeNull();
        expect(getTaskRankBetween(1000, 1000.00001)).toBeNull();
    });

    it('rebalance updates assign stable spaced ranks', () => {
        expect(buildRebalancedTaskOrderUpdates([{ id: 'a' }, { id: 'b' }], 123)).toEqual([
            { id: 'a', sortOrder: 1000, sortOrderUpdatedAt: 123 },
            { id: 'b', sortOrder: 2000, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('builds one sparse update when neighbors are already ranked', () => {
        const updates = buildTaskMoveOrderUpdates([
            { id: 'a', sortOrder: 1000 },
            { id: 'c', sortOrder: 7000 },
            { id: 'b', sortOrder: 5000 },
        ], 'c', 123);

        expect(updates).toEqual([
            { id: 'c', sortOrder: 3000, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('does not build move updates when the moved task is missing or already has the target rank', () => {
        expect(buildTaskMoveOrderUpdates([
            { id: 'a', sortOrder: 1000 },
        ], 'missing', 123)).toEqual([]);

        expect(buildTaskMoveOrderUpdates([
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 2000 },
        ], 'a', 123)).toEqual([]);
    });

    it('rebalances a move when neighboring ranks are too close together', () => {
        const updates = buildTaskMoveOrderUpdates([
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 1000.00001 },
            { id: 'c', sortOrder: 1000.00002 },
        ], 'b', 123);

        expect(updates).toEqual([
            { id: 'a', sortOrder: 1000, sortOrderUpdatedAt: 123 },
            { id: 'b', sortOrder: 2000, sortOrderUpdatedAt: 123 },
            { id: 'c', sortOrder: 3000, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('moves an item to the end of the same container when dropped on the container', () => {
        const updates = buildTaskContainerMoveOrderUpdates([
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 2000 },
            { id: 'c', sortOrder: 3000 },
        ], [
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 2000 },
            { id: 'c', sortOrder: 3000 },
        ], 'a', null, 123);

        expect(updates).toEqual([
            { id: 'a', sortOrder: 4000, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('builds destination ordering updates when moving between containers', () => {
        const updates = buildTaskContainerMoveOrderUpdates([
            { id: 'move-me', sortOrder: 1000 },
        ], [
            { id: 'first', sortOrder: 1000 },
            { id: 'second', sortOrder: 2000 },
        ], 'move-me', 'second', 123);

        expect(updates).toEqual([
            { id: 'move-me', sortOrder: 1500, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('finds the moved item in the destination container and ignores missing moved items', () => {
        expect(buildTaskContainerMoveOrderUpdates([], [
            { id: 'move-me', sortOrder: 1000 },
            { id: 'target', sortOrder: 2000 },
        ], 'move-me', 'target', 123)).toEqual([
            { id: 'move-me', sortOrder: 3000, sortOrderUpdatedAt: 123 },
        ]);

        expect(buildTaskContainerMoveOrderUpdates([], [
            { id: 'target', sortOrder: 2000 },
        ], 'missing', 'target', 123)).toEqual([]);
    });

    it('rebalance updates a scope when neighboring ranks are missing', () => {
        const updates = buildTaskMoveOrderUpdates([
            { id: 'a' },
            { id: 'c' },
            { id: 'b' },
        ], 'c', 123);

        expect(updates).toEqual([
            { id: 'a', sortOrder: 1000, sortOrderUpdatedAt: 123 },
            { id: 'c', sortOrder: 2000, sortOrderUpdatedAt: 123 },
            { id: 'b', sortOrder: 3000, sortOrderUpdatedAt: 123 },
        ]);
    });

    it('appends a new task without rewriting an already ranked scope', () => {
        const plan = buildTaskAppendOrderPlan([
            { id: 'a', sortOrder: 1000 },
            { id: 'b', sortOrder: 2000 },
        ], {
            id: 'new-task',
        }, 'lastActive', 123);

        expect(plan).toEqual({
            newItemSortOrder: 3000,
            newItemSortOrderUpdatedAt: 123,
            existingUpdates: [],
        });
    });

    it('starts a new manual order scope when appending to an empty list', () => {
        expect(buildTaskAppendOrderPlan([], { id: 'new-task' }, 'lastActive', 123)).toEqual({
            newItemSortOrder: 1000,
            newItemSortOrderUpdatedAt: 123,
            existingUpdates: [],
        });
    });

    it('rebalances existing tasks before appending a new task when a manual scope is only partially ranked', () => {
        const plan = buildTaskAppendOrderPlan([
            { id: 'ordered', sortOrder: 1000, lastActive: 300 },
            { id: 'fallback-a', lastActive: 200 },
            { id: 'fallback-b', lastActive: 100 },
        ], {
            id: 'new-task',
            lastActive: 50,
        }, 'lastActive', 123);

        expect(plan).toEqual({
            newItemSortOrder: 4000,
            newItemSortOrderUpdatedAt: 123,
            existingUpdates: [
                { id: 'ordered', sortOrder: 1000, sortOrderUpdatedAt: 123 },
                { id: 'fallback-a', sortOrder: 2000, sortOrderUpdatedAt: 123 },
                { id: 'fallback-b', sortOrder: 3000, sortOrderUpdatedAt: 123 },
            ],
        });
    });
});
