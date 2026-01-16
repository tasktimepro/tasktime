import React, { useState, useMemo, useEffect } from 'react';
import { 
    PencilIcon, 
    TrashIcon,
    ArchiveBoxIcon,
    ClockIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TaskTimer from './TaskTimer.jsx';
import CustomCheckbox from './CustomCheckbox.jsx';
import TimeEntriesModal from './TimeEntriesModal.jsx';
import { formatDurationWithSeconds } from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';
import { deleteTaskWithCleanup } from '../utils/taskUtils';
import { BILLABLE_TIME_THRESHOLD_MS } from '../constants/app';

/**
 * TaskItem component - Displays individual task with timer controls and subtasks
 */
const TaskItem = ({
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    isGlobalTimer = false,
    onDelete,
    onCreateSubtask,
    onArchive,
    onUnarchive,
    onToggleBillable,
    allTasks
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const { showSuccess } = useToast();
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    // Get subtasks for this task
    const subtasks = allTasks.filter(t => t.parentTaskId === task.id);

    // Get time entries for this task
    const taskTimeEntries = timeEntries.filter(entry => entry.taskId === task.id);

    // Get time entries for subtasks
    const subtaskIds = subtasks.map(subtask => subtask.id);

    const subtaskTimeEntries = timeEntries.filter(entry => 
        subtaskIds.includes(entry.taskId)
    );

    // Calculate total time for this task (including subtasks)
    const taskTime = taskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    const subtaskTime = subtaskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    const totalTime = taskTime + subtaskTime;

    // For main tasks, distinguish between main task time and total time with subtasks
    const mainTaskTime = taskTime; // Time logged directly to this task
    const totalTimeWithSubtasks = totalTime; // Main task time + subtask time

    // Check if this task's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;

    // Check if any subtask timer is active
    const subtaskTimerActive = subtasks.some(subtask => 
        currentTimer && currentTimer.taskId === subtask.id
    );

    // Check if task is completed or archived
    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;

    // Task dimming logic:
    // 1. If this task's timer is active, don't dim it
    // 2. If this task's subtask has an active timer, don't dim this task
    // 3. If any timer is active (and not paused) and it's not related to this task, dim it
    // 4. Don't dim archived tasks regardless
    const isRelatedToActiveTimer = isTimerActive || subtaskTimerActive;
    const shouldDimTask = anyTimerActive && !isPaused && !isRelatedToActiveTimer && !isArchived;

    // Check if task has significant billable time since lastBilledAt (for auto-setting as billable)
    const hasSignificantBillableTime = useMemo(() => {
        const taskBillableEntries = taskTimeEntries.filter(entry => {
            if (!entry.end || entry.end <= entry.start) return false;
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            return entry.start > taskLastBilledAt;
        });
        
        // Calculate total time from billable entries
        const totalBillableTime = taskBillableEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);
        
        // Only consider significant if at or above the billable threshold
        return totalBillableTime >= BILLABLE_TIME_THRESHOLD_MS;
    }, [taskTimeEntries, task.lastBilledAt, task.createdAt]);

    // Auto-set task as billable if it has significant billable time (and hasn't been explicitly set by user)
    useEffect(() => {
        // Only auto-set billable status if:
        // 1. Task has significant billable time, AND
        // 2. The billable status hasn't been explicitly set by the user
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            const now = Date.now();
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, billable: true, lastActive: now } : t
            );
            setTasks(updatedTasks);
        }
    }, [hasSignificantBillableTime, task.billable, task.billableSetByUser, task.id, tasks, setTasks]);

    /**
     * Toggle task completion status
     */
    const handleToggleComplete = (checked) => {
        const now = Date.now();
        
        // If timer is active for this task, stop it before completing
        if (isTimerActive && currentTimer) {
            const timeEntry = {
                id: `completion-${Date.now()}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now,
                note: currentTimer.note
            };
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
        }

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: checked, lastActive: now } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Update task title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim(), lastActive: now } : t
        );

        setTasks(updatedTasks);

        setIsEditing(false);
    };

    /**
     * Cancel editing
     */
    const cancelEdit = () => {
        setEditTitle(task.title);
        setIsEditing(false);
    };

    /**
     * Handle creating a subtask
     */
    const handleCreateSubtask = (e) => {
        e.preventDefault();
        
        if (!newSubtaskTitle.trim()) return;

        onCreateSubtask({
            parentTaskId: task.id,
            title: newSubtaskTitle
        });

        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    };

    /**
     * Cancel subtask creation
     */
    const cancelCreateSubtask = () => {
        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    };

    // Calculate active timer display - removed as requested
    // const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`border border-border rounded-lg hover:shadow-md transition-shadow ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
            {/* Main Task */}
            <div className={`p-4 transition-colors ${
                // If we have subtasks or can create them, only round the top corners
                // Otherwise round all corners for a standalone task
                (subtasks.length > 0 || (!task.completed && onCreateSubtask)) ? 'rounded-t-lg' : 'rounded-lg'
            } ${
                (subtaskTimerActive && !isPaused) && !isArchived
                ? 'bg-muted/30 opacity-50 pointer-events-none' 
                : 'hover:bg-muted/40'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Completion Checkbox */}
                        <div className="flex-shrink-0">
                            <CustomCheckbox
                                checked={isCompleted}
                                onChange={handleToggleComplete}
                                disabled={isEditing || isArchived}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                                    <Input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="flex-1 text-sm"
                                        autoFocus
                                        disabled={isCompleted}
                                    />

                                    <Button type="submit" size="sm">
                                        Save
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={cancelEdit}
                                    >
                                        Cancel
                                    </Button>
                                </form>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    <h3 className={`text-sm font-medium truncate ${
                                        isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                                    }`}>
                                        {task.title}
                                    </h3>

                                    {/* Time Display */}
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        {!task.parentTaskId ? (
                                            /* Main task - show both main task time and total time */
                                            <>
                                                {(mainTaskTime > 0 || totalTimeWithSubtasks > 0) && (
                                                    <div className="flex ml-2 items-center space-x-2">
                                                        {mainTaskTime > 0 && (
                                                            <button
                                                                onClick={() => setShowTimeEntriesModal(true)}
                                                                className="hover:bg-muted rounded-md transition-colors"
                                                                title="Click to edit main task time (excluding subtasks)"
                                                                disabled={isCompleted}
                                                            >
                                                                <span className="text-muted-foreground">
                                                                    {formatDurationWithSeconds(mainTaskTime)}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {(totalTimeWithSubtasks > mainTaskTime) && (mainTaskTime > 0) && (
                                                            <span>•</span>
                                                        )}
                                                        {totalTimeWithSubtasks > mainTaskTime && (
                                                            <span 
                                                                className="text-blue-600 font-medium"
                                                                title="Total time including subtasks"
                                                            >
                                                                Total: {formatDurationWithSeconds(totalTimeWithSubtasks)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* Subtask - show only subtask time */
                                            totalTimeWithSubtasks > 0 && (
                                                <button
                                                    onClick={() => setShowTimeEntriesModal(true)}
                                                    className="hover:bg-muted px-2 py-1 rounded-md transition-colors"
                                                    title="Click to edit time"
                                                    disabled={isCompleted}
                                                >
                                                    {formatDurationWithSeconds(totalTimeWithSubtasks)}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center space-x-1">
                            {/* Show timer controls and action buttons conditionally */}
                            {isTimerActive && !isPaused ? (
                                /* Show ONLY timer controls when this timer is actively running (not paused) */
                                <TaskTimer
                                    task={task}
                                    timeEntries={timeEntries}
                                    setTimeEntries={setTimeEntries}
                                    tasks={allTasks || tasks}
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                    isPaused={isPaused}
                                    setIsPaused={setIsPaused}
                                    pausedElapsedTime={pausedElapsedTime}
                                    setPausedElapsedTime={setPausedElapsedTime}
                                    isGlobalTimer={isGlobalTimer}
                                    showTimeDisplay={false}
                                    setTasks={setTasks}
                                />
                            ) : isArchived ? (
                                /* Show unarchive and delete buttons for archived tasks in flex layout */
                                <div className="flex items-center space-x-2">
                                    {onUnarchive && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={onUnarchive}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950 hover:bg-accent dark:hover:bg-blue-900"
                                            title="Unarchive Task"
                                        >
                                            Unarchive
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={onDelete}
                                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900"
                                        title="Delete Task"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            ) : isCompleted ? (
                                /* Only show archive button when completed */
                                !task.parentTaskId && onArchive && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onArchive}
                                        className="h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                                        title="Archive Task"
                                    >
                                        <ArchiveBoxIcon className="h-5 w-5" />
                                    </Button>
                                )
                            ) : anyTimerActive && !isPaused && !isTimerActive ? (
                                /* When any timer is actively running (not paused) and it's not this task's timer, hide all action buttons */
                                null
                            ) : (
                                /* Show all action buttons when not completed and no timer actively running */
                                <>
                                    <TaskTimer
                                        task={task}
                                        timeEntries={timeEntries}
                                        setTimeEntries={setTimeEntries}
                                        tasks={allTasks || tasks}
                                        currentTimer={currentTimer}
                                        setCurrentTimer={setCurrentTimer}
                                        isPaused={isPaused}
                                        setIsPaused={setIsPaused}
                                        pausedElapsedTime={pausedElapsedTime}
                                        setPausedElapsedTime={setPausedElapsedTime}
                                        isGlobalTimer={isGlobalTimer}
                                        showTimeDisplay={false}
                                        setTasks={setTasks}
                                    />

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowTimeEntriesModal(true)}
                                        className="h-8 w-8 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted/40"
                                        title="View Time Entries"
                                    >
                                        <ClockIcon className="h-5 w-5" />
                                    </Button>

                                    {/* Billable Toggle Button - Always show this button */}
                                    {onToggleBillable && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onToggleBillable(task.id)}
                                            className={`h-8 w-8 ${
                                                task.billable
                                                    ? 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 hover:text-purple-700 dark:hover:text-purple-300'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-purple-600 dark:hover:text-purple-400'
                                            }`}
                                            title={
                                                task.billable
                                                    ? 'Mark as not billable'
                                                    : 'Mark as billable'
                                            }
                                        >
                                            <CurrencyDollarIcon className="h-5 w-5" />
                                        </Button>
                                    )}

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-muted-foreground hover:bg-muted/40"
                                                title="More actions"
                                            >
                                                <MoreHorizontal className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => setIsEditing(true)}
                                                className="flex items-center space-x-2 hover:bg-accent hover:text-yellow-600 dark:hover:text-yellow-400"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={onDelete}
                                                className="flex items-center space-x-2 hover:bg-accent hover:text-red-600 dark:hover:text-red-400"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Time Entries Modal */}
            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                allTasks={allTasks}
            />

            {/* Subtasks */}
            {!isArchived && (subtasks.length > 0 || (!task.completed && onCreateSubtask)) && (
                <div className="border-t border-border bg-muted/40 rounded-b-lg">
                    <div className="pl-8 pr-4 py-2 space-y-2">
                        {subtasks.map((subtask) => (
                            <SubtaskItem
                                key={subtask.id}
                                task={subtask}
                                tasks={tasks}
                                setTasks={setTasks}
                                timeEntries={timeEntries}
                                setTimeEntries={setTimeEntries}
                                currentTimer={currentTimer}
                                setCurrentTimer={setCurrentTimer}
                                isPaused={isPaused}
                                setIsPaused={setIsPaused}
                                pausedElapsedTime={pausedElapsedTime}
                                setPausedElapsedTime={setPausedElapsedTime}
                                isGlobalTimer={isGlobalTimer}
                                onToggleBillable={onToggleBillable}
                                allTasks={allTasks}
                                onDelete={() => {
                                    if (window.confirm('Are you sure you want to delete this subtask?')) {
                                        const result = deleteTaskWithCleanup(
                                            subtask.id,
                                            tasks,
                                            timeEntries,
                                            currentTimer,
                                            setTasks,
                                            setTimeEntries,
                                            setCurrentTimer
                                        );
                                        
                                        // Show success toast
                                        showSuccess(`Subtask "${result.taskTitle}" deleted successfully`);
                                    }
                                }}
                            />
                        ))}
                        
                        {/* Add Subtask Section */}
                        {!task.completed && onCreateSubtask && (
                            showCreateSubtaskForm ? (
                                <form onSubmit={handleCreateSubtask} className="space-y-3">
                                    <div className="flex space-x-3">
                                        <Input
                                            type="text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            placeholder="Enter subtask title"
                                            className="flex-1 text-sm"
                                            autoFocus
                                        />
                                        <Button type="submit" size="sm">
                                            Add
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={cancelCreateSubtask}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className={`${
                                    (anyTimerActive && !isPaused && isRelatedToActiveTimer)
                                    ? 'opacity-50 pointer-events-none' 
                                    : ''
                                }`}>
                                    <button
                                        onClick={() => setShowCreateSubtaskForm(true)}
                                        className="w-full text-left py-2 px-3 text-sm text-muted-foreground rounded-md transition-colors border border-dashed border-border hover:bg-muted/40"
                                    >
                                        + Add subtask
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * SubtaskItem component - Displays individual subtask
 */
const SubtaskItem = ({
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    isGlobalTimer = false,
    onToggleBillable,
    onDelete,
    allTasks
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    // Get time entries for this subtask
    const taskTimeEntries = timeEntries.filter(entry => entry.taskId === task.id);

    const totalTime = taskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    // Check if this subtask's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;
    
    // Check if subtask is completed
    const isCompleted = task.completed || false;

    // Check if subtask is archived (either the subtask itself or its parent task)
    const isArchived = task.archived || false;
    
    // For subtasks, we should:
    // 1. Not dim if this subtask's timer is active
    // 2. Only dim if any timer is actively running (not paused) and it's not this subtask's timer
    // 3. Don't dim if the task is archived
    const shouldDimTask = anyTimerActive && !isPaused && !isTimerActive && !isArchived;

    // Check if subtask has significant billable time since lastBilledAt (for auto-setting as billable)
    const hasSignificantBillableTime = useMemo(() => {
        const taskBillableEntries = taskTimeEntries.filter(entry => {
            if (!entry.end || entry.end <= entry.start) return false;
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            return entry.start > taskLastBilledAt;
        });
        
        // Calculate total time from billable entries
        const totalBillableTime = taskBillableEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);
        
        // Only consider significant if at or above the billable threshold
        return totalBillableTime >= BILLABLE_TIME_THRESHOLD_MS;
    }, [taskTimeEntries, task.lastBilledAt, task.createdAt]);

    // Auto-set subtask as billable if it has significant billable time (and hasn't been explicitly set by user)
    useEffect(() => {
        // Only auto-set billable status if:
        // 1. Task has significant billable time, AND
        // 2. The billable status hasn't been explicitly set by the user
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            const now = Date.now();
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, billable: true, lastActive: now } : t
            );
            setTasks(updatedTasks);
        }
    }, [hasSignificantBillableTime, task.billable, task.billableSetByUser, task.id, tasks, setTasks]);

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = (checked) => {
        const now = Date.now();
        
        // If timer is active for this subtask, stop it before completing
        if (isTimerActive && currentTimer) {
            const timeEntry = {
                id: `completion-${Date.now()}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now,
                note: currentTimer.note
            };
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
        }

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: checked, lastActive: now } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Update subtask title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim(), lastActive: now } : t
        );

        setTasks(updatedTasks);

        setIsEditing(false);
    };

    /**
     * Cancel editing
     */
    const cancelEdit = () => {
        setEditTitle(task.title);

        setIsEditing(false);
    };

    // Calculate active timer display - removed as requested
    // const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`flex items-center justify-between py-2 rounded-md hover:bg-muted transition-colors ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-muted/50' : ''}`}>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Completion Checkbox */}
                <div className="flex-shrink-0">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={handleToggleComplete}
                        disabled={isEditing || isArchived}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                            <Input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 text-sm"
                                autoFocus
                                disabled={isCompleted}
                            />

                            <Button type="submit" size="sm">
                                Save
                            </Button>

                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={cancelEdit}
                            >
                                Cancel
                            </Button>
                        </form>
                    ) : (
                        <div className="flex items-center space-x-3">
                            <h4 className={`text-sm truncate ${
                                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                                {task.title}
                            </h4>

                            {/* Time Display - aligned left next to title */}
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                {totalTime > 0 && (
                                    <button
                                        onClick={() => setShowTimeEntriesModal(true)}
                                        className="hover:bg-muted px-2 py-1 rounded-md transition-colors"
                                        title="Click to view time entries"
                                        disabled={isCompleted}
                                    >
                                        {formatDurationWithSeconds(totalTime)}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && (
                <div className="flex items-center space-x-1">
                    {/* Show timer controls and action buttons conditionally */}
                    {isTimerActive && !isPaused ? (
                        /* Show ONLY timer controls when this timer is actively running (not paused) */
                        <TaskTimer
                            task={task}
                            timeEntries={timeEntries}
                            setTimeEntries={setTimeEntries}
                            tasks={allTasks || tasks}
                            currentTimer={currentTimer}
                            setCurrentTimer={setCurrentTimer}
                            isPaused={isPaused}
                            setIsPaused={setIsPaused}
                            pausedElapsedTime={pausedElapsedTime}
                            setPausedElapsedTime={setPausedElapsedTime}
                            isGlobalTimer={isGlobalTimer}
                            showTimeDisplay={false}
                            setTasks={setTasks}
                        />
                    ) : isCompleted ? (
                        /* No actions for completed subtasks */
                        null
                    ) : anyTimerActive && !isPaused && !isTimerActive ? (
                        /* When any timer is actively running (not paused) and it's not this task's timer, hide all action buttons */
                        null
                    ) : (
                        /* Show all action buttons when not completed and no timer actively running */
                        <>
                            <TaskTimer
                                task={task}
                                timeEntries={timeEntries}
                                setTimeEntries={setTimeEntries}
                                tasks={allTasks || tasks}
                                currentTimer={currentTimer}
                                setCurrentTimer={setCurrentTimer}
                                isPaused={isPaused}
                                setIsPaused={setIsPaused}
                                pausedElapsedTime={pausedElapsedTime}
                                setPausedElapsedTime={setPausedElapsedTime}
                                isGlobalTimer={isGlobalTimer}
                                showTimeDisplay={false}
                                setTasks={setTasks}
                            />

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowTimeEntriesModal(true)}
                                className="h-8 w-8 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted/40"
                                title="Edit Time"
                            >
                                <ClockIcon className="h-5 w-5" />
                            </Button>

                            {/* Billable Toggle Button - Always show this button */}
                            {onToggleBillable && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onToggleBillable(task.id)}
                                    className={`h-8 w-8 ${
                                        task.billable
                                            ? 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 hover:text-purple-700 dark:hover:text-purple-300'
                                            : 'text-muted-foreground hover:bg-accent hover:text-purple-600 dark:hover:text-purple-400'
                                    }`}
                                    title={
                                        task.billable
                                            ? 'Mark as not billable'
                                            : 'Mark as billable'
                                    }
                                >
                                    <CurrencyDollarIcon className="h-5 w-5" />
                                </Button>
                            )}
                            
                            {/* Three-dot dropdown menu for Edit and Delete */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-muted-foreground hover:bg-muted/40"
                                        title="More actions"
                                    >
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center space-x-2 hover:bg-accent hover:text-yellow-600 dark:hover:text-yellow-400"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={onDelete}
                                        className="flex items-center space-x-2 hover:bg-accent hover:text-red-600 dark:hover:text-red-400"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                </div>
            )}

            {/* Time Entries Modal */}
            <TimeEntriesModal
                isOpen={showTimeEntriesModal}
                onClose={() => setShowTimeEntriesModal(false)}
                task={task}
                timeEntries={timeEntries}
                setTimeEntries={setTimeEntries}
                allTasks={allTasks}
            />
        </div>
    );
};

export default React.memo(TaskItem);
