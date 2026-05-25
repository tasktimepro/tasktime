import { useCallback, useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import SubtaskCreateForm from '../SubtaskSection/SubtaskCreateForm';
import TaskKanbanCard from './TaskKanbanCard';
import TaskKanbanTaskRow from './TaskKanbanTaskRow';

const renderKanbanDropPlaceholder = (key = 'kanban-drop-placeholder') => (
    <div
        key={key}
        className="h-[4.5rem] rounded-lg border border-dashed border-primary/50 bg-transparent"
        aria-hidden="true"
    />
);

const TaskKanbanColumn = ({
    task,
    subtasks,
    onCreateSubtask,
    onViewTask,
    onArchiveTask,
    onUnarchiveTask,
    onDeleteTask,
    showBillableBadges = false,
    className,
    dragPreview = null,
    dragDisabled = false,
}) => {
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `column:${task.id}`,
        data: {
            type: 'column',
            taskId: task.id,
        },
        disabled: dragDisabled || Boolean(task.completed) || Boolean(task.archived),
    });
    const {
        setNodeRef: setDropzoneNodeRef,
        isOver: isColumnDropzoneOver,
    } = useDroppable({
        id: `column-dropzone:${task.id}`,
        data: {
            type: 'column-dropzone',
            parentTaskId: task.id,
        },
    });
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [showArchivedSubtasks, setShowArchivedSubtasks] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskNote, setNewSubtaskNote] = useState('');
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');

    void isColumnDropzoneOver;

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    const handleCreateSubtask = useCallback((event) => {
        event.preventDefault();

        if (!newSubtaskTitle.trim() || !onCreateSubtask) return;

        onCreateSubtask({
            parentTaskId: task.id,
            title: newSubtaskTitle,
            note: newSubtaskNote,
            startDate: newSubtaskStartDate || null,
            recurring: null,
        });

        setNewSubtaskTitle('');
        setNewSubtaskNote('');
        setNewSubtaskStartDate('');
        setShowCreateSubtaskForm(false);
    }, [newSubtaskTitle, newSubtaskNote, newSubtaskStartDate, onCreateSubtask, task.id]);

    const handleCancelCreateSubtask = useCallback(() => {
        setNewSubtaskTitle('');
        setNewSubtaskNote('');
        setNewSubtaskStartDate('');
        setShowCreateSubtaskForm(false);
    }, []);

    const openTask = useCallback((targetTask) => {
        onViewTask?.(targetTask, { dateStr: null });
    }, [onViewTask]);
    const isCrossColumnPreview = Boolean(
        dragPreview?.taskId
        && dragPreview.destinationParentTaskId
        && dragPreview.destinationParentTaskId !== dragPreview.sourceParentTaskId
    );
    const showDropPreview = isCrossColumnPreview && dragPreview.destinationParentTaskId === task.id;
    const dragGhostTaskId = isCrossColumnPreview && dragPreview.sourceParentTaskId === task.id
        ? dragPreview.taskId
        : null;
    const activeSubtasks = useMemo(() => {
        return subtasks.filter((subtask) => !subtask.archived);
    }, [subtasks]);
    const archivedSubtasks = useMemo(() => {
        return subtasks.filter((subtask) => subtask.archived);
    }, [subtasks]);

    const renderedCards = [];
    let previewInserted = false;

    activeSubtasks.forEach((subtask) => {
        if (showDropPreview && dragPreview.overTaskId === subtask.id) {
            renderedCards.push(renderKanbanDropPlaceholder(`kanban-drop-placeholder-${subtask.id}`));
            previewInserted = true;
        }

        renderedCards.push(
            <TaskKanbanCard
                key={subtask.id}
                task={subtask}
                onOpen={() => openTask(subtask)}
                onArchive={onArchiveTask ? () => onArchiveTask(subtask.id) : null}
                onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(subtask.id) : null}
                onDelete={onDeleteTask ? () => onDeleteTask(subtask.id) : null}
                showBillableBadge={showBillableBadges}
                isDragGhost={dragGhostTaskId === subtask.id}
                disableTransform={showDropPreview}
                dragDisabled={dragDisabled}
            />
        );
    });

    if (showDropPreview && !previewInserted) {
        renderedCards.push(renderKanbanDropPlaceholder('kanban-drop-placeholder-end'));
    }

    const hasRenderedCards = renderedCards.length > 0;

    return (
        <section
            ref={setNodeRef}
            style={style}
            className={cn(
                'flex w-[min(20rem,85vw)] shrink-0 self-start flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:w-80',
                isDragging && 'opacity-0',
                className
            )}
            data-testid={`task-kanban-column-${task.id}`}
        >
            <TaskKanbanTaskRow
                task={task}
                onOpen={() => openTask(task)}
                onArchive={onArchiveTask ? () => onArchiveTask(task.id) : null}
                onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(task.id) : null}
                onDelete={onDeleteTask ? () => onDeleteTask(task.id) : null}
                subtaskCount={subtasks.length}
                showBillableBadge={showBillableBadges}
                dragActivatorRef={setActivatorNodeRef}
                dragAttributes={attributes}
                dragListeners={listeners}
                dragDisabled={dragDisabled || Boolean(task.completed) || Boolean(task.archived)}
            />

            {hasRenderedCards ? (
                <SortableContext items={activeSubtasks.map((subtask) => `card:${subtask.id}`)} strategy={verticalListSortingStrategy}>
                    <div
                        ref={setDropzoneNodeRef}
                        className="flex flex-col gap-2 rounded-lg transition-colors"
                    >
                        {renderedCards}
                    </div>
                </SortableContext>
            ) : null}

            {onCreateSubtask && !task.completed && !task.archived ? (
                showCreateSubtaskForm ? (
                    <SubtaskCreateForm
                        newSubtaskTitle={newSubtaskTitle}
                        setNewSubtaskTitle={setNewSubtaskTitle}
                        newSubtaskNote={newSubtaskNote}
                        setNewSubtaskNote={setNewSubtaskNote}
                        newSubtaskStartDate={newSubtaskStartDate}
                        setNewSubtaskStartDate={setNewSubtaskStartDate}
                        onCreateSubtask={handleCreateSubtask}
                        onCancel={handleCancelCreateSubtask}
                        forceStackedLayout={true}
                    />
                ) : (
                    <Button
                        variant="ghost"
                        className={cn(
                            'h-auto min-h-10 justify-start rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
                            !hasRenderedCards && 'mt-1 min-h-12'
                        )}
                        leadingIcon={PlusIcon}
                        onClick={() => setShowCreateSubtaskForm(true)}
                    >
                        Add subtask
                    </Button>
                )
            ) : null}

            {archivedSubtasks.length > 0 ? (
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => setShowArchivedSubtasks((prev) => !prev)}
                        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                        {showArchivedSubtasks ? (
                            <ChevronDownIcon className="mr-1 h-4 w-4" />
                        ) : (
                            <ChevronRightIcon className="mr-1 h-4 w-4" />
                        )}
                        Archived Subtasks ({archivedSubtasks.length})
                    </button>

                    {showArchivedSubtasks ? (
                        <div className="mt-2 flex flex-col gap-2">
                            {archivedSubtasks.map((subtask) => (
                                <TaskKanbanCard
                                    key={subtask.id}
                                    task={subtask}
                                    onOpen={() => openTask(subtask)}
                                    onArchive={onArchiveTask ? () => onArchiveTask(subtask.id) : null}
                                    onUnarchive={onUnarchiveTask ? () => onUnarchiveTask(subtask.id) : null}
                                    onDelete={onDeleteTask ? () => onDeleteTask(subtask.id) : null}
                                    showBillableBadge={showBillableBadges}
                                    dragDisabled={true}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
};

export default TaskKanbanColumn;
