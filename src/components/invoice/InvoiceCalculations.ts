import { millisecondsToHours } from '../../utils/dateUtils';
import { getBillableDurationMs } from '../../utils/timeEntryDurationUtils';
import { getInvoiceEligibleTimeEntries } from '../../domain/invoices/invoiceEligibility';
import type { Invoice, Project, Task, TimeEntry } from '../../stores/yjs/types';

type BuildInvoiceTaskParams = {
    projectForData: Project | null;
    selectedProject: Project | null;
    tasks: Task[];
    timeEntries: TimeEntry[];
    invoices?: Invoice[];
    editableHours: Record<string, number>;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
};

type InvoiceTaskData = {
    id: string;
    projectId: string;
    projectTitle: string;
    projectHourlyRate: number;
    projectFlatRate: boolean;
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
    invoices = [],
    editableHours,
    billingPeriodStart = '',
    billingPeriodEnd = '',
}: BuildInvoiceTaskParams): InvoiceTaskData[] | null => {
    // Use provided project or default to selected project
    const projectToUse = projectForData || selectedProject;
    if (!projectToUse) return null;

    // Keep archived tasks available when they still own unbilled work.
    const projectTasks = tasks.filter(task => task.projectId === projectToUse.id);
    const projectTaskMap = new Map(projectTasks.map(task => [task.id, task]));

    const billableEntries = getInvoiceEligibleTimeEntries({
        tasks: projectTasks,
        timeEntries,
        invoices,
        billingPeriodStart,
        billingPeriodEnd,
    });

    // Get manually marked billable tasks (tasks with billable: true)
    // IMPORTANT: Explicitly check for billable === true to exclude tasks marked as non-billable
    const manuallyBillableTasks = projectTasks.filter(task => task.billable === true && task.archived !== true);

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
        const task = projectTaskMap.get(taskId);
        return {
            id: taskId,
            projectId: projectToUse.id,
            projectTitle: projectToUse.title || 'Unknown Project',
            projectHourlyRate: typeof projectToUse.hourlyRate === 'number' ? projectToUse.hourlyRate : 0,
            projectFlatRate: projectToUse.flatRate === true,
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
        const taskData = projectTaskMap.get(task.id);
        // Only include tasks that have billable explicitly set to true
        // This ensures tasks toggled to non-billable are excluded
        return taskData && taskData.billable === true;
    });

    return tasksData;
};
