import { useState } from 'react';
import { DocumentCheckIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import TaskItem from './TaskItem';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';

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
    setCurrentTimer
}) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showArchivedTasks, setShowArchivedTasks] = useState(false);
    const { showSuccess } = useToast();

    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get parent tasks (tasks without parentTaskId) that are not archived
    const parentTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived);

    // Get archived parent tasks
    const archivedTasks = projectTasks.filter(task => !task.parentTaskId && task.archived);

    /**
     * Create a new task
     */
    const handleCreateTask = (taskData) => {
        const newTask = {
            id: generateId(),
            projectId: project.id,
            parentTaskId: taskData.parentTaskId,
            title: taskData.title.trim(),
            createdAt: Date.now()
        };

        setTasks([...tasks, newTask]);
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
            task.id === taskId ? { ...task, archived: true } : task
        );
        setTasks(updatedTasks);
    };

    /**
     * Unarchive a task
     */
    const handleUnarchiveTask = (taskId) => {
        const updatedTasks = tasks.map(task =>
            task.id === taskId ? { ...task, archived: false } : task
        );
        setTasks(updatedTasks);
    };

    /**
     * Delete a task and its subtasks
     */
    const handleDeleteTask = (taskId) => {
        if (window.confirm('Are you sure you want to delete this task? All subtasks and time entries will be lost.')) {
            // Get the task title before deletion for the toast message
            const taskToDelete = tasks.find(t => t.id === taskId);
            const taskTitle = taskToDelete ? taskToDelete.title : 'Task';
            
            // Get all subtask IDs
            const subtaskIds = projectTasks
                .filter(task => task.parentTaskId === taskId)
                .map(task => task.id);

            // All task IDs to delete (task + its subtasks)
            const taskIdsToDelete = [taskId, ...subtaskIds];

            // Remove tasks
            setTasks(tasks.filter(task => !taskIdsToDelete.includes(task.id)));

            // Remove time entries for these tasks
            setTimeEntries(timeEntries.filter(entry => !taskIdsToDelete.includes(entry.taskId)));

            // Clear current timer if it's for one of these tasks
            if (currentTimer && taskIdsToDelete.includes(currentTimer.taskId)) {
                setCurrentTimer(null);
            }

            // Show toast notification | Used for main tasks & archived tasks
            showSuccess(`Task "${taskTitle}" deleted successfully`);
        }
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
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Create New Task
                    </h3>

                    <form onSubmit={handleCreateMainTask} className="flex space-x-3">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task title"
                            className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            autoFocus
                        />

                        <button
                            type="submit"
                            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Create
                        </button>

                        <button
                            type="button"
                            onClick={cancelCreate}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Add Task Button */}
            {!showCreateForm && (
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Task
                </button>
            )}

            {/* Tasks List */}
            {parentTasks.length === 0 && archivedTasks.length === 0 ? (
                <div className="text-center py-8">
                    <DocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Get started by creating your first task.
                    </p>
                </div>
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
                                    onDelete={() => handleDeleteTask(task.id)}
                                    onCreateSubtask={handleCreateTask}
                                    onArchive={() => handleArchiveTask(task.id)}
                                    onUnarchive={() => handleUnarchiveTask(task.id)}
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
                                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
                            >
                                {showArchivedTasks ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Tasks ({archivedTasks.length})
                            </button>

                            {showArchivedTasks && (
                                <div className="space-y-2 opacity-75">
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
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onCreateSubtask={handleCreateTask}
                                            onUnarchive={() => handleUnarchiveTask(task.id)}
                                            allTasks={projectTasks}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TaskTree;
