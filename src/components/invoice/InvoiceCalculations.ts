import { millisecondsToHours } from '../../utils/dateUtils';
import { getBillableDurationMs } from '../../utils/timeEntryDurationUtils';

type TaskItem = {
    id: string;
    projectId: string;
    title?: string;
    parentTaskId?: string | null;
    lastBilledAt?: number;
    createdAt?: number;
    billable?: boolean;
};

type TimeEntry = {
    taskId: string;
    start: number;
    end?: number;
    billedDurationMs?: number | null;
    source?: string;
};

type BuildInvoiceTaskParams = {
    projectForData: TaskItem | null;
    selectedProject: TaskItem | null;
    tasks: TaskItem[];
    timeEntries: TimeEntry[];
    editableHours: Record<string, number>;
};

type InvoiceTaskData = {
    id: string;
    title: string;
    parentTaskId: string | null | undefined;
    originalHours: number;
    originalTimeMs: number;
    hours: number;
    isEdited: boolean;
    billable: boolean;
};

/**
 * Build invoice task data for a project.
 * @param {Object} params
 * @param {Object|null} params.projectForData
 * @param {Object|null} params.selectedProject
 * @param {Array} params.tasks
 * @param {Array} params.timeEntries
 * @param {Object} params.editableHours
 * @returns {Array|null}
 */
export const buildInvoiceTaskData = ({
    projectForData,
    selectedProject,
    tasks,
    timeEntries,
    editableHours
}: BuildInvoiceTaskParams): InvoiceTaskData[] | null => {
    // Use provided project or default to selected project
    const projectToUse = projectForData || selectedProject;
    if (!projectToUse) return null;

    // Get all tasks that belong to this project
    const projectTasks = tasks.filter(task => task.projectId === projectToUse.id);
    const projectTaskIds = projectTasks.map(task => task.id);

    // Filter billable entries based on individual task billing dates
    const billableEntries = timeEntries.filter(entry => {
        // Double check that this entry belongs to a task in the current project
        if (!projectTaskIds.includes(entry.taskId)) return false;
        if (!entry.end || entry.end <= entry.start) return false;
        if (entry.source === 'invoice-adjustment') return false;

        // Find the task for this entry
        const task = projectTasks.find(t => t.id === entry.taskId);
        if (!task || task.projectId !== projectToUse.id) return false;

        // Use task-specific lastBilledAt - if never billed, all entries are pending
        const taskLastBilledAt = task.lastBilledAt || 0;

        // Only include entries created after this task's last billing date
        return entry.start > taskLastBilledAt;
    });

    // Get manually marked billable tasks (tasks with billable: true)
    // IMPORTANT: Explicitly check for billable === true to exclude tasks marked as non-billable
    const manuallyBillableTasks = projectTasks.filter(task => task.billable === true);

    // If no billable entries and no manually billable tasks, return null
    if (billableEntries.length === 0 && manuallyBillableTasks.length === 0) {
        return null;
    }

    // Group entries by task
    const taskTimeMap: Record<string, number> = {};

    billableEntries.forEach(entry => {
        if (!taskTimeMap[entry.taskId]) {
            taskTimeMap[entry.taskId] = 0;
        }
        taskTimeMap[entry.taskId] += getBillableDurationMs(entry);
    });

    // Add manually billable tasks to the map (even if they have no time)
    manuallyBillableTasks.forEach(task => {
        if (!taskTimeMap[task.id]) {
            taskTimeMap[task.id] = 0; // 0 time for manually marked tasks
        }
    });

    // Prepare tasks data array
    const tasksData = Object.entries(taskTimeMap).map(([taskId, totalTime]) => {
        const task = tasks.find(t => t.id === taskId);
        return {
            id: taskId,
            title: task ? task.title || 'Unknown Task' : 'Unknown Task',
            parentTaskId: task ? task.parentTaskId : null,
            originalHours: Math.round((millisecondsToHours(totalTime)) * 100) / 100,
            originalTimeMs: totalTime,
            hours: editableHours[taskId] !== undefined ? editableHours[taskId] : (task ? Math.round((millisecondsToHours(totalTime)) * 100) / 100 : 0),
            isEdited: editableHours[taskId] !== undefined && editableHours[taskId] !== (task ? Math.round((millisecondsToHours(totalTime)) * 100) / 100 : 0),
            billable: task ? task.billable === true : false // Explicitly capture the billable status
        };
    }).filter(task => {
        if (!task) return false;
        const taskData = tasks.find(t => t && t.id === task.id && t.projectId === projectToUse.id);
        // Only include tasks that have billable explicitly set to true
        // This ensures tasks toggled to non-billable are excluded
        return taskData && taskData.billable === true;
    });

    return tasksData;
};
