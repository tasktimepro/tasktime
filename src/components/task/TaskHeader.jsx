import React from 'react';
import CustomCheckbox from '../CustomCheckbox';
import TaskEditForm from './TaskEditForm';
import TaskTimeDisplay from './TaskTimeDisplay';
import { linkifyNodes } from '@/utils/linkifyUtils';

const stopDragPropagation = (event) => {
    event.stopPropagation();
};

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
    onTitleClick,
    leadingAccessory = null,
    stopTitleDragPropagation = true,
}) => {
    const titlePointerProps = stopTitleDragPropagation
        ? { onPointerDownCapture: stopDragPropagation }
        : {};

    return (
        <div className="flex items-center space-x-3 flex-1 min-w-0 overflow-hidden">
            {leadingAccessory ? (
                <div className="flex-shrink-0">
                    {leadingAccessory}
                </div>
            ) : null}

            {/* Completion Checkbox */}
            {showCheckbox && (
                <div className="flex-shrink-0" onPointerDownCapture={stopDragPropagation}>
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={onToggleComplete}
                        disabled={isEditing || isArchived}
                    />
                </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
                {isEditing ? (
                    <TaskEditForm
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        onSave={onSaveTitle}
                        onCancel={onCancelEdit}
                        isCompleted={isCompleted}
                    />
                ) : (
                    <div className="flex items-center space-x-3 min-w-0 overflow-hidden">
                        {onTitleClick ? (
                            <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5 overflow-hidden" {...titlePointerProps}>
                                <button
                                    type="button"
                                    onClick={onTitleClick}
                                    className={`block w-full min-w-0 overflow-hidden text-left text-sm font-medium transition-colors cursor-pointer ${
                                        isCompleted
                                            ? 'line-through text-muted-foreground hover:text-muted-foreground'
                                            : 'text-foreground hover-status-info-text-strong'
                                    }`}
                                >
                                    <span className="block w-full truncate">{task.title}</span>
                                </button>
                                {task.note && (
                                    <span className={`block w-full truncate text-xs text-muted-foreground ${
                                        isCompleted ? 'line-through' : ''
                                    }`}>
                                        {linkifyNodes(task.note, React.createElement, {
                                            linkClassName: 'text-muted-foreground hover:text-foreground hover:underline'
                                        })}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className={`text-sm font-medium flex flex-1 flex-col items-start min-w-0 gap-0.5 overflow-hidden ${
                                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`} {...titlePointerProps}>
                                <span className="block w-full truncate">{task.title}</span>
                                {task.note && (
                                    <span className={`block w-full truncate text-xs text-muted-foreground ${
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
