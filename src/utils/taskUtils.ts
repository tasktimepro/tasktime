/**
 * Task utility functions for handling task operations
 */

type Task = {
    id: string;
    projectId?: string | null;
    title?: string;
    parentTaskId?: string | null;
    billable?: boolean;
    createdAt?: number;
    lastBilledAt?: number | null;
};

type TimeEntry = {
    taskId: string;
    start: number;
    end?: number;
    source?: string;
    billedAt?: number | null;
    billedInvoiceId?: string | null;
    billedHourlyRate?: number | null;
};

type Project = {
    id: string;
    isPersonal?: boolean;
};

type TaskDeletionBillingSummary = {
    hasUnbilledTime: boolean;
    unbilledEntryCount: number;
    unbilledTimeMs: number;
    hasBilledTime: boolean;
    billedEntryCount: number;
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

/**
 * Summarize billed and unbilled time that would be removed by deleting tasks.
 * @param {Array} taskIds - Task IDs that will be deleted
 * @param {Array} allTasks - All tasks available in the current scope
 * @param {Array} timeEntries - All time entries available in the current scope
 * @returns {Object} Summary of billed and unbilled time state
 */
export const getTaskDeletionBillingSummary = (
    taskIds: string[],
    allTasks: Task[],
    timeEntries: TimeEntry[],
    projects: Project[] = []
): TaskDeletionBillingSummary => {
    if (taskIds.length === 0) {
        return {
            hasUnbilledTime: false,
            unbilledEntryCount: 0,
            unbilledTimeMs: 0,
            hasBilledTime: false,
            billedEntryCount: 0
        };
    }

    const taskIdSet = new Set(taskIds);
    const taskMap = new Map(
        allTasks
            .filter((task) => taskIdSet.has(task.id))
            .map((task) => [task.id, task])
    );
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    let unbilledEntryCount = 0;
    let unbilledTimeMs = 0;
    let billedEntryCount = 0;

    timeEntries.forEach((entry) => {
        const task = taskMap.get(entry.taskId);
        if (!task) return;
        if (typeof entry.end !== 'number' || entry.end <= entry.start) return;

        const project = task.projectId ? projectMap.get(task.projectId) : null;

        const billingCutoff = task.lastBilledAt || task.createdAt || 0;
        const isExplicitlyBilled = Boolean(
            entry.billedInvoiceId || entry.billedAt || entry.billedHourlyRate
        );
        const isBeforeOrAtBillingCutoff = Boolean(task.lastBilledAt) && entry.start <= billingCutoff;

        if (isExplicitlyBilled || isBeforeOrAtBillingCutoff) {
            billedEntryCount += 1;
        }

        if (
            task.billable === true
            && Boolean(project)
            && project?.isPersonal !== true
            && entry.source !== 'invoice-adjustment'
            && entry.start > billingCutoff
        ) {
            unbilledEntryCount += 1;
            unbilledTimeMs += (entry.end - entry.start);
        }
    });

    return {
        hasUnbilledTime: unbilledEntryCount > 0,
        unbilledEntryCount,
        unbilledTimeMs,
        hasBilledTime: billedEntryCount > 0,
        billedEntryCount
    };
};
