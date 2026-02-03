/**
 * TaskViewModal - Preview modal for tasks
 * 
 * Shows task details, due/repeat info, quick actions, and planner attachment controls.
 */

import { useMemo, useCallback } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { ClockIcon } from '@/components/ui/icons';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useToast } from '@/hooks/useToast';
import { formatRecurringLabel } from '@/utils/recurringUtils';
import { formatDurationWithSeconds, getTodayString, toDisplayDate } from '@/utils/dateUtils';
import { differenceInCalendarDays, endOfDay, parseISO, startOfDay } from 'date-fns';
import TimerControls from '../TimerControls';
import TaskActionsMenu from '../task/TaskActionsMenu';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useTimers } from '@/hooks/useTimers';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.task
 * @param {string|null} props.dateStr
 * @param {Object|null} props.attachment
 * @param {Function} props.onEdit
 * @param {Function} props.onDelete
 * @param {Function} props.onArchive
 * @param {(projectId: string) => void} props.onNavigateToProject
 * @param {(task: Object, dateStr: string | null, attachment: Object | null) => void} props.onOpenTimeEntries
 * @param {(task: Object, dateStr: string | null, attachment: Object | null) => void} props.onOpenPlannerOptions
 */
const TaskViewModal = ({
    isOpen,
    onClose,
    task,
    dateStr = null,
    attachment = null,
    onEdit,
    onDelete,
    onArchive,
    onNavigateToProject,
    onOpenTimeEntries,
    onOpenPlannerOptions
}) => {
    const { showSuccess } = useToast();
    const { projects } = useProjects();
    const { tasks, updateTask, toggleRecurringCompletion, isCompletedOnDate, getRecurringStatus } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer, isTaskTimerActive } = useTimers();
    const { deleteAttachment } = usePlannerAttachments();

    const currentTask = useMemo(() => {
        if (!task) return null;
        return tasks.find((item) => item.id === task.id) || task;
    }, [tasks, task]);

    const project = useMemo(() => {
        if (!currentTask?.projectId) return null;
        return projects.find((p) => p.id === currentTask.projectId) || null;
    }, [currentTask, projects]);

    const parentTask = useMemo(() => {
        if (!currentTask?.parentTaskId) return null;
        return tasks.find((item) => item.id === currentTask.parentTaskId) || null;
    }, [currentTask, tasks]);

    const todayStr = useMemo(() => getTodayString(), []);

    const recurringStatus = useMemo(() => {
        if (!currentTask?.recurring) return null;
        return getRecurringStatus(currentTask, todayStr || undefined);
    }, [currentTask, getRecurringStatus, todayStr]);

    const effectiveDateStr = useMemo(() => {
        if (dateStr) return dateStr;
        if (recurringStatus?.effectiveDateStr) return recurringStatus.effectiveDateStr;
        return todayStr || null;
    }, [dateStr, recurringStatus, todayStr]);

    const dayTimeLabel = useMemo(() => {
        if (!effectiveDateStr) return 'Today';
        if (todayStr && effectiveDateStr === todayStr) return 'Today';
        return toDisplayDate(effectiveDateStr, { month: 'short', day: 'numeric', year: 'numeric' }) || 'Today';
    }, [effectiveDateStr, todayStr]);

    const isCompleted = useMemo(() => {
        if (!currentTask) return false;
        if (currentTask.recurring && effectiveDateStr) {
            return isCompletedOnDate(currentTask, effectiveDateStr);
        }
        return currentTask.completed || false;
    }, [currentTask, effectiveDateStr, isCompletedOnDate]);

    const isRecurringDueToday = useMemo(() => {
        return Boolean(recurringStatus?.isDueToday);
    }, [recurringStatus]);

    const isRecurringOverdue = useMemo(() => {
        return Boolean(recurringStatus?.isOverdue);
    }, [recurringStatus]);

    const nextRecurringDueInDays = useMemo(() => {
        if (!currentTask?.recurring) return null;
        if (isRecurringDueToday) return 0;
        if (!recurringStatus?.nextDueDateStr || !todayStr) return null;

        return differenceInCalendarDays(
            parseISO(recurringStatus.nextDueDateStr),
            parseISO(todayStr)
        );
    }, [currentTask, isRecurringDueToday, recurringStatus, todayStr]);

    const subtasks = useMemo(() => {
        if (!currentTask) return [];
        return tasks.filter((item) => item.parentTaskId === currentTask.id);
    }, [tasks, currentTask]);

    const subtaskIds = useMemo(() => subtasks.map((item) => item.id), [subtasks]);

    const projectTimer = useMemo(() => {
        if (!currentTask) return null;
        return getTimerForTask(currentTask.id, currentTask.projectId);
    }, [currentTask, getTimerForTask]);

    const isTimerActive = useMemo(() => {
        if (!currentTask) return false;
        return isTaskTimerActive(currentTask.id);
    }, [currentTask, isTaskTimerActive]);

    const isTimerPaused = useMemo(() => {
        if (!isTimerActive || !projectTimer) return false;
        return projectTimer.taskId === currentTask?.id && Boolean(projectTimer.isPaused);
    }, [isTimerActive, projectTimer, currentTask]);

    const mainTaskTime = useMemo(() => {
        if (!currentTask) return 0;
        return timeEntries
            .filter((entry) => entry.taskId === currentTask.id && typeof entry.end === 'number')
            .reduce((sum, entry) => sum + (entry.end - entry.start), 0);
    }, [timeEntries, currentTask]);

    const todayTaskTime = useMemo(() => {
        if (!currentTask || !currentTask.recurring || !effectiveDateStr) return 0;

        const [year, month, day] = effectiveDateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayStart = startOfDay(date).getTime();
        const dayEnd = endOfDay(date).getTime();

        return timeEntries
            .filter((entry) => entry.taskId === currentTask.id)
            .reduce((sum, entry) => {
                if (!entry || typeof entry.end !== 'number') return sum;
                if (entry.end <= entry.start) return sum;
                const overlapStart = Math.max(entry.start, dayStart);
                const overlapEnd = Math.min(entry.end, dayEnd);
                if (overlapEnd <= overlapStart) return sum;
                return sum + (overlapEnd - overlapStart);
            }, 0);
    }, [timeEntries, currentTask, effectiveDateStr]);

    const totalTimeWithSubtasks = useMemo(() => {
        if (!currentTask) return 0;
        const allTaskIds = [currentTask.id, ...subtaskIds];
        return timeEntries
            .filter((entry) => allTaskIds.includes(entry.taskId) && typeof entry.end === 'number')
            .reduce((sum, entry) => sum + (entry.end - entry.start), 0);
    }, [timeEntries, currentTask, subtaskIds]);

    const todayTotalWithSubtasks = useMemo(() => {
        if (!currentTask || !currentTask.recurring || !effectiveDateStr) return 0;
        const allTaskIds = [currentTask.id, ...subtaskIds];

        const [year, month, day] = effectiveDateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayStart = startOfDay(date).getTime();
        const dayEnd = endOfDay(date).getTime();

        return timeEntries
            .filter((entry) => allTaskIds.includes(entry.taskId))
            .reduce((sum, entry) => {
                if (!entry || typeof entry.end !== 'number') return sum;
                if (entry.end <= entry.start) return sum;
                const overlapStart = Math.max(entry.start, dayStart);
                const overlapEnd = Math.min(entry.end, dayEnd);
                if (overlapEnd <= overlapStart) return sum;
                return sum + (overlapEnd - overlapStart);
            }, 0);
    }, [timeEntries, currentTask, subtaskIds, effectiveDateStr]);

    const liveTaskTime = useMemo(() => {
        if (!currentTask) return 0;
        const timerTime = isTimerActive ? (projectTimer?.elapsedTime || 0) : 0;
        if (currentTask.recurring && effectiveDateStr) {
            return todayTaskTime + timerTime;
        }
        return mainTaskTime + timerTime;
    }, [currentTask, mainTaskTime, todayTaskTime, isTimerActive, projectTimer, effectiveDateStr]);

    const handleToggleComplete = useCallback(() => {
        if (!currentTask) return;

        if (isTimerActive && projectTimer?.startTime) {
            const now = Date.now();
            createEntry({
                taskId: currentTask.id,
                start: projectTimer.startTime,
                end: now,
                note: projectTimer.note
            });
            clearTimer(currentTask.projectId || currentTask.id);
        }

        if (currentTask.recurring && effectiveDateStr) {
            toggleRecurringCompletion(currentTask.id, effectiveDateStr);
            showSuccess(isCompleted ? 'Marked as incomplete for today' : 'Done for today');
            return;
        }

        updateTask(currentTask.id, {
            completed: !isCompleted,
            completedOnDate: !isCompleted ? effectiveDateStr : null,
            lastActive: Date.now()
        });
        showSuccess(isCompleted ? 'Marked as incomplete' : 'Marked as done');
    }, [currentTask, effectiveDateStr, isCompleted, isTimerActive, projectTimer, createEntry, clearTimer, toggleRecurringCompletion, updateTask, showSuccess]);

    const handleOpenTimeEntries = useCallback(() => {
        if (!currentTask) return;
        onOpenTimeEntries?.(currentTask, effectiveDateStr, attachment || null);
    }, [currentTask, effectiveDateStr, attachment, onOpenTimeEntries]);

    const handleEdit = useCallback(() => {
        if (!currentTask) return;
        onClose();
        onEdit?.(currentTask);
    }, [currentTask, onClose, onEdit]);

    const handleDelete = useCallback(() => {
        if (!currentTask) return;
        onClose();
        onDelete?.(currentTask);
    }, [currentTask, onClose, onDelete]);

    const handleArchive = useCallback(() => {
        if (!currentTask) return;
        onClose();
        onArchive?.(currentTask);
    }, [currentTask, onClose, onArchive]);

    const handleRemoveFromPlanner = useCallback(() => {
        if (!attachment) return;
        deleteAttachment(attachment.id);
        showSuccess('Removed from planner');
        onClose();
    }, [attachment, deleteAttachment, showSuccess, onClose]);

    const handleOpenPlannerOptions = useCallback(() => {
        if (!currentTask || !attachment) return;
        onOpenPlannerOptions?.(currentTask, effectiveDateStr, attachment);
    }, [currentTask, effectiveDateStr, attachment, onOpenPlannerOptions]);

    const handleNavigateToProject = useCallback(() => {
        if (!project) return;
        onClose();
        onNavigateToProject?.(project.id);
    }, [project, onClose, onNavigateToProject]);

    const handleTimerStarted = useCallback(() => {
        onClose();
    }, [onClose]);

    if (!currentTask) return null;

    const completedLabel = isCompleted
        ? (currentTask.recurring ? 'Undo for today' : 'Mark as not done')
        : (currentTask.recurring ? 'Done for today' : 'Mark as done');

    const shouldShowCompleteAction = !currentTask.recurring || isRecurringDueToday || isRecurringOverdue || Boolean(dateStr);
    const dueInLabel = nextRecurringDueInDays === null
        ? 'Not due today'
        : `Due in ${nextRecurringDueInDays} ${nextRecurringDueInDays === 1 ? 'day' : 'days'}`;

    const recurringLabel = currentTask.recurring ? formatRecurringLabel(currentTask.recurring) : '';
    const startDateLabel = currentTask.startDate ? toDisplayDate(currentTask.startDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    const modalFooter = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
            {shouldShowCompleteAction ? (
                <Button
                    variant={isCompleted ? 'secondary' : 'default'}
                    onClick={handleToggleComplete}
                >
                    {completedLabel}
                </Button>
            ) : (
                <div className="text-sm font-medium text-muted-foreground">
                    {dueInLabel}
                </div>
            )}
            <div className="flex items-center gap-2">
                <TimerControls
                    task={currentTask}
                    size="sm"
                    isGlobalTimer={true}
                    onStart={handleTimerStarted}
                />
                {!isTimerActive && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Add time entry"
                        onClick={handleOpenTimeEntries}
                    >
                        <ClockIcon className="h-5 w-5" />
                    </Button>
                )}
                <TaskActionsMenu
                    task={currentTask}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                />
            </div>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={currentTask.title}
                footer={modalFooter}
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                <span>
                                    Total: <span className="font-medium text-foreground">{formatDurationWithSeconds(totalTimeWithSubtasks)}</span>
                                </span>
                                {currentTask.recurring && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span>
                                            {dayTimeLabel}: <span className="font-medium text-foreground">{formatDurationWithSeconds(todayTotalWithSubtasks)}</span>
                                        </span>
                                    </>
                                )}
                                {isTimerActive && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span>
                                            Live: <span className="font-medium text-foreground">{formatDurationWithSeconds(liveTaskTime)}</span>
                                        </span>
                                        <span
                                            className={`text-xs font-mono px-2 py-1 rounded-md ${isTimerPaused
                                                ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900'
                                                : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900'
                                            }`}
                                        >
                                            {isTimerPaused ? 'Paused' : 'Running'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                    </div>

                    {(project || parentTask) && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {project && (
                                <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                                    <button
                                        onClick={handleNavigateToProject}
                                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                    >
                                        {project.title}
                                    </button>
                                </div>
                            )}
                            {parentTask && (
                                <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Subtask of</p>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">{parentTask.title}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {(currentTask.startDate || currentTask.recurring) && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Schedule</p>
                            <div className="text-sm text-foreground space-y-1">
                                {currentTask.startDate && !currentTask.recurring && (
                                    <p>Start date: {startDateLabel}</p>
                                )}
                                {currentTask.recurring && (
                                    <p>Repeats: {recurringLabel}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {currentTask.note && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                                {currentTask.note}
                            </p>
                        </div>
                    )}

                    {attachment && (
                        <div className="pt-2">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={handleOpenPlannerOptions}
                                    leadingIcon={SlidersHorizontal}
                                >
                                    Edit planner options
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleRemoveFromPlanner}
                                    leadingIcon={Trash2}
                                >
                                    Remove from planner
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

        </>
    );
};

export default TaskViewModal;
