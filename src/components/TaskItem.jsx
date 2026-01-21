import React, { useMemo, useState, useCallback } from 'react';
import TaskHeader from './task/TaskHeader';
import TaskActions from './task/TaskActions';
import SubtaskSection from './task/SubtaskSection';
import TimeEntriesModal from './TimeEntriesModal';
import { useToast } from '../hooks/useToast';
import { useTasks } from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimer } from '../hooks/useTimer';

/**
 * TaskItem component - Displays individual task with timer controls and subtasks.
 * Uses Yjs hooks directly for state management
 * @param {Object} props
 */
const TaskItem = ({
    task,
    onDelete,
    onCreateSubtask,
    onArchive,
    onUnarchive,
    onToggleBillable
}) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const { showSuccess } = useToast();
    
    // Yjs hooks for state
    const { tasks, updateTask } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { isActive: isAnyTimerActive, isPaused, taskId: activeTimerTaskId, startTime: timerStartTime, note: timerNote, stopTimer, clearTimer } = useTimer();

    const subtasks = useMemo(() => {
        return tasks.filter((t) => t.parentTaskId === task.id);
    }, [tasks, task.id]);

    // Compute task state
    const isTimerActive = isAnyTimerActive && activeTimerTaskId === task.id;
    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;
    
    // Check if this task or any subtask has active timer
    const subtaskIds = useMemo(() => subtasks.map(s => s.id), [subtasks]);
    const isRelatedToActiveTimer = isAnyTimerActive && (
        activeTimerTaskId === task.id || subtaskIds.includes(activeTimerTaskId)
    );
    
    // Should dim if another task (not related) has an active timer
    const shouldDimTask = isAnyTimerActive && !isRelatedToActiveTimer;

    // Calculate total time for this task
    const mainTaskTime = useMemo(() => {
        return timeEntries
            .filter(e => e.taskId === task.id)
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id]);

    // Calculate total time including subtasks
    const totalTimeWithSubtasks = useMemo(() => {
        const allTaskIds = [task.id, ...subtaskIds];
        return timeEntries
            .filter(e => allTaskIds.includes(e.taskId))
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id, subtaskIds]);

    /**
     * Toggle task completion status.
     * @param {boolean} checked
     */
    const handleToggleComplete = useCallback((checked) => {
        const now = Date.now();

        // If timer is active for this task, stop it and create entry
        if (isTimerActive && timerStartTime) {
            createEntry({
                taskId: task.id,
                start: timerStartTime,
                end: now,
                note: timerNote
            });
            clearTimer();
        }

        updateTask(task.id, { completed: checked, lastActive: now });
    }, [isTimerActive, timerStartTime, timerNote, task.id, createEntry, clearTimer, updateTask]);

    /**
     * Update task title.
     * @param {Event} e
     */
    const handleUpdateTitle = useCallback((e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        updateTask(task.id, { title: editTitle.trim(), lastActive: Date.now() });
        setIsEditing(false);
    }, [editTitle, task.id, updateTask]);

    /**
     * Cancel editing.
     */
    const cancelEdit = useCallback(() => {
        setEditTitle(task.title);
        setIsEditing(false);
    }, [task.title]);

    /**
     * Create a new subtask.
     * @param {Event} e
     */
    const handleCreateSubtask = useCallback((e) => {
        e.preventDefault();

        if (!newSubtaskTitle.trim()) return;

        if (onCreateSubtask) {
            onCreateSubtask({
                parentTaskId: task.id,
                title: newSubtaskTitle
            });

            setNewSubtaskTitle('');
            setShowCreateSubtaskForm(false);
        }
    }, [newSubtaskTitle, task.id, onCreateSubtask]);

    /**
     * Cancel subtask creation.
     */
    const cancelCreateSubtask = useCallback(() => {
        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    }, []);

    return (
        <div className={`bg-card border border-border rounded-lg overflow-hidden ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
            <div className="p-4">
                <div className="flex items-center justify-between space-x-3">
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
                        totalTimeWithSubtasks={totalTimeWithSubtasks}
                        isSubtask={false}
                    />

                    <TaskActions
                        task={task}
                        isEditing={isEditing}
                        isTimerActive={isTimerActive}
                        anyTimerActive={isAnyTimerActive}
                        isArchived={isArchived}
                        isCompleted={isCompleted}
                        isRelatedToActiveTimer={isRelatedToActiveTimer}
                        onArchive={onArchive}
                        onUnarchive={onUnarchive}
                        onDelete={onDelete}
                        onToggleBillable={onToggleBillable}
                        onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                        onEdit={() => setIsEditing(true)}
                    />
                </div>
            </div>

            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
            />

            <SubtaskSection
                subtasks={subtasks}
                task={task}
                onToggleBillable={onToggleBillable}
                onCreateSubtask={onCreateSubtask}
                showCreateSubtaskForm={showCreateSubtaskForm}
                setShowCreateSubtaskForm={setShowCreateSubtaskForm}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                handleCreateSubtask={handleCreateSubtask}
                cancelCreateSubtask={cancelCreateSubtask}
                isArchived={isArchived}
                anyTimerActive={isAnyTimerActive}
                isRelatedToActiveTimer={isRelatedToActiveTimer}
                showSuccess={showSuccess}
            />
        </div>
    );
};

export default React.memo(TaskItem);
