import { ArchiveBoxIcon, ArchiveRestoreIcon, ClockIcon, CurrencyDollarIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import TaskTimer from '../../TaskTimer';
import TaskDropdown from './TaskDropdown';
import { useTimers } from '../../../hooks/useTimers';

/**
 * TaskActions component - Right-side action buttons and timer controls.
 * Now uses Yjs hooks directly for timer state.
 * @param {Object} props
 */
const TaskActions = ({
    task,
    isEditing,
    anyTimerActive,
    isArchived,
    isCompleted,
    isRelatedToActiveTimer,
    onArchive,
    onUnarchive,
    onDelete,
    onToggleBillable,
    onShowTimeEntries,
    onEdit
}) => {
    // Use Yjs timer hook directly
    const { getTimerForTask } = useTimers();
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isPaused = projectTimer?.isPaused || false;
    const hideNonTimerActions = Boolean(projectTimer);
    const hideTimerControls = isCompleted;
    
    if (isEditing) {
        return null;
    }

    // Determine if we should hide the component entirely to prevent empty flex container spacing
    // This happens when a timer is active elsewhere (and not paused) and this task is not related
    // AND it's not archived (archived tasks always show restore/delete buttons)
    const shouldHideAll = !isArchived && anyTimerActive && !isPaused && !isTimerActive && !isRelatedToActiveTimer;

    if (shouldHideAll) {
        return null;
    }

    return (
        <div className="flex items-center space-x-1">
            {isArchived ? (
                <div className="flex items-center space-x-2">
                    {onUnarchive && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onUnarchive}
                            className="h-8 w-8"
                            title="Unarchive Task"
                            aria-label="Unarchive Task"
                        >
                            <ArchiveRestoreIcon className="h-5 w-5" />
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            className="status-danger-action h-8 w-8 status-danger-text-strong"
                            title="Delete Task"
                            aria-label="Delete Task"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {!hideTimerControls && (!anyTimerActive || isTimerActive) && (
                        <TaskTimer
                            task={task}
                            showTimeDisplay={false}
                        />
                    )}

                    {!hideNonTimerActions && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onShowTimeEntries}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                            title="View Time Entries"
                        >
                            <ClockIcon className="h-5 w-5" />
                        </Button>
                    )}

                    {onToggleBillable && !hideNonTimerActions && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onToggleBillable(task.id)}
                            className={`h-8 w-8 ${
                                task.billable
                                    ? 'text-foreground bg-muted'
                                    : 'text-muted-foreground'
                            } hover:text-foreground hover:bg-accent`}
                            title={
                                task.billable
                                    ? 'Mark as not billable'
                                    : 'Mark as billable'
                            }
                        >
                            <CurrencyDollarIcon className="h-5 w-5" />
                        </Button>
                    )}

                    {!task.recurring && isCompleted && !task.parentTaskId && onArchive && !hideNonTimerActions && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onArchive}
                            className="status-warning-action h-8 w-8 status-warning-text-strong"
                            title="Archive Task"
                        >
                            <ArchiveBoxIcon className="h-5 w-5" />
                        </Button>
                    )}

                    {onDelete && !hideNonTimerActions && (
                        <TaskDropdown
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default TaskActions;
