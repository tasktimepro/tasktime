import { useCallback, useMemo, useState } from 'react';
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import TaskKanbanColumn from './TaskKanbanColumn';
import TaskKanbanCreateColumn from './TaskKanbanCreateColumn';
import TaskKanbanTaskRow from './TaskKanbanTaskRow';
import {
    buildKanbanCardMoveMutations,
    buildKanbanColumnOrderMutations,
    sortKanbanCards,
    sortKanbanColumns,
} from './taskKanbanOrdering';

const getDataTaskId = (data, fallbackId) => {
    if (data?.type === 'column') {
        return data.taskId || null;
    }

    if (data?.type === 'card') {
        return data.taskId || null;
    }

    if (typeof fallbackId === 'string' && fallbackId.includes(':')) {
        return fallbackId.split(':')[1] || null;
    }

    return null;
};

const getParentTaskId = (data, fallbackId) => {
    if (data?.type === 'column') {
        return data.taskId || null;
    }

    if (data?.type === 'column-dropzone') {
        return data.parentTaskId || null;
    }

    if (data?.type === 'card') {
        return data.parentTaskId || null;
    }

    if (typeof fallbackId === 'string' && fallbackId.startsWith('column:')) {
        return fallbackId.slice('column:'.length) || null;
    }

    return null;
};

const getDroppableContainersByType = (args, typeMatcher) => {
    return args.droppableContainers.filter((container) => {
        return typeMatcher(container.data.current || null);
    });
};

const getPointerCollisionsByType = (args, typeMatcher) => {
    const droppableContainers = getDroppableContainersByType(args, typeMatcher);

    if (droppableContainers.length === 0) {
        return [];
    }

    return pointerWithin({
        ...args,
        droppableContainers,
    });
};

const getClosestCollisionsByType = (args, typeMatcher, fallbackCollisionDetection = closestCorners) => {
    const droppableContainers = args.droppableContainers.filter((container) => {
        return typeMatcher(container.data.current || null);
    });

    if (droppableContainers.length === 0) {
        return [];
    }

    const narrowedArgs = {
        ...args,
        droppableContainers,
    };

    return fallbackCollisionDetection(narrowedArgs);
};

const kanbanCollisionDetection = (args) => {
    const activeType = args.active.data.current?.type;

    if (activeType === 'card') {
        const cardPointerCollisions = getPointerCollisionsByType(args, (data) => data?.type === 'card');

        if (cardPointerCollisions.length > 0) {
            return cardPointerCollisions;
        }

        const dropzonePointerCollisions = getPointerCollisionsByType(args, (data) => data?.type === 'column-dropzone' || data?.type === 'column');

        if (dropzonePointerCollisions.length > 0) {
            return dropzonePointerCollisions;
        }

        const cardCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'card');

        if (cardCollisions.length > 0) {
            return cardCollisions;
        }

        const dropzoneCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'column-dropzone' || data?.type === 'column');

        return dropzoneCollisions.length > 0 ? dropzoneCollisions : closestCorners(args);
    }

    if (activeType === 'column') {
        const columnPointerCollisions = getPointerCollisionsByType(args, (data) => data?.type === 'column');

        if (columnPointerCollisions.length > 0) {
            return columnPointerCollisions;
        }

        const columnCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'column');

        return columnCollisions.length > 0 ? columnCollisions : closestCorners(args);
    }

    return closestCorners(args);
};

