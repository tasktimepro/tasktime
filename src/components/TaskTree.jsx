import React, { useState } from 'react';
import { DocumentCheckIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons';
import TaskItem from './TaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import { generateId } from '../utils/idUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { deleteTaskWithCleanup } from '../utils/taskUtils.ts';
import { isDeleted, withCreateMetadata, withUpdateMetadata } from '../utils/syncableEntity.ts';

/**
 * TaskTree component - Displays and manages the hierarchical task structure
 */
const TaskTree = ({
    project,
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
    isGlobalTimer = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showArchivedTasks, setShowArchivedTasks] = useState(false);
    const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);
    const { showSuccess } = useToast();

    // Get tasks for this project (exclude soft-deleted)
    const projectTasks = tasks.filter(task => task.projectId === project.id && !isDeleted(task));

    // Get parent tasks (tasks without parentTaskId) that are not archived
    const parentTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived);

    // Get archived parent tasks
    const archivedTasks = projectTasks.filter(task => !task.parentTaskId && task.archived);

    const pendingDeleteTask = pendingDeleteTaskId
        ? tasks.find(task => task.id === pendingDeleteTaskId)
        : null;

    /**
     * Create a new task
     */
    const handleCreateTask = (taskData) => {
        const newTask = withCreateMetadata({
            id: generateId(),
            projectId: project.id,
            parentTaskId: taskData.parentTaskId,
            title: taskData.title.trim(),
            lastActive: Date.now(), // Initialize lastActive to creation time
            lastBilledAt: null, // Initialize as never billed
            billable: false, // Initialize as not billable by default
            billableSetByUser: false // Track if billable status has been explicitly set by user
        });

        // Create a new tasks array with the new task added
        let updatedTasks = [...tasks, newTask];
        
        // If this is a subtask, also update the parent task's lastActive with sync metadata
        if (taskData.parentTaskId) {
            updatedTasks = updatedTasks.map(t => 
                t.id === taskData.parentTaskId ? withUpdateMetadata({ ...t, lastActive: Date.now() }) : t
            );
        }

        setTasks(updatedTasks);
    };

    /**
     * Create a new main task
     */
    const handleCreateMainTask = (e) => {
        e.preventDefault();

        if (!newTaskTitle.trim()) return;

        handleCreateTask({
            parentTaskId: null,
            title: newTaskTitle
        });

        setNewTaskTitle('');
        setShowCreateForm(false);
    };

    /**
     * Archive a task
     */
    const handleArchiveTask = (taskId) => {
        const updatedTasks = tasks.map(task =>
            task.id === taskId ? withUpdateMetadata({ ...task, archived: true, lastActive: Date.now() }) : task
        );
        setTasks(updatedTasks);
    };

    /**
     * Unarchive a task
     */
    const handleUnarchiveTask = (taskId) => {
        const updatedTasks = tasks.map(task =>
            task.id === taskId ? withUpdateMetadata({ ...task, archived: false, lastActive: Date.now() }) : task
        );
        setTasks(updatedTasks);
    };

    /**
     * Toggle billable status for a task
     * This function guarantees that a task can always be toggled
     * between billable and non-billable states
     */
    const handleToggleBillable = (taskId) => {
        // Find the task to get its current billable status
        const targetTask = tasks.find(task => task.id === taskId);
        if (!targetTask) return;
        
        // Create a definite boolean toggle (force it to be a boolean)
        const newBillableStatus = targetTask.billable !== true;
        
        // Update the task, ensuring billable property is explicitly set
        // Also mark that this was set by the user to prevent auto-override
        const updatedTasks = tasks.map(task =>
            task.id === taskId ? withUpdateMetadata({ 
                ...task, 
                billable: newBillableStatus, 
                billableSetByUser: true, // Mark as explicitly set by user
                lastActive: Date.now() 
            }) : task
        );
        
        setTasks(updatedTasks);
        showSuccess(`Task marked as ${newBillableStatus ? 'billable' : 'not billable'}`);
    };

    /**
     * Delete a task and its subtasks
     */
    const handleDeleteTask = (taskId) => {
        setPendingDeleteTaskId(taskId);
    };

    const closeDeleteTaskModal = () => {

        setPendingDeleteTaskId(null);
    };

    const confirmDeleteTask = () => {

        if (!pendingDeleteTaskId) {

            return;
        }

        const result = deleteTaskWithCleanup(
            pendingDeleteTaskId,
            tasks,
            timeEntries,
            currentTimer,
            setTasks,
            setTimeEntries,
            setCurrentTimer
        );

        // Show appropriate success message
        const message = result.isMainTask && result.deletedCount > 1
            ? `Task "${result.taskTitle}" and ${result.deletedCount - 1} subtask(s) deleted successfully`
            : `Task "${result.taskTitle}" deleted successfully`;
        
        showSuccess(message);
        setPendingDeleteTaskId(null);
    };

    /**
     * Start creating a subtask for a parent task
     */
    // const startCreatingSubtask = (parentTaskId) => {
        // This will now be handled by the TaskItem component
        // No need to set global state
    // };

    /**
     * Cancel task creation
     */
    const cancelCreate = () => {
        setShowCreateForm(false);
        setNewTaskTitle('');
    };

    return (
        <div className="space-y-4">
            {/* Create Task Form */}
            {showCreateForm && (
                <div className="bg-muted border border-border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                        Create New Task
                    </h3>

                    <form onSubmit={handleCreateMainTask} className="flex space-x-3">
                        <Input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task title"
                            className="flex-1"
                            autoFocus
                        />

                        <Button type="submit">
                            Create
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelCreate}
                        >
                            Cancel
                        </Button>
                    </form>
                </div>
            )}

            {/* Add Task Button */}
            {!showCreateForm && (
                <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    leadingIcon={PlusIcon}
                >
                    Add Task
                </Button>
            )}

            {/* Tasks List */}
            {parentTasks.length === 0 && archivedTasks.length === 0 ? (
                <EmptyState
                    icon={DocumentCheckIcon}
                    title="No tasks yet"
                    description="Get started by creating your first task."
                    className="py-8"
                />
            ) : (
                <>
                    {/* Active Tasks */}
                    {parentTasks.length > 0 && (
                        <div className="space-y-4">
                            {parentTasks.map((task) => (
                                <TaskItem
                                    key={task.id}
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
                                    onDelete={() => handleDeleteTask(task.id)}
                                    onCreateSubtask={handleCreateTask}
                                    onArchive={() => handleArchiveTask(task.id)}
                                    onUnarchive={() => handleUnarchiveTask(task.id)}
                                    onToggleBillable={handleToggleBillable} // Pass the function directly
                                    allTasks={projectTasks}
                                />
                            ))}
                        </div>
                    )}

                    {/* Archived Tasks Section */}
                    {archivedTasks.length > 0 && (
                        <div className="mt-8 border-t pt-6">
                            <button
                                onClick={() => setShowArchivedTasks(!showArchivedTasks)}
                                className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4"
                            >
                                {showArchivedTasks ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Tasks ({archivedTasks.length})
                            </button>

                            {showArchivedTasks && (
                                <div className="space-y-2 scrollable-container">
                                    {archivedTasks.map((task) => (
                                        <TaskItem
                                            key={task.id}
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
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onCreateSubtask={handleCreateTask}
                                            onUnarchive={() => handleUnarchiveTask(task.id)}
                                            onToggleBillable={handleToggleBillable}
                                            allTasks={projectTasks}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={Boolean(pendingDeleteTaskId)}
                onClose={closeDeleteTaskModal}
                title="Delete task?"
                description="This will permanently remove the task and any related time entries."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteTaskModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteTask}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteTask
                        ? `Deleting "${pendingDeleteTask.title}" cannot be undone.`
                        : 'Deleting this task cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default React.memo(TaskTree);
