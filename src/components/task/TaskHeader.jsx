import CustomCheckbox from '../CustomCheckbox';
import TaskEditForm from './TaskEditForm';
import TaskTimeDisplay from './TaskTimeDisplay';

/**
 * TaskHeader component - Title, checkbox, and time display.
 * @param {Object} props
 */
const TaskHeader = ({
    task,
    isEditing,
    editTitle,
    setEditTitle,
    isCompleted,
    isArchived,
    onToggleComplete,
    onSaveTitle,
    onCancelEdit,
    onShowTimeEntries,
    mainTaskTime,
    totalTimeWithSubtasks,
    isSubtask = false,
    showTimeDisplay = true,
    showCheckbox = true
}) => {
    return (
        <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Completion Checkbox */}
            {showCheckbox && (
                <div className="flex-shrink-0">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={onToggleComplete}
                        disabled={isEditing || isArchived}
                    />
                </div>
            )}

            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <TaskEditForm
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        onSave={onSaveTitle}
                        onCancel={onCancelEdit}
                        isCompleted={isCompleted}
                    />
                ) : (
                    <div className="flex items-center space-x-3">
                        <h3 className={`text-sm font-medium truncate ${
                            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}>
                            {task.title}
                        </h3>

                        {showTimeDisplay && (
                            <TaskTimeDisplay
                                task={task}
                                mainTaskTime={mainTaskTime}
                                totalTimeWithSubtasks={totalTimeWithSubtasks}
                                onShowTimeEntries={onShowTimeEntries}
                                isCompleted={isCompleted}
                                isSubtask={isSubtask}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskHeader;
