import React, { useMemo, useState } from 'react';
import TaskHeader from './task/TaskHeader';
import TaskActions from './task/TaskActions';
import SubtaskSection from './task/SubtaskSection';
import TimeEntriesModal from './TimeEntriesModal.jsx';
import { useToast } from '../hooks/useToast';
import useTaskState from './task/hooks/useTaskState';

/**
 * TaskItem component - Displays individual task with timer controls and subtasks.
 * @param {Object} props
 */
const TaskItem = ({
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
    onDelete,
    onCreateSubtask,
    onArchive,
    onUnarchive,
    onToggleBillable,
    allTasks
}) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const { showSuccess } = useToast();

    const taskList = allTasks || tasks;

    const subtasks = useMemo(() => {

        return taskList.filter((t) => t.parentTaskId === task.id);
    }, [taskList, task.id]);

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
        subtasks,
        setTasks
    });

    /**
     * Toggle task completion status.
     * @param {boolean} checked
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

        const updatedTasks = tasks.map((t) => (
            t.id === task.id
                ? { ...t, completed: checked, lastActive: now }
                : t
        ));

        setTasks(updatedTasks);
    };

    /**
     * Update task title.
     * @param {Event} e
     */
    const handleUpdateTitle = (e) => {

        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map((t) => (
            t.id === task.id
                ? { ...t, title: editTitle.trim(), lastActive: now }
                : t
        ));

        setTasks(updatedTasks);
        setIsEditing(false);
    };

    /**
     * Cancel editing.
     */
    const cancelEdit = () => {

        setEditTitle(task.title);
        setIsEditing(false);
    };

    /**
     * Create a new subtask.
     * @param {Event} e
     */
    const handleCreateSubtask = (e) => {

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
    };

    /**
     * Cancel subtask creation.
     */
    const cancelCreateSubtask = () => {

        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    };

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
                        tasks={taskList}
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
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                allTasks={taskList}
            />

            <SubtaskSection
                subtasks={subtasks}
                task={task}
                tasks={tasks}
                setTasks={setTasks}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                currentTimer={currentTimer}
                setCurrentTimer={setCurrentTimer}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                pausedElapsedTime={pausedElapsedTime}
                setPausedElapsedTime={setPausedElapsedTime}
                isGlobalTimer={isGlobalTimer}
                onToggleBillable={onToggleBillable}
                allTasks={taskList}
                onCreateSubtask={onCreateSubtask}
                showCreateSubtaskForm={showCreateSubtaskForm}
                setShowCreateSubtaskForm={setShowCreateSubtaskForm}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                handleCreateSubtask={handleCreateSubtask}
                cancelCreateSubtask={cancelCreateSubtask}
                isArchived={isArchived}
                anyTimerActive={anyTimerActive}
                isRelatedToActiveTimer={isRelatedToActiveTimer}
                showSuccess={showSuccess}
            />
        </div>
    );
};

export default React.memo(TaskItem);