const TaskKanbanBoard = ({
    parentTasks,
    tasks,
    onCreateSubtask,
    onViewTask,
    onUpdateTask,
    onArchiveTask,
    onUnarchiveTask,
    onDeleteTask,
    showBillableBadges = false,
    fallbackSortBy = 'lastActive',
    createColumnProps = null,
    dragDisabled = false,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const [activeColumnDragId, setActiveColumnDragId] = useState(null);
    const [cardDragPreview, setCardDragPreview] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const columns = useMemo(() => {
        return sortKanbanColumns(parentTasks, fallbackSortBy).map((parentTask) => ({
            task: parentTask,
            subtasks: sortKanbanCards(
                tasks.filter((candidate) => candidate.parentTaskId === parentTask.id && !candidate.recurring)
            ),
        }));
    }, [parentTasks, tasks, fallbackSortBy]);

    const activeCardTask = useMemo(() => {
        if (!cardDragPreview?.taskId) {
            return null;
        }

        return tasks.find((task) => task.id === cardDragPreview.taskId) || null;
    }, [cardDragPreview, tasks]);

    const activeColumnDragColumn = useMemo(() => {
        if (!activeColumnDragId) {
            return null;
        }

        return columns.find((column) => column.task.id === activeColumnDragId) || null;
    }, [activeColumnDragId, columns]);

    const handleDragStart = useCallback((event) => {
        const activeData = event.active.data.current || null;

        if (activeData?.type === 'column') {
            setActiveColumnDragId(getDataTaskId(activeData, event.active.id));
            setCardDragPreview(null);
            return;
        }

        if (activeData?.type !== 'card') {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        setActiveColumnDragId(null);
        const taskId = getDataTaskId(activeData, event.active.id);
        const activeTask = tasks.find((task) => task.id === taskId) || null;

        setCardDragPreview({
            taskId,
            title: activeTask?.title || 'Subtask',
            sourceParentTaskId: activeData.parentTaskId || null,
            destinationParentTaskId: null,
            overTaskId: null,
        });
    }, [tasks]);

    const handleDragOver = useCallback((event) => {
        const activeData = event.active.data.current || null;

        if (activeData?.type !== 'card') {
            return;
        }

        if (!event.over) {
            setCardDragPreview((current) => current ? {
                ...current,
                destinationParentTaskId: null,
                overTaskId: null,
            } : null);
            return;
        }

        const overData = event.over.data.current || null;

        setCardDragPreview((current) => current ? {
            ...current,
            destinationParentTaskId: getParentTaskId(overData, event.over.id),
            overTaskId: overData?.type === 'card'
                ? getDataTaskId(overData, event.over.id)
                : null,
        } : null);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;

        if (!over || !onUpdateTask) {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        const activeData = active.data.current || null;
        const overData = over.data.current || null;
        const activeTaskId = getDataTaskId(activeData, active.id);

        if (!activeTaskId) {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        if (activeData?.type === 'column') {
            const overColumnTaskId = getParentTaskId(overData, over.id);

            if (!overColumnTaskId || overColumnTaskId === activeTaskId) {
                setActiveColumnDragId(null);
                setCardDragPreview(null);
                return;
            }

            const mutations = buildKanbanColumnOrderMutations(
                columns.map((column) => column.task),
                activeTaskId,
                overColumnTaskId
            );

            mutations.forEach((mutation) => {
                onUpdateTask(mutation.id, mutation.updates);
            });

            setActiveColumnDragId(null);
            setCardDragPreview(null);

            return;
        }

        if (activeData?.type !== 'card') {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        const sourceParentTaskId = activeData.parentTaskId || null;
        const destinationParentTaskId = getParentTaskId(overData, over.id);

        if (!sourceParentTaskId || !destinationParentTaskId) {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        const sourceColumn = columns.find((column) => column.task.id === sourceParentTaskId);
        const destinationColumn = columns.find((column) => column.task.id === destinationParentTaskId);

        if (!sourceColumn || !destinationColumn) {
            setActiveColumnDragId(null);
            setCardDragPreview(null);
            return;
        }

        const overCardId = overData?.type === 'card'
            ? getDataTaskId(overData, over.id)
            : null;

        const mutations = buildKanbanCardMoveMutations(
            sourceColumn.subtasks,
            destinationColumn.subtasks,
            activeTaskId,
            destinationParentTaskId,
            overCardId
        );

        mutations.forEach((mutation) => {
            onUpdateTask(mutation.id, mutation.updates);
        });
        setActiveColumnDragId(null);
        setCardDragPreview(null);
    }, [columns, onUpdateTask]);

    if (columns.length === 0 && !createColumnProps) {
        return null;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={kanbanCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={() => {
                setActiveColumnDragId(null);
                setCardDragPreview(null);
            }}
            onDragEnd={handleDragEnd}
        >
            <div className="overflow-x-auto pb-2" data-testid="task-kanban-board">
                <div className={cn('flex min-w-max items-start gap-4', isMobileLayout && 'snap-x snap-mandatory')}>
                    {createColumnProps ? (
                        <TaskKanbanCreateColumn
                            {...createColumnProps}
                        />
                    ) : null}

                    <SortableContext items={columns.map((column) => `column:${column.task.id}`)} strategy={horizontalListSortingStrategy}>
                        {columns.map((column) => (
                            <TaskKanbanColumn
                                key={column.task.id}
                                task={column.task}
                                subtasks={column.subtasks}
                                onCreateSubtask={onCreateSubtask}
                                onViewTask={onViewTask}
                                onArchiveTask={onArchiveTask}
                                onUnarchiveTask={onUnarchiveTask}
                                onDeleteTask={onDeleteTask}
                                showBillableBadges={showBillableBadges}
                                dragPreview={cardDragPreview}
                                className={cn(isMobileLayout && 'snap-start')}
                                dragDisabled={dragDisabled}
                            />
                        ))}
                    </SortableContext>
                </div>
            </div>

            <DragOverlay>
                {activeColumnDragColumn ? (
                    <section className="flex w-[min(20rem,85vw)] shrink-0 self-start flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 shadow-xl opacity-100 sm:w-80 pointer-events-none">
                        <TaskKanbanTaskRow
                            task={activeColumnDragColumn.task}
                            onOpen={() => {}}
                            onArchive={onArchiveTask ? () => onArchiveTask(activeColumnDragColumn.task.id) : null}
                            onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(activeColumnDragColumn.task.id) : null}
                            onDelete={onDeleteTask ? () => onDeleteTask(activeColumnDragColumn.task.id) : null}
                            subtaskCount={activeColumnDragColumn.subtasks.length}
                            showBillableBadge={showBillableBadges}
                            dragDisabled={true}
                        />

                        {activeColumnDragColumn.subtasks.length > 0 ? (
                            <div className="flex flex-col gap-2 rounded-lg">
                                {activeColumnDragColumn.subtasks.map((subtask) => (
                                    <div
                                        key={subtask.id}
                                        className={cn(
                                            'w-full self-start rounded-lg border border-border bg-card p-3 text-left shadow-sm',
                                            subtask.completed && 'bg-muted/50'
                                        )}
                                    >
                                        <TaskKanbanTaskRow
                                            task={subtask}
                                            onOpen={() => {}}
                                            onArchive={onArchiveTask ? () => onArchiveTask(subtask.id) : null}
                                            onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(subtask.id) : null}
                                            onDelete={onDeleteTask ? () => onDeleteTask(subtask.id) : null}
                                            showBillableBadge={showBillableBadges}
                                            dragDisabled={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {onCreateSubtask && !activeColumnDragColumn.task.completed && !activeColumnDragColumn.task.archived ? (
                            <Button
                                variant="ghost"
                                className={cn(
                                    'h-auto min-h-10 justify-start rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground',
                                    activeColumnDragColumn.subtasks.length === 0 && 'mt-1 min-h-12'
                                )}
                                leadingIcon={PlusIcon}
                                tabIndex={-1}
                            >
                                Add subtask
                            </Button>
                        ) : null}
                    </section>
                ) : activeCardTask ? (
                    <div className="w-[min(20rem,85vw)] rounded-lg border border-border bg-card p-3 text-left shadow-xl sm:w-80">
                        <TaskKanbanTaskRow
                            task={activeCardTask}
                            onOpen={() => {}}
                            onArchive={onArchiveTask ? () => onArchiveTask(activeCardTask.id) : null}
                            onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(activeCardTask.id) : null}
                            onDelete={onDeleteTask ? () => onDeleteTask(activeCardTask.id) : null}
                            showBillableBadge={showBillableBadges}
                            dragDisabled={true}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TaskKanbanBoard;
