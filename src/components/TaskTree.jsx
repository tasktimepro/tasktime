import React, { useState, useCallback, useMemo } from 'react';
import { DocumentCheckIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon, SortIcon } from '@/components/ui/icons';
import TaskItem from './TaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import { useToast } from '../hooks/useToast.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useTimer } from '../hooks/useTimer.ts';
import { getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';

/**
 * TaskTree component - Displays and manages the hierarchical task structure
 * Uses Yjs hooks directly for state management
 */
const TaskTree = ({
    project
}) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showArchivedTasks, setShowArchivedTasks] = useState(false);
    const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);
    const [taskSort, setTaskSort] = useState('lastActive');
    const { showSuccess } = useToast();
    
    // Yjs hooks for state
    const { tasks, createTask, updateTask, deleteTask } = useTasks({ projectId: project.id });
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { taskId: activeTimerTaskId, clearTimer } = useTimer();

    const allowBillableToggle = !project.isPersonal;

    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get parent tasks (tasks without parentTaskId) that are not archived
    const parentTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived);

    // Get archived parent tasks
    const archivedTasks = projectTasks.filter(task => !task.parentTaskId && task.archived);

    const visibleTasksCount = useMemo(() => {

        return projectTasks.filter(task => !task.completed && !task.archived).length;
    }, [projectTasks]);

    const sortedParentTasks = useMemo(() => {

        return sortItems({
            items: parentTasks,
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [parentTasks, taskSort]);

    const sortedArchivedTasks = useMemo(() => {

        return sortItems({
            items: archivedTasks,
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [archivedTasks, taskSort]);

    const pendingDeleteTask = pendingDeleteTaskId
        ? tasks.find(task => task.id === pendingDeleteTaskId)
        : null;

    /**
     * Create a new task
     */
    const handleCreateTask = useCallback((taskData) => {
        const newTask = createTask({
            projectId: project.id,
            parentTaskId: taskData.parentTaskId || null,
            title: taskData.title.trim(),
            lastActive: Date.now(),
            lastBilledAt: null,
            billable: false,
            billableSetByUser: false
        });

        // If this is a subtask, also update the parent task's lastActive
        if (taskData.parentTaskId) {
            updateTask(taskData.parentTaskId, { lastActive: Date.now() });
        }
        
        return newTask;
    }, [createTask, updateTask, project.id]);

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
    const handleArchiveTask = useCallback((taskId) => {
        updateTask(taskId, { archived: true, lastActive: Date.now() });
    }, [updateTask]);

    /**
     * Unarchive a task
     */
    const handleUnarchiveTask = useCallback((taskId) => {
        updateTask(taskId, { archived: false, lastActive: Date.now() });
    }, [updateTask]);

    /**
     * Toggle billable status for a task
     */
    const handleToggleBillable = useCallback((taskId) => {
        const targetTask = tasks.find(task => task.id === taskId);
        if (!targetTask) return;
        
        const newBillableStatus = targetTask.billable !== true;
        
        updateTask(taskId, {
            billable: newBillableStatus,
            billableSetByUser: true,
            lastActive: Date.now()
        });
        
        showSuccess(`Task marked as ${newBillableStatus ? 'billable' : 'not billable'}`);
    }, [tasks, updateTask, showSuccess]);

    /**
     * Delete a task and its subtasks
     */
    const handleDeleteTask = (taskId) => {
        setPendingDeleteTaskId(taskId);
    };

    const closeDeleteTaskModal = () => {
        setPendingDeleteTaskId(null);
    };

    const confirmDeleteTask = useCallback(() => {
        if (!pendingDeleteTaskId) return;

        const taskToDelete = tasks.find(t => t.id === pendingDeleteTaskId);
        const taskTitle = taskToDelete?.title || 'Task';
        const isMainTask = !!(taskToDelete && !taskToDelete.parentTaskId);

        // Get all task IDs to delete (including subtasks for main tasks)
        const taskIdsToDelete = isMainTask 
            ? getTaskIdsToDelete(pendingDeleteTaskId, tasks)
            : [pendingDeleteTaskId];

        // Delete time entries for these tasks
        const entriesToDelete = timeEntries.filter(entry => 
            taskIdsToDelete.includes(entry.taskId)
        );
        entriesToDelete.forEach(entry => deleteEntry(entry.id));

        // Clear timer if it's for one of these tasks
        if (activeTimerTaskId && taskIdsToDelete.includes(activeTimerTaskId)) {
            clearTimer();
        }

        // Delete tasks
        taskIdsToDelete.forEach(id => deleteTask(id));

        // Show success message
        const message = isMainTask && taskIdsToDelete.length > 1
            ? `Task "${taskTitle}" and ${taskIdsToDelete.length - 1} subtask(s) deleted successfully`
            : `Task "${taskTitle}" deleted successfully`;
        
        showSuccess(message);
        setPendingDeleteTaskId(null);
    }, [pendingDeleteTaskId, tasks, timeEntries, activeTimerTaskId, deleteEntry, clearTimer, deleteTask, showSuccess]);

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
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                    Tasks ({visibleTasksCount})
                </h3>

                <div className="flex items-center space-x-3">
                    <Select value={taskSort} onValueChange={setTaskSort}>
                        <SelectTrigger
                            className="h-9 w-9"
                            aria-label="Sort tasks"
                            leadingIcon={SortIcon}
                            hideCaret
                            iconOnly
                        >
                            <span className="sr-only">
                                <SelectValue placeholder="Sort by" />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {!showCreateForm && (
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateForm(true)}
                            leadingIcon={PlusIcon}
                        >
                            Add Task
                        </Button>
                    )}
                </div>
            </div>

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
                    {sortedParentTasks.length > 0 && (
                        <div className="space-y-4">
                            {sortedParentTasks.map((task) => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onDelete={() => handleDeleteTask(task.id)}
                                    onCreateSubtask={handleCreateTask}
                                    onArchive={() => handleArchiveTask(task.id)}
                                    onUnarchive={() => handleUnarchiveTask(task.id)}
                                    onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                />
                            ))}
                        </div>
                    )}

                    {/* Archived Tasks Section */}
                    {sortedArchivedTasks.length > 0 && (
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
                                Archived Tasks ({sortedArchivedTasks.length})
                            </button>

                            {showArchivedTasks && (
                                <div className="space-y-2 scrollable-container">
                                    {sortedArchivedTasks.map((task) => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onCreateSubtask={handleCreateTask}
                                            onUnarchive={() => handleUnarchiveTask(task.id)}
                                            onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
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
