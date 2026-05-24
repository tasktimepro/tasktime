import { useCallback, useMemo, useState } from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDownIcon, ChevronRightIcon, GripVerticalIcon } from '@/components/ui/icons';
import SubtaskItem from './SubtaskItem';
import SortableSubtaskItem from '../drag/SortableSubtaskItem';
import SubtaskCreateForm from './SubtaskCreateForm';
import Modal from '../../Modal';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { useTasks } from '../../../hooks/useTasks';
import { useTimeEntries } from '../../../hooks/useTimeEntries';
import { useTimers } from '../../../hooks/useTimers';
import { useProjects } from '../../../hooks/useProjects';
import DeleteTaskWarnings from '../DeleteTaskWarnings';
import { getTaskDeletionBillingSummary } from '../../../utils/taskUtils.ts';
import useIsMobileLayout from '../../../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { toStorageDate } from '../../../utils/dateUtils.ts';
import {
    buildTaskContainerMoveOrderUpdates,
    hasManualTaskOrder,
    sortTasksByManualOrder,
} from '../../../utils/taskOrderingUtils.ts';

const renderListDropPlaceholder = (key = 'list-drop-placeholder') => (
    <div
        key={key}
        className="h-[3.125rem] w-[min(40rem,100%)] rounded-md border border-dashed border-primary/50 bg-transparent"
        aria-hidden="true"
    />
);

/**
 * SubtaskSection component - Renders subtasks list and create form.
 * Uses Yjs hooks directly for state management.
 * @param {Object} props
 */
