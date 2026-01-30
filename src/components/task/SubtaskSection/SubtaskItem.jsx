import React, { useState, useCallback, useMemo } from 'react';
import TimeEntriesModal from '../../TimeEntriesModal';
import TaskHeader from '../TaskHeader';
import TaskActions from '../TaskActions';
import StartDateBadge from '../StartDateBadge';
import { formatDurationWithSeconds } from '../../../utils/dateUtils.ts';
import { useTasks } from '../../../hooks/useTasks';
import { useTimeEntries } from '../../../hooks/useTimeEntries';
import { useTimers } from '../../../hooks/useTimers';

/**
 * SubtaskItem component - Displays individual subtask.
 * Uses Yjs hooks directly for state management.
 * @param {Object} props
 */
const SubtaskItem = ({
    task,
    onToggleBillable,
    onDelete,
    onEditTask
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    // Yjs hooks for state
    const { updateTask } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer } = useTimers();

    // Compute state
    const timerKey = task.projectId || task.id;
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isAnyTimerActive = !!projectTimer;
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;
    
    // For subtasks, isRelatedToActiveTimer is just whether this subtask has the timer
    const isRelatedToActiveTimer = isTimerActive;
    
    // Should dim if another task has active timer
    const shouldDimTask = isAnyTimerActive && !projectTimer?.isPaused && !isRelatedToActiveTimer;

    // Calculate time for this subtask
    const mainTaskTime = useMemo(() => {
        return timeEntries
            .filter(e => e.taskId === task.id)
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id]);

    const liveTaskTime = useMemo(() => {
        const timerTime = isTimerActive ? (projectTimer?.elapsedTime || 0) : 0;
        return mainTaskTime + timerTime;
    }, [mainTaskTime, isTimerActive, projectTimer]);

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = useCallback((checked) => {
        const now = Date.now();

        // If timer is active for this task, stop it and create entry
        if (isTimerActive && projectTimer?.startTime) {
            createEntry({
                taskId: task.id,
                start: projectTimer.startTime,
                end: now,
                note: projectTimer.note
            });
            clearTimer(timerKey);
        }

        updateTask(task.id, { completed: checked, lastActive: now });
    }, [isTimerActive, projectTimer, task.id, createEntry, clearTimer, updateTask, timerKey]);

    /**
     * Update subtask title
     */
    const handleUpdateTitle = useCallback((e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        updateTask(task.id, { title: editTitle.trim(), lastActive: Date.now() });
        setIsEditing(false);
    }, [editTitle, task.id, updateTask]);

    /**
     * Cancel editing
     */
    const cancelEdit = useCallback(() => {
        setEditTitle(task.title);
        setIsEditing(false);
    }, [task.title]);

    const handleEditTask = useCallback(() => {
        if (onEditTask) {
            onEditTask(task);
            return;
        }
        setIsEditing(true);
    }, [onEditTask, task]);

    return (
        <div className={`flex items-center justify-between gap-3 py-2 rounded-md hover:bg-muted transition-colors ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
            <TaskHeader
                task={task}
                isEditing={isEditing}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                isCompleted={isCompleted}
                isArchived={isArchived}
                onToggleComplete={handleToggleComplete}
                onSaveTitle={handleUpdateTitle}
                onCancelEdit={cancelEdit}
                onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                mainTaskTime={mainTaskTime}
                totalTimeWithSubtasks={mainTaskTime}
                isSubtask={true}
                showTimeDisplay={false}
            />

            {(task.startDate || task.recurring) && (
                <StartDateBadge
                    startDate={task.startDate}
                    recurring={task.recurring}
                    completed={isCompleted}
                />
            )}

            <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                {formatDurationWithSeconds(liveTaskTime)}
            </div>

            <TaskActions
                task={task}
                isEditing={isEditing}
                isTimerActive={isTimerActive}
                anyTimerActive={isAnyTimerActive}
                isArchived={isArchived}
                isCompleted={isCompleted}
                isRelatedToActiveTimer={isRelatedToActiveTimer}
                onDelete={onDelete}
                onToggleBillable={onToggleBillable}
                onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                onEdit={handleEditTask}
            />

            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
            />
        </div>
    );
};

export default SubtaskItem;
