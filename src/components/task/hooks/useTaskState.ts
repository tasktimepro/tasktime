import { useEffect, useMemo } from 'react';
import { BILLABLE_TIME_THRESHOLD_MS } from '../../../constants/app';
import { useTasks } from '../../../hooks/useTasks';
import { useTimer } from '../../../hooks/useTimer';

type TaskItem = {
    id: string;
    completed?: boolean;
    archived?: boolean;
    billable?: boolean;
    billableSetByUser?: boolean;
    lastBilledAt?: number;
    createdAt?: number;
};

type TimeEntry = {
    taskId: string;
    start: number;
    end?: number;
};

type UseTaskStateParams = {
    task: TaskItem;
    timeEntries: TimeEntry[];
    subtasks?: TaskItem[];
};

/**
 * useTaskState hook - derives task timing and status state.
 * @param {Object} params
 * @returns {Object}
 */
const useTaskState = ({
    task,
    timeEntries,
    subtasks = []
}: UseTaskStateParams) => {
    const { updateTask } = useTasks();
    const { isActive: anyTimerActive, taskId: timerTaskId, isPaused } = useTimer();
    
    const taskTimeEntries = useMemo(() => {
        return timeEntries.filter(entry => entry.taskId === task.id);
    }, [timeEntries, task.id]);

    const subtaskIds = useMemo(() => {
        return subtasks.map(subtask => subtask.id);
    }, [subtasks]);

    const subtaskTimeEntries = useMemo(() => {
        if (subtaskIds.length === 0) return [] as TimeEntry[];
        return timeEntries.filter(entry => subtaskIds.includes(entry.taskId));
    }, [timeEntries, subtaskIds]);

    const taskTime = useMemo(() => {
        return taskTimeEntries.reduce((total, entry) => {
            if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' &&
                !isNaN(entry.start) && !isNaN(entry.end)) {
                return total + (entry.end - entry.start);
            }
            return total;
        }, 0);
    }, [taskTimeEntries]);

    const subtaskTime = useMemo(() => {
        return subtaskTimeEntries.reduce((total, entry) => {
            if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' &&
                !isNaN(entry.start) && !isNaN(entry.end)) {
                return total + (entry.end - entry.start);
            }
            return total;
        }, 0);
    }, [subtaskTimeEntries]);

    const totalTime = taskTime + subtaskTime;
    const mainTaskTime = taskTime;
    const totalTimeWithSubtasks = totalTime;

    const isTimerActive = anyTimerActive && timerTaskId === task.id;
    const subtaskTimerActive = subtasks.some(subtask =>
        anyTimerActive && timerTaskId === subtask.id
    );

    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;

    const isRelatedToActiveTimer = !!(isTimerActive || subtaskTimerActive);
    const shouldDimTask = anyTimerActive && !isPaused && !isRelatedToActiveTimer && !isArchived;

    const hasSignificantBillableTime = useMemo(() => {
        const taskBillableEntries = taskTimeEntries.filter(entry => {
            if (!entry.end || entry.end <= entry.start) return false;
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            return entry.start > taskLastBilledAt;
        });

        const totalBillableTime = taskBillableEntries.reduce((total, entry) => {
            return total + ((entry.end as number) - entry.start);
        }, 0);

        return totalBillableTime >= BILLABLE_TIME_THRESHOLD_MS;
    }, [taskTimeEntries, task.lastBilledAt, task.createdAt]);

    useEffect(() => {
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            updateTask(task.id, { billable: true, lastActive: Date.now() });
        }
    }, [hasSignificantBillableTime, task.billable, task.billableSetByUser, task.id, updateTask]);

    return {
        taskTimeEntries,
        subtaskTimeEntries,
        mainTaskTime,
        totalTimeWithSubtasks,
        isTimerActive,
        anyTimerActive,
        subtaskTimerActive,
        isCompleted,
        isArchived,
        isRelatedToActiveTimer,
        shouldDimTask
    };
};

export default useTaskState;
