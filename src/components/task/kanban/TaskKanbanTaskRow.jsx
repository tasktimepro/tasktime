import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArchiveBoxIcon, ArchiveRestoreIcon, GripVerticalIcon, TrashIcon } from '@/components/ui/icons';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useTimers } from '@/hooks/useTimers';
import { cn } from '@/lib/utils';
import { getTodayString } from '@/utils/dateUtils.ts';
import { buildBillableDurationFields } from '@/utils/timeEntryDurationUtils.ts';
import TaskTimer from '../../TaskTimer';
import TaskHeader from '../TaskHeader';

const noop = () => {};

const stopDragPropagation = (event) => {
    event.stopPropagation();
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
    const { createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer } = useTimers();
    const { projects } = useProjects();

    const timerKey = task.projectId || task.id;
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isTimerActive = Boolean(projectTimer && projectTimer.taskId === task.id);

    const currentProject = useMemo(() => {
        if (!task.projectId) {
            return null;
        }

        return projects.find((project) => project.id === task.projectId) || null;
    }, [projects, task.projectId]);

    const handleToggleComplete = useCallback((checked) => {
        if (task.recurring || task.archived) {
            return;
        }

        const now = Date.now();

        if (isTimerActive && projectTimer?.startTime) {
            createEntry({
                taskId: task.id,
                start: projectTimer.startTime,
                end: now,
                note: projectTimer.note,
                _stoppedTimerKey: timerKey,
                _stoppedTimerInstanceId: projectTimer.timerInstanceId,
                ...buildBillableDurationFields({
                    start: projectTimer.startTime,
                    end: now,
                    billingIncrementMinutes: currentProject?.billableTimeIncrementMinutes,
                }),
            });
            clearTimer(timerKey);
        }

        updateTask(task.id, {
            completed: checked,
            completedOnDate: checked ? getTodayString() : null,
            lastActive: now,
        });
    }, [clearTimer, createEntry, currentProject?.billableTimeIncrementMinutes, isTimerActive, projectTimer, task.archived, task.id, task.recurring, timerKey, updateTask]);

    const dragHandle = (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground',
                dragDisabled ? 'opacity-50' : ''
            )}
        >
            <GripVerticalIcon className="h-4 w-4" />
        </span>
    );

    const dragInteractionProps = dragDisabled
        ? {}
        : {
            ref: dragActivatorRef,
            ...dragAttributes,
            ...dragListeners,
        };
    const itemLabel = task.parentTaskId ? 'Subtask' : 'Task';
    const showArchiveAction = !task.archived && !task.recurring && task.completed && Boolean(onArchive);
    const showArchivedActions = task.archived && (Boolean(onUnarchive) || Boolean(onDelete));

    return (
        <div
            className={cn('space-y-2 select-none', !dragDisabled && 'cursor-grab active:cursor-grabbing')}
            {...dragInteractionProps}
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
