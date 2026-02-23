import React, { useMemo, useState, useCallback, useEffect } from 'react';
import TaskHeader from './task/TaskHeader';
import TaskActions from './task/TaskActions';
import StartDateBadge from './task/StartDateBadge';
import SubtaskSection from './task/SubtaskSection';
import TimeEntriesModal from './TimeEntriesModal';
import AddTimeEntryModal from './modals/AddTimeEntryModal';
import { useToast } from '../hooks/useToast';
import { useTasks } from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimers } from '../hooks/useTimers';
import { BILLABLE_TIME_THRESHOLD_MS } from '../constants/app';
import { formatDurationWithSeconds, getTodayString } from '../utils/dateUtils.ts';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * TaskItem component - Displays individual task with timer controls and subtasks.
 * Uses Yjs hooks directly for state management
 * @param {Object} props
 */
const TaskItem = ({
    task,
    recurringCompletionDate,
    onDelete,
    onCreateSubtask,
    onArchive,
    onUnarchive,
    onToggleBillable,
    onEditTask,
    onViewTask
}) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const [showAddEntryModal, setShowAddEntryModal] = useState(false);
    const [addEntryDateStr, setAddEntryDateStr] = useState(null);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskNote, setNewSubtaskNote] = useState('');
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');
    const { showSuccess } = useToast();
    
    // Yjs hooks for state
    const { tasks, updateTask, toggleRecurringCompletion, isCompletedOnDate } = useTasks();
    const { entries: timeEntries, createEntry } = useTimeEntries();
    const { getTimerForTask, clearTimer } = useTimers();

    const subtasks = useMemo(() => {
        return tasks.filter((t) => t.parentTaskId === task.id);
    }, [tasks, task.id]);

    // Compute task state
    const timerKey = task.projectId || task.id;
    const projectTimer = getTimerForTask(task.id, task.projectId);
    const isAnyTimerActive = !!projectTimer;
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isCompleted = task.recurring && recurringCompletionDate
        ? isCompletedOnDate(task, recurringCompletionDate)
        : (task.completed || false);
    const isArchived = task.archived || false;
    
    // Check if this task or any subtask has active timer
    const subtaskIds = useMemo(() => subtasks.map(s => s.id), [subtasks]);
    const isRelatedToActiveTimer = isAnyTimerActive && projectTimer && (
        projectTimer.taskId === task.id || subtaskIds.includes(projectTimer.taskId)
    );
    
    // Should dim if another task (not related) has an active timer
    const shouldDimTask = isAnyTimerActive && !projectTimer?.isPaused && !isRelatedToActiveTimer;

    const effectiveDateStr = useMemo(() => {
        if (!task.recurring) return null;
        return recurringCompletionDate || getTodayString();
    }, [task.recurring, recurringCompletionDate]);

    const getEntryOverlapMs = useCallback((entry, dayStart, dayEnd) => {
        if (!entry || typeof entry.end !== 'number') return 0;
        if (entry.end <= entry.start) return 0;

        const overlapStart = Math.max(entry.start, dayStart);
        const overlapEnd = Math.min(entry.end, dayEnd);

        if (overlapEnd <= overlapStart) return 0;
        return overlapEnd - overlapStart;
    }, []);

    // Calculate total time for this task
    const mainTaskTime = useMemo(() => {
        if (task.recurring && effectiveDateStr) {
            const [year, month, day] = effectiveDateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const dayStart = startOfDay(date).getTime();
            const dayEnd = endOfDay(date).getTime();

            return timeEntries
                .filter(e => e.taskId === task.id)
                .reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);
        }

        return timeEntries
            .filter(e => e.taskId === task.id && typeof e.end === 'number')
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id, task.recurring, effectiveDateStr, getEntryOverlapMs]);

    const liveTaskTime = useMemo(() => {
        const timerTime = isTimerActive ? (projectTimer?.elapsedTime || 0) : 0;
        return mainTaskTime + timerTime;
    }, [mainTaskTime, isTimerActive, projectTimer]);

    // Calculate total time including subtasks
    const totalTimeWithSubtasks = useMemo(() => {
        const allTaskIds = [task.id, ...subtaskIds];

        if (task.recurring && effectiveDateStr) {
            const [year, month, day] = effectiveDateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const dayStart = startOfDay(date).getTime();
            const dayEnd = endOfDay(date).getTime();

            return timeEntries
                .filter(e => allTaskIds.includes(e.taskId))
                .reduce((sum, e) => sum + getEntryOverlapMs(e, dayStart, dayEnd), 0);
        }

        return timeEntries
            .filter(e => allTaskIds.includes(e.taskId) && typeof e.end === 'number')
            .reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [timeEntries, task.id, subtaskIds, task.recurring, effectiveDateStr, getEntryOverlapMs]);

    // Auto-mark billable when significant time logged (post last billed) and user hasn't set it
    const hasSignificantBillableTime = useMemo(() => {
        const cutoff = task.lastBilledAt || task.createdAt || 0;
        const relevantEntries = timeEntries.filter((entry) => {
            if (!entry || typeof entry.end !== 'number') return false;
            if (entry.end <= entry.start) return false;
            if (entry.source === 'invoice-adjustment') return false;
            const belongsToTask = entry.taskId === task.id || subtaskIds.includes(entry.taskId);
            return belongsToTask && entry.start > cutoff;
        });

        const totalBillableMs = relevantEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        return totalBillableMs >= BILLABLE_TIME_THRESHOLD_MS;
    }, [timeEntries, task.id, subtaskIds, task.lastBilledAt, task.createdAt]);

    useEffect(() => {
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            updateTask(task.id, { billable: true, lastActive: Date.now() });
        }
    }, [hasSignificantBillableTime, task.billableSetByUser, task.billable, task.id, updateTask]);

    /**
     * Toggle task completion status.
     * @param {boolean} checked
     */
    const handleToggleComplete = useCallback((checked) => {
        const now = Date.now();

        // If timer is active for this task, stop it and create entry
        if (isTimerActive && projectTimer?.startTime) {
            createEntry({
                taskId: task.id,
                start: projectTimer.startTime,
                end: now,
                note: projectTimer.note
            });
            clearTimer(timerKey);
        }

        if (task.recurring && recurringCompletionDate) {
            toggleRecurringCompletion(task.id, recurringCompletionDate);
            if (checked && task.promptTimeEntry) {
                setAddEntryDateStr(effectiveDateStr);
                setShowAddEntryModal(true);
            }
            return;
        }

        const todayStr = getTodayString();
        updateTask(task.id, {
            completed: checked,
            completedOnDate: checked ? todayStr : null,
            lastActive: now
        });
    }, [isTimerActive, projectTimer, task.id, task.recurring, task.promptTimeEntry, recurringCompletionDate, effectiveDateStr, createEntry, clearTimer, updateTask, toggleRecurringCompletion, timerKey]);

    /**
     * Update task title.
     * @param {Event} e
     */
    const handleUpdateTitle = useCallback((e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        updateTask(task.id, { title: editTitle.trim(), lastActive: Date.now() });
        setIsEditing(false);
    }, [editTitle, task.id, updateTask]);

    /**
     * Cancel editing.
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
        onViewTask(task, { dateStr: recurringCompletionDate || null });
    }, [onViewTask, task, recurringCompletionDate]);

    /**
     * Create a new subtask.
     * @param {Event} e
     */
    const handleCreateSubtask = useCallback((e) => {
        e.preventDefault();

        if (!newSubtaskTitle.trim()) return;

        if (onCreateSubtask) {
            onCreateSubtask({
                parentTaskId: task.id,
                title: newSubtaskTitle,
                note: newSubtaskNote,
                startDate: newSubtaskStartDate || null,
                recurring: null
            });

            setNewSubtaskTitle('');
            setNewSubtaskNote('');
            setNewSubtaskStartDate('');
            setShowCreateSubtaskForm(false);
        }
    }, [newSubtaskTitle, newSubtaskNote, newSubtaskStartDate, task.id, onCreateSubtask]);

    /**
     * Cancel subtask creation.
     */
    const cancelCreateSubtask = useCallback(() => {
        setNewSubtaskTitle('');
        setNewSubtaskNote('');
        setNewSubtaskStartDate('');
        setShowCreateSubtaskForm(false);
    }, []);

    return (
        <div className={`bg-card border border-border rounded-lg overflow-hidden ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
            <div className="p-4">
                <div className="flex items-center justify-between space-x-3">
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
                        totalTimeWithSubtasks={totalTimeWithSubtasks}
                        isSubtask={false}
                        showTimeDisplay={false}
                        showCheckbox={!task.recurring || Boolean(recurringCompletionDate)}
                        onTitleClick={handleViewTask}
                    />

                    {(task.startDate || task.recurring) && (
                        <StartDateBadge
                            startDate={task.startDate}
                            recurring={task.recurring}
                            completed={isCompleted}
                        />
                    )}

                    {liveTaskTime > 0 && (
                        <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
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

            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
            />

            <AddTimeEntryModal
                isOpen={showAddEntryModal}
                onClose={() => {
                    setShowAddEntryModal(false);
                    setAddEntryDateStr(null);
                }}
                task={task}
                initialDateStr={addEntryDateStr}
            />

            {!task.recurring && (
                <SubtaskSection
                    subtasks={subtasks}
                    task={task}
                    onToggleBillable={onToggleBillable}
                    onCreateSubtask={onCreateSubtask}
                    showCreateSubtaskForm={showCreateSubtaskForm}
                    setShowCreateSubtaskForm={setShowCreateSubtaskForm}
                    newSubtaskTitle={newSubtaskTitle}
                    setNewSubtaskTitle={setNewSubtaskTitle}
                    newSubtaskNote={newSubtaskNote}
                    setNewSubtaskNote={setNewSubtaskNote}
                    newSubtaskStartDate={newSubtaskStartDate}
                    setNewSubtaskStartDate={setNewSubtaskStartDate}
                    handleCreateSubtask={handleCreateSubtask}
                    cancelCreateSubtask={cancelCreateSubtask}
                    isArchived={isArchived}
                    anyTimerActive={isAnyTimerActive}
                    isRelatedToActiveTimer={isRelatedToActiveTimer}
                    showSuccess={showSuccess}
                    onEditTask={onEditTask}
                    onViewTask={onViewTask}
                />
            )}
        </div>
    );
};

export default React.memo(TaskItem);
