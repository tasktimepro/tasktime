import { ArchiveBoxIcon, ArchiveRestoreIcon, ClockIcon, CurrencyDollarIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import TaskTimer from '../../TaskTimer';
import TaskDropdown from './TaskDropdown';
import { useTimer } from '../../../hooks/useTimer';

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
    const { isActive, isPaused, taskId } = useTimer();
    const isTimerActive = isActive && taskId === task.id;
    
    if (isEditing) {
        return null;
    }

    return (
        <div className="flex items-center space-x-1">
            {isTimerActive && !isPaused ? (
                <TaskTimer
                    task={task}
                    showTimeDisplay={false}
                />
            ) : isArchived ? (
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
                            className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            title="Delete Task"
                            aria-label="Delete Task"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            ) : isCompleted ? (
                !task.parentTaskId && onArchive && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onArchive}
                        className="h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                        title="Archive Task"
                    >
                        <ArchiveBoxIcon className="h-5 w-5" />
                    </Button>
                )
            ) : anyTimerActive && !isPaused && !isTimerActive && !isRelatedToActiveTimer ? (
                null
            ) : (
                <>
                    <TaskTimer
                        task={task}
                        showTimeDisplay={false}
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onShowTimeEntries}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="View Time Entries"
                    >
                        <ClockIcon className="h-5 w-5" />
                    </Button>

                    {onToggleBillable && (
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

                    {onDelete && (
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
