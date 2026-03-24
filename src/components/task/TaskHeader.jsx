import React from 'react';
import CustomCheckbox from '../CustomCheckbox';
import TaskEditForm from './TaskEditForm';
import TaskTimeDisplay from './TaskTimeDisplay';
import { linkifyNodes } from '@/utils/linkifyUtils';

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
    showCheckbox = true,
    onTitleClick
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
                        {onTitleClick ? (
                            <div className="flex flex-col items-start min-w-0 gap-0.5">
                                <button
                                    type="button"
                                    onClick={onTitleClick}
                                    className={`text-left text-sm font-medium transition-colors cursor-pointer min-w-0 ${
                                        isCompleted
                                            ? 'line-through text-muted-foreground hover:text-muted-foreground'
                                            : 'text-foreground hover-status-info-text-strong'
                                    }`}
                                >
                                    <span className="truncate w-full">{task.title}</span>
                                </button>
                                {task.note && (
                                    <span className={`text-xs text-muted-foreground truncate w-full ${
                                        isCompleted ? 'line-through' : ''
                                    }`}>
                                        {linkifyNodes(task.note, React.createElement, {
                                            linkClassName: 'text-muted-foreground hover:text-foreground hover:underline'
                                        })}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className={`text-sm font-medium flex flex-col items-start min-w-0 gap-0.5 ${
                                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                                <span className="truncate w-full">{task.title}</span>
                                {task.note && (
                                    <span className={`text-xs text-muted-foreground truncate w-full ${
                                        isCompleted ? 'line-through' : ''
                                    }`}>
                                        {linkifyNodes(task.note, React.createElement, {
                                            linkClassName: 'text-muted-foreground hover:text-foreground hover:underline'
                                        })}
                                    </span>
                                )}
                            </div>
                        )}

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
