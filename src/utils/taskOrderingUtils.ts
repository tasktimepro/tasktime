import type { SortOption } from './sortUtils';

export const TASK_ORDER_STEP = 1000;
export const TASK_ORDER_MIN_GAP = 0.0001;

export type TaskOrderable = {
    id: string;
    title?: string | null;
    sortOrder?: number | null;
    createdAt?: number | null;
    lastActive?: number | null;
};

export type TaskOrderUpdate = {
    id: string;
    sortOrder: number;
    sortOrderUpdatedAt: number;
};

export type TaskAppendOrderPlan = {
    newItemSortOrder: number;
    newItemSortOrderUpdatedAt: number;
    existingUpdates: TaskOrderUpdate[];
};

const hasFiniteSortOrder = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const compareNames = (a?: string | null, b?: string | null): number => {
    return (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' });
};

const compareNumbersDesc = (a?: number | null, b?: number | null): number => {
    return (b || 0) - (a || 0);
};

const compareFallback = <T extends TaskOrderable>(a: T, b: T, fallbackSortBy: SortOption): number => {
    if (fallbackSortBy === 'name') {
        return compareNames(a.title, b.title) || a.id.localeCompare(b.id);
    }

    if (fallbackSortBy === 'createdAt') {
        return compareNumbersDesc(a.createdAt, b.createdAt) || a.id.localeCompare(b.id);
    }

    return compareNumbersDesc(a.lastActive || a.createdAt, b.lastActive || b.createdAt) || a.id.localeCompare(b.id);
};

export const hasManualTaskOrder = <T extends TaskOrderable>(items: T[]): boolean => {
    return items.some((item) => hasFiniteSortOrder(item.sortOrder));
};

export const sortTasksByManualOrder = <T extends TaskOrderable>(
    items: T[],
    fallbackSortBy: SortOption = 'lastActive'
): T[] => {
    return [...items].sort((a, b) => {
        const aHasOrder = hasFiniteSortOrder(a.sortOrder);
        const bHasOrder = hasFiniteSortOrder(b.sortOrder);

        if (aHasOrder && bHasOrder && a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
        }

        if (aHasOrder !== bHasOrder) {
            return aHasOrder ? -1 : 1;
        }

        return compareFallback(a, b, fallbackSortBy);
    });
};

export const reorderTaskItems = <T extends TaskOrderable>(items: T[], activeId: string, overId: string): T[] => {
    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(oldIndex, 1);
    nextItems.splice(newIndex, 0, movedItem);

    return nextItems;
};

export const insertTaskItem = <T extends TaskOrderable>(items: T[], item: T, overId?: string | null): T[] => {
    const withoutItem = items.filter((candidate) => candidate.id !== item.id);

    if (!overId) {
        return [...withoutItem, item];
    }

    const targetIndex = withoutItem.findIndex((candidate) => candidate.id === overId);

    if (targetIndex < 0) {
        return [...withoutItem, item];
    }

    const nextItems = [...withoutItem];
    nextItems.splice(targetIndex, 0, item);

    return nextItems;
};

export const getTaskRankBetween = (previous?: number | null, next?: number | null): number | null => {
    const hasPrevious = hasFiniteSortOrder(previous);
    const hasNext = hasFiniteSortOrder(next);

    if (hasPrevious && hasNext) {
        if (next - previous <= TASK_ORDER_MIN_GAP) {
            return null;
        }

        return previous + ((next - previous) / 2);
    }

    if (hasPrevious) {
        return previous + TASK_ORDER_STEP;
    }

    if (hasNext) {
        return next - TASK_ORDER_STEP;
    }

    return TASK_ORDER_STEP;
};

export const buildRebalancedTaskOrderUpdates = <T extends TaskOrderable>(
    orderedItems: T[],
    timestamp: number = Date.now()
): TaskOrderUpdate[] => {
    return orderedItems.map((item, index) => ({
        id: item.id,
        sortOrder: (index + 1) * TASK_ORDER_STEP,
        sortOrderUpdatedAt: timestamp,
    }));
};

export const buildTaskMoveOrderUpdates = <T extends TaskOrderable>(
    orderedItems: T[],
    movedTaskId: string,
    timestamp: number = Date.now()
): TaskOrderUpdate[] => {
    const movedIndex = orderedItems.findIndex((item) => item.id === movedTaskId);

    if (movedIndex < 0) {
        return [];
    }

    const previousItem = orderedItems[movedIndex - 1] || null;
    const nextItem = orderedItems[movedIndex + 1] || null;
    const previousRank = previousItem?.sortOrder;
    const nextRank = nextItem?.sortOrder;
    const neighborMissingOrder = Boolean(
        (previousItem && !hasFiniteSortOrder(previousRank))
        || (nextItem && !hasFiniteSortOrder(nextRank))
    );

    if (neighborMissingOrder) {
        return buildRebalancedTaskOrderUpdates(orderedItems, timestamp);
    }

    const nextSortOrder = getTaskRankBetween(previousRank, nextRank);

    if (nextSortOrder === null) {
        return buildRebalancedTaskOrderUpdates(orderedItems, timestamp);
    }

    const movedItem = orderedItems[movedIndex];

    if (movedItem.sortOrder === nextSortOrder) {
        return [];
    }

    return [{
        id: movedTaskId,
        sortOrder: nextSortOrder,
        sortOrderUpdatedAt: timestamp,
    }];
};

export const buildTaskContainerMoveOrderUpdates = <T extends TaskOrderable>(
    sourceItems: T[],
    destinationItems: T[],
    movedTaskId: string,
    overId: string | null,
    timestamp: number = Date.now()
): TaskOrderUpdate[] => {
    const movedItem = sourceItems.find((item) => item.id === movedTaskId)
        || destinationItems.find((item) => item.id === movedTaskId);

    if (!movedItem) {
        return [];
    }

    const isSameContainer = destinationItems.some((item) => item.id === movedTaskId);
    const orderedDestinationItems = isSameContainer
        ? (overId
            ? reorderTaskItems(destinationItems, movedTaskId, overId)
            : insertTaskItem(destinationItems, movedItem, null))
        : insertTaskItem(destinationItems, movedItem, overId);

    return buildTaskMoveOrderUpdates(orderedDestinationItems, movedTaskId, timestamp);
};

export const buildTaskAppendOrderPlan = <T extends TaskOrderable>(
    items: T[],
    newItem: T,
    fallbackSortBy: SortOption = 'lastActive',
    timestamp: number = Date.now()
): TaskAppendOrderPlan => {
    const orderedItems = sortTasksByManualOrder(items, fallbackSortBy);

    if (orderedItems.length === 0) {
        return {
            newItemSortOrder: TASK_ORDER_STEP,
            newItemSortOrderUpdatedAt: timestamp,
            existingUpdates: [],
        };
    }

    const allItemsRanked = orderedItems.every((item) => hasFiniteSortOrder(item.sortOrder));

    if (allItemsRanked) {
        const lastSortOrder = orderedItems[orderedItems.length - 1]?.sortOrder;
        const nextSortOrder = getTaskRankBetween(lastSortOrder, null);

        if (nextSortOrder !== null) {
            return {
                newItemSortOrder: nextSortOrder,
                newItemSortOrderUpdatedAt: timestamp,
                existingUpdates: [],
            };
        }
    }

    const rebalancedUpdates = buildRebalancedTaskOrderUpdates([
        ...orderedItems,
        newItem,
    ], timestamp);
    const newItemUpdate = rebalancedUpdates.find((update) => update.id === newItem.id);

    return {
        newItemSortOrder: newItemUpdate?.sortOrder ?? TASK_ORDER_STEP,
        newItemSortOrderUpdatedAt: newItemUpdate?.sortOrderUpdatedAt ?? timestamp,
        existingUpdates: rebalancedUpdates.filter((update) => update.id !== newItem.id),
    };
};
