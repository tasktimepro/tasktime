import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';

/**
 * TaskTimeDisplay component - Renders time display for tasks.
 * @param {Object} props
 */
const TaskTimeDisplay = ({
    mainTaskTime,
    totalTimeWithSubtasks,
    onShowTimeEntries,
    isCompleted,
    isSubtask = false
}) => {
    if (isSubtask) {
        if (totalTimeWithSubtasks <= 0) return null;
        return (
            <button
                onClick={onShowTimeEntries}
                className="hover:bg-muted px-2 py-1 rounded-md transition-colors"
                title="Click to edit time"
                disabled={isCompleted}
            >
                {formatDurationWithSeconds(totalTimeWithSubtasks)}
            </button>
        );
    }

    return (
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {(mainTaskTime > 0 || totalTimeWithSubtasks > 0) && (
                <div className="flex ml-2 items-center space-x-2">
                    {mainTaskTime > 0 && (
                        <button
                            onClick={onShowTimeEntries}
                            className="hover:bg-muted rounded-md transition-colors"
                            title="Click to edit main task time (excluding subtasks)"
                            disabled={isCompleted}
                        >
                            <span className="text-muted-foreground">
                                {formatDurationWithSeconds(mainTaskTime)}
                            </span>
                        </button>
                    )}
                    {(totalTimeWithSubtasks > mainTaskTime) && (mainTaskTime > 0) && (
                        <span>•</span>
                    )}
                    {totalTimeWithSubtasks > mainTaskTime && (
                        <span
                            className="text-blue-600 font-medium"
                            title="Total time including subtasks"
                        >
                            Total: {formatDurationWithSeconds(totalTimeWithSubtasks)}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskTimeDisplay;
