import type { SortOption } from '@/utils/sortUtils';
import {
    buildTaskContainerMoveOrderUpdates,
    buildTaskMoveOrderUpdates,
    hasManualTaskOrder,
    reorderTaskItems,
    sortTasksByManualOrder,
} from '@/utils/taskOrderingUtils';

type KanbanTask = {
    id: string;
    title?: string | null;
    sortOrder?: number | null;
    createdAt?: number | null;
    lastActive?: number | null;
    completed?: boolean;
    parentTaskId?: string | null;
};

export type KanbanTaskMutation = {
    id: string;
    updates: {
        parentTaskId?: string | null;
        sortOrder?: number;
        sortOrderUpdatedAt?: number;
    };
};

const toMutations = (
    updates: Array<{ id: string; sortOrder: number; sortOrderUpdatedAt: number }>
): KanbanTaskMutation[] => {
    return updates.map((update) => ({
        id: update.id,
        updates: {
            sortOrder: update.sortOrder,
            sortOrderUpdatedAt: update.sortOrderUpdatedAt,
        },
    }));
};

export const sortKanbanColumns = <T extends KanbanTask>(items: T[], fallbackSortBy: SortOption): T[] => {
    if (!hasManualTaskOrder(items)) {
        return items;
    }

    return sortTasksByManualOrder(items, fallbackSortBy);
};

export const sortKanbanCards = <T extends KanbanTask>(items: T[]): T[] => {
    if (hasManualTaskOrder(items)) {
        return sortTasksByManualOrder(items, 'lastActive');
    }

    const incomplete = sortTasksByManualOrder(items.filter((item) => !item.completed), 'lastActive');
    const completed = sortTasksByManualOrder(items.filter((item) => item.completed), 'lastActive');

    return [...incomplete, ...completed];
};

export const buildKanbanColumnOrderMutations = <T extends KanbanTask>(
    orderedColumns: T[],
    activeColumnTaskId: string,
    overColumnTaskId: string,
    timestamp: number = Date.now()
): KanbanTaskMutation[] => {
    const reorderedColumns = reorderTaskItems(orderedColumns, activeColumnTaskId, overColumnTaskId);
    const updates = buildTaskMoveOrderUpdates(reorderedColumns, activeColumnTaskId, timestamp);

    return toMutations(updates);
};

export const buildKanbanCardMoveMutations = <T extends KanbanTask>(
    sourceCards: T[],
    destinationCards: T[],
    activeCardId: string,
    destinationParentTaskId: string,
    overCardId: string | null,
    timestamp: number = Date.now()
): KanbanTaskMutation[] => {
    const activeCard = sourceCards.find((card) => card.id === activeCardId);

    if (!activeCard) {
        return [];
    }

    const isSameColumn = activeCard.parentTaskId === destinationParentTaskId;
    const mutations = toMutations(buildTaskContainerMoveOrderUpdates(
        sourceCards,
        isSameColumn ? sourceCards : destinationCards,
        activeCardId,
        overCardId,
        timestamp
    ));

    if (isSameColumn) {
        return mutations;
    }

    const movedCardMutation = mutations.find((mutation) => mutation.id === activeCardId);

    if (movedCardMutation) {
        movedCardMutation.updates.parentTaskId = destinationParentTaskId;
        return mutations;
    }

    return [{
        id: activeCardId,
        updates: {
            parentTaskId: destinationParentTaskId,
        },
    }];
};
