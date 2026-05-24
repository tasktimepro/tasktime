import { useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { GripVerticalIcon } from '@/components/ui/icons';
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

const TaskKanbanTaskRow = ({
    task,
    onOpen,
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

                {task.completed ? null : <TaskTimer task={task} showTimeDisplay={false} />}
            </div>

            {task.completed ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Done</Badge>
                </div>
            ) : null}
        </div>
    );
};

export default TaskKanbanTaskRow;
