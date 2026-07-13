import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArchiveBoxIcon, ArchiveRestoreIcon, GripVerticalIcon, TrashIcon } from '@/components/ui/icons';
import { useTasks } from '@/hooks/useTasks';
import { useTimers } from '@/hooks/useTimers';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { getTodayString } from '@/utils/dateUtils.ts';
import TaskTimer from '../../TaskTimer';
import TaskHeader from '../TaskHeader';

const noop = () => {};

const stopDragPropagation = (event) => {
    event.stopPropagation();
};

const buildDragHandle = ({
    dragActivatorRef,
    dragAttributes,
    dragListeners,
    dragDisabled,
}) => {
    const dragInteractionProps = dragDisabled
        ? {}
        : {
            ref: dragActivatorRef,
            ...dragAttributes,
            ...dragListeners,
        };

    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground',
                !dragDisabled && 'touch-none cursor-grab active:cursor-grabbing',
                dragDisabled && 'opacity-50'
            )}
            {...dragInteractionProps}
        >
            <GripVerticalIcon className="h-4 w-4" />
        </span>
    );
};

const TaskKanbanTaskRow = ({
    task,
    onOpen,
    onArchive = null,
    onUnarchive = null,
    onDelete = null,
    dragActivatorRef,
    dragAttributes = {},
    dragListeners = {},
    dragDisabled = false,
}) => {
    const { updateTask } = useTasks();
    const { getTimerForTask, stopTimer } = useTimers();
    const { showError } = useToast();

    const timerKey = task.projectId || task.id;
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isTimerActive = Boolean(projectTimer && projectTimer.taskId === task.id);

    const handleToggleComplete = useCallback(async (checked) => {
        if (task.recurring || task.archived) {
            return;
        }

        const now = Date.now();

        if (isTimerActive && projectTimer?.startTime) {
            try {
                if (!await stopTimer(timerKey)) return;
            } catch (error) {
                showError(error instanceof Error ? error.message : 'Could not stop the timer.');
                return;
            }
        }

        updateTask(task.id, {
            completed: checked,
            completedOnDate: checked ? getTodayString() : null,
            lastActive: now,
        });
    }, [isTimerActive, projectTimer, showError, stopTimer, task.archived, task.id, task.recurring, timerKey, updateTask]);

    const dragHandle = buildDragHandle({
        dragActivatorRef,
        dragAttributes,
        dragListeners,
        dragDisabled,
    });

    const itemLabel = task.parentTaskId ? 'Subtask' : 'Task';
    const showArchiveAction = !task.archived && !task.recurring && task.completed && Boolean(onArchive);
    const showArchivedActions = task.archived && (Boolean(onUnarchive) || Boolean(onDelete));

    return (
        <div
            className="space-y-2 select-none"
        >
            <div className="flex items-center gap-4">
                <TaskHeader
                    task={task}
                    isEditing={false}
                    editTitle={task.title}
                    setEditTitle={noop}
                    isCompleted={task.completed === true}
                    isArchived={task.archived === true}
                    onToggleComplete={handleToggleComplete}
                    onSaveTitle={noop}
                    onCancelEdit={noop}
                    onShowTimeEntries={noop}
                    mainTaskTime={0}
                    totalTimeWithSubtasks={0}
                    isSubtask={Boolean(task.parentTaskId)}
                    showTimeDisplay={false}
                    showCheckbox={true}
                    onTitleClick={onOpen}
                    leadingAccessory={dragHandle}
                    stopTitleDragPropagation={false}
                />

                {!task.completed && !task.archived ? <TaskTimer task={task} showTimeDisplay={false} /> : null}

                {showArchivedActions ? (
                    <div className="flex items-center space-x-2" onPointerDownCapture={stopDragPropagation}>
                        {onUnarchive ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onUnarchive}
                                className="h-8 w-8"
                                title={`Unarchive ${itemLabel}`}
                                aria-label={`Unarchive ${itemLabel}`}
                            >
                                <ArchiveRestoreIcon className="h-5 w-5" />
                            </Button>
                        ) : null}

                        {onDelete ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onDelete}
                                className="status-danger-action h-8 w-8 status-danger-text-strong"
                                title={`Delete ${itemLabel}`}
                                aria-label={`Delete ${itemLabel}`}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                {showArchiveAction ? (
                    <div className="flex items-center space-x-2" onPointerDownCapture={stopDragPropagation}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onArchive}
                            className="status-warning-action h-8 w-8 status-warning-text-strong"
                            title={`Archive ${itemLabel}`}
                            aria-label={`Archive ${itemLabel}`}
                        >
                            <ArchiveBoxIcon className="h-5 w-5" />
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default TaskKanbanTaskRow;
