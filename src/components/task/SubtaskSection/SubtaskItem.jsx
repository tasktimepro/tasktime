import React, { useState, useCallback, useMemo, useEffect } from 'react';
import TimeEntriesModal from '../../TimeEntriesModal';
import TaskHeader from '../TaskHeader';
import TaskActions from '../TaskActions';
import StartDateBadge from '../StartDateBadge';
import { BILLABLE_TIME_THRESHOLD_MS } from '../../../constants/app';
import { formatDurationWithSeconds, getTodayString } from '../../../utils/dateUtils.ts';
import { useTasks } from '../../../hooks/useTasks';
import { useTimeEntries } from '../../../hooks/useTimeEntries';
import { useTimers } from '../../../hooks/useTimers';
import { useProjects } from '../../../hooks/useProjects';
import useIsMobileLayout from '../../../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { buildBillableDurationFields, getBillableDurationMs } from '../../../utils/timeEntryDurationUtils.ts';

/**
 * SubtaskItem component - Displays individual subtask.
 * Uses Yjs hooks directly for state management.
 * @param {Object} props
 */
const SubtaskItem = ({
    task,
    onToggleBillable,
    onArchive,
    onUnarchive,
    onDelete,
    onEditTask,
    onViewTask,
    dragHandle = null,
    dragActivatorRef = null,
    dragAttributes = {},
    dragListeners = {},
    isDragging = false,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    // Yjs hooks for state
    const { updateTask } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer } = useTimers();
    const { projects } = useProjects();

    // Compute state
    const timerKey = task.projectId || task.id;
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isAnyTimerActive = !!projectTimer;
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;
    
    // For subtasks, isRelatedToActiveTimer is just whether this subtask has the timer
    const isRelatedToActiveTimer = isTimerActive;
    
    // Should dim if another task has active timer
    const shouldDimTask = isAnyTimerActive && !projectTimer?.isPaused && !isRelatedToActiveTimer;

    const currentProject = useMemo(() => {
        if (!task.projectId) {
            return null;
        }

        return projects.find((project) => project.id === task.projectId) || null;
    }, [projects, task.projectId]);

    // Calculate time for this subtask
    const mainTaskTime = useMemo(() => {
        return timeEntries
            .filter(e => e.taskId === task.id)
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id]);

    const liveTaskTime = useMemo(() => {
        const timerTime = isTimerActive ? (projectTimer?.elapsedTime || 0) : 0;
        return mainTaskTime + timerTime;
    }, [mainTaskTime, isTimerActive, projectTimer]);

    // Auto-mark billable when significant time logged (post last billed) and user hasn't set it
    const hasSignificantBillableTime = useMemo(() => {
        const cutoff = task.lastBilledAt || task.createdAt || 0;
        const relevantEntries = timeEntries.filter((entry) => {
            if (!entry || typeof entry.end !== 'number') return false;
            if (entry.end <= entry.start) return false;
            if (entry.source === 'invoice-adjustment') return false;
            return entry.taskId === task.id && entry.start > cutoff;
        });

        const totalBillableMs = relevantEntries.reduce((total, entry) => {
            return total + getBillableDurationMs(entry);
        }, 0);

        return totalBillableMs >= BILLABLE_TIME_THRESHOLD_MS;
    }, [timeEntries, task.id, task.lastBilledAt, task.createdAt]);

    useEffect(() => {
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            updateTask(task.id, { billable: true, lastActive: Date.now() });
        }
    }, [hasSignificantBillableTime, task.billableSetByUser, task.billable, task.id, updateTask]);

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = useCallback((checked) => {
        if (task.recurring) {
            return;
        }
        const now = Date.now();

        // If timer is active for this task, stop it and create entry
        if (isTimerActive && projectTimer?.startTime) {
            createEntry({
                taskId: task.id,
                start: projectTimer.startTime,
                end: now,
                note: projectTimer.note,
                _stoppedTimerKey: timerKey,
                _stoppedTimerInstanceId: projectTimer.timerInstanceId,
                ...buildBillableDurationFields({
                    start: projectTimer.startTime,
                    end: now,
                    billingIncrementMinutes: currentProject?.billableTimeIncrementMinutes,
                }),
            });
            clearTimer(timerKey);
        }

        const todayStr = getTodayString();
        updateTask(task.id, {
            completed: checked,
            completedOnDate: checked ? todayStr : null,
            lastActive: now
        });
    }, [isTimerActive, projectTimer, task.id, task.recurring, createEntry, clearTimer, updateTask, timerKey, currentProject]);

    /**
     * Update subtask title
     */
    const handleUpdateTitle = useCallback((e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        updateTask(task.id, { title: editTitle.trim(), lastActive: Date.now() });
        setIsEditing(false);
    }, [editTitle, task.id, updateTask]);

    /**
     * Cancel editing
     */
    const cancelEdit = useCallback(() => {
        setEditTitle(task.title);
        setIsEditing(false);
    }, [task.title]);

    const handleEditTask = useCallback(() => {
        if (onEditTask) {
            onEditTask(task);
            return;
        }
        setIsEditing(true);
    }, [onEditTask, task]);

    const handleViewTask = useCallback(() => {
        if (!onViewTask) return;
        onViewTask(task, { dateStr: null });
    }, [onViewTask, task]);

    const resolvedDragHandle = dragHandle ? (
        <span
            ref={dragActivatorRef}
            className="inline-flex cursor-grab active:cursor-grabbing"
            {...dragAttributes}
            {...dragListeners}
        >
            {dragHandle}
        </span>
    ) : null;

    return (
        <div className={`rounded-md px-2 py-2 transition-colors hover:bg-muted ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''} ${isDragging ? 'shadow-sm' : ''}`}>
            {isMobileLayout ? (
                <div>
                    <TaskHeader
                        task={task}
                        isEditing={isEditing}
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        isCompleted={isCompleted}
                        isArchived={isArchived}
                        onToggleComplete={handleToggleComplete}
                        onSaveTitle={handleUpdateTitle}
                        onCancelEdit={cancelEdit}
                        onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                        mainTaskTime={mainTaskTime}
                        totalTimeWithSubtasks={mainTaskTime}
                        isSubtask={true}
                        showTimeDisplay={false}
                        onTitleClick={handleViewTask}
                        leadingAccessory={resolvedDragHandle}
                    />

                    <div className="mt-1.5 flex w-full flex-wrap items-center justify-end gap-2" data-testid={`subtask-item-secondary-${task.id}`}>
                        {(task.startDate || task.recurring) && (
                            <StartDateBadge
                                startDate={task.startDate}
                                recurring={task.recurring}
                                completed={isCompleted}
                            />
                        )}

                        {liveTaskTime > 0 && (
                            <div className="flex-shrink-0 text-xs text-muted-foreground">
                                {formatDurationWithSeconds(liveTaskTime)}
                            </div>
                        )}

                        <TaskActions
                            task={task}
                            isEditing={isEditing}
                            isTimerActive={isTimerActive}
                            anyTimerActive={isAnyTimerActive}
                            isArchived={isArchived}
                            isCompleted={isCompleted}
                            isRelatedToActiveTimer={isRelatedToActiveTimer}
                            onArchive={onArchive}
                            onUnarchive={onUnarchive}
                            onDelete={onDelete}
                            onToggleBillable={onToggleBillable}
                            onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                            onEdit={handleEditTask}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3">
                    <TaskHeader
                        task={task}
                        isEditing={isEditing}
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        isCompleted={isCompleted}
                        isArchived={isArchived}
                        onToggleComplete={handleToggleComplete}
                        onSaveTitle={handleUpdateTitle}
                        onCancelEdit={cancelEdit}
                        onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                        mainTaskTime={mainTaskTime}
                        totalTimeWithSubtasks={mainTaskTime}
                        isSubtask={true}
                        showTimeDisplay={false}
                        onTitleClick={handleViewTask}
                        leadingAccessory={resolvedDragHandle}
                    />

                    {(task.startDate || task.recurring) && (
                        <StartDateBadge
                            startDate={task.startDate}
                            recurring={task.recurring}
                            completed={isCompleted}
                        />
                    )}

                    {liveTaskTime > 0 && (
                        <div className="flex-shrink-0 text-xs text-muted-foreground">
                            {formatDurationWithSeconds(liveTaskTime)}
                        </div>
                    )}

                    <TaskActions
                        task={task}
                        isEditing={isEditing}
                        isTimerActive={isTimerActive}
                        anyTimerActive={isAnyTimerActive}
                        isArchived={isArchived}
                        isCompleted={isCompleted}
                        isRelatedToActiveTimer={isRelatedToActiveTimer}
                        onArchive={onArchive}
                        onUnarchive={onUnarchive}
                        onDelete={onDelete}
                        onToggleBillable={onToggleBillable}
                        onShowTimeEntries={() => setShowTimeEntriesModal(true)}
                        onEdit={handleEditTask}
                    />
                </div>
            )}

            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
            />
        </div>
    );
};

export default SubtaskItem;