const SubtaskSection = ({
    subtasks,
    task,
    onToggleBillable,
    onCreateSubtask,
    showCreateSubtaskForm,
    setShowCreateSubtaskForm,
    newSubtaskTitle,
    setNewSubtaskTitle,
    newSubtaskNote,
    setNewSubtaskNote,
    newSubtaskStartDate,
    setNewSubtaskStartDate,
    handleCreateSubtask,
    cancelCreateSubtask,
    isArchived,
    anyTimerActive,
    isRelatedToActiveTimer,
    showSuccess,
    onEditTask,
    onViewTask,
    manualSortEnabled = false,
    useExternalDragContext = false,
    dragPreview = null,
    showDecorativeDragHandles = false,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const subtaskSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const {
        setNodeRef: setSubtaskContainerNodeRef,
        isOver: isSubtaskContainerOver,
    } = useDroppable({
        id: `subtask-container:${task.id}`,
        data: {
            type: 'subtask-container',
            parentTaskId: task.id,
        },
        disabled: !manualSortEnabled,
    });
    // Yjs hooks for state
    const { tasks, updateTask, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    const { projects } = useProjects();
    const [pendingDeleteSubtaskId, setPendingDeleteSubtaskId] = useState(null);
    const [showArchivedSubtasks, setShowArchivedSubtasks] = useState(false);

    const sortedSubtasks = useMemo(() => {
        if ((manualSortEnabled || showDecorativeDragHandles) && hasManualTaskOrder(subtasks)) {
            return sortTasksByManualOrder(subtasks, 'lastActive');
        }

        return [...subtasks].sort((a, b) => {
            const aCompleted = a.completed === true;
            const bCompleted = b.completed === true;

            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }

            const aLastActive = a.lastActive || a.createdAt || 0;
            const bLastActive = b.lastActive || b.createdAt || 0;

            return bLastActive - aLastActive;
        });
    }, [manualSortEnabled, showDecorativeDragHandles, subtasks]);

    const activeSubtasks = useMemo(() => {
        return sortedSubtasks.filter((subtask) => !subtask.archived);
    }, [sortedSubtasks]);

    const archivedSubtasks = useMemo(() => {
        return sortedSubtasks.filter((subtask) => subtask.archived);
    }, [sortedSubtasks]);

    const isCrossParentPreview = Boolean(
        dragPreview?.taskId
        && dragPreview.destinationParentTaskId
        && dragPreview.destinationParentTaskId !== dragPreview.sourceParentTaskId
    );
    const showDropPreview = isCrossParentPreview && dragPreview.destinationParentTaskId === task.id;
    const dragGhostTaskId = isCrossParentPreview && dragPreview.sourceParentTaskId === task.id
        ? dragPreview.taskId
        : null;

    const pendingDeleteSubtask = useMemo(() => {

        if (!pendingDeleteSubtaskId) return null;

        return tasks.find((item) => item.id === pendingDeleteSubtaskId)
            || subtasks.find((item) => item.id === pendingDeleteSubtaskId)
            || null;
    }, [tasks, subtasks, pendingDeleteSubtaskId]);

    const deleteBillingSummary = useMemo(() => {
        if (!pendingDeleteSubtaskId) {
            return getTaskDeletionBillingSummary([], tasks, timeEntries, projects);
        }

        return getTaskDeletionBillingSummary([pendingDeleteSubtaskId], tasks, timeEntries, projects);
    }, [pendingDeleteSubtaskId, tasks, timeEntries, projects]);
    
    /**
     * Handle subtask deletion with cleanup
     */
    const handleDeleteSubtask = useCallback((subtaskId) => {

        setPendingDeleteSubtaskId(subtaskId);
    }, []);

    const handleArchiveSubtask = useCallback((subtaskId) => {
        updateTask(subtaskId, {
            archived: true,
            archivedOnDate: toStorageDate(new Date()),
            lastActive: Date.now(),
        });
        showSuccess('Subtask archived');
    }, [updateTask, showSuccess]);

    const handleUnarchiveSubtask = useCallback((subtaskId) => {
        updateTask(subtaskId, {
            archived: false,
            archivedOnDate: null,
            lastActive: Date.now(),
        });
        showSuccess('Subtask unarchived');
    }, [updateTask, showSuccess]);

    const closeDeleteSubtaskModal = useCallback(() => {

        setPendingDeleteSubtaskId(null);
    }, []);

    const confirmDeleteSubtask = useCallback(() => {

        if (!pendingDeleteSubtaskId) return;

        const subtaskToDelete = pendingDeleteSubtask
            || subtasks.find((item) => item.id === pendingDeleteSubtaskId)
            || null;

        const subtaskTitle = subtaskToDelete?.title || 'Subtask';

        const entriesToDelete = timeEntries.filter((entry) => entry.taskId === pendingDeleteSubtaskId);
        entriesToDelete.forEach((entry) => deleteEntry(entry.id));

        const activeTimer = timers.find((timer) => timer.taskId === pendingDeleteSubtaskId);
        if (activeTimer) {
            clearTimer(activeTimer.projectId);
        }

        deleteTask(pendingDeleteSubtaskId);
        showSuccess(`Subtask "${subtaskTitle}" deleted successfully`);
        setPendingDeleteSubtaskId(null);
    }, [pendingDeleteSubtaskId, pendingDeleteSubtask, subtasks, timeEntries, timers, deleteEntry, clearTimer, deleteTask, showSuccess]);

    const handleSubtaskDragEnd = useCallback((event) => {
        if (!manualSortEnabled) return;

        const { active, over } = event;

        if (!over) return;

        const activeData = active.data.current || null;
        const overData = over.data.current || null;
        const activeId = activeData?.taskId || (typeof active.id === 'string' ? active.id.replace('subtask:', '') : null);
        const overId = overData?.type === 'subtask'
            ? (overData.taskId || (typeof over.id === 'string' ? over.id.replace('subtask:', '') : null))
            : null;

        if (!activeId) return;

        const updates = buildTaskContainerMoveOrderUpdates(
            activeSubtasks,
            activeSubtasks,
            activeId,
            overId
        );

        updates.forEach((update) => {
            updateTask(update.id, {
                sortOrder: update.sortOrder,
                sortOrderUpdatedAt: update.sortOrderUpdatedAt,
            });
        });
    }, [activeSubtasks, manualSortEnabled, updateTask]);

    if (isArchived || (activeSubtasks.length === 0 && archivedSubtasks.length === 0 && !onCreateSubtask)) {
        return null;
    }

    const renderedSortableSubtasks = [];
    let previewInserted = false;

    activeSubtasks.forEach((subtask) => {
        if (showDropPreview && dragPreview.overTaskId === subtask.id) {
            renderedSortableSubtasks.push(renderListDropPlaceholder(`list-drop-placeholder-${subtask.id}`));
            previewInserted = true;
        }

        renderedSortableSubtasks.push(
            <SortableSubtaskItem
                key={subtask.id}
                task={subtask}
                onToggleBillable={onToggleBillable}
                onArchive={() => handleArchiveSubtask(subtask.id)}
                onDelete={() => handleDeleteSubtask(subtask.id)}
                onEditTask={onEditTask}
                onViewTask={onViewTask}
                isDragGhost={dragGhostTaskId === subtask.id}
                disableTransform={showDropPreview}
            />
        );
    });

    if (showDropPreview && !previewInserted) {
        renderedSortableSubtasks.push(renderListDropPlaceholder('list-drop-placeholder-end'));
    }

    const renderDecorativeDragHandle = () => (
        <span aria-hidden="true" className="inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground">
            <GripVerticalIcon className="h-4 w-4" />
        </span>
    );

    return (
        <div className="border-t border-border bg-muted/40 rounded-b-lg">
            <div className={cn('space-y-2 py-2 pb-4 pr-2', isMobileLayout ? 'px-2' : 'pl-8')}>
                {manualSortEnabled ? (
                    useExternalDragContext ? (
                        <SortableContext items={activeSubtasks.map((subtask) => `subtask:${subtask.id}`)} strategy={verticalListSortingStrategy}>
                            <div
                                ref={setSubtaskContainerNodeRef}
                                className={cn(
                                    'space-y-2 rounded-md transition-colors',
                                    showDropPreview && 'min-h-12'
                                )}
                            >
                                {renderedSortableSubtasks}
                            </div>
                        </SortableContext>
                    ) : (
                    <DndContext
                        sensors={subtaskSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleSubtaskDragEnd}
                    >
                        <SortableContext items={activeSubtasks.map((subtask) => `subtask:${subtask.id}`)} strategy={verticalListSortingStrategy}>
                            <div
                                ref={setSubtaskContainerNodeRef}
                                className={cn(
                                    'space-y-2 rounded-md transition-colors',
                                    showDropPreview && 'min-h-12'
                                )}
                            >
                                {renderedSortableSubtasks}
                            </div>
                        </SortableContext>
                    </DndContext>
                    )
                ) : activeSubtasks.map((subtask) => (
                    <SubtaskItem
                        key={subtask.id}
                        task={subtask}
                        onToggleBillable={onToggleBillable}
                        onArchive={() => handleArchiveSubtask(subtask.id)}
                        onDelete={() => handleDeleteSubtask(subtask.id)}
                        onEditTask={onEditTask}
                        onViewTask={onViewTask}
                        dragHandle={showDecorativeDragHandles ? renderDecorativeDragHandle() : null}
                    />
                ))}

                {!task.completed && onCreateSubtask && (
                    showCreateSubtaskForm ? (
                        <SubtaskCreateForm
                            newSubtaskTitle={newSubtaskTitle}
                            setNewSubtaskTitle={setNewSubtaskTitle}
                            newSubtaskNote={newSubtaskNote}
                            setNewSubtaskNote={setNewSubtaskNote}
                            newSubtaskStartDate={newSubtaskStartDate}
                            setNewSubtaskStartDate={setNewSubtaskStartDate}
                            onCreateSubtask={handleCreateSubtask}
                            onCancel={cancelCreateSubtask}
                        />
                    ) : (
                        <div className={`${
                            (anyTimerActive && isRelatedToActiveTimer)
                                ? 'opacity-50 pointer-events-none'
                                : ''
                        }`}>
                            <button
                                onClick={() => setShowCreateSubtaskForm(true)}
                                className="w-full text-left py-2 px-3 text-sm text-muted-foreground cursor-pointer rounded-md transition-colors border border-dashed border-border hover:bg-muted/40"
                            >
                                + Add subtask
                            </button>
                        </div>
                    )
                )}

                {archivedSubtasks.length > 0 && (
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

                        {showArchivedSubtasks && (
                            <div className="mt-2 space-y-2">
                                {archivedSubtasks.map((subtask) => (
                                    <SubtaskItem
                                        key={subtask.id}
                                        task={subtask}
                                        onToggleBillable={onToggleBillable}
                                        onDelete={() => handleDeleteSubtask(subtask.id)}
                                        onUnarchive={() => handleUnarchiveSubtask(subtask.id)}
                                        onEditTask={onEditTask}
                                        onViewTask={onViewTask}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={Boolean(pendingDeleteSubtaskId)}
                onClose={closeDeleteSubtaskModal}
                title="Delete task?"
                description="This will permanently remove the task and any related time entries."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteSubtaskModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteSubtask}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-3">
                    <Notice
                        title={pendingDeleteSubtask
                            ? `Deleting "${pendingDeleteSubtask.title}" cannot be undone.`
                            : 'Deleting this task cannot be undone.'}
                        variant="destructive"
                    />
                    <DeleteTaskWarnings
                        summary={deleteBillingSummary}
                        taskCount={pendingDeleteSubtaskId ? 1 : 0}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default SubtaskSection;
