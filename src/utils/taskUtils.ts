/**
 * Task utility functions for handling task operations
 */

type Task = {
    id: string;
    title?: string;
    parentTaskId?: string | null;
};

type TimeEntry = {
    taskId: string;
};

type TimerState = {
    taskId: string;
} | null;

/**
 * Get all task IDs that should be deleted when a main task is deleted
 * This includes the main task and all its direct subtasks
 * @param {string} taskId - The ID of the main task to delete
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Array of task IDs to delete
 */
export const getTaskIdsToDelete = (taskId: string, allTasks: Task[]): string[] => {
    // Find all direct subtasks of this task
    const subtaskIds = allTasks
        .filter(task => task.parentTaskId === taskId)
        .map(task => task.id);

    // Return the main task ID plus all subtask IDs
    return [taskId, ...subtaskIds];
};

/**
 * Recursively delete a task and all its related data
 * This function handles:
 * - Main tasks: deletes the task + all subtasks + all related time entries
 * - Subtasks: deletes only the subtask + its time entries (no recursive deletion needed)
 * 
 * @param {string} taskId - The ID of the task to delete
 * @param {Array} allTasks - Array of all tasks
 * @param {Array} timeEntries - Array of all time entries
 * @param {Object} currentTimer - Current active timer (if any)
 * @param {Function} setTasks - Function to update tasks state
 * @param {Function} setTimeEntries - Function to update time entries state
 * @param {Function} setCurrentTimer - Function to update current timer state
 * @returns {Object} Object containing the deleted task title and count of deleted items
 */
export const deleteTaskWithCleanup = (
    taskId: string,
    allTasks: Task[],
    timeEntries: TimeEntry[],
    currentTimer: TimerState,
    setTasks: (tasks: Task[]) => void,
    setTimeEntries: (entries: TimeEntry[]) => void,
    setCurrentTimer: (timer: TimerState) => void
): { taskTitle: string; deletedCount: number; isMainTask: boolean } => {
    // Find the task to get its title for feedback
    const taskToDelete = allTasks.find(t => t.id === taskId);
    const taskTitle = taskToDelete ? taskToDelete.title || 'Task' : 'Task';

    // Check if this is a main task (no parentTaskId) or a subtask
    const isMainTask = !!(taskToDelete && !taskToDelete.parentTaskId);

    let taskIdsToDelete: string[];

    if (isMainTask) {
        // For main tasks, get all subtasks too
        taskIdsToDelete = getTaskIdsToDelete(taskId, allTasks);
    } else {
        // For subtasks, only delete the subtask itself
        taskIdsToDelete = [taskId];
    }

    // Remove tasks
    const updatedTasks = allTasks.filter(task => !taskIdsToDelete.includes(task.id));
    setTasks(updatedTasks);

    // Remove time entries for these tasks
    const updatedTimeEntries = timeEntries.filter(entry => !taskIdsToDelete.includes(entry.taskId));
    setTimeEntries(updatedTimeEntries);

    // Clear current timer if it's for one of these tasks
    if (currentTimer && taskIdsToDelete.includes(currentTimer.taskId)) {
        setCurrentTimer(null);
    }

    return {
        taskTitle,
        deletedCount: taskIdsToDelete.length,
        isMainTask
    };
};

/**
 * Check if a task has any subtasks
 * @param {string} taskId - The ID of the task to check
 * @param {Array} allTasks - Array of all tasks
 * @returns {boolean} True if the task has subtasks
 */
export const hasSubtasks = (taskId: string, allTasks: Task[]): boolean => {
    return allTasks.some(task => task.parentTaskId === taskId);
};

/**
 * Get all subtasks for a given task
 * @param {string} taskId - The ID of the parent task
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Array of subtasks
 */
export const getSubtasks = (taskId: string, allTasks: Task[]): Task[] => {
    return allTasks.filter(task => task.parentTaskId === taskId);
};
