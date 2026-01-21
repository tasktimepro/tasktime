/**
 * Task utility functions for handling task operations
 */

type Task = {
    id: string;
    title?: string;
    parentTaskId?: string | null;
};

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
