import { useState } from 'react';
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import TaskItem from './TaskItem';
import { generateId } from '../utils/idUtils';

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
    const [creatingSubtaskFor, setCreatingSubtaskFor] = useState(null);
    const [showArchivedTasks, setShowArchivedTasks] = useState(false);

    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get parent tasks (tasks without parentTaskId) that are not archived
    const parentTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived);

    // Get archived parent tasks
    const archivedTasks = projectTasks.filter(task => !task.parentTaskId && task.archived);

    /**
     * Create a new task
     */
    const handleCreateTask = (e) => {
        e.preventDefault();

        if (!newTaskTitle.trim()) return;

        const newTask = {
            id: generateId(),
            projectId: project.id,
            parentTaskId: creatingSubtaskFor,
            title: newTaskTitle.trim(),
            createdAt: Date.now()
        };

        setTasks([...tasks, newTask]);

        setNewTaskTitle('');

        setShowCreateForm(false);

        setCreatingSubtaskFor(null);
    };

    /**
     * Archive a task
     */
    const handleArchiveTask = (taskId) => {
        if (window.confirm('Are you sure you want to archive this task? It will be moved to the archived section.')) {
            const updatedTasks = tasks.map(task =>
                task.id === taskId ? { ...task, archived: true } : task
            );
            setTasks(updatedTasks);
        }
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
        }
    };

    /**
     * Start creating a subtask for a parent task
     */
    const startCreatingSubtask = (parentTaskId) => {
        setCreatingSubtaskFor(parentTaskId);

        setShowCreateForm(true);

        setNewTaskTitle('');
    };

    /**
     * Cancel task creation
     */
    const cancelCreate = () => {
        setShowCreateForm(false);

        setCreatingSubtaskFor(null);

        setNewTaskTitle('');
    };

    return (
        <div className="space-y-4">
            {/* Create Task Form */}
            {showCreateForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                        {creatingSubtaskFor ? 'Create Subtask' : 'Create New Task'}
                    </h3>

                    <form onSubmit={handleCreateTask} className="flex space-x-3">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task title"
                            className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    <div className="mx-auto h-12 w-12 text-gray-400">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                    </div>

                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks</h3>

                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first task.</p>
                </div>
            ) : (
                <>
                    {/* Active Tasks */}
                    {parentTasks.length > 0 && (
                        <div className="space-y-2">
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
                                    onCreateSubtask={() => startCreatingSubtask(task.id)}
                                    onArchive={() => handleArchiveTask(task.id)}
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
                                        <div key={task.id} className="relative">
                                            <TaskItem
                                                task={task}
                                                tasks={tasks}
                                                setTasks={setTasks}
                                                timeEntries={timeEntries}
                                                setTimeEntries={setTimeEntries}
                                                currentTimer={currentTimer}
                                                setCurrentTimer={setCurrentTimer}
                                                onDelete={() => handleDeleteTask(task.id)}
                                                onCreateSubtask={() => startCreatingSubtask(task.id)}
                                                allTasks={projectTasks}
                                            />
                                            
                                            {/* Unarchive Button */}
                                            <button
                                                onClick={() => handleUnarchiveTask(task.id)}
                                                className="absolute top-2 right-2 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                                                title="Unarchive Task"
                                            >
                                                Unarchive
                                            </button>
                                        </div>
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
