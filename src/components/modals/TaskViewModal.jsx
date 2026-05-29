/**
 * TaskViewModal - Preview modal for tasks
 * 
 * Shows task details, due/repeat info, quick actions, and planner attachment controls.
 */

import React, { useMemo, useCallback, useState } from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClockIcon, CurrencyDollarIcon } from '@/components/ui/icons';
import { RedoDot, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useToast } from '@/hooks/useToast';
import { formatRecurringLabel } from '@/utils/recurringUtils';
import { formatDurationWithSeconds, getTodayString, millisecondsToHours, toDisplayDate } from '@/utils/dateUtils';
import { formatCurrency, getProjectCurrency } from '@/utils/currencyUtils';
import { differenceInCalendarDays, endOfDay, parseISO, startOfDay } from 'date-fns';
import TimerControls from '../TimerControls';
import TaskActionsMenu from '../task/TaskActionsMenu';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useTimers } from '@/hooks/useTimers';
import { linkifyNodes } from '@/utils/linkifyUtils';
import AddTimeEntryModal from './AddTimeEntryModal';
import { getTaskEstimateAmount } from '@/utils/projectPlanningUtils.ts';

function formatHoursMetric(value) {
    if (!Number.isFinite(value)) {
        return '0';
    }

    const roundedValue = Math.round(value * 100) / 100;

    return Number.isInteger(roundedValue) ? roundedValue.toString() : roundedValue.toFixed(2);
}

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
    const { clients } = useClients();
    const { tasks, updateTask, unarchiveTask, toggleRecurringCompletion, skipRecurringOccurrence, isCompletedOnDate, getRecurringStatus } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer, isTaskTimerActive } = useTimers();
    const { deleteAttachment } = usePlannerAttachments();

    const [showAddEntryModal, setShowAddEntryModal] = useState(false);
    const [addEntryDateStr, setAddEntryDateStr] = useState(null);

    const currentTask = useMemo(() => {
        if (!task) return null;
        return tasks.find((item) => item.id === task.id) || task;
    }, [tasks, task]);

    const project = useMemo(() => {
        if (!currentTask?.projectId) return null;
        return projects.find((p) => p.id === currentTask.projectId) || null;
    }, [currentTask, projects]);

    const projectClient = useMemo(() => {
        if (!project?.preferredClientId) return null;
        return clients.find((item) => item.id === project.preferredClientId) || null;
    }, [clients, project]);

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

    const isViewingFutureDate = useMemo(() => {
        if (!dateStr || !todayStr) return false;
        return dateStr > todayStr;
    }, [dateStr, todayStr]);

    const dayTimeLabel = useMemo(() => {
        if (!effectiveDateStr) return 'Today';
        if (todayStr && effectiveDateStr === todayStr) return 'Today';
        const currentYear = todayStr ? Number(todayStr.split('-')[0]) : null;
        const effectiveYear = Number(effectiveDateStr.split('-')[0]);
        const includeYear = !currentYear || effectiveYear !== currentYear;
        return toDisplayDate(
            effectiveDateStr,
            includeYear
                ? { month: 'short', day: 'numeric', year: 'numeric' }
                : { month: 'short', day: 'numeric' }
        ) || 'Today';
    }, [effectiveDateStr, todayStr]);

    const recurringActionDateLabel = useMemo(() => {
        if (!effectiveDateStr) return '';
        if (todayStr && effectiveDateStr === todayStr) return '';
        const currentYear = todayStr ? Number(todayStr.split('-')[0]) : null;
        const effectiveYear = Number(effectiveDateStr.split('-')[0]);
        const includeYear = !currentYear || effectiveYear !== currentYear;
        return toDisplayDate(
            effectiveDateStr,
            includeYear
                ? { month: 'short', day: 'numeric', year: 'numeric' }
                : { month: 'short', day: 'numeric' }
        ) || '';
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

    const noteContent = useMemo(() => {
        if (!currentTask?.note) return null;
        return linkifyNodes(currentTask.note, React.createElement, {
            linkAdditionalClassName: 'break-all'
        });
    }, [currentTask?.note]);

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

    const dateTotalWithSubtasks = useMemo(() => {
        if (!currentTask || !dateStr) return 0;
        const allTaskIds = [currentTask.id, ...subtaskIds];

        const [year, month, day] = dateStr.split('-').map(Number);
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
    }, [timeEntries, currentTask, dateStr, subtaskIds]);

    const billableRateInfo = useMemo(() => {
        if (!currentTask || !project) return { rate: 0, currency: null };
        const client = projectClient;

        if (project?.flatRate || client?.flatRate) {
            return { rate: 0, currency: null };
        }

        const rate = project?.hourlyRate
            ?? client?.defaultHourlyRate
            ?? client?.hourlyRate
            ?? 0;

        const currency = project ? getProjectCurrency(project, clients) : null;

        return { rate, currency };
    }, [clients, currentTask, project, projectClient]);

    const billableTimeMs = useMemo(() => {
        if (!currentTask) return 0;
        if (dateStr) return dateTotalWithSubtasks;
        if (currentTask.recurring) return todayTotalWithSubtasks;
        return totalTimeWithSubtasks;
    }, [currentTask, dateStr, dateTotalWithSubtasks, todayTotalWithSubtasks, totalTimeWithSubtasks]);

    const billableTotal = useMemo(() => {
        if (!currentTask?.billable) return 0;
        if (!billableRateInfo.rate || billableRateInfo.rate <= 0) return 0;
        const hours = millisecondsToHours(billableTimeMs);
        const roundedHours = Math.round(hours * 100) / 100;
        return roundedHours * billableRateInfo.rate;
    }, [billableRateInfo.rate, billableTimeMs, currentTask?.billable]);

    const shouldShowBillableTotal = useMemo(() => {
        return !isTimerActive
            && Boolean(billableRateInfo.currency)
            && billableTotal > 0;
    }, [billableRateInfo.currency, billableTotal, isTimerActive]);

    const canToggleBillable = useMemo(() => {
        return Boolean(project && !project.isPersonal && !currentTask?.archived);
    }, [project, currentTask?.archived]);

    const liveTaskTime = useMemo(() => {
        if (!currentTask) return 0;
        const timerTime = isTimerActive ? (projectTimer?.elapsedTime || 0) : 0;
        if (currentTask.recurring && effectiveDateStr) {
            return todayTaskTime + timerTime;
        }
        return mainTaskTime + timerTime;
    }, [currentTask, mainTaskTime, todayTaskTime, isTimerActive, projectTimer, effectiveDateStr]);

    const trackedProgressTimeMs = useMemo(() => {
        return billableTimeMs + (isTimerActive ? (projectTimer?.elapsedTime || 0) : 0);
    }, [billableTimeMs, isTimerActive, projectTimer]);

    const estimateProgress = useMemo(() => {
        const estimatedHours = typeof currentTask?.estimatedHours === 'number' && Number.isFinite(currentTask.estimatedHours) && currentTask.estimatedHours > 0
            ? currentTask.estimatedHours
            : null;
        const quotedAmount = project?.flatRate && typeof currentTask?.estimatedFlatAmount === 'number' && Number.isFinite(currentTask.estimatedFlatAmount) && currentTask.estimatedFlatAmount > 0
            ? currentTask.estimatedFlatAmount
            : null;
        const trackedHours = millisecondsToHours(trackedProgressTimeMs);
        const hoursProgressRatio = estimatedHours && estimatedHours > 0
            ? trackedHours / estimatedHours
            : null;
        const estimatedAmount = currentTask && project
            ? getTaskEstimateAmount(currentTask, project, projectClient)
            : 0;

        return {
            estimatedHours,
            quotedAmount,
            trackedHours,
            hoursProgressRatio,
            estimatedAmount,
        };
    }, [currentTask, project, projectClient, trackedProgressTimeMs]);

    const shouldShowEstimateProgress = Boolean(estimateProgress.estimatedHours || estimateProgress.quotedAmount);
    const estimateCurrency = useMemo(() => {
        if (!project) {
            return null;
        }

        return getProjectCurrency(project, clients);
    }, [clients, project]);

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
            const recurringActionLabel = recurringActionDateLabel
                ? (isCompleted ? `Marked as incomplete for ${recurringActionDateLabel}` : `Done for ${recurringActionDateLabel}`)
                : (isCompleted ? 'Marked as incomplete for today' : 'Done for today');
            showSuccess(recurringActionLabel);
            if (!isCompleted && currentTask.promptTimeEntry) {
                setAddEntryDateStr(effectiveDateStr);
                setShowAddEntryModal(true);
            }
            return;
        }

        updateTask(currentTask.id, {
            completed: !isCompleted,
            completedOnDate: !isCompleted ? effectiveDateStr : null,
            lastActive: Date.now()
        });
        showSuccess(isCompleted ? 'Marked as incomplete' : 'Marked as done');
    }, [currentTask, effectiveDateStr, isCompleted, recurringActionDateLabel, isTimerActive, projectTimer, createEntry, clearTimer, toggleRecurringCompletion, updateTask, showSuccess]);

    const handleSkipRecurring = useCallback(() => {
        if (!currentTask?.recurring || !effectiveDateStr) return;

        skipRecurringOccurrence(currentTask.id, effectiveDateStr);
        showSuccess('Skipped until next recurring date');
        onClose();
    }, [currentTask, effectiveDateStr, skipRecurringOccurrence, showSuccess, onClose]);

    const handleToggleBillable = useCallback(() => {
        if (!currentTask || !project || project.isPersonal || currentTask.archived) return;

        const nextBillable = currentTask.billable !== true;

        updateTask(currentTask.id, {
            billable: nextBillable,
            billableSetByUser: true,
            lastActive: Date.now(),
        });

        showSuccess(`Task marked as ${nextBillable ? 'billable' : 'not billable'}`);
    }, [currentTask, project, updateTask, showSuccess]);

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

    const handleUnarchive = useCallback(async () => {
        if (!currentTask) return;
        await unarchiveTask(currentTask.id);
        showSuccess('Task unarchived');
        onClose();
    }, [currentTask, unarchiveTask, showSuccess, onClose]);

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
        ? (currentTask.recurring
            ? (recurringActionDateLabel ? `Undo ${recurringActionDateLabel}` : 'Undo for today')
            : 'Mark as not done')
        : (currentTask.recurring
            ? (recurringActionDateLabel ? `Done for ${recurringActionDateLabel}` : 'Done for today')
            : 'Mark as done');

    const shouldShowCompleteAction = !currentTask.recurring || isRecurringDueToday || isRecurringOverdue || Boolean(dateStr);
    const shouldShowSkipAction = Boolean(
        currentTask.recurring
        && !isCompleted
        && !isViewingFutureDate
        && !recurringStatus?.isSkipped
        && (isRecurringDueToday || isRecurringOverdue)
    );
    const dueInLabel = nextRecurringDueInDays === null
        ? 'Not due today'
        : `Due in ${nextRecurringDueInDays} ${nextRecurringDueInDays === 1 ? 'day' : 'days'}`;

    const recurringLabel = currentTask.recurring ? formatRecurringLabel(currentTask.recurring) : '';
    const startDateLabel = currentTask.startDate ? toDisplayDate(currentTask.startDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const completedDateValue = !currentTask.recurring && isCompleted
        ? (currentTask.completedOnDate || effectiveDateStr || todayStr)
        : null;
    const completedDateLabel = completedDateValue
        ? toDisplayDate(completedDateValue, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
    const deleteActionLabel = currentTask.parentTaskId ? 'Delete subtask' : 'Delete task';

    const modalFooter = currentTask.archived ? (
        <div data-testid="archived-task-modal-footer" className="flex w-full items-center justify-between gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="status-danger-action h-8 w-8 status-danger-text-strong"
                title={deleteActionLabel}
                aria-label={deleteActionLabel}
            >
                <Trash2 className="h-5 w-5" />
            </Button>
            <Button onClick={handleUnarchive}>
                Unarchive
            </Button>
        </div>
    ) : (
        <div className="flex w-full flex-wrap items-center gap-3">
            {shouldShowCompleteAction ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <Button
                        variant={isCompleted ? 'secondary' : 'default'}
                        onClick={handleToggleComplete}
                    >
                        {completedLabel}
                    </Button>
                    {shouldShowSkipAction && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Skip until next recurring"
                            onClick={handleSkipRecurring}
                        >
                            <RedoDot className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            ) : (
                <div className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
                    {dueInLabel}
                </div>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
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
                {canToggleBillable && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${currentTask.billable ? 'text-foreground bg-muted' : 'text-muted-foreground'} hover:text-foreground hover:bg-accent`}
                        title={currentTask.billable ? 'Mark as not billable' : 'Mark as billable'}
                        aria-label={currentTask.billable ? 'Mark as not billable' : 'Mark as billable'}
                        onClick={handleToggleBillable}
                    >
                        <CurrencyDollarIcon className="h-5 w-5" />
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
                    {currentTask.archived && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">Archived</Badge>
                        </div>
                    )}

                    <div className={`flex flex-wrap items-start gap-4 ${shouldShowBillableTotal ? 'justify-between' : ''}`}>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                <span>
                                    Total: <span className="font-medium text-foreground">{formatDurationWithSeconds(totalTimeWithSubtasks)}</span>
                                </span>
                                {(currentTask.recurring || dateStr) && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span>
                                            {dayTimeLabel}: <span className="font-medium text-foreground">{formatDurationWithSeconds(dateStr ? dateTotalWithSubtasks : todayTotalWithSubtasks)}</span>
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
                                                ? 'status-warning-text status-warning-surface'
                                                : 'status-danger-text status-danger-surface'
                                            }`}
                                        >
                                            {isTimerPaused ? 'Paused' : 'Running'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {shouldShowBillableTotal && (
                            <div className="space-y-1 sm:text-right">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Billable total</p>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground sensitive-data">
                                        {formatCurrency(billableTotal, billableRateInfo.currency)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {shouldShowEstimateProgress && (
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimate progress</p>

                            {estimateProgress.estimatedHours && (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                                        <span>
                                            <span className="font-medium text-foreground">{formatHoursMetric(estimateProgress.trackedHours)}</span>
                                            {' '}of{' '}
                                            <span className="font-medium text-foreground">{formatHoursMetric(estimateProgress.estimatedHours)}</span>
                                            {' '}hours tracked
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                            {Math.round((estimateProgress.hoursProgressRatio || 0) * 100)}%
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-foreground/80"
                                            style={{ width: `${Math.min((estimateProgress.hoursProgressRatio || 0) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {estimateProgress.quotedAmount && estimateCurrency && (
                                <div className="text-sm text-muted-foreground">
                                    Quote amount:{' '}
                                    <span className="font-medium text-foreground sensitive-data">
                                        {formatCurrency(estimateProgress.quotedAmount, estimateCurrency)}
                                    </span>
                                </div>
                            )}

                            {!project?.flatRate && estimateProgress.estimatedAmount > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    Estimated value:{' '}
                                    <span className="font-medium text-foreground sensitive-data">
                                        {formatCurrency(estimateProgress.estimatedAmount, estimateCurrency)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {(project || parentTask) && (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
                            {project && (
                                <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                                    <button
                                        onClick={handleNavigateToProject}
                                        className="status-info-text-strong text-sm font-medium hover:underline cursor-pointer"
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

                    {!currentTask.recurring && isCompleted && completedDateLabel && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                            <p className="text-sm text-foreground">Completed ({completedDateLabel})</p>
                        </div>
                    )}

                    {currentTask.note && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                {noteContent}
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

            <AddTimeEntryModal
                isOpen={showAddEntryModal}
                onClose={() => {
                    setShowAddEntryModal(false);
                    setAddEntryDateStr(null);
                }}
                task={currentTask}
                initialDateStr={addEntryDateStr}
            />

        </>
    );
};

export default TaskViewModal;
