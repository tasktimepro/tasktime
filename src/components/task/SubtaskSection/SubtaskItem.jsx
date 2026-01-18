import React, { useState } from 'react';
import TimeEntriesModal from '../../TimeEntriesModal';
import TaskHeader from '../TaskHeader';
import TaskActions from '../TaskActions';
import useTaskState from '../hooks/useTaskState';

/**
 * SubtaskItem component - Displays individual subtask.
 * @param {Object} props
 */
const SubtaskItem = ({
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    isGlobalTimer = false,
    onToggleBillable,
    onDelete,
    allTasks
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    const {
        mainTaskTime,
        totalTimeWithSubtasks,
        isTimerActive,
        anyTimerActive,
        isCompleted,
        isArchived,
        isRelatedToActiveTimer,
        shouldDimTask
    } = useTaskState({
        task,
        tasks,
        timeEntries,
        currentTimer,
        isPaused,
        subtasks: [],
        setTasks
    });

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = (checked) => {
        const now = Date.now();

        if (isTimerActive && currentTimer) {
            const timeEntry = {
                id: `completion-${Date.now()}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now,
                note: currentTimer.note
            };
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
        }

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: checked, lastActive: now } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Update subtask title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim(), lastActive: now } : t
        );

        setTasks(updatedTasks);
        setIsEditing(false);
    };

    /**
     * Cancel editing
     */
    const cancelEdit = () => {
        setEditTitle(task.title);
        setIsEditing(false);
    };

    return (
        <div className={`flex items-center justify-between py-2 rounded-md hover:bg-muted transition-colors ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
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
                isSubtask={true}
            />

            <TaskActions
                task={task}
                tasks={allTasks || tasks}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                currentTimer={currentTimer}
                setCurrentTimer={setCurrentTimer}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                pausedElapsedTime={pausedElapsedTime}
                setPausedElapsedTime={setPausedElapsedTime}
                isGlobalTimer={isGlobalTimer}
                setTasks={setTasks}
                isEditing={isEditing}
                isTimerActive={isTimerActive}
                anyTimerActive={anyTimerActive}
                isArchived={isArchived}
                isCompleted={isCompleted}
                isRelatedToActiveTimer={isRelatedToActiveTimer}
                onDelete={onDelete}
                onToggleBillable={onToggleBillable}
                onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                onEdit={() => setIsEditing(true)}
            />

            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                allTasks={allTasks}
            />
        </div>
    );
};

export default SubtaskItem;
